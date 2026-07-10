"""live_ops.py — Guião de operação em direto (SSS).

Gera, no momento do despacho, uma timeline determinística de beats narrativos
(rádio da equipa, marcos da operação) e 0–2 COMPLICAÇÕES dinâmicas com efeito
REAL na chance final (live_chance_delta, aplicado em engine._roll_outcome).
Cada entrada tem um timestamp absoluto — o frontend revela as linhas quando o
relógio do servidor as alcança, sem trabalho extra por tick.

Formato de cada entrada do live_log:
  {"at": iso, "phase": "en_route"|"operating"|"returning",
   "kind": "net"|"radio"|"milestone"|"comp_bad"|"comp_good"|"good"|"bad"|"police",
   "speaker": "CENTRAL"|"LÍDER"|"CONDUTOR"|"VIGIA"|<nome próprio>,
   "text": str, "pct": float (apenas complicações — delta na chance, ex. -0.06)}
"""
import random
from datetime import timedelta

# Limites do efeito acumulado das complicações na chance final.
LIVE_DELTA_MIN = -0.12
LIVE_DELTA_MAX = 0.08
# Probabilidades de rolar complicações (a 2ª só depois da 1ª).
COMPLICATION_1_CHANCE = 0.62
COMPLICATION_2_CHANCE = 0.28
# Peso do risco/calor no viés para complicações negativas.
NEG_BIAS_BASE = 0.45
NEG_BIAS_PER_RISK = 0.06
NEG_BIAS_HEAT_MAX = 0.15

RANK_ORDER = ["recruta", "membro", "especialista", "veterano", "tenente", "chefe_equipa", "braco_direito"]


def _iso(dt):
    return dt.isoformat()


def _first(name):
    return (name or "?").split()[0]


def _entry(at, phase, kind, speaker, text, pct=None):
    e = {"at": _iso(at), "phase": phase, "kind": kind, "speaker": speaker, "text": text}
    if pct is not None:
        e["pct"] = round(pct, 4)
    return e


def _leader_name(members):
    if not members:
        return None
    best = max(members, key=lambda m: RANK_ORDER.index(m.get("rank", "recruta")) if m.get("rank") in RANK_ORDER else 0)
    return _first(best.get("name"))


def _driver_name(members):
    if not members:
        return None
    best = max(members, key=lambda m: (m.get("attrs") or {}).get("conducao", 0))
    return _first(best.get("name"))


def _pick_other(members, exclude):
    pool = [m for m in members if _first(m.get("name")) not in exclude]
    if not pool:
        pool = members
    return _first(random.choice(pool).get("name")) if pool else "EQUIPA"


# ---------------------------------------------------------------------------
# Conteúdo narrativo — viagem
# ---------------------------------------------------------------------------

TRAVEL_FLAVOUR = [
    ("VIGIA", "Duas patrulhas paradas na rotunda — nada connosco. Seguimos."),
    ("LÍDER", "Revisão rápida: entradas, tempos, saídas. Toda a gente sabe o que faz."),
    ("CONDUTOR", "Semáforos a abrir caminho. Alguém lá em cima gosta de nós."),
    ("VIGIA", "Rádio da polícia calmo. Frequências limpas até ao alvo."),
    ("LÍDER", "Telemóveis em silêncio a partir de agora. Só rádio."),
    ("CONDUTOR", "Rota alternativa memorizada, caso a principal feche."),
]

TRAVEL_INCIDENT = {
    "trânsito": ("CONDUTOR", "Trânsito pesado na radial — a compensar pelo corredor do rio."),
    "chuva": ("CONDUTOR", "Chuva miudinha, piso escorregadio. Vou firme mas com calma."),
}

# ---------------------------------------------------------------------------
# Conteúdo narrativo — operação, por categoria
# ---------------------------------------------------------------------------

