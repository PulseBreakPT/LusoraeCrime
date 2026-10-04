"""Dynamic organization management events.

Events are intentionally managerial rather than random punishment: every event
has a visible trade-off, a deadline and two deterministic choices.  The engine
only spawns them; resolution is handled atomically by the organization routes.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import random
import uuid


EVENT_DEFS = {
    "supplier_shock": {
        "title": "Fornecedor sob pressão",
        "description": "Um fornecedor-chave quer rever condições. Podes imobilizar caixa para garantir material ou aceitar custos piores durante alguns dias.",
        "options": [
            {"key": "stockpile", "label": "Garantir stock", "hint": "6 000 € · recebe material de manutenção"},
            {"key": "ration", "label": "Racionar", "hint": "Sem custo imediato · compras +12% durante 3 dias"},
        ],
    },
    "staff_dispute": {
        "title": "Tensão no efetivo",
        "description": "O ritmo de operações está a criar desgaste interno. Uma resposta financeira melhora retenção; disciplina preserva caixa mas custa moral.",
        "options": [
            {"key": "bonus", "label": "Prémio extraordinário", "hint": "Custo proporcional ao efetivo · moral e lealdade sobem"},
            {"key": "hold_line", "label": "Manter disciplina", "hint": "Sem custo · pequena queda de moral/lealdade"},
        ],
    },
    "rival_ultimatum": {
        "title": "Pressão rival coordenada",
        "description": "Uma organização rival está a testar as tuas zonas. Reforçar agora custa caixa; ignorar transfere o custo para defesa e pressão territorial.",
        "options": [
            {"key": "reinforce", "label": "Reforçar posições", "hint": "7 500 € · baixa pressão e sobe defesa"},
            {"key": "ignore", "label": "Absorver pressão", "hint": "Sem custo · territórios ficam mais vulneráveis"},
        ],
    },
    "information_leak": {
        "title": "Possível fuga de informação",
        "description": "Há sinais de informação operacional fora do circuito. Conter a fuga custa caro; ignorar aumenta a exposição policial.",
        "options": [
            {"key": "contain", "label": "Conter imediatamente", "hint": "12 000 € · reduz calor"},
            {"key": "absorb", "label": "Aceitar o risco", "hint": "Sem custo · calor aumenta"},
        ],
    },
    "maintenance_backlog": {
        "title": "Manutenção acumulada",
        "description": "As bases estão a acumular pequenas falhas. Uma intervenção preventiva recupera condição; adiar acelera a degradação.",
        "options": [
            {"key": "preventive", "label": "Intervenção preventiva", "hint": "5 000 € · melhora condição das bases"},
            {"key": "defer", "label": "Adiar trabalhos", "hint": "Sem custo · condição das bases baixa"},
        ],
    },
}


def parse_dt(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def schedule_next_event(now: datetime) -> str:
    return (now + timedelta(minutes=random.randint(120, 360))).isoformat()


def maybe_spawn_organization_event(
    player: dict,
    *,
    now: datetime | None = None,
    employee_count: int = 0,
    property_count: int = 0,
    territory_count: int = 0,
) -> dict | None:
    now = now or datetime.now(timezone.utc)
    current = player.get("organization_event")
    if current and current.get("status", "pending") == "pending":
        expires = parse_dt(current.get("expires_at"))
        if not expires or expires > now:
            return current
        current = {**current, "status": "expired", "resolved_at": now.isoformat()}
        player["organization_event"] = current

    due = parse_dt(player.get("next_organization_event_at"))
    if due and due > now:
        return None
    if due is None and not current:
        player["next_organization_event_at"] = schedule_next_event(now)
        return None

    candidates = ["information_leak"]
    if employee_count:
        candidates.append("staff_dispute")
    if property_count:
        candidates.extend(["supplier_shock", "maintenance_backlog"])
    if territory_count:
        candidates.extend(["rival_ultimatum", "rival_ultimatum"])

    key = random.choice(candidates)
    cfg = EVENT_DEFS[key]
    event = {
        "id": uuid.uuid4().hex,
        "type": key,
        "title": cfg["title"],
        "description": cfg["description"],
        "options": cfg["options"],
        "status": "pending",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=8)).isoformat(),
    }
    player["organization_event"] = event
    player["next_organization_event_at"] = schedule_next_event(now)
    return event


def public_event(event: dict | None) -> dict | None:
    if not event or event.get("status") != "pending":
        return None
    expires = parse_dt(event.get("expires_at"))
    if expires and expires <= datetime.now(timezone.utc):
        return None
    cfg = EVENT_DEFS.get(event.get("type"), {})
    return {
        "id": event.get("id"),
        "type": event.get("type"),
        "title": event.get("title") or cfg.get("title"),
        "description": event.get("description") or cfg.get("description"),
        "options": event.get("options") or cfg.get("options") or [],
        "created_at": event.get("created_at"),
        "expires_at": event.get("expires_at"),
    }
