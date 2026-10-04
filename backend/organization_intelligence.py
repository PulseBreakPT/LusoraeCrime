"""Organization intelligence and decision support.

Pure, deterministic helpers used by the organization API.  The frontend should
consume these results instead of reimplementing business rules.
"""
from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from typing import Any

from organization_events import public_event
from organization_systems import (
    SUPPLY_CATALOG,
    WEAPON_UPGRADES,
    PROPERTY_MODULES,
    DEPARTMENTS,
    TERRITORY_TIERS,
    VEHICLE_LIFECYCLE,
    PRESTIGE_CATALOG,
    department_cost,
    department_level,
    inventory_capacity,
    inventory_used,
    normalize_inventory,
    protection_cost, logistics_cost_multiplier, supply_cost_multiplier,
)

DEFAULT_ORG_POLICY = {
    "reserve_cash": 25000,
    "max_single_spend_pct": 0.35,
    "stock_targets": {},
    "weekly_budgets": {
        "supplies": 0,
        "fleet": 0,
        "infrastructure": 0,
        "territory": 0,
        "people": 0,
    },
    "automation": {
        "enabled": False,
        "auto_restock": False,
        "renew_insurance": False,
        "preventive_service": False,
    },
}


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, float(value)))


def parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def organization_policy(player: dict) -> dict:
    raw = dict(player.get("organization_policy") or {})
    auto = {**DEFAULT_ORG_POLICY["automation"], **(raw.get("automation") or {})}
    targets = {
        key: max(0, min(10000, int(value or 0)))
        for key, value in (raw.get("stock_targets") or {}).items()
        if key in SUPPLY_CATALOG
    }
    budgets = {
        key: max(0, min(100_000_000, int((raw.get("weekly_budgets") or {}).get(key, 0) or 0)))
        for key in DEFAULT_ORG_POLICY["weekly_budgets"]
    }
    return {
        "reserve_cash": max(0, int(raw.get("reserve_cash", DEFAULT_ORG_POLICY["reserve_cash"]) or 0)),
        "max_single_spend_pct": max(0.05, min(1.0, float(raw.get("max_single_spend_pct", DEFAULT_ORG_POLICY["max_single_spend_pct"]) or 0.35))),
        "stock_targets": targets,
        "weekly_budgets": budgets,
        "automation": {key: bool(auto.get(key, False)) for key in DEFAULT_ORG_POLICY["automation"]},
    }


def _transaction_window(transactions: list[dict], now: datetime, days: int = 28) -> list[dict]:
    cutoff = now.timestamp() - days * 86400
    out = []
    for tx in transactions:
        dt = parse_dt(tx.get("ts"))
        if dt and dt.timestamp() >= cutoff:
            out.append(tx)
    return out


BUDGET_KIND_MAP = {
    "supply_buy": "supplies",
    "automation_restock": "supplies",
    "vehicle_service": "fleet",
    "vehicle_tires": "fleet",
    "vehicle_insurance": "fleet",
    "vehicle_inspection": "fleet",
    "automation_insurance": "fleet",
    "automation_service": "fleet",
    "property_module": "infrastructure",
    "department_upgrade": "infrastructure",
    "prestige": "infrastructure",
    "territory_claim": "territory",
    "territory_consolidate": "territory",
    "territory_defend": "territory",
    "protection": "people",
    "organization_event": "people",
    "recruit": "people",
    "training": "people",
    "bonus": "people",
}


def weekly_budget_spend(transactions: list[dict], now: datetime | None = None) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    cutoff = now.timestamp() - 7 * 86400
    totals = {key: 0 for key in DEFAULT_ORG_POLICY["weekly_budgets"]}
    for tx in transactions:
        dt = parse_dt(tx.get("ts"))
        if not dt or dt.timestamp() < cutoff:
            continue
        category = BUDGET_KIND_MAP.get(tx.get("kind"))
        if not category:
            continue
        amount = float(tx.get("amount", 0) or 0)
        if amount < 0:
            totals[category] += round(abs(amount))
    return totals


