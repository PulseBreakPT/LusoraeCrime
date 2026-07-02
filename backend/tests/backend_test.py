"""Backend API tests for Lusorae — iteration 2 (advanced logic).
Covers: auth/register (75k clean+5k dirty, Crew Alfa, 2 muscles w/ attrs, Sedan Usado),
dispatch/preview, dispatch persists success_chance, stats/history counters,
training (course attr +1), refuel/repair counters, launder counter,
hire/team-create/vehicles-buy/properties buy/upgrade/sell caps guards, police bribe,
dispatch input validation."""

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"

TIMEOUT = 30


# ---------------- Helpers ----------------
def register_new():
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:10]}@lusorae.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"org_name": f"Org{uuid.uuid4().hex[:6]}",
                     "email": email, "password": "TestPass123!"},
               timeout=TIMEOUT)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s, email


def get_state(s):
    r = s.get(f"{BASE_URL}/api/game/state", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login",
               json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=TIMEOUT)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def fresh_user():
    s, email = register_new()
    return s, email


# ---------------- Auth & bootstrap ----------------
class TestAuthBootstrap:
    def test_root_status(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("status") == "operational"

    def test_me_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_register_starter_pack(self):
        s, _ = register_new()
        st = get_state(s)
        # capital
        assert st["player"]["clean_money"] == 75000
        assert st["player"]["dirty_money"] == 5000
        # player.stats
        stats = st["player"].get("stats") or {}
        assert "missions_total" in stats and stats["missions_total"] == 0
        assert "by_category" in stats and "earned_dirty" in stats and "laundered_total" in stats
        # Crew Alfa idle
        assert len(st["teams"]) == 1
        assert st["teams"][0]["name"] == "Crew Alfa"
        assert st["teams"][0]["spec"] == "assalto"
        # 2 muscles with attrs (4 keys) and role attr with bonus (forca >=3)
        emps = st["employees"]
        assert len(emps) == 2
        for e in emps:
            assert e["role_key"] == "musculo"
            assert set(e["attrs"].keys()) == {"forca", "destreza", "qi", "carisma"}
            assert e["attrs"]["forca"] >= 3  # base 1..3 +2 bonus
        # 1 Sedan Usado assigned to Crew Alfa
        vehs = st["vehicles"]
        assert len(vehs) == 1
        assert vehs[0]["model_key"] == "usado"
        assert vehs[0]["team_id"] == st["teams"][0]["id"]
        # caps
        assert st["caps"]["employees"] == {"used": 2, "max": 4}
        assert st["caps"]["vehicles"] == {"used": 1, "max": 2}


# ---------------- Catalog ----------------
class TestCatalog:
    def test_catalog_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200
        c = r.json()
        for k in ("team_specs", "employee_roles", "training_courses", "emp_level_xp",
                  "vehicle_models", "property_types", "opportunity_types", "base_caps",
                  "team_create_cost", "fuel_prices", "property_max_level"):
            assert k in c, f"missing {k}"
        # employee roles carry attr
        assert c["employee_roles"]["musculo"]["attr"] == "forca"
        # training courses carry attr where applicable
        assert c["training_courses"]["conducao"]["attr"] == "destreza"


# ---------------- Dispatch preview + persist ----------------
class TestDispatchPreview:
    def test_preview_returns_breakdown(self, fresh_user):
        s, _ = fresh_user
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        opp = opps[0]
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("chance", "breakdown", "eta_s", "duration_s", "fuel_needed",
                  "reward", "members", "effective_speed"):
            assert k in data, f"missing {k}"
        assert 0.15 <= data["chance"] <= 0.97
        for k in ("base", "risco", "equipa", "calor", "match"):
            assert k in data["breakdown"]
        assert data["members"] >= 1
        assert data["fuel_needed"] > 0

    def test_preview_busy_team_400(self, fresh_user):
        s, _ = fresh_user
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        # dispatch to make busy
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        # try preview with same busy team
        st2 = get_state(s)
        remaining = [o for o in st2["opportunities"] if o["min_level"] <= st2["player"]["level"]]
        if remaining:
            r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                       json={"opportunity_id": remaining[0]["id"], "team_id": team["id"]},
                       timeout=TIMEOUT)
            assert r.status_code == 400

    def test_mission_persists_success_chance_and_history(self, fresh_user):
        """After the previous test dispatched a mission, verify success_chance is stored."""
        s, _ = fresh_user
        st = get_state(s)
        # active mission list must include success_chance
        assert st["missions"], "expected an active mission from previous test"
        m = st["missions"][0]
        assert m.get("success_chance") is not None
        assert 0.15 <= m["success_chance"] <= 0.97


