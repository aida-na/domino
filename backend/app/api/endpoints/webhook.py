"""Domino messaging webhook — receives inbound Blooio iMessage/SMS and saves items."""

import json
import logging
import re
from typing import Any

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.domino import DominoItem, DominoMessage, DominoUser
from app.services.digest import send_weekly_digests
from app.services.processor import (
    classify_topics,
    detect_input_type,
    normalize_topics,
    process_image,
    process_note,
    process_url,
    topic_is_default,
)
from app.services.gemini_client import DEFAULT_GEMINI_MODEL

logger = logging.getLogger(__name__)
router = APIRouter()

_LOGIN_KEYWORDS = {"login", "link", "dashboard", "hi", "hello", "help"}
_STOP_KEYWORDS = {"stop", "unsubscribe", "opt out", "optout", "quit"}
_START_KEYWORDS = {"start"}
_LIST_KEYWORDS = {"list", "show all", "my items", "my stuff", "what did i save"}

_DELETE_RE = re.compile(r"^(delete|remove)\s+(last|the last|that)\b", re.IGNORECASE)
_SETTINGS_RE = re.compile(r"^(digest at|set digest)\b", re.IGNORECASE)


# ── Message logging ───────────────────────────────────────────────────────

async def _log_message(
    db: AsyncSession,
    phone: str,
    direction: str,
    body: str,
    related_item_id=None,
) -> DominoMessage:
    msg = DominoMessage(
        user_phone=phone,
        direction=direction,
        body=body,
        related_item_id=related_item_id,
    )
    db.add(msg)
    await db.flush()
    return msg


async def _load_recent_messages(db: AsyncSession, phone: str, limit: int = 10) -> list[DominoMessage]:
    result = await db.execute(
        select(DominoMessage)
        .where(DominoMessage.user_phone == phone)
        .order_by(DominoMessage.created_at.desc())
        .limit(limit)
    )
    msgs = list(result.scalars().all())
    msgs.reverse()
    return msgs


# ── Handlers ──────────────────────────────────────────────────────────────

