import asyncio
import math
import random
from functools import wraps
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from typing import Optional
from datetime import timedelta

from db import db
from auth import get_current_user
from geo import (is_valid_hq_location, is_in_portugal, in_water_body,
                 distance_to_boundary_m)
from geocode import reverse_geocode, street_label, locality_label
from world_gen import generate_district_points, name_districts_task, ensure_naming_scheduled
from engine import (advance, haversine_m, add_event, now_utc, next_threshold, parse_dt,
                    get_caps, get_org_bonuses, vehicle_doc, effective_speed, chance_breakdown,
                    team_effectiveness, district_attention_of, vehicle_mission_score,
                    age_decay_mult, member_split_mult, property_active, property_condition_factor,
                    local_presence_reduction_s, max_teams_for,
                    gen_candidate, employee_from_candidate, betrayal_risk_of, push_history,
                    record_tx, property_stack_ranks, property_stack_mult,
                    dirty_money_cap, grant_quest_rewards,
                    weapon_combat_score, weapon_effective_score, weapon_jam_risk,
                    weapon_condition_factor,
                    _unlink_employee_weapon,
                    is_on_land, nearest_district, resolve_mission_origin, get_property_vehicle_usage,
                    police_force_for, hot_category)
from quests import (make_instance, enrich_quest, locked_principals, effective_quest_rewards,
                    LEVEL_MONEY_SLOPE, LEVEL_RESPECT_SLOPE, TIER_BONUS, STREAK_BONUS,
                    STREAK_BONUS_MAX, SPEED_BONUS, TOTAL_MULT_CAP, MOMENTUM_CLAIM)
from quests_data import QUEST_DEFS, DIFFICULTY_MULT
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
                       WEAPON_WEAR_PER_MISSION, WEAPON_WEAR_RISK_MULT,
                       WEAPON_COMBAT_SCORE_SCALE, WEAPON_BONUS_MIN, WEAPON_BONUS_MAX,
                       WEAPON_LOUD_HEAT_MULT, WEAPON_PROFICIENCY_GAIN_PER_MISSION,
                       WEAPON_JAM_CHANCE_PENALTY, WEAPON_JAM_CHANCE_PENALTY_CAP,
                       WEAPON_JAM_EXTRA_WEAR, WEAPON_MISMATCH_PENALTY_MAX,
                       LOW_CHANCE_CONFIRM_THRESHOLD,
                       VEHICLE_TRANSFER_COST_PER_KM, VEHICLE_TRANSFER_COST_MIN,
                       VEHICLE_TRANSFER_DURATION_BASE_S, VEHICLE_TRANSFER_DURATION_PER_KM_S,
                       # QI da frota/imóveis (SSS v6) — réguas expostas no /catalog
                       VEHICLE_CATEGORY_WEIGHTS, VEHICLE_MISMATCH_PENALTY,
                       VEHICLE_CONDITION_PENALTY_THRESHOLD, VEHICLE_SPEED_FLOOR,
                       VEHICLE_SPEED_CURVE_EXP, PRIMARY_ATTR_WEIGHT_MAIN,
                       PRIMARY_ATTR_WEIGHT_SECONDARY,
                       # ---- Loja ----
                       SPEEDUP_COST_PER_MIN, SPEEDUP_COST_MIN,
                       SLOT_COST_VEHICLE_BASE, SLOT_COST_EMPLOYEE_BASE, SLOT_COST_SCALE_PER_UNIT,
                       VIP_PLANS, VIP_REFUEL_SPEED_MULT, VEHICLE_PAINTS, TEAM_EMBLEMS, HQ_SKINS)
from reward_engine import calculate_full_reward
from reward_config import MONEY_REWARD_MIN, MONEY_REWARD_MAX, REPEAT_PENALTY_MULTIPLIER
from property_market import property_market_price
from road_routing import road_router
from economy_calendar import WEEKLY_SETTLEMENT_WEEKDAY, WEEKLY_SETTLEMENT_HOUR
from economy_constants import (
    EMPLOYER_SOCIAL_SECURITY_RATE, VEHICLE_ANNUAL_FIXED_COSTS,
    LAUNDER_BASE_RATE, LAUNDER_MAX_RATE, LAUNDER_PASSIVE_RATE,
    VEHICLE_REPAIR_BASE_MULTIPLIER, PROPERTY_MAINTENANCE_PCT_PER_WEEK,
)
from live_ops import build_dispatch_script, build_recall_script, update_memory
from retention_engine import build_retention_snapshot, mission_decision, world_pulse
from game_data import operation_profile_of, OPERATION_PROFILE_LABELS
from organization_systems import (
    SUPPLY_CATALOG, WEAPON_AMMO, WEAPON_UPGRADES, TEAM_DOCTRINES, TEAM_POLICIES,
    DEPARTMENTS, TERRITORY_TIERS, PROPERTY_MODULES, VEHICLE_LIFECYCLE,
    normalize_inventory, inventory_capacity, inventory_used, territory_weekly_cost,
    territory_income_per_hour, territory_reward_bonus, fixed_cost_multiplier,
    doctrine_effect, loadout_effect, default_team_policies, ensure_employee_profile,
    apply_weapon_upgrades, weapon_ammo_status, prestige_effects, department_level,
    logistics_cost_multiplier,
)
from economy_constants import (TEAM_LEADER_MIN_RANK, STEALTH_VEHICLE_DISCRETION_MIN,
                               DRIVER_ATTR_BASELINE, DRIVER_TRAVEL_REDUCTION_PER_POINT,
                               DRIVER_TRAVEL_REDUCTION_MAX,
                               PARTIAL_SUCCESS_WINDOW, PARTIAL_REWARD_MIN, PARTIAL_REWARD_MAX,
                               EV_FAILURE_LOSS_FRAC,
                               # QI das equipas (SSS v4) — réguas expostas no /catalog
                               # (team_meta) para o frontend espelhar as fórmulas do motor.
                               NO_LEADER_PENALTY, SOLO_MEMBER_PENALTY, UNIFORM_SPEC_BONUS,
                               COORDINATION_BONUS_MAX, COORDINATION_RAMP_S, COORDINATION_RAMP_MISSIONS,
                               TEAM_FAMILIARITY_BONUS_MAX, TEAM_FAMILIARITY_RAMP_MISSIONS,
                               TEAM_FAMILIARITY_MIN_MISSIONS,
                               TEAM_MOMENTUM_BONUS_PER_WIN, TEAM_MOMENTUM_BONUS_MAX,
                               TEAM_MOMENTUM_PENALTY_PER_LOSS, TEAM_MOMENTUM_PENALTY_MAX,
                               TEAM_MOMENTUM_ESCAPE_BONUS_MAX,
                               STRATEGIST_MIN_INT, STRATEGIST_RELIEF_FRAC, STRATEGIST_RELIEF_MAX,
                               DRIVER_ESCAPE_BONUS_PER_POINT, DRIVER_ESCAPE_BONUS_MAX,
                               MEDIC_INJURY_MULT, MEDIC_RECOVERY_MULT, LAWYER_ARREST_MULT,
                               CLUTCH_SAVE_MAX, TEAM_SYNERGY_MAX, TEAM_SYNERGY_BASELINE,
                               TEAM_SYNERGY_SPREAD, FATIGUE_CURVE_EXP, MORALE_PENALTY_ASYMMETRY,
                               LOYALTY_BONUS_MAX, LOYALTY_PENALTY_MAX,
                               INCOMPLETE_CREW_PENALTY_PER_MISSING, INCOMPLETE_CREW_PENALTY_MAX,
                               CATEGORY_ATTRS,
                               # Réguas de imóveis (SSS v6) — expostas no /catalog (property_meta)
                               PROPERTY_MAINTENANCE_PCT_PER_DAY, PROPERTY_STACK_DIMINISH,
                               PROPERTY_CONDITION_RECOVERY_PER_HOUR, PROPERTY_CONDITION_DECAY_PER_HOUR)

router = APIRouter(prefix="/api/game", tags=["game"])

PROMOTE_BASE_COST = 2000
POOL_REFRESH_COST = 500
HEAL_BASE_COST = 2500
RELEASE_BASE_COST = 2000
REST_DURATION_S = 90
# Fração do preço de catálogo recuperada ao vender uma arma (antes do fator
# de condição) — exposta no /catalog (weapon_meta.sell_fraction) para o
# frontend usar a MESMA régua que a rota /weapons/sell.
WEAPON_SELL_FRACTION = 0.4


async def get_player(user: dict, allow_pending: bool = False) -> dict:
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    if not player.get("hq"):
        # Conta nova: o jogo só arranca depois de o jogador escolher onde
        # montar o Quartel-General (POST /game/hq/place).
        if allow_pending:
            return player
        raise HTTPException(status_code=409, detail="Estabelece primeiro o teu Quartel-General")
    player["hq"].setdefault("level", 1)
    player["hq"].setdefault("upgrading_until", None)
    player["hq"].setdefault("upgrade_history", [])
    player.setdefault("priorities", {"active": "equilibrio"})
    return player


class MutationInput(BaseModel):
    request_id: Optional[str] = Field(default=None, max_length=80)


def idempotent(action_name: str):
    """Impede retries/reenvios de rede de executar a mesma mutação duas vezes."""
    def decorator(fn):
        @wraps(fn)
        async def wrapped(*args, **kwargs):
            body = kwargs.get("body")
            if body is None:
                body = next((arg for arg in args if isinstance(arg, BaseModel)), None)
            request_id = getattr(body, "request_id", None)
            user = kwargs.get("user")
            if user is None:
                user = next((arg for arg in args if isinstance(arg, dict) and "_id" in arg), None)
            if not request_id or not user:
                return await fn(*args, **kwargs)

            key = f"{user['_id']}:{action_name}:{request_id}"
            now = now_utc()
            try:
                await db.action_receipts.insert_one({
                    "key": key, "status": "processing", "created_at": now,
                    "expires_at": now + timedelta(hours=24),
                })
            except DuplicateKeyError:
                existing = await db.action_receipts.find_one({"key": key})
                if existing and existing.get("status") == "done":
                    return existing.get("result") or {"ok": True, "idempotent_replay": True}
                raise HTTPException(status_code=409, detail="Ação já está a ser processada")

            try:
                result = await fn(*args, **kwargs)
            except Exception:
                await db.action_receipts.delete_one({"key": key, "status": "processing"})
                raise
            await db.action_receipts.update_one(
                {"key": key}, {"$set": {"status": "done", "result": result}}
            )
            return result
        return wrapped
    return decorator


