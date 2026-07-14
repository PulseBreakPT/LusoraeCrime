"""Regras puras do módulo Mastermind: grandes golpes e mercado negro."""

from datetime import datetime, timezone
import hashlib


MASTERMIND_RANKS = [
    {"level": 1, "name": "Planeador", "min_xp": 0},
    {"level": 2, "name": "Coordenador", "min_xp": 180},
    {"level": 3, "name": "Arquiteto", "min_xp": 520},
    {"level": 4, "name": "Mastermind", "min_xp": 1100},
    {"level": 5, "name": "Lenda", "min_xp": 2100},
]

HEIST_TARGETS = {
    "auction_house": {
        "name": "Leilão da Meia-Noite",
        "description": "Obras raras mudam de mãos durante uma janela de segurança privada.",
        "unlock_rank": 1,
        "base_reward": 90000,
        "base_success": 0.56,
        "duration_s": 180,
        "heat": 18,
        "bounty": 22,
        "cooldown_s": 900,
        "preps": [
            {"key": "blueprints", "name": "Plantas do Edifício", "required": True, "duration_s": 45, "cost": 2500, "base_success": 0.78, "bonus": 0.03},
            {"key": "security_pass", "name": "Passe de Segurança", "required": True, "duration_s": 55, "cost": 4000, "base_success": 0.72, "bonus": 0.04},
            {"key": "display_codes", "name": "Códigos das Vitrinas", "required": True, "duration_s": 60, "cost": 5000, "base_success": 0.68, "bonus": 0.05},
            {"key": "inside_buyer", "name": "Comprador Interno", "required": False, "duration_s": 70, "cost": 7500, "base_success": 0.60, "bonus": 0.08},
        ],
    },
    "port_reserve": {
        "name": "Reserva do Estuário",
        "description": "Um contentor blindado permanece no terminal apenas durante a mudança de turno.",
        "unlock_rank": 2,
        "base_reward": 175000,
        "base_success": 0.48,
        "duration_s": 240,
        "heat": 25,
        "bounty": 36,
        "cooldown_s": 1200,
        "preps": [
            {"key": "manifest", "name": "Manifesto de Carga", "required": True, "duration_s": 60, "cost": 6000, "base_success": 0.70, "bonus": 0.04},
            {"key": "crane_access", "name": "Acesso às Gruas", "required": True, "duration_s": 75, "cost": 8000, "base_success": 0.64, "bonus": 0.05},
            {"key": "convoy_route", "name": "Rota do Comboio", "required": True, "duration_s": 80, "cost": 9500, "base_success": 0.60, "bonus": 0.06},
            {"key": "harbor_patrol", "name": "Turnos da Patrulha", "required": False, "duration_s": 65, "cost": 7000, "base_success": 0.66, "bonus": 0.09},
        ],
    },
    "data_exchange": {
        "name": "Nó Soberano",
        "description": "Chaves financeiras ficam online minutos antes da replicação internacional.",
        "unlock_rank": 3,
        "base_reward": 310000,
        "base_success": 0.42,
        "duration_s": 300,
        "heat": 32,
        "bounty": 52,
        "cooldown_s": 1800,
        "preps": [
            {"key": "network_map", "name": "Mapa da Rede", "required": True, "duration_s": 75, "cost": 10000, "base_success": 0.66, "bonus": 0.05},
            {"key": "cold_credentials", "name": "Credenciais Frias", "required": True, "duration_s": 90, "cost": 14000, "base_success": 0.58, "bonus": 0.06},
            {"key": "power_window", "name": "Janela Elétrica", "required": True, "duration_s": 95, "cost": 16000, "base_success": 0.56, "bonus": 0.07},
            {"key": "mirror_server", "name": "Servidor Espelho", "required": False, "duration_s": 110, "cost": 22000, "base_success": 0.50, "bonus": 0.11},
        ],
    },
}

HEIST_APPROACHES = {
    "silent": {
        "name": "Silencioso",
        "description": "Exige precisão, reduz calor e prolonga a execução.",
        "success": 0.06,
        "reward_mult": 0.94,
        "heat_mult": 0.58,
        "duration_mult": 1.20,
        "unlock_rank": 1,
    },
    "social": {
        "name": "Infiltração",
        "description": "Mistura documentos, negociação e uma saída controlada.",
        "success": 0.03,
        "reward_mult": 1.0,
        "heat_mult": 0.82,
        "duration_mult": 1.0,
        "unlock_rank": 1,
    },
    "assault": {
        "name": "Choque",
        "description": "Mais saque em menos tempo, com resposta policial máxima.",
        "success": -0.02,
        "reward_mult": 1.22,
        "heat_mult": 1.55,
        "duration_mult": 0.78,
        "unlock_rank": 2,
    },
}

