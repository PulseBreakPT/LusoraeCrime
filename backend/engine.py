import math
import random
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from game_data import (OPPORTUNITY_TYPES, LISBON_SPOTS, LEVEL_THRESHOLDS, EMP_LEVEL_XP,
                       TRAINING_COURSES, PROPERTY_TYPES, VEHICLE_MODELS, SPECIALIZATIONS,
                       BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, CATEGORY_ATTRS, ATTR_KEYS,
                       RARITIES, RARITY_MIN_RESPECT, RANKS, TALENTS, RECRUIT_SOURCES,
                       POOL_REFRESH_MIN, PAYROLL_CYCLE_MIN, random_employee_name)

OUTCOME_PT = {"success": "sucesso", "failure": "falhou", "police": "intercetado pela polícia"}


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


def emp_level_for(xp, rarity="comum"):
    lvl = 1
    for i, t in enumerate(EMP_LEVEL_XP):
        if xp >= t:
            lvl = i + 1
    return min(lvl, RARITIES.get(rarity, RARITIES["comum"])["max_level"])


def next_threshold(level):
    return LEVEL_THRESHOLDS[level] if level < len(LEVEL_THRESHOLDS) else None


def default_stats():
    return {"missions_total": 0, "missions_success": 0, "missions_failure": 0, "missions_police": 0,
            "earned_dirty": 0, "earned_clean": 0, "fines_paid": 0, "laundered_total": 0,
            "by_category": {}}


def betrayal_risk_of(e):
    return max(0, min(100, round((70 - e.get("loyalty", 70)) * 1.2 + (50 - e.get("morale", 70)) * 0.4)))


# ---------------- Geração de pessoas ----------------

def gen_attrs(role_key, rarity):
    sp = SPECIALIZATIONS[role_key]
    attrs = {k: random.randint(1, 3) for k in ATTR_KEYS}
    boost = {"comum": (2, 3), "raro": (3, 4), "elite": (4, 6), "lendario": (6, 8)}[rarity]
    for a in sp["attrs"]:
        attrs[a] = min(10, attrs[a] + random.randint(*boost))
    return attrs


def gen_talents(role_key, rarity):
    r = RARITIES[rarity]
    n = 1 if random.random() < r["talent_chance"] else 0
    if rarity == "elite" and random.random() < 0.5:
        n = 2
    if rarity == "lendario":
        n = random.choice([2, 3])
    n = min(n, r["talent_slots"])
    pref = [k for k, t in TALENTS.items() if not t["roles"] or role_key in t["roles"]]
    rest = [k for k in TALENTS if k not in pref]
    random.shuffle(pref)
    random.shuffle(rest)
    return (pref + rest)[:n]


def gen_candidate(pid, source_key, now_iso):
    src = RECRUIT_SOURCES[source_key]
    rarity = random.choices(list(src["rarity_w"].keys()), weights=list(src["rarity_w"].values()))[0]
    role_key = random.choice(src["roles"])
    sp = SPECIALIZATIONS[role_key]
    attrs = gen_attrs(role_key, rarity)
    talents = gen_talents(role_key, rarity)
    mult = RARITIES[rarity]["mult"]
    return {
        "player_id": pid, "source": source_key, "name": random_employee_name(),
        "age": random.randint(19, 55), "role_key": role_key, "spec": sp["spec"],
        "rarity": rarity, "attrs": attrs, "talents": talents,
        "salary": int(sp["salary"] * mult),
        "cost": int((2000 + sum(attrs.values()) * 180 + len(talents) * 2500) * mult),
        "min_respect": RARITY_MIN_RESPECT[rarity],
        "created_at": now_iso,
    }


