"""Sistema de missões (quests) — SSS v3.

O cérebro das missões: recompensas dinâmicas (nível × dificuldade × tier
adaptativo × série diária × execução rápida), momentum/tier de desempenho,
seleção inteligente de ofertas (viabilidade + relevância ao estado do jogo +
anti-repetição + variedade), cadeias de consequências das decisões e
triggers dinâmicos ligados à saúde real do império.
"""
import random
from datetime import datetime, timezone, timedelta

from quests_data import (QUEST_DEFS, QUEST_ORDER, DAILY_POOL, WEEKLY_POOL,
                         DYNAMIC_KEYS, EVENT_KEYS, DECISION_KEYS, DIFFICULTY_MULT)


# ---------------- Fórmulas (SSS v3) ----------------

LEVEL_MONEY_SLOPE = 0.10      # +10% por nível; progressão sem inflação exponencial
LEVEL_RESPECT_SLOPE = 0.08    # +8% de respeito por nível acima do 1
TIER_BONUS = 0.08             # +8% por tier adaptativo (0..3)
STREAK_BONUS = 0.04           # +4% por dia de série (diárias/semanais)
STREAK_BONUS_MAX = 0.40       # a série bonifica no máximo +40% (10 dias)
SPEED_BONUS = 0.10            # +10% se concluída na 1.ª metade da janela
QUEST_ECONOMY_MONEY_MULT = 1.35  # acompanha o novo custo de frota/imóveis/TSU
TOTAL_MULT_CAP = 3.0          # trava de segurança da economia

TIER_THRESHOLDS = (25.0, 55.0, 80.0)  # momentum necessário para tier 1/2/3
TIER_LABELS = {0: "Iniciado", 1: "Profissional", 2: "Veterano", 3: "Lenda"}

# Momentum ganho ao reclamar / perdido ao deixar expirar, por tipo de missão.
MOMENTUM_CLAIM = {"diaria": 10.0, "semanal": 25.0, "dinamica": 8.0, "evento": 12.0}
MOMENTUM_EXPIRE = {"diaria": 8.0, "semanal": 12.0, "dinamica": 5.0, "evento": 5.0}

DYNAMIC_COOLDOWN_S = 30 * 60          # uma dinâmica não repete em 30 min
EVENT_REPEAT_WINDOW_S = 6 * 3600      # eventos repetidos em <6h ficam pouco prováveis
OFFER_HISTORY_MAX_AGE_S = 30 * 86400  # poda do histórico de ofertas


def _now():
    return datetime.now(timezone.utc)


def _parse(s):
    return datetime.fromisoformat(s)


async def _event(db, pid, kind, message):
    await db.events.insert_one({"player_id": pid, "kind": kind, "message": message, "ts": _now().isoformat()})


def stat_value(stats, metric):
    cur = stats
    for part in metric.split("."):
        cur = cur.get(part, 0) if isinstance(cur, dict) else 0
    return cur if isinstance(cur, (int, float)) else 0


# ---------------- Desempenho adaptativo (quest_perf) ----------------

def _perf(player):
    perf = player.setdefault("quest_perf", {})
    perf.setdefault("momentum", 0.0)
    perf.setdefault("tier", 0)
    perf.setdefault("claims", 0)
    perf.setdefault("expired", 0)
    return perf


def _tier_for(momentum):
    tier = 0
    for i, th in enumerate(TIER_THRESHOLDS, start=1):
        if momentum >= th:
            tier = i
    return tier


def _bump_momentum(player, delta):
    perf = _perf(player)
    perf["momentum"] = round(max(0.0, min(100.0, perf["momentum"] + delta)), 2)
    perf["tier"] = _tier_for(perf["momentum"])


# ---------------- Série diária (quest_streak) ----------------

def _streak(player):
    s = player.setdefault("quest_streak", {})
    s.setdefault("count", 0)
    s.setdefault("best", 0)
    s.setdefault("last_day", None)
    return s


def _streak_after_claim(player, d, now):
    """Série resultante de reclamar esta missão agora (sem mutar o estado) —
    usada tanto no preview como no cálculo real, para serem consistentes."""
    s = _streak(player)
    if d.get("type") != "diaria":
        return s["count"]
    today = now.date().isoformat()
    if s.get("last_day") == today:
        return s["count"]
    if s.get("last_day") == (now.date() - timedelta(days=1)).isoformat():
        return s["count"] + 1
    return 1


