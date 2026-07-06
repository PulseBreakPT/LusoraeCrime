import asyncio
import math
import random
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import timedelta

from db import db
from auth import get_current_user
from engine import (advance, haversine_m, add_event, now_utc, next_threshold, parse_dt,
                    get_caps, get_org_bonuses, vehicle_doc, effective_speed, chance_breakdown,
                    team_effectiveness, team_bonus_breakdown, vehicle_bonus_breakdown,
                    age_decay_mult, member_split_mult, property_active, property_condition_factor,
                    local_presence_reduction_s, situational_bonus_for, max_teams_for,
                    gen_candidate, employee_from_candidate, betrayal_risk_of, push_history,
                    record_tx, property_stack_ranks, property_stack_mult,
                    dirty_money_cap, grant_quest_rewards)
from quests import make_instance, enrich_quest, locked_principals
from quests_data import QUEST_DEFS
from models import Player, Team, Employee, Candidate, Vehicle, Property, Opportunity, Mission, Event, Quest, Transaction
from game_data import (TEAM_SPECS, TEAM_NAMES, TEAM_CREATE_COST, SPECIALIZATIONS, RARITIES,
                       RARITY_MIN_RESPECT, RANKS, RANK_REQ_LEVEL, TALENTS, RECRUIT_SOURCES,
                       POOL_REFRESH_MIN, PAYROLL_CYCLE_MIN, TRAINING_COURSES, EMP_LEVEL_XP,
                       VEHICLE_MODELS, FUEL_PRICES, PROPERTY_TYPES, PROPERTY_MAX_LEVEL,
                       BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, OPPORTUNITY_TYPES, LISBON_SPOTS,
                       TEAM_MAX_MEMBERS, REORG_AFTER_ROSTER_CHANGE_S, INCOMPLETE_TEAM_PREP_S,
                       NEWBIE_RAMP_S, RECALL_PENALTY_FRACTION, RECALL_PENALTY_HEAT,
                       RECALL_PENALTY_FATIGUE, HIDEOUT_PREP_REDUCTION_PER_LEVEL,
                       PROPERTY_UPGRADE_BASE_S, PROPERTY_UPGRADE_PER_LEVEL_S,
                       LAUNDER_PROPERTY_BONUS_PER_LEVEL, LOCAL_PRESENCE_RADIUS_KM,
                       TRAFFIC_DELAY_CHANCE, TRAFFIC_DELAY_MAX_PCT, RAIN_CHANCE, RAIN_TRAVEL_MULT,
                       EMPLOYEE_HEAVY_USE_THRESHOLD,
                       REFUEL_DURATION_BASE_S, REFUEL_DURATION_PER_L_S,
                       ACHIEVEMENT_MILESTONES, ACHIEVEMENT_BONUS_PCT_PER_MILESTONE,
                       HQ_MAX_LEVEL, HQ_LEVEL_BENEFITS, HQ_PRIORITIES, HQ_DEFAULT_PRIORITY,
                       HQ_DEPARTMENTS)
from reward_engine import calculate_full_reward

router = APIRouter(prefix="/api/game", tags=["game"])

PROMOTE_BASE_COST = 2000
POOL_REFRESH_COST = 500
HEAL_BASE_COST = 2500
RELEASE_BASE_COST = 2000
REST_DURATION_S = 90


async def get_player(user: dict) -> dict:
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    player["hq"].setdefault("level", 1)
    player["hq"].setdefault("upgrading_until", None)
    player["hq"].setdefault("upgrade_history", [])
    player.setdefault("priorities", {"active": "equilibrio"})
    return player


class DispatchInput(BaseModel):
    opportunity_id: str
    team_id: str


class TeamIdInput(BaseModel):
    team_id: str


class OpportunityIdInput(BaseModel):
    opportunity_id: str


class TypeKeyInput(BaseModel):
    type_key: str


class TeamCreateInput(BaseModel):
    spec: str


class RecruitInput(BaseModel):
    candidate_id: str


class EmployeeIdInput(BaseModel):
    employee_id: str


class EmployeeRenameInput(BaseModel):
    employee_id: str
    name: str = Field(min_length=1, max_length=40)


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


class VehicleRenameInput(BaseModel):
    vehicle_id: str
    name: str = Field(min_length=1, max_length=40)


class MissionIdInput(BaseModel):
    mission_id: str


class VehicleAssignInput(BaseModel):
    vehicle_id: str
    team_id: Optional[str] = None


class PropertyBuyInput(BaseModel):
    type_key: str


class PropertyIdInput(BaseModel):
    property_id: str


class PropertyRenameInput(BaseModel):
    property_id: str
    name: str = Field(min_length=1, max_length=40)


class PriorityInput(BaseModel):
    priority: str


class LaunderInput(BaseModel):
    amount: int


class QuestClaimInput(BaseModel):
    quest_id: str


class QuestChooseInput(BaseModel):
    quest_id: str
    option: str


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
        "specializations": SPECIALIZATIONS,
        "rarities": RARITIES,
        "rarity_min_respect": RARITY_MIN_RESPECT,
        "ranks": RANKS,
        "rank_req_level": RANK_REQ_LEVEL,
        "talents": TALENTS,
        "recruit_sources": {k: {"name": v["name"], "min_level": v["min_level"]} for k, v in RECRUIT_SOURCES.items()},
        "pool_refresh_min": POOL_REFRESH_MIN,
        "payroll_cycle_min": PAYROLL_CYCLE_MIN,
        "hr_costs": {"promote_base": PROMOTE_BASE_COST, "pool_refresh": POOL_REFRESH_COST,
                     "heal_base": HEAL_BASE_COST, "release_base": RELEASE_BASE_COST},
        "training_courses": TRAINING_COURSES,
        "emp_level_xp": EMP_LEVEL_XP,
        "vehicle_models": VEHICLE_MODELS,
        "fuel_prices": FUEL_PRICES,
        "property_types": PROPERTY_TYPES,
        "property_max_level": PROPERTY_MAX_LEVEL,
        "base_caps": {"employees": BASE_EMPLOYEE_CAP, "vehicles": BASE_VEHICLE_CAP},
        "team_max_members": TEAM_MAX_MEMBERS,
        "newbie_ramp_s": NEWBIE_RAMP_S,
        "recall_penalty_fraction": RECALL_PENALTY_FRACTION,
        "employee_heavy_use_threshold": EMPLOYEE_HEAVY_USE_THRESHOLD,
        "opportunity_types": {k: {kk: vv for kk, vv in v.items() if kk != "duration_s"} for k, v in OPPORTUNITY_TYPES.items()},
        "achievement_milestones": ACHIEVEMENT_MILESTONES,
        "achievement_bonus_pct_per_milestone": ACHIEVEMENT_BONUS_PCT_PER_MILESTONE,
        "hq_max_level": HQ_MAX_LEVEL,
        "hq_level_benefits": HQ_LEVEL_BENEFITS,
        "hq_priorities": HQ_PRIORITIES,
        "hq_default_priority": HQ_DEFAULT_PRIORITY,
        "hq_departments": HQ_DEPARTMENTS,
    }


