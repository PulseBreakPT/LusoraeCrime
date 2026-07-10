#!/usr/bin/env python3
"""
Testes backend para SSS v4 — QI das Equipas (Lusorae).
Credenciais: admin@lusorae.com / admin123
"""
import os
import sys
import time
import requests
from datetime import datetime
from pymongo import MongoClient

# Base URL from frontend/.env
BASE_URL = "https://tier-weapon-upgrade.preview.emergentagent.com/api"

# Test credentials (CHANGED - DB was reset)
ADMIN_EMAIL = "admin@lusorae.com"
ADMIN_PASSWORD = "admin123"

# MongoDB connection
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "test_database"

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
CYAN = "\033[96m"
RESET = "\033[0m"

test_results = {"passed": 0, "failed": 0, "errors": [], "warnings": []}
breakdown_items_observed = set()
mission_fields_verified = {}


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


def log_warning(message):
    print(f"{YELLOW}⚠{RESET} {message}")
    test_results["warnings"].append(message)


def log_section(title):
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}{title}{RESET}")
    print(f"{BLUE}{'='*70}{RESET}")


def log_info(message):
    print(f"{CYAN}ℹ{RESET} {message}")


def get_mongo_client():
    """Get MongoDB client"""
    try:
        client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        client.server_info()  # Force connection
        return client
    except Exception as e:
        log_warning(f"Não foi possível conectar ao MongoDB: {e}")
        return None


def test_login():
    """Test A: Login and GET /api/game/state"""
    log_section("A. LOGIN E GET /api/game/state")
    
    try:
        # Login
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }, timeout=10)
        
        if resp.status_code != 200:
            log_test("Login com admin@lusorae.com / admin123 → 200", False, 
                    f"Status: {resp.status_code}, Body: {resp.text[:200]}")
            return None
        
        data = resp.json()
        if "access_token" not in data:
            log_test("Login retorna access_token", False, "Missing access_token")
            return None
        
        log_test("Login com admin@lusorae.com / admin123 → 200", True)
        token = data["access_token"]
        
        # GET /api/game/state
        resp_state = requests.get(f"{BASE_URL}/game/state",
            headers={"Authorization": f"Bearer {token}"}, timeout=15)
        
        if resp_state.status_code != 200:
            log_test("GET /api/game/state → 200", False, 
                    f"Status: {resp_state.status_code}, Body: {resp_state.text[:200]}")
            return None
        
        state = resp_state.json()
        
        # Verify teams and opportunities exist
        if "teams" not in state or "opportunities" not in state:
            log_test("GET /api/game/state devolve teams e opportunities", False, 
                    f"Missing fields. Keys: {list(state.keys())}")
            return None
        
        log_test("GET /api/game/state → 200 com teams e opportunities", True)
        log_info(f"Equipas disponíveis: {len(state.get('teams', []))}")
        log_info(f"Oportunidades ativas: {len(state.get('opportunities', []))}")
        
        return {
            "token": token,
            "state": state,
            "teams": state.get("teams", []),
            "opportunities": state.get("opportunities", [])
        }
        
    except Exception as e:
        log_test("Login e GET /api/game/state", False, str(e))
        return None


