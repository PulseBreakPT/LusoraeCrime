"""
Análise Inteligente para Imóveis, Frota, RH e Equipa
Lógica extrema com IA multimodal
"""

from game_data import (PROPERTY_TYPES, PROPERTY_MAX_LEVEL, VEHICLE_MODELS, SPECIALIZATIONS,
                       TALENTS, TEAM_SPECS, CATEGORY_ATTRS, TRAINING_COURSES)
from engine import property_active, property_condition_factor, now_utc, parse_dt


# ============ ANÁLISE DE IMÓVEIS ============

async def analyze_properties_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
  """Análise completa de imóveis com recomendações de upgrade e expandir"""
  now = now_utc()
  properties = state.get("properties", [])
  player = state.get("player", {})

  analysis = {
    "properties_summary": {
      "total": len(properties),
      "total_level": sum(p.get("level", 1) for p in properties),
      "total_condition": sum(p.get("condition", 100) for p in properties) / max(1, len(properties)),
      "total_monthly_cost": sum(
        PROPERTY_TYPES.get(p.get("type_key"), {}).get("maintenance_cost", 0) * p.get("level", 1)
        for p in properties
      ),
    },
    "property_analysis": [],
    "upgrade_recommendations": [],
    "expand_recommendations": []
  }

  # Analisar cada propriedade
  for prop in properties:
    pt = catalog.get("property_types", {}).get(prop.get("type_key"))
    if not pt:
      continue

    level = prop.get("level", 1)
    condition = prop.get("condition", 100)
    is_active = property_active(prop, now)
    condition_mult = property_condition_factor(prop)

    # Calcular ROI (return on investment)
    upgrade_cost = int(pt.get("price", 0) * 0.6 * (level + 1))
    monthly_benefit = pt.get("dirty_per_h", 0) * 24 * 30 * condition_mult * (level + 1)
    roi_months = upgrade_cost / max(1, monthly_benefit) if monthly_benefit > 0 else 999

    analysis["property_analysis"].append({
      "id": prop.get("id"),
      "name": prop.get("name", f"{pt.get('name')} — {prop.get('district')}"),
      "type": pt.get("name"),
      "level": level,
      "condition": round(condition),
      "is_active": is_active,
      "monthly_benefit": int(monthly_benefit),
      "upgrade_cost": upgrade_cost,
      "roi_months": round(roi_months, 1),
      "total_generated": prop.get("total_dirty_generated", 0),
      "needs_repair": condition < 80,
      "can_upgrade": level < catalog.get("property_max_level", 3)
    })

    # Recomendação de upgrade
    if level < catalog.get("property_max_level", 3) and player.get("clean_money", 0) >= upgrade_cost:
      priority = 100 - roi_months  # Maior prioridade = menor ROI
      analysis["upgrade_recommendations"].append({
        "property_id": prop.get("id"),
        "property_name": prop.get("name", f"{pt.get('name')} — {prop.get('district')}"),
        "upgrade_cost": upgrade_cost,
        "roi_months": round(roi_months, 1),
        "new_level": level + 1,
        "priority_score": round(priority, 1)
      })

  # Recomendações de expansão (novos imóveis)
  owned_types = {p.get("type_key") for p in properties}
  for type_key, pt in catalog.get("property_types", {}).items():
    if type_key not in owned_types:
      benefit = pt.get("dirty_per_h", 0) * 24 * 30  # Benefício mensal
      score = benefit / max(1, pt.get("price", 1))  # Efficiency score

      analysis["expand_recommendations"].append({
        "type_key": type_key,
        "type_name": pt.get("name"),
        "description": pt.get("desc"),
        "price": pt.get("price"),
        "monthly_benefit": int(benefit),
        "efficiency_score": round(score, 4),
        "is_locked": player.get("level", 0) < pt.get("min_level", 0)
      })

  # Ordenar recomendações
  analysis["upgrade_recommendations"].sort(key=lambda x: x["roi_months"])
  analysis["expand_recommendations"].sort(key=lambda x: x["efficiency_score"], reverse=True)

  return analysis


