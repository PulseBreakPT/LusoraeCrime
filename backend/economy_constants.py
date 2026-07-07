# ============================================================================
# LUSORAE CRIME - CENTRALIZED ECONOMY CONSTANTS
# All configurable economic values in one place for easy rebalancing
# Redesigned to fix infinite money loops and add late-game money sinks
# ============================================================================

# ============================================================================
# INITIAL CAPITAL
# ============================================================================

INITIAL_CLEAN_MONEY = 75000
INITIAL_DIRTY_MONEY = 5000

# ============================================================================
# DIRTY MONEY MANAGEMENT
# ============================================================================

DIRTY_MONEY_CAP_BASE = 80000
DIRTY_MONEY_CAP_PER_LEVEL = 8000
DIRTY_MONEY_HEAT_THRESHOLD = 60000
DIRTY_MONEY_HEAT_PER_10K = 0.15

# ============================================================================
# PAYROLL CYCLES & MORALE
# ============================================================================

PAYROLL_CYCLE_MIN = 120  # minutes between salary cycles
PAYROLL_MORALE_REGEN = 0.4  # morale/loyalty recovered per employee on time payment
POOL_REFRESH_MIN = 5  # minutes between recruitment pool refreshes

# ============================================================================
# TEAM MANAGEMENT
# ============================================================================

TEAM_CREATE_COST = 5000
BASE_EMPLOYEE_CAP = 4
BASE_VEHICLE_CAP = 2
TEAM_MAX_MEMBERS = 4

# Salary scaling (NEW REDESIGN)
# Formula: payroll_cost = sum(salaries) × (num_employees / 2) ^ 0.5
# This prevents infinite team growth without scaling costs
TEAM_COST_SCALING_BASE = 0.5  # exponent for team scaling
# At 2 employees: (2/2)^0.5 = 1.0x
# At 4 employees: (4/2)^0.5 = 1.41x
# At 8 employees: (8/2)^0.5 = 2.0x
# At 16 employees: (16/2)^0.5 = 2.83x

# ============================================================================
# PROPERTY COSTS (REDESIGNED - 50% INCREASE FROM ORIGINAL)
# ============================================================================

PROPERTY_COSTS = {
    'esconderijo': 30000,        # was 20000, +50%
    'garagem': 22500,            # was 15000, +50%
    'empresa_legal': 52500,      # was 35000, +50%
    'armazem': 37500,            # was 25000, +50%
    'laboratorio': 60000,        # was 40000, +50%
    'oficina': 45000,            # was 30000, +50%
    'porto_clandestino': 90000,  # was 60000, +50%
    'posto_vigilancia': 42000,   # was 28000, +50%
    'escritorio_advocacia': 48000,  # was 32000, +50%
    'arsenal': 57000,            # was 38000, +50%
    'casa_cambio': 63000,        # was 42000, +50%
    'centro_logistico': 82500,   # was 55000, +50%
}