def test_dispatch_preview(context):
    """Test B: POST /api/game/dispatch/preview for multiple opportunities"""
    log_section("B. POST /api/game/dispatch/preview (breakdown)")
    
    if not context:
        log_warning("Sem contexto de login, a saltar testes de preview")
        return
    
    token = context["token"]
    teams = context["teams"]
    opportunities = context["opportunities"]
    
    if not teams:
        log_warning("Sem equipas disponíveis para testar preview")
        return
    
    if not opportunities:
        log_warning("Sem oportunidades disponíveis para testar preview")
        return
    
    # Get first idle team
    idle_team = next((t for t in teams if t.get("status") == "idle"), None)
    if not idle_team:
        log_warning("Sem equipas idle para testar preview")
        return
    
    team_id = idle_team["id"]
    log_info(f"A usar equipa: {idle_team.get('name')} (id: {team_id})")
    
    # Test preview for multiple opportunities
    previews_tested = 0
    for opp in opportunities[:5]:  # Test up to 5 opportunities
        opp_id = opp["id"]
        opp_name = opp.get("name", "Unknown")
        
        try:
            resp = requests.post(f"{BASE_URL}/game/dispatch/preview",
                headers={"Authorization": f"Bearer {token}"},
                json={"opportunity_id": opp_id, "team_id": team_id},
                timeout=10)
            
            if resp.status_code != 200:
                log_test(f"Preview {opp_name} → 200", False, 
                        f"Status: {resp.status_code}, Body: {resp.text[:200]}")
                continue
            
            data = resp.json()
            
            # Verify breakdown structure
            if "breakdown" not in data:
                log_test(f"Preview {opp_name} tem breakdown", False, "Missing breakdown")
                continue
            
            breakdown = data["breakdown"]
            if not isinstance(breakdown, list):
                log_test(f"Preview {opp_name} breakdown é lista", False, 
                        f"Type: {type(breakdown)}")
                continue
            
            # Verify breakdown items structure
            valid_breakdown = True
            for item in breakdown:
                if not all(k in item for k in ["key", "label", "pct", "tip", "category"]):
                    log_test(f"Preview {opp_name} breakdown items têm campos obrigatórios", False,
                            f"Item missing fields: {item}")
                    valid_breakdown = False
                    break
                
                # Collect breakdown keys
                breakdown_items_observed.add(item["key"])
            
            if not valid_breakdown:
                continue
            
            # Verify sum of pct ≈ chance (tolerance 0.001)
            chance = data.get("chance", 0)
            sum_pct = sum(item["pct"] for item in breakdown)
            diff = abs(sum_pct - chance)
            
            if diff > 0.001:
                log_test(f"Preview {opp_name}: soma breakdown ≈ chance", False,
                        f"Chance: {chance:.4f}, Soma: {sum_pct:.4f}, Diff: {diff:.4f}")
                continue
            
            log_test(f"Preview {opp_name} → 200 com breakdown válido (soma={sum_pct:.3f}, chance={chance:.3f})", True)
            previews_tested += 1
            
            # Log breakdown items for first opportunity
            if previews_tested == 1:
                log_info(f"Breakdown items ({len(breakdown)}):")
                for item in breakdown:
                    sign = "+" if item["pct"] >= 0 else ""
                    print(f"    {sign}{item['pct']*100:.1f}% - {item['label']} ({item['key']})")
            
        except Exception as e:
            log_test(f"Preview {opp_name}", False, str(e))
    
    if previews_tested > 0:
        log_info(f"Total de previews testados: {previews_tested}")
        log_info(f"Breakdown keys observadas: {sorted(breakdown_items_observed)}")


