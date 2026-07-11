"""live_phrases.py — Banco narrativo partilhado da Operação em Direto (SSS).

Contém as centenas de variantes NÃO específicas de um tipo de missão:
viagem (por período do dia, calor, incidentes), aberturas/fechos da operação,
complicações (por categoria + genéricas) e todo o guião de regresso (desfechos,
perseguição, encravamentos, chegada, recall).

Placeholders suportados: {district}, {team}, {vehicle}, {opp}, {frac}, {reward},
{fine}, {esc}, {cause}, {weapon}, {who}. O live_ops.PhraseDeck faz a formatação
e a anti-repetição por chave estável.

Nota: os pools são listas de tuplos. Nas listas simples (viagem/regresso) cada
item é (speaker, texto). Nas complicações cada item é (texto, pct_min, pct_max).
"""

# ---------------------------------------------------------------------------
# ABERTURA — CENTRAL anuncia a partida (variantes)
# ---------------------------------------------------------------------------
DISPATCH_OPEN = [
    "Canal cifrado aberto. {team} em rota — alvo: {opp} ({district}).",
    "Ligação estabelecida com {team}. Destino {district}, objetivo {opp}.",
    "{team} destacada. Relógio a contar para {opp}, em {district}.",
    "Sinal verde para {team}. A caminho de {opp} — bairro de {district}.",
    "Rede em silêncio para {team}. Missão {opp} arranca agora, {district}.",
    "Central para {team}: rota traçada até {opp}. Boa sorte lá em {district}.",
    "{team} no ar. Alvo bloqueado — {opp}, coração de {district}.",
    "A operação {opp} começou. {team} rumo a {district}, canal seguro.",
]

# ---------------------------------------------------------------------------
# VIAGEM — sabor genérico (independente da hora)
# ---------------------------------------------------------------------------
TRAVEL_FLAVOUR = [
    ("VIGIA", "Duas patrulhas paradas na rotunda — nada connosco. Seguimos."),
    ("LÍDER", "Revisão rápida: entradas, tempos, saídas. Toda a gente sabe o que faz."),
    ("CONDUTOR", "Semáforos a abrir caminho. Alguém lá em cima gosta de nós."),
    ("VIGIA", "Rádio da polícia calmo. Frequências limpas até ao alvo."),
    ("LÍDER", "Telemóveis em silêncio a partir de agora. Só rádio."),
    ("CONDUTOR", "Rota alternativa memorizada, caso a principal feche."),
    ("VIGIA", "Nenhum carro nos segue há vários quarteirões. Estamos sozinhos."),
    ("CONDUTOR", "A {vehicle} está a portar-se. Motor redondo, tanque cheio."),
    ("LÍDER", "Últimas instruções: sem nomes ao rádio, só funções."),
    ("{X}", "Luvas calçadas, ferramentas conferidas. Prontos de trás."),
    ("VIGIA", "Câmara de trânsito na próxima ponte — baixem as cabeças."),
    ("CONDUTOR", "A cortar pelas ruas de trás de {district}. Menos olhos."),
    ("LÍDER", "Se algo correr mal, o ponto de encontro é o de sempre."),
    ("{X}", "Estou a rever a planta uma última vez. Está tudo na cabeça."),
    ("VIGIA", "Scanner da polícia num murmúrio. Noite de pouco movimento."),
    ("CONDUTOR", "Depósito cheio, pneus bons. A {vehicle} não nos deixa ficar mal."),
    ("LÍDER", "Respirem fundo. Entramos frios, saímos mais frios ainda."),
    ("{X}", "Coração aos saltos, mãos firmes. Estou pronto."),
    ("VIGIA", "Zona do alvo sem movimento anormal. O informador não mentiu."),
    ("CONDUTOR", "Marginal livre a esta hora. Ganhámos dois minutos."),
    ("LÍDER", "Confirmem munições e rádios. Do princípio, sem falhas."),
    ("{X}", "Se houver improviso, seguem o meu ombro. Combinado?"),
    ("VIGIA", "Ponte vigiada por câmara única, ângulo morto à direita. Passem por lá."),
    ("CONDUTOR", "A {vehicle} passa por carro de família. Ninguém olha duas vezes."),
]

