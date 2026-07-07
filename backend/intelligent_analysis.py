"""
Análise inteligente extrema para Imóveis, Frota, RH, Equipas e Armamento.

Cada `analyze_*_intelligence` lê o estado já carregado (mesmo dict devolvido por
GET /state) e o catálogo (GET /catalog) — não faz queries extra à base de dados —
e devolve recomendações acionáveis (o que reparar/comprar/treinar a seguir e
porquê), reaproveitando sempre as mesmas fórmulas de custo/bónus já usadas nos
endpoints de compra/reparação reais, nunca valores aproximados à parte.
"""

from game_data import (
    PROPERTY_TYPES, PROPERTY_MAX_LEVEL, VEHICLE_MODELS, SPECIALIZATIONS, TALENTS,
    TEAM_SPECS, TRAINING_COURSES, WEAPON_MODELS, WEAPON_CATEGORIES, RARITIES,
    RANKS, RANK_REQ_LEVEL, EMP_LEVEL_XP, TEAM_MAX_MEMBERS, WEAPON_REPAIR_COST_MULTIPLIER,
    PROPERTY_MAINTENANCE_PCT_PER_DAY,
)
from engine import (
    property_active, property_condition_factor, now_utc, parse_dt,
    weapon_combat_score, weapon_compatibility_factor,
)


# ============ ANÁLISE DE IMÓVEIS ============

async def analyze_properties_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
    """Análise completa de imóveis com recomendações de upgrade e expansão."""
    now = now_utc()
    properties = state.get("properties", [])
    player = state.get("player", {})

    analysis = {
        "properties_summary": {
            "total": len(properties),
            "total_level": sum(p.get("level", 1) for p in properties),
            "avg_condition": round(sum(p.get("condition", 100) for p in properties) / max(1, len(properties))),
            "total_daily_maintenance": 0,
        },
        "property_analysis": [],
        "upgrade_recommendations": [],
        "expand_recommendations": [],
    }

    for prop in properties:
        pt = catalog.get("property_types", {}).get(prop.get("type_key"))
        if not pt:
            continue

        level = prop.get("level", 1)
        condition = prop.get("condition", 100)
        is_active = property_active(prop, now)
        condition_mult = property_condition_factor(prop)
        max_level = catalog.get("property_max_level", PROPERTY_MAX_LEVEL)

        upgrade_cost = round(pt.get("price", 0) * 0.6 * (level + 1))
        monthly_benefit = pt.get("dirty_per_h", 0) * 24 * 30 * condition_mult
        roi_months = upgrade_cost / max(1, monthly_benefit) if monthly_benefit > 0 else None
        daily_maintenance = round(pt.get("price", 0) * level * PROPERTY_MAINTENANCE_PCT_PER_DAY)
        analysis["properties_summary"]["total_daily_maintenance"] += daily_maintenance

        analysis["property_analysis"].append({
            "id": prop.get("id"),
            "name": prop.get("name") or f"{pt.get('name')} — {prop.get('district')}",
            "type": pt.get("name"),
            "level": level,
            "condition": round(condition),
            "is_active": is_active,
            "monthly_benefit": round(monthly_benefit),
            "daily_maintenance": daily_maintenance,
            "upgrade_cost": upgrade_cost,
            "roi_months": round(roi_months, 1) if roi_months is not None else None,
            "total_generated": prop.get("total_dirty_generated", 0),
            "needs_repair": condition < 80,
            "can_upgrade": level < max_level,
        })

        if level < max_level and player.get("clean_money", 0) >= upgrade_cost and roi_months is not None:
            analysis["upgrade_recommendations"].append({
                "property_id": prop.get("id"),
                "property_name": prop.get("name") or f"{pt.get('name')} — {prop.get('district')}",
                "upgrade_cost": upgrade_cost,
                "roi_months": round(roi_months, 1),
                "new_level": level + 1,
                "priority_score": round(max(0.0, 100 - roi_months), 1),
            })

    owned_types = {p.get("type_key") for p in properties}
    for type_key, pt in catalog.get("property_types", {}).items():
        if type_key in owned_types:
            continue
        benefit = pt.get("dirty_per_h", 0) * 24 * 30
        score = benefit / max(1, pt.get("price", 1))
        analysis["expand_recommendations"].append({
            "type_key": type_key,
            "type_name": pt.get("name"),
            "description": pt.get("desc"),
            "price": pt.get("price"),
            "monthly_benefit": round(benefit),
            "efficiency_score": round(score, 4),
            "is_locked": player.get("level", 0) < pt.get("min_level", 0),
        })

    analysis["upgrade_recommendations"].sort(key=lambda x: x["roi_months"])
    analysis["expand_recommendations"].sort(key=lambda x: x["efficiency_score"], reverse=True)
    return analysis


