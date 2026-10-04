from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timezone

from db import db
from auth import get_current_user, VALID_ROLES, STAFF_ROLES, root_admin_email
from engine import now_utc, default_stats
from game_data import HQ_LOCATION, HQ_DEFAULT_PRIORITY

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(user: dict = Depends(get_current_user)):
    """Acesso total — apenas administradores (todas as mutações)."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado — apenas administradores")
    return user


async def require_staff(user: dict = Depends(get_current_user)):
    """Acesso de leitura — administradores e moderadores (dashboards, listas, logs)."""
    if user.get("role") not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado — apenas equipa de gestão")
    return user


class SetRoleInput(BaseModel):
    role: str


class GrantResourcesInput(BaseModel):
    user_id: str
    clean_money: int = 0
    dirty_money: int = 0
    respect: int = 0


class BanUserInput(BaseModel):
    user_id: str
    reason: str


class ResetPlayerInput(BaseModel):
    user_id: str
    keep_level: bool = False


@router.get("/dashboard")
async def admin_dashboard(admin: dict = Depends(require_staff)):
    """Dashboard com estatísticas gerais do servidor."""
    user_count = await db.users.count_documents({})
    player_count = await db.players.count_documents({})
    active_missions = await db.missions.count_documents({"phase": {"$ne": "done"}})
    total_missions = await db.missions.count_documents({})

    # Agregação para calcular recursos totais
    clean_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$clean_money"}}}
    ]
    dirty_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$dirty_money"}}}
    ]

    clean_result = await db.players.aggregate(clean_pipeline).to_list(1)
    dirty_result = await db.players.aggregate(dirty_pipeline).to_list(1)

    total_clean = clean_result[0]["total"] if clean_result else 0
    total_dirty = dirty_result[0]["total"] if dirty_result else 0

    # Top 5 jogadores por nível
    top_players = await db.players.find().sort("level", -1).limit(5).to_list(5)
    top_players_data = []
    for p in top_players:
        user = await db.users.find_one({"_id": p["user_id"] if isinstance(p["user_id"], ObjectId) else ObjectId(p["user_id"])})
        top_players_data.append({
            "user_id": str(p["_id"]),
            "name": p.get("org_name", "Desconhecido"),
            "email": user.get("email", "N/A") if user else "N/A",
            "level": p.get("level", 1),
            "respect": p.get("respect", 0),
        })

    return {
        "server_time": now_utc().isoformat(),
        "stats": {
            "total_users": user_count,
            "total_players": player_count,
            "active_missions": active_missions,
            "total_missions": total_missions,
            "total_clean_money": total_clean,
            "total_dirty_money": total_dirty,
        },
        "top_players": top_players_data,
    }


@router.get("/users")
async def list_users(admin: dict = Depends(require_staff), page: int = 1, per_page: int = 50):
    """Lista todos os utilizadores registados."""
    skip = (page - 1) * per_page
    users = await db.users.find().skip(skip).limit(per_page).to_list(per_page)
    total = await db.users.count_documents({})

    users_data = []
    for u in users:
        player = await db.players.find_one({"user_id": str(u["_id"])})
        users_data.append({
            "id": str(u["_id"]),
            "email": u["email"],
            "name": u.get("name", ""),
            "role": u.get("role", "player"),
            "created_at": u.get("created_at", ""),
            "player_id": str(player["_id"]) if player else None,
            "player_level": player.get("level", 0) if player else 0,
            "player_respect": player.get("respect", 0) if player else 0,
        })

    return {
        "users": users_data,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "pages": (total + per_page - 1) // per_page,
        },
    }


@router.get("/user/{user_id}")
async def get_user_details(user_id: str, admin: dict = Depends(require_staff)):
    """Detalhes completos de um utilizador específico."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    player = await db.players.find_one({"user_id": str(user_oid)})
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    # Dados do jogador
    teams = await db.teams.find({"player_id": str(player["_id"])}).to_list(100)
    employees = await db.employees.find({"player_id": str(player["_id"])}).to_list(300)
    vehicles = await db.vehicles.find({"player_id": str(player["_id"])}).to_list(100)
    properties = await db.properties.find({"player_id": str(player["_id"])}).to_list(100)
    missions = await db.missions.find({"player_id": str(player["_id"])}).to_list(100)

    return {
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user.get("name", ""),
            "role": user.get("role", "player"),
            "created_at": user.get("created_at", ""),
        },
        "player": {
            "id": str(player["_id"]),
            "org_name": player.get("org_name", ""),
            "level": player.get("level", 1),
            "respect": player.get("respect", 0),
            "heat": player.get("heat", 0),
            "clean_money": player.get("clean_money", 0),
            "dirty_money": player.get("dirty_money", 0),
            "last_tick": player.get("last_tick", ""),
            "created_at": player.get("created_at", ""),
        },
        "resources": {
            "teams_count": len(teams),
            "employees_count": len(employees),
            "vehicles_count": len(vehicles),
            "properties_count": len(properties),
            "missions_done": sum(1 for m in missions if m["phase"] == "done"),
            "missions_active": sum(1 for m in missions if m["phase"] != "done"),
        },
        "stats": player.get("stats", default_stats()),
    }


