"""Standalone economy regression checks for Portugal 2026 balance."""
from pathlib import Path
from datetime import datetime, timezone
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from economy_constants import (
    INITIAL_CLEAN_MONEY,
    EMPLOYER_SOCIAL_SECURITY_RATE,
    PROPERTY_MAINTENANCE_PCT_PER_DAY,
    PROPERTY_MAINTENANCE_PCT_PER_WEEK,
    VEHICLE_ANNUAL_FIXED_COSTS,
    VEHICLE_REPAIR_BASE_MULTIPLIER,
    FUEL_PRICES,
    LAUNDER_BASE_RATE,
    LAUNDER_MAX_RATE,
    LAUNDER_PASSIVE_RATE,
)
from reward_config import (
    MONEY_REWARD_MIN,
    MONEY_REWARD_MAX,
    BASE_REWARD_PER_RISK,
    ORG_LEVEL_MULTIPLIER_PER_LEVEL,
)
from reward_engine import calculate_money_reward
from property_market import property_market_price
from economy_calendar import next_weekly_settlement, is_weekly_settlement, PORTUGAL_TZ


def run():
    assert INITIAL_CLEAN_MONEY == 100000
    assert EMPLOYER_SOCIAL_SECURITY_RATE == 0.2375
    assert FUEL_PRICES == {"gasolina": 2.12, "gasoleo": 2.22}
    assert 0 < PROPERTY_MAINTENANCE_PCT_PER_DAY < 0.0002
    assert abs(PROPERTY_MAINTENANCE_PCT_PER_WEEK - PROPERTY_MAINTENANCE_PCT_PER_DAY * 7) < 1e-12
    assert VEHICLE_REPAIR_BASE_MULTIPLIER == 0.003
    assert VEHICLE_ANNUAL_FIXED_COSTS["usado"] == 1250
    assert VEHICLE_ANNUAL_FIXED_COSTS["supercarro"] == 6000
    assert (LAUNDER_BASE_RATE, LAUNDER_PASSIVE_RATE, LAUNDER_MAX_RATE) == (0.78, 0.82, 0.90)

    rewards = []
    for risk in range(1, 6):
        value = calculate_money_reward(
            difficulty_score=1.0,
            risk=risk,
            org_level=1,
            category="assalto",
            is_rare_mission=False,
            multiplier_stack=1.0,
            repeat_count=0,
        )
        rewards.append(value)
        assert MONEY_REWARD_MIN <= value <= MONEY_REWARD_MAX

    assert rewards == sorted(rewards)
    assert len(set(rewards)) == 5
    assert BASE_REWARD_PER_RISK[1] < BASE_REWARD_PER_RISK[5]
    assert ORG_LEVEL_MULTIPLIER_PER_LEVEL <= 0.12

    garage_base = 55000
    lisboa = property_market_price(garage_base, 38.7223, -9.1393)
    algarve = property_market_price(garage_base, 37.0194, -7.9304)
    interior = property_market_price(garage_base, 38.57, -7.91)
    assert lisboa["zone"] == "Lisboa" and lisboa["price"] == 71500
    assert algarve["zone"] == "Algarve" and algarve["price"] == 60500
    assert interior["zone"] == "Interior" and interior["price"] == 46500
    assert lisboa["price"] > algarve["price"] > interior["price"]

    # O fecho fixo é sempre segunda-feira às 20:00 em Portugal, mesmo com DST.
    reference = datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc)  # sábado
    settlement = next_weekly_settlement(reference)
    local = settlement.astimezone(PORTUGAL_TZ)
    assert local.weekday() == 0
    assert (local.hour, local.minute) == (20, 0)
    assert is_weekly_settlement(settlement)

    # A equipa inicial deve ter custos semanais plausíveis e inferiores a uma
    # operação de risco 2, sem tornar o primeiro ciclo automaticamente deficitário.
    initial_gross = 500 + 450
    employer_ss = round(initial_gross * EMPLOYER_SOCIAL_SECURITY_RATE)
    fleet_weekly = round(VEHICLE_ANNUAL_FIXED_COSTS["usado"] / 52)
    initial_weekly_cost = initial_gross + employer_ss + fleet_weekly
    assert 1100 <= initial_weekly_cost <= 1300
    assert rewards[1] > initial_weekly_cost * 2

    print("Portugal 2026 economy regression checks: OK")
    print("base rewards:", rewards)
    print("initial weekly fixed cost:", initial_weekly_cost)


if __name__ == "__main__":
    run()
