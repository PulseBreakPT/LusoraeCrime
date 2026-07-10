#!/usr/bin/env python3
"""
Testes backend para autenticação e rotas legais do Lusorae.
"""
import os
import sys
import time
import requests
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://sss-enhancement.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"

test_results = {"passed": 0, "failed": 0, "errors": []}


def log_test(name, passed, details=""):
    if passed:
        print(f"{GREEN}✓{RESET} {name}")
        test_results["passed"] += 1
    else:
        print(f"{RED}✗{RESET} {name}")
        if details:
            print(f"  {RED}{details}{RESET}")
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {details}")


def log_section(title):
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}{title}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")


def test_legal_meta():
    """Test GET /api/legal/meta"""
    log_section("1. ROTAS LEGAIS - GET /api/legal/meta")
    try:
        resp = requests.get(f"{BASE_URL}/legal/meta", timeout=10)
        if resp.status_code != 200:
            log_test("GET /api/legal/meta → 200", False, f"Status: {resp.status_code}")
            return
        
        data = resp.json()
        
        # Check contact_email
        if data.get("contact_email") != "geral@lusorae.pt":
            log_test("contact_email = geral@lusorae.pt", False, f"Got: {data.get('contact_email')}")
            return
        
        # Check documents structure
        docs = data.get("documents", {})
        required_docs = ["terms", "privacy", "rgpd"]
        
        for doc_id in required_docs:
            if doc_id not in docs:
                log_test(f"Document '{doc_id}' present", False, f"Missing document: {doc_id}")
                return
            
            doc = docs[doc_id]
            if doc.get("version") != "1.0":
                log_test(f"{doc_id} version = 1.0", False, f"Got: {doc.get('version')}")
                return
            
            if doc.get("effective_date") != "2026-07-08":
                log_test(f"{doc_id} effective_date = 2026-07-08", False, f"Got: {doc.get('effective_date')}")
                return
        
        log_test("GET /api/legal/meta → 200 with correct structure", True)
        
    except Exception as e:
        log_test("GET /api/legal/meta", False, str(e))


