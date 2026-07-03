import random
from datetime import datetime, timezone, timedelta

from quests_data import (QUEST_DEFS, QUEST_ORDER, DAILY_POOL, WEEKLY_POOL,
                         DYNAMIC_KEYS, EVENT_KEYS, DECISION_KEYS)


def _now():
    return datetime.now(timezone.utc)


def _parse(s):
    return datetime.fromisoformat(s)


async def _event(db, pid, kind, message):
    await db.events.insert_one({"player_id": pid, "kind": kind, "message": message, "ts": _now().isoformat()})


def stat_value(stats, metric):
    cur = stats
    for part in metric.split("."):
        cur = cur.get(part, 0) if isinstance(cur, dict) else 0
    return cur if isinstance(cur, (int, float)) else 0


def make_instance(pid, key, now, stats, expires_s=None):
    d = QUEST_DEFS[key]
    obj = d["objective"]
    baseline = {}
    if obj["kind"] == "counter":
        baseline[obj["metric"]] = stat_value(stats, obj["metric"])
    exp = d.get("duration_s") or expires_s
    return {
        "player_id": pid, "quest_key": key, "status": "active",
        "progress": 0.0, "target": float(obj["target"]), "baseline": baseline,
        "choice": None, "outcome": None,
        "activated_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=exp)).isoformat() if exp else None,
        "completed_at": None, "claimed_at": None,
    }


def enrich_quest(qd):
    d = QUEST_DEFS.get(qd.get("quest_key"), {})
    obj = d.get("objective", {})
    qd.update({
        "name": d.get("name"), "desc": d.get("desc"), "type": d.get("type"),
        "category": d.get("category"), "chapter": d.get("chapter"),
        "difficulty": d.get("difficulty"), "rewards": d.get("rewards", {}),
        "unlocks_text": d.get("unlocks_text"),
        "objective_label": obj.get("label"), "direction": obj.get("direction", "gte"),
        "order": QUEST_ORDER.get(qd.get("quest_key"), 999),
    })
    if d.get("type") == "decisao":
        qd["options"] = {k: {"label": o["label"]} for k, o in d.get("options", {}).items()}
    return qd


def locked_principals(existing_keys, level):
    out = []
    for key, d in QUEST_DEFS.items():
        if d["type"] != "principal" or key in existing_keys:
            continue
        out.append(enrich_quest({
            "id": None, "quest_key": key, "status": "locked",
            "progress": 0.0, "target": float(d["objective"]["target"]),
        }))
    return out


def _trigger_met(trigger, player, ctx):
    kind = trigger["kind"]
    if kind == "vehicles_damaged":
        return sum(1 for v in ctx["vehicles"] if v["condition"] < trigger["below"]) >= trigger["count"]
    if kind == "dirty_above":
        return player["dirty_money"] > trigger["amount"]
    if kind == "fatigued_employees":
        return sum(1 for e in ctx["employees"] if e.get("fatigue", 0) > trigger["above"]) >= trigger["count"]
    if kind == "heat_above":
        return player["heat"] >= trigger["value"]
    if kind == "avg_morale_below":
        emps = ctx["employees"]
        return bool(emps) and sum(e.get("morale", 70) for e in emps) / len(emps) < trigger["value"]
    return False


async def _state_value(db, player, ctx, metric):
    if metric == "heat_below":
        return player["heat"]
    if metric == "level_at_least":
        return player["level"]
    if metric.startswith("prop_count:"):
        t = metric.split(":", 1)[1]
        return sum(1 for p in ctx["props"] if p["type_key"] == t)
    if metric == "vehicle_count":
        return len(ctx["vehicles"])
    if metric == "active_ops":
        return await db.missions.count_documents({
            "player_id": str(player["_id"]), "phase": {"$in": ["en_route", "operating"]},
        })
    return 0


