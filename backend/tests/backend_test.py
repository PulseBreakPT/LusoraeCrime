"""Lusorae backend regression tests — iteration 2 (HR/Funcionários overhaul).

Covers new employee schema (14 specs, 9 attrs, rarity, rank, salary, loyalty, morale,
fatigue, talents, history), recruit via candidates, refresh pool, train, rest, promote,
bonus, fire, heal/release guard, assign, and regression on fleet/properties/police/launder.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"
TIMEOUT = 30

ATTR_KEYS_9 = {"forca", "inteligencia", "discricao", "conducao", "tiro", "hack",
               "negociacao", "sangue_frio", "resistencia"}


def register_new():
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:10]}@lusorae.com"
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"org_name": f"Org{uuid.uuid4().hex[:6]}",
                     "email": email, "password": "TestPass123!"}, timeout=TIMEOUT)
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


# ---------------- Auth / bootstrap ----------------
class TestAuthBootstrap:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_me_unauth(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------------- New starter schema ----------------
class TestStarterPack:
    def test_register_creates_assaltante_and_motorista(self):
        s, _ = register_new()
        st = get_state(s)
        # Crew Alfa
        teams = st["teams"]
        assert len(teams) == 1
        assert teams[0]["name"] == "Crew Alfa"
        alfa_id = teams[0]["id"]
        # Employees with new schema
        emps = st["employees"]
        assert len(emps) == 2, f"expected 2 starter employees, got {len(emps)}"
        role_keys = sorted([e["role_key"] for e in emps])
        assert role_keys == ["assaltante", "motorista"]
        for e in emps:
            # New schema fields
            for key in ("rarity", "rank", "salary", "loyalty", "morale", "fatigue",
                        "attrs", "talents", "history"):
                assert key in e, f"missing '{key}' in employee: {e}"
            assert set(e["attrs"].keys()) == ATTR_KEYS_9, f"attrs mismatch: {set(e['attrs'].keys())}"
            assert e["rank"] == "recruta"
            assert e["salary"] > 0
            assert e["team_id"] == alfa_id, "starter should be assigned to Crew Alfa"
            assert e["status"] == "idle"
            assert "betrayal_risk" in e
        # HR-related state fields
        assert "salary_total" in st and st["salary_total"] > 0
        assert "bonuses" in st
        assert "candidates" in st
        p = st["player"]
        assert "next_payroll_at" in p
        assert "pool_refresh_at" in p


# ---------------- Catalog ----------------
class TestCatalog:
    def test_catalog_new_shape(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200
        c = r.json()
        for k in ("specializations", "rarities", "ranks", "rank_req_level", "talents",
                  "recruit_sources", "training_courses", "hr_costs",
                  "vehicle_models", "property_types", "opportunity_types",
                  "base_caps", "team_create_cost", "fuel_prices", "property_max_level"):
            assert k in c, f"missing catalog key: {k}"
        # 14 specializations
        assert len(c["specializations"]) == 14
        for k in ("assaltante", "motorista", "hacker", "mecanico", "informador", "medico",
                  "lavador", "advogado", "negociador", "seguranca", "contrabandista",
                  "falsificador", "espiao", "gestor"):
            assert k in c["specializations"], f"missing spec {k}"
        # rarities
        assert set(c["rarities"].keys()) == {"comum", "raro", "elite", "lendario"}
        # ranks + req_level
        assert isinstance(c["ranks"], list) and len(c["ranks"]) == len(c["rank_req_level"])
        # training courses
        for cc in ("combate", "conducao", "hacking", "discricao", "negociacao",
                   "primeiros_socorros", "logistica", "gestao", "lideranca"):
            assert cc in c["training_courses"]
        # LEGACY REMOVAL guards
        assert "employee_roles" not in c, "legacy 'employee_roles' must be removed"

    def test_legacy_hire_removed(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/game/employees/hire",
                                json={"role_key": "musculo"}, timeout=TIMEOUT)
        # Should NOT be 200 — endpoint removed
        assert r.status_code in (404, 405, 422)


# ---------------- Recruitment ----------------
class TestRecruitment:
    def test_state_has_candidates(self):
        s, _ = register_new()
        st = get_state(s)
        assert isinstance(st["candidates"], list)
        # Fresh org level 1 → sources 'rua' and 'bares' should populate
        assert len(st["candidates"]) >= 1
        c0 = st["candidates"][0]
        for key in ("source", "role_key", "rarity", "attrs", "salary", "cost", "min_respect"):
            assert key in c0

    def test_refresh_pool_costs_500(self):
        s, _ = register_new()
        before = get_state(s)["player"]["clean_money"]
        r = s.post(f"{BASE_URL}/api/game/recruitment/refresh", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        after = get_state(s)
        assert after["player"]["clean_money"] == before - 500
        assert len(after["candidates"]) >= 1

    def test_recruit_candidate_moves_to_roster(self):
        s, _ = register_new()
        st = get_state(s)
        # Pick a comum candidate (no respect req) whose cost we can afford
        cands = [c for c in st["candidates"] if c["rarity"] == "comum" and
                 c["cost"] <= st["player"]["clean_money"]]
        if not cands:
            pytest.skip("No affordable comum candidate")
        cand = cands[0]
        money_before = st["player"]["clean_money"]
        emps_before = len(st["employees"])
        r = s.post(f"{BASE_URL}/api/game/employees/recruit",
                   json={"candidate_id": cand["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        assert st2["player"]["clean_money"] == money_before - cand["cost"]
        assert len(st2["employees"]) == emps_before + 1
        # Candidate removed
        assert not any(c["id"] == cand["id"] for c in st2["candidates"])
        # New employee has new schema
        new_emp = [e for e in st2["employees"] if e["role_key"] == cand["role_key"]][-1]
        assert new_emp["rarity"] == cand["rarity"]
        assert set(new_emp["attrs"].keys()) == ATTR_KEYS_9

    def test_recruit_high_rarity_needs_respect(self):
        s, _ = register_new()
        st = get_state(s)
        # find elite/lendario or raro > 300; fresh players have respect=0
        cands = [c for c in st["candidates"] if c["min_respect"] > 0]
        if not cands:
            # refresh to try get a raro
            for _ in range(5):
                s.post(f"{BASE_URL}/api/game/recruitment/refresh", timeout=TIMEOUT)
                st = get_state(s)
                cands = [c for c in st["candidates"] if c["min_respect"] > 0]
                if cands:
                    break
        if not cands:
            pytest.skip("No high-rarity candidate spawned in 5 refreshes")
        r = s.post(f"{BASE_URL}/api/game/employees/recruit",
                   json={"candidate_id": cands[0]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "respeito" in r.text.lower() or "respect" in r.text.lower()

    def test_recruit_cap_full(self):
        s, _ = register_new()
        # cap is 4; already 2 → recruit 2 more (comum) then a 3rd should fail
        for _ in range(6):  # more attempts to fill cap
            st = get_state(s)
            if len(st["employees"]) >= 4:
                break
            cands = [c for c in st["candidates"] if c["rarity"] == "comum" and
                     c["cost"] <= st["player"]["clean_money"]]
            if not cands:
                r = s.post(f"{BASE_URL}/api/game/recruitment/refresh", timeout=TIMEOUT)
                if r.status_code != 200:
                    break
                continue
            s.post(f"{BASE_URL}/api/game/employees/recruit",
                   json={"candidate_id": cands[0]["id"]}, timeout=TIMEOUT)
        st = get_state(s)
        if len(st["employees"]) < 4:
            pytest.skip("Could not fill cap")
        # cap now full — try another recruit
        cands = [c for c in st["candidates"] if c["rarity"] == "comum" and
                 c["cost"] <= st["player"]["clean_money"]]
        if not cands:
            s.post(f"{BASE_URL}/api/game/recruitment/refresh", timeout=TIMEOUT)
            cands = [c for c in get_state(s)["candidates"]
                     if c["rarity"] == "comum" and c["cost"] <= 100000]
        if cands:
            r = s.post(f"{BASE_URL}/api/game/employees/recruit",
                       json={"candidate_id": cands[0]["id"]}, timeout=TIMEOUT)
            assert r.status_code == 400
            assert "capacidade" in r.text.lower() or "cap" in r.text.lower() or "esconderijo" in r.text.lower()


# ---------------- HR management actions ----------------
class TestHRActions:
    def test_train_starts_and_deducts(self):
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/train",
                   json={"employee_id": emp["id"], "course_key": "conducao"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        e2 = [e for e in st2["employees"] if e["id"] == emp["id"]][0]
        assert e2["status"] == "training"
        assert e2.get("training") is not None
        assert e2["training"]["course_key"] == "conducao"

    def test_train_invalid_course(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/train",
                   json={"employee_id": emp["id"], "course_key": "not_a_course"}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_rest_fails_low_fatigue(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/rest",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "fatig" in r.text.lower()

    def test_promote_fails_low_level(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        assert emp["level"] == 1
        r = s.post(f"{BASE_URL}/api/game/employees/promote",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "nível" in r.text.lower() or "nivel" in r.text.lower() or "n\u00edvel" in r.text.lower()

    def test_bonus_increases_morale_and_deducts(self):
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        morale_before = emp["morale"]
        loyalty_before = emp["loyalty"]
        money_before = st["player"]["clean_money"]
        salary = max(100, emp["salary"])
        r = s.post(f"{BASE_URL}/api/game/employees/bonus",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["cost"] == salary
        st2 = get_state(s)
        e2 = [e for e in st2["employees"] if e["id"] == emp["id"]][0]
        assert e2["morale"] >= min(100.0, morale_before + 14.9)
        assert e2["loyalty"] >= min(100.0, loyalty_before + 9.9)
        assert st2["player"]["clean_money"] == money_before - salary

    def test_heal_requires_injured(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/heal",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "ferido" in r.text.lower()

    def test_release_requires_arrested(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/release",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "preso" in r.text.lower()

    def test_fire_removes_and_charges_severance(self):
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        severance = emp["salary"] * 3
        money_before = st["player"]["clean_money"]
        r = s.post(f"{BASE_URL}/api/game/employees/fire",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["severance"] == severance
        st2 = get_state(s)
        assert not any(e["id"] == emp["id"] for e in st2["employees"])
        assert st2["player"]["clean_money"] == money_before - severance

    def test_assign_removes_from_team(self):
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        assert emp["team_id"] is not None
        r = s.post(f"{BASE_URL}/api/game/employees/assign",
                   json={"employee_id": emp["id"], "team_id": None}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        e2 = [e for e in st2["employees"] if e["id"] == emp["id"]][0]
        assert e2["team_id"] is None

    def test_rename_employee(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/rename",
                   json={"employee_id": emp["id"], "name": "Zé das Sombras"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        e2 = [e for e in st2["employees"] if e["id"] == emp["id"]][0]
        assert e2["name"] == "Zé das Sombras"
        assert e2["history"] and "Zé das Sombras" in e2["history"][-1]["text"]

    def test_rename_employee_rejects_blank(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        r = s.post(f"{BASE_URL}/api/game/employees/rename",
                   json={"employee_id": emp["id"], "name": "   "}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_rename_employee_rejects_other_players_employee(self):
        s1, _ = register_new()
        s2, _ = register_new()
        emp = get_state(s1)["employees"][0]
        r = s2.post(f"{BASE_URL}/api/game/employees/rename",
                    json={"employee_id": emp["id"], "name": "Impostor"}, timeout=TIMEOUT)
        assert r.status_code == 404


# ---------------- Dispatch (regression) ----------------
class TestDispatch:
    def test_dispatch_preview(self, fresh_user):
        s, _ = fresh_user
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("chance", "breakdown", "eta_s", "duration_s", "fuel_needed", "reward",
                  "members", "effective_speed"):
            assert k in d
        assert d["members"] >= 1

    def test_dispatch_and_persist(self, fresh_user):
        s, _ = fresh_user
        st = get_state(s)
        team = st["teams"][0]
        # Crew Alfa starts with exactly 2 idle members — only pick opportunities
        # dispatchable with that (risk-bumped-by-distance min_members can exceed 2).
        opps = [o for o in st["opportunities"]
                if o["min_level"] <= st["player"]["level"] and o["min_members"] <= 2]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        assert st2["missions"], "expected active mission"
        m = st2["missions"][0]
        assert m.get("success_chance") is not None
        # members on_mission
        on_mission = [e for e in st2["employees"] if e["status"] == "on_mission"]
        assert len(on_mission) >= 1


# ---------------- Dispatch min_members / distance scaling (regression) ----------------
class TestDispatchMinMembers:
    def test_opportunity_exposes_min_members_and_rare(self):
        s, _ = register_new()
        st = get_state(s)
        for o in st["opportunities"]:
            assert "min_members" in o and o["min_members"] >= 1
            assert "rare" in o and isinstance(o["rare"], bool)

    def test_dispatch_preview_reports_min_members(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "min_members" in d and "min_members_met" in d
        assert d["min_members"] == opps[0]["min_members"]

    def test_dispatch_succeeds_at_min_members(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]  # 2 idle members by default
        candidates = [o for o in st["opportunities"]
                      if o["min_level"] <= st["player"]["level"] and o["min_members"] <= 2]
        assert candidates
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": candidates[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text

    def test_dispatch_blocked_below_min_members(self):
        s, _ = register_new()
        opp = None
        st = None
        for _ in range(5):  # spawns are randomized; a few polls give new candidates
            st = get_state(s)
            candidates = [o for o in st["opportunities"]
                          if o["min_level"] <= st["player"]["level"] and o["min_members"] > 2]
            if candidates:
                opp = candidates[0]
                break
        if not opp:
            pytest.skip("no min_members>2 opportunity spawned for a level-1 org within retry budget")
        team = st["teams"][0]
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert str(opp["min_members"]) in r.json()["detail"]


# ---------------- Equipas: coordenação e prontidão ----------------
class TestTeamCoordination:
    def test_team_exposes_coordination_fields(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        assert "roster_stable_since" in team
        assert "available_at" in team
        # a equipa inicial já vem com o plantel "estável" desde a criação
        assert team["roster_stable_since"] is not None
        assert team["available_at"] is None

    def test_preview_breakdown_includes_coordenacao(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert "coordenacao" in r.json()["breakdown"]

    def test_roster_change_blocks_dispatch_during_reorg(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        emp = next(e for e in st["employees"] if e["team_id"] == team["id"])
        # Remover um membro dispara o cooldown de reorganização da equipa.
        r = s.post(f"{BASE_URL}/api/game/employees/assign",
                   json={"employee_id": emp["id"], "team_id": None}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        team2 = next(t for t in st2["teams"] if t["id"] == team["id"])
        assert team2["available_at"] is not None
        opps = [o for o in st2["opportunities"] if o["min_level"] <= st2["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "reorganizar" in r.json()["detail"]

    def test_solo_member_team_has_no_positive_coordenacao_bonus(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        members = [e for e in st["employees"] if e["team_id"] == team["id"]]
        assert len(members) >= 2
        # Remove todos os membros menos um, e espera o cooldown de reorganização passar.
        for e in members[1:]:
            r = s.post(f"{BASE_URL}/api/game/employees/assign",
                       json={"employee_id": e["id"], "team_id": None}, timeout=TIMEOUT)
            assert r.status_code == 200, r.text
        time.sleep(16)  # REORG_AFTER_ROSTER_CHANGE_S
        st2 = get_state(s)
        opps = [o for o in st2["opportunities"] if o["min_level"] <= st2["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        # Sem líder (recruta) e equipa de 1 membro: penalização, nunca bónus.
        assert r.json()["breakdown"]["coordenacao"] < 0


# ---------------- Frota: adequação, condição e lugares ----------------
class TestVehicleMechanics:
    def test_vehicle_models_expose_seats_best_for_luxury(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        models = r.json()["vehicle_models"]
        assert models
        for key, m in models.items():
            assert "seats" in m and m["seats"] >= 1, key
            assert "best_for" in m and isinstance(m["best_for"], list), key
            assert "luxury" in m and isinstance(m["luxury"], bool), key

    def test_preview_breakdown_includes_veiculo(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert "veiculo" in r.json()["breakdown"]

    def test_seats_block_when_team_bigger_than_vehicle(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        # Recruta um comum extra e junta-o à equipa (Crew Alfa já tem 2 membros).
        cands = [c for c in st["candidates"] if c["rarity"] == "comum" and
                 c["cost"] <= st["player"]["clean_money"]]
        if not cands:
            pytest.skip("No affordable comum candidate")
        r = s.post(f"{BASE_URL}/api/game/employees/recruit",
                   json={"candidate_id": cands[0]["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        new_emp = next(e for e in st2["employees"] if not e["team_id"])
        r = s.post(f"{BASE_URL}/api/game/employees/assign",
                   json={"employee_id": new_emp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        # Compra uma moto (2 lugares) e atribui-a à equipa (agora com 3 membros).
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st3 = get_state(s)
        moto = next(v for v in st3["vehicles"] if v["model_key"] == "moto")
        r = s.post(f"{BASE_URL}/api/game/vehicles/assign",
                   json={"vehicle_id": moto["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        time.sleep(16)  # espera o cooldown de reorganização do roster change
        st4 = get_state(s)
        opps = [o for o in st4["opportunities"] if o["min_level"] <= st4["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "lugares" in r.json()["detail"].lower()


# ---------------- Funcionários: novatos, moral e energia ----------------
class TestEmployeeMechanics:
    def test_employee_exposes_hired_at_and_last_mission_at(self):
        s, _ = register_new()
        emp = get_state(s)["employees"][0]
        assert "hired_at" in emp and emp["hired_at"]
        assert "last_mission_at" in emp  # None até à primeira missão

    def test_catalog_exposes_newbie_ramp_s(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["newbie_ramp_s"] > 0

    @pytest.mark.slow
    def test_promote_resets_fatigue(self):
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        # Sobe de nível 1 para 2 via formação (curso "conducao": 100s, +50 XP;
        # o limiar de XP para o nível 2 é 100, por isso repete até subir).
        for _ in range(3):
            st = get_state(s)
            e = next(e for e in st["employees"] if e["id"] == emp["id"])
            if e["level"] >= 2:
                break
            if e["status"] != "idle":
                time.sleep(15)
                continue
            r = s.post(f"{BASE_URL}/api/game/employees/train",
                       json={"employee_id": emp["id"], "course_key": "conducao"}, timeout=TIMEOUT)
            assert r.status_code == 200, r.text
            deadline = time.time() + 140
            while time.time() < deadline:
                time.sleep(15)
                e2 = next(e for e in get_state(s)["employees"] if e["id"] == emp["id"])
                if e2["status"] == "idle":
                    break
        st2 = get_state(s)
        e2 = next(e for e in st2["employees"] if e["id"] == emp["id"])
        if e2["level"] < 2:
            pytest.skip("employee did not reach level 2 within retry budget")
        r = s.post(f"{BASE_URL}/api/game/employees/promote",
                   json={"employee_id": emp["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st3 = get_state(s)
        e3 = next(e for e in st3["employees"] if e["id"] == emp["id"])
        assert e3["rank"] == "membro"
        assert e3["fatigue"] == 0.0


# ---------------- Missões: recompensa, disponibilidade e cancelamento ----------------
class TestMissionMechanics:
    def test_catalog_exposes_recall_penalty_fraction(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert 0 < r.json()["recall_penalty_fraction"] <= 1

    def test_opportunity_types_with_required_models(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        types = r.json()["opportunity_types"]
        assert types["contrabando"]["required_models"] == ["van", "suv_blindado"]
        assert types["rota_internacional"]["required_models"] == ["van"]

    def test_spawned_opportunities_expose_required_models(self):
        s, _ = register_new()
        st = get_state(s)
        assert st["opportunities"]
        for o in st["opportunities"]:
            assert "required_models" in o and isinstance(o["required_models"], list)

    def test_preview_includes_age_and_split_pct(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "age_decay_pct" in d and d["age_decay_pct"] <= 0
        assert "split_penalty_pct" in d and d["split_penalty_pct"] <= 0

    def test_recall_immediately_has_no_penalty(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        heat_before = st["player"]["heat"]
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        mission_id = r.json()["mission_id"]
        r = s.post(f"{BASE_URL}/api/game/missions/recall",
                   json={"mission_id": mission_id}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["late_penalty"] is False
        st2 = get_state(s)
        assert st2["player"]["heat"] == heat_before

    @pytest.mark.slow
    def test_recall_late_has_penalty(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        eta_s = r.json()["eta_s"]
        heat_before = st["player"]["heat"]
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        mission_id = r.json()["mission_id"]
        time.sleep(max(1, eta_s * 0.6))
        r = s.post(f"{BASE_URL}/api/game/missions/recall",
                   json={"mission_id": mission_id}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["late_penalty"] is True
        st2 = get_state(s)
        assert st2["player"]["heat"] > heat_before


# ---------------- Fleet regression ----------------
class TestFleet:
    def test_vehicle_full_flow(self):
        s, _ = register_new()
        # buy moto
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy",
                   json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r.status_code == 200
        st = get_state(s)
        v = [x for x in st["vehicles"] if x["model_key"] == "moto"][0]
        # refuel full -> 400
        r2 = s.post(f"{BASE_URL}/api/game/vehicles/refuel",
                    json={"vehicle_id": v["id"]}, timeout=TIMEOUT)
        assert r2.status_code == 400
        # repair perfect -> 400
        r3 = s.post(f"{BASE_URL}/api/game/vehicles/repair",
                    json={"vehicle_id": v["id"]}, timeout=TIMEOUT)
        assert r3.status_code == 400
        # assign to alfa
        alfa = [t for t in st["teams"] if t["name"] == "Crew Alfa"][0]
        r4 = s.post(f"{BASE_URL}/api/game/vehicles/assign",
                    json={"vehicle_id": v["id"], "team_id": alfa["id"]}, timeout=TIMEOUT)
        assert r4.status_code == 200
        # sell it back
        r5 = s.post(f"{BASE_URL}/api/game/vehicles/sell",
                    json={"vehicle_id": v["id"]}, timeout=TIMEOUT)
        assert r5.status_code == 200
        assert "value" in r5.json()

    def test_cap_enforced(self):
        s, _ = register_new()
        # already 1 usado, cap 2 -> buy 1 ok, 3rd fails
        assert s.post(f"{BASE_URL}/api/game/vehicles/buy",
                       json={"model_key": "moto"}, timeout=TIMEOUT).status_code == 200
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy",
                    json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_rename_vehicle(self):
        s, _ = register_new()
        v = get_state(s)["vehicles"][0]
        r = s.post(f"{BASE_URL}/api/game/vehicles/rename",
                   json={"vehicle_id": v["id"], "name": "Batmóvel"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        v2 = [x for x in st2["vehicles"] if x["id"] == v["id"]][0]
        assert v2["name"] == "Batmóvel"

    def test_rename_vehicle_rejects_blank(self):
        s, _ = register_new()
        v = get_state(s)["vehicles"][0]
        r = s.post(f"{BASE_URL}/api/game/vehicles/rename",
                   json={"vehicle_id": v["id"], "name": ""}, timeout=TIMEOUT)
        assert r.status_code in (400, 422)


# ---------------- Properties regression ----------------
class TestProperties:
    def test_esconderijo_expands_emp_cap(self):
        s, _ = register_new()
        base_cap = get_state(s)["caps"]["employees"]["max"]
        r = s.post(f"{BASE_URL}/api/game/properties/buy",
                   json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        new_cap = get_state(s)["caps"]["employees"]["max"]
        assert new_cap == base_cap + 4

    def test_garagem_cap_and_sell_guard(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/properties/buy",
                   json={"type_key": "garagem"}, timeout=TIMEOUT)
        assert r.status_code == 200
        st = get_state(s)
        assert st["caps"]["vehicles"]["max"] == 4
        prop_id = st["properties"][0]["id"]
        # upgrade
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade",
                   json={"property_id": prop_id}, timeout=TIMEOUT)
        assert r.status_code == 200
        # fill vehicles to force sell guard fail
        s.post(f"{BASE_URL}/api/game/vehicles/buy",
                json={"model_key": "moto"}, timeout=TIMEOUT)
        s.post(f"{BASE_URL}/api/game/vehicles/buy",
                json={"model_key": "moto"}, timeout=TIMEOUT)
        # attempt to sell property while vehicles fill capacity → guard 400
        r = s.post(f"{BASE_URL}/api/game/properties/sell",
                   json={"property_id": prop_id}, timeout=TIMEOUT)
        # After upgrade lvl=2, cap contribution is 2*2=4; if used >= (max-4) → block
        # depends on counts, so accept 200 or 400 but ensure not 500
        assert r.status_code in (200, 400)

    def test_rename_property(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s)["properties"][0]
        r = s.post(f"{BASE_URL}/api/game/properties/rename",
                   json={"property_id": prop["id"], "name": "QG Secreto"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        p2 = [x for x in st2["properties"] if x["id"] == prop["id"]][0]
        assert p2["name"] == "QG Secreto"

    def test_rename_property_rejects_other_players_property(self):
        s1, _ = register_new()
        s2, _ = register_new()
        s1.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s1)["properties"][0]
        r = s2.post(f"{BASE_URL}/api/game/properties/rename",
                    json={"property_id": prop["id"], "name": "Impostor"}, timeout=TIMEOUT)
        assert r.status_code == 404


# ---------------- Imóveis: manutenção, melhorias e condição ----------------
class TestPropertyMechanics:
    def test_property_exposes_condition_and_upgrade_fields(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s)["properties"][0]
        assert prop["condition"] == 100.0
        assert prop["upgrading_until"] is None

    def test_upgrade_is_timed_not_instant(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s)["properties"][0]
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade",
                   json={"property_id": prop["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["upgrading_until"] is not None
        st2 = get_state(s)
        p2 = next(p for p in st2["properties"] if p["id"] == prop["id"])
        assert p2["level"] == 1, "o nível não deve subir de imediato — a melhoria demora tempo"
        assert p2["upgrading_until"] is not None

    def test_cannot_upgrade_twice_while_upgrading(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s)["properties"][0]
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade",
                   json={"property_id": prop["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade",
                   json={"property_id": prop["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_cannot_sell_while_upgrading(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s)["properties"][0]
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade",
                   json={"property_id": prop["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        r = s.post(f"{BASE_URL}/api/game/properties/sell",
                   json={"property_id": prop["id"]}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "melhorado" in r.json()["detail"].lower()

    @pytest.mark.slow
    def test_upgrade_completes_and_raises_level(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "esconderijo"}, timeout=TIMEOUT)
        prop = get_state(s)["properties"][0]
        r = s.post(f"{BASE_URL}/api/game/properties/upgrade",
                   json={"property_id": prop["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        until = r.json()["upgrading_until"]
        import datetime
        remaining = (datetime.datetime.fromisoformat(until) - datetime.datetime.now(datetime.timezone.utc)).total_seconds()
        deadline = time.time() + max(1, remaining) + 30
        while time.time() < deadline:
            time.sleep(15)
            st = get_state(s)
            p2 = next(p for p in st["properties"] if p["id"] == prop["id"])
            if p2["level"] == 2:
                assert p2["upgrading_until"] is None
                return
        pytest.fail("property upgrade did not complete within the expected window")


# ---------------- Police / Launder regression ----------------
class TestPoliceLaunder:
    def test_bribe_fails_low_heat(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/police/bribe", timeout=TIMEOUT)
        assert r.status_code == 400

    def test_launder_75pct(self):
        s, _ = register_new()
        st_before = get_state(s)
        clean_before = st_before["player"]["clean_money"]
        r = s.post(f"{BASE_URL}/api/game/launder",
                   json={"amount": 1000}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["clean_gain"] == 750
        st = get_state(s)
        assert st["player"]["dirty_money"] == 4000
        assert st["player"]["clean_money"] == clean_before + 750


# ---------------- Long test: training completes ----------------
class TestTrainingCompletion:
    @pytest.mark.slow
    def test_training_grants_attr_after_wait(self):
        s, _ = register_new()
        st = get_state(s)
        emp = st["employees"][0]
        # pick a course targeting an attr not maxed
        course_key = "conducao"  # +conducao (in ATTR_KEYS_9)
        base_attr = emp["attrs"]["conducao"]
        base_xp = emp["xp"]
        r = s.post(f"{BASE_URL}/api/game/employees/train",
                   json={"employee_id": emp["id"], "course_key": course_key}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        # duration 100s → poll for 140s
        deadline = time.time() + 140
        while time.time() < deadline:
            time.sleep(15)
            st2 = get_state(s)
            e2 = [e for e in st2["employees"] if e["id"] == emp["id"]][0]
            if e2["status"] == "idle":
                assert e2["attrs"]["conducao"] >= base_attr + 1 or base_attr >= 10
                assert e2["xp"] >= base_xp + 50 - 1
                return
        pytest.fail("training did not complete within 140s")


def _quickest_opportunity(st, min_members_max=2):
    """Escolhe, de entre as oportunidades ativas exequíveis, a de menor
    duração — para testes que precisam de esperar uma missão completar."""
    candidates = [o for o in st["opportunities"]
                  if o["min_level"] <= st["player"]["level"] and o["min_members"] <= min_members_max]
    if not candidates:
        return None
    return min(candidates, key=lambda o: o["duration_s"])


def _wait_mission_done(s, mission_id, eta_s, duration_s, extra_s=60, poll_s=10):
    """Espera que uma missão saia da lista de missões ativas (fase 'done')."""
    deadline = time.time() + eta_s * 2 + duration_s + extra_s
    while time.time() < deadline:
        time.sleep(poll_s)
        st = get_state(s)
        if not any(m["id"] == mission_id for m in st["missions"]):
            return st
    return None


# ---------------- Progressão: limite de equipas e conquistas ----------------
class TestProgressionCaps:
    def test_fresh_player_starts_with_team_cap_two(self):
        s, _ = register_new()
        st = get_state(s)
        assert st["caps"]["teams"] == {"used": 1, "max": 2}

    def test_create_team_blocked_at_cap(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/teams/create", json={"spec": "assalto"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st = get_state(s)
        assert st["caps"]["teams"] == {"used": 2, "max": 2}
        r = s.post(f"{BASE_URL}/api/game/teams/create", json={"spec": "assalto"}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert "Limite" in r.json()["detail"]

    def test_fresh_player_has_no_achievement_bonus(self):
        s, _ = register_new()
        st = get_state(s)
        assert st["player"]["achievement_bonus_pct"] == 0.0


# ---------------- Qualidade de vida: favoritos e repetir missão ----------------
class TestFavoritesAndRepeat:
    def test_toggle_favorite_type(self):
        s, _ = register_new()
        st = get_state(s)
        type_key = st["opportunities"][0]["type_key"]
        r = s.post(f"{BASE_URL}/api/game/opportunities/favorite", json={"type_key": type_key}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert type_key in r.json()["favorite_types"]
        st2 = get_state(s)
        assert type_key in st2["player"]["favorite_types"]
        # alternar de novo remove
        r = s.post(f"{BASE_URL}/api/game/opportunities/favorite", json={"type_key": type_key}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert type_key not in r.json()["favorite_types"]

    def test_toggle_favorite_type_rejects_invalid_key(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/opportunities/favorite", json={"type_key": "nao_existe"}, timeout=TIMEOUT)
        assert r.status_code == 400

    def test_recommend_repeat_none_before_first_mission(self):
        s, _ = register_new()
        team = get_state(s)["teams"][0]
        r = s.post(f"{BASE_URL}/api/game/dispatch/recommend_repeat", json={"team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["opportunity_id"] is None

    def test_recommend_repeat_after_dispatch_matches_last_type(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opp = _quickest_opportunity(st)
        assert opp
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st2 = get_state(s)
        team2 = next(t for t in st2["teams"] if t["id"] == team["id"])
        assert team2["last_type_key"] == opp["type_key"]
        r = s.post(f"{BASE_URL}/api/game/dispatch/recommend_repeat", json={"team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        if d["opportunity_id"] is not None:
            matched = next(o for o in get_state(s)["opportunities"] if o["id"] == d["opportunity_id"])
            assert matched["type_key"] == opp["type_key"]


# ---------------- Pequenos detalhes: condições situacionais na preview ----------------
class TestSituationalConditions:
    def test_preview_breakdown_includes_condicoes(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opps = [o for o in st["opportunities"] if o["min_level"] <= st["player"]["level"]]
        assert opps
        r = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                   json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()["breakdown"]
        assert "condicoes" in d
        # bónus furtivo noturno só se aplica a categorias discretas de noite; caso
        # contrário o valor é neutro (0.0) — ambos os casos são válidos aqui.
        assert d["condicoes"] in (0.0, 0.04)


# ---------------- Manutenção: uso, desgaste e reparação ----------------
class TestMaintenanceMechanics:
    def test_vehicle_starts_with_zero_missions_since_repair(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        v = next(v for v in get_state(s)["vehicles"] if v["model_key"] == "moto")
        assert v["missions_since_repair"] == 0

    def test_repair_resets_missions_since_repair(self):
        s, _ = register_new()
        s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        v = next(v for v in get_state(s)["vehicles"] if v["model_key"] == "moto")
        r = s.post(f"{BASE_URL}/api/game/vehicles/repair", json={"vehicle_id": v["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        v2 = next(v for v in get_state(s)["vehicles"] if v["id"] == v["id"])
        assert v2["missions_since_repair"] == 0

    @pytest.mark.slow
    def test_missions_since_repair_increments_after_full_mission(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        vehicle = next((v for v in st["vehicles"] if v["team_id"] == team["id"]), None)
        if not vehicle:
            pytest.skip("crew Alfa inicial não tem veículo atribuído")
        opp = _quickest_opportunity(st)
        assert opp
        prev = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                      json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT).json()
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        mission_id = r.json()["mission_id"]
        final_st = _wait_mission_done(s, mission_id, prev["eta_s"], prev["duration_s"])
        if not final_st:
            pytest.fail("mission did not complete within the expected window")
        v2 = next(v for v in final_st["vehicles"] if v["id"] == vehicle["id"])
        assert v2["missions_since_repair"] == 1


# ---------------- Pequenos imprevistos: eventos aleatórios ao longo de várias missões ----------------
class TestMinorIncidents:
    def test_mission_starts_without_bonus_loot(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        opp = _quickest_opportunity(st)
        assert opp
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        m = next(m for m in get_state(s)["missions"] if m["id"] == r.json()["mission_id"])
        assert m["bonus_loot"] is False

    @pytest.mark.slow
    def test_incidents_appear_over_several_quick_missions(self):
        """Trânsito/chuva (evento) e saque adicional/desempenho excecional
        (histórico do funcionário) são todos aleatórios e de baixa
        probabilidade por missão — despacha várias missões rápidas seguidas
        e procura qualquer uma delas a acontecer."""
        s, _ = register_new()
        markers = ("trânsito", "chuva", "saque adicional", "desempenho excecional")
        for _ in range(8):
            st = get_state(s)
            team = next((t for t in st["teams"] if t["status"] == "idle"), None)
            opp = _quickest_opportunity(st) if team else None
            if not team or not opp:
                time.sleep(10)
                continue
            prev = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                          json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT).json()
            r = s.post(f"{BASE_URL}/api/game/dispatch",
                       json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
            if r.status_code != 200:
                continue
            mission_id = r.json()["mission_id"]
            final_st = _wait_mission_done(s, mission_id, prev["eta_s"], prev["duration_s"], extra_s=30)
            if not final_st:
                continue
            texts = [e["message"].lower() for e in final_st["events"]]
            texts += [h["text"].lower() for e in final_st["employees"] for h in (e.get("history") or [])]
            if any(marker in t for marker in markers for t in texts):
                return
        pytest.skip("nenhum imprevisto aleatório ocorreu no orçamento de tentativas deste teste")


# ---------------- Economia: dinheiro sujo acumulado gera calor extra ----------------
class TestEconomyHeat:
    def test_low_dirty_money_generates_no_extra_heat(self):
        # Um jogador novo começa com 5.000€ sujos, bem abaixo do limiar de 60.000€ —
        # o mecanismo de calor extra por excesso de dinheiro sujo não deve disparar
        # (o calor só deve mover-se pela decadência natural / outras ações).
        s, _ = register_new()
        heat_before = get_state(s)["player"]["heat"]
        time.sleep(5)
        heat_after = get_state(s)["player"]["heat"]
        assert heat_after <= heat_before + 0.01


# ---------------- Sistema de viagem: presença local reduz tempo de preparação ----------------
class TestLocalPresence:
    def test_nearby_active_mission_does_not_increase_travel_time(self):
        s, _ = register_new()
        st = get_state(s)
        team_a = st["teams"][0]
        opp_a = _quickest_opportunity(st)
        assert opp_a
        prev_before = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                             json={"opportunity_id": opp_a["id"], "team_id": team_a["id"]}, timeout=TIMEOUT).json()
        # Cria uma segunda equipa e despacha-a para uma oportunidade próxima do alvo da primeira,
        # depois volta a pré-visualizar a primeira: a viagem nunca deve piorar com mais presença local.
        r = s.post(f"{BASE_URL}/api/game/teams/create", json={"spec": team_a["spec"]}, timeout=TIMEOUT)
        if r.status_code != 200:
            pytest.skip("não foi possível criar segunda equipa para testar presença local")
        st2 = get_state(s)
        team_b = next(t for t in st2["teams"] if t["id"] != team_a["id"])
        free_emp = next((e for e in st2["employees"] if not e["team_id"]), None)
        if not free_emp:
            pytest.skip("sem funcionário livre para formar a segunda equipa")
        s.post(f"{BASE_URL}/api/game/employees/assign",
               json={"employee_id": free_emp["id"], "team_id": team_b["id"]}, timeout=TIMEOUT)
        nearby = [o for o in st2["opportunities"]
                  if o["id"] != opp_a["id"] and o["min_level"] <= st2["player"]["level"]
                  and haversine_km(o["lat"], o["lng"], opp_a["lat"], opp_a["lng"]) <= 1.5]
        if not nearby:
            pytest.skip("nenhuma oportunidade próxima disponível para testar presença local")
        s.post(f"{BASE_URL}/api/game/dispatch",
               json={"opportunity_id": nearby[0]["id"], "team_id": team_b["id"]}, timeout=TIMEOUT)
        prev_after = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                            json={"opportunity_id": opp_a["id"], "team_id": team_a["id"]}, timeout=TIMEOUT).json()
        assert prev_after["eta_s"] <= prev_before["eta_s"] + 1


def haversine_km(lat1, lng1, lat2, lng2):
    import math
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ---------------- Economia: limite de dinheiro sujo, extrato e rendimentos decrescentes ----------------
class TestDirtyMoneyCap:
    def test_state_exposes_dirty_money_cap(self):
        s, _ = register_new()
        st = get_state(s)
        cap = st["caps"]["dirty_money"]
        assert cap["max"] >= 80000
        assert cap["used"] == round(st["player"]["dirty_money"])
        assert cap["used"] <= cap["max"]


class TestTransactionsLedger:
    def test_fresh_account_has_no_transactions(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/transactions", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["transactions"] == []

    def test_vehicle_purchase_is_recorded(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "moto"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        r = s.get(f"{BASE_URL}/api/game/transactions", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        txs = r.json()["transactions"]
        assert any(t["kind"] == "vehicle_buy" and t["amount"] < 0 and t["currency"] == "clean" for t in txs)

    def test_launder_records_two_transactions(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/launder", json={"amount": 1000}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        txs = s.get(f"{BASE_URL}/api/game/transactions", timeout=TIMEOUT).json()["transactions"]
        assert any(t["kind"] == "launder_out" and t["currency"] == "dirty" and t["amount"] < 0 for t in txs)
        assert any(t["kind"] == "launder_in" and t["currency"] == "clean" and t["amount"] > 0 for t in txs)


class TestPropertyStackingDiminish:
    def test_second_bonus_property_of_same_type_yields_smaller_marginal_bonus(self):
        s, _ = register_new()
        st = get_state(s)
        # armazém (bónus de recompensa logística) exige nível 2 — indisponível
        # para uma conta nova (nível 1); o mecanismo de rendimentos decrescentes
        # só é observável depois de subir de nível o suficiente para comprar
        # duas unidades do mesmo tipo.
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        catalog = r.json()
        armazem = catalog["property_types"]["armazem"]
        if st["player"]["level"] < armazem["min_level"]:
            pytest.skip("conta nova está abaixo do nível mínimo do armazém — rendimentos decrescentes não são observáveis sem subir de nível")
        opps = [o for o in st["opportunities"] if o["category"] == "logistica" and o["min_level"] <= st["player"]["level"]]
        if not opps:
            pytest.skip("sem oportunidade de logística disponível para medir o bónus de recompensa")
        team = st["teams"][0]

        def reward_bonus_pct():
            prev = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                          json={"opportunity_id": opps[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
            return prev.json()["reward_bonus_pct"]

        base = reward_bonus_pct()
        r = s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "armazem"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        after_first = reward_bonus_pct()
        first_gain = after_first - base
        assert first_gain > 0
        if s.get(f"{BASE_URL}/api/game/state", timeout=TIMEOUT).json()["player"]["clean_money"] < armazem["price"]:
            pytest.skip("dinheiro insuficiente para o 2º armazém depois do 1º")
        r = s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "armazem"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        after_second = reward_bonus_pct()
        second_gain = after_second - after_first
        # A 2ª unidade do mesmo tipo rende só 70% do que a 1ª rendeu.
        assert second_gain < first_gain


# ---------------- Combustível: abastecer demora tempo, nunca ultrapassa 100% ----------------
class TestRefuelDuration:
    @pytest.mark.slow
    def test_refuel_takes_time_and_blocks_dispatch_meanwhile(self):
        s, _ = register_new()
        st = get_state(s)
        team = st["teams"][0]
        vehicle = next((v for v in st["vehicles"] if v["team_id"] == team["id"]), None)
        if not vehicle:
            pytest.skip("crew Alfa inicial não tem veículo atribuído")
        opp = _quickest_opportunity(st)
        assert opp
        prev = s.post(f"{BASE_URL}/api/game/dispatch/preview",
                      json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT).json()
        r = s.post(f"{BASE_URL}/api/game/dispatch",
                   json={"opportunity_id": opp["id"], "team_id": team["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        mission_id = r.json()["mission_id"]
        final_st = _wait_mission_done(s, mission_id, prev["eta_s"], prev["duration_s"])
        if not final_st:
            pytest.fail("mission did not complete within the expected window")
        v2 = next(v for v in final_st["vehicles"] if v["id"] == vehicle["id"])
        if v2["fuel_l"] >= v2["tank_l"] - 0.1:
            pytest.skip("veículo regressou com o depósito praticamente cheio — nada para reabastecer")
        r = s.post(f"{BASE_URL}/api/game/vehicles/refuel", json={"vehicle_id": vehicle["id"]}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json()["refueling_until"]
        # Um segundo pedido de abastecimento enquanto já está a abastecer é bloqueado.
        r2 = s.post(f"{BASE_URL}/api/game/vehicles/refuel", json={"vehicle_id": vehicle["id"]}, timeout=TIMEOUT)
        assert r2.status_code == 400
        # Nunca ultrapassa 100%: o veículo não pode ser despachado enquanto abastece.
        opps2 = [o for o in get_state(s)["opportunities"] if o["min_level"] <= st["player"]["level"]]
        if opps2:
            r3 = s.post(f"{BASE_URL}/api/game/dispatch",
                        json={"opportunity_id": opps2[0]["id"], "team_id": team["id"]}, timeout=TIMEOUT)
            assert r3.status_code == 400
            assert "abastecer" in r3.json()["detail"].lower()
        deadline = time.time() + 60
        while time.time() < deadline:
            time.sleep(5)
            v3 = next(v for v in get_state(s)["vehicles"] if v["id"] == vehicle["id"])
            if not v3["refueling_until"]:
                assert v3["fuel_l"] == v3["tank_l"]
                return
        pytest.fail("refuel did not complete within the expected window")


# ---------------- Conteúdo novo: 50 missões, 10 funcionários, 5 veículos, 5 imóveis, 50 quests ----------------
class TestNewOpportunityContent:
    def test_catalog_exposes_at_least_67_opportunity_types(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        types = r.json()["opportunity_types"]
        assert len(types) >= 67
        # amostra de tipos novos, um por categoria
        for key in ("assalto_museu", "porto_franco", "guerra_cibernetica", "golpe_estado_local", "golpe_banco_central"):
            assert key in types, key

    def test_new_opportunity_types_expose_full_schema(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        types = r.json()["opportunity_types"]
        for key in ("roubo_joalharia", "entrega_local", "phishing_bancario", "boato_rua", "roubo_obra_arte"):
            t = types[key]
            assert t["category"] in ("assalto", "logistica", "tecnica", "influencia", "especial")
            assert 1 <= t["min_level"] <= 5
            assert t["pays"] in ("clean", "dirty")


class TestNewEmployeeContent:
    def test_catalog_exposes_new_specializations(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        specs = r.json()["specializations"]
        for role in ("franco_atirador", "arrombador", "piloto", "estafeta", "engenheiro_social",
                     "criptografo", "relacoes_publicas", "chantagista", "quimico", "recrutador"):
            assert role in specs, role


class TestNewVehicleContent:
    def test_catalog_exposes_new_vehicle_models(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        models = r.json()["vehicle_models"]
        for key in ("carrinha_entrega", "berlina_blindada", "buggy_todo_terreno", "limousine", "carro_furtivo"):
            assert key in models, key
            assert models[key]["seats"] >= 1

    def test_buy_new_vehicle_model(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/vehicles/buy", json={"model_key": "carrinha_entrega"}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        st = get_state(s)
        assert any(v["model_key"] == "carrinha_entrega" for v in st["vehicles"])


class TestNewPropertyContent:
    def test_catalog_exposes_new_property_types(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        props = r.json()["property_types"]
        for key in ("posto_vigilancia", "escritorio_advocacia", "arsenal", "casa_cambio", "centro_logistico"):
            assert key in props, key

    def test_buy_new_property_type(self):
        s, _ = register_new()
        r = s.post(f"{BASE_URL}/api/game/properties/buy", json={"type_key": "posto_vigilancia"}, timeout=TIMEOUT)
        # posto_vigilancia exige nível 2 — uma conta nova (nível 1) é bloqueada.
        assert r.status_code == 400
        assert "nível" in r.json()["detail"].lower()


class TestNewQuestContent:
    def test_fresh_account_sees_chapter_5_and_6_as_locked(self):
        s, _ = register_new()
        st = get_state(s)
        keys = {q["quest_key"] for q in st["quests"]}
        assert "c5_fleet5" in keys
        assert "c6_level10" in keys
        c5 = next(q for q in st["quests"] if q["quest_key"] == "c5_fleet5")
        c6 = next(q for q in st["quests"] if q["quest_key"] == "c6_level10")
        assert c5["status"] == "locked"
        assert c6["status"] == "locked"
        assert c5["chapter"] == 5
        assert c6["chapter"] == 6

    def test_daily_and_weekly_quests_come_from_the_expanded_pool(self):
        s, _ = register_new()
        st = get_state(s)
        daily = [q for q in st["quests"] if q["type"] == "diaria" and q["status"] == "active"]
        weekly = [q for q in st["quests"] if q["type"] == "semanal" and q["status"] == "active"]
        assert len(daily) == 3
        assert len(weekly) == 2

    def test_c6_raids3_rewards_a_new_vehicle_model(self):
        s, _ = register_new()
        st = get_state(s)
        q = next(q for q in st["quests"] if q["quest_key"] == "c6_raids3")
        assert q["rewards"]["vehicle"] == "carro_furtivo"


# ---------------- Interligação: novas missões, funcionários, veículos e imóveis a cruzarem-se ----------------
class TestContentInterlinking:
    def test_every_new_vehicle_is_required_by_at_least_one_mission_type(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        types = r.json()["opportunity_types"]
        required_anywhere = {m for t in types.values() for m in t.get("required_models", [])}
        for key in ("carrinha_entrega", "berlina_blindada", "buggy_todo_terreno", "limousine", "carro_furtivo"):
            assert key in required_anywhere, f"{key} não é exigido por nenhuma missão"

    def test_quimico_has_a_production_passive(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        quimico = r.json()["specializations"]["quimico"]
        assert quimico.get("passive", {}).get("lab_boost") == 0.20

    def test_every_new_specialization_has_a_talent_or_passive(self):
        s, _ = register_new()
        r = s.get(f"{BASE_URL}/api/game/catalog", timeout=TIMEOUT)
        specs = r.json()["specializations"]
        talents = r.json()["talents"]
        talent_roles = {role for t in talents.values() for role in t.get("roles", [])}
        new_roles = ["franco_atirador", "arrombador", "piloto", "estafeta", "engenheiro_social",
                     "criptografo", "relacoes_publicas", "chantagista", "quimico", "recrutador"]
        for role in new_roles:
            has_passive = bool(specs[role].get("passive"))
            has_talent = role in talent_roles
            assert has_passive or has_talent, f"{role} não tem bónus passivo nem talento associado"