# Property types and configurations
PROPERTY_TYPES = {
    'esconderijo': {
        'name': 'Esconderijo',
        'min_level': 1,
        'cap_employees': 4,
        'desc': 'Alarga a capacidade de operacionais da organização.'
    },
    'garagem': {
        'name': 'Garagem',
        'min_level': 1,
        'cap_vehicles': 2,
        'desc': 'Espaço extra para a frota de veículos.'
    },
    'empresa_legal': {
        'name': 'Empresa de Fachada',
        'min_level': 2,
        'launder_per_h': 1400,  # was 2000, -30%
        'launder_rate': 0.90,
        'desc': 'Lava dinheiro sujo automaticamente (90% de retorno).'
    },
    'armazem': {
        'name': 'Armazém',
        'min_level': 2,
        'bonus_pct': 0.05,
        'bonus_category': 'logistica',
        'bonus_label': 'recompensas de logística',
        'desc': 'Aumenta recompensas de operações logísticas.'
    },
    'laboratorio': {
        'name': 'Laboratório',
        'min_level': 3,
        'dirty_per_h': 2100,  # was 3000, -30%
        'heat_per_h': 0.8,
        'desc': 'Produz dinheiro sujo passivamente, mas atrai calor.'
    },
    'oficina': {
        'name': 'Oficina',
        'min_level': 3,
        'repair_discount_pct': 0.15,
        'desc': 'Reduz o custo de reparações da frota.'
    },
    'porto_clandestino': {
        'name': 'Porto Clandestino',
        'min_level': 4,
        'bonus_pct': 0.05,
        'bonus_category': 'all',
        'bonus_label': 'todas as recompensas',
        'desc': 'Rede de contrabando que aumenta todas as recompensas.'
    },
    'posto_vigilancia': {
        'name': 'Posto de Vigilância',
        'min_level': 2,
        'bonus_pct': 0.05,
        'bonus_category': 'tecnica',
        'bonus_label': 'recompensas técnicas',
        'desc': 'Rede de vigilância que aumenta recompensas de operações técnicas.'
    },
    'escritorio_advocacia': {
        'name': 'Escritório de Advocacia',
        'min_level': 2,
        'bonus_pct': 0.05,
        'bonus_category': 'influencia',
        'bonus_label': 'recompensas de influência',
        'desc': 'Fachada legal que aumenta as recompensas de operações de influência.'
    },
    'arsenal': {
        'name': 'Arsenal',
        'min_level': 3,
        'bonus_pct': 0.05,
        'bonus_category': 'assalto',
        'bonus_label': 'recompensas de assalto',
        'desc': 'Equipamento tático que aumenta as recompensas de operações de assalto.'
    },
    'casa_cambio': {
        'name': 'Casa de Câmbio',
        'min_level': 3,
        'launder_per_h': 1750,  # was 2500, -30%
        'launder_rate': 0.90,
        'desc': 'Duplica a capacidade de lavagem automática através de câmbios internacionais.'
    },
    'centro_logistico': {
        'name': 'Centro Logístico',
        'min_level': 4,
        'cap_vehicles': 3,
        'desc': 'Grande centro de operações que amplia bastante a capacidade da frota.'
    },
}

PROPERTY_MAX_LEVEL = 3
PROPERTY_MAINTENANCE_PCT_PER_DAY = 0.0015
PROPERTY_CONDITION_RECOVERY_PER_HOUR = 2.0
PROPERTY_CONDITION_DECAY_PER_HOUR = 3.0
PROPERTY_UPGRADE_BASE_S = 90
PROPERTY_UPGRADE_PER_LEVEL_S = 60
PROPERTY_STACK_DIMINISH = [1.0, 0.7, 0.5]

# Passive income bonuses for specialized employees
PASSIVE_INCOME_BONUSES = {
    'quimico': 0.20,  # +20% lab production
    'gestor': 0.25,   # +25% laundry rate
    'talents': {
        'formula_secreta': 0.15,      # +15% lab
        'contabilista_sujo': 0.15,    # +15% laundry
    }
}

# ============================================================================
# VEHICLE MANAGEMENT
# ============================================================================

VEHICLE_PURCHASE_PRICES = {
    'usado': 6000,
    'moto': 12000,
    'van': 18000,
    'desportivo': 30000,
    'suv_blindado': 45000,
    'supercarro': 65000,
    'carrinha_entrega': 9000,
    'berlina_blindada': 22000,
    'buggy_todo_terreno': 20000,
    'limousine': 50000,
    'carro_furtivo': 55000,
}

VEHICLE_FUEL_CONSUMPTION = {
    'usado': 8.0,
    'moto': 4.5,
    'van': 10.0,
    'desportivo': 12.0,
    'suv_blindado': 13.0,
    'supercarro': 15.0,
    'carrinha_entrega': 7.5,
    'berlina_blindada': 11.0,
    'buggy_todo_terreno': 9.0,
    'limousine': 14.0,
    'carro_furtivo': 10.0,
}

