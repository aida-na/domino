"""Canonical URL normalization for cross-user deduplication."""

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


_TRACKING_PREFIXES = ("utm_", "fbclid", "gclid", "mc_eid", "ref")


def normalize_url(url: str) -> str | None:
    """Return a canonical URL string, or None if not a valid http(s) link."""
    raw = (url or "").strip()
    if not raw:
        return None
    if not raw.startswith(("http://", "https://")):
        if raw.startswith("www."):
            raw = f"https://{raw}"
        else:
            return None
    try:
        parsed = urlparse(raw)
    except ValueError:
        return None
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None

    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]

    path = parsed.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    query_pairs = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=False)
        if not k.lower().startswith(_TRACKING_PREFIXES)
    ]
    query = urlencode(sorted(query_pairs))

    return urlunparse(("https", host, path, "", query, ""))


def extract_url_from_raw(raw_input: str, input_type: str) -> str | None:
    """Pick a shareable URL from a saved item."""
    if input_type not in ("link", "pdf"):
        return None
    raw = (raw_input or "").strip()
    if raw.startswith(("http://", "https://")):
        return normalize_url(raw)
    return None


def title_from_item(raw_input: str, extracted_text: str | None, summary: str | None) -> str:
    """Derive a display title for trending cards."""
    for candidate in (summary, extracted_text, raw_input):
        if not candidate:
            continue
        line = candidate.strip().split("\n", 1)[0].strip()
        if line:
            return line[:200]
    return "Untitled"
