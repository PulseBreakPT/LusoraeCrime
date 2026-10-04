from datetime import datetime, timezone, timedelta

from city_systems import (
    world_context, season_info, business_projection, business_network_effect,
    boss_leadership_modifier,
)


def run():
    now = datetime(2026, 10, 4, 20, 0, tzinfo=timezone.utc)
    a = world_context(now, "Algarve")
    b = world_context(now + timedelta(minutes=15), "Algarve")
    assert a["weather"]["key"] == b["weather"]["key"]
    assert a["event"]["key"] == b["event"]["key"]
    assert 0.7 <= a["modifiers"]["travel_mult"] <= 1.6
    assert 0.7 <= a["modifiers"]["heat_mult"] <= 1.4
    assert 0.8 <= a["modifiers"]["reward_mult"] <= 1.4

    season = season_info(now)
    assert season["remaining_s"] >= 0
    assert datetime.fromisoformat(season["ends_at"]) - datetime.fromisoformat(season["starts_at"]) == timedelta(days=30)

    business = {
        "type_key": "bar",
        "level": 2,
        "condition": 100,
        "last_collect_at": (now - timedelta(hours=5)).isoformat(),
    }
    projection = business_projection(business, now)
    assert projection["clean"] == 2100
    assert projection["dirty"] == 400
    assert projection["heat"] > 0

    effect = business_network_effect(
        [
            {"type_key": "empresa_tecnologia", "level": 5, "condition": 100},
            {"type_key": "empresa_tecnologia", "level": 5, "condition": 100},
        ],
        "tecnica",
    )
    assert 0 < effect <= 0.06

    leadership = boss_leadership_modifier({
        "boss_health": 55,
        "boss_stress": 80,
        "boss_sentence_until": (now + timedelta(minutes=20)).isoformat(),
    }, now)
    assert leadership["sentence_until"] is not None
    assert -0.075 <= leadership["chance_delta"] < 0
    assert "detida" in leadership["label"]

    recovered = boss_leadership_modifier({
        "boss_health": 100,
        "boss_stress": 0,
        "boss_sentence_until": (now - timedelta(minutes=1)).isoformat(),
    }, now)
    assert recovered["chance_delta"] == 0
    assert recovered["sentence_until"] is None

    print("city systems: ok")


if __name__ == "__main__":
    run()
