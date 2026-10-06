"""Diretor Operacional do SUBMUNDO.

Camada de coordenação inspirada nas melhores ideias de jogos de despacho:
- prontidão PLAYABLE/STRETCH/LOCKED baseada na capacidade real da organização;
- requisitos/recomendações data-driven por operação;
- certificações ligadas aos cursos já existentes;
- perfis semânticos de distrito e cobertura;
- planos de despacho reutilizáveis;
- reforços multi-equipa;
- cadeias/expansões/follow-ups sem duplicar o motor de missões;
- snapshot compacto para a Central de Operações.

Este módulo é puro de propósito: não conhece FastAPI/Mongo e pode ser testado
sem infraestrutura.
"""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timedelta, timezone
from typing import Iterable


READINESS_PLAYABLE = "playable"
READINESS_STRETCH = "stretch"
READINESS_LOCKED = "locked"


CERTIFICATIONS = {
    "combate": {"key": "combate_operacional", "name": "Combate Operacional"},
    "conducao": {"key": "conducao_avancada", "name": "Condução Avançada"},
    "hacking": {"key": "operacoes_tecnicas", "name": "Operações Técnicas"},
    "discricao": {"key": "vigilancia_discreta", "name": "Vigilância Discreta"},
    "negociacao": {"key": "negociacao_operacional", "name": "Negociação Operacional"},
    "primeiros_socorros": {"key": "primeiros_socorros", "name": "Primeiros Socorros"},
    "logistica": {"key": "logistica_avancada", "name": "Logística Avançada"},
    "gestao": {"key": "gestao_operacional", "name": "Gestão Operacional"},
    "lideranca": {"key": "lideranca_operacional", "name": "Liderança Operacional"},
    "treino_fisico": {"key": "aptidao_operacional", "name": "Aptidão Operacional"},
}


DISTRICT_ARCHETYPES = {
    "residencial": {
        "name": "Residencial",
        "tags": ["residencial", "local"],
        "category_weights": {"assalto": 1.05, "influencia": 1.10, "logistica": 0.90},
        "police_mult": 1.0,
    },
    "comercial": {
        "name": "Comercial",
        "tags": ["comercial", "servicos", "movimento"],
        "category_weights": {"influencia": 1.18, "tecnica": 1.10, "assalto": 1.02},
        "police_mult": 1.08,
    },
    "industrial": {
        "name": "Industrial",
        "tags": ["industrial", "armazens", "logistica"],
        "category_weights": {"logistica": 1.25, "assalto": 1.08, "tecnica": 0.95},
        "police_mult": 0.92,
    },
    "turistico": {
        "name": "Turístico",
        "tags": ["turismo", "hotelaria", "movimento"],
        "category_weights": {"influencia": 1.16, "especial": 1.10, "assalto": 0.95},
        "police_mult": 1.12,
    },
    "portuario": {
        "name": "Portuário",
        "tags": ["porto", "carga", "costeiro"],
        "category_weights": {"logistica": 1.32, "especial": 1.12, "assalto": 1.05},
        "police_mult": 1.06,
    },
    "rural": {
        "name": "Rural",
        "tags": ["rural", "baixa_densidade"],
        "category_weights": {"logistica": 1.12, "assalto": 1.05, "tecnica": 0.88},
        "police_mult": 0.82,
    },
    "empresarial": {
        "name": "Empresarial",
        "tags": ["empresas", "escritorios", "tecnologia"],
        "category_weights": {"tecnica": 1.25, "influencia": 1.18, "assalto": 0.88},
        "police_mult": 1.05,
    },
}

