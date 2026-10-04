"""Calendário económico do SUBMUNDO.

Todos os custos fixos são liquidados uma vez por semana, à segunda-feira às
20:00 na timezone Europe/Lisbon. A função converte sempre para UTC antes de
persistir, por isso continua correta durante mudanças de hora.
"""
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

PORTUGAL_TZ = ZoneInfo("Europe/Lisbon")
WEEKLY_SETTLEMENT_WEEKDAY = 0  # Monday
WEEKLY_SETTLEMENT_HOUR = 20


def next_weekly_settlement(now: datetime | None = None) -> datetime:
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    local = current.astimezone(PORTUGAL_TZ)

    days = (WEEKLY_SETTLEMENT_WEEKDAY - local.weekday()) % 7
    target_date = local.date() + timedelta(days=days)
    candidate = datetime.combine(
        target_date,
        time(WEEKLY_SETTLEMENT_HOUR, 0),
        tzinfo=PORTUGAL_TZ,
    )
    if candidate <= local:
        candidate += timedelta(days=7)
    return candidate.astimezone(timezone.utc)


def is_weekly_settlement(value: datetime) -> bool:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    local = value.astimezone(PORTUGAL_TZ)
    return (
        local.weekday() == WEEKLY_SETTLEMENT_WEEKDAY
        and local.hour == WEEKLY_SETTLEMENT_HOUR
        and local.minute == 0
    )