def _register_claim(player, q, d, now):
    """Regista o claim: avança a série (se diária) e o momentum. Muta player."""
    s = _streak(player)
    if d.get("type") == "diaria":
        today = now.date().isoformat()
        if s.get("last_day") != today:
            yesterday = (now.date() - timedelta(days=1)).isoformat()
            s["count"] = s["count"] + 1 if s.get("last_day") == yesterday else 1
            s["last_day"] = today
            s["best"] = max(s.get("best", 0), s["count"])
    perf = _perf(player)
    perf["claims"] = perf.get("claims", 0) + 1
    _bump_momentum(player, MOMENTUM_CLAIM.get(d.get("type"), 4.0))


# ---------------- Recompensas dinâmicas ----------------

def _round_money(v):
    return int(round(v / 25.0) * 25)


def _round_respect(v):
    return int(round(v / 5.0) * 5)


def compute_quest_mult(player, q, d, now, streak_count):
    """Devolve (mult_dinheiro, mult_respeito, etiquetas) da fórmula SSS v3."""
    level = max(1, int(player.get("level", 1)))
    tier = _perf(player)["tier"]
    diff = DIFFICULTY_MULT.get(d.get("difficulty"), 1.0)
    lvl_money = 1 + LEVEL_MONEY_SLOPE * (level - 1)
    lvl_resp = 1 + LEVEL_RESPECT_SLOPE * (level - 1)
    tier_m = 1 + TIER_BONUS * tier
    streak_m = 1.0
    if d.get("type") in ("diaria", "semanal") and streak_count > 0:
        streak_m = 1 + min(STREAK_BONUS_MAX, STREAK_BONUS * streak_count)
    speed_m = 1.0
    if q and q.get("expires_at") and q.get("activated_at"):
        try:
            ref = _parse(q["completed_at"]) if q.get("completed_at") else now
            window = (_parse(q["expires_at"]) - _parse(q["activated_at"])).total_seconds()
            used = (ref - _parse(q["activated_at"])).total_seconds()
            if window > 0 and used <= window * 0.5:
                speed_m = 1 + SPEED_BONUS
        except (ValueError, TypeError):
            pass
    money = min(TOTAL_MULT_CAP, QUEST_ECONOMY_MONEY_MULT * lvl_money * diff * tier_m * streak_m * speed_m)
    respect = min(TOTAL_MULT_CAP, lvl_resp * diff * tier_m)
    labels = []
    if level > 1:
        labels.append(f"nível {level}")
    if diff > 1:
        labels.append(d.get("difficulty", ""))
    if tier > 0:
        labels.append(f"tier {TIER_LABELS[tier]}")
    if streak_m > 1:
        labels.append(f"série {streak_count}d")
    if speed_m > 1:
        labels.append("execução rápida")
    return money, respect, labels


def scale_rewards(base, money_mult, respect_mult):
    """Escala dinheiro/respeito; calor, veículos, recrutas e boosts ficam fixos."""
    rw = dict(base or {})
    if rw.get("dirty"):
        rw["dirty"] = max(int(rw["dirty"]), _round_money(rw["dirty"] * money_mult))
    if rw.get("clean"):
        rw["clean"] = max(int(rw["clean"]), _round_money(rw["clean"] * money_mult))
    if rw.get("respect"):
        rw["respect"] = max(int(rw["respect"]), _round_respect(rw["respect"] * respect_mult))
    return rw


def effective_quest_rewards(player, q, d, now):
    """Recompensas dinâmicas SSS v3 no momento do claim.

    MUTA player (série diária + momentum/tier) — o chamador é responsável por
    persistir quest_streak/quest_perf. Devolve (rewards, nota|None).
    """
    streak_count = _streak_after_claim(player, d, now)
    money_m, resp_m, labels = compute_quest_mult(player, q, d, now, streak_count)
    _register_claim(player, q, d, now)
    rewards = scale_rewards(d.get("rewards", {}), money_m, resp_m)
    note = None
    if labels and any(rewards.get(k) for k in ("dirty", "clean", "respect")):
        note = f"recompensa ×{money_m:.2f} ({', '.join(labels)})"
    return rewards, note


def preview_quest_rewards(player, q, d, now):
    """Versão pura (sem mutações) para o frontend ver o que vai receber."""
    streak_count = _streak_after_claim(player, d, now)
    money_m, resp_m, labels = compute_quest_mult(player, q, d, now, streak_count)
    return scale_rewards(d.get("rewards", {}), money_m, resp_m), money_m, labels


