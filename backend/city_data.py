"""Dados do sistema Cidade Viva.

Tudo aqui é ficcional e serve apenas a simulação de estratégia do SUBMUNDO.
Os multiplicadores são deliberadamente moderados para impedir que um único
estado global substitua a preparação da equipa.
"""

WEATHER_STATES = {
    "ceu_limpo": {
        "name": "Céu limpo", "weight": 30,
        "chance": {}, "travel_mult": 1.0, "heat_mult": 1.0, "reward_mult": 1.0,
        "description": "Visibilidade normal e circulação previsível.",
    },
    "nublado": {
        "name": "Nublado", "weight": 24,
        "chance": {"tecnica": 0.01, "logistica": 0.01},
        "travel_mult": 1.0, "heat_mult": 0.99, "reward_mult": 1.0,
        "description": "Condições neutras com ligeira redução de exposição.",
    },
    "chuva": {
        "name": "Chuva", "weight": 22,
        "chance": {"assalto": 0.025, "tecnica": 0.02, "influencia": -0.01},
        "travel_mult": 1.08, "heat_mult": 0.94, "reward_mult": 1.02,
        "description": "Menos visibilidade, estradas mais lentas e menor exposição.",
    },
    "chuva_forte": {
        "name": "Chuva forte", "weight": 10,
        "chance": {"assalto": 0.04, "tecnica": 0.03, "logistica": -0.025},
        "travel_mult": 1.16, "heat_mult": 0.90, "reward_mult": 1.04,
        "description": "Cobertura excelente, mas deslocações claramente mais difíceis.",
    },
    "nevoeiro": {
        "name": "Nevoeiro", "weight": 8,
        "chance": {"assalto": 0.035, "tecnica": 0.025, "logistica": -0.035},
        "travel_mult": 1.12, "heat_mult": 0.91, "reward_mult": 1.03,
        "description": "Baixa visibilidade favorece discrição e penaliza condução.",
    },
    "tempestade": {
        "name": "Tempestade", "weight": 6,
        "chance": {"assalto": 0.055, "tecnica": 0.045, "logistica": -0.055},
        "travel_mult": 1.24, "heat_mult": 0.86, "reward_mult": 1.07,
        "description": "Caos urbano: mais cobertura, muito mais risco logístico.",
    },
}

DAYPARTS = {
    "madrugada": {
        "name": "Madrugada", "hours": (0, 6),
        "chance": {"assalto": 0.025, "tecnica": 0.02, "logistica": 0.01},
        "police_mult": 0.90, "traffic_mult": 0.78, "reward_mult": 1.02,
    },
    "manha": {
        "name": "Manhã", "hours": (6, 12),
        "chance": {"influencia": 0.015, "logistica": -0.01},
        "police_mult": 1.02, "traffic_mult": 1.12, "reward_mult": 1.0,
    },
    "tarde": {
        "name": "Tarde", "hours": (12, 19),
        "chance": {"influencia": 0.01},
        "police_mult": 1.05, "traffic_mult": 1.16, "reward_mult": 1.0,
    },
    "noite": {
        "name": "Noite", "hours": (19, 24),
        "chance": {"assalto": 0.02, "tecnica": 0.015},
        "police_mult": 0.96, "traffic_mult": 0.92, "reward_mult": 1.025,
    },
}

CITY_EVENTS = {
    "operacao_policial": {
        "name": "Operação policial reforçada", "severity": "high",
        "chance": {"assalto": -0.055, "logistica": -0.03, "tecnica": -0.02},
        "heat_mult": 1.22, "reward_mult": 1.08, "duration_h": 6,
        "description": "Fiscalização reforçada e patrulhamento adicional em zonas sensíveis.",
    },
    "evento_desportivo": {
        "name": "Grande evento urbano", "severity": "medium",
        "chance": {"assalto": 0.02, "influencia": 0.025, "logistica": -0.015},
        "heat_mult": 0.96, "reward_mult": 1.04, "duration_h": 6,
        "description": "Multidões e trânsito alteram rotinas, vigilância e circulação.",
    },
    "greve_transportes": {
        "name": "Perturbação nos transportes", "severity": "medium",
        "chance": {"logistica": -0.035, "assalto": 0.015},
        "heat_mult": 0.98, "reward_mult": 1.05, "duration_h": 6,
        "description": "Rotas congestionadas e padrões de movimento fora do normal.",
    },
    "apagao_local": {
        "name": "Falhas de energia", "severity": "high",
        "chance": {"tecnica": 0.055, "assalto": 0.035, "influencia": -0.025},
        "heat_mult": 0.90, "reward_mult": 1.08, "duration_h": 6,
        "description": "Sistemas degradados e iluminação reduzida em várias zonas.",
    },
    "feira_negra": {
        "name": "Feira clandestina", "severity": "medium",
        "chance": {"logistica": 0.03, "influencia": 0.03},
        "heat_mult": 1.03, "reward_mult": 1.10, "duration_h": 6,
        "description": "Procura temporária por mercadoria e serviços clandestinos.",
    },
    "calmaria": {
        "name": "Cidade estável", "severity": "low",
        "chance": {}, "heat_mult": 0.97, "reward_mult": 1.0, "duration_h": 6,
        "description": "Sem perturbações excecionais. Rotinas previsíveis.",
    },
}

