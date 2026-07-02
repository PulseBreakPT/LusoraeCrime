import math
import random
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from game_data import (OPPORTUNITY_TYPES, LISBON_SPOTS, LEVEL_THRESHOLDS, EMP_LEVEL_XP,
                       TRAINING_COURSES, PROPERTY_TYPES, VEHICLE_MODELS, EMPLOYEE_ROLES,
                       BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, CATEGORY_ATTRS, random_employee_name)


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


def emp_level_for(xp):
    lvl = 1
    for i, t in enumerate(EMP_LEVEL_XP):
        if xp >= t:
            lvl = i + 1
    return lvl


def next_threshold(level):
    return LEVEL_THRESHOLDS[level] if level < len(LEVEL_THRESHOLDS) else None


def vehicle_doc(pid, model_key, now_iso, team_id=None):
    m = VEHICLE_MODELS[model_key]
    return {
        "player_id": pid, "model_key": model_key, "name": m["name"],
        "fuel_type": m["fuel_type"], "tank_l": float(m["tank_l"]), "fuel_l": float(m["tank_l"]),
        "condition": 100.0, "speed": float(m["speed"]), "cons": float(m["cons"]),
        "price": m["price"], "min_level": m["min_level"],
        "team_id": team_id, "km_total": 0.0, "bought_at": now_iso,
    }


def employee_doc(pid, role_key, now_iso, team_id=None):
    role = EMPLOYEE_ROLES[role_key]
    attrs = {k: random.randint(1, 3) for k in ("forca", "destreza", "qi", "carisma")}
    attrs[role["attr"]] = min(10, attrs[role["attr"]] + 2)
    return {
        "player_id": pid, "name": random_employee_name(), "role_key": role_key,
        "spec": role["spec"], "level": 1, "xp": 0, "fatigue": 0.0, "attrs": attrs,
        "status": "idle", "team_id": team_id, "training": None, "hired_at": now_iso,
    }


def default_stats():
    return {"missions_total": 0, "missions_success": 0, "missions_failure": 0, "missions_police": 0,
            "earned_dirty": 0, "earned_clean": 0, "fines_paid": 0, "laundered_total": 0,
            "by_category": {}}


def effective_speed(vehicle):
    c = vehicle["condition"]
    if c >= 50:
        return vehicle["speed"]
    return vehicle["speed"] * (0.6 + 0.4 * c / 50)


def chance_breakdown(heat, risk, team_skill, spec_match):
    base = 0.92
    risk_pen = -risk * 0.07
    skill_bonus = team_skill * 0.05
    heat_pen = -heat * 0.0015
    match_bonus = 0.12 if spec_match else 0.0
    chance = max(0.15, min(0.97, base + risk_pen + skill_bonus + heat_pen + match_bonus))
    return chance, {"base": base, "risco": round(risk_pen, 4), "equipa": round(skill_bonus, 4),
                    "calor": round(heat_pen, 4), "match": round(match_bonus, 4)}


def team_effectiveness(members, category):
    def eff(e):
        attrs = e.get("attrs") or {}
        ak = CATEGORY_ATTRS.get(category)
        attr = attrs.get(ak, 2) if ak else (sum(attrs.values()) / 4 if attrs else 2)
        match = e["spec"] == category or category == "especial"
        return (e["level"] * 0.6 + attr * 0.5) * (1.25 if match else 1.0) * (1 - e["fatigue"] / 250)
    return sum(eff(e) for e in members) / len(members) + 0.3 * (len(members) - 1)


async def get_caps(db, pid):
    props = await db.properties.find({"player_id": pid}).to_list(200)
    emp_cap = BASE_EMPLOYEE_CAP + sum(PROPERTY_TYPES[p["type_key"]].get("cap_employees", 0) * p["level"] for p in props)
    veh_cap = BASE_VEHICLE_CAP + sum(PROPERTY_TYPES[p["type_key"]].get("cap_vehicles", 0) * p["level"] for p in props)
    return {"employees": emp_cap, "vehicles": veh_cap}, props


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
    chance = m.get("success_chance")
    if chance is None:
        chance, _ = chance_breakdown(player["heat"], m["opportunity"]["risk"], m["team_skill"], m.get("spec_match", False))
    if random.random() <= chance:
        return "success"
    return "police" if random.random() < 0.4 else "failure"


