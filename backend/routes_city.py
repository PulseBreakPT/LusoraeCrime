import random
import secrets
import string
from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from auth import get_current_user
from db import db
from engine import add_event, now_utc, record_tx
from routes_game import get_player
from mutation_guard import MutationInput, idempotent
from city_data import (
    BUSINESS_TYPES, RIVAL_ACTIONS, CASINO_MIN_BET, CASINO_MAX_BET,
)
from city_systems import (
    city_snapshot, business_projection, season_info, boss_status,
)
from economy_director import city_business_cap

router = APIRouter(prefix="/api/game/city", tags=["city"])


class BusinessBuyInput(MutationInput):
    type_key: str


class BusinessIdInput(MutationInput):
    business_id: str


class RivalActionInput(MutationInput):
    rival_id: str
    action: str


class CasinoPlayInput(MutationInput):
    game: str
    bet: int = Field(ge=CASINO_MIN_BET, le=CASINO_MAX_BET)
    choice: str | None = None


class ChatInput(MutationInput):
    message: str = Field(min_length=1, max_length=280)


class ChatReportInput(MutationInput):
    message_id: str
    reason: str = Field(min_length=3, max_length=160)


class ChatBlockInput(MutationInput):
    player_id: str
    blocked: bool = True


class TogglePvpInput(MutationInput):
    enabled: bool


class AllianceCreateInput(MutationInput):
    name: str = Field(min_length=3, max_length=32)


class AllianceJoinInput(MutationInput):
    code: str = Field(min_length=4, max_length=12)


class AllianceMemberInput(MutationInput):
    player_id: str


class PvpChallengeInput(MutationInput):
    defender_player_id: str


class PvpAcceptInput(MutationInput):
    challenge_id: str


class PvpDeclineInput(MutationInput):
    challenge_id: str


def _oid(value, label="ID"):
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"{label} inválido")
    return ObjectId(value)


