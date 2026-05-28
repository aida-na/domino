"""Domino WhatsApp webhook — receives inbound Twilio messages and saves items."""

import logging
import re

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

from fastapi import APIRouter, BackgroundTasks, Depends, Form, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import AsyncSessionLocal, get_db
from app.models.domino import DominoItem, DominoMessage, DominoUser
from app.services.digest import send_weekly_digests
from app.services.processor import detect_input_type, process_image, process_note, process_url
from app.services.gemini_client import DEFAULT_GEMINI_MODEL, generate_with_retry

logger = logging.getLogger(__name__)
router = APIRouter()

_TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

_LOGIN_KEYWORDS = {"login", "link", "dashboard", "hi", "hello", "start", "help"}
_STOP_KEYWORDS = {"stop", "unsubscribe", "opt out", "optout", "quit"}
_LIST_KEYWORDS = {"list", "show all", "my items", "my stuff", "what did i save"}

_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
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
        _send_whatsapp, build_magic_link, create_session_for_phone,
    )

    session_token, _ = await create_session_for_phone(phone, db)
    link = build_magic_link(session_token)
    welcome = f"welcome to domino 🁣\n\nyour second brain is ready. tap to open your dashboard:\n{link}"
    _send_whatsapp(phone, welcome)
    await _log_message(db, phone, "outbound", welcome)

    # Ask for email for weekly digest
    result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        user.email_pending = True
    email_prompt = "one last thing — what's your email? i'll send your weekly digest there. reply with your email or 'skip'."
    _send_whatsapp(phone, email_prompt)
    await _log_message(db, phone, "outbound", email_prompt)

    await _save_item(phone, body, db)


