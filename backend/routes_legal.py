"""Rotas públicas de documentos legais e changelog."""
from fastapi import APIRouter, HTTPException

from legal_data import get_document, legal_meta, CHANGELOG, CHANGELOG_CATEGORIES

router = APIRouter(prefix="/api/legal", tags=["legal"])


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
