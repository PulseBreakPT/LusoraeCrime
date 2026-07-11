import os
import re
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field

from db import db
from game_data import HQ_LOCATION, HQ_DEFAULT_PRIORITY, LISBON_SPOTS
from engine import now_utc, add_event, vehicle_doc, starting_employee
from legal_data import current_version

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_ALGORITHM = "HS256"
MAX_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

# ---------------------------------------------------------------------------
# Política de palavras-passe (aplicada no registo e na alteração — contas
# existentes continuam a poder iniciar sessão com as palavras-passe antigas)
# ---------------------------------------------------------------------------
PASSWORD_MIN_LENGTH = 8
# Caracteres proibidos em nomes de organização (controlo + injeção de markup)
ORG_NAME_FORBIDDEN = re.compile(r"[<>{}\[\]\\/;`\x00-\x1f\x7f]")


def password_policy_errors(password: str) -> list:
    """Devolve a lista de requisitos em falta (vazia = palavra-passe válida)."""
    errors = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(f"mínimo {PASSWORD_MIN_LENGTH} caracteres")
    if not re.search(r"[a-z]", password):
        errors.append("pelo menos 1 letra minúscula")
    if not re.search(r"[A-Z]", password):
        errors.append("pelo menos 1 letra maiúscula")
    if not re.search(r"[0-9]", password):
        errors.append("pelo menos 1 número")
    return errors


def validate_password_or_400(password: str):
    errors = password_policy_errors(password)
    if errors:
        raise HTTPException(
            status_code=400,
            detail="Palavra-passe fraca: falta " + ", ".join(errors) + ".",
        )


def sanitize_org_name(name: str) -> str:
    """Normaliza espaços e valida caracteres do nome da organização."""
    cleaned = re.sub(r"\s+", " ", name or "").strip()
    if len(cleaned) < 3:
        raise HTTPException(status_code=400, detail="O nome da organização deve ter pelo menos 3 caracteres")
    if len(cleaned) > 40:
        raise HTTPException(status_code=400, detail="O nome da organização não pode exceder 40 caracteres")
    if ORG_NAME_FORBIDDEN.search(cleaned):
        raise HTTPException(status_code=400, detail="O nome da organização contém caracteres não permitidos")
    return cleaned


async def org_name_taken(name: str, exclude_user_id: str | None = None) -> bool:
    """Verificação de unicidade case-insensitive do nome da organização."""
    query = {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}}
    existing = await db.users.find_one(query)
    if not existing:
        return False
    if exclude_user_id and str(existing["_id"]) == exclude_user_id:
        return False
    return True


def terms_acceptance_record(ip: str) -> dict:
    """Regista a aceitação dos documentos legais com data, hora e versões."""
    terms = current_version("terms") or {}
    privacy = current_version("privacy") or {}
    return {
        "accepted_at": now_utc().isoformat(),
        "terms_version": terms.get("version", "1.0"),
        "privacy_version": privacy.get("version", "1.0"),
        "ip": ip,
    }
# Única conta autorizada a auto-promover-se a administrador pelo botão do
# frontend — qualquer outra conta recebe 403 ao chamar /claim-admin.
SELF_CLAIM_ADMIN_EMAIL = "geral@lusorae.pt"

# Sistema de funções (roles) da plataforma:
#   player    — jogador normal, sem acesso a ferramentas de gestão
#   moderator — acesso de LEITURA ao painel de administração (dashboard,
#               utilizadores, registos, estatísticas); nunca pode alterar nada
#   admin     — acesso total, incluindo mutações e gestão de funções
VALID_ROLES = ("player", "moderator", "admin")
STAFF_ROLES = ("moderator", "admin")


def root_admin_email() -> str:
    """Conta raiz criada pelo seed — protegida contra despromoção/banimento."""
    return os.environ.get("ADMIN_EMAIL", "admin@lusorae.com")


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
        # Contas banidas perdem o acesso imediatamente, mesmo com sessão válida —
        # sem isto, um banido manteria acesso até o refresh token expirar (7 dias).
        if user.get("banned"):
            raise HTTPException(status_code=403, detail=f"Conta banida: {user.get('ban_reason', 'sem motivo indicado')}")
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
    password: str = Field(min_length=1, max_length=128)
    accept_terms: bool = False


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AvailabilityInput(BaseModel):
    org_name: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=254)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=1, max_length=128)


class DeleteAccountInput(BaseModel):
    password: str


def user_public(user: dict) -> dict:
    return {"id": str(user["_id"]), "email": user["email"], "name": user.get("name", ""),
            "role": user.get("role", "player")}


