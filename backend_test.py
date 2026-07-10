#!/usr/bin/env python3
"""
Backend test suite for Lusorae - Live Ops (SSS) Testing
Tests the "Operação em Direto" system with live_log, live_chance_delta, and recall functionality.
"""

import requests
import time
import json
from datetime import datetime, timezone

# Configuration
BASE_URL = "https://missao-qr.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"

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

def login():
    """Login and return session with token"""
    print("\n=== TEST 1: Login ===")
    session = requests.Session()
    
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                session.headers.update({"Authorization": f"Bearer {data['token']}"})
                log_test("Login with admin credentials", True, f"Token received")
                return session
            else:
                log_test("Login with admin credentials", False, "No token in response")
                return None
        else:
            log_test("Login with admin credentials", False, f"Status {response.status_code}: {response.text[:200]}")
            return None
    except Exception as e:
        log_test("Login with admin credentials", False, f"Exception: {str(e)}")
        return None

def test_get_state(session):
    """Test GET /api/game/state"""
    print("\n=== TEST 2: GET /api/game/state ===")
    
    try:
        response = session.get(f"{BASE_URL}/game/state", timeout=10)
        
        if response.status_code != 200:
            log_test("GET /state returns 200", False, f"Status {response.status_code}")
            return None
        
        data = response.json()
        
        # Check required fields
        required_fields = ["player", "teams", "opportunities", "missions"]
        missing = [f for f in required_fields if f not in data]
        
        if missing:
            log_test("GET /state has required fields", False, f"Missing: {missing}")
            return None
        
        log_test("GET /state returns 200 with required fields", True, 
                f"Teams: {len(data['teams'])}, Opportunities: {len(data['opportunities'])}, Missions: {len(data['missions'])}")
        
        return data
    except Exception as e:
        log_test("GET /state returns 200", False, f"Exception: {str(e)}")
        return None

def find_suitable_opportunity(state):
    """Find an opportunity that Crew Alfa can handle"""
    print("\n=== Finding suitable opportunity ===")
    
    teams = state.get("teams", [])
    opportunities = state.get("opportunities", [])
    
    # Find Crew Alfa or first available team
    team = None
    for t in teams:
        if t.get("status") == "idle" and t.get("vehicle_id"):
            team = t
            print(f"Found team: {t.get('name')} (status: {t.get('status')})")
            break
    
    if not team:
        print("❌ No idle team with vehicle found")
        return None, None
    
    # Try to find a suitable opportunity
    for opp in opportunities:
        if opp.get("status") != "active":
            continue
        
        # Check if opportunity is not expired
        expires_at = opp.get("expires_at")
        if expires_at:
            try:
                exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                if exp_dt <= datetime.now(timezone.utc):
                    continue
            except:
                pass
        
        print(f"Trying opportunity: {opp.get('name')} (category: {opp.get('category')}, risk: {opp.get('risk')})")
        return opp, team
    
    print("❌ No suitable opportunity found")
    return None, None

def test_dispatch_preview(session, opp_id, team_id):
    """Test dispatch preview to validate before actual dispatch"""
    print("\n=== Testing dispatch preview ===")
    
    try:
        response = session.post(
            f"{BASE_URL}/game/dispatch/preview",
            json={"opportunity_id": opp_id, "team_id": team_id},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"Preview OK - Chance: {data.get('chance', 0)*100:.1f}%, ETA: {data.get('eta_s', 0)}s")
            return True
        else:
            print(f"Preview failed: {response.status_code} - {response.text[:200]}")
            return False
    except Exception as e:
        print(f"Preview exception: {str(e)}")
        return False

