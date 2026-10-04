"""Standalone retention-engine regression checks."""
from pathlib import Path
from datetime import datetime, timedelta, timezone
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from retention_engine import build_retention_snapshot, mission_decision, world_pulse


def run():
    now = datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc)

    pulse = world_pulse(now)
    assert pulse["category"] in {"assalto", "logistica", "tecnica", "influencia"}
    assert pulse["reward_mult"] > 1
    assert datetime.fromisoformat(pulse["starts_at"]) <= now < datetime.fromisoformat(pulse["ends_at"])
    assert world_pulse(now + timedelta(minutes=30))["key"] == pulse["key"]

    decision = mission_decision(
        "assalto",
        4,
        now + timedelta(seconds=20),
        now + timedelta(seconds=100),
    )
    assert decision is not None
    assert decision["status"] == "pending"
    assert [option["id"] for option in decision["options"]] == ["steady", "push", "safe"]
    steady, push, safe = decision["options"]
    assert steady["chance_delta"] == 0 and steady["reward_mult"] == 1
    assert push["chance_delta"] < 0 and push["reward_mult"] > 1 and push["heat_delta"] > 0
    assert safe["chance_delta"] > 0 and safe["reward_mult"] < 1 and safe["heat_delta"] < 0

    pending = {
        "id": "mission-1",
        "phase": "operating",
        "team_name": "Crew Alfa",
        "decision": {
            **decision,
            "opens_at": (now - timedelta(seconds=10)).isoformat(),
            "expires_at": (now + timedelta(seconds=20)).isoformat(),
        },
    }
    snapshot = build_retention_snapshot(
        now=now,
        player={
            "level": 2,
            "respect": 520,
            "next_level_respect": 1000,
            "clean_money": 20000,
            "dirty_money": 8000,
            "heat": 32,
        },
        teams=[{"id": "team-1", "name": "Crew Alfa", "status": "operating", "vehicle_id": "vehicle-1",
                "missions_done": 12, "streak": 3, "spec": "assalto",
                "category_missions": {"assalto": 9, "logistica": 3}}],
        employees=[{"id": "emp-1", "name": "Rui", "fatigue": 72, "loyalty": 80, "missions_done": 14}],
        vehicles=[{"id": "vehicle-1", "name": "Sedan", "condition": 80, "km_total": 450}],
        properties=[],
        opportunities=[{"id": "opp-1", "status": "active"}],
        missions=[pending],
        history=[{"outcome": "success", "pending_reward": 9000, "team_name": "Crew Alfa",
                  "opportunity": {"name": "Carga"}}],
        caps={"dirty_money": {"used": 8000, "max": 30000}},
        weekly_fixed_total=5000,
    )
    assert snapshot["world_pulse"]["category"] in {"assalto", "logistica", "tecnica", "influencia"}
    assert snapshot["next_moves"][0]["id"] == "live-decision"
    assert {move["horizon"] for move in snapshot["next_moves"]} == {"agora", "sessao", "plano"}
    assert snapshot["records"][0]["key"] == "best_mission"
    assert snapshot["team_legacy"]["team-1"]["title"] == "Estabelecida"
    assert snapshot["active_pressure"]["tired_operatives"] == 1

    # Short operations never generate a fake decision just to force interaction.
    assert mission_decision("tecnica", 3, now, now + timedelta(seconds=20)) is None

    print("Retention engine checks passed.")


if __name__ == "__main__":
    run()
