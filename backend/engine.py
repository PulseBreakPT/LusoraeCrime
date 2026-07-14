import logging
import math
import random
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from game_data import (OPPORTUNITY_TYPES, LISBON_SPOTS, LEVEL_THRESHOLDS, EMP_LEVEL_XP,
                       POLICE_FORCE_REGIONS, POLICE_DEFAULT_FORCE, POLICE_FORCE_EFFECTS,
                       TRAINING_COURSES, PROPERTY_TYPES, VEHICLE_MODELS, SPECIALIZATIONS,
                       BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, CATEGORY_ATTRS, ATTR_KEYS,
                       RARITIES, RARITY_MIN_RESPECT, RANKS, TALENTS, RECRUIT_SOURCES,
                       POOL_REFRESH_MIN, PAYROLL_CYCLE_MIN, random_employee_name,
                       TEAM_LEADER_MIN_RANK, NO_LEADER_PENALTY, SOLO_MEMBER_PENALTY,
                       UNIFORM_SPEC_BONUS, COORDINATION_BONUS_MAX, COORDINATION_RAMP_S,
                       REORG_AFTER_MISSION_S, REORG_AFTER_ROSTER_CHANGE_S, INCOMPLETE_TEAM_PREP_S,
                       TEAM_MAX_MEMBERS, VEHICLE_CONDITION_PENALTY_THRESHOLD,
                       VEHICLE_CONDITION_PENALTY_MAX, VEHICLE_MATCH_BONUS, DISCREET_CATEGORIES,
                       LUXURY_HEAT_MULT, WEAR_KM_RAMP, WEAR_KM_MAX_MULT,
                       NEWBIE_RAMP_S, NEWBIE_PENALTY_MAX, HIGH_MORALE_THRESHOLD, HIGH_MORALE_BONUS,
                       LOW_MORALE_ABSENCE_THRESHOLD, ABSENCE_CHANCE_PER_MIN, ABSENCE_DURATION_S,
                       FULL_ENERGY_FATIGUE_MAX, FULL_ENERGY_XP_BONUS, XP_DECAY_IDLE_DAYS, XP_DECAY_PER_MIN,
                       MEMBER_SPLIT_PENALTY_PER_EXTRA, MEMBER_SPLIT_PENALTY_MAX, AGE_DECAY_MAX,
                       AGE_DECAY_RAMP_S, REPEAT_TYPE_XP_MULT, DURATION_REWARD_BASELINE_S,
                       DURATION_REWARD_MAX_BONUS, DURATION_REWARD_MAX_MALUS, DURATION_REWARD_FLOOR_S,
                       DURATION_REWARD_CEIL_S, FAILED_TYPE_COOLDOWN_MIN, RECALL_PENALTY_FRACTION,
                       RECALL_PENALTY_HEAT, RECALL_PENALTY_FATIGUE,
                       PROPERTY_MAINTENANCE_PCT_PER_DAY, PROPERTY_CONDITION_RECOVERY_PER_HOUR,
                       PROPERTY_CONDITION_DECAY_PER_HOUR, PROPERTY_UPGRADE_BASE_S,
                       PROPERTY_UPGRADE_PER_LEVEL_S, HIDEOUT_PREP_REDUCTION_PER_LEVEL,
                       LAUNDER_PROPERTY_BONUS_PER_LEVEL,
                       DIRTY_MONEY_HEAT_THRESHOLD, DIRTY_MONEY_HEAT_PER_10K, TEAM_COST_SCALING_BASE,
                       PAYROLL_MORALE_REGEN,
                       LOW_LEVEL_XP_GAP, LOW_LEVEL_XP_MULT_PER_GAP, LOW_LEVEL_XP_MULT_MIN,
                       TEAM_COUNT_BASE, TEAM_COUNT_PER_2_LEVELS, ACHIEVEMENT_MILESTONES,
                       ACHIEVEMENT_BONUS_PCT_PER_MILESTONE, LOCAL_PRESENCE_RADIUS_KM,
                       LOCAL_PRESENCE_PREP_REDUCTION_S, LOCAL_PRESENCE_PREP_REDUCTION_MAX_S,
                       TRAFFIC_DELAY_CHANCE, TRAFFIC_DELAY_MAX_PCT, UNEXPECTED_REPAIR_CHANCE_PER_RISK,
                       UNEXPECTED_REPAIR_CONDITION_HIT, EXCEPTIONAL_PERFORMANCE_CHANCE,
                       EXCEPTIONAL_PERFORMANCE_XP_BONUS_PCT, BONUS_LOOT_CHANCE, BONUS_LOOT_MAX_PCT,
                       WEAR_PER_MISSION_SINCE_REPAIR, WEAR_MISSIONS_SINCE_REPAIR_CAP,
                       EMPLOYEE_HEAVY_USE_THRESHOLD, EMPLOYEE_HEAVY_USE_FATIGUE_MULT,
                       RAIN_CHANCE, RAIN_TRAVEL_MULT, NIGHT_STEALTH_HOURS, NIGHT_STEALTH_BONUS,
                       PROPERTY_STACK_DIMINISH, DIRTY_MONEY_CAP_BASE, DIRTY_MONEY_CAP_PER_LEVEL,
                       REFUEL_DURATION_BASE_S, REFUEL_DURATION_PER_L_S,
                       FUEL_PRICES,
                       HQ_MAX_LEVEL, HQ_LEVEL_BENEFITS,
                       WEAPON_MODELS, WEAPON_CATEGORY_WEIGHTS,
                       WEAPON_COMBAT_SCORE_SCALE, WEAPON_BONUS_MIN, WEAPON_BONUS_MAX,
                       WEAPON_COMPATIBILITY_MIN_FACTOR, WEAPON_PROFICIENCY_MAX,
                       WEAPON_PROFICIENCY_BONUS_MAX_PCT, WEAPON_PROFICIENCY_GAIN_PER_MISSION,
                       WEAPON_WEAR_PER_MISSION, WEAPON_WEAR_RISK_MULT, WEAPON_LOUD_HEAT_MULT,
                       VEHICLE_CATEGORY_WEIGHTS, MISSION_FACTOR_WEIGHTS, DIMENSION_SWING_CAP,
                       LOYALTY_BONUS_MAX, LOYALTY_PENALTY_MAX, HQ_CHANCE_BONUS_PER_LEVEL,
                       INCOMPLETE_CREW_PENALTY_PER_MISSING, INCOMPLETE_CREW_PENALTY_MAX,
                       VEHICLE_MISMATCH_PENALTY, WEAPON_MISMATCH_PENALTY_MAX,
                       VEHICLE_TRANSFER_COST_PER_KM, VEHICLE_TRANSFER_COST_MIN,
                       VEHICLE_TRANSFER_DURATION_BASE_S, VEHICLE_TRANSFER_DURATION_PER_KM_S,
                       PROPERTY_INFLUENCE_RADIUS_KM, PROPERTY_SPOT_WEIGHT, LISBON_SPOT_WEIGHT,
                       SPAWN_HQ_FALLOFF_KM,
                       VIP_INCOME_MULT, VIP_HEAT_RELIEF_MULT, VIP_REFUEL_SPEED_MULT,
                       CHANCE_FLOOR, CHANCE_CEILING, CHANCE_SOFT_KNEE, CHANCE_SOFT_SPAN,
                       RISK_PENALTY_LINEAR, RISK_PENALTY_QUADRATIC,
                       PRIMARY_ATTR_WEIGHT_MAIN, PRIMARY_ATTR_WEIGHT_SECONDARY,
                       MENTOR_MIN_RANK, MENTOR_NEWBIE_RELIEF,
                       FATIGUE_CURVE_EXP, MORALE_PENALTY_ASYMMETRY,
                       TEAM_SYNERGY_MAX, TEAM_SYNERGY_BASELINE, TEAM_SYNERGY_SPREAD,
                       STEALTH_SYNERGY_BONUS, STEALTH_SYNERGY_PENALTY,
                       STEALTH_VEHICLE_DISCRETION_MIN, NOISY_VEHICLE_DISCRETION_MAX,
                       WEAPON_SKILL_FLOOR, WEAPON_SKILL_ATTR_CAP,
                       WEAPON_DURABILITY_WEAR_REF, WEAPON_CONDITION_SOFT_KNEE,
                       WEAPON_JAM_RELIABILITY_WEIGHT, WEAPON_JAM_CONDITION_THRESHOLD,
                       WEAPON_JAM_CONDITION_WEIGHT, WEAPON_JAM_MAX,
                       WEAPON_JAM_CHANCE_PENALTY, WEAPON_JAM_CHANCE_PENALTY_CAP,
                       WEAPON_JAM_EXTRA_WEAR,
                       WEAPON_INTIMIDATION_ESCAPE_MAX, WEAPON_STEALTH_DISCRETION_REF,
                       VEHICLE_SPEED_FLOOR, VEHICLE_SPEED_CURVE_EXP,
                       VEHICLE_WEAR_BASE, VEHICLE_WEAR_PER_RISK, VEHICLE_WEAR_PER_KM,
                       ESCAPE_SPEED_BASELINE, ESCAPE_SPEED_BONUS_PER_UNIT, ESCAPE_SPEED_BONUS_MAX,
                       CHASE_DISCRETION_RELIEF, CHASE_HEAT_SPAN, CHASE_HEAT_EXP,
                       ESCAPE_HEAT_SPAN, ESCAPE_HEAT_EXP,
                       POLICE_PROB_BASE, POLICE_PROB_SPAN, POLICE_PROB_EXP, POLICE_PROB_CAP,
                       HEAT_DECAY_BASE_PER_MIN, HEAT_DECAY_SLOPE)
from economy_constants import (
    DISTRICT_ATTENTION_MAX, DISTRICT_ATTENTION_SUCCESS, DISTRICT_ATTENTION_PARTIAL,
    DISTRICT_ATTENTION_FAILURE, DISTRICT_ATTENTION_POLICE, DISTRICT_ATTENTION_PER_RISK,
    DISTRICT_ATTENTION_DECAY_PER_MIN, DISTRICT_ATTENTION_PENALTY_MAX,
    DISTRICT_ATTENTION_CHASE_MAX, DISTRICT_ATTENTION_SPAWN_MIN_W, DISTRICT_ATTENTION_HOT,
    TEAM_MOMENTUM_BONUS_PER_WIN, TEAM_MOMENTUM_BONUS_MAX,
    TEAM_MOMENTUM_PENALTY_PER_LOSS, TEAM_MOMENTUM_PENALTY_MAX,
    TEAM_MOMENTUM_ESCAPE_BONUS_MAX,
    PARTIAL_SUCCESS_WINDOW, PARTIAL_REWARD_MIN, PARTIAL_REWARD_MAX,
    PARTIAL_RESPECT_FRACTION, PARTIAL_HEAT_MULT, PARTIAL_XP_FRACTION, PARTIAL_CHASE_MULT,
    RARE_PITY_PER_SPAWN, RARE_PITY_CAP, SPAWN_DEMAND_SPEC_BOOST, SPAWN_DEMAND_BOOST_MAX,
    SPAWN_ANTIFARM_PENALTY_PER, SPAWN_ANTIFARM_PENALTY_MAX,
    STREAK_SPECIAL_THRESHOLD, STREAK_SPECIAL_REWARD_MULT,
    TEAM_FAMILIARITY_BONUS_MAX, TEAM_FAMILIARITY_RAMP_MISSIONS, TEAM_FAMILIARITY_MIN_MISSIONS,
    COORDINATION_RAMP_MISSIONS,
    DRIVER_ATTR_BASELINE, DRIVER_ESCAPE_BONUS_PER_POINT, DRIVER_ESCAPE_BONUS_MAX,
    STRATEGIST_MIN_INT, STRATEGIST_RELIEF_FRAC, STRATEGIST_RELIEF_MAX,
    MEDIC_INJURY_MULT, MEDIC_RECOVERY_MULT, LAWYER_ARREST_MULT,
    CLUTCH_SAVE_MAX, SMART_WARN_HEAT_DELTA,
)
from quests import process_quests, make_instance, effective_quest_rewards
from live_ops import build_return_script, update_memory
from quests_data import QUEST_DEFS

logger = logging.getLogger(__name__)

OUTCOME_PT = {"success": "sucesso", "partial": "sucesso parcial", "failure": "falhou",
              "police": "intercetado pela polícia"}
REST_DURATION_S = 90


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
            "by_category": {}, "success_by_category": {}, "high_value_ops": 0, "ops_dispatched": 0,
            "recruits_hired": 0, "recruits_informador": 0, "trainings_completed": 0,
            "employees_promoted": 0, "employees_rested": 0, "bonuses_paid": 0,
            "vehicles_bought": 0, "vehicles_repaired": 0, "vehicles_refueled": 0,
            "properties_bought": 0, "properties_upgraded": 0, "teams_created": 0,
            "bribes_paid": 0, "raids_survived": 0}


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
        "property_id": None, "transfer": None,
    }


# ---------------- Bónus da organização ----------------

ACTIVE_FOR_PASSIVE = ("idle", "resting", "training", "on_mission")


def org_bonuses(employees):
    b = {"repair_discount": 0.0, "rare_opp": 0.0, "heal": 0.0, "legal": 0.0,
         "launder_rate": 0.0, "empresa_boost": 0.0, "bribe_discount": 0.0, "lab_boost": 0.0}
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
            elif t == "maos_de_seda":
                b["heal"] += 0.15
            elif t == "formula_secreta":
                b["lab_boost"] += 0.15
    caps = {"repair_discount": 0.5, "rare_opp": 0.3, "heal": 0.6, "legal": 0.6,
            "launder_rate": 0.2, "empresa_boost": 0.75, "bribe_discount": 0.4, "lab_boost": 0.6}
    return {k: round(min(v, caps[k]), 3) for k, v in b.items()}


async def get_org_bonuses(db, pid):
    employees = await db.employees.find({"player_id": pid}).to_list(300)
    return org_bonuses(employees)


async def get_caps(db, pid, hq_level=1):
    props = await db.properties.find({"player_id": pid}).to_list(200)
    hq_tier = HQ_LEVEL_BENEFITS[min(hq_level, HQ_MAX_LEVEL) - 1]
    emp_cap = (BASE_EMPLOYEE_CAP + hq_tier["cap_employees"]
               + sum(PROPERTY_TYPES[p["type_key"]].get("cap_employees", 0) * p["level"] for p in props))
    veh_cap = (BASE_VEHICLE_CAP + hq_tier["cap_vehicles"]
               + sum(PROPERTY_TYPES[p["type_key"]].get("cap_vehicles", 0) * p["level"] for p in props))
    # Slots extra da loja (comprados com dinheiro do jogo) — teto fixo somado,
    # sem tocar na assinatura nem nos pontos de chamada existentes.
    slots = await db.players.find_one(
        {"_id": ObjectId(pid)}, {"extra_vehicle_slots": 1, "extra_employee_slots": 1}
    ) or {}
    emp_cap += slots.get("extra_employee_slots", 0) or 0
    veh_cap += slots.get("extra_vehicle_slots", 0) or 0
    return {"employees": emp_cap, "vehicles": veh_cap}, props


async def get_property_vehicle_usage(db, pid, hq_level=1):
    """Capacidade de veículos por base (propriedade ou QG), independente do
    limite global de get_caps (que continua a ser o tecto aplicado na
    compra). Devolve {'hq'|property_id: {'used','max','type_key'}} — o
    somatório de todos os 'max' aqui é sempre igual ao veh_cap global de
    get_caps para o mesmo jogador."""
    props = await db.properties.find({"player_id": pid}).to_list(200)
    vehicles = await db.vehicles.find({"player_id": pid}).to_list(100)
    hq_tier = HQ_LEVEL_BENEFITS[min(hq_level, HQ_MAX_LEVEL) - 1]
    usage = {"hq": {"used": 0, "max": BASE_VEHICLE_CAP + hq_tier["cap_vehicles"], "type_key": "hq"}}
    for p in props:
        usage[str(p["_id"])] = {
            "used": 0,
            "max": PROPERTY_TYPES[p["type_key"]].get("cap_vehicles", 0) * p["level"],
            "type_key": p["type_key"],
        }
    for v in vehicles:
        key = v.get("property_id") or "hq"
        if key not in usage:
            key = "hq"
        usage[key]["used"] += 1
    return usage


async def resolve_mission_origin(db, player, vehicle):
    """Ponto de partida actual do veículo (e por isso da sua equipa) — usado
    tanto para o cálculo de ETA/distância como para o snapshot Mission.origin.
    Cai para o QG quando o veículo não tem propriedade atribuída (property_id
    None), cobrindo da mesma forma 'nunca atribuído' e veículos antigos
    anteriores a esta funcionalidade."""
    prop_id = vehicle.get("property_id")
    if prop_id:
        prop = await db.properties.find_one({"_id": ObjectId(prop_id), "player_id": str(player["_id"])})
        if prop:
            return {"lat": prop["lat"], "lng": prop["lng"], "property_id": prop_id}
    hq = player["hq"]
    return {"lat": hq["lat"], "lng": hq["lng"], "property_id": None}


async def add_event(db, player_id, kind, message):
    await db.events.insert_one({
        "player_id": player_id, "kind": kind, "message": message,
        "ts": now_utc().isoformat(),
    })


async def record_tx(db, player_id, kind, amount, currency, balance_after, note):
    """Regista uma transação no extrato — todo o dinheiro que entra ou sai
    fica com um registo consultável, mesmo que o evento em si já exista."""
    await db.transactions.insert_one({
        "player_id": player_id, "kind": kind, "amount": amount, "currency": currency,
        "balance_after": balance_after, "note": note, "ts": now_utc().isoformat(),
    })