OP_BEATS = {
    "assalto": [
        ("VIGIA", "Entradas cobertas. Perímetro em silêncio."),
        ("{X}", "Fechadura a ceder... estamos dentro."),
        ("{X}", "Cofre localizado — a trabalhar. Deem-me espaço."),
        ("LÍDER", "Sacos a encher. Ritmo, pessoal — dois minutos no relógio."),
    ],
    "logistica": [
        ("{X}", "Mercadoria confirmada no cais. Está tudo."),
        ("{X}", "Carga a bordo — quase a meio. Sem mirones."),
        ("{X}", "Documentos trocados, selo aplicado. Parece legítimo."),
        ("LÍDER", "Última palete. Amarrar e fechar — saímos limpos."),
    ],
    "tecnica": [
        ("{X}", "Ligação ao terminal estabelecida. A mapear a rede."),
        ("{X}", "Firewall contornada — a extrair os dados."),
        ("{X}", "Transferência a 60%... ninguém desliga nada."),
        ("{X}", "Rasto apagado, logs limpos. Como se nunca cá tivéssemos estado."),
    ],
    "influencia": [
        ("VIGIA", "Contacto avistado. Aproximação calma."),
        ("{X}", "Conversa em curso. Ele está nervoso — bom sinal."),
        ("{X}", "Números em cima da mesa. A pressionar com elegância."),
        ("LÍDER", "Aperto de mão. Negócio fechado — a recolher."),
    ],
    "especial": [
        ("VIGIA", "Perímetro analisado. Plano em execução — fase um."),
        ("{X}", "Fase um concluída sem ruído. A avançar."),
        ("{X}", "Acesso ao núcleo garantido. Isto é grande."),
        ("LÍDER", "Pacote seguro. Preparar extração — como treinámos."),
    ],
}

OP_OPEN = ("LÍDER", "No local. Posições — operação em curso.")
OP_CLOSE = ("LÍDER", "Terminar e sair. Contagem à porta — ninguém fica para trás.")

# ---------------------------------------------------------------------------
# Complicações — (texto, pct_min, pct_max) · pct positivo = ajuda
# ---------------------------------------------------------------------------

COMPLICATIONS_BAD = {
    "generic": [
        ("Patrulha a passar devagar em frente ao alvo — toda a gente quieta.", -0.07, -0.04),
        ("Curioso de telemóvel na esquina. Vigia a acompanhar.", -0.05, -0.03),
        ("Movimento no rádio da polícia — unidades a rondar o setor.", -0.06, -0.03),
        ("Fechadura reforçada. Isto vai custar mais tempo do que o previsto.", -0.06, -0.04),
    ],
    "assalto": [
        ("Segurança extra no turno — não estava nos planos.", -0.08, -0.05),
        ("Possível alarme silencioso. Acelerar tudo.", -0.08, -0.05),
        ("Porta blindada atrás do balcão. Improvisar já.", -0.07, -0.04),
    ],
    "tecnica": [
        ("IDS acordou — tráfego a ser inspecionado. Mascarar assinatura.", -0.08, -0.05),
        ("Encriptação mais dura do que o dossier dizia.", -0.07, -0.04),
        ("Sessão de admin ativa no sistema — alguém está a trabalhar até tarde.", -0.06, -0.04),
    ],
    "logistica": [
        ("Báscula da alfândega ativa esta noite. Rota interna mais lenta.", -0.07, -0.04),
        ("Contentor fora do sítio — a procurar na fila errada.", -0.06, -0.04),
        ("Empilhador bloqueado no corredor B. A desviar à mão.", -0.05, -0.03),
    ],
    "influencia": [
        ("O contacto trouxe companhia inesperada. Dois à esquerda.", -0.07, -0.04),
        ("O preço subiu — ele quer mais. A renegociar com pressa.", -0.06, -0.04),
        ("Alguém conhece a nossa cara. Chapéus baixos, conversa curta.", -0.06, -0.03),
    ],
    "especial": [
        ("Rotação de guardas fora do horário previsto. Recalcular janelas.", -0.08, -0.05),
        ("Sensor de movimento não mapeado no corredor sul.", -0.07, -0.05),
    ],
}