FUEL_PRICES = {
    'gasolina': 1.80,
    'gasoleo': 1.60,
}

REFUEL_DURATION_BASE_S = 15
REFUEL_DURATION_PER_L_S = 0.5

# ============================================================================
# QUARTEL-GENERAL (HQ) — CENTRO ESTRATÉGICO
# ============================================================================

HQ_MAX_LEVEL = 8

# Benefícios cumulativos por nível de HQ (o nível 1 é a base, sem bónus nem
# custo — já vem com a organização). upgrade_cost/upgrade_duration_s/
# min_org_level dizem respeito à melhoria PARA esse nível (por isso o nível 1
# não tem nenhum dos três). cap_employees/cap_vehicles somam-se aos caps base
# e aos das propriedades; passive_income_pct multiplica a produção/lavagem
# passiva das propriedades; heat_reduction_pct reduz o calor gerado por hora
# pelas propriedades ilegais (aplicado em _apply_passive_income, não na
# dissipação global de calor). Custos calibrados para ficarem por baixo do
# custo combinado de todas as propriedades do jogo (~590k€) mesmo no total —
# o HQ é o "capstone" da progressão, não deve eclipsar o sistema de imóveis.
HQ_LEVEL_BENEFITS = [
    {'level': 1, 'upgrade_cost': None, 'upgrade_duration_s': None, 'min_org_level': 1,
     'cap_employees': 0, 'cap_vehicles': 0, 'passive_income_pct': 0.0, 'heat_reduction_pct': 0.0,
     'unlocks': [], 'name': 'Armazém de Operações', 'desc': 'A base da organização.'},
    {'level': 2, 'upgrade_cost': 12000, 'upgrade_duration_s': 480, 'min_org_level': 2,
     'cap_employees': 2, 'cap_vehicles': 1, 'passive_income_pct': 0.0, 'heat_reduction_pct': 0.0,
     'unlocks': [], 'name': 'Escritório Reforçado', 'desc': 'Mais postos de trabalho e uma vaga de garagem.'},
    {'level': 3, 'upgrade_cost': 20000, 'upgrade_duration_s': 1200, 'min_org_level': 3,
     'cap_employees': 2, 'cap_vehicles': 1, 'passive_income_pct': 0.05, 'heat_reduction_pct': 0.0,
     'unlocks': ['financeiro'], 'name': 'Sala de Operações', 'desc': 'Desbloqueia o Gabinete Financeiro (em breve).'},
    {'level': 4, 'upgrade_cost': 34000, 'upgrade_duration_s': 2400, 'min_org_level': 4,
     'cap_employees': 3, 'cap_vehicles': 2, 'passive_income_pct': 0.05, 'heat_reduction_pct': 0.0,
     'unlocks': ['rh'], 'name': 'Central de Recrutamento', 'desc': 'Desbloqueia Recursos Humanos (em breve).'},
    {'level': 5, 'upgrade_cost': 55000, 'upgrade_duration_s': 4200, 'min_org_level': 5,
     'cap_employees': 3, 'cap_vehicles': 2, 'passive_income_pct': 0.10, 'heat_reduction_pct': 0.05,
     'unlocks': ['logistica'], 'name': 'Rede de Comunicações Segura', 'desc': 'Desbloqueia Logística e reduz o calor acumulado.'},
    {'level': 6, 'upgrade_cost': 88000, 'upgrade_duration_s': 6600, 'min_org_level': 6,
     'cap_employees': 4, 'cap_vehicles': 2, 'passive_income_pct': 0.10, 'heat_reduction_pct': 0.10,
     'unlocks': [], 'name': 'Centro Logístico Avançado', 'desc': 'Mais capacidade e menos calor operacional.'},
    {'level': 7, 'upgrade_cost': 140000, 'upgrade_duration_s': 9600, 'min_org_level': 7,
     'cap_employees': 4, 'cap_vehicles': 3, 'passive_income_pct': 0.15, 'heat_reduction_pct': 0.10,
     'unlocks': ['investigacao'], 'name': 'Laboratório de Análise', 'desc': 'Desbloqueia Investigação (em breve).'},
    {'level': 8, 'upgrade_cost': 220000, 'upgrade_duration_s': 14400, 'min_org_level': 8,
     'cap_employees': 5, 'cap_vehicles': 3, 'passive_income_pct': 0.20, 'heat_reduction_pct': 0.15,
     'unlocks': ['comunicacoes'], 'name': 'Quartel-General Completo', 'desc': 'O centro de comando completo da organização.'},
]

