import random
from economy_constants import (
    PROPERTY_COSTS, TEAM_CREATE_COST, PAYROLL_CYCLE_MIN, POOL_REFRESH_MIN,
    DIRTY_MONEY_CAP_BASE, DIRTY_MONEY_CAP_PER_LEVEL,
    VEHICLE_REPAIR_BASE_MULTIPLIER, VEHICLE_REPAIR_MIN,
    MEMBER_SPLIT_PENALTY_PER_EXTRA, MEMBER_SPLIT_PENALTY_MAX,
    TEAM_MAX_MEMBERS, BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, PROPERTY_MAX_LEVEL,
    TEAM_COST_SCALING_BASE, PAYROLL_MORALE_REGEN,
    AGE_DECAY_MAX, AGE_DECAY_RAMP_S,
    PROPERTY_MAINTENANCE_PCT_PER_DAY, PROPERTY_CONDITION_RECOVERY_PER_HOUR,
    PROPERTY_CONDITION_DECAY_PER_HOUR, PROPERTY_UPGRADE_BASE_S, PROPERTY_UPGRADE_PER_LEVEL_S,
    HIDEOUT_PREP_REDUCTION_PER_LEVEL, LAUNDER_PROPERTY_BONUS_PER_LEVEL,
    DIRTY_MONEY_HEAT_THRESHOLD, DIRTY_MONEY_HEAT_PER_10K,
    LEVEL_THRESHOLDS, EMP_LEVEL_XP, PROPERTY_STACK_DIMINISH,
    FUEL_PRICES, REFUEL_DURATION_BASE_S, REFUEL_DURATION_PER_L_S,
    HQ_MAX_LEVEL, HQ_LEVEL_BENEFITS, HQ_PRIORITIES, HQ_DEFAULT_PRIORITY, HQ_DEPARTMENTS,
    WEAPON_WEAR_PER_MISSION, WEAPON_WEAR_RISK_MULT, WEAPON_PROFICIENCY_MAX,
    WEAPON_PROFICIENCY_GAIN_PER_MISSION, WEAPON_PROFICIENCY_BONUS_MAX_PCT,
    WEAPON_REPAIR_COST_MULTIPLIER, WEAPON_LOUD_HEAT_MULT,
    WEAPON_COMBAT_SCORE_SCALE, WEAPON_BONUS_MIN, WEAPON_BONUS_MAX, WEAPON_COMPATIBILITY_MIN_FACTOR,
    LOYALTY_BONUS_MAX, LOYALTY_PENALTY_MAX, HQ_CHANCE_BONUS_PER_LEVEL,
    INCOMPLETE_CREW_PENALTY_PER_MISSING, INCOMPLETE_CREW_PENALTY_MAX,
    VEHICLE_MISMATCH_PENALTY, WEAPON_MISMATCH_PENALTY_MAX, LOW_CHANCE_CONFIRM_THRESHOLD,
    VEHICLE_TRANSFER_COST_PER_KM, VEHICLE_TRANSFER_COST_MIN,
    VEHICLE_TRANSFER_DURATION_BASE_S, VEHICLE_TRANSFER_DURATION_PER_KM_S,
    PROPERTY_INFLUENCE_RADIUS_KM, PROPERTY_SPOT_WEIGHT, LISBON_SPOT_WEIGHT,
    SPAWN_HQ_FALLOFF_KM,
    # ---- SSS-tier formula engine (v2) ----
    CHANCE_FLOOR, CHANCE_CEILING, CHANCE_SOFT_KNEE, CHANCE_SOFT_SPAN,
    RISK_PENALTY_LINEAR, RISK_PENALTY_QUADRATIC,
    PRIMARY_ATTR_WEIGHT_MAIN, PRIMARY_ATTR_WEIGHT_SECONDARY,
    MENTOR_MIN_RANK, MENTOR_NEWBIE_RELIEF,
    FATIGUE_CURVE_EXP, MORALE_PENALTY_ASYMMETRY,
    TEAM_SYNERGY_MAX, TEAM_SYNERGY_BASELINE, TEAM_SYNERGY_SPREAD,
    STEALTH_SYNERGY_BONUS, STEALTH_SYNERGY_PENALTY,
    STEALTH_VEHICLE_DISCRETION_MIN, NOISY_VEHICLE_DISCRETION_MAX,
    WEAPON_SKILL_FLOOR, WEAPON_SKILL_ATTR_CAP,
    # ---- SSS v5 — QI das Armas ----
    WEAPON_DURABILITY_WEAR_REF, WEAPON_CONDITION_SOFT_KNEE,
    WEAPON_JAM_RELIABILITY_WEIGHT, WEAPON_JAM_CONDITION_THRESHOLD,
    WEAPON_JAM_CONDITION_WEIGHT, WEAPON_JAM_MAX,
    WEAPON_JAM_CHANCE_PENALTY, WEAPON_JAM_CHANCE_PENALTY_CAP,
    WEAPON_JAM_EXTRA_WEAR, WEAPON_JAM_WARN_RISK,
    WEAPON_INTIMIDATION_ESCAPE_MAX, WEAPON_STEALTH_DISCRETION_REF,
    VEHICLE_SPEED_FLOOR, VEHICLE_SPEED_CURVE_EXP,
    VEHICLE_WEAR_BASE, VEHICLE_WEAR_PER_RISK, VEHICLE_WEAR_PER_KM,
    ESCAPE_SPEED_BASELINE, ESCAPE_SPEED_BONUS_PER_UNIT, ESCAPE_SPEED_BONUS_MAX,
    CHASE_DISCRETION_RELIEF, CHASE_HEAT_SPAN, CHASE_HEAT_EXP,
    ESCAPE_HEAT_SPAN, ESCAPE_HEAT_EXP,
    POLICE_PROB_BASE, POLICE_PROB_SPAN, POLICE_PROB_EXP, POLICE_PROB_CAP,
    HEAT_DECAY_BASE_PER_MIN, HEAT_DECAY_SLOPE,
    POLICE_URBAN_CHANCE_PENALTY, POLICE_RURAL_CHANCE_BONUS,
    POLICE_URBAN_CHASE_BONUS, POLICE_RURAL_CHASE_RELIEF,
    POLICE_URBAN_ESCAPE_PENALTY, POLICE_RURAL_ESCAPE_BONUS,
    # ---- Loja ----
    SPEEDUP_COST_PER_MIN, SPEEDUP_COST_MIN,
    SLOT_COST_VEHICLE_BASE, SLOT_COST_EMPLOYEE_BASE, SLOT_COST_SCALE_PER_UNIT,
    VIP_PLANS, VIP_INCOME_MULT, VIP_HEAT_RELIEF_MULT, VIP_REFUEL_SPEED_MULT,
    VEHICLE_PAINTS, TEAM_EMBLEMS, HQ_SKINS,
)

LISBON_SPOTS = [
    {"name": "Baixa", "lat": 38.7118, "lng": -9.1366},
    {"name": "Alfama", "lat": 38.7126, "lng": -9.1290},
    {"name": "Bairro Alto", "lat": 38.7139, "lng": -9.1445},
    {"name": "Cais do Sodré", "lat": 38.7060, "lng": -9.1445},
    {"name": "Belém", "lat": 38.6970, "lng": -9.2065},
    {"name": "Alcântara", "lat": 38.7040, "lng": -9.1750},
    {"name": "Parque das Nações", "lat": 38.7680, "lng": -9.0970},
    {"name": "Marvila", "lat": 38.7440, "lng": -9.1030},
    {"name": "Areeiro", "lat": 38.7420, "lng": -9.1330},
    {"name": "Campo de Ourique", "lat": 38.7180, "lng": -9.1650},
    {"name": "Benfica", "lat": 38.7500, "lng": -9.2030},
    {"name": "Lumiar", "lat": 38.7730, "lng": -9.1600},
    {"name": "Mouraria", "lat": 38.7160, "lng": -9.1330},
    {"name": "Estrela", "lat": 38.7130, "lng": -9.1600},
    {"name": "Graça", "lat": 38.7180, "lng": -9.1240},
    {"name": "Amoreiras", "lat": 38.7230, "lng": -9.1600},
]

HQ_LOCATION = {"name": "Armazém do Cais", "lat": 38.7062, "lng": -9.1480}