# ============ ANÁLISE DE FROTA ============

async def analyze_fleet_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
  """Análise completa de frota com gestão inteligente de combustível e manutenção"""
  vehicles = state.get("vehicles", [])
  player = state.get("player", {})
  fuel_prices = state.get("fuel_prices", {})
  now = now_utc()

  analysis = {
    "fleet_summary": {
      "total_vehicles": len(vehicles),
      "total_condition_avg": sum(v.get("condition", 100) for v in vehicles) / max(1, len(vehicles)),
      "total_fuel": sum(v.get("fuel_l", 0) for v in vehicles),
      "total_fuel_capacity": sum(
        VEHICLE_MODELS.get(v.get("model_key"), {}).get("tank_l", 0) for v in vehicles
      ),
      "monthly_maintenance_cost": 0,
      "monthly_fuel_consumption": 0,
    },
    "vehicle_analysis": [],
    "maintenance_recommendations": [],
    "fuel_recommendations": [],
    "next_vehicle_recommendation": None,
    "fleet_optimization": {}
  }

  # Analisar cada veículo
  for vehicle in vehicles:
    vm = VEHICLE_MODELS.get(vehicle.get("model_key"), {})
    if not vm:
      continue

    condition = vehicle.get("condition", 100)
    fuel = vehicle.get("fuel_l", 0)
    tank = vm.get("tank_l", 0)
    fuel_pct = (fuel / tank * 100) if tank > 0 else 0

    # Custos mensais
    maintenance_cost = int(tank * vm.get("cons", 0) * 0.5) * (1 - condition / 200)  # Approximation
    fuel_cost = fuel * fuel_prices.get(vm.get("fuel_type", "gasolina"), 1.5)

    vehicle_data = {
      "id": vehicle.get("id"),
      "name": vm.get("name"),
      "model_key": vehicle.get("model_key"),
      "condition": round(condition),
      "fuel": round(fuel, 1),
      "fuel_capacity": tank,
      "fuel_percentage": round(fuel_pct),
      "fuel_cost": int(fuel_cost),
      "monthly_maintenance": int(maintenance_cost),
      "needs_repair": condition < 40,
      "needs_fuel": fuel_pct < 30,
      "is_refueling": vehicle.get("refueling_until") and parse_dt(vehicle["refueling_until"]) > now,
      "is_repairing": vehicle.get("repair_until") and parse_dt(vehicle["repair_until"]) > now,
      "consumption_l_per_100km": vm.get("cons", 0),
      "range_km": (fuel / vm.get("cons", 0.1) * 100) if vm.get("cons") > 0 else 0
    }

    analysis["vehicle_analysis"].append(vehicle_data)

    # Recomendações de manutenção
    if condition < 60 and not vehicle_data["is_repairing"]:
      priority = max(1, 100 - condition)  # Maior prioridade = pior condição
      analysis["maintenance_recommendations"].append({
        "vehicle_id": vehicle.get("id"),
        "vehicle_name": vm.get("name"),
        "current_condition": round(condition),
        "repair_cost": 5000,  # Approximation
        "priority_score": priority
      })

    # Recomendações de combustível
    if fuel_pct < 50 and not vehicle_data["is_refueling"]:
      priority = 100 - fuel_pct
      analysis["fuel_recommendations"].append({
        "vehicle_id": vehicle.get("id"),
        "vehicle_name": vm.get("name"),
        "fuel_percentage": round(fuel_pct),
        "fuel_needed_l": tank - fuel,
        "fuel_cost": int((tank - fuel) * fuel_prices.get(vm.get("fuel_type", "gasolina"), 1.5)),
        "priority_score": priority
      })

    analysis["fleet_summary"]["monthly_maintenance_cost"] += int(maintenance_cost)
    analysis["fleet_summary"]["monthly_fuel_consumption"] += tank * vm.get("cons", 0)

  # Recomendação do próximo veículo a comprar
  owned_models = {v.get("model_key") for v in vehicles}
  best_next = None
  best_score = 0

  for model_key, vm in VEHICLE_MODELS.items():
    if model_key not in owned_models and player.get("level", 0) >= vm.get("min_level", 0):
      score = (vm.get("speed", 0) / vm.get("cons", 1)) * (vm.get("tank_l", 0) / vm.get("price", 1))
      if score > best_score:
        best_score = score
        best_next = {
          "model_key": model_key,
          "name": vm.get("name"),
          "price": vm.get("price"),
          "speed": vm.get("speed"),
          "tank_l": vm.get("tank_l"),
          "consumption": vm.get("cons"),
          "seats": vm.get("seats"),
          "best_for": vm.get("best_for", []),
          "efficiency_score": round(score, 4)
        }

  analysis["next_vehicle_recommendation"] = best_next

  # Otimização de frota
  analysis["fleet_optimization"] = {
    "total_condition_avg": round(analysis["fleet_summary"]["total_condition_avg"]),
    "needs_maintenance": len(analysis["maintenance_recommendations"]),
    "needs_fuel": len(analysis["fuel_recommendations"]),
    "monthly_operating_cost": analysis["fleet_summary"]["monthly_maintenance_cost"] + int(sum(
      v.get("fuel_cost", 0) for v in analysis["vehicle_analysis"]
    )),
    "needs_expansion": len(vehicles) < 3,  # Recomendação: ter pelo menos 3 veículos
    "recommendation": "Expandir frota" if len(vehicles) < 3 else "Manter e otimizar"
  }

  return analysis


