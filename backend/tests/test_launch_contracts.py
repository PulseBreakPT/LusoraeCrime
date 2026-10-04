"""Launch-contract checks that run without MongoDB or third-party packages."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def text(name):
    return (ROOT / name).read_text(encoding="utf-8")


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
        "/social/alliance/leave", "/social/pvp/challenge",
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

    print("launch contracts: OK")


if __name__ == "__main__":
    run()
