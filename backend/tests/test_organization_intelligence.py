from datetime import datetime, timedelta, timezone

from organization_intelligence import (
    build_organization_intelligence,
    organization_policy,
    quote_action,
)
from organization_events import maybe_spawn_organization_event, public_event


def sample_player():
    return {
        "_id": "p1",
        "level": 7,
        "clean_money": 80000,
        "dirty_money": 10000,
        "heat": 24,
        "hq": {"level": 5},
        "inventory": {
            "medical_kit": 0,
            "service_fluids": 1,
            "vehicle_parts": 1,
            "tire_set": 0,
        },
        "departments": {"logistica": 2, "financeiro": 1},
        "territories": {
            "Centro": {"tier": 1, "defense": 30, "pressure": 82},
        },
        "organization_policy": {
            "reserve_cash": 30000,
            "max_single_spend_pct": 0.25,
            "stock_targets": {"medical_kit": 4},
            "automation": {"enabled": True, "auto_restock": True},
        },
    }


def test_intelligence_surfaces_real_operational_risks():
    player = sample_player()
    now = datetime.now(timezone.utc)
    snapshot = build_organization_intelligence(
        player=player,
        teams=[{
            "_id": "t1", "name": "Crew Alfa", "status": "idle", "vehicle_id": "v1",
            "loadout": {"medical_kit": 1}, "doctrine": "balanced",
        }],
        employees=[{
            "_id": "e1", "team_id": "t1", "fatigue": 76, "morale": 45,
            "loyalty": 70, "salary": 1200,
        }],
        vehicles=[{
            "_id": "v1", "name": "Ibiza", "price": 15000, "condition": 52,
            "tires_pct": 28, "km_total": 6200, "last_service_km": 0,
            "insurance_until": (now - timedelta(days=1)).isoformat(),
            "inspection_due_at": (now + timedelta(days=5)).isoformat(),
        }],
        weapons=[],
        properties=[{
            "_id": "pr1", "name": "Armazém", "condition": 60,
            "staff_employee_ids": [], "security_level": 0, "storage_level": 1,
            "operations_level": 0, "market_multiplier": 1.0,
        }],
        transactions=[
            {"amount": -12000, "ts": now.isoformat()},
            {"amount": 5000, "ts": now.isoformat()},
        ],
        weekly_fixed_total=7000,
        now=now,
    )
    assert snapshot["health"]["score"] < 90
    assert snapshot["alert_counts"]["critical"] >= 3
    assert any(a["code"] == "stock:medical_kit" for a in snapshot["alerts"])
    assert any(a["code"] == "territory:Centro" for a in snapshot["alerts"])
    vehicle = snapshot["fleet"][0]
    assert vehicle["costs"]["service"] < vehicle["costs"]["service_base"]
    assert next(row for row in snapshot["stock"] if row["key"] == "medical_kit")["buy_price"] > 0


def test_policy_is_clamped_and_backward_compatible():
    policy = organization_policy({
        "organization_policy": {
            "reserve_cash": -5,
            "max_single_spend_pct": 9,
            "stock_targets": {"medical_kit": 12, "fake": 999},
            "automation": {"enabled": 1, "unknown": True},
        }
    })
    assert policy["reserve_cash"] == 0
    assert policy["max_single_spend_pct"] == 1.0
    assert policy["stock_targets"] == {"medical_kit": 12}
    assert policy["automation"]["enabled"] is True
    assert "unknown" not in policy["automation"]


def test_quote_warns_before_breaking_cash_reserve():
    player = sample_player()
    player["clean_money"] = 31000
    quote = quote_action(
        action="department_upgrade",
        player=player,
        payload={"department_key": "financeiro"},
    )
    assert quote["cost"] > 0
    assert quote["breaks_reserve"] is True
    assert quote["warnings"]
    assert quote["cash_after"] == player["clean_money"] - quote["cost"]


def test_supply_quote_includes_logistics_discount():
    player = sample_player()
    quote = quote_action(
        action="supply_buy",
        player=player,
        payload={"item_key": "medical_kit", "packs": 1},
    )
    assert 0 < quote["cost"] < 280
    assert quote["eligible"] is True


def test_management_events_are_scheduled_then_become_decisions():
    now = datetime.now(timezone.utc)
    player = {}
    assert maybe_spawn_organization_event(player, now=now, employee_count=3, property_count=1, territory_count=1) is None
    assert player.get("next_organization_event_at")
    player["next_organization_event_at"] = (now - timedelta(seconds=1)).isoformat()
    event = maybe_spawn_organization_event(player, now=now, employee_count=3, property_count=1, territory_count=1)
    assert event is not None
    assert event["status"] == "pending"
    assert len(event["options"]) == 2
    assert public_event(event)["id"] == event["id"]


def test_weekly_budgets_create_actionable_alerts_and_progression():
    player = sample_player()
    player["organization_policy"]["weekly_budgets"] = {
        "supplies": 1000,
        "fleet": 1000,
        "infrastructure": 0,
        "territory": 0,
        "people": 0,
    }
    now = datetime.now(timezone.utc)
    snapshot = build_organization_intelligence(
        player=player,
        teams=[],
        employees=[{"_id": "e1", "salary": 1000, "fatigue": 0, "morale": 80, "loyalty": 80}],
        vehicles=[],
        weapons=[],
        properties=[],
        transactions=[
            {"kind": "supply_buy", "amount": -850, "ts": now.isoformat()},
            {"kind": "vehicle_service", "amount": -1200, "ts": now.isoformat()},
        ],
        weekly_fixed_total=1500,
        now=now,
    )
    budgets = {row["key"]: row for row in snapshot["finance"]["budgets"]}
    assert budgets["supplies"]["status"] == "warning"
    assert budgets["fleet"]["status"] == "over"
    assert any(alert["code"] == "budget:fleet" for alert in snapshot["alerts"])
    assert snapshot["organization"]["level"] >= 1
    assert 0 <= snapshot["organization"]["progression"]["progress_pct"] <= 100


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"{len(tests)} organization intelligence tests passed")
