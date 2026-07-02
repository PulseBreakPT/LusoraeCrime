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


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.players.create_index("user_id")
    await db.teams.create_index("player_id")
    await db.opportunities.create_index([("player_id", 1), ("status", 1)])
    await db.missions.create_index([("player_id", 1), ("phase", 1)])
    await db.events.create_index([("player_id", 1), ("ts", -1)])
    await seed_admin()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