POI_CATALOG = {
    "residencial": ["Bairro residencial", "Condomínio", "Rua secundária", "Garagem privada"],
    "comercial": ["Zona comercial", "Mercado", "Centro de serviços", "Parque de estacionamento"],
    "industrial": ["Armazém logístico", "Parque industrial", "Zona de cargas", "Oficina"],
    "turistico": ["Zona hoteleira", "Frente turística", "Área de entretenimento", "Parque público"],
    "portuario": ["Terminal de carga", "Marina", "Cais", "Zona portuária"],
    "rural": ["Estrada rural", "Quinta isolada", "Zona florestal", "Armazém periférico"],
    "empresarial": ["Centro empresarial", "Escritórios", "Nó tecnológico", "Parque corporativo"],
}



DEFAULT_DISPATCH_PRESETS = {
    "baixo_perfil": {
        "name": "Baixo Perfil",
        "preferred_specs": ["tecnica", "influencia"],
        "min_chance": 0.72,
        "max_heat": 72,
        "min_vehicle_condition": 65,
        "prefer_discreet_vehicle": True,
        "reserve_teams": 1,
        "supplies": ["disguise_kit", "electronics_kit"],
    },
    "assalto_pesado": {
        "name": "Assalto Pesado",
        "preferred_specs": ["assalto"],
        "min_chance": 0.62,
        "max_heat": 82,
        "min_vehicle_condition": 72,
        "prefer_discreet_vehicle": False,
        "reserve_teams": 1,
        "supplies": ["body_armor", "medical_kit", "entry_tools"],
    },
    "logistica_segura": {
        "name": "Logística Segura",
        "preferred_specs": ["logistica"],
        "min_chance": 0.70,
        "max_heat": 76,
        "min_vehicle_condition": 70,
        "prefer_discreet_vehicle": True,
        "reserve_teams": 1,
        "supplies": ["burner_phones", "medical_kit"],
    },
}


CATEGORY_ROLE_REQUIREMENTS = {
    "assalto": {
        "required": {"assaltante"},
        "recommended": {"motorista", "seguranca", "medico"},
        "certs": {"combate_operacional"},
    },
    "logistica": {
        "required": {"motorista"},
        "recommended": {"contrabandista", "estafeta", "mecanico"},
        "certs": {"conducao_avancada"},
    },
    "tecnica": {
        "required": {"hacker"},
        "recommended": {"criptografo", "engenheiro_social", "espiao"},
        "certs": {"operacoes_tecnicas"},
    },
    "influencia": {
        "required": {"negociador"},
        "recommended": {"advogado", "informador", "relacoes_publicas"},
        "certs": {"negociacao_operacional"},
    },
    "especial": {
        "required": set(),
        "recommended": {"motorista", "medico", "negociador", "hacker"},
        "certs": set(),
    },
}


PROFILE_BONUS_REQUIREMENTS = {
    "digital": {"roles": {"hacker", "criptografo"}, "certs": {"operacoes_tecnicas"}},
    "mobility": {"roles": {"motorista", "piloto"}, "certs": {"conducao_avancada"}},
    "stealth": {"roles": {"espiao", "arrombador"}, "certs": {"vigilancia_discreta"}},
    "influence": {"roles": {"negociador", "advogado"}, "certs": {"negociacao_operacional"}},
    "confrontation": {"roles": {"assaltante", "seguranca"}, "certs": {"combate_operacional"}},
}


def _stable_index(value: str, count: int) -> int:
    if count <= 0:
        return 0
    raw = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(raw[:12], 16) % count


def district_profile(district: dict | str | None) -> dict:
    """Dá identidade funcional ao distrito sem depender de nomes de negócios reais.

    O anel influencia a probabilidade: exterior tende mais a rural/industrial;
    nomes com palavras fortes (porto/marina/industrial...) ganham perfil coerente.
    """
    if isinstance(district, str):
        name, ring, key = district, 1, district
    else:
        district = district or {}
        name = str(district.get("name") or district.get("key") or "Zona")
        ring = int(district.get("ring", 1) or 0)
        key = str(district.get("key") or name)

    folded = name.lower()
    keyword_map = (
        (("porto", "marina", "doca", "cais"), "portuario"),
        (("industrial", "parque", "armaz"), "industrial"),
        (("hotel", "praia", "turis", "avenida"), "turistico"),
        (("empres", "tecn", "escrit"), "empresarial"),
        (("comercial", "mercado", "centro"), "comercial"),
    )
    chosen = next((profile for words, profile in keyword_map if any(w in folded for w in words)), None)
    if not chosen:
        if ring >= 2:
            pool = ["rural", "industrial", "portuario", "residencial"]
        elif ring == 0:
            pool = ["comercial", "empresarial", "residencial", "turistico"]
        else:
            pool = list(DISTRICT_ARCHETYPES)
        chosen = pool[_stable_index(f"{key}:{name}:{ring}", len(pool))]
    cfg = DISTRICT_ARCHETYPES[chosen]
    return {"key": chosen, "ring": ring, **cfg}