@router.get("/state")
async def get_state(user: dict = Depends(get_current_user), skip_advance: bool = False):
    player = await get_player(user)
    if not skip_advance:
        player = await advance(db, player)
    pid = str(player["_id"])
    now_iso = now_utc().isoformat()

    (teams, employees, candidates, vehicles, properties, opportunities, missions, history, events, quest_docs, caps, bonuses) = await asyncio.gather(
        db.teams.find({"player_id": pid}).to_list(100),
        db.employees.find({"player_id": pid}).to_list(300),
        db.candidates.find({"player_id": pid}).to_list(50),
        db.vehicles.find({"player_id": pid}).to_list(100),
        db.properties.find({"player_id": pid}).to_list(100),
        db.opportunities.find(
            {"player_id": pid, "$or": [
                {"status": "active", "expires_at": {"$gt": now_iso}},
                {"status": "taken"},
            ]}
        ).to_list(50),
        db.missions.find({"player_id": pid, "phase": {"$ne": "done"}}).to_list(100),
        db.missions.find({"player_id": pid, "phase": "done"}).sort("return_at", -1).to_list(20),
        db.events.find({"player_id": pid}).sort("ts", -1).to_list(30),
        db.quests.find({"player_id": pid}).to_list(400),
        get_caps(db, pid, player["hq"]["level"]),
        get_org_bonuses(db, pid),
    )
    caps = caps[0]
    p = Player.from_mongo(player).model_dump()
    p["next_level_respect"] = next_threshold(player["level"])

    emp_dumps = []
    for e in employees:
        d = Employee.from_mongo(e).model_dump()
        d["betrayal_risk"] = betrayal_risk_of(e)
        emp_dumps.append(d)

    quests_out = [enrich_quest(Quest.from_mongo(q).model_dump()) for q in quest_docs]
    quests_out += locked_principals({q["quest_key"] for q in quest_docs}, player["level"])

    return {
        "server_time": now_iso,
        "player": p,
        "teams": [Team.from_mongo(t).model_dump() for t in teams],
        "employees": emp_dumps,
        "candidates": [Candidate.from_mongo(c).model_dump() for c in candidates],
        "vehicles": [Vehicle.from_mongo(v).model_dump() for v in vehicles],
        "properties": [Property.from_mongo(pr).model_dump() for pr in properties],
        "opportunities": [Opportunity.from_mongo(o).model_dump() for o in opportunities],
        "missions": [Mission.from_mongo(m).model_dump() for m in missions],
        "history": [Mission.from_mongo(h).model_dump() for h in history],
        "events": [Event.from_mongo(e).model_dump() for e in events],
        "quests": quests_out,
        "caps": {
            "employees": {"used": len(employees), "max": caps["employees"]},
            "vehicles": {"used": len(vehicles), "max": caps["vehicles"]},
            "teams": {"used": len(teams), "max": max_teams_for(player["level"])},
            "dirty_money": {"used": round(player["dirty_money"]), "max": dirty_money_cap(player["level"])},
        },
        "bonuses": bonuses,
        "salary_total": sum(e.get("salary", 0) for e in employees),
        "fuel_prices": FUEL_PRICES,
    }


