from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db
from auth import get_current_user
from engine import advance, haversine_m, add_event, now_utc, next_threshold, parse_dt
from models import Player, Team, Opportunity, Mission, Event
from game_data import TEAM_TYPES, VEHICLE_TYPES, TEAM_NAMES, OPPORTUNITY_TYPES
from datetime import timedelta

router = APIRouter(prefix="/api/game", tags=["game"])


async def get_player(user: dict) -> dict:
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    return player


class DispatchInput(BaseModel):
    opportunity_id: str
    team_id: str


class RecruitInput(BaseModel):
    type_key: str


class VehicleInput(BaseModel):
    team_id: str
    vehicle_key: str


class LaunderInput(BaseModel):
    amount: int


@router.get("/catalog")
async def catalog():
    return {
        "team_types": TEAM_TYPES,
        "vehicle_types": VEHICLE_TYPES,
        "opportunity_types": {k: {kk: vv for kk, vv in v.items() if kk != "duration_s"} for k, v in OPPORTUNITY_TYPES.items()},
    }


@router.get("/state")
async def get_state(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    player = await advance(db, player)
    pid = str(player["_id"])
    now_iso = now_utc().isoformat()

    teams = await db.teams.find({"player_id": pid}).to_list(100)
    opportunities = await db.opportunities.find(
        {"player_id": pid, "status": "active", "expires_at": {"$gt": now_iso}}
    ).to_list(50)
    missions = await db.missions.find({"player_id": pid, "phase": {"$ne": "done"}}).to_list(100)
    events = await db.events.find({"player_id": pid}).sort("ts", -1).to_list(30)

    p = Player.from_mongo(player).model_dump()
    p["next_level_respect"] = next_threshold(player["level"])
    return {
        "server_time": now_iso,
        "player": p,
        "teams": [Team.from_mongo(t).model_dump() for t in teams],
        "opportunities": [Opportunity.from_mongo(o).model_dump() for o in opportunities],
        "missions": [Mission.from_mongo(m).model_dump() for m in missions],
        "events": [Event.from_mongo(e).model_dump() for e in events],
    }


@router.post("/dispatch")
async def dispatch(body: DispatchInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()

    opp = await db.opportunities.find_one({"_id": ObjectId(body.opportunity_id), "player_id": pid})
    if not opp or opp["status"] != "active" or parse_dt(opp["expires_at"]) <= now:
        raise HTTPException(status_code=400, detail="Oportunidade já não está disponível")
    if player["level"] < opp["min_level"]:
        raise HTTPException(status_code=400, detail=f"Requer nível {opp['min_level']}")

    team = await db.teams.find_one({"_id": ObjectId(body.team_id), "player_id": pid})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    if team["status"] != "idle":
        raise HTTPException(status_code=400, detail="Equipa está ocupada")

    hq = player["hq"]
    dist = haversine_m(hq["lat"], hq["lng"], opp["lat"], opp["lng"])
    travel_s = max(20, dist / team["vehicle"]["speed"])
    depart = now
    arrive = depart + timedelta(seconds=travel_s)
    finish = arrive + timedelta(seconds=opp["duration_s"])
    ret = finish + timedelta(seconds=travel_s)

    spec_match = team["spec"] == opp["category"] or opp["category"] == "especial"
    mission = {
        "player_id": pid, "team_id": str(team["_id"]), "team_name": team["name"],
        "team_skill": team["skill"], "spec_match": spec_match,
        "opportunity": {
            "type_key": opp["type_key"], "name": opp["name"], "category": opp["category"],
            "district": opp["district"], "reward": opp["reward"], "respect": opp["respect"],
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
    await add_event(db, pid, "dispatch", f"{team['name']} destacada para {opp['name']} em {opp['district']}.")
    return {"mission_id": str(result.inserted_id)}


@router.post("/recruit")
async def recruit(body: RecruitInput, user: dict = Depends(get_current_user)):
    if body.type_key not in TEAM_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de equipa inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    tt = TEAM_TYPES[body.type_key]
    if player["clean_money"] < tt["cost"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")

    count = await db.teams.count_documents({"player_id": pid})
    name = TEAM_NAMES[count % len(TEAM_NAMES)]
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -tt["cost"]}})
    await db.teams.insert_one({
        "player_id": pid, "name": name, "type_key": body.type_key,
        "spec": tt["spec"], "skill": float(tt["skill"]), "status": "idle",
        "vehicle": {"key": "usado", **VEHICLE_TYPES["usado"]},
        "missions_done": 0, "created_at": now_utc().isoformat(),
    })
    await add_event(db, pid, "team", f"{name} ({tt['name']}) recrutada por {tt['cost']:,} €.")
    return {"ok": True}


@router.post("/vehicle")
async def buy_vehicle(body: VehicleInput, user: dict = Depends(get_current_user)):
    if body.vehicle_key not in VEHICLE_TYPES:
        raise HTTPException(status_code=400, detail="Veículo inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    vt = VEHICLE_TYPES[body.vehicle_key]
    team = await db.teams.find_one({"_id": ObjectId(body.team_id), "player_id": pid})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    if team["status"] != "idle":
        raise HTTPException(status_code=400, detail="A equipa tem de estar na base")
    if player["clean_money"] < vt["cost"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")

    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -vt["cost"]}})
    await db.teams.update_one({"_id": team["_id"]}, {"$set": {"vehicle": {"key": body.vehicle_key, **vt}}})
    await add_event(db, pid, "vehicle", f"{team['name']} recebeu um {vt['name']} por {vt['cost']:,} €.")
    return {"ok": True}


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
