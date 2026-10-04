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
  Redesenho completo AAA da experiência de Login/Registo/Autenticação do SUBMUNDO:
  validação em tempo real, força da palavra-passe, Caps Lock, mostrar/esconder password,
  aceitação obrigatória de Termos/Privacidade com registo de data+hora+versão, páginas
  públicas Termos/Privacidade/RGPD/Changelog (pt-PT, servidas pelo backend, versionadas),
  segurança reforçada (validação servidor, sanitização, anti-duplicados, lockout com
  Retry-After, refresh automático de sessão expirada).

backend:
  - task: "POST /api/legal/disclaimer-ack (autenticado) — regista resposta ao disclaimer de ficção {accepted, at, version 1.0, ip} em last_disclaimer + histórico disclaimer_log ($slice -20) no doc do utilizador; 401 sem auth. Infra: backend/.env e frontend/.env recriados 11/07 (reset de ambiente pós-fork) — MONGO_URL, DB_NAME=test_database, CORS_ORIGINS explícito com preview URL, JWT_SECRET novo"
    implemented: true
    working: NA
    file: "backend/routes_legal.py, backend/.env, frontend/.env"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "11/07/2026 — Smoke test por curl OK: login admin, disclaimer-ack devolve {ok:true, version:1.0, accepted:true}, registo cria conta nova (teste.env@lusorae.com / TesteEnv123). Falta teste formal: accepted:false, 401 sem token, persistência last_disclaimer/disclaimer_log no MongoDB."
  - task: "Documentos legais versionados + changelog data-driven (legal_data.py) e rotas públicas GET /api/legal/meta, /api/legal/documents/{terms|privacy|rgpd}, /api/legal/changelog (routes_legal.py)"
    implemented: true
    working: NA
    file: "backend/legal_data.py, backend/routes_legal.py, backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "08/07/2026 — Novos endpoints. Verificado por curl: meta devolve versões atuais (terms/privacy/rgpd v1.0), changelog devolve 6 versões com categorias. Falta teste formal: 404 para doc inexistente, ?version= específica."
  - task: "Registo com aceitação obrigatória de termos (accept_terms) + registo de aceitação {accepted_at, terms_version, privacy_version, ip} no doc do utilizador; política de password forte no servidor (8+ chars, minúscula, maiúscula, número); sanitização org_name (whitespace, chars proibidos <>{}[]\\/;`); unicidade case-insensitive do nome da organização; DuplicateKeyError tratado (índice único email)"
    implemented: true
    working: NA
    file: "backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "08/07/2026 — Verificado por curl: accept_terms=false → 400; password fraca → 400 com requisitos em falta; '  Cartel   de  Teste ' sanitizado para 'Cartel de Teste'; terms_acceptance guardado no MongoDB com versões 1.0. Login de contas antigas NÃO afetado (política só no registo/alteração)."
  - task: "POST /api/auth/check-availability {email?, org_name?} → {valid, available} para validação em tempo real no registo"
    implemented: true
    working: NA
    file: "backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "08/07/2026 — Verificado por curl com email/org do admin: {valid:true, available:false}. Testar também disponíveis e formatos inválidos."
  - task: "Login lockout 429 com header Retry-After (segundos restantes) para countdown no frontend; change-password com nova política de password"
    implemented: true
    working: NA
    file: "backend/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "08/07/2026 — 5 tentativas falhadas → 429 + Retry-After. Não testado ainda. IMPORTANTE: usar emails descartáveis nos testes de lockout para não bloquear admin@lusorae.com."