async def _debit_clean_atomic(player: dict, amount: int, extra_inc: Optional[dict] = None):
    """Debita saldo numa única operação Mongo para impedir overspend concorrente."""
    amount = max(0, int(amount))
    inc = {"clean_money": -amount}
    for key, value in (extra_inc or {}).items():
        inc[key] = inc.get(key, 0) + value
    fresh = await db.players.find_one_and_update(
        {"_id": player["_id"], "clean_money": {"$gte": amount}},
        {"$inc": inc},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    player["clean_money"] = fresh["clean_money"]
    return fresh


def _road_mission_metrics(outward: dict, inward: dict, vehicle: dict, speed: float):
    """Métricas autoritativas da viagem a partir da estrada real, não haversine."""
    out_m = max(0.0, float((outward or {}).get("distance") or 0))
    in_m = max(0.0, float((inward or {}).get("distance") or 0))
    if out_m <= 0 or in_m <= 0:
        raise HTTPException(status_code=422, detail="Percurso rodoviário sem distância válida")
    round_km = (out_m + in_m) / 1000.0
    fuel_needed = round_km * float(vehicle.get("cons", 0) or 0) / 100.0
    effective = max(1.0, float(speed or 1))
    return {
        "out_m": out_m,
        "in_m": in_m,
        "round_km": round_km,
        "fuel_needed": fuel_needed,
        "travel_s": max(20.0, out_m / effective),
        "return_travel_s": max(20.0, in_m / effective),
    }


def _operation_profile_effect(profile: str, members: list, vehicle: dict, weapons_by_employee_id: dict):
    """Pequeno modificador contextual que torna o tipo concreto da operação relevante."""
    role_sets = {
        "digital": {"hacker", "criptografo", "engenheiro_social", "falsificador"},
        "mobility": {"motorista", "piloto", "estafeta", "contrabandista"},
        "stealth": {"espiao", "arrombador", "falsificador", "informador"},
        "influence": {"negociador", "advogado", "chantagista", "relacoes_publicas", "informador"},
        "confrontation": {"assaltante", "seguranca", "franco_atirador", "arrombador"},
    }
    attr_sets = {
        "digital": ("hack", "inteligencia"),
        "mobility": ("conducao", "discricao"),
        "stealth": ("discricao", "sangue_frio"),
        "influence": ("negociacao", "sangue_frio"),
        "confrontation": ("tiro", "forca"),
    }
    roles = {m.get("role_key") for m in members}
    attrs = attr_sets.get(profile, ("sangue_frio",))
    values = [float((m.get("attrs") or {}).get(attr, 0) or 0) for m in members for attr in attrs]
    avg = sum(values) / len(values) if values else 0.0
    specialist = bool(roles & role_sets.get(profile, set()))
    delta = (avg - 5.0) * 0.007 + (0.025 if specialist else -0.012)

    model = VEHICLE_MODELS.get((vehicle or {}).get("model_key"), {})
    if profile == "stealth":
        if float(model.get("discretion", 50) or 50) >= STEALTH_VEHICLE_DISCRETION_MIN:
            delta += 0.015
        if any(WEAPON_MODELS.get(w.get("model_key"), {}).get("loud", False) for w in weapons_by_employee_id.values()):
            delta -= 0.02
    elif profile == "mobility":
        delta += max(-0.015, min(0.02, (float((vehicle or {}).get("condition", 100) or 100) - 70) / 1500))
    elif profile == "confrontation":
        armed = sum(1 for m in members if str(m.get("_id")) in weapons_by_employee_id)
        if members:
            delta += (armed / len(members) - 0.5) * 0.025

    delta = max(-0.06, min(0.07, delta))
    return round(delta, 3), OPERATION_PROFILE_LABELS.get(profile, profile.title())


class MapPointInput(BaseModel):
    lat: float
    lng: float


class RoadRouteInput(BaseModel):
    origin: MapPointInput
    target: MapPointInput


class DispatchInput(MutationInput):
    opportunity_id: str
    team_id: str
    route_outward: Optional[dict] = None
    route_inward: Optional[dict] = None


class TeamIdInput(MutationInput):
    team_id: str


class OpportunityIdInput(MutationInput):
    opportunity_id: str


class TypeKeyInput(MutationInput):
    type_key: str


class TeamCreateInput(MutationInput):
    spec: str
    employee_ids: list[str] = Field(default_factory=list)
    vehicle_id: Optional[str] = None


class RecruitInput(MutationInput):
    candidate_id: str


class EmployeeIdInput(MutationInput):
    employee_id: str


class EmployeeRenameInput(MutationInput):
    employee_id: str
    name: str = Field(min_length=1, max_length=40)


class AssignEmployeeInput(MutationInput):
    employee_id: str
    team_id: Optional[str] = None


class TrainInput(MutationInput):
    employee_id: str
    course_key: str


class VehicleBuyInput(MutationInput):
    model_key: str


class VehicleIdInput(MutationInput):
    vehicle_id: str


class VehicleRenameInput(MutationInput):
    vehicle_id: str
    name: str = Field(min_length=1, max_length=40)


class MissionIdInput(MutationInput):
    mission_id: str


class MissionDecisionInput(MutationInput):
    mission_id: str
    option_id: str


class VehicleAssignInput(MutationInput):
    vehicle_id: str
    team_id: Optional[str] = None


class VehicleTransferInput(MutationInput):
    vehicle_id: str
    to_property_id: Optional[str] = None


class WeaponBuyInput(MutationInput):
    model_key: str


class WeaponIdInput(MutationInput):
    weapon_id: str


class WeaponAssignInput(MutationInput):
    weapon_id: str
    employee_id: str


class WeaponUnassignInput(MutationInput):
    employee_id: str


class PropertyBuyInput(MutationInput):
    type_key: str
    lat: float
    lng: float


class PropertyIdInput(MutationInput):
    property_id: str


class PropertyRenameInput(MutationInput):
    property_id: str
    name: str = Field(min_length=1, max_length=40)


class PriorityInput(MutationInput):
    priority: str


class LaunderInput(MutationInput):
    amount: int


class QuestClaimInput(MutationInput):
    quest_id: str


class QuestChooseInput(MutationInput):
    quest_id: str
    option: str


class ShopSpeedupInput(MutationInput):
    kind: str  # vehicle_refuel | vehicle_transfer | property_upgrade | hq_upgrade | team_reorg
    id: Optional[str] = None  # não usado para hq_upgrade


class ShopBuySlotInput(MutationInput):
    kind: str  # vehicle | employee


class ShopVipInput(MutationInput):
    plan_key: str


class ShopCosmeticInput(MutationInput):
    category: str  # vehicle_paint | team_emblem | hq_skin
    key: str


class VehicleEquipPaintInput(MutationInput):
    vehicle_id: str
    paint_key: Optional[str] = None


class TeamEquipEmblemInput(MutationInput):
    team_id: str
    emblem_key: Optional[str] = None


class HqEquipSkinInput(MutationInput):
    skin_key: Optional[str] = None


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
            # SSS — restantes réguas do motor expostas para a UI do arsenal
            # (desgaste, escala do bónus, penalizações de encravamento, venda).
            "wear_per_mission": WEAPON_WEAR_PER_MISSION,
            "wear_risk_mult": WEAPON_WEAR_RISK_MULT,
            "combat_score_scale": WEAPON_COMBAT_SCORE_SCALE,
            "bonus_min": WEAPON_BONUS_MIN,
            "bonus_max": WEAPON_BONUS_MAX,
            "loud_heat_mult": WEAPON_LOUD_HEAT_MULT,
            "proficiency_gain_per_mission": WEAPON_PROFICIENCY_GAIN_PER_MISSION,
            "jam_chance_penalty": WEAPON_JAM_CHANCE_PENALTY,
            "jam_chance_penalty_cap": WEAPON_JAM_CHANCE_PENALTY_CAP,
            "jam_extra_wear": WEAPON_JAM_EXTRA_WEAR,
            "mismatch_penalty_max": WEAPON_MISMATCH_PENALTY_MAX,
            "sell_fraction": WEAPON_SELL_FRACTION,
        },
        # QI das equipas (SSS v4): réguas do motor expostas para o frontend
        # mostrar momentum, entrosamento, familiaridade e papéis a bordo com
        # EXATAMENTE os mesmos números que a chance de missão usa.
        "team_meta": {
            "leader_min_rank": TEAM_LEADER_MIN_RANK,
            "no_leader_penalty": NO_LEADER_PENALTY,
            "clutch_save_max": CLUTCH_SAVE_MAX,
            "medic_injury_mult": MEDIC_INJURY_MULT,
            "medic_recovery_mult": MEDIC_RECOVERY_MULT,
            "lawyer_arrest_mult": LAWYER_ARREST_MULT,
            "driver_attr_baseline": DRIVER_ATTR_BASELINE,
            "driver_travel_reduction_per_point": DRIVER_TRAVEL_REDUCTION_PER_POINT,
            "driver_travel_reduction_max": DRIVER_TRAVEL_REDUCTION_MAX,
            "driver_escape_bonus_per_point": DRIVER_ESCAPE_BONUS_PER_POINT,
            "driver_escape_bonus_max": DRIVER_ESCAPE_BONUS_MAX,
            "strategist_min_int": STRATEGIST_MIN_INT,
            "strategist_relief_frac": STRATEGIST_RELIEF_FRAC,
            "strategist_relief_max": STRATEGIST_RELIEF_MAX,
            "momentum_bonus_per_win": TEAM_MOMENTUM_BONUS_PER_WIN,
            "momentum_bonus_max": TEAM_MOMENTUM_BONUS_MAX,
            "momentum_penalty_per_loss": TEAM_MOMENTUM_PENALTY_PER_LOSS,
            "momentum_penalty_max": TEAM_MOMENTUM_PENALTY_MAX,
            "momentum_escape_bonus_max": TEAM_MOMENTUM_ESCAPE_BONUS_MAX,
            "coordination_bonus_max": COORDINATION_BONUS_MAX,
            "coordination_ramp_s": COORDINATION_RAMP_S,
            "coordination_ramp_missions": COORDINATION_RAMP_MISSIONS,
            "familiarity_bonus_max": TEAM_FAMILIARITY_BONUS_MAX,
            "familiarity_ramp_missions": TEAM_FAMILIARITY_RAMP_MISSIONS,
            "familiarity_min_missions": TEAM_FAMILIARITY_MIN_MISSIONS,
            "uniform_spec_bonus": UNIFORM_SPEC_BONUS,
            "solo_member_penalty": SOLO_MEMBER_PENALTY,
            "incomplete_penalty_per_missing": INCOMPLETE_CREW_PENALTY_PER_MISSING,
            "incomplete_penalty_max": INCOMPLETE_CREW_PENALTY_MAX,
            "synergy_max": TEAM_SYNERGY_MAX,
            "synergy_baseline": TEAM_SYNERGY_BASELINE,
            "synergy_spread": TEAM_SYNERGY_SPREAD,
            "fatigue_curve_exp": FATIGUE_CURVE_EXP,
            "morale_penalty_asymmetry": MORALE_PENALTY_ASYMMETRY,
            "loyalty_bonus_max": LOYALTY_BONUS_MAX,
            "loyalty_penalty_max": LOYALTY_PENALTY_MAX,
            "category_attrs": CATEGORY_ATTRS,
            "reorg_after_roster_change_s": REORG_AFTER_ROSTER_CHANGE_S,
        },
        "low_chance_confirm_threshold": LOW_CHANCE_CONFIRM_THRESHOLD,
        # QI da frota (SSS v6): pesos e réguas do motor expostos para o frontend
        # calcular adequação por categoria, velocidade efetiva e custos com a
        # MESMA régua que a chance de missão usa.
        "vehicle_category_weights": VEHICLE_CATEGORY_WEIGHTS,
        "fleet_meta": {
            "speed_floor": VEHICLE_SPEED_FLOOR,
            "speed_curve_exp": VEHICLE_SPEED_CURVE_EXP,
            "condition_penalty_threshold": VEHICLE_CONDITION_PENALTY_THRESHOLD,
            "mismatch_penalty": VEHICLE_MISMATCH_PENALTY,
            "max_speed_ref": 26.0,           # supercarro — referência do score de velocidade
            "sell_fraction": 0.4,            # espelho da rota /vehicles/sell
            "repair_cost_pct": VEHICLE_REPAIR_BASE_MULTIPLIER,
            "transfer_cost_per_km": VEHICLE_TRANSFER_COST_PER_KM,
        },
        # QI dos imóveis (SSS v6): manutenção, condição, obras e rendimentos
        # decrescentes — os mesmos números do motor de rendimento passivo.
        "property_meta": {
            "maintenance_pct_per_day": PROPERTY_MAINTENANCE_PCT_PER_DAY,
            "condition_recovery_per_hour": PROPERTY_CONDITION_RECOVERY_PER_HOUR,
            "condition_decay_per_hour": PROPERTY_CONDITION_DECAY_PER_HOUR,
            "upgrade_base_s": PROPERTY_UPGRADE_BASE_S,
            "upgrade_per_level_s": PROPERTY_UPGRADE_PER_LEVEL_S,
            "stack_diminish": PROPERTY_STACK_DIMINISH,
            "sell_fraction": 0.7,            # espelho da rota /properties/sell
            "upgrade_cost_pct": 0.6,         # espelho da rota /properties/upgrade
        },
        # QI dos contratos (SSS v3/v6): fórmula das recompensas dinâmicas
        # exposta para a UI decompor o multiplicador com os números do motor.
        "quest_meta": {
            "level_money_slope": LEVEL_MONEY_SLOPE,
            "level_respect_slope": LEVEL_RESPECT_SLOPE,
            "tier_bonus": TIER_BONUS,
            "streak_bonus": STREAK_BONUS,
            "streak_bonus_max": STREAK_BONUS_MAX,
            "speed_bonus": SPEED_BONUS,
            "total_mult_cap": TOTAL_MULT_CAP,
            "difficulty_mults": DIFFICULTY_MULT,
            "momentum_claim": MOMENTUM_CLAIM,
        },
        "economy_meta": {
            "employer_social_security_rate": EMPLOYER_SOCIAL_SECURITY_RATE,
            "vehicle_annual_fixed_costs": VEHICLE_ANNUAL_FIXED_COSTS,
            "launder_base_rate": LAUNDER_BASE_RATE,
            "launder_max_rate": LAUNDER_MAX_RATE,
            "launder_passive_rate": LAUNDER_PASSIVE_RATE,
            "economic_week_minutes": PAYROLL_CYCLE_MIN,
            "weekly_settlement": {
                "weekday": WEEKLY_SETTLEMENT_WEEKDAY,
                "hour": WEEKLY_SETTLEMENT_HOUR,
                "timezone": "Europe/Lisbon",
            },
            "property_maintenance_pct_per_week": PROPERTY_MAINTENANCE_PCT_PER_WEEK,
            "mission_reward_min": MONEY_REWARD_MIN,
            "mission_reward_max": MONEY_REWARD_MAX,
        },
        # Loja — tudo pago em dinheiro do jogo (clean_money), sem moeda
        # premium/pagamentos reais.
        "organization": {
            "supplies": SUPPLY_CATALOG,
            "weapon_ammo": WEAPON_AMMO,
            "weapon_upgrades": WEAPON_UPGRADES,
            "team_doctrines": TEAM_DOCTRINES,
            "team_policies": TEAM_POLICIES,
            "departments": DEPARTMENTS,
            "territory_tiers": TERRITORY_TIERS,
            "property_modules": PROPERTY_MODULES,
            "vehicle_lifecycle": VEHICLE_LIFECYCLE,
        },
        "shop": {
            "speedup_cost_per_min": SPEEDUP_COST_PER_MIN,
            "speedup_cost_min": SPEEDUP_COST_MIN,
            "slot_cost_vehicle_base": SLOT_COST_VEHICLE_BASE,
            "slot_cost_employee_base": SLOT_COST_EMPLOYEE_BASE,
            "slot_cost_scale_per_unit": SLOT_COST_SCALE_PER_UNIT,
            "vip_plans": VIP_PLANS,
            "vehicle_paints": VEHICLE_PAINTS,
            "team_emblems": TEAM_EMBLEMS,
            "hq_skins": HQ_SKINS,
        },
    }


@router.get("/state")
async def get_state(user: dict = Depends(get_current_user), skip_advance: bool = False):
    player = await get_player(user, allow_pending=True)
    if not player.get("hq"):
        # Onboarding: o jogador ainda não escolheu onde montar o QG — o
        # frontend mostra o mapa de Portugal para a escolha do local.
        return {
            "hq_pending": True,
            "server_time": now_utc().isoformat(),
            "player": {
                "id": str(player["_id"]),
                "org_name": player.get("org_name", ""),
                "clean_money": player.get("clean_money", 0),
                "dirty_money": player.get("dirty_money", 0),
                "level": player.get("level", 1),
            },
        }
    # Retoma o batismo de zonas se alguma ficou sem nome (ex.: Nominatim
    # indisponível na altura da colocação do QG) — operação barata (no-op
    # quando está tudo batizado ou já há uma tarefa em curso).
    ensure_naming_scheduled(db, player)
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

    # Defesa adicional para saves antigos e pedidos skip_advance: nunca enviar
    # ao cliente oportunidades bloqueadas por nível nem mais de cinco sugestões
    # ativas. Operações já tomadas continuam no estado porque alimentam o mapa
    # e o acompanhamento das missões em curso.
    eligible_active = [
        o for o in opportunities
        if o.get("status") == "active" and int(o.get("min_level", 1) or 1) <= player["level"]
    ]
    eligible_active.sort(key=lambda o: str(o.get("created_at") or ""), reverse=True)
    taken_opportunities = [o for o in opportunities if o.get("status") == "taken"]
    opportunities = eligible_active[:5] + taken_opportunities

    caps = caps[0]
    p = Player.from_mongo(player).model_dump()
    p["next_level_respect"] = next_threshold(player["level"])

    emp_dumps = []
    for e in employees:
        e = ensure_employee_profile(e)
        d = Employee.from_mongo(e).model_dump()
        d["betrayal_risk"] = betrayal_risk_of(e)
        emp_dumps.append(d)

    quests_out = [enrich_quest(Quest.from_mongo(q).model_dump(), player) for q in quest_docs]
    quests_out += locked_principals({q["quest_key"] for q in quest_docs}, player["level"])

    gross_salary = int(sum(e.get("salary", 0) for e in employees))
    employer_ss = int(round(gross_salary * EMPLOYER_SOCIAL_SECURITY_RATE))
    fixed_mult = fixed_cost_multiplier(player)
    fleet_weekly = int(round(sum(
        VEHICLE_ANNUAL_FIXED_COSTS.get(v.get("model_key"), 0) / 52
        for v in vehicles
    ) * fixed_mult))
    property_weekly = int(round(sum(
        (pr.get("purchase_price") or PROPERTY_TYPES[pr["type_key"]]["price"])
        * max(1, int(pr.get("level", 1)))
        * PROPERTY_MAINTENANCE_PCT_PER_WEEK
        for pr in properties
    ) * fixed_mult))
    territory_weekly = int(round(territory_weekly_cost(player) * fixed_mult))
    weekly_fixed_total = gross_salary + employer_ss + fleet_weekly + property_weekly + territory_weekly
    caps_out = {
        "employees": {"used": len(employees), "max": caps["employees"]},
        "vehicles": {"used": len(vehicles), "max": caps["vehicles"]},
        "teams": {"used": len(teams), "max": max_teams_for(player["level"])},
        "dirty_money": {
            "used": round(player["dirty_money"]),
            "max": dirty_money_cap(player["level"]) + prestige_effects(player)["dirty_cap_increase"],
        },
    }
    retention = build_retention_snapshot(
        now=now_utc(),
        player=p,
        teams=teams,
        employees=employees,
        vehicles=vehicles,
        properties=properties,
        opportunities=opportunities,
        missions=missions,
        history=history,
        caps=caps_out,
        weekly_fixed_total=weekly_fixed_total,
    )

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
        "caps": caps_out,
        "retention": retention,
        "bonuses": bonuses,
        "salary_total": gross_salary,
        "weekly_fixed_total": weekly_fixed_total,
        "weekly_cost_breakdown": {
            "gross_salaries": gross_salary,
            "employer_social_security": employer_ss,
            "fleet_fixed": fleet_weekly,
            "property_fixed": property_weekly,
            "territory_fixed": territory_weekly,
            "finance_multiplier": fixed_mult,
        },
        "organization": {
            "inventory": normalize_inventory(player),
            "inventory_used": inventory_used(normalize_inventory(player)),
            "inventory_capacity": inventory_capacity(player, properties),
            "departments": player.get("departments") or {},
            "territories": player.get("territories") or {},
            "territory_income_h": territory_income_per_hour(player),
            "prestige_items": player.get("prestige_items") or [],
            "prestige_effects": prestige_effects(player),
            "governance": player.get("governance") or {},
        },
        "fuel_prices": FUEL_PRICES,
        "hot_category": hot_category(now_utc()),
    }