# VIAGEM — por período do dia (madrugada/manhã/tarde/noite)
TRAVEL_BY_PERIOD = {
    "madrugada": [
        ("CONDUTOR", "Ruas de {district} desertas a esta hora. Só nós e os gatos."),
        ("VIGIA", "Três da manhã — a cidade dorme. A melhor testemunha é nenhuma."),
        ("LÍDER", "Turno da noite da polícia é magro. Contamos com isso."),
        ("{X}", "Céu ainda preto. Saímos antes do primeiro café da cidade."),
        ("CONDUTOR", "Nem um semáforo com trânsito. Voamos até ao alvo."),
        ("VIGIA", "Padeiros a abrir portas ao longe. Fora isso, silêncio total."),
    ],
    "manha": [
        ("CONDUTOR", "Trânsito da manhã disfarça-nos bem. Somos mais um na fila."),
        ("VIGIA", "{district} a acordar. Gente para o trabalho, ninguém repara em nós."),
        ("LÍDER", "Hora de ponta é multidão — e multidão é cobertura."),
        ("{X}", "Cafés cheios, ruas movimentadas. Escondidos à vista de todos."),
        ("CONDUTOR", "Autocarros e carrinhas de entregas por todo o lado. Camuflagem natural."),
        ("VIGIA", "Guardas de trânsito ocupados com o caos matinal. Ótimo para nós."),
    ],
    "tarde": [
        ("CONDUTOR", "Sol alto sobre {district}. A {vehicle} passa despercebida no movimento."),
        ("VIGIA", "Tarde tranquila. As pessoas estão nos empregos, as ruas respiram."),
        ("LÍDER", "Luz do dia obriga a mais cuidado. Nada de pressas."),
        ("{X}", "Esplanadas cheias. Ninguém desconfia de gente à luz do sol."),
        ("CONDUTOR", "Trânsito fluido a esta hora. Rota a correr no tempo previsto."),
        ("VIGIA", "Comércio aberto, movimento normal. Perfeitamente banal."),
    ],
    "noite": [
        ("CONDUTOR", "Anoiteceu sobre {district}. Faróis apagados nas ruas certas."),
        ("VIGIA", "Sombra é nossa amiga. A cidade acende-se e nós apagamo-nos."),
        ("LÍDER", "Noite é o nosso horário. Toda a gente sabe o que fazer no escuro."),
        ("{X}", "Néons a refletir na chuva. Filme bonito para um trabalho feio."),
        ("CONDUTOR", "Vida noturna a mascarar-nos. Mais um carro entre muitos."),
        ("VIGIA", "Bares cheios, olhos toldados. Testemunhas pouco fiáveis, ainda bem."),
    ],
}

# VIAGEM — calor alto (a polícia anda atenta à organização)
TRAVEL_HIGH_HEAT = [
    ("VIGIA", "Muita polícia na rua hoje — andam atrás de nós, não há dúvida."),
    ("LÍDER", "Calor está alto. Máxima discrição, zero improvisos."),
    ("CONDUTOR", "Duas patrulhas na mesma avenida. A desviar para as traseiras."),
    ("VIGIA", "Helicóptero ao longe. Mantenham-se debaixo de coberto sempre que der."),
    ("LÍDER", "Eles estão nervosos com o nome da organização. Não lhes deem motivos."),
    ("CONDUTOR", "Barreira de identificação a norte. Vou por baixo, pelo túnel."),
    ("VIGIA", "Reconheci um carro-patrulha à paisana. Vamos mais devagar e mais fundos."),
    ("LÍDER", "Se nos mandarem parar, ninguém corre. Papéis e sorriso primeiro."),
]

# VIAGEM — incidentes já rolados no dispatch
TRAVEL_INCIDENT = {
    "trânsito": [
        ("CONDUTOR", "Trânsito pesado na radial — a compensar pelo corredor do rio."),
        ("CONDUTOR", "Acidente a bloquear a via rápida. A desviar por dentro de {district}."),
        ("CONDUTOR", "Filas por todo o lado. Vamos chegar, só um pouco mais tarde."),
        ("VIGIA", "Este engarrafamento é chato mas serve — ninguém nos distingue no meio disto."),
    ],
    "chuva": [
        ("CONDUTOR", "Chuva miudinha, piso escorregadio. Vou firme mas com calma."),
        ("CONDUTOR", "Aguaceiro forte sobre {district}. Limpa-vidros no máximo, velocidade no mínimo."),
        ("VIGIA", "A chuva afasta os curiosos das ruas. Menos olhos, mais poças."),
        ("CONDUTOR", "Estradas alagadas nas baixas. A escolher as ruas mais altas."),
    ],
}

