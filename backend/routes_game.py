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
                    team_effectiveness, district_attention_of,
                    age_decay_mult, member_split_mult, property_active, property_condition_factor,
                    local_presence_reduction_s, max_teams_for,
                    gen_candidate, employee_from_candidate, betrayal_risk_of, push_history,
                    record_tx, property_stack_ranks, property_stack_mult,
                    dirty_money_cap, grant_quest_rewards,
                    weapon_combat_score, weapon_effective_score, weapon_jam_risk,
                    weapon_condition_factor,
                    _unlink_employee_weapon,
                    is_on_land, nearest_district, resolve_mission_origin, get_property_vehicle_usage)
from quests import make_instance, enrich_quest, locked_principals, effective_quest_rewards
from quests_data import QUEST_DEFS
from models import Player, Team, Employee, Candidate, Vehicle, Weapon, Property, Opportunity, Mission, Event, Quest, Transaction
from game_data import (TEAM_SPECS, TEAM_NAMES, TEAM_CREATE_COST, SPECIALIZATIONS, RARITIES,
                       RARITY_MIN_RESPECT, RANKS, RANK_REQ_LEVEL, TALENTS, RECRUIT_SOURCES,
                       POOL_REFRESH_MIN, PAYROLL_CYCLE_MIN, TRAINING_COURSES, EMP_LEVEL_XP,
                       VEHICLE_MODELS, FUEL_PRICES, PROPERTY_TYPES, PROPERTY_MAX_LEVEL,
                       BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, OPPORTUNITY_TYPES,
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
                       HQ_DEPARTMENTS, WEAPON_MODELS, WEAPON_CATEGORIES, WEAPON_REPAIR_COST_MULTIPLIER,
                       WEAPON_CATEGORY_WEIGHTS, WEAPON_SKILL_FLOOR, WEAPON_SKILL_ATTR_CAP,
                       WEAPON_PROFICIENCY_MAX, WEAPON_PROFICIENCY_BONUS_MAX_PCT,
                       WEAPON_COMPATIBILITY_MIN_FACTOR, WEAPON_CONDITION_SOFT_KNEE,
                       WEAPON_JAM_RELIABILITY_WEIGHT, WEAPON_JAM_CONDITION_THRESHOLD,
                       WEAPON_JAM_CONDITION_WEIGHT, WEAPON_JAM_MAX, WEAPON_JAM_WARN_RISK,
                       WEAPON_DURABILITY_WEAR_REF,
                       LOW_CHANCE_CONFIRM_THRESHOLD,
                       VEHICLE_TRANSFER_COST_PER_KM, VEHICLE_TRANSFER_COST_MIN,
                       VEHICLE_TRANSFER_DURATION_BASE_S, VEHICLE_TRANSFER_DURATION_PER_KM_S)
from reward_engine import calculate_full_reward
from economy_constants import (TEAM_LEADER_MIN_RANK, STEALTH_VEHICLE_DISCRETION_MIN,
                               DRIVER_ATTR_BASELINE, DRIVER_TRAVEL_REDUCTION_PER_POINT,
                               DRIVER_TRAVEL_REDUCTION_MAX,
                               PARTIAL_SUCCESS_WINDOW, PARTIAL_REWARD_MIN, PARTIAL_REWARD_MAX,
                               EV_FAILURE_LOSS_FRAC)

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


class VehicleTransferInput(BaseModel):
    vehicle_id: str
    to_property_id: Optional[str] = None


class WeaponBuyInput(BaseModel):
    model_key: str


class WeaponIdInput(BaseModel):
    weapon_id: str


class WeaponAssignInput(BaseModel):
    weapon_id: str
    employee_id: str


class WeaponUnassignInput(BaseModel):
    employee_id: str