def employee_from_candidate(c, now_iso):
    return {
        "player_id": c["player_id"], "name": c["name"], "age": c["age"],
        "role_key": c["role_key"], "spec": c["spec"], "rarity": c["rarity"],
        "rank": "recruta", "level": 1, "xp": 0, "salary": c["salary"],
        "loyalty": 70.0, "morale": 70.0, "fatigue": 0.0,
        "attrs": c["attrs"], "talents": c["talents"],
        "status": "idle", "status_until": None, "team_id": None, "training": None,
        "history": [{"ts": now_iso, "text": f"Recrutado ({RECRUIT_SOURCES[c['source']]['name']})."}],
        "hired_at": now_iso,
    }


def starting_employee(pid, role_key, now_iso, team_id=None):
    sp = SPECIALIZATIONS[role_key]
    return {
        "player_id": pid, "name": random_employee_name(), "age": random.randint(22, 40),
        "role_key": role_key, "spec": sp["spec"], "rarity": "comum",
        "rank": "recruta", "level": 1, "xp": 0, "salary": sp["salary"],
        "loyalty": 75.0, "morale": 75.0, "fatigue": 0.0,
        "attrs": gen_attrs(role_key, "comum"), "talents": [],
        "status": "idle", "status_until": None, "team_id": team_id, "training": None,
        "history": [{"ts": now_iso, "text": "Membro fundador da organização."}],
        "hired_at": now_iso,
    }


def vehicle_doc(pid, model_key, now_iso, team_id=None):
    m = VEHICLE_MODELS[model_key]
    return {
        "player_id": pid, "model_key": model_key, "name": m["name"],
        "fuel_type": m["fuel_type"], "tank_l": float(m["tank_l"]), "fuel_l": float(m["tank_l"]),
        "condition": 100.0, "speed": float(m["speed"]), "cons": float(m["cons"]),
        "price": m["price"], "min_level": m["min_level"],
        "team_id": team_id, "km_total": 0.0, "bought_at": now_iso,
    }


# ---------------- Bónus da organização ----------------

ACTIVE_FOR_PASSIVE = ("idle", "resting", "training", "on_mission")


def org_bonuses(employees):
    b = {"repair_discount": 0.0, "rare_opp": 0.0, "heal": 0.0, "legal": 0.0,
         "launder_rate": 0.0, "empresa_boost": 0.0, "bribe_discount": 0.0}
    for e in employees:
        if e.get("status") not in ACTIVE_FOR_PASSIVE:
            continue
        p = SPECIALIZATIONS.get(e.get("role_key"), {}).get("passive")
        if p:
            for k, v in p.items():
                b[k] = b.get(k, 0) + v
        for t in e.get("talents", []):
            if t == "mecanico_elite":
                b["repair_discount"] += 0.20
            elif t == "olhos_na_rua":
                b["rare_opp"] += 0.10
            elif t == "contabilista_sujo":
                b["launder_rate"] += 0.15
            elif t == "lingua_de_prata":
                b["bribe_discount"] += 0.15
    caps = {"repair_discount": 0.5, "rare_opp": 0.3, "heal": 0.6, "legal": 0.6,
            "launder_rate": 0.2, "empresa_boost": 0.75, "bribe_discount": 0.4}
    return {k: round(min(v, caps[k]), 3) for k, v in b.items()}


async def get_org_bonuses(db, pid):
    employees = await db.employees.find({"player_id": pid}).to_list(300)
    return org_bonuses(employees)


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


async def push_history(db, emp_id, text):
    await db.employees.update_one({"_id": emp_id}, {"$push": {
        "history": {"$each": [{"ts": now_utc().isoformat(), "text": text}], "$slice": -12},
    }})


# ---------------- Oportunidades ----------------

async def spawn_opportunities(db, player, rare_chance=0.0):
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
        rare = random.random() < rare_chance
        if rare:
            mult *= 2.0
        docs.append({
            "player_id": pid, "type_key": key, "name": t["name"],
            "category": t["category"], "district": spot["name"],
            "lat": spot["lat"] + random.uniform(-0.008, 0.008),
            "lng": spot["lng"] + random.uniform(-0.010, 0.010),
            "reward": int(t["base_reward"] * mult),
            "respect": int(t["respect"] * (1 + 0.15 * (level - 1)) * (1.5 if rare else 1.0)),
            "risk": t["risk"], "heat": t["heat"], "pays": t["pays"], "rare": rare,
            "duration_s": random.randint(*t["duration_s"]),
            "min_level": t["min_level"], "status": "active",
            "expires_at": (now + timedelta(seconds=random.randint(240, 600))).isoformat(),
            "created_at": now.isoformat(),
        })
    if docs:
        await db.opportunities.insert_many(docs)