def test_dispatch_and_mission_cycle(context):
    """Test C: POST /api/game/dispatch and complete mission cycle"""
    log_section("C. POST /api/game/dispatch + ciclo completo de missão")
    
    if not context:
        log_warning("Sem contexto de login, a saltar teste de dispatch")
        return None
    
    token = context["token"]
    teams = context["teams"]
    opportunities = context["opportunities"]
    
    if not teams or not opportunities:
        log_warning("Sem equipas ou oportunidades para testar dispatch")
        return None
    
    # Find a viable opportunity (low risk, short duration)
    viable_opp = None
    idle_team = next((t for t in teams if t.get("status") == "idle"), None)
    
    if not idle_team:
        log_warning("Sem equipas idle para despachar")
        return None
    
    team_id = idle_team["id"]
    
    # Try to find a short, low-risk opportunity
    for opp in opportunities:
        if opp.get("risk", 5) <= 2 and opp.get("duration_s", 999) <= 120:
            viable_opp = opp
            break
    
    if not viable_opp:
        # Fallback to first opportunity
        viable_opp = opportunities[0]
    
    opp_id = viable_opp["id"]
    opp_name = viable_opp.get("name", "Unknown")
    duration_s = viable_opp.get("duration_s", 120)
    
    log_info(f"A despachar equipa '{idle_team.get('name')}' para '{opp_name}'")
    log_info(f"Duração estimada: {duration_s}s + viagem")
    
    try:
        # Dispatch
        resp = requests.post(f"{BASE_URL}/game/dispatch",
            headers={"Authorization": f"Bearer {token}"},
            json={"opportunity_id": opp_id, "team_id": team_id},
            timeout=10)
        
        if resp.status_code != 200:
            log_test("POST /api/game/dispatch → 200", False,
                    f"Status: {resp.status_code}, Body: {resp.text[:200]}")
            return None
        
        data = resp.json()
        if "mission_id" not in data:
            log_test("Dispatch retorna mission_id", False, "Missing mission_id")
            return None
        
        mission_id = data["mission_id"]
        log_test(f"POST /api/game/dispatch → 200 com mission_id", True)
        log_info(f"Mission ID: {mission_id}")
        
        # Poll /api/game/state until mission completes
        log_info("A aguardar conclusão da missão (polling /state)...")
        max_polls = 60  # Max 5 minutes (60 * 5s)
        poll_interval = 5
        mission_completed = False
        errors_during_polling = []
        
        for poll_count in range(max_polls):
            time.sleep(poll_interval)
            
            try:
                resp_state = requests.get(f"{BASE_URL}/game/state",
                    headers={"Authorization": f"Bearer {token}"}, timeout=15)
                
                if resp_state.status_code != 200:
                    errors_during_polling.append(f"Poll {poll_count+1}: Status {resp_state.status_code}")
                    continue
                
                state = resp_state.json()
                
                # Check if team is back to idle
                current_team = next((t for t in state.get("teams", []) if t["id"] == team_id), None)
                if current_team and current_team.get("status") == "idle":
                    mission_completed = True
                    log_info(f"Missão concluída após {(poll_count+1)*poll_interval}s de polling")
                    break
                
                # Show progress
                if (poll_count + 1) % 6 == 0:  # Every 30s
                    status = current_team.get("status", "unknown") if current_team else "not found"
                    log_info(f"  Poll {poll_count+1}/{max_polls}: equipa status = {status}")
            
            except Exception as e:
                errors_during_polling.append(f"Poll {poll_count+1}: {str(e)}")
        
        if errors_during_polling:
            log_test("Polling /state sem erros 500", False,
                    f"Erros durante polling: {errors_during_polling[:3]}")
            return None
        
        if not mission_completed:
            log_test("Missão concluída dentro do timeout", False,
                    f"Timeout após {max_polls*poll_interval}s")
            return None
        
        log_test("Ciclo completo de missão sem erros 500 e equipa volta a idle", True)
        
        # Check for events
        final_state = requests.get(f"{BASE_URL}/game/state",
            headers={"Authorization": f"Bearer {token}"}, timeout=15).json()
        
        events = final_state.get("events", [])
        if events:
            log_info(f"Eventos gerados: {len(events)}")
            # Show last 3 events
            for event in events[:3]:
                msg = event.get("message", "")
                if len(msg) > 80:
                    msg = msg[:77] + "..."
                log_info(f"  • {msg}")
        
        return {"mission_id": mission_id, "team_id": team_id, "category": viable_opp.get("category")}
        
    except Exception as e:
        log_test("Dispatch e ciclo de missão", False, str(e))
        return None


def test_repeat_preview(context, mission_context):
    """Test D: Repeat preview after mission completion"""
    log_section("D. Preview após missão concluída (familiaridade)")
    
    if not context or not mission_context:
        log_warning("Sem contexto para testar preview repetido")
        return
    
    token = context["token"]
    team_id = mission_context["team_id"]
    category = mission_context["category"]
    
    log_info(f"A procurar oportunidades da categoria '{category}' para testar familiaridade")
    
    try:
        # Get fresh state
        resp_state = requests.get(f"{BASE_URL}/game/state",
            headers={"Authorization": f"Bearer {token}"}, timeout=15)
        
        if resp_state.status_code != 200:
            log_test("GET /state para preview repetido", False, f"Status: {resp_state.status_code}")
            return
        
        state = resp_state.json()
        opportunities = state.get("opportunities", [])
        
        # Find opportunity of same category
        same_category_opp = next((o for o in opportunities if o.get("category") == category), None)
        
        if not same_category_opp:
            log_warning(f"Sem oportunidades da categoria '{category}' disponíveis para testar familiaridade")
            log_info("A testar preview com qualquer oportunidade disponível...")
            if opportunities:
                same_category_opp = opportunities[0]
            else:
                log_warning("Sem oportunidades disponíveis")
                return
        
        opp_id = same_category_opp["id"]
        opp_name = same_category_opp.get("name", "Unknown")
        
        # Test preview
        resp = requests.post(f"{BASE_URL}/game/dispatch/preview",
            headers={"Authorization": f"Bearer {token}"},
            json={"opportunity_id": opp_id, "team_id": team_id},
            timeout=10)
        
        if resp.status_code != 200:
            log_test(f"Preview após missão → 200", False,
                    f"Status: {resp.status_code}, Body: {resp.text[:200]}")
            return
        
        data = resp.json()
        breakdown = data.get("breakdown", [])
        
        # Check if "familiaridade" appears
        has_familiaridade = any(item.get("key") == "familiaridade" for item in breakdown)
        
        if has_familiaridade:
            log_test("Preview após missão: item 'familiaridade' aparece no breakdown", True)
            fam_item = next(item for item in breakdown if item.get("key") == "familiaridade")
            log_info(f"  Familiaridade: +{fam_item['pct']*100:.1f}% - {fam_item['label']}")
        else:
            log_info("Item 'familiaridade' NÃO aparece (normal se <3 ops da categoria)")
            log_test("Preview após missão não dá erro 500", True)
        
        log_info(f"Breakdown items no preview repetido: {[item['key'] for item in breakdown]}")
        
    except Exception as e:
        log_test("Preview após missão concluída", False, str(e))