# ============ ANÁLISE DE FROTA ============

async def analyze_fleet_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
    """Análise completa de frota — condição, combustível e próxima compra."""
    vehicles = state.get("vehicles", [])
    player = state.get("player", {})
    fuel_prices = state.get("fuel_prices", {})
    now = now_utc()

    analysis = {
        "fleet_summary": {
            "total_vehicles": len(vehicles),
            "avg_condition": round(sum(v.get("condition", 100) for v in vehicles) / max(1, len(vehicles))),
            "total_repair_cost": 0,
            "total_refuel_cost": 0,
        },
        "vehicle_analysis": [],
        "maintenance_recommendations": [],
        "fuel_recommendations": [],
        "next_vehicle_recommendation": None,
        "fleet_optimization": {},
    }

    for vehicle in vehicles:
        vm = VEHICLE_MODELS.get(vehicle.get("model_key"), {})
        if not vm:
            continue

        condition = vehicle.get("condition", 100)
        fuel = vehicle.get("fuel_l", 0)
        tank = vehicle.get("tank_l") or vm.get("tank_l", 0)
        fuel_pct = (fuel / tank * 100) if tank > 0 else 0
        price = vehicle.get("price") or vm.get("price", 0)

        repair_cost = max(50, round((100 - condition) * price * 0.002))
        refuel_cost = round((tank - fuel) * fuel_prices.get(vehicle.get("fuel_type") or vm.get("fuel_type", "gasolina"), 1.5))
        is_refueling = bool(vehicle.get("refueling_until")) and parse_dt(vehicle["refueling_until"]) > now

        vehicle_data = {
            "id": vehicle.get("id"),
            "name": vehicle.get("name") or vm.get("name"),
            "model_key": vehicle.get("model_key"),
            "condition": round(condition),
            "fuel_percentage": round(fuel_pct),
            "repair_cost": repair_cost,
            "refuel_cost": refuel_cost,
            "needs_repair": condition < 60,
            "needs_fuel": fuel_pct < 50,
            "is_refueling": is_refueling,
            "missions_since_repair": vehicle.get("missions_since_repair", 0),
            "success_rate": round(100 * vehicle.get("missions_success", 0) / vehicle.get("missions_done", 1)) if vehicle.get("missions_done") else None,
        }
        analysis["vehicle_analysis"].append(vehicle_data)

        if condition < 60:
            analysis["maintenance_recommendations"].append({
                "vehicle_id": vehicle.get("id"),
                "vehicle_name": vehicle_data["name"],
                "current_condition": round(condition),
                "repair_cost": repair_cost,
                "priority_score": round(max(1, 100 - condition)),
            })
            analysis["fleet_summary"]["total_repair_cost"] += repair_cost

        if fuel_pct < 50 and not is_refueling:
            analysis["fuel_recommendations"].append({
                "vehicle_id": vehicle.get("id"),
                "vehicle_name": vehicle_data["name"],
                "fuel_percentage": round(fuel_pct),
                "refuel_cost": refuel_cost,
                "priority_score": round(100 - fuel_pct),
            })
            analysis["fleet_summary"]["total_refuel_cost"] += refuel_cost

    owned_models = {v.get("model_key") for v in vehicles}
    best_next = None
    best_score = 0
    for model_key, vm in VEHICLE_MODELS.items():
        if model_key in owned_models or player.get("level", 0) < vm.get("min_level", 0):
            continue
        score = (vm.get("speed", 0) / max(0.1, vm.get("cons", 1))) * (vm.get("tank_l", 0) / max(1, vm.get("price", 1)))
        if score > best_score:
            best_score = score
            best_next = {
                "model_key": model_key, "name": vm.get("name"), "price": vm.get("price"),
                "speed": vm.get("speed"), "tank_l": vm.get("tank_l"), "consumption": vm.get("cons"),
                "seats": vm.get("seats"), "best_for": vm.get("best_for", []),
                "efficiency_score": round(score, 4),
            }
    analysis["next_vehicle_recommendation"] = best_next

    analysis["fleet_optimization"] = {
        "avg_condition": analysis["fleet_summary"]["avg_condition"],
        "needs_maintenance": len(analysis["maintenance_recommendations"]),
        "needs_fuel": len(analysis["fuel_recommendations"]),
        "needs_expansion": len(vehicles) < 3,
        "recommendation": "Expandir frota" if len(vehicles) < 3 else "Manter e otimizar",
    }
    return analysis


