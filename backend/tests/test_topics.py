"""Topic normalization / multi-label helpers."""

from app.services.processor import normalize_topics, topic_hint_from_url, topic_hints_from_text


def test_normalize_topics_ranks_and_dedupes():
    assert normalize_topics(
        ["Health & Wellness", "ai & machine learning", "Health & Wellness", "Nope"]
    ) == ["Health & Wellness", "AI & Machine Learning"]


def test_normalize_topics_caps_at_three():
    assert normalize_topics(
        ["Science", "Biology", "Health & Wellness", "Technology"]
    ) == ["Science", "Biology", "Health & Wellness"]


def test_normalize_topics_fallback_general():
    assert normalize_topics([]) == ["General"]
    assert normalize_topics(["not-a-real-topic"]) == ["General"]


def test_normalize_topics_allows_inbox():
    assert normalize_topics(["Inbox"]) == ["Inbox"]
    assert normalize_topics([], fallback="Inbox") == ["Inbox"]


def test_normalize_topics_aliases():
    assert normalize_topics(["Tech", "News"]) == ["Technology", "Culture"]
    assert normalize_topics(["Startups", "AI"]) == ["Technology", "AI & Machine Learning"]
    assert normalize_topics(["tech news"]) == ["Technology"]


def test_normalize_topics_strips_general_when_specific_exists():
    assert normalize_topics(["Technology", "General"]) == ["Technology"]
    assert normalize_topics(["General", "Technology"]) == ["Technology"]
    assert normalize_topics(["General"]) == ["General"]


def test_topic_hint_from_url():
    assert topic_hint_from_url("https://techcrunch.com/2026/07/17/foo/") == "Technology"
    assert topic_hint_from_url("https://www.techcrunch.com/foo") == "Technology"
    assert topic_hint_from_url("https://example.com/x") is None


def test_topic_hints_from_text_wearables_ai():
    text = (
        "AI: Leveraging Wearables and Other Patient-Generated Data in Research. "
        "Luca Foschini, PhD, co-founder and chief data scientist."
    )
    hints = topic_hints_from_text(text)
    assert hints[0] == "AI & Machine Learning"
    assert "Health & Wellness" in hints


def test_topic_hints_from_text_startup():
    text = "Building an AI startup is one thing. Raising one of the largest seed rounds of the year."
    hints = topic_hints_from_text(text)
    assert "AI & Machine Learning" in hints
    assert "Business" in hints or "Technology" in hints