frontend:
  - task: "Fix crash 'pointAlong is not defined' no OperationView — interiorSim.js usava pointAlong (linha 458) sem o importar de ./pathfind (bug pré-existente do simulador de interiores); rebentava ao abrir a câmara da operação (ErrorBoundary 'Erro de renderização'). Import adicionado."
    implemented: true
    working: true
    file: "frontend/src/lib/interior/interiorSim.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "12/07/2026 — Reportado pelo utilizador com stack trace (OperationView). Causa raiz: import em falta (lint no-undef confirmou, único no ficheiro). Verificado via /dev/operation (DevOperationPreview): interior renderiza, operacionais movem-se, rádio ativo, sem error boundary, 0 erros consola. INFRA: preview URL real é lusora-patrols.preview.emergentagent.com — REACT_APP_BACKEND_URL e CORS_ORIGINS atualizados."
  - task: "Patrulhas PSP/GNR dinâmicas à volta dos ativos do jogador — PoliceLayer.jsx passa ctx.assets (QG {kind:'hq'} + imóveis {kind:'property'}) ao simulador police.js (a peça que faltava: as zonas nunca eram construídas); zonas nascem junto de cada ativo, classificadas PSP (centros urbanos, azul, 2 viaturas/zona, raio 620m) vs GNR (rural/vilas, verde, 1 viatura/zona, raio 1250m) via PSP_CITIES; perímetros de patrulhamento desenhados como Circles tracejados com a cor da força; ícones por força (police-force-gnr faixa verde, police-op-gnr agente verde — luzes de emergência mantêm-se azuis); tooltips com 'PSP · urbana'/'GNR · rural' + copy própria GNR; legenda do mapa atualizada (PSP/GNR/perímetros); robustez multi-cidade em police.js: edgePointNear entra pela periferia LOCAL da zona (2.5 raios) quando os BOUNDS globais esticam, nearestFreePatrol com raio máx de resposta 15 km"
    implemented: true
    working: NA
    file: "frontend/src/components/game/PoliceLayer.jsx, frontend/src/lib/police.js, frontend/src/components/game/LiveMap.jsx, frontend/src/App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "12/07/2026 — Verificado por screenshots Playwright: admin (QG Cais do Sodré, Lisboa) → 2 patrulhas PSP + 1 círculo de zona; conta nova gnr.teste@lusorae.com (QG colocado em Mafra via POST /game/hq/place) → 1 patrulha GNR verde + círculo 1250m. Zero erros de consola. INFRA: .env recriados 12/07 pós-fork (preview c3baec4c-7bfe-4277-937b-58977a0d3545), credenciais em /app/memory/test_credentials.md. Falta teste formal: tooltip da patrulha (força/zona), resposta a ocorrências com desfecho police, merge de zonas com imóveis encavalitados."
  - task: "Câmara do mapa centrada no QG do jogador — LiveMap.jsx MapContainer center passa de [38.7223,-9.1393] (Lisboa hardcoded) para [hq.lat, hq.lng]; vale para o mount logo após colocar o QG no onboarding e para cada login (o LiveMap monta de fresco em ambos os casos)"
    implemented: true
    working: NA
    file: "frontend/src/components/game/LiveMap.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "12/07/2026 — Bug do utilizador: 'estabeleci o QG noutra localização e a câmara vai para Lisboa'. Causa raiz: center hardcoded no MapContainer. Fix de 1 linha. A verificar com agente de testes: conta nova → QG no Porto → câmara deve abrir no Porto após colocação E após re-login."
  - task: "DisclaimerModal ('é só um jogo') mostrado a cada login quando o mapa aparece — alertdialog z-[130] com compromisso explícito; 'Sim, compreendo — é só um jogo' → regista ack no backend + sessionStorage e liberta o jogo; 'Não concordo' → ecrã 'Compromisso necessário' com 'Reler o aviso' ou 'Terminar sessão' (logout + recusa registada); flag limpa em login/register/logout/expiração no AuthContextV2 (reaparece a cada login, não em refresh); testids: disclaimer-overlay, disclaimer-accept, disclaimer-decline, disclaimer-declined-view, disclaimer-reconsider, disclaimer-exit"
    implemented: true
    working: NA
    file: "frontend/src/components/game/DisclaimerModal.jsx, frontend/src/context/AuthContextV2.js, frontend/src/pages/GamePage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "11/07/2026 — Implementado; ainda sem verificação visual. NOTA para testes E2E: o modal bloqueia toda a UI do jogo após login — clicar disclaimer-accept antes de interagir com o mapa/painéis."
      - working: true
        agent: "main"
        comment: "11/07/2026 — Feedback do utilizador (2 bugs + 1 melhoria): (1) 'umacondição' sem espaço no ecrã de recusa → parágrafos reescritos com strings JSX explícitas (à prova de colapso de whitespace); (2) 'Terminar sessão' em loop infinito → CAUSA RAIZ em AuthContextV2.logout(): setUser(null) deixava o ProtectedRoute no estado 'a determinar' (spinner eterno); corrigido para setUser(false) → redireciona /auth. Afetava TODOS os logouts, incluindo o botão das Definições. (3) NOVO: bloqueio de leitura — tempo derivado da contagem de palavras do aviso (~200 ppm, clamp 8-20s → 20s), countdown no botão de aceitar ('Lê o aviso com atenção · Xs' + barra de progresso, testid disclaimer-read-progress), 'Não concordo' sempre clicável, prazo não recomeça ao voltar do ecrã de recusa. Verificado por E2E screenshots: countdown 18s→desbloqueio→aceitar→mapa; recusar→terminar sessão→/auth; re-login→disclaimer reaparece com 20s."
      - working: true
        agent: "main"
        comment: "11/07/2026 — Polimento pedido pelo utilizador: (a) barra de progresso agora é fluida — largura interpolada por transição CSS linear até ao prazo (60fps, sem re-renders; parte da fração já decorrida ao voltar do ecrã de recusa), em vez de saltar a cada segundo; (b) texto auxiliar estático 'Tempo de leitura em curso — lê com calma' (countdown só no botão); (c) botão Terminar sessão das Definições agora variant=destructive (vermelho). Verificado por E2E: larguras 34.8→42.8→51.9px em passos de ~350ms (crescimento sub-segundo), texto sem dígitos, retoma correta pós-recusa, screenshot das Definições com botão vermelho."
      - working: true
        agent: "main"
        comment: "12/07/2026 — FIX de compilação + conclusão de refactor deixado a meio na sessão anterior: DisclaimerModal importava DISCLAIMER_SESSION_KEY que já não existia em AuthContextV2 (erro webpack) e AuthContextV2 chamava clearDisclaimerFlag() (função apagada) em login/register/logout/expiração (crash runtime latente). Refactor concluído: disclaimer agora é UMA ÚNICA VEZ POR CONTA — visibilidade derivada de user.disclaimer_accepted (servidor, via user_public de auth.py); sessionStorage totalmente removido; aceitar → POST /legal/disclaimer-ack + markDisclaimerAccepted() (novo callback no AuthContextV2) após animação de saída. Verificado E2E por screenshots: (A) modal aparece no 1.º login com countdown 20s; (B) aceitar fecha o modal; (C) refresh não repete; (D) re-login com tokens limpos NÃO repete (flag no servidor: last_disclaimer {accepted:true, version 1.0, ip} + disclaimer_log confirmados no Mongo). Ficheiros: DisclaimerModal.jsx, AuthContextV2.js, GamePage.jsx e HQOnboarding.jsx (comentários)."
  - task: "Central da rede — fusão do 'Em direto' (LiveOpsDock) e 'Últimos registos' (ActivityFeed) num só painel com separadores EM DIRETO/REGISTOS (desktop canto inferior esquerdo, mobile barra única); auto-switch para EM DIRETO ao despachar equipa; LiveOpsDock.jsx refeito como LiveOpsPanel embutível (sem Shell/posicionamento próprio) com estado vazio tático"
    implemented: true
    working: true
    file: "frontend/src/components/game/ActivityFeed.jsx, frontend/src/components/game/LiveOpsDock.jsx, frontend/src/pages/GamePage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Verificado por screenshots desktop+mobile: consola com tabs, badge nº operações, estado vazio, transmissão ao vivo (fases/chance/rádio) após despacho com auto-switch, barra mobile mostra 'CREW ALFA · Em rota para o alvo' e popover com as mesmas tabs. Testids antigos liveops-* preservados (liveops-panel, liveops-feed, liveops-chance...); console-tab-live/console-tab-log novos; liveops-dock/liveops-expand/liveops-collapse removidos (colapso agora é da consola)."
  - task: "Fix crítico de sobreposição de UI: modo de colocação de imóveis focado — GamePage esconde dock/consola/legenda/filtro/OpportunityCard durante placement (o dock tapava o botão Confirmar: ambos centro-fundo z-30); PlacementControls redesenhado (z-40, cartão com tipo de propriedade + estado do ponto + botões grandes); MapBaseFilter movido do fundo-esquerdo (colidia com o dock no mobile) para topo-esquerdo sob a ResourceBar; consola/barra suprimidas quando OpportunityCard aberto em ecrãs < xl"
    implemented: true
    working: true
    file: "frontend/src/pages/GamePage.jsx, frontend/src/components/game/LiveMap.jsx, frontend/src/components/game/ActivityFeed.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Bug reportado pelo utilizador: 'quando tento colocar um imóvel não consigo carregar no botão de confirmar'. Causa raiz: PlacementControls e dock partilhavam âncora centro-fundo com z-30, dock renderizado depois no DOM intercetava cliques. Verificado por E2E screenshots: comprar Esconderijo → modo focado limpo (dock/consola/legenda escondidos) → clique no mapa → 'localização válida' → Confirmar clicável → 'Propriedade comprada', tudo restaurado depois. Filtro de bases visível no topo ('Todos | QG | Esconderijo — Areeiro')."
  - task: "Botão 'Otimizar equipas' no painel Equipas (data-testid teams-optimize) — usa optimizeTeams já existente (compõe /api/employees/optimize + /api/vehicles/optimize), tooltip dinâmico com contagens, estilo cyan Sparkles igual aos outros painéis, desativado quando nada há para otimizar"
    implemented: true
    working: true
    file: "frontend/src/components/game/TeamsPanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Lógica canOptimize/optimizeTeams já existia (linhas 266-277) mas o botão nunca era renderizado; adicionado entre o SummaryStrip e a lista de equipas. Verificado por screenshot no preview: botão visível, tooltip dinâmico correto, clique dispara otimização com toast 'A frota já está na distribuição ótima.'. NOTA infra: fork 10/07 — .env de backend+frontend recriados (preview 3aa9b74b-e9aa-4239-b583-92d6420afc1b), credenciais repostas em /app/memory/test_credentials.md."
  - task: "Redesign SSS dos ecrãs de loading (BootScreen + LoadingScreen) — chrome partilhado LoadingChrome.jsx: backdrop cinematográfico (grain feTurbulence, CRT, varrimento ambiente, sonar, vinheta, HUD topo/base com réguas+coordenadas+sessão+canal cifrado), moldura de vidro com cantos animados/linha laser/ticks/cabeçalho EM DIRETO, radar com órbita+cardeais+anel de graus+3 blips, wordmark metálico com sheen, barra de uplink angulada com segmentos+ponto incandescente+% grande, terminal 'Registo de sistema' com estados por linha; estados de erro 'Falha de uplink'; scroll seguro em ecrãs baixos; prefers-reduced-motion estendido; rota /dev/loading (+?state=error) para QA visual"
    implemented: true
    working: true
    file: "frontend/src/components/loading/LoadingChrome.jsx, frontend/src/components/LoadingScreen.jsx, frontend/src/components/BootScreen.jsx, frontend/src/pages/DevLoadingPreview.jsx, frontend/src/App.css, frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "09/07/2026 — Verificado por screenshots: /dev/loading (desktop 1920x800 + mobile 390x700 com scroll fix), /dev/loading?state=error, e fluxo real de login via preview URL com BootScreen capturado em ação (20%, 01/07 fases) e jogo carregado depois sem overlay residual. Lógica dos contextos Boot/Loading intocada."
  - task: "Infra fix: /app/backend/.env e /app/frontend/.env estavam em falta (reset de ambiente) — recriados (MONGO_URL, DB_NAME=test_database, CORS_ORIGINS, JWT_SECRET; REACT_APP_BACKEND_URL da config do supervisor, WDS_SOCKET_PORT=443); backend arrancava com KeyError MONGO_URL"
    implemented: true
    working: true
    file: "backend/.env, frontend/.env"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "09/07/2026 — Após recriação + restart: backend 'Application startup complete', login admin@lusorae.com funcional via preview URL, jogo carrega. Credenciais em /app/memory/test_credentials.md."
  - task: "Infra HUD partilhada (Tip/MiniBar/Chip/Kpi/SummaryStrip) + CSS tooltips"
    implemented: true
    working: true
    file: "frontend/src/components/game/hud.jsx, frontend/src/App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Tooltips CSS-only (.sub-tip, sides top/bottom, align start/center/end), verificados por screenshot."
  - task: "ResourceBar centro de comando (nível+progresso, fluxos /h, calor c/ estado, prontas, ops, salários+countdown)"
    implemented: true
    working: true
    file: "frontend/src/components/game/ResourceBar.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verificado por screenshot; tooltip do calor renderiza abaixo da barra; overflow visível em md+."
  - task: "HUD buttons com badges inteligentes + tooltips (RH/Frota/Equipas/Império/Imóveis/Missões/Intel)"
    implemented: true
    working: true
    file: "frontend/src/pages/GamePage.jsx, frontend/src/lib/game.js (orgAlerts/teamsReadiness)"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Badges por contagem de alertas; alerta pulsante; Intel com total de alertas."
  - task: "LiveMap tooltips nos marcadores (opp/HQ/propriedades/unidades) + legenda colapsável"
    implemented: true
    working: true
    file: "frontend/src/components/game/LiveMap.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Hover em opp mostra recompensa/risco/respeito/expira. Legenda (map-legend-toggle/panel) acima do badge Emergent."
  - task: "OpportunityCard enriquecido (chips distância/duração/respeito/calor/nível, tooltips métricas e fatores, +respeito no preview)"
    implemented: true
    working: true
    file: "frontend/src/components/game/OpportunityCard.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verificado por screenshot (chips 4.6km/42s/+25/+4, MATCH tooltip, ETA)."
  - task: "TeamsPanel (summary strip prontas/operação/afetos/fadiga, minibars veículo, tooltips ações)"
    implemented: true
    working: true
    file: "frontend/src/components/game/TeamsPanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verificado por screenshot (teams-summary)."
  - task: "EmployeesPanel (summary moral/lealdade/fadiga/disponíveis, chips de estado, ATTR_FULL tooltips, impacto salarial candidato, raridade tooltip)"
    implemented: true
    working: true
    file: "frontend/src/components/game/EmployeesPanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verificado por screenshot (hr-summary, hr-status-chips)."
  - task: "FleetPanel (summary operacionais/condição/autonomia/custos, autonomia km por veículo e no stand, tooltips ações)"
    implemented: true
    working: true
    file: "frontend/src/components/game/FleetPanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verificado por screenshot (fleet-summary, ~563 km rest.)."
  - task: "PropertiesPanel (summary produção/lavagem/calor/valor, preview do próximo nível, tooltips upgrade/vender/comprar)"
    implemented: true
    working: true
    file: "frontend/src/components/game/PropertiesPanel.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Lint ok; padrão idêntico aos painéis verificados."
  - task: "EmpirePanel (fluxo de caixa passivo c/ balanço, calor c/ estado+thresholds, quick-nav c/ alertas, tooltips)"
    implemented: true
    working: true
    file: "frontend/src/components/game/EmpirePanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Verificado por screenshot (empire-cashflow, balanço -960 €/h)."
  - task: "IntelPanel (+fortuna total, salários/ciclo, valor frota, tooltips em todas as células) e QuestsPanel (badges de contagem nas tabs) e ActivityFeed (tempo relativo + nº registos)"
    implemented: true
    working: true
    file: "frontend/src/components/game/IntelPanel.jsx, QuestsPanel.jsx, ActivityFeed.jsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Lint ok; feed com tempo relativo visível em screenshot."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "POST /api/legal/disclaimer-ack (autenticado) — regista resposta ao disclaimer de ficção {accepted, at, version 1.0, ip} em last_disclaimer + histórico disclaimer_log ($slice -20) no doc do utilizador; 401 sem auth. Infra: backend/.env e frontend/.env recriados 11/07 (reset de ambiente pós-fork) — MONGO_URL, DB_NAME=test_database, CORS_ORIGINS explícito com preview URL, JWT_SECRET novo"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      12/07/2026 — Patrulhas PSP/GNR à volta dos ativos do jogador (continuação concluída).
      (1) FIX principal: PoliceLayer.jsx agora passa ctx.assets (QG + imóveis) ao simulador
      police.js — antes as zonas dinâmicas nunca eram construídas e as patrulhas não seguiam
      o jogador. (2) Perímetros de zona (Circles tracejados azul PSP / verde GNR), ícones e
      tooltips por força, legenda atualizada, robustez multi-cidade (spawn local + raio de
      resposta 15 km). Sem alterações de código backend. (3) INFRA: .env recriados 12/07
      pós-fork (preview c3baec4c-7bfe-4277-937b-58977a0d3545), JWT_SECRET novo; credenciais
      em /app/memory/test_credentials.md (admin PSP Lisboa + gnr.teste@lusorae.com GNR Mafra).
      Validação por screenshots: Lisboa→2 PSP azuis; Mafra→1 GNR verde; 0 erros consola.
  - agent: "main"
    message: >
      11/07/2026 — (1) INFRA: .env de backend+frontend recriados após reset de ambiente
      (preview d659bcdf-9bf2-4790-8c09-7b3c263608fc); JWT_SECRET novo → sessões antigas
      invalidadas; admin seed OK (admin@lusorae.com / admin123 — ver /app/memory/test_credentials.md).
      (2) NOVO: disclaimer de ficção a cada login. Backend: POST /api/legal/disclaimer-ack
      (Bearer/cookie) body {accepted: bool} → guarda {accepted, at ISO, version "1.0", ip} em
      users.last_disclaimer + push em users.disclaimer_log (cap 20) e devolve
      {ok, version, accepted}. Testar: accepted true/false, 401 sem token, persistência no Mongo.
      Frontend: modal DisclaimerModal em GamePage — NOS TESTES E2E é preciso clicar
      data-testid="disclaimer-accept" logo após o login para desbloquear a UI do jogo.
      Endpoints legais GET existentes não mudaram de comportamento. Testar backend primeiro;
      frontend só com autorização do utilizador.
  - agent: "main"
    message: >
      08/07/2026 — Redesenho AAA da autenticação. BACKEND NOVO: legal_data.py (termos/privacidade/rgpd
      v1.0 versionados + changelog 6 versões), routes_legal.py (3 GET públicos), auth.py alterado
      (register exige accept_terms e guarda terms_acceptance; política password 8+/minúscula/maiúscula/número
      no register e change-password; sanitização e unicidade org_name; check-availability; 429 com
      Retry-After). Login de contas EXISTENTES não é afetado pela política (admin@lusorae.com /
      LusoraeAdmin2026! continua válido — ver /app/memory/test_credentials.md). CUIDADO nos testes de
      lockout: usar email descartável para não bloquear a conta admin (lockout é por ip:email).
      FRONTEND: AuthPage redesenhada (testids mantidos: auth-tab-login/register, register-org-name-input,
      auth-email-input, auth-password-input, auth-error-message, auth-submit-button; novos:
      auth-password-toggle, auth-capslock-indicator, password-strength-meter, register-confirm-password-input,
      terms-checkbox, terms-error, auth-lockout-countdown, auth-retry-button, auth-expired-banner),
      rotas públicas /termos /privacidade /rgpd /changelog, interceptor 401→refresh→retry em api.js.
      Testar backend primeiro; frontend só com autorização do utilizador.