# Prioridades globais — influenciam o desempate das recomendações de
# despacho (dispatch/recommend_*) e as dicas do consultor no frontend.
HQ_PRIORITIES = {
    'equilibrio': 'Crescimento equilibrado',
    'lucro': 'Maximizar lucro',
    'custos': 'Reduzir custos',
    'velocidade': 'Responder mais rapidamente',
    'reputacao': 'Aumentar reputação',
    'complexidade': 'Privilegiar missões complexas',
}
HQ_DEFAULT_PRIORITY = 'equilibrio'

# Departamentos futuros (arquitetura preparada, ainda não implementados) —
# cada chave corresponde a uma entrada em HQ_LEVEL_BENEFITS[i]['unlocks'].
HQ_DEPARTMENTS = {
    'financeiro': {'name': 'Gabinete Financeiro', 'desc': 'Análise financeira avançada e investimentos.'},
    'rh': {'name': 'Recursos Humanos', 'desc': 'Gestão avançada de pessoal e recrutamento.'},
    'logistica': {'name': 'Logística', 'desc': 'Otimização de rotas e frota.'},
    'investigacao': {'name': 'Investigação', 'desc': 'Inteligência sobre a concorrência e a polícia.'},
    'comunicacoes': {'name': 'Comunicações', 'desc': 'Coordenação e automação avançada de operações.'},
}

# VEHICLE REPAIR COSTS (REDESIGNED - 6x INCREASE)
# Old multiplier: 0.002 (0.2% of vehicle price)
# New multiplier: 0.012 (1.2% of vehicle price)
VEHICLE_REPAIR_BASE_MULTIPLIER = 0.012  # was 0.002, 6x increase
VEHICLE_REPAIR_MIN = 50

# Repair discounts stack up to 50% max
REPAIR_DISCOUNT_OFICINA_PER_LEVEL = 0.15
REPAIR_DISCOUNT_MECANICO = 0.15
REPAIR_DISCOUNT_MECANICO_ELITE = 0.20
REPAIR_DISCOUNT_MAX = 0.50

# ============================================================================
# RECRUITMENT & EMPLOYEE MANAGEMENT
# ============================================================================

RECRUITMENT_BASE = 2000
RECRUITMENT_ATTR_MULTIPLIER = 180
RECRUITMENT_TALENT_COST = 2500

PROMOTION_COSTS = {
    1: 2000,    # Recruta → Membro
    2: 4000,    # Membro → Especialista
    3: 6000,    # Especialista → Veterano
    4: 8000,    # Veterano → Tenente
    5: 10000,   # Tenente → Chefe Equipa
    6: 12000,   # Chefe Equipa → Braço Direito
}

PROMOTION_SALARY_INCREASE = 0.10  # +10% per promotion
FIRING_SEVERANCE_MULTIPLIER = 3  # 3x salary
BONUS_MIN = 100
BONUS_SCALE = 1.0  # max(100, employee_salary) × this

# ============================================================================
# TRAINING
# ============================================================================

TRAINING_COSTS = {
    'combate': 3000,
    'conducao': 2500,
    'hacking': 3500,
    'discricao': 2800,
    'negociacao': 3000,
    'primeiros_socorros': 2600,
    'logistica': 2400,
    'gestao': 3200,
    'lideranca': 4000,
    'treino_fisico': 2700,
}

# ============================================================================
# MISSION REWARDS (from reward_engine.py)
# ============================================================================

