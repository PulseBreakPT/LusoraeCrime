"""Rotas públicas de documentos legais e changelog."""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from auth import get_current_user
from db import db
from engine import now_utc
from legal_data import get_document, legal_meta, CHANGELOG, CHANGELOG_CATEGORIES

router = APIRouter(prefix="/api/legal", tags=["legal"])

# Versão do disclaimer de ficção mostrado a cada login ("é apenas um jogo").
# Incrementar quando o texto do aviso mudar de forma material — o registo de
# auditoria guarda a versão aceite/recusada por cada jogador.
DISCLAIMER_VERSION = "1.0"


class DisclaimerAckInput(BaseModel):
    accepted: bool


@router.get("/meta")
async def meta():
    """Versões atuais de todos os documentos legais."""
    return legal_meta()


@router.get("/documents/{doc_id}")
async def document(doc_id: str, version: str | None = None):
    """Documento legal completo (versão atual ou específica)."""
    doc = get_document(doc_id, version)
    if not doc:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return doc


@router.get("/changelog")
async def changelog():
    """Changelog completo, organizado por versões (mais recente primeiro)."""
    return {"categories": CHANGELOG_CATEGORIES, "versions": CHANGELOG}


@router.post("/disclaimer-ack")
async def disclaimer_ack(body: DisclaimerAckInput, request: Request, user: dict = Depends(get_current_user)):
    """Regista a resposta ao disclaimer de ficção mostrado a cada login.

    Trilho de auditoria (prática padrão da indústria): guarda a última resposta
    em `last_disclaimer` e um histórico das últimas 20 respostas em
    `disclaimer_log`, cada uma com data/hora UTC, versão do aviso e IP.
    """
    ip = request.client.host if request.client else "unknown"
    entry = {
        "accepted": bool(body.accepted),
        "at": now_utc().isoformat(),
        "version": DISCLAIMER_VERSION,
        "ip": ip,
    }
    await db.users.update_one(
        {"_id": ObjectId(user["_id"])},
        {
            "$set": {"last_disclaimer": entry},
            "$push": {"disclaimer_log": {"$each": [entry], "$slice": -20}},
        },
    )
    return {"ok": True, "version": DISCLAIMER_VERSION, "accepted": entry["accepted"]}
