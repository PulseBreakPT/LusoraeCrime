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

TEAM_TYPES = {
    "assalto": {"name": "Crew de Assalto", "spec": "assalto", "cost": 15000, "skill": 2,
                "desc": "Especialistas em assaltos, roubos e ataques a territórios."},
    "logistica": {"name": "Rede Logística", "spec": "logistica", "cost": 12000, "skill": 2,
                  "desc": "Transporte de mercadorias ilegais e contrabando."},
    "tecnica": {"name": "Célula Técnica", "spec": "tecnica", "cost": 18000, "skill": 2,
                "desc": "Hacks, infiltrações e vigilância digital."},
    "influencia": {"name": "Unidade de Influência", "spec": "influencia", "cost": 20000, "skill": 2,
                   "desc": "Cobranças, lavagem de dinheiro e operações VIP."},
}

VEHICLE_TYPES = {
    "usado": {"name": "Sedan Usado", "speed": 9, "cost": 0},
    "moto": {"name": "Moto Rápida", "speed": 15, "cost": 12000},
    "van": {"name": "Van Reforçada", "speed": 12, "cost": 18000},
    "desportivo": {"name": "Desportivo", "speed": 19, "cost": 30000},
    "supercarro": {"name": "Supercarro", "speed": 26, "cost": 65000},
}

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
