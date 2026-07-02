import math
import random
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import timedelta

from db import db
from auth import get_current_user
from engine import (advance, haversine_m, add_event, now_utc, next_threshold, parse_dt,
                    get_caps, vehicle_doc, employee_doc)
from models import Player, Team, Employee, Vehicle, Property, Opportunity, Mission, Event
from game_data import (TEAM_SPECS, TEAM_NAMES, TEAM_CREATE_COST, EMPLOYEE_ROLES, TRAINING_COURSES,
                       EMP_LEVEL_XP, VEHICLE_MODELS, FUEL_PRICES, PROPERTY_TYPES, PROPERTY_MAX_LEVEL,
                       BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, OPPORTUNITY_TYPES, LISBON_SPOTS)

router = APIRouter(prefix="/api/game", tags=["game"])


async def get_player(user: dict) -> dict:
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    return player


class DispatchInput(BaseModel):
    opportunity_id: str
    team_id: str


class TeamCreateInput(BaseModel):
    spec: str


class HireInput(BaseModel):
    role_key: str


class AssignEmployeeInput(BaseModel):
    employee_id: str
    team_id: Optional[str] = None


class TrainInput(BaseModel):
    employee_id: str
    course_key: str


class VehicleBuyInput(BaseModel):
    model_key: str


class VehicleIdInput(BaseModel):
    vehicle_id: str


class VehicleAssignInput(BaseModel):
    vehicle_id: str
    team_id: Optional[str] = None


class PropertyBuyInput(BaseModel):
    type_key: str


class PropertyIdInput(BaseModel):
    property_id: str


class LaunderInput(BaseModel):
    amount: int


def _oid(v, msg):
    try:
        return ObjectId(v)
    except Exception:
        raise HTTPException(status_code=400, detail=msg)


@router.get("/catalog")
async def catalog():
    return {
        "team_specs": TEAM_SPECS,
        "team_create_cost": TEAM_CREATE_COST,
        "employee_roles": EMPLOYEE_ROLES,
        "training_courses": TRAINING_COURSES,
        "emp_level_xp": EMP_LEVEL_XP,
        "vehicle_models": VEHICLE_MODELS,
        "fuel_prices": FUEL_PRICES,
        "property_types": PROPERTY_TYPES,
        "property_max_level": PROPERTY_MAX_LEVEL,
        "base_caps": {"employees": BASE_EMPLOYEE_CAP, "vehicles": BASE_VEHICLE_CAP},
        "opportunity_types": {k: {kk: vv for kk, vv in v.items() if kk != "duration_s"} for k, v in OPPORTUNITY_TYPES.items()},
    }


