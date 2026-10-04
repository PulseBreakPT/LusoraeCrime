import hashlib
import math
import random
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from city_data import (
    WEATHER_STATES, DAYPARTS, CITY_EVENTS, BUSINESS_TYPES, RIVAL_ARCHETYPES,
    SEASON_LENGTH_DAYS, SEASON_ANCHOR_ISO, SEASON_REWARDS,
)

LISBON = ZoneInfo("Europe/Lisbon")


def _utc_now():
    return datetime.now(timezone.utc)


def _parse(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _seed_int(*parts):
    payload = "|".join(str(p) for p in parts)
    return int(hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16], 16)


def _weighted_key(table, seed):
    rows = list(table.items())
    total = sum(max(0, int(cfg.get("weight", 1))) for _, cfg in rows) or 1
    pick = seed % total
    cursor = 0
    for key, cfg in rows:
        cursor += max(0, int(cfg.get("weight", 1)))
        if pick < cursor:
            return key
    return rows[-1][0]


def daypart_key(now=None):
    local = (now or _utc_now()).astimezone(LISBON)
    h = local.hour
    if h < 6:
        return "madrugada"
    if h < 12:
        return "manha"
    if h < 19:
        return "tarde"
    return "noite"


def season_info(now=None):
    now = now or _utc_now()
    anchor = datetime.fromisoformat(SEASON_ANCHOR_ISO)
    span = timedelta(days=SEASON_LENGTH_DAYS)
    elapsed = max(0, (now - anchor).total_seconds())
    index = int(elapsed // span.total_seconds())
    start = anchor + index * span
    end = start + span
    return {
        "id": f"S{index + 1:03d}",
        "number": index + 1,
        "starts_at": start.isoformat(),
        "ends_at": end.isoformat(),
        "remaining_s": max(0, int((end - now).total_seconds())),
    }


def world_context(now=None, region="Portugal"):
    now = now or _utc_now()
    local = now.astimezone(LISBON)
    weather_slot = int(now.timestamp() // (2 * 3600))
    event_slot = int(now.timestamp() // (6 * 3600))
    weather_key = _weighted_key(WEATHER_STATES, _seed_int(region, weather_slot, "weather"))
    event_keys = list(CITY_EVENTS)
    event_key = event_keys[_seed_int(region, event_slot, "event") % len(event_keys)]
    period_key = daypart_key(now)
    weather = WEATHER_STATES[weather_key]
    event = CITY_EVENTS[event_key]
    period = DAYPARTS[period_key]

    chance = {}
    for source in (weather.get("chance", {}), period.get("chance", {}), event.get("chance", {})):
        for category, value in source.items():
            chance[category] = round(chance.get(category, 0.0) + float(value), 4)

    return {
        "generated_at": now.isoformat(),
        "local_time": local.isoformat(),
        "weather": {"key": weather_key, **weather},
        "daypart": {"key": period_key, **period},
        "event": {"key": event_key, **event},
        "modifiers": {
            "chance": chance,
            "travel_mult": round(float(weather.get("travel_mult", 1.0)) * float(period.get("traffic_mult", 1.0)), 4),
            "heat_mult": round(float(weather.get("heat_mult", 1.0)) * float(event.get("heat_mult", 1.0)), 4),
            "reward_mult": round(float(weather.get("reward_mult", 1.0)) * float(period.get("reward_mult", 1.0)) * float(event.get("reward_mult", 1.0)), 4),
            "police_mult": round(float(period.get("police_mult", 1.0)), 4),
        },
        "next_weather_at": datetime.fromtimestamp((weather_slot + 1) * 2 * 3600, tz=timezone.utc).isoformat(),
        "next_event_at": datetime.fromtimestamp((event_slot + 1) * 6 * 3600, tz=timezone.utc).isoformat(),
    }


def city_calendar(now=None, region="Portugal", count=4):
    now = now or _utc_now()
    current_slot = int(now.timestamp() // (6 * 3600))
    event_keys = list(CITY_EVENTS)
    rows = []
    for offset in range(max(1, min(8, int(count)))):
        slot = current_slot + offset
        key = event_keys[_seed_int(region, slot, "event") % len(event_keys)]
        cfg = CITY_EVENTS[key]
        start = datetime.fromtimestamp(slot * 6 * 3600, tz=timezone.utc)
        rows.append({
            "key": key,
            "name": cfg["name"],
            "severity": cfg["severity"],
            "description": cfg["description"],
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=6)).isoformat(),
            "active": offset == 0,
        })
    return rows


def boss_status(player, now=None):
    now = now or _utc_now()
    hospital_raw = player.get("boss_hospital_until")
    sentence_raw = player.get("boss_sentence_until")
    hospital_dt = _parse(hospital_raw)
    sentence_dt = _parse(sentence_raw)
    raw_health = player.get("boss_health", 100)
    health = 100 if raw_health is None else int(raw_health)
    return {
        "health": max(0, min(100, health)),
        "stress": max(0, min(100, int(player.get("boss_stress", 0) or 0))),
        "hospital_until": hospital_raw if hospital_dt and hospital_dt > now else None,
        "sentence_until": sentence_raw if sentence_dt and sentence_dt > now else None,
    }


def boss_leadership_modifier(player, now=None):
    status = boss_status(player, now)
    delta = 0.0
    reasons = []
    if status["sentence_until"]:
        delta -= 0.05
        reasons.append("chefia detida")
    elif status["hospital_until"]:
        delta -= 0.03
        reasons.append("chefia hospitalizada")

    if status["stress"] > 35:
        stress_penalty = min(0.025, (status["stress"] - 35) / 65 * 0.025)
        delta -= stress_penalty
        reasons.append(f"stress {status['stress']}%")
    if status["health"] < 70:
        health_penalty = min(0.015, (70 - status["health"]) / 70 * 0.015)
        delta -= health_penalty
        reasons.append(f"saúde {status['health']}%")

    return {
        "chance_delta": round(max(-0.075, delta), 4),
        "label": " · ".join(reasons) if reasons else "chefia operacional",
        **status,
    }


def operation_world_modifier(category, now=None, region="Portugal"):
    ctx = world_context(now, region)
    return {
        "chance_delta": float(ctx["modifiers"]["chance"].get(category, 0.0)),
        "travel_mult": float(ctx["modifiers"]["travel_mult"]),
        "heat_mult": float(ctx["modifiers"]["heat_mult"]),
        "reward_mult": float(ctx["modifiers"]["reward_mult"]),
        "label": f'{ctx["weather"]["name"]} · {ctx["event"]["name"]}',
        "context": ctx,
    }


def _rival_doc(player_id, idx, archetype, level):
    rng = random.Random(_seed_int(player_id, idx, "rival"))
    power = max(18, min(95, 26 + level * 4 + rng.randint(-7, 15)))
    return {
        "player_id": player_id,
        "key": f"rival_{idx + 1}",
        "name": archetype["name"],
        "style": archetype["style"],
        "focus": archetype["focus"],
        "power": power,
        "hostility": rng.randint(18, 68),
        "intel": 0,
        "relation": "neutral",
        "territory_pressure": rng.randint(8, 34),
        "last_action_at": None,
        "created_at": _utc_now().isoformat(),
    }


async def ensure_rivals(db, player):
    pid = str(player["_id"])
    existing = await db.city_rivals.find({"player_id": pid}).to_list(20)
    if existing:
        return existing
    level = int(player.get("level", 1) or 1)
    docs = [_rival_doc(pid, i, RIVAL_ARCHETYPES[i], level) for i in range(min(5, len(RIVAL_ARCHETYPES)))]
    if docs:
        await db.city_rivals.insert_many(docs)
    return docs


async def advance_rival_world(db, player, rivals, businesses, now=None):
    """Permite que uma organização rival tome uma iniciativa a cada 3 horas.

    O slot é adquirido atomicamente no documento do jogador; abrir o painel
    em dois dispositivos não duplica sabotagens, fugas de informação ou apoio.
    """
    now = now or _utc_now()
    slot = int(now.timestamp() // (3 * 3600))
    pid = str(player["_id"])

    # Primeira sincronização apenas fixa o relógio rival. Não dispara uma
    # agressão imediatamente após a funcionalidade ser criada/ativada.
    if player.get("city_rival_slot") is None:
        grace = await db.players.update_one(
            {"_id": player["_id"], "city_rival_slot": {"$exists": False}},
            {"$set": {"city_rival_slot": slot}},
        )
        if grace.modified_count == 1:
            player["city_rival_slot"] = slot
            return {"kind": "grace", "rival": None, "message": None}

    lock = await db.players.update_one(
        {"_id": player["_id"], "city_rival_slot": {"$lt": slot}},
        {"$set": {"city_rival_slot": slot}},
    )
    if lock.modified_count != 1 or not rivals:
        return None
    player["city_rival_slot"] = slot

    rng = random.Random(_seed_int(pid, slot, "rival-auto"))
    rival = rivals[rng.randrange(len(rivals))]
    relation = rival.get("relation", "neutral")
    name = rival.get("name", "Organização rival")

    if relation == "allied":
        reduction = rng.randint(1, 3)
        old_heat = float(player.get("heat", 0) or 0)
        new_heat = max(0.0, old_heat - reduction)
        await db.players.update_one({"_id": player["_id"]}, {"$set": {"heat": new_heat}})
        player["heat"] = new_heat
        message = f"{name} partilhou informação útil (-{reduction} calor)."
        await db.events.insert_one({"player_id": pid, "kind": "system", "message": message, "ts": now.isoformat()})
        return {"kind": "ally_intel", "rival": name, "message": message}

    if relation == "truce":
        # Uma trégua serve para comprar paz real, não apenas para mudar uma label.
        return {"kind": "truce", "rival": name, "message": None}

    hostility = int(rival.get("hostility", 40) or 40)
    roll = rng.random()
    if businesses and hostility >= 45 and roll < 0.38:
        business = businesses[rng.randrange(len(businesses))]
        security = max(0, min(100, int(business.get("security", 25) or 25)))
        raw_hit = rng.randint(5, 12)
        hit = max(2, int(round(raw_hit * (1 - 0.006 * security))))
        condition = max(20.0, float(business.get("condition", 100) or 100) - hit)
        await db.city_businesses.update_one({"_id": business["_id"]}, {"$set": {"condition": condition}})
        business["condition"] = condition
        await db.city_rivals.update_one(
            {"_id": rival["_id"]},
            {"$set": {"last_action_at": now.isoformat()}, "$inc": {"hostility": 2}},
        )
        rival["hostility"] = min(100, hostility + 2)
        rival["last_action_at"] = now.isoformat()
        message = f"{name} sabotou {business.get('name', 'um negócio')} (-{hit}% condição)."
        await db.events.insert_one({"player_id": pid, "kind": "warning", "message": message, "ts": now.isoformat()})
        return {"kind": "sabotage", "rival": name, "message": message}

    if hostility >= 55 and roll < 0.72:
        heat_gain = rng.randint(2, 5)
        stress_gain = rng.randint(2, 6)
        new_heat = min(100.0, float(player.get("heat", 0) or 0) + heat_gain)
        new_stress = min(100, int(player.get("boss_stress", 0) or 0) + stress_gain)
        fields = {"heat": new_heat, "boss_stress": new_stress}
        consequence = None
        if new_heat >= 88 and rng.random() < 0.12 and not player.get("boss_sentence_until"):
            minutes = rng.randint(15, 45)
            fields["boss_sentence_until"] = (now + timedelta(minutes=minutes)).isoformat()
            consequence = "sentence"
        await db.players.update_one({"_id": player["_id"]}, {"$set": fields})
        player.update(fields)
        await db.city_rivals.update_one(
            {"_id": rival["_id"]},
            {"$set": {"last_action_at": now.isoformat()}, "$inc": {"intel": 1}},
        )
        rival["intel"] = min(10, int(rival.get("intel", 0) or 0) + 1)
        rival["last_action_at"] = now.isoformat()
        message = f"{name} fez circular informação contra a organização (+{heat_gain} calor)."
        if consequence == "sentence":
            message += " O chefe acabou detido temporariamente."
        await db.events.insert_one({"player_id": pid, "kind": "warning", "message": message, "ts": now.isoformat()})
        return {"kind": "leak", "rival": name, "message": message, "consequence": consequence}

    pressure = rng.randint(4, 10)
    new_pressure = min(100, int(rival.get("territory_pressure", 20) or 20) + pressure)
    await db.city_rivals.update_one(
        {"_id": rival["_id"]},
        {
            "$set": {"territory_pressure": new_pressure, "last_action_at": now.isoformat()},
            "$inc": {"intel": 1},
        },
    )
    rival["territory_pressure"] = new_pressure
    rival["intel"] = min(10, int(rival.get("intel", 0) or 0) + 1)
    rival["last_action_at"] = now.isoformat()
    message = f"{name} aumentou a pressão territorial (+{pressure})."
    await db.events.insert_one({"player_id": pid, "kind": "warning", "message": message, "ts": now.isoformat()})
    return {"kind": "pressure", "rival": name, "message": message}


def business_projection(doc, now=None):
    now = now or _utc_now()
    cfg = BUSINESS_TYPES.get(doc.get("type_key"), {})
    level = max(1, int(doc.get("level", 1) or 1))
    last = _parse(doc.get("last_collect_at")) or _parse(doc.get("bought_at")) or now
    hours = max(0.0, min(168.0, (now - last).total_seconds() / 3600))
    efficiency = max(0.35, min(1.35, float(doc.get("condition", 100)) / 100))
    clean = float(cfg.get("clean_h", 0)) * level * hours * efficiency
    dirty = float(cfg.get("dirty_h", 0)) * level * hours * efficiency
    return {
        "hours": round(hours, 3),
        "clean": int(clean),
        "dirty": int(dirty),
        "heat": round(float(cfg.get("heat_h", 0)) * level * hours, 2),
    }


def business_network_effect(businesses, category):
    total = 0.0
    for doc in businesses or []:
        cfg = BUSINESS_TYPES.get(doc.get("type_key"), {})
        base = float((cfg.get("effects") or {}).get(category, 0.0))
        level = max(1, int(doc.get("level", 1) or 1))
        condition = max(0.35, min(1.0, float(doc.get("condition", 100)) / 100))
        total += base * (1 + 0.45 * (level - 1)) * condition
    return min(0.06, round(total, 4))


def _serialize(doc):
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    return out


async def _settle_previous_season(db, player, record):
    """Entrega uma única vez o prémio da época anterior.

    A marca de claim e o crédito são feitos na mesma atualização do jogador,
    evitando prémios duplicados quando dois clientes abrem a Cidade ao mesmo tempo.
    """
    if not record or not record.get("season_id"):
        return None
    pid = str(player["_id"])
    season_id = record["season_id"]
    points = int(record.get("points", 0) or 0)
    ahead = await db.city_season_scores.count_documents({
        "season_id": season_id,
        "points": {"$gt": points},
    })
    rank = ahead + 1
    reward = next((x for x in SEASON_REWARDS if int(x.get("rank", -1)) == rank), None) or {
        "rank": rank, "clean": 0, "respect": 0,
    }
    summary = {
        "season_id": season_id,
        "rank": rank,
        "points": points,
        "clean": int(reward.get("clean", 0) or 0),
        "respect": int(reward.get("respect", 0) or 0),
        "claimed_at": _utc_now().isoformat(),
    }
    result = await db.players.update_one(
        {
            "_id": player["_id"],
            "city_season_rewards_claimed": {"$ne": season_id},
        },
        {
            "$addToSet": {"city_season_rewards_claimed": season_id},
            "$set": {"city_last_season_reward": summary},
            "$inc": {
                "clean_money": summary["clean"],
                "respect": summary["respect"],
            },
        },
    )
    if result.modified_count != 1:
        return player.get("city_last_season_reward")

    player["clean_money"] = int(player.get("clean_money", 0) or 0) + summary["clean"]
    player["respect"] = int(player.get("respect", 0) or 0) + summary["respect"]
    player["city_last_season_reward"] = summary
    if summary["clean"]:
        await db.transactions.insert_one({
            "player_id": pid,
            "kind": "city_season_reward",
            "amount": summary["clean"],
            "currency": "clean",
            "balance_after": player["clean_money"],
            "note": f"Prémio {season_id} · #{rank}",
            "ts": summary["claimed_at"],
        })
    await db.events.insert_one({
        "player_id": pid,
        "kind": "system",
        "message": (
            f"Temporada {season_id} encerrada em #{rank}: "
            f"+{summary['clean']:,} € e +{summary['respect']:,} respeito."
            if summary["clean"] or summary["respect"]
            else f"Temporada {season_id} encerrada em #{rank}."
        ),
        "ts": summary["claimed_at"],
    })
    return summary


async def _season_checkpoint(db, player, season):
    pid = str(player["_id"])
    respect = int(player.get("respect", 0) or 0)
    successes = int((player.get("stats") or {}).get("missions_success", 0) or 0)
    record = await db.city_season_scores.find_one({
        "player_id": pid,
        "season_id": season["id"],
    })
    if not record:
        previous = await db.city_season_scores.find_one(
            {"player_id": pid, "season_id": {"$ne": season["id"]}},
            sort=[("updated_at", -1)],
        )
        if previous:
            await _settle_previous_season(db, player, previous)
        record = {
            "player_id": pid,
            "season_id": season["id"],
            "points": 0,
            "respect_checkpoint": int(player.get("respect", respect) or 0),
            "success_checkpoint": successes,
            "updated_at": _utc_now().isoformat(),
        }
        await db.city_season_scores.update_one(
            {"player_id": pid, "season_id": season["id"]},
            {"$setOnInsert": record},
            upsert=True,
        )
        return record

    delta_respect = max(0, respect - int(record.get("respect_checkpoint", respect)))
    delta_success = max(0, successes - int(record.get("success_checkpoint", successes)))
    gained = delta_respect + delta_success * 12
    if gained:
        record["points"] = int(record.get("points", 0)) + gained
        record["respect_checkpoint"] = respect
        record["success_checkpoint"] = successes
        record["updated_at"] = _utc_now().isoformat()
        await db.city_season_scores.update_one(
            {"player_id": pid, "season_id": season["id"]},
            {"$set": {
                "points": record["points"],
                "respect_checkpoint": respect,
                "success_checkpoint": successes,
                "updated_at": record["updated_at"],
            }},
        )
    return record


async def _leaderboard(db, season_id, player):
    rows = await db.city_season_scores.find({"season_id": season_id}).sort("points", -1).to_list(20)
    player_ids = [r["player_id"] for r in rows]
    players = {}
    if player_ids:
        # bson pertence ao runtime Mongo; o import fica aqui para o motor
        # matemático da Cidade Viva continuar testável sem dependências de BD.
        from bson import ObjectId
        object_ids = [ObjectId(x) for x in player_ids if ObjectId.is_valid(x)]
        if object_ids:
            async for doc in db.players.find({"_id": {"$in": object_ids}}):
                players[str(doc["_id"])] = doc.get("org_name", "Organização")
    board = [
        {
            "rank": idx + 1,
            "player_id": row["player_id"],
            "org_name": players.get(row["player_id"], "Organização"),
            "points": int(row.get("points", 0)),
            "is_you": row["player_id"] == str(player["_id"]),
        }
        for idx, row in enumerate(rows)
    ]
    return board


def _news_from_world(ctx):
    return [
        {
            "id": f'world:{ctx["event"]["key"]}:{ctx["next_event_at"]}',
            "kind": "world",
            "headline": ctx["event"]["name"],
            "body": ctx["event"]["description"],
            "severity": ctx["event"]["severity"],
            "ts": ctx["generated_at"],
        },
        {
            "id": f'weather:{ctx["weather"]["key"]}:{ctx["next_weather_at"]}',
            "kind": "weather",
            "headline": f'Condições: {ctx["weather"]["name"]}',
            "body": ctx["weather"]["description"],
            "severity": "low",
            "ts": ctx["generated_at"],
        },
    ]


async def city_snapshot(db, player):
    now = _utc_now()
    pid = str(player["_id"])
    ctx = world_context(now, player.get("region") or "Portugal")
    rivals = await ensure_rivals(db, player)
    businesses = await db.city_businesses.find({"player_id": pid}).sort("bought_at", 1).to_list(50)
    await advance_rival_world(db, player, rivals, businesses, now)
    projections = [business_projection(b, now) for b in businesses]
    season = season_info(now)
    score = await _season_checkpoint(db, player, season)
    board = await _leaderboard(db, season["id"], player)
    chat = await db.city_chat.find({}).sort("ts", -1).to_list(20)
    alliance = await db.city_alliances.find_one({"member_ids": pid})
    recent_events = await db.events.find({"player_id": pid}).sort("ts", -1).to_list(8)
    pvp_players = await db.players.find({
        "pvp_opt_in": True,
        "_id": {"$ne": player["_id"]},
        "hq": {"$type": "object"},
    }).sort("respect", -1).to_list(20)
    pvp_challenges = await db.city_pvp_challenges.find({
        "$or": [{"attacker_id": pid}, {"defender_id": pid}],
        "status": "pending",
        "expires_at": {"$gt": now.isoformat()},
    }).sort("created_at", -1).to_list(20)

    news = _news_from_world(ctx)
    for event in recent_events[:5]:
        message = str(event.get("message") or "").strip()
        if message:
            news.append({
                "id": f'event:{event.get("_id")}',
                "kind": "organization",
                "headline": "Movimento no submundo",
                "body": message,
                "severity": "medium" if event.get("kind") in {"warning", "police"} else "low",
                "ts": event.get("ts") or now.isoformat(),
            })
    news.sort(key=lambda item: item.get("ts", ""), reverse=True)

    rival_out = []
    for row in rivals:
        d = _serialize(row)
        player_power = max(10, int(player.get("level", 1)) * 7 + int(player.get("respect", 0)) // 700)
        d["threat"] = max(0, min(100, int(d.get("power", 0) + d.get("hostility", 0) * 0.35 - player_power * 0.35)))
        rival_out.append(d)

    business_out = []
    for doc, projection in zip(businesses, projections):
        d = _serialize(doc)
        d["projection"] = projection
        d["config"] = BUSINESS_TYPES.get(doc.get("type_key"), {})
        business_out.append(d)

    return {
        "world": ctx,
        "calendar": city_calendar(now, player.get("region") or "Portugal", 5),
        "season": {
            **season,
            "your_points": int(score.get("points", 0)),
            "leaderboard": board,
            "last_reward": player.get("city_last_season_reward"),
        },
        "news": news[:12],
        "rivals": rival_out,
        "businesses": business_out,
        "business_catalog": BUSINESS_TYPES,
        "business_totals": {
            "unclaimed_clean": sum(p["clean"] for p in projections),
            "unclaimed_dirty": sum(p["dirty"] for p in projections),
            "pending_heat": round(sum(p["heat"] for p in projections), 2),
        },
        "social": {
            "alliance": _serialize(alliance) if alliance else None,
            "chat": [_serialize(x) for x in chat],
            "pvp_opt_in": bool(player.get("pvp_opt_in", False)),
            "pvp_players": [
                {
                    "player_id": str(row["_id"]),
                    "org_name": row.get("org_name", "Organização"),
                    "level": int(row.get("level", 1) or 1),
                    "respect": int(row.get("respect", 0) or 0),
                    "heat": round(float(row.get("heat", 0) or 0), 1),
                }
                for row in pvp_players
            ],
            "pvp_challenges": [
                {
                    **_serialize(x),
                    "is_incoming": x.get("defender_id") == pid,
                    "is_outgoing": x.get("attacker_id") == pid,
                }
                for x in pvp_challenges
            ],
        },
        "boss": boss_status(player, now),
    }