async def _prepare_dispatch(player, opp, team):
    pid = str(player["_id"])
    if team["status"] != "idle":
        raise HTTPException(status_code=400, detail="Equipa está ocupada")
    now = now_utc()
    available_at = team.get("available_at")
    if available_at and parse_dt(available_at) > now:
        remaining = round((parse_dt(available_at) - now).total_seconds())
        raise HTTPException(status_code=400, detail=f"Equipa a reorganizar-se — disponível em {remaining}s")
    members = await db.employees.find({
        "player_id": pid, "team_id": str(team["_id"]), "status": "idle", "fatigue": {"$lt": 90},
    }).to_list(50)
    if not members:
        raise HTTPException(status_code=400, detail="A equipa não tem membros disponíveis (sem operacionais ou demasiado fatigados)")
    if not team.get("vehicle_id"):
        raise HTTPException(status_code=400, detail="A equipa não tem veículo atribuído")
    vehicle = await db.vehicles.find_one({"_id": ObjectId(team["vehicle_id"]), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=400, detail="Veículo não encontrado")
    if vehicle["condition"] < 30:
        raise HTTPException(status_code=400, detail="O veículo precisa de reparação")
    if vehicle.get("refueling_until") and parse_dt(vehicle["refueling_until"]) > now_utc():
        raise HTTPException(status_code=400, detail="O veículo está a abastecer")
    seats = VEHICLE_MODELS.get(vehicle["model_key"], {}).get("seats")
    if seats is not None and len(members) > seats:
        raise HTTPException(
            status_code=400,
            detail=f"O veículo só tem {seats} lugares — tens {len(members)} membros disponíveis. Reduz a equipa ou usa outro veículo.",
        )
    required_models = opp.get("required_models") or []
    if required_models and vehicle["model_key"] not in required_models:
        names = ", ".join(VEHICLE_MODELS.get(m, {}).get("name", m) for m in required_models)
        raise HTTPException(status_code=400, detail=f"Esta operação exige um destes veículos: {names}")

    hq = player["hq"]
    dist = haversine_m(hq["lat"], hq["lng"], opp["lat"], opp["lng"])
    round_km = 2 * dist / 1000
    fuel_needed = round_km * vehicle["cons"] / 100
    if vehicle["fuel_l"] < fuel_needed:
        raise HTTPException(status_code=400, detail="Combustível insuficiente para a viagem")

    props = await db.properties.find({"player_id": pid}).to_list(200)

    speed = effective_speed(vehicle)
    travel_s = max(20, dist / speed)
    # Equipas incompletas (abaixo da capacidade máxima) demoram mais tempo a
    # preparar-se antes de partir — esconderijos maiores (mais ativos e em bom
    # estado) reduzem esse atraso.
    missing = max(0, TEAM_MAX_MEMBERS - len(members))
    hideout_reduction = sum(
        HIDEOUT_PREP_REDUCTION_PER_LEVEL * pr["level"] * property_condition_factor(pr)
        for pr in props if pr["type_key"] == "esconderijo" and property_active(pr, now)
    )
    travel_s += missing * INCOMPLETE_TEAM_PREP_S * max(0.0, 1 - min(1.0, hideout_reduction))
    # Já ter outras equipas ativas perto do alvo reduz o tempo de preparação —
    # a organização já conhece a zona.
    active_missions = await db.missions.find({"player_id": pid, "phase": {"$ne": "done"}}).to_list(50)
    nearby_active = sum(
        1 for am in active_missions
        if haversine_m(am["target"]["lat"], am["target"]["lng"], opp["lat"], opp["lng"]) / 1000 <= LOCAL_PRESENCE_RADIUS_KM
    )
    travel_s = max(20, travel_s - local_presence_reduction_s(nearby_active))

    member_talents = sorted({t for e in members for t in e.get("talents", [])})
    if "motorista_fantasma" in member_talents:
        travel_s *= 0.9
    talent_bonus = 0.05 if ("pontaria_letal" in member_talents and opp["category"] == "assalto") else 0.0

    mult = 1.0
    prop_ranks = property_stack_ranks(props)
    for pr in props:
        if not property_active(pr, now):
            continue
        pt = PROPERTY_TYPES[pr["type_key"]]
        if pt.get("bonus_pct") and (pt.get("bonus_category") == "all" or pt.get("bonus_category") == opp["category"]):
            mult += pt["bonus_pct"] * pr["level"] * property_condition_factor(pr) * property_stack_mult(prop_ranks[pr["_id"]])
    tb = player.get("temp_bonus")
    if tb and tb.get("kind") == "reward_boost" and parse_dt(tb["until"]) > now_utc():
        mult += tb["pct"]
    # Conquistas permanentes (marcos de missões bem-sucedidas) dão um bónus fixo.
    mult += player.get("achievement_bonus_pct", 0.0)
    # Recompensa diminui quanto mais tempo a oportunidade ficar por reclamar, e
    # levar mais membros do que o exigido divide o saque.
    age_s = (now - parse_dt(opp["created_at"])).total_seconds()
    age_mult = age_decay_mult(age_s)
    split_mult = member_split_mult(len(members), opp.get("min_members", 1))

    team_skill = team_effectiveness(members, opp["category"], now)
    spec_match = team["spec"] == opp["category"] or opp["category"] == "especial"
    team_bonus = team_bonus_breakdown(members, opp["category"], team.get("roster_stable_since"), now)
    vehicle_bonus = vehicle_bonus_breakdown(vehicle, opp["category"])
    situational_bonus = situational_bonus_for(opp["category"], now)
    chance, breakdown = chance_breakdown(player["heat"], opp["risk"], team_skill, spec_match,
                                          talent_bonus, team_bonus, vehicle_bonus, situational_bonus)

    # Novo sistema de recompensas dinâmicas — calcula baseado em dificuldade real
    # opp["duration_s"] é sempre um único int (gerado em spawn_opportunities), não um intervalo.
    duration_avg = opp.get("duration_s") or 240

    reward_data = calculate_full_reward(
        risk=opp["risk"],
        team_members=len(members),
        min_members_required=opp.get("min_members", 1),
        required_models=opp.get("required_models", []),
        duration_s=int(duration_avg),
        distance_km=dist,
        num_objectives=opp.get("num_objectives", 1),
        specialization_required=opp["category"] != "especial",
        org_level=player.get("level", 1),
        category=opp["category"],
        failure_probability=1.0 - chance,  # Probabilidade de falha
        is_rare_mission=opp.get("weight", 1) >= 8,  # Missões com weight alto são raras
        multiplier_stack=min(2.5, mult),  # Limitar stack para evitar abuso
        repeat_count=0,  # TODO: rastrear repetições consecutivas se desejado
        vehicles_dict=VEHICLE_MODELS,
        specialization_match=spec_match,
    )

    # Aplicar multiplicadores existentes (achievements, properties, temp bonus) e penalidades
    reward = int(reward_data["money"] * mult * age_mult * split_mult)

    return {
        "members": members, "vehicle": vehicle, "dist": dist, "round_km": round_km,
        "fuel_needed": fuel_needed, "speed": speed, "travel_s": travel_s,
        "reward": reward, "reward_mult": mult, "age_mult": age_mult, "split_mult": split_mult,
        "reward_difficulty_score": reward_data["difficulty_score"],
        "reward_xp": reward_data["xp"],
        "reward_reputation": reward_data["reputation"],
        "reward_bonus_chance": reward_data["bonus_reward_chance"],
        "team_skill": team_skill,
        "spec_match": spec_match, "chance": chance, "breakdown": breakdown,
        "talents": member_talents, "min_members": opp.get("min_members", 1),
    }


async def _validate_dispatch_inputs(body: DispatchInput, user: dict):
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
    return player, opp, team


@router.post("/dispatch/preview")
async def dispatch_preview(body: DispatchInput, user: dict = Depends(get_current_user)):
    player, opp, team = await _validate_dispatch_inputs(body, user)
    prep = await _prepare_dispatch(player, opp, team)
    return {
        "chance": round(prep["chance"], 3),
        "breakdown": prep["breakdown"],
        "eta_s": round(prep["travel_s"]),
        "duration_s": opp["duration_s"],
        "fuel_needed": round(prep["fuel_needed"], 1),
        "reward": prep["reward"],
        "reward_bonus_pct": round((prep["reward_mult"] - 1) * 100, 1),
        "age_decay_pct": round((prep["age_mult"] - 1) * 100, 1),
        "split_penalty_pct": round((prep["split_mult"] - 1) * 100, 1),
        "members": len(prep["members"]),
        "effective_speed": round(prep["speed"], 1),
        "spec_match": prep["spec_match"],
        "talents": prep["talents"],
        "min_members": prep["min_members"],
        "min_members_met": len(prep["members"]) >= prep["min_members"],
    }


@router.post("/dispatch")
async def dispatch(body: DispatchInput, user: dict = Depends(get_current_user)):
    player, opp, team = await _validate_dispatch_inputs(body, user)
    pid = str(player["_id"])
    now = now_utc()
    prep = await _prepare_dispatch(player, opp, team)
    if len(prep["members"]) < prep["min_members"]:
        raise HTTPException(
            status_code=400,
            detail=f"Esta operação requer pelo menos {prep['min_members']} membros na equipa (tens {len(prep['members'])} disponíveis)",
        )
    vehicle = prep["vehicle"]
    members = prep["members"]
    repeat_type = team.get("last_type_key") == opp["type_key"]

    # Pequenos imprevistos, decididos só no momento do despacho (não na
    # pré-visualização, para esta continuar a mostrar sempre o valor de base):
    # trânsito e chuva podem atrasar ligeiramente a viagem.
    travel_s = prep["travel_s"]
    incidents = []
    if random.random() < TRAFFIC_DELAY_CHANCE:
        travel_s *= 1 + random.uniform(0.03, TRAFFIC_DELAY_MAX_PCT)
        incidents.append("trânsito")
    if random.random() < RAIN_CHANCE:
        travel_s *= RAIN_TRAVEL_MULT
        incidents.append("chuva")
    if incidents:
        await add_event(db, pid, "team", f"{team['name']} apanhou {' e '.join(incidents)} a caminho de {opp['name']} — viagem mais lenta.")

    depart = now
    arrive = depart + timedelta(seconds=travel_s)
    finish = arrive + timedelta(seconds=opp["duration_s"])
    ret = finish + timedelta(seconds=travel_s)
    member_ids = [str(e["_id"]) for e in members]

    mission = {
        "player_id": pid, "team_id": str(team["_id"]), "team_name": team["name"],
        "team_skill": round(prep["team_skill"], 2), "spec_match": prep["spec_match"],
        "success_chance": round(prep["chance"], 3),
        "member_ids": member_ids, "vehicle_id": str(vehicle["_id"]),
        "vehicle_luxury": VEHICLE_MODELS.get(vehicle["model_key"], {}).get("luxury", False),
        "repeat_type": repeat_type,
        "talents": prep["talents"],
        "opportunity_id": str(opp["_id"]),
        "opportunity": {
            "type_key": opp["type_key"], "name": opp["name"], "category": opp["category"],
            "district": opp["district"], "reward": prep["reward"], "respect": opp["respect"],
            "risk": opp["risk"], "heat": opp["heat"], "pays": opp["pays"], "min_level": opp["min_level"],
        },
        # Dados de recompensa dinâmica para cálculo consistente de XP/reputação
        "reward_xp": prep.get("reward_xp"),
        "reward_reputation": prep.get("reward_reputation"),
        "reward_difficulty_score": prep.get("reward_difficulty_score"),
        "origin": {"lat": player["hq"]["lat"], "lng": player["hq"]["lng"]},
        "target": {"lat": opp["lat"], "lng": opp["lng"]},
        "phase": "en_route", "outcome": None,
        "depart_at": depart.isoformat(), "arrive_at": arrive.isoformat(),
        "finish_at": finish.isoformat(), "return_at": ret.isoformat(),
    }
    result = await db.missions.insert_one(mission)
    await db.opportunities.update_one({"_id": opp["_id"]}, {"$set": {"status": "taken"}})
    await db.teams.update_one({"_id": team["_id"]}, {"$set": {"status": "en_route", "last_type_key": opp["type_key"]}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {
        "fuel_l": round(vehicle["fuel_l"] - prep["fuel_needed"], 2),
        "km_total": round(vehicle["km_total"] + prep["round_km"], 2),
    }})
    await db.employees.update_many(
        {"_id": {"$in": [ObjectId(i) for i in member_ids]}},
        {"$set": {"status": "on_mission"}},
    )
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"stats.ops_dispatched": 1}})
    await add_event(db, pid, "dispatch", f"{team['name']} ({len(members)} membros) destacada para {opp['name']} em {opp['district']}.")
    return {"mission_id": str(result.inserted_id)}


