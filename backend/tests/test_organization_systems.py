from datetime import datetime, timedelta, timezone

from organization_systems import (
    SUPPLY_CATALOG, TEAM_DOCTRINES, TEAM_PRESETS, WEAPON_UPGRADES,
    normalize_inventory, inventory_used, inventory_capacity,
    doctrine_effect, apply_weapon_upgrades, weapon_ammo_status,
    territory_weekly_cost, territory_income_per_hour,
    prestige_effects, protection_active, protection_risk_multiplier,
    property_operations_factor, loadout_effect, rival_profile,
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


def test_every_team_preset_references_real_systems():
    assert len(TEAM_PRESETS) >= 5
    for preset in TEAM_PRESETS.values():
        assert preset["doctrine"] in TEAM_DOCTRINES
        assert preset["loadout"]
        assert all(key in SUPPLY_CATALOG for key in preset["loadout"])


def test_signal_and_documents_change_real_mission_effects():
    base = loadout_effect({}, "tecnica")
    prepared = loadout_effect({"signal_kit": 1, "fake_docs": 1}, "tecnica")
    assert prepared["chance"] > base["chance"]
    assert prepared["heat"] < base["heat"]


def test_governance_trust_and_exposure_are_real_tradeoffs():
    now = datetime.now(timezone.utc)
    until = (now + timedelta(days=10)).isoformat()
    trusted = protection_risk_multiplier({"governance": {"protection_until": until, "trust": 90, "exposure": 5}}, now)
    exposed = protection_risk_multiplier({"governance": {"protection_until": until, "trust": 10, "exposure": 90}}, now)
    assert trusted < exposed < 1.0


def test_rival_profile_is_stable_per_district():
    a = rival_profile("Centro 1")
    b = rival_profile("Centro 1")
    c = rival_profile("Norte 2")
    assert a == b
    assert a["name"]
    assert 20 <= a["strength"] <= 100
    assert a != c


if __name__ == "__main__":
    tests = [value for name, value in globals().items() if name.startswith("test_") and callable(value)]
    for test in tests:
        test()
    print(f"{len(tests)} organization system tests passed")
