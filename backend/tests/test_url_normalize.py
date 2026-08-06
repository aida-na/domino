"""URL normalization tests."""

from app.services.url_normalize import extract_url_from_raw, normalize_url, title_from_item


def test_normalize_url_strips_tracking_and_www():
    url = "https://www.example.com/path/?utm_source=x&ok=1#frag"
    assert normalize_url(url) == "https://example.com/path?ok=1"


def test_normalize_url_trailing_slash():
    assert normalize_url("http://Example.com/foo/") == "https://example.com/foo"


def test_normalize_url_rejects_non_http():
    assert normalize_url("not a url") is None
    assert normalize_url("") is None


def test_extract_url_from_raw_link():
    assert extract_url_from_raw("https://a.com/x", "link") == "https://a.com/x"


def test_extract_url_skips_notes():
    assert extract_url_from_raw("hello world", "note") is None


def test_title_from_item_prefers_summary():
    assert title_from_item("https://x.com", "body", "Summary title") == "Summary title"
