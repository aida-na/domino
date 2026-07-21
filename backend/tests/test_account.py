"""Account export, deletion, and media token tests."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.core.config import settings
from app.core.media_tokens import create_media_token, verify_media_token


def test_media_token_roundtrip(monkeypatch):
    monkeypatch.setattr(settings, "SECRET_KEY", "test-secret-key-for-media-tokens")
    session_id = str(uuid4())
    url = "gcs://domino-media-prod/users/+15551234567/abc.jpg"
    token = create_media_token(session_id=session_id, media_url=url, ttl_seconds=900)
    assert verify_media_token(token, url) == session_id
    assert verify_media_token(token, "gcs://other") is None


def test_media_token_rejects_tampered_url(monkeypatch):
    monkeypatch.setattr(settings, "SECRET_KEY", "test-secret-key-for-media-tokens")
    session_id = str(uuid4())
    url = "https://cdn.blooio.com/media/abc"
    token = create_media_token(session_id=session_id, media_url=url)
    assert verify_media_token(token, url + "?x=1") is None


def test_production_requires_webhook_secret(monkeypatch):
    monkeypatch.setattr(settings, "TESTING", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "SECRET_KEY", "real-secret")
    monkeypatch.setattr(settings, "BLOOIO_WEBHOOK_SECRET", "")
    monkeypatch.setattr(settings, "DOMINO_INTERNAL_SECRET", "internal")

    from pydantic import ValidationError
    from app.core.config import Settings

    with pytest.raises(ValidationError, match="BLOOIO_WEBHOOK_SECRET"):
        Settings(
            ENVIRONMENT="production",
            DEBUG=False,
            SECRET_KEY="real-secret",
            BLOOIO_WEBHOOK_SECRET="",
            DOMINO_INTERNAL_SECRET="internal",
        )
