from datetime import timedelta
from uuid import uuid4

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from auth import get_current_user
from db import db
from engine import add_event, dirty_money_cap, now_utc, parse_dt, record_tx
from game_data import VEHICLE_MODELS
from mutation_guard import MutationInput, idempotent
from state_lease import acquire_player_state_lease, release_player_state_lease
from economy_director import guard_reward
from mastermind_data import (
    COMPLICATIONS,
    FENCES,
    HEIST_APPROACHES,
    HEIST_TARGETS,
    MARKET_GOODS,
    cache_signature,
    clamp_chance,
    deterministic_roll,
    market_bucket,
    market_quote,
    mastermind_rank,
)


router = APIRouter(prefix="/api/game/mastermind", tags=["mastermind"])


class TargetInput(MutationInput):
    target_key: str


class HeistCreateInput(MutationInput):
    target_key: str
    team_id: str
    vehicle_id: str
    approach_key: str
    fence_key: str
    crew_cut_pct: int = Field(default=20, ge=10, le=35)


class HeistIdInput(MutationInput):
    heist_id: str


class PrepInput(HeistIdInput):
    prep_key: str


class MarketTradeInput(MutationInput):
    good_key: str
    action: str
    quantity: int = Field(default=1, ge=1, le=20)


class BountyInput(MutationInput):
    action: str
    team_id: str | None = None


class CacheInput(MutationInput):
    district_key: str


def _oid(value, message="Identificador inválido"):
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail=message)


def _future(value, now):
    return bool(value and parse_dt(value) > now)


def _remaining(value, now):
    if not value:
        return 0
    return max(0, int((parse_dt(value) - now).total_seconds()))


async def _player(user, require_hq=True):
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    if require_hq and not player.get("hq"):
        raise HTTPException(status_code=409, detail="Estabelece primeiro o teu Quartel-General")
    return player


def _district_seed(player):
    source = player.get("districts") or []
    if not source:
        hq = player.get("hq") or {}
        source = [{
            "key": "hq",
            "name": hq.get("name") or player.get("region") or "Área do QG",
        }]
    return [
        {
            "key": str(row.get("key") or f"d{index + 1}"),
            "name": row.get("name") or f"Zona {index + 1}",
        }
        for index, row in enumerate(source)
    ]


def _ensure_mastermind(player, now):
    state = dict(player.get("mastermind") or {})
    state.setdefault("version", 1)
    state.setdefault("xp", 0)
    state.setdefault("active_heist", None)
    state.setdefault("target_cooldowns", {})
    state.setdefault("intel", {})
    state.setdefault("history", [])
    state.setdefault("bounty", 0)
    state.setdefault("hunter_cooldown_until", None)
    state.setdefault("caches_collected", [])
    state.setdefault("cache_cooldowns", {})
    state.setdefault("cache_completion_claimed", False)
    market = dict(state.get("market") or {})
    market.setdefault("holdings", {key: 0 for key in MARKET_GOODS})
    market.setdefault("last_bucket", market_bucket(now))
    market.setdefault("raid_log", [])
    for key in MARKET_GOODS:
        market["holdings"].setdefault(key, 0)
    state["market"] = market
    player["mastermind"] = state
    return state


async def _save_mastermind(player, *, heat=None):
    sets = {"mastermind": player["mastermind"]}
    if heat is not None:
        player["heat"] = max(0.0, min(100.0, float(heat)))
        sets["heat"] = player["heat"]
    await db.players.update_one({"_id": player["_id"]}, {"$set": sets})


async def _owned_team(player, team_id):
    team = await db.teams.find_one({
        "_id": _oid(team_id, "Equipa inválida"),
        "player_id": str(player["_id"]),
    })
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    return team


async def _owned_vehicle(player, vehicle_id):
    vehicle = await db.vehicles.find_one({
        "_id": _oid(vehicle_id, "Veículo inválido"),
        "player_id": str(player["_id"]),
    })
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    return vehicle


async def _team_members(player, team, *, require_ready=False):
    query = {
        "player_id": str(player["_id"]),
        "team_id": str(team["_id"]),
    }
    members = await db.employees.find(query).to_list(20)
    if len(members) < 2:
        raise HTTPException(status_code=400, detail="Um grande golpe exige pelo menos dois operacionais")
    if require_ready:
        blocked = [
            member for member in members
            if member.get("status") != "idle" or float(member.get("fatigue", 0)) >= 90
        ]
        if blocked:
            raise HTTPException(
                status_code=400,
                detail="Todos os membros da equipa têm de estar disponíveis e abaixo de 90 de fadiga",
            )
    return members


APPROACH_ATTRS = {
    "silent": ("discricao", "hack", "sangue_frio"),
    "social": ("negociacao", "inteligencia", "discricao"),
    "assault": ("tiro", "forca", "resistencia"),
    "ghost": ("discricao", "hack", "inteligencia"),
    "distributed": ("inteligencia", "sangue_frio", "negociacao"),
}


def _team_score(members, approach_key=None):
    values = []
    for member in members:
        attrs = member.get("attrs") or {}
        preferred = APPROACH_ATTRS.get(approach_key)
        if preferred:
            skill = sum(float(attrs.get(key, 2)) for key in preferred) / len(preferred)
        else:
            strongest = sorted((float(v) for v in attrs.values()), reverse=True)
            skill = sum(strongest[:3]) / max(1, min(3, len(strongest))) if strongest else 2
        morale = float(member.get("morale", 70))
        loyalty = float(member.get("loyalty", 70))
        fatigue = float(member.get("fatigue", 0))
        value = skill / 10
        value *= 0.78 + morale / 500 + loyalty / 1000
        value *= max(0.55, 1 - fatigue / 220)
        values.append(value)
    return max(0.1, min(1.0, sum(values) / max(1, len(values))))


def _vehicle_score(vehicle):
    model = VEHICLE_MODELS.get(vehicle.get("model_key"), {})
    speed = float(vehicle.get("speed", model.get("speed", 10)))
    condition = float(vehicle.get("condition", 0))
    discretion = float(model.get("discretion", 5))
    return max(0.1, min(1.0, speed / 30 * 0.55 + condition / 100 * 0.3 + discretion / 100 * 0.15))


def _portfolio_usage(mastermind):
    holdings = (mastermind.get("market") or {}).get("holdings") or {}
    return sum(int(holdings.get(key, 0) or 0) * cfg["space"] for key, cfg in MARKET_GOODS.items())


async def _portfolio_capacity(player):
    properties = await db.properties.count_documents({"player_id": str(player["_id"])})
    hq_level = int((player.get("hq") or {}).get("level", 1) or 1)
    return 20 + hq_level * 10 + properties * 6