async def _unlink_employee_weapon(db, emp_id):
    """Ao contrário do veículo (só ligado a Team, nunca a Employee), a arma
    tem uma ligação bidireccional directa com o funcionário. Chamado em todos
    os sítios que apagam um Employee (despedimento, deserção, traição) para
    nunca deixar `weapon.employee_id` a apontar para um funcionário já
    inexistente — nenhum destes sítios exige o funcionário `idle`, e um
    funcionário `idle` pode perfeitamente ter uma arma equipada."""
    await db.weapons.update_many({"employee_id": str(emp_id)}, {"$set": {"employee_id": None}})


def property_stack_ranks(props):
    """Ordem (0-based) de cada propriedade entre as do mesmo tipo, pela data de
    compra — a mais antiga de cada tipo é a 1ª (bónus cheio), as seguintes
    rendem menos. Devolve um dict {id_da_propriedade: ordem}."""
    by_type = {}
    for p in props:
        by_type.setdefault(p["type_key"], []).append(p)
    ranks = {}
    for group in by_type.values():
        for i, p in enumerate(sorted(group, key=lambda p: p.get("bought_at") or "")):
            ranks[p["_id"]] = i
    return ranks


def property_stack_mult(rank):
    """Rendimentos decrescentes: a 1ª unidade de um tipo de propriedade dá o
    bónus percentual cheio, a 2ª menos, a 3ª+ ainda menos — em vez de proibir
    ter várias, cada uma extra vale menos."""
    idx = min(rank, len(PROPERTY_STACK_DIMINISH) - 1)
    return PROPERTY_STACK_DIMINISH[idx]


def dirty_money_cap(level):
    """Limite de armazenamento de dinheiro sujo — acima disto, o excesso
    produzido é desperdiçado (por isso vale a pena lavar regularmente)."""
    return DIRTY_MONEY_CAP_BASE + DIRTY_MONEY_CAP_PER_LEVEL * max(0, level - 1)


async def push_history(db, emp_id, text):
    await db.employees.update_one({"_id": emp_id}, {"$push": {
        "history": {"$each": [{"ts": now_utc().isoformat(), "text": text}], "$slice": -12},
    }})


# Validação geográfica real: polígono oficial de Portugal (continente +
# Madeira + Açores) + exclusão dos grandes corpos de água interiores com
# geometria OSM (estuários do Tejo/Sado/Douro, rias de Aveiro/Formosa,
# Alqueva, lagoas). Substitui a antiga aproximação da margem do Tejo.
from geo import is_on_land_pt


def is_on_land(lat, lng):
    """Terra firme portuguesa — fora do mar, dos estuários e do estrangeiro."""
    return is_on_land_pt(lat, lng)


def _sample_on_land(spot):
    """Sample a nearby (lat,lng) around a Lisbon spot that stays on land. Falls back to
    the spot itself if all attempts land in the river."""
    for _ in range(10):
        lat = spot["lat"] + random.uniform(-0.008, 0.008)
        lng = spot["lng"] + random.uniform(-0.010, 0.010)
        if is_on_land(lat, lng):
            return lat, lng
    return spot["lat"], spot["lng"]


def nearest_district(lat, lng, spots=None):
    """Rótulo de zona mais próxima (só para exibição/fallback) para um ponto
    escolhido manualmente pelo jogador — não é uma chave estrangeira. Usa as
    zonas geradas à volta do QG do jogador; cai nas de Lisboa se em falta."""
    pool = [s for s in (spots or LISBON_SPOTS) if s.get("name")]
    if not pool:
        pool = LISBON_SPOTS
    return min(pool, key=lambda s: haversine_m(lat, lng, s["lat"], s["lng"]))["name"]


# Metros por grau de latitude — MESMA constante do frontend (choreo.js M_LAT),
# para a classificação equirectangular do backend bater exatamente com a da
# simulação visual (police.js distMeters), sem discrepâncias na fronteira.
_M_LAT = 111320.0


def _equirect_m(lat1, lng1, lat2, lng2):
    """Distância planar equirectangular em metros — réplica de distMeters em
    frontend/src/lib/choreo.js (não haversine), para paridade exata na
    classificação de força PSP/GNR entre backend e frontend."""
    east = (lng2 - lng1) * _M_LAT * math.cos(math.radians((lat1 + lat2) / 2))
    north = (lat2 - lat1) * _M_LAT
    return math.hypot(east, north)


def police_force_for(lat, lng):
    """Força de segurança competente pela zona de um ponto (PSP urbana / GNR
    rural). Um ponto dentro do raio de uma região PSP → essa força (a mais
    próxima ganha); caso contrário → POLICE_DEFAULT_FORCE. Genérico para N
    forças: acrescentar regiões a POLICE_FORCE_REGIONS chega. Espelha
    forceFor() em frontend/src/lib/police.js."""
    best = None
    bd = float("inf")
    for c in POLICE_FORCE_REGIONS:
        d = _equirect_m(lat, lng, c["lat"], c["lng"])
        if d <= c["r"] and d < bd:
            bd = d
            best = c
    return best["force"] if best else POLICE_DEFAULT_FORCE


def _sample_around_property(center_lat, center_lng, radius_km):
    """Amostragem uniforme num disco de raio configurável à volta de uma
    propriedade — distinta de _sample_on_land (caixa fixa em torno de um
    spot de Lisboa), já que aqui o raio é uma variável de jogo."""
    for _ in range(10):
        r = radius_km * math.sqrt(random.random())
        theta = random.uniform(0, 2 * math.pi)
        dlat = (r / 111.0) * math.cos(theta)
        dlng = (r / (111.0 * math.cos(math.radians(center_lat)))) * math.sin(theta)
        lat, lng = center_lat + dlat, center_lng + dlng
        if is_on_land(lat, lng):
            return lat, lng
    return center_lat, center_lng


def _property_spawn_weight(prop, all_props):
    """Peso de spawn de uma propriedade como centro de missões — dividido
    pela densidade de propriedades vizinhas, para que bases agrupadas não
    empilhem peso e bases isoladas mantenham cobertura total."""
    nearby = sum(
        1 for other in all_props
        if other["_id"] != prop["_id"]
        and haversine_m(prop["lat"], prop["lng"], other["lat"], other["lng"]) / 1000 <= PROPERTY_INFLUENCE_RADIUS_KM
    )
    return PROPERTY_SPOT_WEIGHT / (1 + nearby)


# ---------------- Oportunidades ----------------

def distance_risk_bump(dist_km):
    """Risco extra por operações longe do QG. Os spots reais de Lisboa vão de
    ~0.3 a 8.2km do QG; só o anel exterior (Benfica/Lumiar/P.Nações, >=6km)
    atinge o bónus +2."""
    if dist_km >= 6.0:
        return 2
    if dist_km >= 3.0:
        return 1
    return 0


def distance_reward_mult(dist_km):
    """+6% de recompensa por km de distância ao QG, capado a +50%
    (cap atingido só pelo ponto mais distante, ~8.3km)."""
    return 1 + min(0.50, 0.06 * dist_km)


def min_members_for(risk):
    """Nº mínimo de membros na equipa para poder despachar, com base no
    risco final (1-5) da oportunidade."""
    return max(1, risk - 1)


HOT_CATEGORY_ROTATION = ["assalto", "logistica", "tecnica", "influencia", "especial"]
HOT_CATEGORY_REWARD_MULT = 1.20