COMPLICATIONS_GOOD = {
    "generic": [
        ("Rua vazia — nem uma alma. A cidade está do nosso lado.", 0.03, 0.05),
        ("Contacto interno confirmou o horário do turno. Janela perfeita.", 0.03, 0.05),
        ("Câmara do quarteirão avariada há uma semana. Sem olhos em cima.", 0.03, 0.06),
    ],
    "assalto": [
        ("Porta de serviço destrancada. Entrada limpa.", 0.04, 0.06),
        ("Guarda a dormir na guarita. Passámos como fantasmas.", 0.04, 0.06),
    ],
    "tecnica": [
        ("Password de admin num post-it. A sério. Acesso direto.", 0.04, 0.07),
        ("Porta lógica esquecida aberta na VPN. Obrigado, estagiário.", 0.04, 0.06),
    ],
    "logistica": [
        ("Estivador conhecido fez vista grossa. Doca lateral livre.", 0.04, 0.06),
        ("Manifesto já vinha adulterado — meio trabalho feito.", 0.03, 0.05),
    ],
    "influencia": [
        ("O alvo já vinha amaciado — alguém falou com ele primeiro.", 0.04, 0.06),
        ("Testemunha conveniente decidiu mudar de rua.", 0.03, 0.05),
    ],
    "especial": [
        ("Planta do edifício batia certo ao centímetro. Sem surpresas.", 0.04, 0.06),
    ],
}


def _pick_complication(category, want_bad):
    pool_map = COMPLICATIONS_BAD if want_bad else COMPLICATIONS_GOOD
    pool = list(pool_map.get("generic", [])) + list(pool_map.get(category, []))
    return random.choice(pool)


def _roll_complications(category, risk, heat):
    """0–2 complicações; risco e calor puxam o viés para o lado negativo.
    Devolve lista [(texto, pct)] com a soma garantida dentro dos limites."""
    count = 0
    if random.random() < COMPLICATION_1_CHANCE:
        count = 1
        if random.random() < COMPLICATION_2_CHANCE:
            count = 2
    picked = []
    if not count:
        return picked
    neg_bias = min(0.9, NEG_BIAS_BASE + NEG_BIAS_PER_RISK * (risk or 3)
                   + NEG_BIAS_HEAT_MAX * max(0.0, min(1.0, (heat or 0) / 100.0)))
    used_texts = set()
    for _ in range(count):
        want_bad = random.random() < neg_bias
        for _attempt in range(6):
            text, lo, hi = _pick_complication(category, want_bad)
            if text not in used_texts:
                break
        used_texts.add(text)
        picked.append((text, random.uniform(lo, hi)))
    total = sum(p for _, p in picked)
    # Escala proporcional para manter o efeito total dentro dos limites — o
    # frontend soma os pct revelados e tem de bater certo com live_chance_delta.
    if total < LIVE_DELTA_MIN:
        scale = LIVE_DELTA_MIN / total
        picked = [(t, p * scale) for t, p in picked]
    elif total > LIVE_DELTA_MAX:
        scale = LIVE_DELTA_MAX / total
        picked = [(t, p * scale) for t, p in picked]
    return picked


# ---------------------------------------------------------------------------
# Guião do despacho — viagem + operação (gerado uma vez, persistido na missão)
# ---------------------------------------------------------------------------