frontend:
  - task: "UI uniformization pass (shared sheet/button/hud/sub-* CSS classes)"
    implemented: true
    working: true
    file: "components/ui/sheet.jsx, components/ui/button.jsx, components/game/hud.jsx, ResourceBar.jsx, GamePage.jsx, App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "Global visual pass via shared components: premium panel shell (all 10 sheets), refined button variants, unified sub-card cards, readable topbar/KPIs, active state on bottom nav. Verified via screenshots (map + Empire + Employees panels). No backend changes."

agent_communication:
    - agent: "main"
      message: "07/07/2026 — CSS-only/visual uniformization through shared components (sheet.jsx, button.jsx, hud.jsx, App.css sub-panel/sub-card/sub-topbar). No API or logic changes; verified visually with screenshots."

frontend:
  - task: "SSS-tier design overhaul (Noir Tático): Rajdhani display font, film grain global, gradient-border topbar/dock com laser sweep, dock unificado da nav inferior, laser line em todos os sub-panel, pins com glow/anel rotativo, tiles do mapa com color grade, AuthPage cinemático (ken burns + título gradiente), ActivityFeed em sub-panel"
    implemented: true
    working: true
    file: "App.css, index.css, GamePage.jsx, AuthPage.jsx, ActivityFeed.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Frontend-only. .env recriados pós-fork (backend+frontend) e credenciais em /app/memory/test_credentials.md. Verificado por screenshots (auth, mapa, painel Império). Lint limpo. Sem alterações de lógica/API."
  - task: "SSS tier ronda 2: button.jsx variantes gradiente+glow, tabs.jsx segmented tático (ativo vermelho), input.jsx foco com glow, sheet.jsx overlay/header/título refinados, BootScreen+LoadingScreen cinematográficos (sub-boot-bg grelha tática, logo pulsante, barra sub-progress-fill com sheen)"
    implemented: true
    working: true
    file: "components/ui/button.jsx, tabs.jsx, input.jsx, sheet.jsx, components/BootScreen.jsx, LoadingScreen.jsx, App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Verificado por screenshots (boot screen capturado em live, painel Missões com tabs vermelhas, painel Operacionais). Lógica dos ecrãs de loading preservada; apenas estilos. Lint limpo."
  - task: "SSS tier ronda 3: OpportunityCard identidade por categoria (laser --mk, ícone com glow, título Rajdhani), CTA despacho esmeralda gradiente, micro-interações globais (tabpanel slide-up, scrollbar vermelho hover)"
    implemented: true
    working: true
    file: "components/game/OpportunityCard.jsx, App.css"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Verificado por screenshot em live (cartão aberto com equipa recomendada, preview 72% e CTA premium). Sem alterações de lógica. Lint limpo."
  - task: "SSS tier ronda 4 (loading): radar tático animado (feixe conic + blip), moldura com 4 cantos HUD (sub-frame/sub-corner-*), scanline vertical no ecrã, reveal do logo (sub-logo-in), cursor terminal (sub-cursor), frases de ambiente rotativas CSS-only (sub-flavor) em BootScreen+LoadingScreen"
    implemented: true
    working: true
    file: "components/BootScreen.jsx, components/LoadingScreen.jsx, App.css"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Capturado em live durante o boot real (radar, cantos, cursor, flavor text visíveis). Lógica de fases/erros preservada. Lint limpo. prefers-reduced-motion respeitado."
  - task: "SSS tier ronda 5 (botões): física de interação .sub-btn (spring transitions, press-down translateY+scale, sheen sweep por background-position que não corta badges), orla metálica mask-ring em primary/success, variantes button.jsx enriquecidas (via- stops, sombras em camadas, focus ring vermelho, disabled dessaturado), TabsTrigger com gradiente+ring inset+hover, icon glow nos sub-hud-btn, indicador luminoso no separador ativo do dock; fixes de intenção de cor: OpportunityCard dispatch (variant success — corrigida regressão via-red-600), EmpirePanel lavar/subornar (outline), SettingsPanel claim-admin (âmbar sólido), LiveMap placement-confirm (success), AdminPanel 5 botões (success/destructive/gradientes)"
    implemented: true
    working: true
    file: "components/ui/button.jsx, components/ui/tabs.jsx, App.css, components/game/OpportunityCard.jsx, components/game/EmpirePanel.jsx, components/game/SettingsPanel.jsx, components/game/LiveMap.jsx, pages/AdminPanel.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Frontend-only. .env recriados pós-fork (preview URL 7f415bc7...). Verificado por screenshots: auth CTA hover (orla metálica+lift), dock (indicador ativo+icon glow), tabs RH (gradiente+ring), CTA Destacar Equipa esmeralda correto em rest+hover. Lint limpo (só warnings pré-existentes). prefers-reduced-motion desativa sheen/transições."
  - task: "SSS tier ronda 6 (primitivos globais): Card (glass gradient+inner highlight+hover border), Badge (variantes gradiente/tints), Select (trigger glass c/ focus vermelho, content dark-glass blur c/ sombra profunda, item highlight vermelho+check red-400), Switch (checked gradiente+glow, track inset), Accordion (hover brighten, chevron vermelho aberto), Progress (track inset, indicador gradiente vermelho+glow); App.css polish global (::selection vermelho, scrollbars finas, tabular-nums no font-mono, z-index popper)"
    implemented: true
    working: true
    file: "components/ui/card.jsx, badge.jsx, select.jsx, switch.jsx, accordion.jsx, progress.jsx, App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Verificado por screenshots (Equipas c/ dropdown aberto: dark-glass + item vermelho; Definições: switches/inputs). Lint limpo nos ficheiros tocados (calendar/command têm erros stock pré-existentes). Sem alterações de lógica/API."
  - task: "SSS tier ronda 8 (Cockpit Cinemático + Voz Noir): radar tático a emanar do QG (marcador CSS não-interativo), grelha tática nas bordas do viewport, moldura HUD com 4 cantos, relógio da rede na topbar (hora servidor + coordenadas Lisboa), flashes âmbar/azul em sujo/respeito, toasts sonner redesenhados (transmissão tática c/ barra lateral por tipo), flash vermelho no registo mais recente do feed (desktop+mobile), carimbo de celebração 'EQUIPA DESTACADA' no despacho (CustomEvent sub:dispatch-stamp), headers de todos os 10 painéis com PanelKicker (micro-etiqueta laser) + PanelWatermark (ícone marca de água) + títulos com gradiente metálico (sub-sheet-title) + taglines noir reescritas, EmptyState tático partilhado (Operacionais/Intel), copy noir em todos os empty states e AuthPage"
    implemented: true
    working: true
    file: "App.css, hud.jsx, sheet.jsx, App.js, GamePage.jsx, LiveMap.jsx, ResourceBar.jsx, ActivityFeed.jsx, OpportunityCard.jsx, 10 painéis, AuthPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "08/07/2026 — Fork: .env recriados (backend+frontend, preview 881ea282...), credenciais em /app/memory/test_credentials.md. Verificado em live por screenshots: header Operacionais (kicker+watermark+gradiente+tagline), despacho real com carimbo+toast+flash no feed+relógio. Lint limpo (só warnings pré-existentes). Sem alterações de lógica/API. prefers-reduced-motion coberto."
  - task: "SSS tier ronda 7 (juice de jogo, CSS-only): entrada do HUD, pins com bounce, halo QG, cascata staggered dos sub-card, prefers-reduced-motion"
    implemented: true
    working: true
    file: "App.css (secção 'SSS ronda 7')"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "main"
          comment: "07/07/2026 — Verificado por screenshots: topbar centrada sem salto, dock/pins/halo QG corretos no mapa; painel Frota com todos os cartões visíveis pós-cascata. 1 edição CSS, zero JS/lógica."