@router.get("/state")
async def get_state(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    player = await advance(db, player)
    pid = str(player["_id"])
    now_iso = now_utc().isoformat()

    teams = await db.teams.find({"player_id": pid}).to_list(100)
    employees = await db.employees.find({"player_id": pid}).to_list(200)
    vehicles = await db.vehicles.find({"player_id": pid}).to_list(100)
    properties = await db.properties.find({"player_id": pid}).to_list(100)
    opportunities = await db.opportunities.find(
        {"player_id": pid, "status": "active", "expires_at": {"$gt": now_iso}}
    ).to_list(50)
    missions = await db.missions.find({"player_id": pid, "phase": {"$ne": "done"}}).to_list(100)
    events = await db.events.find({"player_id": pid}).sort("ts", -1).to_list(30)

    caps, _ = await get_caps(db, pid)
    p = Player.from_mongo(player).model_dump()
    p["next_level_respect"] = next_threshold(player["level"])
    return {
        "server_time": now_iso,
        "player": p,
        "teams": [Team.from_mongo(t).model_dump() for t in teams],
        "employees": [Employee.from_mongo(e).model_dump() for e in employees],
        "vehicles": [Vehicle.from_mongo(v).model_dump() for v in vehicles],
        "properties": [Property.from_mongo(pr).model_dump() for pr in properties],
        "opportunities": [Opportunity.from_mongo(o).model_dump() for o in opportunities],
        "missions": [Mission.from_mongo(m).model_dump() for m in missions],
        "events": [Event.from_mongo(e).model_dump() for e in events],
        "caps": {
            "employees": {"used": len(employees), "max": caps["employees"]},
            "vehicles": {"used": len(vehicles), "max": caps["vehicles"]},
        },
        "fuel_prices": FUEL_PRICES,
    }


@router.post("/dispatch")
async def dispatch(body: DispatchInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()

    if player["heat"] >= 90:
        raise HTTPException(status_code=400, detail="A polícia está em alerta máximo. Reduz o calor antes de operar.")

    opp = await db.opportunities.find_one({"_id": _oid(body.opportunity_id, "Oportunidade inválida"), "player_id": pid})
    if not opp or opp["status"] != "active" or parse_dt(opp["expires_at"]) <= now:
        raise HTTPException(status_code=400, detail="Oportunidade já não está disponível")
    if player["level"] < opp["min_level"]:
        raise HTTPException(status_code=400, detail=f"Requer nível {opp['min_level']}")

    team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    if team["status"] != "idle":
        raise HTTPException(status_code=400, detail="Equipa está ocupada")

    members = await db.employees.find({
        "player_id": pid, "team_id": str(team["_id"]), "status": "idle", "fatigue": {"$lt": 90},
    }).to_list(50)
    if not members:
        raise HTTPException(status_code=400, detail="A equipa não tem membros disponíveis (sem funcionários ou demasiado fatigados)")

    if not team.get("vehicle_id"):
        raise HTTPException(status_code=400, detail="A equipa não tem veículo atribuído")
    vehicle = await db.vehicles.find_one({"_id": ObjectId(team["vehicle_id"]), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=400, detail="Veículo não encontrado")
    if vehicle["condition"] < 30:
        raise HTTPException(status_code=400, detail="O veículo precisa de reparação")

    hq = player["hq"]
    dist = haversine_m(hq["lat"], hq["lng"], opp["lat"], opp["lng"])
    round_km = 2 * dist / 1000
    fuel_needed = round_km * vehicle["cons"] / 100
    if vehicle["fuel_l"] < fuel_needed:
        raise HTTPException(status_code=400, detail="Combustível insuficiente para a viagem")

    travel_s = max(20, dist / vehicle["speed"])
    depart = now
    arrive = depart + timedelta(seconds=travel_s)
    finish = arrive + timedelta(seconds=opp["duration_s"])
    ret = finish + timedelta(seconds=travel_s)

    caps_props = await db.properties.find({"player_id": pid}).to_list(200)
    mult = 1.0
    for pr in caps_props:
        pt = PROPERTY_TYPES[pr["type_key"]]
        if pt.get("bonus_pct") and (pt.get("bonus_category") == "all" or pt.get("bonus_category") == opp["category"]):
            mult += pt["bonus_pct"] * pr["level"]
    reward = int(opp["reward"] * mult)

    def eff(e):
        match = e["spec"] == opp["category"] or opp["category"] == "especial"
        return e["level"] * (1.25 if match else 1.0) * (1 - e["fatigue"] / 250)

    team_skill = sum(eff(e) for e in members) / len(members) + 0.3 * (len(members) - 1)
    spec_match = team["spec"] == opp["category"] or opp["category"] == "especial"
    member_ids = [str(e["_id"]) for e in members]

    mission = {
        "player_id": pid, "team_id": str(team["_id"]), "team_name": team["name"],
        "team_skill": round(team_skill, 2), "spec_match": spec_match,
        "member_ids": member_ids, "vehicle_id": str(vehicle["_id"]),
        "opportunity": {
            "type_key": opp["type_key"], "name": opp["name"], "category": opp["category"],
            "district": opp["district"], "reward": reward, "respect": opp["respect"],
            "risk": opp["risk"], "heat": opp["heat"], "pays": opp["pays"],
        },
        "origin": {"lat": hq["lat"], "lng": hq["lng"]},
        "target": {"lat": opp["lat"], "lng": opp["lng"]},
        "phase": "en_route", "outcome": None,
        "depart_at": depart.isoformat(), "arrive_at": arrive.isoformat(),
        "finish_at": finish.isoformat(), "return_at": ret.isoformat(),
    }
    result = await db.missions.insert_one(mission)
    await db.opportunities.update_one({"_id": opp["_id"]}, {"$set": {"status": "taken"}})
    await db.teams.update_one({"_id": team["_id"]}, {"$set": {"status": "en_route"}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {
        "fuel_l": round(vehicle["fuel_l"] - fuel_needed, 2),
        "km_total": round(vehicle["km_total"] + round_km, 2),
    }})
    await db.employees.update_many(
        {"_id": {"$in": [ObjectId(i) for i in member_ids]}},
        {"$set": {"status": "on_mission"}},
    )
    await add_event(db, pid, "dispatch", f"{team['name']} ({len(members)} membros) destacada para {opp['name']} em {opp['district']}.")
    return {"mission_id": str(result.inserted_id)}


@router.post("/teams/create")
async def create_team(body: TeamCreateInput, user: dict = Depends(get_current_user)):
    if body.spec not in TEAM_SPECS:
        raise HTTPException(status_code=400, detail="Especialização inválida")
    player = await get_player(user)
    pid = str(player["_id"])
    if player["clean_money"] < TEAM_CREATE_COST:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    count = await db.teams.count_documents({"player_id": pid})
    name = TEAM_NAMES[count % len(TEAM_NAMES)]
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -TEAM_CREATE_COST}})
    await db.teams.insert_one({
        "player_id": pid, "name": name, "spec": body.spec, "status": "idle",
        "vehicle_id": None, "missions_done": 0, "created_at": now_utc().isoformat(),
    })
    await add_event(db, pid, "team", f"{name} ({TEAM_SPECS[body.spec]['name']}) formada por {TEAM_CREATE_COST:,} €.")
    return {"ok": True}