def _threat_payload(bounty):
    value = max(0, int(bounty or 0))
    if value >= 85:
        tier, name = 4, "Caçada total"
    elif value >= 55:
        tier, name = 3, "Esquadrão rival"
    elif value >= 25:
        tier, name = 2, "Rastreio ativo"
    elif value > 0:
        tier, name = 1, "Rumores"
    else:
        tier, name = 0, "Sem contrato"
    return {"value": value, "tier": tier, "name": name, "progress_pct": min(100, value)}


def _public_heist(heist, now):
    if not heist:
        return None
    result = {key: value for key, value in heist.items() if key not in ("preps", "finale")}
    target = HEIST_TARGETS[heist["target_key"]]
    saved_preps = heist.get("preps") or {}
    result["preps"] = []
    for cfg in target["preps"]:
        saved = saved_preps.get(cfg["key"]) or {}
        result["preps"].append({
            **cfg,
            "status": saved.get("status", "available"),
            "attempts": int(saved.get("attempts", 0) or 0),
        })
    required = [item for item in result["preps"] if item["required"]]
    result["readiness"] = {
        "required_done": sum(item["status"] == "complete" for item in required),
        "required_total": len(required),
        "ready": bool(required) and all(item["status"] == "complete" for item in required)
            and not heist.get("current_prep"),
        "team": bool(heist.get("team_id")),
        "vehicle": bool(heist.get("vehicle_id")),
        "approach": bool(heist.get("approach_key")),
        "fence": bool(heist.get("fence_key")),
    }
    current = heist.get("current_prep")
    if current:
        current_public = {k: v for k, v in current.items() if k != "outcome"}
        started = parse_dt(current["started_at"])
        finish = parse_dt(current["finish_at"])
        duration = max(1.0, (finish - started).total_seconds())
        elapsed = max(0.0, min(duration, (now - started).total_seconds()))
        current_public["remaining_s"] = _remaining(current["finish_at"], now)
        current_public["progress_pct"] = round(elapsed / duration * 100, 1)
        result["current_prep"] = current_public
    else:
        result["current_prep"] = None
    finale = heist.get("finale")
    if finale:
        finale_public = {
            key: value for key, value in finale.items()
            if key not in ("outcome", "caught", "member_ids")
        }
        started = parse_dt(finale["started_at"])
        finish = parse_dt(finale["finish_at"])
        duration = max(1.0, (finish - started).total_seconds())
        elapsed = max(0.0, min(duration, (now - started).total_seconds()))
        finale_public["remaining_s"] = _remaining(finale["finish_at"], now)
        finale_public["progress_pct"] = round(elapsed / duration * 100, 1)
        result["finale"] = finale_public
    else:
        result["finale"] = None
    return result


async def _process_mastermind(player, now):
    was_missing = not bool(player.get("mastermind"))
    state = _ensure_mastermind(player, now)
    changed = was_missing
    bounded_bounty = max(0, min(100, int(state.get("bounty", 0) or 0)))
    if bounded_bounty != state.get("bounty"):
        state["bounty"] = bounded_bounty
        changed = True
    active = state.get("active_heist")
    if active:
        prep = active.get("current_prep")
        if prep and prep.get("status") == "running" and not _future(prep.get("finish_at"), now):
            prep["status"] = "ready"
            active["preps"][prep["prep_key"]]["status"] = "ready"
            changed = True
        finale = active.get("finale")
        if finale and finale.get("status") == "running" and not _future(finale.get("finish_at"), now):
            finale["status"] = "ready"
            changed = True

    current_bucket = market_bucket(now)
    market = state["market"]
    if int(market.get("last_bucket", current_bucket)) != current_bucket:
        holdings = market["holdings"]
        usage = _portfolio_usage(state)
        capacity = await _portfolio_capacity(player)
        bounty = int(state.get("bounty", 0) or 0)
        heat = float(player.get("heat", 0) or 0)
        risk = min(0.42, 0.03 + heat * 0.002 + bounty * 0.001 + (usage / max(1, capacity)) * 0.10)
        roll = deterministic_roll(f"{player['_id']}:market-raid:{current_bucket}")
        if usage and roll < risk:
            fraction = 0.15 + deterministic_roll(f"{player['_id']}:market-loss:{current_bucket}") * 0.20
            losses = {}
            for key, quantity in holdings.items():
                quantity = int(quantity or 0)
                if quantity:
                    loss = min(quantity, max(1, int(round(quantity * fraction))))
                    holdings[key] = quantity - loss
                    losses[key] = loss
            if losses:
                state["bounty"] = min(100, bounty + 5)
                market["raid_log"] = [{
                    "id": uuid4().hex,
                    "ts": now.isoformat(),
                    "losses": losses,
                    "risk_pct": round(risk * 100, 1),
                }, *list(market.get("raid_log", []))][:10]
                await add_event(
                    db,
                    str(player["_id"]),
                    "police",
                    "Um armazém do mercado negro foi atacado; parte da carteira foi perdida.",
                )
        market["last_bucket"] = current_bucket
        changed = True

    if changed:
        await _save_mastermind(player)
    return state