async def _handle_login(phone: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import (
        _send_whatsapp, build_magic_link, create_session_for_phone,
    )
    session_token, _ = await create_session_for_phone(phone, db)
    link = build_magic_link(session_token)
    reply = f"here's your dashboard link:\n{link}"
    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _save_item(phone: str, raw: str, db: AsyncSession) -> DominoItem | None:
    """Detect type, process, and persist a DominoItem. Returns the saved item."""
    input_type = detect_input_type(raw)

    if input_type in ("link", "pdf"):
        result = await process_url(raw)
    else:
        result = await process_note(raw)

    item = DominoItem(
        user_phone=phone,
        raw_input=raw,
        input_type=result.input_type,
        extracted_text=result.extracted_text or None,
        summary=result.summary or None,
        topic=result.topic or None,
        key_ideas=result.key_ideas or None,
    )
    db.add(item)
    await db.flush()
    return item


async def _handle_save(phone: str, body: str, db: AsyncSession, message_sid: str | None = None) -> None:
    from app.api.endpoints.auth import _react_whatsapp

    if message_sid:
        _react_whatsapp(phone, "👍", message_sid)

    item = await _save_item(phone, body, db)

    await _log_message(db, phone, "inbound", body, related_item_id=item.id if item else None)
    await db.commit()


async def _handle_email_collection(phone: str, body: str, user: DominoUser, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_whatsapp

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
            await send_weekly_digests(force=True)
            reply = f"got it — sending your digest to {text.lower()} now 📬"
        except Exception as e:
            logger.warning("Failed to send digest after email collection for %s: %s", phone, e)
            reply = f"saved your email ({text.lower()}) — you'll get next week's digest there 📬"
    else:
        reply = "that doesn't look like an email. reply with your email address or 'skip'."

    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_command_delete(phone: str, body: str, db: AsyncSession, recent: list[DominoMessage]) -> None:
    from app.api.endpoints.auth import _send_whatsapp

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
        _send_whatsapp(phone, reply)
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

    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_command_list(phone: str, body: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_whatsapp

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

    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_command_settings(phone: str, body: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_whatsapp
    from datetime import datetime
    from sqlalchemy import select

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
            _send_whatsapp(phone, reply)
            await _log_message(db, phone, "outbound", reply)
            await db.commit()
            return
    else:
        h, m = int(time_match.group(1)), int(time_match.group(2))
        if h > 23 or m > 59:
            reply = "that doesn't look like a valid time. try 'digest at 9:00'."
            _send_whatsapp(phone, reply)
            await _log_message(db, phone, "outbound", reply)
            await db.commit()
            return
        new_time = f"{h:02d}:{m:02d}"

    result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = result.scalar_one_or_none()
    if user:
        user.digest_time = new_time

    reply = f"digest time updated to {new_time} ✓"
    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


# ── Media handlers ────────────────────────────────────────────────────────

async def _download_twilio_media(media_url: str) -> bytes:
    import httpx
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            media_url,
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
        )
        resp.raise_for_status()
        return resp.content


async def _transcribe_audio(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe audio via Gemini Files API (more reliable than inline data for audio)."""
    import asyncio
    import tempfile
    import os
    from app.services.gemini_client import get_gemini_client
    from google.genai import types as gtypes

    ext = ".ogg" if "ogg" in mime_type else ".mp3" if "mp3" in mime_type else ".m4a"
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


async def _handle_image(phone: str, media_url: str, content_type: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_whatsapp
    from app.services.storage import upload_to_gcs
    from app.services.gemini_client import generate_with_retry_multimodal

    try:
        image_bytes = await _download_twilio_media(media_url)
        mime = content_type.split(";")[0].strip() or "image/jpeg"

        # Upload to GCS for persistent URL (Twilio URLs expire)
        stored_uri = await upload_to_gcs(image_bytes, mime, folder="domino/images")
        raw_input = stored_uri or media_url  # fall back to Twilio URL if GCS not configured

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

    item = DominoItem(
        user_phone=phone,
        raw_input=raw_input,
        input_type="image",
        extracted_text=description,
        summary=None,
        topic=result.topic or None,
        key_ideas=None,
    )
    db.add(item)
    await db.flush()

    await _log_message(db, phone, "inbound", f"[image] {description[:100]}", related_item_id=item.id)

    reply = f"📷 saved: {description[:100]}"
    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


async def _handle_voice(phone: str, media_url: str, content_type: str, db: AsyncSession) -> None:
    from app.api.endpoints.auth import _send_whatsapp

    try:
        audio_bytes = await _download_twilio_media(media_url)
        mime = content_type.split(";")[0].strip() or "audio/ogg"
        transcript = await _transcribe_audio(audio_bytes, mime)
        if not transcript:
            raise ValueError("Empty transcript")
    except Exception as e:
        logger.warning("Voice transcription failed for %s: %s", phone, e)
        reply = "sorry, i couldn't transcribe that voice note. try sending it as text."
        _send_whatsapp(phone, reply)
        await _log_message(db, phone, "outbound", reply)
        await db.commit()
        return

    # Voice → saved as note
    result = await process_note(transcript)

    item = DominoItem(
        user_phone=phone,
        raw_input=transcript,
        input_type="note",
        extracted_text=transcript,
        summary=None,
        topic=result.topic or None,
        key_ideas=None,
    )
    db.add(item)
    await db.flush()

    await _log_message(db, phone, "inbound", f"[voice] {transcript[:100]}", related_item_id=item.id)

    reply = f"🎤 saved: {transcript[:80]}"
    _send_whatsapp(phone, reply)
    await _log_message(db, phone, "outbound", reply)
    await db.commit()


# ── Main message handler ──────────────────────────────────────────────────

async def _handle_message(raw_from: str, body: str, message_sid: str | None = None) -> None:
    from app.api.endpoints.auth import _strip_whatsapp

    phone = _strip_whatsapp(raw_from)

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
            elif lower in _LOGIN_KEYWORDS:
                await _handle_login(phone, db)
            elif lower in _STOP_KEYWORDS:
                from app.api.endpoints.auth import _send_whatsapp
                reply = "you've been unsubscribed from domino digests. text 'start' anytime to come back."
                _send_whatsapp(phone, reply)
                await _log_message(db, phone, "outbound", reply)
                await db.commit()
            elif _DELETE_RE.match(text):
                await _handle_command_delete(phone, body, db, recent)
            elif lower in _LIST_KEYWORDS:
                await _handle_command_list(phone, body, db)
            elif _SETTINGS_RE.match(text):
                await _handle_command_settings(phone, body, db)
            else:
                await _handle_save(phone, body, db, message_sid=message_sid)

        except Exception as e:
            logger.error("WhatsApp handler error for %s: %s", phone, e, exc_info=True)


async def _handle_media_message(raw_from: str, body: str, media_url: str, media_content_type: str) -> None:
    from app.api.endpoints.auth import _strip_whatsapp

    phone = _strip_whatsapp(raw_from)

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
            user = result.scalar_one_or_none()
            if user is None:
                await _handle_new_user(phone, body or media_url, db)
                return

            mime = media_content_type.split(";")[0].strip().lower()
            if mime.startswith("audio/"):
                await _handle_voice(phone, media_url, media_content_type, db)
            elif mime.startswith("image/"):
                await _handle_image(phone, media_url, media_content_type, db)
            else:
                await _handle_save(phone, media_url, db)
        except Exception as e:
            logger.error("WhatsApp media handler error for %s: %s", phone, e, exc_info=True)


# ── WhatsApp webhook endpoint ─────────────────────────────────────────────

@router.post("/sms")
async def whatsapp_webhook(
    background_tasks: BackgroundTasks,
    From: str | None = Form(default=None),
    Body: str | None = Form(default=None),
    NumMedia: str | None = Form(default=None),
    MediaUrl0: str | None = Form(default=None),
    MediaContentType0: str | None = Form(default=None),
    MessageSid: str | None = Form(default=None),
):
    """Twilio inbound WhatsApp webhook. Returns empty TwiML immediately."""
    if From:
        num_media = int(NumMedia or "0")
        if num_media > 0 and MediaUrl0 and MediaContentType0:
            background_tasks.add_task(
                _handle_media_message, From, Body or "", MediaUrl0, MediaContentType0
            )
        elif Body is not None:
            logger.info("Inbound WhatsApp MessageSid=%s", MessageSid)
            background_tasks.add_task(_handle_message, From, Body, MessageSid)
    return Response(content=_TWIML_EMPTY, media_type="application/xml")


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
            "timezone": user.timezone,
            "unsent_items_last_7d": unsent.scalar(),
            "total_sent_items": sent.scalar(),
        })

    return {"users": result, "email_from": settings.EMAIL_FROM}