def hot_category(now):
    """Mercado dinâmico: a cada 6 horas há uma categoria "em alta" cujas
    oportunidades nascem com +20% de recompensa. Rotação determinística
    global (dia do ano + bloco de 6h), igual para todos os jogadores."""
    idx = (now.timetuple().tm_yday * 4 + now.hour // 6) % len(HOT_CATEGORY_ROTATION)
    return HOT_CATEGORY_ROTATION[idx]


def achievement_bonus_pct(missions_success):
    """Conquistas permanentes: bónus de recompensa que nunca desaparece,
    concedido por cada marco de missões bem-sucedidas atingido."""
    reached = sum(1 for milestone in ACHIEVEMENT_MILESTONES if missions_success >= milestone)
    return round(reached * ACHIEVEMENT_BONUS_PCT_PER_MILESTONE, 4)


def max_teams_for(level):
    """Nº máximo de equipas que a organização pode ter, crescente com o nível."""
    return TEAM_COUNT_BASE + ((max(1, level) - 1) // 2) * TEAM_COUNT_PER_2_LEVELS


def duration_reward_mult(duration_s):
    """Operações mais longas pagam melhor por minuto do que operações muito
    rápidas — neutro aos 90s, até +15% aos 300s e até -10% aos 30s."""
    baseline = DURATION_REWARD_BASELINE_S
    if duration_s >= baseline:
        span = max(1, DURATION_REWARD_CEIL_S - baseline)
        return 1 + DURATION_REWARD_MAX_BONUS * min(1.0, (duration_s - baseline) / span)
    span = max(1, baseline - DURATION_REWARD_FLOOR_S)
    return 1 - DURATION_REWARD_MAX_MALUS * min(1.0, (baseline - duration_s) / span)


def hour_allowed(type_key, now):
    """Algumas oportunidades só aparecem em certas horas do dia (UTC)."""
    hours = OPPORTUNITY_TYPES[type_key].get("hours")
    if not hours:
        return True
    start, end = hours
    h = now.hour
    if start <= end:
        return start <= h < end
    return h >= start or h < end  # intervalo que atravessa a meia-noite


def age_decay_mult(age_s):
    """Quanto mais tempo uma oportunidade fica disponível por reclamar, menor
    a recompensa — até -20% ao fim de ~8 minutos."""
    return max(1 - AGE_DECAY_MAX, 1 - AGE_DECAY_MAX * min(1.0, age_s / AGE_DECAY_RAMP_S))


def member_split_mult(members_count, min_members):
    """Levar mais membros do que o mínimo exigido divide o saque — pequena
    redução de recompensa por cada membro extra."""
    extra = max(0, members_count - min_members)
    return 1 - min(MEMBER_SPLIT_PENALTY_MAX, MEMBER_SPLIT_PENALTY_PER_EXTRA * extra)


def local_presence_reduction_s(nearby_active_count):
    """Ter outras equipas já em ação perto do alvo reduz ligeiramente o tempo
    de preparação/viagem — a organização já conhece a zona."""
    return min(LOCAL_PRESENCE_PREP_REDUCTION_MAX_S, LOCAL_PRESENCE_PREP_REDUCTION_S * nearby_active_count)


def apply_dirty_money_heat(player, hours):
    """Acumular demasiado dinheiro sujo atrai atenção — gera calor extra."""
    if hours <= 0:
        return
    excess = player.get("dirty_money", 0) - DIRTY_MONEY_HEAT_THRESHOLD
    if excess <= 0:
        return
    extra_heat = (excess / 10000) * DIRTY_MONEY_HEAT_PER_10K * hours
    player["heat"] = min(100.0, player["heat"] + extra_heat)


async def spawn_opportunities(db, player, props, rare_chance=0.0):
    now = now_utc()
    pid = str(player["_id"])
    active = await db.opportunities.count_documents({
        "player_id": pid, "status": "active", "expires_at": {"$gt": now.isoformat()},
    })
    level = player["level"]
    target = min(5 + level * 2, 14)
    cooldowns = player.get("type_cooldowns") or {}
    keys = [
        k for k, v in OPPORTUNITY_TYPES.items()
        if v["min_level"] <= level and hour_allowed(k, now)
        and not (cooldowns.get(k) and parse_dt(cooldowns[k]) > now)
    ]
    if not keys:
        return
    # Spawn Director (SSS v3): o mix de tipos deixa de ser cego —
    # 1) procura: categorias em que o jogador TEM equipas especializadas pesam
    #    mais (conteúdo acionável), sem nunca zerar as restantes (exploração);
    # 2) anti-farm: tipos despachados repetidamente há pouco tempo perdem peso.
    teams = await db.teams.find({"player_id": pid}).to_list(50)
    spec_counts = {}
    for tm in teams:
        sp = tm.get("spec")
        if sp:
            spec_counts[sp] = spec_counts.get(sp, 0) + 1
    recent_counts = {}
    for k in (player.get("recent_type_keys") or []):
        recent_counts[k] = recent_counts.get(k, 0) + 1
    weights = []
    for k in keys:
        w = float(OPPORTUNITY_TYPES[k]["weight"])
        n_spec = spec_counts.get(OPPORTUNITY_TYPES[k]["category"], 0)
        if n_spec:
            w *= 1 + min(SPAWN_DEMAND_BOOST_MAX, SPAWN_DEMAND_SPEC_BOOST * n_spec)
        if recent_counts.get(k):
            w *= 1 - min(SPAWN_ANTIFARM_PENALTY_MAX, SPAWN_ANTIFARM_PENALTY_PER * recent_counts[k])
        weights.append(max(0.05, w))
    hq = player["hq"]
    # Centros candidatos: as zonas de operação geradas à volta do QG do
    # jogador (apenas as já batizadas com nomes reais — nunca mostramos nomes
    # inventados) mais um centro sintético por propriedade possuída (peso
    # maior, atenuado por densidade local). Zonas com atenção policial
    # acumulada recebem menos oportunidades — o crime desloca-se para onde a
    # polícia não está. Jogadores antigos (pré-migração) caem nas zonas de Lisboa.
    district_spots = [d for d in (player.get("districts") or LISBON_SPOTS) if d.get("named", True) and d.get("name")]
    att_map = player.get("district_attention") or {}

    def _att_weight(name):
        att = float(att_map.get(attention_key(name), 0.0))
        return max(DISTRICT_ATTENTION_SPAWN_MIN_W,
                   1 - (att / DISTRICT_ATTENTION_MAX) * (1 - DISTRICT_ATTENTION_SPAWN_MIN_W))

    def _dist_weight(lat, lng):
        # Enviesa a escolha de centro para perto do QG sem eliminar o longe:
        # peso ∝ 1/(1 + d/D0). Um centro a SPAWN_HQ_FALLOFF_KM recebe metade do
        # peso de um colado ao QG. Só afeta a probabilidade de escolha — o
        # alcance espacial e o risco/recompensa por distância ficam intactos.
        d_km = haversine_m(hq["lat"], hq["lng"], lat, lng) / 1000
        return 1.0 / (1.0 + d_km / SPAWN_HQ_FALLOFF_KM)

    centers = [(spot, LISBON_SPOT_WEIGHT * _att_weight(spot["name"]) * _dist_weight(spot["lat"], spot["lng"]), None) for spot in district_spots]
    for p in props:
        centers.append(({"name": p["name"], "lat": p["lat"], "lng": p["lng"]},
                         _property_spawn_weight(p, props) * _att_weight(p["name"]), str(p["_id"])))
    if not centers:
        # QG acabado de colocar e nenhuma zona batizada ainda — o batismo em
        # background termina em segundos; sem centros não há onde gerar missões.
        return
    center_weights = [w for _, w, _ in centers]
    # Pity de raras (SSS v3): cada spawn sem uma oportunidade rara acumula um
    # pequeno bónus de probabilidade — a sorte nunca seca indefinidamente.
    spawns_since_rare = int(player.get("spawns_since_rare", 0) or 0)
    eff_rare_chance = min(RARE_PITY_CAP, rare_chance + RARE_PITY_PER_SPAWN * spawns_since_rare)

    def _build_doc(key, rare, extra_mult=1.0, special=False, expires_range=(240, 600)):
        t = OPPORTUNITY_TYPES[key]
        spot, _, origin_prop_id = random.choices(centers, weights=center_weights)[0]
        duration_s = random.randint(*t["duration_s"])
        mult = (1 + 0.30 * (level - 1)) * random.uniform(0.8, 1.35) * duration_reward_mult(duration_s) * extra_mult
        if rare:
            mult *= 2.0
        if origin_prop_id:
            lat, lng = _sample_around_property(spot["lat"], spot["lng"], PROPERTY_INFLUENCE_RADIUS_KM)
        else:
            lat, lng = _sample_on_land(spot)
        # Risco/recompensa por distância continuam medidos a partir do QG —
        # é uma fórmula de equilíbrio já afinada, distinta da distância de
        # despacho (essa sim, resolvida por resolve_mission_origin).
        dist_km = haversine_m(hq["lat"], hq["lng"], lat, lng) / 1000
        risk = min(5, t["risk"] + distance_risk_bump(dist_km))
        mult *= distance_reward_mult(dist_km)
        # Mercado dinâmico: a categoria em alta nasce com +20% de recompensa.
        is_hot = t["category"] == hot_category(now)
        if is_hot:
            mult *= HOT_CATEGORY_REWARD_MULT
        return {
            "player_id": pid, "type_key": key,
            "name": (f"Golpe de Oportunidade: {t['name']}" if special else t["name"]),
            "category": t["category"], "district": spot["name"],
            "lat": lat,
            "lng": lng,
            "dist_km": round(dist_km, 2),
            "reward": int(t["base_reward"] * mult),
            "respect": int(t["respect"] * (1 + 0.15 * (level - 1)) * (1.5 if rare else 1.0)),
            "risk": risk, "heat": t["heat"], "pays": t["pays"], "rare": rare, "hot": is_hot,
            "special": special,
            "required_models": t.get("required_models", []),
            "duration_s": duration_s,
            "min_level": t["min_level"], "min_members": min_members_for(risk),
            "status": "active",
            "expires_at": (now + timedelta(seconds=random.randint(*expires_range))).isoformat(),
            "created_at": now.isoformat(),
            "generated_by_property_id": origin_prop_id,
            # Força competente pela zona (PSP urbana / GNR rural) — afeta risco,
            # perseguição e fuga, e diz à simulação qual força deve responder.
            "police_force": police_force_for(lat, lng),
        }

    docs = []
    player_updates = {}
    # Reação do mundo à série de vitórias: um Golpe de Oportunidade especial —
    # o tipo mais valioso disponível, rara garantida e recompensa amplificada.
    if player.get("streak_op_pending"):
        best_key = max(keys, key=lambda k: OPPORTUNITY_TYPES[k]["base_reward"])
        special_doc = _build_doc(best_key, rare=True, extra_mult=STREAK_SPECIAL_REWARD_MULT,
                                 special=True, expires_range=(480, 720))
        docs.append(special_doc)
        player["streak_op_pending"] = False
        player_updates["streak_op_pending"] = False
        await add_event(db, pid, "intel",
                        f"GOLPE DE OPORTUNIDADE: {special_doc['name']} em {special_doc['district']} — recompensa excecional, janela curta.")
    rare_spawned = False
    for _ in range(max(0, target - active)):
        key = random.choices(keys, weights=weights)[0]
        rare = random.random() < eff_rare_chance
        rare_spawned = rare_spawned or rare
        docs.append(_build_doc(key, rare))
    n_regular = max(0, target - active)
    if n_regular > 0:
        new_since = 0 if rare_spawned else spawns_since_rare + n_regular
        if new_since != spawns_since_rare:
            player["spawns_since_rare"] = new_since
            player_updates["spawns_since_rare"] = new_since
    if player_updates:
        await db.players.update_one({"_id": player["_id"]}, {"$set": player_updates})
    if docs:
        await db.opportunities.insert_many(docs)


# ---------------- Combate / resolução ----------------

def effective_speed(vehicle):
    """Física contínua (SSS v2): a condição afeta a velocidade em curva suave
    em vez do antigo degrau nos 50% — um veículo a 65% já se ressente, um a
    100% rende o máximo. floor + span*(condição/100)^exp, com o mesmo mínimo
    de sempre (60%) a condição 0."""
    c = max(0.0, min(100.0, vehicle["condition"]))
    factor = VEHICLE_SPEED_FLOOR + (1 - VEHICLE_SPEED_FLOOR) * (c / 100) ** VEHICLE_SPEED_CURVE_EXP
    return vehicle["speed"] * factor


BASE_CHANCE = 0.92


def _dim_scale(category, dim):
    """Peso final de uma dimensão (team/vehicle/weapon/environment) para esta
    categoria de missão: tecto de oscilação da dimensão (DIMENSION_SWING_CAP)
    * peso da categoria nessa dimensão (MISSION_FACTOR_WEIGHTS, game_data.py).
    A ponderação interna de cada dimensão (CATEGORY_ATTRS, WEAPON_CATEGORY_WEIGHTS,
    VEHICLE_CATEGORY_WEIGHTS) já faz a maior parte do trabalho de "esta
    categoria valoriza X" — este peso exterior é deliberadamente mais estreito
    para não duplicar esse sinal (ver comentário em MISSION_FACTOR_WEIGHTS)."""
    weights = MISSION_FACTOR_WEIGHTS.get(category, MISSION_FACTOR_WEIGHTS["especial"])
    return DIMENSION_SWING_CAP.get(dim, 0.0) * weights.get(dim, 0.0)


def _weighted_category_attr(attrs, aks):
    """Atributo relevante ponderado (SSS v2): o 1º atributo da categoria pesa
    PRIMARY_ATTR_WEIGHT_MAIN, o 2º PRIMARY_ATTR_WEIGHT_SECONDARY — um
    assaltante vive do tiro, a força é apoio. Fallback para média simples em
    categorias sem exatamente 2 atributos definidos."""
    if aks and len(aks) == 2:
        return attrs.get(aks[0], 2) * PRIMARY_ATTR_WEIGHT_MAIN + attrs.get(aks[1], 2) * PRIMARY_ATTR_WEIGHT_SECONDARY
    if aks:
        return sum(attrs.get(a, 2) for a in aks) / len(aks)
    return sum(attrs.values()) / max(1, len(attrs)) if attrs else 2


def _has_mentor(members):
    """Há um veterano (ou superior) na equipa? Mentores encurtam a adaptação
    dos recém-contratados (ver MENTOR_NEWBIE_RELIEF)."""
    try:
        mentor_idx = RANKS.index(MENTOR_MIN_RANK)
    except ValueError:
        return False
    return any(RANKS.index(e["rank"]) >= mentor_idx for e in members if e.get("rank") in RANKS)


def team_effectiveness(members, category, now=None):
    """Score de competência da equipa usado pela mecânica de perseguição
    policial pós-sucesso (_compute_chase_chance/_compute_escape_chance) —
    NÃO alimenta chance_breakdown (que decompõe a equipa nos seus próprios
    modificadores nomeados, mod_team_*, para dar transparência ao jogador)."""
    now = now or now_utc()
    mentor = _has_mentor(members)

    def eff(e):
        attrs = e.get("attrs") or {}
        aks = CATEGORY_ATTRS.get(category)
        attr = _weighted_category_attr(attrs, aks)
        match = e.get("spec") == category or category == "especial"
        morale = e.get("morale", 70)
        morale_f = 0.75 + morale / 400
        if morale >= HIGH_MORALE_THRESHOLD:
            morale_f += HIGH_MORALE_BONUS
        try:
            rank_f = 1 + 0.02 * RANKS.index(e.get("rank", "recruta"))
        except ValueError:
            rank_f = 1.0
        # Recém-contratados ainda se estão a adaptar — pequena penalização que
        # desvanece nas primeiras horas ao serviço (mais depressa com mentor).
        newbie_f = 1.0
        hired_at = e.get("hired_at")
        if hired_at:
            elapsed_s = max(0.0, (now - parse_dt(hired_at)).total_seconds())
            newbie_pen = NEWBIE_PENALTY_MAX * max(0.0, 1 - min(1.0, elapsed_s / NEWBIE_RAMP_S))
            newbie_f -= newbie_pen * (MENTOR_NEWBIE_RELIEF if mentor else 1.0)
        return (e["level"] * 0.5 + attr * 0.45) * (1.25 if match else 1.0) * (1 - e["fatigue"] / 250) * morale_f * rank_f * newbie_f
    return sum(eff(e) for e in members) / len(members) + 0.3 * (len(members) - 1)


def vehicle_mission_score(model, category):
    """Combina velocidade e discrição do veículo (propriedades fixas do
    modelo) num score 0-1 ponderado pela categoria da missão
    (VEHICLE_CATEGORY_WEIGHTS, game_data.py) — mirror exacto de
    weapon_combat_score, mesma filosofia: nenhum veículo é "sempre melhor",
    só mais adequado a certas operações. A adequação de lugares depende do
    tamanho da equipa e é avaliada à parte (mod_vehicle_capacity)."""
    weights = VEHICLE_CATEGORY_WEIGHTS.get(category, VEHICLE_CATEGORY_WEIGHTS.get("logistica", {}))
    denom = weights.get("speed", 0) + weights.get("discretion", 0)
    if denom <= 0:
        return 0.0
    speed = min(1.0, model.get("speed", 0) / 26.0)  # 26 = supercarro, o mais rápido do catálogo
    discretion = model.get("discretion", 50) / 100.0
    return (speed * weights.get("speed", 0) + discretion * weights.get("discretion", 0)) / denom


def weapon_combat_score(model, category):
    """Combina potência/precisão/alcance/leveza/velocidade/carregador num
    único score (0-1) ponderado pela categoria da missão (WEAPON_CATEGORY_WEIGHTS,
    game_data.py) — cada categoria valoriza atributos diferentes, por isso
    cada modelo tem vantagens/desvantagens reais consoante a operação, em vez
    de um único "melhor" universal."""
    weights = WEAPON_CATEGORY_WEIGHTS.get(category, WEAPON_CATEGORY_WEIGHTS.get("logistica", {}))
    if not weights:
        return 0.0
    power = model.get("power", 0) / 100
    accuracy = model.get("accuracy", 0) / 100
    rng = model.get("range", 0) / 100
    lightness = 1 - min(1.0, model.get("weight", 0) / 100)
    speed = model.get("use_speed", 0) / 100
    magazine = min(1.0, model.get("magazine_capacity", 0) / 30)
    return (
        power * weights.get("power", 0) + accuracy * weights.get("accuracy", 0)
        + rng * weights.get("range", 0) + lightness * weights.get("lightness", 0)
        + speed * weights.get("speed", 0) + magazine * weights.get("magazine", 0)
    )


def weapon_compatibility_factor(emp, model):
    """Sinal suave (nunca um bloqueio): funcionários que não cumprem os
    requisitos mínimos de atributo da arma (requires_attr) usam-na com menos
    eficácia, mas continuam a poder equipá-la."""
    reqs = model.get("requires_attr") or {}
    if not reqs:
        return 1.0
    attrs = emp.get("attrs") or {}
    shortfall = 0.0
    for attr, min_val in reqs.items():
        val = attrs.get(attr, 0)
        if val < min_val:
            shortfall += (min_val - val) / max(1, min_val)
    if shortfall <= 0:
        return 1.0
    return max(WEAPON_COMPATIBILITY_MIN_FACTOR, 1.0 - shortfall * 0.3)


def weapon_condition_factor(condition):
    """Curva de condição das armas (SSS v5): linear até ao joelho
    (WEAPON_CONDITION_SOFT_KNEE), quadrática abaixo dele — uma arma a 20% não
    é 'meio útil', é quase sucata (e candidata a encravar)."""
    c = max(0.0, min(100.0, float(condition if condition is not None else 100))) / 100.0
    knee = WEAPON_CONDITION_SOFT_KNEE / 100.0
    if c >= knee or knee <= 0:
        return c
    return c * (c / knee)


def weapon_jam_risk(model, condition):
    """Risco de encravamento por missão (SSS v5): fiabilidade do modelo +
    défice de condição abaixo do limiar de manutenção. Armas sem mecanismo
    (carregador < 2 e silenciosas, ex.: faca/taser) nunca encravam; uma
    caçadeira serrada aos 30% é uma roleta-russa."""
    if model.get("magazine_capacity", 0) < 2 and not model.get("loud"):
        return 0.0
    rel = max(0.0, min(100.0, float(model.get("reliability", 100)))) / 100.0
    risk = (1.0 - rel) * WEAPON_JAM_RELIABILITY_WEIGHT
    cond = max(0.0, min(100.0, float(condition if condition is not None else 100)))
    if cond < WEAPON_JAM_CONDITION_THRESHOLD:
        risk += (WEAPON_JAM_CONDITION_THRESHOLD - cond) / WEAPON_JAM_CONDITION_THRESHOLD * WEAPON_JAM_CONDITION_WEIGHT
    return max(0.0, min(WEAPON_JAM_MAX, risk))


def weapon_effective_score(emp, weapon_doc, model, category):
    """Score efetivo de uma arma NAS MÃOS de um operacional concreto para uma
    categoria de operação (SSS v5): qualidade do modelo ponderada pela
    categoria × adequação best_for × condição (curva não-linear) × fiabilidade
    × compatibilidade de requisitos × habilidade do portador + proficiência.
    É a MESMA régua em todo o lado: mod_weapon_score (chance de missão),
    /weapons/auto_assign e /weapons/optimize — o que o jogador vê no painel é
    o que a missão usa."""
    score = weapon_combat_score(model, category)
    best_for = model.get("best_for", [])
    best_for_mult = 1.3 if category in best_for else 0.7
    condition = weapon_condition_factor((weapon_doc or {}).get("condition", 100))
    reliability = model.get("reliability", 100) / 100
    compat = weapon_compatibility_factor(emp, model)
    skill = _weapon_skill_factor(emp, model)
    proficiency = (emp.get("weapon_proficiency") or {}).get(model.get("category"), 0)
    # Curva de proficiência com raiz quadrada (SSS v2): ganhos rápidos no
    # início, rendimentos decrescentes perto da mestria.
    proficiency_bonus = math.sqrt(max(0.0, proficiency) / WEAPON_PROFICIENCY_MAX) * WEAPON_PROFICIENCY_BONUS_MAX_PCT
    return score * best_for_mult * condition * reliability * compat * skill * WEAPON_COMBAT_SCORE_SCALE + proficiency_bonus


# ---------------- Modificadores de chance (sistema modular) ----------------
# Cada modificador lê o mesmo `ctx` (montado em _prepare_dispatch) e devolve
# None (não aplicável) ou {"key","label","pct","tip"}. Acrescentar um
# modificador novo no futuro é acrescentar uma função a MODIFIERS — a ordem
# só afecta a ordem de exibição (a soma é comutativa), nunca a lógica de
# agregação/clamping em chance_breakdown.

def _risk_penalty(risk):
    """Curva de risco convexa (SSS v2): linear + quadrática — r1..r5 penaliza
    5.6/12.4/20.4/29.6/40.0% (antes: 7/14/21/28/35, linear). A mediana (r3)
    mantém-se; operações fáceis ficam mais acessíveis, as de topo exigem
    investimento real."""
    return RISK_PENALTY_LINEAR * risk + RISK_PENALTY_QUADRATIC * risk * risk


def mod_risk_type(ctx):
    bump = distance_risk_bump(ctx.get("dist_km", 0.0))
    base_risk = max(0, ctx["risk"] - bump)
    if base_risk <= 0:
        return None
    return {"key": "risco_base", "category": "missao", "label": "Risco da operação", "pct": -_risk_penalty(base_risk),
            "tip": f"Nível de risco base {base_risk}/5 deste tipo de missão — a penalização cresce em curva (operações de topo exigem preparação de topo)."}


def mod_risk_distance(ctx):
    bump = distance_risk_bump(ctx.get("dist_km", 0.0))
    if bump <= 0:
        return None
    risk = ctx["risk"]
    base_risk = max(0, risk - bump)
    # Custo marginal real: penalização(risco total) - penalização(risco base) —
    # na curva convexa, a distância dói mais em operações já arriscadas.
    pct = -( _risk_penalty(risk) - _risk_penalty(base_risk) )
    return {"key": "distancia", "category": "missao", "label": "Distância excessiva", "pct": pct,
            "tip": f"Alvo a {ctx.get('dist_km', 0.0):.1f}km do QG — escolhe uma operação mais próxima para evitar esta penalização."}


def mod_heat(ctx):
    heat = ctx["heat"]
    if heat <= 0:
        return None
    return {"key": "calor", "category": "mundo", "label": "Calor policial elevado", "pct": -heat * 0.0015,
            "tip": f"Calor actual: {round(heat)}% — reduz a probabilidade em qualquer operação. Suborna a polícia ou espera o calor baixar antes de despachar."}


def mod_team_quality(ctx):
    members = ctx["members"]
    if not members:
        return None
    category, now = ctx["category"], ctx["now"]
    mentor = _has_mentor(members)

    def quality(e):
        attrs = e.get("attrs") or {}
        aks = CATEGORY_ATTRS.get(category)
        attr = _weighted_category_attr(attrs, aks)
        match = e.get("spec") == category or category == "especial"
        try:
            rank_f = 1 + 0.02 * RANKS.index(e.get("rank", "recruta"))
        except ValueError:
            rank_f = 1.0
        newbie_f = 1.0
        hired_at = e.get("hired_at")
        if hired_at:
            elapsed_s = max(0.0, (now - parse_dt(hired_at)).total_seconds())
            newbie_pen = NEWBIE_PENALTY_MAX * max(0.0, 1 - min(1.0, elapsed_s / NEWBIE_RAMP_S))
            # Mentoria (SSS v2): um veterano na equipa acelera a adaptação
            # dos recém-contratados — a penalização de novato é reduzida.
            newbie_f -= newbie_pen * (MENTOR_NEWBIE_RELIEF if mentor else 1.0)
        return (e.get("level", 1) * 0.5 + attr * 0.45) * (1.25 if match else 1.0) * rank_f * newbie_f

    avg_quality = sum(quality(e) for e in members) / len(members)
    baseline = (3 * 0.5 + 4 * 0.45)  # recruta nível 3, atributo médio 4, sem match nem bónus
    raw = max(-1.0, min(1.0, (avg_quality - baseline) / max(1.0, baseline)))
    pct = raw * _dim_scale(category, "team")
    tip = "Nível médio, atributos relevantes (o principal da categoria pesa mais) e patente dos operacionais."
    if mentor:
        tip += " Um veterano presente acelera a adaptação dos novatos."
    return {"key": "nivel_especializacao", "category": "equipa", "label": "Nível e especialização da equipa", "pct": pct,
            "tip": tip}


def mod_team_size(ctx):
    members, min_members, category = ctx["members"], ctx.get("min_members", 1), ctx["category"]
    n = len(members)
    if n == 0:
        return None
    if n < min_members:
        missing = min_members - n
        pct = -min(INCOMPLETE_CREW_PENALTY_MAX, INCOMPLETE_CREW_PENALTY_PER_MISSING * missing)
        return {"key": "equipa_incompleta", "category": "equipa", "label": "Equipa incompleta", "pct": pct,
                "tip": f"Faltam {missing} operacional(is) face ao recomendado ({min_members}) — atribui mais operacionais idle a esta equipa."}
    if n == 1:
        return {"key": "membro_solo", "category": "equipa", "label": "A trabalhar sozinho", "pct": -SOLO_MEMBER_PENALTY,
                "tip": "Um único operacional tem muito menos margem para imprevistos — atribui mais operacionais a esta equipa."}
    raw = min(1.0, (n - 1) * 0.2)
    pct = raw * _dim_scale(category, "team") * 0.5
    if pct < 0.0005:
        return None
    return {"key": "equipa_completa", "category": "equipa", "label": "Equipa completa", "pct": pct,
            "tip": "Mais operacionais disponíveis dão mais margem de segurança."}


def mod_team_fatigue(ctx):
    members = ctx["members"]
    if not members:
        return None
    avg_fatigue = sum(e.get("fatigue", 0) for e in members) / len(members)
    if avg_fatigue <= 30:
        return None
    # Curva convexa (SSS v2): fadiga moderada penaliza pouco, extrema penaliza
    # desproporcionalmente — equipas exaustas são um risco real.
    raw = -min(1.0, ((avg_fatigue - 30) / 70) ** FATIGUE_CURVE_EXP)
    pct = raw * _dim_scale(ctx["category"], "team")
    if abs(pct) < 0.0005:
        return None
    return {"key": "fadiga", "category": "moral", "label": "Fadiga elevada", "pct": pct,
            "tip": f"Fadiga média de {round(avg_fatigue)}% — a penalização cresce em curva; perto do limite a equipa torna-se um perigo. Manda os operacionais descansar antes de despachar."}


def mod_team_morale(ctx):
    members = ctx["members"]
    if not members:
        return None
    avg_morale = sum(e.get("morale", 70) for e in members) / len(members)
    raw = max(-1.0, min(1.0, (avg_morale - 70) / 30))
    pct = raw * _dim_scale(ctx["category"], "team") * 0.6
    # Assimetria psicológica (SSS v2): moral baixa mina a operação mais do que
    # moral alta a impulsiona — o lado negativo pesa mais.
    if pct < 0:
        pct *= MORALE_PENALTY_ASYMMETRY
    if abs(pct) < 0.0005:
        return None
    label = "Moral elevada" if raw > 0 else "Moral baixa"
    tip = f"Moral média de {round(avg_morale)}%."
    if raw <= 0:
        tip += " Moral baixa pesa mais do que moral alta ajuda — dá um bónus aos operacionais ou deixa-os descansar."
    return {"key": "moral", "category": "moral", "label": label, "pct": pct, "tip": tip}


def mod_team_loyalty(ctx):
    members = ctx["members"]
    if not members:
        return None
    avg_loyalty = sum(e.get("loyalty", 70) for e in members) / len(members)
    if avg_loyalty >= 70:
        pct = min(1.0, (avg_loyalty - 70) / 30) * LOYALTY_BONUS_MAX
        if pct < 0.0005:
            return None
        return {"key": "lealdade", "category": "moral", "label": "Lealdade elevada", "pct": pct,
                "tip": f"Lealdade média de {round(avg_loyalty)}% — equipa empenhada."}
    pct = -min(1.0, (70 - avg_loyalty) / 70) * LOYALTY_PENALTY_MAX
    if abs(pct) < 0.0005:
        return None
    return {"key": "lealdade", "category": "moral", "label": "Lealdade baixa", "pct": pct,
            "tip": f"Lealdade média de {round(avg_loyalty)}% — maior risco de falhas de empenho. Promoções e bónus aumentam a lealdade."}


def mod_team_leader(ctx):
    members = ctx["members"]
    if not members:
        return None
    try:
        leader_idx = RANKS.index(TEAM_LEADER_MIN_RANK)
    except ValueError:
        leader_idx = len(RANKS) - 1
    has_leader = any(RANKS.index(e["rank"]) >= leader_idx for e in members if e.get("rank") in RANKS)
    if has_leader:
        return None
    return {"key": "sem_lider", "category": "equipa", "label": "Sem líder presente", "pct": -NO_LEADER_PENALTY,
            "tip": f"Nenhum operacional tem a patente de {TEAM_LEADER_MIN_RANK} ou superior — atribui um líder à equipa para obter este bónus."}


def mod_team_uniform_spec(ctx):
    members, category = ctx["members"], ctx["category"]
    if len(members) < 2:
        return None
    fraction = 1.0 if category == "especial" else sum(1 for e in members if e.get("spec") == category) / len(members)
    if fraction <= 0:
        return None
    pct = UNIFORM_SPEC_BONUS * fraction
    label = "Especializações todas correctas" if fraction >= 0.999 else "Especializações parcialmente correctas"
    tip = f"{round(fraction * 100)}% dos operacionais têm a especialização certa para esta operação."
    if fraction < 0.999:
        tip += " Substitui os restantes por especialistas desta categoria para o bónus completo."
    return {"key": "especializacao", "category": "especializacoes", "label": label, "pct": pct, "tip": tip}


def mod_team_coordination(ctx):
    """Coordenação híbrida (SSS v4): 50% tempo de plantel estável + 50%
    operações reais feitas com este plantel — treinar no terreno constrói
    entrosamento mais depressa do que apenas esperar. Mudar membros reinicia
    ambos os contadores."""
    roster_stable_since = ctx.get("roster_stable_since")
    time_frac = 0.0
    if roster_stable_since:
        stable_s = max(0.0, (ctx["now"] - parse_dt(roster_stable_since)).total_seconds())
        time_frac = min(1.0, stable_s / COORDINATION_RAMP_S)
    mission_frac = min(1.0, ctx.get("roster_missions", 0) / COORDINATION_RAMP_MISSIONS)
    pct = COORDINATION_BONUS_MAX * (0.5 * time_frac + 0.5 * mission_frac)
    if pct < 0.0005:
        return None
    return {"key": "coordenacao", "category": "equipa", "label": "Entrosamento do plantel", "pct": pct,
            "tip": f"Tempo com o plantel estável ({round(time_frac * 100)}%) e operações feitas juntos ({ctx.get('roster_missions', 0)}/{COORDINATION_RAMP_MISSIONS}) — mudar membros reinicia a coordenação."}


def mod_team_familiarity(ctx):
    """A equipa aprende (SSS v4): operações concluídas nesta categoria criam
    rotinas e reflexos — bónus com curva sqrt (ganhos rápidos no início,
    mestria lenta), capado. Complementa a especialização individual: aqui é a
    EQUIPA enquanto unidade que domina o tipo de trabalho."""
    count = int(ctx.get("team_cat_missions", 0) or 0)
    if count < TEAM_FAMILIARITY_MIN_MISSIONS:
        return None
    frac = min(1.0, count / TEAM_FAMILIARITY_RAMP_MISSIONS)
    pct = TEAM_FAMILIARITY_BONUS_MAX * math.sqrt(frac)
    if pct < 0.0005:
        return None
    mastery = count >= TEAM_FAMILIARITY_RAMP_MISSIONS
    label = "Mestria da categoria" if mastery else "Familiaridade com a categoria"
    return {"key": "familiaridade", "category": "equipa", "label": label, "pct": pct,
            "tip": f"Esta equipa já concluiu {count} operações desta categoria ({min(count, TEAM_FAMILIARITY_RAMP_MISSIONS)}/{TEAM_FAMILIARITY_RAMP_MISSIONS} para a mestria) — a experiência coletiva conta."}


def mod_team_strategist(ctx):
    """Estratega na equipa (SSS v4): um operacional com inteligência alta
    estuda o alvo e planeia rotas de entrada/saída — recupera uma fração da
    penalização de risco da operação. Quanto mais arriscada a operação, mais
    o planeamento vale (o alívio escala com a própria penalização, capado)."""
    members = ctx["members"]
    if not members:
        return None
    best_int = max(((e.get("attrs") or {}).get("inteligencia", 0) for e in members), default=0)
    if best_int < STRATEGIST_MIN_INT:
        return None
    risk = ctx.get("risk", 0)
    if risk <= 0:
        return None
    # Escala com a inteligência acima do limiar: 7 → 25%, 10 → 100% do alívio.
    scale = (best_int - (STRATEGIST_MIN_INT - 1)) / (10 - (STRATEGIST_MIN_INT - 1))
    pct = min(STRATEGIST_RELIEF_MAX, _risk_penalty(risk) * STRATEGIST_RELIEF_FRAC * scale)
    if pct < 0.0005:
        return None
    return {"key": "estratega", "category": "equipa", "label": "Estratega no terreno", "pct": pct,
            "tip": f"Um operacional com inteligência {best_int}/10 planeou a operação — parte da penalização de risco é recuperada (vale mais em operações arriscadas)."}


def mod_team_synergy(ctx):
    """Química da equipa (SSS v2): cobertura dos atributos-chave da categoria
    pelos MELHORES membros (60%) + diversidade de papéis (40%), centrada num
    baseline neutro — uma equipa mediana fica a ~0%, só composições
    genuinamente complementares ganham o bónus (e monoculturas fracas perdem)."""
    members, category = ctx["members"], ctx["category"]
    if len(members) < 2:
        return None
    aks = CATEGORY_ATTRS.get(category)
    if aks:
        coverage = sum(max(e.get("attrs", {}).get(a, 2) for e in members) for a in aks) / (len(aks) * 10)
    else:
        # "especial": cobertura dos 3 melhores atributos globais da equipa.
        best = sorted((max(e.get("attrs", {}).get(a, 2) for e in members) for a in ATTR_KEYS), reverse=True)
        coverage = sum(best[:3]) / 30
    diversity = len({e.get("role_key") for e in members}) / len(members)
    raw = 0.6 * coverage + 0.4 * diversity - TEAM_SYNERGY_BASELINE
    pct = max(-1.0, min(1.0, raw / TEAM_SYNERGY_SPREAD)) * TEAM_SYNERGY_MAX
    if abs(pct) < 0.0005:
        return None
    label = "Boa química de equipa" if pct > 0 else "Composição pouco complementar"
    tip = "Cobertura dos atributos-chave desta categoria pelos melhores membros e diversidade de papéis."
    if pct <= 0:
        tip += " Junta especialistas complementares (papéis diferentes, atributos fortes na categoria) para o bónus."
    return {"key": "sinergia", "category": "equipa", "label": label, "pct": pct, "tip": tip}


def mod_stealth_synergy(ctx):
    """Sinergia furtiva arma+veículo (SSS v2): em operações discretas, um
    perfil TOTALMENTE silencioso (veículo discreto + nenhuma arma 'loud')
    ganha bónus; qualquer elemento ruidoso no conjunto penaliza — as duas
    dimensões deixam de ser avaliadas em silos."""
    if ctx["category"] not in DISCREET_CATEGORIES:
        return None
    vehicle = ctx.get("vehicle")
    model = VEHICLE_MODELS.get(vehicle.get("model_key")) if vehicle else None
    if not model:
        return None
    weapons = [WEAPON_MODELS.get(w.get("model_key")) for w in (ctx.get("weapons_by_employee_id") or {}).values()]
    weapons = [w for w in weapons if w]
    any_loud = any(w.get("loud") for w in weapons)
    disc = model.get("discretion", 50)
    if disc >= STEALTH_VEHICLE_DISCRETION_MIN and not any_loud:
        # SSS v5: o bónus deixa de ser binário — escala com a discrição média
        # das armas transportadas (mãos vazias contam como discrição total).
        w_disc = [w.get("discretion", 50) for w in weapons]
        stealth_frac = 1.0 if not w_disc else min(1.0, (sum(w_disc) / len(w_disc)) / WEAPON_STEALTH_DISCRETION_REF)
        pct = STEALTH_SYNERGY_BONUS * max(0.35, stealth_frac)
        tip = "Veículo discreto e nenhuma arma ruidosa — o conjunto passa despercebido nesta operação."
        if w_disc and stealth_frac < 1.0:
            tip += " Armas mais discretas (ex.: silenciadas) aumentariam ainda mais este bónus."
        return {"key": "furtividade", "category": "especializacoes", "label": "Perfil totalmente furtivo",
                "pct": pct, "tip": tip}
    if any_loud or disc <= NOISY_VEHICLE_DISCRETION_MAX:
        reasons = []
        if any_loud:
            reasons.append("armas ruidosas")
        if disc <= NOISY_VEHICLE_DISCRETION_MAX:
            reasons.append("veículo espalhafatoso")
        return {"key": "furtividade", "category": "especializacoes", "label": "Perfil ruidoso em operação discreta",
                "pct": -STEALTH_SYNERGY_PENALTY,
                "tip": f"{' e '.join(reasons).capitalize()} numa operação que exige discrição — troca por equipamento silencioso."}
    return None


def mod_vehicle_condition(ctx):
    vehicle = ctx.get("vehicle")
    if not vehicle:
        return None
    condition = vehicle.get("condition", 100)
    if condition >= VEHICLE_CONDITION_PENALTY_THRESHOLD:
        return None
    frac = (VEHICLE_CONDITION_PENALTY_THRESHOLD - condition) / VEHICLE_CONDITION_PENALTY_THRESHOLD
    raw = -min(1.0, frac)
    pct = raw * _dim_scale(ctx["category"], "vehicle") * 2.0
    if abs(pct) < 0.0005:
        return None
    return {"key": "veiculo_danificado", "category": "veiculos", "label": "Veículo danificado", "pct": pct,
            "tip": f"Condição do veículo em {round(condition)}% — repara o veículo para recuperar esta penalização."}


def mod_vehicle_fit(ctx):
    vehicle = ctx.get("vehicle")
    if not vehicle:
        return None
    model = VEHICLE_MODELS.get(vehicle.get("model_key"))
    if not model:
        return None
    category = ctx["category"]
    best_for = model.get("best_for", [])
    score = vehicle_mission_score(model, category)
    raw = max(-1.0, min(1.0, 2 * score - 1))
    pct = raw * _dim_scale(category, "vehicle")
    if best_for and category not in best_for:
        pct -= VEHICLE_MISMATCH_PENALTY
    elif category in best_for:
        pct += _dim_scale(category, "vehicle") * 0.3
    if abs(pct) < 0.0005:
        return None
    label = "Veículo ideal" if pct > 0 else "Veículo pouco adequado"
    tip = "Velocidade e discrição do veículo face às exigências desta categoria de operação."
    if pct <= 0:
        tip += " Utiliza um veículo especializado nesta categoria para aumentar a probabilidade de sucesso."
    return {"key": "veiculo_adequacao", "category": "veiculos", "label": label, "pct": pct, "tip": tip}


def mod_vehicle_capacity(ctx):
    vehicle = ctx.get("vehicle")
    if not vehicle:
        return None
    model = VEHICLE_MODELS.get(vehicle.get("model_key"))
    seats = model.get("seats") if model else None
    members = ctx["members"]
    if not seats or not members:
        return None
    category = ctx["category"]
    weights = VEHICLE_CATEGORY_WEIGHTS.get(category, VEHICLE_CATEGORY_WEIGHTS.get("logistica", {}))
    w = weights.get("seats_fit", 0)
    if w <= 0:
        return None
    ratio = len(members) / seats
    raw = 1.0 if ratio >= 0.75 else max(-0.3, ratio / 0.75 - 1.0)
    pct = raw * DIMENSION_SWING_CAP["vehicle"] * w
    if abs(pct) < 0.0005:
        return None
    label = "Capacidade do veículo bem aproveitada" if raw > 0 else "Veículo sobredimensionado para a equipa"
    tip = f"{len(members)} operacional(is) para {seats} lugares."
    if raw <= 0:
        tip += " Usa um veículo mais pequeno ou leva mais operacionais para aproveitar melhor a capacidade."
    return {"key": "veiculo_capacidade", "category": "veiculos", "label": label, "pct": pct, "tip": tip}


def _weapon_skill_factor(emp, model):
    """A arma certa na mão errada rende pouco (SSS v2): a eficácia escala com
    o atributo relevante do operacional — o 1º requisito da arma (requires_attr),
    senão tiro para armas de fogo / discrição para silenciosas. Um recruta com
    Rifle de Precisão extrai WEAPON_SKILL_FLOOR do potencial; um especialista
    (atributo >= WEAPON_SKILL_ATTR_CAP) extrai 100%."""
    reqs = model.get("requires_attr") or {}
    skill_attr = next(iter(reqs), None) or ("tiro" if model.get("loud") else "discricao")
    attr_val = (emp.get("attrs") or {}).get(skill_attr, 2)
    return WEAPON_SKILL_FLOOR + (1 - WEAPON_SKILL_FLOOR) * min(1.0, attr_val / WEAPON_SKILL_ATTR_CAP)


def mod_weapon_score(ctx):
    members = ctx["members"]
    weapons_by_employee_id = ctx.get("weapons_by_employee_id") or {}
    if not members:
        return None
    category = ctx["category"]
    equipped, total, mismatch = 0, 0.0, False
    for e in members:
        weapon = weapons_by_employee_id.get(str(e["_id"]))
        if not weapon:
            continue
        model = WEAPON_MODELS.get(weapon.get("model_key"))
        if not model:
            continue
        equipped += 1
        best_for = model.get("best_for", [])
        if best_for and category not in best_for:
            mismatch = True
        # Régua única (SSS v5): o mesmo score efetivo usado pelo auto-assign e
        # pelo otimizador de arsenal — inclui a curva de condição não-linear.
        total += weapon_effective_score(e, weapon, model, category)
    if equipped == 0:
        return None
    avg = total / len(members)
    raw = max(-1.0, min(1.0, avg / max(0.001, WEAPON_BONUS_MAX)))
    pct = raw * _dim_scale(category, "weapon")
    if mismatch and pct > 0:
        pct -= WEAPON_MISMATCH_PENALTY_MAX * 0.5
    if abs(pct) < 0.0005:
        return None
    label = "Armas adequadas" if pct > 0 else "Armas pouco adequadas"
    tip = f"{equipped}/{len(members)} operacional(is) equipados; qualidade da arma, adequação à categoria e habilidade de quem a usa."
    if pct <= 0:
        tip += " Equipa uma arma mais adequada — e nas mãos de quem tem o atributo certo para a dominar."
    return {"key": "armamento", "category": "armamento", "label": label, "pct": pct, "tip": tip}


def mod_environment_night(ctx):
    category, now = ctx["category"], ctx["now"]
    start, end = NIGHT_STEALTH_HOURS
    h = now.hour
    is_night = (start <= h < end) if start <= end else (h >= start or h < end)
    if not is_night:
        return None
    pct = _dim_scale(category, "environment")
    if pct < 0.0005:
        return None
    return {"key": "noite", "category": "mundo", "label": "Cobertura da noite", "pct": pct,
            "tip": "Operação de madrugada — mais discrição em categorias que a valorizam."}


def mod_hq_level(ctx):
    hq_level = ctx.get("hq_level", 1)
    if hq_level <= 1:
        return None
    return {"key": "organizacao", "category": "organizacao", "label": "Organização evoluída", "pct": HQ_CHANCE_BONUS_PER_LEVEL * (hq_level - 1),
            "tip": f"Quartel-General nível {hq_level} — competência transversal da organização."}


def mod_talents(ctx):
    if ctx["category"] != "assalto":
        return None
    if not any("pontaria_letal" in (e.get("talents") or []) for e in ctx["members"]):
        return None
    return {"key": "talentos", "category": "talentos", "label": "Talento: Pontaria Letal", "pct": 0.05,
            "tip": "Um operacional da equipa tem o talento Pontaria Letal."}


def attention_key(district):
    """Chave segura para o mapa de atenção policial (Mongo não aceita '.')."""
    return (district or "").replace(".", "").strip() or "desconhecido"


def district_attention_of(player, district):
    return float((player.get("district_attention") or {}).get(attention_key(district), 0.0))


def mod_district_attention(ctx):
    """Memória do mundo (SSS v3): operar repetidamente na mesma zona deixa a
    polícia local em alerta — a atenção acumulada penaliza a chance em curva
    suave e só arrefece com o tempo. Incentiva a rotação geográfica real."""
    att = ctx.get("district_attention", 0.0)
    if att < 5:
        return None
    frac = min(1.0, att / DISTRICT_ATTENTION_MAX)
    pct = -DISTRICT_ATTENTION_PENALTY_MAX * frac ** 1.2
    if abs(pct) < 0.0005:
        return None
    hot = att >= DISTRICT_ATTENTION_HOT
    label = "Zona sob vigilância apertada" if hot else "Polícia atenta à zona"
    return {"key": "atencao_distrito", "category": "mundo", "label": label, "pct": pct,
            "tip": f"Operações recentes em {ctx.get('district', 'esta zona')} deixaram a polícia local em alerta ({round(att)}%) — deixa a zona arrefecer ou opera noutro distrito."}


def mod_police_zone(ctx):
    """Divisão territorial PSP/GNR: a força competente pela zona da operação
    afeta o risco real. Zona urbana (PSP) — malha densa, mais arriscado; zona
    rural (GNR) — menos vigilância, ligeiramente mais fácil. Efeito modesto e
    transparente. Genérico: lê o efeito de POLICE_FORCE_EFFECTS pela força."""
    eff = POLICE_FORCE_EFFECTS.get(ctx.get("police_force"))
    if not eff:
        return None
    pct = eff.get("chance", 0.0)
    if abs(pct) < 0.0005:
        return None
    return {"key": "zona_policial", "category": "mundo", "label": eff["label"], "pct": pct,
            "tip": eff["tip"]}


def mod_team_momentum(ctx):
    """Momentum (SSS v3): séries de vitórias dão confiança operacional (bónus
    modesto e capado); séries de falhas minam-na. Uma vitória limpa repõe tudo."""
    streak = ctx.get("team_streak", 0)
    if streak >= 2:
        pct = min(TEAM_MOMENTUM_BONUS_MAX, TEAM_MOMENTUM_BONUS_PER_WIN * streak)
        return {"key": "momentum", "category": "equipa", "label": f"Momentum: {streak} vitórias seguidas", "pct": pct,
                "tip": "A equipa está confiante — série de operações bem-sucedidas sem falhas. Uma falha apaga a série."}
    if streak <= -2:
        pct = -min(TEAM_MOMENTUM_PENALTY_MAX, TEAM_MOMENTUM_PENALTY_PER_LOSS * (-streak))
        return {"key": "momentum", "category": "moral", "label": "Confiança abalada", "pct": pct,
                "tip": f"{-streak} falhas consecutivas desta equipa — uma vitória limpa restaura a confiança."}
    return None


MODIFIERS = [
    mod_risk_type, mod_risk_distance, mod_heat, mod_district_attention, mod_police_zone,
    mod_team_quality, mod_team_size, mod_team_fatigue, mod_team_morale, mod_team_loyalty,
    mod_team_leader, mod_team_uniform_spec, mod_team_coordination, mod_team_synergy,
    mod_team_momentum, mod_team_familiarity, mod_team_strategist,
    mod_vehicle_condition, mod_vehicle_fit, mod_vehicle_capacity,
    mod_weapon_score, mod_stealth_synergy, mod_environment_night, mod_hq_level, mod_talents,
]


def chance_breakdown(ctx):
    """Sistema modular de probabilidade de sucesso (SSS v2): soma o ponto de
    partida (BASE_CHANCE) com cada modificador aplicável de MODIFIERS, todos
    lidos do mesmo `ctx`, e aplica no fim uma compressão de rendimentos
    decrescentes — acima de CHANCE_SOFT_KNEE cada ponto extra de bónus vale
    exponencialmente menos (assimptota em CHANCE_CEILING), e a chance nunca
    desce abaixo de CHANCE_FLOOR (há sempre uma réstia de sorte) nem atinge a
    certeza absoluta. A compressão, quando aplicada, aparece como um item
    próprio no breakdown ("rendimentos_decrescentes") para manter a soma dos
    itens igual à chance final — transparência total para o jogador.
    Devolve (chance 0-1, items[])."""
    items = [{"key": "base", "category": "base", "label": "Base da missão", "pct": round(BASE_CHANCE, 4),
              "tip": "Ponto de partida antes de qualquer ajuste."}]
    total = BASE_CHANCE
    for mod in MODIFIERS:
        result = mod(ctx)
        if not result:
            continue
        pct = result["pct"]
        if abs(pct) < 0.0005:
            continue
        total += pct
        items.append({**result, "pct": round(pct, 4)})
    # Rendimentos decrescentes acima do joelho: compressão exponencial suave.
    if total > CHANCE_SOFT_KNEE:
        excess = total - CHANCE_SOFT_KNEE
        softened = CHANCE_SOFT_KNEE + CHANCE_SOFT_SPAN * (1 - math.exp(-excess / CHANCE_SOFT_SPAN))
        delta = softened - total
        if delta <= -0.0005:
            items.append({"key": "rendimentos_decrescentes", "category": "base",
                          "label": "Rendimentos decrescentes", "pct": round(delta, 4),
                          "tip": "Acima de ~90%, cada bónus extra vale cada vez menos — nenhuma operação é uma certeza absoluta."})
        total = softened
    chance = max(CHANCE_FLOOR, min(CHANCE_CEILING, total))
    return chance, items


def _roll_outcome(player, m):
    chance = m.get("success_chance")
    if chance is None:
        # success_chance é sempre persistida no dispatch (routes_game.py) —
        # este ramo só existe para missões antigas/malformadas. Reconstruir
        # o ctx completo (membros, veículo, armas) aqui não está disponível
        # nesta função, por isso usa-se um valor neutro em vez de arriscar
        # uma recomputação parcial e inconsistente.
        logger.warning("Mission %s sem success_chance persistida — a usar valor neutro (0.5).", m.get("id") or m.get("_id"))
        chance = 0.5
    # Operação em direto (SSS): as complicações reveladas durante a operação
    # têm efeito REAL — o delta acumulado (pré-rolado no despacho e mostrado
    # ao jogador em tempo real) ajusta a chance antes do roll.
    live_delta = float(m.get("live_chance_delta", 0) or 0)
    if live_delta:
        chance = max(0.05, min(0.97, chance + live_delta))
    # Encravamento (SSS v5): cada arma leva um risco por missão (fiabilidade ×
    # condição, persistido no despacho em weapon_jam_profile). Uma arma que
    # encrava a meio da ação custa pontos de chance — e o relatório final diz
    # de quem era e qual foi.
    jams = [wj for wj in (m.get("weapon_jam_profile") or [])
            if random.random() < float(wj.get("jam_risk", 0) or 0)]
    if jams:
        m["weapon_jams"] = [
            {"weapon_id": wj.get("weapon_id"), "weapon_name": wj.get("weapon_name"),
             "emp_name": wj.get("emp_name")}
            for wj in jams
        ]
        penalty = min(WEAPON_JAM_CHANCE_PENALTY_CAP, WEAPON_JAM_CHANCE_PENALTY * len(jams))
        chance = max(0.02, chance - penalty)
    # Chance efetiva (base + complicações + encravamentos) — persistida para o
    # relatório e para o painel de operação em direto.
    m["final_chance"] = round(chance, 3)
    r = random.random()
    if r <= chance:
        return "success"
    # Numa falha, o calor atual decide se foi só azar ou se a polícia estava
    # mesmo à espera (SSS v2, curva convexa): com calor baixo a polícia quase
    # não conta (16% base); com calor alto a probabilidade dispara até ao cap.
    heat_frac = max(0.0, min(1.0, player.get("heat", 0) / 100))
    police_prob = min(POLICE_PROB_CAP, POLICE_PROB_BASE + POLICE_PROB_SPAN * heat_frac ** POLICE_PROB_EXP)
    if random.random() < police_prob:
        return "police"
    # Near-miss (SSS v3): falhar "por pouco" (dentro da janela acima da chance)
    # e sem interceção policial vira sucesso parcial — a equipa aborta a meio
    # mas salva parte do saque. O resultado deixa de ser tudo-ou-nada.
    if r <= chance + PARTIAL_SUCCESS_WINDOW:
        return "partial"
    # Clutch save do líder (SSS v4): numa falha franca sem polícia, um líder
    # presente com sangue-frio alto pode ainda salvar a operação para um
    # sucesso parcial — improvisa, corta perdas e traz parte do saque.
    if m.get("has_leader"):
        cool = float(m.get("leader_cool", 0) or 0)
        clutch_prob = CLUTCH_SAVE_MAX * max(0.0, min(1.0, cool / 10.0))
        if clutch_prob > 0 and random.random() < clutch_prob:
            m["clutch_save"] = True
            return "partial"
    return "failure"


def _apply_outcome(player, m, outcome):
    t = m["opportunity"]
    stats = player.setdefault("stats", default_stats())
    stats["missions_total"] += 1
    stats["by_category"][t["category"]] = stats["by_category"].get(t["category"], 0) + 1
    # Memória do mundo (SSS v3): a zona onde a operação aconteceu aquece —
    # quanto pior o desfecho e maior o risco, mais atenção policial acumula.
    att = player.setdefault("district_attention", {})
    att_gain = {"success": DISTRICT_ATTENTION_SUCCESS, "partial": DISTRICT_ATTENTION_PARTIAL,
                "failure": DISTRICT_ATTENTION_FAILURE, "police": DISTRICT_ATTENTION_POLICE}.get(outcome, 0.0)
    att_gain *= 1 + DISTRICT_ATTENTION_PER_RISK * t.get("risk", 3)
    akey = attention_key(t.get("district"))
    att[akey] = round(min(DISTRICT_ATTENTION_MAX, att.get(akey, 0.0) + att_gain), 2)
    heat_mult = 0.5 if ("fantasma_digital" in m.get("talents", []) and t["category"] == "tecnica") else 1.0
    if m.get("vehicle_luxury") and t["category"] in DISCREET_CATEGORIES:
        heat_mult *= LUXURY_HEAT_MULT
    if m.get("weapon_loud") and t["category"] in DISCREET_CATEGORIES:
        heat_mult *= WEAPON_LOUD_HEAT_MULT
    if outcome == "success":
        # Money is *not* credited here anymore. Store as pending reward — paid on arrival at HQ
        # if the police chase (if any) is escaped.
        reward = t["reward"]
        # Pequeno imprevisto: saque adicional aleatório.
        if random.random() < BONUS_LOOT_CHANCE:
            bonus_pct = random.uniform(0.02, BONUS_LOOT_MAX_PCT)
            reward = int(reward * (1 + bonus_pct))
            m["bonus_loot"] = True
        m["pending_reward"] = int(reward)
        m["pending_pays"] = t["pays"]
        # Reputação: usar novo cálculo dinâmico se disponível, fallback para antigo
        player["respect"] += m.get("reward_reputation", t["respect"])
        player["heat"] = min(100, player["heat"] + t["heat"] * heat_mult)
        # Roll for police chase during return trip.
        chase_chance = _compute_chase_chance(player, m)
        if random.random() < chase_chance:
            m["chase_active"] = True
            m["escape_chance"] = _compute_escape_chance(player, m)
        m["chase_chance"] = round(chase_chance, 3)
    elif outcome == "partial":
        # Sucesso parcial (SSS v3): a equipa abortou a meio mas salvou parte do
        # saque — paga menos, faz mais barulho e a polícia fica mais desconfiada.
        stats["missions_partial"] = stats.get("missions_partial", 0) + 1
        frac = random.uniform(PARTIAL_REWARD_MIN, PARTIAL_REWARD_MAX)
        m["pending_reward"] = int(t["reward"] * frac)
        m["pending_pays"] = t["pays"]
        m["partial_fraction"] = round(frac, 2)
        base_rep = m.get("reward_reputation", t["respect"])
        player["respect"] += max(1, int(base_rep * PARTIAL_RESPECT_FRACTION))
        player["heat"] = min(100, player["heat"] + t["heat"] * PARTIAL_HEAT_MULT * heat_mult)
        # Golpe interrompido = polícia já alertada: perseguição mais provável.
        chase_chance = min(0.9, _compute_chase_chance(player, m) * PARTIAL_CHASE_MULT)
        if random.random() < chase_chance:
            m["chase_active"] = True
            m["escape_chance"] = _compute_escape_chance(player, m)
        m["chase_chance"] = round(chase_chance, 3)
    elif outcome == "failure":
        stats["missions_failure"] += 1
        # Reputação por falha: 25% do valor de sucesso (usando novo cálculo se disponível)
        base_rep = m.get("reward_reputation", t["respect"])
        player["respect"] += max(1, int(base_rep * 0.25))
        player["heat"] = min(100, player["heat"] + t["heat"] * 1.5 * heat_mult)
        # Este tipo de missão fica temporariamente mais raro depois de falhar.
        cooldowns = player.setdefault("type_cooldowns", {})
        cooldowns[t["type_key"]] = (now_utc() + timedelta(minutes=FAILED_TYPE_COOLDOWN_MIN)).isoformat()
    else:
        stats["missions_police"] += 1
        fine = int(player["dirty_money"] * 0.10)
        stats["fines_paid"] += fine
        player["dirty_money"] -= fine
        player["heat"] = min(100, player["heat"] + t["heat"] * 2 * heat_mult)
        m["fine"] = fine


def _compute_chase_chance(player, m):
    """Probabilidade de a polícia seguir a equipa após o golpe (SSS v3): base
    por risco, calor em curva convexa (CHASE_HEAT_*), atenção policial da zona
    (zonas vigiadas têm patrulhas à espera), aliviada por talentos, skill da
    equipa e — em operações discretas — por um veículo que passa despercebido."""
    t = m["opportunity"]
    risk = t.get("risk", 3)
    heat_frac = max(0.0, min(1.0, player.get("heat", 0) / 100))
    base = 0.05 + (risk / 5) * 0.30
    # Curva convexa: calor baixo quase não conta, calor alto conta muito.
    base += CHASE_HEAT_SPAN * heat_frac ** CHASE_HEAT_EXP
    # Memória do mundo: zonas com atenção acumulada atraem perseguições.
    att = district_attention_of(player, t.get("district"))
    base += DISTRICT_ATTENTION_CHASE_MAX * min(1.0, att / DISTRICT_ATTENTION_MAX)
    # Divisão territorial: no centro urbano (PSP) as patrulhas estão perto e
    # respondem depressa (mais perseguições); no rural (GNR) estão dispersas.
    base += POLICE_FORCE_EFFECTS.get(t.get("police_force"), {}).get("chase", 0.0)
    talents = m.get("talents", []) or []
    reduction = 0.0
    if "fantasma_digital" in talents:
        reduction += 0.10
    if "motorista_fantasma" in talents:
        reduction += 0.05
    # Veículo discreto em operação discreta: menos olhos em cima.
    if m.get("vehicle_discreet") and t.get("category") in DISCREET_CATEGORIES:
        reduction += CHASE_DISCRETION_RELIEF
    skill = m.get("team_skill", 3)
    reduction += min(0.10, max(0.0, (skill - 3) * 0.03))
    return max(0.02, min(0.85, base - reduction))


def _compute_escape_chance(player, m):
    """Probabilidade de despistar a polícia antes do QG (SSS v3): risco e calor
    (convexo, ESCAPE_HEAT_*) contra skill, talentos, momentum da equipa e —
    finalmente — o próprio carro de fuga: velocidade efetiva acima do baseline
    ajuda a fugir (ESCAPE_SPEED_*), um supercarro em bom estado vale ~+15%."""
    t = m["opportunity"]
    risk = t.get("risk", 3)
    skill = m.get("team_skill", 3)
    talents = m.get("talents", []) or []
    base = 0.55 - (risk / 5) * 0.15
    base += min(0.20, max(0.0, (skill - 3) * 0.05))
    if "rei_da_noite" in talents:
        base += 0.08
    if "motorista_fantasma" in talents:
        base += 0.10
    # O carro de fuga conta: velocidade efetiva (condição incluída) do despacho.
    speed = m.get("vehicle_speed_effective")
    if speed:
        base += min(ESCAPE_SPEED_BONUS_MAX,
                    max(0.0, (speed - ESCAPE_SPEED_BASELINE) * ESCAPE_SPEED_BONUS_PER_UNIT))
    # Quem conduz também conta (SSS v4): o melhor condutor da equipa despista
    # a polícia com manobras que o carro sozinho não faz.
    driver = float(m.get("best_driver", 0) or 0)
    if driver > DRIVER_ATTR_BASELINE:
        base += min(DRIVER_ESCAPE_BONUS_MAX,
                    (driver - DRIVER_ATTR_BASELINE) * DRIVER_ESCAPE_BONUS_PER_POINT)
    # Momentum: equipas em série de vitórias fogem com mais sangue-frio.
    streak = m.get("team_streak", 0)
    if streak > 0:
        base += min(TEAM_MOMENTUM_ESCAPE_BONUS_MAX, streak * 0.01)
    # Intimidação (SSS v5): em assaltos, poder de fogo visível dissuade
    # testemunhas e patrulhas — ganha segundos preciosos na fuga. É a
    # contrapartida real do calor extra que as armas ruidosas custam.
    if t.get("category") == "assalto":
        power_avg = float(m.get("weapon_power_avg", 0) or 0)
        if power_avg > 0:
            base += WEAPON_INTIMIDATION_ESCAPE_MAX * min(1.0, power_avg / 100.0)
    # Divisão territorial: estradas nacionais e campo aberto (GNR) facilitam o
    # despiste; a malha densa do centro urbano (PSP) dificulta-o.
    base += POLICE_FORCE_EFFECTS.get(t.get("police_force"), {}).get("escape", 0.0)
    heat_frac = max(0.0, min(1.0, player.get("heat", 0) / 100))
    base -= ESCAPE_HEAT_SPAN * heat_frac ** ESCAPE_HEAT_EXP
    return max(0.10, min(0.95, base))


async def _resolve_chase(db, player, m):
    """Called when the vehicle reaches HQ. Decides if the chase was escaped or crew caught."""
    if not m.get("chase_active"):
        return "no_chase"
    escape = m.get("escape_chance", 0.5)
    if random.random() < escape:
        m["chase_outcome"] = "escaped"
        player["heat"] = min(100, player.get("heat", 0) + 5)
        await add_event(db, m["player_id"], "success",
                        f"{m['team_name']} despistou a polícia mesmo à porta do QG.")
        return "escaped"
    # Caught: lose the reward, extra heat, possible arrest.
    m["chase_outcome"] = "caught"
    lost = int(m.get("pending_reward", 0))
    m["pending_reward"] = 0
    player["heat"] = min(100, player.get("heat", 0) + 20)
    stats = player.setdefault("stats", default_stats())
    stats["fines_paid"] = stats.get("fines_paid", 0) + lost
    stats["missions_police"] = stats.get("missions_police", 0) + 1
    # 40% chance a random member gets arrested.
    if m.get("member_ids") and random.random() < 0.4:
        victim_id = random.choice(m["member_ids"])
        bonuses = await get_org_bonuses(db, m["player_id"])
        # Advogado na equipa (SSS v4): trata da papelada mal chegam à esquadra.
        lawyer_mult = LAWYER_ARREST_MULT if m.get("has_lawyer") else 1.0
        until = (now_utc() + timedelta(seconds=480 * (1 - bonuses["legal"]) * lawyer_mult)).isoformat()
        await db.employees.update_one(
            {"_id": ObjectId(victim_id)},
            {"$set": {"status": "arrested", "status_until": until}},
        )
        emp = await db.employees.find_one({"_id": ObjectId(victim_id)})
        if emp:
            await push_history(db, emp["_id"], "Preso na perseguição de regresso à base.")
            suffix = " O advogado da equipa já está a tratar da libertação." if m.get("has_lawyer") else ""
            await add_event(db, m["player_id"], "police",
                            f"{emp['name']} foi PRESO durante a perseguição policial!{suffix}")
    await add_event(db, m["player_id"], "police",
                    f"POLÍCIA APANHOU {m['team_name']} antes do QG — perdeu {lost:,} € do assalto.")
    return "caught"


async def _pay_pending_reward(db, player, m):
    reward = int(m.get("pending_reward", 0) or 0)
    if reward <= 0:
        return
    pays = m.get("pending_pays") or m.get("opportunity", {}).get("pays", "dirty")
    stats = player.setdefault("stats", default_stats())
    wasted = 0
    if pays == "clean":
        player["clean_money"] += reward
        stats["earned_clean"] = stats.get("earned_clean", 0) + reward
    else:
        cap = dirty_money_cap(player.get("level", 1))
        room = max(0, cap - player["dirty_money"])
        credited = min(reward, room)
        wasted = reward - credited
        player["dirty_money"] += credited
        stats["earned_dirty"] = stats.get("earned_dirty", 0) + credited
    # Persist money & stats immediately.
    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "clean_money": player["clean_money"], "dirty_money": player["dirty_money"],
        "stats": stats,
    }})
    kind = "success"
    label = "limpos" if pays == "clean" else "sujos"
    await add_event(db, m["player_id"], kind,
                    f"{m['team_name']} entregou {reward:,} € {label} no QG.")
    await record_tx(db, m["player_id"], "mission_reward", reward - wasted, pays,
                     player["clean_money"] if pays == "clean" else player["dirty_money"],
                     f"Recompensa de {m['team_name']}: {m['opportunity']['name']}")
    if wasted > 0:
        await add_event(db, m["player_id"], "police",
                        f"Armazenamento de dinheiro sujo no limite — {wasted:,} € foram desperdiçados. Lava dinheiro para abrir espaço.")