def test_legal_documents():
    """Test GET /api/legal/documents/{doc_id}"""
    log_section("2. ROTAS LEGAIS - GET /api/legal/documents")
    
    # Test valid documents
    for doc_id in ["terms", "privacy", "rgpd"]:
        try:
            resp = requests.get(f"{BASE_URL}/legal/documents/{doc_id}", timeout=10)
            if resp.status_code != 200:
                log_test(f"GET /api/legal/documents/{doc_id} → 200", False, f"Status: {resp.status_code}")
                continue
            
            data = resp.json()
            required_fields = ["id", "title", "version", "effective_date", "summary", "sections", "available_versions"]
            
            missing = [f for f in required_fields if f not in data]
            if missing:
                log_test(f"GET /api/legal/documents/{doc_id} has all fields", False, f"Missing: {missing}")
                continue
            
            if not isinstance(data.get("sections"), list):
                log_test(f"GET /api/legal/documents/{doc_id} sections is array", False, "sections is not a list")
                continue
            
            log_test(f"GET /api/legal/documents/{doc_id} → 200 with correct structure", True)
            
        except Exception as e:
            log_test(f"GET /api/legal/documents/{doc_id}", False, str(e))
    
    # Test non-existent document
    try:
        resp = requests.get(f"{BASE_URL}/legal/documents/inexistente", timeout=10)
        if resp.status_code == 404:
            log_test("GET /api/legal/documents/inexistente → 404", True)
        else:
            log_test("GET /api/legal/documents/inexistente → 404", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("GET /api/legal/documents/inexistente → 404", False, str(e))
    
    # Test invalid version
    try:
        resp = requests.get(f"{BASE_URL}/legal/documents/terms?version=9.9", timeout=10)
        if resp.status_code == 404:
            log_test("GET /api/legal/documents/terms?version=9.9 → 404", True)
        else:
            log_test("GET /api/legal/documents/terms?version=9.9 → 404", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("GET /api/legal/documents/terms?version=9.9 → 404", False, str(e))


def test_legal_changelog():
    """Test GET /api/legal/changelog"""
    log_section("3. ROTAS LEGAIS - GET /api/legal/changelog")
    
    try:
        resp = requests.get(f"{BASE_URL}/legal/changelog", timeout=10)
        if resp.status_code != 200:
            log_test("GET /api/legal/changelog → 200", False, f"Status: {resp.status_code}")
            return
        
        data = resp.json()
        
        if "categories" not in data or "versions" not in data:
            log_test("GET /api/legal/changelog has categories and versions", False, "Missing fields")
            return
        
        versions = data.get("versions", [])
        if len(versions) != 6:
            log_test("Changelog has 6 versions", False, f"Got {len(versions)} versions")
            return
        
        # Check first version has tag "atual"
        if versions[0].get("tag") != "atual":
            log_test("First version has tag 'atual'", False, f"Got tag: {versions[0].get('tag')}")
            return
        
        # Check first version is v0.6.0
        if versions[0].get("version") != "0.6.0":
            log_test("First version is v0.6.0", False, f"Got: {versions[0].get('version')}")
            return
        
        log_test("GET /api/legal/changelog → 200 with 6 versions, first is v0.6.0 with tag 'atual'", True)
        
    except Exception as e:
        log_test("GET /api/legal/changelog", False, str(e))


def test_register_validation():
    """Test POST /api/auth/register validation"""
    log_section("4. REGISTO - Validação")
    
    timestamp = int(time.time())
    
    # Test without accept_terms
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": f"Org Test {timestamp}",
            "email": f"test_{timestamp}@lusorae-test.pt",
            "password": "TesteForte123",
            "accept_terms": False
        }, timeout=10)
        
        if resp.status_code == 400 and "Termos" in resp.text:
            log_test("Register without accept_terms → 400 with message about Termos", True)
        else:
            log_test("Register without accept_terms → 400", False, f"Status: {resp.status_code}, Body: {resp.text[:200]}")
    except Exception as e:
        log_test("Register without accept_terms", False, str(e))
    
    # Test weak password
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": f"Org Test {timestamp}",
            "email": f"test_{timestamp}@lusorae-test.pt",
            "password": "abc123",
            "accept_terms": True
        }, timeout=10)
        
        if resp.status_code == 400 and "fraca" in resp.text.lower():
            log_test("Register with weak password 'abc123' → 400 'Palavra-passe fraca'", True)
        else:
            log_test("Register with weak password → 400", False, f"Status: {resp.status_code}, Body: {resp.text[:200]}")
    except Exception as e:
        log_test("Register with weak password", False, str(e))
    
    # Test password without uppercase
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": f"Org Test {timestamp}",
            "email": f"test_{timestamp}@lusorae-test.pt",
            "password": "forte1234",
            "accept_terms": True
        }, timeout=10)
        
        if resp.status_code == 400:
            log_test("Register with password without uppercase 'forte1234' → 400", True)
        else:
            log_test("Register with password without uppercase → 400", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("Register with password without uppercase", False, str(e))
    
    # Test password without number
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": f"Org Test {timestamp}",
            "email": f"test_{timestamp}@lusorae-test.pt",
            "password": "ForteForte",
            "accept_terms": True
        }, timeout=10)
        
        if resp.status_code == 400:
            log_test("Register with password without number 'ForteForte' → 400", True)
        else:
            log_test("Register with password without number → 400", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("Register with password without number", False, str(e))
    
    # Test org_name with forbidden characters
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": "Org<script>",
            "email": f"test_{timestamp}@lusorae-test.pt",
            "password": "TesteForte123",
            "accept_terms": True
        }, timeout=10)
        
        if resp.status_code == 400:
            log_test("Register with org_name containing forbidden chars → 400", True)
        else:
            log_test("Register with org_name containing forbidden chars → 400", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("Register with org_name containing forbidden chars", False, str(e))


def test_register_success():
    """Test successful registration"""
    log_section("5. REGISTO - Sucesso")
    
    timestamp = int(time.time())
    test_email = f"test_{timestamp}@lusorae-test.pt"
    test_org = f"Organização Teste {timestamp}"
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": test_org,
            "email": test_email,
            "password": "TesteForte123",
            "accept_terms": True
        }, timeout=10)
        
        if resp.status_code != 200:
            log_test("Valid registration → 200", False, f"Status: {resp.status_code}, Body: {resp.text[:200]}")
            return None
        
        data = resp.json()
        required_fields = ["id", "email", "name", "role", "access_token", "refresh_token"]
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            log_test("Registration response has all required fields", False, f"Missing: {missing}")
            return None
        
        log_test("Valid registration → 200 with id/email/name/role/access_token/refresh_token", True)
        
        # Return the credentials for further tests
        return {
            "email": test_email,
            "password": "TesteForte123",
            "access_token": data["access_token"],
            "user_id": data["id"]
        }
        
    except Exception as e:
        log_test("Valid registration", False, str(e))
        return None