frontend:
  - task: "SSS ronda 5 — páginas de documento (Termos/Privacidade/RGPD/Changelog) alinhadas com identidade Noir Tático: fundo grelha tática + glows (sub-page-grid/glow), header vidro com laser sweep (sub-page-header) e wordmark gradiente, nav ativa com sublinhado laser, TOC vidro numerado (sub-toc), headings com marcador laser (sub-sec-heading), sumário com cantos HUD (sub-doc-summary), changelog em cartões vidro com nó pulsante e realce da versão atual (sub-version-card/current, sub-node-current), hairlines gradiente, prefers-reduced-motion coberto. Pós-fork: .env backend/frontend recriados e test_credentials.md reposto."
    implemented: true
    working: true
    file: "App.css, components/legal/LegalShell.jsx, pages/LegalPage.jsx, pages/ChangelogPage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "09/07/2026 — Frontend-only, zero mudanças de lógica/API/testids. Verificado por screenshots (/termos e /changelog). Lint limpo. Jogo não afetado (apenas classes CSS novas)."

agent_communication:
  - agent: "main"
    message: "09/07/2026 — SSS ronda 5 (design-only) nas páginas legais/changelog. Sem alterações de backend; .env recriados pós-fork (MONGO_URL/DB_NAME/JWT_SECRET/ADMIN_*, REACT_APP_BACKEND_URL) e login admin verificado por curl."

frontend:
  - task: "Mapa SSS (design+lógica): controlos de câmara (zoom +/−, centrar QG, enquadrar atividade — testids map-zoom-in/out, map-center-hq, map-fit-all), modo seguir unidade (clique na equipa segue, drag/X/seleção cancela; chip map-follow-chip/map-follow-stop), rotação por rumo real da rota no ícone da unidade, anel de urgência pulsante em oportunidades <2 min (opp-pin-urgent), fly-to inteligente na seleção, cache de divIcons das oportunidades (elimina setIcon churn a cada poll), legenda atualizada"
    implemented: true
    working: true
    file: "components/game/LiveMap.jsx, App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "09/07/2026 — Frontend-only. Verificado em live: controlos presentes e funcionais (fit+zoom), seleção de oportunidade abre cartão, despacho OK, clique na unidade ativa follow (chip visível, câmara acompanha). Lint limpo (1 warning pré-existente). Sem alterações de backend."

agent_communication:
  - agent: "main"
    message: "09/07/2026 — Ronda 'Mapa SSS' concluída e verificada em live por automação de screenshots (login admin, despacho de equipa, follow cam). Nenhuma rota/API alterada."

