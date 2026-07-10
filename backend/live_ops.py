"""live_ops.py — Guião de operação em direto (SSS), agora data-driven.

Gera, no momento do despacho, uma timeline determinística de beats narrativos
(rádio da equipa, marcos da operação) e 0–2 COMPLICAÇÕES dinâmicas com efeito
REAL na chance final (live_chance_delta, aplicado em engine._roll_outcome).
Cada entrada tem um timestamp absoluto — o frontend revela as linhas quando o
relógio do servidor as alcança, sem trabalho extra por tick.

Conteúdo narrativo (751+ frases) vive em:
  - live_phrases_beats.TYPE_BEATS  → beats de operação únicos por cada um dos 67 tipos
  - live_phrases.*                 → viagem, complicações, aberturas/fechos, regresso

ANTI-REPETIÇÃO: cada frase tem uma chave estável (ex. "beat:hack:3"). A
organização guarda em player["phrase_memory"] as chaves usadas nas últimas
missões; o PhraseDeck evita-as, preferindo sempre voz nova. Assim, missões
seguidas do mesmo tipo soam diferentes.

Formato de cada entrada do live_log:
  {"at": iso, "phase": "en_route"|"operating"|"returning",
   "kind": "net"|"radio"|"milestone"|"comp_bad"|"comp_good"|"good"|"bad"|"police",
   "speaker": "CENTRAL"|"LÍDER"|"CONDUTOR"|"VIGIA"|<nome próprio>,
   "text": str, "pct": float (apenas complicações — delta na chance)}
"""
import random
from datetime import timedelta

try:
    from zoneinfo import ZoneInfo
    _LISBON = ZoneInfo("Europe/Lisbon")
except Exception:  # pragma: no cover
    _LISBON = None

from live_phrases_beats import TYPE_BEATS
import live_phrases as P

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
# Acima deste calor, a viagem ganha beats de "cidade cheia de polícia".
HIGH_HEAT_THRESHOLD = 55
# Acima deste risco, a abertura da operação pode soar mais tensa.
HIGH_RISK_THRESHOLD = 4
# Memória de anti-repetição — nº de chaves recentes guardadas na organização.
MEMORY_CAP = 280

RANK_ORDER = ["recruta", "membro", "especialista", "veterano", "tenente", "chefe_equipa", "braco_direito"]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _iso(dt):
    return dt.isoformat()


def _first(name):
    return (name or "?").split()[0]


def _period_of(dt):
    """madrugada (0-6) · manha (6-12) · tarde (12-19) · noite (19-24)."""
    try:
        local = dt.astimezone(_LISBON) if _LISBON is not None else dt
        h = local.hour
    except Exception:
        h = getattr(dt, "hour", 12)
    if h < 6:
        return "madrugada"
    if h < 12:
        return "manha"
    if h < 19:
        return "tarde"
    return "noite"


