CHAPTERS = {1: "Começo", 2: "Expansão", 3: "Organização", 4: "Domínio", 5: "Consolidação", 6: "Legado"}

QUEST_DEFS = {
    # ---------- Capítulo 1 — Começo ----------
    "c1_base": {
        "name": "Casa Segura", "type": "principal", "category": "economia", "chapter": 1, "difficulty": "facil",
        "desc": "Toda a organização precisa de um teto. Compra o teu primeiro esconderijo para abrigar mais gente.",
        "objective": {"kind": "state", "metric": "prop_count:esconderijo", "target": 1, "label": "Comprar 1 esconderijo"},
        "requires": [], "rewards": {"dirty": 3000, "respect": 50},
        "unlocks_text": "Capacidade para mais operacionais.",
    },
    "c1_first_dispatch": {
        "name": "Primeira Viagem", "type": "principal", "category": "operacao", "chapter": 1, "difficulty": "facil",
        "desc": "Envia uma equipa com veículo para uma oportunidade no mapa. Lisboa está cheia de trabalho.",
        "objective": {"kind": "counter", "metric": "ops_dispatched", "target": 1, "label": "Despachar 1 operação"},
        "requires": ["c1_base"], "rewards": {"dirty": 1500, "respect": 30},
    },
    "c1_first_hit": {
        "name": "Primeiro Golpe", "type": "principal", "category": "operacao", "chapter": 1, "difficulty": "facil",
        "desc": "Conclui a tua primeira operação de rua com sucesso. Mostra às ruas quem manda.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 1, "label": "Concluir 1 operação"},
        "requires": ["c1_first_dispatch"], "rewards": {"dirty": 3000, "respect": 60},
        "unlocks_text": "Operações maiores esperam por ti.",
    },
    "c1_first_recruit": {
        "name": "Sangue Novo", "type": "principal", "category": "funcionarios", "chapter": 1, "difficulty": "facil",
        "desc": "A organização vive das pessoas. Recruta o teu primeiro operacional no painel de Operacionais.",
        "objective": {"kind": "counter", "metric": "recruits_hired", "target": 1, "label": "Recrutar 1 operacional"},
        "requires": ["c1_first_hit"], "rewards": {"dirty": 2000, "respect": 50},
    },
    "c1_launder": {
        "name": "Dinheiro Limpo", "type": "principal", "category": "economia", "chapter": 1, "difficulty": "normal",
        "desc": "Dinheiro sujo não paga salários. Lava 5.000 € para aprenderes o circuito financeiro.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 5000, "label": "Lavar 5.000 €"},
        "requires": ["c1_first_recruit"], "rewards": {"clean": 3000, "respect": 80},
        "unlocks_text": "Capítulo 2 — Expansão desbloqueado.",
    },

    # ---------- Capítulo 2 — Expansão ----------
    "c2_garage": {
        "name": "Mais Espaço", "type": "principal", "category": "frota", "chapter": 2, "difficulty": "normal",
        "desc": "A frota vai crescer. Compra uma garagem para ganhares espaço para mais veículos.",
        "objective": {"kind": "state", "metric": "prop_count:garagem", "target": 1, "label": "Comprar 1 garagem"},
        "requires": ["c1_launder"], "rewards": {"dirty": 4000, "respect": 80},
    },
    "c2_fleet2": {
        "name": "Frota em Crescimento", "type": "principal", "category": "frota", "chapter": 2, "difficulty": "normal",
        "desc": "Um veículo não chega para dominar Lisboa. Tem pelo menos 2 veículos na frota.",
        "objective": {"kind": "state", "metric": "vehicle_count", "target": 2, "label": "Ter 2 veículos"},
        "requires": ["c2_garage"], "rewards": {"dirty": 5000, "respect": 100},
    },
    "c2_repair": {
        "name": "Máquina Afinada", "type": "principal", "category": "frota", "chapter": 2, "difficulty": "normal",
        "desc": "Veículos degradados falham fugas. Repara um veículo na oficina.",
        "objective": {"kind": "counter", "metric": "vehicles_repaired", "target": 1, "label": "Reparar 1 veículo"},
        "requires": ["c2_fleet2"], "rewards": {"clean": 2500, "respect": 60},
    },
    "c2_front": {
        "name": "Fachada Perfeita", "type": "principal", "category": "economia", "chapter": 2, "difficulty": "dificil",
        "desc": "Abre uma empresa de fachada para lavar dinheiro automaticamente e dar cara legal ao império.",
        "objective": {"kind": "state", "metric": "prop_count:empresa_legal", "target": 1, "label": "Comprar 1 empresa de fachada"},
        "requires": ["c2_repair"], "min_level": 2,
        "rewards": {"vehicle": "van", "respect": 150},
        "unlocks_text": "Capítulo 3 — Organização. Um contacto misterioso vai procurar-te...",
    },

    # ---------- Capítulo 3 — Organização ----------
    "c3_team2": {
        "name": "Divisão de Trabalho", "type": "principal", "category": "funcionarios", "chapter": 3, "difficulty": "normal",
        "desc": "Uma crew não chega. Forma uma segunda equipa especializada.",
        "objective": {"kind": "counter", "metric": "teams_created", "target": 1, "label": "Formar 1 nova equipa"},
        "requires": ["c2_front"], "rewards": {"dirty": 6000, "respect": 120},
    },
    "c3_train3": {
        "name": "Formação Contínua", "type": "principal", "category": "funcionarios", "chapter": 3, "difficulty": "dificil",
        "desc": "Profissionais treinados falham menos. Completa 3 formações de operacionais.",
        "objective": {"kind": "counter", "metric": "trainings_completed", "target": 3, "label": "Completar 3 formações"},
        "requires": ["c3_team2"], "rewards": {"clean": 5000, "respect": 120},
    },
    "c3_highvalue": {
        "name": "Golpe de Alto Valor", "type": "principal", "category": "operacao", "chapter": 3, "difficulty": "dificil",
        "desc": "Chega de trocos. Conclui uma operação com recompensa de pelo menos 8.000 €.",
        "objective": {"kind": "counter", "metric": "high_value_ops", "target": 1, "label": "1 operação de 8.000 €+"},
        "requires": ["c3_train3"], "rewards": {"dirty": 8000, "respect": 150},
    },
    "c3_cool": {
        "name": "Cabeça Fria", "type": "principal", "category": "geral", "chapter": 3, "difficulty": "normal",
        "desc": "A polícia anda em cima. Paga um suborno para limpar o teu rasto.",
        "objective": {"kind": "counter", "metric": "bribes_paid", "target": 1, "label": "Pagar 1 suborno"},
        "requires": ["c3_highvalue"], "rewards": {"clean": 4000, "respect": 100},
    },
    "c3_informant": {
        "name": "Olhos na Rua", "type": "principal", "category": "funcionarios", "chapter": 3, "difficulty": "dificil",
        "desc": "Informação é poder. Recruta um informador para a organização (procura nos Bares).",
        "objective": {"kind": "counter", "metric": "recruits_informador", "target": 1, "label": "Recrutar 1 informador"},
        "requires": ["c3_cool"],
        "rewards": {"employee": {"role": "informador", "rarity": "raro", "fallback_clean": 8000}, "respect": 150},
        "unlocks_text": "Capítulo 4 — Domínio desbloqueado (missões em paralelo).",
    },

    # ---------- Capítulo 4 — Domínio (paralelo) ----------
    "c4_parallel": {
        "name": "Multitarefa", "type": "principal", "category": "operacao", "chapter": 4, "difficulty": "dificil",
        "desc": "Um verdadeiro chefe gere várias frentes. Tem 2 operações a decorrer em simultâneo.",
        "objective": {"kind": "state", "metric": "active_ops", "target": 2, "label": "2 operações em simultâneo"},
        "requires": ["c3_informant"], "rewards": {"dirty": 10000, "respect": 200},
    },
    "c4_promote2": {
        "name": "Hierarquia", "type": "principal", "category": "funcionarios", "chapter": 4, "difficulty": "dificil",
        "desc": "Constrói a tua cadeia de comando. Promove operacionais 2 vezes.",
        "objective": {"kind": "counter", "metric": "employees_promoted", "target": 2, "label": "2 promoções"},
        "requires": ["c3_informant"], "rewards": {"clean": 8000, "respect": 180},
    },
    "c4_raid": {
        "name": "Tempestade", "type": "principal", "category": "geral", "chapter": 4, "difficulty": "elite",
        "desc": "Compra um laboratório, deixa o calor subir e sobrevive a uma rusga policial. O império aguenta tudo.",
        "objective": {"kind": "counter", "metric": "raids_survived", "target": 1, "label": "Sobreviver a 1 rusga"},
        "requires": ["c3_informant"], "rewards": {"dirty": 12000, "respect": 250},
    },
    "c4_launder50k": {
        "name": "Grande Lavagem", "type": "principal", "category": "economia", "chapter": 4, "difficulty": "elite",
        "desc": "O dinheiro tem de circular em grande escala. Lava 50.000 € no total desta missão.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 50000, "label": "Lavar 50.000 €"},
        "requires": ["c3_informant"], "rewards": {"clean": 15000, "respect": 300},
    },
    "c4_empire": {
        "name": "Império", "type": "principal", "category": "geral", "chapter": 4, "difficulty": "lendaria",
        "desc": "Atinge o nível 5 de respeito. Lisboa vai conhecer o teu nome.",
        "objective": {"kind": "state", "metric": "level_at_least", "target": 5, "label": "Atingir nível 5"},
        "requires": ["c3_informant"],
        "rewards": {"employee": {"role": "espiao", "rarity": "lendario", "fallback_clean": 30000}, "respect": 500},
        "unlocks_text": "Dominas Lisboa. Mas consolidar o império é outro trabalho — Capítulo 5 — Consolidação desbloqueado.",
    },

    # ---------- Capítulo 5 — Consolidação ----------
    "c5_fleet5": {
        "name": "Frota de Elite", "type": "principal", "category": "frota", "chapter": 5, "difficulty": "dificil",
        "desc": "Uma organização a sério move-se em força. Tem pelo menos 5 veículos na frota.",
        "objective": {"kind": "state", "metric": "vehicle_count", "target": 5, "label": "Ter 5 veículos"},
        "requires": ["c4_empire"], "rewards": {"dirty": 15000, "respect": 300},
    },
    "c5_team_extra": {
        "name": "Mais Braços", "type": "principal", "category": "funcionarios", "chapter": 5, "difficulty": "dificil",
        "desc": "Duas crews já não chegam. Forma mais 2 equipas.",
        "objective": {"kind": "counter", "metric": "teams_created", "target": 2, "label": "Formar 2 novas equipas"},
        "requires": ["c5_fleet5"], "rewards": {"dirty": 16000, "respect": 320},
    },
    "c5_upgrade3": {
        "name": "Investimento Contínuo", "type": "principal", "category": "geral", "chapter": 5, "difficulty": "dificil",
        "desc": "Um império não fica parado. Melhora 3 propriedades.",
        "objective": {"kind": "counter", "metric": "properties_upgraded", "target": 3, "label": "Melhorar 3 propriedades"},
        "requires": ["c5_team_extra"], "rewards": {"clean": 14000, "respect": 300},
    },
    "c5_recruit5": {
        "name": "Recrutamento em Massa", "type": "principal", "category": "funcionarios", "chapter": 5, "difficulty": "dificil",
        "desc": "O império precisa de gente. Recruta mais 5 operacionais.",
        "objective": {"kind": "counter", "metric": "recruits_hired", "target": 5, "label": "Recrutar 5 operacionais"},
        "requires": ["c5_upgrade3"], "rewards": {"dirty": 15000, "respect": 300},
    },
    "c5_promote3": {
        "name": "Nova Hierarquia", "type": "principal", "category": "funcionarios", "chapter": 5, "difficulty": "dificil",
        "desc": "A cadeia de comando cresce. Promove operacionais mais 3 vezes.",
        "objective": {"kind": "counter", "metric": "employees_promoted", "target": 3, "label": "3 promoções"},
        "requires": ["c5_recruit5"], "rewards": {"clean": 14000, "respect": 320},
    },
    "c5_highvalue3": {
        "name": "Golpes de Peso", "type": "principal", "category": "operacao", "chapter": 5, "difficulty": "elite",
        "desc": "Só trabalhos que valham a pena. Conclui mais 3 operações de 8.000 €+.",
        "objective": {"kind": "counter", "metric": "high_value_ops", "target": 3, "label": "3 operações de alto valor"},
        "requires": ["c5_promote3"], "rewards": {"dirty": 18000, "respect": 350},
    },
    "c5_earn100k": {
        "name": "Fluxo de Capital", "type": "principal", "category": "economia", "chapter": 5, "difficulty": "elite",
        "desc": "O dinheiro tem de entrar a sério. Ganha mais 100.000 € sujos em operações.",
        "objective": {"kind": "counter", "metric": "earned_dirty", "target": 100000, "label": "Ganhar 100.000 € sujos"},
        "requires": ["c5_highvalue3"], "rewards": {"clean": 20000, "respect": 380},
    },
    "c5_launder80k": {
        "name": "Circuito Consolidado", "type": "principal", "category": "economia", "chapter": 5, "difficulty": "elite",
        "desc": "Nada de dinheiro parado. Lava mais 80.000 € no total.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 80000, "label": "Lavar 80.000 €"},
        "requires": ["c5_earn100k"], "rewards": {"clean": 22000, "respect": 380},
    },
    "c5_ops50": {
        "name": "Máquina Bem Oleada", "type": "principal", "category": "operacao", "chapter": 5, "difficulty": "elite",
        "desc": "A organização opera sem parar. Conclui mais 50 operações com sucesso.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 50, "label": "Concluir 50 operações"},
        "requires": ["c5_launder80k"], "rewards": {"dirty": 25000, "respect": 400},
    },
    "c5_empire2": {
        "name": "Consolidação Total", "type": "principal", "category": "geral", "chapter": 5, "difficulty": "lendaria",
        "desc": "Atinge o nível 8. Lisboa já não te escapa das mãos.",
        "objective": {"kind": "state", "metric": "level_at_least", "target": 8, "label": "Atingir nível 8"},
        "requires": ["c5_ops50"],
        "rewards": {"employee": {"role": "quimico", "rarity": "lendario", "fallback_clean": 40000}, "respect": 600},
        "unlocks_text": "O império está consolidado. Capítulo 6 — Legado desbloqueado (missões em paralelo).",
    },

    # ---------- Capítulo 6 — Legado (paralelo) ----------
    "c6_ops100": {
        "name": "Século de Operações", "type": "principal", "category": "operacao", "chapter": 6, "difficulty": "lendaria",
        "desc": "Constrói o teu legado nas ruas. Conclui mais 100 operações com sucesso.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 100, "label": "Concluir 100 operações"},
        "requires": ["c5_empire2"], "rewards": {"dirty": 35000, "respect": 500},
    },
    "c6_earn250k": {
        "name": "Fortuna Sombria", "type": "principal", "category": "economia", "chapter": 6, "difficulty": "lendaria",
        "desc": "Ganha mais 250.000 € sujos em operações. O império paga-se sozinho.",
        "objective": {"kind": "counter", "metric": "earned_dirty", "target": 250000, "label": "Ganhar 250.000 € sujos"},
        "requires": ["c5_empire2"], "rewards": {"clean": 40000, "respect": 500},
    },
    "c6_launder150k": {
        "name": "Império Financeiro", "type": "principal", "category": "economia", "chapter": 6, "difficulty": "lendaria",
        "desc": "Lava mais 150.000 € no total. Nem um cêntimo fica por explicar.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 150000, "label": "Lavar 150.000 €"},
        "requires": ["c5_empire2"], "rewards": {"clean": 42000, "respect": 500},
    },
    "c6_fleet8": {
        "name": "Frota Imperial", "type": "principal", "category": "frota", "chapter": 6, "difficulty": "lendaria",
        "desc": "Tem pelo menos 8 veículos ao serviço da organização.",
        "objective": {"kind": "state", "metric": "vehicle_count", "target": 8, "label": "Ter 8 veículos"},
        "requires": ["c5_empire2"], "rewards": {"dirty": 30000, "respect": 450},
    },
    "c6_teams_extra": {
        "name": "Exército de Crews", "type": "principal", "category": "funcionarios", "chapter": 6, "difficulty": "lendaria",
        "desc": "Forma mais 3 equipas — o império opera em todas as frentes.",
        "objective": {"kind": "counter", "metric": "teams_created", "target": 3, "label": "Formar 3 novas equipas"},
        "requires": ["c5_empire2"], "rewards": {"dirty": 32000, "respect": 460},
    },
    "c6_promote5": {
        "name": "Sucessão", "type": "principal", "category": "funcionarios", "chapter": 6, "difficulty": "lendaria",
        "desc": "Promove operacionais mais 5 vezes. O legado precisa de líderes.",
        "objective": {"kind": "counter", "metric": "employees_promoted", "target": 5, "label": "5 promoções"},
        "requires": ["c5_empire2"], "rewards": {"clean": 30000, "respect": 460},
    },
    "c6_raids3": {
        "name": "À Prova de Bala", "type": "principal", "category": "geral", "chapter": 6, "difficulty": "lendaria",
        "desc": "Sobrevive a mais 3 rusgas policiais. Nada abala o império — e sais delas mais discreto que nunca.",
        "objective": {"kind": "counter", "metric": "raids_survived", "target": 3, "label": "Sobreviver a 3 rusgas"},
        "requires": ["c5_empire2"], "rewards": {"dirty": 20000, "respect": 480, "vehicle": "carro_furtivo"},
    },
    "c6_bribes5": {
        "name": "Amigos na Câmara", "type": "principal", "category": "geral", "chapter": 6, "difficulty": "lendaria",
        "desc": "Paga mais 5 subornos. A polícia já trabalha praticamente para ti.",
        "objective": {"kind": "counter", "metric": "bribes_paid", "target": 5, "label": "Pagar 5 subornos"},
        "requires": ["c5_empire2"], "rewards": {"clean": 28000, "respect": 450},
    },
    "c6_properties10": {
        "name": "Impérios de Tijolo", "type": "principal", "category": "geral", "chapter": 6, "difficulty": "lendaria",
        "desc": "Tem pelo menos 10 propriedades. O teu nome está em cada esquina de Lisboa.",
        "objective": {"kind": "state", "metric": "property_count", "target": 10, "label": "Ter 10 propriedades"},
        "requires": ["c5_empire2"], "rewards": {"dirty": 36000, "respect": 480},
    },
    "c6_level10": {
        "name": "Lenda de Lisboa", "type": "principal", "category": "geral", "chapter": 6, "difficulty": "lendaria",
        "desc": "Atinge o nível máximo, 10. O teu nome fica escrito na história do crime organizado.",
        "objective": {"kind": "state", "metric": "level_at_least", "target": 10, "label": "Atingir nível 10"},
        "requires": ["c5_empire2"],
        "rewards": {"employee": {"role": "espiao", "rarity": "lendario", "fallback_clean": 60000}, "respect": 1000},
        "unlocks_text": "És uma lenda de Lisboa. O teu legado está completo.",
    },

    # ---------- Diárias ----------
    "d_ops3": {
        "name": "Ronda Diária", "type": "diaria", "category": "operacao", "difficulty": "facil",
        "desc": "Mantém as ruas a trabalhar. Conclui 3 operações hoje.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 3, "label": "Concluir 3 operações"},
        "rewards": {"dirty": 3000, "respect": 40},
    },
    "d_launder3k": {
        "name": "Contabilidade", "type": "diaria", "category": "economia", "difficulty": "facil",
        "desc": "O contabilista precisa de movimento. Lava 3.000 € hoje.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 3000, "label": "Lavar 3.000 €"},
        "rewards": {"clean": 2000},
    },
    "d_refuel": {
        "name": "Depósito Cheio", "type": "diaria", "category": "frota", "difficulty": "facil",
        "desc": "Nunca fiques a pé numa fuga. Abastece um veículo.",
        "objective": {"kind": "counter", "metric": "vehicles_refueled", "target": 1, "label": "Abastecer 1 veículo"},
        "rewards": {"dirty": 1200},
    },
    "d_train1": {
        "name": "Dia de Ginásio", "type": "diaria", "category": "funcionarios", "difficulty": "normal",
        "desc": "Investe nas pessoas. Completa 1 formação hoje.",
        "objective": {"kind": "counter", "metric": "trainings_completed", "target": 1, "label": "Completar 1 formação"},
        "rewards": {"dirty": 1000, "respect": 60},
    },
    "d_rest1": {
        "name": "Recuperação", "type": "diaria", "category": "funcionarios", "difficulty": "facil",
        "desc": "Gente cansada comete erros. Manda 1 operacional descansar.",
        "objective": {"kind": "counter", "metric": "employees_rested", "target": 1, "label": "1 descanso"},
        "rewards": {"dirty": 1000},
    },
    "d_ops_assalto": {
        "name": "Dia de Pancada", "type": "diaria", "category": "operacao", "difficulty": "normal",
        "desc": "As crews de assalto querem ação. Conclui 2 operações de assalto.",
        "objective": {"kind": "counter", "metric": "success_by_category.assalto", "target": 2, "label": "2 operações de assalto"},
        "rewards": {"dirty": 2800, "respect": 40},
    },
    "d_ops_logistica": {
        "name": "Rotas Abertas", "type": "diaria", "category": "operacao", "difficulty": "normal",
        "desc": "Mercadoria parada é dinheiro perdido. Conclui 2 operações de logística.",
        "objective": {"kind": "counter", "metric": "success_by_category.logistica", "target": 2, "label": "2 operações de logística"},
        "rewards": {"dirty": 2800, "respect": 40},
    },
    "d_ops_tecnica": {
        "name": "Rede Silenciosa", "type": "diaria", "category": "operacao", "difficulty": "normal", "min_level": 2,
        "desc": "Os hackers estão inspirados. Conclui 2 operações técnicas.",
        "objective": {"kind": "counter", "metric": "success_by_category.tecnica", "target": 2, "label": "2 operações técnicas"},
        "rewards": {"dirty": 3200, "respect": 40},
    },
    "d_ops_influencia": {
        "name": "Favores e Cobranças", "type": "diaria", "category": "operacao", "difficulty": "normal",
        "desc": "Há dívidas por cobrar na cidade. Conclui 2 operações de influência.",
        "objective": {"kind": "counter", "metric": "success_by_category.influencia", "target": 2, "label": "2 operações de influência"},
        "rewards": {"dirty": 2800, "respect": 40},
    },
    "d_ops5": {
        "name": "Turno Duplo", "type": "diaria", "category": "operacao", "difficulty": "normal",
        "desc": "Hoje o dia é longo. Conclui 5 operações.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 5, "label": "Concluir 5 operações"},
        "rewards": {"dirty": 4000, "respect": 60},
    },
    "d_refuel2": {
        "name": "Depósitos Cheios", "type": "diaria", "category": "frota", "difficulty": "facil",
        "desc": "A frota não pode ficar a pé. Abastece 2 veículos.",
        "objective": {"kind": "counter", "metric": "vehicles_refueled", "target": 2, "label": "Abastecer 2 veículos"},
        "rewards": {"dirty": 1500},
    },
    "d_repair1": {
        "name": "Manutenção Preventiva", "type": "diaria", "category": "frota", "difficulty": "facil",
        "desc": "Um veículo avariado é uma fuga perdida. Repara 1 veículo.",
        "objective": {"kind": "counter", "metric": "vehicles_repaired", "target": 1, "label": "Reparar 1 veículo"},
        "rewards": {"clean": 1500},
    },
    "d_recruit1": {
        "name": "Novo na Rua", "type": "diaria", "category": "funcionarios", "difficulty": "facil",
        "desc": "Sempre há espaço para mais um. Recruta 1 operacional.",
        "objective": {"kind": "counter", "metric": "recruits_hired", "target": 1, "label": "Recrutar 1 operacional"},
        "rewards": {"dirty": 1800, "respect": 30},
    },
    "d_promote1": {
        "name": "Reconhecimento", "type": "diaria", "category": "funcionarios", "difficulty": "normal",
        "desc": "O mérito não pode esperar. Promove 1 operacional.",
        "objective": {"kind": "counter", "metric": "employees_promoted", "target": 1, "label": "1 promoção"},
        "rewards": {"clean": 1500, "respect": 40},
    },
    "d_bonus1": {
        "name": "Palmadinha nas Costas", "type": "diaria", "category": "funcionarios", "difficulty": "facil",
        "desc": "A moral não se mantém sozinha. Paga 1 bónus.",
        "objective": {"kind": "counter", "metric": "bonuses_paid", "target": 1, "label": "Pagar 1 bónus"},
        "rewards": {"respect": 30},
    },
    "d_bribe1": {
        "name": "Um Favor à Polícia", "type": "diaria", "category": "geral", "difficulty": "facil",
        "desc": "Mantém as ruas calmas. Paga 1 suborno.",
        "objective": {"kind": "counter", "metric": "bribes_paid", "target": 1, "label": "Pagar 1 suborno"},
        "rewards": {"dirty": 1200},
    },
    "d_launder5k": {
        "name": "Circuito Diário", "type": "diaria", "category": "economia", "difficulty": "normal",
        "desc": "Faz o dinheiro girar. Lava 5.000 € hoje.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 5000, "label": "Lavar 5.000 €"},
        "rewards": {"clean": 2500},
    },
    "d_earn6k": {
        "name": "Meta do Dia", "type": "diaria", "category": "economia", "difficulty": "normal",
        "desc": "Fecha o dia em alta. Ganha 6.000 € sujos em operações.",
        "objective": {"kind": "counter", "metric": "earned_dirty", "target": 6000, "label": "Ganhar 6.000 € sujos"},
        "rewards": {"respect": 50},
    },
    "d_rest2": {
        "name": "Turno de Descanso", "type": "diaria", "category": "funcionarios", "difficulty": "facil",
        "desc": "Gente cansada comete erros. Manda 2 operacionais descansar.",
        "objective": {"kind": "counter", "metric": "employees_rested", "target": 2, "label": "2 descansos"},
        "rewards": {"dirty": 1200},
    },
    "d_train2": {
        "name": "Sala de Aula", "type": "diaria", "category": "funcionarios", "difficulty": "normal",
        "desc": "Investe nas pessoas. Completa 2 formações hoje.",
        "objective": {"kind": "counter", "metric": "trainings_completed", "target": 2, "label": "Completar 2 formações"},
        "rewards": {"dirty": 1800, "respect": 50},
    },
    "d_property1": {
        "name": "Expansão do Dia", "type": "diaria", "category": "geral", "difficulty": "normal",
        "desc": "O império precisa de espaço. Compra 1 propriedade.",
        "objective": {"kind": "counter", "metric": "properties_bought", "target": 1, "label": "Comprar 1 propriedade"},
        "rewards": {"respect": 60},
    },
    "d_ops_assalto_grande": {
        "name": "Dia de Pancada Grande", "type": "diaria", "category": "operacao", "difficulty": "dificil",
        "desc": "As crews de assalto querem mais ação. Conclui 3 operações de assalto.",
        "objective": {"kind": "counter", "metric": "success_by_category.assalto", "target": 3, "label": "3 operações de assalto"},
        "rewards": {"dirty": 3200, "respect": 45},
    },
    "d_ops_logistica_grande": {
        "name": "Rotas em Força", "type": "diaria", "category": "operacao", "difficulty": "dificil",
        "desc": "Mercadoria parada é dinheiro perdido. Conclui 3 operações de logística.",
        "objective": {"kind": "counter", "metric": "success_by_category.logistica", "target": 3, "label": "3 operações de logística"},
        "rewards": {"dirty": 3200, "respect": 45},
    },
    "d_ops_tecnica_grande": {
        "name": "Rede em Sobrecarga", "type": "diaria", "category": "operacao", "difficulty": "dificil", "min_level": 2,
        "desc": "Os hackers estão em grande forma. Conclui 3 operações técnicas.",
        "objective": {"kind": "counter", "metric": "success_by_category.tecnica", "target": 3, "label": "3 operações técnicas"},
        "rewards": {"dirty": 3600, "respect": 45},
    },
    "d_ops_influencia_grande": {
        "name": "Favores em Excesso", "type": "diaria", "category": "operacao", "difficulty": "dificil",
        "desc": "Há mais dívidas do que o costume. Conclui 3 operações de influência.",
        "objective": {"kind": "counter", "metric": "success_by_category.influencia", "target": 3, "label": "3 operações de influência"},
        "rewards": {"dirty": 3200, "respect": 45},
    },
    "d_vehicles_bought1": {
        "name": "Renovação da Frota", "type": "diaria", "category": "frota", "difficulty": "normal",
        "desc": "A frota está sempre a crescer. Compra 1 veículo.",
        "objective": {"kind": "counter", "metric": "vehicles_bought", "target": 1, "label": "Comprar 1 veículo"},
        "rewards": {"respect": 40},
    },
    "d_highvalue1": {
        "name": "Golpe do Dia", "type": "diaria", "category": "operacao", "difficulty": "normal",
        "desc": "Vai atrás de algo que valha a pena. Conclui 1 operação de 8.000 €+.",
        "objective": {"kind": "counter", "metric": "high_value_ops", "target": 1, "label": "1 operação de alto valor"},
        "rewards": {"dirty": 2500, "respect": 50},
    },
    "d_ops_total4": {
        "name": "Sem Parar", "type": "diaria", "category": "operacao", "difficulty": "normal",
        "desc": "Nem todas as operações correm bem, mas o trabalho não para. Despacha 4 operações.",
        "objective": {"kind": "counter", "metric": "missions_total", "target": 4, "label": "Despachar 4 operações"},
        "rewards": {"dirty": 2200},
    },
    "d_informador1": {
        "name": "Contacto Fiável", "type": "diaria", "category": "funcionarios", "difficulty": "normal",
        "desc": "Informação vale ouro. Recruta 1 informador.",
        "objective": {"kind": "counter", "metric": "recruits_informador", "target": 1, "label": "Recrutar 1 informador"},
        "rewards": {"dirty": 2000, "respect": 40},
    },

    # ---------- Semanais ----------
    "w_ops15": {
        "name": "Semana em Grande", "type": "semanal", "category": "operacao", "difficulty": "dificil",
        "desc": "Uma semana de trabalho a sério: conclui 15 operações.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 15, "label": "Concluir 15 operações"},
        "rewards": {"clean": 12000, "respect": 250},
    },
    "w_launder20k": {
        "name": "Circuito Financeiro", "type": "semanal", "category": "economia", "difficulty": "dificil",
        "desc": "Faz o dinheiro girar: lava 20.000 € esta semana.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 20000, "label": "Lavar 20.000 €"},
        "rewards": {"clean": 8000},
    },
    "w_recruit2": {
        "name": "Reforços", "type": "semanal", "category": "funcionarios", "difficulty": "normal",
        "desc": "O império precisa de braços. Recruta 2 operacionais esta semana.",
        "objective": {"kind": "counter", "metric": "recruits_hired", "target": 2, "label": "Recrutar 2 operacionais"},
        "rewards": {"dirty": 6000, "respect": 150},
    },
    "w_highvalue2": {
        "name": "Golpes de Luxo", "type": "semanal", "category": "operacao", "difficulty": "elite", "min_level": 2,
        "desc": "Só trabalhos grandes: conclui 2 operações de 8.000 €+ esta semana.",
        "objective": {"kind": "counter", "metric": "high_value_ops", "target": 2, "label": "2 operações de alto valor"},
        "rewards": {"clean": 10000, "respect": 200},
    },
    "w_earn30k": {
        "name": "Semana Lucrativa", "type": "semanal", "category": "economia", "difficulty": "dificil",
        "desc": "Fecha a semana com 30.000 € sujos ganhos em operações.",
        "objective": {"kind": "counter", "metric": "earned_dirty", "target": 30000, "label": "Ganhar 30.000 € sujos"},
        "rewards": {"respect": 300, "heat": -20},
    },
    "w_promote3": {
        "name": "Ascensão na Hierarquia", "type": "semanal", "category": "funcionarios", "difficulty": "dificil",
        "desc": "Constrói a tua cadeia de comando esta semana. Promove 3 operacionais.",
        "objective": {"kind": "counter", "metric": "employees_promoted", "target": 3, "label": "3 promoções"},
        "rewards": {"clean": 9000, "respect": 180},
    },
    "w_train5": {
        "name": "Semana de Formação", "type": "semanal", "category": "funcionarios", "difficulty": "normal",
        "desc": "Investe a sério nas pessoas. Completa 5 formações esta semana.",
        "objective": {"kind": "counter", "metric": "trainings_completed", "target": 5, "label": "Completar 5 formações"},
        "rewards": {"dirty": 7000, "respect": 150},
    },
    "w_repair5": {
        "name": "Revisão Geral", "type": "semanal", "category": "frota", "difficulty": "normal",
        "desc": "Toda a frota precisa de atenção. Repara 5 veículos esta semana.",
        "objective": {"kind": "counter", "metric": "vehicles_repaired", "target": 5, "label": "Reparar 5 veículos"},
        "rewards": {"clean": 5000},
    },
    "w_refuel8": {
        "name": "Semana na Estrada", "type": "semanal", "category": "frota", "difficulty": "facil",
        "desc": "A frota não para. Abastece 8 veículos esta semana.",
        "objective": {"kind": "counter", "metric": "vehicles_refueled", "target": 8, "label": "Abastecer 8 veículos"},
        "rewards": {"dirty": 4000},
    },
    "w_bonus5": {
        "name": "Semana de Reconhecimento", "type": "semanal", "category": "funcionarios", "difficulty": "normal",
        "desc": "Mantém a tropa motivada. Paga 5 bónus esta semana.",
        "objective": {"kind": "counter", "metric": "bonuses_paid", "target": 5, "label": "Pagar 5 bónus"},
        "rewards": {"respect": 150},
    },
    "w_bribe3": {
        "name": "Proteção Semanal", "type": "semanal", "category": "geral", "difficulty": "normal",
        "desc": "Mantém a polícia calma esta semana. Paga 3 subornos.",
        "objective": {"kind": "counter", "metric": "bribes_paid", "target": 3, "label": "Pagar 3 subornos"},
        "rewards": {"dirty": 6000},
    },
    "w_property1": {
        "name": "Expansão Semanal", "type": "semanal", "category": "geral", "difficulty": "normal",
        "desc": "O império cresce todas as semanas. Compra 1 propriedade.",
        "objective": {"kind": "counter", "metric": "properties_bought", "target": 1, "label": "Comprar 1 propriedade"},
        "rewards": {"respect": 120},
    },
    "w_vehicles_bought2": {
        "name": "Renovação da Frota", "type": "semanal", "category": "frota", "difficulty": "normal",
        "desc": "Investe na frota esta semana. Compra 2 veículos.",
        "objective": {"kind": "counter", "metric": "vehicles_bought", "target": 2, "label": "Comprar 2 veículos"},
        "rewards": {"respect": 130},
    },
    "w_ops_assalto8": {
        "name": "Semana de Assaltos", "type": "semanal", "category": "operacao", "difficulty": "dificil",
        "desc": "As crews de assalto não descansam. Conclui 8 operações de assalto esta semana.",
        "objective": {"kind": "counter", "metric": "success_by_category.assalto", "target": 8, "label": "8 operações de assalto"},
        "rewards": {"dirty": 9000, "respect": 180},
    },
    "w_ops_tecnica8": {
        "name": "Semana Técnica", "type": "semanal", "category": "operacao", "difficulty": "dificil", "min_level": 2,
        "desc": "Os hackers dominam a semana. Conclui 8 operações técnicas.",
        "objective": {"kind": "counter", "metric": "success_by_category.tecnica", "target": 8, "label": "8 operações técnicas"},
        "rewards": {"dirty": 9500, "respect": 180},
    },

    # ---------- Dinâmicas ----------
    "dyn_fleet": {
        "name": "Reorganizar a Frota", "type": "dinamica", "category": "frota", "difficulty": "normal",
        "desc": "Tens veículos em mau estado. Repara 2 antes que uma fuga corra mal.",
        "objective": {"kind": "counter", "metric": "vehicles_repaired", "target": 2, "label": "Reparar 2 veículos"},
        "trigger": {"kind": "vehicles_damaged", "count": 2, "below": 50},
        "rewards": {"clean": 3000},
    },
    "dyn_launder": {
        "name": "Limpeza Financeira", "type": "dinamica", "category": "economia", "difficulty": "normal",
        "desc": "Tens demasiado dinheiro sujo no cofre — um alvo apetecível. Lava 10.000 €.",
        "objective": {"kind": "counter", "metric": "laundered_total", "target": 10000, "label": "Lavar 10.000 €"},
        "trigger": {"kind": "dirty_above", "amount": 25000},
        "rewards": {"clean": 3000},
    },
    "dyn_fatigue": {
        "name": "Rodar Equipas", "type": "dinamica", "category": "funcionarios", "difficulty": "facil",
        "desc": "Há gente exausta na organização. Manda 2 operacionais descansar.",
        "objective": {"kind": "counter", "metric": "employees_rested", "target": 2, "label": "2 descansos"},
        "trigger": {"kind": "fatigued_employees", "count": 2, "above": 60},
        "rewards": {"respect": 80, "dirty": 1500},
    },
    "dyn_heat": {
        "name": "Baixar a Pressão", "type": "dinamica", "category": "geral", "difficulty": "dificil",
        "desc": "A polícia está em cima de ti. Baixa o calor para menos de 25% — para de operar ou suborna.",
        "objective": {"kind": "state", "metric": "heat_below", "target": 25, "label": "Calor abaixo de 25%", "direction": "lte"},
        "trigger": {"kind": "heat_above", "value": 60},
        "rewards": {"dirty": 4000},
    },
    "dyn_morale": {
        "name": "Manter a Tropa Feliz", "type": "dinamica", "category": "funcionarios", "difficulty": "normal",
        "desc": "A moral da organização está em baixo. Paga 2 bónus aos teus operacionais.",
        "objective": {"kind": "counter", "metric": "bonuses_paid", "target": 2, "label": "Pagar 2 bónus"},
        "trigger": {"kind": "avg_morale_below", "value": 50},
        "rewards": {"respect": 100},
    },

    # ---------- Eventos ----------
    "ev_santo_antonio": {
        "name": "Noite de Santo António", "type": "evento", "category": "operacao", "difficulty": "elite", "duration_s": 2700,
        "desc": "As ruas estão cheias de festa e de carteiras. Conclui 3 operações de influência antes do amanhecer.",
        "objective": {"kind": "counter", "metric": "success_by_category.influencia", "target": 3, "label": "3 operações de influência"},
        "rewards": {"dirty": 8000, "temp_bonus": {"kind": "reward_boost", "pct": 0.15, "duration_s": 1800}},
    },
    "ev_cidade_quente": {
        "name": "Cidade Quente", "type": "evento", "category": "operacao", "difficulty": "dificil", "duration_s": 2700,
        "desc": "Rusgas por toda a Lisboa. Prova que operas mesmo debaixo de pressão: 2 operações concluídas.",
        "objective": {"kind": "counter", "metric": "missions_success", "target": 2, "label": "Concluir 2 operações"},
        "rewards": {"heat": -15, "dirty": 3000},
    },
    "ev_greve": {
        "name": "Greve nos Estivadores", "type": "evento", "category": "operacao", "difficulty": "dificil", "duration_s": 2700,
        "desc": "O porto parou e o contrabando dispara. Conclui 2 operações de logística.",
        "objective": {"kind": "counter", "metric": "success_by_category.logistica", "target": 2, "label": "2 operações de logística"},
        "rewards": {"dirty": 7000},
    },
    "ev_tempestade": {
        "name": "Tempestade sobre Lisboa", "type": "evento", "category": "operacao", "difficulty": "dificil", "duration_s": 2700, "min_level": 2,
        "desc": "Chuva torrencial esvazia as ruas — perfeito para trabalho técnico. 2 operações técnicas.",
        "objective": {"kind": "counter", "metric": "success_by_category.tecnica", "target": 2, "label": "2 operações técnicas"},
        "rewards": {"clean": 5000},
    },

    # ---------- Decisões ----------
    "dec_informador": {
        "name": "O Informador", "type": "decisao", "category": "geral", "difficulty": "normal", "min_level": 2,
        "desc": "Um informador quer vender dados sobre as patrulhas da polícia. Como respondes?",
        "objective": {"kind": "state", "metric": "level_at_least", "target": 1, "label": "Tomar uma decisão"},
        "rewards": {},
        "options": {
            "pagar": {"label": "Pagar 3.000 €", "cost_clean": 3000, "effects": {"heat": -20},
                      "outcome": "Os dados valeram cada cêntimo. As patrulhas evitaram-te durante horas (-20 calor)."},
            "ameacar": {"label": "Ameaçar", "random": [
                {"p": 0.5, "effects": {"heat": -10}, "outcome": "O informador cedeu e entregou os dados de borla (-10 calor)."},
                {"p": 0.5, "effects": {"heat": 8}, "outcome": "O informador fugiu direto para a polícia (+8 calor)."},
            ]},
            "ignorar": {"label": "Ignorar", "effects": {},
                        "outcome": "Deixaste passar a oportunidade. Sem consequências."},
            "eliminar": {"label": "Eliminar o contacto", "effects": {"heat": 6, "respect": 60},
                         "outcome": "A mensagem foi enviada às ruas (+60 respeito), mas a polícia reparou (+6 calor)."},
        },
    },
    "dec_policia": {
        "name": "O Polícia Corrupto", "type": "decisao", "category": "geral", "difficulty": "dificil", "min_level": 2,
        "desc": "Um inspetor corrupto oferece proteção... por um preço. O que fazes?",
        "objective": {"kind": "state", "metric": "level_at_least", "target": 1, "label": "Tomar uma decisão"},
        "rewards": {},
        "options": {
            "pagar": {"label": "Pagar 5.000 €", "cost_clean": 5000, "effects": {"heat": -30},
                      "outcome": "O inspetor desviou as investigações (-30 calor)."},
            "recusar": {"label": "Recusar", "effects": {"heat": 5, "respect": 40},
                        "outcome": "As ruas respeitam quem não se verga (+40 respeito), mas fizeste um inimigo (+5 calor)."},
            "negociar": {"label": "Negociar", "random": [
                {"p": 0.5, "effects": {"heat": -15}, "outcome": "Conseguiste metade da proteção por nada (-15 calor)."},
                {"p": 0.5, "effects": {"heat": 8}, "outcome": "O inspetor sentiu-se insultado (+8 calor)."},
            ]},
        },
    },
}

