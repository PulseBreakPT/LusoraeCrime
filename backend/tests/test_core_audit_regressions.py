"""Regression checks for the SSS gameplay audit fixes."""
from datetime import datetime, timezone

from engine import hour_allowed
from game_data import operation_profile_of
from reward_engine import calculate_money_reward
from travel_metrics import road_mission_metrics


def test_operation_hours_follow_portugal_local_time():
    # 1 July 2026: Lisbon is UTC+1. 21:30 UTC is 22:30 local and the
    # 22:00-05:00 VIP window must already be open.
    assert hour_allowed("operacao_vip", datetime(2026, 7, 1, 21, 30, tzinfo=timezone.utc))
    # 20:30 UTC is 21:30 local: still closed.
    assert not hour_allowed("operacao_vip", datetime(2026, 7, 1, 20, 30, tzinfo=timezone.utc))


def test_road_metrics_use_real_out_and_return_distances():
    metrics = road_mission_metrics(
        {"distance": 12_000},
        {"distance": 14_000},
        {"cons": 8.0},
        10.0,
    )
    assert metrics["out_m"] == 12_000
    assert metrics["in_m"] == 14_000
    assert metrics["round_km"] == 26
    assert abs(metrics["fuel_needed"] - 2.08) < 1e-9
    assert metrics["travel_s"] == 1200
    assert metrics["return_travel_s"] == 1400


def test_operation_profiles_create_real_mechanical_families():
    assert operation_profile_of("ciberataque_bancario", "tecnica") == "digital"
    assert operation_profile_of("rota_internacional", "logistica") == "mobility"
    assert operation_profile_of("operacao_fantasma", "especial") == "stealth"
    assert operation_profile_of("chantagem_politico", "influencia") == "influence"
    assert operation_profile_of("assalto_blindado", "assalto") == "confrontation"


def test_repeat_penalty_and_rare_bonus_have_correct_direction():
    common = calculate_money_reward(
        difficulty_score=1.2, risk=3, org_level=3, category="assalto",
        is_rare_mission=False, multiplier_stack=1.0, repeat_count=0,
    )
    repeated = calculate_money_reward(
        difficulty_score=1.2, risk=3, org_level=3, category="assalto",
        is_rare_mission=False, multiplier_stack=1.0, repeat_count=1,
    )
    rare = calculate_money_reward(
        difficulty_score=1.2, risk=3, org_level=3, category="assalto",
        is_rare_mission=True, multiplier_stack=1.0, repeat_count=0,
    )
    assert repeated < common < rare


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"{len(tests)} core audit regression checks passed")
