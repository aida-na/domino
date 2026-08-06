"""User taste profiles and similar-user matching."""

from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domino import DominoItem, DominoUser, DominoUserTasteProfile

TOPIC_WEIGHTS = (1.0, 0.5, 0.25)
MIN_ITEMS_FOR_TASTE = 5
MIN_SIMILARITY = 0.3
DEFAULT_SIMILAR_LIMIT = 50


def _topic_list(item: DominoItem) -> list[str]:
    topics = list(item.topics or [])
    if not topics and item.topic:
        topics = [item.topic]
    return [t for t in topics if t]


def compute_topic_weights(items: list[DominoItem]) -> dict[str, float]:
    scores: dict[str, float] = {}
    for item in items:
        for idx, topic in enumerate(_topic_list(item)[:3]):
            weight = TOPIC_WEIGHTS[idx] if idx < len(TOPIC_WEIGHTS) else 0.25
            scores[topic] = scores.get(topic, 0.0) + weight
    total = sum(scores.values())
    if total <= 0:
        return {}
    return {topic: round(score / total, 6) for topic, score in scores.items()}


def cosine_similarity(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in keys)
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a <= 0 or norm_b <= 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def build_taste_profile(user_phone: str, db: AsyncSession) -> DominoUserTasteProfile | None:
    result = await db.execute(
        select(DominoItem).where(DominoItem.user_phone == user_phone)
    )
    items = list(result.scalars().all())
    weights = compute_topic_weights(items)
    profile_result = await db.execute(
        select(DominoUserTasteProfile).where(DominoUserTasteProfile.user_phone == user_phone)
    )
    profile = profile_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if profile is None:
        profile = DominoUserTasteProfile(
            user_phone=user_phone,
            topic_weights=weights,
            item_count=len(items),
            updated_at=now,
        )
        db.add(profile)
    else:
        profile.topic_weights = weights
        profile.item_count = len(items)
        profile.updated_at = now
    await db.flush()
    return profile


async def find_similar_users(
    user_phone: str,
    db: AsyncSession,
    *,
    limit: int = DEFAULT_SIMILAR_LIMIT,
    min_similarity: float = MIN_SIMILARITY,
) -> list[str]:
    profile_result = await db.execute(
        select(DominoUserTasteProfile).where(DominoUserTasteProfile.user_phone == user_phone)
    )
    my_profile = profile_result.scalar_one_or_none()
    if not my_profile or my_profile.item_count < MIN_ITEMS_FOR_TASTE:
        return []
    my_weights = dict(my_profile.topic_weights or {})
    if not my_weights:
        return []

    candidates = await db.execute(
        select(DominoUserTasteProfile, DominoUser)
        .join(DominoUser, DominoUser.phone == DominoUserTasteProfile.user_phone)
        .where(
            DominoUserTasteProfile.user_phone != user_phone,
            DominoUser.discover_opt_in.is_(True),
            DominoUserTasteProfile.item_count >= MIN_ITEMS_FOR_TASTE,
        )
    )
    scored: list[tuple[float, str]] = []
    for profile, _user in candidates.all():
        sim = cosine_similarity(my_weights, dict(profile.topic_weights or {}))
        if sim >= min_similarity:
            scored.append((sim, profile.user_phone))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [phone for _, phone in scored[:limit]]


def top_topics(weights: dict[str, float], limit: int = 3) -> list[str]:
    return [t for t, _ in sorted(weights.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]]
