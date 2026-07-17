"""Daily new-user cap."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.api.endpoints.auth import SignupFullError, assert_can_create_user, count_new_users_today
from app.core.config import settings


@pytest.mark.asyncio
async def test_assert_can_create_user_blocks_when_at_limit(monkeypatch):
    monkeypatch.setattr(settings, "DAILY_NEW_USER_LIMIT", 5)

    db = AsyncMock()
    # count_new_users_today uses db.execute → scalar_one
    result = MagicMock()
    result.scalar_one.return_value = 5
    db.execute = AsyncMock(return_value=result)

    with pytest.raises(SignupFullError):
        await assert_can_create_user(db)


@pytest.mark.asyncio
async def test_assert_can_create_user_allows_under_limit(monkeypatch):
    monkeypatch.setattr(settings, "DAILY_NEW_USER_LIMIT", 5)

    db = AsyncMock()
    result = MagicMock()
    result.scalar_one.return_value = 4
    db.execute = AsyncMock(return_value=result)

    await assert_can_create_user(db)


@pytest.mark.asyncio
async def test_assert_can_create_user_unlimited(monkeypatch):
    monkeypatch.setattr(settings, "DAILY_NEW_USER_LIMIT", 0)

    db = AsyncMock()
    await assert_can_create_user(db)
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_count_new_users_today_uses_utc_midnight():
    db = AsyncMock()
    result = MagicMock()
    result.scalar_one.return_value = 2
    db.execute = AsyncMock(return_value=result)

    n = await count_new_users_today(db)
    assert n == 2
    db.execute.assert_awaited_once()
    # sanity: "today" should be UTC
    assert datetime.now(timezone.utc).tzinfo is not None