def _failure_cause_suffix(m):
    """Forense pós-operação (SSS v3): aponta o fator negativo mais pesado do
    despacho — o jogador aprende PORQUÊ falhou, não apenas QUE falhou."""
    cause = (m.get("top_negatives") or [None])[0]
    if not cause:
        return ""
    return f" Fator crítico: {cause['label']} ({round(cause['pct'] * 100)}%)."


def _jam_suffix(m):
    """Relatório de encravamento (SSS v5): o jogador fica a saber QUAL arma
    encravou e DE QUEM era — para reparar, substituir ou vender."""
    jams = m.get("weapon_jams") or []
    if not jams:
        return ""
    if len(jams) == 1:
        j = jams[0]
        return f" A {j.get('weapon_name', 'arma')} de {j.get('emp_name', '?')} ENCRAVOU no pior momento."
    return f" {len(jams)} armas ENCRAVARAM durante a ação — o arsenal precisa de manutenção."


def _outcome_message(m, outcome):
    t = m["opportunity"]
    symbol = "€ limpos" if t["pays"] == "clean" else "€ sujos"
    if outcome == "success":
        reward = int(m.get("pending_reward", t.get("reward", 0)) or 0)
        chase = m.get("chase_active")
        base = f"{m['team_name']} concluiu {t['name']} em {t['district']}: leva {reward:,} {symbol}"
        if chase:
            base += f" — POLÍCIA em perseguição (escape ≈ {int((m.get('escape_chance', 0.5)) * 100)}%)"
        else:
            base += ", regressa em segurança"
        base += f", +{t['respect']} respeito."
        return base + _jam_suffix(m)
    if outcome == "partial":
        reward = int(m.get("pending_reward", 0) or 0)
        frac = int(m.get("partial_fraction", 0.6) * 100)
        if m.get("clutch_save"):
            base = f"O líder de {m['team_name']} manteve o sangue-frio quando tudo parecia perdido em {t['name']} ({t['district']}) — improvisou e salvou {reward:,} {symbol} ({frac}% do saque)"
        else:
            base = f"{m['team_name']} teve de abortar {t['name']} em {t['district']} a meio — salvou {reward:,} {symbol} ({frac}% do saque)"
        if m.get("chase_active"):
            base += f" — POLÍCIA em perseguição (escape ≈ {int((m.get('escape_chance', 0.5)) * 100)}%)"
        base += "."
        return base + _jam_suffix(m)
    if outcome == "failure":
        return f"{m['team_name']} falhou {t['name']} em {t['district']}. A operação foi abortada.{_failure_cause_suffix(m)}{_jam_suffix(m)}"
    fine = m.get("fine", 0)
    return f"A polícia intercetou {m['team_name']} durante {t['name']} em {t['district']}. Multa de {fine:,} €.{_failure_cause_suffix(m)}{_jam_suffix(m)}"


