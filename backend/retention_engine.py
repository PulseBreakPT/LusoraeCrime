"""Retention/engagement systems for SUBMUNDO.

The goal is not to add artificial checklists. This module turns existing game
state into consequential decisions: a rotating world pulse, contextual next
moves, account records, and one optional tactical decision during live ops.
All functions are pure so server and tests can reason about them deterministically.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone


WORLD_PULSES = (
    {
        "key": "cash_window",
        "label": "Dinheiro na rua",
        "category": "assalto",
        "description": "Alvos de assalto estão a movimentar mais numerário, mas a exposição também subiu.",
        "reward_mult": 1.18,
        "heat_mult": 1.12,
    },
    {
        "key": "cold_routes",
        "label": "Rotas frias",
        "category": "logistica",
        "description": "Menos fiscalização nas rotas logísticas. O lucro melhora e o calor cresce mais devagar.",
        "reward_mult": 1.14,
        "heat_mult": 0.88,
    },
    {
        "key": "digital_noise",
        "label": "Ruído digital",
        "category": "tecnica",
        "description": "Infraestruturas digitais estão mais vulneráveis durante esta janela operacional.",
        "reward_mult": 1.17,
        "heat_mult": 0.96,
    },
    {
        "key": "open_doors",
        "label": "Portas abertas",
        "category": "influencia",
        "description": "Contactos e intermediários estão mais recetivos. Operações de influência pagam melhor.",
        "reward_mult": 1.15,
        "heat_mult": 0.90,
    },
)


def _stable_index(value: str, size: int) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % max(1, size)


def world_pulse(now: datetime) -> dict:
    """One global four-hour window shared by every player.

    A shared pulse makes the world feel like a place rather than a per-account
    slot machine. It changes strategy without invalidating a player's build.
    """
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    slot_s = 4 * 60 * 60
    slot = int(now.timestamp()) // slot_s
    pulse = dict(WORLD_PULSES[_stable_index(f"submundo-world-{slot}", len(WORLD_PULSES))])
    starts = datetime.fromtimestamp(slot * slot_s, tz=timezone.utc)
    ends = starts + timedelta(seconds=slot_s)
    pulse.update({
        "starts_at": starts.isoformat(),
        "ends_at": ends.isoformat(),
        "reward_bonus_pct": round((pulse["reward_mult"] - 1) * 100),
        "heat_delta_pct": round((pulse["heat_mult"] - 1) * 100),
    })
    return pulse


DECISION_VARIANTS = {
    "assalto": {
        "title": "A segurança mudou de posição",
        "description": "A equipa tem segundos para decidir se acelera o golpe ou reduz a exposição.",
        "push": ("Forçar a entrada", "Mais saque, mais ruído e uma execução mais arriscada."),
        "safe": ("Mudar o plano", "Menos saque, mas uma abordagem mais controlada."),
    },
    "logistica": {
        "title": "A rota de saída ficou congestionada",
        "description": "O condutor pede uma decisão antes de comprometer a fuga.",
        "push": ("Manter a rota rápida", "Preserva o valor do golpe, mas aumenta o risco operacional."),
        "safe": ("Desviar por secundárias", "Reduz exposição em troca de parte da margem."),
    },
    "tecnica": {
        "title": "Foi detetado um sistema adicional",
        "description": "Há uma janela curta para explorar o acesso ou sair sem tocar no novo alvo.",
        "push": ("Explorar o acesso", "Pode aumentar o retorno, mas piora a margem de erro."),
        "safe": ("Isolar e continuar", "Melhora a segurança, mas sacrifica parte da recompensa."),
    },
    "influencia": {
        "title": "O intermediário mudou as condições",
        "description": "A equipa pode pressionar o contacto ou aceitar um acordo mais conservador.",
        "push": ("Pressionar o contacto", "Melhor retorno com maior risco de exposição."),
        "safe": ("Fechar acordo seguro", "Menor retorno, maior controlo da situação."),
    },
    "especial": {
        "title": "O terreno mudou",
        "description": "A equipa precisa de uma decisão tática antes de avançar.",
        "push": ("Aproveitar a abertura", "Maior retorno com mais risco."),
        "safe": ("Consolidar posição", "Menor retorno, maior segurança."),
    },
}


def mission_decision(category: str, risk: int, arrive_at: datetime, finish_at: datetime) -> dict | None:
    """Create one optional mid-operation decision.

    Ignoring it is neutral: there is no streak punishment and no hidden loss.
    The window exists to replace dead timer time with an informed trade-off.
    """
    duration = max(0.0, (finish_at - arrive_at).total_seconds())
    if duration < 35:
        return None
    variant = DECISION_VARIANTS.get(category, DECISION_VARIANTS["especial"])
    opens = arrive_at + timedelta(seconds=max(8, duration * 0.28))
    expires = arrive_at + timedelta(seconds=max(22, duration * 0.78))
    risk_scale = max(0.0, min(1.0, (float(risk or 1) - 1) / 4))
    push_penalty = round(-(0.025 + 0.02 * risk_scale), 3)
    safe_bonus = round(0.035 + 0.015 * risk_scale, 3)
    return {
        "status": "pending",
        "title": variant["title"],
        "description": variant["description"],
        "opens_at": opens.isoformat(),
        "expires_at": expires.isoformat(),
        "choice": None,
        "options": [
            {
                "id": "steady",
                "label": "Manter plano",
                "description": "Sem alterar risco, recompensa ou calor.",
                "chance_delta": 0.0,
                "reward_mult": 1.0,
                "heat_delta": 0.0,
                "fatigue_delta": 0.0,
            },
            {
                "id": "push",
                "label": variant["push"][0],
                "description": variant["push"][1],
                "chance_delta": push_penalty,
                "reward_mult": 1.15,
                "heat_delta": round(3 + 3 * risk_scale, 1),
                "fatigue_delta": round(3 + 2 * risk_scale, 1),
            },
            {
                "id": "safe",
                "label": variant["safe"][0],
                "description": variant["safe"][1],
                "chance_delta": safe_bonus,
                "reward_mult": 0.88,
                "heat_delta": round(-(1.5 + 1.5 * risk_scale), 1),
                "fatigue_delta": 1.5,
            },
        ],
    }


def _progress(value, target):
    target = max(1.0, float(target or 1))
    value = max(0.0, float(value or 0))
    return {
        "value": round(value, 1),
        "target": round(target, 1),
        "pct": round(min(100.0, value / target * 100), 1),
    }


def build_retention_snapshot(
    *,
    now: datetime,
    player: dict,
    teams: list,
    employees: list,
    vehicles: list,
    properties: list,
    opportunities: list,
    missions: list,
    history: list,
    caps: dict,
    weekly_fixed_total: int,
) -> dict:
    """Turn current state into a small set of high-signal reasons to act now.

    Exactly three horizons are returned: now, this session, and long-term.
    They are advisory, not mandatory, and never reset a streak for absence.
    """
    moves = []
    active = [m for m in missions if m.get("phase") != "done"]
    pending_decision = next(
        (
            m for m in active
            if (m.get("decision") or {}).get("status") == "pending"
            and (m.get("decision") or {}).get("opens_at")
            and (m.get("decision") or {}).get("expires_at")
            and datetime.fromisoformat(m["decision"]["opens_at"]) <= now <= datetime.fromisoformat(m["decision"]["expires_at"])
        ),
        None,
    )

    if pending_decision:
        moves.append({
            "id": "live-decision",
            "horizon": "agora",
            "priority": 100,
            "title": f"Decisão em {pending_decision.get('team_name', 'operação')}",
            "description": (pending_decision.get("decision") or {}).get("title", "A equipa aguarda instruções."),
            "panel": "operations",
            "focus_test_id": None,
            "progress": _progress(1, 1),
            "tone": "red",
        })
    else:
        ready_teams = sum(1 for team in teams if team.get("status") == "idle" and team.get("vehicle_id"))
        live_opps = sum(1 for opp in opportunities if opp.get("status") == "active")
        if ready_teams and live_opps:
            moves.append({
                "id": "dispatch-next",
                "horizon": "agora",
                "priority": 90,
                "title": "Há trabalho pronto",
                "description": f"{ready_teams} equipa(s) pronta(s) e {live_opps} oportunidade(s) disponíveis.",
                "panel": "operations",
                "focus_test_id": None,
                "progress": _progress(ready_teams, max(1, ready_teams)),
                "tone": "cyan",
            })
        elif not teams:
            moves.append({
                "id": "build-first-team",
                "horizon": "agora",
                "priority": 88,
                "title": "Monta uma equipa operacional",
                "description": "Sem uma equipa não consegues transformar oportunidades em progresso.",
                "panel": "teams",
                "focus_test_id": "team-builder",
                "progress": _progress(0, 1),
                "tone": "cyan",
            })
        elif ready_teams == 0:
            moves.append({
                "id": "restore-readiness",
                "horizon": "agora",
                "priority": 86,
                "title": "Põe uma equipa pronta",
                "description": "Há equipas, mas nenhuma está em condições de receber uma nova ordem.",
                "panel": "teams",
                "focus_test_id": None,
                "progress": _progress(0, max(1, len(teams))),
                "tone": "amber",
            })
        else:
            moves.append({
                "id": "scan-opportunities",
                "horizon": "agora",
                "priority": 72,
                "title": "Lê o terreno",
                "description": "As equipas estão prontas. Verifica a próxima janela operacional no mapa.",
                "panel": "operations",
                "focus_test_id": None,
                "progress": _progress(0, 1),
                "tone": "cyan",
            })

    tired = [e for e in employees if float(e.get("fatigue", 0) or 0) >= 65]
    damaged = [v for v in vehicles if float(v.get("condition", 100) or 100) < 45]
    low_loyalty = [e for e in employees if float(e.get("loyalty", 100) or 100) < 55]
    if tired:
        worst = max(tired, key=lambda e: float(e.get("fatigue", 0) or 0))
        moves.append({
            "id": "fatigue-pressure",
            "horizon": "sessao",
            "priority": 80,
            "title": f"{worst.get('name', 'Operacional')} está no limite",
            "description": f"Fadiga a {round(float(worst.get('fatigue', 0)))}%. Recuperar agora protege a próxima operação.",
            "panel": "employees",
            "focus_test_id": f"employee-card-{worst.get('_id') or worst.get('id')}",
            "progress": _progress(worst.get("fatigue", 0), 100),
            "tone": "amber",
        })
    elif damaged:
        worst = min(damaged, key=lambda v: float(v.get("condition", 100) or 100))
        moves.append({
            "id": "fleet-pressure",
            "horizon": "sessao",
            "priority": 78,
            "title": f"{worst.get('name', 'Veículo')} precisa de oficina",
            "description": f"Condição a {round(float(worst.get('condition', 0)))}%. Mais uma operação aumenta o risco de avaria.",
            "panel": "fleet",
            "focus_test_id": f"vehicle-card-{worst.get('_id') or worst.get('id')}",
            "progress": _progress(100 - float(worst.get("condition", 0) or 0), 100),
            "tone": "amber",
        })
    elif low_loyalty:
        worst = min(low_loyalty, key=lambda e: float(e.get("loyalty", 100) or 100))
        moves.append({
            "id": "loyalty-pressure",
            "horizon": "sessao",
            "priority": 76,
            "title": f"Lealdade de {worst.get('name', 'um operacional')} está baixa",
            "description": f"{round(float(worst.get('loyalty', 0)))}% de lealdade. Resolve antes de depender dele num golpe importante.",
            "panel": "employees",
            "focus_test_id": f"employee-card-{worst.get('_id') or worst.get('id')}",
            "progress": _progress(100 - float(worst.get("loyalty", 0) or 0), 100),
            "tone": "red",
        })

    clean = int(player.get("clean_money", 0) or 0)
    if weekly_fixed_total > 0 and clean < weekly_fixed_total * 1.35:
        moves.append({
            "id": "weekly-buffer",
            "horizon": "plano",
            "priority": 70,
            "title": "Cria margem para o fecho semanal",
            "description": f"Reserva recomendada: {round(weekly_fixed_total * 1.35):,} €. Custos fixos atuais: {weekly_fixed_total:,} €.",
            "panel": "empire",
            "focus_test_id": None,
            "progress": _progress(clean, weekly_fixed_total * 1.35),
            "tone": "amber",
        })
    else:
        level = int(player.get("level", 1) or 1)
        next_level = int(player.get("next_level_respect", 0) or 0)
        respect = int(player.get("respect", 0) or 0)
        if next_level > respect:
            moves.append({
                "id": "next-level",
                "horizon": "plano",
                "priority": 60,
                "title": f"Constrói o caminho para o nível {level + 1}",
                "description": f"Faltam {max(0, next_level - respect):,} pontos de progressão.",
                "panel": "operations",
                "focus_test_id": None,
                "progress": _progress(respect, next_level),
                "tone": "cyan",
            })

    # Fill missing horizons without turning the game into a checklist.
    if not any(move["horizon"] == "sessao" for move in moves):
        dirty_cap = (caps.get("dirty_money") or {}).get("max", 0)
        dirty = int(player.get("dirty_money", 0) or 0)
        moves.append({
            "id": "dirty-capacity",
            "horizon": "sessao",
            "priority": 45,
            "title": "Mantém a tesouraria respirável",
            "description": "Evita que o dinheiro sujo bloqueie novas recompensas.",
            "panel": "empire",
            "focus_test_id": "launder-amount-input" if dirty else None,
            "progress": _progress(dirty, max(1, dirty_cap)),
            "tone": "green",
        })

    if not any(move["horizon"] == "plano" for move in moves):
        property_cap = max(1, int(player.get("level", 1) or 1) + 1)
        moves.append({
            "id": "empire-footprint",
            "horizon": "plano",
            "priority": 40,
            "title": "Expande a pegada da organização",
            "description": "Mais bases e imóveis criam capacidade, rendimento e novas rotas de decisão.",
            "panel": "properties",
            "focus_test_id": None,
            "progress": _progress(len(properties), property_cap),
            "tone": "green",
        })

    horizon_order = {"agora": 0, "sessao": 1, "plano": 2}
    chosen = []
    for horizon in ("agora", "sessao", "plano"):
        candidates = sorted(
            [move for move in moves if move["horizon"] == horizon],
            key=lambda item: -item["priority"],
        )
        if candidates:
            chosen.append(candidates[0])

    # Long-term account memory: records make past play visible and personal.
    completed = [m for m in history if m.get("outcome") in ("success", "partial", "failure", "police")]
    persisted_records = player.get("records") or {}
    best_mission = max(completed, key=lambda m: int(m.get("pending_reward", 0) or 0), default=None)
    veteran = max(employees, key=lambda e: int(e.get("missions_done", 0) or 0), default=None)
    road_car = max(vehicles, key=lambda v: float(v.get("km_total", v.get("km", 0)) or 0), default=None)
    top_team = max(teams, key=lambda t: int(t.get("missions_done", 0) or 0), default=None)
    records = []
    persisted_best = persisted_records.get("best_mission") or {}
    if persisted_best:
        records.append({
            "key": "best_mission",
            "label": "Maior saque",
            "value": int(persisted_best.get("value", 0) or 0),
            "detail": f"{persisted_best.get('team_name', 'Equipa')} · {persisted_best.get('operation', 'Operação')}",
        })
    elif best_mission:
        records.append({
            "key": "best_mission",
            "label": "Maior saque",
            "value": int(best_mission.get("pending_reward", 0) or 0),
            "detail": f"{best_mission.get('team_name', 'Equipa')} · {(best_mission.get('opportunity') or {}).get('name', 'Operação')}",
        })
    clutch = persisted_records.get("lowest_chance_success") or {}
    if clutch:
        records.append({
            "key": "clutch_success",
            "label": "Golpe mais improvável",
            "value": round(float(clutch.get("chance", 0) or 0) * 100, 1),
            "detail": f"{clutch.get('team_name', 'Equipa')} · {clutch.get('operation', 'Operação')}",
        })
    if veteran:
        records.append({
            "key": "veteran",
            "label": "Veterano",
            "value": int(veteran.get("missions_done", 0) or 0),
            "detail": veteran.get("name", "Operacional"),
        })
    if road_car:
        records.append({
            "key": "road_car",
            "label": "Mais quilómetros",
            "value": round(float(road_car.get("km_total", road_car.get("km", 0)) or 0), 1),
            "detail": road_car.get("name", "Veículo"),
        })
    if top_team:
        records.append({
            "key": "top_team",
            "label": "Equipa mais rodada",
            "value": int(top_team.get("missions_done", 0) or 0),
            "detail": top_team.get("name", "Equipa"),
        })

    legacy = {}
    for team in teams:
        missions_done = int(team.get("missions_done", 0) or 0)
        category_missions = team.get("category_missions") or {}
        identity = max(category_missions, key=category_missions.get) if category_missions else team.get("spec")
        if missions_done >= 50:
            tier, title = 4, "Lenda"
        elif missions_done >= 25:
            tier, title = 3, "Veterana"
        elif missions_done >= 10:
            tier, title = 2, "Estabelecida"
        elif missions_done >= 3:
            tier, title = 1, "Rodada"
        else:
            tier, title = 0, "Nova"
        legacy[str(team.get("_id") or team.get("id"))] = {
            "tier": tier,
            "title": title,
            "identity": identity,
            "missions": missions_done,
            "streak": int(team.get("streak", 0) or 0),
            "next_at": (3, 10, 25, 50, None)[tier],
        }

    return {
        "world_pulse": world_pulse(now),
        "next_moves": chosen,
        "records": records,
        "team_legacy": legacy,
        "active_pressure": {
            "heat": round(float(player.get("heat", 0) or 0), 1),
            "tired_operatives": len(tired),
            "damaged_vehicles": len(damaged),
            "low_loyalty": len(low_loyalty),
        },
    }