async def _prepare_dispatch(player, opp, team, *, resolve_routes=False, route_outward=None, route_inward=None):
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
    if vehicle.get("seized_until") and parse_dt(vehicle["seized_until"]) > now:
        remaining = round((parse_dt(vehicle["seized_until"]) - now).total_seconds())
        raise HTTPException(status_code=400, detail=f"Veículo apreendido — disponível em {remaining}s")
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
    straight_dist = haversine_m(origin["lat"], origin["lng"], opp["lat"], opp["lng"])
    dist = straight_dist
    round_km = 2 * straight_dist / 1000

    props = await db.properties.find({"player_id": pid}).to_list(200)

    speed = effective_speed(vehicle)
    travel_s = max(20, straight_dist / speed)
    return_travel_s = travel_s
    road_outward = None
    road_inward = None
    if resolve_routes:
        target_point = {"lat": float(opp["lat"]), "lng": float(opp["lng"])}
        road_outward = _validated_client_road_plan(route_outward, origin, target_point)
        road_inward = _validated_client_road_plan(route_inward, target_point, origin)
        if not road_outward or not road_inward:
            road_outward, road_inward = await asyncio.gather(
                road_router.get(origin, target_point),
                road_router.get(target_point, origin),
            )
        metrics = _road_mission_metrics(road_outward, road_inward, vehicle, speed)
        dist = metrics["out_m"]
        round_km = metrics["round_km"]
        travel_s = metrics["travel_s"]
        return_travel_s = metrics["return_travel_s"]
        fuel_needed = metrics["fuel_needed"]
    else:
        fuel_needed = round_km * vehicle["cons"] / 100

    if vehicle["fuel_l"] < fuel_needed:
        raise HTTPException(status_code=400, detail="Combustível insuficiente para a viagem rodoviária")
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
        return_travel_s = max(20, return_travel_s * (1 - driver_reduction))

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
    repeat_count = int(team.get("repeat_type_count", 0) or 0) + 1 if team.get("last_type_key") == opp["type_key"] else 0
    operation_profile = opp.get("profile") or operation_profile_of(opp.get("type_key"), opp.get("category"))
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
    # Força competente pela zona da operação — de opp.police_force (gravado no
    # spawn) ou classificado agora para oportunidades anteriores à feature.
    police_force = opp.get("police_force") or police_force_for(opp["lat"], opp["lng"])
    chance_ctx = {
        "heat": player["heat"], "risk": opp["risk"], "dist_km": opp.get("dist_km", 0.0),
        "category": opp["category"], "members": members, "min_members": opp.get("min_members", 1),
        "vehicle": vehicle, "weapons_by_employee_id": weapons_by_employee_id,
        "roster_stable_since": team.get("roster_stable_since"), "hq_level": player["hq"]["level"],
        # SSS v4: memória do mundo e da equipa, finalmente ligadas à chance.
        "district": opp.get("district"),
        "district_attention": district_attention_of(player, opp.get("district")),
        "police_force": police_force,
        "team_streak": team_streak,
        "team_cat_missions": team_cat_missions,
        "roster_missions": roster_missions,
        "now": now,
    }
    chance, breakdown = chance_breakdown(chance_ctx)

    # Organização integrada: doutrina, loadout e território afetam exatamente
    # o preview que será persistido na missão.
    doctrine = doctrine_effect(team, opp["category"])
    loadout = dict(team.get("loadout") or {})
    loadout_fx = loadout_effect(loadout, opp["category"])
    doctrine_delta = float(doctrine.get("chance", 0.0))
    loadout_delta = float(loadout_fx.get("chance", 0.0))
    if doctrine_delta:
        breakdown.append({"key": "doutrina", "label": f"Doutrina: {doctrine['name']}", "pct": doctrine_delta})
    if loadout_delta:
        breakdown.append({"key": "loadout", "label": "Equipamento preparado", "pct": loadout_delta})
    chance = max(0.02, min(0.97, chance + doctrine_delta + loadout_delta))

    profile_delta, profile_label = _operation_profile_effect(
        operation_profile, members, vehicle, weapons_by_employee_id
    )
    if profile_delta:
        breakdown.append({
            "key": f"perfil_{operation_profile}",
            "label": f"Perfil da operação: {profile_label}",
            "pct": profile_delta,
        })
        chance = max(0.02, min(0.97, chance + profile_delta))

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
        wm = apply_weapon_upgrades(wm, w)
        ammo = weapon_ammo_status(w.get("model_key", ""), wm, w)
        weapon_powers.append(wm.get("power", 0) * (1.0 if ammo["ammo_key"] is None else ammo["fraction"]))
        jr = weapon_jam_risk(wm, w.get("condition", 100))
        if jr > 0:
            emp = emp_by_id.get(eid)
            weapon_jam_profile.append({
                "weapon_id": str(w["_id"]), "weapon_name": w.get("name", wm["name"]),
                "emp_name": (emp or {}).get("name", "?"), "jam_risk": round(jr, 3),
                "ammo_loaded": ammo["loaded"], "ammo_capacity": ammo["capacity"],
            })
    weapon_power_avg = round(sum(weapon_powers) / len(members), 1) if weapon_powers else 0.0
    weapon_alerts = [
        f"{wj['weapon_name']} de {wj['emp_name']}: risco de encravar ≈ {round(wj['jam_risk'] * 100)}%"
        for wj in weapon_jam_profile if wj["jam_risk"] >= WEAPON_JAM_WARN_RISK
    ]
    for eid, w in weapons_by_employee_id.items():
        wm = apply_weapon_upgrades(WEAPON_MODELS.get(w.get("model_key"), {}), w)
        ammo = weapon_ammo_status(w.get("model_key", ""), wm, w)
        if ammo["ammo_key"] is not None and ammo["fraction"] < 0.35:
            emp = emp_by_id.get(eid)
            weapon_alerts.append(
                f"{w.get('name', wm.get('name', 'Arma'))} de {(emp or {}).get('name', '?')}: munição baixa ({ammo['loaded']}/{ammo['capacity']})"
            )

    # Novo sistema de recompensas dinâmicas — calcula baseado em dificuldade real
    # opp["duration_s"] é sempre um único int (gerado em spawn_opportunities), não um intervalo.
    duration_avg = opp.get("duration_s") or 240

    reward_data = calculate_full_reward(
        risk=opp["risk"],
        team_members=len(members),
        min_members_required=opp.get("min_members", 1),
        required_models=opp.get("required_models", []),
        duration_s=int(duration_avg),
        distance_km=dist / 1000.0,
        num_objectives=opp.get("num_objectives", 1),
        specialization_required=opp["category"] != "especial",
        org_level=player.get("level", 1),
        category=opp["category"],
        failure_probability=1.0 - chance,  # Probabilidade de falha
        is_rare_mission=bool(opp.get("rare")),
        multiplier_stack=1.0,  # bónus de propriedades/conquistas é aplicado UMA vez abaixo
        repeat_count=repeat_count,
        vehicles_dict=VEHICLE_MODELS,
        specialization_match=spec_match,
    )

    # Pulso do mundo: uma janela global de quatro horas muda o valor relativo
    # de uma categoria. É a mesma para todos os jogadores e aparece no preview,
    # por isso não existe multiplicador escondido.
    pulse = world_pulse(now)
    pulse_active = opp["category"] == pulse["category"]
    pulse_reward_mult = pulse["reward_mult"] if pulse_active else 1.0

    # Aplicar multiplicadores existentes uma única vez. Antes, "mult" entrava
    # no reward_engine e voltava a ser multiplicado aqui, inflacionando o saque.
    territory_bonus = territory_reward_bonus(player, opp.get("district"))
    prestige = prestige_effects(player)
    prestige_reward = float(prestige.get("mission_bonus", 0.0))
    if spec_match:
        prestige_reward += float(prestige.get("spec_bonus", 0.0))
    reward = int(
        reward_data["money"] * mult * pulse_reward_mult * age_mult * split_mult
        * float(doctrine.get("reward", 1.0)) * (1.0 + territory_bonus + prestige_reward)
    )
    reward = max(MONEY_REWARD_MIN, min(MONEY_REWARD_MAX, reward))

    mission_pulse = {
        **pulse,
        "active_for_mission": pulse_active,
        "applied_reward_mult": pulse_reward_mult,
        "applied_heat_mult": pulse["heat_mult"] if pulse_active else 1.0,
    }

    return {
        "members": members, "vehicle": vehicle, "dist": dist, "round_km": round_km,
        "fuel_needed": fuel_needed, "speed": speed, "travel_s": travel_s,
        "return_travel_s": return_travel_s, "road_outward": road_outward, "road_inward": road_inward,
        "repeat_count": repeat_count, "operation_profile": operation_profile, "operation_profile_label": profile_label,
        "reward": reward,
        "reward_mult": mult * pulse_reward_mult * float(doctrine.get("reward", 1.0)) * (1.0 + territory_bonus + prestige_reward),
        "age_mult": age_mult, "split_mult": split_mult,
        "world_pulse": mission_pulse,
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
        "doctrine": doctrine.get("key", "balanced"),
        "doctrine_heat_mult": float(doctrine.get("heat", 1.0)) * float(loadout_fx.get("heat", 1.0)),
        "doctrine_fatigue_mult": float(doctrine.get("fatigue", 1.0)),
        "loadout": loadout,
        "loadout_injury_mult": float(loadout_fx.get("injury", 1.0)),
        "territory_bonus": territory_bonus,
        "prestige_reward_bonus": prestige_reward,
    }


def _validated_client_road_plan(plan, origin, target):
    """Aceita apenas geometria OSRM-like razoável enviada pelo cliente.

    A rota é validada pelo backend e alimenta distância, combustível e duração;
    por isso limitamos tamanho, coordenadas,
    tempos e distância dos extremos para não persistir lixo arbitrário.
    """
    if not isinstance(plan, dict) or plan.get("unavailable"):
        return None
    latlngs = plan.get("latlngs")
    times = plan.get("times")
    if not isinstance(latlngs, list) or not (2 <= len(latlngs) <= 5000):
        return None
    if not isinstance(times, list) or len(times) != len(latlngs):
        return None

    clean_points = []
    clean_times = []
    previous = -1.0
    for point, second in zip(latlngs, times):
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            return None
        try:
            lat, lng, t = float(point[0]), float(point[1]), float(second)
        except (TypeError, ValueError):
            return None
        if not all(math.isfinite(value) for value in (lat, lng, t)) or t < previous or t < 0:
            return None
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return None
        clean_points.append([lat, lng])
        clean_times.append(t)
        previous = t

    # OSRM pode fazer snap alguns quilómetros em zonas rurais, mas nunca deve
    # começar/terminar noutro distrito ou atravessar o mapa por um payload falso.
    if haversine_m(origin["lat"], origin["lng"], clean_points[0][0], clean_points[0][1]) > 5000:
        return None
    if haversine_m(target["lat"], target["lng"], clean_points[-1][0], clean_points[-1][1]) > 5000:
        return None

    try:
        distance = max(0.0, float(plan.get("distance") or 0))
        duration = max(0.0, float(plan.get("duration") or clean_times[-1]))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(distance) or not math.isfinite(duration) or distance > 2_000_000:
        return None

    return {
        "latlngs": clean_points,
        "times": clean_times,
        "distance": distance,
        "duration": duration,
        "source": str(plan.get("source") or "OSRM / OpenStreetMap")[:80],
        "estimated": True,
        "liveTraffic": False,
        "unavailable": False,
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


@router.post("/road-route")
async def road_route(body: RoadRouteInput, user: dict = Depends(get_current_user)):
    """Percurso rodoviário autoritativo usado pelo mapa e pelo despacho.

    Fica no backend para evitar CORS/rate-limit no browser e partilha a mesma
    cache persistente que o próprio /dispatch.
    """
    await get_player(user)
    return await road_router.get(body.origin.model_dump(), body.target.model_dump())


@router.post("/dispatch/preview")
async def dispatch_preview(body: DispatchInput, user: dict = Depends(get_current_user)):
    player, opp, team = await _validate_dispatch_inputs(body, user)
    prep = await _prepare_dispatch(
        player, opp, team, resolve_routes=True,
        route_outward=body.route_outward, route_inward=body.route_inward,
    )
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
        "repeat_count": prep.get("repeat_count", 0),
        "repeat_penalty_pct": round((REPEAT_PENALTY_MULTIPLIER ** prep.get("repeat_count", 0) - 1) * 100, 1),
        "operation_profile": prep.get("operation_profile"),
        "operation_profile_label": prep.get("operation_profile_label"),
        "distance_km": round(prep.get("round_km", 0), 1),
        "members": len(prep["members"]),
        "effective_speed": round(prep["speed"], 1),
        "spec_match": prep["spec_match"],
        "talents": prep["talents"],
        "min_members": prep["min_members"],
        "min_members_met": len(prep["members"]) >= prep["min_members"],
        "weapon_alerts": prep.get("weapon_alerts", []),
        "world_pulse": prep.get("world_pulse"),
        "doctrine": prep.get("doctrine", "balanced"),
        "doctrine_heat_mult": prep.get("doctrine_heat_mult", 1.0),
        "doctrine_fatigue_mult": prep.get("doctrine_fatigue_mult", 1.0),
        "loadout": prep.get("loadout", {}),
        "loadout_injury_mult": prep.get("loadout_injury_mult", 1.0),
    }


