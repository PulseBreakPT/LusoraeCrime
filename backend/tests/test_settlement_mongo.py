"""MongoDB integration checks for actual atomic settlement behavior.

Run with MONGO_URL pointing at an isolated MongoDB instance.
"""
import ast
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
import os
from pathlib import Path
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient


ENGINE = (Path(__file__).parents[1] / "engine.py").read_text(encoding="utf-8")


def load_function(name, namespace):
    node = next(
        item for item in ast.parse(ENGINE).body
        if isinstance(item, ast.AsyncFunctionDef) and item.name == name
    )
    scope = dict(namespace)
    exec(compile(ast.Module(body=[node], type_ignores=[]), "<engine>", "exec"), scope)
    return scope[name]


async def run():
    url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    database_name = "submundo_sss_audit_" + uuid4().hex[:10]
    db = client[database_name]
    try:
        await client.admin.command("ping")
        await db.players.insert_one({
            "_id": "player1", "level": 1,
            "clean_money": 200, "dirty_money": 940,
            "stats": {"earned_clean": 0, "earned_dirty": 0},
        })
        events, transactions = [], []

        async def event(*args):
            events.append(args)

        async def tx(*args):
            transactions.append(args)

        mission_reward = load_function("_pay_pending_reward", {
            "dirty_money_cap": lambda _: 1000,
            "prestige_effects": lambda _: {"dirty_cap_increase": 0},
            "default_stats": lambda: {"earned_clean": 0, "earned_dirty": 0},
            "add_event": event,
            "record_tx": tx,
        })
        mission = {
            "_id": "mission1", "pending_reward": 200,
            "pending_pays": "dirty", "team_name": "Crew",
            "player_id": "player1", "opportunity": {"name": "Alvo"},
        }
        snapshot = await db.players.find_one({"_id": "player1"})
        await asyncio.gather(*[
            mission_reward(db, deepcopy(snapshot), mission)
            for _ in range(12)
        ])
        paid = await db.players.find_one({"_id": "player1"})
        assert paid["dirty_money"] == 1000
        assert paid["stats"]["earned_dirty"] == 60
        assert paid["mission_rewards_paid"] == ["mission1"]
        assert len(transactions) == 1

        quest_grant = load_function("grant_quest_rewards", {
            "now_utc": lambda: datetime(2026, 10, 9, tzinfo=timezone.utc),
        })
        quest = {"dirty": 17, "clean": 83, "respect": 4}
        progress = {"quest_streak": {"daily": 2}, "quest_perf": {"momentum": 3}}
        snapshot = await db.players.find_one({"_id": "player1"})
        await asyncio.gather(*[
            quest_grant(
                db, deepcopy(snapshot), quest,
                claim_id="quest1", claim_progress=progress,
            )
            for _ in range(12)
        ])
        paid = await db.players.find_one({"_id": "player1"})
        assert paid["dirty_money"] == 1017
        assert paid["clean_money"] == 283
        assert paid["respect"] == 4
        assert paid["quest_rewards_paid"] == ["quest1"]
        assert paid["quest_streak"] == progress["quest_streak"]
        print("MongoDB: 24 concurrent mission and quest grants settled once")
    finally:
        await client.drop_database(database_name)
        client.close()


if __name__ == "__main__":
    asyncio.run(run())