@router.post("/employees/hire")
async def hire_employee(body: HireInput, user: dict = Depends(get_current_user)):
    if body.role_key not in EMPLOYEE_ROLES:
        raise HTTPException(status_code=400, detail="Função inválida")
    player = await get_player(user)
    pid = str(player["_id"])
    role = EMPLOYEE_ROLES[body.role_key]
    if player["clean_money"] < role["cost"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    caps, _ = await get_caps(db, pid)
    used = await db.employees.count_documents({"player_id": pid})
    if used >= caps["employees"]:
        raise HTTPException(status_code=400, detail="Sem capacidade. Compra ou melhora um esconderijo.")
    doc = employee_doc(pid, body.role_key, now_utc().isoformat())
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -role["cost"]}})
    await db.employees.insert_one(doc)
    await add_event(db, pid, "team", f"{doc['name']} ({role['name']}) contratado por {role['cost']:,} €.")
    return {"ok": True}


@router.post("/employees/assign")
async def assign_employee(body: AssignEmployeeInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await db.employees.find_one({"_id": _oid(body.employee_id, "Funcionário inválido"), "player_id": pid})
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Funcionário está ocupado")
    if body.team_id:
        team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
        if not team:
            raise HTTPException(status_code=404, detail="Equipa não encontrada")
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"team_id": body.team_id}})
    return {"ok": True}


@router.post("/employees/train")
async def train_employee(body: TrainInput, user: dict = Depends(get_current_user)):
    if body.course_key not in TRAINING_COURSES:
        raise HTTPException(status_code=400, detail="Formação inválida")
    player = await get_player(user)
    pid = str(player["_id"])
    course = TRAINING_COURSES[body.course_key]
    emp = await db.employees.find_one({"_id": _oid(body.employee_id, "Funcionário inválido"), "player_id": pid})
    if not emp:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado")
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Funcionário está ocupado")
    if player["clean_money"] < course["cost"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    ends = now_utc() + timedelta(seconds=course["duration_s"])
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -course["cost"]}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
        "status": "training",
        "training": {"course_key": body.course_key, "ends_at": ends.isoformat()},
    }})
    await add_event(db, pid, "team", f"{emp['name']} iniciou a formação {course['name']}.")
    return {"ok": True}