# ---------------- Instâncias e enriquecimento ----------------

def make_instance(pid, key, now, stats, expires_s=None):
    d = QUEST_DEFS[key]
    obj = d["objective"]
    baseline = {}
    if obj["kind"] == "counter":
        baseline[obj["metric"]] = stat_value(stats, obj["metric"])
    exp = d.get("duration_s") or expires_s
    return {
        "player_id": pid, "quest_key": key, "status": "active",
        "progress": 0.0, "target": float(obj["target"]), "baseline": baseline,
        "choice": None, "outcome": None,
        "activated_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=exp)).isoformat() if exp else None,
        "completed_at": None, "claimed_at": None,
    }


def enrich_quest(qd, player=None, now=None):
    d = QUEST_DEFS.get(qd.get("quest_key"), {})
    obj = d.get("objective", {})
    qd.update({
        "name": d.get("name"), "desc": d.get("desc"), "type": d.get("type"),
        "category": d.get("category"), "chapter": d.get("chapter"),
        "difficulty": d.get("difficulty"), "rewards": d.get("rewards", {}),
        "unlocks_text": d.get("unlocks_text"),
        "objective_label": obj.get("label"), "direction": obj.get("direction", "gte"),
        "order": QUEST_ORDER.get(qd.get("quest_key"), 999),
    })
    # Preview das recompensas dinâmicas — o jogador vê o valor real que vai
    # receber (escalado por nível/dificuldade/tier/série), não o valor base.
    if player is not None and d.get("type") not in (None, "decisao") \
            and qd.get("status") in ("active", "completed"):
        rewards, mult, labels = preview_quest_rewards(player, qd, d, now or _now())
        qd["rewards"] = rewards
        qd["reward_mult"] = round(mult, 2)
        if labels:
            qd["mult_note"] = " · ".join(labels)
    if d.get("type") == "decisao":
        # cost_clean incluído para o frontend poder desativar (e pintar de
        # vermelho) opções que o jogador não pode pagar, antes de clicar.
        # As cadeias de consequências ficam escondidas — sem spoilers.
        qd["options"] = {
            k: {"label": o["label"], "cost_clean": o.get("cost_clean", 0)}
            for k, o in d.get("options", {}).items()
        }
    return qd


def locked_principals(existing_keys, level):
    out = []
    for key, d in QUEST_DEFS.items():
        if d["type"] != "principal" or key in existing_keys:
            continue
        out.append(enrich_quest({
            "id": None, "quest_key": key, "status": "locked",
            "progress": 0.0, "target": float(d["objective"]["target"]),
        }))
    return out


# ---------------- Triggers dinâmicos ----------------

def _trigger_met(trigger, player, ctx):
    kind = trigger["kind"]
    if kind == "vehicles_damaged":
        return sum(1 for v in ctx["vehicles"] if v["condition"] < trigger["below"]) >= trigger["count"]
    if kind == "dirty_above":
        return player["dirty_money"] > trigger["amount"]
    if kind == "fatigued_employees":
        return sum(1 for e in ctx["employees"] if e.get("fatigue", 0) > trigger["above"]) >= trigger["count"]
    if kind == "heat_above":
        return player["heat"] >= trigger["value"]
    if kind == "avg_morale_below":
        emps = ctx["employees"]
        return bool(emps) and sum(e.get("morale", 70) for e in emps) / len(emps) < trigger["value"]
    if kind == "fleet_fuel_low":
        low = sum(1 for v in ctx["vehicles"]
                  if (v.get("fuel_l", 0) / max(1.0, v.get("tank_l", 1))) * 100 < trigger["below_pct"])
        return low >= trigger["count"]
    if kind == "dirty_near_cap":
        cap = ctx.get("dirty_cap") or 0
        return cap > 0 and player["dirty_money"] >= cap * trigger["fraction"]
    if kind == "arrested_employees":
        return sum(1 for e in ctx["employees"] if e.get("status") == "arrested") >= trigger["count"]
    return False