# ---------------- Combate / resolução ----------------

def effective_speed(vehicle):
    c = vehicle["condition"]
    if c >= 50:
        return vehicle["speed"]
    return vehicle["speed"] * (0.6 + 0.4 * c / 50)


def chance_breakdown(heat, risk, team_skill, spec_match, talent_bonus=0.0):
    base = 0.92
    risk_pen = -risk * 0.07
    skill_bonus = team_skill * 0.05
    heat_pen = -heat * 0.0015
    match_bonus = 0.12 if spec_match else 0.0
    chance = max(0.15, min(0.97, base + risk_pen + skill_bonus + heat_pen + match_bonus + talent_bonus))
    return chance, {"base": base, "risco": round(risk_pen, 4), "equipa": round(skill_bonus, 4),
                    "calor": round(heat_pen, 4), "match": round(match_bonus, 4),
                    "talentos": round(talent_bonus, 4)}


def team_effectiveness(members, category):
    def eff(e):
        attrs = e.get("attrs") or {}
        aks = CATEGORY_ATTRS.get(category)
        if aks:
            attr = sum(attrs.get(a, 2) for a in aks) / len(aks)
        else:
            attr = sum(attrs.values()) / max(1, len(attrs)) if attrs else 2
        match = e.get("spec") == category or category == "especial"
        morale_f = 0.75 + e.get("morale", 70) / 400
        try:
            rank_f = 1 + 0.02 * RANKS.index(e.get("rank", "recruta"))
        except ValueError:
            rank_f = 1.0
        return (e["level"] * 0.5 + attr * 0.45) * (1.25 if match else 1.0) * (1 - e["fatigue"] / 250) * morale_f * rank_f
    return sum(eff(e) for e in members) / len(members) + 0.3 * (len(members) - 1)


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
    heat_mult = 0.5 if ("fantasma_digital" in m.get("talents", []) and t["category"] == "tecnica") else 1.0
    if outcome == "success":
        stats["missions_success"] += 1
        if t["pays"] == "clean":
            player["clean_money"] += t["reward"]
            stats["earned_clean"] += t["reward"]
        else:
            player["dirty_money"] += t["reward"]
            stats["earned_dirty"] += t["reward"]
        player["respect"] += t["respect"]
        player["heat"] = min(100, player["heat"] + t["heat"] * heat_mult)
    elif outcome == "failure":
        stats["missions_failure"] += 1
        player["respect"] += max(1, t["respect"] // 4)
        player["heat"] = min(100, player["heat"] + t["heat"] * 1.5 * heat_mult)
    else:
        stats["missions_police"] += 1
        fine = int(player["dirty_money"] * 0.10)
        stats["fines_paid"] += fine
        player["dirty_money"] -= fine
        player["heat"] = min(100, player["heat"] + t["heat"] * 2 * heat_mult)
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
    pid = m["player_id"]
    bonuses = await get_org_bonuses(db, pid)
    members = []
    for emp_id in m.get("member_ids", []):
        emp = await db.employees.find_one({"_id": ObjectId(emp_id)})
        if emp:
            members.append(emp)

    for emp in members:
        match = emp.get("spec") == t["category"] or t["category"] == "especial"
        if outcome == "success":
            xp_gain = int(t["respect"] * 0.5 * (1.5 if match else 1.0))
            d_morale, d_loyal = 2, 1
        elif outcome == "failure":
            xp_gain = max(1, int(t["respect"] * 0.2))
            d_morale, d_loyal = -4, 0
        else:
            xp_gain = max(1, int(t["respect"] * 0.2))
            d_morale, d_loyal = -6, -2
        xp = emp["xp"] + xp_gain
        rarity = emp.get("rarity", "comum")
        new_level = emp_level_for(xp, rarity)
        fat_mult = 0.8 if "rei_da_noite" in emp.get("talents", []) else 1.0
        sets = {
            "xp": xp, "level": new_level,
            "fatigue": min(100.0, emp["fatigue"] + (12 + t["risk"] * 4) * fat_mult),
            "morale": max(0.0, min(100.0, emp.get("morale", 70) + d_morale)),
            "loyalty": max(0.0, min(100.0, emp.get("loyalty", 70) + d_loyal)),
        }
        if new_level > emp["level"]:
            sp = SPECIALIZATIONS.get(emp["role_key"])
            attrs = emp.get("attrs") or {}
            if sp:
                a = random.choice(sp["attrs"])
                attrs[a] = min(10, attrs.get(a, 2) + (new_level - emp["level"]))
                sets["attrs"] = attrs
            talents = list(emp.get("talents", []))
            if len(talents) < RARITIES[rarity]["talent_slots"] and random.random() < 0.5:
                pool = [k for k, tv in TALENTS.items() if k not in talents and (not tv["roles"] or emp["role_key"] in tv["roles"])]
                if pool:
                    new_t = random.choice(pool)
                    talents.append(new_t)
                    sets["talents"] = talents
                    await add_event(db, pid, "team", f"{emp['name']} desbloqueou o talento {TALENTS[new_t]['name']}!")
            await add_event(db, pid, "team", f"{emp['name']} subiu para o nível {new_level}.")
        await db.employees.update_one({"_id": emp["_id"]}, {"$set": sets})
        await push_history(db, emp["_id"], f"{t['name']} em {t['district']}: {OUTCOME_PT[outcome]}.")

    if members:
        if outcome == "failure":
            victim = random.choice(members)
            p = 0.35 if victim["fatigue"] > 70 else 0.2
            if random.random() < p:
                until = (now_utc() + timedelta(seconds=300 * (1 - bonuses["heal"]))).isoformat()
                await db.employees.update_one({"_id": victim["_id"]}, {"$set": {"status": "injured", "status_until": until}})
                await push_history(db, victim["_id"], "Ferido em operação.")
                await add_event(db, pid, "police", f"{victim['name']} ficou ferido durante {t['name']}!")
        elif outcome == "police" and random.random() < 0.3:
            victim = random.choice(members)
            until = (now_utc() + timedelta(seconds=480 * (1 - bonuses["legal"]))).isoformat()
            await db.employees.update_one({"_id": victim["_id"]}, {"$set": {"status": "arrested", "status_until": until}})
            await push_history(db, victim["_id"], "Preso pela polícia.")
            await add_event(db, pid, "police", f"{victim['name']} foi PRESO durante {t['name']}!")

    if m.get("vehicle_id"):
        veh = await db.vehicles.find_one({"_id": ObjectId(m["vehicle_id"])})
        if veh:
            wear = 2 + t["risk"] * 1.5
            inc = {"missions_done": 1}
            if outcome == "success":
                inc["missions_success"] = 1
            await db.vehicles.update_one({"_id": veh["_id"]}, {
                "$set": {"condition": max(0.0, veh["condition"] - wear)},
                "$inc": inc,
            })


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
                {"_id": {"$in": [ObjectId(i) for i in m["member_ids"]]}, "status": "on_mission"},
                {"$set": {"status": "idle"}},
            )
        await add_event(db, m["player_id"], "team", f"{m['team_name']} regressou à base.")
    if updates:
        await db.missions.update_one({"_id": m["_id"]}, {"$set": updates})