@router.post("/vehicles/buy")
async def buy_vehicle(body: VehicleBuyInput, user: dict = Depends(get_current_user)):
    if body.model_key not in VEHICLE_MODELS:
        raise HTTPException(status_code=400, detail="Modelo inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    model = VEHICLE_MODELS[body.model_key]
    if player["level"] < model["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {model['min_level']}")
    if player["clean_money"] < model["price"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    caps, _ = await get_caps(db, pid)
    used = await db.vehicles.count_documents({"player_id": pid})
    if used >= caps["vehicles"]:
        raise HTTPException(status_code=400, detail="Garagem cheia. Compra ou melhora uma garagem.")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -model["price"]}})
    await db.vehicles.insert_one(vehicle_doc(pid, body.model_key, now_utc().isoformat()))
    await add_event(db, pid, "vehicle", f"{model['name']} adquirido por {model['price']:,} €.")
    return {"ok": True}


async def _vehicle_free(pid, vehicle):
    if vehicle.get("team_id"):
        team = await db.teams.find_one({"_id": ObjectId(vehicle["team_id"]), "player_id": pid})
        if team and team["status"] != "idle":
            return False
    return True


@router.post("/vehicles/sell")
async def sell_vehicle(body: VehicleIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em missão")
    value = int(vehicle["price"] * 0.4 * vehicle["condition"] / 100)
    if vehicle.get("team_id"):
        await db.teams.update_one({"_id": ObjectId(vehicle["team_id"])}, {"$set": {"vehicle_id": None}})
    await db.vehicles.delete_one({"_id": vehicle["_id"]})
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": value}})
    await add_event(db, pid, "vehicle", f"{vehicle['name']} abatido. Recebeste {value:,} €.")
    return {"value": value}


@router.post("/vehicles/refuel")
async def refuel_vehicle(body: VehicleIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em missão")
    missing = vehicle["tank_l"] - vehicle["fuel_l"]
    if missing <= 0.1:
        raise HTTPException(status_code=400, detail="Depósito já está cheio")
    cost = math.ceil(missing * FUEL_PRICES[vehicle["fuel_type"]])
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"fuel_l": vehicle["tank_l"]}})
    await add_event(db, pid, "vehicle", f"{vehicle['name']} abastecido ({vehicle['fuel_type']}) por {cost:,} €.")
    return {"cost": cost}


@router.post("/vehicles/repair")
async def repair_vehicle(body: VehicleIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em missão")
    missing = 100 - vehicle["condition"]
    if missing < 1:
        raise HTTPException(status_code=400, detail="Veículo em perfeitas condições")
    _, props = await get_caps(db, pid)
    discount = min(0.45, sum(0.15 * p["level"] for p in props if p["type_key"] == "oficina"))
    cost = max(50, int(missing * vehicle["price"] * 0.002 * (1 - discount)))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"condition": 100.0}})
    await add_event(db, pid, "vehicle", f"{vehicle['name']} reparado por {cost:,} €.")
    return {"cost": cost}


@router.post("/vehicles/assign")
async def assign_vehicle(body: VehicleAssignInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em missão")
    if vehicle.get("team_id"):
        await db.teams.update_one({"_id": ObjectId(vehicle["team_id"])}, {"$set": {"vehicle_id": None}})
    if body.team_id:
        team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
        if not team:
            raise HTTPException(status_code=404, detail="Equipa não encontrada")
        if team["status"] != "idle":
            raise HTTPException(status_code=400, detail="A equipa está em missão")
        if team.get("vehicle_id"):
            await db.vehicles.update_one({"_id": ObjectId(team["vehicle_id"])}, {"$set": {"team_id": None}})
        await db.teams.update_one({"_id": team["_id"]}, {"$set": {"vehicle_id": str(vehicle["_id"])}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"team_id": body.team_id}})
    return {"ok": True}


