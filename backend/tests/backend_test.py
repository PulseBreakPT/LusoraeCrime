"""Backend API tests for Lusorae MMORPG."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://underworld-ops-6.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def new_user_session():
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:10]}@lusorae.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"org_name": f"Org {uuid.uuid4().hex[:6]}", "email": email, "password": "TestPass123!"},
               timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s, email


# ---------------- Auth tests ----------------
class TestAuth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "operational"

    def test_login_admin(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL

    def test_login_invalid(self):
        # random email so we don't lock out real accounts
        email = f"nope_{uuid.uuid4().hex[:8]}@lusorae.com"
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_register_creates_player(self, new_user_session):
        s, email = new_user_session
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == email
        # verify /state provides player+team
        r = s.get(f"{BASE_URL}/api/game/state", timeout=30)
        assert r.status_code == 200
        state = r.json()
        assert state["player"]["clean_money"] == 50000
        assert state["player"]["dirty_money"] == 0
        assert len(state["teams"]) == 1
        assert state["teams"][0]["name"] == "Crew Alfa"

    def test_logout(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=15)
        assert r.status_code == 200
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401


# ---------------- Game state / catalog ----------------
class TestGameState:
    def test_catalog(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/game/catalog", timeout=15)
        assert r.status_code == 200
        cat = r.json()
        assert "team_types" in cat and "vehicle_types" in cat and "opportunity_types" in cat
        assert "assalto" in cat["team_types"]

    def test_state_structure_and_spawn(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/game/state", timeout=30)
        assert r.status_code == 200
        s = r.json()
        for k in ("player", "teams", "opportunities", "missions", "events", "server_time"):
            assert k in s
        assert s["player"]["level"] >= 1
        # spawn target for lvl 1 is 5+1*2=7
        assert len(s["opportunities"]) >= 5

    def test_state_unauth(self):
        r = requests.get(f"{BASE_URL}/api/game/state", timeout=15)
        assert r.status_code == 401


# ---------------- Dispatch flow ----------------
class TestDispatch:
    def test_dispatch_and_busy_error(self, new_user_session):
        s, _ = new_user_session
        r = s.get(f"{BASE_URL}/api/game/state", timeout=30)
        state = r.json()
        team = state["teams"][0]
        # pick any active opportunity (min_level 1 for a new player)
        opps = [o for o in state["opportunities"] if o["min_level"] <= state["player"]["level"]]
        assert opps, "no opportunities available"
        opp = opps[0]

        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=15)
        assert r.status_code == 200, r.text
        assert "mission_id" in r.json()

        # verify team is busy in next state
        r = s.get(f"{BASE_URL}/api/game/state", timeout=15)
        s2 = r.json()
        t = [t for t in s2["teams"] if t["id"] == team["id"]][0]
        assert t["status"] in ("en_route", "operating", "returning")
        assert len(s2["missions"]) >= 1

        # dispatch same team again -> 400
        opps2 = [o for o in s2["opportunities"] if o["min_level"] <= s2["player"]["level"]]
        if opps2:
            r = s.post(f"{BASE_URL}/api/game/dispatch",
                       json={"opportunity_id": opps2[0]["id"], "team_id": team["id"]}, timeout=15)
            assert r.status_code == 400

    def test_dispatch_invalid_opp(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/game/state", timeout=15)
        teams = r.json()["teams"]
        # fake ObjectId
        r = admin_session.post(f"{BASE_URL}/api/game/dispatch",
                               json={"opportunity_id": "507f1f77bcf86cd799439011",
                                     "team_id": teams[0]["id"]}, timeout=15)
        assert r.status_code == 400


# ---------------- Recruit / Vehicle ----------------
class TestRecruitVehicle:
    def test_recruit_and_insufficient(self, new_user_session):
        s, _ = new_user_session
        r = s.get(f"{BASE_URL}/api/game/state", timeout=15)
        state = r.json()
        before = state["player"]["clean_money"]
        r = s.post(f"{BASE_URL}/api/game/recruit", json={"type_key": "logistica"}, timeout=15)
        assert r.status_code == 200, r.text
        r = s.get(f"{BASE_URL}/api/game/state", timeout=15)
        state2 = r.json()
        assert state2["player"]["clean_money"] == before - 12000
        assert len(state2["teams"]) == 2

        # invalid type
        r = s.post(f"{BASE_URL}/api/game/recruit", json={"type_key": "bogus"}, timeout=15)
        assert r.status_code == 400

    def test_recruit_insufficient_money(self, new_user_session):
        s, _ = new_user_session
        # Drain by recruiting expensive teams repeatedly until we get an insufficient error
        got_400 = False
        for _ in range(6):
            r = s.post(f"{BASE_URL}/api/game/recruit", json={"type_key": "influencia"}, timeout=15)
            if r.status_code == 400:
                got_400 = True
                break
        assert got_400, "expected insufficient money at some point"

    def test_buy_vehicle(self, new_user_session):
        s, _ = new_user_session
        r = s.get(f"{BASE_URL}/api/game/state", timeout=15)
        state = r.json()
        # find an idle team
        idle = [t for t in state["teams"] if t["status"] == "idle"]
        if not idle:
            pytest.skip("no idle team")
        team = idle[0]
        before = state["player"]["clean_money"]
        r = s.post(f"{BASE_URL}/api/game/vehicle",
                   json={"team_id": team["id"], "vehicle_key": "moto"}, timeout=15)
        # may fail with insufficient money if previous test drained; both acceptable
        if r.status_code == 200:
            r = s.get(f"{BASE_URL}/api/game/state", timeout=15)
            state2 = r.json()
            assert state2["player"]["clean_money"] == before - 12000
            t = [t for t in state2["teams"] if t["id"] == team["id"]][0]
            assert t["vehicle"]["key"] == "moto"
        else:
            assert r.status_code == 400


# ---------------- Launder ----------------
class TestLaunder:
    def test_launder_insufficient(self, new_user_session):
        s, _ = new_user_session
        r = s.post(f"{BASE_URL}/api/game/launder", json={"amount": 1000}, timeout=15)
        # new user has 0 dirty
        assert r.status_code == 400

    def test_launder_invalid(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/game/launder", json={"amount": 0}, timeout=15)
        assert r.status_code == 400

    def test_launder_flow(self, admin_session):
        # Manipulate via dispatch loop: hard to guarantee dirty money in short test.
        # Instead just verify insufficient path if admin has 0 dirty; otherwise, launder positive amount.
        r = admin_session.get(f"{BASE_URL}/api/game/state", timeout=15)
        state = r.json()
        dm = state["player"]["dirty_money"]
        if dm >= 100:
            before_clean = state["player"]["clean_money"]
            r = admin_session.post(f"{BASE_URL}/api/game/launder",
                                   json={"amount": 100}, timeout=15)
            assert r.status_code == 200
            gain = r.json()["clean_gain"]
            assert gain == 75
            r = admin_session.get(f"{BASE_URL}/api/game/state", timeout=15)
            s2 = r.json()
            assert s2["player"]["clean_money"] == before_clean + 75
            assert s2["player"]["dirty_money"] == dm - 100
        else:
            r = admin_session.post(f"{BASE_URL}/api/game/launder",
                                   json={"amount": 1000}, timeout=15)
            assert r.status_code == 400
