"""Regressões da progressão SUBMUNDO 1-100.

Este ficheiro é deliberadamente executável sem MongoDB para correr cedo no CI.
"""
from economy_constants import (
    MAX_ORG_LEVEL, LEGACY_LEVEL_THRESHOLDS, LEVEL_THRESHOLDS,
    HQ_MAX_LEVEL, HQ_LEVEL_BENEFITS,
)
from game_data import (
    VEHICLE_MODELS, WEAPON_MODELS, PROPERTY_TYPES, OPPORTUNITY_TYPES,
    RECRUIT_SOURCES, ORG_LEVEL_UNLOCKS,
)
from organization_systems import TERRITORY_TIERS, ORGANIZATION_SPECIALIZATIONS
from mastermind_data import MASTERMIND_RANKS, HEIST_TARGETS


def assert_levels():
    assert MAX_ORG_LEVEL == 100
    assert len(LEVEL_THRESHOLDS) == 100
    assert LEVEL_THRESHOLDS[:10] == LEGACY_LEVEL_THRESHOLDS
    assert LEGACY_LEVEL_THRESHOLDS == [0, 400, 1200, 2800, 5500, 9500, 15000, 22000, 31000, 42000]
    assert all(a < b for a, b in zip(LEVEL_THRESHOLDS, LEVEL_THRESHOLDS[1:]))
    assert LEVEL_THRESHOLDS[-1] > LEVEL_THRESHOLDS[9]


def assert_content_distribution():
    tables = (VEHICLE_MODELS, WEAPON_MODELS, PROPERTY_TYPES, OPPORTUNITY_TYPES, RECRUIT_SOURCES)
    for table in tables:
        assert table
        for key, cfg in table.items():
            level = int(cfg.get("min_level", 1))
            assert 1 <= level <= 100, (key, level)

    assert VEHICLE_MODELS["usado"]["min_level"] == 1
    assert WEAPON_MODELS["pistola"]["min_level"] == 1
    assert PROPERTY_TYPES["esconderijo"]["min_level"] == 1
    assert RECRUIT_SOURCES["contactos"]["min_level"] == 75

    # A carreira não pode voltar a concentrar-se toda no early game.
    all_unlocks = [
        *(int(v["min_level"]) for v in VEHICLE_MODELS.values()),
        *(int(v["min_level"]) for v in WEAPON_MODELS.values()),
        *(int(v["min_level"]) for v in PROPERTY_TYPES.values()),
        *(int(v["min_level"]) for v in OPPORTUNITY_TYPES.values()),
    ]
    assert max(all_unlocks) >= 90

    assert len(ORG_LEVEL_UNLOCKS) == 100
    assert any(item["key"] == "milestone_100" for item in ORG_LEVEL_UNLOCKS[100])


def assert_hq_and_territory():
    assert HQ_MAX_LEVEL == 10
    assert len(HQ_LEVEL_BENEFITS) == 10
    assert HQ_LEVEL_BENEFITS[-1]["level"] == 10
    assert HQ_LEVEL_BENEFITS[-1]["min_org_level"] == 100
    assert "em breve" not in " ".join(str(row.get("desc", "")).lower() for row in HQ_LEVEL_BENEFITS)

    assert TERRITORY_TIERS[1]["unlock_level"] == 20
    assert TERRITORY_TIERS[2]["unlock_level"] == 45
    assert TERRITORY_TIERS[3]["unlock_level"] == 75
    assert ORGANIZATION_SPECIALIZATIONS["shadow_network"]["unlock_level"] == 50
    assert ORGANIZATION_SPECIALIZATIONS["industrial_machine"]["unlock_level"] == 65
    assert ORGANIZATION_SPECIALIZATIONS["territorial_empire"]["unlock_level"] == 80


def assert_mastermind_endgame():
    assert len(MASTERMIND_RANKS) == 10
    assert MASTERMIND_RANKS[-1]["level"] == 10
    assert MASTERMIND_RANKS[-1]["name"] == "SUBMUNDO"
    capstone = HEIST_TARGETS["submundo_capstone"]
    assert capstone["unlock_rank"] == 10
    assert capstone["min_org_level"] == 100
    target_levels = sorted(int(row.get("min_org_level", 1)) for row in HEIST_TARGETS.values())
    assert target_levels == [10, 25, 40, 55, 70, 85, 100]


if __name__ == "__main__":
    assert_levels()
    assert_content_distribution()
    assert_hq_and_territory()
    assert_mastermind_endgame()
    print("level-100 progression: OK")