def test_mission_document_fields(mission_context):
    """Test E: Verify mission document has new fields in MongoDB"""
    log_section("E. Verificação de campos novos no documento de missão (MongoDB)")
    
    if not mission_context:
        log_warning("Sem contexto de missão para verificar MongoDB")
        return
    
    mission_id = mission_context["mission_id"]
    
    client = get_mongo_client()
    if not client:
        log_warning("Sem acesso ao MongoDB, a saltar verificação de campos")
        return
    
    try:
        db = client[DB_NAME]
        missions_col = db["missions"]
        teams_col = db["teams"]
        
        # Find mission document
        from bson import ObjectId
        mission_doc = missions_col.find_one({"_id": ObjectId(mission_id)})
        
        if not mission_doc:
            log_test("Documento de missão encontrado no MongoDB", False, f"Mission ID: {mission_id}")
            return
        
        log_test("Documento de missão encontrado no MongoDB", True)
        
        # Check new fields
        required_fields = {
            "team_streak": int,
            "vehicle_speed_effective": (int, float),
            "vehicle_discreet": bool,
            "has_leader": bool,
            "leader_cool": (int, float),
            "has_medic": bool,
            "has_lawyer": bool,
            "best_driver": (int, float),
            "top_negatives": list,
            "heat_at_dispatch": (int, float)
        }
        
        for field, expected_type in required_fields.items():
            if field not in mission_doc:
                log_test(f"Campo '{field}' presente no mission doc", False, "Campo em falta")
                mission_fields_verified[field] = False
            else:
                value = mission_doc[field]
                if isinstance(expected_type, tuple):
                    type_ok = isinstance(value, expected_type)
                else:
                    type_ok = isinstance(value, expected_type)
                
                if type_ok:
                    log_test(f"Campo '{field}' presente e tipo correto", True)
                    mission_fields_verified[field] = True
                    
                    # Log value for inspection
                    if field == "top_negatives":
                        log_info(f"  {field} = {value[:2] if len(value) > 2 else value}...")
                    else:
                        log_info(f"  {field} = {value}")
                else:
                    log_test(f"Campo '{field}' tem tipo correto", False,
                            f"Esperado {expected_type}, obtido {type(value)}")
                    mission_fields_verified[field] = False
        
        # Check team document
        team_id = mission_doc.get("team_id")
        if team_id:
            team_doc = teams_col.find_one({"_id": ObjectId(team_id)})
            if team_doc:
                log_test("Documento de equipa encontrado no MongoDB", True)
                
                # Check team fields
                roster_missions = team_doc.get("roster_missions", 0)
                category_missions = team_doc.get("category_missions", {})
                streak = team_doc.get("streak")
                
                log_info(f"  roster_missions = {roster_missions}")
                log_info(f"  category_missions = {category_missions}")
                log_info(f"  streak = {streak}")
                
                if roster_missions >= 1:
                    log_test("Team.roster_missions >= 1 após conclusão", True)
                else:
                    log_test("Team.roster_missions >= 1", False, f"Valor: {roster_missions}")
                
                if streak is not None:
                    log_test("Team.streak != null", True)
                else:
                    log_test("Team.streak != null", False, "streak é null")
            else:
                log_test("Documento de equipa encontrado", False, f"Team ID: {team_id}")
        
    except Exception as e:
        log_test("Verificação de campos no MongoDB", False, str(e))
    finally:
        if client:
            client.close()