backend:
  - task: "SSS v3 Missões — fórmulas de recompensa dinâmicas: effective_quest_rewards (nível × dificuldade × tier adaptativo × série diária × execução rápida, cap ×4, arredondamentos 25€/5 respeito), preview no /state (reward_mult + mult_note em quests ativas/concluídas), claim manual e auto-claim usam a mesma fórmula e persistem quest_streak/quest_perf"
    implemented: true
    working: NA
    file: "backend/quests.py, backend/routes_game.py, backend/engine.py, backend/models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Corrigido crash de arranque (import effective_quest_rewards em falta — trabalho anterior interrompido). Verificado por curl: claim de d_bribe1 deu 1.375€ (base 1.200 ×1.14 série 1d + execução rápida), quest_streak {count:1, best:1} e quest_perf {momentum:10, claims:1} persistidos; /state devolve reward_mult/mult_note nas quests ativas."
  - task: "SSS v3 Missões — QI de ofertas: seleção ponderada de diárias/semanais (viabilidade — nunca oferece impossíveis; relevância ao estado do jogo — frota danificada/combustível baixo/fadiga/moral/calor/dinheiro sujo; dificuldade adequada ao tier; anti-repetição via quest_offer_history; variedade de categorias no lote), 4.ª diária no tier≥2 e 3.ª semanal no tier 3, momentum/tier com penalizações por expiração, cooldown de 30 min nas dinâmicas, eventos com anti-repetição 6h, decisões filtradas por min_level e menos recentes primeiro"
    implemented: true
    working: NA
    file: "backend/quests.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Diárias/semanais geradas com _select_offers (amostragem ponderada sem reposição). Verificado que a conta admin recebeu 3 diárias + 2 semanais de categorias variadas."
  - task: "SSS v3 Missões — novos triggers dinâmicos (dyn_fuel fleet_fuel_low, dyn_dirty_cap dirty_near_cap com dirty_cap no ctx, dyn_arrested arrested_employees + métrica de estado arrested_count) e cadeias de consequências: decisões novas dec_carga/dec_rival + chain em dec_informador.eliminar agendam pending_chains → process_quests spawna ev_carga_marcada/ev_represalia/ev_vinganca com evento 'CONSEQUÊNCIA'"
    implemented: true
    working: NA
    file: "backend/quests.py, backend/quests_data.py, backend/routes_game.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Verificado por curl: dyn_arrested spawna com 1 preso e completa ao libertar (lte 0); pending_chains plantada spawna ev_carga_marcada com evento CONSEQUÊNCIA e é consumida; POST /quests/choose dec_carga 'comprar' cobra 4.000€ e credita dirty (ramo 60%)."

  - task: "SSS v4 QI das Equipas — religação de mecânicas SSS v3 desligadas: chance_ctx agora recebe district/district_attention/team_streak (mod_district_attention e mod_team_momentum finalmente ativos); mission doc persiste team_streak, vehicle_speed_effective, vehicle_discreet (fuga/perseguição conscientes do veículo) e top_negatives (forense 'Fator crítico' nas mensagens de falha)"
    implemented: true
    working: NA
    file: "backend/routes_game.py (_prepare_dispatch, dispatch), backend/engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Grep confirmou que ctx['district_attention'], ctx['team_streak'], m['vehicle_speed_effective'], m['vehicle_discreet'], m['top_negatives'] nunca eram preenchidos (mecânicas mortas). Religado tudo em _prepare_dispatch/dispatch. Preview via curl OK (sem 500)."

  - task: "SSS v4 QI das Equipas — novos modificadores de chance: mod_team_familiarity (equipa aprende por categoria, sqrt até TEAM_FAMILIARITY_BONUS_MAX=5% em 25 ops, mínimo 3), mod_team_strategist (inteligência>=7 recupera fração da penalização de risco, cap 6%), mod_team_coordination híbrido (50% tempo estável + 50% roster_missions/8)"
    implemented: true
    working: NA
    file: "backend/engine.py (MODIFIERS), backend/economy_constants.py (bloco SSS v4)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Registados em MODIFIERS; equipas persistem category_missions.{cat} e roster_missions ($inc em _progress_mission ao concluir; reset de roster_missions em employees/assign; defaults na criação de equipa)."

  - task: "SSS v4 QI das Equipas — papéis internos e decisões: melhor condutor reduz viagem (até -12%) e melhora fuga (até +6%); médico reduz prob. de ferimento (x0.5) e duração (x0.7); advogado reduz prisões (x0.6, interceção e perseguição); clutch save do líder (falha→parcial, prob = 18% x sangue_frio/10, mensagem própria); aviso do líder à chegada se calor subiu >=12 pts desde a partida (nunca aborta, evento intel)"
    implemented: true
    working: NA
    file: "backend/engine.py (_roll_outcome, _compute_escape_chance, _crew_returns, _resolve_chase, _progress_mission, _outcome_message), backend/routes_game.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Campos has_leader/leader_cool/has_medic/has_lawyer/best_driver/heat_at_dispatch persistidos no mission doc no dispatch; clutch_save persistido no update de fase."

  - task: "SSS v4 QI das Equipas — recomendações por valor esperado real: _expected_value (chance*reward + parciais esperados - perdas de falha - combustível) usado em _rank_key para todas as prioridades (lucro=EV primeiro; equilibrio=chance em degraus de 1% + EV; custos=combustível primeiro)"
    implemented: true
    working: NA
    file: "backend/routes_game.py (_expected_value, _rank_key)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Afeta /dispatch/recommend_opportunity, /dispatch/recommend_team, /dispatch/recommend_repeat."

test_plan:
  current_focus:
    - "SSS v5 QI das Armas — catálogo expandido (9 modelos, 3 novos) + weapon_meta/weights no /catalog"
    - "SSS v5 QI das Armas — encravamento (jam profile no dispatch, roll no outcome, weapon_jams persistido, mensagem, desgaste extra)"
    - "SSS v5 QI das Armas — durabilidade no desgaste, curva de condição não-linear, intimidação na fuga, furtividade gradual"
    - "SSS v5 QI das Armas — auto_assign por ganho marginal + POST /weapons/optimize"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      10/07/2026 — SSS v4 QI das Equipas (backend only, frontend intocado). 4 blocos:
      (1) RELIGAÇÃO: mod_district_attention e mod_team_momentum estavam mortos (ctx sem
      district_attention/team_streak) e as perseguições ignoravam vehicle_speed_effective/
      vehicle_discreet/top_negatives (nunca persistidos) — tudo ligado agora.
      (2) NOVOS MODIFICADORES: familiaridade por categoria (team.category_missions),
      estratega (int>=7), coordenação híbrida (tempo + team.roster_missions).
      (3) PAPÉIS/DECISÕES: condutor (viagem/fuga), médico (ferimentos), advogado (prisões),
      clutch save do líder (falha→parcial), aviso do líder à chegada (heat_at_dispatch).
      (4) RECOMENDAÇÕES: _rank_key por valor esperado real (_expected_value).
      NOTA fork: ambiente foi RESET — .env backend/frontend recriados (preview
      71606141-6a00-440a-9da2-f4f7109928fa), DB nova ⇒ credenciais MUDARAM:
      admin@lusorae.com / admin123 (ver /app/memory/test_credentials.md).
      CUIDADO: lockout de login é por ip:email — usar emails descartáveis em testes de lockout.
      Testar: preview/dispatch (breakdown com novos itens quando aplicável), mission doc com
      novos campos, recommend_* sem 500, ciclo completo de missão (tick /state) sem crashes.
  - agent: "testing"
    message: >
      10/07/2026 — Testes backend SSS v4 concluídos. RESULTADOS:
      ✓ Login e GET /state funcionais (2 equipas, 8 oportunidades).
      ✓ Endpoints de recomendação (recommend_opportunity/team/repeat) → 200 sem erros.
      ✓ GET /state 3x consecutivos sem erros 500.
      ✓ Criação de nova equipa com campos SSS v4 corretos (streak=0, category_missions={}, roster_missions=0).
      ✓ TODOS os 10 campos novos verificados no mission doc MongoDB: team_streak, vehicle_speed_effective,
      vehicle_discreet, has_leader, leader_cool, has_medic, has_lawyer, best_driver, top_negatives (lista),
      heat_at_dispatch.
      LIMITAÇÃO: Não foi possível testar preview/dispatch completo porque todas as equipas estavam ocupadas
      ou sem membros disponíveis durante a janela de testes. Contudo, a verificação direta do MongoDB
      confirma que a missão ativa criada pelo main agent contém TODOS os campos novos esperados.
      BREAKDOWN items observados em missão ativa: distancia, risco_base (top_negatives).
      CONCLUSÃO: Implementação SSS v4 está funcional — campos persistidos corretamente, endpoints de
      recomendação operacionais, sem crashes no /state. Recomendo ao main agent sumarizar e concluir.

backend:
  - task: "SSS v5 QI das Armas — catálogo expandido: 3 modelos novos (pistola_silenciada N3 silenciosa, cacadeira_serrada N3 assalto frágil/potente, metralhadora_ligeira N6 assalto_pesado) + categoria assalto_pesado; /catalog expõe weapon_category_weights e weapon_meta (fórmulas para o frontend calcular match %/jam risk com a mesma régua do motor)"
    implemented: true
    working: NA
    file: "backend/game_data.py, backend/economy_constants.py, backend/routes_game.py (catalog)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Verificado por curl: catálogo devolve 9 modelos, 6 categorias, weights e meta com 13 chaves."
  - task: "SSS v5 QI das Armas — encravamento: weapon_jam_risk (fiabilidade+condição, armas sem mecanismo nunca encravam), weapon_jam_profile/weapon_power_avg persistidos no mission doc no dispatch, roll em _roll_outcome (perda de chance 4%/arma cap 10%, weapon_jams persistido), sufixo 'ENCRAVOU' nas mensagens de outcome, desgaste extra +6 na arma encravada, weapon_alerts no preview (risco >= 15%)"
    implemented: true
    working: NA
    file: "backend/engine.py, backend/routes_game.py (_prepare_dispatch, dispatch, preview)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Verificado ponta-a-ponta por curl+mongo: pistola a 25% → alerta 21% no preview; jam forçado (risk 1.0) → weapon_jams persistido, outcome partial, evento com 'ENCRAVOU no pior momento', condição 25→14.5 (4.5 base + 6.0 jam)."
  - task: "SSS v5 QI das Armas — lógica profunda: durabilidade liga ao desgaste (wear × 70/durability), curva de condição não-linear (quadrática abaixo de 40%), intimidação na fuga (assalto: +até 6% escape por poder de fogo médio), sinergia furtiva gradual (bónus escala com discrição média das armas)"
    implemented: true
    working: NA
    file: "backend/engine.py (weapon_condition_factor, _crew_returns, _compute_escape_chance, mod_stealth_synergy)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — mod_weapon_score refatorado para régua única weapon_effective_score (mesma função usada por auto_assign/optimize)."
  - task: "SSS v5 QI das Armas — QI de atribuição: /weapons/auto_assign reescrito por ganho marginal real (weapon_effective_score novo − atual); novo POST /api/game/weapons/optimize redistribui todo o arsenal disponível (guloso por score efetivo, só mexe em portadores idle, devolve changes/benched/message, idempotente)"
    implemented: true
    working: NA
    file: "backend/routes_game.py (auto_assign_weapon, optimize_weapons), backend/engine.py (weapon_effective_score)"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Verificado por curl: optimize atribuiu Pistola→spec assalto e Faca→logistica; 2.ª chamada devolve 'já está na distribuição ótima' (idempotente)."