async def _change_clean(player, amount, note, kind):
    amount = int(amount)
    query = {"_id": player["_id"]}
    if amount < 0:
        query["clean_money"] = {"$gte": -amount}
    fresh = await db.players.find_one_and_update(
        query,
        {"$inc": {"clean_money": amount}},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    balance = int(fresh.get("clean_money", 0))
    await record_tx(db, str(player["_id"]), kind, amount, "clean", balance, note)
    player["clean_money"] = balance
    return balance


async def _change_dirty(player, amount, note, kind):
    amount = int(amount)
    query = {"_id": player["_id"]}
    if amount < 0:
        query["dirty_money"] = {"$gte": -amount}
    fresh = await db.players.find_one_and_update(
        query,
        {"$inc": {"dirty_money": amount}},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Dinheiro sujo insuficiente")
    balance = int(fresh.get("dirty_money", 0))
    await record_tx(db, str(player["_id"]), kind, amount, "dirty", balance, note)
    player["dirty_money"] = balance
    return balance


@router.get("/state")
async def get_city_state(user: dict = Depends(get_current_user)):
    player = await get_player(user)
    snapshot = await city_snapshot(db, player)
    blocked = {str(value) for value in (player.get("city_blocked_player_ids") or [])}
    social = snapshot.get("social") or {}
    if blocked:
        social["chat"] = [
            row for row in (social.get("chat") or [])
            if str(row.get("player_id") or "") not in blocked
        ]
    social["blocked_player_ids"] = sorted(blocked)
    snapshot["social"] = social
    return snapshot


@router.post("/businesses/buy")
@idempotent("city_business_buy")
async def buy_business(body: BusinessBuyInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    cfg = BUSINESS_TYPES.get(body.type_key)
    if not cfg:
        raise HTTPException(status_code=404, detail="Tipo de negócio inexistente")
    required_level = int(cfg.get("min_level", 1))
    if int(player.get("level", 1)) < required_level:
        raise HTTPException(status_code=400, detail=f"Este negócio desbloqueia no nível {required_level}")
    pid = str(player["_id"])
    owned = await db.city_businesses.count_documents({"player_id": pid})
    capacity = city_business_cap(player.get("level", 1))
    if owned >= capacity:
        raise HTTPException(status_code=400, detail=f"Rede empresarial cheia ({owned}/{capacity}); sobe de nível para expandir")
    same = await db.city_businesses.count_documents({"player_id": pid, "type_key": body.type_key})
    price = int(cfg["price"] * (1 + owned * 0.08 + same * 0.12))
    await _change_clean(player, -price, f"Compra de negócio: {cfg['name']}", "city_business_buy")
    now = now_utc().isoformat()
    doc = {
        "player_id": pid,
        "type_key": body.type_key,
        "name": cfg["name"],
        "level": 1,
        "condition": 100.0,
        "security": int(cfg.get("security", 25)),
        "reputation": 50.0,
        "bought_at": now,
        "last_collect_at": now,
        "total_clean": 0,
        "total_dirty": 0,
    }
    result = await db.city_businesses.insert_one(doc)
    await add_event(db, pid, "system", f"{cfg['name']} entrou na rede empresarial da organização.")
    return {"ok": True, "business_id": str(result.inserted_id), "price": price}


@router.post("/businesses/upgrade")
@idempotent("city_business_upgrade")
async def upgrade_business(body: BusinessIdInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    business = await db.city_businesses.find_one({"_id": _oid(body.business_id, "Negócio"), "player_id": pid})
    if not business:
        raise HTTPException(status_code=404, detail="Negócio não encontrado")
    cfg = BUSINESS_TYPES[business["type_key"]]
    level = int(business.get("level", 1))
    if level >= int(cfg.get("max_level", 5)):
        raise HTTPException(status_code=400, detail="Negócio já está no nível máximo")
    cost = int(cfg["price"] * (0.42 + level * 0.18))
    await _change_clean(player, -cost, f"Melhoria de {business['name']} para nível {level + 1}", "city_business_upgrade")
    await db.city_businesses.update_one(
        {"_id": business["_id"]},
        {"$set": {
            "level": level + 1,
            "security": min(100, int(business.get("security", cfg.get("security", 25))) + 5),
            "condition": min(100.0, float(business.get("condition", 100)) + 8),
        }},
    )
    await add_event(db, pid, "system", f"{business['name']} evoluiu para nível {level + 1}.")
    return {"ok": True, "cost": cost, "level": level + 1}


@router.post("/businesses/collect")
@idempotent("city_business_collect")
async def collect_businesses(body: MutationInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    now = now_utc()
    businesses = await db.city_businesses.find({"player_id": pid}).to_list(100)
    if not businesses:
        raise HTTPException(status_code=400, detail="Ainda não tens negócios urbanos")
    total_clean = total_dirty = 0
    total_heat = 0.0
    for business in businesses:
        projection = business_projection(business, now)
        claim = await db.city_businesses.update_one(
            {"_id": business["_id"], "last_collect_at": business.get("last_collect_at")},
            {"$set": {"last_collect_at": now.isoformat()},
             "$inc": {"total_clean": projection["clean"], "total_dirty": projection["dirty"]}},
        )
        # Outro pedido pode ter reclamado este mesmo período milissegundos antes.
        if claim.modified_count != 1:
            continue
        total_clean += projection["clean"]
        total_dirty += projection["dirty"]
        total_heat += projection["heat"]
    if total_clean:
        await _change_clean(player, total_clean, "Receitas da rede empresarial", "city_business_income")
    if total_dirty:
        await _change_dirty(player, total_dirty, "Receitas clandestinas da rede empresarial", "city_business_income")
    new_heat = min(100.0, float(player.get("heat", 0)) + total_heat)
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"heat": new_heat}})
    await add_event(
        db, pid, "system",
        f"Rede empresarial fechou caixa: +{total_clean:,} € limpos, +{total_dirty:,} € sujos."
    )
    return {"ok": True, "clean": total_clean, "dirty": total_dirty, "heat": round(total_heat, 2)}


@router.post("/rivals/action")
@idempotent("city_rival_action")
async def rival_action(body: RivalActionInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    cfg = RIVAL_ACTIONS.get(body.action)
    if not cfg:
        raise HTTPException(status_code=400, detail="Ação rival inválida")
    rival = await db.city_rivals.find_one({"_id": _oid(body.rival_id, "Rival"), "player_id": pid})
    if not rival:
        raise HTTPException(status_code=404, detail="Organização rival não encontrada")
    last = rival.get("last_action_at")
    if last:
        from city_systems import _parse
        parsed = _parse(last)
        if parsed and now_utc() < parsed + timedelta(hours=float(cfg["cooldown_h"])):
            remaining = int(((parsed + timedelta(hours=float(cfg["cooldown_h"]))) - now_utc()).total_seconds())
            raise HTTPException(status_code=429, detail=f"Rede ainda em cooldown ({remaining}s)")
    await _change_clean(player, -int(cfg["cost"]), f"{cfg['name']} contra {rival['name']}", "city_rival_action")
    rng = random.SystemRandom()
    level = int(player.get("level", 1) or 1)
    intel = int(rival.get("intel", 0) or 0)
    power = int(rival.get("power", 30) or 30)
    skill = level * 7 + intel * 4 + int(player.get("respect", 0) or 0) // 900
    success = rng.random() < max(0.18, min(0.88, 0.48 + (skill - power) / 180))
    update = {"last_action_at": now_utc().isoformat()}
    message = ""

    if body.action == "recon":
        gain = rng.randint(1, 3)
        update["intel"] = min(10, intel + gain)
        success = True
        message = f"Reconhecimento a {rival['name']}: inteligência +{gain}."
    elif body.action == "sabotage":
        if success:
            hit = rng.randint(4, 10)
            update["power"] = max(8, power - hit)
            update["hostility"] = min(100, int(rival.get("hostility", 40)) + 12)
            message = f"Sabotagem bem-sucedida contra {rival['name']} (-{hit} poder)."
        else:
            heat = min(100.0, float(player.get("heat", 0)) + 6)
            await db.players.update_one({"_id": player["_id"]}, {"$set": {"heat": heat, "boss_stress": min(100, int(player.get("boss_stress", 0)) + 8)}})
            message = f"A sabotagem contra {rival['name']} falhou e aumentou a pressão policial."
    elif body.action == "pressure":
        delta = rng.randint(8, 18) if success else -rng.randint(3, 8)
        update["territory_pressure"] = max(0, min(100, int(rival.get("territory_pressure", 20)) - delta))
        update["hostility"] = min(100, int(rival.get("hostility", 40)) + (9 if success else 4))
        message = f"Pressão territorial sobre {rival['name']}: {'avanço' if success else 'resistência rival'}."
    elif body.action == "truce":
        if success or int(rival.get("hostility", 0)) < 55:
            update["relation"] = "truce"
            update["hostility"] = max(0, int(rival.get("hostility", 40)) - 30)
            success = True
            message = f"Trégua temporária estabelecida com {rival['name']}."
        else:
            message = f"{rival['name']} recusou a trégua."
    elif body.action == "alliance":
        threshold = 45 + int(rival.get("hostility", 40))
        success = rng.randint(0, 100) + intel * 4 + level * 2 >= threshold
        if success:
            update["relation"] = "allied"
            update["hostility"] = max(0, int(rival.get("hostility", 40)) - 45)
            message = f"Acordo estratégico estabelecido com {rival['name']}."
        else:
            message = f"As negociações com {rival['name']} falharam."

    await db.city_rivals.update_one({"_id": rival["_id"]}, {"$set": update})
    await add_event(db, pid, "system" if success else "warning", message)
    return {"ok": True, "success": success, "message": message}


def _card(rng):
    rank = rng.choice([2,3,4,5,6,7,8,9,10,10,10,10,11])
    return rank


def _blackjack(rng):
    player = [_card(rng), _card(rng)]
    dealer = [_card(rng), _card(rng)]
    def value(cards):
        total = sum(cards)
        aces = sum(1 for c in cards if c == 11)
        while total > 21 and aces:
            total -= 10
            aces -= 1
        return total
    while value(player) < 16:
        player.append(_card(rng))
    while value(dealer) < 17:
        dealer.append(_card(rng))
    pv, dv = value(player), value(dealer)
    if pv > 21:
        outcome = "lose"
    elif dv > 21 or pv > dv:
        outcome = "win"
    elif pv == dv:
        outcome = "push"
    else:
        outcome = "lose"
    natural = len(player) == 2 and pv == 21
    return outcome, natural, player, dealer, pv, dv


@router.post("/casino/play")
@idempotent("city_casino_play")
async def casino_play(body: CasinoPlayInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    bet = int(body.bet)
    if body.game not in {"roulette", "blackjack"}:
        raise HTTPException(status_code=400, detail="Jogo de casino inválido")
    if int(player.get("clean_money", 0)) < bet:
        raise HTTPException(status_code=400, detail="Saldo insuficiente")
    rng = random.SystemRandom()
    await _change_clean(player, -bet, f"Aposta: {body.game}", "city_casino_bet")
    payout = 0
    detail = {}

    if body.game == "roulette":
        choice = (body.choice or "red").lower()
        if choice not in {"red", "black", "green"}:
            raise HTTPException(status_code=400, detail="Escolha inválida para a roleta")
        number = rng.randint(0, 36)
        reds = {1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36}
        color = "green" if number == 0 else ("red" if number in reds else "black")
        if color == choice:
            payout = bet * (36 if choice == "green" else 2)
        detail = {"number": number, "color": color, "choice": choice}
    elif body.game == "blackjack":
        outcome, natural, hand, dealer, pv, dv = _blackjack(rng)
        if outcome == "push":
            payout = bet
        elif outcome == "win":
            payout = int(bet * (2.5 if natural else 2))
        detail = {"outcome": outcome, "player": hand, "dealer": dealer, "player_value": pv, "dealer_value": dv, "natural": natural}
    if payout:
        await _change_clean(player, payout, f"Prémio: {body.game}", "city_casino_payout")
    net = payout - bet
    await add_event(db, str(player["_id"]), "system", f"Casino: {body.game} terminou com resultado líquido de {net:+,} €.")
    return {"ok": True, "payout": payout, "net": net, **detail}


@router.post("/social/pvp")
@idempotent("city_pvp_toggle")
async def toggle_pvp(body: TogglePvpInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    if body.enabled and int(player.get("level", 1)) < 15:
        raise HTTPException(status_code=400, detail="PvP desbloqueia no nível 15")
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"pvp_opt_in": bool(body.enabled)}})
    return {"ok": True, "enabled": bool(body.enabled)}


@router.post("/social/chat")
@idempotent("city_chat")
async def post_chat(body: ChatInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    last = await db.city_chat.find_one({"player_id": pid}, sort=[("ts", -1)])
    if last:
        from city_systems import _parse
        parsed = _parse(last.get("ts"))
        if parsed and (now_utc() - parsed).total_seconds() < 10:
            raise HTTPException(status_code=429, detail="Aguarda alguns segundos antes de enviar outra mensagem")
    doc = {
        "player_id": pid,
        "org_name": player.get("org_name", "Organização"),
        "message": body.message.strip(),
        "ts": now_utc().isoformat(),
    }
    await db.city_chat.insert_one(doc)
    return {"ok": True}


@router.post("/social/chat/report")
@idempotent("city_chat_report")
async def report_chat(body: ChatReportInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    reporter_id = str(player["_id"])
    message = await db.city_chat.find_one({"_id": _oid(body.message_id, "Mensagem")})
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")
    target_id = str(message.get("player_id") or "")
    if target_id == reporter_id:
        raise HTTPException(status_code=400, detail="Não podes denunciar a tua própria mensagem")
    existing = await db.city_chat_reports.find_one({
        "reporter_id": reporter_id,
        "message_id": str(message["_id"]),
        "status": {"$in": ["open", "reviewing"]},
    })
    if existing:
        raise HTTPException(status_code=409, detail="Esta mensagem já foi denunciada por ti")
    await db.city_chat_reports.insert_one({
        "reporter_id": reporter_id,
        "target_player_id": target_id,
        "message_id": str(message["_id"]),
        "message_snapshot": str(message.get("message") or "")[:280],
        "reason": body.reason.strip(),
        "status": "open",
        "created_at": now_utc().isoformat(),
    })
    return {"ok": True}


@router.post("/social/chat/block")
@idempotent("city_chat_block")
async def block_chat_player(body: ChatBlockInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    target_id = str(body.player_id or "").strip()
    if target_id == pid:
        raise HTTPException(status_code=400, detail="Não podes bloquear a tua própria organização")
    target = await db.players.find_one({"_id": _oid(target_id, "Jogador")})
    if not target:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    if body.blocked:
        await db.players.update_one(
            {"_id": player["_id"]},
            {"$addToSet": {"city_blocked_player_ids": target_id}},
        )
    else:
        await db.players.update_one(
            {"_id": player["_id"]},
            {"$pull": {"city_blocked_player_ids": target_id}},
        )
    return {"ok": True, "player_id": target_id, "blocked": bool(body.blocked)}


def _alliance_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))


@router.post("/social/alliance/create")
@idempotent("city_alliance_create")
async def create_alliance(body: AllianceCreateInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if await db.city_alliances.find_one({"member_ids": pid}):
        raise HTTPException(status_code=409, detail="Já pertences a uma aliança")
    code = _alliance_code()
    while await db.city_alliances.find_one({"code": code}):
        code = _alliance_code()
    season = season_info()
    doc = {
        "name": body.name.strip(),
        "code": code,
        "leader_id": pid,
        "member_ids": [pid],
        "season_id": season["id"],
        "season_points": 0,
        "created_at": now_utc().isoformat(),
    }
    result = await db.city_alliances.insert_one(doc)
    return {"ok": True, "alliance_id": str(result.inserted_id), "code": code}


@router.post("/social/alliance/join")
@idempotent("city_alliance_join")
async def join_alliance(body: AllianceJoinInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    if await db.city_alliances.find_one({"member_ids": pid}):
        raise HTTPException(status_code=409, detail="Já pertences a uma aliança")
    alliance = await db.city_alliances.find_one({"code": body.code.strip().upper()})
    if not alliance:
        raise HTTPException(status_code=404, detail="Código de aliança inválido")
    if len(alliance.get("member_ids", [])) >= 20:
        raise HTTPException(status_code=400, detail="Aliança cheia")
    await db.city_alliances.update_one({"_id": alliance["_id"]}, {"$addToSet": {"member_ids": pid}})
    return {"ok": True, "name": alliance["name"]}


@router.post("/social/alliance/leave")
@idempotent("city_alliance_leave")
async def leave_alliance(body: MutationInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    alliance = await db.city_alliances.find_one({"member_ids": pid})
    if not alliance:
        raise HTTPException(status_code=404, detail="Não pertences a uma aliança")
    members = list(alliance.get("member_ids") or [])
    if alliance.get("leader_id") == pid and len(members) > 1:
        raise HTTPException(status_code=400, detail="Transfere a liderança antes de sair")
    if len(members) <= 1:
        await db.city_alliances.delete_one({"_id": alliance["_id"]})
    else:
        await db.city_alliances.update_one({"_id": alliance["_id"]}, {"$pull": {"member_ids": pid}})
    return {"ok": True}


@router.post("/social/alliance/transfer")
@idempotent("city_alliance_transfer")
async def transfer_alliance_leadership(body: AllianceMemberInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    target_id = str(body.player_id or "").strip()
    alliance = await db.city_alliances.find_one({"member_ids": pid})
    if not alliance:
        raise HTTPException(status_code=404, detail="Não pertences a uma aliança")
    if alliance.get("leader_id") != pid:
        raise HTTPException(status_code=403, detail="Só o líder pode transferir a liderança")
    if target_id == pid:
        raise HTTPException(status_code=400, detail="Já és o líder da aliança")
    if target_id not in (alliance.get("member_ids") or []):
        raise HTTPException(status_code=404, detail="Esse jogador não pertence à aliança")
    await db.city_alliances.update_one(
        {"_id": alliance["_id"], "leader_id": pid},
        {"$set": {"leader_id": target_id, "leadership_changed_at": now_utc().isoformat()}},
    )
    return {"ok": True, "leader_id": target_id}


@router.post("/social/alliance/kick")
@idempotent("city_alliance_kick")
async def kick_alliance_member(body: AllianceMemberInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    pid = str(player["_id"])
    target_id = str(body.player_id or "").strip()
    alliance = await db.city_alliances.find_one({"member_ids": pid})
    if not alliance:
        raise HTTPException(status_code=404, detail="Não pertences a uma aliança")
    if alliance.get("leader_id") != pid:
        raise HTTPException(status_code=403, detail="Só o líder pode expulsar membros")
    if target_id == pid:
        raise HTTPException(status_code=400, detail="O líder não se pode expulsar; transfere a liderança primeiro")
    if target_id not in (alliance.get("member_ids") or []):
        raise HTTPException(status_code=404, detail="Esse jogador não pertence à aliança")
    await db.city_alliances.update_one(
        {"_id": alliance["_id"], "leader_id": pid},
        {"$pull": {"member_ids": target_id}, "$set": {"updated_at": now_utc().isoformat()}},
    )
    return {"ok": True, "removed_player_id": target_id}


@router.post("/social/pvp/challenge")
@idempotent("city_pvp_challenge")
async def challenge_pvp(body: PvpChallengeInput, user: dict = Depends(get_current_user)):
    attacker = await get_player(user)
    if not attacker.get("pvp_opt_in"):
        raise HTTPException(status_code=400, detail="Ativa primeiro o PvP")
    if int(attacker.get("level", 1)) < 15:
        raise HTTPException(status_code=400, detail="PvP desbloqueia no nível 15")
    defender = await db.players.find_one({"_id": _oid(body.defender_player_id, "Jogador"), "pvp_opt_in": True})
    if not defender or defender["_id"] == attacker["_id"] or int(defender.get("level", 1)) < 15:
        raise HTTPException(status_code=404, detail="Rival PvP indisponível")
    now = now_utc()
    attacker_id, defender_id = str(attacker["_id"]), str(defender["_id"])
    pair_query = {"$or": [
        {"attacker_id": attacker_id, "defender_id": defender_id},
        {"attacker_id": defender_id, "defender_id": attacker_id},
    ]}
    await db.city_pvp_challenges.update_many(
        {**pair_query, "status": "pending", "expires_at": {"$lte": now.isoformat()}},
        {"$set": {"status": "expired", "resolved_at": now.isoformat()}},
    )
    pending = await db.city_pvp_challenges.find_one({**pair_query, "status": "pending", "expires_at": {"$gt": now.isoformat()}})
    if pending:
        raise HTTPException(status_code=409, detail="Já existe um desafio pendente entre estas organizações")
    recent = await db.city_pvp_challenges.count_documents({
        **pair_query, "status": "resolved",
        "resolved_at": {"$gte": (now - timedelta(hours=24)).isoformat()},
    })
    if recent >= 3:
        raise HTTPException(status_code=429, detail="Limite diário atingido contra este rival")
    last = await db.city_pvp_challenges.find_one({
        **pair_query, "status": "resolved",
        "resolved_at": {"$gte": (now - timedelta(hours=6)).isoformat()},
    })
    if last:
        raise HTTPException(status_code=429, detail="Este confronto está em cooldown durante 6 horas")
    doc = {
        "attacker_id": str(attacker["_id"]),
        "attacker_name": attacker.get("org_name", "Organização"),
        "defender_id": str(defender["_id"]),
        "defender_name": defender.get("org_name", "Organização"),
        "status": "pending",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=12)).isoformat(),
    }
    result = await db.city_pvp_challenges.insert_one(doc)
    return {"ok": True, "challenge_id": str(result.inserted_id)}


@router.post("/social/pvp/accept")
@idempotent("city_pvp_accept")
async def accept_pvp(body: PvpAcceptInput, user: dict = Depends(get_current_user)):
    defender = await get_player(user)
    challenge = await db.city_pvp_challenges.find_one({
        "_id": _oid(body.challenge_id, "Desafio"),
        "defender_id": str(defender["_id"]),
        "status": "pending",
    })
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio PvP não encontrado")
    attacker = await db.players.find_one({"_id": _oid(challenge["attacker_id"], "Atacante")})
    if not attacker or not attacker.get("pvp_opt_in") or not defender.get("pvp_opt_in"):
        raise HTTPException(status_code=400, detail="PvP já não está ativo para ambos")
    rng = random.SystemRandom()
    def score(p):
        stats = p.get("stats") or {}
        return (
            int(p.get("level", 1)) * 12
            + int(p.get("respect", 0)) / 350
            + int(stats.get("missions_success", 0)) * 0.7
            + rng.uniform(0, 22)
        )
    a_score, d_score = score(attacker), score(defender)
    winner = attacker if a_score >= d_score else defender
    loser = defender if winner["_id"] == attacker["_id"] else attacker
    season = season_info()
    now = now_utc()
    pair_query = {"$or": [
        {"attacker_id": str(attacker["_id"]), "defender_id": str(defender["_id"])},
        {"attacker_id": str(defender["_id"]), "defender_id": str(attacker["_id"])},
    ]}
    recent_count = await db.city_pvp_challenges.count_documents({
        **pair_query, "status": "resolved",
        "resolved_at": {"$gte": (now - timedelta(days=7)).isoformat()},
    })
    farm_mult = [1.0, 0.5, 0.25][recent_count] if recent_count < 3 else 0.10
    winner_points = max(8, int(round(80 * farm_mult)))
    loser_points = max(2, int(round(20 * farm_mult)))
    await db.city_season_scores.update_one(
        {"player_id": str(winner["_id"]), "season_id": season["id"]},
        {"$inc": {"points": winner_points}, "$set": {"updated_at": now.isoformat()}},
        upsert=True,
    )
    await db.city_season_scores.update_one(
        {"player_id": str(loser["_id"]), "season_id": season["id"]},
        {"$inc": {"points": loser_points}, "$set": {"updated_at": now.isoformat()}},
        upsert=True,
    )

    # As alianças têm a mesma época dos jogadores. Ao mudar de época, os
    # pontos antigos são arquivados implicitamente pelo season_id e a tabela
    # começa novamente em zero antes de aplicar o resultado atual.
    for member_id, points in (
        (str(winner["_id"]), winner_points),
        (str(loser["_id"]), loser_points),
    ):
        alliance = await db.city_alliances.find_one({"member_ids": member_id})
        if alliance:
            if alliance.get("season_id") != season["id"]:
                await db.city_alliances.update_one(
                    {"_id": alliance["_id"]},
                    {"$set": {"season_id": season["id"], "season_points": points}},
                )
            else:
                await db.city_alliances.update_one(
                    {"_id": alliance["_id"]},
                    {"$inc": {"season_points": points}},
                )
    consequence = None
    loser_fields = {"boss_stress": min(100, int(loser.get("boss_stress", 0) or 0) + 8)}
    if float(loser.get("heat", 0) or 0) >= 75 and rng.random() < 0.06:
        loser_fields["boss_sentence_until"] = (now_utc() + timedelta(minutes=rng.randint(15, 45))).isoformat()
        consequence = "sentence"
    elif rng.random() < 0.08:
        loser_fields["boss_hospital_until"] = (now_utc() + timedelta(minutes=rng.randint(10, 30))).isoformat()
        loser_fields["boss_health"] = rng.randint(55, 80)
        consequence = "hospital"
    await db.players.update_one({"_id": loser["_id"]}, {"$set": loser_fields})
    await db.city_pvp_challenges.update_one(
        {"_id": challenge["_id"]},
        {"$set": {
            "status": "resolved",
            "winner_id": str(winner["_id"]),
            "resolved_at": now_utc().isoformat(),
            "consequence": consequence,
        }},
    )
    await add_event(db, str(winner["_id"]), "system", f"Conflito PvP vencido contra {loser.get('org_name', 'rival')}.")
    await add_event(db, str(loser["_id"]), "warning", f"Conflito PvP perdido contra {winner.get('org_name', 'rival')}.")
    return {"ok": True, "winner_id": str(winner["_id"]), "winner_name": winner.get("org_name"), "consequence": consequence}


@router.post("/social/pvp/decline")
@idempotent("city_pvp_decline")
async def decline_pvp(body: PvpDeclineInput, user: dict = Depends(get_current_user)):
    defender = await get_player(user)
    challenge = await db.city_pvp_challenges.find_one({
        "_id": _oid(body.challenge_id, "Desafio"),
        "defender_id": str(defender["_id"]),
        "status": "pending",
    })
    if not challenge:
        raise HTTPException(status_code=404, detail="Desafio PvP não encontrado")
    await db.city_pvp_challenges.update_one(
        {"_id": challenge["_id"]},
        {"$set": {"status": "declined", "resolved_at": now_utc().isoformat()}},
    )
    return {"ok": True}


@router.post("/boss/recover")
@idempotent("city_boss_recover")
async def recover_boss(body: MutationInput, user: dict = Depends(get_current_user)):
    player = await get_player(user)
    now = now_utc()
    status = boss_status(player, now)
    hospital = status.get("hospital_until")
    sentence = status.get("sentence_until")
    cost = 0
    fields = {
        "boss_health": 100,
        "boss_stress": max(0, int(player.get("boss_stress", 0)) - 30),
        "boss_hospital_until": None,
        "boss_sentence_until": None,
    }
    if hospital:
        cost += 3500
    if sentence:
        cost += 7500
    stress = int(player.get("boss_stress", 0) or 0)
    health = int(player.get("boss_health", 100) or 100)
    if stress >= 35 and not hospital and not sentence:
        cost += 1000
    if not hospital and not sentence and health >= 100 and stress < 35:
        raise HTTPException(status_code=400, detail="Não há nenhuma consequência ativa para tratar")
    if cost:
        await _change_clean(player, -cost, "Recuperação do chefe", "city_boss_recovery")
    await db.players.update_one({"_id": player["_id"]}, {"$set": fields})
    await add_event(db, str(player["_id"]), "system", "O chefe regressou à atividade.")
    return {"ok": True, "cost": cost}