MISSION_REWARD_MIN = 500
MISSION_REWARD_MAX = 120000
MISSION_REWARD_MULTIPLIER_CAP = 2.5

# Organization level scaling
ORG_LEVEL_MULTIPLIER_BASE = 1.0
ORG_LEVEL_MULTIPLIER_PER_LEVEL = 0.35
# At level 5: 1.0 + (4 × 0.35) = 2.4x
# At level 10: 1.0 + (9 × 0.35) = 4.15x

CATEGORY_MULTIPLIERS = {
    'assalto': 1.0,
    'logistica': 0.85,
    'tecnica': 1.0,
    'influencia': 0.9,
    'especial': 1.2,
}

RARE_MISSION_MULTIPLIER = 2.0

# Achievement system
ACHIEVEMENT_MILESTONES = [10, 50, 150, 400]
ACHIEVEMENT_BONUS_PCT_PER_MILESTONE = 0.02  # 2% per milestone, max 8%

# Distance bonus
DISTANCE_BONUS_MAX = 0.50
DISTANCE_BONUS_PER_KM = 0.06

# Age decay penalty
AGE_DECAY_MAX = 0.20
AGE_DECAY_RAMP_S = 480

# MEMBER SPLIT PENALTY (REDESIGNED - INCREASED)
# Old: 1 - min(0.20, 0.04 × extra_members) = 4% per extra, max 20%
# New: 1 - min(0.40, 0.08 × extra_members) = 8% per extra, max 40%
MEMBER_SPLIT_PENALTY_PER_EXTRA = 0.08  # was 0.04, doubled
MEMBER_SPLIT_PENALTY_MAX = 0.40  # was 0.20, doubled

# ============================================================================
# HEAT SYSTEM (REDESIGNED)
# ============================================================================

# Intercept probability (police chance)
# Old: 0.20 + (heat / 100) × 0.25 = 0.20-0.45 (20-45%)
# New: min(0.40, 0.15 + (heat / 100) × 0.20) = 0.15-0.40 (15-40%, capped at 40%)
HEAT_INTERCEPT_BASE = 0.15  # was 0.20
HEAT_INTERCEPT_PER_100_HEAT = 0.20  # was 0.25
HEAT_INTERCEPT_CAP = 0.40  # NEW: cap at 40% (was no cap)

# Bribe costs
# Old: heat × 150 €
# New: heat × 75 € (half the cost)
HEAT_BRIBE_PER_POINT = 75  # was 150, cut in half
HEAT_BRIBE_MIN = 1000

# Heat decay (unchanged)
HEAT_DECAY_PER_MINUTE = 1.2

# Heat consequences
HEAT_RAID_THRESHOLD = 70
HEAT_RAID_SEIZURE_PCT = 0.25
HEAT_RAID_COOLDOWN_MINUTES = 10
HEAT_FAILURE_MULTIPLIER = 1.5
HEAT_INTERCEPT_LOSS_PCT = 0.10

# ============================================================================
# MEDICAL & LEGAL COSTS
# ============================================================================

MEDICAL_TREATMENT_BASE = 2500
MEDICAL_TREATMENT_DISCOUNT_SCALE = 0.60  # max 60% discount
MEDICAL_TREATMENT_MIN = 200

BAIL_BASE = 2000
BAIL_PER_HEAT = 30
BAIL_LEGAL_BONUS = 0.30
BAIL_BRIBE_BONUS = 0.15
BAIL_MIN = 300

# ============================================================================
# LATE-GAME MONEY SINKS (NEW SYSTEMS - REDESIGN)
# ============================================================================

# Government Corruption (monthly cost to avoid raids)
GOVERNMENT_CORRUPTION_BASE = 25000  # baseline monthly cost
GOVERNMENT_CORRUPTION_PER_EMPLOYEE = 1000
GOVERNMENT_CORRUPTION_PER_PROPERTY = 2000
GOVERNMENT_CORRUPTION_UNPAID_HEAT_PENALTY = 2  # heat per unpaid cycle
GOVERNMENT_CORRUPTION_UNLOCK_LEVEL = 5