def district_category_multiplier(district: dict | str | None, category: str) -> float:
    profile = district_profile(district)
    return float((profile.get("category_weights") or {}).get(category, 1.0))


def poi_for_operation(district: dict | str | None, opportunity: dict) -> dict:
    profile = district_profile(district)
    pool = POI_CATALOG.get(profile["key"], ["Ponto operacional"])
    seed = f"{profile['key']}:{opportunity.get('type_key')}:{opportunity.get('district')}:{opportunity.get('lat')}:{opportunity.get('lng')}"
    name = pool[_stable_index(seed, len(pool))]
    return {
        "key": f"{profile['key']}_{_stable_index(seed + ':poi', 9999)}",
        "name": name,
        "profile": profile["key"],
        "tags": list(profile.get("tags") or []),
    }


def recommended_dispatch_preset(opportunity: dict) -> str:
    category = opportunity.get("category")
    profile = opportunity.get("profile")
    risk = int(opportunity.get("risk", 1) or 1)
    if category == "logistica":
        return "logistica_segura"
    if category in {"tecnica", "influencia"} or profile == "stealth":
        return "baixo_perfil"
    if category == "assalto" or risk >= 4:
        return "assalto_pesado"
    return "baixo_perfil"


def intel_profile(opportunity: dict, capabilities: dict) -> dict:
    risk = max(1, min(5, int(opportunity.get("risk", 1) or 1)))
    roles = capabilities.get("roles") or set()
    specialists = {"informador", "espiao", "hacker", "engenheiro_social"}
    specialist_bonus = 1 if roles & specialists else 0
    patrol_bonus = 0
    district_intel = (capabilities.get("district_intel") or {}).get(str(opportunity.get("district") or ""))
    if district_intel:
        expires = _parse_dt(district_intel.get("expires_at"))
        if not expires or expires > datetime.now(timezone.utc):
            patrol_bonus = max(0, min(2, int(district_intel.get("level", 1) or 1)))
    score = max(1, min(5, 5 - risk + specialist_bonus + patrol_bonus))
    labels = {1: "Fragmentária", 2: "Baixa", 3: "Razoável", 4: "Boa", 5: "Excelente"}
    confidence = {1: 0.48, 2: 0.60, 3: 0.72, 4: 0.84, 5: 0.93}[score]
    spread = round((1.0 - confidence) * 0.22, 3)
    return {
        "score": score,
        "label": labels[score],
        "confidence": confidence,
        "chance_uncertainty": spread,
        "exact_after_preview": score >= 4,
    }


def certifications_for_employee(employee: dict) -> set[str]:
    return set(employee.get("certifications") or [])


