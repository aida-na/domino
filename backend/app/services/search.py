"""Keyword and hybrid retrieval over saved items for ask / chat."""

from __future__ import annotations

import math
import re
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domino import DominoItem

MAX_ITEMS_SCAN = 500
DEFAULT_RETRIEVE_LIMIT = 20

_STOP_WORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might", "must",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "them",
    "what", "which", "who", "whom", "this", "that", "these", "those", "where", "when",
    "why", "how", "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
    "very", "can", "just", "don", "now", "about", "into", "through", "during", "before",
    "after", "above", "below", "up", "down", "out", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "any", "tell", "give", "show", "find",
})


def tokenize_query(question: str) -> list[str]:
    """Extract meaningful query tokens, keeping multi-char tokens and numbers."""
    raw = re.findall(r"[a-z0-9']+", question.lower())
    tokens = [t for t in raw if len(t) > 1 and t not in _STOP_WORDS]
    return tokens or [t for t in raw if len(t) > 1][:3]


def item_searchable_text(item: DominoItem) -> str:
    parts: list[str] = []
    if item.summary:
        parts.append(item.summary)
    if item.extracted_text:
        parts.append(item.extracted_text)
    if item.raw_input:
        parts.append(item.raw_input)
    if item.topic:
        parts.append(item.topic)
    if item.topics:
        parts.extend(item.topics)
    if item.key_ideas:
        parts.extend(item.key_ideas)
    return " ".join(parts).lower()


def score_item_keyword(item: DominoItem, tokens: Sequence[str]) -> float:
    if not tokens:
        return 0.0

    text = item_searchable_text(item)
    if not text:
        return 0.0

    score = 0.0
    matched = 0
    for token in tokens:
        count = text.count(token)
        if count:
            matched += 1
            score += 1.0 + min(count - 1, 2) * 0.25
            if item.topic and token in item.topic.lower():
                score += 0.5
            if item.key_ideas and any(token in idea.lower() for idea in item.key_ideas):
                score += 0.35

    if matched >= 2:
        score += matched * 0.75

    if matched == len(tokens):
        score += 1.5

    return score


def rank_items_by_keyword(
    items: Sequence[DominoItem],
    question: str,
    limit: int = DEFAULT_RETRIEVE_LIMIT,
) -> list[DominoItem]:
    tokens = tokenize_query(question)
    scored: list[tuple[float, int, DominoItem]] = []
    for idx, item in enumerate(items):
        kw_score = score_item_keyword(item, tokens)
        if kw_score > 0:
            scored.append((kw_score, idx, item))

    if scored:
        scored.sort(key=lambda row: (-row[0], row[1]))
        return [item for _, _, item in scored[:limit]]

    # Fallback: most recent items when nothing matches keywords
    return list(items[:limit])


def cosine_similarity(a: Sequence[float], b: Sequence[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _normalize_keyword_score(score: float, max_score: float) -> float:
    if max_score <= 0:
        return 0.0
    return min(score / max_score, 1.0)


def rank_items_hybrid(
    items: Sequence[DominoItem],
    question: str,
    query_embedding: Sequence[float],
    limit: int = DEFAULT_RETRIEVE_LIMIT,
) -> list[DominoItem]:
    tokens = tokenize_query(question)
    keyword_scores = [score_item_keyword(item, tokens) for item in items]
    max_kw = max(keyword_scores) if keyword_scores else 0.0

    scored: list[tuple[float, int, DominoItem]] = []
    for idx, item in enumerate(items):
        kw_norm = _normalize_keyword_score(keyword_scores[idx], max_kw)
        emb = item.embedding
        if emb and query_embedding:
            vec_score = cosine_similarity(query_embedding, emb)
            combined = 0.4 * kw_norm + 0.6 * vec_score
        else:
            combined = kw_norm
        if combined > 0:
            scored.append((combined, idx, item))

    if scored:
        scored.sort(key=lambda row: (-row[0], row[1]))
        return [item for _, _, item in scored[:limit]]

    return rank_items_by_keyword(items, question, limit)


async def retrieve_relevant_items(
    phone: str,
    question: str,
    db: AsyncSession,
    limit: int = DEFAULT_RETRIEVE_LIMIT,
) -> list[DominoItem]:
    result = await db.execute(
        select(DominoItem)
        .where(DominoItem.user_phone == phone)
        .order_by(DominoItem.created_at.desc())
        .limit(MAX_ITEMS_SCAN)
    )
    items = list(result.scalars().all())
    if not items:
        return []

    has_embeddings = any(item.embedding for item in items)
    if has_embeddings:
        try:
            from app.services.gemini_client import embed_text_with_retry

            query_embedding = await embed_text_with_retry(question)
            return rank_items_hybrid(items, question, query_embedding, limit)
        except Exception:
            pass

    return rank_items_by_keyword(items, question, limit)


def build_embedding_text(item: DominoItem) -> str:
    parts: list[str] = []
    if item.summary:
        parts.append(item.summary)
    if item.key_ideas:
        parts.extend(item.key_ideas)
    if item.extracted_text:
        parts.append(item.extracted_text[:1000])
    if item.topic:
        parts.append(item.topic)
    text = "\n".join(parts).strip()
    return text or (item.raw_input or "")[:1000]


async def maybe_embed_item(item: DominoItem) -> None:
    """Generate and attach an embedding when we have enough text."""
    text = build_embedding_text(item)
    if len(text.strip()) < 20:
        return
    try:
        from app.services.gemini_client import embed_text_with_retry

        item.embedding = await embed_text_with_retry(text)
    except Exception:
        pass