async def _snapshot(player, now):
    state = await _process_mastermind(player, now)
    rank = mastermind_rank(state.get("xp", 0))
    capacity = await _portfolio_capacity(player)
    usage = _portfolio_usage(state)
    targets = []
    for key, cfg in HEIST_TARGETS.items():
        intel = (state.get("intel") or {}).get(key)
        intel_active = bool(intel and _future(intel.get("expires_at"), now))
        targets.append({
            "key": key,
            **cfg,
            "preps": [{**prep} for prep in cfg["preps"]],
            "unlocked": rank["level"] >= cfg["unlock_rank"],
            "intel_cost": 1500 * cfg["unlock_rank"],
            "cooldown_remaining_s": _remaining((state.get("target_cooldowns") or {}).get(key), now),
            "intel": intel if intel_active else None,
            "intel_active": intel_active,
        })
    quotes = []
    for key, cfg in MARKET_GOODS.items():
        quotes.append({
            "key": key,
            **cfg,
            **market_quote(str(player["_id"]), key, now),
            "owned": int(state["market"]["holdings"].get(key, 0) or 0),
            "unlocked": rank["level"] >= cfg["unlock_rank"],
        })
    districts = []
    collected = set(state.get("caches_collected") or [])
    for district in _district_seed(player):
        districts.append({
            **district,
            "signature": cache_signature(str(player["_id"]), district["key"]),
            "collected": district["key"] in collected,
            "remaining_s": _remaining((state.get("cache_cooldowns") or {}).get(district["key"]), now),
        })
    return {
        "server_time": now.isoformat(),
        "rank": rank,
        "targets": targets,
        "approaches": [
            {"key": key, **cfg, "unlocked": rank["level"] >= cfg["unlock_rank"]}
            for key, cfg in HEIST_APPROACHES.items()
        ],
        "fences": [
            {"key": key, **cfg, "unlocked": rank["level"] >= cfg["unlock_rank"]}
            for key, cfg in FENCES.items()
        ],
        "active_heist": _public_heist(state.get("active_heist"), now),
        "market": {
            "goods": quotes,
            "capacity": capacity,
            "used": usage,
            "raid_risk_pct": round(min(
                42,
                3 + float(player.get("heat", 0)) * 0.2
                + int(state.get("bounty", 0)) * 0.1
                + usage / max(1, capacity) * 10,
            ), 1),
            "raid_log": list(state["market"].get("raid_log", []))[:10],
        },
        "bounty": {
            **_threat_payload(state.get("bounty", 0)),
            "hunter_cooldown_until": state.get("hunter_cooldown_until"),
            "hunter_remaining_s": _remaining(state.get("hunter_cooldown_until"), now),
            "payoff_cost": max(2000, int(state.get("bounty", 0) or 0) * 180),
        },
        "caches": {
            "districts": districts,
            "collected": len(collected),
            "total": len(districts),
            "completion_claimed": bool(state.get("cache_completion_claimed")),
        },
        "history": list(state.get("history", []))[:20],
        "balances": {
            "clean_money": player.get("clean_money", 0),
            "dirty_money": player.get("dirty_money", 0),
            "heat": player.get("heat", 0),
        },
    }


@router.get("/state")
async def mastermind_state(user: dict = Depends(get_current_user)):
    player = await _player(user, require_hq=False)
    if not player.get("hq"):
        return {"hq_pending": True, "server_time": now_utc().isoformat()}
    now = now_utc()
    owner = f"mastermind-state:{user['_id']}:{now.timestamp():.6f}"
    locked = await acquire_player_state_lease(
        db, player["_id"], owner, ttl_s=120, wait_s=5,
    )
    if not locked:
        raise HTTPException(status_code=409, detail="A organização está a atualizar o estado")
    try:
        return await _snapshot(locked, now)
    finally:
        await release_player_state_lease(db, player["_id"], owner)