# VIAGEM — chegada ao alvo (variantes)
TRAVEL_ARRIVE = [
    ("CONDUTOR", "A entrar em {district}. Zona de largada à vista."),
    ("CONDUTOR", "Chegámos à borda de {district}. A estacionar no ponto cego."),
    ("VIGIA", "Alvo à vista. A {vehicle} fica pronta para arranque rápido."),
    ("LÍDER", "No local. Confirmem posições antes de sair da viatura."),
    ("CONDUTOR", "Parados a cem metros do alvo. Motor a trabalhar, portas destrancadas."),
    ("VIGIA", "Perímetro do alvo em silêncio. Podemos avançar."),
    ("LÍDER", "Última paragem antes do trabalho. Máscaras — a partir de agora é a sério."),
    ("CONDUTOR", "{vehicle} encostada de frente para a saída. Cada segundo conta na volta."),
]

# ---------------------------------------------------------------------------
# OPERAÇÃO — abertura e fecho (variantes)
# ---------------------------------------------------------------------------
OP_OPEN = [
    ("LÍDER", "No local. Posições — operação em curso."),
    ("LÍDER", "Estamos dentro. A partir de agora, silêncio de rádio salvo o essencial."),
    ("LÍDER", "Todos em posição. Começa agora — foco total."),
    ("LÍDER", "Luz verde. Executar o plano ponto por ponto."),
    ("LÍDER", "Perímetro nosso. Iniciar operação — sem heróis."),
    ("LÍDER", "Marca no relógio. A operação {opp} arranca — mexam-se."),
]

OP_OPEN_HIGH_RISK = [
    ("LÍDER", "Isto é de alto risco. Um erro e não há segunda tentativa. A postos."),
    ("LÍDER", "Alvo perigoso. Todos alerta — protejam-se uns aos outros."),
    ("LÍDER", "Sabemos os riscos. Frieza acima de tudo. Iniciar."),
]

OP_CLOSE = [
    ("LÍDER", "Terminar e sair. Contagem à porta — ninguém fica para trás."),
    ("LÍDER", "Concluído. Retirada ordenada, sem correrias."),
    ("LÍDER", "Trabalho feito. Recolher tudo e desaparecer."),
    ("LÍDER", "Está feito. Últimos a sair apagam o rasto."),
    ("LÍDER", "Fechar a operação. Todos para a {vehicle}, já."),
    ("LÍDER", "Objetivo garantido. Saída pela ordem inversa — vamos."),
]

