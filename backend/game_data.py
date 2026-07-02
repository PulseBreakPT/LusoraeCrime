import random

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

LEVEL_THRESHOLDS = [0, 400, 1200, 2800, 5500, 9500, 15000, 22000, 31000, 42000]

TEAM_NAMES = ["Crew Alfa", "Crew Bravo", "Crew Cobra", "Crew Delta", "Crew Eco",
              "Crew Fénix", "Crew Gama", "Crew Hidra", "Crew Íbis", "Crew Jaguar",
              "Crew Kilo", "Crew Lince", "Crew Mamba", "Crew Norte", "Crew Onix"]

TEAM_CREATE_COST = 5000

TEAM_SPECS = {
    "assalto": {"name": "Crew de Assalto", "desc": "Especializada em assaltos, roubos e ataques a territórios."},
    "logistica": {"name": "Rede Logística", "desc": "Transporte de mercadorias ilegais e contrabando."},
    "tecnica": {"name": "Célula Técnica", "desc": "Hacks, infiltrações e vigilância digital."},
    "influencia": {"name": "Unidade de Influência", "desc": "Cobranças, lavagem de dinheiro e operações VIP."},
}

EMPLOYEE_ROLES = {
    "musculo": {"name": "Músculo", "spec": "assalto", "cost": 4000, "desc": "Força bruta para assaltos e ataques."},
    "condutor": {"name": "Condutor", "spec": "logistica", "cost": 3500, "desc": "Mestre da estrada e das rotas de fuga."},
    "hacker": {"name": "Hacker", "spec": "tecnica", "cost": 5000, "desc": "Especialista em sistemas e infiltração digital."},
    "negociador": {"name": "Negociador", "spec": "influencia", "cost": 4500, "desc": "Persuasão, cobranças e contactos VIP."},
}

EMP_LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]

TRAINING_COURSES = {
    "combate": {"name": "Treino de Combate", "spec": "assalto", "cost": 3000, "duration_s": 120, "xp": 60},
    "conducao": {"name": "Condução Evasiva", "spec": "logistica", "cost": 2500, "duration_s": 100, "xp": 50},
    "ciberseguranca": {"name": "Cibersegurança", "spec": "tecnica", "cost": 3500, "duration_s": 140, "xp": 70},
    "persuasao": {"name": "Retórica e Persuasão", "spec": "influencia", "cost": 3000, "duration_s": 120, "xp": 60},
    "fisico": {"name": "Preparação Física", "spec": None, "cost": 2000, "duration_s": 90, "xp": 40, "fatigue_relief": 25},
}

_FIRST_NAMES = ["Rui", "Tiago", "Miguel", "André", "Bruno", "Carlos", "Diogo", "Vasco", "Nuno", "Pedro",
                "Marta", "Inês", "Sofia", "Carla", "Beatriz", "Joana", "Rita", "Ana", "Hugo", "Fábio"]
_LAST_NAMES = ["Silva", "Santos", "Ferreira", "Costa", "Oliveira", "Rodrigues", "Martins", "Sousa",
               "Fonseca", "Ramos", "Lopes", "Vieira", "Cardoso", "Pinto", "Moreira", "Correia"]


def random_employee_name():
    return f"{random.choice(_FIRST_NAMES)} {random.choice(_LAST_NAMES)}"


VEHICLE_MODELS = {
    "usado": {"name": "Sedan Usado", "min_level": 1, "price": 6000, "speed": 9,
              "fuel_type": "gasolina", "tank_l": 45, "cons": 8.0},
    "moto": {"name": "Moto Rápida", "min_level": 1, "price": 12000, "speed": 15,
             "fuel_type": "gasolina", "tank_l": 15, "cons": 4.5},
    "van": {"name": "Van Reforçada", "min_level": 2, "price": 18000, "speed": 12,
            "fuel_type": "gasoleo", "tank_l": 70, "cons": 10.0},
    "desportivo": {"name": "Desportivo", "min_level": 3, "price": 30000, "speed": 19,
                   "fuel_type": "gasolina", "tank_l": 55, "cons": 12.0},
    "suv_blindado": {"name": "SUV Blindado", "min_level": 4, "price": 45000, "speed": 14,
                     "fuel_type": "gasoleo", "tank_l": 80, "cons": 13.0},
    "supercarro": {"name": "Supercarro", "min_level": 5, "price": 65000, "speed": 26,
                   "fuel_type": "gasolina", "tank_l": 60, "cons": 15.0},
}

FUEL_PRICES = {"gasolina": 1.80, "gasoleo": 1.60}

