# Sistema de recompensas dinâmicas — constantes e configuração
# Todos os valores são ajustáveis sem tocar no código principal

# ============================================================================
# SCORES BASE — Componentes primitivos do cálculo de recompensa
# ============================================================================

# Multiplicador de risco: quanto maior o risco, maior a recompensa base
RISK_MULTIPLIERS = {
    1: 1.0,      # Muito baixo
    2: 1.3,      # Baixo
    3: 1.7,      # Médio
    4: 2.4,      # Alto
    5: 3.5,      # Muito alto
    6: 5.0,      # Extremo (risco artificial por distância)
}

# Pesos dos tipos de veículo — quanto maior, mais contribuem para a recompensa
# Reflete especialização e valor do veículo
VEHICLE_TYPE_WEIGHTS = {
    # Categoria: weight
    # Veículos leves/comuns — base 1.0
    "sedan": 1.0,
    "hatchback": 1.0,
    "van_light": 1.1,

    # Veículos utilitários — +30%
    "pickup": 1.3,
    "van_standard": 1.3,

    # Veículos especializados — +50-80%
    "ambulancia": 1.8,
    "camiao": 2.2,

    # Veículos muito especializados — +180-200%
    "camiao_pesado": 2.8,
    "blindado": 3.2,
    "carro_furtivo": 3.5,

    # Fallback para veículos não mapeados
    "__default__": 1.0,
}

# Score de duração da missão (em minutos)
# Linear: quanto mais tempo, mais compensação
DURATION_SCORE_MIN_S = 30
DURATION_SCORE_MAX_S = 600
DURATION_SCORE_MIN_MULT = 0.8  # Operações muito rápidas valem menos
DURATION_SCORE_MAX_MULT = 1.6  # Operações longas valem mais

# Score de distância (em km)
# Crescimento sublinear: a distância vale, mas com diminishing returns
DISTANCE_SCORE_BASE = 1.0
DISTANCE_SCORE_PER_KM = 0.04
DISTANCE_SCORE_MAX = 1.8  # Cap para evitar exploits

# Score de tamanho da equipa
# Mais membros = mais complexo, mas com diminishing returns
TEAM_SIZE_SCORE_BASE = 1.0
TEAM_SIZE_SCORE_PER_MEMBER = 0.06  # +6% por cada membro acima do mínimo
TEAM_SIZE_SCORE_MAX = 1.5  # Cap em 50% de aumento

# Score de especialização
# Se a missão requer especialização específica, vale mais
SPECIALIZATION_SCORE_REQUIRED = 1.4  # Missão que exige match específico
SPECIALIZATION_SCORE_NORMAL = 1.0   # Missão aberta

# Score de objetivos/complexidade
# Baseado no número de requisitos ou "steps" da missão
OBJECTIVE_COMPLEXITY_BASE = 1.0
OBJECTIVE_COMPLEXITY_PER_REQUIREMENT = 0.05  # +5% por requisito

# ============================================================================
# RECOMPENSAS MONETÁRIAS — Escala absoluta
# ============================================================================

# Valor base mínimo e máximo para recompensas monetárias
# O algoritmo garante que nenhuma operação sairá destes limites
MONEY_REWARD_MIN = 500        # Operação trivial mínima
MONEY_REWARD_MAX = 120000     # Operação extrema máxima (aumentado para permitir spread)

# Multiplicador base por dificuldade
# Define o "valor" de uma operação de risco 1 ao nível 1
BASE_REWARD_PER_RISK = {
    1: 1500,   # Risco muito baixo
    2: 2500,   # Risco baixo
    3: 4500,   # Risco médio
    4: 8500,   # Risco alto
    5: 15000,  # Risco muito alto
}

# Escalamento por nível da organização
ORG_LEVEL_MULTIPLIER_BASE = 1.0
ORG_LEVEL_MULTIPLIER_PER_LEVEL = 0.35  # +35% por nível

# Escalamento por tipo de operação (category)
# Alguns tipos são intrinsecamente mais valiosos
CATEGORY_MULTIPLIERS = {
    "assalto": 1.0,      # Roubo — baseline
    "logistica": 0.85,   # Entrega — mais seguro, menos recompensa
    "tecnica": 1.0,      # Hacking — mesma dificuldade
    "influencia": 0.9,   # Influência — mais variável
    "especial": 1.2,     # Especial — operações raras, mais valor
    "__default__": 1.0,
}

# ============================================================================
# RECOMPENSAS NÃO-MONETÁRIAS
# ============================================================================

# Experiência dos operacionais
# Usa a mesma pontuação que dinheiro, mas com escala diferente
XP_REWARD_MIN = 50
XP_REWARD_MAX = 2000