class _SafeCtx(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def _fmt(text, ctx):
    try:
        return text.format_map(_SafeCtx(ctx))
    except Exception:
        return text


def _entry(at, phase, kind, speaker, text, ctx=None, pct=None):
    e = {"at": _iso(at), "phase": phase, "kind": kind, "speaker": speaker,
         "text": _fmt(text, ctx or {})}
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
# PhraseDeck — escolha de frases com memória de anti-repetição
# ---------------------------------------------------------------------------

class PhraseDeck:
    """Escolhe frases evitando as usadas recentemente (memória da organização)
    e as já usadas no guião atual. Regista as chaves escolhidas em `self.used`."""

    def __init__(self, memory=None):
        self.recent = set(memory or [])
        self.used = []          # chaves escolhidas neste guião (para persistir)
        self._used_set = set()  # evita repetir dentro do mesmo guião

    def _register(self, key):
        if key not in self._used_set:
            self._used_set.add(key)
            self.used.append(key)

    def _choose(self, indexed, prefix):
        """indexed: lista de (i, item). Devolve item, preferindo chaves inéditas."""
        if not indexed:
            return None
        keyed = [(f"{prefix}:{i}", item) for i, item in indexed]
        fresh = [(k, it) for k, it in keyed if k not in self.recent and k not in self._used_set]
        if not fresh:
            fresh = [(k, it) for k, it in keyed if k not in self._used_set]
        if not fresh:
            fresh = keyed
        key, item = random.choice(fresh)
        self._register(key)
        return item

    def pick(self, pool, prefix):
        """Escolhe um item de uma lista simples (speaker,text) / string / tuplo."""
        return self._choose(list(enumerate(pool)), prefix)

    def pick_beats(self, type_key, n):
        """Escolhe n beats de operação de um tipo, respeitando o arco narrativo.
        Sequência de stages: n=2 → [1,3]; n=3 → [1,2,3]; n=4 → [1,2,2,3]."""
        beats = TYPE_BEATS.get(type_key) or TYPE_BEATS.get("missao_especial")
        by_stage = {1: [], 2: [], 3: []}
        for i, (stage, sp, txt) in enumerate(beats):
            by_stage.get(stage, by_stage[2]).append((i, (sp, txt)))
        seq = {2: [1, 3], 3: [1, 2, 3], 4: [1, 2, 2, 3]}.get(n, [1, 2, 3])
        out = []
        for stage in seq:
            pool = by_stage[stage] or by_stage[2] or by_stage[1] or by_stage[3]
            item = self._choose(pool, f"beat:{type_key}")
            if item:
                out.append(item)
        return out


def update_memory(memory, used_keys, cap=MEMORY_CAP):
    """Anexa as chaves usadas ao histórico e mantém apenas as `cap` mais recentes."""
    mem = list(memory or [])
    for k in used_keys:
        if k in mem:
            mem.remove(k)
        mem.append(k)
    if len(mem) > cap:
        mem = mem[-cap:]
    return mem


# ---------------------------------------------------------------------------
# Complicações
# ---------------------------------------------------------------------------

def _complication_pool(category, want_bad):
    pool_map = P.COMPLICATIONS_BAD if want_bad else P.COMPLICATIONS_GOOD
    # Ordem determinística (generic primeiro) → chaves estáveis para a memória.
    return list(pool_map.get("generic", [])) + list(pool_map.get(category, []))


def _roll_complications(deck, category, risk, heat):
    """0–2 complicações; risco e calor puxam o viés para o lado negativo.
    Devolve lista [(texto, pct, kind)] com a soma dentro dos limites."""
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
    for _ in range(count):
        want_bad = random.random() < neg_bias
        pool = _complication_pool(category, want_bad)
        prefix = f"c{'bad' if want_bad else 'good'}:{category}"
        chosen = deck.pick(pool, prefix)
        if not chosen:
            continue
        text, lo, hi = chosen
        pct = random.uniform(lo, hi)
        picked.append((text, pct, "comp_bad" if pct < 0 else "comp_good"))
    total = sum(p for _, p, _ in picked)
    if total < LIVE_DELTA_MIN and total != 0:
        scale = LIVE_DELTA_MIN / total
        picked = [(t, p * scale, k) for t, p, k in picked]
    elif total > LIVE_DELTA_MAX and total != 0:
        scale = LIVE_DELTA_MAX / total
        picked = [(t, p * scale, k) for t, p, k in picked]
    return picked


# ---------------------------------------------------------------------------
# Guião do despacho — viagem + operação
# ---------------------------------------------------------------------------

def build_dispatch_script(*, team_name, opp, members, incidents, depart, arrive,
                          finish, heat, has_leader, vehicle_name=None, memory=None):
    """Constrói o live_log da ida + operação.

    Devolve (entries, chance_delta, used_keys).
    opp: snapshot (name, district, category, risk, type_key).
    incidents: imprevistos de viagem já rolados ("trânsito"/"chuva")."""
    deck = PhraseDeck(memory)
    entries = []
    type_key = opp.get("type_key", "missao_especial")
    category = opp.get("category", "especial")
    risk = opp.get("risk", 3)
    travel_s = max(1.0, (arrive - depart).total_seconds())
    duration_s = max(1.0, (finish - arrive).total_seconds())
    leader = _leader_name(members) if has_leader else None
    driver = _driver_name(members)
    period = _period_of(depart)

    ctx = {
        "team": team_name,
        "district": opp.get("district", "Lisboa"),
        "vehicle": vehicle_name or "viatura",
        "opp": opp.get("name", "o alvo"),
    }

    def who(tag):
        if tag == "LÍDER":
            return leader or "LÍDER"
        if tag == "CONDUTOR":
            return driver or "CONDUTOR"
        if tag == "{X}":
            return _pick_other(members, {leader, driver})
        return tag

    def add(at, phase, kind, speaker_tag, text):
        entries.append(_entry(at, phase, kind, who(speaker_tag), text, ctx))

    # --- Partida (CENTRAL) ---
    open_txt = deck.pick(P.DISPATCH_OPEN, "open")
    add(depart + timedelta(seconds=2), "en_route", "net", "CENTRAL", open_txt)

    # --- Viagem ---
    if travel_s >= 20:
        # 1º beat: incidente > calor alto > período do dia > sabor genérico.
        if incidents:
            inc = incidents[0]
            sp, txt = deck.pick(P.TRAVEL_INCIDENT.get(inc, P.TRAVEL_FLAVOUR), f"tinc:{inc}")
            add(depart + timedelta(seconds=travel_s * 0.26), "en_route", "radio", sp, txt)
        elif (heat or 0) >= HIGH_HEAT_THRESHOLD:
            sp, txt = deck.pick(P.TRAVEL_HIGH_HEAT, "theat")
            add(depart + timedelta(seconds=travel_s * 0.28), "en_route", "radio", sp, txt)
        else:
            sp, txt = deck.pick(P.TRAVEL_BY_PERIOD[period], f"tper:{period}")
            add(depart + timedelta(seconds=travel_s * 0.28), "en_route", "radio", sp, txt)

        if travel_s >= 55:
            sp, txt = deck.pick(P.TRAVEL_FLAVOUR, "tflav")
            add(depart + timedelta(seconds=travel_s * 0.55), "en_route", "radio", sp, txt)
        if travel_s >= 110:
            sp, txt = deck.pick(P.TRAVEL_FLAVOUR, "tflav")
            add(depart + timedelta(seconds=travel_s * 0.72), "en_route", "radio", sp, txt)

        sp, txt = deck.pick(P.TRAVEL_ARRIVE, "tarr")
        add(arrive - timedelta(seconds=min(6, travel_s * 0.1)), "en_route", "radio", sp, txt)

    # --- Operação: abertura ---
    if risk >= HIGH_RISK_THRESHOLD and random.random() < 0.6:
        sp, txt = deck.pick(P.OP_OPEN_HIGH_RISK, "openhr")
    else:
        sp, txt = deck.pick(P.OP_OPEN, "openop")
    add(arrive + timedelta(seconds=min(4, duration_s * 0.05)), "operating", "milestone", sp, txt)

    # --- Beats específicos do tipo ---
    n_beats = 2 if duration_s < 60 else (3 if duration_s < 120 else 4)
    fracs = {2: [0.30, 0.62], 3: [0.22, 0.48, 0.72], 4: [0.16, 0.38, 0.58, 0.78]}[n_beats]
    beats = deck.pick_beats(type_key, n_beats)
    for i, (sp, txt) in enumerate(beats):
        frac = fracs[i] if i < len(fracs) else 0.7
        add(arrive + timedelta(seconds=duration_s * frac), "operating", "radio", sp, txt)

    # --- Complicações (efeito real na chance) ---
    comps = _roll_complications(deck, category, risk, heat)
    comp_fracs = [0.42, 0.68]
    delta = 0.0
    for i, (text, pct, kind) in enumerate(comps):
        delta += pct
        speaker = who("VIGIA") if pct < 0 else who("{X}")
        entries.append(_entry(arrive + timedelta(seconds=duration_s * comp_fracs[i % 2]),
                              "operating", kind, speaker, text, ctx, pct=pct))

    # --- Fecho ---
    sp, txt = deck.pick(P.OP_CLOSE, "closeop")
    add(arrive + timedelta(seconds=duration_s * 0.90), "operating", "milestone", sp, txt)

    entries.sort(key=lambda e: e["at"])
    return entries, round(delta, 4), deck.used


# ---------------------------------------------------------------------------
# Guião do regresso — construído na transição operating→returning
# ---------------------------------------------------------------------------

def build_return_script(m, finish_dt, return_dt, memory=None):
    deck = PhraseDeck(memory)
    entries = []
    outcome = m.get("outcome")
    return_s = max(1.0, (return_dt - finish_dt).total_seconds())
    leader = "LÍDER" if m.get("has_leader") else "EQUIPA"
    ctx = {
        "team": m.get("team_name", "a equipa"),
        "district": (m.get("opportunity") or {}).get("district", "Lisboa"),
        "vehicle": m.get("vehicle_name") or "viatura",
        "opp": (m.get("opportunity") or {}).get("name", "o alvo"),
    }

    def at(frac, cap=None):
        s = return_s * frac
        if cap is not None:
            s = min(s, cap)
        return finish_dt + timedelta(seconds=s)

    def money(v):
        return f"{int(v or 0):,}".replace(",", " ")

    if outcome == "success":
        ctx["reward"] = money(m.get("pending_reward", 0))
        txt, kind = deck.pick(P.RETURN_SUCCESS, "rsucc")
        entries.append(_entry(at(0.04, 6), "returning", kind, leader, txt, ctx))
        if m.get("bonus_loot"):
            entries.append(_entry(at(0.10, 12), "returning", "good", "EQUIPA",
                                  deck.pick(P.RETURN_BONUS, "rbonus"), ctx))
    elif outcome == "partial":
        ctx["frac"] = int((m.get("partial_fraction") or 0.6) * 100)
        if m.get("clutch_save"):
            entries.append(_entry(at(0.04, 6), "returning", "good", leader,
                                  deck.pick(P.RETURN_PARTIAL_CLUTCH, "rpclutch"), ctx))
        else:
            entries.append(_entry(at(0.04, 6), "returning", "bad", leader,
                                  deck.pick(P.RETURN_PARTIAL_ABORT, "rpabort"), ctx))
    elif outcome == "failure":
        entries.append(_entry(at(0.04, 6), "returning", "bad", leader,
                              deck.pick(P.RETURN_FAILURE, "rfail"), ctx))
        cause = (m.get("top_negatives") or [None])[0]
        if cause:
            ctx["cause"] = cause.get("label", "fator desconhecido")
            entries.append(_entry(at(0.12, 14), "returning", "bad", "CENTRAL",
                                  deck.pick(P.RETURN_FAILURE_CAUSE, "rfailc"), ctx))
    elif outcome == "police":
        entries.append(_entry(at(0.03, 5), "returning", "police", "VIGIA",
                              deck.pick(P.RETURN_POLICE, "rpol"), ctx))
        fine = int(m.get("fine", 0) or 0)
        if fine > 0:
            ctx["fine"] = money(fine)
            entries.append(_entry(at(0.14, 16), "returning", "police", "CENTRAL",
                                  deck.pick(P.RETURN_FINE, "rfine"), ctx))

    jams = m.get("weapon_jams") or []
    if jams:
        j = jams[0]
        ctx["weapon"] = j.get("weapon_name", "arma")
        ctx["who"] = j.get("emp_name", "um dos nossos")
        entries.append(_entry(at(0.20, 20), "returning", "bad", "EQUIPA",
                              deck.pick(P.RETURN_JAM, "rjam"), ctx))

    if m.get("chase_active"):
        ctx["esc"] = int((m.get("escape_chance") or 0.5) * 100)
        entries.append(_entry(at(0.18), "returning", "police", "VIGIA",
                              deck.pick(P.CHASE_START, "chstart"), ctx))
        entries.append(_entry(at(0.48), "returning", "police", "CONDUTOR",
                              deck.pick(P.CHASE_MID, "chmid"), ctx))
        entries.append(_entry(at(0.78), "returning", "police", leader,
                              deck.pick(P.CHASE_END, "chend"), ctx))
    elif outcome in ("success", "partial"):
        entries.append(_entry(at(0.55), "returning", "radio", "VIGIA",
                              deck.pick(P.RETURN_CLEAN, "rclean"), ctx))

    entries.append(_entry(return_dt - timedelta(seconds=min(6, return_s * 0.08)),
                          "returning", "net", "CENTRAL",
                          deck.pick(P.RETURN_ARRIVAL, "rarr"), ctx))
    entries.sort(key=lambda e: e["at"])
    return entries, deck.used


def build_recall_script(m, now_dt, return_dt, memory=None):
    """Guião curto de regresso antecipado (recall) — corta a narrativa futura."""
    deck = PhraseDeck(memory)
    return_s = max(1.0, (return_dt - now_dt).total_seconds())
    ctx = {
        "team": m.get("team_name", "a equipa"),
        "district": (m.get("opportunity") or {}).get("district", "Lisboa"),
        "vehicle": m.get("vehicle_name") or "viatura",
        "opp": (m.get("opportunity") or {}).get("name", "o alvo"),
    }
    entries = [
        _entry(now_dt + timedelta(seconds=1), "returning", "net", "CENTRAL",
               deck.pick(P.RECALL_ORDER, "recorder"), ctx),
        _entry(now_dt + timedelta(seconds=5), "returning", "radio", "CONDUTOR",
               deck.pick(P.RECALL_ACK, "recack"), ctx),
        _entry(return_dt - timedelta(seconds=min(4, return_s * 0.08)),
               "returning", "net", "CENTRAL",
               deck.pick(P.RETURN_ARRIVAL, "rarr"), ctx),
    ]
    entries.sort(key=lambda e: e["at"])
    return entries, deck.used