async def _crew_returns(db, player, m, outcome):
    t = m["opportunity"]
    pid = m["player_id"]
    bonuses = await get_org_bonuses(db, pid)
    members = []
    for emp_id in m.get("member_ids", []):
        emp = await db.employees.find_one({"_id": ObjectId(emp_id)})
        if emp:
            members.append(emp)

    # Missões muito abaixo do nível da organização rendem menos XP.
    level_gap = max(0, player.get("level", 1) - t.get("min_level", 1) - LOW_LEVEL_XP_GAP)
    low_level_mult = max(LOW_LEVEL_XP_MULT_MIN, 1 - LOW_LEVEL_XP_MULT_PER_GAP * level_gap)

    for emp in members:
        match = emp.get("spec") == t["category"] or t["category"] == "especial"

        # XP baseado em dificuldade real da operação (armazenado em m["reward_xp"] se disponível)
        # Fallback para cálculo clássico se não estiver disponível
        base_xp = m.get("reward_xp", max(1, int(t["respect"] * 0.5)))

        if outcome == "success":
            xp_gain = int(base_xp * (1.5 if match else 1.0))
            d_morale, d_loyal = 2, 1
        elif outcome == "partial":
            # Salvar parte do saque ainda ensina — mas deixa um travo amargo.
            xp_gain = max(1, int(base_xp * PARTIAL_XP_FRACTION * (1.5 if match else 1.0)))
            d_morale, d_loyal = -1, 0
        elif outcome == "failure":
            xp_gain = max(1, int(base_xp * 0.2))
            d_morale, d_loyal = -4, 0
        else:
            xp_gain = max(1, int(base_xp * 0.2))
            d_morale, d_loyal = -6, -2
        # Foi para a operação com a energia (fadiga) no máximo: pequeno bónus de XP.
        if emp["fatigue"] <= FULL_ENERGY_FATIGUE_MAX:
            xp_gain = int(xp_gain * (1 + FULL_ENERGY_XP_BONUS))
        # Repetir o mesmo tipo de operação consecutivamente rende menos XP —
        # incentiva variedade.
        if m.get("repeat_type"):
            xp_gain = int(xp_gain * REPEAT_TYPE_XP_MULT)
        xp_gain = max(1, int(xp_gain * low_level_mult))
        exceptional = random.random() < EXCEPTIONAL_PERFORMANCE_CHANCE
        if exceptional:
            xp_gain = int(xp_gain * (1 + EXCEPTIONAL_PERFORMANCE_XP_BONUS_PCT))
        xp = emp["xp"] + xp_gain
        rarity = emp.get("rarity", "comum")
        new_level = emp_level_for(xp, rarity)
        # Já no nível máximo para a raridade: XP deixa de acumular acima do
        # limiar, para não crescer indefinidamente sem efeito nenhum.
        max_level = RARITIES.get(rarity, RARITIES["comum"])["max_level"]
        if new_level >= max_level:
            xp = min(xp, EMP_LEVEL_XP[max_level - 1])
        fat_mult = 0.8 if "rei_da_noite" in emp.get("talents", []) else 1.0
        # Funcionários muito utilizados (muitas missões feitas) cansam-se mais
        # depressa — precisam de descansar com mais frequência.
        if emp.get("missions_done", 0) >= EMPLOYEE_HEAVY_USE_THRESHOLD:
            fat_mult *= EMPLOYEE_HEAVY_USE_FATIGUE_MULT
        sets = {
            "xp": xp, "level": new_level,
            "fatigue": min(100.0, emp["fatigue"] + (12 + t["risk"] * 4) * fat_mult),
            "morale": max(0.0, min(100.0, emp.get("morale", 70) + d_morale)),
            "loyalty": max(0.0, min(100.0, emp.get("loyalty", 70) + d_loyal)),
            "last_mission_at": now_utc().isoformat(),
            "missions_done": emp.get("missions_done", 0) + 1,
        }
        # Arma equipada: desgasta-se por missão (mirror do desgaste de
        # veículo mais abaixo) e o funcionário ganha proficiência na
        # categoria dessa arma (não na arma específica — sobrevive à troca
        # de arma dentro da mesma categoria).
        weapon = None
        if emp.get("weapon_id"):
            weapon = await db.weapons.find_one({"_id": ObjectId(emp["weapon_id"])})
        if weapon:
            model = WEAPON_MODELS.get(weapon["model_key"])
            if model:
                wcat = model["category"]
                proficiency = dict(emp.get("weapon_proficiency") or {})
                proficiency[wcat] = min(WEAPON_PROFICIENCY_MAX, proficiency.get(wcat, 0) + WEAPON_PROFICIENCY_GAIN_PER_MISSION)
                sets["weapon_proficiency"] = proficiency
        if exceptional:
            await push_history(db, emp["_id"], f"Desempenho excecional em {t['name']} — XP extra.")
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
        if weapon:
            w_model = WEAPON_MODELS.get(weapon["model_key"], {})
            # Durabilidade finalmente ligada (SSS v5): modelos robustos desgastam
            # devagar, modelos frágeis desfazem-se depressa — e uma arma que
            # encravou durante a ação perde condição extra.
            durability = max(30.0, float(w_model.get("durability", WEAPON_DURABILITY_WEAR_REF)))
            wear = (WEAPON_WEAR_PER_MISSION + t["risk"] * WEAPON_WEAR_RISK_MULT) * (WEAPON_DURABILITY_WEAR_REF / durability)
            jammed_ids = {j.get("weapon_id") for j in (m.get("weapon_jams") or [])}
            if str(weapon["_id"]) in jammed_ids:
                wear += WEAPON_JAM_EXTRA_WEAR
            new_w_condition = max(0.0, weapon.get("condition", 100.0) - wear)
            await db.weapons.update_one({"_id": weapon["_id"]}, {
                "$set": {"condition": new_w_condition},
                "$inc": {"missions_done": 1, "missions_since_repair": 1},
            })

    if members:
        if outcome == "failure":
            victim = random.choice(members)
            p = 0.35 if victim["fatigue"] > 70 else 0.2
            # Médico na equipa (SSS v4): estabiliza no terreno — ferimentos menos
            # prováveis e recuperação mais rápida.
            has_medic = m.get("has_medic", False)
            if has_medic:
                p *= MEDIC_INJURY_MULT
            if random.random() < p:
                duration = 300 * (1 - bonuses["heal"]) * (MEDIC_RECOVERY_MULT if has_medic else 1.0)
                until = (now_utc() + timedelta(seconds=duration)).isoformat()
                await db.employees.update_one({"_id": victim["_id"]}, {"$set": {"status": "injured", "status_until": until}})
                await push_history(db, victim["_id"], "Ferido em operação.")
                suffix = " O médico da equipa estabilizou-o — recupera mais depressa." if has_medic else ""
                await add_event(db, pid, "police", f"{victim['name']} ficou ferido durante {t['name']}!{suffix}")
        elif outcome == "police" and random.random() < 0.3:
            victim = random.choice(members)
            # Advogado na equipa (SSS v4): a prisão dura menos.
            lawyer_mult = LAWYER_ARREST_MULT if m.get("has_lawyer") else 1.0
            until = (now_utc() + timedelta(seconds=480 * (1 - bonuses["legal"]) * lawyer_mult)).isoformat()
            await db.employees.update_one({"_id": victim["_id"]}, {"$set": {"status": "arrested", "status_until": until}})
            await push_history(db, victim["_id"], "Preso pela polícia.")
            suffix = " O advogado da equipa já está a tratar da libertação." if m.get("has_lawyer") else ""
            await add_event(db, pid, "police", f"{victim['name']} foi PRESO durante {t['name']}!{suffix}")

    if m.get("vehicle_id"):
        veh = await db.vehicles.find_one({"_id": ObjectId(m["vehicle_id"])})
        if veh:
            # Veículos com muitos quilómetros acumulados, ou muitas missões desde a
            # última reparação, desgastam-se mais depressa por operação.
            wear_mult = 1 + (WEAR_KM_MAX_MULT - 1) * min(1.0, veh.get("km_total", 0) / WEAR_KM_RAMP)
            missions_since_repair = veh.get("missions_since_repair", 0)
            wear_mult += WEAR_PER_MISSION_SINCE_REPAIR * min(missions_since_repair, WEAR_MISSIONS_SINCE_REPAIR_CAP)
            # Desgaste re-derivado (SSS v3, constantes v2 finalmente ligadas):
            # componente fixa + risco + km reais percorridos — expedições longas
            # desgastam mais, operações à porta do QG desgastam menos.
            wear = (VEHICLE_WEAR_BASE + t["risk"] * VEHICLE_WEAR_PER_RISK
                    + VEHICLE_WEAR_PER_KM * float(m.get("round_km") or 0.0)) * wear_mult
            # Pequeno imprevisto: avaria inesperada após uma operação arriscada.
            if random.random() < UNEXPECTED_REPAIR_CHANCE_PER_RISK * t["risk"]:
                wear += UNEXPECTED_REPAIR_CONDITION_HIT
                await add_event(db, pid, "vehicle", f"{veh['name']} sofreu uma avaria inesperada durante {t['name']}.")
            new_condition = max(0.0, veh["condition"] - wear)
            inc = {"missions_done": 1, "missions_since_repair": 1}
            if outcome == "success":
                inc["missions_success"] = 1
            await db.vehicles.update_one({"_id": veh["_id"]}, {
                "$set": {"condition": new_condition},
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
        # Aviso inteligente do líder (SSS v4): se o calor disparou desde a
        # partida, o líder reporta do alvo — o jogador fica a saber que as
        # condições pioraram (a equipa mantém sempre a operação).
        heat_then = m.get("heat_at_dispatch")
        if m.get("has_leader") and heat_then is not None:
            heat_now = player.get("heat", 0)
            if heat_now - heat_then >= SMART_WARN_HEAT_DELTA:
                await add_event(db, m["player_id"], "intel",
                                f"Líder de {m['team_name']} reporta do alvo: o calor subiu de {round(heat_then)}% para {round(heat_now)}% desde a partida — condições piores do que o planeado. A equipa mantém a operação.")
    if phase == "operating" and now >= parse_dt(m["finish_at"]):
        outcome = _roll_outcome(player, m)
        _apply_outcome(player, m, outcome)
        await _crew_returns(db, player, m, outcome)
        phase = "returning"
        updates.update({"phase": phase, "outcome": outcome})
        # Persist pending reward and chase state so the front-end can display them.
        for k in ("pending_reward", "pending_pays", "chase_active", "chase_chance",
                  "escape_chance", "fine", "bonus_loot", "partial_fraction", "clutch_save",
                  "weapon_jams", "final_chance"):
            if k in m:
                updates[k] = m[k]
        # Guião de regresso em direto (SSS live ops): o desfecho e a perseguição
        # só são conhecidos agora — anexar os beats do regresso ao live_log.
        try:
            ret_entries, ret_used = build_return_script(
                m, parse_dt(m["finish_at"]), parse_dt(m["return_at"]),
                memory=player.get("phrase_memory"),
            )
            if ret_entries:
                updates["live_log"] = (m.get("live_log") or []) + ret_entries
            if ret_used:
                player["phrase_memory"] = update_memory(player.get("phrase_memory"), ret_used)
        except Exception:
            logger.exception("Falha a gerar o guião de regresso da missão %s", m.get("_id"))
        # Track success now (before pay-out): the operation succeeded, delivery is separate.
        stats = player.setdefault("stats", default_stats())
        if outcome == "success":
            stats["missions_success"] = stats.get("missions_success", 0) + 1
            # Métricas usadas pelas missões (quests) de categoria e alto valor —
            # sem estes incrementos, 19 quests ficavam impossíveis de completar.
            cat = m["opportunity"].get("category")
            if cat:
                stats.setdefault("success_by_category", {})
                stats["success_by_category"][cat] = stats["success_by_category"].get(cat, 0) + 1
            if int(m.get("pending_reward", 0) or 0) >= 8000:
                stats["high_value_ops"] = stats.get("high_value_ops", 0) + 1
            # Conquistas permanentes: cada marco de missões bem-sucedidas concede
            # um pequeno bónus passivo de recompensa, para sempre.
            player["achievement_bonus_pct"] = achievement_bonus_pct(stats["missions_success"])
            # Série de vitórias da organização (SSS v3): ao atingir o marco, o
            # mundo reage — o próximo tick gera um Golpe de Oportunidade especial.
            stats["current_success_streak"] = stats.get("current_success_streak", 0) + 1
            if stats["current_success_streak"] == STREAK_SPECIAL_THRESHOLD and not player.get("streak_op_pending"):
                player["streak_op_pending"] = True
                await add_event(db, m["player_id"], "intel",
                                f"As ruas falam da tua série de {STREAK_SPECIAL_THRESHOLD} vitórias — um Golpe de Oportunidade vai aparecer no mapa.")
        elif outcome in ("failure", "police"):
            stats["current_success_streak"] = 0
        # Momentum da equipa (SSS v3): vitórias somam, falhas invertem o sinal,
        # sucesso parcial não mexe — nem herói nem culpado.
        team_doc = await db.teams.find_one({"_id": team_oid})
        old_streak = int((team_doc or {}).get("streak", 0) or 0)
        if outcome == "success":
            new_streak = old_streak + 1 if old_streak >= 0 else 1
        elif outcome in ("failure", "police"):
            new_streak = old_streak - 1 if old_streak <= 0 else -1
        else:
            new_streak = old_streak
        await db.teams.update_one({"_id": team_oid}, {
            "$set": {"status": "returning", "streak": new_streak},
            # A equipa aprende (SSS v4): qualquer operação concluída conta para a
            # familiaridade da categoria e para o entrosamento do plantel atual.
            "$inc": {"missions_done": 1, "roster_missions": 1,
                     f"category_missions.{m['opportunity'].get('category', 'especial')}": 1},
        })
        kind = "success" if outcome in ("success", "partial") else ("police" if outcome == "police" else "failure")
        await add_event(db, m["player_id"], kind, _outcome_message(m, outcome))
    if phase == "returning" and now >= parse_dt(m["return_at"]):
        # Resolve chase (if any) and pay pending reward on arrival at HQ.
        if m.get("outcome") in ("success", "partial"):
            await _resolve_chase(db, player, m)
            for k in ("pending_reward", "chase_outcome"):
                if k in m:
                    updates[k] = m[k]
            if int(m.get("pending_reward", 0) or 0) > 0:
                await _pay_pending_reward(db, player, m)
        phase = "done"
        updates["phase"] = phase
        reorg_until = (now + timedelta(seconds=REORG_AFTER_MISSION_S)).isoformat()
        await db.teams.update_one({"_id": team_oid}, {"$set": {"status": "idle", "available_at": reorg_until}})
        if m.get("member_ids"):
            await db.employees.update_many(
                {"_id": {"$in": [ObjectId(i) for i in m["member_ids"]]}, "status": "on_mission"},
                {"$set": {"status": "idle"}},
            )
        if m.get("opportunity_id"):
            await db.opportunities.update_one(
                {"_id": ObjectId(m["opportunity_id"])},
                {"$set": {"status": "consumed"}},
            )
        await add_event(db, m["player_id"], "team", f"{m['team_name']} regressou à base.")
    if updates:
        await db.missions.update_one({"_id": m["_id"]}, {"$set": updates})


# ---------------- Ciclos de vida dos funcionários ----------------

async def _complete_trainings(db, player, now):
    pid = str(player["_id"])
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
        player["stats"]["trainings_completed"] = player["stats"].get("trainings_completed", 0) + 1
        msg = f"{e['name']} concluiu a formação {course['name']}"
        if course.get("attr"):
            msg += f" (+1 {course['attr'].upper()})"
        msg += "."
        if new_level > e["level"]:
            msg += f" Subiu para o nível {new_level}!"
        await push_history(db, e["_id"], f"Formação {course['name']} concluída.")
        await add_event(db, pid, "team", msg)


async def _process_statuses(db, pid, now):
    docs = await db.employees.find({"player_id": pid, "status": {"$in": ["resting", "injured", "arrested", "absent"]}}).to_list(300)
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
        elif e["status"] == "absent":
            msg = f"{e['name']} voltou ao trabalho."
        else:
            sets["morale"] = max(0.0, e.get("morale", 70) - 5)
            msg = f"{e['name']} cumpriu a pena e saiu da prisão."
        await db.employees.update_one({"_id": e["_id"]}, {"$set": sets})
        await push_history(db, e["_id"], msg)
        await add_event(db, pid, "team", msg)


BAILOUT_GRANT = 8000
BAILOUT_MIN_FUNDS = 6000  # candidato "comum" mais barato ronda ~4.300€; margem de segurança


async def _maybe_grant_bailout(db, player, employees):
    """Rede de segurança única: se a organização ficar sem ninguém e sem
    fundos para recrutar (por atraso salarial, despedimentos, etc.), o
    jogador fica bloqueado sem forma de recuperar. Empresta-se capital de
    emergência uma única vez por jogador."""
    if employees or player.get("bailout_used") or player["clean_money"] >= BAILOUT_MIN_FUNDS:
        return
    pid = str(player["_id"])
    player["clean_money"] += BAILOUT_GRANT
    player["bailout_used"] = True
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"bailout_used": True}})
    await add_event(
        db, pid, "system",
        f"A organização ficou sem pessoal e sem fundos — um contacto antigo emprestou {BAILOUT_GRANT:,} € "
        "para reergueres o negócio. Este apoio só acontece uma vez, por isso mantém os salários em dia.",
    )