def _stock_targets(player: dict, teams: list[dict]) -> tuple[dict[str, int], dict[str, int]]:
    policy = organization_policy(player)
    reserved: dict[str, int] = {key: 0 for key in SUPPLY_CATALOG}
    for team in teams:
        for key, qty in (team.get("loadout") or {}).items():
            if key in reserved:
                reserved[key] += max(0, int(qty or 0))
    targets = {}
    for key, cfg in SUPPLY_CATALOG.items():
        explicit = int(policy["stock_targets"].get(key, 0) or 0)
        operational = reserved[key] * 3
        sensible_floor = int(cfg.get("pack", 1) or 1) if reserved[key] else 0
        targets[key] = max(explicit, operational, sensible_floor)
    return targets, reserved


def _vehicle_health(vehicle: dict, now: datetime) -> tuple[float, list[str]]:
    score = 100.0
    reasons = []
    condition = clamp(vehicle.get("condition", 100))
    tires = clamp(vehicle.get("tires_pct", 100))
    if condition < 70:
        score -= (70 - condition) * 0.8
        reasons.append("condição baixa")
    if tires < 45:
        score -= (45 - tires) * 0.7
        reasons.append("pneus gastos")
    km = float(vehicle.get("km_total", 0) or 0)
    last_service = float(vehicle.get("last_service_km", 0) or 0)
    due = float(VEHICLE_LIFECYCLE["service_interval_km"]) - (km - last_service)
    if due <= 0:
        score -= 18
        reasons.append("revisão vencida")
    insurance = parse_dt(vehicle.get("insurance_until"))
    if not insurance or insurance <= now:
        score -= 16
        reasons.append("sem seguro")
    elif (insurance - now).total_seconds() <= 7 * 86400:
        score -= 6
        reasons.append("seguro a expirar")
    inspection = parse_dt(vehicle.get("inspection_due_at"))
    if inspection and inspection <= now:
        score -= 18
        reasons.append("IPO vencida")
    elif inspection and (inspection - now).total_seconds() <= 14 * 86400:
        score -= 6
        reasons.append("IPO próxima")
    if parse_dt(vehicle.get("seized_until")) and parse_dt(vehicle.get("seized_until")) > now:
        score -= 35
        reasons.append("apreendido")
    return clamp(score), reasons


def _team_health(team: dict, employees: list[dict], inventory: dict) -> tuple[float, list[str]]:
    members = [e for e in employees if e.get("team_id") == str(team.get("_id") or team.get("id"))]
    score = 100.0
    reasons = []
    if team.get("status") != "idle":
        score -= 6
    if not members:
        return 15.0, ["sem operacionais"]
    avg_fatigue = sum(float(e.get("fatigue", 0) or 0) for e in members) / len(members)
    avg_morale = sum(float(e.get("morale", 70) or 70) for e in members) / len(members)
    avg_loyalty = sum(float(e.get("loyalty", 70) or 70) for e in members) / len(members)
    score -= max(0.0, avg_fatigue - 35) * 0.45
    score -= max(0.0, 60 - avg_morale) * 0.35
    score -= max(0.0, 55 - avg_loyalty) * 0.35
    if avg_fatigue >= 70:
        reasons.append("fadiga elevada")
    if avg_morale < 50:
        reasons.append("moral baixa")
    if avg_loyalty < 45:
        reasons.append("lealdade em risco")
    shortages = [
        key for key, qty in (team.get("loadout") or {}).items()
        if int(qty or 0) > int(inventory.get(key, 0) or 0)
    ]
    if shortages:
        score -= min(30, len(shortages) * 10)
        reasons.append("loadout sem stock")
    if not team.get("vehicle_id"):
        score -= 20
        reasons.append("sem veículo")
    return clamp(score), reasons


def _property_staff_score(prop: dict) -> float:
    explicit = prop.get("staff_effectiveness")
    if explicit is not None:
        return clamp(float(explicit) * 100 if float(explicit) <= 1.5 else float(explicit))
    return clamp(len(prop.get("staff_employee_ids") or []) / 4 * 100)