BUSINESS_TYPES = {
    "bar": {
        "name": "Bar", "price": 42000, "clean_h": 210, "dirty_h": 40,
        "heat_h": 0.03, "security": 25, "max_level": 5,
        "effects": {"influencia": 0.006},
        "description": "Receita estável e fonte de contactos locais.",
    },
    "discoteca": {
        "name": "Discoteca", "price": 115000, "clean_h": 480, "dirty_h": 180,
        "heat_h": 0.10, "security": 32, "max_level": 5,
        "effects": {"influencia": 0.012, "assalto": 0.004},
        "description": "Rendimento noturno elevado, informação e maior exposição.",
    },
    "oficina_privada": {
        "name": "Oficina privada", "price": 78000, "clean_h": 340, "dirty_h": 55,
        "heat_h": 0.025, "security": 40, "max_level": 5,
        "effects": {"logistica": 0.012},
        "description": "Rede logística, manutenção e circulação de veículos.",
    },
    "transportadora": {
        "name": "Transportadora", "price": 145000, "clean_h": 610, "dirty_h": 150,
        "heat_h": 0.07, "security": 42, "max_level": 5,
        "effects": {"logistica": 0.018},
        "description": "Cobertura para operações logísticas e cadeia de abastecimento.",
    },
    "empresa_seguranca": {
        "name": "Empresa de segurança", "price": 190000, "clean_h": 760, "dirty_h": 90,
        "heat_h": 0.05, "security": 62, "max_level": 5,
        "effects": {"assalto": 0.008, "influencia": 0.008},
        "description": "Inteligência de terreno e segurança empresarial.",
    },
    "imobiliaria": {
        "name": "Imobiliária", "price": 230000, "clean_h": 980, "dirty_h": 130,
        "heat_h": 0.055, "security": 45, "max_level": 5,
        "effects": {"influencia": 0.015},
        "description": "Fluxo limpo elevado e acesso privilegiado ao mercado urbano.",
    },
    "casa_apostas": {
        "name": "Casa de apostas", "price": 275000, "clean_h": 900, "dirty_h": 420,
        "heat_h": 0.18, "security": 48, "max_level": 5,
        "effects": {"influencia": 0.012},
        "description": "Margens fortes e lavagem elevada, com maior risco regulatório.",
    },
    "empresa_tecnologia": {
        "name": "Empresa tecnológica", "price": 320000, "clean_h": 1320, "dirty_h": 120,
        "heat_h": 0.04, "security": 52, "max_level": 5,
        "effects": {"tecnica": 0.022},
        "description": "Infraestrutura técnica, dados e capacidade digital.",
    },
    "hotel": {
        "name": "Hotel", "price": 420000, "clean_h": 1680, "dirty_h": 260,
        "heat_h": 0.08, "security": 55, "max_level": 5,
        "effects": {"influencia": 0.016, "logistica": 0.008},
        "description": "Rede de contactos, alojamento e cobertura logística.",
    },
    "marina": {
        "name": "Marina", "price": 520000, "clean_h": 1820, "dirty_h": 520,
        "heat_h": 0.16, "security": 58, "max_level": 5,
        "effects": {"logistica": 0.026},
        "description": "Late game logístico com forte capacidade de circulação.",
    },
}

RIVAL_ARCHETYPES = [
    {"name": "Ordem do Norte", "style": "disciplina", "focus": "assalto"},
    {"name": "Linha Cinzenta", "style": "logística", "focus": "logistica"},
    {"name": "Vértice", "style": "tecnologia", "focus": "tecnica"},
    {"name": "Círculo Dourado", "style": "influência", "focus": "influencia"},
    {"name": "Costa Negra", "style": "contrabando", "focus": "logistica"},
    {"name": "Matilha", "style": "pressão", "focus": "assalto"},
]

RIVAL_ACTIONS = {
    "recon": {"name": "Reconhecimento", "cost": 1200, "cooldown_h": 1},
    "sabotage": {"name": "Sabotagem", "cost": 6500, "cooldown_h": 4},
    "pressure": {"name": "Pressão territorial", "cost": 9000, "cooldown_h": 6},
    "truce": {"name": "Propor trégua", "cost": 3500, "cooldown_h": 8},
    "alliance": {"name": "Negociar aliança", "cost": 12000, "cooldown_h": 12},
}

SEASON_LENGTH_DAYS = 30
SEASON_ANCHOR_ISO = "2026-01-01T00:00:00+00:00"
SEASON_REWARDS = [
    {"rank": 1, "clean": 120000, "respect": 1600},
    {"rank": 2, "clean": 80000, "respect": 1000},
    {"rank": 3, "clean": 50000, "respect": 700},
]

CASINO_MIN_BET = 100
CASINO_MAX_BET = 5000
