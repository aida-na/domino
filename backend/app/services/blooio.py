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

# Reuse TLS connections — creating a Client per send adds ~200–800ms each time.
_http: httpx.Client | None = None


def _client() -> httpx.Client:
    global _http
    if _http is None or _http.is_closed:
        _http = httpx.Client(
            timeout=httpx.Timeout(15.0, connect=5.0),
            headers={"User-Agent": "domino-api/1.0"},
        )
    return _http

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


class BlooioError(RuntimeError):
    """Raised when Blooio rejects a send/react request."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        body: str | None = None,
        user_message: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.body = body
        self.user_message = user_message


def _paused_conversation_user_message(body: str | None) -> str | None:
    """Blooio blocks outbound when the thread is idle 14+ days after re-engagement."""
    if not body:
        return None
    lower = body.lower()
    if "paused" in lower and ("re-engagement" in lower or "14 days" in lower):
        from_number = (settings.BLOOIO_PHONE_NUMBER or "+14249441140").strip()
        return (
            "your iMessage thread with domino is paused — send us any message first "
            f"({from_number}), then request a code again."
        )
    return None


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


def _raise_for_blooio(resp: httpx.Response, *, action: str) -> None:
    if resp.is_success:
        return
    body = (resp.text or "")[:500]
    paused = _paused_conversation_user_message(body)
    if paused:
        raise BlooioError(
            f"Blooio {action} failed — conversation paused",
            status_code=resp.status_code,
            body=body,
            user_message=paused,
        )
    # Blooio documents 503 as "no active number available"
    if resp.status_code == 503:
        raise BlooioError(
            "Blooio has no active sender for this API key (503). "
            "In the Blooio dashboard open Channels and drag your number onto this API key; "
            "confirm the line shows Active (not provisioning/offline). "
            "Also prefer a key shaped like bl_live_… if you still have an older api_… key.",
            status_code=503,
            body=body,
        )
    raise BlooioError(
        f"Blooio {action} failed ({resp.status_code}): {body or resp.reason_phrase}",
        status_code=resp.status_code,
        body=body,
    )


def send_message(
    to: str,
    body: str,
    *,
    attachments: list[str] | None = None,
    pin_from_number: bool = True,
) -> dict[str, Any] | None:
    """
    Send an iMessage/SMS via Blooio.
    Falls back to console print when credentials are missing (local dev).
    Successful sends return HTTP 202 (accepted/queued).
    """
    if not _configured():
        if settings.is_production:
            raise BlooioError("BLOOIO_API_KEY is not configured")
        from app.core.privacy import mask_phone

        logger.warning(
            "BLOOIO_API_KEY is not set — dev console fallback for %s",
            mask_phone(to),
        )
        if settings.DEBUG:
            print(f"\n[DOMINO DEV] Message to {mask_phone(to)}:\n{body}\n", flush=True)
        else:
            print(f"\n[DOMINO DEV] Message to {mask_phone(to)}: [redacted]\n", flush=True)
        return None

    # Omit from_number by default — Blooio auto-selects from the key's Channels pool.
    # Only pin a number when explicitly configured AND you have assigned it under Channels.
    payload: dict[str, Any] = {"text": body}
    if attachments:
        payload["attachments"] = attachments

    from_number = (settings.BLOOIO_PHONE_NUMBER or "").strip()
    if pin_from_number and from_number:
        payload["from_number"] = from_number

    url = f"{BLOOIO_API_BASE}/chats/{_chat_path(to)}/messages"
    t0 = time.monotonic()
    max_attempts = 3
    retryable_status = {408, 429, 500, 502, 503, 504}

    try:
        client = _client()
        resp: httpx.Response | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                resp = client.post(url, headers=_auth_headers(), json=payload)
            except httpx.RequestError as e:
                if attempt >= max_attempts:
                    raise BlooioError(f"Blooio send_message network error: {e}") from e
                logger.warning(
                    "Blooio send_message network error to %s (attempt %d/%d): %s",
                    to[-4:],
                    attempt,
                    max_attempts,
                    e,
                )
                time.sleep(0.4 * attempt)
                continue

            # If pin failed (number not on key), fall back to pool auto-select once
            if (
                not resp.is_success
                and pin_from_number
                and from_number
                and resp.status_code in {400, 403, 503}
            ):
                logger.warning(
                    "Blooio from_number=%s failed (%s); retrying auto-select. body=%s",
                    from_number,
                    resp.status_code,
                    (resp.text or "")[:300],
                )
                payload.pop("from_number", None)
                resp = client.post(url, headers=_auth_headers(), json=payload)

            if resp.is_success or resp.status_code not in retryable_status or attempt >= max_attempts:
                break

            logger.warning(
                "Blooio send_message retryable status %s to %s (attempt %d/%d) body=%s",
                resp.status_code,
                to[-4:],
                attempt,
                max_attempts,
                (resp.text or "")[:300],
            )
            time.sleep(0.4 * attempt)

        assert resp is not None
        _raise_for_blooio(resp, action="send_message")
        data = resp.json()
        logger.info(
            "Blooio send ok to %s http=%s message_id=%s elapsed_ms=%d",
            to[-4:],
            resp.status_code,
            data.get("message_id") if isinstance(data, dict) else None,
            int((time.monotonic() - t0) * 1000),
        )
        return data
    except BlooioError as e:
        logger.error(
            "Blooio send_message to %s after %dms: status=%s %s body=%s",
            to[-4:],
            int((time.monotonic() - t0) * 1000),
            e.status_code,
            e,
            e.body,
        )
        raise
    except Exception as e:
        logger.exception("Blooio send_message failed to %s: %s", to[-4:], e)
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
        resp = _client().post(
            f"{BLOOIO_API_BASE}/chats/{_chat_path(chat_id)}/messages/{quote(message_id, safe='')}/reactions",
            headers=_auth_headers(),
            json={"reaction": reaction_value, "direction": "inbound"},
        )
        if not resp.is_success:
            logger.warning(
                "Blooio send_reaction failed for %s/%s: %s %s",
                chat_id,
                message_id,
                resp.status_code,
                (resp.text or "")[:300],
            )
            return None
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
        if settings.allow_unsigned_webhooks:
            return True
        logger.error("BLOOIO_WEBHOOK_SECRET is not set — rejecting webhook")
        return False
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
