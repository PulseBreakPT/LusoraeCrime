# Motor de cálculo de recompensas dinâmicas
# Sistema modular que calcula recompensas baseado em múltiplos fatores

import math
from reward_config import *
from economy_director import guard_reward


def get_vehicle_weight(vehicle_model: str, vehicles_dict: dict) -> float:
    """
    Obtém o peso de um veículo para cálculo de recompensa.

    Args:
        vehicle_model: Nome do modelo (ex: "sedan")
        vehicles_dict: Dict com definições dos veículos

    Returns:
        Multiplicador de peso (1.0 é baseline)
    """
    if vehicle_model in VEHICLE_TYPE_WEIGHTS:
        return VEHICLE_TYPE_WEIGHTS[vehicle_model]

    # Tentar mapear de veículo real para tipo genérico
    if vehicle_model in vehicles_dict:
        v = vehicles_dict[vehicle_model]
        # Usar "best_for" para estimar categoria
        if "best_for" in v and v["best_for"]:
            # Veículo especializado — usar weight médio de especializados
            return VEHICLE_TYPE_WEIGHTS.get("ambulancia", 1.8)

    return VEHICLE_TYPE_WEIGHTS["__default__"]


def calculate_vehicle_score(
    required_models: list,
    num_vehicles: int,
    vehicles_dict: dict
) -> float:
    """
    Calcula score de veículos necessários.

    Args:
        required_models: Lista de modelos requeridos (ex: ["sedan", "camiao"])
        num_vehicles: Total de veículos na operação
        vehicles_dict: Dict com definições dos veículos

    Returns:
        Score de 1.0+ (maior = mais recompensa)
    """
    if not required_models or num_vehicles == 0:
        return 1.0

    # Pesar cada veículo conforme o tipo
    total_weight = 0.0
    for model in required_models:
        total_weight += get_vehicle_weight(model, vehicles_dict)

    # Score é a média dos pesos, com ajuste por quantidade
    avg_weight = total_weight / len(required_models)

    # Mais veículos = operação mais complexa (mas com diminishing returns)
    num_multiplier = 1.0 + (num_vehicles - 1) * 0.15

    return avg_weight * min(1.5, num_multiplier)


def calculate_team_score(
    team_members: int,
    min_members_required: int,
    specialization_required: bool = False
):
    """
    Calcula score de equipa e deteta penalidades.

    Returns:
        (team_score, undercrewing_penalty)
    """
    # Score base
    team_score = TEAM_SIZE_SCORE_BASE

    # Adicionar por cada membro acima do mínimo
    if team_members > min_members_required:
        extra_members = team_members - min_members_required
        bonus = min(TEAM_SIZE_SCORE_MAX - 1.0, extra_members * TEAM_SIZE_SCORE_PER_MEMBER)
        team_score += bonus

    # Penalidade se usar menos que o mínimo
    undercrewing_penalty = 1.0
    if team_members < min_members_required:
        missing_members = min_members_required - team_members
        undercrewing_penalty = max(0.5, 1.0 - missing_members * UNDERCREWING_PENALTY_PER_MISSING)

    # Penalidade se usar muito mais que necessário
    overcrewing_penalty = 1.0
    if team_members > min_members_required * 2:
        extra_members = team_members - (min_members_required * 2)
        overcrewing_penalty = max(0.6, 1.0 - extra_members * OVERCREWING_PENALTY_PER_EXTRA)

    # Especialização aumenta valor
    if specialization_required:
        team_score *= SPECIALIZATION_SCORE_REQUIRED
    else:
        team_score *= SPECIALIZATION_SCORE_NORMAL

    overall_penalty = undercrewing_penalty * overcrewing_penalty

    return team_score, overall_penalty


def calculate_duration_score(duration_s: int) -> float:
    """
    Calcula score baseado na duração estimada da missão.
    Operações rápidas são menos valiosas, operações longas são mais valiosas.

    Args:
        duration_s: Duração estimada em segundos

    Returns:
        Multiplicador de duração (0.8 a 1.6)
    """
    clamped = max(DURATION_SCORE_MIN_S, min(DURATION_SCORE_MAX_S, duration_s))

    # Interpolação linear
    progress = (clamped - DURATION_SCORE_MIN_S) / (DURATION_SCORE_MAX_S - DURATION_SCORE_MIN_S)
    score = DURATION_SCORE_MIN_MULT + (DURATION_SCORE_MAX_MULT - DURATION_SCORE_MIN_MULT) * progress

    return score