async def _process_payroll(db, player, employees, now):
    pid = str(player["_id"])
    if not player.get("next_payroll_at"):
        player["next_payroll_at"] = (now + timedelta(minutes=PAYROLL_CYCLE_MIN)).isoformat()
        return
    cycles = 0
    while parse_dt(player["next_payroll_at"]) <= now and cycles < 4:
        cycles += 1
        player["next_payroll_at"] = (parse_dt(player["next_payroll_at"]) + timedelta(minutes=PAYROLL_CYCLE_MIN)).isoformat()
        base_total = sum(e.get("salary", 0) for e in employees)
        # Team cost scaling: larger teams pay more per cycle (multiplicative, not linear)
        # Formula: (num_employees / 2) ^ 0.5
        # At 2 employees: 1.0x, at 4: 1.41x, at 8: 2.0x, at 16: 2.83x
        team_scaling = (max(1, len(employees)) / 2) ** TEAM_COST_SCALING_BASE
        total = int(base_total * team_scaling)
        if total <= 0:
            continue
        if player["clean_money"] >= total:
            player["clean_money"] -= total
            await add_event(db, pid, "system", f"Ciclo salarial pago: -{total:,} €.")
            await record_tx(db, pid, "payroll", -total, "clean", player["clean_money"], "Ciclo salarial")
            # Salários em dia recuperam lentamente a moral e a lealdade do efetivo.
            idle_ids = [e["_id"] for e in employees if e.get("status") == "idle"]
            if idle_ids:
                await db.employees.update_many(
                    {"_id": {"$in": idle_ids}, "morale": {"$lt": 100.0}},
                    {"$inc": {"morale": PAYROLL_MORALE_REGEN, "loyalty": PAYROLL_MORALE_REGEN}},
                )
                await db.employees.update_many({"_id": {"$in": idle_ids}, "morale": {"$gt": 100.0}}, {"$set": {"morale": 100.0}})
                await db.employees.update_many({"_id": {"$in": idle_ids}, "loyalty": {"$gt": 100.0}}, {"$set": {"loyalty": 100.0}})
        else:
            await add_event(db, pid, "police", f"Sem fundos para os salários ({total:,} €)! Moral e lealdade em queda.")
            for e in employees:
                e["loyalty"] = max(0.0, e.get("loyalty", 70) - 8)
                e["morale"] = max(0.0, e.get("morale", 70) - 10)
            would_leave = [e for e in employees if e["loyalty"] <= 10 and e.get("status") == "idle"]
            # Nunca deixar a organização ficar sem ninguém só por salários em
            # atraso — o mais leal dos que sairiam fica (a contragosto) para
            # não bloquear o jogador sem forma de recuperar.
            spare_id = None
            if would_leave and len(would_leave) == len(employees):
                spare_id = max(would_leave, key=lambda e: e["loyalty"])["_id"]
            survivors = []
            for e in employees:
                if e in would_leave and e["_id"] != spare_id:
                    await _unlink_employee_weapon(db, e["_id"])
                    await db.employees.delete_one({"_id": e["_id"]})
                    await add_event(db, pid, "police", f"{e['name']} abandonou a organização por salários em atraso!")
                else:
                    note = "Salário em atraso." if e["_id"] != spare_id else "Ficou apesar do atraso — é o último e não abandona a organização sozinho."
                    await db.employees.update_one({"_id": e["_id"]}, {"$set": {"loyalty": e["loyalty"], "morale": e["morale"]}})
                    await push_history(db, e["_id"], note)
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
            await _unlink_employee_weapon(db, e["_id"])
            await db.employees.delete_one({"_id": e["_id"]})
            await add_event(db, pid, "police", f"{e['name']} abandonou a organização!")
            break
        await db.employees.update_one({"_id": e["_id"]}, {"$set": {"loyalty": min(100.0, e["loyalty"] + 25)}})
        await push_history(db, e["_id"], f"Traição: {kind}.")
        await add_event(db, pid, "police", msg)
        break


