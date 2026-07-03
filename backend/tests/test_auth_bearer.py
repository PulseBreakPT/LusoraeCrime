"""Auth Bearer token flow tests — iteration 3.

Verifies migration from cookie-based auth to Authorization Bearer tokens:
- /api/auth/register returns access_token + refresh_token in body
- /api/auth/login returns access_token + refresh_token in body
- Wrong password → 401 with PT error
- Duplicate email → 400 with PT error
- /api/auth/me works with Bearer header, 401 without
- /api/game/state works with Bearer header
- /api/auth/logout returns {ok: true}
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"
TIMEOUT = 30


def _bearer(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def new_user_creds():
    email = f"qa_{uuid.uuid4().hex[:10]}@lusorae.com"
    return {"org_name": f"Org{uuid.uuid4().hex[:6]}",
            "email": email, "password": "QaPass1234!"}


class TestRegister:
    def test_register_returns_tokens_in_body(self, new_user_creds):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json=new_user_creds, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "access_token" in d and isinstance(d["access_token"], str) and len(d["access_token"]) > 20
        assert "refresh_token" in d and isinstance(d["refresh_token"], str) and len(d["refresh_token"]) > 20
        assert d["email"] == new_user_creds["email"].lower()
        assert d["name"] == new_user_creds["org_name"]
        assert "id" in d
        # store for downstream
        new_user_creds["_access"] = d["access_token"]
        new_user_creds["_refresh"] = d["refresh_token"]
        new_user_creds["_id"] = d["id"]

    def test_duplicate_email_400(self, new_user_creds):
        r = requests.post(f"{BASE_URL}/api/auth/register",
                          json={"org_name": "DupeOrg",
                                "email": new_user_creds["email"],
                                "password": "SomePass1!"}, timeout=TIMEOUT)
        assert r.status_code == 400
        assert r.json().get("detail") == "Este email já está registado"


class TestLogin:
    def test_admin_login_returns_tokens(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                          timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "access_token" in d and len(d["access_token"]) > 20
        assert "refresh_token" in d and len(d["refresh_token"]) > 20
        assert d["email"] == ADMIN_EMAIL
        pytest.admin_access = d["access_token"]

    def test_wrong_password_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "WRONG_PASS_XYZ"},
                          timeout=TIMEOUT)
        assert r.status_code == 401
        assert r.json().get("detail") == "Email ou password incorretos"


class TestAuthMe:
    def test_me_no_token_401(self):
        # Use a bare request (no session cookies) to ensure no cookie leak
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_me_invalid_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers=_bearer("not.a.jwt.token"), timeout=TIMEOUT)
        assert r.status_code == 401

    def test_me_with_bearer_ok(self, new_user_creds):
        tok = new_user_creds["_access"]
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers=_bearer(tok), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == new_user_creds["email"].lower()
        assert d["name"] == new_user_creds["org_name"]
        assert "id" in d


class TestGameStateBearer:
    def test_state_with_bearer_ok(self, new_user_creds):
        tok = new_user_creds["_access"]
        r = requests.get(f"{BASE_URL}/api/game/state",
                         headers=_bearer(tok), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        # populated payload sanity
        assert "player" in d and d["player"].get("clean_money") == 75000
        assert "teams" in d and len(d["teams"]) == 1
        assert "employees" in d and len(d["employees"]) >= 2
        assert "opportunities" in d

    def test_state_no_token_401(self):
        r = requests.get(f"{BASE_URL}/api/game/state", timeout=TIMEOUT)
        assert r.status_code == 401


class TestLogout:
    def test_logout_returns_ok(self, new_user_creds):
        tok = new_user_creds["_access"]
        r = requests.post(f"{BASE_URL}/api/auth/logout",
                          headers=_bearer(tok), timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_token_still_valid_after_logout(self, new_user_creds):
        # Since we use stateless JWT and logout only clears cookies,
        # the Bearer token should still authenticate /me (documented behavior).
        tok = new_user_creds["_access"]
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers=_bearer(tok), timeout=TIMEOUT)
        assert r.status_code == 200


class TestRefresh:
    def test_refresh_with_bearer(self, new_user_creds):
        rtok = new_user_creds["_refresh"]
        r = requests.post(f"{BASE_URL}/api/auth/refresh",
                          headers=_bearer(rtok), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "access_token" in d and len(d["access_token"]) > 20
