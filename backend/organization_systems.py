"""Sistemas integrados da organização — logística, equipamento e late game.

Este módulo é deliberadamente puro sempre que possível: catálogos e helpers
vivem aqui; as rotas fazem as mutações e engine.py executa efeitos ao longo do
tempo. Mantém uma única fonte de verdade para frontend/backend.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from economy_constants import (
    PRESTIGE_ITEMS, GOVERNMENT_CORRUPTION_BASE, GOVERNMENT_CORRUPTION_PER_EMPLOYEE,
    GOVERNMENT_CORRUPTION_PER_PROPERTY, GOVERNMENT_CORRUPTION_UNLOCK_LEVEL,
)

# 18 stocks transversais. Valores são de balanceamento ficcional.
SUPPLY_CATALOG = {
    "ammo_sidearm": {"name": "Munição curta", "category": "municoes", "price": 90, "pack": 30, "space": 0.08, "min_level": 1, "desc": "Stock para armas curtas."},
    "ammo_shotgun": {"name": "Cartuchos", "category": "municoes", "price": 120, "pack": 20, "space": 0.12, "min_level": 2, "desc": "Stock para caçadeiras."},
    "ammo_rifle": {"name": "Munição de carabina", "category": "municoes", "price": 160, "pack": 30, "space": 0.10, "min_level": 3, "desc": "Stock para armas longas."},
    "ammo_precision": {"name": "Munição de precisão", "category": "municoes", "price": 220, "pack": 15, "space": 0.10, "min_level": 5, "desc": "Stock especializado de precisão."},
    "medical_kit": {"name": "Kit médico", "category": "equipa", "price": 280, "pack": 1, "space": 1.0, "min_level": 1, "desc": "Reduz consequências físicas quando incluído no loadout."},
    "body_armor": {"name": "Proteção balística", "category": "equipa", "price": 650, "pack": 1, "space": 1.5, "min_level": 2, "desc": "Proteção consumível para operações de maior risco."},
    "disguise_kit": {"name": "Kit de disfarce", "category": "equipa", "price": 380, "pack": 1, "space": 0.8, "min_level": 2, "desc": "Ajuda operações discretas e de influência."},
    "entry_tools": {"name": "Ferramentas de entrada", "category": "ferramentas", "price": 420, "pack": 1, "space": 1.2, "min_level": 1, "desc": "Ferramentas genéricas de acesso para gameplay."},
    "electronics_kit": {"name": "Kit eletrónico", "category": "ferramentas", "price": 520, "pack": 1, "space": 1.0, "min_level": 2, "desc": "Suporte a operações técnicas."},
    "surveillance_kit": {"name": "Kit de vigilância", "category": "ferramentas", "price": 780, "pack": 1, "space": 1.2, "min_level": 2, "desc": "Melhora preparação e reconhecimento."},
    "burner_phones": {"name": "Telemóveis descartáveis", "category": "comunicacoes", "price": 240, "pack": 4, "space": 0.3, "min_level": 1, "desc": "Comunicações de curta duração."},
    "signal_kit": {"name": "Kit de sinal", "category": "comunicacoes", "price": 900, "pack": 1, "space": 1.0, "min_level": 4, "desc": "Equipamento eletrónico de apoio e contramedidas ficcionais."},
    "fake_docs": {"name": "Documentação de cobertura", "category": "cobertura", "price": 600, "pack": 1, "space": 0.2, "min_level": 3, "desc": "Cobertura operacional consumível."},
    "vehicle_parts": {"name": "Peças de oficina", "category": "frota", "price": 450, "pack": 1, "space": 2.0, "min_level": 1, "desc": "Usadas em revisões e reparações avançadas."},
    "tire_set": {"name": "Jogo de pneus", "category": "frota", "price": 520, "pack": 1, "space": 3.0, "min_level": 1, "desc": "Repõe a saúde dos pneus de um veículo."},
    "service_fluids": {"name": "Consumíveis de revisão", "category": "frota", "price": 180, "pack": 1, "space": 1.0, "min_level": 1, "desc": "Usados numa revisão programada."},
    "safehouse_supplies": {"name": "Suprimentos de base", "category": "imoveis", "price": 260, "pack": 1, "space": 1.5, "min_level": 1, "desc": "Mantém instalações preparadas e seguras."},
    "evidence_cleanup": {"name": "Kit de limpeza operacional", "category": "cobertura", "price": 480, "pack": 1, "space": 0.8, "min_level": 3, "desc": "Reduz exposição após operações arriscadas."},
}

WEAPON_AMMO = {
    "faca_taser": None,
    "pistola": "ammo_sidearm",
    "espingarda": "ammo_shotgun",
    "submetralhadora": "ammo_sidearm",
    "pistola_silenciada": "ammo_sidearm",
    "cacadeira_serrada": "ammo_shotgun",
    "rifle_assalto": "ammo_rifle",
    "rifle_precisao": "ammo_precision",
    "metralhadora_ligeira": "ammo_rifle",
}

WEAPON_UPGRADES = {
    "reliability": {"name": "Kit de fiabilidade", "cost": 950, "min_level": 2, "max_rank": 3, "reliability": 4, "desc": "Reduz risco de falha mecânica."},
    "handling": {"name": "Ergonomia", "cost": 800, "min_level": 2, "max_rank": 3, "use_speed": 4, "accuracy": 2, "desc": "Melhora utilização e controlo."},
    "precision": {"name": "Miras melhoradas", "cost": 1200, "min_level": 3, "max_rank": 2, "accuracy": 5, "range": 4, "desc": "Aumenta precisão e alcance de gameplay."},
    "low_profile": {"name": "Perfil discreto", "cost": 1500, "min_level": 3, "max_rank": 2, "discretion": 7, "power": -2, "desc": "Troca algum impacto por menor exposição."},
    "reinforced": {"name": "Componentes reforçados", "cost": 1350, "min_level": 4, "max_rank": 2, "durability": 8, "weight": 3, "desc": "Mais durabilidade com pequeno custo de peso."},
}

TEAM_DOCTRINES = {
    "balanced": {"name": "Equilibrada", "desc": "Sem modificadores; decisão segura para uso geral.", "chance": 0.0, "reward": 1.0, "heat": 1.0, "fatigue": 1.0},
    "cautious": {"name": "Segurança Máxima", "desc": "Prioriza sobrevivência e consistência.", "chance": 0.03, "reward": 0.94, "heat": 0.88, "fatigue": 0.90},
    "stealth": {"name": "Baixo Perfil", "desc": "Favorece técnica/influência e reduz exposição.", "chance": 0.01, "reward": 0.98, "heat": 0.78, "fatigue": 1.0, "category_bonus": {"tecnica": 0.025, "influencia": 0.02}},
    "aggressive": {"name": "Impacto", "desc": "Mais retorno com maior exposição e desgaste.", "chance": -0.015, "reward": 1.10, "heat": 1.22, "fatigue": 1.15, "category_bonus": {"assalto": 0.035, "especial": 0.02}},
}

TEAM_POLICIES = {
    "abort_below_pct": {"name": "Limiar de risco", "default": 0, "min": 0, "max": 60},
    "protect_injured": {"name": "Proteger feridos", "default": True},
    "auto_use_medical": {"name": "Usar kit médico", "default": True},
    "auto_use_armor": {"name": "Usar proteção", "default": True},
}

DEPARTMENTS = {
    "financeiro": {
        "name": "Gabinete Financeiro", "unlock_hq": 3, "base_cost": 18000, "max_level": 5,
        "desc": "Controlo de custos, tesouraria e disciplina de capital.",
        "levels": ["Contabilidade central", "Negociação de contratos", "Tesouraria preventiva", "Controlo de risco", "Planeamento estratégico"],
    },
    "rh": {
        "name": "Recursos Humanos", "unlock_hq": 4, "base_cost": 22000, "max_level": 5,
        "desc": "Recrutamento, formação, retenção e recuperação do efetivo.",
        "levels": ["Triagem profissional", "Formação acelerada", "Retenção", "Planos de carreira", "Academia interna"],
    },
    "logistica": {
        "name": "Logística", "unlock_hq": 5, "base_cost": 28000, "max_level": 5,
        "desc": "Compras, transferências, capacidade e prontidão material.",
        "levels": ["Compras centralizadas", "Rotas otimizadas", "Stock de segurança", "Manutenção preventiva", "Cadeia integrada"],
    },
    "investigacao": {
        "name": "Investigação", "unlock_hq": 7, "base_cost": 38000, "max_level": 5,
        "desc": "Contrainteligência, exposição e leitura territorial.",
        "levels": ["Reconhecimento", "Contra-vigilância", "Análise de padrões", "Célula de risco", "Inteligência estratégica"],
    },
    "comunicacoes": {
        "name": "Comunicações", "unlock_hq": 8, "base_cost": 45000, "max_level": 5,
        "desc": "Coordenação, reorganização e continuidade operacional.",
        "levels": ["Procedimentos comuns", "Despacho coordenado", "Rede redundante", "Comando distribuído", "Centro de operações"],
    },
}

TERRITORY_TIERS = {
    1: {"name": "Presença", "cost": 55000, "income_h": 180, "reward_bonus": 0.01, "defense_weekly": 900},
    2: {"name": "Consolidado", "cost": 90000, "income_h": 420, "reward_bonus": 0.025, "defense_weekly": 2200},
    3: {"name": "Dominante", "cost": 155000, "income_h": 850, "reward_bonus": 0.05, "defense_weekly": 4800},
}

PROPERTY_MODULES = {
    "security": {"name": "Segurança", "base_cost": 12000, "max_level": 3, "desc": "Reduz risco de rusga e perdas."},
    "storage": {"name": "Armazenamento", "base_cost": 9000, "max_level": 3, "desc": "Aumenta a capacidade logística desta base."},
    "operations": {"name": "Operações", "base_cost": 14000, "max_level": 3, "desc": "Melhora eficiência geral da instalação."},
}

VEHICLE_LIFECYCLE = {
    "service_interval_km": 5000,
    "inspection_days": 365,
    "insurance_days": 28,
    "service_base_pct": 0.018,
    "insurance_week_pct": 0.0012,
    "inspection_base": 85,
    "tire_wear_per_100km": 1.4,
    "notoriety_decay_per_hour": 0.6,
}

TRAITS = [
    "disciplinado", "ambicioso", "prudente", "leal", "competitivo",
    "metodico", "resiliente", "impulsivo", "reservado", "social",
]

PRESTIGE_CATALOG = PRESTIGE_ITEMS

INJURY_SEVERITIES = {
    "ligeiro": {"recovery_s": 180, "performance": 0.96},
    "moderado": {"recovery_s": 480, "performance": 0.90},
    "grave": {"recovery_s": 900, "performance": 0.80},
}


def department_level(player: dict, key: str) -> int:
    return max(0, int((player.get("departments") or {}).get(key, 0) or 0))


def department_cost(key: str, next_level: int) -> int:
    cfg = DEPARTMENTS[key]
    return int(cfg["base_cost"] * (1 + 0.75 * max(0, next_level - 1)))


def doctrine_effect(team: dict, category: str) -> dict:
    key = team.get("doctrine") or "balanced"
    cfg = TEAM_DOCTRINES.get(key, TEAM_DOCTRINES["balanced"])
    chance = float(cfg.get("chance", 0)) + float((cfg.get("category_bonus") or {}).get(category, 0))
    return {**cfg, "key": key, "chance": chance}


def normalize_inventory(player: dict) -> dict[str, int]:
    inv = dict(player.get("inventory") or {})
    for key in SUPPLY_CATALOG:
        inv[key] = max(0, int(inv.get(key, 0) or 0))
    return inv


def inventory_capacity(player: dict, properties: list[dict]) -> int:
    hq_level = int((player.get("hq") or {}).get("level", 1) or 1)
    cap = 60 + hq_level * 20 + department_level(player, "logistica") * 40
    for p in properties:
        lvl = max(1, int(p.get("level", 1) or 1))
        typ = p.get("type_key")
        if typ == "armazem":
            cap += 90 * lvl
        elif typ == "centro_logistico":
            cap += 140 * lvl
        elif typ == "arsenal":
            cap += 45 * lvl
        elif typ in {"garagem", "esconderijo"}:
            cap += 20 * lvl
        cap += int(p.get("storage_level", 0) or 0) * 45
    return cap


def inventory_used(inventory: dict[str, int]) -> float:
    return round(sum(float(SUPPLY_CATALOG[k]["space"]) * max(0, int(inventory.get(k, 0) or 0)) for k in SUPPLY_CATALOG), 2)


def territory_weekly_cost(player: dict) -> int:
    total = 0
    for info in (player.get("territories") or {}).values():
        tier = max(0, min(3, int((info or {}).get("tier", 0) or 0)))
        if tier:
            total += TERRITORY_TIERS[tier]["defense_weekly"]
    return total


def territory_income_per_hour(player: dict) -> int:
    total = 0
    for info in (player.get("territories") or {}).values():
        tier = max(0, min(3, int((info or {}).get("tier", 0) or 0)))
        if tier:
            pressure = max(0.0, min(100.0, float((info or {}).get("pressure", 0) or 0)))
            total += int(TERRITORY_TIERS[tier]["income_h"] * (1 - pressure / 160.0))
    return max(0, total)


def territory_reward_bonus(player: dict, district: str | None) -> float:
    if not district:
        return 0.0
    info = (player.get("territories") or {}).get(district)
    if not info:
        return 0.0
    tier = max(0, min(3, int(info.get("tier", 0) or 0)))
    return TERRITORY_TIERS.get(tier, {}).get("reward_bonus", 0.0)


def vehicle_service_snapshot(vehicle: dict) -> dict:
    km = float(vehicle.get("km_total", 0) or 0)
    last = float(vehicle.get("last_service_km", 0) or 0)
    interval = VEHICLE_LIFECYCLE["service_interval_km"]
    remaining = max(0, interval - (km - last))
    return {
        "service_due_in_km": round(remaining),
        "service_overdue": km - last >= interval,
        "tires_pct": round(max(0.0, min(100.0, float(vehicle.get("tires_pct", 100) or 0))), 1),
        "insurance_until": vehicle.get("insurance_until"),
        "inspection_due_at": vehicle.get("inspection_due_at"),
        "notoriety": round(max(0.0, min(100.0, float(vehicle.get("notoriety", 0) or 0))), 1),
        "seized_until": vehicle.get("seized_until"),
    }


def property_security_factor(properties: list[dict]) -> float:
    labs = [p for p in properties if p.get("type_key") == "laboratorio"]
    if not labs:
        return 1.0
    avg = sum(int(p.get("security_level", 0) or 0) for p in labs) / len(labs)
    return max(0.55, 1.0 - avg * 0.12)


def default_team_policies() -> dict[str, Any]:
    return {key: cfg["default"] for key, cfg in TEAM_POLICIES.items()}


def ensure_employee_profile(emp: dict) -> dict:
    # Determinístico para saves antigos, sem depender de random no GET.
    if emp.get("traits"):
        return emp
    seed = sum(ord(ch) for ch in str(emp.get("_id") or emp.get("name") or "x"))
    emp["traits"] = [TRAITS[seed % len(TRAITS)], TRAITS[(seed // 7 + 3) % len(TRAITS)]]
    emp.setdefault("stress", 10.0)
    emp.setdefault("injury", None)
    emp.setdefault("sentence", None)
    emp.setdefault("relations", {})
    return emp


def fixed_cost_multiplier(player: dict) -> float:
    """Financeiro: reduz custos operacionais; salários e TSU continuam intactos."""
    return max(0.80, 1.0 - department_level(player, "financeiro") * 0.04)


def logistics_cost_multiplier(player: dict) -> float:
    return max(0.70, 1.0 - department_level(player, "logistica") * 0.06)


def raid_risk_multiplier(player: dict, properties: list[dict]) -> float:
    investigation = max(0.50, 1.0 - department_level(player, "investigacao") * 0.10)
    protection = 0.72 if protection_active(player) else 1.0
    return investigation * property_security_factor(properties) * protection


def loadout_effect(loadout: dict, category: str, policies: dict | None = None) -> dict:
    loadout = loadout or {}
    policies = {**default_team_policies(), **(policies or {})}
    chance = 0.0
    heat = 1.0
    injury = 1.0
    if loadout.get("surveillance_kit"):
        chance += 0.012
    if loadout.get("electronics_kit") and category == "tecnica":
        chance += 0.025
    if loadout.get("disguise_kit") and category in {"tecnica", "influencia"}:
        chance += 0.02
        heat *= 0.92
    if loadout.get("entry_tools") and category in {"assalto", "especial"}:
        chance += 0.018
    if loadout.get("burner_phones"):
        heat *= 0.95
    if loadout.get("signal_kit"):
        if category in {"tecnica", "logistica"}:
            chance += 0.016
        heat *= 0.93
    if loadout.get("fake_docs"):
        if category in {"influencia", "logistica"}:
            chance += 0.015
        heat *= 0.91
    if loadout.get("evidence_cleanup"):
        heat *= 0.86
    if loadout.get("medical_kit") and policies.get("auto_use_medical", True):
        injury *= 0.72
    if loadout.get("body_armor") and policies.get("auto_use_armor", True):
        injury *= 0.78
        heat *= 1.02
    if policies.get("protect_injured", True):
        injury *= 0.90
        # Resgatar e proteger feridos preserva pessoas, mas torna a retirada
        # ligeiramente mais lenta/exposta.
        heat *= 1.015
    return {
        "chance": min(0.08, chance),
        "heat": max(0.65, heat),
        "injury": max(0.40, injury),
        "protect_injured": bool(policies.get("protect_injured", True)),
        "auto_use_medical": bool(policies.get("auto_use_medical", True)),
        "auto_use_armor": bool(policies.get("auto_use_armor", True)),
    }


def apply_weapon_upgrades(model: dict, weapon: dict | None) -> dict:
    result = dict(model or {})
    for installed in (weapon or {}).get("upgrades") or []:
        cfg = WEAPON_UPGRADES.get(installed.get("key"))
        if not cfg:
            continue
        for stat in ("reliability", "use_speed", "accuracy", "range", "discretion", "power", "durability", "weight"):
            if stat in cfg:
                result[stat] = max(0, float(result.get(stat, 0) or 0) + float(cfg[stat]))
    return result


def weapon_ammo_status(model_key: str, model: dict, weapon: dict) -> dict:
    ammo_key = WEAPON_AMMO.get(model_key)
    capacity = max(0, int((model or {}).get("magazine_capacity", 0) or 0))
    if ammo_key is None:
        return {"ammo_key": None, "capacity": capacity, "loaded": capacity, "fraction": 1.0}
    loaded = max(0, min(capacity, int((weapon or {}).get("ammo_loaded", 0) or 0)))
    fraction = loaded / max(1, capacity)
    return {"ammo_key": ammo_key, "capacity": capacity, "loaded": loaded, "fraction": fraction}


def prestige_effects(player: dict) -> dict:
    owned = set(player.get("prestige_items") or [])
    out = {
        "dirty_cap_increase": 0, "mission_bonus": 0.0, "spec_bonus": 0.0,
        "lab_bonus": 0.0, "laundry_bonus": 0.0, "heat_decay_bonus": 0.0,
    }
    for key in owned:
        cfg = PRESTIGE_ITEMS.get(key) or {}
        for field in out:
            if field in cfg:
                out[field] += cfg[field]
    return out


def protection_active(player: dict, now: datetime | None = None) -> bool:
    until = (player.get("governance") or {}).get("protection_until")
    if not until:
        return False
    try:
        dt = datetime.fromisoformat(until)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt > (now or datetime.now(timezone.utc))
    except (TypeError, ValueError):
        return False


def protection_cost(player: dict, employee_count: int, property_count: int) -> int:
    if int(player.get("level", 1) or 1) < GOVERNMENT_CORRUPTION_UNLOCK_LEVEL:
        return 0
    return int(
        GOVERNMENT_CORRUPTION_BASE
        + max(0, employee_count) * GOVERNMENT_CORRUPTION_PER_EMPLOYEE
        + max(0, property_count) * GOVERNMENT_CORRUPTION_PER_PROPERTY
    )


def property_operations_factor(prop: dict) -> float:
    module = max(0, int(prop.get("operations_level", 0) or 0))
    staff = min(4, len(prop.get("staff_employee_ids") or []))
    effectiveness = max(0.0, min(1.0, float(prop.get("staff_effectiveness", 0.0) or 0.0)))
    # Staff deixa de ser apenas "quantidade". Quatro pessoas mal escolhidas
    # rendem menos do que uma equipa pequena com atributos adequados.
    staff_bonus = staff * 0.01 + effectiveness * 0.08
    return 1.0 + module * 0.05 + staff_bonus