# ============ ANÁLISE DE RH ============

async def analyze_hr_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
    """Análise completa de RH — valor, risco, treino e recrutamento."""
    employees = state.get("employees", [])
    rarities = catalog.get("rarities", RARITIES)
    ranks = catalog.get("ranks", RANKS)
    rank_req_level = catalog.get("rank_req_level", RANK_REQ_LEVEL)
    emp_level_xp = catalog.get("emp_level_xp", EMP_LEVEL_XP)

    analysis = {
        "hr_summary": {
            "total_employees": len(employees),
            "total_payroll_per_cycle": 0,
            "avg_level": 0,
            "avg_fatigue": 0,
            "avg_morale": 0,
            "high_value_count": 0,
            "at_risk_count": 0,
        },
        "employee_analysis": [],
        "training_recommendations": [],
        "recruitment_needs": [],
        "talent_potential": [],
    }

    if not employees:
        return analysis

    total_level = total_fatigue = total_morale = high_value = at_risk = 0

    for emp in employees:
        spec = SPECIALIZATIONS.get(emp.get("role_key"), {})
        rarity = emp.get("rarity", "comum")
        rar = rarities.get(rarity, {"mult": 1.0, "max_level": 5})
        level = emp.get("level", 0)
        talents = emp.get("talents", [])
        fatigue = emp.get("fatigue", 0)
        morale = emp.get("morale", 70)
        xp = emp.get("xp", 0)

        max_level = rar.get("max_level", 5)
        if level >= max_level or level >= len(emp_level_xp):
            xp_pct = 100
        else:
            prev_xp = emp_level_xp[level - 1] if level >= 1 else 0
            next_xp = emp_level_xp[level] if level < len(emp_level_xp) else prev_xp
            xp_pct = round(100 * (xp - prev_xp) / max(1, next_xp - prev_xp))

        rank_idx = ranks.index(emp["rank"]) if emp.get("rank") in ranks else 0
        next_req = rank_req_level[rank_idx + 1] if rank_idx + 1 < len(rank_req_level) else None
        levels_to_next_rank = max(0, next_req - level) if next_req is not None else 0

        value_score = rar.get("mult", 1.0) * (1 + level * 0.1) * (1 + len(talents) * 0.05) * 100
        total_level += level
        total_fatigue += fatigue
        total_morale += morale
        if value_score > 150:
            high_value += 1
        if fatigue > 85 or morale < 40:
            at_risk += 1

        analysis["employee_analysis"].append({
            "id": emp.get("id"),
            "name": emp.get("name"),
            "role": spec.get("name"),
            "rarity": rarity,
            "level": level,
            "xp_progress_pct": xp_pct,
            "fatigue": round(fatigue),
            "morale": round(morale),
            "talents": talents,
            "value_score": round(value_score),
            "status": "at_risk" if (fatigue > 85 or morale < 40) else "tired" if fatigue > 50 else "healthy",
            "is_top_rank": next_req is None,
            "levels_to_next_rank": levels_to_next_rank,
        })

        if next_req is not None and xp_pct >= 50:
            best_course, best_score = None, 0
            for course_key, course in TRAINING_COURSES.items():
                attr_match = 1 if course.get("attr") in emp.get("attrs", {}) else 0.5
                spec_match = 1 if course.get("spec") == emp.get("spec") else (0.75 if course.get("spec") is None else 0.5)
                score = attr_match * spec_match
                if score > best_score:
                    best_score, best_course = score, course_key
            if best_course:
                analysis["training_recommendations"].append({
                    "employee_id": emp.get("id"),
                    "employee_name": emp.get("name"),
                    "course_key": best_course,
                    "course_name": TRAINING_COURSES[best_course].get("name"),
                    "cost": TRAINING_COURSES[best_course].get("cost"),
                    "duration_s": TRAINING_COURSES[best_course].get("duration_s"),
                    "priority_score": round(best_score * 100),
                })

    n = len(employees)
    analysis["hr_summary"].update({
        "total_payroll_per_cycle": sum(e.get("salary", 0) for e in employees),
        "avg_level": round(total_level / n, 1),
        "avg_fatigue": round(total_fatigue / n),
        "avg_morale": round(total_morale / n),
        "high_value_count": high_value,
        "at_risk_count": at_risk,
    })

    spec_counts = {}
    for emp in employees:
        spec_key = SPECIALIZATIONS.get(emp.get("role_key"), {}).get("spec", "suporte")
        spec_counts[spec_key] = spec_counts.get(spec_key, 0) + 1
    for spec_key in TEAM_SPECS:
        count = spec_counts.get(spec_key, 0)
        needed = max(0, 2 - count)
        if needed > 0:
            analysis["recruitment_needs"].append({
                "spec": spec_key, "spec_name": TEAM_SPECS[spec_key].get("name"),
                "current_count": count, "needed": needed, "priority_score": needed * 50,
            })

    for emp in employees:
        if emp.get("rarity") in ("elite", "lendario"):
            available = len([t for t, tv in TALENTS.items() if emp.get("role_key") in tv.get("roles", [])])
            analysis["talent_potential"].append({
                "id": emp.get("id"), "name": emp.get("name"), "rarity": emp.get("rarity"),
                "talents": emp.get("talents", []),
                "talents_available": max(0, available - len(emp.get("talents", []))),
            })

    return analysis