# ============ ANÁLISE DE RH ============

async def analyze_hr_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
  """Análise completa de RH com gestão de talentos e treinamento"""
  employees = state.get("employees", [])
  player = state.get("player", {})
  now = now_utc()

  analysis = {
    "hr_summary": {
      "total_employees": len(employees),
      "total_payroll_monthly": 0,
      "avg_level": 0,
      "avg_fatigue": 0,
      "avg_health": 0,
      "high_value_count": 0,
      "at_risk_count": 0
    },
    "employee_analysis": [],
    "training_recommendations": [],
    "recruitment_needs": [],
    "talent_potential": []
  }

  if not employees:
    return analysis

  total_payroll = 0
  total_level = 0
  total_fatigue = 0
  total_health = 0
  high_value = 0
  at_risk = 0

  # Analisar cada funcionário
  for emp in employees:
    spec = SPECIALIZATIONS.get(emp.get("role_key"), {})
    rarity = emp.get("rarity", "comum")
    level = emp.get("level", 0)
    salary = spec.get("salary", 0)
    talents = emp.get("talents", [])
    fatigue = emp.get("fatigue", 0)
    health = emp.get("health", 100)
    xp = emp.get("xp", 0)
    xp_next = xp / max(1, emp.get("xp_to_level", 100))

    monthly_cost = salary * 30

    # Calcular valor/ROI do funcionário
    rarity_mult = {"comum": 1.0, "raro": 1.5, "elite": 2.5, "lendario": 4.0}.get(rarity, 1.0)
    level_mult = 1.0 + (level * 0.1)
    talent_mult = 1.0 + (len(talents) * 0.05)
    value_score = rarity_mult * level_mult * talent_mult * 100

    total_payroll += monthly_cost
    total_level += level
    total_fatigue += fatigue
    total_health += health

    if value_score > 150:
      high_value += 1
    if fatigue > 85 or health < 50:
      at_risk += 1

    emp_data = {
      "id": emp.get("id"),
      "name": emp.get("name"),
      "role": spec.get("name"),
      "rarity": rarity,
      "level": level,
      "xp_progress": round(xp_next * 100),
      "monthly_salary": monthly_cost,
      "fatigue": fatigue,
      "health": health,
      "talents": talents,
      "value_score": round(value_score),
      "status": "at_risk" if (fatigue > 85 or health < 50) else "healthy" if fatigue < 50 else "tired",
      "months_to_next_rank": 3  # Approximation
    }

    analysis["employee_analysis"].append(emp_data)

    # Recomendações de treinamento
    if level < 8 and xp_next > 0.5:  # Está perto de subir de nível
      best_course = None
      best_score = 0

      for course_key, course in TRAINING_COURSES.items():
        # Pontuação: atributo alinhado + especialização alinhada
        attr_match = 1 if course.get("attr") in emp.get("attrs", {}) else 0.5
        spec_match = 1 if course.get("spec") == spec.get("spec") else 0.5
        score = attr_match * spec_match

        if score > best_score:
          best_score = score
          best_course = course_key

      if best_course:
        analysis["training_recommendations"].append({
          "employee_id": emp.get("id"),
          "employee_name": emp.get("name"),
          "course_key": best_course,
          "course_name": TRAINING_COURSES[best_course].get("name"),
          "cost": TRAINING_COURSES[best_course].get("cost"),
          "duration_s": TRAINING_COURSES[best_course].get("duration_s"),
          "priority_score": round(best_score * 100)
        })

  analysis["hr_summary"]["total_payroll_monthly"] = total_payroll
  analysis["hr_summary"]["avg_level"] = round(total_level / max(1, len(employees)), 1)
  analysis["hr_summary"]["avg_fatigue"] = round(total_fatigue / max(1, len(employees)))
  analysis["hr_summary"]["avg_health"] = round(total_health / max(1, len(employees)))
  analysis["hr_summary"]["high_value_count"] = high_value
  analysis["hr_summary"]["at_risk_count"] = at_risk

  # Necessidades de recrutamento
  spec_counts = {}
  for emp in employees:
    role = emp.get("role_key")
    spec = SPECIALIZATIONS.get(role, {}).get("spec", "suporte")
    spec_counts[spec] = spec_counts.get(spec, 0) + 1

  for spec in TEAM_SPECS:
    count = spec_counts.get(spec, 0)
    needed = max(0, 2 - count)  # Recomendação: pelo menos 2 de cada especialização
    if needed > 0:
      analysis["recruitment_needs"].append({
        "spec": spec,
        "spec_name": TEAM_SPECS[spec].get("name"),
        "current_count": count,
        "needed": needed,
        "priority_score": needed * 50
      })

  # Potencial de talento
  for emp in employees:
    if emp.get("rarity") in ["elite", "lendario"]:
      analysis["talent_potential"].append({
        "id": emp.get("id"),
        "name": emp.get("name"),
        "rarity": emp.get("rarity"),
        "talents": emp.get("talents", []),
        "talents_available": len([t for t in TALENTS if emp.get("role_key") in TALENTS[t].get("roles", [])]) - len(emp.get("talents", []))
      })

  return analysis