async def _state_value(db, player, ctx, metric):
    if metric == "heat_below":
        return player["heat"]
    if metric == "level_at_least":
        return player["level"]
    if metric.startswith("prop_count:"):
        t = metric.split(":", 1)[1]
        return sum(1 for p in ctx["props"] if p["type_key"] == t)
    if metric == "vehicle_count":
        return len(ctx["vehicles"])
    if metric == "property_count":
        return len(ctx["props"])
    if metric == "arrested_count":
        return sum(1 for e in ctx["employees"] if e.get("status") == "arrested")
    if metric == "active_ops":
        return await db.missions.count_documents({
            "player_id": str(player["_id"]), "phase": {"$in": ["en_route", "operating"]},
        })
    return 0


# ---------------- Seleção inteligente de ofertas (o QI) ----------------

def _offer_weight(key, d, player, ctx, tier, history, now, kind):
    """Peso de uma missão candidata: viabilidade (0 = impossível), relevância
    ao estado atual do império, adequação da dificuldade ao tier e
    anti-repetição face ao histórico de ofertas."""
    obj = d.get("objective", {})
    metric = obj.get("metric", "")
    vehicles = ctx.get("vehicles", [])
    employees = ctx.get("employees", [])
    stats = player.get("stats", {}) or {}
    w = 1.0

    # --- viabilidade: nunca oferecer o impossível ---
    if metric in ("vehicles_refueled", "vehicles_repaired") and not vehicles:
        return 0.0
    if metric in ("trainings_completed", "employees_rested", "employees_promoted",
                  "bonuses_paid") and not employees:
        return 0.0

    # --- relevância: sugerir o que o império precisa agora ---
    if metric == "vehicles_repaired" and any(v.get("condition", 100) < 60 for v in vehicles):
        w *= 2.0
    if metric == "vehicles_refueled" and any(
            (v.get("fuel_l", 0) / max(1.0, v.get("tank_l", 1))) * 100 < 40 for v in vehicles):
        w *= 2.0
    if metric == "employees_rested" and any(e.get("fatigue", 0) > 50 for e in employees):
        w *= 2.0
    if metric == "bonuses_paid" and employees and \
            sum(e.get("morale", 70) for e in employees) / len(employees) < 60:
        w *= 2.0
    if metric == "laundered_total" and player.get("dirty_money", 0) > 15000:
        w *= 1.6
    if metric == "bribes_paid" and player.get("heat", 0) >= 40:
        w *= 2.0
    if metric == "recruits_hired" and len(employees) < 6:
        w *= 1.4
    if metric.startswith("success_by_category."):
        # favorece categorias em que o jogador realmente opera
        cat = metric.split(".", 1)[1]
        done = (stats.get("success_by_category", {}) or {}).get(cat, 0)
        total = max(1, stats.get("missions_success", 0))
        w *= 0.8 + min(0.8, (done / total) * 2.0)
    if metric == "properties_bought" and player.get("clean_money", 0) < 8000:
        w *= 0.5
    if metric == "vehicles_bought" and player.get("clean_money", 0) < 6000:
        w *= 0.5

    # --- dificuldade adequada ao tier adaptativo ---
    ladder = {
        "facil":   (1.6, 1.2, 0.8, 0.6),
        "normal":  (1.0, 1.1, 1.1, 1.0),
        "dificil": (0.5, 0.9, 1.4, 1.6),
        "elite":   (0.3, 0.6, 1.2, 1.6),
    }.get(d.get("difficulty"))
    if ladder:
        w *= ladder[tier]

    # --- anti-repetição: o que saiu há pouco perde prioridade ---
    last = history.get(key)
    if last:
        window = 2 * 86400 if kind == "daily" else 14 * 86400
        try:
            if (now - _parse(last)).total_seconds() < window:
                w *= 0.25
        except (ValueError, TypeError):
            pass
    return w


def _select_offers(pool, count, player, ctx, history, now, kind):
    """Amostragem ponderada sem reposição, com penalização de categorias
    repetidas dentro do mesmo lote (variedade garantida)."""
    tier = _perf(player)["tier"]
    cands = {}
    for k in pool:
        w = _offer_weight(k, QUEST_DEFS[k], player, ctx, tier, history, now, kind)
        if w > 0:
            cands[k] = w
    chosen = []
    while cands and len(chosen) < count:
        total = sum(cands.values())
        r = random.random() * total
        acc = 0.0
        pick = next(iter(cands))
        for k, w in cands.items():
            acc += w
            if r <= acc:
                pick = k
                break
        chosen.append(pick)
        cat = QUEST_DEFS[pick].get("category")
        cands.pop(pick)
        for k in list(cands):
            if QUEST_DEFS[k].get("category") == cat:
                cands[k] *= 0.35
    return chosen