@router.post("/dispatch")
@idempotent("dispatch")
async def dispatch(body: DispatchInput, user: dict = Depends(get_current_user)):
    player, opp, team = await _validate_dispatch_inputs(body, user)
    pid = str(player["_id"])
    now = now_utc()
    prep = await _prepare_dispatch(
        player, opp, team, resolve_routes=True,
        route_outward=body.route_outward, route_inward=body.route_inward,
    )
    if len(prep["members"]) < prep["min_members"]:
        raise HTTPException(
            status_code=400,
            detail=f"Esta operação requer pelo menos {prep['min_members']} membros na equipa (tens {len(prep['members'])} disponíveis)",
        )
    vehicle = prep["vehicle"]
    members = prep["members"]
    repeat_type = team.get("last_type_key") == opp["type_key"]

    policies = {**default_team_policies(), **(team.get("policies") or {})}
    threshold = max(0, min(60, int(policies.get("abort_below_pct", 0) or 0)))
    if threshold and prep["chance"] * 100 < threshold:
        raise HTTPException(
            status_code=400,
            detail=f"Política da equipa impede o despacho abaixo de {threshold}% de sucesso",
        )
    loadout = dict(prep.get("loadout") or {})
    inventory = normalize_inventory(player)
    shortages = [
        SUPPLY_CATALOG[key]["name"] for key, qty in loadout.items()
        if int(qty or 0) > int(inventory.get(key, 0) or 0)
    ]
    if shortages:
        raise HTTPException(status_code=400, detail="Stock insuficiente: " + ", ".join(shortages))

    # As duas rotas reais já foram validadas/resolvidas em _prepare_dispatch.
    road_outward = prep["road_outward"]
    road_inward = prep["road_inward"]

    # Pequenos imprevistos, decididos só no momento do despacho (não na
    # pré-visualização, para esta continuar a mostrar sempre o valor de base):
    # trânsito e chuva podem atrasar ligeiramente a viagem.
    travel_s = prep["travel_s"]
    return_travel_s = prep.get("return_travel_s", travel_s)
    incidents = []
    if random.random() < TRAFFIC_DELAY_CHANCE:
        travel_s *= 1 + random.uniform(0.03, TRAFFIC_DELAY_MAX_PCT)
        incidents.append("trânsito")
    if random.random() < RAIN_CHANCE:
        travel_s *= RAIN_TRAVEL_MULT
        return_travel_s *= RAIN_TRAVEL_MULT
        incidents.append("chuva")
    if incidents:
        await add_event(db, pid, "team", f"{team['name']} apanhou {' e '.join(incidents)} a caminho de {opp['name']} — viagem mais lenta.")

    depart = now
    arrive = depart + timedelta(seconds=travel_s)
    finish = arrive + timedelta(seconds=opp["duration_s"])
    ret = finish + timedelta(seconds=return_travel_s)
    member_ids = [str(e["_id"]) for e in members]

    # Operação em direto (SSS): guião narrativo da ida+operação com timestamps
    # absolutos e 0–2 complicações com efeito REAL na chance final (o delta é
    # aplicado em engine._roll_outcome). Gerado uma única vez e persistido.
    vehicle_name = VEHICLE_MODELS.get(vehicle["model_key"], {}).get("name") or vehicle.get("model_key")
    live_log, live_delta, live_used_keys = build_dispatch_script(
        team_name=team["name"],
        opp={"name": opp["name"], "district": opp["district"],
             "category": opp["category"], "risk": opp["risk"],
             "type_key": opp["type_key"]},
        members=members, incidents=incidents,
        depart=depart, arrive=arrive, finish=finish,
        heat=player.get("heat", 0), has_leader=prep.get("has_leader", False),
        vehicle_name=vehicle_name, memory=player.get("phrase_memory"),
    )
    decision = mission_decision(opp["category"], opp["risk"], arrive, finish)

    mission = {
        "player_id": pid, "team_id": str(team["_id"]), "team_name": team["name"],
        "team_skill": round(prep["team_skill"], 2), "spec_match": prep["spec_match"],
        "success_chance": round(prep["chance"], 3),
        "member_ids": member_ids, "vehicle_id": str(vehicle["_id"]),
        "vehicle_name": vehicle_name,
        "vehicle_luxury": VEHICLE_MODELS.get(vehicle["model_key"], {}).get("luxury", False),
        "weapon_loud": prep.get("weapon_loud", False),
        "repeat_type": repeat_type,
        "repeat_count": prep.get("repeat_count", 0),
        "operation_profile": prep.get("operation_profile", "confrontation"),
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
            "risk": opp["risk"], "heat": round(opp["heat"] * prep.get("doctrine_heat_mult", 1.0), 3),
            "pays": opp["pays"], "min_level": opp["min_level"],
            "profile": prep.get("operation_profile", "confrontation"),
            "distance_km": round(prep.get("dist", 0) / 1000.0, 2),
            "police_force": opp.get("police_force") or police_force_for(opp["lat"], opp["lng"]),
        },
        # Dados de recompensa dinâmica para cálculo consistente de XP/reputação
        "reward_xp": prep.get("reward_xp"),
        "reward_reputation": prep.get("reward_reputation"),
        "reward_difficulty_score": prep.get("reward_difficulty_score"),
        "origin": {"lat": prep["origin"]["lat"], "lng": prep["origin"]["lng"]},
        "origin_property_id": prep["origin"]["property_id"],
        "target": {"lat": opp["lat"], "lng": opp["lng"]},
        "road_outward": road_outward,
        "road_inward": road_inward,
        "phase": "en_route", "outcome": None,
        "depart_at": depart.isoformat(), "arrive_at": arrive.isoformat(),
        "finish_at": finish.isoformat(), "return_at": ret.isoformat(),
        "live_log": live_log, "live_chance_delta": live_delta,
        "decision": decision,
        "decision_reward_mult": 1.0,
        "world_pulse": prep.get("world_pulse"),
    }
    # Reserva atómica: duas tabs/requests nunca conseguem despachar a mesma
    # oportunidade ou a mesma equipa em simultâneo.
    claimed_opp = await db.opportunities.find_one_and_update(
        {"_id": opp["_id"], "player_id": pid, "status": "active"},
        {"$set": {"status": "taken"}},
        return_document=ReturnDocument.BEFORE,
    )
    if not claimed_opp:
        raise HTTPException(status_code=409, detail="A oportunidade acabou de ser ocupada")
    claimed_team = await db.teams.find_one_and_update(
        {"_id": team["_id"], "player_id": pid, "status": "idle"},
        {"$set": {
            "status": "en_route", "last_type_key": opp["type_key"],
            "repeat_type_count": prep.get("repeat_count", 0),
        }},
        return_document=ReturnDocument.BEFORE,
    )
    if not claimed_team:
        await db.opportunities.update_one({"_id": opp["_id"], "status": "taken"}, {"$set": {"status": "active"}})
        raise HTTPException(status_code=409, detail="A equipa acabou de ser ocupada")

    result = None
    try:
        result = await db.missions.insert_one(mission)
        await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {
        "fuel_l": round(vehicle["fuel_l"] - prep["fuel_needed"], 2),
        "km_total": round(vehicle["km_total"] + prep["round_km"], 2),
    }})
        await db.employees.update_many(
            {"_id": {"$in": [ObjectId(i) for i in member_ids]}},
            {"$set": {"status": "on_mission"}},
        )
    except Exception:
        if result is not None:
            await db.missions.delete_one({"_id": result.inserted_id})
        await db.opportunities.update_one({"_id": opp["_id"], "status": "taken"}, {"$set": {"status": "active"}})
        await db.teams.update_one({"_id": team["_id"], "status": "en_route"}, {"$set": {"status": "idle"}})
        raise
    # Anti-repetição narrativa: guardar as frases usadas no guião de despacho
    # na memória da organização (mantida com um teto) — o regresso e as
    # próximas missões preferem voz nova.
    new_memory = update_memory(player.get("phrase_memory"), live_used_keys)
    player_inc = {"stats.ops_dispatched": 1}
    for key, qty in loadout.items():
        if key in SUPPLY_CATALOG and int(qty or 0) > 0:
            player_inc[f"inventory.{key}"] = -int(qty)
    await db.players.update_one(
        {"_id": player["_id"]},
        {"$inc": player_inc, "$set": {"phrase_memory": new_memory}},
    )
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
@idempotent("missions.recall")
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
    # Live ops: corta a narrativa futura (a operação nunca vai acontecer) e
    # anexa o guião curto de regresso antecipado.
    now_iso = now.isoformat()
    kept_log = [e for e in (m.get("live_log") or []) if e.get("at", "") <= now_iso]
    recall_entries, recall_used = build_recall_script(m, now, ret, memory=player.get("phrase_memory"))
    kept_log += recall_entries
    changed = await db.missions.update_one(
        {"_id": m["_id"], "player_id": pid, "phase": "en_route"},
        {"$set": {
            "phase": "returning", "outcome": "recalled",
            "target": turn_point, "arrive_at": now.isoformat(), "finish_at": now.isoformat(),
            "return_at": ret.isoformat(), "live_log": kept_log,
        }},
    )
    if changed.modified_count != 1:
        raise HTTPException(status_code=409, detail="A operação mudou de fase antes da chamada de volta")
    await db.players.update_one(
        {"_id": player["_id"]},
        {"$set": {"phrase_memory": update_memory(player.get("phrase_memory"), recall_used)}},
    )
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



@router.post("/missions/decision")
@idempotent("missions.decision")
async def resolve_mission_decision(body: MissionDecisionInput, user: dict = Depends(get_current_user)):
    """Resolve one optional live tactical choice.

    Choices are transparent trade-offs. Doing nothing keeps the original plan
    and never carries a hidden penalty.
    """
    player = await get_player(user)
    pid = str(player["_id"])
    mission = await db.missions.find_one({
        "_id": _oid(body.mission_id, "Operação inválida"),
        "player_id": pid,
    })
    if not mission:
        raise HTTPException(status_code=404, detail="Operação não encontrada")
    decision = mission.get("decision") or {}
    if not decision or decision.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Esta decisão já não está disponível")

    now = now_utc()
    opens_at = parse_dt(decision.get("opens_at"))
    expires_at = parse_dt(decision.get("expires_at"))
    if mission.get("phase") != "operating" or now < opens_at:
        raise HTTPException(status_code=400, detail="A janela de decisão ainda não abriu")
    if now > expires_at:
        await db.missions.update_one(
            {"_id": mission["_id"]},
            {"$set": {"decision.status": "expired"}},
        )
        raise HTTPException(status_code=400, detail="A janela de decisão terminou — a equipa manteve o plano original")

    option = next((item for item in decision.get("options", []) if item.get("id") == body.option_id), None)
    if not option:
        raise HTTPException(status_code=400, detail="Opção tática inválida")

    chance_delta = float(option.get("chance_delta", 0) or 0)
    reward_mult = float(option.get("reward_mult", 1) or 1)
    heat_delta = float(option.get("heat_delta", 0) or 0)
    fatigue_delta = float(option.get("fatigue_delta", 0) or 0)
    new_heat = max(0.0, min(100.0, float(player.get("heat", 0) or 0) + heat_delta))

    resolved = {
        **decision,
        "status": "resolved",
        "choice": option["id"],
        "choice_label": option["label"],
        "resolved_at": now.isoformat(),
    }
    effect_bits = []
    if chance_delta:
        effect_bits.append(f"{chance_delta * 100:+.0f}% chance")
    if reward_mult != 1:
        effect_bits.append(f"{(reward_mult - 1) * 100:+.0f}% recompensa")
    if heat_delta:
        effect_bits.append(f"{heat_delta:+.0f} calor")
    effect_text = " · ".join(effect_bits) if effect_bits else "plano original"

    live_entry = {
        "at": now.isoformat(),
        "speaker": "COMANDO",
        "kind": "comp_good" if chance_delta > 0 else ("comp_bad" if chance_delta < 0 else "radio"),
        "text": f"{option['label']} — {effect_text}.",
    }
    if chance_delta:
        live_entry["pct"] = chance_delta

    update = {
        "$set": {
            "decision": resolved,
            "decision_reward_mult": reward_mult,
        },
        "$push": {"live_log": live_entry},
    }
    if chance_delta:
        update["$inc"] = {"live_chance_delta": chance_delta}
    changed = await db.missions.update_one(
        {"_id": mission["_id"], "player_id": pid, "phase": "operating", "decision.status": "pending"},
        update,
    )
    if changed.modified_count != 1:
        raise HTTPException(status_code=409, detail="Esta decisão acabou de ser resolvida noutra sessão")
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"heat": new_heat}})

    if fatigue_delta and mission.get("member_ids"):
        member_oids = [ObjectId(member_id) for member_id in mission["member_ids"]]
        await db.employees.update_many({"_id": {"$in": member_oids}}, {"$inc": {"fatigue": fatigue_delta}})
        await db.employees.update_many(
            {"_id": {"$in": member_oids}, "fatigue": {"$gt": 100}},
            {"$set": {"fatigue": 100.0}},
        )

    await add_event(
        db,
        pid,
        "intel",
        f"{mission['team_name']}: decisão tática — {option['label']} ({effect_text}).",
    )
    return {
        "ok": True,
        "choice": option["id"],
        "effects": {
            "chance_delta": chance_delta,
            "reward_mult": reward_mult,
            "heat_delta": heat_delta,
            "fatigue_delta": fatigue_delta,
        },
    }


@router.post("/teams/create")
@idempotent("teams.create")
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

    employee_ids = list(dict.fromkeys(body.employee_ids or []))
    if len(employee_ids) > TEAM_MAX_MEMBERS:
        raise HTTPException(status_code=400, detail=f"Uma equipa pode ter no máximo {TEAM_MAX_MEMBERS} membros")

    employees = []
    if employee_ids:
        employee_oids = [_oid(employee_id, "Operacional inválido") for employee_id in employee_ids]
        employees = await db.employees.find({"_id": {"$in": employee_oids}, "player_id": pid}).to_list(TEAM_MAX_MEMBERS)
        if len(employees) != len(employee_ids):
            raise HTTPException(status_code=404, detail="Um ou mais operacionais não foram encontrados")
        blocked = [
            employee["name"] for employee in employees
            if employee.get("status") != "idle" or employee.get("team_id") or employee.get("stationed_property_id")
        ]
        if blocked:
            raise HTTPException(status_code=400, detail=f"Operacionais indisponíveis: {', '.join(blocked)}")

    vehicle = None
    if body.vehicle_id:
        vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        if vehicle.get("team_id"):
            raise HTTPException(status_code=400, detail="O veículo já está atribuído a outra equipa")
        if vehicle.get("transfer"):
            raise HTTPException(status_code=400, detail="O veículo está em transferência")
        model = VEHICLE_MODELS.get(vehicle.get("model_key"), {})
        seats = int(model.get("seats", 0) or 0)
        if employee_ids and seats and len(employee_ids) > seats:
            raise HTTPException(status_code=400, detail=f"O veículo só tem {seats} lugares para {len(employee_ids)} membros")

    name = TEAM_NAMES[count % len(TEAM_NAMES)]
    created = now_utc().isoformat()
    team_doc = {
        "player_id": pid, "name": name, "spec": body.spec, "status": "idle",
        "vehicle_id": str(vehicle["_id"]) if vehicle else None,
        "missions_done": 0, "created_at": created,
        "available_at": None, "roster_stable_since": created,
        # SSS v4: memória da equipa — momentum, familiaridade e entrosamento.
        "streak": 0, "category_missions": {}, "roster_missions": 0,
        "repeat_type_count": 0,
        "doctrine": "balanced", "policies": default_team_policies(), "loadout": {},
    }
    fresh_player = await _debit_clean_atomic(player, TEAM_CREATE_COST, {"stats.teams_created": 1})
    try:
        result = await db.teams.insert_one(team_doc)
    except Exception:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": TEAM_CREATE_COST, "stats.teams_created": -1}})
        raise
    team_id = str(result.inserted_id)
    if employee_ids:
        await db.employees.update_many(
            {"_id": {"$in": [employee["_id"] for employee in employees]}},
            {"$set": {"team_id": team_id}},
        )
    if vehicle:
        await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"team_id": team_id}})

    details = []
    if employees:
        details.append(f"{len(employees)} membro(s)")
    if vehicle:
        details.append(vehicle["name"])
    suffix = f" · {' · '.join(details)}" if details else ""
    await add_event(db, pid, "team", f"{name} ({TEAM_SPECS[body.spec]['name']}) formada por {TEAM_CREATE_COST:,} €{suffix}.")
    await record_tx(db, pid, "team_create", -TEAM_CREATE_COST, "clean", fresh_player["clean_money"], f"Nova equipa: {name}")
    return {
        "ok": True,
        "team_id": team_id,
        "team_name": name,
        "assigned_members": len(employees),
        "vehicle_id": str(vehicle["_id"]) if vehicle else None,
    }


# ---------------- Funcionários ----------------

async def _get_employee(pid, employee_id):
    emp = await db.employees.find_one({"_id": _oid(employee_id, "Operacional inválido"), "player_id": pid})
    if not emp:
        raise HTTPException(status_code=404, detail="Operacional não encontrado")
    return emp


