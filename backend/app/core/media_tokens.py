"""Short-lived HMAC tokens for media-proxy URLs (avoids session UUID in img src)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from urllib.parse import quote

from app.core.config import settings

_MEDIA_TTL_SECONDS = 900  # 15 minutes


def _sign(payload: str) -> str:
    return hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_media_token(*, session_id: str, media_url: str, ttl_seconds: int = _MEDIA_TTL_SECONDS) -> str:
    expires = int(time.time()) + ttl_seconds
    payload = f"{session_id}|{media_url}|{expires}"
    sig = _sign(payload)
    raw = f"{payload}|{sig}"
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii").rstrip("=")


def verify_media_token(token: str, media_url: str) -> str | None:
    """
    Validate token for the given media URL.
    Returns session_id if valid, else None.
    """
    try:
        padded = token + "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8")
        session_id, url, expires_str, sig = raw.rsplit("|", 3)
    except (ValueError, UnicodeDecodeError):
        return None

    if url != media_url:
        return None
    try:
        expires = int(expires_str)
    except ValueError:
        return None
    if expires < int(time.time()):
        return None

    payload = f"{session_id}|{url}|{expires_str}"
    if not hmac.compare_digest(_sign(payload), sig):
        return None
    return session_id


def build_media_proxy_path(media_url: str, media_token: str) -> str:
    return f"/api/v1/media-proxy?url={quote(media_url, safe='')}&media_token={quote(media_token, safe='')}"