def operation_requirements(opportunity: dict) -> dict:
    category = opportunity.get("category", "especial")
    risk = max(1, min(5, int(opportunity.get("risk", 1) or 1)))
    profile = opportunity.get("profile", "confrontation")
    base = CATEGORY_ROLE_REQUIREMENTS.get(category, CATEGORY_ROLE_REQUIREMENTS["especial"])
    prof = PROFILE_BONUS_REQUIREMENTS.get(profile, {})

    required_roles = set(base["required"])
    recommended_roles = set(base["recommended"]) | set(prof.get("roles", set()))
    required_certs = set()
    recommended_certs = set(base["certs"]) | set(prof.get("certs", set()))

    # Certificações são retrocompatíveis: em risco baixo/médio melhoram a
    # preparação, mas só se tornam obrigatórias nas operações realmente
    # avançadas. Isto evita bloquear saves anteriores ao sistema.
    support_teams = 0
    if risk >= 4:
        support_teams = 1
        required_certs |= set(base["certs"])
        if category == "especial" and recommended_roles:
            required_roles.add(sorted(recommended_roles)[0])
    if risk >= 5:
        support_teams = 2
        required_certs |= set(prof.get("certs", set()))

    min_members = max(int(opportunity.get("min_members", 1) or 1), 2 if risk >= 3 else 1)
    required_models = list(opportunity.get("required_models") or [])

    return {
        "required_roles": sorted(required_roles),
        "recommended_roles": sorted(recommended_roles - required_roles),
        "required_certifications": sorted(required_certs),
        "recommended_certifications": sorted(recommended_certs - required_certs),
        "min_members": min_members,
        "support_teams": support_teams,
        "required_models": required_models,
        "recommended_vehicle_condition": 55 + risk * 7,
        "recommended_stock": (
            ["medical_kit"] if risk >= 3 else []
        ) + (
            ["body_armor"] if category == "assalto" and risk >= 4 else []
        ) + (
            ["electronics_kit"] if category == "tecnica" else []
        ) + (
            ["disguise_kit"] if category == "influencia" else []
        ),
    }


def capability_snapshot(
    player: dict,
    teams: list[dict],
    employees: list[dict],
    vehicles: list[dict],
    properties: list[dict],
) -> dict:
    idle_team_ids = {str(t.get("_id") or t.get("id")) for t in teams if t.get("status") == "idle"}
    team_employee_map: dict[str, list[dict]] = {tid: [] for tid in idle_team_ids}
    for emp in employees:
        tid = str(emp.get("team_id") or "")
        if tid in team_employee_map and emp.get("status") == "idle" and float(emp.get("fatigue", 0) or 0) < 90:
            team_employee_map[tid].append(emp)

    roles = set()
    certs = set()
    for emp in employees:
        if emp.get("status") in {"idle", "resting"}:
            roles.add(emp.get("role_key"))
            certs |= certifications_for_employee(emp)

    usable_vehicles = [
        v for v in vehicles
        if float(v.get("condition", 0) or 0) >= 30 and not v.get("seized_until")
    ]
    return {
        "idle_team_ids": idle_team_ids,
        "idle_team_count": len(idle_team_ids),
        "team_employee_map": team_employee_map,
        "roles": {r for r in roles if r},
        "certifications": certs,
        "vehicle_models": {v.get("model_key") for v in usable_vehicles},
        "usable_vehicle_count": len(usable_vehicles),
        "property_types": {p.get("type_key") for p in properties},
        "inventory": dict(player.get("inventory") or {}),
        "district_intel": dict(player.get("district_intel") or {}),
        "heat": float(player.get("heat", 0) or 0),
        "level": int(player.get("level", 1) or 1),
    }


def missing_team_requirements(requirements: dict, members: list[dict]) -> list[dict]:
    """Requisitos que têm de coexistir na equipa principal."""
    roles = {m.get("role_key") for m in members if m.get("role_key")}
    certs = set()
    for member in members:
        certs |= certifications_for_employee(member)

    missing = []
    if len(members) < int(requirements.get("min_members", 1) or 1):
        missing.append({
            "kind": "members",
            "key": "min_members",
            "label": f"Mínimo de {requirements.get('min_members', 1)} operacionais",
        })
    for role in requirements.get("required_roles") or []:
        if role not in roles:
            missing.append({
                "kind": "role",
                "key": role,
                "label": f"Falta na equipa: {role.replace('_', ' ')}",
            })
    for cert in requirements.get("required_certifications") or []:
        if cert not in certs:
            missing.append({
                "kind": "certification",
                "key": cert,
                "label": f"Falta certificação: {cert.replace('_', ' ')}",
            })
    return missing