PROPERTY_TYPES = {
    "esconderijo": {"name": "Esconderijo", "min_level": 1, "price": 20000, "cap_employees": 4,
                    "desc": "Alarga a capacidade de funcionários da organização."},
    "garagem": {"name": "Garagem", "min_level": 1, "price": 15000, "cap_vehicles": 2,
                "desc": "Espaço extra para a frota de veículos."},
    "empresa_legal": {"name": "Empresa de Fachada", "min_level": 2, "price": 35000, "launder_per_h": 2000,
                      "desc": "Lava dinheiro sujo automaticamente (90% de retorno)."},
    "armazem": {"name": "Armazém", "min_level": 2, "price": 25000, "bonus_pct": 0.05, "bonus_category": "logistica",
                "bonus_label": "recompensas de logística", "desc": "Aumenta recompensas de operações logísticas."},
    "laboratorio": {"name": "Laboratório", "min_level": 3, "price": 40000, "dirty_per_h": 3000, "heat_per_h": 0.8,
                    "desc": "Produz dinheiro sujo passivamente, mas atrai calor."},
    "oficina": {"name": "Oficina", "min_level": 3, "price": 30000, "repair_discount_pct": 0.15,
                "desc": "Reduz o custo de reparações da frota."},
    "porto_clandestino": {"name": "Porto Clandestino", "min_level": 4, "price": 60000, "bonus_pct": 0.05,
                          "bonus_category": "all", "bonus_label": "todas as recompensas",
                          "desc": "Rede de contrabando que aumenta todas as recompensas."},
}

BASE_EMPLOYEE_CAP = 4
BASE_VEHICLE_CAP = 2
PROPERTY_MAX_LEVEL = 3

OPPORTUNITY_TYPES = {
    "assalto": {"name": "Assalto", "category": "assalto", "min_level": 1, "base_reward": 3500,
                "respect": 40, "heat": 6, "risk": 2, "duration_s": (45, 90), "weight": 10, "pays": "dirty"},
    "roubo": {"name": "Roubo de Veículo", "category": "assalto", "min_level": 1, "base_reward": 2500,
              "respect": 25, "heat": 4, "risk": 1, "duration_s": (30, 60), "weight": 12, "pays": "dirty"},
    "cobranca": {"name": "Cobrança", "category": "influencia", "min_level": 1, "base_reward": 2000,
                 "respect": 20, "heat": 2, "risk": 1, "duration_s": (30, 60), "weight": 12, "pays": "dirty"},
    "transporte": {"name": "Transporte Ilegal", "category": "logistica", "min_level": 1, "base_reward": 3000,
                   "respect": 30, "heat": 3, "risk": 2, "duration_s": (60, 120), "weight": 10, "pays": "dirty"},
    "contrabando": {"name": "Contrabando", "category": "logistica", "min_level": 2, "base_reward": 6000,
                    "respect": 60, "heat": 8, "risk": 3, "duration_s": (90, 150), "weight": 8, "pays": "dirty"},
    "hack": {"name": "Hack", "category": "tecnica", "min_level": 2, "base_reward": 5500,
             "respect": 55, "heat": 5, "risk": 3, "duration_s": (60, 120), "weight": 8, "pays": "dirty"},
    "lavagem": {"name": "Lavagem de Dinheiro", "category": "influencia", "min_level": 2, "base_reward": 4500,
                "respect": 35, "heat": 2, "risk": 2, "duration_s": (90, 150), "weight": 6, "pays": "clean"},
    "infiltracao": {"name": "Infiltração", "category": "tecnica", "min_level": 3, "base_reward": 9000,
                    "respect": 90, "heat": 10, "risk": 4, "duration_s": (120, 200), "weight": 5, "pays": "dirty"},
    "ataque_territorio": {"name": "Ataque a Território", "category": "assalto", "min_level": 3, "base_reward": 11000,
                          "respect": 120, "heat": 14, "risk": 4, "duration_s": (120, 220), "weight": 4, "pays": "dirty"},
    "operacao_vip": {"name": "Operação VIP", "category": "influencia", "min_level": 4, "base_reward": 16000,
                     "respect": 160, "heat": 12, "risk": 4, "duration_s": (150, 260), "weight": 3, "pays": "dirty"},
    "missao_especial": {"name": "Missão Especial", "category": "especial", "min_level": 5, "base_reward": 25000,
                        "respect": 260, "heat": 16, "risk": 5, "duration_s": (180, 300), "weight": 2, "pays": "dirty"},
}
