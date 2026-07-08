#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: >
  (1) Melhorar significativamente a lógica de login e registo; (2) checkbox obrigatória de aceitação
  dos Termos e Condições e Política de Privacidade no registo; (3) melhorar o design da autenticação;
  (4) páginas de Termos e Condições e Política de Privacidade; (5) página de Changelog preenchida com
  o histórico real do jogo. Fork novo: .env recriados (MONGO_URL/DB_NAME/JWT_SECRET/CORS_ORIGINS/REACT_APP_BACKEND_URL).

backend:
  - task: "Registo exige accept_terms (400 sem aceitação) + guarda terms_accepted_at/terms_version"
    implemented: true
    working: "NA"
    file: "backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "RegisterInput com accept_terms bool; 400 com mensagem PT se false; user doc guarda terms_accepted_at + terms_version 1.0."
  - task: "Validação de password forte (>=8 chars, letras+números) no registo e change-password"
    implemented: true
    working: "NA"
    file: "backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "field_validator validate_password_strength com mensagens PT (422 pydantic). Login NÃO valida força (contas antigas)."
  - task: "Lockout inteligente no login: tentativas restantes (<=2) e minutos restantes quando bloqueado"
    implemented: true
    working: "NA"
    file: "backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "locked_until só definido ao atingir MAX_ATTEMPTS=5; 401 com 'X tentativas restantes' quando restam <=2; 429 com minutos restantes quando bloqueado."

frontend:
  - task: "AuthPage redesenhada (2 colunas, feature pills, footer links) + toggle password + medidor de força + validação inline + checkbox termos"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/AuthPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Verificado por screenshot. Test-ids mantidos (auth-tab-login/register, register-org-name-input, auth-email-input, auth-password-input, auth-submit-button, auth-error-message) + novos (auth-terms-checkbox, auth-password-toggle, password-strength, footer-link-*)."
  - task: "Páginas /termos, /privacidade (RGPD) e /changelog (timeline + filtros) com LegalLayout partilhado"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/legal/*, frontend/src/pages/ChangelogPage.jsx, frontend/src/data/changelog.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rotas públicas em App.js. Changelog com 8 versões/63 alterações do histórico git real. Verificado por screenshot."
  - task: "AuthContextV2 register envia accept_terms"
    implemented: true
    working: "NA"
    file: "frontend/src/context/AuthContextV2.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "register(orgName, email, password, acceptTerms) → body accept_terms."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "Registo exige accept_terms (400 sem aceitação) + guarda terms_accepted_at/terms_version"
    - "Validação de password forte (>=8 chars, letras+números) no registo e change-password"
    - "Lockout inteligente no login: tentativas restantes (<=2) e minutos restantes quando bloqueado"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      Autenticação 2.0: testar SÓ backend. Endpoints: POST /api/auth/register (org_name, email,
      password, accept_terms), POST /api/auth/login, POST /api/auth/change-password. Cenários:
      (1) registo sem accept_terms → 400; (2) registo com password fraca (curta/sem número/sem letra)
      → 422 pydantic; (3) registo válido com accept_terms=true → 200 + tokens, user tem
      terms_accepted_at/terms_version na BD; (4) login válido admin@lusorae.com/LusoraeAdmin2026! → 200;
      (5) login errado 3x → 401 genérico, 4ª tentativa → 401 com '1 tentativa restante', 5ª → 429
      bloqueado com minutos, 6ª → 429 com minutos restantes; (6) usar emails únicos para não bloquear
      o admin. Base URL: usar REACT_APP_BACKEND_URL do frontend/.env. Credenciais em
      /app/memory/test_credentials.md. NÃO testar frontend (aguarda autorização do utilizador).

