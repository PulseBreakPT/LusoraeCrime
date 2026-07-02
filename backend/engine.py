import math
import random
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from game_data import OPPORTUNITY_TYPES, LISBON_SPOTS, LEVEL_THRESHOLDS


def now_utc():
    return datetime.now(timezone.utc)


def parse_dt(s):
    return datetime.fromisoformat(s)


def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def level_for(respect):
    lvl = 1
    for i, t in enumerate(LEVEL_THRESHOLDS):
        if respect >= t:
            lvl = i + 1
    return lvl


def next_threshold(level):
    return LEVEL_THRESHOLDS[level] if level < len(LEVEL_THRESHOLDS) else None


async def add_event(db, player_id, kind, message):
    await db.events.insert_one({
        "player_id": player_id, "kind": kind, "message": message,
        "ts": now_utc().isoformat(),
    })


async def spawn_opportunities(db, player):
    now = now_utc()
    pid = str(player["_id"])
    active = await db.opportunities.count_documents({
        "player_id": pid, "status": "active", "expires_at": {"$gt": now.isoformat()},
    })
    level = player["level"]
    target = min(5 + level * 2, 14)
    keys = [k for k, v in OPPORTUNITY_TYPES.items() if v["min_level"] <= level]
    weights = [OPPORTUNITY_TYPES[k]["weight"] for k in keys]
    docs = []
    for _ in range(max(0, target - active)):
        key = random.choices(keys, weights=weights)[0]
        t = OPPORTUNITY_TYPES[key]
        spot = random.choice(LISBON_SPOTS)
        mult = (1 + 0.30 * (level - 1)) * random.uniform(0.8, 1.35)
        docs.append({
            "player_id": pid, "type_key": key, "name": t["name"],
            "category": t["category"], "district": spot["name"],
            "lat": spot["lat"] + random.uniform(-0.008, 0.008),
            "lng": spot["lng"] + random.uniform(-0.010, 0.010),
            "reward": int(t["base_reward"] * mult),
            "respect": int(t["respect"] * (1 + 0.15 * (level - 1))),
            "risk": t["risk"], "heat": t["heat"], "pays": t["pays"],
            "duration_s": random.randint(*t["duration_s"]),
            "min_level": t["min_level"], "status": "active",
            "expires_at": (now + timedelta(seconds=random.randint(240, 600))).isoformat(),
            "created_at": now.isoformat(),
        })
    if docs:
        await db.opportunities.insert_many(docs)


def _roll_outcome(player, m):
    t = m["opportunity"]
    chance = 0.92 - t["risk"] * 0.07 + m["team_skill"] * 0.05 - player["heat"] * 0.0015
    if m.get("spec_match"):
        chance += 0.12
    chance = max(0.15, min(0.97, chance))
    if random.random() <= chance:
        return "success"
    return "police" if random.random() < 0.4 else "failure"


def _apply_outcome(player, m, outcome):
    t = m["opportunity"]
    if outcome == "success":
        if t["pays"] == "clean":
            player["clean_money"] += t["reward"]
        else:
            player["dirty_money"] += t["reward"]
        player["respect"] += t["respect"]
        player["heat"] = min(100, player["heat"] + t["heat"])
    elif outcome == "failure":
        player["respect"] += max(1, t["respect"] // 4)
        player["heat"] = min(100, player["heat"] + t["heat"] * 1.5)
    else:
        fine = int(player["dirty_money"] * 0.10)
        player["dirty_money"] -= fine
        player["heat"] = min(100, player["heat"] + t["heat"] * 2)
        m["fine"] = fine


def _outcome_message(m, outcome):
    t = m["opportunity"]
    if outcome == "success":
        symbol = "€" if t["pays"] == "dirty" else "€ limpos"
        return f"{m['team_name']} concluiu {t['name']} em {t['district']}: +{t['reward']:,} {symbol}, +{t['respect']} respeito."
    if outcome == "failure":
        return f"{m['team_name']} falhou {t['name']} em {t['district']}. A operação foi abortada."
    fine = m.get("fine", 0)
    return f"A polícia intercetou {m['team_name']} durante {t['name']} em {t['district']}. Multa de {fine:,} €."


async def _progress_mission(db, player, m, now):
    phase = m["phase"]
    updates = {}
    team_oid = ObjectId(m["team_id"])
    if phase == "en_route" and now >= parse_dt(m["arrive_at"]):
        phase = "operating"
        updates["phase"] = phase
        await db.teams.update_one({"_id": team_oid}, {"$set": {"status": "operating"}})
    if phase == "operating" and now >= parse_dt(m["finish_at"]):
        outcome = _roll_outcome(player, m)
        _apply_outcome(player, m, outcome)
        phase = "returning"
        updates.update({"phase": phase, "outcome": outcome})
        if "fine" in m:
            updates["fine"] = m["fine"]
        await db.teams.update_one({"_id": team_oid}, {"$set": {"status": "returning"}, "$inc": {"missions_done": 1}})
        kind = "success" if outcome == "success" else ("police" if outcome == "police" else "failure")
        await add_event(db, m["player_id"], kind, _outcome_message(m, outcome))
    if phase == "returning" and now >= parse_dt(m["return_at"]):
        phase = "done"
        updates["phase"] = phase
        await db.teams.update_one({"_id": team_oid}, {"$set": {"status": "idle"}})
        await add_event(db, m["player_id"], "team", f"{m['team_name']} regressou à base.")
    if updates:
        await db.missions.update_one({"_id": m["_id"]}, {"$set": updates})


async def advance(db, player):
    now = now_utc()
    pid = str(player["_id"])

    await db.opportunities.update_many(
        {"player_id": pid, "status": "active", "expires_at": {"$lte": now.isoformat()}},
        {"$set": {"status": "expired"}},
    )

    missions = await db.missions.find({"player_id": pid, "phase": {"$ne": "done"}}).to_list(200)
    for m in missions:
        await _progress_mission(db, player, m, now)

    last = parse_dt(player["last_tick"])
    minutes = max(0.0, (now - last).total_seconds() / 60)
    player["heat"] = round(max(0.0, player["heat"] - minutes * 1.2), 2)
    player["level"] = level_for(player["respect"])
    player["last_tick"] = now.isoformat()

    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "heat": player["heat"], "level": player["level"], "last_tick": player["last_tick"],
        "clean_money": player["clean_money"], "dirty_money": player["dirty_money"],
        "respect": player["respect"],
    }})
    await spawn_opportunities(db, player)
    return player