def test_dispatch_mission(session, opp, team):
    """Test POST /api/game/dispatch and verify live_log + live_chance_delta"""
    print("\n=== TEST 3: Dispatch Mission ===")
    
    opp_id = opp["id"]
    team_id = team["id"]
    
    # First try preview
    if not test_dispatch_preview(session, opp_id, team_id):
        log_test("Dispatch preview", False, "Preview failed - skipping dispatch")
        return None
    
    try:
        response = session.post(
            f"{BASE_URL}/game/dispatch",
            json={"opportunity_id": opp_id, "team_id": team_id},
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("POST /dispatch returns 200", False, f"Status {response.status_code}: {response.text[:200]}")
            return None
        
        data = response.json()
        mission_id = data.get("mission_id")
        
        if not mission_id:
            log_test("POST /dispatch returns mission_id", False, "No mission_id in response")
            return None
        
        log_test("POST /dispatch returns 200 with mission_id", True, f"Mission ID: {mission_id}")
        
        # Wait a moment for the mission to be persisted
        time.sleep(1)
        
        # Get state to verify mission details
        state = test_get_state(session)
        if not state:
            return None
        
        # Find the mission
        mission = None
        for m in state.get("missions", []):
            if m.get("id") == mission_id:
                mission = m
                break
        
        if not mission:
            log_test("Mission found in state", False, "Mission not found after dispatch")
            return None
        
        log_test("Mission found in state", True)
        
        # Verify live_log
        live_log = mission.get("live_log", [])
        if not live_log:
            log_test("Mission has live_log (non-empty)", False, "live_log is empty")
            return None
        
        log_test("Mission has live_log (non-empty)", True, f"{len(live_log)} entries")
        
        # Verify live_log structure
        all_valid = True
        required_keys = ["at", "phase", "kind", "speaker", "text"]
        
        for i, entry in enumerate(live_log):
            missing = [k for k in required_keys if k not in entry]
            if missing:
                log_test(f"live_log entries have required keys", False, f"Entry {i} missing: {missing}")
                all_valid = False
                break
        
        if all_valid:
            log_test("live_log entries have required keys (at/phase/kind/speaker/text)", True)
        
        # Verify live_log is ordered by 'at'
        timestamps = [entry.get("at") for entry in live_log]
        is_sorted = timestamps == sorted(timestamps)
        log_test("live_log is ordered by 'at' (ascending)", is_sorted, 
                f"First: {timestamps[0] if timestamps else 'N/A'}, Last: {timestamps[-1] if timestamps else 'N/A'}")
        
        # Verify live_chance_delta
        live_chance_delta = mission.get("live_chance_delta")
        if live_chance_delta is None:
            log_test("Mission has live_chance_delta (float)", False, "live_chance_delta is missing")
        else:
            log_test("Mission has live_chance_delta (float)", True, f"Delta: {live_chance_delta}")
            
            # Verify sum of pct values matches delta (within tolerance)
            pct_entries = [e for e in live_log if "pct" in e]
            if pct_entries:
                total_pct = sum(e.get("pct", 0) for e in pct_entries)
                diff = abs(total_pct - live_chance_delta)
                tolerance = 0.001
                
                if diff <= tolerance:
                    log_test("Sum of pct values ≈ live_chance_delta (±0.001)", True, 
                            f"Sum: {total_pct:.4f}, Delta: {live_chance_delta:.4f}, Diff: {diff:.4f}")
                else:
                    log_test("Sum of pct values ≈ live_chance_delta (±0.001)", False, 
                            f"Sum: {total_pct:.4f}, Delta: {live_chance_delta:.4f}, Diff: {diff:.4f}")
        
        # Verify success_chance is present
        success_chance = mission.get("success_chance")
        if success_chance is not None:
            log_test("Mission has success_chance", True, f"Chance: {success_chance*100:.1f}%")
        else:
            log_test("Mission has success_chance", False, "success_chance is missing")
        
        return mission
        
    except Exception as e:
        log_test("POST /dispatch", False, f"Exception: {str(e)}")
        return None

def test_mission_progression(session, mission):
    """Poll mission until it reaches 'returning' phase and verify final_chance"""
    print("\n=== TEST 4: Mission Progression to 'returning' ===")
    
    mission_id = mission.get("id")
    max_polls = 120  # 10 minutes max (5s intervals)
    poll_interval = 5
    
    print(f"Polling mission {mission_id} every {poll_interval}s (max {max_polls} polls)...")
    
    for poll_count in range(max_polls):
        time.sleep(poll_interval)
        
        state = test_get_state(session)
        if not state:
            log_test("Mission progression polling", False, "Failed to get state")
            return None
        
        # Find the mission
        current_mission = None
        for m in state.get("missions", []):
            if m.get("id") == mission_id:
                current_mission = m
                break
        
        # Check if mission is in history (done)
        if not current_mission:
            for m in state.get("history", []):
                if m.get("id") == mission_id:
                    current_mission = m
                    break
        
        if not current_mission:
            log_test("Mission progression polling", False, f"Mission disappeared after {poll_count} polls")
            return None
        
        phase = current_mission.get("phase")
        outcome = current_mission.get("outcome")
        
        print(f"Poll {poll_count+1}/{max_polls}: Phase={phase}, Outcome={outcome}")
        
        if phase == "returning" or phase == "done":
            print(f"✅ Mission reached phase '{phase}' after {(poll_count+1)*poll_interval}s")
            
            # Verify live_log has returning entries
            live_log = current_mission.get("live_log", [])
            returning_entries = [e for e in live_log if e.get("phase") == "returning"]
            
            if returning_entries:
                log_test("live_log has entries with phase='returning'", True, 
                        f"{len(returning_entries)} returning entries")
            else:
                log_test("live_log has entries with phase='returning'", False, 
                        "No returning entries found")
            
            # Verify final_chance if outcome is success/partial/failure/police
            outcome = current_mission.get("outcome")
            if outcome in ("success", "partial", "failure", "police"):
                final_chance = current_mission.get("final_chance")
                
                if final_chance is not None:
                    if 0.02 <= final_chance <= 0.98:
                        log_test("final_chance present and in range [0.02, 0.98]", True, 
                                f"final_chance: {final_chance:.3f}, outcome: {outcome}")
                    else:
                        log_test("final_chance present and in range [0.02, 0.98]", False, 
                                f"final_chance: {final_chance:.3f} out of range")
                else:
                    log_test("final_chance present for outcome", False, 
                            f"final_chance missing for outcome: {outcome}")
            
            return current_mission
    
    log_test("Mission progression to returning", False, 
            f"Mission did not reach returning/done phase after {max_polls*poll_interval}s")
    return None

def test_recall_mission(session, state):
    """Test POST /api/game/missions/recall"""
    print("\n=== TEST 5: Recall Mission ===")
    
    # Find an opportunity and team for a new mission
    opp, team = find_suitable_opportunity(state)
    
    if not opp or not team:
        log_test("Recall test - find opportunity", False, "No suitable opportunity/team for recall test")
        return
    
    # Dispatch a new mission
    print("Dispatching new mission for recall test...")
    try:
        response = session.post(
            f"{BASE_URL}/game/dispatch",
            json={"opportunity_id": opp["id"], "team_id": team["id"]},
            timeout=10
        )
        
        if response.status_code != 200:
            log_test("Recall test - dispatch mission", False, f"Status {response.status_code}")
            return
        
        mission_id = response.json().get("mission_id")
        if not mission_id:
            log_test("Recall test - dispatch mission", False, "No mission_id")
            return
        
        log_test("Recall test - dispatch mission", True, f"Mission {mission_id}")
        
        # Wait a moment
        time.sleep(2)
        
        # Recall the mission immediately
        print(f"Recalling mission {mission_id}...")
        recall_response = session.post(
            f"{BASE_URL}/game/missions/recall",
            json={"mission_id": mission_id},
            timeout=10
        )
        
        if recall_response.status_code != 200:
            log_test("POST /missions/recall returns 200", False, 
                    f"Status {recall_response.status_code}: {recall_response.text[:200]}")
            return
        
        log_test("POST /missions/recall returns 200", True)
        
        # Get state to verify recall
        time.sleep(1)
        state = test_get_state(session)
        if not state:
            return
        
        # Find the recalled mission
        recalled_mission = None
        for m in state.get("missions", []):
            if m.get("id") == mission_id:
                recalled_mission = m
                break
        
        if not recalled_mission:
            log_test("Recalled mission found in state", False, "Mission not found")
            return
        
        # Verify outcome is 'recalled'
        outcome = recalled_mission.get("outcome")
        if outcome == "recalled":
            log_test("Recalled mission has outcome='recalled'", True)
        else:
            log_test("Recalled mission has outcome='recalled'", False, f"Outcome: {outcome}")
        
        # Verify phase is 'returning'
        phase = recalled_mission.get("phase")
        if phase == "returning":
            log_test("Recalled mission has phase='returning'", True)
        else:
            log_test("Recalled mission has phase='returning'", False, f"Phase: {phase}")
        
        # Verify live_log has recall entries
        live_log = recalled_mission.get("live_log", [])
        recall_texts = [e.get("text", "") for e in live_log if "regresso" in e.get("text", "").lower()]
        
        if len(recall_texts) >= 3:
            log_test("live_log contains recall entries (≥3 with 'regresso')", True, 
                    f"{len(recall_texts)} recall entries")
        else:
            log_test("live_log contains recall entries (≥3 with 'regresso')", False, 
                    f"Only {len(recall_texts)} recall entries found")
        
        # Verify no future operating entries (at > now)
        now_iso = datetime.now(timezone.utc).isoformat()
        future_operating = [e for e in live_log 
                          if e.get("phase") == "operating" and e.get("at", "") > now_iso]
        
        if not future_operating:
            log_test("No future operating entries after recall", True)
        else:
            log_test("No future operating entries after recall", False, 
                    f"{len(future_operating)} future operating entries found")
        
    except Exception as e:
        log_test("Recall test", False, f"Exception: {str(e)}")

def test_regression(session):
    """Run regression tests"""
    print("\n=== TEST 6: Regression Tests ===")
    
    # Test GET /catalog
    try:
        response = session.get(f"{BASE_URL}/game/catalog", timeout=10)
        if response.status_code == 200:
            log_test("GET /catalog returns 200", True)
        else:
            log_test("GET /catalog returns 200", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("GET /catalog returns 200", False, f"Exception: {str(e)}")
    
    # Test multiple GET /state calls
    all_ok = True
    for i in range(3):
        try:
            response = session.get(f"{BASE_URL}/game/state", timeout=10)
            if response.status_code != 200:
                all_ok = False
                break
        except:
            all_ok = False
            break
    
    if all_ok:
        log_test("Multiple GET /state calls (3x) without 500", True)
    else:
        log_test("Multiple GET /state calls (3x) without 500", False)

def print_summary():
    """Print test summary"""
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Total Tests: {test_results['passed'] + test_results['failed']}")
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print("="*60)
    
    if test_results['failed'] > 0:
        print("\nFailed Tests:")
        for test in test_results['tests']:
            if not test['passed']:
                print(f"  ❌ {test['name']}")
                if test['details']:
                    print(f"     {test['details']}")

def main():
    """Main test execution"""
    print("="*60)
    print("LUSORAE - LIVE OPS (SSS) BACKEND TESTS")
    print("="*60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Admin: {ADMIN_EMAIL}")
    print("="*60)
    
    # Test 1: Login
    session = login()
    if not session:
        print("\n❌ Login failed - cannot continue tests")
        print_summary()
        return
    
    # Test 2: Get state
    state = test_get_state(session)
    if not state:
        print("\n❌ GET /state failed - cannot continue tests")
        print_summary()
        return
    
    # Find suitable opportunity
    opp, team = find_suitable_opportunity(state)
    if not opp or not team:
        print("\n❌ No suitable opportunity/team found - cannot test dispatch")
        print_summary()
        return
    
    # Test 3: Dispatch mission
    mission = test_dispatch_mission(session, opp, team)
    if not mission:
        print("\n⚠️  Dispatch failed - skipping progression test")
    else:
        # Test 4: Mission progression
        final_mission = test_mission_progression(session, mission)
    
    # Test 5: Recall (with fresh state)
    state = test_get_state(session)
    if state:
        test_recall_mission(session, state)
    
    # Test 6: Regression
    test_regression(session)
    
    # Print summary
    print_summary()

if __name__ == "__main__":
    main()