@router.post("/employees/recruit")
@idempotent("employees.recruit")
async def recruit_employee(body: RecruitInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    cand = await db.candidates.find_one({"_id": _oid(body.candidate_id, "Candidato inválido"), "player_id": pid})
    if not cand:
        raise HTTPException(status_code=404, detail="Candidato já não está disponível")
    if player["respect"] < cand["min_respect"]:
        raise HTTPException(status_code=400, detail=f"Requer {cand['min_respect']:,} respeito para recrutar {RARITIES[cand['rarity']]['name']}")
    recruit_cost = max(0, int(cand["cost"] * (1.0 - 0.05 * department_level(player, "rh"))))
    if player["clean_money"] < recruit_cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    caps, _ = await get_caps(db, pid, player["hq"]["level"])
    used = await db.employees.count_documents({"player_id": pid})
    if used >= caps["employees"]:
        raise HTTPException(status_code=400, detail="Sem capacidade. Compra ou melhora um esconderijo.")
    doc = employee_from_candidate(cand, now_utc().isoformat())
    stat_inc = {"stats.recruits_hired": 1}
    if cand["role_key"] == "informador":
        stat_inc["stats.recruits_informador"] = 1

    reserved = await db.candidates.find_one_and_delete({"_id": cand["_id"], "player_id": pid})
    if not reserved:
        raise HTTPException(status_code=409, detail="O candidato acabou de ser recrutado noutra sessão")
    try:
        fresh_player = await _debit_clean_atomic(player, recruit_cost, stat_inc)
    except Exception:
        await db.candidates.insert_one(reserved)
        raise
    try:
        await db.employees.insert_one(doc)
    except Exception:
        refund = {"clean_money": recruit_cost, "stats.recruits_hired": -1}
        if cand["role_key"] == "informador":
            refund["stats.recruits_informador"] = -1
        await db.players.update_one({"_id": player["_id"]}, {"$inc": refund})
        await db.candidates.insert_one(reserved)
        raise
    role_name = SPECIALIZATIONS[cand["role_key"]]["name"]
    await add_event(db, pid, "team", f"{cand['name']} ({role_name}, {RARITIES[cand['rarity']]['name']}) recrutado por {recruit_cost:,} €.")
    await record_tx(db, pid, "recruit", -recruit_cost, "clean", fresh_player["clean_money"], f"Recrutamento de {cand['name']}")
    return {"ok": True}


@router.post("/recruitment/refresh")
@idempotent("recruitment.refresh")
async def refresh_recruitment(body: Optional[MutationInput] = None, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if player["clean_money"] < POOL_REFRESH_COST:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    now = now_utc()
    old_docs = await db.candidates.find({"player_id": pid}).to_list(100)
    fresh_player = await _debit_clean_atomic(player, POOL_REFRESH_COST)
    docs = []
    for key, src in RECRUIT_SOURCES.items():
        if player["level"] >= src["min_level"]:
            for _ in range(2):
                docs.append(gen_candidate(pid, key, now.isoformat()))
    try:
        await db.candidates.delete_many({"player_id": pid})
        if docs:
            await db.candidates.insert_many(docs)
        await db.players.update_one(
            {"_id": player["_id"]},
            {"$set": {"pool_refresh_at": (now + timedelta(minutes=POOL_REFRESH_MIN)).isoformat()}},
        )
    except Exception:
        await db.candidates.delete_many({"player_id": pid})
        if old_docs:
            await db.candidates.insert_many(old_docs)
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": POOL_REFRESH_COST}})
        raise
    await add_event(db, pid, "team", f"Contactos de recrutamento atualizados por {POOL_REFRESH_COST:,} €.")
    await record_tx(db, pid, "pool_refresh", -POOL_REFRESH_COST, "clean", fresh_player["clean_money"], "Atualização de contactos")
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
    station = emp.get("stationed_property_id")
    if body.team_id and station:
        await db.properties.update_one(
            {"_id": ObjectId(station), "player_id": pid},
            {"$pull": {"staff_employee_ids": body.employee_id}},
        )
    await db.employees.update_one(
        {"_id": emp["_id"]},
        {"$set": {"team_id": body.team_id, **({"stationed_property_id": None} if body.team_id else {})}},
    )
    # Mudar o plantel de uma equipa quebra a coordenação: reinicia a veterania e
    # aplica um pequeno cooldown de reorganização antes do próximo despacho.
    affected_ids = {tid for tid in (old_team_id, body.team_id) if tid}
    if affected_ids:
        now_iso = now_utc().isoformat()
        reorg_until = (now_utc() + timedelta(seconds=REORG_AFTER_ROSTER_CHANGE_S * max(0.6, 1.0 - 0.10 * department_level(player, "comunicacoes")))).isoformat()
        await db.teams.update_many(
            {"_id": {"$in": [ObjectId(tid) for tid in affected_ids]}, "player_id": pid},
            {"$set": {"roster_stable_since": now_iso, "available_at": reorg_until, "roster_missions": 0}},
        )
    return {"ok": True}


@router.post("/employees/train")
@idempotent("employees.train")
async def train_employee(body: TrainInput, user: dict = Depends(get_current_user)):
    if body.course_key not in TRAINING_COURSES:
        raise HTTPException(status_code=400, detail="Formação inválida")
    player = await get_player(user)
    pid = str(player["_id"])
    course = TRAINING_COURSES[body.course_key]
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] != "idle":
        raise HTTPException(status_code=400, detail="Operacional está ocupado")
    training_cost = max(0, int(course["cost"] * (1.0 - 0.06 * department_level(player, "rh"))))
    if player["clean_money"] < training_cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    ends = now_utc() + timedelta(seconds=course["duration_s"] * max(0.72, 1.0 - 0.08 * department_level(player, "rh")))
    fresh_player = await _debit_clean_atomic(player, training_cost)
    changed = await db.employees.update_one(
        {"_id": emp["_id"], "player_id": pid, "status": "idle"},
        {"$set": {
            "status": "training",
            "training": {"course_key": body.course_key, "ends_at": ends.isoformat()},
        }},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": training_cost}})
        raise HTTPException(status_code=409, detail="O estado do operacional mudou antes da formação")
    await add_event(db, pid, "team", f"{emp['name']} iniciou a formação {course['name']}.")
    await record_tx(db, pid, "training", -training_cost, "clean", fresh_player["clean_money"], f"Formação {course['name']} de {emp['name']}")
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
@idempotent("employees.promote")
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
    fresh_player = await _debit_clean_atomic(player, cost, {"stats.employees_promoted": 1})
    changed = await db.employees.update_one(
        {"_id": emp["_id"], "player_id": pid, "rank": emp.get("rank", "recruta"), "level": {"$gte": RANK_REQ_LEVEL[new_idx]}},
        {"$set": {
            "rank": new_rank, "salary": int(emp.get("salary", 0) * 1.1),
            "loyalty": min(100.0, emp.get("loyalty", 70) + 10),
            "morale": min(100.0, emp.get("morale", 70) + 8),
            "fatigue": 0.0,
        }},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost, "stats.employees_promoted": -1}})
        raise HTTPException(status_code=409, detail="O posto do operacional mudou antes da promoção")
    await push_history(db, emp["_id"], f"Promovido a {new_rank.replace('_', ' ')}.")
    await add_event(db, pid, "team", f"{emp['name']} promovido a {new_rank.replace('_', ' ')} por {cost:,} €.")
    await record_tx(db, pid, "promote", -cost, "clean", fresh_player["clean_money"], f"Promoção de {emp['name']}")
    return {"ok": True}


@router.post("/employees/bonus")
@idempotent("employees.bonus")
async def bonus_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    cost = max(100, emp.get("salary", 100))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    fresh_player = await _debit_clean_atomic(player, cost, {"stats.bonuses_paid": 1})
    await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
        "morale": min(100.0, emp.get("morale", 70) + 15),
        "loyalty": min(100.0, emp.get("loyalty", 70) + 10),
    }})
    await push_history(db, emp["_id"], f"Recebeu um bónus de {cost:,} €.")
    await add_event(db, pid, "team", f"Bónus de {cost:,} € pago a {emp['name']}. Moral e lealdade subiram.")
    await record_tx(db, pid, "bonus", -cost, "clean", fresh_player["clean_money"], f"Bónus para {emp['name']}")
    return {"cost": cost}


@router.post("/employees/heal")
@idempotent("employees.heal")
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
    fresh_player = await _debit_clean_atomic(player, cost)
    changed = await db.employees.update_one(
        {"_id": emp["_id"], "player_id": pid, "status": "injured"},
        {"$set": {"status": "idle", "status_until": None, "injury": None, "stress": max(0.0, float(emp.get("stress", 10) or 0) - 12)}},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost}})
        raise HTTPException(status_code=409, detail="O estado clínico mudou antes do tratamento")
    await push_history(db, emp["_id"], "Tratado na clínica clandestina.")
    await add_event(db, pid, "team", f"{emp['name']} tratado na clínica clandestina por {cost:,} €.")
    await record_tx(db, pid, "heal", -cost, "clean", fresh_player["clean_money"], f"Clínica para {emp['name']}")
    return {"cost": cost}


@router.post("/employees/release")
@idempotent("employees.release")
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
    fresh_player = await _debit_clean_atomic(player, cost)
    changed = await db.employees.update_one(
        {"_id": emp["_id"], "player_id": pid, "status": "arrested"},
        {"$set": {
            "status": "idle", "status_until": None, "sentence": None,
            "loyalty": min(100.0, emp.get("loyalty", 70) + 8),
        }},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost}})
        raise HTTPException(status_code=409, detail="O estado prisional mudou antes da libertação")
    await push_history(db, emp["_id"], "Libertado com ajuda do advogado.")
    await add_event(db, pid, "team", f"{emp['name']} libertado da prisão por {cost:,} € (advogados e subornos).")
    await record_tx(db, pid, "release", -cost, "clean", fresh_player["clean_money"], f"Advogado para {emp['name']}")
    return {"cost": cost}


@router.post("/employees/fire")
@idempotent("employees.fire")
async def fire_employee(body: EmployeeIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    emp = await _get_employee(pid, body.employee_id)
    if emp["status"] == "on_mission":
        raise HTTPException(status_code=400, detail="Não podes despedir alguém em operação")
    severance = emp.get("salary", 100) * 3
    if player["clean_money"] < severance:
        raise HTTPException(status_code=400, detail=f"Indemnização de {severance:,} € — dinheiro limpo insuficiente")
    fresh_player = await _debit_clean_atomic(player, severance)
    deleted = await db.employees.delete_one({"_id": emp["_id"], "player_id": pid, "status": {"$ne": "on_mission"}})
    if deleted.deleted_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": severance}})
        raise HTTPException(status_code=409, detail="O estado do operacional mudou antes do despedimento")
    await _unlink_employee_weapon(db, emp["_id"])
    if emp.get("stationed_property_id"):
        await db.properties.update_one(
            {"_id": ObjectId(emp["stationed_property_id"]), "player_id": pid},
            {"$pull": {"staff_employee_ids": body.employee_id}},
        )
    await db.employees.update_many({"player_id": pid}, {"$inc": {"morale": -3}})
    await db.employees.update_many({"player_id": pid, "morale": {"$lt": 0}}, {"$set": {"morale": 0.0}})
    await add_event(db, pid, "team", f"{emp['name']} despedido (indemnização de {severance:,} €). A moral da equipa ressentiu-se.")
    await record_tx(db, pid, "fire", -severance, "clean", fresh_player["clean_money"], f"Indemnização de {emp['name']}")
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

@router.post("/employees/optimize")
async def optimize_employees(user: dict = Depends(get_current_user)):
    """QI do efetivo (SSS v6): preenche as vagas das equipas disponíveis com os
    operacionais disponíveis SEM equipa, maximizando a aptidão para a
    especialização de cada equipa — a mesma régua da eficácia de missão
    (atributo ponderado da categoria + match de especialização + nível).
    Nunca move membros entre equipas (protege o entrosamento); só preenche
    lugares vazios com quem está de fora."""
    player = await get_player(user)
    pid = str(player["_id"])
    employees = await db.employees.find({"player_id": pid}).to_list(300)
    free = [
        e for e in employees
        if e.get("status") == "idle" and not e.get("team_id") and not e.get("stationed_property_id")
    ]
    if not free:
        raise HTTPException(status_code=400, detail="Nenhum operacional disponível sem equipa para colocar")
    teams = await db.teams.find({"player_id": pid, "status": "idle"}).to_list(100)
    if not teams:
        raise HTTPException(status_code=400, detail="Nenhuma equipa disponível (todas em operação)")
    counts = {}
    for e in employees:
        tid = e.get("team_id")
        if tid:
            counts[tid] = counts.get(tid, 0) + 1
    slots = {str(t["_id"]): TEAM_MAX_MEMBERS - counts.get(str(t["_id"]), 0) for t in teams}
    open_teams = [t for t in teams if slots[str(t["_id"])] > 0]
    if not open_teams:
        raise HTTPException(status_code=400, detail="Todas as equipas disponíveis já estão completas")

    def fit_score(emp, team):
        # A mesma régua de team_effectiveness: atributo relevante ponderado
        # (1.º atributo da categoria pesa mais) × match de especialização.
        spec = team.get("spec") or "especial"
        attrs = emp.get("attrs") or {}
        aks = CATEGORY_ATTRS.get(spec)
        if aks and len(aks) == 2:
            attr = attrs.get(aks[0], 2) * PRIMARY_ATTR_WEIGHT_MAIN + attrs.get(aks[1], 2) * PRIMARY_ATTR_WEIGHT_SECONDARY
        elif aks:
            attr = sum(attrs.get(a, 2) for a in aks) / len(aks)
        else:
            attr = sum(attrs.values()) / max(1, len(attrs)) if attrs else 2
        match = 1.25 if (emp.get("spec") == spec or spec == "especial") else 1.0
        return (emp.get("level", 1) * 0.5 + attr * 0.45) * match

    pairs = []
    for e in free:
        for t in open_teams:
            pairs.append((fit_score(e, t), str(e["_id"]), str(t["_id"])))
    pairs.sort(key=lambda p: p[0], reverse=True)
    emp_by_id = {str(e["_id"]): e for e in free}
    team_by_id = {str(t["_id"]): t for t in open_teams}
    plan, used_e = {}, set()
    remaining = dict(slots)
    for score, eid, tid in pairs:
        if eid in used_e or remaining.get(tid, 0) <= 0:
            continue
        plan[eid] = tid
        used_e.add(eid)
        remaining[tid] -= 1
    if not plan:
        return {"ok": True, "changes": [], "message": "O efetivo já está na distribuição ótima."}

    changes = []
    affected = set()
    for eid, tid in plan.items():
        await db.employees.update_one({"_id": ObjectId(eid)}, {"$set": {"team_id": tid}})
        affected.add(tid)
        changes.append({"employee": emp_by_id[eid].get("name", "?"), "to": team_by_id[tid].get("name", "?")})
    # Mudar o plantel quebra a coordenação — mesmo efeito do assign manual.
    now_iso = now_utc().isoformat()
    reorg_until = (now_utc() + timedelta(seconds=REORG_AFTER_ROSTER_CHANGE_S * max(0.6, 1.0 - 0.10 * department_level(player, "comunicacoes")))).isoformat()
    await db.teams.update_many(
        {"_id": {"$in": [ObjectId(tid) for tid in affected]}, "player_id": pid},
        {"$set": {"roster_stable_since": now_iso, "available_at": reorg_until, "roster_missions": 0}},
    )
    await add_event(db, pid, "team",
                    f"Efetivo otimizado — {len(changes)} operacional(is) colocado(s) nas equipas mais adequadas.")
    return {"ok": True, "changes": changes,
            "message": f"{len(changes)} operacional(is) colocado(s) por aptidão à especialização."}


# ---------------- Veículos ----------------

@router.post("/vehicles/buy")
@idempotent("vehicles.buy")
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
    fresh_player = await _debit_clean_atomic(player, model["price"], {"stats.vehicles_bought": 1})
    try:
        await db.vehicles.insert_one(vehicle_doc(pid, body.model_key, now_utc().isoformat()))
    except Exception:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": model["price"], "stats.vehicles_bought": -1}})
        raise
    await add_event(db, pid, "vehicle", f"{model['name']} adquirido por {model['price']:,} €.")
    await record_tx(db, pid, "vehicle_buy", -model["price"], "clean", fresh_player["clean_money"], f"Compra de {model['name']}")
    return {"ok": True}


async def _vehicle_free(pid, vehicle):
    seized_until = vehicle.get("seized_until")
    if seized_until and parse_dt(seized_until) > now_utc():
        return False
    if vehicle.get("transfer"):
        return False
    if vehicle.get("team_id"):
        team = await db.teams.find_one({"_id": ObjectId(vehicle["team_id"]), "player_id": pid})
        if team and team["status"] != "idle":
            return False
    return True


@router.post("/vehicles/sell")
@idempotent("vehicles.sell")
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
    deleted = await db.vehicles.delete_one({"_id": vehicle["_id"], "player_id": pid})
    if deleted.deleted_count != 1:
        raise HTTPException(status_code=409, detail="O veículo já foi vendido noutra sessão")
    fresh_player = await db.players.find_one_and_update(
        {"_id": player["_id"]}, {"$inc": {"clean_money": value}}, return_document=ReturnDocument.AFTER
    )
    await add_event(db, pid, "vehicle", f"{vehicle['name']} abatido. Recebeste {value:,} €.")
    await record_tx(db, pid, "vehicle_sell", value, "clean", fresh_player["clean_money"], f"Venda de {vehicle['name']}")
    return {"value": value}


@router.post("/vehicles/refuel")
@idempotent("vehicles.refuel")
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
    cost = math.ceil(missing * FUEL_PRICES[vehicle["fuel_type"]] * logistics_cost_multiplier(player))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    duration_s = REFUEL_DURATION_BASE_S + REFUEL_DURATION_PER_L_S * missing
    vip_active = bool(player.get("vip_until")) and parse_dt(player["vip_until"]) > now_utc()
    if vip_active:
        duration_s *= VIP_REFUEL_SPEED_MULT
    until = (now_utc() + timedelta(seconds=duration_s)).isoformat()
    fresh_player = await _debit_clean_atomic(player, cost, {"stats.vehicles_refueled": 1})
    changed = await db.vehicles.update_one(
        {"_id": vehicle["_id"], "player_id": pid, "fuel_l": vehicle["fuel_l"], "$or": [
            {"refueling_until": None}, {"refueling_until": {"$exists": False}}, {"refueling_until": {"$lte": now_utc().isoformat()}},
        ]},
        {"$set": {"refueling_until": until}, "$inc": {"fuel_spent_total": cost}},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost, "stats.vehicles_refueled": -1}})
        raise HTTPException(status_code=409, detail="O estado do veículo mudou antes do abastecimento")
    await add_event(db, pid, "vehicle", f"{vehicle['name']} a abastecer ({vehicle['fuel_type']}) por {cost:,} € — pronto em {round(duration_s)}s.")
    await record_tx(db, pid, "refuel", -cost, "clean", fresh_player["clean_money"], f"Combustível para {vehicle['name']}")
    return {"cost": cost, "refueling_until": until}


