#!/usr/bin/env python3
"""
Backend test suite for SUBMUNDO - Disclaimer & Legal Endpoints
Test scope (11/07/2026):
1. AUTH SMOKE: Login admin + register new disposable account
2. NEW ENDPOINT POST /api/legal/disclaimer-ack: with/without token, accepted true/false, persistence, invalid body
3. REGRESSION: GET /api/legal/meta, /api/legal/changelog, /api/legal/documents/terms
"""

import requests
import time
import json
from datetime import datetime, timezone
from pymongo import MongoClient

# Configuration
BASE_URL = "https://lusora-patrols.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "admin123"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

def log_test(name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    test_results["tests"].append({
        "name": name,
        "passed": passed,
        "details": details
    })
    if passed:
        test_results["passed"] += 1
    else:
        test_results["failed"] += 1
    print(f"{status}: {name}")
    if details:
        print(f"  Details: {details}")

def generate_unique_email():
    """Generate a unique disposable email for testing"""
    timestamp = int(time.time())
    return f"teste.disclaimer.{timestamp}@lusorae.com"

def generate_strong_password():
    """Generate a strong password meeting requirements (8+ chars, upper, lower, number)"""
    return f"TesteAbc{timestamp_suffix()}"

def timestamp_suffix():
    """Get timestamp suffix for unique names"""
    return str(int(time.time()) % 10000)

def generate_unique_org_name():
    """Generate a unique organization name"""
    return f"Cartel Teste {timestamp_suffix()}"

# ============================================================================
# PRIORITY 1: AUTH SMOKE TESTS
# ============================================================================

def test_admin_login():
    """Test 1.1: POST /api/auth/login with admin@lusorae.com / admin123 → 200 with access_token"""
    print("\n=== TEST 1.1: Admin Login ===")
    session = requests.Session()
    
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            # Check for access_token in response or cookies
            has_token = "access_token" in data or "access_token" in session.cookies
            
            if has_token:
                log_test("POST /api/auth/login (admin) → 200 with access_token", True, 
                        f"Email: {ADMIN_EMAIL}")
                return session
            else:
                log_test("POST /api/auth/login (admin) → 200 with access_token", False, 
                        "No access_token in response or cookies")
                return None
        else:
            log_test("POST /api/auth/login (admin) → 200 with access_token", False, 
                    f"Status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        log_test("POST /api/auth/login (admin) → 200 with access_token", False, f"Exception: {str(e)}")
        return None

def test_register_new_account():
    """Test 1.2: POST /api/auth/register with unique email/org, strong password, accept_terms=true → 200 with access_token"""
    print("\n=== TEST 1.2: Register New Disposable Account ===")
    
    email = generate_unique_email()
    org_name = generate_unique_org_name()
    password = generate_strong_password()
    
    print(f"  Registering: {email}")
    print(f"  Org: {org_name}")
    print(f"  Password: {password}")
    
    session = requests.Session()
    
    try:
        response = session.post(
            f"{BASE_URL}/auth/register",
            json={
                "email": email,
                "org_name": org_name,
                "password": password,
                "accept_terms": True
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            has_token = "access_token" in data or "access_token" in session.cookies
            
            if has_token:
                log_test("POST /api/auth/register (new account) → 200 with access_token", True, 
                        f"Email: {email}")
                return session, email
            else:
                log_test("POST /api/auth/register (new account) → 200 with access_token", False, 
                        "No access_token in response or cookies")
                return None, None
        else:
            log_test("POST /api/auth/register (new account) → 200 with access_token", False, 
                    f"Status {response.status_code}: {response.text[:300]}")
            return None, None
    except Exception as e:
        log_test("POST /api/auth/register (new account) → 200 with access_token", False, f"Exception: {str(e)}")
        return None, None

# ============================================================================
# PRIORITY 2: NEW ENDPOINT POST /api/legal/disclaimer-ack
# ============================================================================

def test_disclaimer_ack_without_token():
    """Test 2.1: POST /api/legal/disclaimer-ack without token → 401"""
    print("\n=== TEST 2.1: Disclaimer-ack Without Token ===")
    
    try:
        response = requests.post(
            f"{BASE_URL}/legal/disclaimer-ack",
            json={"accepted": True},
            timeout=10
        )
        
        if response.status_code == 401:
            log_test("POST /api/legal/disclaimer-ack (no token) → 401", True)
        else:
            log_test("POST /api/legal/disclaimer-ack (no token) → 401", False, 
                    f"Status {response.status_code}")
    except Exception as e:
        log_test("POST /api/legal/disclaimer-ack (no token) → 401", False, f"Exception: {str(e)}")

def test_disclaimer_ack_accepted_true(session, user_email):
    """Test 2.2: POST /api/legal/disclaimer-ack with Bearer token, body {"accepted": true} → 200 {"ok": true, "version": "1.0", "accepted": true}"""
    print("\n=== TEST 2.2: Disclaimer-ack Accepted True ===")
    
    try:
        response = session.post(
            f"{BASE_URL}/legal/disclaimer-ack",
            json={"accepted": True},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response structure
            if data.get("ok") == True and data.get("version") == "1.0" and data.get("accepted") == True:
                log_test("POST /api/legal/disclaimer-ack (accepted:true) → 200 with correct response", True, 
                        f"Response: {data}")
                return True
            else:
                log_test("POST /api/legal/disclaimer-ack (accepted:true) → 200 with correct response", False, 
                        f"Unexpected response: {data}")
                return False
        else:
            log_test("POST /api/legal/disclaimer-ack (accepted:true) → 200", False, 
                    f"Status {response.status_code}: {response.text[:200]}")
            return False
    except Exception as e:
        log_test("POST /api/legal/disclaimer-ack (accepted:true)", False, f"Exception: {str(e)}")
        return False

def test_disclaimer_ack_accepted_false(session):
    """Test 2.3: POST /api/legal/disclaimer-ack with body {"accepted": false} → 200 with accepted:false"""
    print("\n=== TEST 2.3: Disclaimer-ack Accepted False ===")
    
    try:
        response = session.post(
            f"{BASE_URL}/legal/disclaimer-ack",
            json={"accepted": False},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("ok") == True and data.get("version") == "1.0" and data.get("accepted") == False:
                log_test("POST /api/legal/disclaimer-ack (accepted:false) → 200 with accepted:false", True, 
                        f"Response: {data}")
                return True
            else:
                log_test("POST /api/legal/disclaimer-ack (accepted:false) → 200 with accepted:false", False, 
                        f"Unexpected response: {data}")
                return False
        else:
            log_test("POST /api/legal/disclaimer-ack (accepted:false) → 200", False, 
                    f"Status {response.status_code}")
            return False
    except Exception as e:
        log_test("POST /api/legal/disclaimer-ack (accepted:false)", False, f"Exception: {str(e)}")
        return False

def test_disclaimer_ack_invalid_body(session):
    """Test 2.4: POST /api/legal/disclaimer-ack with invalid body (e.g. {} without accepted) → 422"""
    print("\n=== TEST 2.4: Disclaimer-ack Invalid Body ===")
    
    try:
        response = session.post(
            f"{BASE_URL}/legal/disclaimer-ack",
            json={},
            timeout=10
        )
        
        if response.status_code == 422:
            log_test("POST /api/legal/disclaimer-ack (invalid body) → 422", True)
        else:
            log_test("POST /api/legal/disclaimer-ack (invalid body) → 422", False, 
                    f"Status {response.status_code}")
    except Exception as e:
        log_test("POST /api/legal/disclaimer-ack (invalid body) → 422", False, f"Exception: {str(e)}")

def test_disclaimer_persistence_mongodb(user_email):
    """Test 2.5: Verify persistence in MongoDB - last_disclaimer and disclaimer_log"""
    print("\n=== TEST 2.5: Disclaimer Persistence in MongoDB ===")
    
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        
        # Find user by email
        user = db.users.find_one({"email": user_email})
        
        if not user:
            log_test("MongoDB persistence - user found", False, f"User {user_email} not found")
            return
        
        log_test("MongoDB persistence - user found", True, f"User ID: {user['_id']}")
        
        # Check last_disclaimer
        last_disclaimer = user.get("last_disclaimer")
        if not last_disclaimer:
            log_test("MongoDB persistence - last_disclaimer exists", False, "Field missing")
            return
        
        # Verify last_disclaimer structure
        required_fields = ["accepted", "at", "version", "ip"]
        missing = [f for f in required_fields if f not in last_disclaimer]
        
        if missing:
            log_test("MongoDB persistence - last_disclaimer has required fields", False, 
                    f"Missing: {missing}")
        else:
            log_test("MongoDB persistence - last_disclaimer has required fields", True, 
                    f"accepted={last_disclaimer['accepted']}, version={last_disclaimer['version']}, at={last_disclaimer['at']}")
        
        # Verify version is "1.0"
        if last_disclaimer.get("version") == "1.0":
            log_test("MongoDB persistence - last_disclaimer.version == '1.0'", True)
        else:
            log_test("MongoDB persistence - last_disclaimer.version == '1.0'", False, 
                    f"Version: {last_disclaimer.get('version')}")
        
        # Check disclaimer_log
        disclaimer_log = user.get("disclaimer_log")
        if not disclaimer_log:
            log_test("MongoDB persistence - disclaimer_log exists", False, "Field missing")
            return
        
        if isinstance(disclaimer_log, list):
            log_test("MongoDB persistence - disclaimer_log is array", True, 
                    f"Length: {len(disclaimer_log)}")
            
            # Verify log entries have same structure
            if len(disclaimer_log) > 0:
                last_entry = disclaimer_log[-1]
                missing_log = [f for f in required_fields if f not in last_entry]
                
                if missing_log:
                    log_test("MongoDB persistence - disclaimer_log entries have required fields", False, 
                            f"Missing: {missing_log}")
                else:
                    log_test("MongoDB persistence - disclaimer_log entries have required fields", True)
                
                # Verify last entry matches last_disclaimer
                if last_entry == last_disclaimer:
                    log_test("MongoDB persistence - last disclaimer_log entry matches last_disclaimer", True)
                else:
                    log_test("MongoDB persistence - last disclaimer_log entry matches last_disclaimer", False, 
                            "Mismatch between last_disclaimer and last log entry")
            
            # Verify cap at 20 (can't test directly without 20+ entries, but we can check it's ≤20)
            if len(disclaimer_log) <= 20:
                log_test("MongoDB persistence - disclaimer_log capped at ≤20 entries", True, 
                        f"Current: {len(disclaimer_log)}")
            else:
                log_test("MongoDB persistence - disclaimer_log capped at ≤20 entries", False, 
                        f"Length: {len(disclaimer_log)}")
        else:
            log_test("MongoDB persistence - disclaimer_log is array", False, 
                    f"Type: {type(disclaimer_log)}")
        
        client.close()
        
    except Exception as e:
        log_test("MongoDB persistence check", False, f"Exception: {str(e)}")

# ============================================================================
# PRIORITY 3: REGRESSION - PUBLIC LEGAL ENDPOINTS
# ============================================================================

def test_legal_meta():
    """Test 3.1: GET /api/legal/meta → 200"""
    print("\n=== TEST 3.1: GET /api/legal/meta ===")
    
    try:
        response = requests.get(f"{BASE_URL}/legal/meta", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log_test("GET /api/legal/meta → 200", True, f"Keys: {list(data.keys())}")
        else:
            log_test("GET /api/legal/meta → 200", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /api/legal/meta → 200", False, f"Exception: {str(e)}")

def test_legal_changelog():
    """Test 3.2: GET /api/legal/changelog → 200"""
    print("\n=== TEST 3.2: GET /api/legal/changelog ===")
    
    try:
        response = requests.get(f"{BASE_URL}/legal/changelog", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            versions = data.get("versions", [])
            log_test("GET /api/legal/changelog → 200", True, f"Versions: {len(versions)}")
        else:
            log_test("GET /api/legal/changelog → 200", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /api/legal/changelog → 200", False, f"Exception: {str(e)}")

def test_legal_documents_terms():
    """Test 3.3: GET /api/legal/documents/terms → 200"""
    print("\n=== TEST 3.3: GET /api/legal/documents/terms ===")
    
    try:
        response = requests.get(f"{BASE_URL}/legal/documents/terms", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log_test("GET /api/legal/documents/terms → 200", True, 
                    f"Version: {data.get('version', 'N/A')}")
        else:
            log_test("GET /api/legal/documents/terms → 200", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /api/legal/documents/terms → 200", False, f"Exception: {str(e)}")

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

def print_summary():
    """Print test summary"""
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print("="*70)
    
    if test_results['failed'] > 0:
        print("\n❌ FAILED TESTS:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  • {test['name']}")
                if test['details']:
                    print(f"    {test['details']}")
    
    print("\n" + "="*70)

def main():
    """Main test execution"""
    print("="*70)
    print("SUBMUNDO - BACKEND TESTS: DISCLAIMER & LEGAL ENDPOINTS")
    print("Test Date: 11/07/2026")
    print("="*70)
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print(f"MongoDB: {MONGO_URL}/{DB_NAME}")
    print("="*70)
    
    # ========================================================================
    # PRIORITY 1: AUTH SMOKE TESTS
    # ========================================================================
    print("\n" + "="*70)
    print("PRIORITY 1: AUTH SMOKE TESTS")
    print("="*70)
    
    # Test 1.1: Admin login
    admin_session = test_admin_login()
    if not admin_session:
        print("\n❌ Admin login failed - cannot continue with admin tests")
    
    # Test 1.2: Register new account
    new_session, new_email = test_register_new_account()
    if not new_session:
        print("\n❌ Register failed - cannot continue with new account tests")
    
    # ========================================================================
    # PRIORITY 2: NEW ENDPOINT POST /api/legal/disclaimer-ack
    # ========================================================================
    print("\n" + "="*70)
    print("PRIORITY 2: NEW ENDPOINT POST /api/legal/disclaimer-ack")
    print("="*70)
    
    # Test 2.1: Without token → 401
    test_disclaimer_ack_without_token()
    
    # Test 2.2-2.4: With token (use new account to avoid polluting admin)
    if new_session and new_email:
        # Test 2.2: accepted:true
        test_disclaimer_ack_accepted_true(new_session, new_email)
        
        # Wait a moment for persistence
        time.sleep(1)
        
        # Test 2.3: accepted:false
        test_disclaimer_ack_accepted_false(new_session)
        
        # Wait a moment for persistence
        time.sleep(1)
        
        # Test 2.4: Invalid body
        test_disclaimer_ack_invalid_body(new_session)
        
        # Test 2.5: MongoDB persistence
        test_disclaimer_persistence_mongodb(new_email)
    else:
        print("\n⚠️  Skipping disclaimer-ack tests (no authenticated session)")
    
    # ========================================================================
    # PRIORITY 3: REGRESSION - PUBLIC LEGAL ENDPOINTS
    # ========================================================================
    print("\n" + "="*70)
    print("PRIORITY 3: REGRESSION - PUBLIC LEGAL ENDPOINTS")
    print("="*70)
    
    # Test 3.1: GET /api/legal/meta
    test_legal_meta()
    
    # Test 3.2: GET /api/legal/changelog
    test_legal_changelog()
    
    # Test 3.3: GET /api/legal/documents/terms
    test_legal_documents_terms()
    
    # ========================================================================
    # SUMMARY
    # ========================================================================
    print_summary()

if __name__ == "__main__":
    main()