# ---------------------------------------------------------------------------
# COMPLICAÇÕES — (texto, pct_min, pct_max). pct positivo = ajuda.
# ---------------------------------------------------------------------------
COMPLICATIONS_BAD = {
    "generic": [
        ("Patrulha a passar devagar em frente ao alvo — toda a gente quieta.", -0.07, -0.04),
        ("Curioso de telemóvel na esquina. Vigia a acompanhar.", -0.05, -0.03),
        ("Movimento no rádio da polícia — unidades a rondar o setor.", -0.06, -0.03),
        ("Fechadura reforçada. Isto vai custar mais tempo do que o previsto.", -0.06, -0.04),
        ("Um vizinho acendeu a luz e chegou à janela. A congelar.", -0.05, -0.03),
        ("Cão a ladrar sem parar — vai acordar o quarteirão inteiro.", -0.05, -0.03),
        ("O informador enganou-se no horário. Temos menos tempo do que pensávamos.", -0.07, -0.04),
        ("Carro de segurança privada a fazer ronda inesperada.", -0.06, -0.04),
        ("Sinal de rádio a falhar dentro do edifício. Comunicação a meias.", -0.05, -0.03),
        ("Alguém deixou uma porta trancada que devia estar aberta. A improvisar.", -0.06, -0.04),
        ("Sirene ao longe — pode não ser para nós, mas encolhe o estômago.", -0.05, -0.03),
        ("O plano assumia o alvo vazio. Está lá gente a mais.", -0.07, -0.04),
        ("Câmara nova instalada desde o reconhecimento. Não estava no dossier.", -0.06, -0.04),
        ("Tempo a esgotar-se mais depressa do que o previsto. Acelerar tudo.", -0.06, -0.04),
        ("Vizinho insone a fumar à varanda. Olhos onde não queríamos.", -0.05, -0.03),
        ("Falha de energia no bairro — luzes de emergência acesas de repente.", -0.05, -0.03),
    ],
    "assalto": [
        ("Segurança extra no turno — não estava nos planos.", -0.08, -0.05),
        ("Possível alarme silencioso. Acelerar tudo.", -0.08, -0.05),
        ("Porta blindada atrás do balcão. Improvisar já.", -0.07, -0.04),
        ("Cofre com temporizador — só abre daqui a minutos que não temos.", -0.08, -0.05),
        ("Um funcionário escondido acionou o botão de pânico.", -0.08, -0.05),
        ("Grade de segurança extra desceu a meio. A forçar passagem.", -0.07, -0.04),
        ("Cliente inesperado a bater à porta. Toda a gente parada.", -0.06, -0.03),
        ("Notas marcadas na primeira gaveta — a separar depressa.", -0.05, -0.03),
    ],
    "tecnica": [
        ("IDS acordou — tráfego a ser inspecionado. Mascarar assinatura.", -0.08, -0.05),
        ("Encriptação mais dura do que o dossier dizia.", -0.07, -0.04),
        ("Sessão de admin ativa no sistema — alguém está a trabalhar até tarde.", -0.06, -0.04),
        ("Autenticação de dois fatores inesperada. A intercetar o código.", -0.07, -0.04),
        ("Servidor a fazer cópia de segurança — desempenho a cair a pique.", -0.06, -0.04),
        ("Analista de segurança online do outro lado. Jogo de gato e rato.", -0.08, -0.05),
        ("Ligação a cair de dez em dez segundos. A estabilizar o túnel.", -0.06, -0.03),
        ("Honeypot detetado a tempo — quase caímos na armadilha.", -0.07, -0.04),
    ],
    "logistica": [
        ("Báscula da alfândega ativa esta noite. Rota interna mais lenta.", -0.07, -0.04),
        ("Contentor fora do sítio — a procurar na fila errada.", -0.06, -0.04),
        ("Empilhador bloqueado no corredor B. A desviar à mão.", -0.05, -0.03),
        ("Inspeção surpresa no portão. A escolher outra saída.", -0.07, -0.04),
        ("Motorista do camião voltou mais cedo do jantar. Menos tempo.", -0.07, -0.04),
        ("Selo de segurança do reboque não cede. Ferramenta pesada agora.", -0.06, -0.04),
        ("Guarda do porto mudou de posto — o nosso trajeto ficou exposto.", -0.06, -0.04),
        ("Manifesto revisto à última hora. Números não batem certo.", -0.05, -0.03),
    ],
    "influencia": [
        ("O contacto trouxe companhia inesperada. Dois à esquerda.", -0.07, -0.04),
        ("O preço subiu — ele quer mais. A renegociar com pressa.", -0.06, -0.04),
        ("Alguém conhece a nossa cara. Chapéus baixos, conversa curta.", -0.06, -0.03),
        ("O alvo está a gravar a conversa. A cortar para código.", -0.07, -0.04),
        ("Guarda-costas dele ficou desconfiado. Tensão a subir.", -0.07, -0.04),
        ("O nosso contacto está bêbado e a falar alto. A controlar os danos.", -0.06, -0.04),
        ("Testemunha inconveniente sentou-se na mesa ao lado.", -0.05, -0.03),
        ("Ele mudou de ideias a meio. A pressionar sem levantar a voz.", -0.06, -0.04),
    ],
    "especial": [
        ("Rotação de guardas fora do horário previsto. Recalcular janelas.", -0.08, -0.05),
        ("Sensor de movimento não mapeado no corredor sul.", -0.07, -0.05),
        ("Protocolo de segurança elevado sem aviso. Tudo mais apertado.", -0.08, -0.05),
        ("Reforços do alvo a chegar mais cedo. A comprimir o plano.", -0.08, -0.05),
        ("Comunicação com o cliente cortada no pior momento.", -0.06, -0.04),
        ("Um dos nossos hesitou na fase crítica. A recompor a equipa.", -0.07, -0.04),
    ],
}

