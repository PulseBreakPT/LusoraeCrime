from datetime import datetime, timedelta, timezone

from organization_systems import (
    SUPPLY_CATALOG, TEAM_DOCTRINES, WEAPON_UPGRADES,
    normalize_inventory, inventory_used, inventory_capacity,
    doctrine_effect, apply_weapon_upgrades, weapon_ammo_status,
    territory_weekly_cost, territory_income_per_hour,
    prestige_effects, protection_active, property_operations_factor,
)


def test_supply_catalog_has_exactly_18_stocks():
    assert len(SUPPLY_CATALOG) == 18
    assert all(item["price"] > 0 and item["pack"] > 0 for item in SUPPLY_CATALOG.values())


def test_inventory_is_backward_compatible_and_capacity_grows():
    player = {"hq": {"level": 2}, "inventory": {}, "departments": {"logistica": 2}}
    inv = normalize_inventory(player)
    assert set(SUPPLY_CATALOG).issubset(inv)
    base = inventory_capacity(player, [])
    expanded = inventory_capacity(player, [{"type_key": "armazem", "level": 2, "storage_level": 2}])
    assert expanded > base
    assert inventory_used({"medical_kit": 2}) > 0


def test_doctrine_is_a_real_tradeoff():
    cautious = doctrine_effect({"doctrine": "cautious"}, "assalto")
    aggressive = doctrine_effect({"doctrine": "aggressive"}, "assalto")
    assert cautious["chance"] > aggressive["chance"]
    assert cautious["reward"] < aggressive["reward"]
    assert cautious["heat"] < aggressive["heat"]


def test_weapon_upgrades_and_ammo_affect_model():
    base = {"reliability": 80, "accuracy": 60, "magazine_capacity": 15}
    weapon = {"model_key": "pistola", "upgrades": [{"key": "reliability"}], "ammo_loaded": 3}
    upgraded = apply_weapon_upgrades(base, weapon)
    assert upgraded["reliability"] == 84
    ammo = weapon_ammo_status("pistola", upgraded, weapon)
    assert ammo["capacity"] == 15
    assert ammo["loaded"] == 3
    assert 0 < ammo["fraction"] < 1


def test_territory_cost_and_income_scale_with_tier():
    player = {"territories": {"A": {"tier": 1, "pressure": 0}, "B": {"tier": 3, "pressure": 0}}}
    assert territory_weekly_cost(player) > 0
    assert territory_income_per_hour(player) > 850


def test_prestige_effects_stack_only_owned_items():
    player = {"prestige_items": ["ultimate_vault", "research_evasion"]}
    effects = prestige_effects(player)
    assert effects["dirty_cap_increase"] == 25000
    assert effects["heat_decay_bonus"] == 0.20


def test_protection_expiry_is_time_aware():
    now = datetime.now(timezone.utc)
    assert protection_active({"governance": {"protection_until": (now + timedelta(days=1)).isoformat()}}, now)
    assert not protection_active({"governance": {"protection_until": (now - timedelta(seconds=1)).isoformat()}}, now)


def test_property_operations_staff_and_module_stack():
    assert property_operations_factor({"operations_level": 0, "staff_employee_ids": []}) == 1.0
    assert property_operations_factor({"operations_level": 2, "staff_employee_ids": ["1", "2"]}) > 1.1


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"{len(tests)} organization system tests passed")
