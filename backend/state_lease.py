"""Per-player state lease shared by simulation ticks and API mutations."""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from time import monotonic

from pymongo import ReturnDocument


async def acquire_player_state_lease(
    db,
    player_id,
    owner: str,
    *,
    ttl_s: float = 120.0,
    wait_s: float = 0.0,
):
    """Atomically acquire the player's write lease and return the fresh document.

    A short wait is useful for user mutations that collide with a lazy state
    tick. Simulation polling itself uses wait_s=0 so duplicate readers do not
    queue a second simulation of the same interval.
    """
    deadline = monotonic() + max(0.0, float(wait_s or 0.0))
    while True:
        now = datetime.now(timezone.utc)
        until = (now + timedelta(seconds=max(5.0, float(ttl_s or 0.0)))).isoformat()
        doc = await db.players.find_one_and_update(
            {
                "_id": player_id,
                "$or": [
                    {"state_lease_owner": owner},
                    {"state_lease_until": {"$exists": False}},
                    {"state_lease_until": None},
                    {"state_lease_until": {"$lte": now.isoformat()}},
                ],
            },
            {"$set": {
                "state_lease_owner": owner,
                "state_lease_until": until,
            }},
            return_document=ReturnDocument.AFTER,
        )
        if doc:
            return doc
        if monotonic() >= deadline:
            return None
        await asyncio.sleep(0.05)


async def release_player_state_lease(db, player_id, owner: str):
    """Release only the lease owned by this caller."""
    await db.players.update_one(
        {"_id": player_id, "state_lease_owner": owner},
        {"$unset": {
            "state_lease_owner": "",
            "state_lease_until": "",
        }},
    )