# ---------------- Dispatch validation ----------------
class TestDispatchValidation:
    def test_invalid_opp(self, admin_session):
        st = get_state(admin_session)
        r = admin_session.post(f"{BASE_URL}/api/game/dispatch",
                               json={"opportunity_id": "507f1f77bcf86cd799439011",
                                     "team_id": st["teams"][0]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_dispatch_without_members(self):
        """Register a user, remove members via new empty team → 400 no members."""
        s, _ = register_new()
        # Create a new team (5000 €) — it has no members and no vehicle
        r = s.post(f"{BASE_URL}/api/game/teams/create", json={"spec": "logistica"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st = get_state(s)
        empty = [t for t in st["teams"] if t["name"] != "Crew Alfa"][0]
        opp = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]][0]
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": empty["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        # should mention either members or vehicle
        assert "veículo" in r.text.lower() or "membros" in r.text.lower() or "funcion" in r.text.lower()


# ---------------- Hire caps, team create cost ----------------
class TestHireAndTeams:
    def test_team_create_cost(self):
        s, _ = register_new()
        before = get_state(s)["player"]["clean_money"]
        r = s.post(f"{BASE_URL}/api/game/teams/create", json={"spec": "tecnica"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert get_state(s)["player"]["clean_money"] == before - 5000

    def test_hire_cap_enforced(self):
        s, _ = register_new()
        # already 2 muscles; cap 4 → 2 more allowed, 3rd extra should fail
        r1 = s.post(f"{BASE_URL}/api/game/employees/hire", json={"role_key": "musculo"}, timeout=TIMEOUT)
        r2 = s.post(f"{BASE_URL}/api/game/employees/hire", json={"role_key": "musculo"}, timeout=TIMEOUT)
        r3 = s.post(f"{BASE_URL}/api/game/employees/hire", json={"role_key": "musculo"}, timeout=TIMEOUT)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r3.status_code == 400  # cap 4 reached


# ---------------- Vehicles ----------------
class TestVehicles:
    def test_min_level_lock(self):
        s, _ = register_new()
        # supercarro requires level 5
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "supercarro"}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "nível" in r.text.lower() or "n\\u00edvel" in r.text.lower()

    def test_buy_within_cap_and_repair_counters(self):
        s, _ = register_new()
        # already 1 usado, cap 2 → buy 1 moto ok, third fails
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r.status_code == 200
        r2 = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r2.status_code == 400  # cap
        # refuel not needed (fuel_l == tank_l initially) → 400
        st = get_state(s)
        v = st["vehicles"][0]
        r3 = s.post(f"{BASE_URL}/api/game/vehicles/refuel", json={"vehicle_id": v["id"]}, timeout=TIMEOUT)
        assert r3.status_code == 400  # tank full
        # repair perfect condition → 400
        r4 = s.post(f"{BASE_URL}/api/game/vehicles/repair", json={"vehicle_id": v["id"]}, timeout=TIMEOUT)
        assert r4.status_code == 400


# ---------------- Properties ----------------
class TestProperties:
    def test_buy_upgrade_sell_caps_guard(self):
        s, _ = register_new()
        # buy garagem (15000, min_level 1) → cap_vehicles +2 → 2 → 4
        r = s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "garagem"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st = get_state(s)
        assert st["caps"]["vehicles"]["max"] == 4
        prop_id = st["properties"][0]["id"]
        # buy 2 extra motos so we have 3 vehicles (needs cap 4)
        s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        st2 = get_state(s)
        assert st2["caps"]["vehicles"]["used"] == 3
        # selling garagem would drop cap to 2 → we have 3 vehicles → guard 400
        r = s.post(f"{BASE_URL}/api/game/properties/sell", json={"property_id": prop_id}, timeout=TIMEOUT)
        assert r.status_code == 400
        # upgrade works
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade", json={"property_id": prop_id}, timeout=TIMEOUT)
        assert r.status_code == 200
        st3 = get_state(s)
        assert st3["properties"][0]["level"] == 2

    def test_min_level_property(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "laboratorio"}, timeout=TIMEOUT)
        assert r.status_code == 400  # requires level 3


# ---------------- Launder counter ----------------
class TestLaunder:
    def test_launder_invalid_amount(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/game/launder", json={"amount": 0}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_launder_increments_stat(self):
        s, _ = register_new()
        # starter has 5000 dirty
        before = get_state(s)["player"]["stats"].get("laundered_total", 0)
        r = s.post(f"{BASE_URL}/api/game/launder", json={"amount": 1000}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["clean_gain"] == 750
        st = get_state(s)
        assert st["player"]["stats"]["laundered_total"] == before + 1000
        assert st["player"]["dirty_money"] == 4000


# ---------------- Police bribe ----------------
class TestPolice:
    def test_bribe_requires_heat(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/police/bribe", timeout=TIMEOUT)
        assert r.status_code == 400  # heat < 10


# ---------------- Training ----------------
class TestTraining:
    def test_training_grants_attr(self):
        """Long test: waits for a training course to complete and validates +1 attr."""
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        base_destreza = emp["attrs"]["destreza"]
        # conducao → destreza, duration 100s
        r = s.post(f"{BASE_URL}/api/game/employees/train",
                   json={"employee_id": emp["id"], "course_key": "conducao"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        # verify status training
        st2 = get_state(s)
        e2 = [e for e in st2["employees"] if e["id"] == emp["id"]][0]
        assert e2["status"] == "training"
        # wait a bit over course duration (100s) — poll
        deadline = time.time() + 140
        while time.time() < deadline:
            time.sleep(15)
            st3 = get_state(s)  # hits /state which advances state + completes trainings
            e3 = [e for e in st3["employees"] if e["id"] == emp["id"]][0]
            if e3["status"] == "idle":
                assert e3["attrs"]["destreza"] == min(10, base_destreza + 1)
                assert e3["xp"] >= 50
                return
        pytest.fail("training did not complete in time")