async def create_player_for_user(user_id: str, org_name: str, with_default_hq: bool = False):
    # SAFEGUARD: never overwrite existing player data on restart/redeploy
    existing = await db.players.find_one({"user_id": user_id})
    if existing:
        return str(existing["_id"])

    now = now_utc().isoformat()
    # Novos jogadores escolhem onde montar o 1º Quartel-General (em Portugal,
    # nunca no mar) — o jogo só arranca depois do POST /game/hq/place.
    # `with_default_hq` mantém o comportamento antigo para a conta admin seeded.
    if with_default_hq:
        hq = {**HQ_LOCATION, "level": 1, "upgrading_until": None, "upgrade_history": []}
        districts = [{"key": f"d{i + 1}", "name": s["name"], "lat": s["lat"], "lng": s["lng"], "named": True}
                     for i, s in enumerate(LISBON_SPOTS)]
        region = "Lisboa"
    else:
        hq, districts, region = None, [], ""
    result = await db.players.insert_one({
        "user_id": user_id, "org_name": org_name,
        "clean_money": 75000, "dirty_money": 5000,
        "respect": 0, "level": 1, "heat": 0.0,
        "frac_dirty": 0.0, "frac_clean": 0.0, "frac_launder": 0.0, "v2": True,
        "hq": hq, "districts": districts, "region": region,
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
    await add_event(db, pid, "system", f"{org_name} foi fundada com 75.000 € limpos e 5.000 € sujos de capital inicial.")
    await add_event(db, pid, "team", "Crew Alfa está pronta: um assaltante, um motorista e um Sedan Usado na garagem.")
    return pid


@router.post("/register")
async def register(body: RegisterInput, request: Request, response: Response):
    # 1. Aceitação obrigatória dos documentos legais
    if not body.accept_terms:
        raise HTTPException(
            status_code=400,
            detail="É necessário aceitar os Termos de Serviço e a Política de Privacidade para criar conta",
        )
    # 2. Validação e sanitização no servidor (nunca confiar só no cliente)
    org_name = sanitize_org_name(body.org_name)
    validate_password_or_400(body.password)
    email = body.email.lower().strip()

    # 3. Unicidade
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Este email já está registado")
    if await org_name_taken(org_name):
        raise HTTPException(status_code=400, detail="Este nome de organização já está a ser utilizado")

    ip = request.client.host if request.client else "unknown"
    now = now_utc().isoformat()
    try:
        result = await db.users.insert_one({
            "email": email, "password_hash": hash_password(body.password),
            "name": org_name, "role": "player", "created_at": now,
            "terms_acceptance": terms_acceptance_record(ip),
        })
    except DuplicateKeyError:
        # Proteção contra pedidos duplicados/simultâneos (índice único no email)
        raise HTTPException(status_code=400, detail="Este email já está registado")
    user_id = str(result.inserted_id)
    await create_player_for_user(user_id, org_name)
    access = create_access_token(user_id, email)
    refresh_tok = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh_tok)
    return {"id": user_id, "email": email, "name": org_name, "role": "player",
            "access_token": access, "refresh_token": refresh_tok}


@router.post("/check-availability")
async def check_availability(body: AvailabilityInput):
    """Verificação em tempo real de disponibilidade (registo)."""
    result = {}
    if body.email is not None:
        email = body.email.lower().strip()
        valid = bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))
        taken = bool(await db.users.find_one({"email": email})) if valid else False
        result["email"] = {"valid": valid, "available": valid and not taken}
    if body.org_name is not None:
        cleaned = re.sub(r"\s+", " ", body.org_name).strip()
        valid = 3 <= len(cleaned) <= 40 and not ORG_NAME_FORBIDDEN.search(cleaned)
        taken = await org_name_taken(cleaned) if valid else False
        result["org_name"] = {"valid": valid, "available": valid and not taken}
    return result


@router.post("/login")
async def login(body: LoginInput, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= MAX_ATTEMPTS:
        locked_until = datetime.fromisoformat(attempt["locked_until"])
        now = datetime.now(timezone.utc)
        if now < locked_until:
            remaining = max(1, int((locked_until - now).total_seconds()))
            raise HTTPException(
                status_code=429,
                detail="Demasiadas tentativas falhadas. Por segurança, o acesso está temporariamente bloqueado.",
                headers={"Retry-After": str(remaining)},
            )
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
    validate_password_or_400(body.new_password)
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
        await create_player_for_user(str(result.inserted_id), "Sindicato Lusorae", with_default_hq=True)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