@router.post("/user/{user_id}/grant-resources")
async def grant_resources(user_id: str, body: GrantResourcesInput, admin: dict = Depends(require_admin)):
    """Dar recursos a um jogador."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    player = await db.players.find_one({"user_id": str(user_oid)})
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    updates = {}
    if body.clean_money != 0:
        updates["clean_money"] = player.get("clean_money", 0) + body.clean_money
    if body.dirty_money != 0:
        updates["dirty_money"] = player.get("dirty_money", 0) + body.dirty_money
    if body.respect != 0:
        updates["respect"] = player.get("respect", 0) + body.respect

    if updates:
        await db.players.update_one({"_id": player["_id"]}, {"$set": updates})

    # Log da ação
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "grant_resources",
        "target_player_id": str(player["_id"]),
        "details": body.model_dump(),
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": "Recursos concedidos com sucesso"}


@router.post("/user/{user_id}/reset-progress")
async def reset_player_progress(user_id: str, body: ResetPlayerInput, admin: dict = Depends(require_admin)):
    """Resetar o progresso de um jogador (limpa tudo, volta ao estado inicial)."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    player = await db.players.find_one({"user_id": str(user_oid)})
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    pid = str(player["_id"])
    now = now_utc().isoformat()

    # Deletar tudo relacionado ao jogador
    for coll in (
        db.teams, db.employees, db.vehicles, db.weapons, db.properties, db.opportunities,
        db.missions, db.events, db.quests, db.candidates, db.transactions,
        db.city_businesses, db.city_rivals, db.city_season_scores, db.city_chat,
    ):
        await coll.delete_many({"player_id": pid})
    await db.city_pvp_challenges.delete_many({"$or": [{"attacker_id": pid}, {"defender_id": pid}]})
    await db.city_chat_reports.delete_many({"$or": [{"reporter_id": pid}, {"target_player_id": pid}]})
    await db.city_alliances.update_many({"member_ids": pid}, {"$pull": {"member_ids": pid}})
    await db.action_receipts.delete_many({"key": {"$regex": f"^{str(user_oid)}:"}})

    # Recriar player com estado inicial
    level = player.get("level", 1) if body.keep_level else 1
    respect_for_level = 0  # Nível 1
    if body.keep_level and level > 1:
        from game_data import LEVEL_THRESHOLDS
        respect_for_level = LEVEL_THRESHOLDS[min(level - 1, len(LEVEL_THRESHOLDS) - 1)]

    await db.players.update_one({"_id": player["_id"]}, {"$set": {
        "clean_money": 100000,
        "dirty_money": 5000,
        "respect": respect_for_level,
        "level": level,
        "heat": 0.0,
        "frac_dirty": 0.0,
        "frac_clean": 0.0,
        "frac_launder": 0.0,
        "hq": {**HQ_LOCATION, "level": 1, "upgrading_until": None, "upgrade_history": []},
        "priorities": {"active": HQ_DEFAULT_PRIORITY},
        "last_tick": now,
        "stats": default_stats(),
        "type_cooldowns": {},
    }})

    # Recriar equipa inicial
    team_res = await db.teams.insert_one({
        "player_id": pid,
        "name": "Crew Alfa",
        "spec": "assalto",
        "status": "idle",
        "vehicle_id": None,
        "missions_done": 0,
        "created_at": now,
        "available_at": None,
        "roster_stable_since": now,
    })
    tid = str(team_res.inserted_id)

    # Recriar veículo inicial
    from engine import vehicle_doc
    veh_res = await db.vehicles.insert_one(vehicle_doc(pid, "usado", now, team_id=tid))
    await db.teams.update_one({"_id": team_res.inserted_id}, {"$set": {"vehicle_id": str(veh_res.inserted_id)}})

    # Recriar funcionários iniciais
    from engine import starting_employee
    for role in ("assaltante", "motorista"):
        await db.employees.insert_one(starting_employee(pid, role, now, team_id=tid))

    # Log da ação
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "reset_progress",
        "target_player_id": pid,
        "details": {"keep_level": body.keep_level},
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": "Progresso resetado com sucesso"}