# ============ ANÁLISE DE EQUIPAS ============

async def analyze_teams_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
    """Análise completa de equipas — composição, equilíbrio e alinhamento."""
    teams = state.get("teams", [])
    employees = state.get("employees", [])
    opportunities = state.get("opportunities", [])
    max_members = catalog.get("team_max_members", TEAM_MAX_MEMBERS)

    analysis = {
        "teams_summary": {
            "total_teams": len(teams),
            "teams_by_spec": {},
            "avg_team_size": 0,
            "teams_idle": sum(1 for t in teams if t.get("status") == "idle"),
            "teams_busy": sum(1 for t in teams if t.get("status") != "idle"),
        },
        "team_analysis": [],
        "composition_recommendations": [],
        "specialization_balance": [],
    }

    teams_by_spec = {}
    for team in teams:
        teams_by_spec[team.get("spec")] = teams_by_spec.get(team.get("spec"), 0) + 1
    analysis["teams_summary"]["teams_by_spec"] = teams_by_spec

    emps_by_team = {}
    for emp in employees:
        if emp.get("team_id"):
            emps_by_team.setdefault(emp["team_id"], []).append(emp)

    for team in teams:
        team_emps = emps_by_team.get(team.get("id"), [])
        spec = team.get("spec")
        spec_roles = {rk for rk, rv in SPECIALIZATIONS.items() if rv.get("spec") == spec}
        matching_roles = sum(1 for e in team_emps if e.get("role_key") in spec_roles)

        comp_score = (matching_roles / max(1, len(team_emps))) * 40 if team_emps else 0
        team_talents = set()
        for e in team_emps:
            team_talents.update(e.get("talents", []))
        comp_score += min(30, len(team_talents) * 5)
        avg_level = sum(e.get("level", 0) for e in team_emps) / max(1, len(team_emps)) if team_emps else 0
        comp_score += min(30, avg_level * 3)

        analysis["team_analysis"].append({
            "id": team.get("id"), "name": team.get("name"), "spec": spec, "status": team.get("status"),
            "members": len(team_emps), "max_members": max_members,
            "composition_score": round(comp_score), "missions_done": team.get("missions_done", 0),
            "avg_level": round(avg_level, 1), "has_vehicle": bool(team.get("vehicle_id")),
        })

        if len(team_emps) < max_members:
            recommended_roles = [r for r in spec_roles][:max(0, min(3, max_members - len(team_emps)))]
            if recommended_roles:
                analysis["composition_recommendations"].append({
                    "team_id": team.get("id"), "team_name": team.get("name"),
                    "current_size": len(team_emps), "recommended_roles": recommended_roles,
                    "priority_score": (max_members - len(team_emps)) * 20,
                })

    for spec_key in TEAM_SPECS:
        count = teams_by_spec.get(spec_key, 0)
        opps_for_spec = sum(1 for o in opportunities if o.get("status") == "active" and o.get("category") == spec_key)
        avg_opp_per_team = opps_for_spec / count if count > 0 else opps_for_spec
        analysis["specialization_balance"].append({
            "spec": spec_key, "teams": count, "active_opportunities": opps_for_spec,
            "avg_opp_per_team": round(avg_opp_per_team, 2),
            "balance_status": "overextended" if count and avg_opp_per_team > 3 else "idle" if count == 0 and opps_for_spec > 0 else "balanced",
        })

    analysis["teams_summary"]["avg_team_size"] = round(
        sum(len(emps_by_team.get(t.get("id"), [])) for t in teams) / max(1, len(teams)), 1
    )
    return analysis


# ============ ANÁLISE DE ARMAMENTO ============