async def _process_absences(db, player, employees, minutes, now):
    """Moral muito baixa pode levar um funcionário a faltar ao trabalho por um tempo."""
    if minutes <= 0:
        return
    pid = str(player["_id"])
    for e in employees:
        if e.get("status") != "idle" or e.get("morale", 70) >= LOW_MORALE_ABSENCE_THRESHOLD:
            continue
        prob = min(0.5, minutes * ABSENCE_CHANCE_PER_MIN)
        if random.random() >= prob:
            continue
        until = (now + timedelta(seconds=ABSENCE_DURATION_S)).isoformat()
        await db.employees.update_one({"_id": e["_id"]}, {"$set": {"status": "absent", "status_until": until}})
        await push_history(db, e["_id"], "Faltou ao trabalho — moral demasiado baixa.")
        await add_event(db, pid, "team", f"{e['name']} faltou ao trabalho — moral demasiado baixa.")
        break


async def _process_xp_decay(db, player, employees, minutes, now):
    """Quem fica muitos dias sem participar numa missão perde alguma experiência
    prática — nunca abaixo do mínimo exigido para o nível atual."""
    if minutes <= 0:
        return
    for e in employees:
        last = e.get("last_mission_at") or e.get("hired_at")
        if not last:
            continue
        idle_days = (now - parse_dt(last)).total_seconds() / 86400
        if idle_days < XP_DECAY_IDLE_DAYS:
            continue
        level = max(1, e.get("level", 1))
        floor_xp = EMP_LEVEL_XP[min(level - 1, len(EMP_LEVEL_XP) - 1)]
        loss = XP_DECAY_PER_MIN * minutes
        new_xp = int(max(floor_xp, e["xp"] - loss))
        if new_xp < e["xp"]:
            await db.employees.update_one({"_id": e["_id"]}, {"$set": {"xp": new_xp}})


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


async def grant_quest_rewards(db, player, rw):
    pid = str(player["_id"])
    now_iso = now_utc().isoformat()
    parts, inc, sets = [], {}, {}
    if rw.get("dirty"):
        inc["dirty_money"] = rw["dirty"]
        parts.append(f"+{rw['dirty']:,} € sujos")
    if rw.get("clean"):
        inc["clean_money"] = inc.get("clean_money", 0) + rw["clean"]
        parts.append(f"+{rw['clean']:,} € limpos")
    if rw.get("respect"):
        inc["respect"] = rw["respect"]
        parts.append(f"+{rw['respect']} respeito")
    if rw.get("heat"):
        sets["heat"] = max(0.0, min(100.0, player["heat"] + rw["heat"]))
        parts.append(f"{rw['heat']} calor")
    if rw.get("vehicle"):
        m = VEHICLE_MODELS[rw["vehicle"]]
        caps, _ = await get_caps(db, pid, player["hq"]["level"])
        used = await db.vehicles.count_documents({"player_id": pid})
        if used < caps["vehicles"]:
            await db.vehicles.insert_one(vehicle_doc(pid, rw["vehicle"], now_iso))
            parts.append(f"{m['name']} novo na garagem")
        else:
            inc["clean_money"] = inc.get("clean_money", 0) + m["price"]
            parts.append(f"+{m['price']:,} € limpos (garagem cheia)")
    if rw.get("employee"):
        er = rw["employee"]
        role, rarity = er["role"], er["rarity"]
        caps, _ = await get_caps(db, pid, player["hq"]["level"])
        used = await db.employees.count_documents({"player_id": pid})
        if used < caps["employees"]:
            sp = SPECIALIZATIONS[role]
            await db.employees.insert_one({
                "player_id": pid, "name": random_employee_name(), "age": random.randint(20, 50),
                "role_key": role, "spec": sp["spec"], "rarity": rarity,
                "rank": "recruta", "level": 1, "xp": 0,
                "salary": int(sp["salary"] * RARITIES[rarity]["mult"]),
                "loyalty": 80.0, "morale": 80.0, "fatigue": 0.0,
                "attrs": gen_attrs(role, rarity), "talents": gen_talents(role, rarity),
                "status": "idle", "status_until": None, "team_id": None, "training": None,
                "history": [{"ts": now_iso, "text": "Juntou-se como recompensa de missão."}],
                "hired_at": now_iso,
            })
            parts.append(f"{sp['name']} {RARITIES[rarity]['name']} juntou-se à organização")
        else:
            fb = er.get("fallback_clean", 10000)
            inc["clean_money"] = inc.get("clean_money", 0) + fb
            parts.append(f"+{fb:,} € limpos (sem espaço no esconderijo)")
    if rw.get("temp_bonus"):
        tb = rw["temp_bonus"]
        sets["temp_bonus"] = {"kind": tb["kind"], "pct": tb["pct"],
                              "until": (now_utc() + timedelta(seconds=tb["duration_s"])).isoformat()}
        parts.append(f"+{int(tb['pct'] * 100)}% recompensas durante {tb['duration_s'] // 60} min")
    update = {}
    if inc:
        update["$inc"] = inc
    if sets:
        update["$set"] = sets
    if update:
        await db.players.update_one({"_id": player["_id"]}, update)
    # Reflete as alterações também no objeto em memória — necessário quando esta
    # função é chamada a partir do advance() (auto-reclamar missões), que faz um
    # persist final do estado inteiro do jogador a partir deste dicionário, o que
    # apagaria silenciosamente o $inc/$set feito diretamente na base de dados.
    for k, v in inc.items():
        player[k] = player.get(k, 0) + v
    player.update(sets)
    return parts


# ---------------- Automatizações ----------------

DEFAULT_SETTINGS = {
    "auto_repair_enabled": False, "auto_repair_threshold": 30,
    "auto_refuel_enabled": False, "auto_refuel_threshold": 20,
    "auto_rest_enabled": False, "auto_rest_threshold": 20,
    "auto_claim_quests": False,
}