FENCES = {
    "quick": {
        "name": "Liquidação Rápida",
        "description": "Pagamento imediato com comissão elevada.",
        "reward_mult": 0.82,
        "heat_mult": 1.0,
        "delay_s": 0,
        "success": 0.02,
        "unlock_rank": 1,
    },
    "discreet": {
        "name": "Rede Discreta",
        "description": "Espera adicional por melhor cobertura e menos calor.",
        "reward_mult": 0.94,
        "heat_mult": 0.68,
        "delay_s": 90,
        "success": 0.04,
        "unlock_rank": 1,
    },
    "exclusive": {
        "name": "Comprador Exclusivo",
        "description": "Pagamento superior, mas o comprador exige perfeição.",
        "reward_mult": 1.08,
        "heat_mult": 1.12,
        "delay_s": 45,
        "success": -0.05,
        "unlock_rank": 3,
    },
}

COMPLICATIONS = {
    "inside_help": {
        "name": "Ajuda Interna",
        "description": "Uma porta crítica ficou aberta.",
        "success": 0.06,
        "reward_mult": 1.0,
        "heat_mult": 0.9,
    },
    "silent_alarm": {
        "name": "Alarme Silencioso",
        "description": "A resposta chega antes do previsto.",
        "success": -0.07,
        "reward_mult": 1.08,
        "heat_mult": 1.25,
    },
    "extra_loot": {
        "name": "Carga Não Registada",
        "description": "A equipa encontrou valor adicional no alvo.",
        "success": -0.03,
        "reward_mult": 1.18,
        "heat_mult": 1.05,
    },
    "rival_tip": {
        "name": "Denúncia Rival",
        "description": "Uma fação concorrente entregou parte do plano.",
        "success": -0.09,
        "reward_mult": 1.12,
        "heat_mult": 1.35,
    },
    "clean_window": {
        "name": "Janela Limpa",
        "description": "O turno de segurança atrasou-se.",
        "success": 0.08,
        "reward_mult": 0.98,
        "heat_mult": 0.75,
    },
}

MARKET_GOODS = {
    "microchips": {
        "name": "Microchips Selados",
        "description": "Componentes escassos com procura industrial.",
        "base_price": 1800,
        "unlock_rank": 1,
        "space": 1,
    },
    "art_crates": {
        "name": "Caixas de Arte",
        "description": "Proveniência incerta e liquidez volátil.",
        "base_price": 4200,
        "unlock_rank": 1,
        "space": 2,
    },
    "medical_cases": {
        "name": "Malas Clínicas",
        "description": "Material de emergência que reage a crises urbanas.",
        "base_price": 3100,
        "unlock_rank": 2,
        "space": 1,
    },
    "cipher_keys": {
        "name": "Chaves Cifradas",
        "description": "Ativos digitais raros, difíceis de armazenar e rastrear.",
        "base_price": 7800,
        "unlock_rank": 3,
        "space": 3,
    },
}


def mastermind_rank(xp):
    value = max(0, int(xp or 0))
    current = MASTERMIND_RANKS[0]
    for row in MASTERMIND_RANKS:
        if value >= row["min_xp"]:
            current = row
    index = MASTERMIND_RANKS.index(current)
    next_row = MASTERMIND_RANKS[index + 1] if index + 1 < len(MASTERMIND_RANKS) else None
    progress = 100.0
    if next_row:
        progress = (value - current["min_xp"]) / max(1, next_row["min_xp"] - current["min_xp"]) * 100
    return {
        **current,
        "xp": value,
        "next_xp": next_row["min_xp"] if next_row else None,
        "next_name": next_row["name"] if next_row else None,
        "progress_pct": round(max(0, min(100, progress)), 1),
    }


def _stable_unit(seed):
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") / float(2**64 - 1)


def market_bucket(now=None):
    current = now or datetime.now(timezone.utc)
    return int(current.timestamp()) // (15 * 60)


def market_quote(player_id, good_key, now=None):
    current = now or datetime.now(timezone.utc)
    bucket = market_bucket(current)
    cfg = MARKET_GOODS[good_key]
    unit = _stable_unit(f"{player_id}:{good_key}:{bucket}")
    previous = _stable_unit(f"{player_id}:{good_key}:{bucket - 1}")
    factor = 0.68 + unit * 0.77
    previous_factor = 0.68 + previous * 0.77
    price = max(100, int(round(cfg["base_price"] * factor / 10) * 10))
    previous_price = max(100, int(round(cfg["base_price"] * previous_factor / 10) * 10))
    end_ts = (bucket + 1) * 15 * 60
    return {
        "price": price,
        "previous_price": previous_price,
        "trend": "up" if price > previous_price else "down" if price < previous_price else "flat",
        "change_pct": round((price / previous_price - 1) * 100, 1),
        "ends_at": datetime.fromtimestamp(end_ts, tz=timezone.utc).isoformat(),
        "bucket": bucket,
    }


def deterministic_roll(seed):
    return _stable_unit(seed)


def cache_signature(player_id, district_key):
    digest = hashlib.sha256(f"cache:{player_id}:{district_key}".encode("utf-8")).hexdigest()
    return digest[:10].upper()


def clamp_chance(value):
    return round(max(0.12, min(0.90, float(value))), 3)