@router.post("/heists/intel")
@idempotent("mastermind_intel")
async def scout_target(body: TargetInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    cfg = HEIST_TARGETS.get(body.target_key)
    rank = mastermind_rank(state.get("xp", 0))
    if not cfg or rank["level"] < cfg["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Alvo ainda bloqueado pelo rank Mastermind")
    if int(player.get("level", 1)) < int(cfg.get("min_org_level", 1)):
        raise HTTPException(status_code=400, detail=f"Alvo desbloqueia no nível {cfg.get('min_org_level')} da organização")
    current = (state.get("intel") or {}).get(body.target_key)
    if current and _future(current.get("expires_at"), now):
        raise HTTPException(status_code=400, detail="O dossiê deste alvo ainda está atualizado")
    cost = 1500 * cfg["unlock_rank"]
    approach_keys = [
        key for key, approach in HEIST_APPROACHES.items()
        if rank["level"] >= approach["unlock_rank"]
    ]
    pick = int(deterministic_roll(
        f"{player['_id']}:{body.target_key}:intel:{market_bucket(now)}"
    ) * len(approach_keys))
    recommended = approach_keys[min(len(approach_keys) - 1, pick)]
    intel = {
        "scouted_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=30)).isoformat(),
        "recommended_approach": recommended,
        "recommended_name": HEIST_APPROACHES[recommended]["name"],
        "reward_min": int(cfg["base_reward"] * 0.72),
        "reward_max": int(cfg["base_reward"] * 1.34),
        "risk_note": (
            "Resposta muito armada" if cfg["heat"] >= 30
            else "Rotas sob vigilância" if cfg["heat"] >= 22
            else "Segurança privada variável"
        ),
    }
    intel_path = f"mastermind.intel.{body.target_key}"
    updated = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "clean_money": {"$gte": cost},
            "$or": [
                {intel_path: {"$exists": False}},
                {f"{intel_path}.expires_at": {"$lte": now.isoformat()}},
            ],
        },
        {
            "$inc": {"clean_money": -cost},
            "$set": {intel_path: intel},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(
            status_code=409,
            detail="O dossiê já foi atualizado ou o saldo mudou antes do pedido",
        )
    await record_tx(
        db,
        str(player["_id"]),
        "mastermind_intel",
        -cost,
        "clean",
        updated["clean_money"],
        f"Dossiê: {cfg['name']}",
    )
    await add_event(db, str(player["_id"]), "intel", f"Dossiê atualizado para {cfg['name']}.")
    return {"ok": True, "intel": intel, "cost": cost}


@router.post("/heists/create")
@idempotent("mastermind_create")
async def create_heist(body: HeistCreateInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    if state.get("active_heist"):
        raise HTTPException(status_code=409, detail="Já tens um grande golpe em preparação")
    target = HEIST_TARGETS.get(body.target_key)
    approach = HEIST_APPROACHES.get(body.approach_key)
    fence = FENCES.get(body.fence_key)
    rank = mastermind_rank(state.get("xp", 0))
    if not target or rank["level"] < target["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Alvo ainda bloqueado pelo rank Mastermind")
    if int(player.get("level", 1)) < int(target.get("min_org_level", 1)):
        raise HTTPException(status_code=400, detail=f"Alvo desbloqueia no nível {target.get('min_org_level')} da organização")
    if _future((state.get("target_cooldowns") or {}).get(body.target_key), now):
        raise HTTPException(status_code=400, detail="Este alvo ainda está em alerta")
    if not approach or rank["level"] < approach["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Abordagem indisponível")
    if not fence or rank["level"] < fence["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Recetor indisponível")
    team = await _owned_team(player, body.team_id)
    vehicle = await _owned_vehicle(player, body.vehicle_id)
    if vehicle.get("team_id") and vehicle.get("team_id") != str(team["_id"]):
        raise HTTPException(
            status_code=400,
            detail="O veículo de fuga está atribuído a outra equipa",
        )
    await _team_members(player, team)
    heist = {
        "id": uuid4().hex,
        "target_key": body.target_key,
        "target_name": target["name"],
        "team_id": body.team_id,
        "team_name": team["name"],
        "vehicle_id": body.vehicle_id,
        "vehicle_name": vehicle["name"],
        "approach_key": body.approach_key,
        "approach_name": approach["name"],
        "fence_key": body.fence_key,
        "fence_name": fence["name"],
        "crew_cut_pct": body.crew_cut_pct,
        "phase": "planning",
        "created_at": now.isoformat(),
        "current_prep": None,
        "finale": None,
        "preps": {
            prep["key"]: {"status": "available", "attempts": 0}
            for prep in target["preps"]
        },
    }
    updated = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "$or": [
                {"mastermind.active_heist": None},
                {"mastermind.active_heist": {"$exists": False}},
            ],
        },
        {"$set": {"mastermind.active_heist": heist}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Outro plano ficou ativo antes deste pedido")
    await add_event(db, str(player["_id"]), "intel", f"Planeamento iniciado: {target['name']}.")
    return {"ok": True, "heist": _public_heist(heist, now)}


@router.post("/heists/prep/start")
@idempotent("mastermind_prep_start")
async def start_prep(body: PrepInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    heist = state.get("active_heist")
    if not heist or heist.get("id") != body.heist_id:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    if heist.get("phase") != "planning":
        raise HTTPException(status_code=400, detail="A fase de preparação já terminou")
    if heist.get("current_prep"):
        raise HTTPException(status_code=409, detail="Já existe uma preparação em curso")
    target = HEIST_TARGETS[heist["target_key"]]
    cfg = next((item for item in target["preps"] if item["key"] == body.prep_key), None)
    saved = (heist.get("preps") or {}).get(body.prep_key)
    if not cfg or not saved:
        raise HTTPException(status_code=404, detail="Preparação não encontrada")
    if saved.get("status") == "complete":
        raise HTTPException(status_code=400, detail="Esta preparação já está concluída")

    rank = mastermind_rank(state.get("xp", 0))
    attempts = int(saved.get("attempts", 0) or 0) + 1
    chance = cfg["base_success"] + (rank["level"] - 1) * 0.025
    chance += min(0.04, int(player.get("level", 1)) * 0.004)
    intel = (state.get("intel") or {}).get(heist["target_key"])
    if intel and _future(intel.get("expires_at"), now):
        chance += 0.04
    street = player.get("street") or {}
    if _future(street.get("intel_until"), now):
        chance += 0.06
    chance -= float(player.get("heat", 0)) * 0.0012
    chance += min(0.05, max(0, attempts - 1) * 0.015)
    chance = clamp_chance(chance)
    prep = {
        "id": uuid4().hex,
        "prep_key": body.prep_key,
        "name": cfg["name"],
        "status": "running",
        "chance": chance,
        "outcome": "success" if deterministic_roll(
            f"{player['_id']}:{heist['id']}:{body.prep_key}:{attempts}"
        ) < chance else "failure",
        "started_at": now.isoformat(),
        "finish_at": (now + timedelta(seconds=cfg["duration_s"])).isoformat(),
    }
    status_path = f"mastermind.active_heist.preps.{body.prep_key}"
    updated = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "clean_money": {"$gte": cfg["cost"]},
            "mastermind.active_heist.id": heist["id"],
            "mastermind.active_heist.phase": "planning",
            "mastermind.active_heist.current_prep": None,
            f"{status_path}.status": {"$ne": "complete"},
        },
        {
            "$inc": {"clean_money": -cfg["cost"]},
            "$set": {
                "mastermind.active_heist.current_prep": prep,
                f"{status_path}.status": "running",
                f"{status_path}.attempts": attempts,
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Estado alterado ou dinheiro limpo insuficiente")
    await record_tx(
        db,
        str(player["_id"]),
        "mastermind_prep",
        -cfg["cost"],
        "clean",
        updated["clean_money"],
        f"Preparação: {cfg['name']}",
    )
    await add_event(db, str(player["_id"]), "dispatch", f"Preparação iniciada: {cfg['name']}.")
    return {"ok": True, "prep": {k: v for k, v in prep.items() if k != "outcome"}}


@router.post("/heists/prep/claim")
@idempotent("mastermind_prep_claim")
async def claim_prep(body: PrepInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    heist = state.get("active_heist")
    if not heist or heist.get("id") != body.heist_id:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    prep = heist.get("current_prep")
    if not prep or prep.get("prep_key") != body.prep_key:
        raise HTTPException(status_code=404, detail="Preparação ativa não encontrada")
    if prep.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Preparação ainda em curso durante {_remaining(prep.get('finish_at'), now)}s",
        )
    success = prep["outcome"] == "success"
    status_path = f"mastermind.active_heist.preps.{body.prep_key}.status"
    updated = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "mastermind.active_heist.id": heist["id"],
            "mastermind.active_heist.current_prep.id": prep["id"],
            "mastermind.active_heist.current_prep.status": "ready",
        },
        {
            "$set": {
                "mastermind.active_heist.current_prep": None,
                status_path: "complete" if success else "available",
            },
            **({
                "$inc": {"heat": 3, "mastermind.bounty": 3},
            } if not success else {}),
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Esta preparação já foi recolhida")
    if not success:
        await db.players.update_one(
            {"_id": player["_id"], "heat": {"$gt": 100}},
            {"$set": {"heat": 100}},
        )
    message = (
        f"{prep['name']} concluída; o plano ganhou uma nova vantagem."
        if success
        else f"{prep['name']} falhou; a equipa terá de repetir e chamou atenção."
    )
    await add_event(db, str(player["_id"]), "success" if success else "police", message)
    return {"ok": True, "success": success, "message": message}


@router.post("/heists/launch")
@idempotent("mastermind_launch")
async def launch_heist(body: HeistIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    heist = state.get("active_heist")
    if not heist or heist.get("id") != body.heist_id:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    if heist.get("phase") != "planning" or heist.get("current_prep"):
        raise HTTPException(status_code=400, detail="O plano ainda não está pronto para o golpe")
    target = HEIST_TARGETS[heist["target_key"]]
    required = [prep for prep in target["preps"] if prep["required"]]
    if not all(heist["preps"].get(prep["key"], {}).get("status") == "complete" for prep in required):
        raise HTTPException(status_code=400, detail="Conclui todas as preparações obrigatórias")

    team = await _owned_team(player, heist["team_id"])
    if team.get("status") != "idle":
        raise HTTPException(status_code=400, detail="A equipa selecionada está ocupada")
    if _future(team.get("available_at"), now):
        raise HTTPException(status_code=400, detail="A equipa ainda está a reorganizar-se")
    members = await _team_members(player, team, require_ready=True)
    vehicle = await _owned_vehicle(player, heist["vehicle_id"])
    if vehicle.get("team_id") and vehicle.get("team_id") != str(team["_id"]):
        raise HTTPException(
            status_code=400,
            detail="O veículo de fuga está atribuído a outra equipa",
        )
    if _future(vehicle.get("impounded_until"), now):
        raise HTTPException(status_code=400, detail="O veículo de fuga está apreendido")
    if _future(vehicle.get("refueling_until"), now):
        raise HTTPException(status_code=400, detail="O veículo de fuga está a abastecer")
    transfer = vehicle.get("transfer") or {}
    if _future(transfer.get("ends_at"), now):
        raise HTTPException(status_code=400, detail="O veículo de fuga está em transferência")
    if float(vehicle.get("condition", 0)) < 45:
        raise HTTPException(status_code=400, detail="O veículo de fuga precisa de reparação")
    fuel_cost = 10 + target["unlock_rank"] * 3
    if float(vehicle.get("fuel_l", 0)) < fuel_cost:
        raise HTTPException(status_code=400, detail="Combustível insuficiente para o golpe")

    approach = HEIST_APPROACHES[heist["approach_key"]]
    fence = FENCES[heist["fence_key"]]
    complication_keys = list(COMPLICATIONS)
    comp_index = int(deterministic_roll(
        f"{player['_id']}:{heist['id']}:complication"
    ) * len(complication_keys))
    complication_key = complication_keys[min(len(complication_keys) - 1, comp_index)]
    complication = COMPLICATIONS[complication_key]
    rank = mastermind_rank(state.get("xp", 0))
    team_score = _team_score(members, heist["approach_key"])
    vehicle_score = _vehicle_score(vehicle)
    completed = [
        cfg for cfg in target["preps"]
        if heist["preps"].get(cfg["key"], {}).get("status") == "complete"
    ]
    prep_bonus = sum(cfg["bonus"] for cfg in completed)
    optional_done = sum(not cfg["required"] for cfg in completed)
    crew_cut = int(heist["crew_cut_pct"])
    chance = target["base_success"] + approach["success"] + fence["success"]
    chance += complication["success"] + prep_bonus
    chance += (rank["level"] - 1) * 0.025
    chance += (team_score - 0.45) * 0.22 + (vehicle_score - 0.45) * 0.10
    chance += (crew_cut - 20) * 0.002
    chance -= float(player.get("heat", 0)) * 0.0013
    chance -= int(state.get("bounty", 0)) * 0.0008
    chance = clamp_chance(chance)

    model = VEHICLE_MODELS.get(vehicle.get("model_key"), {})
    seats = int(model.get("seats", 2) or 2)
    loot_capacity = max(0.78, min(
        1.18,
        0.80 + seats * 0.045 + float(vehicle.get("condition", 0)) / 1000,
    ))
    variation = 0.90 + deterministic_roll(
        f"{player['_id']}:{heist['id']}:loot"
    ) * 0.20
    gross_reward = int(
        target["base_reward"]
        * approach["reward_mult"]
        * fence["reward_mult"]
        * complication["reward_mult"]
        * loot_capacity
        * (1 + optional_done * 0.05)
        * variation
    )
    gross_reward = guard_reward(gross_reward, int(player.get("level", 1) or 1), "mastermind")
    net_reward = int(gross_reward * (1 - crew_cut / 100))
    heat_gain = max(1, int(
        target["heat"] * approach["heat_mult"] * fence["heat_mult"] * complication["heat_mult"]
    ))
    duration_s = int(target["duration_s"] * approach["duration_mult"] + fence["delay_s"])
    outcome = "success" if deterministic_roll(
        f"{player['_id']}:{heist['id']}:finale"
    ) < chance else "failure"
    caught_chance = min(
        0.72,
        0.13 + float(player.get("heat", 0)) * 0.004
        + int(state.get("bounty", 0)) * 0.002
        + (0.10 if heist["approach_key"] == "assault" else 0),
    )
    caught = outcome == "failure" and deterministic_roll(
        f"{player['_id']}:{heist['id']}:caught"
    ) < caught_chance
    finale = {
        "id": uuid4().hex,
        "status": "running",
        "chance": chance,
        "gross_reward": gross_reward,
        "net_reward": net_reward,
        "loot_capacity_pct": round(loot_capacity * 100),
        "heat_gain": heat_gain,
        "complication_key": complication_key,
        "complication_name": complication["name"],
        "complication_description": complication["description"],
        "outcome": outcome,
        "caught": caught,
        "member_ids": [str(member["_id"]) for member in members],
        "started_at": now.isoformat(),
        "finish_at": (now + timedelta(seconds=max(45, duration_s))).isoformat(),
    }

    locked = await db.teams.find_one_and_update(
        {
            "_id": team["_id"],
            "player_id": str(player["_id"]),
            "status": "idle",
        },
        {"$set": {"status": "mastermind"}},
        return_document=ReturnDocument.AFTER,
    )
    if not locked:
        raise HTTPException(status_code=409, detail="A equipa ficou ocupada antes do lançamento")
    vehicle_locked = await db.vehicles.find_one_and_update(
        {
            "_id": vehicle["_id"],
            "$or": [
                {"mastermind_heist_id": None},
                {"mastermind_heist_id": {"$exists": False}},
            ],
        },
        {"$set": {"mastermind_heist_id": heist["id"]}},
        return_document=ReturnDocument.AFTER,
    )
    if not vehicle_locked:
        await db.teams.update_one(
            {"_id": team["_id"], "status": "mastermind"},
            {"$set": {"status": "idle"}},
        )
        raise HTTPException(status_code=409, detail="O veículo ficou reservado por outro plano")
    updated = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "mastermind.active_heist.id": heist["id"],
            "mastermind.active_heist.phase": "planning",
        },
        {
            "$set": {
                "mastermind.active_heist.phase": "finale",
                "mastermind.active_heist.finale": finale,
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        await db.teams.update_one({"_id": team["_id"], "status": "mastermind"}, {"$set": {"status": "idle"}})
        await db.vehicles.update_one(
            {"_id": vehicle["_id"], "mastermind_heist_id": heist["id"]},
            {"$set": {"mastermind_heist_id": None}},
        )
        raise HTTPException(status_code=409, detail="O plano foi alterado antes do lançamento")
    await db.employees.update_many(
        {"_id": {"$in": [member["_id"] for member in members]}, "status": "idle"},
        {"$set": {"status": "on_mission"}},
    )
    await db.vehicles.update_one(
        {"_id": vehicle["_id"]},
        {
            "$set": {
                "fuel_l": max(0, round(float(vehicle.get("fuel_l", 0)) - fuel_cost, 2)),
                "condition": max(0, round(float(vehicle.get("condition", 0)) - 4 - target["unlock_rank"], 2)),
            },
            "$inc": {"street_notoriety": 5 + target["unlock_rank"] * 3},
        },
    )
    await add_event(
        db,
        str(player["_id"]),
        "dispatch",
        f"{team['name']} avançou sobre {target['name']} com abordagem {approach['name'].lower()}.",
    )
    return {"ok": True, "finale": _public_heist({**heist, "phase": "finale", "finale": finale}, now)["finale"]}


async def _release_heist_team(player, heist, now, *, success=None):
    team_id = heist.get("team_id")
    if team_id:
        team = await db.teams.find_one({"_id": _oid(team_id), "player_id": str(player["_id"])})
        if team:
            streak = int(team.get("streak", 0) or 0)
            if success is True:
                streak = streak + 1 if streak >= 0 else 1
            elif success is False:
                streak = streak - 1 if streak <= 0 else -1
            await db.teams.update_one(
                {"_id": team["_id"], "status": "mastermind"},
                {
                    "$set": {
                        "status": "idle",
                        "available_at": (now + timedelta(seconds=45)).isoformat(),
                        "streak": streak,
                    },
                    **({"$inc": {"missions_done": 1, "roster_missions": 1}} if success is not None else {}),
                },
            )
    if heist.get("vehicle_id"):
        await db.vehicles.update_one(
            {
                "_id": _oid(heist["vehicle_id"]),
                "player_id": str(player["_id"]),
                "mastermind_heist_id": heist.get("id"),
            },
            {"$set": {"mastermind_heist_id": None}},
        )
    finale = heist.get("finale") or {}
    member_ids = [
        _oid(value, "Operacional inválido")
        for value in finale.get("member_ids", [])
    ]
    if member_ids:
        morale_delta = 0
        loyalty_delta = 0
        fatigue_delta = 8
        if success is True:
            morale_delta = 3 + max(0, int(heist.get("crew_cut_pct", 20)) - 20) * 0.18
            loyalty_delta = 2 + max(0, int(heist.get("crew_cut_pct", 20)) - 18) * 0.12
            fatigue_delta = 16
        elif success is False:
            morale_delta = -8
            loyalty_delta = -3
            fatigue_delta = 24
        await db.employees.update_many(
            {"_id": {"$in": member_ids}, "status": "on_mission"},
            {
                "$set": {"status": "idle", "last_mission_at": now.isoformat()},
                "$inc": {
                    "fatigue": fatigue_delta,
                    "morale": morale_delta,
                    "loyalty": loyalty_delta,
                    **({"xp": 20} if success else {}),
                },
            },
        )
        await db.employees.update_many(
            {"_id": {"$in": member_ids}, "fatigue": {"$gt": 100}},
            {"$set": {"fatigue": 100}},
        )
        await db.employees.update_many(
            {"_id": {"$in": member_ids}, "morale": {"$gt": 100}},
            {"$set": {"morale": 100}},
        )
        await db.employees.update_many(
            {"_id": {"$in": member_ids}, "morale": {"$lt": 0}},
            {"$set": {"morale": 0}},
        )
        await db.employees.update_many(
            {"_id": {"$in": member_ids}, "loyalty": {"$gt": 100}},
            {"$set": {"loyalty": 100}},
        )
        await db.employees.update_many(
            {"_id": {"$in": member_ids}, "loyalty": {"$lt": 0}},
            {"$set": {"loyalty": 0}},
        )
    return member_ids


@router.post("/heists/claim")
@idempotent("mastermind_claim")
async def claim_heist(body: HeistIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    heist = state.get("active_heist")
    if not heist or heist.get("id") != body.heist_id:
        raise HTTPException(status_code=404, detail="Grande golpe não encontrado")
    finale = heist.get("finale")
    if not finale or finale.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail=f"Final ainda em curso durante {_remaining((finale or {}).get('finish_at'), now)}s",
        )
    claimed = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "mastermind.active_heist.id": heist["id"],
            "mastermind.active_heist.finale.id": finale["id"],
            "mastermind.active_heist.finale.status": "ready",
        },
        {"$set": {"mastermind.active_heist": None}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        raise HTTPException(status_code=409, detail="Este resultado já foi recolhido")

    success = finale["outcome"] == "success"
    member_ids = await _release_heist_team(player, heist, now, success=success)
    target = HEIST_TARGETS[heist["target_key"]]
    xp_gain = 80 + target["unlock_rank"] * 35 if success else 18
    heat_gain = finale["heat_gain"] if success else max(4, int(finale["heat_gain"] * 1.35))
    new_heat = min(100.0, float(claimed.get("heat", 0)) + heat_gain)
    bounty_before = int((claimed.get("mastermind") or {}).get("bounty", 0) or 0)
    bounty_gain = target["bounty"] if success else target["bounty"] + (12 if finale.get("caught") else 5)
    new_bounty = min(100, bounty_before + bounty_gain)
    reward = 0
    if success:
        room = max(0, dirty_money_cap(claimed.get("level", 1)) - int(claimed.get("dirty_money", 0)))
        reward = min(int(finale["net_reward"]), room)

    cooldown_until = (now + timedelta(seconds=target["cooldown_s"])).isoformat()
    history = {
        "id": heist["id"],
        "ts": now.isoformat(),
        "target_key": heist["target_key"],
        "target_name": heist["target_name"],
        "team_name": heist["team_name"],
        "vehicle_name": heist["vehicle_name"],
        "approach_name": heist["approach_name"],
        "complication_name": finale["complication_name"],
        "success": success,
        "caught": bool(finale.get("caught")),
        "reward": reward,
        "xp": xp_gain,
    }
    update = {
        "$set": {
            "heat": new_heat,
            "mastermind.bounty": new_bounty,
            f"mastermind.target_cooldowns.{heist['target_key']}": cooldown_until,
        },
        "$inc": {"mastermind.xp": xp_gain},
        "$push": {
            "mastermind.history": {
                "$each": [history],
                "$position": 0,
                "$slice": 20,
            },
        },
    }
    if reward:
        update["$inc"]["dirty_money"] = reward
    await db.players.update_one({"_id": player["_id"]}, update)

    if reward:
        await record_tx(
            db,
            str(player["_id"]),
            "mastermind_heist",
            reward,
            "dirty",
            int(claimed.get("dirty_money", 0)) + reward,
            heist["target_name"],
        )
    if not success and member_ids:
        victim_index = int(deterministic_roll(
            f"{player['_id']}:{heist['id']}:victim"
        ) * len(member_ids))
        victim_id = member_ids[min(len(member_ids) - 1, victim_index)]
        if finale.get("caught"):
            await db.employees.update_one(
                {"_id": victim_id},
                {
                    "$set": {
                        "status": "arrested",
                        "status_until": (now + timedelta(minutes=10)).isoformat(),
                    },
                },
            )
            await db.vehicles.update_one(
                {"_id": _oid(heist["vehicle_id"])},
                {
                    "$set": {"impounded_until": (now + timedelta(minutes=12)).isoformat()},
                    "$inc": {"street_notoriety": 20},
                },
            )
        else:
            await db.employees.update_one(
                {"_id": victim_id},
                {
                    "$set": {
                        "status": "injured",
                        "status_until": (now + timedelta(minutes=6)).isoformat(),
                    },
                },
            )

    if success:
        message = f"{heist['target_name']} concluído: +{reward:,} € sujos e +{xp_gain} XP Mastermind."
        kind = "success"
    elif finale.get("caught"):
        message = f"{heist['target_name']} falhou; um operacional foi detido e o veículo apreendido."
        kind = "police"
    else:
        message = f"{heist['target_name']} falhou; a equipa regressou ferida e sem carga."
        kind = "failure"
    await add_event(db, str(player["_id"]), kind, message)
    return {
        "ok": True,
        "success": success,
        "caught": bool(finale.get("caught")),
        "reward": reward,
        "xp": xp_gain,
        "message": message,
    }


@router.post("/heists/abort")
@idempotent("mastermind_abort")
async def abort_heist(body: HeistIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    heist = state.get("active_heist")
    if not heist or heist.get("id") != body.heist_id:
        raise HTTPException(status_code=404, detail="Plano não encontrado")
    cleared = await db.players.find_one_and_update(
        {"_id": player["_id"], "mastermind.active_heist.id": heist["id"]},
        {
            "$set": {"mastermind.active_heist": None},
            **({
                "$inc": {"heat": 3, "mastermind.bounty": 2},
            } if heist.get("phase") == "finale" else {}),
        },
        return_document=ReturnDocument.AFTER,
    )
    if not cleared:
        raise HTTPException(status_code=409, detail="O plano já foi alterado")
    if heist.get("phase") == "finale":
        await _release_heist_team(player, heist, now)
        await db.players.update_one(
            {"_id": player["_id"], "heat": {"$gt": 100}},
            {"$set": {"heat": 100}},
        )
    await add_event(db, str(player["_id"]), "team", f"Plano cancelado: {heist['target_name']}.")
    return {"ok": True}


@router.post("/market/trade")
@idempotent("mastermind_market_trade")
async def trade_market(body: MarketTradeInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    cfg = MARKET_GOODS.get(body.good_key)
    rank = mastermind_rank(state.get("xp", 0))
    if not cfg or rank["level"] < cfg["unlock_rank"]:
        raise HTTPException(status_code=400, detail="Mercadoria ainda bloqueada")
    quote = market_quote(str(player["_id"]), body.good_key, now)
    total = quote["price"] * body.quantity
    path = f"mastermind.market.holdings.{body.good_key}"
    action = body.action.lower()
    if action == "buy":
        capacity = await _portfolio_capacity(player)
        if _portfolio_usage(state) + cfg["space"] * body.quantity > capacity:
            raise HTTPException(status_code=400, detail="Armazenamento clandestino insuficiente")
        updated = await db.players.find_one_and_update(
            {"_id": player["_id"], "dirty_money": {"$gte": total}},
            {
                "$inc": {
                    "dirty_money": -total,
                    path: body.quantity,
                    "mastermind.bounty": max(1, body.quantity // 5),
                },
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=400, detail="Dinheiro sujo insuficiente")
        amount = -total
        balance = updated["dirty_money"]
        message = f"Compraste {body.quantity}× {cfg['name']}."
    elif action == "sell":
        owned = int(state["market"]["holdings"].get(body.good_key, 0) or 0)
        if owned < body.quantity:
            raise HTTPException(status_code=400, detail="Quantidade insuficiente na carteira")
        room = max(0, dirty_money_cap(player.get("level", 1)) - int(player.get("dirty_money", 0)))
        if room < total:
            raise HTTPException(
                status_code=400,
                detail=f"O cofre só tem espaço para {room:,} €; reduz a quantidade",
            )
        payout = total
        updated = await db.players.find_one_and_update(
            {"_id": player["_id"], path: {"$gte": body.quantity}},
            {
                "$inc": {
                    path: -body.quantity,
                    "dirty_money": payout,
                    "mastermind.bounty": max(1, body.quantity // 8),
                },
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(status_code=409, detail="A carteira mudou antes da venda")
        amount = payout
        balance = updated["dirty_money"]
        total = payout
        message = f"Vendeste {body.quantity}× {cfg['name']}."
    else:
        raise HTTPException(status_code=400, detail="Ação de mercado inválida")
    await record_tx(
        db,
        str(player["_id"]),
        "black_market",
        amount,
        "dirty",
        balance,
        message,
    )
    await add_event(db, str(player["_id"]), "intel", message)
    return {"ok": True, "action": action, "quantity": body.quantity, "total": total, "message": message}


@router.post("/bounty")
@idempotent("mastermind_bounty")
async def resolve_bounty(body: BountyInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    bounty = int(state.get("bounty", 0) or 0)
    if bounty <= 0:
        raise HTTPException(status_code=400, detail="Não existe recompensa rival ativa")
    if body.action == "pay":
        cost = max(2000, bounty * 180)
        remaining = max(0, int(bounty * 0.35))
        updated = await db.players.find_one_and_update(
            {
                "_id": player["_id"],
                "clean_money": {"$gte": cost},
                "mastermind.bounty": bounty,
            },
            {
                "$inc": {"clean_money": -cost},
                "$set": {"mastermind.bounty": remaining},
            },
            return_document=ReturnDocument.AFTER,
        )
        if not updated:
            raise HTTPException(
                status_code=409,
                detail="O saldo ou a recompensa rival mudou antes do pagamento",
            )
        await record_tx(
            db,
            str(player["_id"]),
            "bounty_payoff",
            -cost,
            "clean",
            updated["clean_money"],
            "Compra de silêncio à rede rival",
        )
        message = f"A rede aceitou o pagamento; a recompensa caiu para {remaining}."
        await add_event(db, str(player["_id"]), "intel", message)
        return {"ok": True, "success": True, "remaining": remaining, "cost": cost, "message": message}
    if body.action != "ambush":
        raise HTTPException(status_code=400, detail="Resposta à recompensa inválida")
    if _future(state.get("hunter_cooldown_until"), now):
        raise HTTPException(status_code=400, detail="A contraemboscada ainda está em recarga")
    if not body.team_id:
        raise HTTPException(status_code=400, detail="Escolhe uma equipa para a contraemboscada")
    team = await _owned_team(player, body.team_id)
    if team.get("status") != "idle" or _future(team.get("available_at"), now):
        raise HTTPException(status_code=400, detail="A equipa selecionada não está disponível")
    members = await _team_members(player, team, require_ready=True)
    rank = mastermind_rank(state.get("xp", 0))
    chance = clamp_chance(0.46 + _team_score(members) * 0.26 + rank["level"] * 0.025 - bounty * 0.0015)
    success = deterministic_roll(
        f"{player['_id']}:hunters:{body.team_id}:{market_bucket(now)}"
    ) < chance
    cooldown = (now + timedelta(minutes=10)).isoformat()
    locked = await db.teams.find_one_and_update(
        {
            "_id": team["_id"],
            "player_id": str(player["_id"]),
            "status": "idle",
        },
        {"$set": {"status": "mastermind_hunters"}},
        return_document=ReturnDocument.AFTER,
    )
    if not locked:
        raise HTTPException(status_code=409, detail="A equipa ficou ocupada antes da emboscada")
    reserved = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "$or": [
                {"mastermind.hunter_cooldown_until": None},
                {"mastermind.hunter_cooldown_until": {"$exists": False}},
                {"mastermind.hunter_cooldown_until": {"$lte": now.isoformat()}},
            ],
        },
        {"$set": {"mastermind.hunter_cooldown_until": cooldown}},
        return_document=ReturnDocument.AFTER,
    )
    if not reserved:
        await db.teams.update_one(
            {"_id": team["_id"], "status": "mastermind_hunters"},
            {"$set": {"status": "idle"}},
        )
        raise HTTPException(status_code=409, detail="Outra contraemboscada foi lançada primeiro")
    if success:
        remaining = max(0, int(bounty * 0.45))
        await db.players.update_one(
            {"_id": player["_id"]},
            {
                "$set": {
                    "mastermind.bounty": remaining,
                    "mastermind.hunter_cooldown_until": cooldown,
                },
                "$inc": {"mastermind.xp": 30},
            },
        )
        message = f"{team['name']} desmantelou os perseguidores; recompensa reduzida para {remaining}."
        kind = "success"
    else:
        remaining = min(100, bounty + 10)
        await db.players.update_one(
            {"_id": player["_id"]},
            {
                "$set": {
                    "mastermind.bounty": remaining,
                    "mastermind.hunter_cooldown_until": cooldown,
                    "heat": min(100, float(player.get("heat", 0)) + 8),
                },
            },
        )
        victim_index = int(deterministic_roll(
            f"{player['_id']}:hunters:{body.team_id}:victim:{market_bucket(now)}"
        ) * len(members))
        victim = members[min(len(members) - 1, victim_index)]
        await db.employees.update_one(
            {"_id": victim["_id"]},
            {
                "$set": {
                    "status": "injured",
                    "status_until": (now + timedelta(minutes=5)).isoformat(),
                },
            },
        )
        message = f"A contraemboscada falhou; {victim['name']} ficou ferido."
        kind = "failure"
    await db.teams.update_one(
        {"_id": team["_id"], "status": "mastermind_hunters"},
        {
            "$set": {
                "status": "idle",
                "available_at": (now + timedelta(seconds=30)).isoformat(),
            },
        },
    )
    await add_event(db, str(player["_id"]), kind, message)
    return {
        "ok": True,
        "success": success,
        "remaining": remaining,
        "chance": chance,
        "message": message,
    }


@router.post("/cache/scan")
@idempotent("mastermind_cache_scan")
async def scan_cache(body: CacheInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    now = now_utc()
    state = await _process_mastermind(player, now)
    districts = _district_seed(player)
    district = next((row for row in districts if row["key"] == body.district_key), None)
    if not district:
        raise HTTPException(status_code=404, detail="Zona não encontrada")
    if body.district_key in set(state.get("caches_collected") or []):
        raise HTTPException(status_code=400, detail="Este sinal já foi recuperado")
    cooldown = (state.get("cache_cooldowns") or {}).get(body.district_key)
    if _future(cooldown, now):
        raise HTTPException(status_code=400, detail=f"Scanner em recarga durante {_remaining(cooldown, now)}s")
    rank = mastermind_rank(state.get("xp", 0))
    chance = 0.52 + rank["level"] * 0.06
    if _future((player.get("street") or {}).get("intel_until"), now):
        chance += 0.08
    chance = clamp_chance(chance)
    scan_bucket = int(now.timestamp()) // 120
    success = deterministic_roll(
        f"{player['_id']}:cache:{body.district_key}:{scan_bucket}"
    ) < chance
    if not success:
        until = (now + timedelta(minutes=2)).isoformat()
        await db.players.update_one(
            {"_id": player["_id"]},
            {
                "$set": {
                    f"mastermind.cache_cooldowns.{body.district_key}": until,
                },
            },
        )
        message = f"O sinal em {district['name']} perdeu-se; recalibra o scanner."
        await add_event(db, str(player["_id"]), "intel", message)
        return {"ok": True, "success": False, "chance": chance, "message": message}

    reward = 2500 + rank["level"] * 1000
    xp_gain = 20
    collected_after = set(state.get("caches_collected") or [])
    collected_after.add(body.district_key)
    completed = len(collected_after) == len(districts)
    completion_bonus = 0
    if completed and not state.get("cache_completion_claimed"):
        completion_bonus = 25000
        xp_gain += 100
    updated = await db.players.find_one_and_update(
        {
            "_id": player["_id"],
            "mastermind.caches_collected": {"$ne": body.district_key},
        },
        {
            "$addToSet": {"mastermind.caches_collected": body.district_key},
            "$set": {
                f"mastermind.cache_cooldowns.{body.district_key}": None,
                **({"mastermind.cache_completion_claimed": True} if completion_bonus else {}),
            },
            "$inc": {
                "clean_money": reward + completion_bonus,
                "mastermind.xp": xp_gain,
            },
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Este sinal já foi recuperado")
    total_reward = reward + completion_bonus
    await record_tx(
        db,
        str(player["_id"]),
        "signal_cache",
        total_reward,
        "clean",
        updated["clean_money"],
        f"Cache de sinal: {district['name']}",
    )
    message = f"Cache recuperada em {district['name']}: +{total_reward:,} € limpos e +{xp_gain} XP."
    if completion_bonus:
        message += " A rede completa concedeu o bónus Lenda do Sinal."
    await add_event(db, str(player["_id"]), "success", message)
    return {
        "ok": True,
        "success": True,
        "reward": total_reward,
        "xp": xp_gain,
        "completed": completed,
        "message": message,
    }