# ---------------------------------------------------------------------------
# Divisão territorial das forças de segurança (PSP urbano / GNR rural).
# Espelho EXATO de PSP_CITIES em frontend/src/lib/police.js — o backend e a
# simulação visual têm de classificar cada ponto da mesma forma. Um ponto a
# menos de `r` metros do centro de uma região cai nessa força; caso contrário
# cai na força por omissão (GNR — vilas, aldeias, campo, estradas, periferias).
#
# Estrutura genérica (N forças): para acrescentar a PJ/GOE/etc. no futuro basta
# juntar entradas com outra `force` e um efeito em POLICE_FORCE_EFFECTS — sem
# refatorações. `police_force_for()` (engine.py) resolve a força competente.
POLICE_DEFAULT_FORCE = "GNR"
POLICE_FORCE_REGIONS = [
    {"force": "PSP", "name": "Lisboa", "lat": 38.7223, "lng": -9.1393, "r": 9500},
    {"force": "PSP", "name": "Amadora", "lat": 38.7597, "lng": -9.2399, "r": 3500},
    {"force": "PSP", "name": "Cascais", "lat": 38.6979, "lng": -9.4215, "r": 3500},
    {"force": "PSP", "name": "Almada", "lat": 38.68, "lng": -9.1587, "r": 3500},
    {"force": "PSP", "name": "Porto", "lat": 41.1496, "lng": -8.6109, "r": 7500},
    {"force": "PSP", "name": "Vila Nova de Gaia", "lat": 41.124, "lng": -8.6118, "r": 4500},
    {"force": "PSP", "name": "Braga", "lat": 41.5454, "lng": -8.4265, "r": 5000},
    {"force": "PSP", "name": "Guimarães", "lat": 41.4425, "lng": -8.2918, "r": 3500},
    {"force": "PSP", "name": "Coimbra", "lat": 40.2033, "lng": -8.4103, "r": 5000},
    {"force": "PSP", "name": "Faro", "lat": 37.0194, "lng": -7.9304, "r": 4000},
    {"force": "PSP", "name": "Setúbal", "lat": 38.5244, "lng": -8.8882, "r": 4500},
    {"force": "PSP", "name": "Aveiro", "lat": 40.6405, "lng": -8.6538, "r": 4000},
    {"force": "PSP", "name": "Viseu", "lat": 40.6566, "lng": -7.9124, "r": 3500},
    {"force": "PSP", "name": "Leiria", "lat": 39.7443, "lng": -8.807, "r": 3500},
    {"force": "PSP", "name": "Évora", "lat": 38.5714, "lng": -7.9135, "r": 3500},
    {"force": "PSP", "name": "Santarém", "lat": 39.2362, "lng": -8.6868, "r": 3000},
    {"force": "PSP", "name": "Viana do Castelo", "lat": 41.6946, "lng": -8.8302, "r": 3000},
    {"force": "PSP", "name": "Vila Real", "lat": 41.3006, "lng": -7.7441, "r": 3000},
    {"force": "PSP", "name": "Bragança", "lat": 41.8061, "lng": -6.7567, "r": 3000},
    {"force": "PSP", "name": "Castelo Branco", "lat": 39.8222, "lng": -7.4931, "r": 3000},
    {"force": "PSP", "name": "Guarda", "lat": 40.5373, "lng": -7.2675, "r": 3000},
    {"force": "PSP", "name": "Portalegre", "lat": 39.2967, "lng": -7.4286, "r": 2500},
    {"force": "PSP", "name": "Beja", "lat": 38.0151, "lng": -7.8632, "r": 3000},
    {"force": "PSP", "name": "Funchal", "lat": 32.6669, "lng": -16.9241, "r": 4500},
    {"force": "PSP", "name": "Ponta Delgada", "lat": 37.7412, "lng": -25.6756, "r": 3500},
]

# Efeito de cada força no risco REAL da operação (chance, perseguição, fuga).
# `.get(force, {})` devolve efeito neutro para forças ainda sem regras — mais
# uma força no futuro = mais uma entrada aqui, sem tocar na lógica.
POLICE_FORCE_EFFECTS = {
    "PSP": {
        "terrain": "urbana", "chance": -POLICE_URBAN_CHANCE_PENALTY,
        "chase": POLICE_URBAN_CHASE_BONUS, "escape": -POLICE_URBAN_ESCAPE_PENALTY,
        "label": "Zona urbana — PSP",
        "tip": "Centro urbano sob competência da PSP: malha policial densa e resposta rápida — mais arriscado e mais difícil de despistar.",
    },
    "GNR": {
        "terrain": "rural", "chance": POLICE_RURAL_CHANCE_BONUS,
        "chase": -POLICE_RURAL_CHASE_RELIEF, "escape": POLICE_RURAL_ESCAPE_BONUS,
        "label": "Zona rural — GNR",
        "tip": "Zona rural/estrada sob competência da GNR: patrulhas dispersas por muito terreno — menos vigilância e fuga mais fácil.",
    },
}

TEAM_NAMES = ["Crew Alfa", "Crew Bravo", "Crew Cobra", "Crew Delta", "Crew Eco",
              "Crew Fénix", "Crew Gama", "Crew Hidra", "Crew Íbis", "Crew Jaguar",
              "Crew Kilo", "Crew Lince", "Crew Mamba", "Crew Norte", "Crew Onix"]

# TEAM_CREATE_COST is imported from economy_constants.py

TEAM_SPECS = {
    "assalto": {"name": "Crew de Assalto", "desc": "Especializada em assaltos, roubos e ataques a territórios."},
    "logistica": {"name": "Rede Logística", "desc": "Transporte de mercadorias ilegais e contrabando."},
    "tecnica": {"name": "Célula Técnica", "desc": "Hacks, infiltrações e vigilância digital."},
    "influencia": {"name": "Unidade de Influência", "desc": "Cobranças, lavagem de dinheiro e operações VIP."},
}

# ---------------- Funcionários ----------------

ATTR_KEYS = ["forca", "inteligencia", "discricao", "conducao", "tiro", "hack", "negociacao", "sangue_frio", "resistencia"]

CATEGORY_ATTRS = {
    "assalto": ["tiro", "forca"],
    "logistica": ["conducao", "discricao"],
    "tecnica": ["hack", "inteligencia"],
    "influencia": ["negociacao", "sangue_frio"],
}

