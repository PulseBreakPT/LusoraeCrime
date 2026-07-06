import logging
import math
import random
from datetime import datetime, timezone, timedelta
from bson import ObjectId

from game_data import (OPPORTUNITY_TYPES, LISBON_SPOTS, LEVEL_THRESHOLDS, EMP_LEVEL_XP,
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
                       DIRTY_MONEY_HEAT_THRESHOLD, DIRTY_MONEY_HEAT_PER_10K,
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
                       REFUEL_DURATION_BASE_S, REFUEL_DURATION_PER_L_S, PAYROLL_MORALE_REGEN,
                       FUEL_PRICES, random_employee_name)
from quests import process_quests, make_instance
from quests_data import QUEST_DEFS

logger = logging.getLogger(__name__)

OUTCOME_PT = {"success": "sucesso", "failure": "falhou", "police": "intercetado pela polícia"}
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


async def record_tx(db, player_id, kind, amount, currency, balance_after, note):
    """Regista uma transação no extrato — todo o dinheiro que entra ou sai
    fica com um registo consultável, mesmo que o evento em si já exista."""
    await db.transactions.insert_one({
        "player_id": player_id, "kind": kind, "amount": amount, "currency": currency,
        "balance_after": balance_after, "note": note, "ts": now_utc().isoformat(),
    })


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


# River Tejo shoreline approximation (west→east). A sampled point is on land when its
# latitude is north of the interpolated shore at that longitude. Coarse but effective.
_TEJO_SHORE = [
    (-9.240, 38.690),  # west of Belém
    (-9.200, 38.694),  # Belém
    (-9.180, 38.700),  # Alcântara docks
    (-9.150, 38.703),  # Cais do Sodré waterfront
    (-9.130, 38.706),  # Terreiro do Paço
    (-9.110, 38.711),  # Alfama waterfront
    (-9.100, 38.720),  # Santa Apolónia bend
    (-9.093, 38.750),  # Marvila / P. das Nações south
    (-9.093, 38.780),  # P. das Nações north (river ends)
]

_LISBON_BOUNDS = {"lat_min": 38.685, "lat_max": 38.800, "lng_min": -9.240, "lng_max": -9.085}


def is_on_land(lat, lng):
    """Reject points that fall on the Tejo or outside Lisbon's coarse bounds."""
    b = _LISBON_BOUNDS
    if not (b["lat_min"] <= lat <= b["lat_max"] and b["lng_min"] <= lng <= b["lng_max"]):
        return False
    # Interpolate the shore latitude at this longitude.
    pts = _TEJO_SHORE
    if lng <= pts[0][0]:
        shore = pts[0][1]
    elif lng >= pts[-1][0]:
        shore = pts[-1][1]
    else:
        for i in range(1, len(pts)):
            if lng <= pts[i][0]:
                x0, y0 = pts[i - 1]
                x1, y1 = pts[i]
                t = (lng - x0) / max(1e-9, (x1 - x0))
                shore = y0 + t * (y1 - y0)
                break
    # Give the shore a ~110m buffer so pins don't visually sit at the water's edge.
    return lat >= shore + 0.0010


def _sample_on_land(spot):
    """Sample a nearby (lat,lng) around a Lisbon spot that stays on land. Falls back to
    the spot itself if all attempts land in the river."""
    for _ in range(10):
        lat = spot["lat"] + random.uniform(-0.008, 0.008)
        lng = spot["lng"] + random.uniform(-0.010, 0.010)
        if is_on_land(lat, lng):
            return lat, lng
    return spot["lat"], spot["lng"]


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


