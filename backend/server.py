from dotenv import load_dotenv
from pathlib import Path
from datetime import timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import random
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import client, db
from auth import router as auth_router, seed_admin
from routes_game import router as game_router
from routes_mastermind import router as mastermind_router
from routes_admin import router as admin_router
from routes_legal import router as legal_router
from routes_organization import router as organization_router
from routes_city import router as city_router
from engine import vehicle_doc, starting_employee, gen_attrs, now_utc, default_stats
from game_data import SPECIALIZATIONS, HQ_DEFAULT_PRIORITY, WEAPON_MODELS
from road_routing import road_router

app = FastAPI(title="SUBMUNDO API")

app.include_router(auth_router)
app.include_router(game_router)
app.include_router(mastermind_router)
app.include_router(admin_router)
app.include_router(legal_router)
app.include_router(organization_router)
app.include_router(city_router)


@app.get("/api/")
async def root():
    return {"message": "SUBMUNDO API", "status": "operational"}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


async def migrate_v2():
    async for player in db.players.find({"v2": {"$ne": True}}):
        pid = str(player["_id"])
        now = now_utc().isoformat()
        teams = await db.teams.find({"player_id": pid}).to_list(100)
        for t in teams:
            if "vehicle_id" in t:
                continue
            old_key = (t.get("vehicle") or {}).get("key", "usado")
            model_key = old_key if old_key in ("usado", "moto", "van", "desportivo", "supercarro") else "usado"
            res = await db.vehicles.insert_one(vehicle_doc(pid, model_key, now, team_id=str(t["_id"])))
            await db.teams.update_one({"_id": t["_id"]}, {
                "$set": {"vehicle_id": str(res.inserted_id), "spec": t.get("spec", "assalto")},
                "$unset": {"vehicle": "", "skill": "", "type_key": ""},
            })
        emp_count = await db.employees.count_documents({"player_id": pid})
        if emp_count == 0 and teams:
            tid = str(teams[0]["_id"])
            for role in ("assaltante", "motorista"):
                await db.employees.insert_one(starting_employee(pid, role, now, team_id=tid))
        await db.players.update_one({"_id": player["_id"]}, {"$set": {
            "v2": True, "frac_dirty": 0.0, "frac_clean": 0.0, "frac_launder": 0.0,
        }})
    await db.players.update_many({"stats": {"$exists": False}}, {"$set": {"stats": default_stats()}})
    # Nota: contas em onboarding têm hq=null (ainda sem QG escolhido) — o
    # filtro exige um hq objeto para não tentar criar campos dentro de null.
    await db.players.update_many(
        {"hq": {"$type": "object"}, "hq.level": {"$exists": False}},
        {"$set": {"hq.level": 1, "hq.upgrading_until": None, "hq.upgrade_history": []}},
    )
    await db.players.update_many({"priorities": {"$exists": False}}, {"$set": {
        "priorities": {"active": HQ_DEFAULT_PRIORITY},
    }})


ROLE_MAP_V4 = {"musculo": "assaltante", "condutor": "motorista", "hacker": "hacker", "negociador": "negociador"}