def calculate_distance_score(distance_km: float) -> float:
    """
    Calcula score baseado em distância percorrida.
    Com diminishing returns para evitar exploits.

    Args:
        distance_km: Distância em km

    Returns:
        Multiplicador de distância (1.0 a 1.8)
    """
    score = DISTANCE_SCORE_BASE + distance_km * DISTANCE_SCORE_PER_KM
    return min(DISTANCE_SCORE_MAX, score)


def calculate_objective_complexity_score(num_objectives: int) -> float:
    """
    Calcula score baseado no número de objetivos/requisitos.

    Args:
        num_objectives: Número de objetivos/requisitos

    Returns:
        Multiplicador de complexidade
    """
    score = OBJECTIVE_COMPLEXITY_BASE + num_objectives * OBJECTIVE_COMPLEXITY_PER_REQUIREMENT
    return score


def calculate_difficulty_score(
    risk: int,
    team_members: int,
    min_members_required: int,
    required_models: list,
    duration_s: int,
    distance_km: float,
    num_objectives: int = 1,
    specialization_required: bool = False,
    vehicles_dict: dict = None
) -> float:
    """
    Calcula o score de dificuldade geral da operação.

    Este é o multiplicador principal que afeta todas as recompensas.
    Usa escalamento ADITIVO dos componentes para evitar crescimento exponencial.

    Args:
        risk: Nível de risco (1-6)
        team_members: Número de membros da equipa
        min_members_required: Número mínimo de membros necessários
        required_models: Lista de modelos de veículos necessários
        duration_s: Duração estimada em segundos
        distance_km: Distância em km
        num_objectives: Número de objetivos
        specialization_required: Se requer especialização específica
        vehicles_dict: Dict com definições dos veículos

    Returns:
        Score de dificuldade (será multiplicado pela recompensa base)
    """
    if vehicles_dict is None:
        vehicles_dict = {}

    # Base score: 1.0 = operação de risco 1 com mínimo requerido
    base_score = 1.0

    # ===== COMPONENTES ADITIVOS (contribuem como percentagem) =====

    # Risk: 0% a +250% (risco 1 a 5)
    risk_component = (RISK_MULTIPLIERS.get(risk, RISK_MULTIPLIERS[5]) - 1.0)

    # Veículos: 0% a +250%
    vehicle_score = calculate_vehicle_score(required_models, len(required_models), vehicles_dict)
    vehicle_component = max(0.0, vehicle_score - 1.0) * 1.5  # Limitar a 150%

    # Equipa e especialização: 0% a +100%
    team_score, team_penalty = calculate_team_score(team_members, min_members_required, specialization_required)
    team_component = max(0.0, team_score - 1.0) * 0.8  # Limitar a 80%

    # Duração: -20% a +60%
    duration_score = calculate_duration_score(duration_s)
    duration_component = (duration_score - 1.0) * 0.4  # Suavizar de -20% a +24%

    # Distância: 0% a +80%
    distance_score = calculate_distance_score(distance_km)
    distance_component = (distance_score - 1.0) * 0.4  # Suavizar de 0% a +32%

    # Objetivos: +5% por objetivo
    objective_component = (num_objectives - 1) * 0.05

    # Penalidades de equipa
    penalty_component = team_penalty - 1.0

    # Combinar tudo aditivamente
    combined = 1.0 + (
        risk_component +
        vehicle_component +
        team_component +
        duration_component +
        distance_component +
        objective_component +
        penalty_component
    )

    # Aplicar fator de inflação global
    final_score = combined * DIFFICULTY_SCORE_INFLATION_FACTOR

    # Clamp para évitar extremos
    return max(DIFFICULTY_SCORE_MIN, min(DIFFICULTY_SCORE_MAX, final_score))


