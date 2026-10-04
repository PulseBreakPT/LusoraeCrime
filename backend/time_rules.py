"""Pure local-time rules for Portugal gameplay windows."""

from datetime import timezone
from zoneinfo import ZoneInfo

PORTUGAL_TZ = ZoneInfo("Europe/Lisbon")


def portugal_hour_allowed(hours, now) -> bool:
    """Return whether an aware/naive UTC instant is inside a local Portugal window."""
    if not hours:
        return True
    start, end = hours
    base = now if now.tzinfo else now.replace(tzinfo=timezone.utc)
    local_now = base.astimezone(PORTUGAL_TZ)
    h = local_now.hour
    if start <= end:
        return start <= h < end
    return h >= start or h < end