@router.post("/vehicles/repair")
@idempotent("vehicles.repair")
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
    cost = max(50, int(missing * vehicle["price"] * VEHICLE_REPAIR_BASE_MULTIPLIER * (1 - discount)))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    fresh_player = await _debit_clean_atomic(player, cost, {"stats.vehicles_repaired": 1})
    changed = await db.vehicles.update_one(
        {"_id": vehicle["_id"], "player_id": pid, "condition": vehicle["condition"]},
        {
            "$set": {"condition": 100.0, "missions_since_repair": 0},
            "$inc": {"repair_spent_total": cost},
        },
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost, "stats.vehicles_repaired": -1}})
        raise HTTPException(status_code=409, detail="A condição do veículo mudou antes da reparação")
    await add_event(db, pid, "vehicle", f"{vehicle['name']} reparado por {cost:,} €.")
    await record_tx(db, pid, "repair", -cost, "clean", fresh_player["clean_money"], f"Reparação de {vehicle['name']}")
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
@idempotent("vehicles.transfer")
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
    cost = max(VEHICLE_TRANSFER_COST_MIN, round(dist_km * VEHICLE_TRANSFER_COST_PER_KM * logistics_cost_multiplier(player)))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    duration_s = VEHICLE_TRANSFER_DURATION_BASE_S + VEHICLE_TRANSFER_DURATION_PER_KM_S * dist_km
    now = now_utc()
    until = (now + timedelta(seconds=duration_s)).isoformat()
    dest_name = to_prop["name"] if to_prop else player["hq"]["name"]
    fresh_player = await _debit_clean_atomic(player, cost)
    changed = await db.vehicles.update_one(
        {
            "_id": vehicle["_id"], "player_id": pid,
            "property_id": vehicle.get("property_id"),
            "$or": [{"transfer": None}, {"transfer": {"$exists": False}}],
        },
        {"$set": {
            "transfer": {
                "to_property_id": body.to_property_id, "started_at": now.isoformat(), "ends_at": until,
                "from": {"lat": origin["lat"], "lng": origin["lng"]},
                "to": {"lat": to_lat, "lng": to_lng},
            },
        }},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost}})
        raise HTTPException(status_code=409, detail="O veículo mudou de base/estado antes da transferência")
    await add_event(db, pid, "vehicle", f"{vehicle['name']} a caminho de {dest_name} — chega em {round(duration_s)}s.")
    await record_tx(db, pid, "vehicle_transfer", -cost, "clean", fresh_player["clean_money"], f"Transferência de {vehicle['name']} para {dest_name}")
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


@router.post("/vehicles/optimize")
async def optimize_vehicles(user: dict = Depends(get_current_user)):
    """QI da frota (SSS v6): redistribui os veículos disponíveis pelas equipas
    disponíveis maximizando a adequação global — a mesma régua da chance de
    missão (vehicle_mission_score da especialização, best_for, condição,
    combustível e aproveitamento de lugares). Só mexe em veículos cuja equipa
    está disponível e nunca deixa uma equipa com menos lugares que membros."""
    player = await get_player(user)
    pid = str(player["_id"])
    vehicles = await db.vehicles.find({"player_id": pid}).to_list(200)
    if not vehicles:
        raise HTTPException(status_code=400, detail="Não tens veículos na frota")
    teams = await db.teams.find({"player_id": pid}).to_list(100)
    idle_teams = [t for t in teams if t.get("status") == "idle"]
    if not idle_teams:
        raise HTTPException(status_code=400, detail="Nenhuma equipa disponível para receber veículos")
    employees = await db.employees.find({"player_id": pid}).to_list(300)
    members_count = {}
    for e in employees:
        tid = e.get("team_id")
        if tid:
            members_count[tid] = members_count.get(tid, 0) + 1
    now = now_utc()
    teams_by_id = {str(t["_id"]): t for t in teams}

    def movable_vehicle(v):
        tr = v.get("transfer")
        if tr and tr.get("ends_at") and parse_dt(tr["ends_at"]) > now:
            return False  # em trânsito entre bases
        t = teams_by_id.get(v.get("team_id") or "")
        return t is None or t.get("status") == "idle"

    movable = [v for v in vehicles if movable_vehicle(v)]
    if not movable:
        raise HTTPException(status_code=400, detail="Nenhum veículo disponível para redistribuir (equipas em operação)")
    # Equipas cujo veículo atual não é móvel (ex.: em trânsito) ficam de fora —
    # atribuir-lhes outro veículo desligaria o que está a caminho.
    eligible_teams = []
    for t in idle_teams:
        cur = t.get("vehicle_id")
        if cur and not any(str(v["_id"]) == cur for v in movable) and any(str(v["_id"]) == cur for v in vehicles):
            continue
        eligible_teams.append(t)
    if not eligible_teams:
        raise HTTPException(status_code=400, detail="Nenhuma equipa elegível para trocar de veículo")

    def pair_score(v, t):
        model = VEHICLE_MODELS.get(v.get("model_key"))
        if not model:
            return None
        n = members_count.get(str(t["_id"]), 0)
        seats = model.get("seats", 2)
        if n > seats:
            return None  # despacho ficaria bloqueado por falta de lugares
        spec = t.get("spec") or "especial"
        base = vehicle_mission_score(model, spec)
        best = model.get("best_for") or []
        fit = 1.15 if spec in best else (0.9 if best else 1.0)
        cond = 0.7 + 0.3 * max(0.0, min(100.0, v.get("condition", 100.0))) / 100.0
        fuel = 0.9 + 0.1 * (v.get("fuel_l", 0.0) / max(1.0, v.get("tank_l", 1.0)))
        seat_fit = 1.0
        if n > 0:
            seat_fit = 0.85 + 0.15 * min(1.0, (n / seats) / 0.75)
        return base * fit * cond * fuel * seat_fit

    pairs = []
    v_by_id = {str(v["_id"]): v for v in movable}
    for v in movable:
        for t in eligible_teams:
            s = pair_score(v, t)
            if s is not None:
                pairs.append((s, str(v["_id"]), str(t["_id"])))
    if not pairs:
        raise HTTPException(status_code=400, detail="Nenhuma combinação válida (lugares insuficientes para as equipas)")
    pairs.sort(key=lambda p: p[0], reverse=True)
    plan, used_v, used_t = {}, set(), set()
    for score, vid, tid in pairs:
        if vid in used_v or tid in used_t:
            continue
        plan[vid] = tid
        used_v.add(vid)
        used_t.add(tid)

    team_name = {str(t["_id"]): t.get("name", "?") for t in teams}
    changes = []
    for vid, tid in plan.items():
        v = v_by_id[vid]
        if v.get("team_id") == tid:
            continue
        changes.append({
            "vehicle": v.get("name", "?"),
            "from": team_name.get(v.get("team_id") or ""),
            "to": team_name.get(tid, "?"),
        })
    benched = [v_by_id[vid].get("name", "?") for vid in v_by_id
               if vid not in plan and v_by_id[vid].get("team_id")
               and str(v_by_id[vid].get("team_id")) in {str(t["_id"]) for t in eligible_teams}]
    if not changes and not benched:
        return {"ok": True, "changes": [], "message": "A frota já está na distribuição ótima."}

    # Aplicar de forma atómica: limpar vínculos móveis e ligar o plano.
    eligible_ids = [t["_id"] for t in eligible_teams]
    await db.vehicles.update_many(
        {"_id": {"$in": [ObjectId(vid) for vid in v_by_id]}},
        {"$set": {"team_id": None}},
    )
    await db.teams.update_many({"_id": {"$in": eligible_ids}}, {"$set": {"vehicle_id": None}})
    for vid, tid in plan.items():
        await db.vehicles.update_one({"_id": ObjectId(vid)}, {"$set": {"team_id": tid}})
        await db.teams.update_one({"_id": ObjectId(tid)}, {"$set": {"vehicle_id": vid}})
    moved = len(changes)
    await add_event(db, pid, "vehicle",
                    f"Frota otimizada — {moved} veículo(s) redistribuído(s) pelas equipas mais adequadas."
                    + (f" {len(benched)} veículo(s) voltaram à garagem." if benched else ""))
    return {"ok": True, "changes": changes, "benched": benched,
            "message": f"{moved} veículo(s) redistribuído(s)." if moved else "Frota arrumada — sem trocas necessárias."}


@router.post("/weapons/buy")
@idempotent("weapons.buy")
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
    fresh_player = await _debit_clean_atomic(player, model["price"])
    try:
        await db.weapons.insert_one({
        "player_id": pid, "model_key": body.model_key, "name": model["name"],
        "condition": 100.0, "employee_id": None, "missions_since_repair": 0,
        "missions_done": 0, "upgrades": [],
        "ammo_loaded": int(model.get("magazine_capacity", 0) or 0),
            "bought_at": now_utc().isoformat(),
        })
    except Exception:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": model["price"]}})
        raise
    await add_event(db, pid, "weapon", f"{model['name']} adquirida por {model['price']:,} €.")
    await record_tx(db, pid, "weapon_buy", -model["price"], "clean", fresh_player["clean_money"], f"Compra de {model['name']}")
    return {"ok": True}


@router.post("/weapons/sell")
@idempotent("weapons.sell")
async def sell_weapon(body: WeaponIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    weapon = await db.weapons.find_one({"_id": _oid(body.weapon_id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    if not await _weapon_free(pid, weapon):
        raise HTTPException(status_code=400, detail="O funcionário equipado está em operação")
    model = WEAPON_MODELS.get(weapon["model_key"], {})
    value = int(model.get("price", 0) * WEAPON_SELL_FRACTION * weapon.get("condition", 100) / 100)
    if weapon.get("employee_id"):
        await db.employees.update_one({"_id": ObjectId(weapon["employee_id"])}, {"$set": {"weapon_id": None}})
    deleted = await db.weapons.delete_one({"_id": weapon["_id"], "player_id": pid})
    if deleted.deleted_count != 1:
        raise HTTPException(status_code=409, detail="A arma já foi vendida noutra sessão")
    fresh_player = await db.players.find_one_and_update(
        {"_id": player["_id"]}, {"$inc": {"clean_money": value}}, return_document=ReturnDocument.AFTER
    )
    await add_event(db, pid, "weapon", f"{weapon['name']} vendida. Recebeste {value:,} €.")
    await record_tx(db, pid, "weapon_sell", value, "clean", fresh_player["clean_money"], f"Venda de {weapon['name']}")
    return {"value": value}


@router.post("/weapons/repair")
@idempotent("weapons.repair")
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
    fresh_player = await _debit_clean_atomic(player, cost)
    changed = await db.weapons.update_one(
        {"_id": weapon["_id"], "player_id": pid, "condition": weapon.get("condition", 100)},
        {"$set": {"condition": 100.0, "missions_since_repair": 0}},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost}})
        raise HTTPException(status_code=409, detail="A condição da arma mudou antes da reparação")
    await add_event(db, pid, "weapon", f"{weapon['name']} reparada por {cost:,} €.")
    await record_tx(db, pid, "weapon_repair", -cost, "clean", fresh_player["clean_money"], f"Reparação de {weapon['name']}")
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

@router.post("/properties/validate-location")
async def validate_property_location(body: MapPointInput, user: dict = Depends(get_current_user)):
    """Validação geográfica oficial para o modo de colocação do mapa."""
    player = await get_player(user)
    valid = is_in_portugal(body.lat, body.lng) and not in_water_body(body.lat, body.lng)
    district = nearest_district(body.lat, body.lng, player.get("districts")) if valid else None
    return {
        "valid": valid,
        "district": district,
        "reason": None if valid else "Escolhe um ponto em terra firme em Portugal.",
    }


@router.post("/properties/buy")
@idempotent("properties.buy")
async def buy_property(body: PropertyBuyInput, user: dict = Depends(get_current_user)):
    if body.type_key not in PROPERTY_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de propriedade inválido")
    if not is_on_land(body.lat, body.lng):
        raise HTTPException(status_code=400, detail="Localização inválida — escolhe um ponto em terra em Portugal")
    player = await get_player(user)
    pid = str(player["_id"])
    pt = PROPERTY_TYPES[body.type_key]
    if player["level"] < pt["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {pt['min_level']}")
    market = property_market_price(pt["price"], body.lat, body.lng)
    price = market["price"]
    if player["clean_money"] < price:
        raise HTTPException(
            status_code=400,
            detail=f"Dinheiro limpo insuficiente — preço regional: {price:,} € ({market['zone']})",
        )
    district = nearest_district(body.lat, body.lng, player.get("districts"))
    fresh_player = await _debit_clean_atomic(player, price, {"stats.properties_bought": 1})
    try:
        await db.properties.insert_one({
        "player_id": pid, "type_key": body.type_key,
        "name": f"{pt['name']} — {district}", "district": district,
        "lat": body.lat, "lng": body.lng,
        "level": 1,
        "purchase_price": price,
        "market_zone": market["zone"],
        "market_multiplier": market["multiplier"],
            "bought_at": now_utc().isoformat(),
        })
    except Exception:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": price, "stats.properties_bought": -1}})
        raise
    await add_event(
        db, pid, "property",
        f"{pt['name']} comprado em {district} por {price:,} € "
        f"(índice {market['zone']} ×{market['multiplier']:.2f}).",
    )
    await record_tx(
        db, pid, "property_buy", -price, "clean", fresh_player["clean_money"],
        f"Compra de {pt['name']} — {market['zone']}",
    )
    return {"ok": True, "price": price, "market_zone": market["zone"], "market_multiplier": market["multiplier"]}


@router.post("/properties/sell")
@idempotent("properties.sell")
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
    market_basis = int(prop.get("purchase_price") or pt["price"])
    value = int(market_basis * 0.7 * prop["level"])
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
    if prop.get("staff_employee_ids"):
        await db.employees.update_many(
            {"player_id": pid, "_id": {"$in": [ObjectId(eid) for eid in prop.get("staff_employee_ids", [])]}},
            {"$set": {"stationed_property_id": None}},
        )
    deleted = await db.properties.delete_one({"_id": prop["_id"], "player_id": pid})
    if deleted.deleted_count != 1:
        raise HTTPException(status_code=409, detail="O imóvel já foi vendido noutra sessão")
    fresh_player = await db.players.find_one_and_update(
        {"_id": player["_id"]}, {"$inc": {"clean_money": value}}, return_document=ReturnDocument.AFTER
    )
    await add_event(db, pid, "property", f"{prop['name']} vendido por {value:,} €.")
    await record_tx(db, pid, "property_sell", value, "clean", fresh_player["clean_money"], f"Venda de {prop['name']}")
    return {"value": value}


@router.post("/properties/upgrade")
@idempotent("properties.upgrade")
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
    market_basis = int(prop.get("purchase_price") or pt["price"])
    cost = int(market_basis * 0.6 * (prop["level"] + 1))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    target_level = prop["level"] + 1
    duration_s = PROPERTY_UPGRADE_BASE_S + PROPERTY_UPGRADE_PER_LEVEL_S * target_level
    until = (now + timedelta(seconds=duration_s)).isoformat()
    fresh_player = await _debit_clean_atomic(player, cost, {"stats.properties_upgraded": 1})
    changed = await db.properties.update_one(
        {
            "_id": prop["_id"], "player_id": pid, "level": prop["level"],
            "$or": [{"upgrading_until": None}, {"upgrading_until": {"$exists": False}}, {"upgrading_until": {"$lte": now.isoformat()}}],
        },
        {"$set": {"upgrading_until": until}},
    )
    if changed.modified_count != 1:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"clean_money": cost, "stats.properties_upgraded": -1}})
        raise HTTPException(status_code=409, detail="O imóvel mudou de estado antes da melhoria")
    await add_event(db, pid, "property", f"{prop['name']} começou a ser melhorado para nível {target_level} por {cost:,} € — pronto em {round(duration_s / 60, 1)} min.")
    await record_tx(db, pid, "property_upgrade", -cost, "clean", fresh_player["clean_money"], f"Melhoria de {prop['name']}")
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


