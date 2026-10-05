"""Global economy guardrails for SUBMUNDO.

The game intentionally has different payout formulas (operations, quests, city,
Mastermind), but all of them pass through the same career envelope.  The
director is deliberately permissive: normal tuned rewards are unchanged; it
only catches multiplier explosions, duplicate-content farms and future balance
changes that would create an outlier economy.
"""
from __future__ import annotations


# level, sustainable floor/h, target/h, hard ceiling/h (clean-equivalent euros)
CAREER_ECONOMY_BANDS = (
    (1, 1_200, 4_500, 18_000),
    (10, 2_500, 9_000, 22_500),
    (25, 5_000, 18_000, 30_000),
    (50, 9_000, 32_000, 45_000),
    (75, 15_000, 50_000, 60_000),
    (100, 22_000, 70_000, 80_000),
)

# A burst reward may represent several hours of progression in one result.
SOURCE_BURST_HOURS = {
    "operation": 5.0,
    "quest": 3.0,
    "mastermind": 20.0,
    "city_cache": 2.0,
    "season": 30.0,
}


def _level(value) -> int:
    return max(1, min(100, int(value or 1)))


def _interpolate(level: int, index: int) -> float:
    level = _level(level)
    previous = CAREER_ECONOMY_BANDS[0]
    if level <= previous[0]:
        return float(previous[index])
    for current in CAREER_ECONOMY_BANDS[1:]:
        if level <= current[0]:
            span = current[0] - previous[0]
            t = (level - previous[0]) / max(1, span)
            return float(previous[index]) + (float(current[index]) - float(previous[index])) * t
        previous = current
    return float(CAREER_ECONOMY_BANDS[-1][index])


def career_economy_band(level: int) -> dict:
    """Return the global sustainable money envelope for an organization level."""
    return {
        "level": _level(level),
        "floor_per_hour": round(_interpolate(level, 1)),
        "target_per_hour": round(_interpolate(level, 2)),
        "ceiling_per_hour": round(_interpolate(level, 3)),
    }


def reward_ceiling(level: int, source: str) -> int:
    band = career_economy_band(level)
    hours = float(SOURCE_BURST_HOURS.get(source, 5.0))
    return max(1, int(round(band["ceiling_per_hour"] * hours)))


def guard_reward(amount: int | float, level: int, source: str) -> int:
    """Clamp a positive payout to the shared career envelope."""
    value = max(0, int(round(float(amount or 0))))
    return min(value, reward_ceiling(level, source))


def passive_hourly_ceiling(level: int) -> int:
    """Network-wide ceiling used as a last-resort guard for passive systems."""
    return career_economy_band(level)["ceiling_per_hour"]


def passive_portfolio_scale(level: int, hours: float, clean: int | float, dirty: int | float) -> float:
    """Scale an aggregate passive payout into the career envelope.

    Accumulated offline income may cover several hours, so the ceiling grows
    with the longest collection window instead of treating the whole claim as
    one instantaneous hour.
    """
    window_h = max(0.0, float(hours or 0.0))
    total = max(0.0, float(clean or 0.0)) + max(0.0, float(dirty or 0.0))
    if total <= 0 or window_h <= 0:
        return 1.0
    ceiling = passive_hourly_ceiling(level) * window_h
    return max(0.0, min(1.0, ceiling / total))


def city_business_cap(level: int) -> int:
    """Portfolio size grows with the career instead of allowing infinite copies."""
    level = _level(level)
    return min(12, 2 + level // 10)