async def _try_prepare_dispatch(player, opp, team):
    """Como _prepare_dispatch, mas devolve None em vez de rebentar quando a
    combinação equipa/oportunidade não é viável — usado pelos endpoints de
    recomendação, que avaliam várias combinações e só querem as viáveis."""
    try:
        return await _prepare_dispatch(player, opp, team)
    except HTTPException:
        return None


def _rank_key(prep, priority=HQ_DEFAULT_PRIORITY):
    # Critério principal depende da prioridade global da organização; os
    # restantes campos servem de desempate, na mesma ordem de sempre (maior
    # probabilidade de sucesso, depois mais perto, depois maior recompensa).
    if priority == "lucro":
        return (-prep["reward"], -prep["chance"], prep["dist"])
    if priority == "velocidade":
        return (prep["travel_s"], -prep["chance"], -prep["reward"])
    if priority == "reputacao":
        return (-prep.get("reward_reputation", 0), -prep["chance"], -prep["reward"])
    if priority == "complexidade":
        return (-prep.get("reward_difficulty_score", 0), -prep["chance"], -prep["reward"])
    # "custos" e "equilibrio" (por omissão): comportamento clássico.
    return (-prep["chance"], prep["dist"], -prep["reward"])


@router.post("/dispatch/recommend_opportunity")
async def recommend_opportunity(body: TeamIdInput, user: dict = Depends(get_current_user)):
    """Para uma equipa, sugere a melhor oportunidade que ela consegue mesmo
    cumprir (nunca uma que não cumpra os requisitos mínimos). Se não houver
    candidatas válidas, tenta retornar pelo menos algo viável."""
    player = await get_player(user)
    pid = str(player["_id"])
    team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    if player["heat"] >= 90:
        return {"opportunity_id": None}
    priority = player["priorities"]["active"]
    now = now_utc()
    opps = await db.opportunities.find({
        "player_id": pid, "status": "active", "expires_at": {"$gt": now.isoformat()},
        "min_level": {"$lte": player["level"]},
    }).to_list(50)
    best_opp, best_prep = None, None
    for opp in opps:
        prep = await _try_prepare_dispatch(player, opp, team)
        if not prep:
            continue
        if len(prep["members"]) >= prep["min_members"]:
            if best_prep is None or _rank_key(prep, priority) < _rank_key(best_prep, priority):
                best_opp, best_prep = opp, prep
    if not best_opp:
        return {"opportunity_id": None}
    return {
        "opportunity_id": str(best_opp["_id"]),
        "chance": round(best_prep["chance"], 3),
        "reward": best_prep["reward"],
        "eta_s": round(best_prep["travel_s"]),
        "dist_km": round(best_prep["dist"] / 1000, 2),
    }


@router.post("/dispatch/recommend_team")
async def recommend_team(body: OpportunityIdInput, user: dict = Depends(get_current_user)):
    """Para uma oportunidade, sugere a equipa com maior probabilidade de
    sucesso entre as que cumprem mesmo os requisitos mínimos."""
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()
    opp = await db.opportunities.find_one({"_id": _oid(body.opportunity_id, "Oportunidade inválida"), "player_id": pid})
    if not opp or opp["status"] != "active" or parse_dt(opp["expires_at"]) <= now:
        return {"team_id": None}
    if player["heat"] >= 90 or player["level"] < opp["min_level"]:
        return {"team_id": None}
    priority = player["priorities"]["active"]
    teams = await db.teams.find({"player_id": pid, "status": "idle"}).to_list(50)
    best_team, best_prep = None, None
    for team in teams:
        prep = await _try_prepare_dispatch(player, opp, team)
        if not prep or len(prep["members"]) < prep["min_members"]:
            continue
        if best_prep is None or _rank_key(prep, priority) < _rank_key(best_prep, priority):
            best_team, best_prep = team, prep
    if not best_team:
        return {"team_id": None}
    return {
        "team_id": str(best_team["_id"]),
        "chance": round(best_prep["chance"], 3),
        "reward": best_prep["reward"],
        "eta_s": round(best_prep["travel_s"]),
        "dist_km": round(best_prep["dist"] / 1000, 2),
    }


@router.post("/dispatch/recommend_repeat")
async def recommend_repeat(body: TeamIdInput, user: dict = Depends(get_current_user)):
    """Repetir a última missão: sugere uma oportunidade ativa do mesmo tipo da
    última operação desta equipa, se ainda existir e for exequível."""
    player = await get_player(user)
    pid = str(player["_id"])
    team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
    if not team or not team.get("last_type_key"):
        return {"opportunity_id": None}
    if player["heat"] >= 90:
        return {"opportunity_id": None}
    priority = player["priorities"]["active"]
    now = now_utc()
    opps = await db.opportunities.find({
        "player_id": pid, "status": "active", "expires_at": {"$gt": now.isoformat()},
        "min_level": {"$lte": player["level"]}, "type_key": team["last_type_key"],
    }).to_list(50)
    best_opp, best_prep = None, None
    for opp in opps:
        prep = await _try_prepare_dispatch(player, opp, team)
        if not prep or len(prep["members"]) < prep["min_members"]:
            continue
        if best_prep is None or _rank_key(prep, priority) < _rank_key(best_prep, priority):
            best_opp, best_prep = opp, prep
    if not best_opp:
        return {"opportunity_id": None}
    return {
        "opportunity_id": str(best_opp["_id"]),
        "chance": round(best_prep["chance"], 3),
        "reward": best_prep["reward"],
        "eta_s": round(best_prep["travel_s"]),
        "dist_km": round(best_prep["dist"] / 1000, 2),
    }


@router.post("/opportunities/favorite")
async def toggle_favorite_type(body: TypeKeyInput, user: dict = Depends(get_current_user)):
    """Marca/desmarca um tipo de operação como favorito — favoritos aparecem
    primeiro no mapa e na lista de oportunidades."""
    if body.type_key not in OPPORTUNITY_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de operação inválido")
    player = await get_player(user)
    favorites = list(player.get("favorite_types", []))
    if body.type_key in favorites:
        favorites.remove(body.type_key)
    else:
        favorites.append(body.type_key)
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"favorite_types": favorites}})
    return {"favorite_types": favorites}