def test_recommendation_endpoints(context):
    """Test F: Recommendation endpoints"""
    log_section("F. Endpoints de recomendação (recommend_*)")
    
    if not context:
        log_warning("Sem contexto para testar recomendações")
        return
    
    token = context["token"]
    teams = context["teams"]
    opportunities = context["opportunities"]
    
    if not teams:
        log_warning("Sem equipas para testar recomendações")
        return
    
    # Get first idle team
    idle_team = next((t for t in teams if t.get("status") == "idle"), None)
    if not idle_team:
        log_warning("Sem equipas idle para testar recomendações")
        return
    
    team_id = idle_team["id"]
    
    # Test recommend_opportunity
    try:
        resp = requests.post(f"{BASE_URL}/game/dispatch/recommend_opportunity",
            headers={"Authorization": f"Bearer {token}"},
            json={"team_id": team_id},
            timeout=10)
        
        if resp.status_code != 200:
            log_test("POST /dispatch/recommend_opportunity → 200", False,
                    f"Status: {resp.status_code}, Body: {resp.text[:200]}")
        else:
            data = resp.json()
            opp_id = data.get("opportunity_id")
            if opp_id:
                log_test("POST /dispatch/recommend_opportunity → 200 com opportunity_id", True)
                log_info(f"  Recomendação: opportunity_id={opp_id}, chance={data.get('chance')}, reward={data.get('reward')}")
            else:
                log_test("POST /dispatch/recommend_opportunity → 200 (null, sem viáveis)", True)
                log_info("  Nenhuma oportunidade viável recomendada")
    except Exception as e:
        log_test("POST /dispatch/recommend_opportunity", False, str(e))
    
    # Test recommend_team
    if opportunities:
        opp_id = opportunities[0]["id"]
        try:
            resp = requests.post(f"{BASE_URL}/game/dispatch/recommend_team",
                headers={"Authorization": f"Bearer {token}"},
                json={"opportunity_id": opp_id},
                timeout=10)
            
            if resp.status_code != 200:
                log_test("POST /dispatch/recommend_team → 200", False,
                        f"Status: {resp.status_code}, Body: {resp.text[:200]}")
            else:
                data = resp.json()
                team_id_rec = data.get("team_id")
                if team_id_rec:
                    log_test("POST /dispatch/recommend_team → 200 com team_id", True)
                    log_info(f"  Recomendação: team_id={team_id_rec}, chance={data.get('chance')}")
                else:
                    log_test("POST /dispatch/recommend_team → 200 (null, sem viáveis)", True)
        except Exception as e:
            log_test("POST /dispatch/recommend_team", False, str(e))
    
    # Test recommend_repeat
    try:
        resp = requests.post(f"{BASE_URL}/game/dispatch/recommend_repeat",
            headers={"Authorization": f"Bearer {token}"},
            json={"team_id": team_id},
            timeout=10)
        
        if resp.status_code != 200:
            log_test("POST /dispatch/recommend_repeat → 200", False,
                    f"Status: {resp.status_code}, Body: {resp.text[:200]}")
        else:
            data = resp.json()
            opp_id = data.get("opportunity_id")
            if opp_id:
                log_test("POST /dispatch/recommend_repeat → 200 com opportunity_id", True)
                log_info(f"  Recomendação: opportunity_id={opp_id}")
            else:
                log_test("POST /dispatch/recommend_repeat → 200 (null, sem repetição)", True)
    except Exception as e:
        log_test("POST /dispatch/recommend_repeat", False, str(e))