class PropertyBuyInput(BaseModel):
    type_key: str
    lat: float
    lng: float


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
        "weapon_models": WEAPON_MODELS,
        "weapon_categories": WEAPON_CATEGORIES,
        # QI das armas (SSS v5): pesos e fórmulas expostos para o frontend
        # calcular match %, risco de encravamento e adequação — a MESMA régua
        # que o motor usa na chance de missão.
        "weapon_category_weights": WEAPON_CATEGORY_WEIGHTS,
        "weapon_meta": {
            "skill_floor": WEAPON_SKILL_FLOOR,
            "skill_attr_cap": WEAPON_SKILL_ATTR_CAP,
            "proficiency_max": WEAPON_PROFICIENCY_MAX,
            "proficiency_bonus_max_pct": WEAPON_PROFICIENCY_BONUS_MAX_PCT,
            "compatibility_min_factor": WEAPON_COMPATIBILITY_MIN_FACTOR,
            "condition_soft_knee": WEAPON_CONDITION_SOFT_KNEE,
            "jam_reliability_weight": WEAPON_JAM_RELIABILITY_WEIGHT,
            "jam_condition_threshold": WEAPON_JAM_CONDITION_THRESHOLD,
            "jam_condition_weight": WEAPON_JAM_CONDITION_WEIGHT,
            "jam_max": WEAPON_JAM_MAX,
            "jam_warn_risk": WEAPON_JAM_WARN_RISK,
            "durability_wear_ref": WEAPON_DURABILITY_WEAR_REF,
            "repair_cost_multiplier": WEAPON_REPAIR_COST_MULTIPLIER,
        },
        "low_chance_confirm_threshold": LOW_CHANCE_CONFIRM_THRESHOLD,
    }