def classify_opportunity_readiness(opportunity: dict, capabilities: dict) -> dict:
    req = operation_requirements(opportunity)
    missing = []
    weak = []
    roles = capabilities["roles"]
    certs = capabilities["certifications"]

    for role in req["required_roles"]:
        if role not in roles:
            missing.append({"kind": "role", "key": role, "label": f"Falta especialista: {role.replace('_', ' ')}"})
    for cert in req["required_certifications"]:
        if cert not in certs:
            missing.append({"kind": "certification", "key": cert, "label": f"Falta certificação: {cert.replace('_', ' ')}"})

    required_models = set(req["required_models"])
    if required_models and not (required_models & capabilities["vehicle_models"]):
        missing.append({"kind": "vehicle", "key": "required_model", "label": "Falta veículo compatível"})

    if capabilities["idle_team_count"] <= 0:
        missing.append({"kind": "team", "key": "idle_team", "label": "Não há equipa pronta"})
    else:
        team_map = capabilities.get("team_employee_map") or {}
        primary_ready = any(
            not missing_team_requirements(req, members)
            for members in team_map.values()
        )
        if not primary_ready and not missing:
            weak.append({
                "kind": "composition",
                "key": "reorganize_primary",
                "label": "Os recursos existem, mas tens de reorganizar uma equipa principal",
            })
        if req["support_teams"] and capabilities["idle_team_count"] < 1 + req["support_teams"]:
            weak.append({
                "kind": "support",
                "key": "support_teams",
                "label": f"Recomendado: {req['support_teams']} equipa(s) de apoio",
            })

    for stock in req["recommended_stock"]:
        if int(capabilities["inventory"].get(stock, 0) or 0) <= 0:
            weak.append({"kind": "stock", "key": stock, "label": f"Sem {stock.replace('_', ' ')}"})

    for role in req["recommended_roles"]:
        if role not in roles:
            weak.append({"kind": "role", "key": role, "label": f"Recomendado: {role.replace('_', ' ')}"})

    if missing:
        state = READINESS_LOCKED
    elif weak:
        state = READINESS_STRETCH
    else:
        state = READINESS_PLAYABLE

    return {
        "state": state,
        "requirements": req,
        "missing": missing,
        "warnings": weak[:6],
        "summary": (
            "Pronta com os recursos atuais"
            if state == READINESS_PLAYABLE
            else "Executável, mas abaixo da preparação ideal"
            if state == READINESS_STRETCH
            else "A organização ainda não tem capacidade mínima"
        ),
    }


def enrich_opportunities(
    opportunities: Iterable[dict],
    player: dict,
    teams: list[dict],
    employees: list[dict],
    vehicles: list[dict],
    properties: list[dict],
) -> list[dict]:
    caps = capability_snapshot(player, teams, employees, vehicles, properties)
    district_map = {str(d.get("name")): d for d in (player.get("districts") or [])}
    out = []
    for raw in opportunities:
        opp = dict(raw)
        profile = district_profile(district_map.get(str(opp.get("district"))) or str(opp.get("district") or "Zona"))
        opp["district_profile"] = profile
        opp["poi"] = poi_for_operation(district_map.get(str(opp.get("district"))) or str(opp.get("district") or "Zona"), opp)
        opp["readiness"] = classify_opportunity_readiness(opp, caps)
        opp["requirements"] = opp["readiness"]["requirements"]
        opp["dispatch_preset"] = recommended_dispatch_preset(opp)
        opp["intel"] = intel_profile(opp, caps)
        out.append(opp)
    return out