@router.post("/properties/optimize")
@idempotent("properties.optimize")
async def optimize_properties(body: Optional[MutationInput] = None, user: dict = Depends(get_current_user)):
    """QI do património (SSS v6): lança as melhorias com melhor retorno real,
    respeitando uma reserva de caixa para o próximo ciclo salarial. Imóveis
    produtivos (laboratórios/lavagem) ordenados por payback (custo ÷ ganho/h
    à condição atual); imóveis de capacidade/bónus a seguir, do mais barato
    para o mais caro."""
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()
    props = await db.properties.find({"player_id": pid}).to_list(200)
    if not props:
        raise HTTPException(status_code=400, detail="Não tens imóveis para melhorar")
    upgradable = [
        p for p in props
        if p["level"] < PROPERTY_MAX_LEVEL
        and not (p.get("upgrading_until") and parse_dt(p["upgrading_until"]) > now)
        and p["type_key"] in PROPERTY_TYPES
    ]
    if not upgradable:
        raise HTTPException(status_code=400, detail="Nenhum imóvel elegível — tudo no nível máximo ou já em obras")
    employees = await db.employees.find({"player_id": pid}).to_list(300)
    vehicles = await db.vehicles.find({"player_id": pid}).to_list(200)
    gross_reserve = int(sum(e.get("salary", 0) for e in employees))
    reserve = (
        gross_reserve
        + int(round(gross_reserve * EMPLOYER_SOCIAL_SECURITY_RATE))
        + int(round(sum(
            VEHICLE_ANNUAL_FIXED_COSTS.get(v.get("model_key"), 0) / 52
            for v in vehicles
        )))
        + int(round(sum(
            (p.get("purchase_price") or PROPERTY_TYPES[p["type_key"]]["price"])
            * max(1, int(p.get("level", 1)))
            * PROPERTY_MAINTENANCE_PCT_PER_WEEK
            for p in props
        )))
    )

    def plan_for(p):
        pt = PROPERTY_TYPES[p["type_key"]]
        cost = int((p.get("purchase_price") or pt["price"]) * 0.6 * (p["level"] + 1))
        # Ganho por hora de subir 1 nível, usando a mesma taxa passiva do motor.
        rate = (pt.get("dirty_per_h") or 0) + (pt.get("launder_per_h") or 0) * LAUNDER_PASSIVE_RATE
        gain_h = rate * property_condition_factor(p)
        payback_h = (cost / gain_h) if gain_h > 0 else None
        return {"prop": p, "pt": pt, "cost": cost, "gain_h": gain_h, "payback_h": payback_h}

    plans = [plan_for(p) for p in upgradable]
    income = sorted([x for x in plans if x["payback_h"]], key=lambda x: x["payback_h"])
    other = sorted([x for x in plans if not x["payback_h"]], key=lambda x: x["cost"])
    ordered = income + other

    budget = player["clean_money"] - reserve
    actions = []
    for x in ordered:
        if x["cost"] > budget:
            continue
        p, pt = x["prop"], x["pt"]
        target_level = p["level"] + 1
        duration_s = PROPERTY_UPGRADE_BASE_S + PROPERTY_UPGRADE_PER_LEVEL_S * target_level
        until = (now + timedelta(seconds=duration_s)).isoformat()
        fresh_player = await db.players.find_one_and_update(
            {"_id": player["_id"], "clean_money": {"$gte": x["cost"] + reserve}},
            {"$inc": {"clean_money": -x["cost"], "stats.properties_upgraded": 1}},
            return_document=ReturnDocument.AFTER,
        )
        if not fresh_player:
            continue
        changed = await db.properties.update_one(
            {
                "_id": p["_id"], "player_id": pid, "level": p["level"],
                "$or": [{"upgrading_until": None}, {"upgrading_until": {"$exists": False}}, {"upgrading_until": {"$lte": now.isoformat()}}],
            },
            {"$set": {"upgrading_until": until}},
        )
        if changed.modified_count != 1:
            await db.players.update_one(
                {"_id": player["_id"]},
                {"$inc": {"clean_money": x["cost"], "stats.properties_upgraded": -1}},
            )
            continue
        player["clean_money"] = fresh_player["clean_money"]
        await record_tx(db, pid, "property_upgrade", -x["cost"], "clean", fresh_player["clean_money"], f"Melhoria de {p['name']} (otimização)")
        budget = max(0, fresh_player["clean_money"] - reserve)
        actions.append({
            "property": p.get("name", pt["name"]), "to_level": target_level, "cost": x["cost"],
            "payback_h": round(x["payback_h"], 1) if x["payback_h"] else None,
        })
    if not actions:
        return {"ok": True, "actions": [],
                "message": f"Sem verba livre — mantida uma reserva de {reserve:,} € para o ciclo salarial."}
    names = ", ".join(f"{a['property']} → N{a['to_level']}" for a in actions)
    await add_event(db, pid, "property",
                    f"Património otimizado — {len(actions)} melhoria(s) lançada(s) por melhor retorno: {names}.")
    return {"ok": True, "actions": actions,
            "message": f"{len(actions)} melhoria(s) lançada(s) — reserva salarial de {reserve:,} € preservada."}


# ---------------- Quartel-General ----------------

# Margem mínima de terra firme entre o QG e a costa/fronteira — protege
# contra a margem de erro do polígono simplificado junto ao mar (mesma
# régua do geo.is_valid_hq_location).
HQ_MIN_INLAND_M = 120.0


class HqPlaceInput(BaseModel):
    lat: float
    lng: float


def _hq_location_verdict(lat: float, lng: float):
    """Razão exata pela qual um ponto (não) serve para o QG — alimenta o
    feedback específico do ecrã de escolha. Regra do jogo: em Portugal
    (continente, Madeira ou Açores), NUNCA no mar/estuários/albufeiras e
    afastado da linha de costa pelo menos ~120 m."""
    if not (math.isfinite(lat) and math.isfinite(lng)
            and -90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return False, "Coordenadas inválidas."
    if not is_in_portugal(lat, lng):
        return False, ("Este ponto está fora de território português — mar ou estrangeiro. "
                       "O Quartel-General tem de ficar em terra firme de Portugal "
                       "(continente, Madeira ou Açores).")
    if in_water_body(lat, lng):
        return False, ("Este ponto está na água — estuário, ria ou albufeira. "
                       "O Quartel-General precisa de terra firme.")
    if distance_to_boundary_m(lat, lng) < HQ_MIN_INLAND_M:
        return False, ("Demasiado colado à linha de costa ou fronteira — recua um pouco "
                       "para o interior (mínimo ~120 m de terra firme).")
    return True, ""


@router.post("/hq/validate")
async def validate_hq_spot(body: HqPlaceInput, user: dict = Depends(get_current_user)):
    """Validação em direto de um ponto candidato a QG (onboarding). Devolve a
    razão exata quando inválido; quando válido, devolve o nome REAL do local
    (Nominatim com cache Mongo — nunca inventa nomes)."""
    valid, reason = _hq_location_verdict(body.lat, body.lng)
    label, locality = None, None
    if valid:
        g = await reverse_geocode(db, body.lat, body.lng, zoom=16)
        label = street_label(g)
        locality = locality_label(g)
    return {"valid": valid, "reason": reason or None, "label": label, "locality": locality}


@router.post("/hq/place")
async def place_hq(body: HqPlaceInput, user: dict = Depends(get_current_user)):
    """Coloca o PRIMEIRO Quartel-General (onboarding de conta nova). Regras
    estritas: só uma vez; só em terra firme portuguesa — o mar é estritamente
    proibido. Gera as zonas de operação em anéis à volta do QG e agenda o
    batismo com moradas reais em background; as missões começam a aparecer
    assim que a primeira zona tem nome."""
    player = await get_player(user, allow_pending=True)
    if player.get("hq"):
        raise HTTPException(status_code=409, detail="O Quartel-General já está estabelecido — não pode ser mudado.")
    valid, reason = _hq_location_verdict(body.lat, body.lng)
    if not valid or not is_valid_hq_location(body.lat, body.lng, min_inland_m=HQ_MIN_INLAND_M):
        raise HTTPException(status_code=422, detail=reason or "Localização inválida para o Quartel-General.")
    lat, lng = round(float(body.lat), 6), round(float(body.lng), 6)

    # Nome real do local (melhor esforço — sem rede fica o rótulo genérico;
    # nunca inventamos moradas).
    g = await reverse_geocode(db, lat, lng, zoom=16)
    label = street_label(g)
    region = locality_label(g) or ""
    hq_name = f"QG · {label}" if label else "Quartel-General"

    districts = generate_district_points(lat, lng)
    now_iso = now_utc().isoformat()
    hq = {"name": hq_name, "lat": lat, "lng": lng, "level": 1,
          "upgrading_until": None, "upgrade_history": []}
    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "hq": hq, "districts": districts, "region": region,
        "hq_placed_at": now_iso,
        # Reset do relógio do motor: o tempo parado no onboarding não conta
        # como tempo de jogo (salários, decaimentos, spawns).
        "last_tick": now_iso,
    }})
    pid = str(player["_id"])
    where = label or f"{lat:.4f}, {lng:.4f}"
    suffix = f" ({region})" if region and region not in where else ""
    await add_event(db, pid, "system",
                    f"Quartel-General estabelecido em {where}{suffix}. A rede está a mapear as zonas de operação em redor.")
    # Batismo das zonas com moradas reais em background (Nominatim ~1 req/s).
    asyncio.create_task(name_districts_task(db, player["_id"]))
    return {"ok": True, "hq": hq, "region": region, "districts": len(districts)}