@router.post("/missions/recall")
async def recall_mission(body: MissionIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    m = await db.missions.find_one({"_id": _oid(body.mission_id, "Operação inválida"), "player_id": pid})
    if not m:
        raise HTTPException(status_code=404, detail="Operação não encontrada")
    if m["phase"] != "en_route":
        raise HTTPException(status_code=400, detail="Só podes chamar de volta uma equipa que ainda vai a caminho do alvo")
    now = now_utc()
    depart = parse_dt(m["depart_at"])
    arrive = parse_dt(m["arrive_at"])
    total = max(1.0, (arrive - depart).total_seconds())
    elapsed = max(1.0, min(total, (now - depart).total_seconds()))
    t = elapsed / total
    o, tg = m["origin"], m["target"]
    turn_point = {"lat": o["lat"] + (tg["lat"] - o["lat"]) * t, "lng": o["lng"] + (tg["lng"] - o["lng"]) * t}
    ret = now + timedelta(seconds=elapsed)
    await db.missions.update_one({"_id": m["_id"]}, {"$set": {
        "phase": "returning", "outcome": "recalled",
        "target": turn_point, "arrive_at": now.isoformat(), "finish_at": now.isoformat(),
        "return_at": ret.isoformat(),
    }})
    await db.teams.update_one({"_id": ObjectId(m["team_id"])}, {"$set": {"status": "returning"}})
    if m.get("opportunity_id"):
        await db.opportunities.update_one(
            {"_id": ObjectId(m["opportunity_id"]), "status": "taken", "expires_at": {"$gt": now.isoformat()}},
            {"$set": {"status": "active"}},
        )
    late = t >= RECALL_PENALTY_FRACTION
    msg = f"{m['team_name']} foi chamada de volta à base sem completar {m['opportunity']['name']}."
    if late:
        new_heat = min(100.0, player["heat"] + RECALL_PENALTY_HEAT)
        await db.players.update_one({"_id": player["_id"]}, {"$set": {"heat": new_heat}})
        if m.get("member_ids"):
            await db.employees.update_many(
                {"_id": {"$in": [ObjectId(i) for i in m["member_ids"]]}},
                {"$inc": {"fatigue": RECALL_PENALTY_FATIGUE}},
            )
        msg += f" Chamada tardia (já a {round(t * 100)}% do caminho) — +{RECALL_PENALTY_HEAT} calor e equipa mais cansada."
    await add_event(db, pid, "team", msg)
    return {"ok": True, "return_at": ret.isoformat(), "late_penalty": late}


@router.post("/teams/create")
async def create_team(body: TeamCreateInput, user: dict = Depends(get_current_user)):
    if body.spec not in TEAM_SPECS:
        raise HTTPException(status_code=400, detail="Especialização inválida")
    player = await get_player(user)
    pid = str(player["_id"])
    if player["clean_money"] < TEAM_CREATE_COST:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    count = await db.teams.count_documents({"player_id": pid})
    max_teams = max_teams_for(player["level"])
    if count >= max_teams:
        raise HTTPException(status_code=400, detail=f"Limite de {max_teams} equipas para o nível {player['level']} — sobe de nível para desbloquear mais.")
    name = TEAM_NAMES[count % len(TEAM_NAMES)]
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -TEAM_CREATE_COST, "stats.teams_created": 1}})
    created = now_utc().isoformat()
    await db.teams.insert_one({
        "player_id": pid, "name": name, "spec": body.spec, "status": "idle",
        "vehicle_id": None, "missions_done": 0, "created_at": created,
        "available_at": None, "roster_stable_since": created,
    })
    await add_event(db, pid, "team", f"{name} ({TEAM_SPECS[body.spec]['name']}) formada por {TEAM_CREATE_COST:,} €.")
    await record_tx(db, pid, "team_create", -TEAM_CREATE_COST, "clean", player["clean_money"] - TEAM_CREATE_COST, f"Nova equipa: {name}")
    return {"ok": True}


# ---------------- Funcionários ----------------

async def _get_employee(pid, employee_id):
    emp = await db.employees.find_one({"_id": _oid(employee_id, "Operacional inválido"), "player_id": pid})
    if not emp:
        raise HTTPException(status_code=404, detail="Operacional não encontrado")
    return emp


@router.post("/employees/recruit")
async def recruit_employee(body: RecruitInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    cand = await db.candidates.find_one({"_id": _oid(body.candidate_id, "Candidato inválido"), "player_id": pid})
    if not cand:
        raise HTTPException(status_code=404, detail="Candidato já não está disponível")
    if player["respect"] < cand["min_respect"]:
        raise HTTPException(status_code=400, detail=f"Requer {cand['min_respect']:,} respeito para recrutar {RARITIES[cand['rarity']]['name']}")
    if player["clean_money"] < cand["cost"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    caps, _ = await get_caps(db, pid, player["hq"]["level"])
    used = await db.employees.count_documents({"player_id": pid})
    if used >= caps["employees"]:
        raise HTTPException(status_code=400, detail="Sem capacidade. Compra ou melhora um esconderijo.")
    doc = employee_from_candidate(cand, now_utc().isoformat())
    inc = {"clean_money": -cand["cost"], "stats.recruits_hired": 1}
    if cand["role_key"] == "informador":
        inc["stats.recruits_informador"] = 1
    await db.players.update_one({"_id": player["_id"]}, {"$inc": inc})
    await db.employees.insert_one(doc)
    await db.candidates.delete_one({"_id": cand["_id"]})
    role_name = SPECIALIZATIONS[cand["role_key"]]["name"]
    await add_event(db, pid, "team", f"{cand['name']} ({role_name}, {RARITIES[cand['rarity']]['name']}) recrutado por {cand['cost']:,} €.")
    await record_tx(db, pid, "recruit", -cand["cost"], "clean", player["clean_money"] - cand["cost"], f"Recrutamento de {cand['name']}")
    return {"ok": True}


@router.post("/recruitment/refresh")
async def refresh_recruitment(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if player["clean_money"] < POOL_REFRESH_COST:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    now = now_utc()
    await db.candidates.delete_many({"player_id": pid})
    docs = []
    for key, src in RECRUIT_SOURCES.items():
        if player["level"] >= src["min_level"]:
            for _ in range(2):
                docs.append(gen_candidate(pid, key, now.isoformat()))
    if docs:
        await db.candidates.insert_many(docs)
    await db.players.update_one({"_id": player["_id"]}, {
        "$inc": {"clean_money": -POOL_REFRESH_COST},
        "$set": {"pool_refresh_at": (now + timedelta(minutes=POOL_REFRESH_MIN)).isoformat()},
    })
    await add_event(db, pid, "team", f"Contactos de recrutamento atualizados por {POOL_REFRESH_COST:,} €.")
    await record_tx(db, pid, "pool_refresh", -POOL_REFRESH_COST, "clean", player["clean_money"] - POOL_REFRESH_COST, "Atualização de contactos")
    return {"ok": True}


@router.post("/employees/assign")
async def assign_employee(body: AssignEmployeeInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Operacional está ocupado")
    if body.team_id:
        team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
        if not team:
            raise HTTPException(status_code=404, detail="Equipa não encontrada")
        current = await db.employees.count_documents({"player_id": pid, "team_id": body.team_id})
        if current >= TEAM_MAX_MEMBERS:
            raise HTTPException(status_code=400, detail=f"A equipa já está no limite de {TEAM_MAX_MEMBERS} membros")
    old_team_id = emp.get("team_id")
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"team_id": body.team_id}})
    # Mudar o plantel de uma equipa quebra a coordenação: reinicia a veterania e
    # aplica um pequeno cooldown de reorganização antes do próximo despacho.
    affected_ids = {tid for tid in (old_team_id, body.team_id) if tid}
    if affected_ids:
        now_iso = now_utc().isoformat()
        reorg_until = (now_utc() + timedelta(seconds=REORG_AFTER_ROSTER_CHANGE_S)).isoformat()
        await db.teams.update_many(
            {"_id": {"$in": [ObjectId(tid) for tid in affected_ids]}, "player_id": pid},
            {"$set": {"roster_stable_since": now_iso, "available_at": reorg_until}},
        )
    return {"ok": True}


@router.post("/employees/train")
async def train_employee(body: TrainInput, user: dict = Depends(get_current_user)):
    if body.course_key not in TRAINING_COURSES:
        raise HTTPException(status_code=400, detail="Formação inválida")
    player = await get_player(user)
    pid = str(player["_id"])
    course = TRAINING_COURSES[body.course_key]
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Operacional está ocupado")
    if player["clean_money"] < course["cost"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    ends = now_utc() + timedelta(seconds=course["duration_s"])
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -course["cost"]}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
        "status": "training",
        "training": {"course_key": body.course_key, "ends_at": ends.isoformat()},
    }})
    await add_event(db, pid, "team", f"{emp['name']} iniciou a formação {course['name']}.")
    await record_tx(db, pid, "training", -course["cost"], "clean", player["clean_money"] - course["cost"], f"Formação {course['name']} de {emp['name']}")
    return {"ok": True}