def _apply_outcome(player, m, outcome):
    t = m["opportunity"]
    stats = player.setdefault("stats", default_stats())
    stats["missions_total"] += 1
    stats["by_category"][t["category"]] = stats["by_category"].get(t["category"], 0) + 1
    if outcome == "success":
        stats["missions_success"] += 1
        if t["pays"] == "clean":
            player["clean_money"] += t["reward"]
            stats["earned_clean"] += t["reward"]
        else:
            player["dirty_money"] += t["reward"]
            stats["earned_dirty"] += t["reward"]
        player["respect"] += t["respect"]
        player["heat"] = min(100, player["heat"] + t["heat"])
    elif outcome == "failure":
        stats["missions_failure"] += 1
        player["respect"] += max(1, t["respect"] // 4)
        player["heat"] = min(100, player["heat"] + t["heat"] * 1.5)
    else:
        stats["missions_police"] += 1
        fine = int(player["dirty_money"] * 0.10)
        stats["fines_paid"] += fine
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


async def _crew_returns(db, m, outcome):
    t = m["opportunity"]
    for emp_id in m.get("member_ids", []):
        emp = await db.employees.find_one({"_id": ObjectId(emp_id)})
        if not emp:
            continue
        match = emp["spec"] == t["category"] or t["category"] == "especial"
        if outcome == "success":
            xp_gain = int(t["respect"] * 0.5 * (1.5 if match else 1.0))
        else:
            xp_gain = max(1, int(t["respect"] * 0.2))
        xp = emp["xp"] + xp_gain
        new_level = emp_level_for(xp)
        if new_level > emp["level"]:
            await add_event(db, m["player_id"], "team", f"{emp['name']} subiu para o nível {new_level}.")
        await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
            "xp": xp, "level": new_level,
            "fatigue": min(100.0, emp["fatigue"] + 12 + t["risk"] * 4),
        }})
    if m.get("vehicle_id"):
        veh = await db.vehicles.find_one({"_id": ObjectId(m["vehicle_id"])})
        if veh:
            wear = 2 + t["risk"] * 1.5
            await db.vehicles.update_one({"_id": veh["_id"]}, {"$set": {"condition": max(0.0, veh["condition"] - wear)}})


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
        await _crew_returns(db, m, outcome)
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
        if m.get("member_ids"):
            await db.employees.update_many(
                {"_id": {"$in": [ObjectId(i) for i in m["member_ids"]]}},
                {"$set": {"status": "idle"}},
            )
        await add_event(db, m["player_id"], "team", f"{m['team_name']} regressou à base.")
    if updates:
        await db.missions.update_one({"_id": m["_id"]}, {"$set": updates})


async def _complete_trainings(db, pid, now):
    trainees = await db.employees.find({"player_id": pid, "status": "training"}).to_list(200)
    for e in trainees:
        tr = e.get("training") or {}
        if not tr or parse_dt(tr["ends_at"]) > now:
            continue
        course = TRAINING_COURSES[tr["course_key"]]
        bonus = 1.5 if course["spec"] == e["spec"] else 1.0
        xp = e["xp"] + int(course["xp"] * bonus)
        new_level = emp_level_for(xp)
        sets = {
            "xp": xp, "level": new_level, "status": "idle", "training": None,
            "fatigue": max(0.0, e["fatigue"] - course.get("fatigue_relief", 0)),
        }
        attrs = e.get("attrs") or {}
        gained_attr = None
        if course.get("attr"):
            attrs[course["attr"]] = min(10, attrs.get(course["attr"], 2) + 1)
            gained_attr = course["attr"]
        if new_level > e["level"]:
            role_attr = EMPLOYEE_ROLES[e["role_key"]]["attr"]
            attrs[role_attr] = min(10, attrs.get(role_attr, 2) + (new_level - e["level"]))
        if attrs:
            sets["attrs"] = attrs
        await db.employees.update_one({"_id": e["_id"]}, {"$set": sets})
        msg = f"{e['name']} concluiu a formação {course['name']}."
        if gained_attr:
            msg += f" +1 {gained_attr.upper()}."
        if new_level > e["level"]:
            msg += f" Subiu para o nível {new_level}!"
        await add_event(db, pid, "team", msg)



