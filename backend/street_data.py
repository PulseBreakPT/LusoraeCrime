"""Regras puras do módulo Cidade Viva.

O módulo mantém os números e nomes fora das rotas para que a economia das
atividades de rua seja auditável e possa ser testada sem base de dados.
"""

from datetime import datetime, timezone
import hashlib


WANTED_THRESHOLDS = (10, 30, 50, 70, 85)

STREET_RANKS = [
    {"level": 1, "name": "Desconhecido", "min_rep": 0},
    {"level": 2, "name": "Condutor de Rua", "min_rep": 150},
    {"level": 3, "name": "Operador Local", "min_rep": 400},
    {"level": 4, "name": "Nome na Cidade", "min_rep": 800},
    {"level": 5, "name": "Chefe de Zona", "min_rep": 1400},
    {"level": 6, "name": "Lenda Urbana", "min_rep": 2300},
]

CITY_EVENTS = {
    "quiet_night": {
        "name": "Noite Silenciosa",
        "description": "Poucas patrulhas e ruas vazias favorecem operações discretas.",
        "success": 0.05,
        "reward_mult": 0.95,
        "heat_mult": 0.65,
        "gear_mult": 1.0,
        "job_success": {"smuggling": 0.04},
    },
    "crackdown": {
        "name": "Operação Cerco",
        "description": "A polícia montou controlos móveis. O risco sobe, tal como o valor dos trabalhos.",
        "success": -0.08,
        "reward_mult": 1.25,
        "heat_mult": 1.35,
        "gear_mult": 1.0,
        "job_success": {},
    },
    "street_festival": {
        "name": "Festival de Rua",
        "description": "Trânsito, multidões e apostas elevadas dominam a cidade.",
        "success": -0.01,
        "reward_mult": 1.10,
        "heat_mult": 0.85,
        "gear_mult": 1.0,
        "job_success": {"race": 0.10},
    },
    "black_market": {
        "name": "Mercado Paralelo",
        "description": "Equipamento tático circula com desconto durante uma janela curta.",
        "success": 0.0,
        "reward_mult": 1.08,
        "heat_mult": 1.0,
        "gear_mult": 0.72,
        "job_success": {"chop_shop": 0.04},
    },
    "rain_front": {
        "name": "Frente de Chuva",
        "description": "Piso molhado dificulta corridas, mas apaga rastos nas rotas de entrega.",
        "success": -0.02,
        "reward_mult": 1.08,
        "heat_mult": 0.90,
        "gear_mult": 1.0,
        "job_success": {"race": -0.06, "smuggling": 0.07},
    },
    "port_strike": {
        "name": "Greve no Porto",
        "description": "Contentores parados criam rotas raras e pagamentos excecionais.",
        "success": -0.04,
        "reward_mult": 1.18,
        "heat_mult": 1.12,
        "gear_mult": 0.95,
        "job_success": {"smuggling": 0.05},
    },
}

CONTACTS = {
    "fixer": {
        "name": "A Ponte",
        "role": "Intermediário",
        "unlock_rank": 1,
        "cooldown_s": 600,
        "description": "Prepara um multiplicador de recompensa para a próxima atividade.",
    },
    "mechanic": {
        "name": "Oficina 24",
        "role": "Mecânico",
        "unlock_rank": 2,
        "cooldown_s": 720,
        "description": "Repara e abastece um veículo no terreno.",
    },
    "lawyer": {
        "name": "Linha Cinzenta",
        "role": "Advogada",
        "unlock_rank": 3,
        "cooldown_s": 900,
        "description": "Reduz o calor e trata da libertação de um operacional.",
    },
    "informant": {
        "name": "Olho Norte",
        "role": "Informador",
        "unlock_rank": 4,
        "cooldown_s": 720,
        "description": "Ativa inteligência policial e reduz pressão rival.",
    },
}

ACTIVITIES = {
    "race": {
        "name": "Corrida Clandestina",
        "description": "Aposta limpa, velocidade máxima e desgaste real do veículo.",
        "unlock_rank": 1,
        "duration_s": 70,
        "base_success": 0.54,
        "reward_min": 4000,
        "reward_max": 7500,
        "base_cost": 0,
        "heat": 5,
        "rep": 20,
        "fuel": 7,
        "wear": 5,
        "pays": "clean",
    },
    "chop_shop": {
        "name": "Entrega à Desmontagem",
        "description": "Localiza, troca e entrega uma viatura antes do alerta fechar a zona.",
        "unlock_rank": 2,
        "duration_s": 95,
        "base_success": 0.50,
        "reward_min": 7500,
        "reward_max": 13500,
        "base_cost": 1200,
        "heat": 9,
        "rep": 32,
        "fuel": 9,
        "wear": 8,
        "pays": "dirty",
    },
    "smuggling": {
        "name": "Rota Clandestina",
        "description": "Transporta carga por uma rota longa com controlos policiais ativos.",
        "unlock_rank": 3,
        "duration_s": 125,
        "base_success": 0.48,
        "reward_min": 12000,
        "reward_max": 22000,
        "base_cost": 2500,
        "heat": 12,
        "rep": 46,
        "fuel": 13,
        "wear": 10,
        "pays": "dirty",
    },
}