def operational_snapshot(
    player: dict,
    teams: list[dict],
    employees: list[dict],
    vehicles: list[dict],
    properties: list[dict],
    opportunities: list[dict],
    missions: list[dict],
    world: dict | None = None,
) -> dict:
    caps = capability_snapshot(player, teams, employees, vehicles, properties)
    enriched = enrich_opportunities(opportunities, player, teams, employees, vehicles, properties)
    active = [m for m in missions if m.get("phase") != "done"]
    now = datetime.now(timezone.utc)
    pending = []
    for mission in active:
        decision = mission.get("decision") or {}
        if decision.get("status") == "pending":
            opens = _parse_dt(decision.get("opens_at"))
            expires = _parse_dt(decision.get("expires_at"))
            if opens and expires and opens <= now <= expires:
                pending.append({
                    "kind": "decision",
                    "mission_id": str(mission.get("_id") or mission.get("id") or ""),
                    "title": decision.get("title", "Decisão tática"),
                    "team": mission.get("team_name", "Equipa"),
                    "expires_at": decision.get("expires_at"),
                })
        if mission.get("reinforcement_request", {}).get("status") == "pending":
            pending.append({
                "kind": "reinforcement",
                "mission_id": str(mission.get("_id") or mission.get("id") or ""),
                "title": mission["reinforcement_request"].get("title", "Pedido de reforço"),
                "team": mission.get("team_name", "Equipa"),
                "expires_at": mission["reinforcement_request"].get("expires_at"),
            })

    coverage = []
    for district in player.get("districts") or []:
        name = district.get("name") or district.get("key")
        local_ops = [o for o in enriched if o.get("district") == name and o.get("status") == "active"]
        attention = float((player.get("district_attention") or {}).get(name, 0) or 0)
        territory = (player.get("territories") or {}).get(name) or {}
        patrols = [
            t for t in teams
            if t.get("status") == "patrolling"
            and (t.get("patrol") or {}).get("district") == name
        ]
        intel = (player.get("district_intel") or {}).get(name) or {}
        coverage.append({
            "district": name,
            "lat": district.get("lat"),
            "lng": district.get("lng"),
            "profile": district_profile(district),
            "active_operations": len(local_ops),
            "attention": round(attention, 1),
            "territory_tier": int(territory.get("tier", 0) or 0),
            "pressure": round(float(territory.get("pressure", 0) or 0), 1),
            "patrols": len(patrols),
            "intel": intel,
        })

    counts = {READINESS_PLAYABLE: 0, READINESS_STRETCH: 0, READINESS_LOCKED: 0}
    for opp in enriched:
        counts[opp["readiness"]["state"]] += 1

    active_staging = []
    for area in player.get("staging_areas") or []:
        expires = _parse_dt(area.get("expires_at"))
        if not expires or expires > now:
            active_staging.append(area)

    return {
        "requires_action": pending,
        "readiness_counts": counts,
        "available_teams": caps["idle_team_count"],
        "usable_vehicles": caps["usable_vehicle_count"],
        "active_missions": len(active),
        "coverage": sorted(coverage, key=lambda row: (-row["active_operations"], -row["attention"]))[:12],
        "world": world or {},
        "presets": {**DEFAULT_DISPATCH_PRESETS, **dict(player.get("dispatch_presets") or {})},
        "staging_areas": active_staging,
        "operational_rules": dict(player.get("operational_rules") or {}),
    }


def reinforcement_effect(mission: dict, team: dict, members: list[dict], vehicle: dict | None) -> dict:
    """Efeito limitado e transparente de uma equipa de reforço.

    O reforço melhora chance/segurança mas nunca pode transformar a operação
    numa certeza. O valor cresce com membros e especialização compatível.
    """
    category = (mission.get("opportunity") or {}).get("category", "especial")
    member_count = len(members)
    spec_match = team.get("spec") == category or category == "especial"
    condition = float((vehicle or {}).get("condition", 50) or 50)
    delta = 0.015 + min(0.035, member_count * 0.007)
    if spec_match:
        delta += 0.018
    if condition >= 75:
        delta += 0.008
    return {
        "chance_delta": round(min(0.07, delta), 3),
        "injury_mult": 0.92 if member_count >= 2 else 0.96,
        "label": f"{team.get('name', 'Equipa de apoio')} · {member_count} operacionais",
    }