async def _handle_new_user(phone: str, body: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import (
        SIGNUP_FULL_MESSAGE,
        SignupFullError,
        _send_message,
        build_magic_link,
        create_session_for_phone,
    )
    from app.core.config import settings

    try:
        session_token, _ = await create_session_for_phone(phone, db)
    except SignupFullError:
        base = (settings.FRONTEND_URL or "https://www.domino.fyi").rstrip("/")
        reply = f"{SIGNUP_FULL_MESSAGE}\n\njoin the waitlist: {base}"
        _send_message(phone, reply)
        await _log_message(db, phone, "outbound", reply)
        await db.commit()
        return

    link = build_magic_link(session_token)
    welcome = f"welcome to domino 🁣\n\nyour second brain is ready. tap to open your dashboard:\n{link}"
    _send_message(phone, welcome)
    await _log_message(db, phone, "outbound", welcome)

    # Ask for email for weekly digest
    result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        user.email_pending = True
    email_prompt = "one last thing — what's your email? i'll send your weekly digest there. reply with your email or 'skip'."
    _send_message(phone, email_prompt)
    await _log_message(db, phone, "outbound", email_prompt)

    await _save_item(phone, body, db)
    await db.commit()


async def _handle_login(phone: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import (
        _send_message, build_magic_link, create_session_for_phone,
    )
    session_token, _ = await create_session_for_phone(phone, db)
    link = build_magic_link(session_token)
    reply = f"here's your dashboard link:\n{link}"
    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _save_item(phone: str, raw: str, db: AsyncSession) -> DominoItem | None:
    """Detect type, process, and persist a DominoItem. Returns the saved item."""
    from app.api.endpoints.items import _apply_note_enrichment
    from app.services.processor import detect_input_type, process_url

    input_type = detect_input_type(raw)

    if input_type in ("link", "pdf"):
        result = await process_url(raw)
        topics = list(result.topics or ([result.topic] if result.topic else ["General"]))
        item = DominoItem(
            user_phone=phone,
            raw_input=raw,
            input_type=result.input_type,
            extracted_text=result.extracted_text or None,
            summary=result.summary or None,
            topic=result.topic or topics[0],
            topics=topics,
            key_ideas=result.key_ideas or None,
        )
        db.add(item)
        await db.flush()
        return item

    # Notes: save fast, then enrich in-place so iMessage notes get polish too.
    item = DominoItem(
        user_phone=phone,
        raw_input=raw,
        input_type="note",
        extracted_text=raw,
        summary=None,
        topic="Inbox",
        topics=["Inbox"],
        key_ideas=[],
    )
    db.add(item)
    await db.flush()
    try:
        await _apply_note_enrichment(item)
    except Exception as e:
        logger.warning("note enrich after iMessage save failed: %s", e)
    return item


async def _handle_save(
    phone: str,
    body: str,
    db: AsyncSession,
    message_id: str | None = None,
) -> None:
    from app.api.endpoints.auth import _react_message

    if message_id:
        _react_message(phone, message_id, "👍")

    item = await _save_item(phone, body, db)

    await _log_message(db, phone, "inbound", body, related_item_id=item.id if item else None)
    await db.commit()


async def _handle_email_collection(phone: str, body: str, user: DominoUser, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_message

    await _log_message(db, phone, "inbound", body)
    text = body.strip()

    if text.lower() == "skip":
        user.email_pending = False
        reply = "no worries! you can always add it later from the dashboard."
    elif _EMAIL_RE.match(text):
        user.email = text.lower()
        user.email_pending = False
        await db.commit()
        # Send the pending digest now that we have an email
        try:
            await send_weekly_digests(force=True, phone=phone)
            reply = f"got it — sending your digest to {text.lower()} now 📬"
        except Exception as e:
            logger.warning("Failed to send digest after email collection for %s: %s", phone, e)
            reply = f"saved your email ({text.lower()}) — you'll get next week's digest there 📬"
    else:
        reply = "that doesn't look like an email. reply with your email address or 'skip'."

    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_command_delete(phone: str, body: str, db: AsyncSession, recent: list[DominoMessage]) -> None:
    from app.api.endpoints.auth import _send_message

    await _log_message(db, phone, "inbound", body)

    # Find last saved item via recent messages
    last_item_id = None
    for msg in reversed(recent):
        if msg.related_item_id:
            last_item_id = msg.related_item_id
            break

    if not last_item_id:
        # Fallback: most recent item in DB
        r = await db.execute(
            select(DominoItem)
            .where(DominoItem.user_phone == phone)
            .order_by(DominoItem.created_at.desc())
            .limit(1)
        )
        last = r.scalar_one_or_none()
        last_item_id = last.id if last else None

    if not last_item_id:
        reply = "nothing to delete — i couldn't find your last saved item."
        _send_message(phone, reply)
        await _log_message(db, phone, "outbound", reply)
        await db.commit()
        return

    r = await db.execute(
        select(DominoItem).where(
            DominoItem.id == last_item_id,
            DominoItem.user_phone == phone,
        )
    )
    item = r.scalar_one_or_none()
    if item:
        preview = (item.summary or item.raw_input)[:40]
        await db.delete(item)
        reply = f"deleted: {preview}"
    else:
        reply = "that item was already deleted."

    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_command_list(phone: str, body: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_message

    await _log_message(db, phone, "inbound", body)
    result = await db.execute(
        select(DominoItem)
        .where(DominoItem.user_phone == phone)
        .order_by(DominoItem.created_at.desc())
        .limit(5)
    )
    items = result.scalars().all()

    if not items:
        reply = "you haven't saved anything yet."
    else:
        lines = [f"{i}. {(item.summary or item.raw_input)[:50]}" for i, item in enumerate(items, 1)]
        reply = "your recent saves:\n" + "\n".join(lines)

    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_command_settings(phone: str, body: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_message

    await _log_message(db, phone, "inbound", body)

    time_match = re.search(r"(\d{1,2}):(\d{2})", body)
    if not time_match:
        time_match = re.search(r"(\d{1,2})\s*(am|pm)", body, re.IGNORECASE)
        if time_match:
            hour = int(time_match.group(1))
            ampm = time_match.group(2).lower()
            if ampm == "pm" and hour < 12:
                hour += 12
            if ampm == "am" and hour == 12:
                hour = 0
            new_time = f"{hour:02d}:00"
        else:
            reply = "send 'digest at HH:MM' (e.g. 'digest at 9:00') to change your digest time."
            _send_message(phone, reply)
            await _log_message(db, phone, "outbound", reply)
            await db.commit()
            return
    else:
        h, m = int(time_match.group(1)), int(time_match.group(2))
        if h > 23 or m > 59:
            reply = "that doesn't look like a valid time. try 'digest at 9:00'."
            _send_message(phone, reply)
            await _log_message(db, phone, "outbound", reply)
            await db.commit()
            return
        new_time = f"{h:02d}:{m:02d}"

    result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        user.digest_time = new_time

    reply = f"digest time updated to {new_time} ✓"
    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


# ── Media handlers ────────────────────────────────────────────────────────

async def _transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe audio via Gemini Files API (more reliable than inline data for audio)."""
    import asyncio
    import tempfile
    import os
    from app.services.gemini_client import get_gemini_client
    from google.genai import types as gtypes

    ext = (
        ".ogg" if "ogg" in mime_type
        else ".mp3" if "mp3" in mime_type
        else ".caf" if "caf" in mime_type
        else ".m4a"
    )
    client = get_gemini_client()

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        loop = asyncio.get_event_loop()
        uploaded = await loop.run_in_executor(
            None,
            lambda: client.files.upload(
                file=tmp_path,
                config={"mime_type": mime_type.split(";")[0].strip()},
            ),
        )

        response = await client.aio.models.generate_content(
            model=DEFAULT_GEMINI_MODEL,
            contents=[
                gtypes.Content(role="user", parts=[
                    gtypes.Part(file_data=gtypes.FileData(
                        file_uri=uploaded.uri,
                        mime_type=mime_type.split(";")[0].strip(),
                    )),
                    gtypes.Part(text="Transcribe this voice message accurately. Return only the transcription, no commentary."),
                ])
            ],
        )

        # Clean up the uploaded file from Gemini
        try:
            await loop.run_in_executor(None, lambda: client.files.delete(name=uploaded.name))
        except Exception:
            pass

        return (response.text or "").strip()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _guess_media_kind(content_type: str, media_url: str) -> str:
    """Return 'audio', 'image', or 'other' from content-type / URL."""
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime.startswith("audio/") or mime in {"audio/x-caf", "audio/mp4"}:
        return "audio"
    if mime.startswith("image/"):
        return "image"
    lower = media_url.lower()
    if any(lower.endswith(ext) for ext in (".m4a", ".caf", ".mp3", ".ogg", ".wav", ".aac")):
        return "audio"
    if any(lower.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif")):
        return "image"
    return "other"


async def _handle_image(phone: str, media_url: str, content_type: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_message
    from app.services.storage import upload_to_gcs
    from app.services.gemini_client import generate_with_retry_multimodal
    from app.services.blooio import download_media

    try:
        image_bytes, detected_type = await download_media(media_url)
        mime = (content_type or detected_type or "image/jpeg").split(";")[0].strip() or "image/jpeg"

        # Upload to GCS for persistent URL
        stored_uri = await upload_to_gcs(image_bytes, mime, folder="domino/images")
        raw_input = stored_uri or media_url

        description = await generate_with_retry_multimodal(
            model=DEFAULT_GEMINI_MODEL,
            prompt=(
                "Describe what's in this image concisely and factually in 1-3 sentences. "
                "If it's a screenshot of text, extract the key content. "
                "Return only the description."
            ),
            media_bytes=image_bytes,
            mime_type=mime,
        )
        description = description.strip()
    except Exception as e:
        logger.warning("Image processing failed for %s: %s", phone, e)
        raw_input = media_url
        description = "photo"

    result = await process_image(description)
    topics = list(result.topics or ([result.topic] if result.topic else ["General"]))

    item = DominoItem(
        user_phone=phone,
        raw_input=raw_input,
        input_type="image",
        extracted_text=description,
        summary=None,
        topic=result.topic or topics[0],
        topics=topics,
        key_ideas=None,
    )
    db.add(item)
    await db.flush()

    await _log_message(db, phone, "inbound", f"[image] {description[:100]}", related_item_id=item.id)

    reply = f"📷 saved: {description[:100]}"
    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_voice(phone: str, media_url: str, content_type: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_message
    from app.services.blooio import download_media

    try:
        audio_bytes, detected_type = await download_media(media_url)
        mime = (content_type or detected_type or "audio/mp4").split(";")[0].strip() or "audio/mp4"
        transcript = await _transcribe_audio(audio_bytes, mime)
        if not transcript:
            raise ValueError("Empty transcript")
    except Exception as e:
        logger.warning("Voice transcription failed for %s: %s", phone, e)
        reply = "sorry, i couldn't transcribe that voice note. try sending it as text."
        _send_message(phone, reply)
        await _log_message(db, phone, "outbound", reply)
        await db.commit()
        return

    # Voice → saved as note
    result = await process_note(transcript)
    topics = list(result.topics or ([result.topic] if result.topic else ["Inbox"]))

    item = DominoItem(
        user_phone=phone,
        raw_input=transcript,
        input_type="note",
        extracted_text=transcript,
        summary=None,
        topic=result.topic or topics[0],
        topics=topics,
        key_ideas=None,
    )
    db.add(item)
    await db.flush()

    await _log_message(db, phone, "inbound", f"[voice] {transcript[:100]}", related_item_id=item.id)

    reply = f"🎤 saved: {transcript[:80]}"
    _send_message(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


# ── Main message handler ──────────────────────────────────────────────────

async def _handle_message(
    raw_from: str,
    body: str,
    message_id: str | None = None,
) -> None:
    from app.api.endpoints.auth import _normalize_inbound_phone

    phone = _normalize_inbound_phone(raw_from)
    # Never persist Blooio CDN preview URLs as the saved item
    if _is_blooio_cdn(body.strip()):
        logger.warning(
            "Refusing to save Blooio CDN URL as item for %s: %s",
            phone[-4:],
            body[:120],
        )
        return
    canonical = _first_non_blooio_url(body)
    if canonical and canonical != body.strip():
        body = canonical

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
            user = result.scalar_one_or_none()

            if user is None:
                await _handle_new_user(phone, body, db)
                return

            recent = await _load_recent_messages(db, phone, limit=10)
            text = body.strip()
            lower = text.lower()

            if user.email_pending:
                await _handle_email_collection(phone, body, user, db)
            elif lower in _STOP_KEYWORDS:
                from app.api.endpoints.auth import _send_message
                user.digest_opted_out = True
                reply = "you've been unsubscribed from domino digests. text 'start' anytime to come back."
                _send_message(phone, reply)
                await _log_message(db, phone, "outbound", reply)
                await db.commit()
            elif lower in _START_KEYWORDS:
                from app.api.endpoints.auth import _send_message
                user.digest_opted_out = False
                reply = "welcome back — weekly digests are on again."
                _send_message(phone, reply)
                await _log_message(db, phone, "outbound", reply)
                await db.commit()
            elif lower in _LOGIN_KEYWORDS:
                await _handle_login(phone, db)
            elif _DELETE_RE.match(text):
                await _handle_command_delete(phone, body, db, recent)
            elif lower in _LIST_KEYWORDS:
                await _handle_command_list(phone, body, db)
            elif _SETTINGS_RE.match(text):
                await _handle_command_settings(phone, body, db)
            else:
                await _handle_save(phone, body, db, message_id=message_id)

        except Exception as e:
            logger.error("Message handler error for %s: %s", phone, e, exc_info=True)


async def _handle_media_message(
    raw_from: str,
    body: str,
    media_url: str,
) -> None:
    from app.api.endpoints.auth import _normalize_inbound_phone
    from app.services.blooio import download_media

    phone = _normalize_inbound_phone(raw_from)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
            user = result.scalar_one_or_none()
            if user is None:
                await _handle_new_user(phone, body or media_url, db)
                return

            try:
                _, content_type = await download_media(media_url)
            except Exception:
                content_type = ""

            kind = _guess_media_kind(content_type, media_url)
            if kind == "audio":
                await _handle_voice(phone, media_url, content_type, db)
            elif kind == "image":
                await _handle_image(phone, media_url, content_type, db)
            else:
                await _handle_save(phone, media_url, db)
        except Exception as e:
            logger.error("Media handler error for %s: %s", phone, e, exc_info=True)


_HTTP_URL_RE = re.compile(r"https?://[^\s<>\"')\]]+", re.IGNORECASE)


def _is_blooio_cdn(url: str) -> bool:
    """True for Blooio-hosted attachment/preview CDN URLs (not the user's link)."""
    try:
        from urllib.parse import urlparse
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        host = ""
    return host.endswith("blooio.com") or "bucket.blooio.com" in url.lower()


def _clean_url(url: str) -> str:
    return url.strip().rstrip(".,);]>\"'")


def _first_non_blooio_url(text: str | None) -> str | None:
    if not text:
        return None
    for match in _HTTP_URL_RE.finditer(text):
        candidate = _clean_url(match.group(0))
        if candidate.startswith("http") and not _is_blooio_cdn(candidate):
            return candidate
    return None


def _iter_attachments(attachments: Any) -> list[Any]:
    if not attachments:
        return []
    if isinstance(attachments, list):
        return attachments
    return [attachments]


def _first_attachment_url(attachments: Any) -> str | None:
    """Extract the first media URL from a Blooio attachments field."""
    for item in _iter_attachments(attachments):
        if isinstance(item, str) and item.startswith("http"):
            return item
        if isinstance(item, dict):
            url = item.get("url") or item.get("media_url")
            if isinstance(url, str) and url.startswith("http"):
                return url
    return None


def _url_from_attachments(attachments: Any) -> str | None:
    """
    iMessage link shares often arrive as a Blooio CDN preview image.
    Prefer any original/source URL on the attachment object; never return CDN hosts.
    """
    for item in _iter_attachments(attachments):
        if isinstance(item, str):
            # Bare attachment URL — only keep if it's not Blooio CDN
            if item.startswith("http") and not _is_blooio_cdn(item):
                return _clean_url(item)
            continue
        if not isinstance(item, dict):
            continue
        for key in (
            "original_url",
            "source_url",
            "page_url",
            "link",
            "href",
            "canonical_url",
            "website_url",
        ):
            val = item.get(key)
            if isinstance(val, str) and val.startswith("http") and not _is_blooio_cdn(val):
                return _clean_url(val)
        # Filename / name sometimes carries the shared URL
        for key in ("name", "filename", "file_name", "transfer_name", "title"):
            val = item.get(key)
            found = _first_non_blooio_url(val if isinstance(val, str) else None)
            if found:
                return found
        # Nested metadata
        meta = item.get("metadata") or item.get("meta")
        if isinstance(meta, dict):
            nested = _url_from_attachments([meta])
            if nested:
                return nested
    return None


def _extract_text(data: dict[str, Any]) -> str:
    """Pull message text from flat or nested Blooio payloads (incl. content objects)."""
    text = data.get("text")
    if isinstance(text, str) and text.strip():
        return text

    content = data.get("content")
    if isinstance(content, str) and content.strip():
        return content
    if isinstance(content, dict):
        inner = content.get("text") or content.get("body")
        if isinstance(inner, str) and inner.strip():
            return inner

    # URL-balloon fields — skip Blooio CDN (those are preview assets, not the link)
    for key in ("url", "link", "body"):
        val = data.get(key)
        if isinstance(val, str) and val.startswith("http") and not _is_blooio_cdn(val):
            return val

    parts = data.get("parts")
    if isinstance(parts, list):
        for part in parts:
            if not isinstance(part, dict):
                continue
            part_text = part.get("text")
            if isinstance(part_text, str) and part_text.strip():
                return part_text
            part_url = part.get("url")
            if isinstance(part_url, str) and part_url.startswith("http") and not _is_blooio_cdn(part_url):
                return part_url

    return ""


def _resolve_inbound_content(
    body: str,
    data: dict[str, Any],
    raw: dict[str, Any],
) -> tuple[str | None, str | None]:
    """
    Returns (user_url_or_text, media_url).
    Prefer the user's real link over Blooio preview-attachment CDN URLs.
    """
    attachments = data.get("attachments") or raw.get("attachments")
    media_url = _first_attachment_url(attachments) or (
        (data.get("media_url") or "").strip() or None
    )
    if media_url and _is_blooio_cdn(media_url):
        # Preview image only — don't treat as the saved item URL
        preview_cdn = media_url
        media_url = None
    else:
        preview_cdn = None

    user_url = (
        _first_non_blooio_url(body)
        or _url_from_attachments(attachments)
        or _first_non_blooio_url(_extract_text(data))
        or _first_non_blooio_url(_extract_text(raw))
    )

    if user_url:
        return user_url, None

    # No real URL found. Keep non-CDN media (true photos/voice). Drop Blooio previews.
    if media_url:
        return (body.strip() or None), media_url

    if preview_cdn:
        # Log attachment shape so we can map original-URL fields if Blooio adds them
        try:
            sample = json.dumps(_iter_attachments(attachments)[:2], default=str)[:800]
        except Exception:
            sample = str(_iter_attachments(attachments)[:2])[:800]
        logger.warning(
            "Blooio inbound link-preview without original URL cdn=%s body=%r attachments=%s",
            preview_cdn[:120],
            (body or "")[:80],
            sample,
        )
    return (body.strip() or None), None


_INBOUND_EVENTS = {
    "message.received",
    "message",
    "received",
}


# ── Blooio webhook endpoint ───────────────────────────────────────────────

@router.post("/sms")
async def blooio_webhook(
    request: Request,
    x_blooio_signature: str | None = Header(default=None, alias="X-Blooio-Signature"),
):
    """
    Blooio inbound message webhook.
    Configure webhook URL to: https://<host>/api/v1/sms  (type: message or all)

    Handlers run inline (not BackgroundTasks) so Cloud Run CPU isn't frozen
    after the HTTP response — otherwise saves silently never complete.
    """
    from app.services.blooio import verify_webhook_signature

    raw_body = await request.body()
    if not verify_webhook_signature(raw_body, x_blooio_signature):
        logger.warning(
            "Blooio webhook rejected: bad/missing signature (has_header=%s body_len=%s)",
            bool(x_blooio_signature),
            len(raw_body),
        )
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        raw: dict[str, Any] = json.loads(raw_body.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Expected JSON body")

    # Support both flat and nested { data: {...} } shapes
    data = raw.get("data") if isinstance(raw.get("data"), dict) else raw
    event = (
        raw.get("event")
        or raw.get("type")
        or data.get("event")
        or data.get("type")
        or ""
    )
    if isinstance(event, str):
        event = event.strip()
    else:
        event = ""

    # Ignore outbound/status callbacks
    if event and event not in _INBOUND_EVENTS and not event.endswith(".received"):
        logger.info("Blooio webhook ignored event=%s", event)
        return {"ok": True}

    from_number = (
        data.get("sender")
        or data.get("external_id")
        or data.get("from")
        or data.get("from_number")
        or raw.get("sender")
        or raw.get("external_id")
    )
    if not from_number:
        logger.warning("Blooio webhook missing sender; keys=%s", list(raw.keys())[:20])
        return {"ok": True}

    body = _extract_text(data) or _extract_text(raw)
    message_id = data.get("message_id") or data.get("id") or raw.get("message_id")
    save_text, media_url = _resolve_inbound_content(body, data, raw)

    logger.info(
        "Blooio inbound event=%s from=%s message_id=%s text_len=%s save=%s has_media=%s protocol=%s",
        event or "(none)",
        str(from_number)[-4:],
        message_id,
        len(body or ""),
        (save_text or "")[:80],
        bool(media_url),
        data.get("protocol") or raw.get("protocol"),
    )

    if save_text and (
        save_text.startswith("http")
        or _first_non_blooio_url(save_text)
        or not media_url
    ):
        # Links / notes — never save bucket.blooio.com preview URLs as the item
        await _handle_message(str(from_number), save_text, message_id)
    elif media_url:
        await _handle_media_message(str(from_number), body or "", media_url)
    else:
        logger.warning(
            "Blooio inbound empty body/media message_id=%s keys=%s data_sample=%s",
            message_id,
            list(data.keys())[:30],
            {k: data.get(k) for k in list(data.keys())[:12]},
        )

    return {"ok": True}


# ── Digest trigger (internal) ─────────────────────────────────────────────

@router.post("/digest/trigger")
async def trigger_digest(
    x_internal_secret: str | None = Header(default=None),
    force: bool = False,
):
    if x_internal_secret != settings.DOMINO_INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    from app.services.scheduler import process_due_reminders
    digest_result = await send_weekly_digests(force=force)
    reminder_count = await process_due_reminders()
    return {"digest": digest_result, "reminders_sent": reminder_count}


@router.get("/digest/debug")
async def debug_digest(
    x_internal_secret: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Show digest state for all users — email, item counts, sent status."""
    if x_internal_secret != settings.DOMINO_INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import select, func as sqlfunc
    from app.models.domino import DominoUser, DominoItem

    now_utc = datetime.now(timezone.utc)
    since = now_utc - timedelta(days=7)

    users_result = await db.execute(select(DominoUser))
    users = users_result.scalars().all()

    result = []
    for user in users:
        total = await db.execute(
            select(sqlfunc.count()).select_from(DominoItem).where(
                DominoItem.user_phone == user.phone,
            )
        )
        unsent = await db.execute(
            select(sqlfunc.count()).select_from(DominoItem).where(
                DominoItem.user_phone == user.phone,
                DominoItem.digest_sent == False,  # noqa: E712
                DominoItem.created_at >= since,
            )
        )
        sent = await db.execute(
            select(sqlfunc.count()).select_from(DominoItem).where(
                DominoItem.user_phone == user.phone,
                DominoItem.digest_sent == True,  # noqa: E712
            )
        )
        result.append({
            "phone": user.phone[-4:].rjust(len(user.phone), "*"),  # mask all but last 4
            "email": user.email or "(not set)",
            "email_pending": user.email_pending,
            "digest_opted_out": bool(user.digest_opted_out),
            "timezone": user.timezone,
            "digest_time": user.digest_time,
            "total_items": total.scalar(),
            "unsent_items_last_7d": unsent.scalar(),
            "total_sent_items": sent.scalar(),
        })

    # Items keyed to phones with no user row (should be empty under FK, but useful if orphans exist)
    orphan_rows = await db.execute(
        select(DominoItem.user_phone, sqlfunc.count())
        .where(
            DominoItem.user_phone.notin_(select(DominoUser.phone))
        )
        .group_by(DominoItem.user_phone)
    )
    orphans = [
        {"phone": phone[-4:].rjust(len(phone), "*"), "total_items": count}
        for phone, count in orphan_rows.all()
    ]

    return {"users": result, "orphans": orphans, "email_from": settings.EMAIL_FROM}


@router.post("/items/reclassify-defaults")
async def reclassify_default_topics(
    x_internal_secret: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
):
    """Re-run topic classification for items still on Inbox/General (links + notes)."""
    if x_internal_secret != settings.DOMINO_INTERNAL_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    result = await db.execute(
        select(DominoItem)
        .where(DominoItem.topic.in_(["General", "Inbox", "general", "inbox"]))
        .order_by(DominoItem.created_at.desc())
        .limit(min(limit, 200))
    )
    items = list(result.scalars().all())
    updated: list[dict[str, Any]] = []

    for item in items:
        if not topic_is_default(item.topic):
            continue
        text = (item.extracted_text or item.raw_input or "").strip()
        if not text:
            continue
        url = item.raw_input if detect_input_type(item.raw_input or "") == "link" else None
        new_topics = normalize_topics(await classify_topics(text, url=url))
        if not new_topics or new_topics[0].lower() == (item.topic or "").lower():
            continue
        item.topic = new_topics[0]
        item.topics = new_topics
        updated.append(
            {
                "id": str(item.id),
                "topic": item.topic,
                "topics": item.topics,
                "raw": (item.raw_input or "")[:80],
            }
        )

    await db.commit()
    return {"updated": len(updated), "items": updated}
