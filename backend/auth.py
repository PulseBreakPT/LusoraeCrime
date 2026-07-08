import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from db import db
from game_data import HQ_LOCATION, HQ_DEFAULT_PRIORITY
from engine import now_utc, add_event, vehicle_doc, starting_employee

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"
MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
# Única conta autorizada a auto-promover-se a administrador pelo botão do
# frontend — qualquer outra conta recebe 403 ao chamar /claim-admin.
SELF_CLAIM_ADMIN_EMAIL = "geral@lusorae.pt"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="lax", max_age=3600, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="lax", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizador não encontrado")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


class RegisterInput(BaseModel):
    org_name: str = Field(min_length=3, max_length=40)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class DeleteAccountInput(BaseModel):
    password: str


def user_public(user: dict) -> dict:
    return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""),
            "role": user.get("role", "player")}


async def create_player_for_user(user_id: str, org_name: str):
    # SAFEGUARD: never overwrite existing player data on restart/redeploy
    existing = await db.players.find_one({"user_id": user_id})
    if existing:
        return str(existing["_id"])

    now = now_utc().isoformat()
    result = await db.players.insert_one({
        "user_id": user_id, "org_name": org_name,
        "clean_money": 75000, "dirty_money": 5000,
        "respect": 0, "level": 1, "heat": 0.0,
        "frac_dirty": 0.0, "frac_clean": 0.0, "frac_launder": 0.0, "v2": True,
        "hq": {**HQ_LOCATION, "level": 1, "upgrading_until": None, "upgrade_history": []},
        "priorities": {"active": HQ_DEFAULT_PRIORITY},
        "last_tick": now, "created_at": now,
    })
    pid = str(result.inserted_id)
    team_res = await db.teams.insert_one({
        "player_id": pid, "name": "Crew Alfa", "spec": "assalto",
        "status": "idle", "vehicle_id": None, "missions_done": 0, "created_at": now,
        "available_at": None, "roster_stable_since": now,
    })
    tid = str(team_res.inserted_id)
    veh_res = await db.vehicles.insert_one(vehicle_doc(pid, "usado", now, team_id=tid))
    await db.teams.update_one({"_id": team_res.inserted_id}, {"$set": {"vehicle_id": str(veh_res.inserted_id)}})
    for role in ("assaltante", "motorista"):
        await db.employees.insert_one(starting_employee(pid, role, now, team_id=tid))
    await add_event(db, pid, "system", f"{org_name} estabeleceu operações em Lisboa com 75.000 € limpos e 5.000 € sujos de capital inicial.")
    await add_event(db, pid, "team", "Crew Alfa está pronta: um assaltante, um motorista e um Sedan Usado na garagem.")
    return pid


@router.post("/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Este email já está registado")
    now = now_utc().isoformat()
    result = await db.users.insert_one({
        "email": email, "password_hash": hash_password(body.password),
        "name": body.org_name, "role": "player", "created_at": now,
    })
    user_id = str(result.inserted_id)
    await create_player_for_user(user_id, body.org_name)
    access = create_access_token(user_id, email)
    refresh_tok = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh_tok)
    return {"id": user_id, "email": email, "name": body.org_name, "role": "player",
            "access_token": access, "refresh_token": refresh_tok}


@router.post("/login")
async def login(body: LoginInput, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = datetime.fromisoformat(attempt["locked_until"])
        if datetime.now(timezone.utc) < locked_until:
            raise HTTPException(status_code=429, detail="Demasiadas tentativas. Tenta novamente em alguns minutos.")
        await db.login_attempts.delete_one({"identifier": identifier})

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email ou password incorretos")

    # Verificar se o utilizador está banido
    if user.get("banned"):
        raise HTTPException(status_code=403, detail=f"Conta banida: {user.get('ban_reason', 'Motivo não especificado')}")

    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])

    # SAFEGUARD: ensure player exists (recovery from database loss on restart/redeploy)
    player = await db.players.find_one({"user_id": user_id})
    if not player:
        await create_player_for_user(user_id, user.get("name", "Organização Recuperada"))

    access = create_access_token(user_id, email)
    refresh_tok = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh_tok)
    return {**user_public(user), "access_token": access, "refresh_token": refresh_tok}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public({**user, "_id": user["_id"]})


@router.post("/claim-admin")
async def claim_admin(user: dict = Depends(get_current_user)):
    """Auto-promoção a administrador — restrita a uma única conta autorizada."""
    if user["email"] != SELF_CLAIM_ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Esta conta não tem permissão para se tornar administradora")
    if user.get("role") == "admin":
        return {"ok": True, "role": "admin", "message": "Esta conta já é administradora"}
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"role": "admin"}})
    await db.admin_logs.insert_one({
        "admin_id": user["_id"], "admin_email": user["email"],
        "action": "self_claim_admin", "target_user_id": user["_id"],
        "ts": now_utc().isoformat(),
    })
    return {"ok": True, "role": "admin", "message": "Acesso de administrador concedido"}


@router.post("/change-password")
async def change_password(body: ChangePasswordInput, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full_user or not verify_password(body.current_password, full_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Palavra-passe atual incorreta")
    await db.users.update_one({"_id": full_user["_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


@router.post("/delete-account")
async def delete_account(body: DeleteAccountInput, response: Response, user: dict = Depends(get_current_user)):
    full_user = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full_user or not verify_password(body.password, full_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Palavra-passe incorreta")
    player = await db.players.find_one({"user_id": user["_id"]})
    if player:
        pid = str(player["_id"])
        for coll in (db.teams, db.employees, db.vehicles, db.weapons, db.properties, db.opportunities,
                     db.missions, db.events, db.quests, db.candidates, db.transactions):
            await coll.delete_many({"player_id": pid})
        await db.players.delete_one({"_id": player["_id"]})
    await db.users.delete_one({"_id": ObjectId(user["_id"])})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Sem refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Tipo de token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Utilizador não encontrado")
        access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="lax", max_age=3600, path="/")
        return {"ok": True, "access_token": access}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@lusorae.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        result = await db.users.insert_one({
            "email": admin_email, "password_hash": hash_password(admin_password),
            "name": "Sindicato Lusorae", "role": "admin",
            "created_at": now_utc().isoformat(),
        })
        await create_player_for_user(str(result.inserted_id), "Sindicato Lusorae")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