@router.post("/employees/rest")
async def rest_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Operacional está ocupado")
    if emp["fatigue"] < 15:
        raise HTTPException(status_code=400, detail="Não está fatigado o suficiente para descansar")
    until = (now_utc() + timedelta(seconds=REST_DURATION_S)).isoformat()
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"status": "resting", "status_until": until}})
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"stats.employees_rested": 1}})
    await add_event(db, pid, "team", f"{emp['name']} foi descansar.")
    return {"ok": True}


@router.post("/employees/promote")
async def promote_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] == "on_mission":
        raise HTTPException(status_code=400, detail="Operacional está em operação")
    try:
        idx = RANKS.index(emp.get("rank", "recruta"))
    except ValueError:
        idx = 0
    if idx >= len(RANKS) - 1:
        raise HTTPException(status_code=400, detail="Já está no topo da hierarquia")
    new_idx = idx + 1
    if emp["level"] < RANK_REQ_LEVEL[new_idx]:
        raise HTTPException(status_code=400, detail=f"Requer nível {RANK_REQ_LEVEL[new_idx]} do operacional")
    cost = PROMOTE_BASE_COST * new_idx
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    new_rank = RANKS[new_idx]
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost, "stats.employees_promoted": 1}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
        "rank": new_rank, "salary": int(emp.get("salary", 0) * 1.1),
        "loyalty": min(100.0, emp.get("loyalty", 70) + 10),
        "morale": min(100.0, emp.get("morale", 70) + 8),
        "fatigue": 0.0,
    }})
    await push_history(db, emp["_id"], f"Promovido a {new_rank.replace('_', ' ')}.")
    await add_event(db, pid, "team", f"{emp['name']} promovido a {new_rank.replace('_', ' ')} por {cost:,} €.")
    await record_tx(db, pid, "promote", -cost, "clean", player["clean_money"] - cost, f"Promoção de {emp['name']}")
    return {"ok": True}


@router.post("/employees/bonus")
async def bonus_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    cost = max(100, emp.get("salary", 100))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost, "stats.bonuses_paid": 1}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
        "morale": min(100.0, emp.get("morale", 70) + 15),
        "loyalty": min(100.0, emp.get("loyalty", 70) + 10),
    }})
    await push_history(db, emp["_id"], f"Recebeu um bónus de {cost:,} €.")
    await add_event(db, pid, "team", f"Bónus de {cost:,} € pago a {emp['name']}. Moral e lealdade subiram.")
    await record_tx(db, pid, "bonus", -cost, "clean", player["clean_money"] - cost, f"Bónus para {emp['name']}")
    return {"cost": cost}


@router.post("/employees/heal")
async def heal_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "injured":
        raise HTTPException(status_code=400, detail="Operacional não está ferido")
    bonuses = await get_org_bonuses(db, pid)
    cost = max(200, int(HEAL_BASE_COST * (1 - bonuses["heal"])))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"status": "idle", "status_until": None}})
    await push_history(db, emp["_id"], "Tratado na clínica clandestina.")
    await add_event(db, pid, "team", f"{emp['name']} tratado na clínica clandestina por {cost:,} €.")
    await record_tx(db, pid, "heal", -cost, "clean", player["clean_money"] - cost, f"Clínica para {emp['name']}")
    return {"cost": cost}


@router.post("/employees/release")
async def release_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "arrested":
        raise HTTPException(status_code=400, detail="Operacional não está preso")
    bonuses = await get_org_bonuses(db, pid)
    cost = max(300, int((RELEASE_BASE_COST + player["heat"] * 30) * (1 - bonuses["legal"]) * (1 - bonuses["bribe_discount"])))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
        "status": "idle", "status_until": None,
        "loyalty": min(100.0, emp.get("loyalty", 70) + 8),
    }})
    await push_history(db, emp["_id"], "Libertado com ajuda do advogado.")
    await add_event(db, pid, "team", f"{emp['name']} libertado da prisão por {cost:,} € (advogados e subornos).")
    await record_tx(db, pid, "release", -cost, "clean", player["clean_money"] - cost, f"Advogado para {emp['name']}")
    return {"cost": cost}


@router.post("/employees/fire")
async def fire_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] == "on_mission":
        raise HTTPException(status_code=400, detail="Não podes despedir alguém em operação")
    severance = emp.get("salary", 100) * 3
    if player["clean_money"] < severance:
        raise HTTPException(status_code=400, detail=f"Indemnização de {severance:,} € — dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -severance}})
    await db.employees.delete_one({"_id": emp["_id"]})
    await db.employees.update_many({"player_id": pid}, {"$inc": {"morale": -3}})
    await db.employees.update_many({"player_id": pid, "morale": {"$lt": 0}}, {"$set": {"morale": 0.0}})
    await add_event(db, pid, "team", f"{emp['name']} despedido (indemnização de {severance:,} €). A moral da equipa ressentiu-se.")
    await record_tx(db, pid, "fire", -severance, "clean", player["clean_money"] - severance, f"Indemnização de {emp['name']}")
    return {"severance": severance}


@router.post("/employees/rename")
async def rename_employee(body: EmployeeRenameInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome não pode estar vazio")
    old_name = emp["name"]
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"name": name}})
    if name != old_name:
        await push_history(db, emp["_id"], f"Renomeado de {old_name} para {name}.")
    return {"ok": True}


# ---------------- Veículos ----------------

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
    caps, _ = await get_caps(db, pid, player["hq"]["level"])
    used = await db.vehicles.count_documents({"player_id": pid})
    if used >= caps["vehicles"]:
        raise HTTPException(status_code=400, detail="Garagem cheia. Compra ou melhora uma garagem.")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -model["price"], "stats.vehicles_bought": 1}})
    await db.vehicles.insert_one(vehicle_doc(pid, body.model_key, now_utc().isoformat()))
    await add_event(db, pid, "vehicle", f"{model['name']} adquirido por {model['price']:,} €.")
    await record_tx(db, pid, "vehicle_buy", -model["price"], "clean", player["clean_money"] - model["price"], f"Compra de {model['name']}")
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
        raise HTTPException(status_code=400, detail="O veículo está em operação")
    if vehicle.get("refueling_until") and parse_dt(vehicle["refueling_until"]) > now_utc():
        raise HTTPException(status_code=400, detail="O veículo está a abastecer")
    value = int(vehicle["price"] * 0.4 * vehicle["condition"] / 100)
    if vehicle.get("team_id"):
        await db.teams.update_one({"_id": ObjectId(vehicle["team_id"])}, {"$set": {"vehicle_id": None}})
    await db.vehicles.delete_one({"_id": vehicle["_id"]})
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": value}})
    await add_event(db, pid, "vehicle", f"{vehicle['name']} abatido. Recebeste {value:,} €.")
    await record_tx(db, pid, "vehicle_sell", value, "clean", player["clean_money"] + value, f"Venda de {vehicle['name']}")
    return {"value": value}


@router.post("/vehicles/refuel")
async def refuel_vehicle(body: VehicleIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em operação")
    if vehicle.get("refueling_until") and parse_dt(vehicle["refueling_until"]) > now_utc():
        raise HTTPException(status_code=400, detail="Já está a abastecer")
    missing = vehicle["tank_l"] - vehicle["fuel_l"]
    if missing <= 0.1:
        raise HTTPException(status_code=400, detail="Depósito já está cheio")
    cost = math.ceil(missing * FUEL_PRICES[vehicle["fuel_type"]])
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    duration_s = REFUEL_DURATION_BASE_S + REFUEL_DURATION_PER_L_S * missing
    until = (now_utc() + timedelta(seconds=duration_s)).isoformat()
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost, "stats.vehicles_refueled": 1}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"refueling_until": until}, "$inc": {"fuel_spent_total": cost}})
    await add_event(db, pid, "vehicle", f"{vehicle['name']} a abastecer ({vehicle['fuel_type']}) por {cost:,} € — pronto em {round(duration_s)}s.")
    await record_tx(db, pid, "refuel", -cost, "clean", player["clean_money"] - cost, f"Combustível para {vehicle['name']}")
    return {"cost": cost, "refueling_until": until}