WAGERS = {
    "cautious": {"name": "Aposta Cautelosa", "cost": 1000, "reward_mult": 1.0, "success": 0.05, "unlock_rank": 1},
    "standard": {"name": "Aposta de Rua", "cost": 5000, "reward_mult": 1.45, "success": 0.0, "unlock_rank": 1},
    "high": {"name": "Tudo ou Nada", "cost": 15000, "reward_mult": 2.25, "success": -0.08, "unlock_rank": 3},
}

APPROACHES = {
    "ghost": {
        "name": "Fantasma",
        "description": "Mais preparação, menos calor e menor recompensa.",
        "success": 0.07,
        "reward_mult": 0.88,
        "heat_mult": 0.60,
        "duration_mult": 1.18,
        "unlock_rank": 1,
    },
    "balanced": {
        "name": "Calculado",
        "description": "Equilíbrio entre tempo, risco e pagamento.",
        "success": 0.0,
        "reward_mult": 1.0,
        "heat_mult": 1.0,
        "duration_mult": 1.0,
        "unlock_rank": 1,
    },
    "force": {
        "name": "Impacto",
        "description": "Execução rápida, pagamento superior e muita atenção.",
        "success": 0.03,
        "reward_mult": 1.18,
        "heat_mult": 1.48,
        "duration_mult": 0.82,
        "unlock_rank": 2,
    },
}

ESCAPE_PLANS = {
    "low_profile": {
        "name": "Baixo Perfil",
        "description": "Rotas secundárias reduzem a exposição.",
        "success": 0.04,
        "caught_relief": 0.08,
        "reward_mult": 0.95,
        "heat_mult": 0.75,
        "duration_mult": 1.12,
        "cost": 0,
        "unlock_rank": 1,
    },
    "speed": {
        "name": "Velocidade",
        "description": "Fuga direta que depende do veículo.",
        "success": 0.02,
        "caught_relief": 0.03,
        "reward_mult": 1.0,
        "heat_mult": 1.10,
        "duration_mult": 0.86,
        "cost": 0,
        "unlock_rank": 1,
    },
    "decoy": {
        "name": "Isca",
        "description": "Uma equipa falsa atrai patrulhas para outra zona.",
        "success": 0.07,
        "caught_relief": 0.15,
        "reward_mult": 0.94,
        "heat_mult": 0.68,
        "duration_mult": 1.0,
        "cost": 1800,
        "unlock_rank": 3,
    },
}

GEAR = {
    "armor": {
        "name": "Colete Modular",
        "description": "Proteção adicional em entregas de alto risco.",
        "price": 2600,
        "success": 0.04,
        "heat_mult": 1.0,
        "caught_relief": 0.04,
        "jobs": ("chop_shop", "smuggling"),
        "unlock_rank": 1,
    },
    "jammer": {
        "name": "Bloqueador de Sinal",
        "description": "Atrasa comunicações policiais e reduz o calor.",
        "price": 4200,
        "success": 0.05,
        "heat_mult": 0.72,
        "caught_relief": 0.07,
        "jobs": ("race", "chop_shop", "smuggling"),
        "unlock_rank": 2,
    },
    "fake_docs": {
        "name": "Documentos Frios",
        "description": "Manifestos e matrículas coerentes para controlos de carga.",
        "price": 3600,
        "success": 0.08,
        "heat_mult": 0.85,
        "caught_relief": 0.05,
        "jobs": ("smuggling",),
        "unlock_rank": 3,
    },
    "runflats": {
        "name": "Pneus Reforçados",
        "description": "Mantêm aderência e mobilidade sob pressão.",
        "price": 3100,
        "success": 0.06,
        "heat_mult": 1.0,
        "caught_relief": 0.05,
        "jobs": ("race", "chop_shop"),
        "unlock_rank": 2,
    },
}


def wanted_stars(heat):
    value = max(0.0, min(100.0, float(heat or 0)))
    return sum(1 for threshold in WANTED_THRESHOLDS if value >= threshold)


def street_rank(rep):
    value = max(0, int(rep or 0))
    current = STREET_RANKS[0]
    for row in STREET_RANKS:
        if value >= row["min_rep"]:
            current = row
    index = STREET_RANKS.index(current)
    next_row = STREET_RANKS[index + 1] if index + 1 < len(STREET_RANKS) else None
    return {
        **current,
        "rep": value,
        "next_rep": next_row["min_rep"] if next_row else None,
        "next_name": next_row["name"] if next_row else None,
    }


def city_event(player_id, now=None):
    current = now or datetime.now(timezone.utc)
    bucket_s = 30 * 60
    bucket = int(current.timestamp()) // bucket_s
    keys = sorted(CITY_EVENTS)
    digest = hashlib.sha256(f"{player_id}:{bucket}".encode("utf-8")).digest()
    key = keys[int.from_bytes(digest[:4], "big") % len(keys)]
    ends_ts = (bucket + 1) * bucket_s
    ends_at = datetime.fromtimestamp(ends_ts, tz=timezone.utc).isoformat()
    return {"key": key, **CITY_EVENTS[key], "ends_at": ends_at}


def clamp_chance(value):
    return round(max(0.15, min(0.92, float(value))), 3)
