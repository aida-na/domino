"""Domino items endpoints — save, list, delete."""

import logging
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.auth import get_domino_user, get_domino_user_with_session
from app.core.datetime_utils import serialize_datetime
from app.core.media_tokens import create_media_token, verify_media_token
from app.db.session import get_db
from app.models.domino import DominoItem, DominoSession, DominoUser
from app.services.chat import answer_question_web
from app.services.processor import (
    detect_input_type,
    enrich_note,
    normalize_topics,
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

def _item_topics(item: DominoItem) -> list[str]:
    """Primary-first topic list for API responses (falls back to legacy topic)."""
    topics = list(item.topics or [])
    if not topics and item.topic:
        topics = [item.topic]
    return topics


def _serialize_item(item: DominoItem) -> dict:
    topics = _item_topics(item)
    return {
        "id": str(item.id),
        "raw_input": item.raw_input,
        "input_type": item.input_type,
        "extracted_text": item.extracted_text,
        "summary": item.summary,
        "topic": item.topic or (topics[0] if topics else None),
        "topics": topics,
        "key_ideas": item.key_ideas or [],
        "created_at": serialize_datetime(item.created_at),
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
        current_topics=list(item.topics or []),
        allow_topic_update=allow_topic,
    )
    if allow_topic:
        item.topic = enriched["topic"]
        item.topics = enriched["topics"]
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
        primary = client_topic or "Inbox"
        item = DominoItem(
            user_phone=current_user.phone,
            raw_input=raw,
            input_type="note",
            extracted_text=raw,
            summary=None,
            topic=primary,
            topics=[primary],
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

    if client_topic:
        topics = normalize_topics(
            [client_topic, *[t for t in (result.topics or []) if t != client_topic]]
        )
        primary = topics[0]
    else:
        topics = list(result.topics or ([result.topic] if result.topic else ["General"]))
        primary = result.topic or topics[0]

    item = DominoItem(
        user_phone=current_user.phone,
        raw_input=raw,
        input_type=result.input_type,
        extracted_text=result.extracted_text or None,
        summary=result.summary or None,
        topic=primary,
        topics=topics,
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
        topic = body.topic.strip() or "Inbox"
        item.topic = topic
        # Keep secondary labels; promote the user-chosen folder to primary.
        rest = [t for t in (item.topics or []) if t.lower() != topic.lower()]
        item.topics = normalize_topics([topic, *rest], fallback=topic)
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

async def _user_owns_media_url(db: AsyncSession, *, user_phone: str, media_url: str) -> bool:
    """True when the URL appears on one of the user's saved items."""
    result = await db.execute(
        select(DominoItem.id)
        .where(
            DominoItem.user_phone == user_phone,
            DominoItem.raw_input.contains(media_url),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def _resolve_media_session(
    db: AsyncSession,
    *,
    media_url: str,
    media_token: str | None,
    raw_token: str | None,
) -> DominoSession | None:
    """Resolve a valid session from signed media token or legacy session UUID."""
    now = datetime.now(timezone.utc)

    if media_token:
        session_id = verify_media_token(media_token, media_url)
        if not session_id:
            return None
        try:
            session_uuid = UUID(session_id)
        except ValueError:
            return None
    elif raw_token:
        try:
            session_uuid = UUID(raw_token)
        except ValueError:
            return None
    else:
        return None

    result = await db.execute(
        select(DominoSession).where(
            DominoSession.id == session_uuid,
            DominoSession.expires_at > now,
        )
    )
    return result.scalar_one_or_none()


@router.get("/media-token")
async def issue_media_token(
    url: str = Query(...),
    user_session: tuple[DominoUser, DominoSession] = Depends(get_domino_user_with_session),
    db: AsyncSession = Depends(get_db),
):
    """Return a short-lived signed token for media-proxy (preferred over session UUID in URLs)."""
    user, session = user_session
    if not await _user_owns_media_url(db, user_phone=user.phone, media_url=url):
        raise HTTPException(status_code=403, detail="Media not found in your saves")
    token = create_media_token(session_id=str(session.id), media_url=url)
    return {"media_token": token, "expires_in": 900}


@router.get("/media-proxy")
async def media_proxy(
    url: str = Query(...),
    token: str | None = Query(default=None),
    media_token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Proxy media for saved items. Accepts signed media_token, Bearer header, or legacy ?token=."""
    raw_token = token or (
        authorization.split(" ", 1)[1].strip()
        if authorization and authorization.startswith("Bearer ")
        else None
    )
    if not media_token and not raw_token:
        raise HTTPException(status_code=401, detail="Missing token")

    session = await _resolve_media_session(
        db,
        media_url=url,
        media_token=media_token,
        raw_token=raw_token if not media_token else None,
    )
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or not found")

    if not await _user_owns_media_url(db, user_phone=session.user_phone, media_url=url):
        raise HTTPException(status_code=403, detail="Media not found in your saves")

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