# ============ ANÁLISE DE EQUIPA ============

async def analyze_teams_intelligence(db, pid: str, state: dict, catalog: dict) -> dict:
  """Análise completa de equipas com composição ideal e estratégia"""
  teams = state.get("teams", [])
  employees = state.get("employees", [])
  opportunities = state.get("opportunities", [])

  analysis = {
    "teams_summary": {
      "total_teams": len(teams),
      "teams_by_spec": {},
      "avg_team_size": 0,
      "total_missions_done": 0,
      "teams_idle": 0,
      "teams_busy": 0
    },
    "team_analysis": [],
    "composition_recommendations": [],
    "specialization_balance": [],
    "opportunity_alignment": {}
  }

  # Contar equipas por especialização
  teams_by_spec = {}
  for team in teams:
    spec = team.get("spec")
    teams_by_spec[spec] = teams_by_spec.get(spec, 0) + 1

  analysis["teams_summary"]["teams_by_spec"] = teams_by_spec
  analysis["teams_summary"]["total_missions_done"] = sum(t.get("missions_done", 0) for t in teams)
  analysis["teams_summary"]["teams_idle"] = sum(1 for t in teams if t.get("status") == "idle")
  analysis["teams_summary"]["teams_busy"] = sum(1 for t in teams if t.get("status") != "idle")

  # Mapa de funcionários por equipa
  emps_by_team = {}
  for emp in employees:
    team_id = emp.get("team_id")
    if team_id:
      if team_id not in emps_by_team:
        emps_by_team[team_id] = []
      emps_by_team[team_id].append(emp)

  # Analisar cada equipa
  for team in teams:
    team_emps = emps_by_team.get(team.get("id"), [])
    spec = team.get("spec")
    status = team.get("status")

    # Score de composição (0-100)
    comp_score = 0
    # Especialização dos membros
    spec_roles = {rk for rk, rv in SPECIALIZATIONS.items() if rv.get("spec") == spec}
    matching_roles = sum(1 for e in team_emps if e.get("role_key") in spec_roles)
    comp_score += (matching_roles / max(1, len(team_emps))) * 40

    # Talentos relevantes
    team_talents = set()
    for emp in team_emps:
      team_talents.update(emp.get("talents", []))
    comp_score += min(30, len(team_talents) * 5)

    # Nível médio
    avg_level = sum(e.get("level", 0) for e in team_emps) / max(1, len(team_emps))
    comp_score += min(30, avg_level * 3)

    analysis["team_analysis"].append({
      "id": team.get("id"),
      "name": team.get("name"),
      "spec": spec,
      "status": status,
      "members": len(team_emps),
      "max_members": 6,  # TEAM_MAX_MEMBERS
      "composition_score": round(comp_score),
      "missions_done": team.get("missions_done", 0),
      "avg_level": round(avg_level, 1),
      "has_vehicle": bool(team.get("vehicle_id")),
      "team_talents": len(team_talents)
    })

    # Recomendações de composição
    if len(team_emps) < 6:
      recommended_roles = list(spec_roles)[:min(3, 6 - len(team_emps))]
      if recommended_roles:
        analysis["composition_recommendations"].append({
          "team_id": team.get("id"),
          "team_name": team.get("name"),
          "current_size": len(team_emps),
          "recommended_additions": recommended_roles,
          "priority_score": (6 - len(team_emps)) * 20
        })

  # Equilíbrio de especialização
  for spec in TEAM_SPECS:
    count = teams_by_spec.get(spec, 0)
    opps_for_spec = sum(1 for o in opportunities if o.get("status") == "active" and o.get("category") == spec)
    avg_opp_per_team = opps_for_spec / max(1, count) if count > 0 else 0

    analysis["specialization_balance"].append({
      "spec": spec,
      "teams": count,
      "active_opportunities": opps_for_spec,
      "avg_opp_per_team": round(avg_opp_per_team, 2),
      "balance_status": "overextended" if avg_opp_per_team > 3 else "balanced" if avg_opp_per_team > 0 else "idle"
    })

  # Alinhamento com oportunidades
  for spec in TEAM_SPECS:
    opps = [o for o in opportunities if o.get("status") == "active" and o.get("category") == spec]
    analysis["opportunity_alignment"][spec] = {
      "teams": teams_by_spec.get(spec, 0),
      "opportunities": len(opps),
      "avg_reward": int(sum(o.get("reward", 0) for o in opps) / max(1, len(opps))) if opps else 0,
      "alignment_score": (teams_by_spec.get(spec, 0) / max(1, len(opps))) if opps else 0
    }

  analysis["teams_summary"]["avg_team_size"] = round(
    sum(len(emps_by_team.get(t.get("id"), [])) for t in teams) / max(1, len(teams)), 1
  )

  return analysis
