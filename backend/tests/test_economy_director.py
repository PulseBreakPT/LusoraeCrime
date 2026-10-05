"""Pure regression tests for the global SUBMUNDO economy director."""
from economy_director import (
    CAREER_ECONOMY_BANDS,
    career_economy_band,
    reward_ceiling,
    guard_reward,
    city_business_cap,
    passive_portfolio_scale,
)


def test_career_bands_are_monotonic():
    previous = None
    for level, floor, target, ceiling in CAREER_ECONOMY_BANDS:
        assert 1 <= level <= 100
        assert 0 < floor <= target <= ceiling
        if previous:
            assert floor >= previous[0]
            assert target >= previous[1]
            assert ceiling >= previous[2]
        previous = (floor, target, ceiling)


def test_interpolation_and_caps_scale_to_endgame():
    low = career_economy_band(1)
    mid = career_economy_band(50)
    end = career_economy_band(100)
    assert low["ceiling_per_hour"] < mid["ceiling_per_hour"] < end["ceiling_per_hour"]
    assert reward_ceiling(100, "mastermind") == 1_600_000
    assert reward_ceiling(100, "operation") == 400_000
    assert guard_reward(9_999_999, 100, "mastermind") == 1_600_000


def test_passive_portfolio_is_scaled_to_the_same_career_envelope():
    # Level 1 ceiling is 18k/h: a 36k one-hour portfolio is halved.
    assert passive_portfolio_scale(1, 1, 18_000, 18_000) == 0.5
    assert passive_portfolio_scale(100, 2, 80_000, 80_000) == 1.0


def test_city_business_capacity_is_bounded_and_progressive():
    assert city_business_cap(1) == 2
    assert city_business_cap(10) == 3
    assert city_business_cap(50) == 7
    assert city_business_cap(100) == 12
    assert city_business_cap(999) == 12


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"{len(tests)} economy director checks passed")