CHAIN_RULES = {
    "success": {"chance": 0.24, "kind": "follow_up", "risk_delta": 1, "reward_mult": 1.22},
    "partial": {"chance": 0.18, "kind": "follow_up", "risk_delta": 0, "reward_mult": 1.10},
    "failure": {"chance": 0.20, "kind": "recovery", "risk_delta": 1, "reward_mult": 0.95},
    "police": {"chance": 0.28, "kind": "cleanup", "risk_delta": 1, "reward_mult": 1.05},
}


def chain_spec(mission: dict, outcome: str) -> dict | None:
    """Decisão determinística para evitar duplicados em retries/offline ticks."""
    rule = CHAIN_RULES.get(outcome)
    if not rule:
        return None
    mid = str(mission.get("_id") or mission.get("id") or mission.get("opportunity_id") or "")
    token = hashlib.sha256(f"{mid}:{outcome}:chain".encode("utf-8")).hexdigest()
    roll = int(token[:8], 16) / 0xFFFFFFFF
    if roll > rule["chance"]:
        return None
    stage = int(mission.get("chain_stage", 0) or 0) + 1
    if stage > 3:
        return None
    return {**rule, "stage": stage}


def build_follow_up_opportunity(mission: dict, outcome: str, now: datetime | None = None) -> dict | None:
    spec = chain_spec(mission, outcome)
    if not spec:
        return None
    now = now or datetime.now(timezone.utc)
    source = dict(mission.get("opportunity") or {})
    target = dict(mission.get("target") or {})
    chain_id = str(mission.get("chain_id") or mission.get("_id") or mission.get("id") or mission.get("opportunity_id") or "")
    names = {
        "follow_up": "Pista quente",
        "recovery": "Recuperação urgente",
        "cleanup": "Limpeza de exposição",
    }
    risk = max(1, min(5, int(source.get("risk", 2) or 2) + int(spec["risk_delta"])))
    # Pequeno desvio geográfico estável, suficiente para não empilhar ícones.
    seed = _stable_index(f"{chain_id}:{spec['stage']}", 360)
    angle = math.radians(seed)
    radius = 0.004 + 0.0015 * spec["stage"]
    lat = float(target.get("lat", 0) or 0) + math.cos(angle) * radius
    lng = float(target.get("lng", 0) or 0) + math.sin(angle) * radius
    return {
        "player_id": mission.get("player_id"),
        "type_key": source.get("type_key", "operacao_encoberta"),
        "name": f"{names[spec['kind']]} · {source.get('name', 'Operação')}",
        "category": source.get("category", "especial"),
        "district": source.get("district", "Zona"),
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "reward": max(500, int(float(source.get("reward", 1000) or 1000) * spec["reward_mult"])),
        "respect": max(1, int(source.get("respect", 5) or 5) + spec["stage"]),
        "risk": risk,
        "heat": round(float(source.get("heat", 2) or 2) * (1.0 + 0.08 * spec["stage"]), 2),
        "pays": source.get("pays", "dirty"),
        "rare": spec["stage"] >= 2,
        "hot": True,
        "dist_km": float(source.get("distance_km", 0) or 0),
        "min_members": max(1, int(source.get("min_members", 1) or 1)),
        "required_models": list(source.get("required_models") or []),
        "duration_s": max(60, int((mission.get("finish_at") and 180) or 180)),
        "min_level": int(source.get("min_level", 1) or 1),
        "status": "active",
        "expires_at": (now + timedelta(minutes=22)).isoformat(),
        "created_at": now.isoformat(),
        "profile": source.get("profile", mission.get("operation_profile", "confrontation")),
        "chain_id": chain_id,
        "parent_mission_id": str(mission.get("_id") or mission.get("id") or ""),
        "chain_stage": spec["stage"],
        "chain_kind": spec["kind"],
    }


def _parse_dt(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None
