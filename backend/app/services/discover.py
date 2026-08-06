"""Discover trending feeds — similar taste and friends."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domino import DominoSharedSave, DominoUser, DominoUserTasteProfile
from app.services.friends import friend_phones
from app.services.taste_profile import (
    MIN_ITEMS_FOR_TASTE,
    find_similar_users,
    top_topics,
)

DEFAULT_WINDOW_DAYS = 7
DEFAULT_LIMIT = 20
MIN_SIMILAR_SAVERS = 2


def _window_start(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _aggregate_trending(
    rows: list[DominoSharedSave],
    *,
    limit: int,
    min_savers: int,
) -> list[dict]:
    by_url: dict[str, dict] = {}
    users_by_url: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        users_by_url[row.url_normalized].add(row.user_phone)
        existing = by_url.get(row.url_normalized)
        if existing is None or row.saved_at > existing["_saved_at"]:
            by_url[row.url_normalized] = {
                "url": row.url_normalized,
                "title": row.title,
                "topic": row.topic_primary,
                "_saved_at": row.saved_at,
            }
    items = []
    for url, meta in by_url.items():
        count = len(users_by_url[url])
        if count < min_savers:
            continue
        items.append({
            "url": meta["url"],
            "title": meta["title"],
            "save_count": count,
            "topic": meta["topic"],
            "_saved_at": meta["_saved_at"],
        })
    items.sort(key=lambda x: (-x["save_count"], -x["_saved_at"].timestamp()))
    return [
        {k: v for k, v in item.items() if not k.startswith("_")}
        for item in items[:limit]
    ]


async def get_discover_status(user: DominoUser, db: AsyncSession) -> dict:
    profile_result = await db.execute(
        select(DominoUserTasteProfile).where(DominoUserTasteProfile.user_phone == user.phone)
    )
    profile = profile_result.scalar_one_or_none()
    item_count = profile.item_count if profile else 0
    taste_ready = item_count >= MIN_ITEMS_FOR_TASTE
    friends = await friend_phones(db, user.phone)
    friend_count = len(friends)

    has_data = False
    if user.discover_opt_in:
        shared_count = await db.execute(
            select(func.count()).select_from(DominoSharedSave)
        )
        has_data = int(shared_count.scalar_one() or 0) > 0

    return {
        "opt_in": bool(user.discover_opt_in),
        "taste_ready": taste_ready,
        "item_count": item_count,
        "friend_count": friend_count,
        "has_data": has_data,
    }


async def get_similar_taste_trending(
    user: DominoUser,
    db: AsyncSession,
    *,
    window_days: int = DEFAULT_WINDOW_DAYS,
    limit: int = DEFAULT_LIMIT,
) -> dict:
    if not user.discover_opt_in:
        return {
            "items": [],
            "cohort_label": "people with similar taste",
            "opt_in_required": True,
        }

    since = _window_start(window_days)
    similar = await find_similar_users(user.phone, db)
    cohort_label = "people with similar taste"

    if similar:
        result = await db.execute(
            select(DominoSharedSave).where(
                DominoSharedSave.user_phone.in_(similar),
                DominoSharedSave.saved_at >= since,
            )
        )
        items = _aggregate_trending(
            list(result.scalars().all()),
            limit=limit,
            min_savers=MIN_SIMILAR_SAVERS,
        )
        return {"items": items, "cohort_label": cohort_label, "opt_in_required": False}

    # Cold start: global trending in user's top topics
    profile_result = await db.execute(
        select(DominoUserTasteProfile).where(DominoUserTasteProfile.user_phone == user.phone)
    )
    profile = profile_result.scalar_one_or_none()
    topics = top_topics(dict(profile.topic_weights or {})) if profile else []
    if not topics:
        return {"items": [], "cohort_label": cohort_label, "opt_in_required": False}

    result = await db.execute(
        select(DominoSharedSave)
        .join(DominoUser, DominoUser.phone == DominoSharedSave.user_phone)
        .where(
            DominoSharedSave.saved_at >= since,
            DominoSharedSave.user_phone != user.phone,
            DominoUser.discover_opt_in.is_(True),
            DominoSharedSave.topic_primary.in_(topics),
        )
    )
    items = _aggregate_trending(
        list(result.scalars().all()),
        limit=limit,
        min_savers=MIN_SIMILAR_SAVERS,
    )
    return {"items": items, "cohort_label": cohort_label, "opt_in_required": False}


async def get_friends_trending(
    user: DominoUser,
    db: AsyncSession,
    *,
    window_days: int = DEFAULT_WINDOW_DAYS,
    limit: int = DEFAULT_LIMIT,
) -> dict:
    if not user.discover_opt_in:
        return {"items": [], "friend_count": 0, "opt_in_required": True}

    friends = await friend_phones(db, user.phone)
    if not friends:
        return {"items": [], "friend_count": 0, "opt_in_required": False}

    since = _window_start(window_days)
    result = await db.execute(
        select(DominoSharedSave).where(
            DominoSharedSave.user_phone.in_(friends),
            DominoSharedSave.saved_at >= since,
        )
    )
    items = _aggregate_trending(
        list(result.scalars().all()),
        limit=limit,
        min_savers=1,
    )
    return {"items": items, "friend_count": len(friends), "opt_in_required": False}
