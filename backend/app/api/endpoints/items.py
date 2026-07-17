"""Domino items endpoints — save, list, delete."""

import logging
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.auth import get_domino_user
from app.db.session import get_db
from app.models.domino import DominoItem, DominoUser
from app.services.chat import answer_question_web
from app.services.processor import (
    detect_input_type,
    enrich_note,
    process_url,
    topic_is_default,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────

class CreateItemBody(BaseModel):
    raw_input: str
    topic: str | None = Field(default=None, max_length=64)


class ChatBody(BaseModel):
    message: str


class PatchItemBody(BaseModel):
    is_pinned: bool | None = None
    is_favorited: bool | None = None
    raw_input: str | None = None
    topic: str | None = Field(default=None, max_length=64)
    enrich: bool | None = None


# ── Helpers ───────────────────────────────────────────────────────────────

def _serialize_item(item: DominoItem) -> dict:
    return {
        "id": str(item.id),
        "raw_input": item.raw_input,
        "input_type": item.input_type,
        "extracted_text": item.extracted_text,
        "summary": item.summary,
        "topic": item.topic,
        "key_ideas": item.key_ideas or [],
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "digest_sent": item.digest_sent,
        "is_pinned": item.is_pinned,
        "is_favorited": item.is_favorited,
    }


async def _apply_note_enrichment(item: DominoItem) -> None:
    """Mutate item in-place with AI topic/summary/key_ideas. Caller commits."""
    text = (item.extracted_text or item.raw_input or "").strip()
    if not text:
        return
    allow_topic = topic_is_default(item.topic)
    enriched = await enrich_note(
        text,
        current_topic=item.topic,
        allow_topic_update=allow_topic,
    )
    if allow_topic:
        item.topic = enriched["topic"]
    if enriched["summary"]:
        item.summary = enriched["summary"]
    if enriched["key_ideas"]:
        item.key_ideas = enriched["key_ideas"]


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/items")
async def list_items(
    limit: int = 20,
    offset: int = 0,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DominoItem)
        .where(DominoItem.user_phone == current_user.phone)
        .order_by(DominoItem.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [_serialize_item(i) for i in result.scalars().all()]


@router.post("/items")
async def create_item(
    body: CreateItemBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    raw = body.raw_input.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="raw_input is required")

    input_type = detect_input_type(raw)
    client_topic = body.topic.strip() if body.topic and body.topic.strip() else None

    # Notes: fast path — no Gemini on the request. Client calls /enrich after.
    if input_type == "note":
        item = DominoItem(
            user_phone=current_user.phone,
            raw_input=raw,
            input_type="note",
            extracted_text=raw,
            summary=None,
            topic=client_topic or "Inbox",
            key_ideas=[],
        )
        db.add(item)
        await db.commit()
        await db.refresh(item)
        return _serialize_item(item)

    if input_type in ("link", "pdf"):
        result = await process_url(raw)
    else:
        from app.services.processor import process_note
        result = await process_note(raw)

    item = DominoItem(
        user_phone=current_user.phone,
        raw_input=raw,
        input_type=result.input_type,
        extracted_text=result.extracted_text or None,
        summary=result.summary or None,
        topic=client_topic or result.topic or None,
        key_ideas=result.key_ideas or None,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _serialize_item(item)


@router.get("/items/{item_id}")
async def get_item(
    item_id: UUID,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DominoItem).where(
            DominoItem.id == item_id,
            DominoItem.user_phone == current_user.phone,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return _serialize_item(item)


@router.patch("/items/{item_id}")
async def patch_item(
    item_id: UUID,
    body: PatchItemBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DominoItem).where(
            DominoItem.id == item_id,
            DominoItem.user_phone == current_user.phone,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if body.is_pinned is not None:
        item.is_pinned = body.is_pinned
    if body.is_favorited is not None:
        item.is_favorited = body.is_favorited
    if body.topic is not None:
        topic = body.topic.strip()
        item.topic = topic or "Inbox"
    if body.raw_input is not None:
        raw = body.raw_input.strip()
        if not raw:
            raise HTTPException(status_code=400, detail="raw_input cannot be empty")
        item.raw_input = raw
        if item.input_type == "note":
            item.extracted_text = raw

    should_enrich = bool(body.enrich) and item.input_type in ("note", "image")
    if should_enrich:
        await _apply_note_enrichment(item)

    await db.commit()
    await db.refresh(item)
    return _serialize_item(item)


@router.post("/items/{item_id}/enrich")
async def enrich_item(
    item_id: UUID,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    """AI polish for notes/images: topic (if still default) + summary/key ideas."""
    result = await db.execute(
        select(DominoItem).where(
            DominoItem.id == item_id,
            DominoItem.user_phone == current_user.phone,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.input_type not in ("note", "image"):
        raise HTTPException(status_code=400, detail="Only notes and images can be enriched")

    await _apply_note_enrichment(item)
    await db.commit()
    await db.refresh(item)
    return _serialize_item(item)


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: UUID,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DominoItem).where(
            DominoItem.id == item_id,
            DominoItem.user_phone == current_user.phone,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()
    return {"success": True}


@router.post("/chat")
async def chat(
    body: ChatBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    answer, sources = await answer_question_web(current_user.phone, body.message, db)
    return {"answer": answer, "sources": sources}


# ── Media proxy ────────────────────────────────────────────────────────────

@router.get("/media-proxy")
async def media_proxy(
    url: str = Query(...),
    token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Proxy Twilio media. Accepts Bearer header OR ?token= query param (needed for <img> tags)."""
    from datetime import datetime, timezone
    from uuid import UUID

    from app.models.domino import DominoSession

    # Resolve token from query param or Authorization header
    raw_token = token or (authorization.split(" ", 1)[1].strip() if authorization and authorization.startswith("Bearer ") else None)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        session_uuid = UUID(raw_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(DominoSession).where(
            DominoSession.id == session_uuid,
            DominoSession.expires_at > datetime.now(timezone.utc),
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=401, detail="Session expired or not found")

    from app.services.storage import fetch_from_gcs, is_gcs_uri

    # GCS URI: gcs://bucket/key
    if is_gcs_uri(url):
        try:
            data, content_type = await fetch_from_gcs(url)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch from GCS: {e}")
        return StreamingResponse(
            iter([data]),
            media_type=content_type,
            headers={"Cache-Control": "private, max-age=86400"},
        )

    # External media (Blooio CDN, legacy Sendblue/Twilio URLs still in DB)
    lower = url.lower()
    if not any(
        host in lower
        for host in ("blooio.com", "sendblue.co", "sendblue.com", "twilio.com")
    ):
        raise HTTPException(status_code=400, detail="Unsupported media URL")

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("media-proxy fetch failed for %s: %s", url, e)
            raise HTTPException(status_code=502, detail=f"Failed to fetch media: {e}")

    return StreamingResponse(
        iter([resp.content]),
        media_type=resp.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "private, max-age=86400"},
    )
