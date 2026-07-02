# Lusorae — PRD

## Problema original
MMORPG de estratégia criminal para Web/Android/iOS, inspirado em MissionChief, Crime.Life e GTA Online mas totalmente original. Simulador de gestão de organização criminosa — o jogador controla um império inteiro através de uma dashboard moderna e um mapa vivo (centro da experiência). Oportunidades criminosas em tempo real, equipas/veículos com deslocação automática, economia viva, mundo vivo, progressão profunda. Interface premium, dark theme, mobile-first, mapa fullscreen, menus flutuantes, cartões compactos, animações suaves. Arquitetura extremamente modular para evolução por temporadas/anos.

## Escolhas do utilizador
- MVP: núcleo completo (mapa vivo + oportunidades em tempo real + equipas/veículos automáticos + economia base)
- Auth: JWT email/password
- Mapa: Lisboa
- Multiplayer: fase posterior (MVP single-player persistente)
- IA: apenas lógica de jogo (sem LLM)

## Personas
- Jogador estratégico casual/mobile: sessões curtas, despacha equipas, acompanha progressão
- Jogador de gestão hardcore: otimiza economia, especializações, frotas

## Arquitetura (modular)
- FastAPI + MongoDB (motor) + React 19 + Leaflet (CartoDB Dark Matter)
- Backend: `server.py` (app+startup), `auth.py` (JWT/cookies + seed admin), `routes_game.py` (endpoints), `engine.py` (tick lazy: spawn/resolução/heat decay), `game_data.py` (catálogos data-driven — novos tipos de oportunidades/equipas/veículos adicionam-se aqui sem tocar na arquitetura), `models.py` (PyObjectId/BaseDocument)
- Frontend: contexts (Auth, Game c/ polling 4s + clock offset), páginas (AuthPage, GamePage), componentes HUD (LiveMap, ResourceBar, OpportunityCard, TeamsPanel, EmpirePanel, ActivityFeed), `lib/game.js` (interpolação de posições, catálogos visuais)
- Tick lazy no GET /state: expira oportunidades, faz spawn (target por nível), progride missões (en_route→operating→returning→done), heat decay, level-up
- Movimento no mapa: timestamps server-side + interpolação client-side (350ms)

## Implementado (Jul 2026 — MVP Temporada 0)
- Auth JWT (cookies httpOnly + Bearer fallback), registo cria org + equipa inicial, brute-force lockout, admin seeded
- 11 tipos de oportunidades (assalto, roubo, contrabando, transporte, lavagem, cobrança, ataque a território, infiltração, hack, operação VIP, missão especial) com gate por nível
- 4 especializações de equipas (assalto, logística, técnica, influência) com bónus de match; skill cresce com missões
- 5 veículos (velocidade afeta ETA); garagem por equipa
- Economia: € limpo / € sujo, lavagem (taxa 25%), respeito/níveis (10 thresholds), calor/polícia (multas, decay)
- Mapa vivo de Lisboa: 16 zonas, HQ Cais do Sodré, marcadores pulsantes por categoria, unidades a mover-se em tempo real
- HUD premium dark: resource bar, cartão de oportunidade c/ ETA, painéis Equipas/Império (sheets), feed de atividade terminal
- Testes: 17/17 backend + todos os fluxos frontend (iteration_1)

## Backlog priorizado
### P0 (próxima fase)
- Edifícios: comprar/melhorar esconderijos, garagens, laboratórios, armazéns, portos, oficinas, empresas legais (geração passiva + capacidade)
- Territórios/influência: conquistar bairros de Lisboa, controlo gera rendimento, ataques a territórios ligados ao mapa
### P1
- Membros individuais dentro das equipas (recrutar, treinar, especializar)
- Polícia mais profunda: raids em heat alto, subornos, inteligência
- Mercado dinâmico (preços de mercadorias flutuantes) + logística de armazéns
- Tecnologia/árvore de investigação
### P2
- Multiplayer: jogadores visíveis, ataques PvP, alianças
- Temporadas/eventos, leaderboards
- PWA/Capacitor para Android/iOS

## Próximas tarefas
1. Sistema de edifícios (P0)
2. Territórios + influência (P0)
3. Rendimento passivo ligado a edifícios/territórios

## Credenciais
Ver /app/memory/test_credentials.md (admin@lusorae.com / LusoraeAdmin2026!)