COMPLICATIONS_GOOD = {
    "generic": [
        ("Rua vazia — nem uma alma. A cidade está do nosso lado.", 0.03, 0.05),
        ("Contacto interno confirmou o horário do turno. Janela perfeita.", 0.03, 0.05),
        ("Câmara do quarteirão avariada há uma semana. Sem olhos em cima.", 0.03, 0.06),
        ("Guarda saiu para fumar mesmo a tempo. Passagem livre.", 0.03, 0.05),
        ("Trânsito parou a favor — o alvo ficou isolado para nós.", 0.03, 0.05),
        ("Apagão de sorte no bairro. Câmaras todas cegas.", 0.04, 0.06),
        ("Alarme já estava desligado por avaria. Presente de aniversário.", 0.04, 0.06),
        ("Vizinhança em festa — barulho tapa qualquer ruído nosso.", 0.03, 0.05),
        ("A chuva afastou toda a gente. Rua só nossa.", 0.03, 0.05),
        ("Reforço nosso apareceu de surpresa e cobriu o flanco fraco.", 0.03, 0.05),
    ],
    "assalto": [
        ("Porta de serviço destrancada. Entrada limpa.", 0.04, 0.06),
        ("Guarda a dormir na guarita. Passámos como fantasmas.", 0.04, 0.06),
        ("Cofre já estava aberto do fecho de caixa. Sorte a rodos.", 0.04, 0.07),
        ("Alarme com bateria fraca — falhou no momento exato.", 0.04, 0.06),
        ("Câmara principal virada para o lado errado. Nem nos apanha.", 0.03, 0.05),
    ],
    "tecnica": [
        ("Password de admin num post-it. A sério. Acesso direto.", 0.04, 0.07),
        ("Porta lógica esquecida aberta na VPN. Obrigado, estagiário.", 0.04, 0.06),
        ("Sistema por atualizar há meses — cheio de buracos a nosso favor.", 0.04, 0.06),
        ("Sessão de admin já aberta e esquecida. Entrámos sem bater.", 0.04, 0.07),
        ("Backups desligados para manutenção. Nada para nos trair.", 0.03, 0.05),
    ],
    "logistica": [
        ("Estivador conhecido fez vista grossa. Doca lateral livre.", 0.04, 0.06),
        ("Manifesto já vinha adulterado — meio trabalho feito.", 0.03, 0.05),
        ("Turno da alfândega reduzido esta noite. Passagem larga.", 0.04, 0.06),
        ("Contentor mesmo à mão, primeiro da fila. Poupámos tempo.", 0.03, 0.05),
        ("Câmara da doca em manutenção. Ponto cego perfeito.", 0.04, 0.06),
    ],
    "influencia": [
        ("O alvo já vinha amaciado — alguém falou com ele primeiro.", 0.04, 0.06),
        ("Testemunha conveniente decidiu mudar de rua.", 0.03, 0.05),
        ("Ele deve mais favores do que pensávamos. Cede fácil.", 0.04, 0.06),
        ("O guarda-costas dele é nosso conhecido. Deu-nos espaço.", 0.04, 0.06),
        ("Ambiente descontraído joga a nosso favor. Ele confia depressa.", 0.03, 0.05),
    ],
    "especial": [
        ("Planta do edifício batia certo ao centímetro. Sem surpresas.", 0.04, 0.06),
        ("Guarda-chave adoeceu — substituto não conhece as rotinas.", 0.04, 0.06),
        ("Sistema de reserva ainda não estava ligado. Falha a nosso favor.", 0.04, 0.06),
        ("O cliente enviou informação de última hora que mudou tudo — para melhor.", 0.04, 0.06),
    ],
}