def test_regression(context):
    """Test G: Regression tests"""
    log_section("G. Testes de regressão")
    
    if not context:
        log_warning("Sem contexto para testes de regressão")
        return
    
    token = context["token"]
    
    # Test GET /state 3x without 500
    errors = []
    for i in range(3):
        try:
            resp = requests.get(f"{BASE_URL}/game/state",
                headers={"Authorization": f"Bearer {token}"}, timeout=15)
            
            if resp.status_code != 200:
                errors.append(f"Tentativa {i+1}: Status {resp.status_code}")
        except Exception as e:
            errors.append(f"Tentativa {i+1}: {str(e)}")
    
    if errors:
        log_test("GET /state 3x sem erros", False, f"Erros: {errors}")
    else:
        log_test("GET /state 3x sem erros 500", True)
    
    # Test create new team (if money allows)
    try:
        resp_state = requests.get(f"{BASE_URL}/game/state",
            headers={"Authorization": f"Bearer {token}"}, timeout=15)
        
        if resp_state.status_code == 200:
            state = resp_state.json()
            player = state.get("player", {})
            clean_money = player.get("clean_money", 0)
            
            if clean_money >= 5000:
                resp_create = requests.post(f"{BASE_URL}/game/teams/create",
                    headers={"Authorization": f"Bearer {token}"},
                    json={"spec": "assalto"},
                    timeout=10)
                
                if resp_create.status_code == 200:
                    log_test("POST /teams/create → 200", True)
                    
                    # Verify new team in MongoDB
                    client = get_mongo_client()
                    if client:
                        try:
                            db = client[DB_NAME]
                            teams_col = db["teams"]
                            
                            # Get player_id
                            player_id = player.get("id")
                            if player_id:
                                new_teams = list(teams_col.find({"player_id": player_id}).sort("created_at", -1).limit(1))
                                if new_teams:
                                    new_team = new_teams[0]
                                    streak = new_team.get("streak")
                                    category_missions = new_team.get("category_missions", {})
                                    roster_missions = new_team.get("roster_missions")
                                    
                                    log_info(f"  Nova equipa: streak={streak}, category_missions={category_missions}, roster_missions={roster_missions}")
                                    
                                    if streak == 0 and category_missions == {} and roster_missions == 0:
                                        log_test("Nova equipa criada com campos corretos (streak=0, category_missions={}, roster_missions=0)", True)
                                    else:
                                        log_test("Nova equipa com campos corretos", False,
                                                f"streak={streak}, category_missions={category_missions}, roster_missions={roster_missions}")
                        finally:
                            client.close()
                else:
                    log_test("POST /teams/create → 200", False,
                            f"Status: {resp_create.status_code}, Body: {resp_create.text[:200]}")
            else:
                log_info(f"Dinheiro insuficiente para criar equipa ({clean_money} < 5000)")
                log_test("POST /teams/create (skip - sem dinheiro)", True)
    except Exception as e:
        log_test("Teste de criação de equipa", False, str(e))


def print_summary():
    """Print test summary"""
    log_section("RESUMO DOS TESTES")
    
    total = test_results["passed"] + test_results["failed"]
    print(f"\nTotal: {total} testes")
    print(f"{GREEN}Passou: {test_results['passed']}{RESET}")
    print(f"{RED}Falhou: {test_results['failed']}{RESET}")
    
    if test_results["warnings"]:
        print(f"{YELLOW}Avisos: {len(test_results['warnings'])}{RESET}")
    
    # Report breakdown items observed
    if breakdown_items_observed:
        print(f"\n{CYAN}Breakdown items observados:{RESET}")
        for key in sorted(breakdown_items_observed):
            print(f"  • {key}")
    
    # Report mission fields verified
    if mission_fields_verified:
        print(f"\n{CYAN}Campos novos verificados no mission doc:{RESET}")
        for field, verified in mission_fields_verified.items():
            status = f"{GREEN}✓{RESET}" if verified else f"{RED}✗{RESET}"
            print(f"  {status} {field}")
    
    if test_results["failed"] > 0:
        print(f"\n{RED}Erros encontrados:{RESET}")
        for error in test_results["errors"]:
            print(f"  • {error}")
    
    if test_results["warnings"]:
        print(f"\n{YELLOW}Avisos:{RESET}")
        for warning in test_results["warnings"][:5]:  # Show first 5
            print(f"  • {warning}")
    
    print()
    
    return test_results["failed"] == 0


def main():
    print(f"\n{BLUE}{'='*70}{RESET}")
    print(f"{BLUE}TESTES BACKEND - LUSORAE SSS v4 QI DAS EQUIPAS{RESET}")
    print(f"{BLUE}Base URL: {BASE_URL}{RESET}")
    print(f"{BLUE}Credenciais: {ADMIN_EMAIL} / {ADMIN_PASSWORD}{RESET}")
    print(f"{BLUE}{'='*70}{RESET}\n")
    
    # Run all tests in order
    context = test_login()
    test_dispatch_preview(context)
    mission_context = test_dispatch_and_mission_cycle(context)
    test_repeat_preview(context, mission_context)
    test_mission_document_fields(mission_context)
    test_recommendation_endpoints(context)
    test_regression(context)
    
    # Print summary
    success = print_summary()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