# ---------------- Ciclos de vida dos funcionários ----------------

async def _complete_trainings(db, pid, now):
    trainees = await db.employees.find({"player_id": pid, "status": "training"}).to_list(300)
    for e in trainees:
        tr = e.get("training") or {}
        if not tr or parse_dt(tr["ends_at"]) > now:
            continue
        course = TRAINING_COURSES[tr["course_key"]]
        bonus = 1.5 if course.get("spec") and course["spec"] == e.get("spec") else 1.0
        xp = e["xp"] + int(course["xp"] * bonus)
        rarity = e.get("rarity", "comum")
        new_level = emp_level_for(xp, rarity)
        attrs = e.get("attrs") or {}
        if course.get("attr"):
            attrs[course["attr"]] = min(10, attrs.get(course["attr"], 2) + 1)
        sets = {
            "xp": xp, "level": new_level, "status": "idle", "training": None, "attrs": attrs,
            "morale": min(100.0, e.get("morale", 70) + course.get("morale", 0)),
        }
        await db.employees.update_one({"_id": e["_id"]}, {"$set": sets})
        msg = f"{e['name']} concluiu a formação {course['name']}"
        if course.get("attr"):
            msg += f" (+1 {course['attr'].upper()})"
        msg += "."
        if new_level > e["level"]:
            msg += f" Subiu para o nível {new_level}!"
        await push_history(db, e["_id"], f"Formação {course['name']} concluída.")
        await add_event(db, pid, "team", msg)