def _record_offer(player, keys, now):
    hist = player.setdefault("quest_offer_history", {})
    iso = now.isoformat()
    for k in keys:
        hist[k] = iso
    cutoff = now - timedelta(seconds=OFFER_HISTORY_MAX_AGE_S)
    for k in list(hist):
        try:
            if _parse(hist[k]) < cutoff:
                del hist[k]
        except (ValueError, TypeError):
            del hist[k]


def _offered_within(player, key, now, window_s):
    last = (player.get("quest_offer_history") or {}).get(key)
    if not last:
        return False
    try:
        return (now - _parse(last)).total_seconds() < window_s
    except (ValueError, TypeError):
        return False


# ---------------- Ciclo principal ----------------

async def process_quests(db, player, ctx):
    now = _now()
    pid = str(player["_id"])
    stats = player.get("stats", {})
    perf = _perf(player)
    history = player.setdefault("quest_offer_history", {})
    quests = await db.quests.find({"player_id": pid}).to_list(400)
    by_key = {}
    for q in quests:
        by_key.setdefault(q["quest_key"], []).append(q)

    new_docs = []

    # missões principais (cadeia narrativa)
    for key, d in QUEST_DEFS.items():
        if d["type"] != "principal" or key in by_key:
            continue
        if player["level"] < d.get("min_level", 1):
            continue
        reqs = d.get("requires", [])
        if all(any(q["status"] == "claimed" for q in by_key.get(r, [])) for r in reqs):
            new_docs.append(make_instance(pid, key, now, stats))

    # diárias — seleção inteligente; tier alto (≥2) ganha um 4.º contrato
    dr = player.get("quests_daily_at")
    if not dr or _parse(dr) <= now:
        unfinished = await db.quests.count_documents(
            {"player_id": pid, "status": "active", "quest_key": {"$in": DAILY_POOL}})
        if dr and unfinished:
            _bump_momentum(player, -min(24.0, MOMENTUM_EXPIRE["diaria"] * unfinished))
            perf["expired"] = perf.get("expired", 0) + unfinished
        await db.quests.update_many(
            {"player_id": pid, "status": "active", "quest_key": {"$in": DAILY_POOL}},
            {"$set": {"status": "expired"}},
        )
        pool = [k for k in DAILY_POOL if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
        count = 3 + (1 if perf["tier"] >= 2 else 0)
        picked = _select_offers(pool, count, player, ctx, history, now, "daily")
        for key in picked:
            new_docs.append(make_instance(pid, key, now, stats, expires_s=86400))
        _record_offer(player, picked, now)
        player["quests_daily_at"] = (now + timedelta(hours=24)).isoformat()
        if dr:
            await _event(db, pid, "system", "Novas missões diárias disponíveis.")

    # semanais — idem; tier máximo (3) ganha um 3.º contrato
    wr = player.get("quests_weekly_at")
    if not wr or _parse(wr) <= now:
        unfinished = await db.quests.count_documents(
            {"player_id": pid, "status": "active", "quest_key": {"$in": WEEKLY_POOL}})
        if wr and unfinished:
            _bump_momentum(player, -min(24.0, MOMENTUM_EXPIRE["semanal"] * unfinished))
            perf["expired"] = perf.get("expired", 0) + unfinished
        await db.quests.update_many(
            {"player_id": pid, "status": "active", "quest_key": {"$in": WEEKLY_POOL}},
            {"$set": {"status": "expired"}},
        )
        pool = [k for k in WEEKLY_POOL if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
        count = 2 + (1 if perf["tier"] >= 3 else 0)
        picked = _select_offers(pool, count, player, ctx, history, now, "weekly")
        for key in picked:
            new_docs.append(make_instance(pid, key, now, stats, expires_s=7 * 86400))
        _record_offer(player, picked, now)
        player["quests_weekly_at"] = (now + timedelta(days=7)).isoformat()
        if wr:
            await _event(db, pid, "system", "Novas missões semanais disponíveis.")

    # dinâmicas (sugeridas pelo estado do jogo, com cooldown anti-spam)
    for key in DYNAMIC_KEYS:
        d = QUEST_DEFS[key]
        if any(q["status"] in ("active", "completed") for q in by_key.get(key, [])):
            continue
        if player["level"] < d.get("min_level", 1):
            continue
        if _offered_within(player, key, now, DYNAMIC_COOLDOWN_S):
            continue
        if _trigger_met(d["trigger"], player, ctx):
            new_docs.append(make_instance(pid, key, now, stats, expires_s=7200))
            _record_offer(player, [key], now)
            await _event(db, pid, "system", f"Missão sugerida: {d['name']} — {d['desc']}")

    # cadeias de consequências (decisões passadas batem à porta)
    chains = player.get("pending_chains") or []
    if chains:
        remaining = []
        for c in chains:
            key = c.get("key")
            d = QUEST_DEFS.get(key)
            if not d:
                continue
            try:
                due = _parse(c.get("at"))
            except (ValueError, TypeError):
                continue
            if due > now:
                remaining.append(c)
                continue
            if any(q["quest_key"] == key and q["status"] == "active" for q in quests):
                continue
            new_docs.append(make_instance(pid, key, now, stats))
            await _event(db, pid, "police", f"CONSEQUÊNCIA: {d['name']} — {d['desc']}")
        player["pending_chains"] = remaining

    # eventos temporários (nunca os chain_only; anti-repetição em <6h)
    active_event = any(q["status"] == "active" and q["quest_key"] in EVENT_KEYS for q in quests)
    if not active_event:
        ne = player.get("next_event_at")
        if not ne:
            player["next_event_at"] = (now + timedelta(minutes=random.randint(5, 20))).isoformat()
        elif _parse(ne) <= now:
            pool = [k for k in EVENT_KEYS if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
            if pool:
                weights = [0.25 if _offered_within(player, k, now, EVENT_REPEAT_WINDOW_S) else 1.0
                           for k in pool]
                key = random.choices(pool, weights=weights, k=1)[0]
                d = QUEST_DEFS[key]
                new_docs.append(make_instance(pid, key, now, stats))
                _record_offer(player, [key], now)
                player["next_event_at"] = (now + timedelta(seconds=d.get("duration_s", 2700))
                                           + timedelta(minutes=random.randint(30, 60))).isoformat()
                await _event(db, pid, "police", f"EVENTO: {d['name']} — {d['desc']}")

    # decisões aleatórias — respeitam min_level e preferem as menos recentes
    minutes = ctx.get("minutes", 0)
    has_decision = any(q["status"] == "active" and q["quest_key"] in DECISION_KEYS for q in quests)
    if not has_decision and player["level"] >= 2 and minutes > 0:
        if random.random() < min(0.2, minutes * 0.02):
            pool = [k for k in DECISION_KEYS if player["level"] >= QUEST_DEFS[k].get("min_level", 1)]
            if pool:
                pool.sort(key=lambda k: history.get(k, ""))
                key = pool[0] if random.random() < 0.7 else random.choice(pool)
                new_docs.append(make_instance(pid, key, now, stats, expires_s=1800))
                _record_offer(player, [key], now)
                await _event(db, pid, "intel", f"DECISÃO: {QUEST_DEFS[key]['name']} — abre o painel de Missões.")

    if new_docs:
        await db.quests.insert_many(new_docs)
        quests.extend(new_docs)

    # progresso e conclusão
    for q in quests:
        if q["status"] != "active":
            continue
        d = QUEST_DEFS.get(q["quest_key"])
        if not d:
            continue
        if q.get("expires_at") and _parse(q["expires_at"]) <= now:
            await db.quests.update_one({"_id": q["_id"]}, {"$set": {"status": "expired"}})
            if d["type"] in ("dinamica", "evento"):
                _bump_momentum(player, -MOMENTUM_EXPIRE[d["type"]])
                perf["expired"] = perf.get("expired", 0) + 1
            continue
        if d["type"] == "decisao":
            continue
        obj = d["objective"]
        if obj["kind"] == "counter":
            cur = stat_value(stats, obj["metric"]) - q.get("baseline", {}).get(obj["metric"], 0)
        else:
            cur = await _state_value(db, player, ctx, obj["metric"])
        done = cur <= obj["target"] if obj.get("direction") == "lte" else cur >= obj["target"]
        sets = {}
        if round(float(cur), 2) != q.get("progress"):
            sets["progress"] = round(float(cur), 2)
        if done:
            sets.update({"status": "completed", "completed_at": now.isoformat()})
            await _event(db, pid, "success", f"Missão concluída: {d['name']} — reclama a recompensa!")
        if sets:
            await db.quests.update_one({"_id": q["_id"]}, {"$set": sets})