@router.post("/properties/buy")
async def buy_property(body: PropertyBuyInput, user: dict = Depends(get_current_user)):
    if body.type_key not in PROPERTY_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de propriedade inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    pt = PROPERTY_TYPES[body.type_key]
    if player["level"] < pt["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {pt['min_level']}")
    if player["clean_money"] < pt["price"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    spot = random.choice(LISBON_SPOTS)
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -pt["price"]}})
    await db.properties.insert_one({
        "player_id": pid, "type_key": body.type_key,
        "name": f"{pt['name']} — {spot['name']}", "district": spot["name"],
        "lat": spot["lat"] + random.uniform(-0.006, 0.006),
        "lng": spot["lng"] + random.uniform(-0.008, 0.008),
        "level": 1, "bought_at": now_utc().isoformat(),
    })
    await add_event(db, pid, "property", f"{pt['name']} comprado em {spot['name']} por {pt['price']:,} €.")
    return {"ok": True}


@router.post("/properties/sell")
async def sell_property(body: PropertyIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    prop = await db.properties.find_one({"_id": _oid(body.property_id, "Propriedade inválida"), "player_id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada")
    pt = PROPERTY_TYPES[prop["type_key"]]
    caps, _ = await get_caps(db, pid)
    if pt.get("cap_employees"):
        used = await db.employees.count_documents({"player_id": pid})
        if used > caps["employees"] - pt["cap_employees"] * prop["level"]:
            raise HTTPException(status_code=400, detail="Não podes vender: os teus funcionários ficariam sem espaço")
    if pt.get("cap_vehicles"):
        used = await db.vehicles.count_documents({"player_id": pid})
        if used > caps["vehicles"] - pt["cap_vehicles"] * prop["level"]:
            raise HTTPException(status_code=400, detail="Não podes vender: os teus veículos ficariam sem espaço")
    value = int(pt["price"] * 0.7 * prop["level"])
    await db.properties.delete_one({"_id": prop["_id"]})
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": value}})
    await add_event(db, pid, "property", f"{prop['name']} vendido por {value:,} €.")
    return {"value": value}


@router.post("/properties/upgrade")
async def upgrade_property(body: PropertyIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    prop = await db.properties.find_one({"_id": _oid(body.property_id, "Propriedade inválida"), "player_id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada")
    if prop["level"] >= PROPERTY_MAX_LEVEL:
        raise HTTPException(status_code=400, detail="Nível máximo atingido")
    pt = PROPERTY_TYPES[prop["type_key"]]
    cost = int(pt["price"] * 0.6 * (prop["level"] + 1))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.properties.update_one({"_id": prop["_id"]}, {"$inc": {"level": 1}})
    await add_event(db, pid, "property", f"{prop['name']} melhorado para nível {prop['level'] + 1} por {cost:,} €.")
    return {"ok": True}


@router.post("/police/bribe")
async def bribe_police(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if player["heat"] < 10:
        raise HTTPException(status_code=400, detail="O calor está demasiado baixo para justificar um suborno")
    cost = max(1000, int(player["heat"] * 150))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    new_heat = max(0.0, player["heat"] - 40)
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}, "$set": {"heat": new_heat}})
    await add_event(db, pid, "police", f"Suborno de {cost:,} € pago. O calor baixou para {round(new_heat)}%.")
    return {"cost": cost}


@router.post("/launder")
async def launder(body: LaunderInput, user: dict = Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Montante inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    if player["dirty_money"] < body.amount:
        raise HTTPException(status_code=400, detail="Dinheiro sujo insuficiente")
    clean_gain = int(body.amount * 0.75)
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"dirty_money": -body.amount, "clean_money": clean_gain}})
    await add_event(db, pid, "launder", f"Lavagem de {body.amount:,} € — recebeste {clean_gain:,} € limpos (taxa 25%).")
    return {"clean_gain": clean_gain}