@router.post("/user/{user_id}/ban")
async def ban_user(user_id: str, body: BanUserInput, admin: dict = Depends(require_admin)):
    """Banir um utilizador (impede login)."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    # Proteções de lógica: nunca banir a própria conta, a conta raiz do
    # sistema, ou outro administrador (tem de ser despromovido primeiro).
    if str(user_oid) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Não podes banir a tua própria conta")
    if user.get("email") == root_admin_email():
        raise HTTPException(status_code=403, detail="A conta raiz do sistema não pode ser banida")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Não é possível banir um administrador — remove primeiro a função")

    # Marcar como banido
    await db.users.update_one(
        {"_id": user_oid},
        {
            "$set": {
                "banned": True,
                "ban_reason": body.reason,
                "banned_at": now_utc().isoformat(),
                "banned_by": admin["email"],
            },
            "$inc": {"token_version": 1},
        },
    )

    # Log da ação
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "ban_user",
        "target_user_id": str(user_oid),
        "details": {"reason": body.reason},
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": "Utilizador banido com sucesso"}


@router.post("/user/{user_id}/unban")
async def unban_user(user_id: str, admin: dict = Depends(require_admin)):
    """Desbanir um utilizador."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    await db.users.update_one({"_id": user_oid}, {"$unset": {
        "banned": "",
        "ban_reason": "",
        "banned_at": "",
        "banned_by": "",
    }})

    # Log da ação
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "unban_user",
        "target_user_id": str(user_oid),
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": "Utilizador desbanido com sucesso"}


@router.post("/user/{user_id}/role")
async def set_user_role(user_id: str, body: SetRoleInput, admin: dict = Depends(require_admin)):
    """Definir a função de um utilizador (player/moderator/admin) — só admins.

    Proteções: função inválida → 400; alterar a própria função → 400 (evita
    lockout); alterar a conta raiz do seed → 403.
    """
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Função inválida — usa uma de: {', '.join(VALID_ROLES)}")
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    if str(user_oid) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Não podes alterar a tua própria função")
    if user.get("email") == root_admin_email():
        raise HTTPException(status_code=403, detail="A conta raiz do sistema não pode ser alterada")

    previous_role = user.get("role", "player")
    if previous_role == body.role:
        raise HTTPException(status_code=400, detail=f"Utilizador já tem a função '{body.role}'")

    await db.users.update_one({"_id": user_oid}, {"$set": {"role": body.role}, "$inc": {"token_version": 1}})

    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "set_role",
        "target_user_id": str(user_oid),
        "target_user_email": user.get("email", ""),
        "details": {"from": previous_role, "to": body.role},
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": f"{user.get('email', '')} é agora '{body.role}'", "role": body.role}