async def _process_statuses(db, pid, now):
    docs = await db.employees.find({"player_id": pid, "status": {"$in": ["resting", "injured", "arrested"]}}).to_list(300)
    for e in docs:
        su = e.get("status_until")
        if not su or parse_dt(su) > now:
            continue
        sets = {"status": "idle", "status_until": None}
        if e["status"] == "resting":
            sets["fatigue"] = max(0.0, e["fatigue"] - 50)
            sets["morale"] = min(100.0, e.get("morale", 70) + 5)
            msg = f"{e['name']} terminou o descanso."
        elif e["status"] == "injured":
            msg = f"{e['name']} recuperou dos ferimentos."
        else:
            sets["morale"] = max(0.0, e.get("morale", 70) - 5)
            msg = f"{e['name']} cumpriu a pena e saiu da prisão."
        await db.employees.update_one({"_id": e["_id"]}, {"$set": sets})
        await push_history(db, e["_id"], msg)
        await add_event(db, pid, "team", msg)


async def _process_payroll(db, player, employees, now):
    pid = str(player["_id"])
    if not player.get("next_payroll_at"):
        player["next_payroll_at"] = (now + timedelta(minutes=PAYROLL_CYCLE_MIN)).isoformat()
        return
    cycles = 0
    while parse_dt(player["next_payroll_at"]) <= now and cycles < 4:
        cycles += 1
        player["next_payroll_at"] = (parse_dt(player["next_payroll_at"]) + timedelta(minutes=PAYROLL_CYCLE_MIN)).isoformat()
        total = sum(e.get("salary", 0) for e in employees)
        if total <= 0:
            continue
        if player["clean_money"] >= total:
            player["clean_money"] -= total
            await add_event(db, pid, "system", f"Folha salarial paga: -{total:,} €.")
        else:
            await add_event(db, pid, "police", f"Sem fundos para os salários ({total:,} €)! Moral e lealdade em queda.")
            survivors = []
            for e in employees:
                e["loyalty"] = max(0.0, e.get("loyalty", 70) - 8)
                e["morale"] = max(0.0, e.get("morale", 70) - 10)
                if e["loyalty"] <= 10 and e.get("status") == "idle":
                    await db.employees.delete_one({"_id": e["_id"]})
                    await add_event(db, pid, "police", f"{e['name']} abandonou a organização por salários em atraso!")
                else:
                    await db.employees.update_one({"_id": e["_id"]}, {"$set": {"loyalty": e["loyalty"], "morale": e["morale"]}})
                    await push_history(db, e["_id"], "Salário em atraso.")
                    survivors.append(e)
            employees[:] = survivors


