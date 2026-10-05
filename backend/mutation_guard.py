"""Shared mutation contracts and retry protection for game API domains."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps

from fastapi import HTTPException
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from db import db
from state_lease import acquire_player_state_lease, release_player_state_lease


class MutationInput(BaseModel):
    request_id: str | None = Field(default=None, max_length=80)


def idempotent(action_name: str, *, audit_collection: str | None = None):
    """Protect a mutation against retries *and* concurrent player-state writes."""
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

            receipt_key = None
            if request_id and user:
                receipt_key = f"{user['_id']}:{action_name}:{request_id}"
                now = datetime.now(timezone.utc)
                try:
                    await db.action_receipts.insert_one({
                        "key": receipt_key,
                        "status": "processing",
                        "created_at": now,
                        "expires_at": now + timedelta(hours=24),
                    })
                except DuplicateKeyError:
                    existing = await db.action_receipts.find_one({"key": receipt_key})
                    if existing and existing.get("status") == "done":
                        return existing.get("result") or {
                            "ok": True,
                            "idempotent_replay": True,
                        }
                    raise HTTPException(
                        status_code=409,
                        detail="Ação já está a ser processada",
                    )

            player_doc = None
            lease_owner = None
            if user:
                player_doc = await db.players.find_one(
                    {"user_id": user["_id"]},
                    {"_id": 1},
                )
            if player_doc:
                suffix = request_id or f"{id(body)}:{id(user)}"
                lease_owner = f"mutation:{action_name}:{suffix}"
                locked = await acquire_player_state_lease(
                    db,
                    player_doc["_id"],
                    lease_owner,
                    ttl_s=120,
                    wait_s=5,
                )
                if not locked:
                    if receipt_key:
                        await db.action_receipts.delete_one({
                            "key": receipt_key,
                            "status": "processing",
                        })
                    raise HTTPException(
                        status_code=409,
                        detail="A organização está a atualizar o estado; repete a ação",
                    )

            try:
                result = await fn(*args, **kwargs)
                if receipt_key:
                    try:
                        await db.action_receipts.update_one(
                            {"key": receipt_key},
                            {"$set": {"status": "done", "result": result}},
                        )
                    except Exception:
                        # The mutation already succeeded. Returning an error here
                        # could encourage a dangerous manual retry.
                        pass
                if audit_collection and user:
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
                        pass
                return result
            except Exception:
                if receipt_key:
                    await db.action_receipts.delete_one({
                        "key": receipt_key,
                        "status": "processing",
                    })
                raise
            finally:
                if player_doc and lease_owner:
                    await release_player_state_lease(
                        db,
                        player_doc["_id"],
                        lease_owner,
                    )

        return wrapped
    return decorator