@router.get("/state")
async def get_state(user: dict = Depends(get_current_user), skip_advance: bool = False):
    player = await get_player(user)
    if not skip_advance:
        player = await advance(db, player)
    pid = str(player["_id"])
    now_iso = now_utc().isoformat()

    (teams, employees, candidates, vehicles, weapons, properties, opportunities, missions, history, events, quest_docs, caps, bonuses) = await asyncio.gather(
        db.teams.find({"player_id": pid}).to_list(100),
        db.employees.find({"player_id": pid}).to_list(300),
        db.candidates.find({"player_id": pid}).to_list(50),
        db.vehicles.find({"player_id": pid}).to_list(100),
        db.weapons.find({"player_id": pid}).to_list(300),
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

    quests_out = [enrich_quest(Quest.from_mongo(q).model_dump(), player) for q in quest_docs]
    quests_out += locked_principals({q["quest_key"] for q in quest_docs}, player["level"])

    return {
        "server_time": now_iso,
        "player": p,
        "teams": [Team.from_mongo(t).model_dump() for t in teams],
        "employees": emp_dumps,
        "candidates": [Candidate.from_mongo(c).model_dump() for c in candidates],
        "vehicles": [Vehicle.from_mongo(v).model_dump() for v in vehicles],
        "weapons": [Weapon.from_mongo(w).model_dump() for w in weapons],
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
    weapon_docs = await db.weapons.find({
        "player_id": pid, "employee_id": {"$in": [str(e["_id"]) for e in members]},
    }).to_list(50)
    weapons_by_employee_id = {w["employee_id"]: w for w in weapon_docs}
    if not team.get("vehicle_id"):
        raise HTTPException(status_code=400, detail="A equipa não tem veículo atribuído")
    vehicle = await db.vehicles.find_one({"_id": ObjectId(team["vehicle_id"]), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=400, detail="Veículo não encontrado")
    if vehicle["condition"] < 30:
        raise HTTPException(status_code=400, detail="O veículo precisa de reparação")
    if vehicle.get("refueling_until") and parse_dt(vehicle["refueling_until"]) > now_utc():
        raise HTTPException(status_code=400, detail="O veículo está a abastecer")
    if vehicle.get("transfer") and parse_dt(vehicle["transfer"]["ends_at"]) > now_utc():
        raise HTTPException(status_code=400, detail="O veículo está em trânsito para outra base")
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

    origin = await resolve_mission_origin(db, player, vehicle)
    dist = haversine_m(origin["lat"], origin["lng"], opp["lat"], opp["lng"])
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
    # Condutor de topo (SSS v4): o melhor atributo de condução da equipa
    # reduz o tempo de viagem — quem vai ao volante importa, não só o carro.
    best_driver = max(((e.get("attrs") or {}).get("conducao", 0) for e in members), default=0)
    if best_driver > DRIVER_ATTR_BASELINE:
        driver_reduction = min(DRIVER_TRAVEL_REDUCTION_MAX,
                               (best_driver - DRIVER_ATTR_BASELINE) * DRIVER_TRAVEL_REDUCTION_PER_POINT)
        travel_s = max(20, travel_s * (1 - driver_reduction))

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
    # Inteligência da equipa (SSS v4): papéis internos e memória, lidos uma vez
    # aqui e usados na chance, nas perseguições e nas consequências pós-missão.
    try:
        leader_idx = RANKS.index(TEAM_LEADER_MIN_RANK)
    except ValueError:
        leader_idx = len(RANKS) - 1
    leaders = [e for e in members if e.get("rank") in RANKS and RANKS.index(e["rank"]) >= leader_idx]
    has_leader = bool(leaders)
    leader_cool = max(((e.get("attrs") or {}).get("sangue_frio", 0) for e in leaders), default=0)
    member_roles = {e.get("role_key") for e in members}
    has_medic = "medico" in member_roles
    has_lawyer = "advogado" in member_roles
    team_streak = int(team.get("streak", 0) or 0)
    team_cat_missions = int((team.get("category_missions") or {}).get(opp["category"], 0) or 0)
    roster_missions = int(team.get("roster_missions", 0) or 0)
    vehicle_discreet = VEHICLE_MODELS.get(vehicle["model_key"], {}).get("discretion", 50) >= STEALTH_VEHICLE_DISCRETION_MIN
    chance_ctx = {
        "heat": player["heat"], "risk": opp["risk"], "dist_km": opp.get("dist_km", 0.0),
        "category": opp["category"], "members": members, "min_members": opp.get("min_members", 1),
        "vehicle": vehicle, "weapons_by_employee_id": weapons_by_employee_id,
        "roster_stable_since": team.get("roster_stable_since"), "hq_level": player["hq"]["level"],
        # SSS v4: memória do mundo e da equipa, finalmente ligadas à chance.
        "district": opp.get("district"),
        "district_attention": district_attention_of(player, opp.get("district")),
        "team_streak": team_streak,
        "team_cat_missions": team_cat_missions,
        "roster_missions": roster_missions,
        "now": now,
    }
    chance, breakdown = chance_breakdown(chance_ctx)
    # Forense pré-falha (SSS v4): os 3 fatores mais negativos do despacho, para
    # o relatório de falha explicar PORQUÊ ("Fator crítico: ...").
    top_negatives = [
        {"key": i["key"], "label": i["label"], "pct": i["pct"]}
        for i in sorted((i for i in breakdown if i["pct"] < 0 and i["key"] != "rendimentos_decrescentes"),
                        key=lambda i: i["pct"])[:3]
    ]
    weapon_loud = any(
        WEAPON_MODELS.get(w.get("model_key"), {}).get("loud", False)
        for w in weapons_by_employee_id.values()
    )
    # QI das armas (SSS v5): perfil de encravamento e poder de fogo médio,
    # persistidos com a missão — alimentam o roll de encravamento na ação,
    # a intimidação na fuga e os avisos do preview.
    weapon_jam_profile = []
    weapon_powers = []
    emp_by_id = {str(e["_id"]): e for e in members}
    for eid, w in weapons_by_employee_id.items():
        wm = WEAPON_MODELS.get(w.get("model_key"))
        if not wm:
            continue
        weapon_powers.append(wm.get("power", 0))
        jr = weapon_jam_risk(wm, w.get("condition", 100))
        if jr > 0:
            emp = emp_by_id.get(eid)
            weapon_jam_profile.append({
                "weapon_id": str(w["_id"]), "weapon_name": w.get("name", wm["name"]),
                "emp_name": (emp or {}).get("name", "?"), "jam_risk": round(jr, 3),
            })
    weapon_power_avg = round(sum(weapon_powers) / len(members), 1) if weapon_powers else 0.0
    weapon_alerts = [
        f"{wj['weapon_name']} de {wj['emp_name']}: risco de encravar ≈ {round(wj['jam_risk'] * 100)}%"
        for wj in weapon_jam_profile if wj["jam_risk"] >= WEAPON_JAM_WARN_RISK
    ]

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
        "weapon_loud": weapon_loud, "origin": origin,
        # SSS v4: inteligência da equipa persistida com a missão.
        "team_streak": team_streak, "vehicle_discreet": vehicle_discreet,
        "has_leader": has_leader, "leader_cool": leader_cool,
        "has_medic": has_medic, "has_lawyer": has_lawyer,
        "best_driver": best_driver, "top_negatives": top_negatives,
        # QI das armas (SSS v5): encravamento, intimidação e avisos.
        "weapon_jam_profile": weapon_jam_profile,
        "weapon_power_avg": weapon_power_avg,
        "weapon_alerts": weapon_alerts,
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
        "weapon_alerts": prep.get("weapon_alerts", []),
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
        "weapon_loud": prep.get("weapon_loud", False),
        "repeat_type": repeat_type,
        "talents": prep["talents"],
        # QI da equipa (SSS v4): campos que alimentam perseguições, clutch save,
        # papéis internos, aviso do líder e forense de falha.
        "team_streak": prep.get("team_streak", 0),
        "vehicle_speed_effective": round(prep["speed"], 1),
        "vehicle_discreet": prep.get("vehicle_discreet", False),
        "has_leader": prep.get("has_leader", False),
        "leader_cool": prep.get("leader_cool", 0),
        "has_medic": prep.get("has_medic", False),
        "has_lawyer": prep.get("has_lawyer", False),
        "best_driver": prep.get("best_driver", 0),
        "top_negatives": prep.get("top_negatives", []),
        "heat_at_dispatch": player.get("heat", 0),
        # QI das armas (SSS v5): perfil de encravamento (roll na ação) e
        # poder de fogo médio (intimidação na fuga).
        "weapon_jam_profile": prep.get("weapon_jam_profile", []),
        "weapon_power_avg": prep.get("weapon_power_avg", 0.0),
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
        "origin": {"lat": prep["origin"]["lat"], "lng": prep["origin"]["lng"]},
        "origin_property_id": prep["origin"]["property_id"],
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


def _expected_value(prep):
    """Valor esperado real de um despacho (SSS v4): chance*recompensa + saque
    esperado dos sucessos parciais (janela near-miss) − perdas esperadas numa
    falha franca (desgaste, calor, fadiga — proxy) − custo real do combustível.
    É isto que um consigliere calcularia, não apenas 'chance alta'."""
    chance = prep["chance"]
    reward = prep["reward"]
    partial_ev = PARTIAL_SUCCESS_WINDOW * ((PARTIAL_REWARD_MIN + PARTIAL_REWARD_MAX) / 2) * reward
    fail_prob = max(0.0, 1.0 - chance - PARTIAL_SUCCESS_WINDOW)
    fuel_type = (prep.get("vehicle") or {}).get("fuel_type")
    fuel_cost = prep.get("fuel_needed", 0.0) * FUEL_PRICES.get(fuel_type, 1.8)
    return chance * reward + partial_ev - fail_prob * reward * EV_FAILURE_LOSS_FRAC - fuel_cost


def _rank_key(prep, priority=HQ_DEFAULT_PRIORITY):
    # Critério principal depende da prioridade global da organização; os
    # restantes campos servem de desempate. SSS v4: o valor esperado real
    # (_expected_value) substitui a recompensa bruta — uma operação de 10k a
    # 40% de chance deixa de "ganhar" a uma de 6k a 95%.
    ev = _expected_value(prep)
    if priority == "lucro":
        return (-ev, -prep["chance"], prep["dist"])
    if priority == "velocidade":
        return (prep["travel_s"], -prep["chance"], -ev)
    if priority == "reputacao":
        return (-prep.get("reward_reputation", 0), -prep["chance"], -ev)
    if priority == "complexidade":
        return (-prep.get("reward_difficulty_score", 0), -prep["chance"], -ev)
    if priority == "custos":
        return (round(prep.get("fuel_needed", 0.0), 1), -prep["chance"], -ev)
    # "equilibrio" (por omissão): segurança primeiro (chance em degraus de 1%),
    # e dentro do mesmo degrau decide o valor esperado — o melhor dos dois mundos.
    return (-round(prep["chance"], 2), -ev, prep["dist"])


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
        # SSS v4: memória da equipa — momentum, familiaridade e entrosamento.
        "streak": 0, "category_missions": {}, "roster_missions": 0,
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
            {"$set": {"roster_stable_since": now_iso, "available_at": reorg_until, "roster_missions": 0}},
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
    await _unlink_employee_weapon(db, emp["_id"])
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
    if vehicle.get("transfer"):
        return False
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


@router.post("/vehicles/transfer")
async def transfer_vehicle(body: VehicleTransferInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if not await _vehicle_free(pid, vehicle):
        raise HTTPException(status_code=400, detail="O veículo está em operação")
    if (vehicle.get("property_id") or None) == (body.to_property_id or None):
        raise HTTPException(status_code=400, detail="O veículo já está nessa base")
    to_prop = None
    if body.to_property_id:
        to_prop = await db.properties.find_one({"_id": _oid(body.to_property_id, "Propriedade inválida"), "player_id": pid})
        if not to_prop:
            raise HTTPException(status_code=404, detail="Propriedade não encontrada")
    usage = await get_property_vehicle_usage(db, pid, player["hq"]["level"])
    target_key = body.to_property_id or "hq"
    if usage[target_key]["used"] >= usage[target_key]["max"]:
        raise HTTPException(status_code=400, detail="Essa base não tem capacidade para mais veículos")
    origin = await resolve_mission_origin(db, player, vehicle)
    to_lat, to_lng = (to_prop["lat"], to_prop["lng"]) if to_prop else (player["hq"]["lat"], player["hq"]["lng"])
    dist_km = haversine_m(origin["lat"], origin["lng"], to_lat, to_lng) / 1000
    cost = max(VEHICLE_TRANSFER_COST_MIN, round(dist_km * VEHICLE_TRANSFER_COST_PER_KM))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    duration_s = VEHICLE_TRANSFER_DURATION_BASE_S + VEHICLE_TRANSFER_DURATION_PER_KM_S * dist_km
    now = now_utc()
    until = (now + timedelta(seconds=duration_s)).isoformat()
    dest_name = to_prop["name"] if to_prop else player["hq"]["name"]
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {
        "transfer": {
            "to_property_id": body.to_property_id, "started_at": now.isoformat(), "ends_at": until,
            "from": {"lat": origin["lat"], "lng": origin["lng"]},
            "to": {"lat": to_lat, "lng": to_lng},
        },
    }})
    await add_event(db, pid, "vehicle", f"{vehicle['name']} a caminho de {dest_name} — chega em {round(duration_s)}s.")
    await record_tx(db, pid, "vehicle_transfer", -cost, "clean", player["clean_money"] - cost, f"Transferência de {vehicle['name']} para {dest_name}")
    return {"cost": cost, "transfer_until": until}


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


# ---------------- Armamento ----------------
# Equipamento operacional pessoal: uma arma por funcionário (ao contrário do
# veículo, partilhado pela equipa). Mesma família de endpoints (compra,
# venda, reparação, atribuição) que veículos, mas a ligação bidireccional é
# Employee↔Weapon em vez de Team↔Vehicle.

async def _weapon_free(pid, weapon):
    """Mirror de _vehicle_free, mas do lado do funcionário: uma arma
    atribuída a um funcionário em operação não pode ser vendida/reatribuída."""
    if weapon.get("employee_id"):
        emp = await db.employees.find_one({"_id": ObjectId(weapon["employee_id"]), "player_id": pid})
        if emp and emp["status"] != "idle":
            return False
    return True


@router.post("/weapons/buy")
async def buy_weapon(body: WeaponBuyInput, user: dict = Depends(get_current_user)):
    if body.model_key not in WEAPON_MODELS:
        raise HTTPException(status_code=400, detail="Modelo inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    model = WEAPON_MODELS[body.model_key]
    if player["level"] < model["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {model['min_level']}")
    if player["clean_money"] < model["price"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -model["price"]}})
    await db.weapons.insert_one({
        "player_id": pid, "model_key": body.model_key, "name": model["name"],
        "condition": 100.0, "employee_id": None, "missions_since_repair": 0,
        "missions_done": 0, "upgrades": [], "bought_at": now_utc().isoformat(),
    })
    await add_event(db, pid, "weapon", f"{model['name']} adquirida por {model['price']:,} €.")
    await record_tx(db, pid, "weapon_buy", -model["price"], "clean", player["clean_money"] - model["price"], f"Compra de {model['name']}")
    return {"ok": True}


@router.post("/weapons/sell")
async def sell_weapon(body: WeaponIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    weapon = await db.weapons.find_one({"_id": _oid(body.weapon_id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    if not await _weapon_free(pid, weapon):
        raise HTTPException(status_code=400, detail="O funcionário equipado está em operação")
    model = WEAPON_MODELS.get(weapon["model_key"], {})
    value = int(model.get("price", 0) * 0.4 * weapon.get("condition", 100) / 100)
    if weapon.get("employee_id"):
        await db.employees.update_one({"_id": ObjectId(weapon["employee_id"])}, {"$set": {"weapon_id": None}})
    await db.weapons.delete_one({"_id": weapon["_id"]})
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": value}})
    await add_event(db, pid, "weapon", f"{weapon['name']} vendida. Recebeste {value:,} €.")
    await record_tx(db, pid, "weapon_sell", value, "clean", player["clean_money"] + value, f"Venda de {weapon['name']}")
    return {"value": value}


@router.post("/weapons/repair")
async def repair_weapon(body: WeaponIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    weapon = await db.weapons.find_one({"_id": _oid(body.weapon_id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    if not await _weapon_free(pid, weapon):
        raise HTTPException(status_code=400, detail="O funcionário equipado está em operação")
    missing = 100 - weapon.get("condition", 100)
    if missing < 1:
        raise HTTPException(status_code=400, detail="Arma em perfeitas condições")
    model = WEAPON_MODELS.get(weapon["model_key"], {})
    cost = max(20, int(missing * model.get("maintenance_cost", 100) * WEAPON_REPAIR_COST_MULTIPLIER / 100))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -cost}})
    await db.weapons.update_one({"_id": weapon["_id"]}, {"$set": {"condition": 100.0, "missions_since_repair": 0}})
    await add_event(db, pid, "weapon", f"{weapon['name']} reparada por {cost:,} €.")
    await record_tx(db, pid, "weapon_repair", -cost, "clean", player["clean_money"] - cost, f"Reparação de {weapon['name']}")
    return {"cost": cost}


@router.post("/weapons/assign")
async def assign_weapon(body: WeaponAssignInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    weapon = await db.weapons.find_one({"_id": _oid(body.weapon_id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Operacional está ocupado")
    if not await _weapon_free(pid, weapon):
        raise HTTPException(status_code=400, detail="O funcionário atualmente equipado está em operação")
    # Desatribuir a arma anterior do funcionário (de volta ao inventário) e
    # esta arma de outro funcionário, se aplicável — mirror do padrão de
    # vehicles/assign, mas do lado do funcionário.
    if emp.get("weapon_id") and emp["weapon_id"] != str(weapon["_id"]):
        await db.weapons.update_one({"_id": ObjectId(emp["weapon_id"])}, {"$set": {"employee_id": None}})
    if weapon.get("employee_id") and weapon["employee_id"] != body.employee_id:
        await db.employees.update_one({"_id": ObjectId(weapon["employee_id"])}, {"$set": {"weapon_id": None}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"weapon_id": str(weapon["_id"])}})
    await db.weapons.update_one({"_id": weapon["_id"]}, {"$set": {"employee_id": body.employee_id}})
    return {"ok": True}


@router.post("/weapons/unassign")
async def unassign_weapon(body: WeaponUnassignInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if not emp.get("weapon_id"):
        raise HTTPException(status_code=400, detail="Operacional não tem arma equipada")
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Operacional está ocupado")
    await db.weapons.update_one({"_id": ObjectId(emp["weapon_id"])}, {"$set": {"employee_id": None}})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"weapon_id": None}})
    return {"ok": True}


@router.post("/weapons/auto_assign")
async def auto_assign_weapon(body: WeaponIdInput, user: dict = Depends(get_current_user)):
    """Atribui automaticamente a arma ao operacional disponível com o maior
    GANHO MARGINAL de score efetivo (SSS v5) — a mesma régua da chance de
    missão: adequação à especialização, compatibilidade de requisitos,
    habilidade, proficiência e condição da arma, descontando o que o
    operacional já rende com a arma atual."""
    player = await get_player(user)
    pid = str(player["_id"])
    weapon = await db.weapons.find_one({"_id": _oid(body.weapon_id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    if not await _weapon_free(pid, weapon):
        raise HTTPException(status_code=400, detail="O funcionário atualmente equipado está em operação")
    model = WEAPON_MODELS.get(weapon["model_key"], {})
    candidates = await db.employees.find({"player_id": pid, "status": "idle"}).to_list(300)
    if not candidates:
        raise HTTPException(status_code=400, detail="Não há operacionais disponíveis para equipar")
    current_weapons = {w["employee_id"]: w for w in await db.weapons.find({"player_id": pid, "employee_id": {"$ne": None}}).to_list(300)}

    def rank_key(emp):
        # QI das armas (SSS v5): ganho marginal REAL — score efetivo desta arma
        # nas mãos deste operacional (compatibilidade, habilidade, proficiência
        # e condição incluídas) menos o que ele já rende com a arma atual.
        # É a mesma régua que a chance de missão usa (weapon_effective_score).
        spec = emp.get("spec") or "especial"
        new_score = weapon_effective_score(emp, weapon, model, spec)
        current = current_weapons.get(str(emp["_id"]))
        current_score = 0.0
        if current:
            current_model = WEAPON_MODELS.get(current["model_key"])
            if current_model:
                current_score = weapon_effective_score(emp, current, current_model, spec)
        gain = new_score - current_score
        return (-round(gain, 6), -new_score, -emp.get("level", 1))

    best = min(candidates, key=rank_key)
    if best.get("weapon_id"):
        await db.weapons.update_one({"_id": ObjectId(best["weapon_id"])}, {"$set": {"employee_id": None}})
    if weapon.get("employee_id"):
        await db.employees.update_one({"_id": ObjectId(weapon["employee_id"])}, {"$set": {"weapon_id": None}})
    await db.employees.update_one({"_id": best["_id"]}, {"$set": {"weapon_id": str(weapon["_id"])}})
    await db.weapons.update_one({"_id": weapon["_id"]}, {"$set": {"employee_id": str(best["_id"])}})
    return {"ok": True, "employee_id": str(best["_id"]), "employee_name": best["name"]}


@router.post("/weapons/optimize")
async def optimize_weapons(user: dict = Depends(get_current_user)):
    """QI das armas (SSS v5): redistribui TODO o arsenal disponível pelos
    operacionais disponíveis maximizando o score efetivo global — atribuição
    gulosa por score (a mesma régua da chance de missão). Só mexe em armas
    cujo portador atual está disponível; quem está em serviço não larga a
    arma. Armas a mais ficam no inventário, sempre as piores combinações."""
    player = await get_player(user)
    pid = str(player["_id"])
    weapons = await db.weapons.find({"player_id": pid}).to_list(300)
    if not weapons:
        raise HTTPException(status_code=400, detail="Não tens armas no arsenal")
    employees = await db.employees.find({"player_id": pid}).to_list(300)
    emp_by_id = {str(e["_id"]): e for e in employees}
    idle = [e for e in employees if e.get("status") == "idle"]
    if not idle:
        raise HTTPException(status_code=400, detail="Nenhum operacional disponível para equipar")
    movable = []
    for w in weapons:
        holder = emp_by_id.get(w.get("employee_id") or "")
        if holder is None or holder.get("status") == "idle":
            movable.append(w)
    if not movable:
        raise HTTPException(status_code=400, detail="Nenhuma arma disponível para redistribuir (portadores em serviço)")

    # Todas as combinações (arma, operacional) avaliadas pela régua única e
    # atribuídas gulosamente por ordem decrescente de score efetivo.
    pairs = []
    weapons_by_id = {}
    for w in movable:
        wm = WEAPON_MODELS.get(w.get("model_key"))
        if not wm:
            continue
        wid = str(w["_id"])
        weapons_by_id[wid] = w
        for e in idle:
            spec = e.get("spec") or "especial"
            pairs.append((weapon_effective_score(e, w, wm, spec), wid, str(e["_id"])))
    if not pairs:
        raise HTTPException(status_code=400, detail="Nenhuma combinação válida para otimizar")
    pairs.sort(key=lambda p: p[0], reverse=True)
    plan, used_w, used_e = {}, set(), set()
    for score, wid, eid in pairs:
        if wid in used_w or eid in used_e:
            continue
        plan[wid] = eid
        used_w.add(wid)
        used_e.add(eid)

    changes = []
    for wid, eid in plan.items():
        w = weapons_by_id[wid]
        old_eid = w.get("employee_id")
        if old_eid == eid:
            continue
        changes.append({
            "weapon": w.get("name", "?"),
            "from": emp_by_id.get(old_eid, {}).get("name") if old_eid else None,
            "to": emp_by_id.get(eid, {}).get("name", "?"),
        })
    # Armas móveis que ficam sem portador (mais armas do que operacionais).
    benched = [weapons_by_id[wid].get("name", "?") for wid in weapons_by_id
               if wid not in plan and weapons_by_id[wid].get("employee_id")]
    if not changes and not benched:
        return {"ok": True, "changes": [], "message": "O arsenal já está na distribuição ótima."}

    # Aplicar: limpar vínculos das armas móveis e dos operacionais disponíveis,
    # depois ligar o plano — evita estados intermédios inconsistentes.
    await db.weapons.update_many(
        {"_id": {"$in": [ObjectId(wid) for wid in weapons_by_id]}},
        {"$set": {"employee_id": None}},
    )
    await db.employees.update_many(
        {"_id": {"$in": [e["_id"] for e in idle]}},
        {"$set": {"weapon_id": None}},
    )
    for wid, eid in plan.items():
        await db.weapons.update_one({"_id": ObjectId(wid)}, {"$set": {"employee_id": eid}})
        await db.employees.update_one({"_id": ObjectId(eid)}, {"$set": {"weapon_id": wid}})
    moved = len(changes)
    await add_event(db, pid, "weapon",
                    f"Arsenal otimizado — {moved} arma(s) redistribuída(s) pelos operacionais mais aptos."
                    + (f" {len(benched)} arma(s) voltaram ao inventário." if benched else ""))
    return {"ok": True, "changes": changes, "benched": benched,
            "message": f"{moved} arma(s) redistribuída(s)." if moved else "Arsenal arrumado — sem trocas necessárias."}


# ---------------- Propriedades ----------------

@router.post("/properties/buy")
async def buy_property(body: PropertyBuyInput, user: dict = Depends(get_current_user)):
    if body.type_key not in PROPERTY_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de propriedade inválido")
    if not is_on_land(body.lat, body.lng):
        raise HTTPException(status_code=400, detail="Localização inválida — escolhe um ponto em terra dentro de Lisboa")
    player = await get_player(user)
    pid = str(player["_id"])
    pt = PROPERTY_TYPES[body.type_key]
    if player["level"] < pt["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {pt['min_level']}")
    if player["clean_money"] < pt["price"]:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    district = nearest_district(body.lat, body.lng)
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": -pt["price"], "stats.properties_bought": 1}})
    await db.properties.insert_one({
        "player_id": pid, "type_key": body.type_key,
        "name": f"{pt['name']} — {district}", "district": district,
        "lat": body.lat, "lng": body.lng,
        "level": 1, "bought_at": now_utc().isoformat(),
    })
    await add_event(db, pid, "property", f"{pt['name']} comprado em {district} por {pt['price']:,} €.")
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
    value = int(pt["price"] * 0.7 * prop["level"])
    prop_id_str = str(prop["_id"])
    if pt.get("cap_vehicles"):
        stranded = await db.vehicles.find({"player_id": pid, "property_id": prop_id_str}).to_list(100)
        for v in stranded:
            await db.vehicles.update_one({"_id": v["_id"]}, {"$set": {"property_id": None}})
        await db.vehicles.update_many(
            {"player_id": pid, "transfer.to_property_id": prop_id_str},
            {"$set": {
                "transfer.to_property_id": None,
                "transfer.to": {"lat": player["hq"]["lat"], "lng": player["hq"]["lng"]},
            }},
        )
        if stranded:
            await add_event(db, pid, "property", f"{len(stranded)} veículo(s) realojado(s) no Quartel-General após venda de {prop['name']}.")
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
    # Recompensas dinâmicas SSS v3 — nível × dificuldade × tier adaptativo ×
    # série diária × execução rápida (mesma fórmula do auto-reclamar).
    rewards, mult_note = effective_quest_rewards(player, q, d, now_utc())
    parts = await grant_quest_rewards(db, player, rewards)
    if mult_note:
        parts.append(mult_note)
    # effective_quest_rewards mutou série/desempenho — persistir já.
    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "quest_streak": player.get("quest_streak", {}),
        "quest_perf": player.get("quest_perf", {}),
    }})
    await db.quests.update_one({"_id": q["_id"]}, {"$set": {"status": "claimed", "claimed_at": now_utc().isoformat()}})
    if q["quest_key"] == "c2_front":
        await db.quests.insert_one(make_instance(pid, "dec_informador", now_utc(), player.get("stats", {}), expires_s=3600))
        await add_event(db, pid, "intel", "DECISÃO: O Informador quer falar contigo — abre o painel de Missões.")
    msg = f"Recompensa reclamada — {d['name']}: " + ", ".join(parts) + "." if parts else f"Missão {d['name']} reclamada."
    await add_event(db, pid, "success", msg)
    return {"ok": True, "rewards": parts, "unlocks": d.get("unlocks_text"), "mult_note": mult_note}


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
    # Cadeias de consequências (SSS v3): certas escolhas plantam um evento
    # futuro — o mundo lembra-se do que fizeste e responde com atraso.
    chain = res.get("chain")
    if chain and QUEST_DEFS.get(chain.get("key")) and random.random() <= chain.get("p", 1.0):
        lo, hi = chain.get("delay_s", [120, 480])
        due = (now_utc() + timedelta(seconds=random.randint(int(lo), int(hi)))).isoformat()
        chains = list(player.get("pending_chains") or [])
        chains.append({"key": chain["key"], "at": due})
        sets["pending_chains"] = chains
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