@router.post("/hq/upgrade")
@idempotent("hq.upgrade")
async def upgrade_hq(body: Optional[MutationInput] = None, user: dict = Depends(get_current_user)):
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
    fresh_player = await db.players.find_one_and_update(
        {
            "_id": player["_id"], "clean_money": {"$gte": cost}, "hq.level": level,
            "$or": [{"hq.upgrading_until": None}, {"hq.upgrading_until": {"$exists": False}}, {"hq.upgrading_until": {"$lte": now.isoformat()}}],
        },
        {"$inc": {"clean_money": -cost}, "$set": {"hq.upgrading_until": until}},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh_player:
        raise HTTPException(status_code=409, detail="O saldo ou o estado do Quartel-General mudou antes da melhoria")
    await add_event(db, pid, "property", f"Quartel-General começou a ser melhorado para nível {target_level} por {cost:,} € — pronto em {round(duration_s / 60, 1)} min.")
    await record_tx(db, pid, "hq_upgrade", -cost, "clean", fresh_player["clean_money"], f"Melhoria do Quartel-General para nível {target_level}")
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
@idempotent("police.bribe")
async def bribe_police(body: Optional[MutationInput] = None, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if player["heat"] < 10:
        raise HTTPException(status_code=400, detail="O calor está demasiado baixo para justificar um suborno")
    bonuses = await get_org_bonuses(db, pid)
    cost = max(1000, int(player["heat"] * 150 * (1 - bonuses["bribe_discount"])))
    if player["clean_money"] < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    new_heat = max(0.0, player["heat"] - 40)
    fresh_player = await db.players.find_one_and_update(
        {"_id": player["_id"], "clean_money": {"$gte": cost}, "heat": player["heat"]},
        {"$inc": {"clean_money": -cost, "stats.bribes_paid": 1}, "$set": {"heat": new_heat}},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh_player:
        raise HTTPException(status_code=409, detail="O saldo ou o nível de calor mudou antes do suborno")
    await add_event(db, pid, "police", f"Suborno de {cost:,} € pago. O calor baixou para {round(new_heat)}%.")
    await record_tx(db, pid, "bribe", -cost, "clean", fresh_player["clean_money"], "Suborno à polícia")
    return {"cost": cost}


@router.post("/launder")
@idempotent("launder")
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
    rate = min(LAUNDER_MAX_RATE, LAUNDER_BASE_RATE + bonuses["launder_rate"] + property_bonus)
    clean_gain = int(body.amount * rate)
    fresh_player = await db.players.find_one_and_update(
        {"_id": player["_id"], "dirty_money": {"$gte": body.amount}},
        {"$inc": {
            "dirty_money": -body.amount, "clean_money": clean_gain, "stats.laundered_total": body.amount,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh_player:
        raise HTTPException(status_code=409, detail="O saldo de dinheiro sujo mudou antes do pedido")
    await add_event(db, pid, "launder", f"Lavagem de {body.amount:,} € — recebeste {clean_gain:,} € limpos (taxa {round((1 - rate) * 100)}%).")
    await record_tx(db, pid, "launder_out", -body.amount, "dirty", fresh_player["dirty_money"], "Lavagem de dinheiro")
    await record_tx(db, pid, "launder_in", clean_gain, "clean", fresh_player["clean_money"], "Lavagem de dinheiro")
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
@idempotent("quests.claim")
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
    # Reserva por compare-and-set antes de creditar qualquer recompensa.
    reserved = await db.quests.find_one_and_update(
        {"_id": q["_id"], "player_id": pid, "status": "completed"},
        {"$set": {"status": "claiming"}},
        return_document=ReturnDocument.AFTER,
    )
    if not reserved:
        raise HTTPException(status_code=409, detail="A recompensa acabou de ser reclamada noutra sessão")
    try:
        rewards, mult_note = effective_quest_rewards(player, q, d, now_utc())
        parts = await grant_quest_rewards(db, player, rewards)
        if mult_note:
            parts.append(mult_note)
        # effective_quest_rewards mutou série/desempenho — persistir já.
        await db.players.update_one({"_id": player["_id"]}, {"$set": {
            "quest_streak": player.get("quest_streak", {}),
            "quest_perf": player.get("quest_perf", {}),
        }})
        await db.quests.update_one(
            {"_id": q["_id"], "status": "claiming"},
            {"$set": {"status": "claimed", "claimed_at": now_utc().isoformat()}},
        )
    except Exception:
        await db.quests.update_one({"_id": q["_id"], "status": "claiming"}, {"$set": {"status": "completed"}})
        raise
    if q["quest_key"] == "c2_front":
        await db.quests.insert_one(make_instance(pid, "dec_informador", now_utc(), player.get("stats", {}), expires_s=3600))
        await add_event(db, pid, "intel", "DECISÃO: O Informador quer falar contigo — abre o painel de Missões.")
    msg = f"Recompensa reclamada — {d['name']}: " + ", ".join(parts) + "." if parts else f"Missão {d['name']} reclamada."
    await add_event(db, pid, "success", msg)
    return {"ok": True, "rewards": parts, "unlocks": d.get("unlocks_text"), "mult_note": mult_note}


@router.post("/quests/claim_all")
@idempotent("quests.claim_all")
async def claim_all_quests(body: Optional[MutationInput] = None, user: dict = Depends(get_current_user)):
    """Reclama TODAS as missões concluídas de uma vez — a mesma fórmula
    dinâmica do claim individual (nível × dificuldade × tier × série ×
    execução rápida), com a série/momentum persistidos uma única vez no fim."""
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()
    qs = await db.quests.find({"player_id": pid, "status": "completed"}).to_list(100)
    claimable = [q for q in qs if QUEST_DEFS.get(q.get("quest_key"))]
    if not claimable:
        raise HTTPException(status_code=400, detail="Nenhuma missão concluída por reclamar")
    all_parts = []
    claimed_count = 0
    for q in claimable:
        reserved = await db.quests.find_one_and_update(
            {"_id": q["_id"], "player_id": pid, "status": "completed"},
            {"$set": {"status": "claiming"}},
            return_document=ReturnDocument.AFTER,
        )
        if not reserved:
            continue
        d = QUEST_DEFS[q["quest_key"]]
        try:
            rewards, mult_note = effective_quest_rewards(player, q, d, now)
            parts = await grant_quest_rewards(db, player, rewards)
            if mult_note:
                parts.append(mult_note)
            await db.quests.update_one(
                {"_id": q["_id"], "status": "claiming"},
                {"$set": {"status": "claimed", "claimed_at": now.isoformat()}},
            )
        except Exception:
            await db.quests.update_one({"_id": q["_id"], "status": "claiming"}, {"$set": {"status": "completed"}})
            raise
        claimed_count += 1
        if q["quest_key"] == "c2_front":
            await db.quests.insert_one(make_instance(pid, "dec_informador", now, player.get("stats", {}), expires_s=3600))
            await add_event(db, pid, "intel", "DECISÃO: O Informador quer falar contigo — abre o painel de Missões.")
        all_parts.append(f"{d['name']}: " + ", ".join(parts) if parts else d["name"])
    # effective_quest_rewards mutou série/desempenho a cada claim — persistir uma vez.
    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "quest_streak": player.get("quest_streak", {}),
        "quest_perf": player.get("quest_perf", {}),
    }})
    if claimed_count == 0:
        raise HTTPException(status_code=409, detail="As recompensas foram reclamadas noutra sessão")
    await add_event(db, pid, "success",
                    f"Recompensas reclamadas — {claimed_count} contrato(s) fechado(s) de uma vez.")
    return {"ok": True, "claimed": claimed_count, "rewards": all_parts}


@router.post("/quests/choose")
@idempotent("quests.choose")
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
    reserved = await db.quests.find_one_and_update(
        {"_id": q["_id"], "player_id": pid, "status": "active"},
        {"$set": {"status": "resolving"}},
        return_document=ReturnDocument.AFTER,
    )
    if not reserved:
        raise HTTPException(status_code=409, detail="Esta decisão acabou de ser tomada noutra sessão")

    update = {}
    if inc:
        update["$inc"] = inc
    if sets:
        update["$set"] = sets
    query = {"_id": player["_id"]}
    if opt.get("cost_clean"):
        query["clean_money"] = {"$gte": opt["cost_clean"]}
    if update:
        fresh_player = await db.players.find_one_and_update(
            query, update, return_document=ReturnDocument.AFTER
        )
        if not fresh_player:
            await db.quests.update_one({"_id": q["_id"], "status": "resolving"}, {"$set": {"status": "active"}})
            raise HTTPException(status_code=409, detail="O saldo mudou antes da decisão")
    finalized = await db.quests.update_one(
        {"_id": q["_id"], "player_id": pid, "status": "resolving"},
        {"$set": {
            "status": "claimed", "choice": body.option, "outcome": res["outcome"],
            "claimed_at": now_utc().isoformat(),
        }},
    )
    if finalized.modified_count != 1:
        raise HTTPException(status_code=409, detail="Não foi possível finalizar a decisão")
    await add_event(db, pid, "intel", f"{d['name']}: {res['outcome']}")
    return {"ok": True, "outcome": res["outcome"]}


# ============================================================================
# LOJA — acelerar tempo, slots extra, VIP e cosméticos. Tudo pago em
# clean_money (dinheiro do jogo); sem moeda premium nem pagamentos reais.
# ============================================================================

def _speedup_cost(remaining_s: float) -> int:
    mins = max(0.0, remaining_s) / 60
    return max(SPEEDUP_COST_MIN, round(mins * SPEEDUP_COST_PER_MIN))


async def _shop_debit(player_id, cost: int, guard=None, update=None):
    """Debita saldo e altera o jogador numa única operação protegida."""
    query = {"_id": player_id, "clean_money": {"$gte": cost}}
    if guard:
        query.update(guard)
    operations = {"$inc": {"clean_money": -cost}}
    for operator, values in (update or {}).items():
        operations.setdefault(operator, {}).update(values)
    return await db.players.find_one_and_update(
        query,
        operations,
        return_document=ReturnDocument.AFTER,
    )


async def _shop_failure(player_id, cost: int, message: str):
    fresh = await db.players.find_one({"_id": player_id}, {"clean_money": 1}) or {}
    if (fresh.get("clean_money") or 0) < cost:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    raise HTTPException(status_code=409, detail=message)


async def _consume_shop_timer(player_id, cost: int, collection, query, update):
    """Consome o temporizador por compare-and-set ou devolve o débito."""
    result = await collection.update_one(query, update)
    if result.modified_count == 1:
        return
    await db.players.update_one({"_id": player_id}, {"$inc": {"clean_money": cost}})
    raise HTTPException(
        status_code=409,
        detail="Este temporizador já foi alterado. O dinheiro foi devolvido.",
    )


@router.post("/shop/speedup")
async def shop_speedup(body: ShopSpeedupInput, user: dict = Depends(get_current_user)):
    """Acelera um temporizador já existente (nunca cria lógica de conclusão
    nova) — só antecipa o timestamp relevante para agora. O próximo advance()
    conclui-o pelo caminho normal (_complete_refuels, _complete_hq_upgrade,
    etc.), exatamente como aconteceria sem a compra."""
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()

    if body.kind == "vehicle_refuel":
        vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Veículo não encontrado")
        until = vehicle.get("refueling_until")
        if not until or parse_dt(until) <= now:
            raise HTTPException(status_code=400, detail="Não está a abastecer")
        cost = _speedup_cost((parse_dt(until) - now).total_seconds())
        charged = await _shop_debit(player["_id"], cost)
        if not charged:
            raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
        await _consume_shop_timer(
            player["_id"], cost, db.vehicles,
            {"_id": vehicle["_id"], "player_id": pid, "refueling_until": until},
            {"$set": {"refueling_until": now.isoformat()}},
        )
        note = f"Abastecimento de {vehicle['name']}"

    elif body.kind == "vehicle_transfer":
        vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
        if not vehicle or not vehicle.get("transfer"):
            raise HTTPException(status_code=400, detail="Veículo não está em trânsito")
        ends_at = vehicle["transfer"]["ends_at"]
        if parse_dt(ends_at) <= now:
            raise HTTPException(status_code=400, detail="Transferência já concluída")
        cost = _speedup_cost((parse_dt(ends_at) - now).total_seconds())
        charged = await _shop_debit(player["_id"], cost)
        if not charged:
            raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
        await _consume_shop_timer(
            player["_id"], cost, db.vehicles,
            {"_id": vehicle["_id"], "player_id": pid, "transfer.ends_at": ends_at},
            {"$set": {"transfer.ends_at": now.isoformat()}},
        )
        note = f"Transferência de {vehicle['name']}"

    elif body.kind == "property_upgrade":
        prop = await db.properties.find_one({"_id": _oid(body.id, "Propriedade inválida"), "player_id": pid})
        if not prop:
            raise HTTPException(status_code=404, detail="Propriedade não encontrada")
        until = prop.get("upgrading_until")
        if not until or parse_dt(until) <= now:
            raise HTTPException(status_code=400, detail="Não está a subir de nível")
        cost = _speedup_cost((parse_dt(until) - now).total_seconds())
        charged = await _shop_debit(player["_id"], cost)
        if not charged:
            raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
        await _consume_shop_timer(
            player["_id"], cost, db.properties,
            {"_id": prop["_id"], "player_id": pid, "upgrading_until": until},
            {"$set": {"upgrading_until": now.isoformat()}},
        )
        note = f"Melhoria de {prop['name']}"

    elif body.kind == "hq_upgrade":
        hq = player.get("hq") or {}
        until = hq.get("upgrading_until")
        if not until or parse_dt(until) <= now:
            raise HTTPException(status_code=400, detail="O Quartel-General não está a subir de nível")
        cost = _speedup_cost((parse_dt(until) - now).total_seconds())
        charged = await _shop_debit(
            player["_id"],
            cost,
            guard={"hq.upgrading_until": until},
            update={"$set": {"hq.upgrading_until": now.isoformat()}},
        )
        if not charged:
            await _shop_failure(
                player["_id"],
                cost,
                "Esta melhoria já foi acelerada. Atualiza o jogo e tenta novamente.",
            )
        note = "Melhoria do Quartel-General"

    elif body.kind == "team_reorg":
        team = await db.teams.find_one({"_id": _oid(body.id, "Equipa inválida"), "player_id": pid})
        if not team:
            raise HTTPException(status_code=404, detail="Equipa não encontrada")
        until = team.get("available_at")
        if not until or parse_dt(until) <= now:
            raise HTTPException(status_code=400, detail="A equipa já está pronta")
        cost = _speedup_cost((parse_dt(until) - now).total_seconds())
        charged = await _shop_debit(player["_id"], cost)
        if not charged:
            raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
        await _consume_shop_timer(
            player["_id"], cost, db.teams,
            {"_id": team["_id"], "player_id": pid, "available_at": until},
            {"$set": {"available_at": None}},
        )
        note = f"Reorganização de {team['name']}"

    else:
        raise HTTPException(status_code=400, detail="Tipo de aceleração inválido")

    await add_event(db, pid, "shop", f"Aceleraste: {note} por {cost:,} €.")
    await record_tx(db, pid, "shop_speedup", -cost, "clean", charged["clean_money"], note)
    return {"ok": True, "cost": cost}


@router.post("/shop/buy_slot")
async def shop_buy_slot(body: ShopBuySlotInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if body.kind == "vehicle":
        field, base, label = "extra_vehicle_slots", SLOT_COST_VEHICLE_BASE, "veículo"
    elif body.kind == "employee":
        field, base, label = "extra_employee_slots", SLOT_COST_EMPLOYEE_BASE, "funcionário"
    else:
        raise HTTPException(status_code=400, detail="Tipo de slot inválido")
    n = player.get(field, 0) or 0
    cost = round(base * (1 + n * SLOT_COST_SCALE_PER_UNIT))
    guard = {field: n} if n else {"$or": [{field: 0}, {field: {"$exists": False}}]}
    charged = await _shop_debit(
        player["_id"],
        cost,
        guard=guard,
        update={"$inc": {field: 1}},
    )
    if not charged:
        await _shop_failure(
            player["_id"],
            cost,
            "O preço do slot mudou porque outra compra terminou primeiro. Tenta novamente.",
        )
    await add_event(db, pid, "shop", f"Compraste mais um slot de {label} por {cost:,} €.")
    await record_tx(db, pid, "shop_slot", -cost, "clean", charged["clean_money"], f"Slot extra de {label}")
    return {"ok": True, "cost": cost}


@router.post("/shop/vip")
async def shop_buy_vip(body: ShopVipInput, user: dict = Depends(get_current_user)):
    plan = VIP_PLANS.get(body.plan_key)
    if not plan:
        raise HTTPException(status_code=400, detail="Plano inválido")
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()
    current_raw = player.get("vip_until")
    current_until = parse_dt(current_raw) if current_raw else None
    base = current_until if current_until and current_until > now else now
    new_until = (base + timedelta(days=plan["days"])).isoformat()
    charged = await _shop_debit(
        player["_id"],
        plan["cost"],
        guard={"vip_until": current_raw},
        update={"$set": {"vip_until": new_until}},
    )
    if not charged:
        await _shop_failure(
            player["_id"],
            plan["cost"],
            "O período VIP foi atualizado por outro pedido. Tenta novamente.",
        )
    await add_event(db, pid, "shop", f"Ativaste o {plan['label']} por {plan['cost']:,} €.")
    await record_tx(db, pid, "shop_vip", -plan["cost"], "clean", charged["clean_money"], plan["label"])
    return {"ok": True, "vip_until": new_until}


_COSMETIC_CATALOGS = {"vehicle_paint": VEHICLE_PAINTS, "team_emblem": TEAM_EMBLEMS, "hq_skin": HQ_SKINS}


@router.post("/shop/cosmetic")
async def shop_buy_cosmetic(body: ShopCosmeticInput, user: dict = Depends(get_current_user)):
    catalog_map = _COSMETIC_CATALOGS.get(body.category)
    if not catalog_map or body.key not in catalog_map:
        raise HTTPException(status_code=400, detail="Cosmético inválido")
    item = catalog_map[body.key]
    player = await get_player(user)
    pid = str(player["_id"])
    owned_key = f"{body.category}:{body.key}"
    charged = await _shop_debit(
        player["_id"],
        item["cost"],
        guard={"owned_cosmetics": {"$ne": owned_key}},
        update={"$addToSet": {"owned_cosmetics": owned_key}},
    )
    if not charged:
        fresh = await db.players.find_one(
            {"_id": player["_id"]},
            {"clean_money": 1, "owned_cosmetics": 1},
        ) or {}
        if owned_key in (fresh.get("owned_cosmetics") or []):
            raise HTTPException(status_code=409, detail="Já possuis este cosmético")
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    await add_event(db, pid, "shop", f"Compraste o cosmético \"{item['label']}\" por {item['cost']:,} €.")
    await record_tx(db, pid, "shop_cosmetic", -item["cost"], "clean", charged["clean_money"], item["label"])
    return {"ok": True}


@router.post("/vehicles/equip_paint")
async def equip_vehicle_paint(body: VehicleEquipPaintInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if body.paint_key and body.paint_key not in VEHICLE_PAINTS:
        raise HTTPException(status_code=400, detail="Pintura inválida")
    if body.paint_key and f"vehicle_paint:{body.paint_key}" not in (player.get("owned_cosmetics") or []):
        raise HTTPException(status_code=400, detail="Não possuis esta pintura")
    vehicle = await db.vehicles.find_one({"_id": _oid(body.vehicle_id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"paint_key": body.paint_key}})
    return {"ok": True}


@router.post("/teams/equip_emblem")
async def equip_team_emblem(body: TeamEquipEmblemInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if body.emblem_key and body.emblem_key not in TEAM_EMBLEMS:
        raise HTTPException(status_code=400, detail="Emblema inválido")
    if body.emblem_key and f"team_emblem:{body.emblem_key}" not in (player.get("owned_cosmetics") or []):
        raise HTTPException(status_code=400, detail="Não possuis este emblema")
    team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": pid})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    await db.teams.update_one({"_id": team["_id"]}, {"$set": {"emblem_key": body.emblem_key}})
    return {"ok": True}


@router.post("/hq/equip_skin")
async def equip_hq_skin(body: HqEquipSkinInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if body.skin_key and body.skin_key not in HQ_SKINS:
        raise HTTPException(status_code=400, detail="Skin inválida")
    if body.skin_key and f"hq_skin:{body.skin_key}" not in (player.get("owned_cosmetics") or []):
        raise HTTPException(status_code=400, detail="Não possuis esta skin")
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"hq_skin_key": body.skin_key}})
    return {"ok": True}