def test_register_whitespace():
    """Test org_name with multiple spaces"""
    log_section("6. REGISTO - Normalização de espaços")
    
    timestamp = int(time.time())
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": f"  Nome   Duplo  {timestamp}  ",
            "email": f"test_{timestamp}@lusorae-test.pt",
            "password": "TesteForte123",
            "accept_terms": True
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            # Check if name was normalized (multiple spaces → single space, trimmed)
            expected_name = f"Nome Duplo {timestamp}"
            if data.get("name") == expected_name:
                log_test("org_name with multiple spaces normalized correctly", True)
            else:
                log_test("org_name with multiple spaces normalized", False, f"Expected '{expected_name}', got '{data.get('name')}'")
        else:
            log_test("Register with spaces in org_name", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("Register with spaces in org_name", False, str(e))


def test_register_duplicate():
    """Test duplicate email and org_name"""
    log_section("7. REGISTO - Duplicados")
    
    timestamp = int(time.time())
    test_email = f"test_dup_{timestamp}@lusorae-test.pt"
    test_org = f"Org Duplicada {timestamp}"
    
    # First registration
    try:
        resp1 = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": test_org,
            "email": test_email,
            "password": "TesteForte123",
            "accept_terms": True
        }, timeout=10)
        
        if resp1.status_code != 200:
            log_test("First registration for duplicate test", False, f"Status: {resp1.status_code}")
            return
        
        # Try to register with same email
        resp2 = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": f"Outra Org {timestamp}",
            "email": test_email,
            "password": "TesteForte123",
            "accept_terms": True
        }, timeout=10)
        
        if resp2.status_code == 400 and "email já está registado" in resp2.text:
            log_test("Register with duplicate email → 400 'Este email já está registado'", True)
        else:
            log_test("Register with duplicate email → 400", False, f"Status: {resp2.status_code}, Body: {resp2.text[:200]}")
        
        # Try to register with same org_name (different capitalization)
        resp3 = requests.post(f"{BASE_URL}/auth/register", json={
            "org_name": test_org.upper(),  # Same name but uppercase
            "email": f"test_dup2_{timestamp}@lusorae-test.pt",
            "password": "TesteForte123",
            "accept_terms": True
        }, timeout=10)
        
        if resp3.status_code == 400 and "nome de organização já está a ser utilizado" in resp3.text:
            log_test("Register with duplicate org_name (different case) → 400", True)
        else:
            log_test("Register with duplicate org_name → 400", False, f"Status: {resp3.status_code}, Body: {resp3.text[:200]}")
        
    except Exception as e:
        log_test("Duplicate registration tests", False, str(e))