@router.post("/vehicles/repair")
async def repair_vehicle(body: VehicleIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em operação")
    missing = 100 - vehicle["condition"]
    if missing < 1:
        raise HTTPException(status_code=400, detail="Veículo em perfeitas condições")
    _, props = await get_caps(db, pid, player["hq"]["level"])
    bonuses = await get_org_bonuses(db, pid)
    now = now_utc()
    prop_ranks = property_stack_ranks(props)
    oficina_pct = PROPERTY_TYPES["oficina"]["repair_discount_pct"]
    discount = min(0.6, sum(
        oficina_pct * p["level"] * property_condition_factor(p) * property_stack_mult(prop_ranks[p["_id"]])
        for p in props if p["type_key"] == "oficina" and property_active(p, now)
    ) + bonuses["repair_discount"])
    cost = max(50, int(missing * vehicle["price"] * 0.012 * (1 - discount)))  # 0.012 = 1.2% (redesigned, 6x increase)
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost, "stats.vehicles_repaired": 1}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {
        "$set": {"condition": 100.0, "missions_since_repair": 0},
        "$inc": {"repair_spent_total": cost},
    })
    await add_event(db, pid, "vehicle", f"{vehicle['name']} reparado por {cost:,} €.")
    await record_tx(db, pid, "repair", -cost, "clean", player["clean_money"] - cost, f"Reparação de {vehicle['name']}")
    return {"cost": cost}


@router.post("/vehicles/assign")
async def assign_vehicle(body: VehicleAssignInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em operação")
    if vehicle.get("team_id"):
        await db.teams.update_one({"_id": ObjectId(vehicle["team_id"])}, {"$set": {"vehicle_id": None}})
    if body.team_id:
        team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
        if not team:
            raise HTTPException(status_code=404, detail="Equipa não encontrada")
        if team["status"] != "idle":
            raise HTTPException(status_code=400, detail="A equipa está em operação")
        if team.get("vehicle_id"):
            await db.vehicles.update_one({"_id": ObjectId(team["vehicle_id"])}, {"$set": {"team_id": None}})
        await db.teams.update_one({"_id": team["_id"]}, {"$set": {"vehicle_id": str(vehicle["_id"])}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"team_id": body.team_id}})
    return {"ok": True}


@router.post("/vehicles/rename")
async def rename_vehicle(body: VehicleRenameInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome não pode estar vazio")
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"name": name}})
    return {"ok": True}


# ---------------- Propriedades ----------------

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
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -pt["price"], "stats.properties_bought": 1}})
    await db.properties.insert_one({
        "player_id": pid, "type_key": body.type_key,
        "name": f"{pt['name']} — {spot['name']}", "district": spot["name"],
        "lat": spot["lat"] + random.uniform(-0.006, 0.006),
        "lng": spot["lng"] + random.uniform(-0.008, 0.008),
        "level": 1, "bought_at": now_utc().isoformat(),
    })
    await add_event(db, pid, "property", f"{pt['name']} comprado em {spot['name']} por {pt['price']:,} €.")
    await record_tx(db, pid, "property_buy", -pt["price"], "clean", player["clean_money"] - pt["price"], f"Compra de {pt['name']}")
    return {"ok": True}


@router.post("/properties/sell")
async def sell_property(body: PropertyIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    prop = await db.properties.find_one({"_id": _oid(body.property_id, "Propriedade inválida"), "player_id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada")
    if prop.get("upgrading_until") and parse_dt(prop["upgrading_until"]) > now_utc():
        raise HTTPException(status_code=400, detail="Não podes vender: está a ser melhorado")
    pt = PROPERTY_TYPES[prop["type_key"]]
    caps, _ = await get_caps(db, pid, player["hq"]["level"])
    if pt.get("cap_employees"):
        used = await db.employees.count_documents({"player_id": pid})
        if used > caps["employees"] - pt["cap_employees"] * prop["level"]:
            raise HTTPException(status_code=400, detail="Não podes vender: os teus operacionais ficariam sem espaço")
    if pt.get("cap_vehicles"):
        used = await db.vehicles.count_documents({"player_id": pid})
        if used > caps["vehicles"] - pt["cap_vehicles"] * prop["level"]:
            raise HTTPException(status_code=400, detail="Não podes vender: os teus veículos ficariam sem espaço")
    value = int(pt["price"] * 0.7 * prop["level"])
    await db.properties.delete_one({"_id": prop["_id"]})
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": value}})
    await add_event(db, pid, "property", f"{prop['name']} vendido por {value:,} €.")
    await record_tx(db, pid, "property_sell", value, "clean", player["clean_money"] + value, f"Venda de {prop['name']}")
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
    now = now_utc()
    if prop.get("upgrading_until") and parse_dt(prop["upgrading_until"]) > now:
        raise HTTPException(status_code=400, detail="Já está a ser melhorado")
    pt = PROPERTY_TYPES[prop["type_key"]]
    cost = int(pt["price"] * 0.6 * (prop["level"] + 1))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    target_level = prop["level"] + 1
    duration_s = PROPERTY_UPGRADE_BASE_S + PROPERTY_UPGRADE_PER_LEVEL_S * target_level
    until = (now + timedelta(seconds=duration_s)).isoformat()
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost, "stats.properties_upgraded": 1}})
    await db.properties.update_one({"_id": prop["_id"]}, {"$set": {"upgrading_until": until}})
    await add_event(db, pid, "property", f"{prop['name']} começou a ser melhorado para nível {target_level} por {cost:,} € — pronto em {round(duration_s / 60, 1)} min.")
    await record_tx(db, pid, "property_upgrade", -cost, "clean", player["clean_money"] - cost, f"Melhoria de {prop['name']}")
    return {"ok": True, "upgrading_until": until}


@router.post("/properties/rename")
async def rename_property(body: PropertyRenameInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    prop = await db.properties.find_one({"_id": _oid(body.property_id, "Propriedade inválida"), "player_id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Propriedade não encontrada")
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome não pode estar vazio")
    await db.properties.update_one({"_id": prop["_id"]}, {"$set": {"name": name}})
    return {"ok": True}


# ---------------- Quartel-General ----------------

@router.post("/hq/upgrade")
async def upgrade_hq(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    hq = player["hq"]
    level = hq["level"]
    if level >= HQ_MAX_LEVEL:
        raise HTTPException(status_code=400, detail="Nível máximo atingido")
    now = now_utc()
    if hq.get("upgrading_until") and parse_dt(hq["upgrading_until"]) > now:
        raise HTTPException(status_code=400, detail="Já está a ser melhorado")
    target_level = level + 1
    tier = HQ_LEVEL_BENEFITS[target_level - 1]
    if player["level"] < tier["min_org_level"]:
        raise HTTPException(status_code=400, detail=f"Requer nível de organização {tier['min_org_level']}")
    cost = tier["upgrade_cost"]
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    duration_s = tier["upgrade_duration_s"]
    until = (now + timedelta(seconds=duration_s)).isoformat()
    await db.players.update_one({"_id": player["_id"]}, {
        "$inc": {"clean_money": -cost},
        "$set": {"hq.upgrading_until": until},
    })
    await add_event(db, pid, "property", f"Quartel-General começou a ser melhorado para nível {target_level} por {cost:,} € — pronto em {round(duration_s / 60, 1)} min.")
    await record_tx(db, pid, "hq_upgrade", -cost, "clean", player["clean_money"] - cost, f"Melhoria do Quartel-General para nível {target_level}")
    return {"ok": True, "upgrading_until": until}


@router.post("/hq/priority")
async def set_hq_priority(body: PriorityInput, user: dict = Depends(get_current_user)):
    if body.priority not in HQ_PRIORITIES:
        raise HTTPException(status_code=400, detail="Prioridade inválida")
    player = await get_player(user)
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"priorities.active": body.priority}})
    return {"ok": True, "priority": body.priority}