agent_communication:
  - agent: "main"
    message: >
      10/07/2026 — SSS v5 QI das Armas (backend only, frontend na fase seguinte). NOTA fork: ambiente
      RESET — .env recriados, DB nova, credenciais admin@lusorae.com / admin123
      (/app/memory/test_credentials.md). Conta admin é nível 1 com 2 operacionais/1 equipa (DB fresca).
      4 blocos: (1) CATÁLOGO: 9 modelos (3 novos), categoria assalto_pesado, /catalog com
      weapon_category_weights + weapon_meta. (2) ENCRAVAMENTO: perfil no dispatch → roll no outcome →
      weapon_jams + mensagem + desgaste extra; preview devolve weapon_alerts. (3) LÓGICA: durabilidade
      no desgaste, condição não-linear, intimidação na fuga (assalto), furtividade gradual.
      (4) QI: weapon_effective_score como régua única; auto_assign por ganho marginal; POST
      /weapons/optimize (testids frontend ainda não existem — NÃO testar UI). Testar: catálogo (9 modelos,
      meta), buy/sell/repair/assign/unassign/auto_assign/optimize sem 500, optimize idempotente,
      preview com weapon_alerts (arma degradada), dispatch persiste weapon_jam_profile/weapon_power_avg,
      ciclo de missão sem crash. CUIDADO: lockout de login é por ip:email — usar emails descartáveis.

# ============ RONDA: Design SSS das Armas no frontend (10/07/2026) ============

user_problem_statement: >
  Melhorar significativamente o design das armas para o SSS tier de acordo com o backend:
  expor no painel de Armamento toda a inteligência do motor (SSS v5 QI das Armas) — risco de
  encravamento, curva de condição não-linear, desgaste por missão, habilidade/proficiência do
  portador, adequação por categoria de operação — com cartões "dossier" (silhuetas SVG por
  modelo, tiers Rua/Profissional/Militar/Pesado) e botão Otimizar arsenal.

backend:
  - task: "Catálogo weapon_meta estendido (wear_per_mission, wear_risk_mult, combat_score_scale, bonus_min/max, loud_heat_mult, proficiency_gain_per_mission, jam_chance_penalty(+cap), jam_extra_wear, mismatch_penalty_max, sell_fraction) + constante WEAPON_SELL_FRACTION usada na rota /weapons/sell (antes 0.4 hardcoded)"
    implemented: true
    working: NA
    file: "backend/routes_game.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Aditivo, sem alteração de lógica de jogo. Verificado localmente: /api/game/catalog devolve weapon_meta com 25 chaves (sell_fraction 0.4, wear_per_mission 3.0, combat_score_scale 0.15). Falta teste formal de regressão dos endpoints de armas."

frontend:
  - task: "WeaponsPanel redesenhado SSS: cartões dossier com silhueta SVG por modelo (WeaponGlyph.jsx, 9 silhuetas), tier por nível (Rua/Profissional/Militar/Pesado com cor na moldura via --wtier), grelha de 6 stats (potência/precisão/alcance/leveza/velocidade/carregador), adequação por operação (5 mini-barras, best_for realçado), chip de encravamento (nunca encrava/[x]% com aviso), condição com eficácia real (curva não-linear), desgaste/missão, bloco do portador (habilidade por atributo + proficiência com bónus %), summary 4 KPIs (equipadas/condição/encravar/revenda), botão Otimizar arsenal (novo optimizeWeapons no GameContextV2 → POST /weapons/optimize), loja Arsenal com o mesmo tratamento + chips fiab./desgaste/discrição/manutenção + 'no arsenal: N'. Helpers em lib/game.js espelham EXATAMENTE engine.py (weaponCombatScore, weaponConditionFactor, weaponJamRisk, weaponSkillInfo, weaponCompatFactor, weaponEffectiveScore, weaponWearPerMission, weaponAdequacy, weaponTier). CSS: .sub-weapon-card/.sub-weapon-plate (orla tier, grelha diagonal, sheen hover, reduced-motion)."
    implemented: true
    working: NA
    file: "frontend/src/components/game/WeaponsPanel.jsx, frontend/src/components/game/WeaponGlyph.jsx, frontend/src/lib/game.js, frontend/src/context/GameContextV2.js, frontend/src/App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Verificado por screenshots (compra faca+pistola, auto-assign, tooltips, KPIs atualizam). Testids antigos preservados (weapons-count/summary/search/repair-all/list, weapon-card/employee-select/auto-assign, repair-weapon, sell-weapon, buy-weapon-{key}, weapons-nav-employees); novos: weapons-optimize, weapon-jam-{id}, weapon-holder-{id}, weapon-adequacy-{id}, arsenal-card-{key}, arsenal-adequacy-{key}."

test_plan:
  current_focus:
    - "Catálogo weapon_meta estendido + WEAPON_SELL_FRACTION na rota /weapons/sell"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      10/07/2026 — Frontend SSS das armas + extensão aditiva do /catalog. NOTA infra: .env de
      backend/frontend estavam de novo em falta (reset do fork) — recriados; credenciais
      admin@lusorae.com / LusoraeAdmin2026! (ADMIN_PASSWORD no backend/.env; ver
      /app/memory/test_credentials.md). TESTAR BACKEND APENAS: (1) GET /api/game/catalog →
      weapon_meta contém as 25 chaves incl. sell_fraction/wear_per_mission/combat_score_scale/
      loud_heat_mult/jam_chance_penalty; (2) regressão de /weapons/buy, sell (valor = preço ×
      sell_fraction × condição), repair, assign, unassign, auto_assign, optimize sem 500;
      (3) login/registo intactos. A conta admin JÁ TEM 2 armas (faca_taser equipada, pistola em
      inventário) compradas na verificação visual — não assumir arsenal vazio. CUIDADO: lockout
      é por ip:email — usar emails descartáveis em testes de auth.

# ============ RONDA: Design SSS das Equipas no frontend (10/07/2026) ============

user_problem_statement: >
  Melhorar significativamente o design das equipas para o SSS tier de acordo com o backend,
  usando o design das armas como exemplo: expor no painel de Equipas toda a inteligência do
  motor (SSS v4 QI das Equipas) — momentum (série de vitórias/derrotas), entrosamento do
  plantel, familiaridade por categoria, papéis a bordo (líder/condutor/médico/advogado/
  estratega), química da composição — com cartões "dossier" (emblemas SVG por especialização,
  tiers Recruta/Operacional/Veterana/Lendária pela experiência).

backend:
  - task: "Modelo Team serializa campos SSS v4 no /state (streak, roster_missions, category_missions — antes retidos pelo Pydantic extra=ignore) + novo bloco team_meta no /catalog com 38 réguas exatas do motor (momentum, coordenação, familiaridade, estratega, condutor, médico, advogado, clutch do líder, sinergia, curvas moral/fadiga/lealdade, category_attrs, reorg)"
    implemented: true
    working: true
    file: "backend/models.py, backend/routes_game.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Aditivo, zero mudanças de lógica de jogo. Verificado por curl: /catalog devolve team_meta com 38 chaves; /state teams inclui streak/roster_missions/category_missions. Falta regressão formal dos endpoints de equipas."
      - working: true
        agent: "testing"
        comment: "10/07/2026 — Testes backend SSS das Equipas concluídos com SUCESSO (26 passed, 0 failed, 2 warnings). RESULTADOS: ✓ GET /api/game/catalog contém team_meta com 38 chaves (leader_min_rank='chefe_equipa', no_leader_penalty=0.03, clutch_save_max=0.18, category_attrs com assalto/logistica/tecnica/influencia). ✓ weapon_meta presente (regressão OK). ✓ GET /api/game/state: equipa Crew Alfa tem streak (int), roster_missions (int), category_missions (dict). ✓ POST /api/game/teams/create: nova equipa criada com streak=0, roster_missions=0, category_missions={}. ✓ Endpoints de recomendação (recommend_opportunity/team/repeat) → 200 sem 500. ✓ POST /api/game/dispatch/preview → 200 com breakdown e chance. ✓ Login intacto. AVISOS (não-críticos): Sem funcionários/veículos livres para testes de atribuição (conta admin com recursos limitados). CONCLUSÃO: Implementação SSS v4 das equipas está FUNCIONAL — campos persistidos corretamente, endpoints operacionais, sem crashes."

