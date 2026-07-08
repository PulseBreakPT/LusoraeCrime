# Lusorae — PRD

## Problema original
MMORPG de estratégia criminal para Web/Android/iOS, inspirado em MissionChief, Crime.Life e GTA Online mas totalmente original. Simulador de gestão de organização criminosa — o jogador controla um império inteiro através de uma dashboard moderna e um mapa vivo (centro da experiência). Oportunidades criminosas em tempo real, equipas/veículos com deslocação automática, economia viva, mundo vivo, progressão profunda. Interface premium, dark theme, mobile-first, mapa fullscreen, menus flutuantes, cartões compactos, animações suaves. Arquitetura extremamente modular para evolução por temporadas/anos.

## Escolhas do utilizador
- MVP: núcleo completo (mapa vivo + oportunidades em tempo real + equipas/veículos automáticos + economia base)
- Auth: JWT email/password
- Mapa: Lisboa
- Multiplayer: fase posterior (MVP single-player persistente)
- IA: apenas lógica de jogo (sem LLM)
- Funcionários são o CORAÇÃO da organização (pedido explícito): especializações, atributos, raridades, talentos, lealdade, moral, fadiga, estados, progressão

## Personas
- Jogador estratégico casual/mobile: sessões curtas, despacha equipas, acompanha progressão
- Jogador de gestão hardcore: otimiza economia, especializações, frotas, RH

## Arquitetura (modular)
- FastAPI + MongoDB (motor) + React 19 + Leaflet (CartoDB Dark Matter)
- Backend: `server.py` (app+startup+migrações v2/v4), `auth.py` (JWT/cookies + seed admin), `routes_game.py` (endpoints), `engine.py` (tick lazy: spawn/resolução/heat decay/RH), `game_data.py` (catálogos data-driven), `models.py` (PyObjectId/BaseDocument)
- Frontend: contexts (Auth, Game c/ polling 4s + clock offset), páginas (AuthPage, GamePage), componentes HUD (LiveMap, ResourceBar, OpportunityCard, TeamsPanel, EmployeesPanel, FleetPanel, PropertiesPanel, EmpirePanel, IntelPanel, ActivityFeed), `lib/game.js`
- Tick lazy no GET /state: expira oportunidades, spawn, progride missões, heat decay, level-up, formações, estados RH, folha salarial, traições, pool de recrutamento, rendimento passivo, rusgas

## Implementado (Jul 2026)
### MVP Temporada 0
- Auth JWT (cookies httpOnly + Bearer fallback), registo cria org + Crew Alfa + 2 fundadores + Sedan Usado, brute-force lockout, admin seeded
- 11 tipos de oportunidades com gate por nível; 4 especializações de equipas com bónus de match
- Mapa vivo de Lisboa: 16 zonas, HQ Cais do Sodré, marcadores pulsantes, unidades a mover-se em tempo real
- Economia: € limpo / € sujo, lavagem, respeito/níveis (10 thresholds), calor/polícia
### Frota & Propriedades
- 6 veículos (combustível gasolina/gasóleo, desgaste, reparações, atribuição a equipas, venda, estatísticas)
- 7 propriedades (esconderijo=cap funcionários, garagem=cap veículos, empresa de fachada=lavagem passiva, armazém/porto=bónus recompensas, laboratório=produção suja+calor, oficina=desconto reparações); upgrade até nível 3; rusgas policiais com heat≥70
### Sistema de Funcionários COMPLETO (02/07/2026)
- 14 especializações (assaltante, motorista, hacker, mecânico, informador, médico, lavador, advogado, negociador, segurança, contrabandista, falsificador, espião, gestor) — 6 com passivos de organização
- 9 atributos (força, inteligência, discrição, condução, tiro, hack, negociação, sangue-frio, resistência)
- 4 raridades (comum/raro/elite/lendário) com multiplicadores, max level e slots de talento; gate por respeito
- 8 talentos (ex: Motorista Fantasma -10% viagem, Pontaria Letal +5% assaltos, Fantasma Digital -50% calor técnico) — aplicados em missões
- 7 ranks (recruta→braço-direito) com promoções pagas (requisito de nível, +10% salário)
- Lealdade/Moral/Fadiga: folha salarial a cada 30 min (falta de pagamento → quebra moral/lealdade/abandonos), traições (roubo, fuga de info, sabotagem, abandono) com risco exposto na UI, bónus pagos para subir moral
- Estados: idle, on_mission, training, resting (90s, -50 fadiga), injured (clínica paga cura), arrested (advogado/suborno liberta)
- Recrutamento por 6 fontes (rua, bares, empresas, prisões, mercado negro, contactos) desbloqueadas por nível; pool renova 5 min ou refresh pago 500€
- 9 formações (+1 atributo, XP, bónus se combinar com especialização)
- XP/level individual, subida de atributos + desbloqueio de talentos no level-up, histórico por funcionário
- EmployeesPanel reformulado: tabs Plantel/Recrutar, cartões com barras moral/lealdade/fadiga, atributos, talentos, ações (treinar, descansar, promover, bónus, despedir, curar, libertar), countdowns
- Migração v4 automática de funcionários do schema antigo
- Testes: backend 29/29 pytest + frontend Playwright 100% (iteration_2)
### UI "Centro de Comando" (03/07/2026)
- Infra partilhada `components/game/hud.jsx`: Tip (tooltip CSS `.lus-tip`, sides/align), MiniBar, Chip, Kpi, SummaryStrip
- Helpers `lib/game.js`: heatStatus (Calmo/Vigiado/Alerta/Crítico), ATTR_FULL, vehicleRangeKm, refuel/repair/sellValueOf, passiveRates, teamsReadiness, orgAlerts
- ResourceBar: nível c/ barra de respeito, fluxos passivos €/h, calor c/ estado+minibar, equipas prontas, ops ativas, salários+countdown — tudo c/ tooltips
- HUD buttons c/ badges inteligentes (RH problemas, Frota avarias/combustível, Missões por reclamar, Equipas ocupadas, alertas pulsantes Império/Imóveis) + Intel c/ total de alertas
- LiveMap: tooltips hover em todos os marcadores (opp: recompensa/risco/respeito/expira; propriedades: nível/benefício; unidades: fase/countdown/probabilidade) + legenda colapsável (map-legend-toggle)
- Painéis c/ summary strips: Equipas (prontas/operação/afetos/fadiga), RH (moral/lealdade/fadiga/disponíveis + chips de estado), Frota (operacionais/condição/autonomia/custos), Imóveis (produção/lavagem/calor/valor)
- Império: fluxo de caixa passivo c/ balanço €/h, calor c/ thresholds 70/90, quick-nav c/ alertas
- Frota: autonomia km por veículo e no stand; RH: impacto na folha salarial ao contratar, tooltips raridade/atributos/estados; Imóveis: preview do benefício no próximo nível
- Intel: fortuna total, valor frota, salários/ciclo, tooltips em todas as células; Quests: badges de contagem nas tabs; ActivityFeed: tempo relativo + nº registos
- NOTA infra: .env recriados pós-fork; CORS exige origens explícitas (não "*" c/ credentials); testar via preview URL

