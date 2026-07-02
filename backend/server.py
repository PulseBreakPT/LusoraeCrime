from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from db import client, db
from auth import router as auth_router, seed_admin
from routes_game import router as game_router
from engine import vehicle_doc, employee_doc, now_utc, default_stats
from game_data import EMPLOYEE_ROLES

app = FastAPI(title="Lusorae API")

app.include_router(auth_router)
app.include_router(game_router)


@app.get("/api/")
async def root():
    return {"message": "Lusorae API", "status": "operational"}


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
            for _ in range(2):
                await db.employees.insert_one(employee_doc(pid, "musculo", now, team_id=tid))
        await db.players.update_one({"_id": player["_id"]}, {"$set": {
            "v2": True, "frac_dirty": 0.0, "frac_clean": 0.0, "frac_launder": 0.0,
        }})


async def migrate_v3():
    import random as _r
    async for emp in db.employees.find({"attrs": {"$exists": False}}):
        attrs = {k: _r.randint(1, 3) for k in ("forca", "destreza", "qi", "carisma")}
        role_attr = EMPLOYEE_ROLES.get(emp.get("role_key", "musculo"), EMPLOYEE_ROLES["musculo"])["attr"]
        attrs[role_attr] = min(10, attrs[role_attr] + 2 + max(0, emp.get("level", 1) - 1))
        await db.employees.update_one({"_id": emp["_id"]}, {"$set": {"attrs": attrs}})
    await db.players.update_many({"stats": {"$exists": False}}, {"$set": {"stats": default_stats()}})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.players.create_index("user_id")
    await db.teams.create_index("player_id")
    await db.employees.create_index("player_id")
    await db.vehicles.create_index("player_id")
    await db.properties.create_index("player_id")
    await db.opportunities.create_index([("player_id", 1), ("status", 1)])
    await db.missions.create_index([("player_id", 1), ("phase", 1)])
    await db.events.create_index([("player_id", 1), ("ts", -1)])
    await seed_admin()
    await migrate_v2()
    await migrate_v3()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