async def analyze_weapons_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
    """Análise completa de armamento — condição, compatibilidade, cobertura de
    categorias face às especializações do efetivo, e próxima compra."""
    weapons = state.get("weapons", [])
    employees = state.get("employees", [])
    player = state.get("player", {})
    emp_by_id = {e.get("id"): e for e in employees}

    analysis = {
        "weapons_summary": {
            "total": len(weapons),
            "equipped": sum(1 for w in weapons if w.get("employee_id")),
            "avg_condition": round(sum(w.get("condition", 100) for w in weapons) / max(1, len(weapons))),
            "loud_equipped": 0,
            "total_repair_cost": 0,
        },
        "weapon_analysis": [],
        "repair_recommendations": [],
        "unequipped_weapons": [],
        "idle_employees_without_weapon": [],
        "category_coverage": [],
        "next_weapon_recommendation": None,
    }

    for weapon in weapons:
        model = WEAPON_MODELS.get(weapon.get("model_key"))
        if not model:
            continue
        condition = weapon.get("condition", 100)
        emp = emp_by_id.get(weapon.get("employee_id")) if weapon.get("employee_id") else None
        repair_cost = max(20, round((100 - condition) * model.get("maintenance_cost", 100) * WEAPON_REPAIR_COST_MULTIPLIER / 100))
        compat = round(weapon_compatibility_factor(emp, model) * 100) if emp else None
        proficiency = emp.get("weapon_proficiency", {}).get(model["category"], 0) if emp else None
        loud_and_equipped = bool(model.get("loud")) and emp is not None and emp.get("status") != "idle"
        if loud_and_equipped:
            analysis["weapons_summary"]["loud_equipped"] += 1

        analysis["weapon_analysis"].append({
            "id": weapon.get("id"), "name": weapon.get("name"), "model_key": weapon.get("model_key"),
            "category": model.get("category"), "condition": round(condition),
            "equipped": emp is not None, "employee_name": emp.get("name") if emp else None,
            "compatibility_pct": compat, "proficiency": round(proficiency) if proficiency is not None else None,
            "loud": bool(model.get("loud")), "needs_repair": condition < 60,
        })

        if condition < 60:
            analysis["repair_recommendations"].append({
                "weapon_id": weapon.get("id"), "weapon_name": weapon.get("name"),
                "current_condition": round(condition), "repair_cost": repair_cost,
                "priority_score": round(max(1, 100 - condition)),
            })
            analysis["weapons_summary"]["total_repair_cost"] += repair_cost

        if not weapon.get("employee_id"):
            analysis["unequipped_weapons"].append({
                "weapon_id": weapon.get("id"), "weapon_name": weapon.get("name"),
                "category": model.get("category"), "condition": round(condition),
            })

    idle_unarmed = [e for e in employees if e.get("status") == "idle" and not e.get("weapon_id")]
    analysis["idle_employees_without_weapon"] = [
        {"employee_id": e.get("id"), "employee_name": e.get("name"), "spec": e.get("spec")}
        for e in idle_unarmed
    ]

    spec_counts = {}
    for e in employees:
        spec_counts[e.get("spec")] = spec_counts.get(e.get("spec"), 0) + 1
    category_equipped = {}
    for weapon in weapons:
        model = WEAPON_MODELS.get(weapon.get("model_key"))
        if model and weapon.get("employee_id"):
            category_equipped[model["category"]] = category_equipped.get(model["category"], 0) + 1
    for category, cat_info in WEAPON_CATEGORIES.items():
        needed = spec_counts.get(category, 0)
        equipped = category_equipped.get(category, 0)
        analysis["category_coverage"].append({
            "category": category, "category_name": cat_info.get("name"),
            "employees_in_spec": needed, "weapons_equipped": equipped,
            "gap": max(0, needed - equipped),
        })
    analysis["category_coverage"].sort(key=lambda x: x["gap"], reverse=True)

    owned_models = {w.get("model_key") for w in weapons}
    gap_categories = [c["category"] for c in analysis["category_coverage"] if c["gap"] > 0] or list(WEAPON_CATEGORIES.keys())
    best_next, best_score = None, -1
    for model_key, model in WEAPON_MODELS.items():
        if model_key in owned_models or player.get("level", 0) < model.get("min_level", 0):
            continue
        score = max(weapon_combat_score(model, cat) for cat in gap_categories) if gap_categories else 0
        value = score / max(1, model.get("price", 1) / 1000)
        if value > best_score:
            best_score = value
            best_next = {
                "model_key": model_key, "name": model.get("name"), "price": model.get("price"),
                "category": model.get("category"), "best_for": model.get("best_for", []),
                "loud": bool(model.get("loud")), "efficiency_score": round(value, 4),
            }
    analysis["next_weapon_recommendation"] = best_next

    analysis["repair_recommendations"].sort(key=lambda x: x["priority_score"], reverse=True)
    return analysis
