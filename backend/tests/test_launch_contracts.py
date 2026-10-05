"""Launch-contract checks that run without MongoDB or third-party packages."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def text(name):
    return (ROOT / name).read_text(encoding="utf-8")


def repo_text(name):
    return (ROOT.parent / name).read_text(encoding="utf-8")


def require_idempotent(source, route, action=None):
    pattern = rf'@router\.post\("{re.escape(route)}"\)\s*@idempotent\("([^"]+)"\)'
    match = re.search(pattern, source)
    assert match, f"{route} is missing @idempotent"
    if action:
        assert match.group(1) == action, (route, match.group(1), action)


def run():
    game = text("routes_game.py")
    city = text("routes_city.py")
    mastermind = text("routes_mastermind.py")
    auth = text("auth.py")
    admin = text("routes_admin.py")
    engine = text("engine.py")
    automation = text("organization_automation.py")
    game_data = text("game_data.py")
    live_map = repo_text("frontend/src/components/game/LiveMap.jsx")
    guest_engine = repo_text("frontend/src/game/localGuestEngine.js")
    guest_catalog = repo_text("frontend/src/game/localGuestCatalog.js")

    # Money/state mutations most likely to be retried by browsers/mobile networks.
    for route in (
        "/shop/speedup", "/shop/buy_slot", "/shop/vip", "/shop/cosmetic",
        "/vehicles/equip_paint", "/teams/equip_emblem", "/hq/equip_skin",
        "/employees/rest", "/employees/rename", "/employees/optimize",
        "/vehicles/rename", "/vehicles/optimize", "/weapons/auto_assign",
        "/weapons/optimize", "/properties/rename",
    ):
        require_idempotent(game, route)

    for route in (
        "/heists/intel", "/heists/create", "/heists/prep/start",
        "/heists/prep/claim", "/heists/launch", "/heists/claim",
        "/heists/abort", "/market/trade", "/bounty", "/cache/scan",
    ):
        require_idempotent(mastermind, route)

    for route in (
        "/businesses/buy", "/businesses/upgrade", "/businesses/collect",
        "/rivals/action", "/casino/play", "/social/pvp",
        "/social/alliance/create", "/social/alliance/join",
        "/social/alliance/leave", "/social/alliance/transfer", "/social/alliance/kick",
        "/social/pvp/challenge",
        "/social/pvp/accept", "/social/pvp/decline", "/boss/recover",
        "/social/chat/report", "/social/chat/block",
    ):
        require_idempotent(city, route)

    # Production auth invariants.
    assert '/claim-admin' not in auth
    assert 'os.environ.get("ADMIN_PASSWORD", "admin123")' not in auth
    assert 'token_version' in auth
    assert 'Sessão revogada' in auth

    # Privacy surface introduced by Cidade Viva must be included in erasure.
    for collection in (
        "city_businesses", "city_rivals", "city_season_scores", "city_chat",
        "city_pvp_challenges", "city_chat_reports", "city_alliances",
    ):
        assert collection in auth, f"delete-account missing {collection}"

    # Admin reset and stats must understand the level-100 world.
    assert ".to_list(100)" in admin
    assert "city_chat_reports" in admin

    # State polling must never simulate the same elapsed interval twice.
    assert "simulation_lease_token" in engine
    assert "simulation_lease_until" in engine
    assert "OFFLINE_SIMULATION_MAX_MINUTES" in engine
    assert "OFFLINE_PAYROLL_MAX_CYCLES" in engine

    # Automatic organization spending claims an atomic 15-minute slot.
    assert "organization_automation_slot" in automation
    assert '"skipped": "concurrent"' in automation

    # Dispatch geometry is immutable after the backend/local engine persisted it.
    assert "validRoadPlan(mission.road_outward)" in live_map
    assert "const outward = await fetchRoute(mission.origin, mission.target);" not in live_map

    # Level-100 unlocks are a versioned contract, not a side-effect of prices.
    assert "PROGRESSION_UNLOCK_VERSION = 1" in game_data
    assert "_spread_unlocks(" not in game_data
    assert "progression_unlock_version = 1" in guest_catalog
    assert "spreadLocalUnlocks" not in guest_catalog

    # Backend and guest use the same bounded offline catch-up policy.
    assert "OFFLINE_SIMULATION_MAX_S = 28 * 24 * 3600" in guest_engine
    assert "OFFLINE_PAYROLL_MAX_CYCLES = 5" in guest_engine

    print("launch contracts: OK")


if __name__ == "__main__":
    run()