async def process_quests(db, player, ctx):
    now = _now()
    pid = str(player["_id"])
    stats = player.get("stats", {})
    quests = await db.quests.find({"player_id": pid}).to_list(400)
    by_key = {}
    for q in quests:
        by_key.setdefault(q["quest_key"], []).append(q)

    new_docs = []

    # missões principais (cadeia)
    for key, d in QUEST_DEFS.items():
        if d["type"] != "principal" or key in by_key:
            continue
        if player["level"] < d.get("min_level", 1):
            continue
        reqs = d.get("requires", [])
        if all(any(q["status"] == "claimed" for q in by_key.get(r, [])) for r in reqs):
            new_docs.append(make_instance(pid, key, now, stats))

    # diárias
    dr = player.get("quests_daily_at")
    if not dr or _parse(dr) <= now:
        await db.quests.update_many(
            {"player_id": pid, "status": "active", "quest_key": {"$in": DAILY_POOL}},
            {"$set": {"status": "expired"}},
        )
        pool = [k for k in DAILY_POOL if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
        for key in random.sample(pool, min(3, len(pool))):
            new_docs.append(make_instance(pid, key, now, stats, expires_s=86400))
        player["quests_daily_at"] = (now + timedelta(hours=24)).isoformat()
        if dr:
            await _event(db, pid, "system", "Novas missões diárias disponíveis.")

    # semanais
    wr = player.get("quests_weekly_at")
    if not wr or _parse(wr) <= now:
        await db.quests.update_many(
            {"player_id": pid, "status": "active", "quest_key": {"$in": WEEKLY_POOL}},
            {"$set": {"status": "expired"}},
        )
        pool = [k for k in WEEKLY_POOL if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
        for key in random.sample(pool, min(2, len(pool))):
            new_docs.append(make_instance(pid, key, now, stats, expires_s=7 * 86400))
        player["quests_weekly_at"] = (now + timedelta(days=7)).isoformat()
        if wr:
            await _event(db, pid, "system", "Novas missões semanais disponíveis.")

    # dinâmicas (sugeridas pelo estado do jogo)
    for key in DYNAMIC_KEYS:
        d = QUEST_DEFS[key]
        if any(q["status"] in ("active", "completed") for q in by_key.get(key, [])):
            continue
        if player["level"] < d.get("min_level", 1):
            continue
        if _trigger_met(d["trigger"], player, ctx):
            new_docs.append(make_instance(pid, key, now, stats, expires_s=7200))
            await _event(db, pid, "system", f"Missão sugerida: {d['name']} — {d['desc']}")

    # eventos temporários
    active_event = any(q["status"] == "active" and q["quest_key"] in EVENT_KEYS for q in quests)
    if not active_event:
        ne = player.get("next_event_at")
        if not ne:
            player["next_event_at"] = (now + timedelta(minutes=random.randint(5, 20))).isoformat()
        elif _parse(ne) <= now:
            pool = [k for k in EVENT_KEYS if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
            key = random.choice(pool)
            d = QUEST_DEFS[key]
            new_docs.append(make_instance(pid, key, now, stats))
            player["next_event_at"] = (now + timedelta(seconds=d.get("duration_s", 2700))
                                       + timedelta(minutes=random.randint(30, 60))).isoformat()
            await _event(db, pid, "police", f"EVENTO: {d['name']} — {d['desc']}")

    # decisões aleatórias
    minutes = ctx.get("minutes", 0)
    has_decision = any(q["status"] == "active" and q["quest_key"] in DECISION_KEYS for q in quests)
    if not has_decision and player["level"] >= 2 and minutes > 0:
        if random.random() < min(0.2, minutes * 0.02):
            key = random.choice(DECISION_KEYS)
            new_docs.append(make_instance(pid, key, now, stats, expires_s=1800))
            await _event(db, pid, "intel", f"DECISÃO: {QUEST_DEFS[key]['name']} — abre o painel de Missões.")

    if new_docs:
        await db.quests.insert_many(new_docs)
        quests.extend(new_docs)

    # progresso e conclusão
    for q in quests:
        if q["status"] != "active":
            continue
        d = QUEST_DEFS.get(q["quest_key"])
        if not d:
            continue
        if q.get("expires_at") and _parse(q["expires_at"]) <= now:
            await db.quests.update_one({"_id": q["_id"]}, {"$set": {"status": "expired"}})
            continue
        if d["type"] == "decisao":
            continue
        obj = d["objective"]
        if obj["kind"] == "counter":
            cur = stat_value(stats, obj["metric"]) - q.get("baseline", {}).get(obj["metric"], 0)
        else:
            cur = await _state_value(db, player, ctx, obj["metric"])
        done = cur <= obj["target"] if obj.get("direction") == "lte" else cur >= obj["target"]
        sets = {}
        if round(float(cur), 2) != q.get("progress"):
            sets["progress"] = round(float(cur), 2)
        if done:
            sets.update({"status": "completed", "completed_at": now.isoformat()})
            await _event(db, pid, "success", f"Missão concluída: {d['name']} — reclama a recompensa!")
        if sets:
            await db.quests.update_one({"_id": q["_id"]}, {"$set": sets})