frontend:
  - task: "TeamsPanel redesenhado SSS 'dossier de unidade': placa com emblema SVG por especialização (TeamGlyph.jsx, 4 emblemas), tier pela experiência (Recruta<8/Operacional<25/Veterana<60/Lendária, cor na moldura via --ttier), chip de momentum (série vitórias/derrotas com % do motor), chip de química (cobertura+diversidade), 5 chips de papéis a bordo (líder+clutch %, condutor −viagem/+fuga, médico, advogado, estratega INT) acesos/apagados com fórmulas nas dicas, barra de entrosamento (50% tempo+50% missões juntos, ao segundo), fila de familiaridade por 5 categorias (curva sqrt, mestria ★, espec realçada), vitais médios moral/lealdade/fadiga com curvas do motor, KPI 'Série' no summary, cartões de formação com emblemas. Helpers em lib/game.js espelham EXATAMENTE engine.py (teamTier, teamMomentum, teamCoordination, teamFamiliarity, teamRoles, teamSynergy, TEAM_OP_CATEGORIES). CSS: .sub-team-card/.sub-team-plate (padrão .sub-weapon-card, reduced-motion coberto)."
    implemented: true
    working: NA
    file: "frontend/src/components/game/TeamsPanel.jsx, frontend/src/components/game/TeamGlyph.jsx, frontend/src/lib/game.js, frontend/src/App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Verificado por screenshots em live (login admin, painel aberto: emblema, tier, papéis, entrosamento, familiaridade, vitais, despacho 85% funcional, 4 glyphs na formação). Testids antigos TODOS preservados (teams-summary/list, team-card/favorite/readiness/members-cap/nav-rh/member-rest/member-remove/add-member/vehicle-select/vehicle-seats/nav-fleet/refuel/repair/dispatch-best/repeat-last, recall-team, create-team-{key}); novos: team-momentum-{id}, team-roles-{id}, team-cohesion-{id}, team-familiarity-{id}, team-vitals-{id}."

test_plan:
  current_focus:
    - "Modelo Team serializa campos SSS v4 no /state + team_meta no /catalog"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      10/07/2026 — Design SSS das equipas (frontend) + extensão aditiva do backend. NOTA infra:
      ambiente RESET pelo fork — .env backend/frontend recriados (preview 650672af-769f-42ed-
      a63b-7c572aecf857), credenciais admin@lusorae.com / LusoraeAdmin2026! (ver
      /app/memory/test_credentials.md). TESTAR BACKEND APENAS: (1) GET /api/game/catalog →
      team_meta com 38 chaves (leader_min_rank, clutch_save_max, driver_*, strategist_*,
      momentum_*, coordination_*, familiarity_*, medic_*, lawyer_arrest_mult, synergy_*,
      category_attrs, reorg_after_roster_change_s); (2) GET /state → cada team tem streak (int),
      roster_missions (int), category_missions (dict); (3) regressão de equipas: POST /teams
      (criar), employees/assign a equipa, vehicles/assign, dispatch/preview e dispatch reais sem
      500, recommend_opportunity/team/repeat sem 500; (4) login intacto. Conta admin: 1 equipa
      (Crew Alfa, 2 membros, Sedan Usado), nível 1. CUIDADO: lockout é por ip:email — usar
      emails descartáveis em testes de auth. Frontend só com autorização do utilizador.
  - agent: "testing"
    message: >
      10/07/2026 — Testes backend SSS das Equipas CONCLUÍDOS COM SUCESSO. Todos os testes
      passaram (26 passed, 0 failed, 2 warnings não-críticos). VERIFICADO: (1) GET /api/game/catalog
      contém team_meta com 38 chaves corretas (leader_min_rank='chefe_equipa', no_leader_penalty=0.03,
      clutch_save_max=0.18, category_attrs com 4 categorias); weapon_meta presente (regressão OK).
      (2) GET /api/game/state: equipa Crew Alfa tem streak (int), roster_missions (int),
      category_missions (dict). (3) POST /api/game/teams/create: nova equipa criada com streak=0,
      roster_missions=0, category_missions={}. (4) Endpoints de recomendação
      (recommend_opportunity/team/repeat) → 200 sem 500. (5) POST /api/game/dispatch/preview → 200
      com breakdown e chance. (6) Login intacto. AVISOS (não-críticos): Sem funcionários/veículos
      livres para testes de atribuição (conta admin com recursos limitados, mas endpoints
      funcionam). CONCLUSÃO: Implementação SSS v4 das equipas está FUNCIONAL — campos persistidos
      corretamente, endpoints operacionais, sem crashes. Recomendo ao main agent sumarizar e concluir.

# ============================================================================
# 10/07/2026 — Operação em Direto (SSS): simulação viva de missões
# ============================================================================

user_problem_statement: >
  Melhorar significativamente a lógica e o design da simulação de "fazer a missão" para
  nível SSS — simulação viva e rica em detalhes (dock de transmissão em direto com feed
  rádio narrativo, complicações dinâmicas com efeito real na chance, guião de regresso
  com perseguições).

backend:
  - task: "live_ops.py NOVO — build_dispatch_script (guião viagem+operação com timestamps absolutos, beats por categoria com nomes reais dos membros, 0-2 complicações com pct cuja soma == live_chance_delta, clamp [-0.12,+0.08], viés negativo por risco/calor), build_return_script (beats de desfecho por outcome + perseguição + encravamentos), build_recall_script"
    implemented: true
    working: NA
    file: "backend/live_ops.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Smoke test unitário local OK: entries ordenados por at, soma dos pct == delta, textos por categoria, return script com chase/jam/bonus_loot. Falta teste via API."
  - task: "Dispatch gera live_log + live_chance_delta no doc da missão; recall corta beats futuros (at <= now) e anexa guião de recall; Mission model serializa live_log/live_chance_delta/final_chance"
    implemented: true
    working: NA
    file: "backend/routes_game.py, backend/models.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — POST /api/game/dispatch persiste live_log (lista de {at,phase,kind,speaker,text,pct?}) e live_chance_delta. GET /state deve devolver estes campos em cada missão ativa."
  - task: "_roll_outcome aplica live_chance_delta à chance (clamp 0.05-0.97) e persiste final_chance; _progress_mission (operating→returning) anexa build_return_script ao live_log e persiste live_log+final_chance nos updates"
    implemented: true
    working: NA
    file: "backend/engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Delta aplicado antes do roll de jams; final_chance = chance efetiva final. Return script gerado no tick lazy quando now >= finish_at."

frontend:
  - task: "LiveOpsDock — dock inferior 'transmissão em direto' (REC pulsante, tabs multi-operação, timeline Ida/Ação/Volta, chance ao vivo = success_chance + pct revelados, feed rádio com reveal por relógio do servidor + caret terminal, faixa de desfecho/perseguição, cartão de conclusão 8s, colapsável, botão seguir câmara via CustomEvent sub:follow-mission)"
    implemented: true
    working: NA
    file: "frontend/src/components/game/LiveOpsDock.jsx, frontend/src/pages/GamePage.jsx, frontend/src/components/game/LiveMap.jsx, frontend/src/App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "10/07/2026 — Novo componente + integração no GamePage + listener follow no LiveMap + estilos .sub-lo-* com prefers-reduced-motion. Compila sem erros novos."

test_plan:
  current_focus:
    - "live_ops.py NOVO — guiões de operação em direto"
    - "Dispatch gera live_log + live_chance_delta; recall corta beats"
    - "_roll_outcome aplica delta e persiste final_chance"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      10/07/2026 — Operação em Direto (SSS). NOTA infra: ambiente RESET pelo fork — .env
      recriados (preview 737970f5-e984-42c5-af9e-8508f17ae284), credenciais
      admin@lusorae.com / LusoraeAdmin2026! em /app/memory/test_credentials.md.
      TESTAR BACKEND APENAS:
      (1) Login admin → GET /api/game/state OK.
      (2) POST /api/game/dispatch (usar uma oportunidade de /state + equipa Crew Alfa) →
      mission criada; GET /state → missão ativa tem live_log (lista não-vazia, ordenada por
      at, entradas com at/phase/kind/speaker/text) e live_chance_delta (float; se houver
      entradas com pct, a soma dos pct ≈ live_chance_delta ±0.001).
      (3) Esperar a missão passar a returning (duração+viagem curtas; fazer polling de /state)
      → live_log cresceu com entradas phase='returning' e, se outcome in
      (success,partial,failure,police), final_chance presente (0.02-0.98).
      (4) POST /api/game/missions/recall numa missão en_route (despachar outra) → live_log
      só com entradas at<=now + 3 entradas de recall; outcome='recalled'.
      (5) Regressão: dispatch/preview sem 500; quests/state/catalog sem 500.
      CUIDADO: lockout por ip:email — usar emails descartáveis em testes de auth.
      Frontend só com autorização do utilizador.

#====================================================================================================
# RONDA — Banco narrativo massivo (751 frases) + memória anti-repetição + fix infra .env (09/07/2026)
#====================================================================================================