# Prestige Items (one-time purchases for progression)
PRESTIGE_ITEMS = {
    'warehouse_expansion': {
        'name': 'Expansão de Armazém',
        'cost': 50000,
        'unlock_level': 5,
        'dirty_cap_increase': 5000,
    },
    'advanced_warehouse': {
        'name': 'Armazém Avançado',
        'cost': 100000,
        'unlock_level': 7,
        'dirty_cap_increase': 10000,
    },
    'ultimate_vault': {
        'name': 'Cofre Definitivo',
        'cost': 250000,
        'unlock_level': 9,
        'dirty_cap_increase': 25000,
    },
    'vehicle_customization': {
        'name': 'Personalização de Veículo',
        'cost': 75000,
        'unlock_level': 6,
        'mission_bonus': 0.15,
    },
    'crew_specialization': {
        'name': 'Especialização de Crew',
        'cost': 75000,
        'unlock_level': 6,
        'spec_bonus': 0.10,
    },
    'research_formula': {
        'name': 'Pesquisa: Fórmula Avançada',
        'cost': 150000,
        'unlock_level': 8,
        'lab_bonus': 0.20,
    },
    'research_laundry': {
        'name': 'Pesquisa: Técnicas de Lavagem',
        'cost': 150000,
        'unlock_level': 8,
        'laundry_bonus': 0.15,
    },
    'research_evasion': {
        'name': 'Pesquisa: Técnicas de Evasão',
        'cost': 200000,
        'unlock_level': 9,
        'heat_decay_bonus': 0.20,
    },
}

# Territory expansion (end-game progression)
TERRITORY_CONTROL_UNLOCK_LEVEL = 9
TERRITORY_CONTROL_COST = 300000
TERRITORY_CONTROL_WEEKLY_DEFENSE = 20000
TERRITORY_CONTROL_BONUS = 0.10  # +10% mission rewards in district

REGIONAL_DOMINANCE_UNLOCK_LEVEL = 10
REGIONAL_DOMINANCE_COST = 500000
REGIONAL_DOMINANCE_BI_WEEKLY_DEFENSE = 40000
REGIONAL_DOMINANCE_BONUS = 0.20  # +20% mission rewards in region

# ============================================================================
# ACHIEVEMENTS & PROGRESSION
# ============================================================================

LEVEL_THRESHOLDS = [0, 400, 1200, 2800, 5500, 9500, 15000, 22000, 31000, 42000]
TEAM_COUNT_BASE = 2
TEAM_COUNT_PER_2_LEVELS = 1

LOW_LEVEL_XP_GAP = 2
LOW_LEVEL_XP_MULT_PER_GAP = 0.15
LOW_LEVEL_XP_MULT_MIN = 0.3

# ============================================================================
# EMPLOYEE ATTRIBUTES & SPECIALIZATIONS
# ============================================================================

ATTR_KEYS = ["forca", "inteligencia", "discricao", "conducao", "tiro", "hack", "negociacao", "sangue_frio", "resistencia"]

CATEGORY_ATTRS = {
    "assalto": ["tiro", "forca"],
    "logistica": ["conducao", "discricao"],
    "tecnica": ["hack", "inteligencia"],
    "influencia": ["negociacao", "sangue_frio"],
}

RARITIES = {
    "comum": {"name": "Comum", "mult": 1.0, "max_level": 5, "talent_slots": 1, "talent_chance": 0.12},
    "raro": {"name": "Raro", "mult": 1.5, "max_level": 7, "talent_slots": 1, "talent_chance": 0.6},
    "elite": {"name": "Elite", "mult": 2.5, "max_level": 9, "talent_slots": 2, "talent_chance": 1.0},
    "lendario": {"name": "Lendário", "mult": 4.0, "max_level": 10, "talent_slots": 3, "talent_chance": 1.0},
}

RARITY_MIN_RESPECT = {"comum": 0, "raro": 300, "elite": 1200, "lendario": 3500}