def test_check_availability():
    """Test POST /api/auth/check-availability"""
    log_section("8. CHECK-AVAILABILITY")
    
    timestamp = int(time.time())
    
    # Test with admin email (should be unavailable)
    try:
        resp = requests.post(f"{BASE_URL}/auth/check-availability", json={
            "email": ADMIN_EMAIL
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            email_data = data.get("email", {})
            if email_data.get("valid") and not email_data.get("available"):
                log_test("check-availability with admin email → valid:true, available:false", True)
            else:
                log_test("check-availability with admin email", False, f"Got: {email_data}")
        else:
            log_test("check-availability with admin email", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("check-availability with admin email", False, str(e))
    
    # Test with available email
    try:
        resp = requests.post(f"{BASE_URL}/auth/check-availability", json={
            "email": f"livre_{timestamp}@teste.pt"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            email_data = data.get("email", {})
            if email_data.get("valid") and email_data.get("available"):
                log_test("check-availability with available email → valid:true, available:true", True)
            else:
                log_test("check-availability with available email", False, f"Got: {email_data}")
        else:
            log_test("check-availability with available email", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("check-availability with available email", False, str(e))
    
    # Test with invalid email
    try:
        resp = requests.post(f"{BASE_URL}/auth/check-availability", json={
            "email": "invalido"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            email_data = data.get("email", {})
            if not email_data.get("valid") and not email_data.get("available"):
                log_test("check-availability with invalid email → valid:false, available:false", True)
            else:
                log_test("check-availability with invalid email", False, f"Got: {email_data}")
        else:
            log_test("check-availability with invalid email", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("check-availability with invalid email", False, str(e))
    
    # Test with admin org_name (should be unavailable)
    try:
        resp = requests.post(f"{BASE_URL}/auth/check-availability", json={
            "org_name": "Sindicato Lusorae"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            org_data = data.get("org_name", {})
            if not org_data.get("available"):
                log_test("check-availability with admin org_name → available:false", True)
            else:
                log_test("check-availability with admin org_name", False, f"Got: {org_data}")
        else:
            log_test("check-availability with admin org_name", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("check-availability with admin org_name", False, str(e))
    
    # Test with short org_name
    try:
        resp = requests.post(f"{BASE_URL}/auth/check-availability", json={
            "org_name": "ab"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            org_data = data.get("org_name", {})
            if not org_data.get("valid"):
                log_test("check-availability with short org_name → valid:false", True)
            else:
                log_test("check-availability with short org_name", False, f"Got: {org_data}")
        else:
            log_test("check-availability with short org_name", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("check-availability with short org_name", False, str(e))
    
    # Test with unique org_name
    try:
        resp = requests.post(f"{BASE_URL}/auth/check-availability", json={
            "org_name": f"Nome Único {timestamp}"
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            org_data = data.get("org_name", {})
            if org_data.get("valid") and org_data.get("available"):
                log_test("check-availability with unique org_name → valid:true, available:true", True)
            else:
                log_test("check-availability with unique org_name", False, f"Got: {org_data}")
        else:
            log_test("check-availability with unique org_name", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("check-availability with unique org_name", False, str(e))


def test_login_and_lockout():
    """Test login and lockout mechanism"""
    log_section("9. LOGIN + LOCKOUT")
    
    # Test valid login with admin
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if "access_token" in data:
                log_test("Login with admin credentials → 200", True)
            else:
                log_test("Login with admin credentials", False, "Missing access_token")
        else:
            log_test("Login with admin credentials → 200", False, f"Status: {resp.status_code}, Body: {resp.text[:200]}")
    except Exception as e:
        log_test("Login with admin credentials", False, str(e))
    
    # Test lockout with disposable email
    timestamp = int(time.time())
    lockout_email = f"lockout_{timestamp}@teste.pt"
    
    try:
        # Make 5 failed attempts
        for i in range(5):
            resp = requests.post(f"{BASE_URL}/auth/login", json={
                "email": lockout_email,
                "password": "WrongPassword123"
            }, timeout=10)
            
            if resp.status_code != 401:
                log_test(f"Failed login attempt {i+1} → 401", False, f"Status: {resp.status_code}")
        
        # 6th attempt should return 429 with Retry-After header
        time.sleep(1)  # Small delay to ensure lockout is triggered
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": lockout_email,
            "password": "WrongPassword123"
        }, timeout=10)
        
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            if retry_after and retry_after.isdigit() and int(retry_after) > 0:
                log_test(f"6th failed attempt → 429 with Retry-After header ({retry_after}s)", True)
            else:
                log_test("6th failed attempt → 429 with Retry-After", False, f"Retry-After: {retry_after}")
        else:
            log_test("6th failed attempt → 429", False, f"Status: {resp.status_code}, Body: {resp.text[:200]}")
    except Exception as e:
        log_test("Login lockout test", False, str(e))


def test_change_password(user_creds):
    """Test POST /api/auth/change-password"""
    log_section("10. CHANGE-PASSWORD")
    
    if not user_creds:
        print(f"{YELLOW}⚠ Skipping change-password tests (no user credentials){RESET}")
        return
    
    # Test with weak new password
    try:
        resp = requests.post(f"{BASE_URL}/auth/change-password", 
            headers={"Authorization": f"Bearer {user_creds['access_token']}"},
            json={
                "current_password": user_creds["password"],
                "new_password": "fraca"
            }, timeout=10)
        
        if resp.status_code == 400:
            log_test("change-password with weak new password → 400", True)
        else:
            log_test("change-password with weak new password → 400", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("change-password with weak password", False, str(e))
    
    # Test with wrong current password
    try:
        resp = requests.post(f"{BASE_URL}/auth/change-password",
            headers={"Authorization": f"Bearer {user_creds['access_token']}"},
            json={
                "current_password": "WrongPassword123",
                "new_password": "NovaForte123"
            }, timeout=10)
        
        if resp.status_code == 400:
            log_test("change-password with wrong current password → 400", True)
        else:
            log_test("change-password with wrong current password → 400", False, f"Status: {resp.status_code}")
    except Exception as e:
        log_test("change-password with wrong current password", False, str(e))
    
    # Test successful password change
    try:
        resp = requests.post(f"{BASE_URL}/auth/change-password",
            headers={"Authorization": f"Bearer {user_creds['access_token']}"},
            json={
                "current_password": user_creds["password"],
                "new_password": "NovaForte123"
            }, timeout=10)
        
        if resp.status_code == 200:
            log_test("change-password with correct credentials → 200", True)
            
            # Try to login with new password
            time.sleep(1)
            resp2 = requests.post(f"{BASE_URL}/auth/login", json={
                "email": user_creds["email"],
                "password": "NovaForte123"
            }, timeout=10)
            
            if resp2.status_code == 200:
                log_test("Login with new password → 200", True)
            else:
                log_test("Login with new password → 200", False, f"Status: {resp2.status_code}")
        else:
            log_test("change-password with correct credentials → 200", False, f"Status: {resp.status_code}, Body: {resp.text[:200]}")
    except Exception as e:
        log_test("change-password success", False, str(e))


def test_regression():
    """Test regression - existing endpoints still work"""
    log_section("11. REGRESSÃO")
    
    # Login as admin to get token
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code != 200:
            log_test("Login for regression tests", False, f"Status: {resp.status_code}")
            return
        
        token = resp.json().get("access_token")
        refresh_token = resp.json().get("refresh_token")
        
        # Test GET /api/auth/me
        resp_me = requests.get(f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"}, timeout=10)
        
        if resp_me.status_code == 200:
            log_test("GET /api/auth/me with Bearer token → 200", True)
        else:
            log_test("GET /api/auth/me → 200", False, f"Status: {resp_me.status_code}")
        
        # Test POST /api/auth/refresh
        resp_refresh = requests.post(f"{BASE_URL}/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"}, timeout=10)
        
        if resp_refresh.status_code == 200:
            data = resp_refresh.json()
            if "access_token" in data:
                log_test("POST /api/auth/refresh → 200 with new access_token", True)
            else:
                log_test("POST /api/auth/refresh", False, "Missing access_token")
        else:
            log_test("POST /api/auth/refresh → 200", False, f"Status: {resp_refresh.status_code}")
        
        # Test GET /api/game/state (check if registration creates player/org)
        resp_game = requests.get(f"{BASE_URL}/game/state",
            headers={"Authorization": f"Bearer {token}"}, timeout=10)
        
        if resp_game.status_code == 200:
            log_test("GET /api/game/state with registered user → 200", True)
        else:
            log_test("GET /api/game/state → 200", False, f"Status: {resp_game.status_code}")
        
    except Exception as e:
        log_test("Regression tests", False, str(e))


def print_summary():
    """Print test summary"""
    log_section("RESUMO DOS TESTES")
    
    total = test_results["passed"] + test_results["failed"]
    print(f"\nTotal: {total} testes")
    print(f"{GREEN}Passou: {test_results['passed']}{RESET}")
    print(f"{RED}Falhou: {test_results['failed']}{RESET}")
    
    if test_results["failed"] > 0:
        print(f"\n{RED}Erros encontrados:{RESET}")
        for error in test_results["errors"]:
            print(f"  • {error}")
    
    print()
    
    return test_results["failed"] == 0


def main():
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TESTES BACKEND - LUSORAE AUTENTICAÇÃO E ROTAS LEGAIS{RESET}")
    print(f"{BLUE}Base URL: {BASE_URL}{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    # Run all tests
    test_legal_meta()
    test_legal_documents()
    test_legal_changelog()
    test_register_validation()
    user_creds = test_register_success()
    test_register_whitespace()
    test_register_duplicate()
    test_check_availability()
    test_login_and_lockout()
    test_change_password(user_creds)
    test_regression()
    
    # Print summary
    success = print_summary()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