def build_dispatch_script(*, team_name, opp, members, incidents, depart, arrive, finish, heat, has_leader):
    """Constrói o live_log da ida + operação e devolve (entries, chance_delta).

    opp: snapshot da oportunidade (name, district, category, risk).
    incidents: lista de imprevistos de viagem já rolados no dispatch
    ("trânsito"/"chuva") — o guião narra-os em vez de os duplicar."""
    entries = []
    category = opp.get("category", "especial")
    risk = opp.get("risk", 3)
    travel_s = max(1.0, (arrive - depart).total_seconds())
    duration_s = max(1.0, (finish - arrive).total_seconds())
    leader = _leader_name(members) if has_leader else None
    driver = _driver_name(members)

    def who(tag):
        if tag == "LÍDER":
            return leader or "LÍDER"
        if tag == "CONDUTOR":
            return driver or "CONDUTOR"
        if tag == "{X}":
            return _pick_other(members, {leader, driver})
        return tag

    # --- Partida ---
    entries.append(_entry(depart + timedelta(seconds=2), "en_route", "net", "CENTRAL",
                          f"Canal cifrado aberto. {team_name} em rota — alvo: {opp.get('name')} ({opp.get('district')})."))

    # --- Viagem ---
    if travel_s >= 20:
        used = set()
        if incidents:
            inc = incidents[0]
            sp, txt = TRAVEL_INCIDENT.get(inc, ("CONDUTOR", f"Apanhámos {inc} — viagem mais lenta."))
            entries.append(_entry(depart + timedelta(seconds=travel_s * 0.28), "en_route", "radio", who(sp), txt))
        else:
            sp, txt = random.choice(TRAVEL_FLAVOUR)
            used.add(txt)
            entries.append(_entry(depart + timedelta(seconds=travel_s * 0.30), "en_route", "radio", who(sp), txt))
        if travel_s >= 60:
            for _ in range(6):
                sp, txt = random.choice(TRAVEL_FLAVOUR)
                if txt not in used:
                    break
            used.add(txt)
            entries.append(_entry(depart + timedelta(seconds=travel_s * 0.62), "en_route", "radio", who(sp), txt))
        entries.append(_entry(arrive - timedelta(seconds=min(6, travel_s * 0.1)), "en_route", "radio", who("CONDUTOR"),
                              f"A entrar em {opp.get('district')}. Zona de largada à vista."))

    # --- Operação: abertura, beats por categoria, complicações, retirada ---
    sp, txt = OP_OPEN
    entries.append(_entry(arrive + timedelta(seconds=min(4, duration_s * 0.05)), "operating", "milestone", who(sp), txt))

    beats = OP_BEATS.get(category, OP_BEATS["especial"])
    n_beats = 2 if duration_s < 60 else (3 if duration_s < 120 else 4)
    fracs = {2: [0.30, 0.62], 3: [0.22, 0.48, 0.72], 4: [0.16, 0.38, 0.58, 0.78]}[n_beats]
    for i, frac in enumerate(fracs):
        sp, txt = beats[i if n_beats == 4 else (i + (1 if n_beats == 2 else 0)) % len(beats)]
        entries.append(_entry(arrive + timedelta(seconds=duration_s * frac), "operating", "radio", who(sp), txt))

    comps = _roll_complications(category, risk, heat)
    comp_fracs = [0.42, 0.68]
    delta = 0.0
    for i, (text, pct) in enumerate(comps):
        delta += pct
        kind = "comp_good" if pct >= 0 else "comp_bad"
        speaker = who("VIGIA") if pct < 0 else who("{X}")
        entries.append(_entry(arrive + timedelta(seconds=duration_s * comp_fracs[i % 2]), "operating", kind, speaker, text, pct=pct))

    sp, txt = OP_CLOSE
    entries.append(_entry(arrive + timedelta(seconds=duration_s * 0.90), "operating", "milestone", who(sp), txt))

    entries.sort(key=lambda e: e["at"])
    return entries, round(delta, 4)


# ---------------------------------------------------------------------------
# Guião do regresso — construído na transição operating→returning (o desfecho
# e a perseguição só são conhecidos nesse momento)
# ---------------------------------------------------------------------------

