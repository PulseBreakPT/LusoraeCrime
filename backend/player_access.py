"""Shared player loading rules for HTTP game domains."""
from __future__ import annotations

from fastapi import HTTPException

from db import db


async def get_player(user: dict, allow_pending: bool = False) -> dict:
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    if not player.get("hq"):
        if allow_pending:
            return player
        raise HTTPException(
            status_code=409,
            detail="Estabelece primeiro o teu Quartel-General",
        )
    player["hq"].setdefault("level", 1)
    player["hq"].setdefault("upgrading_until", None)
    player["hq"].setdefault("upgrade_history", [])
    player.setdefault("priorities", {"active": "equilibrio"})
    return player
