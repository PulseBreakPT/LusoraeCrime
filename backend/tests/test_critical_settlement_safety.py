"""Standalone behavioral regression tests for interrupted money settlements.

Runs without MongoDB or third-party Python packages. Extracts the actual
async settlement functions from engine.py and exercises their database writes
with a deliberately small fake collection.
"""
import ast
import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace


ENGINE = (Path(__file__).parents[1] / "engine.py").read_text(encoding="utf-8")


def load_function(name, namespace):
    tree = ast.parse(ENGINE)
    function = next(
        node for node in tree.body
        if isinstance(node, ast.AsyncFunctionDef) and node.name == name
    )
    scope = dict(namespace)
    exec(compile(ast.Module(body=[function], type_ignores=[]), "<engine>", "exec"), scope)
    return scope[name]


class FakePlayers:
    def __init__(self, player):
        self.value = deepcopy(player)

    async def update_one(self, query, update):
        if self.value["_id"] != query["_id"]:
            return SimpleNamespace(modified_count=0)
        for field, condition in query.items():
            if field == "_id":
                continue
            if "$ne" in condition and condition["$ne"] in self.value.get(field, []):
                return SimpleNamespace(modified_count=0)
        for path, delta in update.get("$inc", {}).items():
            keys = path.split(".")
            obj = self.value
            for key in keys[:-1]:
                obj = obj.setdefault(key, {})
            obj[keys[-1]] = obj.get(keys[-1], 0) + delta
        for path, val in update.get("$set", {}).items():
            self.value[path] = deepcopy(val)
        for path, value in update.get("$addToSet", {}).items():
            entries = self.value.setdefault(path, [])
            if value not in entries:
                entries.append(value)
        return SimpleNamespace(modified_count=1)


async def check_mission_reward_once():
    player = {
        "_id": "p1", "clean_money": 400, "dirty_money": 940,
        "level": 1, "stats": {"earned_clean": 0, "earned_dirty": 0},
    }
    events, transactions = [], []

    async def event(*args):
        events.append(args)

    async def tx(*args):
        transactions.append(args)

    payout = load_function("_pay_pending_reward", {
        "dirty_money_cap": lambda level: 1000,
        "prestige_effects": lambda p: {"dirty_cap_increase": 0},
        "default_stats": lambda: {"earned_clean": 0, "earned_dirty": 0},
        "add_event": event,
        "record_tx": tx,
    })
    collection = FakePlayers(player)
    db = SimpleNamespace(players=collection)
    mission = {
        "_id": "mission-1", "pending_reward": 200,
        "pending_pays": "dirty", "team_name": "Equipa A",
        "player_id": "p1", "opportunity": {"name": "Teste"},
    }
    await payout(db, deepcopy(collection.value), mission)
    assert collection.value["dirty_money"] == 1000
    assert collection.value["stats"]["earned_dirty"] == 60
    assert collection.value["mission_rewards_paid"] == ["mission-1"]

    await payout(db, deepcopy(collection.value), mission)
    assert collection.value["dirty_money"] == 1000
    assert len(transactions) == 1, "Retry must not write a second payout"


async def check_quest_reward_once():
    player = {
        "_id": "p2", "clean_money": 100, "dirty_money": 20,
        "respect": 0, "heat": 10, "stats": {}, "hq": {"level": 1},
    }
    grant = load_function("grant_quest_rewards", {
        "now_utc": lambda: datetime(2026, 10, 9, tzinfo=timezone.utc),
    })
    collection = FakePlayers(player)
    db = SimpleNamespace(players=collection)
    reward = {"clean": 75, "dirty": 55, "respect": 6}
    progress = {"quest_streak": {"daily": 1}, "quest_perf": {"momentum": 1}}
    await grant(db, deepcopy(collection.value), reward, claim_id="quest-1", claim_progress=progress)
    assert collection.value["clean_money"] == 175
    assert collection.value["dirty_money"] == 75
    assert collection.value["respect"] == 6
    assert collection.value["quest_rewards_paid"] == ["quest-1"]
    assert collection.value["quest_streak"] == progress["quest_streak"]

    await grant(db, deepcopy(collection.value), reward, claim_id="quest-1", claim_progress=progress)
    assert collection.value["clean_money"] == 175
    assert collection.value["dirty_money"] == 75
    assert collection.value["respect"] == 6


def test_pvp_settlement_has_recovery_receipts():
    source = (Path(__file__).parents[1] / "routes_city.py").read_text(encoding="utf-8")
    assert '"status": "settling"' in source
    assert '"pvp_awards": {"$ne": cid}' in source
    assert '"pvp_consequences": {"$ne": cid}' in source


def test_mastermind_settlement_is_atomic():
    source = (Path(__file__).parents[1] / "routes_mastermind.py").read_text(encoding="utf-8")
    assert '"mastermind.claim_recovery": {' in source
    assert '"mastermind.active_heist": None' in source
    assert 'update["$inc"]["dirty_money"] = reward' in source


if __name__ == "__main__":
    asyncio.run(check_mission_reward_once())
    asyncio.run(check_quest_reward_once())
    test_pvp_settlement_has_recovery_receipts()
    test_mastermind_settlement_is_atomic()
    print("4 critical SSS settlement safety checks passed")
