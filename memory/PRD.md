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
### Botões SSS (07/07/2026)- `button.jsx`: variantes enriquecidas (gradientes com via-stops, sombras em camadas, focus ring vermelho, disabled dessaturado) + classe base `lus-btn`
- `App.css`: física de interação (spring easing, press-down translateY+scale+brightness), sheen sweep no hover via background-position (não corta badges externos), orla metálica mask-ring 1px em primary/success (branco→dourado→sombra), icon glow currentColor nos `lus-hud-btn`, indicador luminoso sob o separador ativo do dock, tudo coberto por prefers-reduced-motion
- `tabs.jsx`: TabsTrigger ativo com gradiente rico + ring inset + inner shadow; hover nos inativos; active:scale
- Fixes de intenção de cor (bg-color tapado pelo gradiente do variant default): OpportunityCard dispatch→success (corrigida regressão via-red-600), EmpirePanel lavar/subornar→outline, SettingsPanel claim-admin→âmbar sólido, LiveMap placement-confirm→success, AdminPanel 5 botões→variants corretos
- NOTA infra: .env recriados pós-fork; CORS exige origens explícitas (não "*" c/ credentials); testar via preview URL

### Responsividade mobile (10/07/2026)
- Controlos de câmara do mapa (+/−/centrar/enquadrar) removidos — zoom por gestos (pinch) / roda do rato; CSS `.lus-map-ctrl` eliminado
- Legenda do mapa: max-height `min(100dvh-9rem, 34rem)` + scroll interno + largura limitada ao viewport; parágrafo narrativo gigante do fim removido (antes transbordava 140px acima do ecrã)
- Tooltips `Tip` (hud.jsx): em ecrãs táteis, tap em botões de ação já não abre/prende o popover; chips informativos mantêm tap-para-ver; hover desktop inalterado
- ResourceBar: `fmtMoneyShort` ("75k €") abaixo de 640px via hook `useNarrow` — sem truncações; `SummaryStrip` cols=4 → 2 colunas em mobile; dock inferior com anti-overflow (max-w + scroll-x invisível)

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

### UI Uniformization Pass (07/07/2026)
- Design system CSS: `.lus-panel` (shell vidro escuro de todos os Sheets + OpportunityCard), `.lus-card` (cartão interno standard, substituiu `border-white/10 bg-white/[0.03]` em 11 ficheiros), `.lus-topbar` (ResourceBar)
- sheet.jsx: overlay c/ blur, header c/ barra vermelha de destaque + border-b, título uppercase display, close button circular — afeta os 10 painéis
- button.jsx: default/success c/ glow + border, outline elevado, active:scale press effect — afeta todos os botões
- hud.jsx: Kpi (lus-card, labels 9px, valores 12px), Chip (10px) — afeta todos os summary strips
- ResourceBar: lus-topbar, labels 9px, valores 12-13px; GamePage: HudButton c/ estado ativo (glow vermelho no painel aberto)

### Central da rede + fix de sobreposições (10/07/2026)
- Fusão "Em direto" + "Últimos registos" num só painel: ActivityFeed é agora a "Central da rede" com separadores EM DIRETO (transmissão: fases, chance ao vivo, rádio — LiveOpsPanel embutível, ex-LiveOpsDock) e REGISTOS (filtros/não lidos); auto-switch para EM DIRETO ao despachar; mobile: barra única com estado ao vivo + popover com as mesmas tabs
- Fix crítico: botão Confirmar da colocação de imóveis era tapado pelo dock (mesma âncora centro-fundo z-30) — modo de colocação agora é focado (GamePage esconde dock/consola/legenda/filtro/OpportunityCard), PlacementControls redesenhado (z-40, cartão com tipo+estado+botões grandes)
- MapBaseFilter movido para topo-esquerdo sob a ResourceBar (colidia com o dock no mobile); consola suprimida (<xl) quando OpportunityCard aberto — regra: nenhuma UI sobreposta/inclicável

### Botão Otimizar no painel Equipas (10/07/2026)
- TeamsPanel: botão "Otimizar equipas" (teams-optimize) entre o SummaryStrip e a lista — a lógica optimizeTeams/canOptimize já existia mas nunca era renderizada; um clique compõe /employees/optimize (preenche vagas por aptidão) + /vehicles/optimize (redistribui frota), tooltip dinâmico com contagens, desativado com razão quando nada há para otimizar
- NOTA infra: fork 10/07 — .env recriados (preview 3aa9b74b-e9aa-4239-b583-92d6420afc1b), credenciais em /app/memory/test_credentials.md

### SSS Ronda 8 — Cockpit Cinemático + Voz Noir (08/07/2026)
- Mapa: radar tático CSS a emanar do QG (marcador não-interativo 170px), grelha tática visível nas bordas (mask radial), moldura HUD com 4 cantos vermelhos no viewport
- Topbar: relógio da rede (hora do servidor + "Lisboa · 38.72N 9.14W"), flashes âmbar (dinheiro sujo) e azul (respeito) quando os valores sobem
- Juice: toasts sonner redesenhados (.lus-toast — vidro escuro, barra lateral por tipo success/error/warning/info, mono), flash vermelho no registo mais recente do feed (lus-feed-new, desktop+mobile), carimbo de celebração "EQUIPA DESTACADA" (lus-stamp, CustomEvent lus:dispatch-stamp disparado pelo OpportunityCard, GamePage renderiza 1.7s)
- Textos/Títulos: PanelKicker (micro-etiqueta laser vermelha) + PanelWatermark (ícone marca de água) em todos os 10 painéis, títulos com gradiente metálico (lus-sheet-title), taglines noir reescritas (ex. Império: "O dinheiro não dorme — lava-o, investe-o e mantém a polícia longe."), EmptyState tático partilhado (hud.jsx), copy noir em empty states (feed "Silêncio na rede. Por agora.", quests "Contratos diários esgotados — novos ao nascer do dia.") e AuthPage
- NOTA infra: fork 08/07 — .env recriados (preview 881ea282-260f-4851-99f8-c7e53f1369fd), credenciais em /app/memory/test_credentials.md