backend:
  - task: "FIX INFRA: backend/.env e frontend/.env em falta (reset de ambiente) — recriados (MONGO_URL, DB_NAME=test_database, CORS_ORIGINS com preview a7ffc1dd + localhost:3000, JWT_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD; REACT_APP_BACKEND_URL preview a7ffc1dd, WDS_SOCKET_PORT=443). Backend rebentava com KeyError MONGO_URL → utilizador não conseguia registar nem entrar."
    implemented: true
    working: NA
    file: "backend/.env, frontend/.env"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "09/07/2026 — Após recriar + restart: backend 'Application startup complete', GET /api/ OK. Falta verificar LOGIN admin@lusorae.com e REGISTO de conta nova end-to-end (bug reportado pelo utilizador)."
  - task: "Banco narrativo data-driven: live_phrases_beats.py (TYPE_BEATS — 469 beats de operação ÚNICOS, 7 por cada um dos 67 tipos, com stages 1/2/3) + live_phrases.py (282 frases partilhadas: abertura, viagem por período do dia/calor/incidente/chegada, aberturas/fechos, complicações por categoria, regresso/perseguição/recall). Total 751 frases."
    implemented: true
    working: NA
    file: "backend/live_phrases_beats.py, backend/live_phrases.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "09/07/2026 — Script local /tmp/test_live.py: 67 tipos geram guião sem placeholders por resolver e com delta dentro de [-0.12,+0.08]; período do dia e calor alto selecionam pools certos; todos os desfechos de regresso gerados."
  - task: "live_ops.py reescrito: PhraseDeck com anti-repetição por memória (player.phrase_memory, cap 280 chaves), formatação de contexto ({district},{team},{vehicle},{opp},{reward},{fine},{esc},{cause},{weapon},{who}), período do dia (Europe/Lisbon), beats por tipo com arco narrativo. build_dispatch_script→(entries,delta,used_keys); build_return_script/build_recall_script→(entries,used_keys). update_memory()."
    implemented: true
    working: NA
    file: "backend/live_ops.py, backend/routes_game.py, backend/engine.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: NA
        agent: "main"
        comment: "09/07/2026 — Dispatch persiste vehicle_name na missão e phrase_memory no player; recall e tick (return) atualizam phrase_memory. Anti-repetição verificada no smoke test (6x mesmo tipo → vozes variadas)."

test_plan:
  current_focus:
    - "FIX INFRA .env — login admin + registo de conta nova"
    - "Banco narrativo — dispatch gera live_log rico e variado"
    - "phrase_memory persiste e varia entre missões"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: >
      09/07/2026 — BUG REPORTADO PELO UTILIZADOR: não conseguia registar nem entrar.
      CAUSA: .env em falta (reset de ambiente) → backend KeyError MONGO_URL. FIX: .env
      recriados (preview a7ffc1dd-f9ae-4a89-8b4d-e1b25ecb2787). Credenciais admin em
      /app/memory/test_credentials.md (admin@lusorae.com / LusoraeAdmin2026!).
      TESTAR BACKEND APENAS (prioridade ao bug de auth):
      (1) LOGIN admin@lusorae.com / LusoraeAdmin2026! → 200 + sessão; GET /api/game/state OK.
      (2) REGISTO de conta NOVA (email descartável único, org_name único, accept_terms=true,
      password forte) → cria org + Crew Alfa + fundadores + veículo; login subsequente OK.
      (3) Banco narrativo: POST /api/game/dispatch (oportunidade de /state + Crew Alfa) →
      GET /state → missão tem live_log não-vazio, ordenado por at, com beats de operação;
      live_chance_delta float; se houver pct, soma ≈ live_chance_delta ±0.001.
      (4) Despachar o MESMO tipo 2-3x (se houver oportunidades) → verificar que os textos de
      operação variam (anti-repetição via player.phrase_memory).
      (5) Esperar returning (polling) → live_log cresce com phase='returning' e final_chance
      presente (0.02-0.98). Recall numa missão en_route → live_log só at<=now + recall.
      (6) Regressão: /state, /catalog, quests sem 500.
      CUIDADO: lockout por ip:email — usar emails descartáveis nos testes de auth para não
      bloquear o admin. Frontend só com autorização do utilizador.

frontend:
  - task: "Responsividade mobile — remoção dos controlos de câmara do mapa (+/−/centrar QG/enquadrar): componente MapControls eliminado do LiveMap (zoom por gestos/roda), testids map-zoom-in/out/center-hq/fit-all removidos, CSS .sub-map-ctrl apagado"
    implemented: true
    working: true
    file: "frontend/src/components/game/LiveMap.jsx, frontend/src/App.css"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Pedido do utilizador. Verificado por screenshot mobile 390px + desktop 1920px: controlos ausentes, pan/zoom do Leaflet intactos."
  - task: "Legenda do mapa responsiva — painel com max-height min(100dvh-9rem, 34rem) + overflow-y-auto (antes transbordava 140px acima do ecrã em 780px), largura w-60 max-w-[calc(100vw-1.25rem)], parágrafo narrativo gigante do fim removido"
    implemented: true
    working: true
    file: "frontend/src/components/game/LiveMap.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Bug do utilizador: 'legendas não aparecem no ecrã'. Antes: box y=-140 h=864 em viewport 780. Depois: y=226 h=498, cabe inteira, texto gigante removido. Verificado mobile+desktop."
  - task: "Tooltips (Tip/hud.jsx) em ecrãs táteis — tap em elementos interativos (button/a/input) já não abre nem prende o popover (deteção matchMedia hover+pointer:fine e querySelector no trigger); chips informativos mantêm tap-para-ver; hover desktop inalterado"
    implemented: true
    working: true
    file: "frontend/src/components/game/hud.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Causa dos tooltips presos no mobile: browsers emulam mouseenter/click no toque e o Popover controlado abria e ficava. Verificado hover desktop OK por Playwright; comportamento touch real só verificável com emulação de touch (testing agent, se o utilizador autorizar)."
  - task: "ResourceBar mobile — hook useNarrow (matchMedia max-width:639px) troca fmtMoney por novo fmtMoneyShort (75000→'75k €', 5400→'5,4k €', 1.25M→'1,25M €') em Limpo/Sujo e subs /h; SummaryStrip cols=4 → grid-cols-2 sm:grid-cols-4 (rótulos KPI 'LEALD…/DISPO…' deixam de truncar); dock com max-w-[calc(100vw-4rem)] + overflow-x-auto sem scrollbar + shrink-0 nos botões para ecrãs <360px"
    implemented: true
    working: true
    file: "frontend/src/components/game/ResourceBar.jsx, frontend/src/lib/game.js, frontend/src/components/game/hud.jsx, frontend/src/pages/GamePage.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "10/07/2026 — Verificado por screenshots: 360px mostra '75k €'/'5k €' sem reticências; desktop mantém '75 000 €'; painel Operacionais com KPIs 2×2 em mobile."

agent_communication:
  - agent: "main"
    message: >
      12/07/2026 — FIX de compilação (continuação): a sessão anterior deixou o refactor do
      disclaimer a meio — DisclaimerModal.jsx importava DISCLAIMER_SESSION_KEY já removido
      do AuthContextV2 (erro de compilação webpack) e AuthContextV2 chamava clearDisclaimerFlag()
      inexistente em 4 sítios (crash runtime latente). Refactor concluído: disclaimer de ficção
      agora aparece UMA única vez por conta (fonte de verdade user.disclaimer_accepted do
      servidor; sessionStorage eliminado; novo markDisclaimerAccepted no AuthContextV2).
      INFRA: .env backend+frontend recriados de novo (reset pós-fork; preview
      d7399260-2a1a-48e8-8920-ae982efab0af); JWT_SECRET novo → sessões antigas inválidas;
      admin seed OK (admin@lusorae.com / admin123; test_credentials.md atualizado; a BD
      recomeçou vazia → o admin volta a ver o disclaimer 1 vez). Verificado E2E por
      screenshots: modal no 1.º login → aceitar → não repete em refresh NEM em re-login;
      last_disclaimer/disclaimer_log confirmados no Mongo. NOTA PARA TESTES E2E: contas
      NOVAS têm de clicar data-testid="disclaimer-accept" (desbloqueia após ~20s) uma única
      vez; depois disso o modal nunca mais aparece nessa conta.
  - agent: "main"
    message: >
      10/07/2026 — Melhorias de responsividade mobile (só frontend, backend intocado).
      NOTA INFRA: .env backend+frontend recriados de novo (fork; preview
      850d821d-ead4-4fc5-8681-7ba0dfe1d6cf); password real do admin é admin123
      (test_credentials.md atualizado — a mensagem antiga referia LusoraeAdmin2026!, inválida).
      Mudanças: MapControls removido (testids map-zoom-in/out/center-hq/fit-all JÁ NÃO EXISTEM
      — não testar); legenda com scroll interno e sem parágrafo final; Tip não abre em tap
      sobre botões em dispositivos táteis; fmtMoneyShort na ResourceBar <640px; SummaryStrip
      2 colunas em mobile; dock com proteção anti-overflow. Verificado por screenshots
      390/360/1920. Teste frontend automatizado pendente de autorização do utilizador.
