import random
from datetime import timedelta
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from auth import get_current_user
from db import db
from engine import add_event, dirty_money_cap, now_utc, parse_dt, police_force_for, record_tx
from street_data import (
    ACTIVITIES, APPROACHES, CITY_EVENTS, CONTACTS, ESCAPE_PLANS, GEAR, WAGERS,
    city_event, clamp_chance, street_rank, wanted_stars,
)


router = APIRouter(prefix="/api/game/street", tags=["street"])


class StreetPlanInput(BaseModel):
    approach_key: str
    escape_key: str
    gear_keys: list[str] = Field(default_factory=list, max_length=2)


class GearBuyInput(BaseModel):
    gear_key: str
    quantity: int = Field(default=1, ge=1, le=5)


class TerritoryInput(BaseModel):
    district_key: str
    action: str


class ContactInput(BaseModel):
    contact_key: str
    vehicle_id: str | None = None


class ActivityStartInput(BaseModel):
    job_key: str
    district_key: str
    vehicle_id: str
    wager_key: str | None = None


class ActivityClaimInput(BaseModel):
    job_id: str


class GarageInput(BaseModel):
    vehicle_id: str
    action: str


def _oid(value, message="Identificador inválido"):
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail=message)


def _future(value, now):
    return bool(value and parse_dt(value) > now)


def _remaining(value, now):
    if not value:
        return 0
    return max(0, int((parse_dt(value) - now).total_seconds()))


async def _player(user, require_hq=True):
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    if require_hq and not player.get("hq"):
        raise HTTPException(status_code=409, detail="Estabelece primeiro o teu Quartel-General")
    return player


def _district_seed(player):
    source = player.get("districts") or []
    if not source:
        hq = player.get("hq") or {}
        source = [{
            "key": "hq",
            "name": hq.get("name") or player.get("region") or "Área do QG",
            "lat": hq.get("lat"),
            "lng": hq.get("lng"),
        }]
    return source


def _ensure_street(player, now):
    street = dict(player.get("street") or {})
    street.setdefault("version", 1)
    street.setdefault("rep", 0)
    street.setdefault("income_at", now.isoformat())
    street.setdefault("race_streak", 0)
    street.setdefault("search_until", None)
    street.setdefault("intel_until", None)
    street.setdefault("fixer_boost", 0)
    street.setdefault("active_job", None)
    street.setdefault("history", [])
    street.setdefault("gear", {key: 0 for key in GEAR})
    street.setdefault("plan", {"approach_key": "balanced", "escape_key": "speed", "gear_keys": []})
    street.setdefault("contacts", {})
    street.setdefault("districts", {})

    for key in GEAR:
        street["gear"].setdefault(key, 0)
    for key in CONTACTS:
        street["contacts"].setdefault(key, {"favor": 0, "cooldown_until": None})

    for index, district in enumerate(_district_seed(player)):
        key = str(district.get("key") or f"d{index + 1}")
        entry = street["districts"].setdefault(key, {
            "name": district.get("name") or f"Zona {index + 1}",
            "influence": 0.0,
            "tier": 0,
            "rival_pressure": 0.0,
            "defend_cooldown_until": None,
        })
        entry["name"] = district.get("name") or entry.get("name") or f"Zona {index + 1}"
        entry.setdefault("influence", 0.0)
        entry.setdefault("tier", 0)
        entry.setdefault("rival_pressure", 0.0)
        entry.setdefault("defend_cooldown_until", None)

    player["street"] = street
    return street


async def _save_street(player, *, heat=None):
    sets = {"street": player["street"]}
    if heat is not None:
        player["heat"] = max(0.0, min(100.0, float(heat)))
        sets["heat"] = player["heat"]
    await db.players.update_one({"_id": player["_id"]}, {"$set": sets})