# ---------------------------------------------------------------------------
# REGRESSO — desfechos (speaker, texto). {reward}, {frac}, {fine}, {cause}.
# ---------------------------------------------------------------------------
RETURN_SUCCESS = [
    ("Feito. Saque connosco — {reward} € em jogo. A caminho de casa.", "good"),
    ("Objetivo cumprido na perfeição. {reward} € a bordo, rumo à base.", "good"),
    ("Trabalho limpo. Levamos {reward} € e nem uma pegada para trás.", "good"),
    ("Como ensaiado — {reward} € na mala e ninguém deu por nada.", "good"),
    ("Correu melhor do que o plano. {reward} € connosco, a regressar.", "good"),
    ("Missão fechada com chave de ouro. {reward} € a caminho de casa.", "good"),
    ("Impecável do início ao fim. {reward} € garantidos, sem sustos.", "good"),
    ("A equipa esteve fina. {reward} € no bolso, direção à base.", "good"),
    ("Nem uma dobra no plano. {reward} € recolhidos e a sair limpos.", "good"),
    ("Executado ponto por ponto. Levamos {reward} € e a cabeça erguida.", "good"),
    ("Alvo desfeito, saque seguro — {reward} €. Ninguém nos viu partir.", "good"),
    ("Isto é que é um trabalho. {reward} € e um regresso tranquilo.", "good"),
]

RETURN_BONUS = [
    ("Havia mais do que o previsto — levamos tudo."),
    ("Encontrámos um extra que não estava no dossier. Bónus da casa."),
    ("O alvo guardava mais do que dizia. Sorte grande hoje."),
    ("Achado a mais na saída — não íamos deixar ficar."),
    ("Cofre secundário aberto por acaso. Recheio inesperado connosco."),
]

RETURN_PARTIAL_CLUTCH = [
    ("Esteve por um fio — improvisámos e salvámos {frac}% do plano. Saímos com alguma coisa."),
    ("Quase deu para o torto, mas agarrámos {frac}% do saque à justa."),
    ("Reagimos a tempo e safámos {frac}% do previsto. Podia ter sido zero."),
    ("Última hora complicou — ainda assim, {frac}% do golpe vem connosco."),
    ("Salvámos o que deu: {frac}% do plano. Melhor sair vivo com metade."),
]

RETURN_PARTIAL_ABORT = [
    ("Não dava — abortámos com o que tínhamos ({frac}% do saque). Metade é melhor que zero."),
    ("Cortámos a operação a meio. {frac}% do plano é o que salvámos."),
    ("Riscos a subir de mais — saímos com {frac}% e sem mais riscos."),
    ("Preferi abortar a arriscar tudo. {frac}% já vem connosco."),
    ("O plano quebrou-se — recolhemos {frac}% e demos meia-volta."),
]

RETURN_FAILURE = [
    ("Aborta! Não há condições. Dispersar e voltar — mãos vazias."),
    ("Não deu. Retirada imediata, sem levar nada. Vivos é o que conta."),
    ("O trabalho fugiu-nos das mãos. A abortar tudo — regressar já."),
    ("Impossível continuar. Dispersar pelos pontos combinados, sem saque."),
    ("Correu mal desde o início. Cortamos as perdas e voltamos de vazio."),
    ("Sem hipótese hoje. A recuar — melhor sair de mãos a abanar que preso."),
    ("Plano por terra. Toda a gente para trás — não há prémio desta vez."),
    ("Falhámos. Assumo — recolher e voltar à base para repensar tudo."),
    ("Não estava para acontecer. Retirada limpa, prejuízo assumido."),
    ("O alvo escapou-nos. Abortar e desaparecer antes que piore."),
]

RETURN_FAILURE_CAUSE = [
    ("Análise preliminar: {cause} pesou contra a operação."),
    ("A central confirma — {cause} foi o que nos deitou o plano abaixo."),
    ("Ponto fraco identificado: {cause}. Fica a lição para a próxima."),
    ("O relatório aponta {cause} como a razão principal da falha."),
]

RETURN_POLICE = [
    ("PATRULHA EM CIMA DO ALVO — separar e desaparecer, JÁ!"),
    ("Polícia por todo o lado! Dispersar — cada um por si até à base!"),
    ("Fomos denunciados! Larguem tudo e corram — polícia a chegar!"),
    ("Blitz montada à saída! Abortar e sumir pelas traseiras, agora!"),
    ("Sirenes a cercar o quarteirão. Separem-se — não os deixem juntar-nos!"),
    ("Rusga em cima de nós! Deitar fora o que compromete e fugir!"),
    ("Emboscada policial! Ninguém para, ninguém fala — desaparecer!"),
    ("Azuis a fechar as ruas! Plano de fuga de emergência, JÁ!"),
    ("Estamos queimados! Polícia a saltar das carrinhas — mexam-se!"),
    ("Eles sabiam que vínhamos. Dispersar total — falamos depois."),
]

