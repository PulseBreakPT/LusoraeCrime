"""Realtime multiplayer transport for SUBMUNDO.

WebSockets handle low-latency delivery to connected players. Render Key Value
(Valkey/Redis-compatible) is used as a cross-instance pub/sub bus so the API can
scale horizontally without pinning a player to one process.

MongoDB remains the source of truth. Realtime events are notifications: clients
must still use the normal authenticated HTTP mutations for authoritative game
state changes.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import jwt
from bson import ObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from auth import JWT_ALGORITHM, get_jwt_secret
from db import db

try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover - service can still run without Redis
    redis_async = None

router = APIRouter(prefix="/api/realtime", tags=["realtime"])
logger = logging.getLogger(__name__)

BUS_CHANNEL = "submundo:realtime:v1"
ALLOWED_CHANNELS = {"world", "city", "chat", "pvp", "alliance"}
MAX_CLIENT_MESSAGE_BYTES = 8_192


@dataclass
class Connection:
    websocket: WebSocket
    user_id: str
    player_id: str
    alliance_id: str | None = None
    channels: set[str] = field(default_factory=lambda: {"world", "city"})


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[int, Connection] = {}
        self._lock = asyncio.Lock()

    async def add(self, connection: Connection) -> None:
        async with self._lock:
            self._connections[id(connection.websocket)] = connection

    async def remove(self, websocket: WebSocket) -> Connection | None:
        async with self._lock:
            return self._connections.pop(id(websocket), None)

    async def count(self) -> int:
        async with self._lock:
            return len(self._connections)

    async def deliver(self, event: dict[str, Any]) -> None:
        async with self._lock:
            connections = list(self._connections.values())

        # Alliance membership can be revoked without a WebSocket reconnect.
        # Resolve it once per event, from the authoritative DB, before sending
        # potentially private alliance content.
        alliance_members = None
        if event.get("scope") == "alliance":
            target = str(event.get("target") or "")
            alliance = (
                await db.city_alliances.find_one(
                    {"_id": ObjectId(target)}, {"member_ids": 1},
                )
                if ObjectId.is_valid(target) else None
            )
            alliance_members = set((alliance or {}).get("member_ids") or [])

        dead: list[WebSocket] = []
        for connection in connections:
            if alliance_members is not None:
                if connection.player_id not in alliance_members:
                    connection.alliance_id = None
                    continue
                connection.alliance_id = str(event.get("target"))
            if not _event_visible(event, connection):
                continue
            try:
                await connection.websocket.send_json(event)
            except Exception:
                dead.append(connection.websocket)

        for websocket in dead:
            await self.remove(websocket)


hub = RealtimeHub()
_redis = None
_listener_task: asyncio.Task | None = None


def _event_visible(event: dict[str, Any], connection: Connection) -> bool:
    scope = event.get("scope", "global")
    target = str(event.get("target") or "")
    channel = str(event.get("channel") or "world")

    if channel not in connection.channels and channel != "system":
        return False
    if scope == "global":
        return True
    if scope == "player":
        return target == connection.player_id
    if scope == "user":
        return target == connection.user_id
    if scope == "alliance":
        return bool(connection.alliance_id and target == connection.alliance_id)
    return False


def _normalize_channels(raw: Any) -> set[str]:
    if not isinstance(raw, list):
        return set()
    return {str(value) for value in raw if str(value) in ALLOWED_CHANNELS}


def _origin_allowed(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin")
    if not origin:
        # Native clients and some non-browser WebSocket stacks omit Origin.
        return True
    configured = {
        value.strip()
        for value in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
        if value.strip()
    }
    return "*" in configured or origin in configured


async def _authenticate(websocket: WebSocket) -> tuple[dict, dict] | None:
    token = websocket.query_params.get("token") or websocket.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        user_id = str(payload.get("sub") or "")
        if not ObjectId.is_valid(user_id):
            return None
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user or user.get("banned"):
            return None
        if int(payload.get("ver", 0) or 0) != int(user.get("token_version", 0) or 0):
            return None
        player = await db.players.find_one({"user_id": user_id})
        if not player:
            return None
        return user, player
    except (jwt.InvalidTokenError, ValueError):
        return None


async def _alliance_id(player_id: str) -> str | None:
    alliance = await db.city_alliances.find_one({"member_ids": player_id}, {"_id": 1})
    return str(alliance["_id"]) if alliance else None


async def _listen_bus(pubsub) -> None:
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                raw = message.get("data")
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8")
                event = json.loads(raw)
            except Exception:
                logger.warning("Ignored malformed realtime bus payload")
                continue
            await hub.deliver(event)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Realtime bus listener stopped unexpectedly")
    finally:
        try:
            await pubsub.aclose()
        except Exception:
            pass


async def start_realtime() -> None:
    global _redis, _listener_task
    url = os.environ.get("REDIS_URL", "").strip()
    if not url or redis_async is None:
        logger.warning("Realtime running in single-instance mode (REDIS_URL unavailable)")
        return

    try:
        _redis = redis_async.from_url(url, encoding="utf-8", decode_responses=True)
        await _redis.ping()
        pubsub = _redis.pubsub()
        await pubsub.subscribe(BUS_CHANNEL)
        _listener_task = asyncio.create_task(_listen_bus(pubsub), name="submundo-realtime-bus")
        logger.info("Realtime cross-instance bus connected")
    except Exception:
        logger.exception("Could not connect realtime bus; falling back to local delivery")
        _redis = None


async def stop_realtime() -> None:
    global _redis, _listener_task
    if _listener_task:
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
        _listener_task = None
    if _redis:
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None


async def publish_realtime_event(
    event_type: str,
    data: dict[str, Any] | None = None,
    *,
    scope: str = "global",
    target: str | None = None,
    channel: str = "world",
) -> dict[str, Any]:
    """Publish a notification to local and/or remote API instances."""
    event = {
        "id": str(uuid4()),
        "type": str(event_type),
        "channel": channel if channel in ALLOWED_CHANNELS or channel == "system" else "world",
        "scope": scope,
        "target": target,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": data or {},
    }

    if _redis:
        try:
            await _redis.publish(BUS_CHANNEL, json.dumps(event, separators=(",", ":"), default=str))
            return event
        except Exception:
            logger.exception("Realtime publish failed; using local delivery")

    await hub.deliver(event)
    return event


@router.get("/health")
async def realtime_health():
    redis_ok = False
    if _redis:
        try:
            redis_ok = bool(await _redis.ping())
        except Exception:
            redis_ok = False
    return {
        "status": "operational",
        "transport": "websocket",
        "shared_bus": "redis" if redis_ok else "local",
        "connections_local": await hub.count(),
    }


@router.websocket("/ws")
async def realtime_socket(websocket: WebSocket):
    if not _origin_allowed(websocket):
        await websocket.close(code=4403, reason="Origin not allowed")
        return

    auth = await _authenticate(websocket)
    if not auth:
        await websocket.close(code=4401, reason="Authentication required")
        return

    user, player = auth
    user_id = str(user["_id"])
    player_id = str(player["_id"])
    connection = Connection(
        websocket=websocket,
        user_id=user_id,
        player_id=player_id,
        alliance_id=await _alliance_id(player_id),
    )

    await websocket.accept()
    await hub.add(connection)
    await websocket.send_json({
        "type": "realtime.ready",
        "channel": "system",
        "scope": "player",
        "target": player_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        "data": {
            "player_id": player_id,
            "channels": sorted(connection.channels),
            "shared_bus": bool(_redis),
        },
    })
    await publish_realtime_event(
        "presence.changed",
        {"player_id": player_id, "online": True},
        channel="world",
    )

    try:
        while True:
            message = await websocket.receive_text()
            if len(message.encode("utf-8")) > MAX_CLIENT_MESSAGE_BYTES:
                await websocket.close(code=4400, reason="Message too large")
                break
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "data": {"code": "invalid_json"}})
                continue

            msg_type = payload.get("type")
            if msg_type == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "channel": "system",
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
            elif msg_type == "subscribe":
                requested = _normalize_channels(payload.get("channels"))
                connection.channels = {"world"} | requested
                connection.alliance_id = await _alliance_id(player_id)
                await websocket.send_json({
                    "type": "realtime.subscribed",
                    "channel": "system",
                    "data": {"channels": sorted(connection.channels)},
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
            else:
                # Authoritative mutations remain HTTP-only. This prevents a
                # client from forging game state through the realtime channel.
                await websocket.send_json({
                    "type": "error",
                    "channel": "system",
                    "data": {"code": "unsupported_message"},
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
    except WebSocketDisconnect:
        pass
    finally:
        await hub.remove(websocket)
        await publish_realtime_event(
            "presence.changed",
            {"player_id": player_id, "online": False},
            channel="world",
        )