async def spawn_opportunities(db, player, rare_chance=0.0):
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
    weights = [OPPORTUNITY_TYPES[k]["weight"] for k in keys]
    hq = player["hq"]
    docs = []
    for _ in range(max(0, target - active)):
        key = random.choices(keys, weights=weights)[0]
        t = OPPORTUNITY_TYPES[key]
        spot = random.choice(LISBON_SPOTS)
        duration_s = random.randint(*t["duration_s"])
        mult = (1 + 0.30 * (level - 1)) * random.uniform(0.8, 1.35) * duration_reward_mult(duration_s)
        rare = random.random() < rare_chance
        if rare:
            mult *= 2.0
        lat, lng = _sample_on_land(spot)
        dist_km = haversine_m(hq["lat"], hq["lng"], lat, lng) / 1000
        risk = min(5, t["risk"] + distance_risk_bump(dist_km))
        mult *= distance_reward_mult(dist_km)
        docs.append({
            "player_id": pid, "type_key": key, "name": t["name"],
            "category": t["category"], "district": spot["name"],
            "lat": lat,
            "lng": lng,
            "dist_km": round(dist_km, 2),
            "reward": int(t["base_reward"] * mult),
            "respect": int(t["respect"] * (1 + 0.15 * (level - 1)) * (1.5 if rare else 1.0)),
            "risk": risk, "heat": t["heat"], "pays": t["pays"], "rare": rare,
            "required_models": t.get("required_models", []),
            "duration_s": duration_s,
            "min_level": t["min_level"], "min_members": min_members_for(risk),
            "status": "active",
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


def chance_breakdown(heat, risk, team_skill, spec_match, talent_bonus=0.0, team_bonus=0.0,
                      vehicle_bonus=0.0, situational_bonus=0.0):
    base = 0.92
    risk_pen = -risk * 0.07
    skill_bonus = team_skill * 0.05
    heat_pen = -heat * 0.0015
    match_bonus = 0.12 if spec_match else 0.0
    chance = max(0.15, min(0.97, base + risk_pen + skill_bonus + heat_pen + match_bonus
                            + talent_bonus + team_bonus + vehicle_bonus + situational_bonus))
    return chance, {"base": base, "risco": round(risk_pen, 4), "equipa": round(skill_bonus, 4),
                    "calor": round(heat_pen, 4), "match": round(match_bonus, 4),
                    "talentos": round(talent_bonus, 4), "coordenacao": round(team_bonus, 4),
                    "veiculo": round(vehicle_bonus, 4), "condicoes": round(situational_bonus, 4)}


def situational_bonus_for(category, now):
    """Operações noturnas dão um pequeno bónus furtivo em categorias discretas."""
    start, end = NIGHT_STEALTH_HOURS
    h = now.hour
    is_night = (start <= h < end) if start <= end else (h >= start or h < end)
    if is_night and category in DISCREET_CATEGORIES:
        return NIGHT_STEALTH_BONUS
    return 0.0


def team_effectiveness(members, category, now=None):
    now = now or now_utc()

    def eff(e):
        attrs = e.get("attrs") or {}
        aks = CATEGORY_ATTRS.get(category)
        if aks:
            attr = sum(attrs.get(a, 2) for a in aks) / len(aks)
        else:
            attr = sum(attrs.values()) / max(1, len(attrs)) if attrs else 2
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
        # desvanece nas primeiras horas ao serviço.
        newbie_f = 1.0
        hired_at = e.get("hired_at")
        if hired_at:
            elapsed_s = max(0.0, (now - parse_dt(hired_at)).total_seconds())
            newbie_f -= NEWBIE_PENALTY_MAX * max(0.0, 1 - min(1.0, elapsed_s / NEWBIE_RAMP_S))
        return (e["level"] * 0.5 + attr * 0.45) * (1.25 if match else 1.0) * (1 - e["fatigue"] / 250) * morale_f * rank_f * newbie_f
    return sum(eff(e) for e in members) / len(members) + 0.3 * (len(members) - 1)


def team_bonus_breakdown(members, category, roster_stable_since, now):
    """Ajustes de chance derivados da coordenação da equipa: falta de líder,
    equipa demasiado pequena, homogeneidade de especialização e veterania
    (tempo desde a última alteração de membros)."""
    total = 0.0
    try:
        leader_idx = RANKS.index(TEAM_LEADER_MIN_RANK)
    except ValueError:
        leader_idx = len(RANKS) - 1
    has_leader = any(RANKS.index(e["rank"]) >= leader_idx for e in members if e.get("rank") in RANKS)
    if not has_leader:
        total -= NO_LEADER_PENALTY
    if len(members) == 1:
        total -= SOLO_MEMBER_PENALTY
    if len(members) > 1 and all(e.get("spec") == category for e in members):
        total += UNIFORM_SPEC_BONUS
    if roster_stable_since:
        stable_s = max(0.0, (now - parse_dt(roster_stable_since)).total_seconds())
        total += COORDINATION_BONUS_MAX * min(1.0, stable_s / COORDINATION_RAMP_S)
    return total


def vehicle_bonus_breakdown(vehicle, category):
    """Ajustes de chance derivados do veículo: pouca durabilidade aumenta o
    risco de algo correr mal; um veículo adequado ao tipo de operação ajuda."""
    total = 0.0
    condition = vehicle.get("condition", 100)
    if condition < VEHICLE_CONDITION_PENALTY_THRESHOLD:
        frac = (VEHICLE_CONDITION_PENALTY_THRESHOLD - condition) / VEHICLE_CONDITION_PENALTY_THRESHOLD
        total -= VEHICLE_CONDITION_PENALTY_MAX * min(1.0, frac)
    model = VEHICLE_MODELS.get(vehicle.get("model_key"), {})
    if category in model.get("best_for", []):
        total += VEHICLE_MATCH_BONUS
    return total


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
    if m.get("vehicle_luxury") and t["category"] in DISCREET_CATEGORIES:
        heat_mult *= LUXURY_HEAT_MULT
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
        player["respect"] += t["respect"]
        player["heat"] = min(100, player["heat"] + t["heat"] * heat_mult)
        # Roll for police chase during return trip.
        chase_chance = _compute_chase_chance(player, m)
        if random.random() < chase_chance:
            m["chase_active"] = True
            m["escape_chance"] = _compute_escape_chance(player, m)
        m["chase_chance"] = round(chase_chance, 3)
    elif outcome == "failure":
        stats["missions_failure"] += 1
        player["respect"] += max(1, t["respect"] // 4)
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
    """Base chance the police tail the crew back to base after a successful heist."""
    t = m["opportunity"]
    risk = t.get("risk", 3)
    heat = player.get("heat", 0)
    # Base by risk (0..0.35), heat contribution up to +0.25.
    base = 0.05 + (risk / 5) * 0.30
    heat_bonus = (heat / 100) * 0.25
    # Talents & skill mitigate: "fantasma_digital" and technical categories are stealthier.
    talents = m.get("talents", []) or []
    reduction = 0.0
    if "fantasma_digital" in talents:
        reduction += 0.10
    if "motorista_fantasma" in talents:
        reduction += 0.05
    # Team skill matters a bit.
    skill = m.get("team_skill", 3)
    reduction += min(0.10, max(0.0, (skill - 3) * 0.03))
    return max(0.02, min(0.85, base + heat_bonus - reduction))


def _compute_escape_chance(player, m):
    """Chance of losing the police tail before reaching HQ."""
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
    heat = player.get("heat", 0)
    base -= (heat / 100) * 0.10
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
        until = (now_utc() + timedelta(seconds=480 * (1 - bonuses["legal"]))).isoformat()
        await db.employees.update_one(
            {"_id": ObjectId(victim_id)},
            {"$set": {"status": "arrested", "status_until": until}},
        )
        emp = await db.employees.find_one({"_id": ObjectId(victim_id)})
        if emp:
            await push_history(db, emp["_id"], "Preso na perseguição de regresso à base.")
            await add_event(db, m["player_id"], "police",
                            f"{emp['name']} foi PRESO durante a perseguição policial!")
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


def _outcome_message(m, outcome):
    t = m["opportunity"]
    if outcome == "success":
        reward = int(m.get("pending_reward", t.get("reward", 0)) or 0)
        symbol = "€ limpos" if t["pays"] == "clean" else "€ sujos"
        chase = m.get("chase_active")
        base = f"{m['team_name']} concluiu {t['name']} em {t['district']}: leva {reward:,} {symbol}"
        if chase:
            base += f" — POLÍCIA em perseguição (escape ≈ {int((m.get('escape_chance', 0.5)) * 100)}%)"
        else:
            base += ", regressa em segurança"
        base += f", +{t['respect']} respeito."
        return base
    if outcome == "failure":
        return f"{m['team_name']} falhou {t['name']} em {t['district']}. A operação foi abortada."
    fine = m.get("fine", 0)
    return f"A polícia intercetou {m['team_name']} durante {t['name']} em {t['district']}. Multa de {fine:,} €."


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
        if outcome == "success":
            xp_gain = int(t["respect"] * 0.5 * (1.5 if match else 1.0))
            d_morale, d_loyal = 2, 1
        elif outcome == "failure":
            xp_gain = max(1, int(t["respect"] * 0.2))
            d_morale, d_loyal = -4, 0
        else:
            xp_gain = max(1, int(t["respect"] * 0.2))
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
            # Veículos com muitos quilómetros acumulados, ou muitas missões desde a
            # última reparação, desgastam-se mais depressa por operação.
            wear_mult = 1 + (WEAR_KM_MAX_MULT - 1) * min(1.0, veh.get("km_total", 0) / WEAR_KM_RAMP)
            missions_since_repair = veh.get("missions_since_repair", 0)
            wear_mult += WEAR_PER_MISSION_SINCE_REPAIR * min(missions_since_repair, WEAR_MISSIONS_SINCE_REPAIR_CAP)
            wear = (2 + t["risk"] * 1.5) * wear_mult
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
    if phase == "operating" and now >= parse_dt(m["finish_at"]):
        outcome = _roll_outcome(player, m)
        _apply_outcome(player, m, outcome)
        await _crew_returns(db, player, m, outcome)
        phase = "returning"
        updates.update({"phase": phase, "outcome": outcome})
        # Persist pending reward and chase state so the front-end can display them.
        for k in ("pending_reward", "pending_pays", "chase_active", "chase_chance", "escape_chance", "fine", "bonus_loot"):
            if k in m:
                updates[k] = m[k]
        # Track success now (before pay-out): the operation succeeded, delivery is separate.
        if outcome == "success":
            stats = player.setdefault("stats", default_stats())
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
        await db.teams.update_one({"_id": team_oid}, {"$set": {"status": "returning"}, "$inc": {"missions_done": 1}})
        kind = "success" if outcome == "success" else ("police" if outcome == "police" else "failure")
        await add_event(db, m["player_id"], kind, _outcome_message(m, outcome))
    if phase == "returning" and now >= parse_dt(m["return_at"]):
        # Resolve chase (if any) and pay pending reward on arrival at HQ.
        if m.get("outcome") == "success":
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
        total = sum(e.get("salary", 0) for e in employees)
        if total <= 0:
            continue
        if player["clean_money"] >= total:
            player["clean_money"] -= total
            await add_event(db, pid, "system", f"Folha salarial paga: -{total:,} €.")
            await record_tx(db, pid, "payroll", -total, "clean", player["clean_money"], "Folha salarial")
            # Salários em dia recuperam lentamente a moral e a lealdade do plantel.
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
        caps, _ = await get_caps(db, pid)
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
        caps, _ = await get_caps(db, pid)
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
        parts = await grant_quest_rewards(db, player, d.get("rewards", {}))
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
    for p in props:
        if not property_active(p, now):
            continue
        pt = PROPERTY_TYPES[p["type_key"]]
        factor = property_condition_factor(p)
        if pt.get("dirty_per_h"):
            rate = pt["dirty_per_h"] * p["level"] * factor * lab_mult
            share = rate * hours
            dirty_rate += rate
            await db.properties.update_one({"_id": p["_id"]}, {"$inc": {"total_dirty_generated": share}})
        if pt.get("heat_per_h"):
            heat_rate += pt["heat_per_h"] * p["level"] * factor
        if pt.get("launder_per_h"):
            launder_rate += pt["launder_per_h"] * p["level"] * factor
    launder_rate *= (1 + bonuses.get("empresa_boost", 0))

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
                    share = conv * (pt["launder_per_h"] * p["level"] * factor * (1 + bonuses.get("empresa_boost", 0)) / launder_rate)
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


async def _complete_refuels(db, player, vehicles, now):
    """Abastecer não é instantâneo — enche o depósito só quando o tempo de
    espera termina (nunca acima de 100%)."""
    for v in vehicles:
        until = v.get("refueling_until")
        if not until or parse_dt(until) > now:
            continue
        await db.vehicles.update_one({"_id": v["_id"]}, {"$set": {"fuel_l": v["tank_l"], "refueling_until": None}})
        await add_event(db, str(player["_id"]), "vehicle", f"{v['name']} terminou de abastecer — depósito cheio.")


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
    await _maybe_raid(db, player, props, minutes, now)

    vehicles = await db.vehicles.find({"player_id": pid}).to_list(100)
    await _complete_refuels(db, player, vehicles, now)
    await process_quests(db, player, {"employees": employees, "props": props,
                                      "vehicles": vehicles, "minutes": minutes})
    await process_automations(db, player, employees, vehicles, props, bonuses, now)

    player["heat"] = round(max(0.0, player["heat"] - minutes * 1.2), 3)
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
    }})
    await spawn_opportunities(db, player, rare_chance=bonuses.get("rare_opp", 0.0))
    return player