async def _charge_clean(player, cost, kind, note):
    cost = max(0, int(cost))
    if cost == 0:
        return
    updated = await db.players.find_one_and_update(
        {"_id": player["_id"], "clean_money": {"$gte": cost}},
        {"$inc": {"clean_money": -cost}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=400, detail=f"Dinheiro limpo insuficiente — precisas de {cost:,} €")
    player["clean_money"] = updated["clean_money"]
    await record_tx(
        db, str(player["_id"]), kind, -cost, "clean",
        player["clean_money"], note,
    )


async def _owned_vehicle(player, vehicle_id):
    vehicle = await db.vehicles.find_one({
        "_id": _oid(vehicle_id, "Veículo inválido"),
        "player_id": str(player["_id"]),
    })
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    return vehicle


async def _process_street(player, now):
    """Avança apenas os sistemas urbanos. O tick principal continua responsável
    pelas missões, calor base, salários e propriedades existentes."""
    was_missing = not bool(player.get("street"))
    street = _ensure_street(player, now)
    changed = was_missing

    # Um veículo regressa automaticamente da apreensão quando o prazo termina.
    await db.vehicles.update_many(
        {
            "player_id": str(player["_id"]),
            "impounded_until": {"$ne": None, "$lte": now.isoformat()},
        },
        {"$set": {"impounded_until": None}},
    )

    # Procurado de 3+ estrelas inicia uma janela de busca. A janela não é
    # estendida em cada poll; pode terminar se o calor entretanto tiver caído.
    stars = wanted_stars(player.get("heat", 0))
    if stars >= 3 and not _future(street.get("search_until"), now):
        street["search_until"] = (now + timedelta(seconds=55 + stars * 35)).isoformat()
        changed = True
    elif stars < 2 and street.get("search_until") and not _future(street["search_until"], now):
        street["search_until"] = None
        changed = True

    # Rendimentos e pressão rival são liquidados em blocos de 5 minutos para
    # impedir milhares de microtransações durante o polling.
    last_income = parse_dt(street.get("income_at") or now.isoformat())
    elapsed_s = max(0.0, (now - last_income).total_seconds())
    dirty_income = 0
    clean_income = 0
    lost_names = []
    if elapsed_s >= 300:
        hours = min(24.0, elapsed_s / 3600)
        for district in street["districts"].values():
            tier = int(district.get("tier", 0) or 0)
            if tier <= 0:
                continue
            dirty_income += int(320 * tier * hours)
            clean_income += int(70 * max(0, tier - 1) * hours)
            pressure = float(district.get("rival_pressure", 0) or 0)
            pressure += hours * (2.5 + tier * 1.5)
            if pressure >= 100:
                district["tier"] = max(0, tier - 1)
                district["influence"] = max(30.0, float(district.get("influence", 0)) - 35)
                district["rival_pressure"] = 42.0
                lost_names.append(district["name"])
            else:
                district["rival_pressure"] = round(pressure, 2)
        # O rendimento territorial respeita o mesmo limite de dinheiro
        # sujo usado pelas propriedades e recompensas do jogo principal.
        dirty_room = max(0, dirty_money_cap(player.get("level", 1)) - int(player.get("dirty_money", 0)))
        dirty_income = min(dirty_income, dirty_room)
        street["income_at"] = now.isoformat()
        changed = True

    active = street.get("active_job")
    if active and active.get("status") == "running" and not _future(active.get("finish_at"), now):
        active["status"] = "ready"
        changed = True

    update = {"$set": {"street": street}}
    increments = {}
    if dirty_income:
        increments["dirty_money"] = dirty_income
        player["dirty_money"] = player.get("dirty_money", 0) + dirty_income
    if clean_income:
        increments["clean_money"] = clean_income
        player["clean_money"] = player.get("clean_money", 0) + clean_income
    if increments:
        update["$inc"] = increments
    if changed or increments:
        await db.players.update_one({"_id": player["_id"]}, update)

    if dirty_income:
        await record_tx(
            db, str(player["_id"]), "territory_income", dirty_income, "dirty",
            player["dirty_money"], "Rendimento agregado dos territórios",
        )
    if clean_income:
        await record_tx(
            db, str(player["_id"]), "territory_front_income", clean_income, "clean",
            player["clean_money"], "Fachadas dos territórios consolidados",
        )
    for name in lost_names:
        await add_event(db, str(player["_id"]), "police", f"Uma fação rival recuperou terreno em {name}.")
    return street


def _rank_payload(street):
    rank = street_rank(street.get("rep", 0))
    rank["progress_pct"] = 100
    if rank["next_rep"]:
        current_floor = rank["min_rep"]
        span = rank["next_rep"] - current_floor
        rank["progress_pct"] = round((rank["rep"] - current_floor) / max(1, span) * 100, 1)
    return rank


def _public_job(job, now):
    if not job:
        return None
    result = dict(job)
    started = parse_dt(job["started_at"])
    finish = parse_dt(job["finish_at"])
    duration = max(1.0, (finish - started).total_seconds())
    elapsed = max(0.0, min(duration, (now - started).total_seconds()))
    result["progress_pct"] = round(elapsed / duration * 100, 1)
    result["remaining_s"] = max(0, int((finish - now).total_seconds()))
    return result


async def _snapshot(player, now):
    street = await _process_street(player, now)
    rank = _rank_payload(street)
    event = city_event(str(player["_id"]), now)
    vehicles = await db.vehicles.find({"player_id": str(player["_id"])}).to_list(200)

    districts = []
    for key, value in street["districts"].items():
        row = {"key": key, **value}
        row["controlled"] = int(value.get("tier", 0) or 0) > 0
        row["defend_remaining_s"] = _remaining(value.get("defend_cooldown_until"), now)
        row["income_per_h"] = 320 * int(value.get("tier", 0) or 0)
        districts.append(row)

    contacts = []
    for key, cfg in CONTACTS.items():
        saved = street["contacts"][key]
        contacts.append({
            "key": key,
            **cfg,
            "favor": int(saved.get("favor", 0) or 0),
            "cooldown_until": saved.get("cooldown_until"),
            "remaining_s": _remaining(saved.get("cooldown_until"), now),
            "unlocked": rank["level"] >= cfg["unlock_rank"],
        })

    vehicle_meta = []
    for vehicle in vehicles:
        until = vehicle.get("impounded_until")
        vehicle_meta.append({
            "vehicle_id": str(vehicle["_id"]),
            "notoriety": round(float(vehicle.get("street_notoriety", 0) or 0), 1),
            "insured": bool(vehicle.get("insured", False)),
            "impounded_until": until,
            "impounded": _future(until, now),
            "impound_remaining_s": _remaining(until, now),
        })

    hottest = max(districts, key=lambda item: item.get("rival_pressure", 0), default=None)
    hq = player.get("hq") or {}
    stars = wanted_stars(player.get("heat", 0))
    search_until = street.get("search_until")
    return {
        "server_time": now.isoformat(),
        "wanted": {
            "stars": stars,
            "heat": round(float(player.get("heat", 0)), 1),
            "search_active": _future(search_until, now),
            "search_until": search_until,
            "remaining_s": _remaining(search_until, now),
        },
        "rank": rank,
        "event": event,
        "scanner": {
            "force": police_force_for(hq.get("lat", 38.72), hq.get("lng", -9.14)),
            "alert": "máximo" if stars >= 5 else "elevado" if stars >= 3 else "moderado" if stars else "baixo",
            "hot_district": hottest["name"] if hottest else None,
            "intel_active": _future(street.get("intel_until"), now),
            "intel_remaining_s": _remaining(street.get("intel_until"), now),
        },
        "districts": sorted(districts, key=lambda item: (-item["tier"], -item["influence"], item["name"])),
        "contacts": contacts,
        "activities": [{"key": key, **value, "unlocked": rank["level"] >= value["unlock_rank"]}
                       for key, value in ACTIVITIES.items()],
        "wagers": [{"key": key, **value, "unlocked": rank["level"] >= value["unlock_rank"]}
                   for key, value in WAGERS.items()],
        "approaches": [{"key": key, **value, "unlocked": rank["level"] >= value["unlock_rank"]}
                       for key, value in APPROACHES.items()],
        "escape_plans": [{"key": key, **value, "unlocked": rank["level"] >= value["unlock_rank"]}
                         for key, value in ESCAPE_PLANS.items()],
        "gear_catalog": [{
            "key": key, **value,
            "owned": int(street["gear"].get(key, 0) or 0),
            "current_price": int(value["price"] * event.get("gear_mult", 1.0)),
            "unlocked": rank["level"] >= value["unlock_rank"],
        } for key, value in GEAR.items()],
        "plan": street["plan"],
        "active_job": _public_job(street.get("active_job"), now),
        "race_streak": int(street.get("race_streak", 0) or 0),
        "fixer_boost": int(street.get("fixer_boost", 0) or 0),
        "history": list(street.get("history", []))[:20],
        "vehicle_meta": vehicle_meta,
        "balances": {
            "clean_money": player.get("clean_money", 0),
            "dirty_money": player.get("dirty_money", 0),
            "heat": player.get("heat", 0),
        },
    }


@router.get("/state")
async def street_state(user: dict = Depends(get_current_user)):
    player = await _player(user, require_hq=False)
    if not player.get("hq"):
        return {"hq_pending": True, "server_time": now_utc().isoformat()}
    return await _snapshot(player, now_utc())


@router.post("/plan")
async def save_plan(body: StreetPlanInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    street = await _process_street(player, now)
    rank = street_rank(street.get("rep", 0))["level"]

    approach = APPROACHES.get(body.approach_key)
    escape = ESCAPE_PLANS.get(body.escape_key)
    if not approach or rank < approach["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Abordagem indisponível")
    if not escape or rank < escape["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Plano de fuga indisponível")

    gear_keys = list(dict.fromkeys(body.gear_keys))
    if len(gear_keys) > 2:
        raise HTTPException(status_code=400, detail="Podes preparar no máximo dois equipamentos")
    for key in gear_keys:
        cfg = GEAR.get(key)
        if not cfg or rank < cfg["unlock_rank"]:
            raise HTTPException(status_code=400, detail="Equipamento indisponível")
        if int(street["gear"].get(key, 0) or 0) < 1:
            raise HTTPException(status_code=400, detail=f"Não tens {cfg['name']} no inventário")

    street["plan"] = {
        "approach_key": body.approach_key,
        "escape_key": body.escape_key,
        "gear_keys": gear_keys,
    }
    await _save_street(player)
    return {"ok": True, "plan": street["plan"]}


@router.post("/gear/buy")
async def buy_gear(body: GearBuyInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    street = await _process_street(player, now)
    rank = street_rank(street.get("rep", 0))["level"]
    cfg = GEAR.get(body.gear_key)
    if not cfg or rank < cfg["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Equipamento ainda bloqueado")
    event = city_event(str(player["_id"]), now)
    unit = int(cfg["price"] * event.get("gear_mult", 1.0))
    cost = unit * body.quantity
    await _charge_clean(player, cost, "street_gear", f"{body.quantity}× {cfg['name']}")
    street["gear"][body.gear_key] = int(street["gear"].get(body.gear_key, 0) or 0) + body.quantity
    await _save_street(player)
    return {"ok": True, "owned": street["gear"][body.gear_key], "cost": cost}


@router.post("/territory")
async def territory_action(body: TerritoryInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    street = await _process_street(player, now)
    district = street["districts"].get(body.district_key)
    if not district:
        raise HTTPException(status_code=404, detail="Zona não encontrada")
    rank = street_rank(street.get("rep", 0))["level"]
    action = body.action
    message = ""

    if action == "claim":
        if int(district.get("tier", 0) or 0) > 0:
            raise HTTPException(status_code=400, detail="A zona já está sob controlo")
        if float(district.get("influence", 0) or 0) < 100:
            raise HTTPException(status_code=400, detail="Precisas de 100 de influência para assumir a zona")
        cost = 5000
        await _charge_clean(player, cost, "territory_claim", f"Tomada de {district['name']}")
        district.update({"tier": 1, "influence": 40.0, "rival_pressure": 20.0})
        street["rep"] = int(street.get("rep", 0) or 0) + 35
        message = f"{district['name']} passou para o controlo da organização."
    elif action == "reinforce":
        tier = int(district.get("tier", 0) or 0)
        if tier <= 0:
            raise HTTPException(status_code=400, detail="Controla primeiro esta zona")
        if tier >= 3:
            raise HTTPException(status_code=400, detail="A zona já está no nível máximo")
        required = 90 + tier * 20
        if float(district.get("influence", 0) or 0) < required:
            raise HTTPException(status_code=400, detail=f"Precisas de {required} de influência para consolidar")
        cost = 6000 * tier
        await _charge_clean(player, cost, "territory_reinforce", f"Consolidação de {district['name']}")
        district.update({"tier": tier + 1, "influence": 45.0, "rival_pressure": max(0.0, district["rival_pressure"] - 20)})
        street["rep"] = int(street.get("rep", 0) or 0) + 30 * tier
        message = f"{district['name']} foi consolidada para o nível {tier + 1}."
    elif action == "defend":
        if int(district.get("tier", 0) or 0) <= 0:
            raise HTTPException(status_code=400, detail="Não controlas esta zona")
        if _future(district.get("defend_cooldown_until"), now):
            raise HTTPException(status_code=400, detail="A defesa desta zona ainda está a reorganizar-se")
        if float(district.get("rival_pressure", 0) or 0) < 5:
            raise HTTPException(status_code=400, detail="Não existe pressão rival relevante")
        await _charge_clean(player, 1500, "territory_defend", f"Defesa de {district['name']}")
        chance = min(0.9, 0.58 + rank * 0.04 - float(district["rival_pressure"]) * 0.001)
        success = random.random() < chance
        district["defend_cooldown_until"] = (now + timedelta(minutes=5)).isoformat()
        if success:
            district["rival_pressure"] = max(0.0, float(district["rival_pressure"]) - 38)
            district["influence"] = min(150.0, float(district["influence"]) + 10)
            street["rep"] = int(street.get("rep", 0) or 0) + 14
            message = f"A pressão rival em {district['name']} foi travada."
        else:
            district["rival_pressure"] = min(100.0, float(district["rival_pressure"]) + 14)
            await _save_street(player, heat=player.get("heat", 0) + 4)
            message = f"A defesa de {district['name']} falhou e chamou atenção."
            await add_event(db, str(player["_id"]), "police", message)
            return {"ok": True, "success": False, "message": message}
    else:
        raise HTTPException(status_code=400, detail="Ação territorial inválida")

    await _save_street(player)
    await add_event(db, str(player["_id"]), "team", message)
    return {"ok": True, "success": True, "message": message}


@router.post("/contacts/call")
async def call_contact(body: ContactInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    street = await _process_street(player, now)
    cfg = CONTACTS.get(body.contact_key)
    rank = street_rank(street.get("rep", 0))["level"]
    if not cfg or rank < cfg["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Contacto ainda bloqueado")
    saved = street["contacts"][body.contact_key]
    if _future(saved.get("cooldown_until"), now):
        raise HTTPException(status_code=400, detail=f"Contacto indisponível durante {_remaining(saved['cooldown_until'], now)}s")

    message = ""
    heat = player.get("heat", 0)
    if body.contact_key == "fixer":
        street["fixer_boost"] = min(3, int(street.get("fixer_boost", 0) or 0) + 1)
        message = "A Ponte garantiu um pagamento superior para a próxima atividade."
    elif body.contact_key == "mechanic":
        if not body.vehicle_id:
            raise HTTPException(status_code=400, detail="Escolhe um veículo para a assistência")
        vehicle = await _owned_vehicle(player, body.vehicle_id)
        if _future(vehicle.get("impounded_until"), now):
            raise HTTPException(status_code=400, detail="A oficina não consegue aceder a um veículo apreendido")
        await db.vehicles.update_one(
            {"_id": vehicle["_id"]},
            {"$set": {"condition": 100.0, "fuel_l": vehicle["tank_l"], "refueling_until": None}},
        )
        message = f"{vehicle['name']} foi reparado e abastecido no terreno."
    elif body.contact_key == "lawyer":
        heat = max(0.0, heat - 25)
        arrested = await db.employees.find_one({
            "player_id": str(player["_id"]), "status": "arrested",
        })
        if arrested:
            await db.employees.update_one(
                {"_id": arrested["_id"]},
                {"$set": {"status": "idle", "status_until": None}},
            )
            message = f"{arrested['name']} foi libertado e o calor desceu 25 pontos."
        else:
            message = "A Linha Cinzenta limpou registos e reduziu o calor em 25 pontos."
        street["search_until"] = None
    elif body.contact_key == "informant":
        street["intel_until"] = (now + timedelta(minutes=15)).isoformat()
        for district in street["districts"].values():
            district["rival_pressure"] = max(0.0, float(district.get("rival_pressure", 0)) - 10)
        message = "O scanner tem inteligência reforçada durante 15 minutos."

    saved["favor"] = int(saved.get("favor", 0) or 0) + 1
    saved["cooldown_until"] = (now + timedelta(seconds=cfg["cooldown_s"])).isoformat()
    street["rep"] = int(street.get("rep", 0) or 0) + 6
    await _save_street(player, heat=heat)
    await add_event(db, str(player["_id"]), "intel", message)
    return {"ok": True, "message": message, "favor": saved["favor"]}


@router.post("/garage")
async def garage_action(body: GarageInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    await _process_street(player, now)
    vehicle = await _owned_vehicle(player, body.vehicle_id)
    notoriety = float(vehicle.get("street_notoriety", 0) or 0)
    action = body.action

    if action == "plates":
        if notoriety <= 0:
            raise HTTPException(status_code=400, detail="Este veículo não tem notoriedade para limpar")
        cost = max(1200, int(notoriety * 95))
        await _charge_clean(player, cost, "fake_plates", f"Matrículas frias para {vehicle['name']}")
        await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"street_notoriety": 0.0}})
        message = f"{vehicle['name']} recebeu matrículas frias."
    elif action == "insure":
        if vehicle.get("insured"):
            raise HTTPException(status_code=400, detail="Este veículo já está segurado")
        cost = max(2500, int(vehicle.get("price", 0) * 0.08))
        await _charge_clean(player, cost, "vehicle_insurance", f"Seguro clandestino de {vehicle['name']}")
        await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"insured": True}})
        message = f"{vehicle['name']} ficou protegido contra custos totais de apreensão."
    elif action == "recover":
        until = vehicle.get("impounded_until")
        if not until:
            raise HTTPException(status_code=400, detail="O veículo não está apreendido")
        still_held = _future(until, now)
        cost = max(1500, int(notoriety * 70)) if still_held else 0
        if vehicle.get("insured"):
            cost = int(cost * 0.45)
        if cost:
            await _charge_clean(player, cost, "vehicle_recovery", f"Recuperação de {vehicle['name']}")
        await db.vehicles.update_one(
            {"_id": vehicle["_id"]},
            {"$set": {
                "impounded_until": None,
                "condition": max(35.0, float(vehicle.get("condition", 0))),
                "street_notoriety": max(0.0, notoriety - 20),
            }},
        )
        message = f"{vehicle['name']} regressou à garagem."
    else:
        raise HTTPException(status_code=400, detail="Ação de garagem inválida")

    await add_event(db, str(player["_id"]), "vehicle", message)
    return {"ok": True, "message": message, "cost": cost}