SPECIALIZATIONS = {
    "assaltante": {"name": "Assaltante", "spec": "assalto", "attrs": ["tiro", "forca"], "salary": 260,
                   "desc": "Linha da frente em assaltos e ataques."},
    "motorista": {"name": "Motorista", "spec": "logistica", "attrs": ["conducao", "sangue_frio"], "salary": 220,
                  "desc": "Rotas de fuga e transportes rápidos."},
    "hacker": {"name": "Hacker", "spec": "tecnica", "attrs": ["hack", "inteligencia"], "salary": 320,
               "desc": "Sistemas, dados e infiltração digital."},
    "mecanico": {"name": "Mecânico", "spec": "suporte", "attrs": ["inteligencia", "resistencia"], "salary": 200,
                 "desc": "Passivo: -15% custo de reparações.", "passive": {"repair_discount": 0.15}},
    "informador": {"name": "Informador", "spec": "suporte", "attrs": ["discricao", "negociacao"], "salary": 180,
                   "desc": "Passivo: +8% oportunidades raras.", "passive": {"rare_opp": 0.08}},
    "medico": {"name": "Médico Clandestino", "spec": "suporte", "attrs": ["inteligencia", "sangue_frio"], "salary": 340,
               "desc": "Passivo: feridos recuperam 40% mais rápido e barato.", "passive": {"heal": 0.4}},
    "lavador": {"name": "Lavador de Dinheiro", "spec": "influencia", "attrs": ["negociacao", "inteligencia"], "salary": 300,
                "desc": "Passivo: +5% taxa de lavagem manual.", "passive": {"launder_rate": 0.05}},
    "advogado": {"name": "Advogado", "spec": "suporte", "attrs": ["negociacao", "inteligencia"], "salary": 380,
                 "desc": "Passivo: libertações 40% mais rápidas e baratas.", "passive": {"legal": 0.4}},
    "negociador": {"name": "Negociador", "spec": "influencia", "attrs": ["negociacao", "sangue_frio"], "salary": 280,
                   "desc": "Cobranças, acordos e operações VIP."},
    "seguranca": {"name": "Segurança", "spec": "assalto", "attrs": ["forca", "resistencia"], "salary": 210,
                  "desc": "Proteção de equipas e cargas."},
    "contrabandista": {"name": "Contrabandista", "spec": "logistica", "attrs": ["discricao", "conducao"], "salary": 290,
                       "desc": "Mercadoria ilegal através de fronteiras."},
    "falsificador": {"name": "Falsificador", "spec": "tecnica", "attrs": ["discricao", "inteligencia"], "salary": 270,
                     "desc": "Documentos, identidades e notas."},
    "espiao": {"name": "Espião", "spec": "tecnica", "attrs": ["discricao", "sangue_frio"], "salary": 350,
               "desc": "Infiltrações e vigilância de alto risco."},
    "gestor": {"name": "Gestor de Empresa", "spec": "suporte", "attrs": ["inteligencia", "negociacao"], "salary": 310,
               "desc": "Passivo: +25% lavagem passiva das empresas.", "passive": {"empresa_boost": 0.25}},
    "franco_atirador": {"name": "Franco-Atirador", "spec": "assalto", "attrs": ["tiro", "sangue_frio"], "salary": 300,
                        "desc": "Cobertura à distância em assaltos de alto risco."},
    "arrombador": {"name": "Arrombador", "spec": "assalto", "attrs": ["discricao", "forca"], "salary": 240,
                   "desc": "Abre qualquer fechadura ou cofre sem dar alarme."},
    "piloto": {"name": "Piloto de Fuga", "spec": "logistica", "attrs": ["conducao", "sangue_frio"], "salary": 260,
               "desc": "Rotas de fuga sob pressão máxima."},
    "estafeta": {"name": "Estafeta", "spec": "logistica", "attrs": ["conducao", "discricao"], "salary": 200,
                 "desc": "Entregas rápidas e discretas pela cidade."},
    "engenheiro_social": {"name": "Engenheiro Social", "spec": "tecnica", "attrs": ["negociacao", "hack"], "salary": 300,
                          "desc": "Manipula pessoas para contornar segurança digital."},
    "criptografo": {"name": "Criptógrafo", "spec": "tecnica", "attrs": ["hack", "inteligencia"], "salary": 330,
                    "desc": "Quebra e cria cifras para operações técnicas."},
    "relacoes_publicas": {"name": "Relações Públicas", "spec": "influencia", "attrs": ["negociacao", "inteligencia"], "salary": 290,
                          "desc": "Gere a imagem pública da organização."},
    "chantagista": {"name": "Chantagista", "spec": "influencia", "attrs": ["negociacao", "discricao"], "salary": 270,
                    "desc": "Encontra e explora os segredos de quem manda."},
    "quimico": {"name": "Químico", "spec": "suporte", "attrs": ["inteligencia", "resistencia"], "salary": 350,
                "desc": "Passivo: +20% produção de dinheiro sujo dos laboratórios.", "passive": {"lab_boost": 0.20}},
    "recrutador": {"name": "Recrutador", "spec": "suporte", "attrs": ["negociacao", "discricao"], "salary": 260,
                   "desc": "Passivo: +5% oportunidades raras (bom faro para talento).", "passive": {"rare_opp": 0.05}},
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

TALENTS = {
    "motorista_fantasma": {"name": "Motorista Fantasma", "desc": "-10% tempo de viagem; despista perseguições policiais mais facilmente",
                          "roles": ["motorista", "contrabandista", "piloto", "estafeta"]},
    "contabilista_sujo": {"name": "Contabilista Sujo", "desc": "+15% lavagem de dinheiro", "roles": ["lavador", "gestor"]},
    "olhos_na_rua": {"name": "Olhos na Rua", "desc": "+10% oportunidades raras", "roles": ["informador", "espiao", "recrutador"]},
    "mecanico_elite": {"name": "Mecânico de Elite", "desc": "-20% custo de reparação", "roles": ["mecanico"]},
    "pontaria_letal": {"name": "Pontaria Letal", "desc": "+5% sucesso em assaltos",
                       "roles": ["assaltante", "seguranca", "franco_atirador", "arrombador"]},
    "rei_da_noite": {"name": "Rei da Noite", "desc": "-20% fadiga em missões", "roles": []},
    "lingua_de_prata": {"name": "Língua de Prata", "desc": "-15% custo de subornos",
                       "roles": ["negociador", "advogado", "relacoes_publicas", "chantagista"]},
    "fantasma_digital": {"name": "Fantasma Digital", "desc": "-50% calor em operações técnicas",
                        "roles": ["hacker", "falsificador", "espiao", "engenheiro_social", "criptografo"]},
    "maos_de_seda": {"name": "Mãos de Seda", "desc": "+15% eficácia na cura de feridos", "roles": ["medico"]},
    "formula_secreta": {"name": "Fórmula Secreta", "desc": "+15% produção de laboratórios", "roles": ["quimico"]},
}

RECRUIT_SOURCES = {
    "rua": {"name": "Rua", "min_level": 1, "roles": ["assaltante", "seguranca", "motorista", "arrombador"],
            "rarity_w": {"comum": 80, "raro": 18, "elite": 2, "lendario": 0}},
    "bares": {"name": "Bares", "min_level": 1, "roles": ["informador", "contrabandista", "negociador", "motorista", "piloto", "estafeta"],
              "rarity_w": {"comum": 70, "raro": 25, "elite": 5, "lendario": 0}},
    "empresas": {"name": "Empresas", "min_level": 2, "roles": ["gestor", "advogado", "lavador", "relacoes_publicas", "recrutador"],
                 "rarity_w": {"comum": 55, "raro": 35, "elite": 9, "lendario": 1}},
    "prisoes": {"name": "Prisões", "min_level": 3, "roles": ["assaltante", "falsificador", "seguranca", "contrabandista", "franco_atirador", "chantagista"],
                "rarity_w": {"comum": 50, "raro": 35, "elite": 13, "lendario": 2}},
    "mercado_negro": {"name": "Mercado Negro", "min_level": 4, "roles": ["hacker", "falsificador", "espiao", "medico", "engenheiro_social", "criptografo", "quimico"],
                      "rarity_w": {"comum": 35, "raro": 40, "elite": 20, "lendario": 5}},
    "contactos": {"name": "Contactos", "min_level": 5, "roles": list(SPECIALIZATIONS.keys()),
                  "rarity_w": {"comum": 20, "raro": 40, "elite": 30, "lendario": 10}},
}

# POOL_REFRESH_MIN and PAYROLL_CYCLE_MIN are imported from economy_constants.py
# EMP_LEVEL_XP is imported from economy_constants.py

TRAINING_COURSES = {
    "combate": {"name": "Combate", "attr": "tiro", "spec": "assalto", "cost": 3000, "duration_s": 120, "xp": 60},
    "conducao": {"name": "Condução Evasiva", "attr": "conducao", "spec": "logistica", "cost": 2500, "duration_s": 100, "xp": 50},
    "hacking": {"name": "Hacking", "attr": "hack", "spec": "tecnica", "cost": 3500, "duration_s": 140, "xp": 70},
    "discricao": {"name": "Discrição", "attr": "discricao", "spec": None, "cost": 2800, "duration_s": 110, "xp": 55},
    "negociacao": {"name": "Negociação", "attr": "negociacao", "spec": "influencia", "cost": 3000, "duration_s": 120, "xp": 60},
    "primeiros_socorros": {"name": "Primeiros Socorros", "attr": "inteligencia", "spec": None, "cost": 2600, "duration_s": 100, "xp": 45},
    "logistica": {"name": "Logística", "attr": "resistencia", "spec": "logistica", "cost": 2400, "duration_s": 90, "xp": 45},
    "gestao": {"name": "Gestão", "attr": "inteligencia", "spec": None, "cost": 3200, "duration_s": 130, "xp": 60},
    "lideranca": {"name": "Liderança", "attr": "sangue_frio", "spec": None, "cost": 4000, "duration_s": 150, "xp": 70, "morale": 10},
    "treino_fisico": {"name": "Treino Físico", "attr": "forca", "spec": "assalto", "cost": 2700, "duration_s": 100, "xp": 50},
}

_FIRST_NAMES = ["Rui", "Tiago", "Miguel", "André", "Bruno", "Carlos", "Diogo", "Vasco", "Nuno", "Pedro",
                "Marta", "Inês", "Sofia", "Carla", "Beatriz", "Joana", "Rita", "Ana", "Hugo", "Fábio",
                "Leonor", "Duarte", "Gonçalo", "Matilde", "Ricardo", "Telma", "Xavier", "Lara"]
_LAST_NAMES = ["Silva", "Santos", "Ferreira", "Costa", "Oliveira", "Rodrigues", "Martins", "Sousa",
               "Fonseca", "Ramos", "Lopes", "Vieira", "Cardoso", "Pinto", "Moreira", "Correia",
               "Teixeira", "Nunes", "Barbosa", "Machado"]


def random_employee_name():
    return f"{random.choice(_FIRST_NAMES)} {random.choice(_LAST_NAMES)}"


# ---------------- Veículos ----------------

VEHICLE_MODELS = {
    "usado": {"name": "Sedan Usado", "min_level": 1, "price": 6000, "speed": 9,
              "fuel_type": "gasolina", "tank_l": 45, "cons": 8.0, "seats": 4,
              "discretion": 75, "best_for": ["logistica", "influencia"], "luxury": False},
    "moto": {"name": "Moto Rápida", "min_level": 1, "price": 12000, "speed": 15,
             "fuel_type": "gasolina", "tank_l": 15, "cons": 4.5, "seats": 2,
             "discretion": 70, "best_for": ["assalto", "tecnica"], "luxury": False},
    "van": {"name": "Van Reforçada", "min_level": 2, "price": 18000, "speed": 12,
            "fuel_type": "gasoleo", "tank_l": 70, "cons": 10.0, "seats": 6,
            "discretion": 80, "best_for": ["logistica"], "luxury": False},
    "desportivo": {"name": "Desportivo", "min_level": 3, "price": 30000, "speed": 19,
                   "fuel_type": "gasolina", "tank_l": 55, "cons": 12.0, "seats": 2,
                   "discretion": 15, "best_for": ["especial"], "luxury": True},
    "suv_blindado": {"name": "SUV Blindado", "min_level": 4, "price": 45000, "speed": 14,
                     "fuel_type": "gasoleo", "tank_l": 80, "cons": 13.0, "seats": 5,
                     "discretion": 35, "best_for": ["assalto"], "luxury": False},
    "supercarro": {"name": "Supercarro", "min_level": 5, "price": 65000, "speed": 26,
                   "fuel_type": "gasolina", "tank_l": 60, "cons": 15.0, "seats": 2,
                   "discretion": 8, "best_for": ["especial"], "luxury": True},
    "carrinha_entrega": {"name": "Carrinha de Entregas", "min_level": 1, "price": 9000, "speed": 10,
                         "fuel_type": "gasolina", "tank_l": 50, "cons": 7.5, "seats": 3,
                         "discretion": 85, "best_for": ["logistica"], "luxury": False},
    "berlina_blindada": {"name": "Berlina Blindada", "min_level": 2, "price": 22000, "speed": 13,
                         "fuel_type": "gasoleo", "tank_l": 65, "cons": 11.0, "seats": 4,
                         "discretion": 45, "best_for": ["influencia"], "luxury": False},
    "buggy_todo_terreno": {"name": "Buggy Todo-o-Terreno", "min_level": 2, "price": 20000, "speed": 16,
                          "fuel_type": "gasolina", "tank_l": 40, "cons": 9.0, "seats": 2,
                          "discretion": 25, "best_for": ["assalto"], "luxury": False},
    "limousine": {"name": "Limousine", "min_level": 4, "price": 50000, "speed": 11,
                 "fuel_type": "gasolina", "tank_l": 70, "cons": 14.0, "seats": 6,
                 "discretion": 5, "best_for": ["influencia", "especial"], "luxury": True},
    "carro_furtivo": {"name": "Carro Furtivo", "min_level": 5, "price": 55000, "speed": 20,
                     "fuel_type": "gasolina", "tank_l": 50, "cons": 10.0, "seats": 2,
                     "discretion": 95, "best_for": ["tecnica", "especial"], "luxury": False},
}


# ---------------- Armamento ----------------
# Equipamento operacional pessoal — uma arma por funcionário (ao contrário do
# veículo, partilhado por toda a equipa). Preços por isso deliberadamente bem
# abaixo de veículos: equipar uma equipa inteira custa até 4x o preço unitário.
# Cada modelo tem vantagens/desvantagens reais por categoria de missão via
# "best_for" + WEAPON_CATEGORY_WEIGHTS — "mais cara" não implica "sempre
# melhor em tudo".

WEAPON_MODELS = {
    "faca_taser": {
        "name": "Faca/Taser", "category": "silenciosa", "min_level": 1, "price": 1200,
        "power": 15, "accuracy": 65, "range": 3, "weight": 5, "use_speed": 95,
        "durability": 90, "reliability": 95, "magazine_capacity": 1, "maintenance_cost": 50,
        "discretion": 95, "best_for": ["tecnica", "influencia"], "requires_attr": {}, "loud": False,
        "desc": "Sem munições, silenciosa — ideal para operações discretas, mas quase sem poder de fogo.",
    },
    "pistola": {
        "name": "Pistola", "category": "equilibrada", "min_level": 1, "price": 2800,
        "power": 40, "accuracy": 60, "range": 25, "weight": 20, "use_speed": 75,
        "durability": 70, "reliability": 85, "magazine_capacity": 15, "maintenance_cost": 180,
        "discretion": 45, "best_for": ["assalto", "tecnica", "influencia"], "requires_attr": {}, "loud": True,
        "desc": "Equilibrada e sem requisitos — funciona em qualquer categoria, sem se destacar em nenhuma.",
    },
    "espingarda": {
        "name": "Espingarda", "category": "assalto", "min_level": 2, "price": 5000,
        "power": 85, "accuracy": 45, "range": 12, "weight": 55, "use_speed": 55,
        "durability": 65, "reliability": 80, "magazine_capacity": 6, "maintenance_cost": 280,
        "discretion": 20, "best_for": ["assalto"], "requires_attr": {"forca": 4}, "loud": True,
        "desc": "Potência elevada a curta distância — péssima em operações discretas ou de longo alcance.",
    },
    "submetralhadora": {
        "name": "Submetralhadora", "category": "assalto", "min_level": 3, "price": 10000,
        "power": 60, "accuracy": 50, "range": 30, "weight": 45, "use_speed": 90,
        "durability": 60, "reliability": 75, "magazine_capacity": 30, "maintenance_cost": 450,
        "discretion": 25, "best_for": ["assalto", "especial"], "requires_attr": {"forca": 3, "tiro": 4}, "loud": True,
        "desc": "Cadência e carregador elevados — precisão baixa, exige manutenção frequente.",
    },
    "pistola_silenciada": {
        "name": "Pistola Silenciada", "category": "silenciosa", "min_level": 3, "price": 8000,
        "power": 35, "accuracy": 75, "range": 20, "weight": 15, "use_speed": 85,
        "durability": 80, "reliability": 90, "magazine_capacity": 12, "maintenance_cost": 240,
        "discretion": 85, "best_for": ["tecnica", "especial"], "requires_attr": {"discricao": 4}, "loud": False,
        "desc": "Discreta com poder de fogo real — o upgrade natural da faca para operações silenciosas de alto risco.",
    },
    "cacadeira_serrada": {
        "name": "Caçadeira de Canos Serrados", "category": "assalto", "min_level": 3, "price": 6500,
        "power": 95, "accuracy": 35, "range": 8, "weight": 40, "use_speed": 65,
        "durability": 45, "reliability": 60, "magazine_capacity": 2, "maintenance_cost": 320,
        "discretion": 15, "best_for": ["assalto"], "requires_attr": {"forca": 5}, "loud": True,
        "desc": "Devastadora à queima-roupa e barata — mas encrava com frequência e desfaz-se depressa. Alto risco, alto impacto.",
    },
    "rifle_assalto": {
        "name": "Rifle de Assalto", "category": "assalto_especial", "min_level": 4, "price": 18000,
        "power": 75, "accuracy": 70, "range": 55, "weight": 60, "use_speed": 70,
        "durability": 75, "reliability": 85, "magazine_capacity": 25, "maintenance_cost": 650,
        "discretion": 30, "best_for": ["assalto", "especial"], "requires_attr": {"tiro": 5, "forca": 4}, "loud": True,
        "desc": "Alta gama equilibrada — sem fraquezas graves, mas cara e exigente.",
    },
    "rifle_precisao": {
        "name": "Rifle de Precisão", "category": "tecnica_especial", "min_level": 5, "price": 32000,
        "power": 90, "accuracy": 95, "range": 95, "weight": 70, "use_speed": 25,
        "durability": 80, "reliability": 80, "magazine_capacity": 5, "maintenance_cost": 900,
        "discretion": 65, "best_for": ["tecnica", "especial"], "requires_attr": {"tiro": 7, "inteligencia": 4}, "loud": False,
        "desc": "Precisão e alcance máximos, carregador e velocidade mínimos — investimento para 1-2 especialistas, não para toda a equipa.",
    },
    "metralhadora_ligeira": {
        "name": "Metralhadora Ligeira", "category": "assalto_pesado", "min_level": 6, "price": 45000,
        "power": 88, "accuracy": 55, "range": 60, "weight": 90, "use_speed": 60,
        "durability": 85, "reliability": 82, "magazine_capacity": 100, "maintenance_cost": 1200,
        "discretion": 5, "best_for": ["assalto", "especial"], "requires_attr": {"forca": 7, "tiro": 6}, "loud": True,
        "desc": "Supressão total — poder e carregador esmagadores, mas pesadíssima, caríssima de manter e impossível de esconder.",
    },
}

WEAPON_CATEGORIES = {
    "silenciosa": {"name": "Silenciosa", "desc": "Sem barulho, ideal para discrição."},
    "equilibrada": {"name": "Equilibrada", "desc": "Sem requisitos, funciona em qualquer lado."},
    "assalto": {"name": "Assalto", "desc": "Potência e cadência para operações de força."},
    "assalto_especial": {"name": "Assalto/Especial", "desc": "Alta gama equilibrada."},
    "assalto_pesado": {"name": "Assalto Pesado", "desc": "Supressão máxima para quem aguenta o peso."},
    "tecnica_especial": {"name": "Técnica/Especial", "desc": "Precisão e alcance para operações de alto risco."},
}

# Peso de cada estatística (potência/precisão/alcance/leveza/velocidade/
# carregador) no score de combate, por categoria de missão — soma ~1.0 por
# categoria. É esta ponderação que faz cada modelo ter vantagens/desvantagens
# reais consoante a operação, em vez de um único "melhor" universal.
WEAPON_CATEGORY_WEIGHTS = {
    "assalto": {"power": 0.35, "accuracy": 0.15, "range": 0.0, "lightness": 0.0, "speed": 0.30, "magazine": 0.20},
    "tecnica": {"power": 0.05, "accuracy": 0.35, "range": 0.25, "lightness": 0.25, "speed": 0.10, "magazine": 0.0},
    "especial": {"power": 0.25, "accuracy": 0.25, "range": 0.25, "lightness": 0.0, "speed": 0.15, "magazine": 0.10},
    "influencia": {"power": 0.0, "accuracy": 0.40, "range": 0.0, "lightness": 0.35, "speed": 0.25, "magazine": 0.0},
    "logistica": {"power": 0.20, "accuracy": 0.20, "range": 0.0, "lightness": 0.20, "speed": 0.20, "magazine": 0.20},
}

# Peso de velocidade/capacidade(lugares vs. equipa)/discrição no score de
# adequação do veículo à missão, por categoria — mirror exacto de
# WEAPON_CATEGORY_WEIGHTS, mesma lógica: nenhum veículo é "sempre melhor",
# só mais adequado a certas operações.
VEHICLE_CATEGORY_WEIGHTS = {
    "assalto": {"speed": 0.45, "seats_fit": 0.25, "discretion": 0.30},
    "tecnica": {"speed": 0.20, "seats_fit": 0.20, "discretion": 0.60},
    "especial": {"speed": 0.40, "seats_fit": 0.20, "discretion": 0.40},
    "influencia": {"speed": 0.15, "seats_fit": 0.35, "discretion": 0.50},
    "logistica": {"speed": 0.15, "seats_fit": 0.55, "discretion": 0.30},
}

# Peso de cada dimensão (equipa/veículo/armamento/ambiente) na probabilidade
# de sucesso, por categoria de missão — soma 1.0 por categoria. É esta
# ponderação exterior que faz cada missão valorizar factores diferentes
# ("mais cara"/"melhor" nunca é universal); a ponderação interna de cada
# dimensão (CATEGORY_ATTRS, WEAPON_CATEGORY_WEIGHTS, VEHICLE_CATEGORY_WEIGHTS)
# já faz a maior parte do trabalho de "esta categoria valoriza X" — este peso
# exterior é deliberadamente mais estreito (ver DIMENSION_SWING_CAP) para não
# duplicar esse sinal.
MISSION_FACTOR_WEIGHTS = {
    "assalto":    {"team": 0.30, "vehicle": 0.20, "weapon": 0.30, "environment": 0.20},
    "logistica":  {"team": 0.30, "vehicle": 0.40, "weapon": 0.10, "environment": 0.20},
    "tecnica":    {"team": 0.30, "vehicle": 0.15, "weapon": 0.15, "environment": 0.40},
    "influencia": {"team": 0.45, "vehicle": 0.20, "weapon": 0.05, "environment": 0.30},
    "especial":   {"team": 0.25, "vehicle": 0.25, "weapon": 0.25, "environment": 0.25},
}

# Oscilação máxima (em pontos percentuais, antes do peso de categoria) que
# cada dimensão pode contribuir para a chance final — aplicado ANTES de
# MISSION_FACTOR_WEIGHTS, para que o peso exterior por categoria expresse
# sobretudo "equipa importa mais que equipamento aqui", sem re-derivar o
# mesmo sinal que a ponderação interna de cada dimensão já capturou.
DIMENSION_SWING_CAP = {"team": 0.28, "vehicle": 0.15, "weapon": 0.15, "environment": 0.12}

# TEAM_MAX_MEMBERS is imported from economy_constants.py

# ---------------- Coordenação e prontidão das equipas ----------------

TEAM_LEADER_MIN_RANK = "chefe_equipa"   # patente mínima para um membro contar como líder
NO_LEADER_PENALTY = 0.03                # penalização de chance sem nenhum membro nessa patente
SOLO_MEMBER_PENALTY = 0.05              # penalização extra para equipas com um único membro
UNIFORM_SPEC_BONUS = 0.05               # bónus quando todos os membros partilham a especialização da operação
COORDINATION_BONUS_MAX = 0.05           # bónus máximo por veterania (equipa estável há muito tempo)
COORDINATION_RAMP_S = 6 * 3600          # tempo (s) de estabilidade para atingir o bónus máximo
REORG_AFTER_MISSION_S = 25              # cooldown de despacho após a equipa regressar de uma missão
REORG_AFTER_ROSTER_CHANGE_S = 15        # cooldown de despacho após adicionar/remover um membro
INCOMPLETE_TEAM_PREP_S = 8              # segundos extra de preparação por membro em falta (vs. TEAM_MAX_MEMBERS)

# ---------------- Frota: adequação, condição e desgaste ----------------

VEHICLE_CONDITION_PENALTY_THRESHOLD = 70  # abaixo deste valor a condição começa a penalizar a chance
VEHICLE_CONDITION_PENALTY_MAX = 0.08       # penalização máxima de chance (condição a 0%)
VEHICLE_MATCH_BONUS = 0.05                 # bónus quando o veículo é adequado à categoria da operação
DISCREET_CATEGORIES = {"tecnica"}          # categorias consideradas operações discretas
LUXURY_HEAT_MULT = 1.4                     # multiplicador de calor ao usar veículo de luxo em missão discreta
WEAR_KM_RAMP = 8000                        # km a partir dos quais o desgaste por missão aumenta
WEAR_KM_MAX_MULT = 1.5                     # multiplicador máximo de desgaste para veículos muito usados

# ---------------- Funcionários: desempenho, novatos e disponibilidade ----------------

NEWBIE_RAMP_S = 3600                  # tempo (s) desde a contratação até deixar de ser "novato"
NEWBIE_PENALTY_MAX = 0.10             # penalização máxima de desempenho para um recém-contratado
HIGH_MORALE_THRESHOLD = 90            # moral a partir da qual há um bónus extra de desempenho
HIGH_MORALE_BONUS = 0.05              # bónus de desempenho para moral muito alta
LOW_MORALE_ABSENCE_THRESHOLD = 25     # moral abaixo da qual pode faltar ao trabalho
ABSENCE_CHANCE_PER_MIN = 0.003        # probabilidade de faltar, por minuto real, com moral baixa
ABSENCE_DURATION_S = 600              # duração da falta ao trabalho
FULL_ENERGY_FATIGUE_MAX = 10          # fadiga abaixo da qual conta como "energia máxima"
FULL_ENERGY_XP_BONUS = 0.10           # bónus de XP ao entrar em missão com energia máxima
XP_DECAY_IDLE_DAYS = 5                # dias sem participar numa missão antes de começar a perder XP
XP_DECAY_PER_MIN = 0.05               # XP perdido por minuto real de inatividade prolongada

# Missão reward parameters are imported from economy_constants.py
# MEMBER_SPLIT_PENALTY_PER_EXTRA, MEMBER_SPLIT_PENALTY_MAX, AGE_DECAY_MAX, AGE_DECAY_RAMP_S
# NOTE: These are now configured in economy_constants.py for easier tuning
REPEAT_TYPE_XP_MULT = 0.85             # multiplicador de XP quando a equipa repete o mesmo tipo de missão
DURATION_REWARD_BASELINE_S = 90        # duração neutra (nem bónus nem penalização) de recompensa por minuto
DURATION_REWARD_MAX_BONUS = 0.15       # bónus máximo de recompensa para operações longas
DURATION_REWARD_MAX_MALUS = 0.10       # penalização máxima de recompensa para operações muito rápidas
DURATION_REWARD_FLOOR_S = 30           # duração a partir da qual a penalização é máxima
DURATION_REWARD_CEIL_S = 300           # duração a partir da qual o bónus é máximo
FAILED_TYPE_COOLDOWN_MIN = 8           # minutos em que um tipo de missão falhado deixa de aparecer
RECALL_PENALTY_FRACTION = 0.5          # fração da viagem a partir da qual chamar a equipa de volta tem custo
RECALL_PENALTY_HEAT = 3                # calor extra ao chamar de volta tarde
RECALL_PENALTY_FATIGUE = 8             # fadiga extra da equipa ao chamar de volta tarde

# FUEL_PRICES is imported from economy_constants.py

# ---------------- Imóveis: manutenção, melhorias e sinergias ----------------

# The following are imported from economy_constants.py:
# PROPERTY_MAINTENANCE_PCT_PER_DAY, PROPERTY_CONDITION_RECOVERY_PER_HOUR,
# PROPERTY_CONDITION_DECAY_PER_HOUR, PROPERTY_UPGRADE_BASE_S,
# PROPERTY_UPGRADE_PER_LEVEL_S, HIDEOUT_PREP_REDUCTION_PER_LEVEL,
# LAUNDER_PROPERTY_BONUS_PER_LEVEL

# ---------------- Propriedades ----------------

PROPERTY_TYPES = {
    "esconderijo": {"name": "Esconderijo", "min_level": 1, "price": PROPERTY_COSTS['esconderijo'], "cap_employees": 4,
                    "desc": "Alarga a capacidade de operacionais da organização."},
    "garagem": {"name": "Garagem", "min_level": 1, "price": PROPERTY_COSTS['garagem'], "cap_vehicles": 2,
                "desc": "Espaço extra para a frota de veículos."},
    "empresa_legal": {"name": "Empresa de Fachada", "min_level": 2, "price": PROPERTY_COSTS['empresa_legal'], "launder_per_h": 1400,
                      "desc": "Lava dinheiro sujo automaticamente (90% de retorno)."},
    "armazem": {"name": "Armazém", "min_level": 2, "price": PROPERTY_COSTS['armazem'], "bonus_pct": 0.05, "bonus_category": "logistica",
                "bonus_label": "recompensas de logística", "desc": "Aumenta recompensas de operações logísticas."},
    "laboratorio": {"name": "Laboratório", "min_level": 3, "price": PROPERTY_COSTS['laboratorio'], "dirty_per_h": 2100, "heat_per_h": 0.8,
                    "desc": "Produz dinheiro sujo passivamente, mas atrai calor."},
    "oficina": {"name": "Oficina", "min_level": 3, "price": PROPERTY_COSTS['oficina'], "repair_discount_pct": 0.15,
                "desc": "Reduz o custo de reparações da frota."},
    "porto_clandestino": {"name": "Porto Clandestino", "min_level": 4, "price": PROPERTY_COSTS['porto_clandestino'], "bonus_pct": 0.05,
                          "bonus_category": "all", "bonus_label": "todas as recompensas",
                          "desc": "Rede de contrabando que aumenta todas as recompensas."},
    "posto_vigilancia": {"name": "Posto de Vigilância", "min_level": 2, "price": PROPERTY_COSTS['posto_vigilancia'], "bonus_pct": 0.05,
                         "bonus_category": "tecnica", "bonus_label": "recompensas técnicas",
                         "desc": "Rede de vigilância que aumenta recompensas de operações técnicas."},
    "escritorio_advocacia": {"name": "Escritório de Advocacia", "min_level": 2, "price": PROPERTY_COSTS['escritorio_advocacia'], "bonus_pct": 0.05,
                            "bonus_category": "influencia", "bonus_label": "recompensas de influência",
                            "desc": "Fachada legal que aumenta as recompensas de operações de influência."},
    "arsenal": {"name": "Arsenal", "min_level": 3, "price": PROPERTY_COSTS['arsenal'], "bonus_pct": 0.05,
                "bonus_category": "assalto", "bonus_label": "recompensas de assalto",
                "desc": "Equipamento tático que aumenta as recompensas de operações de assalto."},
    "casa_cambio": {"name": "Casa de Câmbio", "min_level": 3, "price": PROPERTY_COSTS['casa_cambio'], "launder_per_h": 1750,
                    "desc": "Duplica a capacidade de lavagem automática através de câmbios internacionais."},
    "centro_logistico": {"name": "Centro Logístico", "min_level": 4, "price": PROPERTY_COSTS['centro_logistico'], "cap_vehicles": 3,
                         "desc": "Grande centro de operações que amplia bastante a capacidade da frota."},
}

# BASE_EMPLOYEE_CAP, BASE_VEHICLE_CAP, PROPERTY_MAX_LEVEL are imported from economy_constants.py

# ---------------- Oportunidades ----------------

OPPORTUNITY_TYPES = {
    "assalto": {"name": "Assalto", "category": "assalto", "min_level": 1, "base_reward": 3500,
                "respect": 40, "heat": 6, "risk": 2, "duration_s": (45, 90), "weight": 10, "pays": "dirty"},
    "roubo": {"name": "Roubo de Veículo", "category": "assalto", "min_level": 1, "base_reward": 2500,
              "respect": 25, "heat": 4, "risk": 1, "duration_s": (30, 60), "weight": 12, "pays": "dirty"},
    "cobranca": {"name": "Cobrança", "category": "influencia", "min_level": 1, "base_reward": 2000,
                 "respect": 20, "heat": 2, "risk": 1, "duration_s": (30, 60), "weight": 12, "pays": "dirty",
                 "hours": (8, 20)},
    "transporte": {"name": "Transporte Ilegal", "category": "logistica", "min_level": 1, "base_reward": 3000,
                   "respect": 30, "heat": 3, "risk": 2, "duration_s": (60, 120), "weight": 10, "pays": "dirty"},
    "contrabando": {"name": "Contrabando", "category": "logistica", "min_level": 2, "base_reward": 6000,
                    "respect": 60, "heat": 8, "risk": 3, "duration_s": (90, 150), "weight": 8, "pays": "dirty",
                    "required_models": ["van", "suv_blindado"]},
    "hack": {"name": "Hack", "category": "tecnica", "min_level": 2, "base_reward": 5500,
             "respect": 55, "heat": 5, "risk": 3, "duration_s": (60, 120), "weight": 8, "pays": "dirty"},
    "lavagem": {"name": "Lavagem de Dinheiro", "category": "influencia", "min_level": 2, "base_reward": 4500,
                "respect": 35, "heat": 2, "risk": 2, "duration_s": (90, 150), "weight": 6, "pays": "clean"},
    "infiltracao": {"name": "Infiltração", "category": "tecnica", "min_level": 3, "base_reward": 9000,
                    "respect": 90, "heat": 10, "risk": 4, "duration_s": (120, 200), "weight": 5, "pays": "dirty"},
    "ataque_territorio": {"name": "Ataque a Território", "category": "assalto", "min_level": 3, "base_reward": 11000,
                          "respect": 120, "heat": 14, "risk": 4, "duration_s": (120, 220), "weight": 4, "pays": "dirty"},
    "operacao_vip": {"name": "Operação VIP", "category": "influencia", "min_level": 4, "base_reward": 16000,
                     "respect": 160, "heat": 12, "risk": 4, "duration_s": (150, 260), "weight": 3, "pays": "dirty",
                     "hours": (22, 5), "required_models": ["berlina_blindada", "limousine"]},
    "missao_especial": {"name": "Missão Especial", "category": "especial", "min_level": 5, "base_reward": 25000,
                        "respect": 260, "heat": 16, "risk": 5, "duration_s": (180, 300), "weight": 2, "pays": "dirty"},
    "entrega_expressa": {"name": "Entrega Expressa", "category": "logistica", "min_level": 1, "base_reward": 2200,
                         "respect": 22, "heat": 3, "risk": 1, "duration_s": (35, 65), "weight": 11, "pays": "dirty"},
    "vigilancia_digital": {"name": "Vigilância Digital", "category": "tecnica", "min_level": 1, "base_reward": 2300,
                           "respect": 22, "heat": 2, "risk": 1, "duration_s": (30, 55), "weight": 10, "pays": "dirty"},
    "assalto_armado": {"name": "Assalto Armado", "category": "assalto", "min_level": 2, "base_reward": 7500,
                       "respect": 75, "heat": 9, "risk": 3, "duration_s": (75, 130), "weight": 7, "pays": "dirty"},
    "suborno_oficial": {"name": "Suborno a Oficial", "category": "influencia", "min_level": 3, "base_reward": 8500,
                        "respect": 80, "heat": 4, "risk": 3, "duration_s": (90, 150), "weight": 6, "pays": "clean"},
    "rota_internacional": {"name": "Rota Internacional", "category": "logistica", "min_level": 4, "base_reward": 13500,
                           "respect": 125, "heat": 10, "risk": 4, "duration_s": (150, 230), "weight": 3, "pays": "dirty",
                           "required_models": ["van"]},
    "ciberataque_bancario": {"name": "Ciberataque Bancário", "category": "tecnica", "min_level": 5, "base_reward": 23000,
                            "respect": 230, "heat": 18, "risk": 5, "duration_s": (190, 300), "weight": 2, "pays": "dirty"},

    # ---- Assalto (10 novas) ----
    "roubo_joalharia": {"name": "Roubo de Joalharia", "category": "assalto", "min_level": 1, "base_reward": 2800,
                        "respect": 28, "heat": 5, "risk": 2, "duration_s": (40, 80), "weight": 9, "pays": "dirty"},
    "assalto_licorista": {"name": "Assalto a Licorista", "category": "assalto", "min_level": 1, "base_reward": 2400,
                          "respect": 24, "heat": 4, "risk": 1, "duration_s": (30, 60), "weight": 10, "pays": "dirty"},
    "roubo_carga": {"name": "Roubo de Carga", "category": "assalto", "min_level": 2, "base_reward": 5000,
                    "respect": 50, "heat": 7, "risk": 2, "duration_s": (70, 120), "weight": 7, "pays": "dirty"},
    "assalto_penhores": {"name": "Assalto a Casa de Penhores", "category": "assalto", "min_level": 2, "base_reward": 6200,
                         "respect": 62, "heat": 8, "risk": 3, "duration_s": (80, 140), "weight": 6, "pays": "dirty"},
    "assalto_blindado": {"name": "Assalto a Carro Blindado", "category": "assalto", "min_level": 3, "base_reward": 9500,
                         "respect": 95, "heat": 12, "risk": 4, "duration_s": (110, 190), "weight": 4, "pays": "dirty",
                         "required_models": ["suv_blindado"]},
    "emboscada_rival": {"name": "Emboscada a Rival", "category": "assalto", "min_level": 3, "base_reward": 8800,
                        "respect": 88, "heat": 11, "risk": 3, "duration_s": (90, 160), "weight": 5, "pays": "dirty",
                        "required_models": ["buggy_todo_terreno"]},
    "assalto_casino": {"name": "Assalto a Casino", "category": "assalto", "min_level": 4, "base_reward": 14000,
                       "respect": 140, "heat": 13, "risk": 4, "duration_s": (140, 240), "weight": 3, "pays": "dirty"},
    "sequestro_relampago": {"name": "Sequestro Relâmpago", "category": "assalto", "min_level": 4, "base_reward": 15500,
                            "respect": 150, "heat": 14, "risk": 4, "duration_s": (130, 220), "weight": 2, "pays": "dirty"},
    "assalto_museu": {"name": "Assalto a Museu", "category": "assalto", "min_level": 5, "base_reward": 22000,
                      "respect": 220, "heat": 16, "risk": 5, "duration_s": (180, 300), "weight": 2, "pays": "dirty"},
    "guerra_territorio": {"name": "Guerra de Território", "category": "assalto", "min_level": 5, "base_reward": 26000,
                          "respect": 260, "heat": 20, "risk": 5, "duration_s": (200, 300), "weight": 1, "pays": "dirty"},

    # ---- Logística (10 novas) ----
    "entrega_local": {"name": "Entrega Local", "category": "logistica", "min_level": 1, "base_reward": 1800,
                      "respect": 18, "heat": 2, "risk": 1, "duration_s": (25, 50), "weight": 12, "pays": "dirty"},
    "recolha_mercadoria": {"name": "Recolha de Mercadoria", "category": "logistica", "min_level": 1, "base_reward": 2600,
                           "respect": 26, "heat": 3, "risk": 1, "duration_s": (35, 65), "weight": 10, "pays": "dirty"},
    "transporte_armas": {"name": "Transporte de Armas", "category": "logistica", "min_level": 2, "base_reward": 5200,
                         "respect": 52, "heat": 8, "risk": 3, "duration_s": (80, 140), "weight": 6, "pays": "dirty",
                         "required_models": ["van"]},
    "rota_costeira": {"name": "Rota Costeira", "category": "logistica", "min_level": 2, "base_reward": 4800,
                      "respect": 48, "heat": 6, "risk": 2, "duration_s": (70, 130), "weight": 7, "pays": "dirty",
                      "required_models": ["carrinha_entrega", "van"]},
    "contrabando_tabaco": {"name": "Contrabando de Tabaco", "category": "logistica", "min_level": 3, "base_reward": 8200,
                          "respect": 82, "heat": 9, "risk": 3, "duration_s": (100, 170), "weight": 5, "pays": "dirty"},
    "frota_fantasma": {"name": "Frota Fantasma", "category": "logistica", "min_level": 3, "base_reward": 9200,
                       "respect": 92, "heat": 10, "risk": 3, "duration_s": (110, 180), "weight": 4, "pays": "dirty",
                       "required_models": ["van", "suv_blindado"]},
    "rota_alfandega": {"name": "Rota da Alfândega", "category": "logistica", "min_level": 4, "base_reward": 13500,
                       "respect": 130, "heat": 11, "risk": 4, "duration_s": (140, 230), "weight": 3, "pays": "dirty"},
    "carga_diplomatica": {"name": "Carga Diplomática", "category": "logistica", "min_level": 4, "base_reward": 15000,
                          "respect": 145, "heat": 10, "risk": 4, "duration_s": (150, 240), "weight": 2, "pays": "dirty"},
    "rede_distribuicao": {"name": "Rede de Distribuição", "category": "logistica", "min_level": 5, "base_reward": 20000,
                          "respect": 200, "heat": 15, "risk": 4, "duration_s": (170, 280), "weight": 2, "pays": "dirty"},
    "porto_franco": {"name": "Porto Franco", "category": "logistica", "min_level": 5, "base_reward": 24000,
                     "respect": 240, "heat": 17, "risk": 5, "duration_s": (190, 300), "weight": 1, "pays": "dirty",
                     "required_models": ["van"]},

    # ---- Técnica (10 novas) ----
    "phishing_bancario": {"name": "Phishing Bancário", "category": "tecnica", "min_level": 1, "base_reward": 2100,
                          "respect": 21, "heat": 2, "risk": 1, "duration_s": (30, 55), "weight": 10, "pays": "dirty"},
    "clonagem_cartoes": {"name": "Clonagem de Cartões", "category": "tecnica", "min_level": 1, "base_reward": 2500,
                         "respect": 25, "heat": 3, "risk": 1, "duration_s": (35, 60), "weight": 9, "pays": "dirty"},
    "hack_semaforos": {"name": "Hack de Semáforos", "category": "tecnica", "min_level": 2, "base_reward": 4700,
                       "respect": 47, "heat": 5, "risk": 2, "duration_s": (60, 110), "weight": 7, "pays": "dirty"},
    "fraude_criptomoedas": {"name": "Fraude de Criptomoedas", "category": "tecnica", "min_level": 2, "base_reward": 6000,
                            "respect": 60, "heat": 6, "risk": 3, "duration_s": (80, 140), "weight": 6, "pays": "dirty"},
    "invasao_servidor": {"name": "Invasão de Servidor", "category": "tecnica", "min_level": 3, "base_reward": 8600,
                         "respect": 86, "heat": 9, "risk": 3, "duration_s": (100, 170), "weight": 5, "pays": "dirty"},
    "ciberespionagem": {"name": "Ciberespionagem", "category": "tecnica", "min_level": 3, "base_reward": 9400,
                        "respect": 94, "heat": 10, "risk": 4, "duration_s": (120, 190), "weight": 4, "pays": "dirty"},
    "ataque_ddos": {"name": "Ataque DDoS", "category": "tecnica", "min_level": 4, "base_reward": 13000,
                    "respect": 125, "heat": 11, "risk": 4, "duration_s": (130, 220), "weight": 3, "pays": "dirty"},
    "roubo_dados": {"name": "Roubo de Dados", "category": "tecnica", "min_level": 4, "base_reward": 14500,
                    "respect": 140, "heat": 12, "risk": 4, "duration_s": (140, 230), "weight": 2, "pays": "dirty"},
    "sabotagem_industrial": {"name": "Sabotagem Industrial", "category": "tecnica", "min_level": 5, "base_reward": 21000,
                             "respect": 210, "heat": 16, "risk": 5, "duration_s": (180, 290), "weight": 2, "pays": "dirty"},
    "guerra_cibernetica": {"name": "Guerra Cibernética", "category": "tecnica", "min_level": 5, "base_reward": 25000,
                           "respect": 250, "heat": 18, "risk": 5, "duration_s": (190, 300), "weight": 1, "pays": "dirty"},

    # ---- Influência (10 novas) ----
    "protecao_comercio": {"name": "Proteção de Comércio", "category": "influencia", "min_level": 1, "base_reward": 1900,
                          "respect": 19, "heat": 1, "risk": 1, "duration_s": (25, 50), "weight": 11, "pays": "dirty",
                          "hours": (8, 20)},
    "boato_rua": {"name": "Boato de Rua", "category": "influencia", "min_level": 1, "base_reward": 2200,
                 "respect": 22, "heat": 2, "risk": 1, "duration_s": (30, 55), "weight": 10, "pays": "dirty"},
    "suborno_funcionario": {"name": "Suborno a Funcionário", "category": "influencia", "min_level": 2, "base_reward": 4600,
                           "respect": 46, "heat": 3, "risk": 2, "duration_s": (60, 110), "weight": 7, "pays": "clean"},
    "chantagem_politico": {"name": "Chantagem a Político", "category": "influencia", "min_level": 2, "base_reward": 5800,
                           "respect": 58, "heat": 5, "risk": 2, "duration_s": (70, 130), "weight": 6, "pays": "dirty"},
    "lavagem_casino": {"name": "Lavagem via Casino", "category": "influencia", "min_level": 3, "base_reward": 8000,
                       "respect": 80, "heat": 4, "risk": 2, "duration_s": (90, 160), "weight": 5, "pays": "clean"},
    "infiltracao_sindicato": {"name": "Infiltração em Sindicato", "category": "influencia", "min_level": 3, "base_reward": 9000,
                             "respect": 90, "heat": 8, "risk": 3, "duration_s": (100, 170), "weight": 4, "pays": "dirty"},
    "acordo_autarca": {"name": "Acordo com Autarca", "category": "influencia", "min_level": 4, "base_reward": 13500,
                       "respect": 130, "heat": 6, "risk": 3, "duration_s": (130, 220), "weight": 3, "pays": "clean"},
    "campanha_difamacao": {"name": "Campanha de Difamação", "category": "influencia", "min_level": 4, "base_reward": 14800,
                          "respect": 145, "heat": 9, "risk": 4, "duration_s": (140, 230), "weight": 2, "pays": "dirty"},
    "controlo_imprensa": {"name": "Controlo da Imprensa", "category": "influencia", "min_level": 5, "base_reward": 20500,
                         "respect": 205, "heat": 10, "risk": 4, "duration_s": (170, 280), "weight": 2, "pays": "clean",
                         "required_models": ["limousine"]},
    "golpe_estado_local": {"name": "Golpe de Estado Local", "category": "influencia", "min_level": 5, "base_reward": 25500,
                          "respect": 255, "heat": 14, "risk": 5, "duration_s": (190, 300), "weight": 1, "pays": "dirty"},

    # ---- Especial (10 novas) ----
    "roubo_obra_arte": {"name": "Roubo de Obra de Arte", "category": "especial", "min_level": 2, "base_reward": 7000,
                        "respect": 70, "heat": 8, "risk": 3, "duration_s": (100, 170), "weight": 3, "pays": "dirty"},
    "operacao_encoberta": {"name": "Operação Encoberta", "category": "especial", "min_level": 3, "base_reward": 9800,
                          "respect": 98, "heat": 9, "risk": 3, "duration_s": (110, 190), "weight": 3, "pays": "dirty"},
    "resgate_refem": {"name": "Resgate de Refém", "category": "especial", "min_level": 3, "base_reward": 10000,
                      "respect": 100, "heat": 12, "risk": 4, "duration_s": (120, 200), "weight": 2, "pays": "dirty"},
    "leilao_clandestino": {"name": "Leilão Clandestino", "category": "especial", "min_level": 4, "base_reward": 14200,
                          "respect": 138, "heat": 10, "risk": 3, "duration_s": (130, 220), "weight": 2, "pays": "dirty"},
    "venda_armamento": {"name": "Venda de Armamento", "category": "especial", "min_level": 4, "base_reward": 15000,
                        "respect": 150, "heat": 13, "risk": 4, "duration_s": (150, 240), "weight": 2, "pays": "dirty"},
    "fuga_prisao": {"name": "Fuga da Prisão", "category": "especial", "min_level": 4, "base_reward": 16500,
                    "respect": 160, "heat": 15, "risk": 4, "duration_s": (140, 230), "weight": 1, "pays": "dirty"},
    "assassinato_contrato": {"name": "Assassínio por Contrato", "category": "especial", "min_level": 5, "base_reward": 24000,
                            "respect": 240, "heat": 20, "risk": 5, "duration_s": (180, 300), "weight": 1, "pays": "dirty"},
    "golpe_banco_central": {"name": "Golpe ao Banco Central", "category": "especial", "min_level": 5, "base_reward": 30000,
                           "respect": 300, "heat": 22, "risk": 5, "duration_s": (220, 300), "weight": 1, "pays": "dirty"},
    "trafico_influencia_internacional": {"name": "Tráfico de Influência Internacional", "category": "especial", "min_level": 5,
                                         "base_reward": 27000, "respect": 270, "heat": 18, "risk": 5,
                                         "duration_s": (200, 300), "weight": 1, "pays": "dirty"},
    "operacao_fantasma": {"name": "Operação Fantasma", "category": "especial", "min_level": 5, "base_reward": 26000,
                         "respect": 260, "heat": 16, "risk": 5, "duration_s": (190, 300), "weight": 1, "pays": "dirty",
                         "required_models": ["carro_furtivo"]},
}

# ---------------- Economia e recursos ----------------

DIRTY_MONEY_HEAT_THRESHOLD = 60000       # acima deste montante de dinheiro sujo acumulado, gera calor extra
DIRTY_MONEY_HEAT_PER_10K = 0.15          # calor extra por hora, por cada 10 mil € sujos acima do limiar

# ---------------- Progressão ----------------

LOW_LEVEL_XP_GAP = 2                     # diferença de nível (missão vs. organização) a partir da qual a XP é reduzida
LOW_LEVEL_XP_MULT_PER_GAP = 0.15         # redução de XP por cada nível de diferença acima do limiar
LOW_LEVEL_XP_MULT_MIN = 0.3              # redução mínima de XP para missões muito abaixo do nível
TEAM_COUNT_BASE = 2                      # nº máximo de equipas ao nível 1
TEAM_COUNT_PER_2_LEVELS = 1              # +1 equipa máxima a cada 2 níveis da organização
ACHIEVEMENT_MILESTONES = [10, 50, 150, 400]  # missões bem-sucedidas para desbloquear cada bónus permanente
ACHIEVEMENT_BONUS_PCT_PER_MILESTONE = 0.02   # bónus de recompensa permanente por marco atingido

# ---------------- Sistema de viagem / logística ----------------

LOCAL_PRESENCE_RADIUS_KM = 1.5           # raio para uma missão já em curso contar como "na mesma zona"
LOCAL_PRESENCE_PREP_REDUCTION_S = 6      # redução do tempo de viagem por cada equipa já ativa perto do alvo
LOCAL_PRESENCE_PREP_REDUCTION_MAX_S = 18 # redução máxima combinada

# ---------------- Pequenos imprevistos ----------------

TRAFFIC_DELAY_CHANCE = 0.12              # probabilidade de trânsito atrasar ligeiramente a viagem
TRAFFIC_DELAY_MAX_PCT = 0.15             # atraso máximo (% do tempo de viagem)
UNEXPECTED_REPAIR_CHANCE_PER_RISK = 0.03 # probabilidade (por ponto de risco) de avaria inesperada após a operação
UNEXPECTED_REPAIR_CONDITION_HIT = 12     # condição extra perdida numa avaria inesperada
EXCEPTIONAL_PERFORMANCE_CHANCE = 0.08    # probabilidade de desempenho excecional
EXCEPTIONAL_PERFORMANCE_XP_BONUS_PCT = 0.5  # XP extra num desempenho excecional
BONUS_LOOT_CHANCE = 0.06                 # probabilidade de saque adicional aleatório
BONUS_LOOT_MAX_PCT = 0.15                # saque adicional máximo (% da recompensa)

# ---------------- Manutenção ----------------

WEAR_PER_MISSION_SINCE_REPAIR = 0.08     # desgaste extra por missão acumulada desde a última reparação
WEAR_MISSIONS_SINCE_REPAIR_CAP = 10      # nº de missões a partir do qual o desgaste extra deixa de aumentar
EMPLOYEE_HEAVY_USE_THRESHOLD = 30        # nº de missões a partir do qual um funcionário é "muito utilizado"
EMPLOYEE_HEAVY_USE_FATIGUE_MULT = 1.25   # fadiga extra ganha por missão para funcionários muito utilizados

# ---------------- Pequenos detalhes ----------------

RAIN_CHANCE = 0.10                       # probabilidade de chuva numa viagem
RAIN_TRAVEL_MULT = 1.10                  # aumento do tempo de viagem com chuva
NIGHT_STEALTH_HOURS = (0, 6)             # horas (UTC) consideradas noite fechada para o bónus furtivo
NIGHT_STEALTH_BONUS = 0.04               # bónus de chance em operações discretas durante a noite

# ---------------- Economia: recursos com limites e rendimentos decrescentes ----------------

# Bónus percentuais (recompensa, desconto de reparação) de propriedades do mesmo
# tipo empilhadas: a 1ª unidade dá o valor cheio, a 2ª 70%, a 3ª+ apenas 50% —
# em vez de um limite artificial, cada compra extra do mesmo tipo rende menos.
# PROPERTY_STACK_DIMINISH, DIRTY_MONEY_CAP_BASE, DIRTY_MONEY_CAP_PER_LEVEL,
# REFUEL_DURATION_BASE_S, REFUEL_DURATION_PER_L_S, and PAYROLL_MORALE_REGEN
# are now imported from economy_constants.py for centralized economic management
