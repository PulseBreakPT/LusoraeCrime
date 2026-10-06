from datetime import datetime, timezone

from operational_director import (
    READINESS_LOCKED,
    READINESS_PLAYABLE,
    READINESS_STRETCH,
    build_follow_up_opportunity,
    capability_snapshot,
    classify_opportunity_readiness,
    district_profile,
    operation_requirements,
    reinforcement_effect,
)


def _opp(**overrides):
    base = {
        "category": "assalto",
        "risk": 3,
        "profile": "confrontation",
        "min_members": 2,
        "required_models": [],
        "type_key": "assalto",
        "name": "Assalto",
        "reward": 3000,
        "respect": 8,
        "heat": 4,
        "pays": "dirty",
        "min_level": 1,
        "district": "Centro",
    }
    base.update(overrides)
    return base


def test_requirements_scale_with_risk():
    low = operation_requirements(_opp(risk=2))
    high = operation_requirements(_opp(risk=5))
    assert low["support_teams"] == 0
    assert high["support_teams"] == 2
    assert "combate_operacional" in high["required_certifications"]


def test_readiness_uses_real_capabilities():
    teams = [{"_id": "t1", "status": "idle"}, {"_id": "t2", "status": "idle"}]
    employees = [
        {
            "_id": "e1",
            "team_id": "t1",
            "status": "idle",
            "fatigue": 10,
            "role_key": "assaltante",
            "certifications": ["combate_operacional"],
        },
        {
            "_id": "e2",
            "team_id": "t2",
            "status": "idle",
            "fatigue": 10,
            "role_key": "motorista",
            "certifications": ["conducao_avancada"],
        },
    ]
    vehicles = [{"model_key": "usado", "condition": 90}]
    caps = capability_snapshot({"inventory": {"medical_kit": 1}}, teams, employees, vehicles, [])
    ready = classify_opportunity_readiness(_opp(risk=3), caps)
    assert ready["state"] in {READINESS_PLAYABLE, READINESS_STRETCH}

    caps_no_role = capability_snapshot(
        {"inventory": {}},
        teams,
        [{**employees[1], "role_key": "motorista"}],
        vehicles,
        [],
    )
    blocked = classify_opportunity_readiness(_opp(risk=3), caps_no_role)
    assert blocked["state"] == READINESS_LOCKED


def test_district_profile_is_stable():
    district = {"key": "d7", "name": "Zona Industrial", "ring": 1}
    assert district_profile(district)["key"] == "industrial"
    assert district_profile(district) == district_profile(district)


def test_reinforcement_has_bounded_effect():
    mission = {"opportunity": {"category": "assalto"}}
    team = {"name": "Bravo", "spec": "assalto"}
    members = [{"id": "1"}, {"id": "2"}, {"id": "3"}]
    fx = reinforcement_effect(mission, team, members, {"condition": 90})
    assert 0 < fx["chance_delta"] <= 0.07
    assert fx["injury_mult"] < 1


def test_follow_up_never_exceeds_stage_cap():
    mission = {
        "_id": "507f1f77bcf86cd799439011",
        "player_id": "p1",
        "chain_stage": 3,
        "opportunity": {
            "type_key": "assalto",
            "name": "Operação",
            "category": "assalto",
            "district": "Centro",
            "reward": 5000,
            "respect": 8,
            "risk": 4,
            "heat": 6,
            "pays": "dirty",
            "min_level": 1,
        },
        "target": {"lat": 38.72, "lng": -9.14},
    }
    assert build_follow_up_opportunity(mission, "success", datetime.now(timezone.utc)) is None


if __name__ == "__main__":
    test_requirements_scale_with_risk()
    test_readiness_uses_real_capabilities()
    test_district_profile_is_stable()
    test_reinforcement_has_bounded_effect()
    test_follow_up_never_exceeds_stage_cap()
    print("Operational director checks passed.")