@router.post("/user/{user_id}/grant-admin")
async def grant_admin(user_id: str, admin: dict = Depends(require_admin)):
    """Promover um utilizador a administrador."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Utilizador já é administrador")

    await db.users.update_one({"_id": user_oid}, {"$set": {"role": "admin"}, "$inc": {"token_version": 1}})

    # Log da ação
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "grant_admin",
        "target_user_id": str(user_oid),
        "target_user_email": user.get("email", ""),
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": f"Utilizador {user.get('email', '')} é agora administrador"}


@router.post("/user/{user_id}/revoke-admin")
async def revoke_admin(user_id: str, admin: dict = Depends(require_admin)):
    """Remover acesso de administrador de um utilizador."""
    try:
        user_oid = ObjectId(user_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de utilizador inválido")

    user = await db.users.find_one({"_id": user_oid})
    if not user:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado")

    if str(user_oid) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Não podes remover a tua própria função de administrador")
    if user.get("email") == root_admin_email():
        raise HTTPException(status_code=403, detail="A conta raiz do sistema não pode ser alterada")

    if user.get("role") != "admin":
        raise HTTPException(status_code=400, detail="Utilizador não é administrador")

    await db.users.update_one({"_id": user_oid}, {"$set": {"role": "player"}, "$inc": {"token_version": 1}})

    # Log da ação
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "revoke_admin",
        "target_user_id": str(user_oid),
        "target_user_email": user.get("email", ""),
        "ts": now_utc().isoformat(),
    })

    return {"ok": True, "message": f"Acesso de administrador removido de {user.get('email', '')}"}


@router.get("/logs")
async def get_admin_logs(admin: dict = Depends(require_staff), limit: int = 100):
    """Últimas ações administrativas."""
    logs = await db.admin_logs.find().sort("ts", -1).limit(limit).to_list(limit)

    logs_data = []
    for log in logs:
        logs_data.append({
            "id": str(log["_id"]),
            "admin_email": log.get("admin_email", ""),
            "action": log.get("action", ""),
            "target_user_id": log.get("target_user_id", ""),
            "target_player_id": log.get("target_player_id", ""),
            "details": log.get("details", {}),
            "ts": log.get("ts", ""),
        })

    return {"logs": logs_data}


class ResolveChatReportInput(BaseModel):
    status: str
    note: str = ""


@router.get("/chat-reports")
async def list_chat_reports(admin: dict = Depends(require_staff), status: str = "open", limit: int = 100):
    """Fila de moderação do chat da Cidade."""
    query = {} if status == "all" else {"status": status}
    rows = await db.city_chat_reports.find(query).sort("created_at", -1).limit(min(200, max(1, limit))).to_list(200)
    return {
        "reports": [
            {
                "id": str(row["_id"]),
                "reporter_id": row.get("reporter_id"),
                "target_player_id": row.get("target_player_id"),
                "message_id": row.get("message_id"),
                "message_snapshot": row.get("message_snapshot", ""),
                "reason": row.get("reason", ""),
                "status": row.get("status", "open"),
                "created_at": row.get("created_at"),
                "resolved_at": row.get("resolved_at"),
                "moderator_note": row.get("moderator_note", ""),
            }
            for row in rows
        ]
    }


@router.post("/chat-reports/{report_id}/resolve")
async def resolve_chat_report(report_id: str, body: ResolveChatReportInput, admin: dict = Depends(require_admin)):
    """Resolve, arquiva ou rejeita uma denúncia e mantém auditoria."""
    if body.status not in {"resolved", "dismissed"}:
        raise HTTPException(status_code=400, detail="Estado inválido")
    try:
        report_oid = ObjectId(report_id)
    except (InvalidId, ValueError):
        raise HTTPException(status_code=400, detail="ID de denúncia inválido")
    report = await db.city_chat_reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(status_code=404, detail="Denúncia não encontrada")
    now = now_utc().isoformat()
    await db.city_chat_reports.update_one(
        {"_id": report_oid},
        {"$set": {
            "status": body.status,
            "resolved_at": now,
            "resolved_by": admin.get("email", ""),
            "moderator_note": body.note[:500],
        }},
    )
    await db.admin_logs.insert_one({
        "admin_id": admin["_id"],
        "admin_email": admin["email"],
        "action": "resolve_chat_report",
        "target_player_id": report.get("target_player_id", ""),
        "details": {"report_id": report_id, "status": body.status, "note": body.note[:500]},
        "ts": now,
    })
    return {"ok": True, "status": body.status}


@router.get("/server-stats")
async def get_server_stats(admin: dict = Depends(require_staff)):
    """Estatísticas avançadas do servidor."""
    now = now_utc()

    # Utilizadores ativos (login nos últimos 7 dias)
    seven_days_ago = (now - __import__('datetime').timedelta(days=7)).isoformat()
    active_users = await db.users.count_documents({"created_at": {"$gt": seven_days_ago}})

    # Missões por categoria
    missions_pipeline = [
        {"$match": {"phase": "done"}},
        {"$group": {
            "_id": "$opportunity.category",
            "count": {"$sum": 1},
            "total_reward": {"$sum": "$opportunity.reward"},
        }},
    ]
    missions_by_cat = await db.missions.aggregate(missions_pipeline).to_list(10)

    # Distribuição de níveis
    levels_pipeline = [
        {"$group": {
            "_id": "$level",
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    levels_dist = await db.players.aggregate(levels_pipeline).to_list(100)

    return {
        "server_time": now.isoformat(),
        "active_users_7d": active_users,
        "missions_by_category": missions_by_cat,
        "player_level_distribution": levels_dist,
    }