RETURN_FINE = [
    ("Interceção confirmada. Custos imediatos: {fine} € para abafar o processo."),
    ("Apanhados. Vai custar {fine} € a advogados e silêncios."),
    ("Detenções feitas — {fine} € para os tirar lá de dentro e calar bocas."),
    ("Estragos legais: {fine} € para limpar isto antes que suba na hierarquia."),
]

RETURN_JAM = [
    ("A {weapon} de {who} encravou no pior momento. Precisa de bancada."),
    ("A {weapon} falhou a meio — {who} teve de improvisar sem ela."),
    ("Encravamento da {weapon} nas mãos de {who}. Sorte não ter dado para o torto."),
    ("A {weapon} de {who} negou fogo. Vai direta à oficina."),
]

# PERSEGUIÇÃO — 3 fases
CHASE_START = [
    ("Sirenes atrás de nós! Temos companhia."),
    ("Azuis colados ao para-choques! Segurem-se!"),
    ("Patrulha em perseguição! Não largam há dois quarteirões."),
    ("Luzes no retrovisor — estão atrás de nós, confirmado."),
    ("Perseguição ativa! A {vehicle} vai ter de dar tudo."),
    ("Apanharam-nos à saída! A fugir com eles atrás!"),
]

CHASE_MID = [
    ("A cortar por vielas — agarrem-se. Vamos fazê-los perder-nos."),
    ("Contramão na próxima — só por segundos, aguentem!"),
    ("A meter-me no meio do trânsito para os travar. Vá lá..."),
    ("Túnel à frente — assim que sairmos, viramos e apagamos luzes."),
    ("A ziguezaguear pelo mercado. A {vehicle} passa onde eles não passam."),
    ("Dois carros deles agora. A abrir distância pela circular."),
]

CHASE_END = [
    ("Ainda aí estão... última cartada antes da base. Escape estimado: {esc}%."),
    ("Reta final para casa — ou os despistamos agora, ou nunca. {esc}% de escape."),
    ("A garagem está perto. Escape a {esc}% — segurem-se que vou a fundo."),
    ("Última curva antes do esconderijo. {esc}% de safar isto — reza."),
]

RETURN_CLEAN = [
    ("Rota limpa. Ninguém atrás de nós."),
    ("Retrovisor vazio. Fugimos limpos."),
    ("Nem uma sirene. A cidade nem deu por nós."),
    ("Sem perseguição, sem drama. Só estrada até casa."),
    ("Confirmado: não há cauda. Podemos relaxar os ombros."),
    ("Tudo tranquilo atrás. A viagem de regresso é só nossa."),
    ("Zero movimento policial. Saímos como sombras."),
    ("Estamos a salvo. Nem um olhar sobre a {vehicle}."),
]

RETURN_ARRIVAL = [
    ("Unidade em aproximação final à base. Portões abertos."),
    ("A entrar na garagem segura. Missão praticamente encerrada."),
    ("Base à vista. A {vehicle} a recolher — bom trabalho, pessoal."),
    ("Chegámos. Portões a fechar atrás de nós — estamos em casa."),
    ("Aproximação final ao esconderijo. Luzes apagadas, motor ao ralenti."),
    ("De volta ao ninho. Descarregar e descansar — mereceram."),
    ("Unidade em casa. Encerrar canal em breve."),
    ("A recolher à base sem sobressaltos. Portões abertos, café a fazer."),
]

# RECALL — regresso antecipado (variantes)
RECALL_ORDER = [
    ("Ordem de regresso emitida — abortar aproximação e voltar à base."),
    ("Cancelar operação. Voltem já, sem completar o objetivo."),
    ("Mudança de planos — recolher a unidade imediatamente."),
    ("Abortar missão. Regresso à base ordenado pela central."),
]

RECALL_ACK = [
    ("Recebido. A inverter — sem completar o objetivo."),
    ("Entendido. Meia-volta, rumo a casa de mãos a abanar."),
    ("Confirmado o recall. A abortar e regressar já."),
    ("Copiado. A dar meia-volta — deixamos isto para outro dia."),
]
