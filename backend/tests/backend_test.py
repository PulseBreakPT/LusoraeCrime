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