# ---------------- Polícia / economia ----------------

@router.post("/police/bribe")
async def bribe_police(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if player["heat"] < 10:
        raise HTTPException(status_code=400, detail="O calor está demasiado baixo para justificar um suborno")
    bonuses = await get_org_bonuses(db, pid)
    cost = max(1000, int(player["heat"] * 150 * (1 - bonuses["bribe_discount"])))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    new_heat = max(0.0, player["heat"] - 40)
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost, "stats.bribes_paid": 1}, "$set": {"heat": new_heat}})
    await add_event(db, pid, "police", f"Suborno de {cost:,} € pago. O calor baixou para {round(new_heat)}%.")
    await record_tx(db, pid, "bribe", -cost, "clean", player["clean_money"] - cost, "Suborno à polícia")
    return {"cost": cost}


@router.post("/launder")
async def launder(body: LaunderInput, user: dict = Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Montante inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    if player["dirty_money"] < body.amount:
        raise HTTPException(status_code=400, detail="Dinheiro sujo insuficiente")
    bonuses = await get_org_bonuses(db, pid)
    now = now_utc()
    props = await db.properties.find({"player_id": pid, "type_key": "empresa_legal"}).to_list(50)
    property_bonus = sum(
        LAUNDER_PROPERTY_BONUS_PER_LEVEL * pr["level"] * property_condition_factor(pr)
        for pr in props if property_active(pr, now)
    )
    rate = min(0.95, 0.75 + bonuses["launder_rate"] + property_bonus)
    clean_gain = int(body.amount * rate)
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {
        "dirty_money": -body.amount, "clean_money": clean_gain, "stats.laundered_total": body.amount,
    }})
    await add_event(db, pid, "launder", f"Lavagem de {body.amount:,} € — recebeste {clean_gain:,} € limpos (taxa {round((1 - rate) * 100)}%).")
    await record_tx(db, pid, "launder_out", -body.amount, "dirty", player["dirty_money"] - body.amount, "Lavagem de dinheiro")
    await record_tx(db, pid, "launder_in", clean_gain, "clean", player["clean_money"] + clean_gain, "Lavagem de dinheiro")
    return {"clean_gain": clean_gain}


@router.get("/transactions")
async def get_transactions(user: dict = Depends(get_current_user)):
    """Extrato: as últimas transações, mais recente primeiro."""
    player = await get_player(user)
    pid = str(player["_id"])
    txs = await db.transactions.find({"player_id": pid}).sort("ts", -1).to_list(50)
    return {"transactions": [Transaction.from_mongo(t).model_dump() for t in txs]}


# ---------------- Definições ----------------

class SettingsUpdateInput(BaseModel):
    auto_repair_enabled: Optional[bool] = None
    auto_repair_threshold: Optional[int] = None
    auto_refuel_enabled: Optional[bool] = None
    auto_refuel_threshold: Optional[int] = None
    auto_rest_enabled: Optional[bool] = None
    auto_rest_threshold: Optional[int] = None
    auto_claim_quests: Optional[bool] = None


@router.post("/settings")
async def update_settings(body: SettingsUpdateInput, user: dict = Depends(get_current_user)):
    """Guarda as preferências de automatização — só estas afetam o servidor
    (as restantes definições de interface/jogabilidade vivem só no dispositivo)."""
    player = await get_player(user)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    for k in ("auto_repair_threshold", "auto_refuel_threshold", "auto_rest_threshold"):
        if k in updates:
            updates[k] = max(1, min(99, int(updates[k])))
    settings = {**(player.get("settings") or {}), **updates}
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"settings": settings}})
    return {"settings": settings}


# ---------------- Missões ----------------


@router.post("/quests/claim")
async def claim_quest(body: QuestClaimInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    q = await db.quests.find_one({"_id": _oid(body.quest_id, "Missão inválida"), "player_id": pid})
    if not q:
        raise HTTPException(status_code=404, detail="Missão não encontrada")
    if q["status"] != "completed":
        raise HTTPException(status_code=400, detail="A missão ainda não está concluída")
    d = QUEST_DEFS.get(q["quest_key"])
    if not d:
        raise HTTPException(status_code=400, detail="Missão desconhecida")
    parts = await grant_quest_rewards(db, player, d.get("rewards", {}))
    await db.quests.update_one({"_id": q["_id"]}, {"$set": {"status": "claimed", "claimed_at": now_utc().isoformat()}})
    if q["quest_key"] == "c2_front":
        await db.quests.insert_one(make_instance(pid, "dec_informador", now_utc(), player.get("stats", {}), expires_s=3600))
        await add_event(db, pid, "intel", "DECISÃO: O Informador quer falar contigo — abre o painel de Missões.")
    msg = f"Recompensa reclamada — {d['name']}: " + ", ".join(parts) + "." if parts else f"Missão {d['name']} reclamada."
    await add_event(db, pid, "success", msg)
    return {"ok": True, "rewards": parts, "unlocks": d.get("unlocks_text")}


@router.post("/quests/choose")
async def choose_quest(body: QuestChooseInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    q = await db.quests.find_one({"_id": _oid(body.quest_id, "Missão inválida"), "player_id": pid})
    if not q or q["status"] != "active":
        raise HTTPException(status_code=400, detail="Decisão já não está disponível")
    d = QUEST_DEFS.get(q["quest_key"])
    if not d or d["type"] != "decisao":
        raise HTTPException(status_code=400, detail="Esta missão não tem decisões")
    opt = d["options"].get(body.option)
    if not opt:
        raise HTTPException(status_code=400, detail="Opção inválida")
    if opt.get("cost_clean") and player["clean_money"] < opt["cost_clean"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    res = opt
    if opt.get("random"):
        r, acc = random.random(), 0.0
        res = opt["random"][-1]
        for cand in opt["random"]:
            acc += cand["p"]
            if r <= acc:
                res = cand
                break
    inc, sets = {}, {}
    if opt.get("cost_clean"):
        inc["clean_money"] = -opt["cost_clean"]
    eff = res.get("effects", {})
    if eff.get("dirty"):
        inc["dirty_money"] = eff["dirty"]
    if eff.get("clean"):
        inc["clean_money"] = inc.get("clean_money", 0) + eff["clean"]
    if eff.get("respect"):
        inc["respect"] = eff["respect"]
    if eff.get("heat"):
        sets["heat"] = max(0.0, min(100.0, player["heat"] + eff["heat"]))
    update = {}
    if inc:
        update["$inc"] = inc
    if sets:
        update["$set"] = sets
    if update:
        await db.players.update_one({"_id": player["_id"]}, update)
    await db.quests.update_one({"_id": q["_id"]}, {"$set": {
        "status": "claimed", "choice": body.option, "outcome": res["outcome"],
        "claimed_at": now_utc().isoformat(),
    }})
    await add_event(db, pid, "intel", f"{d['name']}: {res['outcome']}")
    return {"ok": True, "outcome": res["outcome"]}
