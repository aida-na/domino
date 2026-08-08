"""Discover aggregation and opt-in gating tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.discover import (
    _aggregate_trending,
    get_friends_trending,
    get_global_trending,
    get_similar_taste_trending,
)


def _row(url, title, user, saved_at=None, topic="Technology"):
    return SimpleNamespace(
        url_normalized=url,
        title=title,
        user_phone=user,
        topic_primary=topic,
        saved_at=saved_at or datetime.now(timezone.utc),
    )


def test_aggregate_trending_counts_distinct_users():
    rows = [
        _row("https://a.com/1", "A", "+1"),
        _row("https://a.com/1", "A", "+2"),
        _row("https://b.com/2", "B", "+3"),
    ]
    items = _aggregate_trending(rows, limit=10, min_savers=2)
    assert len(items) == 1
    assert items[0]["url"] == "https://a.com/1"
    assert items[0]["save_count"] == 2


def test_aggregate_trending_anonymized_payload():
    rows = [_row("https://a.com/1", "Title", "+1"), _row("https://a.com/1", "Title", "+2")]
    items = _aggregate_trending(rows, limit=10, min_savers=2)
    assert set(items[0].keys()) == {"url", "title", "save_count", "topic"}
    assert "user_phone" not in items[0]


@pytest.mark.asyncio
async def test_similar_taste_opt_in_required():
    user = SimpleNamespace(phone="+15550001111", discover_opt_in=False)
    db = AsyncMock()
    result = await get_similar_taste_trending(user, db)
    assert result["opt_in_required"] is True
    assert result["items"] == []
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_friends_trending_opt_in_required():
    user = SimpleNamespace(phone="+15550001111", discover_opt_in=False)
    db = AsyncMock()
    result = await get_friends_trending(user, db)
    assert result["opt_in_required"] is True
    assert result["items"] == []


@pytest.mark.asyncio
async def test_global_trending_no_opt_in_gate():
    user = SimpleNamespace(phone="+15550001111", discover_opt_in=False)
    db = AsyncMock()
    rows_result = MagicMock()
    rows_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
    db.execute = AsyncMock(return_value=rows_result)
    result = await get_global_trending(user, db)
    assert result["items"] == []
    assert result["cohort_label"] == "domino users"
    db.execute.assert_called_once()