def calculate_money_reward(
    difficulty_score: float,
    risk: int,
    org_level: int,
    category: str = "assalto",
    is_rare_mission: bool = False,
    multiplier_stack: float = 1.0,
    repeat_count: int = 0
) -> int:
    """
    Calcula recompensa monetária final.

    Args:
        difficulty_score: Score de dificuldade (de calculate_difficulty_score)
        risk: Nível de risco (1-6)
        org_level: Nível da organização (1+)
        category: Categoria da missão
        is_rare_mission: Se é uma missão rara (2× reward)
        multiplier_stack: Multiplicadores stackados (achievement, property, etc.)
        repeat_count: Quantas vezes a mesma missão foi repetida

    Returns:
        Recompensa em euros
    """
    # Base reward por risco
    base = BASE_REWARD_PER_RISK.get(min(risk, 5), BASE_REWARD_PER_RISK[5])

    # Aplicar score de dificuldade
    reward = base * difficulty_score

    # Preserva a economia 1-10; depois cresce de forma suave até ao 100.
    legacy_level = min(10, max(1, int(org_level or 1)))
    org_multiplier = ORG_LEVEL_MULTIPLIER_BASE + (legacy_level - 1) * ORG_LEVEL_MULTIPLIER_PER_LEVEL
    if org_level > 10:
        org_multiplier += (min(100, int(org_level)) - 10) * ORG_LEVEL_MULTIPLIER_LATE
    reward *= org_multiplier

    # Multiplicador por categoria
    category_mult = CATEGORY_MULTIPLIERS.get(category, CATEGORY_MULTIPLIERS["__default__"])
    reward *= category_mult

    # Missões raras pagam mais, mas não duplicam automaticamente a economia.
    if is_rare_mission:
        reward *= RARE_MISSION_REWARD_MULTIPLIER

    # Stack de multiplicadores (achievement, property, etc.)
    # Limitar para evitar combinações absurdas
    reward *= min(MAX_COMBINED_MULTIPLIER, multiplier_stack)

    # Penalidade por repetição
    if repeat_count > 0:
        repeat_penalty = REPEAT_PENALTY_MULTIPLIER ** repeat_count
        reward *= repeat_penalty

    # Clamp final. Mantém 90k até ao nível 10 e abre espaço de forma
    # gradual para operações de late-game, sem saltos bruscos na economia.
    late_levels = max(0, min(100, int(org_level or 1)) - 10)
    reward_cap = MONEY_REWARD_MAX + late_levels * MONEY_REWARD_MAX_LATE_PER_LEVEL
    tuned = int(max(MONEY_REWARD_MIN, min(reward_cap, reward)))
    return max(MONEY_REWARD_MIN, guard_reward(tuned, org_level, "operation"))


def calculate_xp_reward(
    difficulty_score: float,
    risk: int,
    team_members: int,
    specialization_match: bool = False
) -> dict:
    """
    Calcula recompensa de experiência para cada membro da equipa.

    Returns:
        {
            "base_xp": int,  # XP por membro
            "specialization_bonus_xp": int,  # Bonus se especializado
            "fatigue_factor": float,  # Redução por cansaço
        }
    """
    # Score base para XP
    base_xp = int(XP_REWARD_MIN + difficulty_score * 100)
    base_xp = min(XP_REWARD_MAX, base_xp)

    # Multiplicador por risco
    risk_mult = 1.0 + risk * XP_MULTIPLIER_PER_RISK
    base_xp = int(base_xp * risk_mult)

    # Bonus por especialização
    spec_bonus = 0
    if specialization_match:
        spec_bonus = int(base_xp * 0.5)  # +50% bonus

    return {
        "base_xp": min(XP_REWARD_MAX, base_xp),
        "specialization_bonus_xp": spec_bonus,
        "fatigue_factor": 1.0,  # Será ajustado por cansaço real do operacional
    }


def calculate_reputation_reward(
    difficulty_score: float,
    risk: int,
    is_rare_mission: bool = False
) -> int:
    """
    Calcula recompensa de reputação (respect).

    Args:
        difficulty_score: Score de dificuldade
        risk: Nível de risco
        is_rare_mission: Se é rara

    Returns:
        Pontos de reputação
    """
    # Base reputation
    base = 50 + difficulty_score * 20

    # Multiplicador por risco
    risk_mult = 1.0 + risk * REPUTATION_MULTIPLIER_PER_RISK
    reputation = int(base * risk_mult)

    # Missões raras ganham mais reputação
    if is_rare_mission:
        reputation = int(reputation * 1.5)

    return reputation