async def _apply_passive_income(db, player, props, hours):
    if hours <= 0:
        return
    dirty_rate = 0
    heat_rate = 0
    launder_rate = 0
    for p in props:
        pt = PROPERTY_TYPES[p["type_key"]]
        if pt.get("dirty_per_h"):
            share = pt["dirty_per_h"] * p["level"] * hours
            dirty_rate += pt["dirty_per_h"] * p["level"]
            await db.properties.update_one({"_id": p["_id"]}, {"$inc": {"total_dirty_generated": share}})
        if pt.get("heat_per_h"):
            heat_rate += pt["heat_per_h"] * p["level"]
        if pt.get("launder_per_h"):
            launder_rate += pt["launder_per_h"] * p["level"]

    if dirty_rate > 0:
        fd = player.get("frac_dirty", 0.0) + dirty_rate * hours
        gain = int(fd)
        player["frac_dirty"] = fd - gain
        player["dirty_money"] += gain
    if heat_rate > 0:
        player["heat"] = min(100.0, player["heat"] + heat_rate * hours)
    if launder_rate > 0 and player["dirty_money"] > 0:
        fl = player.get("frac_launder", 0.0) + launder_rate * hours
        conv = min(player["dirty_money"], int(fl))
        player["frac_launder"] = fl - int(fl) if player["dirty_money"] >= int(fl) else 0.0
        if conv > 0:
            player["dirty_money"] -= conv
            player.setdefault("stats", default_stats())
            player["stats"]["laundered_total"] = player["stats"].get("laundered_total", 0) + conv
            fc = player.get("frac_clean", 0.0) + conv * 0.9
            gain = int(fc)
            player["frac_clean"] = fc - gain
            player["clean_money"] += gain
            for p in props:
                pt = PROPERTY_TYPES[p["type_key"]]
                if pt.get("launder_per_h"):
                    share = conv * (pt["launder_per_h"] * p["level"] / launder_rate)
                    await db.properties.update_one({"_id": p["_id"]}, {"$inc": {"total_laundered": share}})


async def _maybe_raid(db, player, props, minutes, now):
    if player["heat"] < 70 or player["dirty_money"] <= 0:
        return
    labs = [p for p in props if p["type_key"] == "laboratorio"]
    if not labs:
        return
    cooldown = player.get("raid_cooldown_until")
    if cooldown and parse_dt(cooldown) > now:
        return
    prob = min(0.5, minutes * 0.02 * (player["heat"] - 60) / 40)
    if random.random() >= prob:
        return
    lab = random.choice(labs)
    seized = int(player["dirty_money"] * 0.25)
    player["dirty_money"] -= seized
    player["heat"] = max(0.0, player["heat"] - 15)
    player.setdefault("stats", default_stats())
    player["stats"]["fines_paid"] += seized
    player["raid_cooldown_until"] = (now + timedelta(minutes=10)).isoformat()
    await add_event(db, str(player["_id"]), "police",
                    f"RUSGA POLICIAL ao {lab['name']}! Apreenderam {seized:,} € sujos.")


async def advance(db, player):
    now = now_utc()
    pid = str(player["_id"])
    player.setdefault("stats", default_stats())

    await db.opportunities.update_many(
        {"player_id": pid, "status": "active", "expires_at": {"$lte": now.isoformat()}},
        {"$set": {"status": "expired"}},
    )

    missions = await db.missions.find({"player_id": pid, "phase": {"$ne": "done"}}).to_list(200)
    for m in missions:
        await _progress_mission(db, player, m, now)

    await _complete_trainings(db, pid, now)

    last = parse_dt(player["last_tick"])
    minutes = max(0.0, (now - last).total_seconds() / 60)

    if minutes > 0:
        rec = minutes * 0.6
        await db.employees.update_many(
            {"player_id": pid, "status": "idle", "fatigue": {"$gt": 0}},
            {"$inc": {"fatigue": -rec}},
        )
        await db.employees.update_many(
            {"player_id": pid, "fatigue": {"$lt": 0}},
            {"$set": {"fatigue": 0.0}},
        )

    props = await db.properties.find({"player_id": pid}).to_list(200)
    await _apply_passive_income(db, player, props, minutes / 60)
    await _maybe_raid(db, player, props, minutes, now)

    player["heat"] = round(max(0.0, player["heat"] - minutes * 1.2), 3)
    player["level"] = level_for(player["respect"])
    player["last_tick"] = now.isoformat()

    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "heat": player["heat"], "level": player["level"], "last_tick": player["last_tick"],
        "clean_money": player["clean_money"], "dirty_money": player["dirty_money"],
        "respect": player["respect"], "stats": player["stats"],
        "raid_cooldown_until": player.get("raid_cooldown_until"),
        "frac_dirty": player.get("frac_dirty", 0.0), "frac_clean": player.get("frac_clean", 0.0),
        "frac_launder": player.get("frac_launder", 0.0),
    }})
    await spawn_opportunities(db, player)
    return player