QUEST_ORDER = {k: i for i, k in enumerate(QUEST_DEFS)}

DAILY_POOL = ["d_ops3", "d_launder3k", "d_refuel", "d_train1", "d_rest1",
              "d_ops_assalto", "d_ops_logistica", "d_ops_tecnica", "d_ops_influencia",
              "d_ops5", "d_refuel2", "d_repair1", "d_recruit1", "d_promote1", "d_bonus1",
              "d_bribe1", "d_launder5k", "d_earn6k", "d_rest2", "d_train2", "d_property1",
              "d_ops_assalto_grande", "d_ops_logistica_grande", "d_ops_tecnica_grande",
              "d_ops_influencia_grande", "d_vehicles_bought1", "d_highvalue1", "d_ops_total4",
              "d_informador1"]
WEEKLY_POOL = ["w_ops15", "w_launder20k", "w_recruit2", "w_highvalue2", "w_earn30k",
              "w_promote3", "w_train5", "w_repair5", "w_refuel8", "w_bonus5",
              "w_bribe3", "w_property1", "w_vehicles_bought2", "w_ops_assalto8", "w_ops_tecnica8"]
DYNAMIC_KEYS = ["dyn_fleet", "dyn_launder", "dyn_fatigue", "dyn_heat", "dyn_morale"]
EVENT_KEYS = ["ev_santo_antonio", "ev_cidade_quente", "ev_greve", "ev_tempestade"]
DECISION_KEYS = ["dec_informador", "dec_policia"]
