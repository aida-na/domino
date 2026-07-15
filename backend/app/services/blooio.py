"""Blooio iMessage / SMS client (v2 API)."""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

BLOOIO_API_BASE = "https://api.blooio.com/v2/api"

# Map common emoji ack → Blooio classic tapback types (prefixed with +)
_EMOJI_TO_REACTION = {
    "👍": "like",
    "❤️": "love",
    "❤": "love",
    "👎": "dislike",
    "😂": "laugh",
    "‼️": "emphasize",
    "❗️": "emphasize",
    "❓": "question",
}


def _configured() -> bool:
    return bool(settings.BLOOIO_API_KEY)


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.BLOOIO_API_KEY}",
        "Content-Type": "application/json",
    }


def _chat_path(phone: str) -> str:
    """URL-encode E.164 phone for /chats/{chatId}/... paths."""
    return quote(phone, safe="")


def send_message(to: str, body: str, *, attachments: list[str] | None = None) -> dict[str, Any] | None:
    """
    Send an iMessage/SMS via Blooio.
    Falls back to console print when credentials are missing (local dev).
    """
    if not _configured():
        print(f"\n[DOMINO DEV] Message to {to}: {body}\n", flush=True)
        return None

    payload: dict[str, Any] = {"text": body}
    if attachments:
        payload["attachments"] = attachments
    if settings.BLOOIO_PHONE_NUMBER:
        payload["from_number"] = settings.BLOOIO_PHONE_NUMBER

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{BLOOIO_API_BASE}/chats/{_chat_path(to)}/messages",
                headers=_auth_headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.exception("Blooio send_message failed to %s: %s", to, e)
        raise


def send_reaction(chat_id: str, message_id: str, emoji_or_type: str = "like") -> dict[str, Any] | None:
    """
    Send an iMessage tapback on an inbound message.
    Accepts a classic tapback type (like, love, …) or a mapped emoji.
    """
    reaction = _EMOJI_TO_REACTION.get(emoji_or_type, emoji_or_type)
    if reaction not in {"love", "like", "dislike", "laugh", "emphasize", "question"}:
        reaction = "like"
    reaction_value = f"+{reaction}"

    if not _configured():
        print(
            f"\n[DOMINO DEV] React {reaction_value} on {message_id} in {chat_id}\n",
            flush=True,
        )
        return None

    try:
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{BLOOIO_API_BASE}/chats/{_chat_path(chat_id)}/messages/{quote(message_id, safe='')}/reactions",
                headers=_auth_headers(),
                json={"reaction": reaction_value, "direction": "inbound"},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        # Tapbacks are best-effort; don't fail the save path.
        logger.warning("Blooio send_reaction failed for %s/%s: %s", chat_id, message_id, e)
        return None


async def download_media(media_url: str) -> tuple[bytes, str]:
    """Download inbound media. Returns (bytes, content_type)."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(media_url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "application/octet-stream")
        return resp.content, content_type.split(";")[0].strip()


def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """
    Verify X-Blooio-Signature (HMAC-SHA256 of `{t}.{raw_body}`).
    If BLOOIO_WEBHOOK_SECRET is unset, allow (local/dev).
    """
    secret = settings.BLOOIO_WEBHOOK_SECRET
    if not secret:
        return True
    if not signature_header:
        return False

    parts: dict[str, str] = {}
    for part in signature_header.split(","):
        if "=" in part:
            k, v = part.split("=", 1)
            parts[k.strip()] = v.strip()

    timestamp = parts.get("t")
    signature = parts.get("v1")
    if not timestamp or not signature:
        return False

    try:
        age = int(time.time()) - int(timestamp)
    except ValueError:
        return False
    if age > 300:
        logger.warning("Blooio webhook timestamp too old (age=%ss)", age)
        return False

    signed_payload = f"{timestamp}.{raw_body.decode('utf-8')}"
    expected = hmac.new(
        secret.encode("utf-8"),
        signed_payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