def calculate_rare_item_drop_chance(risk: int, failure_probability: float) -> float:
    """
    Calcula probabilidade de dropar um item raro.

    Args:
        risk: Nível de risco
        failure_probability: Probabilidade de falha (0.0-1.0)

    Returns:
        Probabilidade entre 0.0 e 1.0
    """
    base_chance = RARE_ITEM_CHANCE_BASE

    if risk >= 5:
        base_chance = RARE_ITEM_CHANCE_HIGH_RISK

    if risk >= 6:
        base_chance = RARE_ITEM_CHANCE_EXTREME_RISK

    # Quanto maior a probabilidade de falha, maior o drop rate
    # (como compensação pelo risco)
    adjusted = base_chance * (1.0 + failure_probability * 0.5)

    return min(0.25, adjusted)  # Cap em 25%


def calculate_bonus_reward_chance(risk: int, failure_probability: float) -> tuple[float, float]:
    """
    Calcula chance de bónus especial (extra dinheiro + XP).

    Returns:
        (chance_of_bonus, multiplier_if_bonus_occurs)
    """
    chance = BONUS_REWARD_CHANCE

    # Operações extremamente difíceis têm mais chance de bónus
    if risk >= 5 and failure_probability > 0.5:
        chance *= 2.0

    return min(0.15, chance), BONUS_REWARD_MULTIPLIER


def validate_rewards(
    money: int,
    xp: int,
    reputation: int,
    risk: int
) -> bool:
    """
    Valida se as recompensas estão dentro de limites razoáveis.

    Retorna False se algo estiver errado (para logging/debugging).
    """
    if money < MONEY_REWARD_MIN or money > MONEY_REWARD_MAX:
        return False

    if xp < XP_REWARD_MIN or xp > XP_REWARD_MAX:
        return False

    # Reputation: não deve ser negativa, deve ser razoável
    # Risco 5 pode dar centenas de reputação
    if reputation < 20 or reputation > 5000:
        return False

    return True


def calculate_full_reward(
    risk: int,
    team_members: int,
    min_members_required: int,
    required_models: list,
    duration_s: int,
    distance_km: float,
    num_objectives: int,
    specialization_required: bool,
    org_level: int,
    category: str,
    failure_probability: float,
    is_rare_mission: bool = False,
    multiplier_stack: float = 1.0,
    repeat_count: int = 0,
    vehicles_dict: dict = None,
    specialization_match: bool = False,
) -> dict:
    """
    Função principal que calcula TODA a recompensa de uma operação.

    Returns um dict com todas as recompensas e metadados.
    """
    # Calcular dificuldade
    difficulty_score = calculate_difficulty_score(
        risk=risk,
        team_members=team_members,
        min_members_required=min_members_required,
        required_models=required_models,
        duration_s=duration_s,
        distance_km=distance_km,
        num_objectives=num_objectives,
        specialization_required=specialization_required,
        vehicles_dict=vehicles_dict,
    )

    # Calcular cada componente
    money = calculate_money_reward(
        difficulty_score=difficulty_score,
        risk=risk,
        org_level=org_level,
        category=category,
        is_rare_mission=is_rare_mission,
        multiplier_stack=multiplier_stack,
        repeat_count=repeat_count,
    )

    xp_info = calculate_xp_reward(
        difficulty_score=difficulty_score,
        risk=risk,
        team_members=team_members,
        specialization_match=specialization_match,
    )

    reputation = calculate_reputation_reward(
        difficulty_score=difficulty_score,
        risk=risk,
        is_rare_mission=is_rare_mission,
    )

    rare_item_chance = calculate_rare_item_drop_chance(risk, failure_probability)
    bonus_chance, bonus_mult = calculate_bonus_reward_chance(risk, failure_probability)

    return {
        "money": money,
        "xp": xp_info["base_xp"],
        "xp_specialization_bonus": xp_info["specialization_bonus_xp"],
        "reputation": reputation,
        "difficulty_score": round(difficulty_score, 2),
        "rare_item_chance": round(rare_item_chance, 3),
        "bonus_reward_chance": round(bonus_chance, 3),
        "bonus_reward_multiplier": bonus_mult,
        "is_valid": validate_rewards(money, xp_info["base_xp"], reputation, risk),
    }