RANKS = ["recruta", "membro", "especialista", "veterano", "tenente", "chefe_equipa", "braco_direito"]
RANK_REQ_LEVEL = [1, 2, 3, 4, 6, 8, 10]

# ============================================================================
# TEAM PERFORMANCE MODIFIERS
# ============================================================================

TEAM_LEADER_MIN_RANK = "chefe_equipa"
NO_LEADER_PENALTY = 0.03
SOLO_MEMBER_PENALTY = 0.05
UNIFORM_SPEC_BONUS = 0.05
COORDINATION_BONUS_MAX = 0.05
COORDINATION_RAMP_S = 6 * 3600
REORG_AFTER_MISSION_S = 25
REORG_AFTER_ROSTER_CHANGE_S = 15
INCOMPLETE_TEAM_PREP_S = 8

# ============================================================================
# VEHICLE PERFORMANCE MODIFIERS
# ============================================================================

VEHICLE_CONDITION_PENALTY_THRESHOLD = 70
VEHICLE_CONDITION_PENALTY_MAX = 0.08
VEHICLE_MATCH_BONUS = 0.05
DISCREET_CATEGORIES = {"tecnica"}
LUXURY_HEAT_MULT = 1.4
WEAR_KM_RAMP = 8000
WEAR_KM_MAX_MULT = 1.5

# ============================================================================
# EMPLOYEE PERFORMANCE MODIFIERS
# ============================================================================

NEWBIE_RAMP_S = 3600
NEWBIE_PENALTY_MAX = 0.10
HIGH_MORALE_THRESHOLD = 90
HIGH_MORALE_BONUS = 0.05
LOW_MORALE_ABSENCE_THRESHOLD = 25
ABSENCE_CHANCE_PER_MIN = 0.003
ABSENCE_DURATION_S = 600
FULL_ENERGY_FATIGUE_MAX = 10
FULL_ENERGY_XP_BONUS = 0.10
XP_DECAY_IDLE_DAYS = 5
XP_DECAY_PER_MIN = 0.05

# ============================================================================
# MISSION MODIFIERS
# ============================================================================

REPEAT_TYPE_XP_MULT = 0.85
DURATION_REWARD_BASELINE_S = 90
DURATION_REWARD_MAX_BONUS = 0.15
DURATION_REWARD_MAX_MALUS = 0.10
DURATION_REWARD_FLOOR_S = 30
DURATION_REWARD_CEIL_S = 300
FAILED_TYPE_COOLDOWN_MIN = 8
RECALL_PENALTY_FRACTION = 0.5
RECALL_PENALTY_HEAT = 3
RECALL_PENALTY_FATIGUE = 8

# ============================================================================
# RANDOM EVENTS
# ============================================================================

TRAFFIC_DELAY_CHANCE = 0.12
TRAFFIC_DELAY_MAX_PCT = 0.15
UNEXPECTED_REPAIR_CHANCE_PER_RISK = 0.03
UNEXPECTED_REPAIR_CONDITION_HIT = 12
EXCEPTIONAL_PERFORMANCE_CHANCE = 0.08
EXCEPTIONAL_PERFORMANCE_XP_BONUS_PCT = 0.5
BONUS_LOOT_CHANCE = 0.06
BONUS_LOOT_MAX_PCT = 0.15

# ============================================================================
# VEHICLE WEAR
# ============================================================================

WEAR_PER_MISSION_SINCE_REPAIR = 0.08
WEAR_MISSIONS_SINCE_REPAIR_CAP = 10
EMPLOYEE_HEAVY_USE_THRESHOLD = 30
EMPLOYEE_HEAVY_USE_FATIGUE_MULT = 1.25

# ============================================================================
# WEAPON PERFORMANCE & WEAR
# ============================================================================
# NOTE: engine.py imports these transitively through game_data.py (not
# directly from this file) — see the WEAPON_* re-export in game_data.py's
# `from economy_constants import (...)` block. Adding a constant only here
# without also re-exporting it there means engine.py will never see it.

