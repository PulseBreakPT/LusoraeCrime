from __future__ import annotations

from datetime import timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import db
from engine import add_event, now_utc, record_tx
from game_data import WEAPON_MODELS
from organization_systems import (
    SUPPLY_CATALOG, WEAPON_AMMO, WEAPON_UPGRADES, TEAM_DOCTRINES, TEAM_POLICIES,
    DEPARTMENTS, TERRITORY_TIERS, PROPERTY_MODULES, VEHICLE_LIFECYCLE,
    department_cost, department_level, inventory_capacity, inventory_used,
    normalize_inventory, vehicle_service_snapshot, default_team_policies,
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


async def _debit(player: dict, amount: int, *, stat: str | None = None) -> dict:
    inc = {"clean_money": -int(amount)}
    if stat:
        inc[f"stats.{stat}"] = 1
    fresh = await db.players.find_one_and_update(
        {"_id": player["_id"], "clean_money": {"$gte": int(amount)}},
        {"$inc": inc},
        return_document=True,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Dinheiro limpo insuficiente")
    player["clean_money"] = fresh["clean_money"]
    return fresh


class SupplyTradeInput(BaseModel):
    item_key: str
    packs: int = Field(default=1, ge=1, le=100)


class TeamRenameInput(BaseModel):
    team_id: str
    name: str = Field(min_length=1, max_length=40)


class TeamDoctrineInput(BaseModel):
    team_id: str
    doctrine: str


class TeamPolicyInput(BaseModel):
    team_id: str
    policies: dict


class TeamLoadoutInput(BaseModel):
    team_id: str
    loadout: dict[str, int] = Field(default_factory=dict)


class EntityIdInput(BaseModel):
    id: str


class WeaponUpgradeInput(BaseModel):
    weapon_id: str
    upgrade_key: str


class PropertyModuleInput(BaseModel):
    property_id: str
    module_key: str


class DepartmentInput(BaseModel):
    department_key: str


class TerritoryInput(BaseModel):
    district: str


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
    }


@router.post("/inventory/buy")
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
        return_document=True,
    )
    if not fresh:
        raise HTTPException(status_code=400, detail="Stock insuficiente")
    value = int(cfg["price"] * body.packs * 0.45)
    await record_tx(db, str(player["_id"]), "supply_sell", value, "clean", fresh["clean_money"], f"Venda de {cfg['name']} ×{units}")
    return {"ok": True, "value": value}


@router.post("/teams/rename")
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
async def service_vehicle(body: EntityIdInput, user: dict = Depends(get_current_user)):
    player = await _player(user)
    pid = str(player["_id"])
    vehicle = await db.vehicles.find_one({"_id": _oid(body.id, "Veículo inválido"), "player_id": pid})
    if not vehicle or vehicle.get("team_id") and (await db.teams.find_one({"_id": ObjectId(vehicle["team_id"])})).get("status") != "idle":
        raise HTTPException(status_code=400, detail="Veículo inexistente ou ocupado")
    missing = max(0.0, 100 - float(vehicle.get("condition", 100) or 0))
    cost = max(120, int(vehicle.get("price", 0) * VEHICLE_LIFECYCLE["service_base_pct"] + missing * 8))
    await _debit(player, cost, stat="vehicle_services")
    await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {
        "condition": min(100.0, float(vehicle.get("condition", 100)) + 18),
        "last_service_km": float(vehicle.get("km_total", 0) or 0),
        "missions_since_repair": 0,
    }, "$inc": {"repair_spent_total": cost}})
    await record_tx(db, pid, "vehicle_service", -cost, "clean", player["clean_money"], f"Revisão de {vehicle.get('name','veículo')}")
    return {"ok": True, "cost": cost}


@router.post("/vehicles/tires")
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


@router.post("/departments/upgrade")
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