async def _auto_repair_vehicles(db, player, vehicles, teams_by_id, props, bonuses, settings, now):
    threshold = max(1, min(99, settings.get("auto_repair_threshold", 30)))
    prop_ranks = property_stack_ranks(props)
    oficina_pct = PROPERTY_TYPES["oficina"]["repair_discount_pct"]
    pid = str(player["_id"])
    for v in vehicles:
        if v["condition"] >= threshold:
            continue
        team = teams_by_id.get(v.get("team_id"))
        if team and team.get("status") != "idle":
            continue
        missing = 100 - v["condition"]
        if missing < 1:
            continue
        discount = min(0.6, sum(
            oficina_pct * p["level"] * property_condition_factor(p) * property_stack_mult(prop_ranks[p["_id"]])
            for p in props if p["type_key"] == "oficina" and property_active(p, now)
        ) + bonuses["repair_discount"])
        cost = max(50, int(missing * v["price"] * 0.002 * (1 - discount)))
        if player["clean_money"] < cost:
            continue
        player["clean_money"] -= cost
        player.setdefault("stats", default_stats())["vehicles_repaired"] = \
            player["stats"].get("vehicles_repaired", 0) + 1
        await db.vehicles.update_one({"_id": v["_id"]}, {
            "$set": {"condition": 100.0, "missions_since_repair": 0},
            "$inc": {"repair_spent_total": cost},
        })
        await add_event(db, pid, "vehicle", f"{v['name']} reparado automaticamente por {cost:,} €.")
        await record_tx(db, pid, "repair", -cost, "clean", player["clean_money"], f"Reparação automática de {v['name']}")


async def _auto_refuel_vehicles(db, player, vehicles, teams_by_id, settings, now):
    threshold = max(1, min(99, settings.get("auto_refuel_threshold", 20)))
    pid = str(player["_id"])
    for v in vehicles:
        if v.get("refueling_until") and parse_dt(v["refueling_until"]) > now:
            continue
        fuel_pct = (v["fuel_l"] / v["tank_l"] * 100) if v["tank_l"] > 0 else 100
        if fuel_pct >= threshold:
            continue
        team = teams_by_id.get(v.get("team_id"))
        if team and team.get("status") != "idle":
            continue
        missing = v["tank_l"] - v["fuel_l"]
        if missing <= 0.1:
            continue
        cost = math.ceil(missing * FUEL_PRICES[v["fuel_type"]])
        if player["clean_money"] < cost:
            continue
        duration_s = REFUEL_DURATION_BASE_S + REFUEL_DURATION_PER_L_S * missing
        until = (now + timedelta(seconds=duration_s)).isoformat()
        player["clean_money"] -= cost
        player.setdefault("stats", default_stats())["vehicles_refueled"] = \
            player["stats"].get("vehicles_refueled", 0) + 1
        await db.vehicles.update_one({"_id": v["_id"]}, {"$set": {"refueling_until": until}, "$inc": {"fuel_spent_total": cost}})
        await add_event(db, pid, "vehicle", f"{v['name']} a abastecer automaticamente por {cost:,} € — pronto em {round(duration_s)}s.")
        await record_tx(db, pid, "refuel", -cost, "clean", player["clean_money"], f"Combustível automático para {v['name']}")


async def _auto_rest_employees(db, player, employees, settings, now):
    threshold = max(1, min(99, settings.get("auto_rest_threshold", 20)))
    fatigue_floor = 100 - threshold
    pid = str(player["_id"])
    for e in employees:
        if e.get("status") != "idle" or e.get("fatigue", 0) < max(15, fatigue_floor):
            continue
        until = (now + timedelta(seconds=REST_DURATION_S)).isoformat()
        await db.employees.update_one({"_id": e["_id"]}, {"$set": {"status": "resting", "status_until": until}})
        player.setdefault("stats", default_stats())["employees_rested"] = \
            player["stats"].get("employees_rested", 0) + 1
        await add_event(db, pid, "team", f"{e['name']} foi descansar automaticamente.")


async def _auto_claim_quests(db, player, now):
    pid = str(player["_id"])
    completed = await db.quests.find({"player_id": pid, "status": "completed"}).to_list(50)
    for q in completed:
        d = QUEST_DEFS.get(q["quest_key"])
        if not d:
            continue
        # Recompensas dinâmicas (SSS v3): nível × dificuldade × tier adaptativo
        # × streak — o mesmo cálculo do claim manual, para consistência total.
        rewards, streak_note = effective_quest_rewards(player, q, d, now)
        parts = await grant_quest_rewards(db, player, rewards)
        if streak_note:
            parts.append(streak_note)
        await db.quests.update_one({"_id": q["_id"]}, {"$set": {"status": "claimed", "claimed_at": now.isoformat()}})
        if q["quest_key"] == "c2_front":
            await db.quests.insert_one(make_instance(pid, "dec_informador", now, player.get("stats", {}), expires_s=3600))
            await add_event(db, pid, "intel", "DECISÃO: O Informador quer falar contigo — abre o painel de Missões.")
        msg = f"Recompensa reclamada automaticamente — {d['name']}: " + ", ".join(parts) + "." if parts else f"Missão {d['name']} reclamada automaticamente."
        await add_event(db, pid, "success", msg)


async def process_automations(db, player, employees, vehicles, props, bonuses, now):
    settings = {**DEFAULT_SETTINGS, **(player.get("settings") or {})}
    if not any(settings.get(k) for k in ("auto_repair_enabled", "auto_refuel_enabled", "auto_rest_enabled", "auto_claim_quests")):
        return
    teams_by_id = {}
    if settings.get("auto_repair_enabled") or settings.get("auto_refuel_enabled"):
        pid = str(player["_id"])
        teams = await db.teams.find({"player_id": pid}).to_list(50)
        teams_by_id = {str(t["_id"]): t for t in teams}
    if settings.get("auto_repair_enabled"):
        await _auto_repair_vehicles(db, player, vehicles, teams_by_id, props, bonuses, settings, now)
    if settings.get("auto_refuel_enabled"):
        await _auto_refuel_vehicles(db, player, vehicles, teams_by_id, settings, now)
    if settings.get("auto_rest_enabled"):
        await _auto_rest_employees(db, player, employees, settings, now)
    if settings.get("auto_claim_quests"):
        await _auto_claim_quests(db, player, now)


# ---------------- Economia passiva / polícia ----------------

def property_active(p, now):
    """Um imóvel em melhoria não presta os seus benefícios passivos até terminar."""
    upgrading_until = p.get("upgrading_until")
    return not (upgrading_until and parse_dt(upgrading_until) > now)


def property_condition_factor(p):
    """Imóveis degradados (manutenção em atraso) rendem menos."""
    return p.get("condition", 100.0) / 100.0


async def _apply_passive_income(db, player, props, hours, bonuses, now):
    if hours <= 0:
        return
    dirty_rate = 0
    heat_rate = 0
    launder_rate = 0
    # Químicos na equipa tornam os laboratórios mais produtivos.
    lab_mult = 1 + bonuses.get("lab_boost", 0)
    # O Quartel-General melhora a eficiência de todas as propriedades: mais
    # produção/lavagem passiva e menos calor gerado pelas ilegais.
    hq_tier = HQ_LEVEL_BENEFITS[min(player["hq"]["level"], HQ_MAX_LEVEL) - 1]
    # VIP da loja (comprado com dinheiro do jogo): bónus modesto, mesmo gate
    # dos benefícios por nível de QG — não é um sistema de bónus novo.
    vip_active = bool(player.get("vip_until")) and parse_dt(player["vip_until"]) > now
    hq_income_mult = (1 + hq_tier["passive_income_pct"]) * (VIP_INCOME_MULT if vip_active else 1.0)
    hq_heat_mult = (1 - hq_tier["heat_reduction_pct"]) * (VIP_HEAT_RELIEF_MULT if vip_active else 1.0)
    for p in props:
        if not property_active(p, now):
            continue
        pt = PROPERTY_TYPES[p["type_key"]]
        factor = property_condition_factor(p)
        if pt.get("dirty_per_h"):
            rate = pt["dirty_per_h"] * p["level"] * factor * lab_mult * hq_income_mult
            share = rate * hours
            dirty_rate += rate
            await db.properties.update_one({"_id": p["_id"]}, {"$inc": {"total_dirty_generated": share}})
        if pt.get("heat_per_h"):
            heat_rate += pt["heat_per_h"] * p["level"] * factor * hq_heat_mult
        if pt.get("launder_per_h"):
            launder_rate += pt["launder_per_h"] * p["level"] * factor
    launder_rate *= (1 + bonuses.get("empresa_boost", 0)) * hq_income_mult

    if dirty_rate > 0:
        fd = player.get("frac_dirty", 0.0) + dirty_rate * hours
        gain = int(fd)
        player["frac_dirty"] = fd - gain
        # Limite de armazenamento de dinheiro sujo — produção acima da capacidade
        # é desperdiçada (incentiva lavar regularmente em vez de deixar acumular).
        cap = dirty_money_cap(player.get("level", 1))
        room = max(0, cap - player["dirty_money"])
        player["dirty_money"] += min(gain, room)
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
                if not property_active(p, now):
                    continue
                pt = PROPERTY_TYPES[p["type_key"]]
                if pt.get("launder_per_h"):
                    factor = property_condition_factor(p)
                    share = conv * (pt["launder_per_h"] * p["level"] * factor * (1 + bonuses.get("empresa_boost", 0)) * hq_income_mult / launder_rate)
                    await db.properties.update_one({"_id": p["_id"]}, {"$inc": {"total_laundered": share}})


async def _process_property_maintenance(db, player, props, minutes, now):
    """Cada imóvel tem um custo diário de manutenção. Se a organização não
    conseguir pagá-lo, os imóveis degradam-se lentamente (menos condição, menos
    benefício); se conseguir, recuperam condição aos poucos."""
    if minutes <= 0 or not props:
        return
    hours = minutes / 60
    total_cost = sum(
        PROPERTY_TYPES[p["type_key"]]["price"] * p["level"] * PROPERTY_MAINTENANCE_PCT_PER_DAY / 24 * hours
        for p in props
    )
    can_pay = player["clean_money"] >= total_cost
    if can_pay and total_cost > 0:
        player["clean_money"] -= int(total_cost)
    delta = (PROPERTY_CONDITION_RECOVERY_PER_HOUR if can_pay else -PROPERTY_CONDITION_DECAY_PER_HOUR) * hours
    for p in props:
        new_condition = max(0.0, min(100.0, p.get("condition", 100.0) + delta))
        if new_condition != p.get("condition", 100.0):
            await db.properties.update_one({"_id": p["_id"]}, {"$set": {"condition": new_condition}})


async def _complete_property_upgrades(db, player, props, now):
    for p in props:
        upgrading_until = p.get("upgrading_until")
        if not upgrading_until or parse_dt(upgrading_until) > now:
            continue
        new_level = p["level"] + 1
        await db.properties.update_one({"_id": p["_id"]}, {"$set": {"level": new_level, "upgrading_until": None}})
        pid = str(player["_id"])
        await add_event(db, pid, "property", f"{p['name']} concluiu a melhoria — agora no nível {new_level}.")


async def _complete_hq_upgrade(db, player, now):
    """Como _complete_property_upgrades, mas para o Quartel-General: o campo
    `hq` vive dentro do documento do jogador, não numa coleção própria, e o
    `advance()` só persiste um subconjunto fixo de campos do jogador no fim
    (ver o `$set` explícito no fundo desta função) — por isso escrevemos aqui
    diretamente na base de dados, e atualizamos também `player["hq"]` em
    memória, já que o mesmo dict é devolvido por `advance()` e serializado
    logo a seguir em GET /state."""
    hq = player["hq"]
    upgrading_until = hq.get("upgrading_until")
    if not upgrading_until or parse_dt(upgrading_until) > now:
        return
    new_level = hq["level"] + 1
    now_iso = now.isoformat()
    history_entry = {"level": new_level, "completed_at": now_iso}
    await db.players.update_one({"_id": player["_id"]}, {
        "$set": {"hq.level": new_level, "hq.upgrading_until": None},
        "$push": {"hq.upgrade_history": history_entry},
    })
    hq["level"] = new_level
    hq["upgrading_until"] = None
    hq.setdefault("upgrade_history", []).append(history_entry)
    await add_event(db, str(player["_id"]), "property", f"Quartel-General concluiu a melhoria — agora no nível {new_level}.")


async def _complete_refuels(db, player, vehicles, now):
    """Abastecer não é instantâneo — enche o depósito só quando o tempo de
    espera termina (nunca acima de 100%)."""
    for v in vehicles:
        until = v.get("refueling_until")
        if not until or parse_dt(until) > now:
            continue
        await db.vehicles.update_one({"_id": v["_id"]}, {"$set": {"fuel_l": v["tank_l"], "refueling_until": None}})
        await add_event(db, str(player["_id"]), "vehicle", f"{v['name']} terminou de abastecer — depósito cheio.")


async def _complete_vehicle_transfers(db, player, vehicles, props_by_id, now):
    """Transferência entre bases não é instantânea — o veículo só passa a
    pertencer à propriedade destino quando o tempo de trânsito termina."""
    for v in vehicles:
        tr = v.get("transfer")
        if not tr or parse_dt(tr["ends_at"]) > now:
            continue
        new_pid = tr.get("to_property_id")
        await db.vehicles.update_one({"_id": v["_id"]}, {"$set": {"property_id": new_pid, "transfer": None}})
        dest_name = props_by_id[new_pid]["name"] if new_pid and new_pid in props_by_id else player["hq"]["name"]
        await add_event(db, str(player["_id"]), "vehicle", f"{v['name']} chegou a {dest_name}.")


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
    player["stats"]["raids_survived"] = player["stats"].get("raids_survived", 0) + 1
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
        try:
            await _progress_mission(db, player, m, now)
        except Exception:
            # Uma missão com dados inesperados nunca deve derrubar o
            # /game/state inteiro (dinheiro, equipas, tudo) — regista o erro
            # e avança para a próxima missão; esta fica por resolver neste
            # tick e tenta-se de novo no próximo.
            logger.exception("Falha ao processar missão %s (player %s)", m.get("_id"), pid)

    await _complete_trainings(db, player, now)
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
    await _maybe_grant_bailout(db, player, employees)
    await _process_betrayals(db, player, employees, minutes)
    await _process_absences(db, player, employees, minutes, now)
    await _process_xp_decay(db, player, employees, minutes, now)
    await _refresh_recruitment_pool(db, player, now)

    props = await db.properties.find({"player_id": pid}).to_list(200)
    await _apply_passive_income(db, player, props, minutes / 60, bonuses, now)
    await _process_property_maintenance(db, player, props, minutes, now)
    await _complete_property_upgrades(db, player, props, now)
    await _complete_hq_upgrade(db, player, now)
    await _maybe_raid(db, player, props, minutes, now)

    vehicles = await db.vehicles.find({"player_id": pid}).to_list(100)
    await _complete_refuels(db, player, vehicles, now)
    await _complete_vehicle_transfers(db, player, vehicles, {str(p["_id"]): p for p in props}, now)
    await process_quests(db, player, {"employees": employees, "props": props,
                                      "vehicles": vehicles, "minutes": minutes,
                                      "dirty_cap": dirty_money_cap(player["level"])})
    await process_automations(db, player, employees, vehicles, props, bonuses, now)

    # Decaimento de calor não-linear (SSS v3, constantes v2 finalmente ligadas):
    # calor baixo dissipa mais depressa, calor alto "cola-se" — picos pesam.
    decay_rate = max(0.3, HEAT_DECAY_BASE_PER_MIN - HEAT_DECAY_SLOPE * (player["heat"] / 100))
    player["heat"] = round(max(0.0, player["heat"] - minutes * decay_rate), 3)
    # A atenção policial por distrito arrefece com o tempo — zonas quentes
    # voltam gradualmente a ser operáveis.
    if minutes > 0 and player.get("district_attention"):
        cooled = {}
        for k, v in player["district_attention"].items():
            nv = round(min(DISTRICT_ATTENTION_MAX, float(v)) - minutes * DISTRICT_ATTENTION_DECAY_PER_MIN, 2)
            if nv > 0.5:
                cooled[k] = nv
        player["district_attention"] = cooled
    apply_dirty_money_heat(player, minutes / 60)
    player["level"] = level_for(player["respect"])
    player["last_tick"] = now.isoformat()

    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "heat": player["heat"], "level": player["level"], "last_tick": player["last_tick"],
        "clean_money": player["clean_money"], "dirty_money": player["dirty_money"],
        "respect": player["respect"], "stats": player["stats"],
        "raid_cooldown_until": player.get("raid_cooldown_until"),
        "next_payroll_at": player.get("next_payroll_at"),
        "pool_refresh_at": player.get("pool_refresh_at"),
        "quests_daily_at": player.get("quests_daily_at"),
        "quests_weekly_at": player.get("quests_weekly_at"),
        "next_event_at": player.get("next_event_at"),
        "temp_bonus": player.get("temp_bonus"),
        "frac_dirty": player.get("frac_dirty", 0.0), "frac_clean": player.get("frac_clean", 0.0),
        "frac_launder": player.get("frac_launder", 0.0),
        "type_cooldowns": player.get("type_cooldowns", {}),
        "achievement_bonus_pct": player.get("achievement_bonus_pct", 0.0),
        "district_attention": player.get("district_attention", {}),
        "streak_op_pending": player.get("streak_op_pending", False),
        "quest_streak": player.get("quest_streak", {}),
        "quest_perf": player.get("quest_perf", {}),
        "quest_offer_history": player.get("quest_offer_history", {}),
        "pending_chains": player.get("pending_chains", []),
        "phrase_memory": player.get("phrase_memory", []),
    }})
    await spawn_opportunities(db, player, props, rare_chance=bonuses.get("rare_opp", 0.0))
    return player