async def _process_betrayals(db, player, employees, minutes):
    if minutes <= 0:
        return
    pid = str(player["_id"])
    for e in employees:
        if e.get("status") != "idle" or e.get("loyalty", 70) >= 25:
            continue
        prob = min(0.5, minutes * 0.01 * (25 - e["loyalty"]) / 25)
        if random.random() >= prob:
            continue
        kind = random.choice(["roubo", "fuga_info", "sabotagem", "abandono"])
        if kind == "roubo" and player["dirty_money"] > 500:
            stolen = max(100, int(player["dirty_money"] * 0.05))
            player["dirty_money"] -= stolen
            msg = f"{e['name']} roubou {stolen:,} € do cofre!"
        elif kind == "fuga_info":
            player["heat"] = min(100, player["heat"] + 6)
            msg = f"{e['name']} vendeu informação à polícia (+6 calor)."
        elif kind == "sabotagem":
            veh = await db.vehicles.find_one({"player_id": pid})
            if veh:
                await db.vehicles.update_one({"_id": veh["_id"]}, {"$set": {"condition": max(0.0, veh["condition"] - 20)}})
            msg = f"{e['name']} sabotou um veículo da frota!"
        else:
            await db.employees.delete_one({"_id": e["_id"]})
            await add_event(db, pid, "police", f"{e['name']} abandonou a organização!")
            break
        await db.employees.update_one({"_id": e["_id"]}, {"$set": {"loyalty": min(100.0, e["loyalty"] + 25)}})
        await push_history(db, e["_id"], f"Traição: {kind}.")
        await add_event(db, pid, "police", msg)
        break


async def _refresh_recruitment_pool(db, player, now):
    pr = player.get("pool_refresh_at")
    if pr and parse_dt(pr) > now:
        return
    pid = str(player["_id"])
    await db.candidates.delete_many({"player_id": pid})
    docs = []
    for key, src in RECRUIT_SOURCES.items():
        if player["level"] >= src["min_level"]:
            for _ in range(2):
                docs.append(gen_candidate(pid, key, now.isoformat()))
    if docs:
        await db.candidates.insert_many(docs)
    player["pool_refresh_at"] = (now + timedelta(minutes=POOL_REFRESH_MIN)).isoformat()


# ---------------- Economia passiva / polícia ----------------

async def _apply_passive_income(db, player, props, hours, bonuses):
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
    launder_rate *= (1 + bonuses.get("empresa_boost", 0))

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
        player["frac_launder"] = min(fl - conv, launder_rate)
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
                    share = conv * (pt["launder_per_h"] * p["level"] * (1 + bonuses.get("empresa_boost", 0)) / launder_rate)
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


# ---------------- Tick principal ----------------

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
    await _process_statuses(db, pid, now)

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

    employees = await db.employees.find({"player_id": pid}).to_list(300)
    bonuses = org_bonuses(employees)

    await _process_payroll(db, player, employees, now)
    await _process_betrayals(db, player, employees, minutes)
    await _refresh_recruitment_pool(db, player, now)

    props = await db.properties.find({"player_id": pid}).to_list(200)
    await _apply_passive_income(db, player, props, minutes / 60, bonuses)
    await _maybe_raid(db, player, props, minutes, now)

    player["heat"] = round(max(0.0, player["heat"] - minutes * 1.2), 3)
    player["level"] = level_for(player["respect"])
    player["last_tick"] = now.isoformat()

    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "heat": player["heat"], "level": player["level"], "last_tick": player["last_tick"],
        "clean_money": player["clean_money"], "dirty_money": player["dirty_money"],
        "respect": player["respect"], "stats": player["stats"],
        "raid_cooldown_until": player.get("raid_cooldown_until"),
        "next_payroll_at": player.get("next_payroll_at"),
        "pool_refresh_at": player.get("pool_refresh_at"),
        "frac_dirty": player.get("frac_dirty", 0.0), "frac_clean": player.get("frac_clean", 0.0),
        "frac_launder": player.get("frac_launder", 0.0),
    }})
    await spawn_opportunities(db, player, rare_chance=bonuses.get("rare_opp", 0.0))
    return player