WEAPON_WEAR_PER_MISSION = 3.0          # desgaste base de condição por missão
WEAPON_WEAR_RISK_MULT = 1.5            # desgaste extra por ponto de risco da missão
WEAPON_PROFICIENCY_MAX = 100.0
WEAPON_PROFICIENCY_GAIN_PER_MISSION = 4.0
WEAPON_PROFICIENCY_BONUS_MAX_PCT = 0.08   # bónus de chance máximo à proficiência máxima
WEAPON_REPAIR_COST_MULTIPLIER = 0.5       # custo de reparação = maintenance_cost * multiplicador * (% em falta)
WEAPON_LOUD_HEAT_MULT = 1.3               # mirror de LUXURY_HEAT_MULT, mas para armas "loud"
WEAPON_COMBAT_SCORE_SCALE = 0.15          # escala o score de combate (0-1) para um bónus de chance
WEAPON_BONUS_MIN = -0.05                  # limite inferior do bónus total de armamento
WEAPON_BONUS_MAX = 0.12                   # limite superior do bónus total de armamento
WEAPON_COMPATIBILITY_MIN_FACTOR = 0.4     # factor mínimo quando os requisitos de atributo não são cumpridos

# ---------------- Reformulação do cálculo de chance (sistema modular) ----------------
LOYALTY_BONUS_MAX = 0.04                  # bónus máx. quando a lealdade média está bem acima do padrão (70)
LOYALTY_PENALTY_MAX = 0.06                # penalização máx. quando a lealdade média está muito abaixo do padrão
HQ_CHANCE_BONUS_PER_LEVEL = 0.006         # bónus fixo por nível de QG, agnóstico de categoria ("organização evoluída")
INCOMPLETE_CREW_PENALTY_PER_MISSING = 0.05   # penalização por cada membro em falta face ao min_members da missão
INCOMPLETE_CREW_PENALTY_MAX = 0.20
VEHICLE_MISMATCH_PENALTY = 0.04           # penalização quando o veículo tem best_for definido e a categoria não está lá
WEAPON_MISMATCH_PENALTY_MAX = 0.04        # penalização máx. quando a arma equipada é claramente inadequada à categoria
LOW_CHANCE_CONFIRM_THRESHOLD = 0.15       # abaixo disto, o frontend pede confirmação extra antes de despachar

# ============================================================================
# TRAVEL & LOGISTICS
# ============================================================================

LOCAL_PRESENCE_RADIUS_KM = 1.5
LOCAL_PRESENCE_PREP_REDUCTION_S = 6
LOCAL_PRESENCE_PREP_REDUCTION_MAX_S = 18

HIDEOUT_PREP_REDUCTION_PER_LEVEL = 0.25
LAUNDER_PROPERTY_BONUS_PER_LEVEL = 0.03

# ============================================================================
# MISCELLANEOUS
# ============================================================================

RAIN_CHANCE = 0.10
RAIN_TRAVEL_MULT = 1.10
NIGHT_STEALTH_HOURS = (0, 6)
NIGHT_STEALTH_BONUS = 0.04

EMP_LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]

# ============================================================================
# SUMMARY OF REDESIGNED VALUES
# ============================================================================
#
# PROPERTY COSTS: +50% (was underpriced, now breakeven is 2-3 days instead of <1 day)
# PASSIVE INCOME: -30% (was too high, now sustainable but meaningful)
# SALARY SCALING: Now multiplicative (was linear, encouraged infinite hiring)
# HEAT INTERCEPT: Capped at 40% (was 45%, now unbeatable at high heat)
# HEAT BRIBES: Halved cost (was exponential, now realistic recovery)
# VEHICLE REPAIR: 6x increase (was negligible, now meaningful decision)
# MEMBER SPLIT PENALTY: Doubled (was too lenient, now encourages lean teams)
# LATE-GAME SINKS: NEW (government corruption, prestige items, territory)
#
# ============================================================================
