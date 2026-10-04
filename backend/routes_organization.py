from __future__ import annotations

import asyncio
from functools import wraps
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from auth import get_current_user
from db import db
from engine import add_event, now_utc, record_tx
from game_data import WEAPON_MODELS, PROPERTY_TYPES
from economy_constants import (
    EMPLOYER_SOCIAL_SECURITY_RATE, VEHICLE_ANNUAL_FIXED_COSTS,
    PROPERTY_MAINTENANCE_PCT_PER_WEEK,
)
from organization_intelligence import (
    build_organization_intelligence, quote_action, organization_policy,
)
from organization_automation import run_organization_automation
from organization_systems import (
    SUPPLY_CATALOG, WEAPON_AMMO, WEAPON_UPGRADES, TEAM_DOCTRINES, TEAM_POLICIES,
    DEPARTMENTS, TERRITORY_TIERS, PROPERTY_MODULES, VEHICLE_LIFECYCLE,
    department_cost, department_level, inventory_capacity, inventory_used,
    normalize_inventory, vehicle_service_snapshot, default_team_policies,
    PRESTIGE_CATALOG, protection_cost, fixed_cost_multiplier, territory_weekly_cost,
)

router = APIRouter(prefix="/api/game/org", tags=["organization"])


async def _player(user: dict) -> dict:
    player = await db.players.find_one({"user_id": user["_id"]})
    if not player or not player.get("hq"):
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    return player


def _oid(value: str, label: str):
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail=label)


def _property_staff_profile(employees: list[dict]) -> tuple[dict[str, str], float]:
    """Assign people to the role where their real attributes add most value."""
    role_attrs = {
        "security": ("forca", "tiro", "sangue_frio"),
        "operations": ("inteligencia", "discricao", "sangue_frio"),
        "logistics": ("conducao", "inteligencia", "discricao"),
        "management": ("negociacao", "inteligencia", "sangue_frio"),
    }
    remaining = set(role_attrs)
    roles: dict[str, str] = {}
    scores = []
    for emp in sorted(employees, key=lambda e: float(e.get("level", 1) or 1), reverse=True):
        attrs = emp.get("attrs") or {}
        choices = remaining or set(role_attrs)
        best_role = max(
            choices,
            key=lambda role: sum(float(attrs.get(key, 0) or 0) for key in role_attrs[role]),
        )
        raw = sum(float(attrs.get(key, 0) or 0) for key in role_attrs[best_role]) / (10 * len(role_attrs[best_role]))
        morale = max(0.4, min(1.0, float(emp.get("morale", 70) or 70) / 100))
        fatigue = max(0.45, 1.0 - float(emp.get("fatigue", 0) or 0) / 140)
        score = max(0.0, min(1.0, raw * morale * fatigue))
        roles[str(emp["_id"])] = best_role
        scores.append(score)
        remaining.discard(best_role)
    effectiveness = sum(scores) / len(scores) if scores else 0.0
    return roles, round(effectiveness, 3)


