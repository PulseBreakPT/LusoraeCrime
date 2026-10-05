"""Shared mutation contracts and retry protection for game API domains."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps

from fastapi import HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from db import db


class MutationInput(BaseModel):
    request_id: str | None = Field(default=None, max_length=80)


def idempotent(action_name: str, *, audit_collection: str | None = None):
    """Execute a request-id mutation at most once for a player for 24 hours.

    Domains may opt into a lightweight audit trail without reimplementing the
    retry/receipt protocol.
    """
    def decorator(fn):
        @wraps(fn)
        async def wrapped(*args, **kwargs):
            body = kwargs.get("body")
            if body is None:
                body = next((arg for arg in args if isinstance(arg, BaseModel)), None)
            request_id = getattr(body, "request_id", None)
            user = kwargs.get("user")
            if user is None:
                user = next(
                    (arg for arg in args if isinstance(arg, dict) and "_id" in arg),
                    None,
                )
            if not request_id or not user:
                return await fn(*args, **kwargs)

            key = f"{user['_id']}:{action_name}:{request_id}"
            now = datetime.now(timezone.utc)
            try:
                await db.action_receipts.insert_one({
                    "key": key,
                    "status": "processing",
                    "created_at": now,
                    "expires_at": now + timedelta(hours=24),
                })
            except DuplicateKeyError:
                existing = await db.action_receipts.find_one({"key": key})
                if existing and existing.get("status") == "done":
                    return existing.get("result") or {
                        "ok": True,
                        "idempotent_replay": True,
                    }
                raise HTTPException(
                    status_code=409,
                    detail="Ação já está a ser processada",
                )

            try:
                result = await fn(*args, **kwargs)
            except Exception:
                await db.action_receipts.delete_one({
                    "key": key,
                    "status": "processing",
                })
                raise

            await db.action_receipts.update_one(
                {"key": key},
                {"$set": {"status": "done", "result": result}},
            )
            if audit_collection:
                try:
                    payload = body.model_dump() if body is not None else {}
                    payload.pop("request_id", None)
                    await db[audit_collection].insert_one({
                        "player_user_id": str(user["_id"]),
                        "action": action_name,
                        "payload": payload,
                        "result": result,
                        "ts": datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    # Audit failure must never turn a completed mutation into
                    # an API error (which could encourage a dangerous retry).
                    pass
            return result

        return wrapped
    return decorator
