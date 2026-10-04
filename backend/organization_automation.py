"""Conservative organization automation.

Runs from the normal game tick and can also be invoked manually.  It never
spends below the player's configured reserve and all writes use conditional
queries so concurrent sessions cannot overspend the same cash.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import ceil

from organization_intelligence import organization_policy
from organization_systems import (
    SUPPLY_CATALOG, VEHICLE_LIFECYCLE,
    inventory_capacity, inventory_used, normalize_inventory,
    logistics_cost_multiplier, supply_cost_multiplier,
)


def _parse_dt(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


async def run_organization_automation(db, player, *, now=None, add_event=None, record_tx=None, force=False):
    now = now or datetime.now(timezone.utc)
    policy = organization_policy(player)
    auto = policy["automation"]
    if not force and (not auto.get("enabled")):
        return {"ok": True, "skipped": "disabled", "actions": []}

    last = _parse_dt(player.get("organization_automation_last_at"))
    if not force and last and now - last < timedelta(minutes=15):
        return {"ok": True, "skipped": "cooldown", "actions": []}

    pid = str(player["_id"])
    teams = await db.teams.find({"player_id": pid}).to_list(200)
    properties = await db.properties.find({"player_id": pid}).to_list(300)
    vehicles = await db.vehicles.find({"player_id": pid}).to_list(300)
    inventory = normalize_inventory(player)
    cash = int(player.get("clean_money", 0) or 0)
    reserve = int(policy["reserve_cash"])
    actions = []

    async def spend(amount, inc=None):
        nonlocal cash
        amount = max(0, int(amount))
        if amount <= 0:
            return True
        if cash - amount < reserve:
            return False
        update = {"clean_money": -amount}
        for key, value in (inc or {}).items():
            update[key] = update.get(key, 0) + value
        result = await db.players.update_one(
            {"_id": player["_id"], "clean_money": {"$gte": amount + reserve}},
            {"$inc": update},
        )
        if result.modified_count != 1:
            return False
        cash -= amount
        player["clean_money"] = cash
        return True

    if auto.get("auto_restock"):
        targets = dict(policy.get("stock_targets") or {})
        # If the player did not set a target, three configured dispatches are
        # the sensible baseline for materials actually used by crews.
        reserved = {key: 0 for key in SUPPLY_CATALOG}
        for team in teams:
            for key, qty in (team.get("loadout") or {}).items():
                if key in reserved:
                    reserved[key] += max(0, int(qty or 0))
        for key, cfg in SUPPLY_CATALOG.items():
            target = max(int(targets.get(key, 0) or 0), reserved[key] * 3)
            current = int(inventory.get(key, 0) or 0)
            if target <= current:
                continue
            pack = max(1, int(cfg.get("pack", 1) or 1))
            packs = max(1, ceil((target - current) / pack))
            projected = dict(inventory)
            projected[key] = current + packs * pack
            while packs > 0 and inventory_used(projected) > inventory_capacity(player, properties):
                packs -= 1
                projected[key] = current + packs * pack
            if packs <= 0:
                continue
            cost = max(1, int(cfg["price"] * packs * supply_cost_multiplier(player, now)))
            units = packs * pack
            if not await spend(cost, {f"inventory.{key}": units}):
                continue
            inventory[key] = current + units
            player.setdefault("inventory", {})[key] = inventory[key]
            actions.append({"type": "restock", "item_key": key, "units": units, "cost": cost})
            if record_tx:
                await record_tx(db, pid, "automation_restock", -cost, "clean", cash, f"Auto-stock: {cfg['name']} ×{units}")

    team_by_id = {str(team["_id"]): team for team in teams}

    if auto.get("renew_insurance"):
        for vehicle in vehicles:
            until = _parse_dt(vehicle.get("insurance_until"))
            if until and until - now > timedelta(days=3):
                continue
            cost = max(80, int(float(vehicle.get("price", 0) or 0) * VEHICLE_LIFECYCLE["insurance_week_pct"] * 4))
            if not await spend(cost):
                continue
            new_until = now + timedelta(days=VEHICLE_LIFECYCLE["insurance_days"])
            await db.vehicles.update_one({"_id": vehicle["_id"]}, {"$set": {"insurance_until": new_until.isoformat()}})
            actions.append({"type": "insurance", "vehicle_id": str(vehicle["_id"]), "name": vehicle.get("name"), "cost": cost})
            if record_tx:
                await record_tx(db, pid, "automation_insurance", -cost, "clean", cash, f"Auto-seguro: {vehicle.get('name','veículo')}")

    if auto.get("preventive_service"):
        for vehicle in vehicles:
            team = team_by_id.get(str(vehicle.get("team_id"))) if vehicle.get("team_id") else None
            if team and team.get("status") != "idle":
                continue
            condition = float(vehicle.get("condition", 100) or 0)
            km_since = float(vehicle.get("km_total", 0) or 0) - float(vehicle.get("last_service_km", 0) or 0)
            if condition >= 65 and km_since < VEHICLE_LIFECYCLE["service_interval_km"] - 500:
                continue
            missing = max(0.0, 100 - condition)
            base_cost = max(120, int(float(vehicle.get("price", 0) or 0) * VEHICLE_LIFECYCLE["service_base_pct"] + missing * 8))
            use_fluids = int(inventory.get("service_fluids", 0) or 0) > 0
            use_parts = missing >= 20 and int(inventory.get("vehicle_parts", 0) or 0) > 0
            material_credit = (
                (int(SUPPLY_CATALOG["service_fluids"]["price"]) if use_fluids else 0)
                + (int(SUPPLY_CATALOG["vehicle_parts"]["price"]) if use_parts else 0)
            )
            cost = max(60, base_cost - int(material_credit * 0.70))
            inc = {}
            if use_fluids:
                inc["inventory.service_fluids"] = -1
            if use_parts:
                inc["inventory.vehicle_parts"] = -1
            if not await spend(cost, inc):
                continue
            if use_fluids:
                inventory["service_fluids"] -= 1
                player.setdefault("inventory", {})["service_fluids"] = inventory["service_fluids"]
            if use_parts:
                inventory["vehicle_parts"] -= 1
                player.setdefault("inventory", {})["vehicle_parts"] = inventory["vehicle_parts"]
            await db.vehicles.update_one({"_id": vehicle["_id"]}, {
                "$set": {
                    "condition": min(100.0, condition + 18),
                    "last_service_km": float(vehicle.get("km_total", 0) or 0),
                    "missions_since_repair": 0,
                },
                "$inc": {"repair_spent_total": cost},
            })
            actions.append({"type": "service", "vehicle_id": str(vehicle["_id"]), "name": vehicle.get("name"), "cost": cost})
            if record_tx:
                await record_tx(db, pid, "automation_service", -cost, "clean", cash, f"Auto-revisão: {vehicle.get('name','veículo')}")

    await db.players.update_one(
        {"_id": player["_id"]},
        {"$set": {"organization_automation_last_at": now.isoformat()}},
    )
    player["organization_automation_last_at"] = now.isoformat()

    if actions and add_event:
        spent = sum(int(action.get("cost", 0) or 0) for action in actions)
        await add_event(
            db, pid, "system",
            f"Automação da organização executou {len(actions)} ação(ões) por {spent:,} € sem quebrar a reserva de caixa.",
        )
    if actions:
        await db.organization_audit.insert_one({
            "player_user_id": str(player.get("user_id") or ""),
            "action": "automation.run",
            "payload": {"force": force},
            "result": {"actions": actions, "cash_after": cash},
            "ts": now.isoformat(),
        })
    return {"ok": True, "actions": actions, "cash_after": cash, "reserve_cash": reserve}
