"""Tests for ask / chat retrieval over saved items."""

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

from app.services.chat import build_item_context, item_to_source, parse_cited_sources
from app.services.search import (
    rank_items_by_keyword,
    rank_items_hybrid,
    score_item_keyword,
    tokenize_query,
)


def _item(**kwargs):
    defaults = {
        "id": uuid.uuid4(),
        "raw_input": "",
        "input_type": "note",
        "extracted_text": None,
        "summary": None,
        "topic": None,
        "topics": None,
        "key_ideas": None,
        "created_at": datetime.now(timezone.utc),
        "embedding": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_tokenize_query_strips_stop_words():
    tokens = tokenize_query("where should I camp in California?")
    assert "camp" in tokens
    assert "california" in tokens
    assert "where" not in tokens
    assert "should" not in tokens


def test_score_item_keyword_camping_california():
    camping = _item(
        summary="Best campsites in Yosemite and Big Sur, California",
        topic="Travel",
        key_ideas=["Yosemite camping", "coastal campsites"],
    )
    unrelated = _item(summary="React 19 server components guide", topic="Technology")

    tokens = tokenize_query("where should I camp in california")
    assert score_item_keyword(camping, tokens) > score_item_keyword(unrelated, tokens)


def test_rank_items_by_keyword_prefers_relevant_over_recent():
    recent_unrelated = [
        _item(summary=f"tech article {i}", topic="Technology", created_at=datetime(2026, 1, i, tzinfo=timezone.utc))
        for i in range(1, 28)
    ]
    old_camping = _item(
        summary="Hidden California campgrounds near the coast",
        topic="Travel",
        raw_input="https://example.com/ca-camping",
        input_type="link",
        created_at=datetime(2025, 6, 1, tzinfo=timezone.utc),
    )
    items = recent_unrelated + [old_camping]

    ranked = rank_items_by_keyword(items, "where to camp in california", limit=5)
    assert ranked[0] is old_camping


def test_rank_items_by_keyword_falls_back_to_recent():
    items = [
        _item(summary=f"item {i}", created_at=datetime(2026, 1, i, tzinfo=timezone.utc))
        for i in range(1, 6)
    ]
    ranked = rank_items_by_keyword(items, "xyzzy nonsense query", limit=3)
    assert len(ranked) == 3
    assert ranked[0].summary == "item 1"


def test_rank_items_hybrid_combines_vector_and_keyword():
    query_emb = [1.0, 0.0, 0.0]
    camping = _item(
        summary="California camping spots",
        embedding=[0.95, 0.1, 0.0],
    )
    unrelated = _item(
        summary="unrelated topic",
        embedding=[0.0, 1.0, 0.0],
    )
    ranked = rank_items_hybrid([unrelated, camping], "camping california", query_emb, limit=1)
    assert ranked[0] is camping


def test_build_item_context_includes_url_and_key_ideas():
    item = _item(
        id=uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890"),
        summary="Yosemite guide",
        raw_input="https://example.com/yosemite",
        input_type="link",
        topic="Travel",
        key_ideas=["reservations", "bear boxes"],
        created_at=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    ctx = build_item_context([item])
    assert "[Item abcdef12]" in ctx
    assert "https://example.com/yosemite" in ctx
    assert "reservations" in ctx


def test_parse_cited_sources():
    item = _item(
        id=uuid.UUID("abcdef12-3456-7890-abcd-ef1234567890"),
        summary="Camp guide",
        raw_input="https://example.com/camp",
        input_type="link",
        topic="Travel",
    )
    answer = "Try Yosemite [Item abcdef12] for great camping."
    sources = parse_cited_sources(answer, [item])
    assert len(sources) == 1
    assert sources[0]["id"] == str(item.id)
    assert sources[0]["raw_input"] == "https://example.com/camp"
    assert sources[0]["input_type"] == "link"


def test_item_to_source_shape():
    item = _item(
        id=uuid.uuid4(),
        summary="Test",
        raw_input="hello",
        input_type="note",
        topic="General",
    )
    src = item_to_source(item)
    assert set(src.keys()) == {"id", "summary", "raw_input", "input_type", "topic", "created_at"}