# Multiplicador de XP por dificuldade
XP_MULTIPLIER_BASE = 1.0
XP_MULTIPLIER_PER_RISK = 0.5  # +50% XP por nível de risco

# Reputação (respect) — para desbloquear missões
REPUTATION_MULTIPLIER_BASE = 1.0
REPUTATION_MULTIPLIER_PER_RISK = 0.8  # +80% reputation por nível de risco

# Bónus especiais em operações de risco muito elevado (risk >= 5)
RARE_ITEM_CHANCE_BASE = 0.01      # 1% em operações normais
RARE_ITEM_CHANCE_HIGH_RISK = 0.05  # 5% em operações de risco muito elevado
RARE_ITEM_CHANCE_EXTREME_RISK = 0.10  # 10% em operações extremas

BONUS_REWARD_CHANCE = 0.05  # 5% chance de bónus em operações muito difíceis
BONUS_REWARD_MULTIPLIER = 1.5  # +50% quando ocorre

# ============================================================================
# LIMITES E PROTEÇÃO CONTRA EXPLOITS
# ============================================================================

# Limite máximo de multiplicadores que podem ser stackados
# Previne combinações absurdas (achievement + property + org level)
MAX_COMBINED_MULTIPLIER = 2.5  # Máximo 2.5× após todos os multiplicadores

# Penalidade por repetição da mesma missão tipo
# Evita farm de operações simples
REPEAT_PENALTY_MULTIPLIER = 0.85  # -15% por cada repetição consecutiva
REPEAT_PENALTY_RESETS_AFTER_MIN = 60  # Reseta a penalidade após X minutos

# Penalidade por usar team abaixo do requisito
# Se usar 1 membro numa operação de risco 4 (precisa 3), reduz recompensa
UNDERCREWING_PENALTY_PER_MISSING = 0.15  # -15% por membro faltando

# Penalidade por usando team muito maior que o requisito
# Usar 10 pessoas numa operação de risco 1 (precisa 1) é absurdo
OVERCREWING_PENALTY_PER_EXTRA = 0.04  # -4% por cada extra

# Perda de dinheiro em interceção policial
POLICE_INTERCEPT_FINE_MULTIPLIER = 0.10  # 10% do dinheiro pendente

# ============================================================================
# ESCALAS DE DIFICULDADE CALCULADA
# ============================================================================

# A dificuldade é calculada dinamicamente, não é fixa
# O algoritmo pondera todos os fatores para determinar quão difícil é

# Score mínimo/máximo esperado
DIFFICULTY_SCORE_MIN = 0.5   # Operação trivial
DIFFICULTY_SCORE_MAX = 15.0  # Operação impossível

# Ajuste fino para distribuição de recompensas
# Se o score médio for muito alto/baixo, estes valores rebalanceiam
DIFFICULTY_SCORE_INFLATION_FACTOR = 1.0  # Ajustar se a economia divergir

# ============================================================================
# DEFAULTS E FALLBACKS
# ============================================================================

# Se uma missão não tem um dos campos esperados, usar estes valores
DEFAULT_MISSION_DURATION_S = 120  # 2 minutos
DEFAULT_MISSION_DISTANCE_KM = 5.0  # 5 km
DEFAULT_TEAM_SIZE_MIN = 1
DEFAULT_TEAM_SIZE_MAX = 6
DEFAULT_RISK = 3

# ============================================================================
# DOCUMENTAÇÃO DE USO
# ============================================================================

"""
COMO USAR:

1. Para ajustar a dificuldade global: mudar DIFFICULTY_SCORE_INFLATION_FACTOR
2. Para favorecer/desfavorecer um tipo de operação: CATEGORY_MULTIPLIERS
3. Para rebalancear por nível: ORG_LEVEL_MULTIPLIER_PER_LEVEL
4. Para ajustar custo de vida (salários): fazer a conta com MONEY_REWARD_MAX
5. Para prevenir farm: ajustar REPEAT_PENALTY_MULTIPLIER

ECONOMIA SUSTENTÁVEL:

A recompensa final é calculada como:
  score = (risk × vehicle × team × duration × distance × specialization × objectives)
  reward = score × risk_multiplier × org_level × category × (1 - penalties)
  capped(reward, MONEY_REWARD_MIN, MONEY_REWARD_MAX)

Isto garante que:
- Operações triviais nunca pagam muito (mínimo 500€)
- Operações extremas nunca pagam infinito (máximo 50k€)
- O scaling é proporcional à dificuldade real
- Adicionar novos veículos/riscos/categorias não quebra a economia
"""