async def migrate_integrated_org():
    """Add safe defaults to saves created before the organization systems."""
    now = now_utc()
    await db.players.update_many({"inventory": {"$exists": False}}, {"$set": {"inventory": {}}})
    await db.players.update_many({"departments": {"$exists": False}}, {"$set": {"departments": {}}})
    await db.players.update_many({"territories": {"$exists": False}}, {"$set": {"territories": {}}})
    await db.players.update_many({"prestige_items": {"$exists": False}}, {"$set": {"prestige_items": []}})
    await db.players.update_many({"governance": {"$exists": False}}, {"$set": {"governance": {}}})
    await db.players.update_many({"organization_policy": {"$exists": False}}, {"$set": {
        "organization_policy": {
            "reserve_cash": 25000,
            "max_single_spend_pct": 0.35,
            "stock_targets": {},
            "weekly_budgets": {
                "supplies": 0,
                "fleet": 0,
                "infrastructure": 0,
                "territory": 0,
                "people": 0,
            },
            "automation": {
                "enabled": False,
                "auto_restock": False,
                "renew_insurance": False,
                "preventive_service": False,
            },
        },
    }})
    await db.teams.update_many({"doctrine": {"$exists": False}}, {"$set": {"doctrine": "balanced"}})
    await db.teams.update_many({"policies": {"$exists": False}}, {"$set": {"policies": {
        "abort_below_pct": 0, "protect_injured": True,
        "auto_use_medical": True, "auto_use_armor": True,
    }}})
    await db.teams.update_many({"loadout": {"$exists": False}}, {"$set": {"loadout": {}}})
    await db.employees.update_many({"stress": {"$exists": False}}, {"$set": {"stress": 10.0}})
    await db.employees.update_many({"traits": {"$exists": False}}, {"$set": {"traits": []}})
    await db.employees.update_many({"relations": {"$exists": False}}, {"$set": {"relations": {}}})
    await db.employees.update_many({"stationed_property_id": {"$exists": False}}, {"$set": {"stationed_property_id": None}})
    await db.properties.update_many({"security_level": {"$exists": False}}, {"$set": {"security_level": 0}})
    await db.properties.update_many({"storage_level": {"$exists": False}}, {"$set": {"storage_level": 0}})
    await db.properties.update_many({"operations_level": {"$exists": False}}, {"$set": {"operations_level": 0}})
    await db.properties.update_many({"staff_employee_ids": {"$exists": False}}, {"$set": {"staff_employee_ids": []}})
    await db.properties.update_many({"staff_roles": {"$exists": False}}, {"$set": {"staff_roles": {}}})
    await db.properties.update_many({"staff_effectiveness": {"$exists": False}}, {"$set": {"staff_effectiveness": 0.0}})
    await db.vehicles.update_many({"last_service_km": {"$exists": False}}, {"$set": {"last_service_km": 0.0}})
    await db.vehicles.update_many({"tires_pct": {"$exists": False}}, {"$set": {"tires_pct": 100.0}})
    await db.vehicles.update_many({"notoriety": {"$exists": False}}, {"$set": {"notoriety": 0.0}})
    await db.vehicles.update_many({"seized_until": {"$exists": False}}, {"$set": {"seized_until": None}})
    inspection_due = (now + timedelta(days=365)).isoformat()
    await db.vehicles.update_many({"inspection_due_at": {"$exists": False}}, {"$set": {"inspection_due_at": inspection_due}})
    await db.vehicles.update_many({"insurance_until": {"$exists": False}}, {"$set": {"insurance_until": None}})
    for model_key, model in WEAPON_MODELS.items():
        await db.weapons.update_many(
            {"model_key": model_key, "ammo_loaded": {"$exists": False}},
            {"$set": {"ammo_loaded": int(model.get("magazine_capacity", 0) or 0)}},
        )
    await db.weapons.update_many({"upgrades": {"$exists": False}}, {"$set": {"upgrades": []}})


async def migrate_v4():
    async for emp in db.employees.find({"rarity": {"$exists": False}}):
        role_key = ROLE_MAP_V4.get(emp.get("role_key"), "assaltante")
        sp = SPECIALIZATIONS[role_key]
        level = emp.get("level", 1)
        attrs = gen_attrs(role_key, "comum")
        for a in sp["attrs"]:
            attrs[a] = min(10, attrs[a] + max(0, level - 1))
        await db.employees.update_one({"_id": emp["_id"]}, {"$set": {
            "role_key": role_key, "spec": sp["spec"], "rarity": "comum", "rank": "recruta",
            "age": random.randint(22, 45), "salary": sp["salary"], "loyalty": 70.0, "morale": 70.0,
            "attrs": attrs, "talents": [], "status_until": None,
            "history": [{"ts": now_utc().isoformat(), "text": "Registo migrado para o novo sistema de RH."}],
        }})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("google_sub", unique=True, sparse=True)
    await db.login_attempts.create_index("identifier")
    await db.players.create_index("user_id")
    await db.teams.create_index("player_id")
    await db.employees.create_index("player_id")
    await db.candidates.create_index("player_id")
    await db.vehicles.create_index("player_id")
    await db.weapons.create_index("player_id")
    await db.weapons.create_index([("player_id", 1), ("employee_id", 1)])
    await db.properties.create_index("player_id")
    await db.opportunities.create_index([("player_id", 1), ("status", 1)])
    await db.missions.create_index([("player_id", 1), ("phase", 1)])
    await db.events.create_index([("player_id", 1), ("ts", -1)])
    await db.transactions.create_index([("player_id", 1), ("ts", -1)])
    await db.action_receipts.create_index("key", unique=True)
    await db.action_receipts.create_index("expires_at", expireAfterSeconds=0)
    await db.organization_audit.create_index([("player_user_id", 1), ("ts", -1)])
    await db.city_businesses.create_index([("player_id", 1), ("type_key", 1)])
    await db.city_rivals.create_index([("player_id", 1), ("key", 1)], unique=True)
    await db.city_season_scores.create_index([("season_id", 1), ("points", -1)])
    await db.city_season_scores.create_index([("player_id", 1), ("season_id", 1)], unique=True)
    await db.city_chat.create_index([("ts", -1)])
    await db.city_alliances.create_index("code", unique=True)
    await db.city_alliances.create_index("member_ids")
    await db.city_pvp_challenges.create_index([("defender_id", 1), ("status", 1)])
    await db.quests.create_index([("player_id", 1), ("status", 1)])
    await db.road_routes.create_index("key", unique=True)
    await db.road_routes.create_index("expires_at")
    await seed_admin()
    await migrate_v2()
    await migrate_v4()
    await migrate_integrated_org()


@app.on_event("shutdown")
async def shutdown_db_client():
    await road_router.close()
    client.close()
