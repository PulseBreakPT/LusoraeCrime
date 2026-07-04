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
    "motorista_fantasma": {"name": "Motorista Fantasma", "desc": "-10% tempo de viagem", "roles": ["motorista", "contrabandista"]},
    "contabilista_sujo": {"name": "Contabilista Sujo", "desc": "+15% lavagem de dinheiro", "roles": ["lavador", "gestor"]},
    "olhos_na_rua": {"name": "Olhos na Rua", "desc": "+10% oportunidades raras", "roles": ["informador", "espiao"]},
    "mecanico_elite": {"name": "Mecânico de Elite", "desc": "-20% custo de reparação", "roles": ["mecanico"]},
    "pontaria_letal": {"name": "Pontaria Letal", "desc": "+5% sucesso em assaltos", "roles": ["assaltante", "seguranca"]},
    "rei_da_noite": {"name": "Rei da Noite", "desc": "-20% fadiga em missões", "roles": []},
    "lingua_de_prata": {"name": "Língua de Prata", "desc": "-15% custo de subornos", "roles": ["negociador", "advogado"]},
    "fantasma_digital": {"name": "Fantasma Digital", "desc": "-50% calor em operações técnicas", "roles": ["hacker", "falsificador", "espiao"]},
}

RECRUIT_SOURCES = {
    "rua": {"name": "Rua", "min_level": 1, "roles": ["assaltante", "seguranca", "motorista"],
            "rarity_w": {"comum": 80, "raro": 18, "elite": 2, "lendario": 0}},
    "bares": {"name": "Bares", "min_level": 1, "roles": ["informador", "contrabandista", "negociador", "motorista"],
              "rarity_w": {"comum": 70, "raro": 25, "elite": 5, "lendario": 0}},
    "empresas": {"name": "Empresas", "min_level": 2, "roles": ["gestor", "advogado", "lavador"],
                 "rarity_w": {"comum": 55, "raro": 35, "elite": 9, "lendario": 1}},
    "prisoes": {"name": "Prisões", "min_level": 3, "roles": ["assaltante", "falsificador", "seguranca", "contrabandista"],
                "rarity_w": {"comum": 50, "raro": 35, "elite": 13, "lendario": 2}},
    "mercado_negro": {"name": "Mercado Negro", "min_level": 4, "roles": ["hacker", "falsificador", "espiao", "medico"],
                      "rarity_w": {"comum": 35, "raro": 40, "elite": 20, "lendario": 5}},
    "contactos": {"name": "Contactos", "min_level": 5, "roles": list(SPECIALIZATIONS.keys()),
                  "rarity_w": {"comum": 20, "raro": 40, "elite": 30, "lendario": 10}},
}

POOL_REFRESH_MIN = 5
PAYROLL_CYCLE_MIN = 30

EMP_LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200]

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
              "best_for": ["logistica", "influencia"], "luxury": False},
    "moto": {"name": "Moto Rápida", "min_level": 1, "price": 12000, "speed": 15,
             "fuel_type": "gasolina", "tank_l": 15, "cons": 4.5, "seats": 2,
             "best_for": ["assalto", "tecnica"], "luxury": False},
    "van": {"name": "Van Reforçada", "min_level": 2, "price": 18000, "speed": 12,
            "fuel_type": "gasoleo", "tank_l": 70, "cons": 10.0, "seats": 6,
            "best_for": ["logistica"], "luxury": False},
    "desportivo": {"name": "Desportivo", "min_level": 3, "price": 30000, "speed": 19,
                   "fuel_type": "gasolina", "tank_l": 55, "cons": 12.0, "seats": 2,
                   "best_for": ["especial"], "luxury": True},
    "suv_blindado": {"name": "SUV Blindado", "min_level": 4, "price": 45000, "speed": 14,
                     "fuel_type": "gasoleo", "tank_l": 80, "cons": 13.0, "seats": 5,
                     "best_for": ["assalto"], "luxury": False},
    "supercarro": {"name": "Supercarro", "min_level": 5, "price": 65000, "speed": 26,
                   "fuel_type": "gasolina", "tank_l": 60, "cons": 15.0, "seats": 2,
                   "best_for": ["especial"], "luxury": True},
}

# Nº máximo de membros ativos por equipa (independente do veículo).
TEAM_MAX_MEMBERS = 4

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

# ---------------- Missões: recompensa, disponibilidade e cancelamento ----------------

MEMBER_SPLIT_PENALTY_PER_EXTRA = 0.04  # redução de recompensa por membro acima do mínimo exigido
MEMBER_SPLIT_PENALTY_MAX = 0.20        # redução máxima de recompensa por divisão do saque
AGE_DECAY_MAX = 0.20                   # decaimento máximo de recompensa por a missão estar disponível há muito tempo
AGE_DECAY_RAMP_S = 480                 # tempo (s) até atingir o decaimento máximo
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

FUEL_PRICES = {"gasolina": 1.80, "gasoleo": 1.60}

# ---------------- Propriedades ----------------

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
                     "hours": (22, 5)},
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
}
