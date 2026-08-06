"""Taste profile weight and similarity tests."""

from types import SimpleNamespace

from app.services.taste_profile import compute_topic_weights, cosine_similarity, top_topics


def _item(topics):
    return SimpleNamespace(topics=topics, topic=topics[0] if topics else None)


def test_compute_topic_weights_normalizes():
    items = [
        _item(["Technology", "Business"]),
        _item(["Technology"]),
    ]
    weights = compute_topic_weights(items)
    assert abs(sum(weights.values()) - 1.0) < 0.001
    assert weights["Technology"] > weights["Business"]


def test_cosine_similarity_identical():
    w = {"Technology": 0.7, "Business": 0.3}
    assert cosine_similarity(w, w) == 1.0


def test_cosine_similarity_orthogonal():
    a = {"Technology": 1.0}
    b = {"Business": 1.0}
    assert cosine_similarity(a, b) == 0.0


def test_top_topics():
    assert top_topics({"A": 0.5, "B": 0.3, "C": 0.2}, limit=2) == ["A", "B"]