### Autenticação 2.0 + Legal + Changelog (08/07/2026)
- Registo exige accept_terms (400 sem aceitação); guarda terms_accepted_at + terms_version "1.0"; password forte (>=8, letras+números) no registo/change-password; lockout inteligente (tentativas restantes <=2 no 401, minutos restantes no 429)
- AuthPage redesenhada: 2 colunas c/ feature pills, toggle password, medidor de força live, validação inline, checkbox termos c/ links, footer Termos·Privacidade·Changelog (test-ids antigos mantidos + auth-terms-checkbox/auth-password-toggle/password-strength)
- Páginas públicas /termos (15 secções PT-PT), /privacidade (RGPD c/ tabelas de dados), /changelog (timeline 8 versões/63 alterações do histórico git real, filtros por tipo, versão atual destacada) — LegalLayout partilhado (header c/ nav ativa, hero gradiente, secções numeradas c/ hover, footer editorial)
- Dados: src/data/changelog.js (CURRENT_VERSION 1.0.0); AuthContextV2.register(+acceptTerms)
- Smoke test backend OK (400/422/200); teste completo do backend por agente ficou PENDENTE (interrompido)
- NOTA fork: .env recriados (backend: MONGO_URL/DB_NAME=lusorae/JWT_SECRET/CORS_ORIGINS/ADMIN_*; frontend: REACT_APP_BACKEND_URL); DB começou vazia, admin re-seeded

## Backlog priorizado
### P0 (próxima fase)
- Territórios/influência: conquistar bairros de Lisboa, controlo gera rendimento, ataques a territórios ligados ao mapa
### P1
- Polícia mais profunda: investigações prolongadas, inteligência, informadores da polícia
- Mercado dinâmico (preços de mercadorias flutuantes) + logística de armazéns
- Tecnologia/árvore de investigação
### P2
- Multiplayer: jogadores visíveis, ataques PvP, alianças
- Temporadas/eventos, leaderboards
- PWA/Capacitor para Android/iOS

### Refactoring
- `routes_game.py` (~760 linhas) — dividir em módulos (routes_employees, routes_fleet, routes_properties) quando crescer mais
- `engine.py` (~700 linhas) — dividir por domínio se ultrapassar 900

## Próximas tarefas
1. Territórios + influência (P0)
2. Rendimento passivo ligado a territórios
3. Refactoring de rotas por módulo

## Credenciais
Ver /app/memory/test_credentials.md (admin@lusorae.com / LusoraeAdmin2026!)