@router.post("/activities/start")
async def start_activity(body: ActivityStartInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    street = await _process_street(player, now)
    if street.get("active_job"):
        raise HTTPException(status_code=409, detail="Já tens uma atividade de rua em curso")

    cfg = ACTIVITIES.get(body.job_key)
    rank = street_rank(street.get("rep", 0))["level"]
    if not cfg or rank < cfg["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Atividade ainda bloqueada")
    district = street["districts"].get(body.district_key)
    if not district:
        raise HTTPException(status_code=404, detail="Zona não encontrada")
    vehicle = await _owned_vehicle(player, body.vehicle_id)
    if _future(vehicle.get("impounded_until"), now):
        raise HTTPException(status_code=400, detail="O veículo está apreendido")
    if vehicle.get("refueling_until") and _future(vehicle["refueling_until"], now):
        raise HTTPException(status_code=400, detail="O veículo está a abastecer")
    if vehicle.get("transfer") and _future((vehicle["transfer"] or {}).get("ends_at"), now):
        raise HTTPException(status_code=400, detail="O veículo está em transferência")
    if float(vehicle.get("condition", 0)) < 35:
        raise HTTPException(status_code=400, detail="O veículo precisa de reparação")
    if float(vehicle.get("fuel_l", 0)) < cfg["fuel"]:
        raise HTTPException(status_code=400, detail="Combustível insuficiente")

    if vehicle.get("team_id"):
        team = await db.teams.find_one({"_id": _oid(vehicle["team_id"])})
        if team and team.get("status") != "idle":
            raise HTTPException(status_code=400, detail="O veículo está com uma equipa em operação")

    plan = street.get("plan") or {}
    approach = APPROACHES.get(plan.get("approach_key")) or APPROACHES["balanced"]
    escape = ESCAPE_PLANS.get(plan.get("escape_key")) or ESCAPE_PLANS["speed"]
    if rank < approach["unlock_rank"] or rank < escape["unlock_rank"]:
        raise HTTPException(status_code=400, detail="O plano guardado contém opções ainda bloqueadas")

    wager = None
    if body.job_key == "race":
        wager = WAGERS.get(body.wager_key or "standard")
        if not wager or rank < wager["unlock_rank"]:
            raise HTTPException(status_code=400, detail="Aposta indisponível")

    gear_keys = list(dict.fromkeys(plan.get("gear_keys") or []))
    gear_effects = []
    for key in gear_keys:
        item = GEAR.get(key)
        if not item or rank < item["unlock_rank"]:
            raise HTTPException(status_code=400, detail="O plano contém equipamento bloqueado")
        if body.job_key not in item["jobs"]:
            raise HTTPException(status_code=400, detail=f"{item['name']} não se aplica a esta atividade")
        if int(street["gear"].get(key, 0) or 0) < 1:
            raise HTTPException(status_code=400, detail=f"Falta {item['name']} no inventário")
        gear_effects.append(item)

    event = city_event(str(player["_id"]), now)
    condition = float(vehicle.get("condition", 100))
    speed = float(vehicle.get("speed", 100)) * (0.55 + 0.45 * condition / 100)
    notoriety = float(vehicle.get("street_notoriety", 0) or 0)
    stars = wanted_stars(player.get("heat", 0))
    tier = int(district.get("tier", 0) or 0)

    chance = cfg["base_success"]
    chance += (rank - 1) * 0.018
    chance += (condition - 65) / 700
    chance += approach["success"] + escape["success"]
    chance += event.get("success", 0) + event.get("job_success", {}).get(body.job_key, 0)
    chance += tier * 0.02
    chance -= stars * 0.025
    chance -= min(0.13, notoriety * 0.0018)
    if body.job_key == "race":
        chance += max(-0.08, min(0.16, (speed - 105) / 420))
        chance += wager["success"]
    elif body.job_key == "smuggling":
        chance += max(-0.05, min(0.08, (speed - 90) / 650))
    else:
        chance += max(-0.04, min(0.10, (speed - 95) / 520))
    if _future(street.get("intel_until"), now):
        chance += 0.06
    for item in gear_effects:
        chance += item["success"]
    chance = clamp_chance(chance)

    reward_mult = approach["reward_mult"] * escape["reward_mult"] * event["reward_mult"]
    reward_mult *= 1 + tier * 0.05
    if body.job_key == "race":
        reward_mult *= wager["reward_mult"]
        reward_mult *= 1 + min(0.25, int(street.get("race_streak", 0) or 0) * 0.05)
    fixer_boost = int(street.get("fixer_boost", 0) or 0)
    if fixer_boost:
        reward_mult *= 1 + fixer_boost * 0.15
    reward = int(random.randint(cfg["reward_min"], cfg["reward_max"]) * reward_mult)

    heat_mult = approach["heat_mult"] * escape["heat_mult"] * event["heat_mult"]
    caught_relief = escape["caught_relief"]
    for item in gear_effects:
        heat_mult *= item["heat_mult"]
        caught_relief += item["caught_relief"]
    heat_gain = max(1, int(cfg["heat"] * heat_mult))

    caught_chance = 0.10 + stars * 0.085 + min(0.16, notoriety * 0.002)
    caught_chance = max(0.02, min(0.78, caught_chance - caught_relief))
    outcome = "success" if random.random() < chance else "failure"
    caught = outcome == "failure" and random.random() < caught_chance

    duration_s = int(cfg["duration_s"] * approach["duration_mult"] * escape["duration_mult"])
    cost = cfg["base_cost"] + escape["cost"] + (wager["cost"] if wager else 0)
    job = {
        "id": uuid4().hex,
        "job_key": body.job_key,
        "name": cfg["name"],
        "district_key": body.district_key,
        "district_name": district["name"],
        "vehicle_id": body.vehicle_id,
        "vehicle_name": vehicle["name"],
        "wager_key": body.wager_key or "standard" if wager else None,
        "approach_key": plan.get("approach_key", "balanced"),
        "escape_key": plan.get("escape_key", "speed"),
        "gear_keys": gear_keys,
        "chance": chance,
        "reward": reward,
        "pays": cfg["pays"],
        "rep_reward": cfg["rep"],
        "heat_gain": heat_gain,
        "caught": caught,
        "outcome": outcome,
        "status": "running",
        "started_at": now.isoformat(),
        "finish_at": (now + timedelta(seconds=max(30, duration_s))).isoformat(),
    }

    query = {
        "_id": player["_id"],
        "clean_money": {"$gte": cost},
        "$or": [{"street.active_job": None}, {"street.active_job": {"$exists": False}}],
    }
    increments = {"clean_money": -cost}
    for key in gear_keys:
        query[f"street.gear.{key}"] = {"$gte": 1}
        increments[f"street.gear.{key}"] = -1
    updated = await db.players.find_one_and_update(
        query,
        {
            "$set": {"street.active_job": job, "street.fixer_boost": 0},
            "$inc": increments,
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Estado alterado: verifica saldo, equipamento e atividade atual")

    player["clean_money"] = updated["clean_money"]
    await db.vehicles.update_one(
        {"_id": vehicle["_id"]},
        {"$set": {
            "fuel_l": max(0.0, round(float(vehicle["fuel_l"]) - cfg["fuel"], 2)),
            "condition": max(0.0, round(condition - cfg["wear"], 2)),
        }},
    )
    if cost:
        await record_tx(
            db, str(player["_id"]), "street_activity_cost", -cost, "clean",
            player["clean_money"], f"Preparação: {cfg['name']}",
        )
    await add_event(db, str(player["_id"]), "dispatch", f"{cfg['name']} iniciada em {district['name']} com {vehicle['name']}.")
    return {"ok": True, "job": _public_job(job, now)}


@router.post("/activities/claim")
async def claim_activity(body: ActivityClaimInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    street = await _process_street(player, now)
    job = street.get("active_job")
    if not job or job.get("id") != body.job_id:
        raise HTTPException(status_code=404, detail="Atividade não encontrada")
    if job.get("status") != "ready":
        raise HTTPException(status_code=400, detail=f"Atividade ainda em curso durante {_remaining(job['finish_at'], now)}s")

    claimed = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "street.active_job.id": body.job_id,
            "street.active_job.status": "ready",
        },
        {"$set": {"street.active_job": None}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        raise HTTPException(status_code=409, detail="Esta atividade já foi recolhida")

    street = claimed["street"]
    district = street["districts"].get(job["district_key"])
    cfg = ACTIVITIES[job["job_key"]]
    success = job["outcome"] == "success"
    heat_gain = job["heat_gain"] if success else max(2, int(job["heat_gain"] * 1.35))
    new_heat = min(100.0, float(claimed.get("heat", 0)) + heat_gain)
    rep_gain = int(job["rep_reward"] if success else max(2, job["rep_reward"] * 0.15))
    street["rep"] = int(street.get("rep", 0) or 0) + rep_gain
    paid_reward = 0

    if success:
        influence_gain = 18 + int(job["rep_reward"] / 4)
        district["influence"] = min(150.0, float(district.get("influence", 0)) + influence_gain)
        district["rival_pressure"] = max(0.0, float(district.get("rival_pressure", 0)) - 5)
        if job["job_key"] == "race":
            street["race_streak"] = int(street.get("race_streak", 0) or 0) + 1
        balance_field = "clean_money" if job["pays"] == "clean" else "dirty_money"
        paid_reward = int(job["reward"])
        if balance_field == "dirty_money":
            room = max(0, dirty_money_cap(claimed.get("level", 1)) - int(claimed.get("dirty_money", 0)))
            paid_reward = min(paid_reward, room)
        await db.players.update_one(
            {"_id": player["_id"]},
            {
                "$set": {"street": street, "heat": new_heat},
                "$inc": {balance_field: paid_reward},
            },
        )
        balance_after = claimed.get(balance_field, 0) + paid_reward
        if paid_reward:
            await record_tx(
                db, str(player["_id"]), "street_activity_reward", paid_reward, job["pays"],
                balance_after, job["name"],
            )
        notoriety_gain = 4 + cfg["heat"] * 0.6
        await db.vehicles.update_one(
            {"_id": _oid(job["vehicle_id"])},
            {"$inc": {"street_notoriety": notoriety_gain}},
        )
        message = f"{job['name']} concluída: +{paid_reward:,} € e +{rep_gain} reputação de rua."
        event_kind = "success"
    else:
        district["rival_pressure"] = min(100.0, float(district.get("rival_pressure", 0)) + 12)
        if job["job_key"] == "race":
            street["race_streak"] = 0
        history_note = "Falha"
        vehicle_sets = {}
        notoriety_gain = 8.0
        if job.get("caught"):
            vehicle = await db.vehicles.find_one({"_id": _oid(job["vehicle_id"])})
            insured = bool((vehicle or {}).get("insured"))
            hold_s = 300 if insured else 600
            vehicle_sets["impounded_until"] = (now + timedelta(seconds=hold_s)).isoformat()
            vehicle_sets["condition"] = max(20.0, float((vehicle or {}).get("condition", 40)) - 8)
            notoriety_gain += 18
            history_note = "Intercetado e veículo apreendido"
        update_vehicle = {"$inc": {"street_notoriety": notoriety_gain}}
        if vehicle_sets:
            update_vehicle["$set"] = vehicle_sets
        await db.vehicles.update_one({"_id": _oid(job["vehicle_id"])}, update_vehicle)
        await db.players.update_one(
            {"_id": player["_id"]},
            {"$set": {"street": street, "heat": new_heat}},
        )
        message = f"{job['name']} falhou. {history_note}; +{heat_gain} calor."
        event_kind = "police" if job.get("caught") else "failure"

    history = {
        "id": job["id"],
        "ts": now.isoformat(),
        "name": job["name"],
        "district_name": job["district_name"],
        "vehicle_name": job["vehicle_name"],
        "outcome": job["outcome"],
        "caught": bool(job.get("caught")),
        "reward": paid_reward,
        "rep": rep_gain,
    }
    street["history"] = [history, *list(street.get("history", []))][:20]
    await db.players.update_one(
        {"_id": player["_id"]},
        {"$set": {"street": street, "heat": new_heat}},
    )
    await add_event(db, str(player["_id"]), event_kind, message)
    return {"ok": True, "success": success, "caught": bool(job.get("caught")), "message": message}