async def _debit(player: dict, amount: int, *, stat: str | None = None) -> dict:
    inc = {"clean_money": -int(amount)}
    if stat:
        inc[f"stats.{stat}"] = 1
    fresh = await db.players.find_one_and_update(
        {"_id": player["_id"], "clean_money": {"$gte": int(amount)}},
        {"$inc": inc},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    player["clean_money"] = fresh["clean_money"]
    return fresh


class MutationInput(BaseModel):
    request_id: str | None = Field(default=None, max_length=80)


def idempotent(action_name: str):
    """Persist a short-lived mutation receipt so network retries cannot double-spend."""
    def decorator(fn):
        @wraps(fn)
        async def wrapped(*args, **kwargs):
            body = kwargs.get("body")
            if body is None:
                body = next((arg for arg in args if isinstance(arg, BaseModel)), None)
            request_id = getattr(body, "request_id", None)
            user = kwargs.get("user")
            if user is None:
                user = next((arg for arg in args if isinstance(arg, dict) and "_id" in arg), None)
            if not request_id or not user:
                return await fn(*args, **kwargs)

            key = f"{user['_id']}:{action_name}:{request_id}"
            now = now_utc()
            try:
                await db.action_receipts.insert_one({
                    "key": key,
                    "status": "processing",
                    "created_at": now,
                    "expires_at": now + timedelta(hours=24),
                })
            except DuplicateKeyError:
                existing = await db.action_receipts.find_one({"key": key})
                if existing and existing.get("status") == "done":
                    return existing.get("result") or {"ok": True, "idempotent_replay": True}
                raise HTTPException(status_code=409, detail="Ação já está a ser processada")

            try:
                result = await fn(*args, **kwargs)
            except Exception:
                await db.action_receipts.delete_one({"key": key, "status": "processing"})
                raise
            await db.action_receipts.update_one(
                {"key": key},
                {"$set": {"status": "done", "result": result}},
            )
            try:
                payload = body.model_dump() if body is not None else {}
                payload.pop("request_id", None)
                await db.organization_audit.insert_one({
                    "player_user_id": str(user["_id"]),
                    "action": action_name,
                    "payload": payload,
                    "result": result,
                    "ts": now_utc().isoformat(),
                })
            except Exception:
                # Auditoria nunca deve transformar uma mutação válida em erro.
                pass
            return result
        return wrapped
    return decorator


class SupplyTradeInput(MutationInput):
    item_key: str
    packs: int = Field(default=1, ge=1, le=100)


class TeamRenameInput(MutationInput):
    team_id: str
    name: str = Field(min_length=1, max_length=40)


class TeamDoctrineInput(MutationInput):
    team_id: str
    doctrine: str


class TeamPolicyInput(MutationInput):
    team_id: str
    policies: dict


class TeamLoadoutInput(MutationInput):
    team_id: str
    loadout: dict[str, int] = Field(default_factory=dict)


class EntityIdInput(MutationInput):
    id: str


class WeaponUpgradeInput(MutationInput):
    weapon_id: str
    upgrade_key: str


class PropertyModuleInput(MutationInput):
    property_id: str
    module_key: str


class PropertyStaffInput(MutationInput):
    property_id: str
    employee_ids: list[str] = Field(default_factory=list)


class DepartmentInput(MutationInput):
    department_key: str


class TerritoryInput(MutationInput):
    district: str


class OrganizationQuoteInput(BaseModel):
    action: str
    payload: dict = Field(default_factory=dict)


class OrganizationPolicyInput(MutationInput):
    reserve_cash: int = Field(default=25000, ge=0, le=100_000_000)
    max_single_spend_pct: float = Field(default=0.35, ge=0.05, le=1.0)
    stock_targets: dict[str, int] = Field(default_factory=dict)
    automation: dict[str, bool] = Field(default_factory=dict)


@router.get("/catalog")
async def organization_catalog():
    return {
        "supplies": SUPPLY_CATALOG,
        "weapon_ammo": WEAPON_AMMO,
        "weapon_upgrades": WEAPON_UPGRADES,
        "team_doctrines": TEAM_DOCTRINES,
        "team_policies": TEAM_POLICIES,
        "departments": DEPARTMENTS,
        "territory_tiers": TERRITORY_TIERS,
        "property_modules": PROPERTY_MODULES,
        "vehicle_lifecycle": VEHICLE_LIFECYCLE,
        "prestige": PRESTIGE_CATALOG,
    }


@router.get("/intelligence")
async def organization_intelligence(user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    teams, employees, vehicles, weapons, properties, transactions = await asyncio.gather(
        db.teams.find({"player_id": pid}).to_list(200),
        db.employees.find({"player_id": pid}).to_list(500),
        db.vehicles.find({"player_id": pid}).to_list(300),
        db.weapons.find({"player_id": pid}).to_list(500),
        db.properties.find({"player_id": pid}).to_list(300),
        db.transactions.find({"player_id": pid}).sort("ts", -1).to_list(2000),
    )
    gross_salary = int(sum(int(e.get("salary", 0) or 0) for e in employees))
    employer_ss = int(round(gross_salary * EMPLOYER_SOCIAL_SECURITY_RATE))
    fixed_mult = fixed_cost_multiplier(player)
    fleet_weekly = int(round(sum(
        VEHICLE_ANNUAL_FIXED_COSTS.get(v.get("model_key"), 0) / 52
        for v in vehicles
    ) * fixed_mult))
    property_weekly = int(round(sum(
        (p.get("purchase_price") or PROPERTY_TYPES.get(p.get("type_key"), {}).get("price", 0))
        * max(1, int(p.get("level", 1) or 1))
        * PROPERTY_MAINTENANCE_PCT_PER_WEEK
        for p in properties
    ) * fixed_mult))
    territory_weekly = int(round(territory_weekly_cost(player) * fixed_mult))
    weekly_fixed_total = gross_salary + employer_ss + fleet_weekly + property_weekly + territory_weekly
    return build_organization_intelligence(
        player=player,
        teams=teams,
        employees=employees,
        vehicles=vehicles,
        weapons=weapons,
        properties=properties,
        transactions=transactions,
        weekly_fixed_total=weekly_fixed_total,
        now=now_utc(),
    )


@router.post("/quote")
async def organization_quote(body: OrganizationQuoteInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    payload = dict(body.payload or {})
    entity = None
    if body.action.startswith("vehicle_"):
        raw_id = payload.get("id") or payload.get("vehicle_id")
        if raw_id:
            entity = await db.vehicles.find_one({"_id": _oid(raw_id, "Veículo inválido"), "player_id": pid})
            if not entity:
                raise HTTPException(status_code=404, detail="Veículo não encontrado")
    elif body.action == "weapon_upgrade":
        raw_id = payload.get("weapon_id") or payload.get("id")
        if raw_id:
            entity = await db.weapons.find_one({"_id": _oid(raw_id, "Arma inválida"), "player_id": pid})
            if not entity:
                raise HTTPException(status_code=404, detail="Arma não encontrada")
    elif body.action == "property_module":
        raw_id = payload.get("property_id")
        if raw_id:
            entity = await db.properties.find_one({"_id": _oid(raw_id, "Imóvel inválido"), "player_id": pid})
            if not entity:
                raise HTTPException(status_code=404, detail="Imóvel não encontrado")
    employees = properties = []
    if body.action == "protection":
        employees, properties = await asyncio.gather(
            db.employees.find({"player_id": pid}).to_list(500),
            db.properties.find({"player_id": pid}).to_list(300),
        )
    return quote_action(
        action=body.action,
        player=player,
        payload=payload,
        employees=employees,
        properties=properties,
        entity=entity,
    )


@router.get("/policy")
async def get_organization_policy(user: dict = Depends(get_current_user)):
    return organization_policy(await _player(user))


@router.post("/policy")
@idempotent("policy.update")
async def set_organization_policy(body: OrganizationPolicyInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    targets = {
        key: max(0, min(10000, int(value or 0)))
        for key, value in body.stock_targets.items()
        if key in SUPPLY_CATALOG
    }
    allowed_auto = {"enabled", "auto_restock", "renew_insurance", "preventive_service"}
    automation = {key: bool(value) for key, value in body.automation.items() if key in allowed_auto}
    policy = {
        "reserve_cash": int(body.reserve_cash),
        "max_single_spend_pct": float(body.max_single_spend_pct),
        "stock_targets": targets,
        "automation": automation,
    }
    await db.players.update_one({"_id": player["_id"]}, {"$set": {"organization_policy": policy}})
    return {"ok": True, "policy": organization_policy({**player, "organization_policy": policy})}


@router.post("/automation/run")
async def run_automation_now(user: dict = Depends(get_current_user)):
    player = await _player(user)
    return await run_organization_automation(
        db, player, now=now_utc(), add_event=add_event, record_tx=record_tx, force=True,
    )


@router.get("/audit")
async def organization_audit(user: dict = Depends(get_current_user), limit: int = 50):
    player = await _player(user)
    rows = await db.organization_audit.find(
        {"player_user_id": str(user["_id"])}
    ).sort("ts", -1).to_list(max(1, min(200, int(limit or 50))))
    return {
        "items": [
            {
                "id": str(row["_id"]),
                "action": row.get("action"),
                "payload": row.get("payload") or {},
                "result": row.get("result") or {},
                "ts": row.get("ts"),
            }
            for row in rows
        ]
    }


@router.post("/inventory/buy")
@idempotent("inventory.buy")
async def buy_supply(body: SupplyTradeInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    cfg = SUPPLY_CATALOG.get(body.item_key)
    if not cfg:
        raise HTTPException(status_code=400, detail="Consumível inválido")
    if player.get("level", 1) < cfg["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {cfg['min_level']}")
    props = await db.properties.find({"player_id": str(player["_id"])}).to_list(200)
    inv = normalize_inventory(player)
    units = cfg["pack"] * body.packs
    projected = dict(inv)
    projected[body.item_key] += units
    capacity = inventory_capacity(player, props)
    if inventory_used(projected) > capacity:
        raise HTTPException(status_code=400, detail="Armazenamento insuficiente — melhora Armazéns/Logística")
    cost = cfg["price"] * body.packs
    await _debit(player, cost, stat="supply_purchases")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {f"inventory.{body.item_key}": units}})
    await record_tx(db, str(player["_id"]), "supply_buy", -cost, "clean", player["clean_money"], f"{cfg['name']} ×{units}")
    await add_event(db, str(player["_id"]), "shop", f"Logística recebeu {cfg['name']} ×{units} por {cost:,} €.")
    return {"ok": True, "item_key": body.item_key, "units": units, "cost": cost}


@router.post("/inventory/sell")
@idempotent("inventory.sell")
async def sell_supply(body: SupplyTradeInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    cfg = SUPPLY_CATALOG.get(body.item_key)
    if not cfg:
        raise HTTPException(status_code=400, detail="Consumível inválido")
    units = cfg["pack"] * body.packs
    path = f"inventory.{body.item_key}"
    fresh = await db.players.find_one_and_update(
        {"_id": player["_id"], path: {"$gte": units}},
        {"$inc": {path: -units, "clean_money": int(cfg["price"] * body.packs * 0.45)}},
        return_document=ReturnDocument.AFTER,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Stock insuficiente")
    value = int(cfg["price"] * body.packs * 0.45)
    await record_tx(db, str(player["_id"]), "supply_sell", value, "clean", fresh["clean_money"], f"Venda de {cfg['name']} ×{units}")
    return {"ok": True, "value": value}


@router.post("/teams/rename")
@idempotent("teams.rename")
async def rename_team(body: TeamRenameInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    team = await db.teams.find_one({"_id": _oid(body.team_id, "Equipa inválida"), "player_id": str(player["_id"])})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    if team.get("status") != "idle":
        raise HTTPException(status_code=400, detail="A equipa está em operação")
    await db.teams.update_one({"_id": team["_id"]}, {"$set": {"name": body.name.strip()}})
    return {"ok": True}


@router.post("/teams/doctrine")
@idempotent("teams.doctrine")
async def set_doctrine(body: TeamDoctrineInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    if body.doctrine not in TEAM_DOCTRINES:
        raise HTTPException(status_code=400, detail="Doutrina inválida")
    result = await db.teams.update_one(
        {"_id": _oid(body.team_id, "Equipa inválida"), "player_id": str(player["_id"]), "status": "idle"},
        {"$set": {"doctrine": body.doctrine}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=400, detail="Equipa inexistente ou ocupada")
    return {"ok": True}


@router.post("/teams/policies")
@idempotent("teams.policies")
async def set_policies(body: TeamPolicyInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    clean = default_team_policies()
    for key, value in body.policies.items():
        if key not in TEAM_POLICIES:
            continue
        if key == "abort_below_pct":
            clean[key] = max(0, min(60, int(value or 0)))
        else:
            clean[key] = bool(value)
    result = await db.teams.update_one(
        {"_id": _oid(body.team_id, "Equipa inválida"), "player_id": str(player["_id"]), "status": "idle"},
        {"$set": {"policies": clean}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=400, detail="Equipa inexistente ou ocupada")
    return {"ok": True, "policies": clean}


@router.post("/teams/loadout")
@idempotent("teams.loadout")
async def set_loadout(body: TeamLoadoutInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    inv = normalize_inventory(player)
    loadout = {}
    for key, qty in body.loadout.items():
        if key not in SUPPLY_CATALOG:
            continue
        n = max(0, min(10, int(qty or 0)))
        if n > inv.get(key, 0):
            raise HTTPException(status_code=400, detail=f"Stock insuficiente de {SUPPLY_CATALOG[key]['name']}")
        if n:
            loadout[key] = n
    result = await db.teams.update_one(
        {"_id": _oid(body.team_id, "Equipa inválida"), "player_id": str(player["_id"]), "status": "idle"},
        {"$set": {"loadout": loadout}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=400, detail="Equipa inexistente ou ocupada")
    return {"ok": True, "loadout": loadout}


@router.post("/teams/dissolve")
@idempotent("teams.dissolve")
async def dissolve_team(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    team = await db.teams.find_one({"_id": _oid(body.id, "Equipa inválida"), "player_id": pid})
    if not team:
        raise HTTPException(status_code=404, detail="Equipa não encontrada")
    if team.get("status") != "idle":
        raise HTTPException(status_code=400, detail="Não podes dissolver uma equipa em operação")
    tid = str(team["_id"])
    await db.employees.update_many({"player_id": pid, "team_id": tid}, {"$set": {"team_id": None}})
    await db.vehicles.update_many({"player_id": pid, "team_id": tid}, {"$set": {"team_id": None}})
    await db.teams.delete_one({"_id": team["_id"]})
    await add_event(db, pid, "team", f"{team.get('name','Equipa')} foi dissolvida; recursos regressaram à reserva.")
    return {"ok": True}


@router.post("/weapons/reload")
@idempotent("weapons.reload")
async def reload_weapon(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    weapon = await db.weapons.find_one({"_id": _oid(body.id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    if weapon.get("employee_id"):
        emp = await db.employees.find_one({"_id": ObjectId(weapon["employee_id"]), "player_id": pid})
        if emp and emp.get("status") != "idle":
            raise HTTPException(status_code=400, detail="O portador está ocupado")
    model = WEAPON_MODELS.get(weapon["model_key"], {})
    ammo_key = WEAPON_AMMO.get(weapon["model_key"])
    capacity = int(model.get("magazine_capacity", 0) or 0)
    if not ammo_key:
        await db.weapons.update_one({"_id": weapon["_id"]}, {"$set": {"ammo_loaded": capacity}})
        return {"ok": True, "ammo_loaded": capacity, "used": 0}
    loaded = max(0, int(weapon.get("ammo_loaded", 0) or 0))
    need = max(0, capacity - loaded)
    if need <= 0:
        raise HTTPException(status_code=400, detail="Carregador já está cheio")
    available = int((player.get("inventory") or {}).get(ammo_key, 0) or 0)
    used = min(need, available)
    if used <= 0:
        raise HTTPException(status_code=400, detail=f"Sem {SUPPLY_CATALOG[ammo_key]['name']} em stock")
    await db.players.update_one({"_id": player["_id"]}, {"$inc": {f"inventory.{ammo_key}": -used}})
    await db.weapons.update_one({"_id": weapon["_id"]}, {"$set": {"ammo_loaded": loaded + used}})
    return {"ok": True, "ammo_loaded": loaded + used, "used": used}


@router.post("/weapons/upgrade")
@idempotent("weapons.upgrade")
async def upgrade_weapon(body: WeaponUpgradeInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    cfg = WEAPON_UPGRADES.get(body.upgrade_key)
    if not cfg:
        raise HTTPException(status_code=400, detail="Upgrade inválido")
    if player.get("level", 1) < cfg["min_level"]:
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {cfg['min_level']}")
    weapon = await db.weapons.find_one({"_id": _oid(body.weapon_id, "Arma inválida"), "player_id": pid})
    if not weapon:
        raise HTTPException(status_code=404, detail="Arma não encontrada")
    upgrades = list(weapon.get("upgrades") or [])
    rank = sum(1 for u in upgrades if u.get("key") == body.upgrade_key)
    if rank >= cfg["max_rank"]:
        raise HTTPException(status_code=400, detail="Upgrade já está no nível máximo")
    cost = int(cfg["cost"] * (1 + rank * 0.65))
    await _debit(player, cost, stat="weapon_upgrades")
    upgrades.append({"key": body.upgrade_key, "installed_at": now_utc().isoformat()})
    await db.weapons.update_one({"_id": weapon["_id"]}, {"$set": {"upgrades": upgrades}})
    await record_tx(db, pid, "weapon_upgrade", -cost, "clean", player["clean_money"], f"{cfg['name']} em {weapon.get('name','arma')}")
    return {"ok": True, "cost": cost, "rank": rank + 1}


@router.post("/vehicles/service")
@idempotent("vehicles.service")
async def service_vehicle(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if vehicle.get("seized_until"):
        try:
            if datetime.fromisoformat(vehicle["seized_until"]) > now_utc():
                raise HTTPException(status_code=400, detail="Veículo apreendido")
        except ValueError:
            pass
    if vehicle.get("team_id"):
        team = await db.teams.find_one({"_id": ObjectId(vehicle["team_id"]), "player_id": pid})
        if team and team.get("status") != "idle":
            raise HTTPException(status_code=400, detail="Veículo ocupado")
    missing = max(0.0, 100 - float(vehicle.get("condition", 100) or 0))
    base_cost = max(120, int(vehicle.get("price", 0) * VEHICLE_LIFECYCLE["service_base_pct"] + missing * 8))
    inv = normalize_inventory(player)
    use_fluids = int(inv.get("service_fluids", 0) or 0) > 0
    use_parts = missing >= 20 and int(inv.get("vehicle_parts", 0) or 0) > 0
    material_credit = (
        (int(SUPPLY_CATALOG["service_fluids"]["price"]) if use_fluids else 0)
        + (int(SUPPLY_CATALOG["vehicle_parts"]["price"]) if use_parts else 0)
    )
    cost = max(60, base_cost - int(material_credit * 0.70))
    await _debit(player, cost, stat="vehicle_services")
    inventory_inc = {}
    if use_fluids:
        inventory_inc["inventory.service_fluids"] = -1
    if use_parts:
        inventory_inc["inventory.vehicle_parts"] = -1
    if inventory_inc:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": inventory_inc})
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {
        "condition": min(100.0, float(vehicle.get("condition", 100)) + 18),
        "last_service_km": float(vehicle.get("km_total", 0) or 0),
        "missions_since_repair": 0,
    }, "$inc": {"repair_spent_total": cost}})
    materials = [name for flag, name in ((use_fluids, "consumíveis"), (use_parts, "peças")) if flag]
    note = f"Revisão de {vehicle.get('name','veículo')}"
    if materials:
        note += " · stock: " + " + ".join(materials)
    await record_tx(db, pid, "vehicle_service", -cost, "clean", player["clean_money"], note)
    return {"ok": True, "cost": cost, "base_cost": base_cost, "used_stock": materials}


@router.post("/vehicles/tires")
@idempotent("vehicles.tires")
async def replace_tires(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    inv = normalize_inventory(player)
    if inv["tire_set"] > 0:
        await db.players.update_one({"_id": player["_id"]}, {"$inc": {"inventory.tire_set": -1}})
        cost = 0
    else:
        cost = SUPPLY_CATALOG["tire_set"]["price"]
        await _debit(player, cost, stat="vehicle_tires")
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"tires_pct": 100.0}})
    return {"ok": True, "cost": cost}


@router.post("/vehicles/insurance")
@idempotent("vehicles.insurance")
async def insure_vehicle(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    cost = max(80, int(vehicle.get("price", 0) * VEHICLE_LIFECYCLE["insurance_week_pct"] * 4))
    await _debit(player, cost, stat="vehicle_insurance")
    until = (now_utc() + timedelta(days=VEHICLE_LIFECYCLE["insurance_days"])).isoformat()
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"insurance_until": until}})
    return {"ok": True, "cost": cost, "insurance_until": until}


@router.post("/vehicles/inspection")
@idempotent("vehicles.inspection")
async def inspect_vehicle(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    if vehicle.get("condition", 100) < 55 or vehicle.get("tires_pct", 100) < 35:
        raise HTTPException(status_code=400, detail="Veículo reprova: melhora condição e pneus primeiro")
    cost = VEHICLE_LIFECYCLE["inspection_base"]
    await _debit(player, cost, stat="vehicle_inspections")
    until = (now_utc() + timedelta(days=VEHICLE_LIFECYCLE["inspection_days"])).isoformat()
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"inspection_due_at": until}})
    return {"ok": True, "cost": cost, "inspection_due_at": until}


@router.post("/properties/module")
@idempotent("properties.module")
async def upgrade_property_module(body: PropertyModuleInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    cfg = PROPERTY_MODULES.get(body.module_key)
    if not cfg:
        raise HTTPException(status_code=400, detail="Módulo inválido")
    prop = await db.properties.find_one({"_id": _oid(body.property_id, "Imóvel inválido"), "player_id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado")
    field = f"{body.module_key}_level"
    current = int(prop.get(field, 0) or 0)
    if current >= cfg["max_level"]:
        raise HTTPException(status_code=400, detail="Módulo já está no máximo")
    cost = int(cfg["base_cost"] * (1 + current * 0.75) * float(prop.get("market_multiplier", 1.0) or 1.0))
    await _debit(player, cost, stat="property_module_upgrades")
    await db.properties.update_one({"_id": prop["_id"]}, {"$set": {field: current + 1}})
    await record_tx(db, pid, "property_module", -cost, "clean", player["clean_money"], f"{cfg['name']} em {prop.get('name','imóvel')}")
    return {"ok": True, "cost": cost, "level": current + 1}


@router.post("/properties/staff")
@idempotent("properties.staff")
async def assign_property_staff(body: PropertyStaffInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    prop = await db.properties.find_one({"_id": _oid(body.property_id, "Imóvel inválido"), "player_id": pid})
    if not prop:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado")
    ids = list(dict.fromkeys(body.employee_ids))[:4]
    employees = []
    if ids:
        oid_list = [_oid(eid, "Operacional inválido") for eid in ids]
        employees = await db.employees.find({"_id": {"$in": oid_list}, "player_id": pid}).to_list(10)
        if len(employees) != len(ids):
            raise HTTPException(status_code=400, detail="Um ou mais operacionais são inválidos")
        blocked = [
            e["name"] for e in employees
            if e.get("status") != "idle"
            or e.get("team_id")
            or (e.get("stationed_property_id") and e.get("stationed_property_id") != body.property_id)
        ]
        if blocked:
            raise HTTPException(status_code=400, detail="Só podes destacar operacionais livres: " + ", ".join(blocked))
    old_ids = list(prop.get("staff_employee_ids") or [])
    if old_ids:
        await db.employees.update_many(
            {"player_id": pid, "_id": {"$in": [ObjectId(eid) for eid in old_ids]}},
            {"$set": {"stationed_property_id": None}},
        )
    staff_roles, staff_effectiveness = _property_staff_profile(employees)
    await db.properties.update_one({"_id": prop["_id"]}, {"$set": {
        "staff_employee_ids": ids,
        "staff_roles": staff_roles,
        "staff_effectiveness": staff_effectiveness,
    }})
    if ids:
        await db.employees.update_many(
            {"player_id": pid, "_id": {"$in": [ObjectId(eid) for eid in ids]}},
            {"$set": {"stationed_property_id": body.property_id}},
        )
    await db.organization_audit.insert_one({
        "player_user_id": str(user["_id"]),
        "action": "properties.staff_profile",
        "payload": {"property_id": body.property_id},
        "result": {"staff_roles": staff_roles, "staff_effectiveness": staff_effectiveness},
        "ts": now_utc().isoformat(),
    })
    return {
        "ok": True,
        "staff_employee_ids": ids,
        "staff_roles": staff_roles,
        "staff_effectiveness": staff_effectiveness,
    }


@router.post("/departments/upgrade")
@idempotent("departments.upgrade")
async def upgrade_department(body: DepartmentInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    cfg = DEPARTMENTS.get(body.department_key)
    if not cfg:
        raise HTTPException(status_code=400, detail="Departamento inválido")
    if int(player.get("hq", {}).get("level", 1)) < cfg["unlock_hq"]:
        raise HTTPException(status_code=400, detail=f"Requer QG nível {cfg['unlock_hq']}")
    current = department_level(player, body.department_key)
    if current >= cfg["max_level"]:
        raise HTTPException(status_code=400, detail="Departamento no nível máximo")
    nxt = current + 1
    cost = department_cost(body.department_key, nxt)
    await _debit(player, cost, stat="department_upgrades")
    await db.players.update_one({"_id": player["_id"]}, {"$set": {f"departments.{body.department_key}": nxt}})
    await record_tx(db, str(player["_id"]), "department_upgrade", -cost, "clean", player["clean_money"], f"{cfg['name']} N{nxt}")
    return {"ok": True, "level": nxt, "cost": cost}


@router.post("/territories/claim")
@idempotent("territories.claim")
async def claim_territory(body: TerritoryInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    if int(player.get("level", 1)) < 5:
        raise HTTPException(status_code=400, detail="Controlo territorial desbloqueia no nível 5")
    districts = {d.get("name") or d.get("key"): d for d in (player.get("districts") or [])}
    if body.district not in districts:
        raise HTTPException(status_code=400, detail="Distrito operacional inválido")
    if body.district in (player.get("territories") or {}):
        raise HTTPException(status_code=400, detail="Já tens presença nesta zona")
    cfg = TERRITORY_TIERS[1]
    await _debit(player, cfg["cost"], stat="territories_claimed")
    info = {"tier": 1, "pressure": 10.0, "defense": 70.0, "claimed_at": now_utc().isoformat()}
    await db.players.update_one({"_id": player["_id"]}, {"$set": {f"territories.{body.district}": info}})
    await record_tx(db, str(player["_id"]), "territory_claim", -cfg["cost"], "clean", player["clean_money"], f"Presença territorial: {body.district}")
    return {"ok": True, "territory": info}


@router.post("/territories/consolidate")
@idempotent("territories.consolidate")
async def consolidate_territory(body: TerritoryInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    info = dict((player.get("territories") or {}).get(body.district) or {})
    current = int(info.get("tier", 0) or 0)
    if current <= 0:
        raise HTTPException(status_code=400, detail="Ainda não controlas esta zona")
    if current >= 3:
        raise HTTPException(status_code=400, detail="Território já está no máximo")
    nxt = current + 1
    cost = TERRITORY_TIERS[nxt]["cost"]
    await _debit(player, cost, stat="territories_consolidated")
    info.update({"tier": nxt, "pressure": min(100.0, float(info.get("pressure", 0)) + 12), "defense": 100.0})
    await db.players.update_one({"_id": player["_id"]}, {"$set": {f"territories.{body.district}": info}})
    return {"ok": True, "territory": info, "cost": cost}


@router.post("/territories/defend")
@idempotent("territories.defend")
async def defend_territory(body: TerritoryInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    info = dict((player.get("territories") or {}).get(body.district) or {})
    tier = int(info.get("tier", 0) or 0)
    if tier <= 0:
        raise HTTPException(status_code=400, detail="Território não controlado")
    cost = max(500, int(TERRITORY_TIERS[tier]["defense_weekly"] * 1.5))
    await _debit(player, cost, stat="territories_defended")
    info["defense"] = 100.0
    info["pressure"] = max(0.0, float(info.get("pressure", 0)) - 22)
    info["last_defended_at"] = now_utc().isoformat()
    await db.players.update_one({"_id": player["_id"]}, {"$set": {f"territories.{body.district}": info}})
    return {"ok": True, "cost": cost, "territory": info}


@router.get("/vehicles/{vehicle_id}/lifecycle")
async def vehicle_lifecycle(vehicle_id: str, user: dict = Depends(get_current_user)):
    player = await _player(user)
    vehicle = await db.vehicles.find_one({"_id": _oid(vehicle_id, "Veículo inválido"), "player_id": str(player["_id"])})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")
    return vehicle_service_snapshot(vehicle)


class PrestigeInput(MutationInput):
    item_key: str


@router.post("/prestige/buy")
@idempotent("prestige.buy")
async def buy_prestige(body: PrestigeInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    cfg = PRESTIGE_CATALOG.get(body.item_key)
    if not cfg:
        raise HTTPException(status_code=400, detail="Investimento de prestígio inválido")
    if int(player.get("level", 1) or 1) < int(cfg.get("unlock_level", 1) or 1):
        raise HTTPException(status_code=400, detail=f"Desbloqueia no nível {cfg.get('unlock_level', 1)}")
    if body.item_key in set(player.get("prestige_items") or []):
        raise HTTPException(status_code=400, detail="Investimento já adquirido")
    cost = int(cfg["cost"])
    await _debit(player, cost, stat="prestige_purchases")
    await db.players.update_one({"_id": player["_id"]}, {"$addToSet": {"prestige_items": body.item_key}})
    await record_tx(db, str(player["_id"]), "prestige", -cost, "clean", player["clean_money"], cfg["name"])
    return {"ok": True, "cost": cost}


@router.post("/governance/protection")
@idempotent("governance.protection")
async def buy_protection(body: MutationInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    employees, properties = await asyncio.gather(
        db.employees.count_documents({"player_id": pid}),
        db.properties.count_documents({"player_id": pid}),
    )
    cost = protection_cost(player, employees, properties)
    if cost <= 0:
        raise HTTPException(status_code=400, detail="Rede de proteção desbloqueia no nível 5")
    await _debit(player, cost, stat="protection_payments")
    until = (now_utc() + timedelta(days=30)).isoformat()
    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "governance.protection_until": until,
        "governance.last_cost": cost,
    }})
    await record_tx(db, pid, "protection", -cost, "clean", player["clean_money"], "Rede de proteção — 30 dias")
    return {"ok": True, "cost": cost, "protection_until": until}


@router.get("/finance/summary")
async def finance_summary(user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    now = now_utc()
    cutoff = now - timedelta(days=30)
    transactions, vehicles, weapons, properties, employees = await asyncio.gather(
        db.transactions.find({"player_id": pid}).sort("ts", -1).to_list(1000),
        db.vehicles.find({"player_id": pid}).to_list(200),
        db.weapons.find({"player_id": pid}).to_list(300),
        db.properties.find({"player_id": pid}).to_list(200),
        db.employees.find({"player_id": pid}).to_list(300),
    )
    recent = []
    for tx in transactions:
        try:
            ts = datetime.fromisoformat(tx.get("ts"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts >= cutoff:
                recent.append(tx)
        except (TypeError, ValueError):
            continue
    income = sum(float(tx.get("amount", 0) or 0) for tx in recent if float(tx.get("amount", 0) or 0) > 0)
    expenses = -sum(float(tx.get("amount", 0) or 0) for tx in recent if float(tx.get("amount", 0) or 0) < 0)
    by_kind = {}
    for tx in recent:
        key = tx.get("kind") or "other"
        by_kind[key] = round(by_kind.get(key, 0.0) + float(tx.get("amount", 0) or 0), 2)
    property_value = sum(int(p.get("purchase_price", 0) or 0) * max(1, int(p.get("level", 1) or 1)) for p in properties)
    fleet_value = sum(int(v.get("price", 0) or 0) * max(0, float(v.get("condition", 100) or 0)) / 100.0 for v in vehicles)
    weapon_value = sum(int(WEAPON_MODELS.get(w.get("model_key"), {}).get("price", 0) or 0) * max(0, float(w.get("condition", 100) or 0)) / 100.0 for w in weapons)
    return {
        "window_days": 30,
        "income": round(income),
        "expenses": round(expenses),
        "net": round(income - expenses),
        "by_kind": by_kind,
        "asset_value": round(property_value + fleet_value + weapon_value),
        "property_value": round(property_value),
        "fleet_value": round(fleet_value),
        "weapon_value": round(weapon_value),
        "headcount": len(employees),
        "cash": int(player.get("clean_money", 0) or 0),
        "dirty_cash": int(player.get("dirty_money", 0) or 0),
    }