def build_organization_intelligence(
    *,
    player: dict,
    teams: list[dict],
    employees: list[dict],
    vehicles: list[dict],
    weapons: list[dict],
    properties: list[dict],
    transactions: list[dict],
    weekly_fixed_total: int,
    now: datetime | None = None,
) -> dict:
    now = now or datetime.now(timezone.utc)
    inventory = normalize_inventory(player)
    policy = organization_policy(player)
    targets, reserved = _stock_targets(player, teams)
    recent = _transaction_window(transactions, now, 28)
    weekly_spend = weekly_budget_spend(transactions, now)
    budgets = []
    for key, limit in policy["weekly_budgets"].items():
        spent = int(weekly_spend.get(key, 0) or 0)
        pct = None if limit <= 0 else round(spent / max(1, limit) * 100, 1)
        budgets.append({
            "key": key, "limit": int(limit), "spent": spent,
            "remaining": None if limit <= 0 else max(0, int(limit) - spent),
            "pct": pct, "status": "unlimited" if limit <= 0 else ("over" if spent > limit else "warning" if spent >= limit * 0.80 else "ok"),
        })
    income_28 = sum(max(0.0, float(tx.get("amount", 0) or 0)) for tx in recent)
    expenses_28 = sum(abs(min(0.0, float(tx.get("amount", 0) or 0))) for tx in recent)
    historic_weekly_spend = expenses_28 / 4 if expenses_28 else 0
    weekly_burn = max(float(weekly_fixed_total or 0), historic_weekly_spend, 1.0)
    cash = max(0, int(player.get("clean_money", 0) or 0))
    runway = cash / weekly_burn
    finance_score = clamp(runway / 8 * 100)
    if income_28 > expenses_28 and recent:
        finance_score = clamp(finance_score + 8)

    stock_rows = []
    critical_stock = []
    stock_value = 0
    for key, cfg in SUPPLY_CATALOG.items():
        qty = int(inventory.get(key, 0) or 0)
        target = int(targets.get(key, 0) or 0)
        pack = max(1, int(cfg.get("pack", 1) or 1))
        packs_owned = qty / pack
        unit_pack_price = int(cfg.get("price", 0) or 0)
        stock_value += (qty / pack) * unit_pack_price
        ratio = 1.0 if target <= 0 else qty / max(1, target)
        status = "ok" if target <= 0 or ratio >= 1 else ("low" if ratio >= 0.5 else "critical")
        buy_price = max(1, int(unit_pack_price * supply_cost_multiplier(player)))
        row = {
            "key": key, "name": cfg["name"], "qty": qty, "target": target,
            "reserved_per_dispatch": reserved.get(key, 0), "coverage_dispatches": None if reserved.get(key, 0) <= 0 else round(qty / max(1, reserved[key]), 1),
            "status": status, "packs_owned": round(packs_owned, 1),
            "reorder_packs": max(0, ceil(max(0, target - qty) / pack)),
            "buy_price": buy_price,
            "sell_value": int(unit_pack_price * 0.45),
        }
        stock_rows.append(row)
        if status == "critical":
            critical_stock.append(row)

    cap = max(1, inventory_capacity(player, properties))
    used = inventory_used(inventory)
    storage_ratio = used / cap
    logistics_score = 100.0
    if critical_stock:
        logistics_score -= min(55, len(critical_stock) * 8)
    if storage_ratio >= 0.95:
        logistics_score -= 25
    elif storage_ratio >= 0.85:
        logistics_score -= 10
    logistics_score = clamp(logistics_score)

    team_rows = []
    for team in teams:
        score, reasons = _team_health(team, employees, inventory)
        team_rows.append({
            "id": str(team.get("_id") or team.get("id")), "name": team.get("name", "Crew"),
            "score": round(score), "status": team.get("status", "idle"),
            "doctrine": team.get("doctrine", "balanced"), "reasons": reasons,
        })
    crew_score = round(sum(t["score"] for t in team_rows) / len(team_rows), 1) if team_rows else 35.0

    fleet_rows = []
    for vehicle in vehicles:
        score, reasons = _vehicle_health(vehicle, now)
        condition = float(vehicle.get("condition", 100) or 0)
        missing = max(0.0, 100 - condition)
        service_base = max(120, int(float(vehicle.get("price", 0) or 0) * VEHICLE_LIFECYCLE["service_base_pct"] + missing * 8))
        use_fluids = int(inventory.get("service_fluids", 0) or 0) > 0
        use_parts = missing >= 20 and int(inventory.get("vehicle_parts", 0) or 0) > 0
        material_credit = (
            (int(SUPPLY_CATALOG["service_fluids"]["price"]) if use_fluids else 0)
            + (int(SUPPLY_CATALOG["vehicle_parts"]["price"]) if use_parts else 0)
        )
        service_cost = max(60, service_base - int(material_credit * 0.70))
        tire_cost = 0 if int(inventory.get("tire_set", 0) or 0) > 0 else int(SUPPLY_CATALOG["tire_set"]["price"])
        insurance_cost = max(80, int(float(vehicle.get("price", 0) or 0) * VEHICLE_LIFECYCLE["insurance_week_pct"] * 4))
        fleet_rows.append({
            "id": str(vehicle.get("_id") or vehicle.get("id")), "name": vehicle.get("name", "Veículo"),
            "score": round(score), "condition": round(condition, 1),
            "tires_pct": round(float(vehicle.get("tires_pct", 100) or 0), 1),
            "reasons": reasons,
            "costs": {
                "service": service_cost,
                "service_base": service_base,
                "tires": tire_cost,
                "insurance": insurance_cost,
                "inspection": int(VEHICLE_LIFECYCLE["inspection_base"]),
            },
        })
    fleet_score = round(sum(v["score"] for v in fleet_rows) / len(fleet_rows), 1) if fleet_rows else 45.0

    property_rows = []
    for prop in properties:
        condition = clamp(prop.get("condition", 100))
        staff_score = _property_staff_score(prop)
        module_avg = (
            int(prop.get("security_level", 0) or 0)
            + int(prop.get("storage_level", 0) or 0)
            + int(prop.get("operations_level", 0) or 0)
        ) / 9
        score = clamp(condition * 0.55 + staff_score * 0.25 + module_avg * 100 * 0.20)
        module_costs = {}
        for key, cfg in PROPERTY_MODULES.items():
            level = int(prop.get(f"{key}_level", 0) or 0)
            module_costs[key] = None if level >= int(cfg["max_level"]) else int(
                cfg["base_cost"] * (1 + level * 0.75) * float(prop.get("market_multiplier", 1.0) or 1.0)
            )
        property_rows.append({
            "id": str(prop.get("_id") or prop.get("id")), "name": prop.get("name", "Imóvel"),
            "score": round(score), "condition": round(condition), "staff_score": round(staff_score),
            "staff_count": len(prop.get("staff_employee_ids") or []),
            "staff_roles": prop.get("staff_roles") or {},
            "module_costs": module_costs,
        })
    property_score = round(sum(p["score"] for p in property_rows) / len(property_rows), 1) if property_rows else 55.0

    territories = player.get("territories") or {}
    territory_rows = []
    for district, info in territories.items():
        defense = clamp((info or {}).get("defense", 0))
        pressure = clamp((info or {}).get("pressure", 0))
        score = clamp(defense * 0.65 + (100 - pressure) * 0.35)
        tier = int((info or {}).get("tier", 0) or 0)
        territory_rows.append({
            "district": district, "tier": tier,
            "defense": round(defense), "pressure": round(pressure), "score": round(score),
            "rival": (info or {}).get("rival") or {},
            "costs": {
                "defend": max(500, int(TERRITORY_TIERS[tier]["defense_weekly"] * 1.5)) if tier in TERRITORY_TIERS else None,
                "consolidate": int(TERRITORY_TIERS[tier + 1]["cost"]) if tier + 1 in TERRITORY_TIERS else None,
            },
        })
    territory_score = round(sum(t["score"] for t in territory_rows) / len(territory_rows), 1) if territory_rows else 70.0

    heat = clamp(player.get("heat", 0))
    security_score = clamp(100 - heat)
    overall = round(
        finance_score * 0.24
        + crew_score * 0.18
        + fleet_score * 0.16
        + logistics_score * 0.15
        + property_score * 0.12
        + territory_score * 0.10
        + security_score * 0.05
    )
    grade = "SSS" if overall >= 92 else "SS" if overall >= 85 else "S" if overall >= 78 else "A" if overall >= 68 else "B" if overall >= 55 else "C"

    alerts = []
    def add_alert(severity: str, code: str, title: str, detail: str, tab: str, entity_id: str | None = None):
        order = {"critical": 0, "warning": 1, "info": 2}
        alerts.append({
            "severity": severity, "priority": order[severity], "code": code,
            "title": title, "detail": detail, "tab": tab, "entity_id": entity_id,
        })

    for budget in budgets:
        if budget["status"] == "over":
            add_alert("critical", f"budget:{budget['key']}", f"Orçamento {budget['key']} ultrapassado", f"Gasto {budget['spent']:,} € / limite {budget['limit']:,} €.", "centro")
        elif budget["status"] == "warning":
            add_alert("warning", f"budget:{budget['key']}", f"Orçamento {budget['key']} perto do limite", f"Gasto {budget['spent']:,} € / limite {budget['limit']:,} €.", "centro")

    if runway < 1.25:
        add_alert("critical", "cash_runway", "Caixa em risco", f"Runway de apenas {runway:.1f} semanas ao ritmo atual.", "centro")
    elif runway < 3:
        add_alert("warning", "cash_runway", "Runway curto", f"A caixa cobre aproximadamente {runway:.1f} semanas.", "centro")
    if heat >= 85:
        add_alert("critical", "heat", "Exposição extrema", f"Calor em {round(heat)}%. Evita expansão até reduzir exposição.", "centro")
    elif heat >= 70:
        add_alert("warning", "heat", "Exposição elevada", f"Calor em {round(heat)}%. Risco de rusga já é material.", "centro")
    for row in critical_stock[:5]:
        add_alert("critical", f"stock:{row['key']}", f"{row['name']} crítico", f"Stock {row['qty']} / alvo {row['target']}.", "stock", row["key"])
    for row in fleet_rows:
        if row["score"] < 55:
            add_alert("critical", f"vehicle:{row['id']}", f"{row['name']} exige atenção", ", ".join(row["reasons"]) or "prontidão baixa", "frota", row["id"])
        elif row["score"] < 75:
            add_alert("warning", f"vehicle:{row['id']}", f"{row['name']} abaixo do ideal", ", ".join(row["reasons"]) or "prontidão reduzida", "frota", row["id"])
    for row in team_rows:
        if row["score"] < 55:
            add_alert("critical", f"team:{row['id']}", f"{row['name']} não está pronta", ", ".join(row["reasons"]) or "prontidão baixa", "crew", row["id"])
        elif row["score"] < 75:
            add_alert("warning", f"team:{row['id']}", f"{row['name']} pode melhorar", ", ".join(row["reasons"]) or "prontidão reduzida", "crew", row["id"])
    for row in property_rows:
        if row["condition"] < 55:
            add_alert("critical", f"property:{row['id']}", f"{row['name']} degradado", f"Condição em {row['condition']}%.", "imoveis", row["id"])
        elif row["staff_count"] == 0:
            add_alert("warning", f"property_staff:{row['id']}", f"{row['name']} sem pessoal", "A propriedade não tem operacionais destacados.", "imoveis", row["id"])
    for row in territory_rows:
        if row["defense"] < 35 or row["pressure"] > 75:
            add_alert("critical", f"territory:{row['district']}", f"{row['district']} instável", f"Defesa {row['defense']}% · pressão {row['pressure']}%.", "territorios", row["district"])
        elif row["defense"] < 60 or row["pressure"] > 55:
            add_alert("warning", f"territory:{row['district']}", f"{row['district']} sob pressão", f"Defesa {row['defense']}% · pressão {row['pressure']}%.", "territorios", row["district"])

    alerts.sort(key=lambda a: (a["priority"], a["title"]))
    recommendations = []
    for alert in alerts[:5]:
        recommendation = {
            "title": alert["title"],
            "reason": alert["detail"],
            "tab": alert["tab"],
            "entity_id": alert.get("entity_id"),
            "confidence": 0.95 if alert["severity"] == "critical" else 0.82,
        }
        if alert["code"] == "cash_runway":
            recommendation["action"] = "preserve_cash"
        elif alert["code"].startswith("stock:"):
            recommendation["action"] = "restock"
        elif alert["code"].startswith("vehicle:"):
            recommendation["action"] = "maintain_vehicle"
        elif alert["code"].startswith("territory:"):
            recommendation["action"] = "defend_territory"
        elif alert["code"].startswith("team:"):
            recommendation["action"] = "improve_team_readiness"
        else:
            recommendation["action"] = "review"
        recommendations.append(recommendation)

    org_power = round(
        len(employees) * 8 + len(teams) * 18 + len(vehicles) * 6 + len(properties) * 22
        + sum(int((x or {}).get("tier", 0) or 0) for x in territories.values()) * 30
        + sum(int(v or 0) for v in (player.get("departments") or {}).values()) * 12
    )
    org_level = max(1, min(10, 1 + org_power // 110))
    next_level_power = None if org_level >= 10 else org_level * 110
    progression = {
        "level": org_level,
        "power": org_power,
        "next_level_power": next_level_power,
        "progress_pct": 100 if org_level >= 10 else round(max(0, min(100, (org_power - (org_level - 1) * 110) / 110 * 100))),
    }
    dimensions = {
        "power": min(100, round(org_power / 4)),
        "influence": min(100, round(len(territories) * 14 + department_level(player, "comunicacoes") * 12)),
        "logistics": round(logistics_score),
        "security": round((security_score + territory_score) / 2),
        "management": round((finance_score + crew_score + property_score) / 3),
    }

    department_quotes = {}
    for key, cfg in DEPARTMENTS.items():
        level = department_level(player, key)
        department_quotes[key] = {
            "level": level,
            "next_cost": None if level >= int(cfg["max_level"]) else department_cost(key, level + 1),
        }

    return {
        "health": {
            "score": overall, "grade": grade,
            "finance": round(finance_score), "crew": round(crew_score), "fleet": round(fleet_score),
            "logistics": round(logistics_score), "properties": round(property_score),
            "territory": round(territory_score), "security": round(security_score),
        },
        "finance": {
            "cash": cash, "weekly_burn": round(weekly_burn), "runway_weeks": round(runway, 1),
            "income_28d": round(income_28), "expenses_28d": round(expenses_28),
            "reserve_cash": policy["reserve_cash"], "available_above_reserve": max(0, cash - policy["reserve_cash"]),
            "budgets": budgets,
        },
        "organization": {"score": org_power, "level": org_level, "progression": progression, "dimensions": dimensions},
        "quotes": {
            "departments": department_quotes,
            "protection": protection_cost(player, len(employees), len(properties)),
            "territory_claim": int(TERRITORY_TIERS[1]["cost"]),
        },
        "storage": {"used": used, "capacity": cap, "pct": round(storage_ratio * 100, 1), "stock_value": round(stock_value)},
        "stock": stock_rows,
        "teams": team_rows,
        "fleet": fleet_rows,
        "properties": property_rows,
        "territories": territory_rows,
        "alerts": alerts[:12],
        "alert_counts": {
            "critical": sum(a["severity"] == "critical" for a in alerts),
            "warning": sum(a["severity"] == "warning" for a in alerts),
            "info": sum(a["severity"] == "info" for a in alerts),
        },
        "recommendations": recommendations,
        "event": public_event(player.get("organization_event")),
        "policy": policy,
    }


def quote_action(
    *,
    action: str,
    player: dict,
    payload: dict,
    employees: list[dict] | None = None,
    properties: list[dict] | None = None,
    entity: dict | None = None,
) -> dict:
    employees = employees or []
    properties = properties or []
    entity = entity or {}
    cash = int(player.get("clean_money", 0) or 0)
    policy = organization_policy(player)
    cost = 0
    effect = ""
    reasons: list[str] = []

    if action == "supply_buy":
        key = payload.get("item_key")
        cfg = SUPPLY_CATALOG.get(key)
        packs = max(1, min(100, int(payload.get("packs", 1) or 1)))
        if not cfg:
            reasons.append("Consumível inválido.")
        else:
            cost = max(1, int(int(cfg["price"]) * packs * supply_cost_multiplier(player)))
            effect = f"+{int(cfg['pack']) * packs} {cfg['name']}"
            if int(player.get("level", 1) or 1) < int(cfg.get("min_level", 1) or 1):
                reasons.append(f"Requer nível {cfg['min_level']}.")
    elif action == "vehicle_service":
        missing = max(0.0, 100 - float(entity.get("condition", 100) or 0))
        base_cost = max(120, int(float(entity.get("price", 0) or 0) * VEHICLE_LIFECYCLE["service_base_pct"] + missing * 8))
        inv = normalize_inventory(player)
        use_fluids = int(inv.get("service_fluids", 0) or 0) > 0
        use_parts = missing >= 20 and int(inv.get("vehicle_parts", 0) or 0) > 0
        material_credit = (
            (int(SUPPLY_CATALOG["service_fluids"]["price"]) if use_fluids else 0)
            + (int(SUPPLY_CATALOG["vehicle_parts"]["price"]) if use_parts else 0)
        )
        cost = max(60, base_cost - int(material_credit * 0.70))
        materials = [name for flag, name in ((use_fluids, "consumíveis"), (use_parts, "peças")) if flag]
        effect = f"Condição +{min(18, round(missing))}% e revisão reiniciada"
        if materials:
            effect += " · usa " + " + ".join(materials)
    elif action == "vehicle_tires":
        inv = normalize_inventory(player)
        cost = 0 if inv.get("tire_set", 0) > 0 else int(SUPPLY_CATALOG["tire_set"]["price"])
        effect = "Pneus para 100%"
    elif action == "vehicle_insurance":
        cost = max(80, int(float(entity.get("price", 0) or 0) * VEHICLE_LIFECYCLE["insurance_week_pct"] * 4))
        effect = f"Seguro por {VEHICLE_LIFECYCLE['insurance_days']} dias"
    elif action == "vehicle_inspection":
        cost = int(VEHICLE_LIFECYCLE["inspection_base"])
        effect = f"IPO válida por {VEHICLE_LIFECYCLE['inspection_days']} dias"
        if float(entity.get("condition", 100) or 0) < 55 or float(entity.get("tires_pct", 100) or 0) < 35:
            reasons.append("Condição ≥55% e pneus ≥35% necessários.")
    elif action == "weapon_upgrade":
        key = payload.get("upgrade_key")
        cfg = WEAPON_UPGRADES.get(key)
        if not cfg:
            reasons.append("Upgrade inválido.")
        else:
            rank = sum(1 for item in (entity.get("upgrades") or []) if item.get("key") == key)
            if rank >= int(cfg["max_rank"]):
                reasons.append("Upgrade já está no máximo.")
            if int(player.get("level", 1) or 1) < int(cfg["min_level"]):
                reasons.append(f"Requer nível {cfg['min_level']}.")
            cost = int(cfg["cost"] * (1 + rank * 0.65))
            effect = f"{cfg['name']} N{rank + 1}"
    elif action == "property_module":
        key = payload.get("module_key")
        cfg = PROPERTY_MODULES.get(key)
        if not cfg:
            reasons.append("Módulo inválido.")
        else:
            level = int(entity.get(f"{key}_level", 0) or 0)
            if level >= int(cfg["max_level"]):
                reasons.append("Módulo já está no máximo.")
            cost = int(cfg["base_cost"] * (1 + level * 0.75) * float(entity.get("market_multiplier", 1.0) or 1.0))
            effect = f"{cfg['name']} N{level + 1}"
    elif action == "department_upgrade":
        key = payload.get("department_key")
        cfg = DEPARTMENTS.get(key)
        if not cfg:
            reasons.append("Departamento inválido.")
        else:
            level = department_level(player, key)
            if int(player.get("hq", {}).get("level", 1) or 1) < int(cfg["unlock_hq"]):
                reasons.append(f"Requer QG nível {cfg['unlock_hq']}.")
            if level >= int(cfg["max_level"]):
                reasons.append("Departamento já está no máximo.")
            cost = department_cost(key, level + 1)
            effect = f"{cfg['name']} N{level + 1}"
    elif action == "territory_claim":
        cost = int(TERRITORY_TIERS[1]["cost"])
        effect = "Presença territorial N1"
        if int(player.get("level", 1) or 1) < 5:
            reasons.append("Requer nível 5.")
    elif action == "territory_consolidate":
        info = (player.get("territories") or {}).get(payload.get("district")) or {}
        tier = int(info.get("tier", 0) or 0)
        if tier <= 0:
            reasons.append("Território não controlado.")
        elif tier >= max(TERRITORY_TIERS):
            reasons.append("Território no máximo.")
        else:
            cost = int(TERRITORY_TIERS[tier + 1]["cost"])
            effect = f"Território N{tier + 1}"
    elif action == "territory_defend":
        info = (player.get("territories") or {}).get(payload.get("district")) or {}
        tier = int(info.get("tier", 0) or 0)
        if tier <= 0:
            reasons.append("Território não controlado.")
        else:
            cost = max(500, int(TERRITORY_TIERS[tier]["defense_weekly"] * 1.5))
            effect = "Defesa 100% e pressão -22"
    elif action == "protection":
        cost = protection_cost(player, len(employees), len(properties))
        effect = "Proteção institucional por 30 dias"
        if cost <= 0:
            reasons.append("Requer nível 5.")
    elif action == "prestige":
        key = payload.get("item_key")
        cfg = PRESTIGE_CATALOG.get(key)
        if not cfg:
            reasons.append("Investimento inválido.")
        else:
            cost = int(cfg["cost"])
            effect = cfg["name"]
            if key in set(player.get("prestige_items") or []):
                reasons.append("Já adquirido.")
            if int(player.get("level", 1) or 1) < int(cfg.get("unlock_level", 1) or 1):
                reasons.append(f"Requer nível {cfg['unlock_level']}.")
    else:
        reasons.append("Ação não suportada.")

    after = cash - cost
    reserve_break = cost > 0 and after < int(policy["reserve_cash"])
    single_spend_limit = max(1, int(cash * float(policy["max_single_spend_pct"])))
    concentration_risk = cost > single_spend_limit and cost > 0
    if cash < cost:
        reasons.append("Dinheiro limpo insuficiente.")

    return {
        "action": action, "cost": max(0, cost), "cash_before": cash, "cash_after": after,
        "effect": effect, "eligible": not reasons, "blocking_reasons": reasons,
        "reserve_cash": int(policy["reserve_cash"]), "breaks_reserve": reserve_break,
        "concentration_risk": concentration_risk,
        "warnings": [
            *([f"Ficas abaixo da reserva de {policy['reserve_cash']:,} €."] if reserve_break else []),
            *([f"Esta decisão usa mais de {round(policy['max_single_spend_pct'] * 100)}% da caixa atual."] if concentration_risk else []),
        ],
    }
