#!/usr/bin/env python3
"""
Backend test suite for Lusorae - Design SSS das Equipas
Tests the ADDITIVE backend changes for the "Design SSS das Equipas" round.
"""

import requests
import json
import sys
from typing import Dict, Any, Optional

# Configuration
BASE_URL = "https://dynamic-tactical-map.preview.emergentagent.com"
API_URL = f"{BASE_URL}/api"

# Test credentials
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "LusoraeAdmin2026!"

# ANSI color codes for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"


class TestResult:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.errors = []

    def add_pass(self, test_name: str):
        self.passed += 1
        print(f"{GREEN}✓{RESET} {test_name}")

    def add_fail(self, test_name: str, error: str):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print(f"{RED}✗{RESET} {test_name}: {error}")

    def add_warning(self, test_name: str, warning: str):
        self.warnings += 1
        print(f"{YELLOW}⚠{RESET} {test_name}: {warning}")

    def summary(self):
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}TEST SUMMARY{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")
        print(f"{GREEN}Passed:{RESET} {self.passed}")
        print(f"{RED}Failed:{RESET} {self.failed}")
        print(f"{YELLOW}Warnings:{RESET} {self.warnings}")
        if self.errors:
            print(f"\n{RED}ERRORS:{RESET}")
            for error in self.errors:
                print(f"  - {error}")
        print(f"{BLUE}{'='*60}{RESET}\n")
        return self.failed == 0


class LusoraeAPIClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.session = requests.Session()

    def login(self, email: str, password: str) -> bool:
        """Login and store the JWT token"""
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                return True
            return False
        except Exception as e:
            print(f"{RED}Login error: {e}{RESET}")
            return False

    def get(self, endpoint: str, auth: bool = True) -> requests.Response:
        """Make a GET request"""
        headers = {}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return self.session.get(f"{self.base_url}{endpoint}", headers=headers)

    def post(self, endpoint: str, data: Dict[Any, Any], auth: bool = True) -> requests.Response:
        """Make a POST request"""
        headers = {"Content-Type": "application/json"}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return self.session.post(f"{self.base_url}{endpoint}", json=data, headers=headers)


def test_catalog_team_meta(client: LusoraeAPIClient, result: TestResult):
    """Test 1: GET /api/game/catalog contains team_meta with 38 keys"""
    print(f"\n{BLUE}Test 1: Catalog team_meta{RESET}")
    
    try:
        response = client.get("/game/catalog", auth=False)
        
        if response.status_code != 200:
            result.add_fail("GET /api/game/catalog", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        # Check team_meta exists
        if "team_meta" not in data:
            result.add_fail("team_meta presence", "team_meta not found in catalog")
            return
        
        result.add_pass("team_meta presence")
        
        team_meta = data["team_meta"]
        
        # Expected 38 keys
        expected_keys = [
            "leader_min_rank", "no_leader_penalty", "clutch_save_max",
            "medic_injury_mult", "medic_recovery_mult", "lawyer_arrest_mult",
            "driver_attr_baseline", "driver_travel_reduction_per_point",
            "driver_travel_reduction_max", "driver_escape_bonus_per_point",
            "driver_escape_bonus_max", "strategist_min_int",
            "strategist_relief_frac", "strategist_relief_max",
            "momentum_bonus_per_win", "momentum_bonus_max",
            "momentum_penalty_per_loss", "momentum_penalty_max",
            "momentum_escape_bonus_max", "coordination_bonus_max",
            "coordination_ramp_s", "coordination_ramp_missions",
            "familiarity_bonus_max", "familiarity_ramp_missions",
            "familiarity_min_missions", "uniform_spec_bonus",
            "solo_member_penalty", "incomplete_penalty_per_missing",
            "incomplete_penalty_max", "synergy_max", "synergy_baseline",
            "synergy_spread", "fatigue_curve_exp", "morale_penalty_asymmetry",
            "loyalty_bonus_max", "loyalty_penalty_max", "category_attrs",
            "reorg_after_roster_change_s"
        ]
        
        missing_keys = [key for key in expected_keys if key not in team_meta]
        extra_keys = [key for key in team_meta if key not in expected_keys]
        
        if missing_keys:
            result.add_fail("team_meta keys", f"Missing keys: {missing_keys}")
        elif len(team_meta) != 38:
            result.add_warning("team_meta keys", f"Expected 38 keys, got {len(team_meta)}")
        else:
            result.add_pass("team_meta has 38 keys")
        
        # Verify specific key values
        if team_meta.get("leader_min_rank") == "chefe_equipa":
            result.add_pass("leader_min_rank value")
        else:
            result.add_fail("leader_min_rank value", f"Expected 'chefe_equipa', got {team_meta.get('leader_min_rank')}")
        
        if team_meta.get("no_leader_penalty") == 0.03:
            result.add_pass("no_leader_penalty value")
        else:
            result.add_fail("no_leader_penalty value", f"Expected 0.03, got {team_meta.get('no_leader_penalty')}")
        
        if team_meta.get("clutch_save_max") == 0.18:
            result.add_pass("clutch_save_max value")
        else:
            result.add_fail("clutch_save_max value", f"Expected 0.18, got {team_meta.get('clutch_save_max')}")
        
        # Check category_attrs is a dict
        if isinstance(team_meta.get("category_attrs"), dict):
            result.add_pass("category_attrs is dict")
            cat_attrs = team_meta["category_attrs"]
            expected_cats = ["assalto", "logistica", "tecnica", "influencia"]
            for cat in expected_cats:
                if cat in cat_attrs:
                    result.add_pass(f"category_attrs.{cat} present")
                else:
                    result.add_fail(f"category_attrs.{cat} present", "Missing")
        else:
            result.add_fail("category_attrs is dict", f"Got {type(team_meta.get('category_attrs'))}")
        
        # Regression: Check weapon_meta still present
        if "weapon_meta" in data:
            result.add_pass("weapon_meta regression check")
        else:
            result.add_fail("weapon_meta regression check", "weapon_meta missing from catalog")
        
    except Exception as e:
        result.add_fail("GET /api/game/catalog", f"Exception: {str(e)}")


def test_state_team_fields(client: LusoraeAPIClient, result: TestResult):
    """Test 2: GET /api/game/state - teams have streak, roster_missions, category_missions"""
    print(f"\n{BLUE}Test 2: State team fields{RESET}")
    
    try:
        response = client.get("/game/state")
        
        if response.status_code != 200:
            result.add_fail("GET /api/game/state", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        if "teams" not in data:
            result.add_fail("teams in state", "teams not found")
            return
        
        teams = data["teams"]
        
        if not teams:
            result.add_warning("teams in state", "No teams found in state")
            return
        
        result.add_pass(f"GET /api/game/state ({len(teams)} teams)")
        
        # Check each team has the required fields
        for i, team in enumerate(teams):
            team_name = team.get("name", f"Team {i}")
            
            # Check streak (int)
            if "streak" in team:
                if isinstance(team["streak"], int):
                    result.add_pass(f"{team_name}: streak field (int)")
                else:
                    result.add_fail(f"{team_name}: streak field", f"Not int: {type(team['streak'])}")
            else:
                result.add_fail(f"{team_name}: streak field", "Missing")
            
            # Check roster_missions (int)
            if "roster_missions" in team:
                if isinstance(team["roster_missions"], int):
                    result.add_pass(f"{team_name}: roster_missions field (int)")
                else:
                    result.add_fail(f"{team_name}: roster_missions field", f"Not int: {type(team['roster_missions'])}")
            else:
                result.add_fail(f"{team_name}: roster_missions field", "Missing")
            
            # Check category_missions (dict)
            if "category_missions" in team:
                if isinstance(team["category_missions"], dict):
                    result.add_pass(f"{team_name}: category_missions field (dict)")
                else:
                    result.add_fail(f"{team_name}: category_missions field", f"Not dict: {type(team['category_missions'])}")
            else:
                result.add_fail(f"{team_name}: category_missions field", "Missing")
        
    except Exception as e:
        result.add_fail("GET /api/game/state", f"Exception: {str(e)}")


def test_team_creation_regression(client: LusoraeAPIClient, result: TestResult):
    """Test 3: Create new team and verify SSS v4 fields"""
    print(f"\n{BLUE}Test 3: Team creation regression{RESET}")
    
    try:
        # Get current state to check team count
        state_response = client.get("/game/state")
        if state_response.status_code != 200:
            result.add_fail("Pre-check state", f"Status {state_response.status_code}")
            return
        
        state_data = state_response.json()
        initial_team_count = len(state_data.get("teams", []))
        
        # Try to create a new team
        create_response = client.post("/game/teams/create", {"spec": "logistica"})
        
        if create_response.status_code == 200:
            result.add_pass("POST /api/game/teams/create")
            
            # Get state again to verify the new team
            state_response = client.get("/game/state")
            if state_response.status_code != 200:
                result.add_fail("Post-create state", f"Status {state_response.status_code}")
                return
            
            state_data = state_response.json()
            teams = state_data.get("teams", [])
            
            if len(teams) > initial_team_count:
                new_team = teams[-1]  # Assume last team is the new one
                
                # Verify SSS v4 fields
                if new_team.get("streak") == 0:
                    result.add_pass("New team: streak=0")
                else:
                    result.add_fail("New team: streak=0", f"Got {new_team.get('streak')}")
                
                if new_team.get("roster_missions") == 0:
                    result.add_pass("New team: roster_missions=0")
                else:
                    result.add_fail("New team: roster_missions=0", f"Got {new_team.get('roster_missions')}")
                
                if new_team.get("category_missions") == {}:
                    result.add_pass("New team: category_missions={}")
                else:
                    result.add_fail("New team: category_missions={}", f"Got {new_team.get('category_missions')}")
                
                return new_team
            else:
                result.add_fail("Team creation", "Team count did not increase")
        elif create_response.status_code == 400:
            # Might be at team limit or insufficient funds
            error_msg = create_response.json().get("detail", "Unknown error")
            result.add_warning("POST /api/game/teams/create", f"Cannot create team: {error_msg}")
        else:
            result.add_fail("POST /api/game/teams/create", f"Status {create_response.status_code}")
    
    except Exception as e:
        result.add_fail("Team creation regression", f"Exception: {str(e)}")
    
    return None


def test_employee_assignment(client: LusoraeAPIClient, result: TestResult):
    """Test 4: Assign employee to team without 500 error"""
    print(f"\n{BLUE}Test 4: Employee assignment{RESET}")
    
    try:
        # Get state to find a free employee and a team
        state_response = client.get("/game/state")
        if state_response.status_code != 200:
            result.add_fail("Get state for assignment", f"Status {state_response.status_code}")
            return
        
        state_data = state_response.json()
        employees = state_data.get("employees", [])
        teams = state_data.get("teams", [])
        
        if not teams:
            result.add_warning("Employee assignment", "No teams available")
            return
        
        # Find a free employee (not on mission, not in a team)
        free_employee = None
        for emp in employees:
            if emp.get("status") == "idle" and not emp.get("team_id"):
                free_employee = emp
                break
        
        if not free_employee:
            result.add_warning("Employee assignment", "No free employees available")
            return
        
        # Try to assign to first team
        team = teams[0]
        assign_response = client.post("/game/employees/assign", {
            "employee_id": free_employee["id"],
            "team_id": team["id"]
        })
        
        if assign_response.status_code == 200:
            result.add_pass("POST /api/game/employees/assign")
        elif assign_response.status_code == 400:
            error_msg = assign_response.json().get("detail", "Unknown error")
            result.add_warning("POST /api/game/employees/assign", f"Cannot assign: {error_msg}")
        elif assign_response.status_code == 500:
            result.add_fail("POST /api/game/employees/assign", "500 Internal Server Error")
        else:
            result.add_fail("POST /api/game/employees/assign", f"Status {assign_response.status_code}")
    
    except Exception as e:
        result.add_fail("Employee assignment", f"Exception: {str(e)}")


def test_vehicle_assignment(client: LusoraeAPIClient, result: TestResult):
    """Test 5: Assign/remove vehicle without 500 error"""
    print(f"\n{BLUE}Test 5: Vehicle assignment{RESET}")
    
    try:
        # Get state to find a free vehicle and a team
        state_response = client.get("/game/state")
        if state_response.status_code != 200:
            result.add_fail("Get state for vehicle", f"Status {state_response.status_code}")
            return
        
        state_data = state_response.json()
        vehicles = state_data.get("vehicles", [])
        teams = state_data.get("teams", [])
        
        if not teams:
            result.add_warning("Vehicle assignment", "No teams available")
            return
        
        # Find a free vehicle
        free_vehicle = None
        for veh in vehicles:
            if not veh.get("team_id"):
                free_vehicle = veh
                break
        
        if not free_vehicle:
            result.add_warning("Vehicle assignment", "No free vehicles available")
            return
        
        # Try to assign to first team
        team = teams[0]
        assign_response = client.post("/game/vehicles/assign", {
            "vehicle_id": free_vehicle["id"],
            "team_id": team["id"]
        })
        
        if assign_response.status_code == 200:
            result.add_pass("POST /api/game/vehicles/assign")
            
            # Try to unassign
            unassign_response = client.post("/game/vehicles/assign", {
                "vehicle_id": free_vehicle["id"],
                "team_id": None
            })
            
            if unassign_response.status_code == 200:
                result.add_pass("POST /api/game/vehicles/assign (unassign)")
            elif unassign_response.status_code == 500:
                result.add_fail("Vehicle unassign", "500 Internal Server Error")
            else:
                result.add_warning("Vehicle unassign", f"Status {unassign_response.status_code}")
        
        elif assign_response.status_code == 400:
            error_msg = assign_response.json().get("detail", "Unknown error")
            result.add_warning("POST /api/game/vehicles/assign", f"Cannot assign: {error_msg}")
        elif assign_response.status_code == 500:
            result.add_fail("POST /api/game/vehicles/assign", "500 Internal Server Error")
        else:
            result.add_fail("POST /api/game/vehicles/assign", f"Status {assign_response.status_code}")
    
    except Exception as e:
        result.add_fail("Vehicle assignment", f"Exception: {str(e)}")


def test_recommendation_endpoints(client: LusoraeAPIClient, result: TestResult):
    """Test 6: Recommendation endpoints return 200/4xx, never 500"""
    print(f"\n{BLUE}Test 6: Recommendation endpoints{RESET}")
    
    try:
        # Get state to find teams and opportunities
        state_response = client.get("/game/state")
        if state_response.status_code != 200:
            result.add_fail("Get state for recommendations", f"Status {state_response.status_code}")
            return
        
        state_data = state_response.json()
        teams = state_data.get("teams", [])
        opportunities = state_data.get("opportunities", [])
        
        if not teams:
            result.add_warning("Recommendation endpoints", "No teams available")
            return
        
        team_id = teams[0]["id"]
        
        # Test recommend_opportunity
        rec_opp_response = client.post("/game/dispatch/recommend_opportunity", {"team_id": team_id})
        if rec_opp_response.status_code in [200, 400, 404]:
            result.add_pass("POST /api/game/dispatch/recommend_opportunity")
        elif rec_opp_response.status_code == 500:
            result.add_fail("POST /api/game/dispatch/recommend_opportunity", "500 Internal Server Error")
        else:
            result.add_warning("POST /api/game/dispatch/recommend_opportunity", f"Status {rec_opp_response.status_code}")
        
        # Test recommend_team (if we have opportunities)
        if opportunities:
            opp_id = opportunities[0]["id"]
            rec_team_response = client.post("/game/dispatch/recommend_team", {"opportunity_id": opp_id})
            if rec_team_response.status_code in [200, 400, 404]:
                result.add_pass("POST /api/game/dispatch/recommend_team")
            elif rec_team_response.status_code == 500:
                result.add_fail("POST /api/game/dispatch/recommend_team", "500 Internal Server Error")
            else:
                result.add_warning("POST /api/game/dispatch/recommend_team", f"Status {rec_team_response.status_code}")
        else:
            result.add_warning("POST /api/game/dispatch/recommend_team", "No opportunities available")
        
        # Test recommend_repeat
        rec_repeat_response = client.post("/game/dispatch/recommend_repeat", {"team_id": team_id})
        if rec_repeat_response.status_code in [200, 400, 404]:
            result.add_pass("POST /api/game/dispatch/recommend_repeat")
        elif rec_repeat_response.status_code == 500:
            result.add_fail("POST /api/game/dispatch/recommend_repeat", "500 Internal Server Error")
        else:
            result.add_warning("POST /api/game/dispatch/recommend_repeat", f"Status {rec_repeat_response.status_code}")
    
    except Exception as e:
        result.add_fail("Recommendation endpoints", f"Exception: {str(e)}")


def test_dispatch_preview(client: LusoraeAPIClient, result: TestResult):
    """Test 7: Dispatch preview for eligible team/opportunity"""
    print(f"\n{BLUE}Test 7: Dispatch preview{RESET}")
    
    try:
        # Get state to find eligible team and opportunity
        state_response = client.get("/game/state")
        if state_response.status_code != 200:
            result.add_fail("Get state for preview", f"Status {state_response.status_code}")
            return
        
        state_data = state_response.json()
        teams = state_data.get("teams", [])
        opportunities = state_data.get("opportunities", [])
        
        if not teams or not opportunities:
            result.add_warning("Dispatch preview", "No teams or opportunities available")
            return
        
        # Find an idle team with members and vehicle
        eligible_team = None
        for team in teams:
            if team.get("status") == "idle" and team.get("vehicle_id"):
                # Check if team has members
                employees = state_data.get("employees", [])
                team_members = [e for e in employees if e.get("team_id") == team["id"] and e.get("status") == "idle"]
                if team_members:
                    eligible_team = team
                    break
        
        if not eligible_team:
            result.add_warning("Dispatch preview", "No eligible team found (need idle team with members and vehicle)")
            return
        
        # Find an active opportunity
        active_opp = None
        for opp in opportunities:
            if opp.get("status") == "active":
                active_opp = opp
                break
        
        if not active_opp:
            result.add_warning("Dispatch preview", "No active opportunities")
            return
        
        # Try preview
        preview_response = client.post("/game/dispatch/preview", {
            "team_id": eligible_team["id"],
            "opportunity_id": active_opp["id"]
        })
        
        if preview_response.status_code == 200:
            result.add_pass("POST /api/game/dispatch/preview")
            
            # Verify breakdown is present
            preview_data = preview_response.json()
            if "breakdown" in preview_data:
                result.add_pass("Preview has breakdown")
            else:
                result.add_fail("Preview has breakdown", "Missing breakdown field")
            
            if "chance" in preview_data:
                result.add_pass("Preview has chance")
            else:
                result.add_fail("Preview has chance", "Missing chance field")
        
        elif preview_response.status_code == 400:
            error_msg = preview_response.json().get("detail", "Unknown error")
            result.add_warning("POST /api/game/dispatch/preview", f"Cannot preview: {error_msg}")
        elif preview_response.status_code == 500:
            result.add_fail("POST /api/game/dispatch/preview", "500 Internal Server Error")
        else:
            result.add_fail("POST /api/game/dispatch/preview", f"Status {preview_response.status_code}")
    
    except Exception as e:
        result.add_fail("Dispatch preview", f"Exception: {str(e)}")


def test_login_regression(client: LusoraeAPIClient, result: TestResult):
    """Test 8: Login regression check"""
    print(f"\n{BLUE}Test 8: Login regression{RESET}")
    
    try:
        # Create a new client to test fresh login
        test_client = LusoraeAPIClient(API_URL)
        
        if test_client.login(ADMIN_EMAIL, ADMIN_PASSWORD):
            result.add_pass("POST /api/auth/login")
        else:
            result.add_fail("POST /api/auth/login", "Login failed")
    
    except Exception as e:
        result.add_fail("Login regression", f"Exception: {str(e)}")


def main():
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}LUSORAE BACKEND TEST SUITE{RESET}")
    print(f"{BLUE}Design SSS das Equipas - Backend Changes{RESET}")
    print(f"{BLUE}{'='*60}{RESET}\n")
    
    result = TestResult()
    client = LusoraeAPIClient(API_URL)
    
    # Login
    print(f"{BLUE}Logging in as {ADMIN_EMAIL}...{RESET}")
    if not client.login(ADMIN_EMAIL, ADMIN_PASSWORD):
        print(f"{RED}Failed to login. Cannot proceed with tests.{RESET}")
        sys.exit(1)
    print(f"{GREEN}Login successful{RESET}\n")
    
    # Run tests
    test_catalog_team_meta(client, result)
    test_state_team_fields(client, result)
    test_team_creation_regression(client, result)
    test_employee_assignment(client, result)
    test_vehicle_assignment(client, result)
    test_recommendation_endpoints(client, result)
    test_dispatch_preview(client, result)
    test_login_regression(client, result)
    
    # Summary
    success = result.summary()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