def build_return_script(m, finish_dt, return_dt):
    entries = []
    t = m.get("opportunity", {})
    outcome = m.get("outcome")
    return_s = max(1.0, (return_dt - finish_dt).total_seconds())
    leader = "LÍDER" if m.get("has_leader") else "EQUIPA"

    def at(frac, cap=None):
        s = return_s * frac
        if cap is not None:
            s = min(s, cap)
        return finish_dt + timedelta(seconds=s)

    if outcome == "success":
        reward = int(m.get("pending_reward", 0) or 0)
        entries.append(_entry(at(0.04, 6), "returning", "good", leader,
                              f"Feito. Saque connosco — {reward:,} € em jogo. A caminho de casa.".replace(",", " ")))
        if m.get("bonus_loot"):
            entries.append(_entry(at(0.10, 12), "returning", "good", "EQUIPA",
                                  "Havia mais do que o previsto — levamos tudo."))
    elif outcome == "partial":
        frac = int((m.get("partial_fraction") or 0.6) * 100)
        if m.get("clutch_save"):
            entries.append(_entry(at(0.04, 6), "returning", "good", leader,
                                  f"Esteve por um fio — improvisámos e salvámos {frac}% do plano. Saímos com alguma coisa."))
        else:
            entries.append(_entry(at(0.04, 6), "returning", "bad", leader,
                                  f"Não dava — abortámos com o que tínhamos ({frac}% do saque). Metade é melhor que zero."))
    elif outcome == "failure":
        entries.append(_entry(at(0.04, 6), "returning", "bad", leader,
                              "Aborta! Não há condições. Dispersar e voltar — mãos vazias."))
        cause = (m.get("top_negatives") or [None])[0]
        if cause:
            entries.append(_entry(at(0.12, 14), "returning", "bad", "CENTRAL",
                                  f"Análise preliminar: {cause.get('label', 'fator desconhecido')} pesou contra a operação."))
    elif outcome == "police":
        entries.append(_entry(at(0.03, 5), "returning", "police", "VIGIA",
                              "PATRULHA EM CIMA DO ALVO — separar e desaparecer, JÁ!"))
        fine = int(m.get("fine", 0) or 0)
        if fine > 0:
            entries.append(_entry(at(0.14, 16), "returning", "police", "CENTRAL",
                                  f"Interceção confirmada. Custos imediatos: {fine:,} € para abafar o processo.".replace(",", " ")))

    jams = m.get("weapon_jams") or []
    if jams:
        j = jams[0]
        entries.append(_entry(at(0.20, 20), "returning", "bad", "EQUIPA",
                              f"A {j.get('weapon_name', 'arma')} de {j.get('emp_name', '?')} encravou no pior momento. Precisa de bancada."))

    if m.get("chase_active"):
        esc = int((m.get("escape_chance") or 0.5) * 100)
        entries.append(_entry(at(0.18), "returning", "police", "VIGIA", "Sirenes atrás de nós! Temos companhia."))
        entries.append(_entry(at(0.48), "returning", "police", "CONDUTOR",
                              "A cortar por vielas — agarrem-se. Vamos fazê-los perder-nos."))
        entries.append(_entry(at(0.78), "returning", "police", leader,
                              f"Ainda aí estão... última cartada antes da base. Escape estimado: {esc}%."))
    elif outcome in ("success", "partial"):
        entries.append(_entry(at(0.55), "returning", "radio", "VIGIA", "Rota limpa. Ninguém atrás de nós."))

    entries.append(_entry(return_dt - timedelta(seconds=min(6, return_s * 0.08)), "returning", "net", "CENTRAL",
                          "Unidade em aproximação final à base. Portões abertos."))
    entries.sort(key=lambda e: e["at"])
    return entries


def build_recall_script(m, now_dt, return_dt):
    """Guião curto de regresso antecipado (recall) — corta a narrativa futura."""
    return [
        _entry(now_dt + timedelta(seconds=1), "returning", "net", "CENTRAL",
               "Ordem de regresso emitida — abortar aproximação e voltar à base."),
        _entry(now_dt + timedelta(seconds=5), "returning", "radio", "CONDUTOR",
               "Recebido. A inverter — sem completar o objetivo."),
        _entry(return_dt - timedelta(seconds=4), "returning", "net", "CENTRAL",
               "Unidade em aproximação final à base."),
    ]
