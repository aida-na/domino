"""Domino item processing pipeline."""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from dataclasses import dataclass, field

from app.services.gemini_client import DEFAULT_GEMINI_MODEL, generate_with_retry, strip_json_markdown

logger = logging.getLogger(__name__)

TOPIC_LIST = [
    "Technology", "AI & Machine Learning", "Science", "Mathematics",
    "History", "Philosophy", "Economics", "Business", "Finance",
    "Psychology", "Health & Wellness", "Biology", "Physics", "Chemistry",
    "Law", "Politics", "Environment", "Art & Design", "Music",
    "Literature", "Language", "Culture", "Religion", "Sports",
    "Cooking", "Travel", "Productivity", "Career", "Education", "General",
]

# Gemini often returns near-miss labels ("Tech", "News", "AI"). Map those
# onto TOPIC_LIST so we don't silently fall back to General.
TOPIC_ALIASES: dict[str, str] = {
    "tech": "Technology",
    "technology": "Technology",
    "tech news": "Technology",
    "gadgets": "Technology",
    "software": "Technology",
    "startups": "Technology",
    "startup": "Technology",
    "venture": "Business",
    "venture capital": "Business",
    "news": "Culture",
    "media": "Culture",
    "ai": "AI & Machine Learning",
    "ml": "AI & Machine Learning",
    "llm": "AI & Machine Learning",
    "artificial intelligence": "AI & Machine Learning",
    "machine learning": "AI & Machine Learning",
    "health": "Health & Wellness",
    "wellness": "Health & Wellness",
    "fitness": "Health & Wellness",
    "medicine": "Health & Wellness",
    "art": "Art & Design",
    "design": "Art & Design",
    "food": "Cooking",
    "recipes": "Cooking",
    "work": "Career",
    "jobs": "Career",
    "money": "Finance",
    "investing": "Finance",
    "climate": "Environment",
    "books": "Literature",
    "writing": "Literature",
}

# When extraction/classification yields only General, use the link host.
_HOST_TOPIC_HINTS: dict[str, str] = {
    "techcrunch.com": "Technology",
    "theverge.com": "Technology",
    "wired.com": "Technology",
    "arstechnica.com": "Technology",
    "engadget.com": "Technology",
    "cnet.com": "Technology",
    "zdnet.com": "Technology",
    "openai.com": "AI & Machine Learning",
    "anthropic.com": "AI & Machine Learning",
    "huggingface.co": "AI & Machine Learning",
    "bloomberg.com": "Finance",
    "ft.com": "Finance",
    "wsj.com": "Finance",
    "nytimes.com": "Culture",
    "newyorker.com": "Culture",
    "theatlantic.com": "Culture",
    "bbc.com": "Culture",
    "bbc.co.uk": "Culture",
}

_PDF_RE = re.compile(r"(\.pdf$|/pdf/[\w.\-]+)", re.IGNORECASE)
_URL_HOST_RE = re.compile(r"^https?://([^/]+)", re.IGNORECASE)


def detect_input_type(raw: str, mime: str | None = None) -> str:
    if mime:
        m = mime.split(";")[0].strip().lower()
        if m.startswith("image/"):
            return "image"
        if m.startswith("audio/") or m.startswith("video/"):
            return "note"

    text = raw.strip()
    if re.match(r"^https?://", text, re.IGNORECASE):
        path = text.lower().split("?")[0].split("#")[0]
        if _PDF_RE.search(path):
            return "pdf"
        return "link"

    return "note"


_TOPIC_PROMPT = """\
Assign this content to up to THREE topics from the list below, ranked best-first.
The first topic is the main label; the next two are secondary labels that also fit.
Return JSON only — an array of 1 to 3 topic names.
Use EXACT strings from the Topics list (e.g. "Technology", not "Tech" or "News").
No markdown.

Topics: {topics}

Content:
{preview}

JSON:"""


def _canonical_topic(label: str) -> str | None:
    """Resolve a freeform label to a TOPIC_LIST entry (or Inbox)."""
    key = str(label or "").strip().lower()
    if not key:
        return None
    options = {t.lower(): t for t in TOPIC_LIST}
    options["inbox"] = "Inbox"
    if key in options:
        return options[key]
    if key in TOPIC_ALIASES:
        return TOPIC_ALIASES[key]
    # Partial contains: "ai tools" / "tech news" → mapped topic
    for alias, canonical in TOPIC_ALIASES.items():
        if len(alias) >= 3 and alias in key:
            return canonical
    return None


def topic_hint_from_url(url: str) -> str | None:
    """Best-effort topic from a known publisher host."""
    m = _URL_HOST_RE.match((url or "").strip())
    if not m:
        return None
    host = m.group(1).lower()
    if host.startswith("www."):
        host = host[4:]
    if host in _HOST_TOPIC_HINTS:
        return _HOST_TOPIC_HINTS[host]
    # subdomain match: news.techcrunch.com
    for suffix, topic in _HOST_TOPIC_HINTS.items():
        if host.endswith("." + suffix):
            return topic
    return None


def normalize_topics(
    labels: list[str] | None,
    *,
    fallback: str = "General",
    limit: int = 3,
) -> list[str]:
    """Map freeform labels onto TOPIC_LIST (+ Inbox), dedupe, cap at limit."""
    out: list[str] = []
    seen: set[str] = set()
    for label in labels or []:
        canonical = _canonical_topic(label)
        if not canonical or canonical.lower() in seen:
            continue
        out.append(canonical)
        seen.add(canonical.lower())
        if len(out) >= limit:
            break
    if not out:
        fb = _canonical_topic(fallback) or "General"
        return [fb]
    return out


async def classify_topics(text: str, *, url: str | None = None) -> list[str]:
    """Return 1–3 ranked topics from TOPIC_LIST (primary first)."""
    preview = text[:800].strip()
    if not preview:
        hint = topic_hint_from_url(url or "")
        return [hint] if hint else ["General"]

    prompt = _TOPIC_PROMPT.format(topics=", ".join(TOPIC_LIST), preview=preview)
    try:
        raw = await generate_with_retry(DEFAULT_GEMINI_MODEL, prompt, max_output_tokens=64)
        parsed = json.loads(strip_json_markdown(raw))
        if isinstance(parsed, dict):
            parsed = parsed.get("topics") or parsed.get("labels") or []
        if isinstance(parsed, str):
            parsed = [parsed]
        if not isinstance(parsed, list):
            parsed = []
        topics = normalize_topics([str(x) for x in parsed])
    except Exception as e:
        logger.warning("classify_topics failed: %s", e)
        topics = ["General"]

    # Known publishers beat weak/generic labels (e.g. model says "News" → Culture).
    hint = topic_hint_from_url(url or text)
    if hint and topics[0] in {"General", "Culture"}:
        return normalize_topics([hint, *[t for t in topics if t != hint]])
    return topics


async def classify_topic(text: str) -> str:
    """Primary topic only (compat wrapper)."""
    return (await classify_topics(text))[0]


_RICH_PROMPT = """\
Analyze the content below and return JSON only (no markdown fences).

Return:
{{
  "summary": "2-3 sentence prose summary of what this is about",
  "key_ideas": ["concise idea 1", "concise idea 2", "concise idea 3"]
}}

Rules:
- summary: plain prose, 2-3 sentences max
- key_ideas: 3 to 7 items, each a single clear sentence
- No markdown inside the values

Content:
{text}"""


async def _gemini_rich(text: str) -> tuple[str, list[str]]:
    prompt = _RICH_PROMPT.format(text=text[:6000])
    try:
        raw = await generate_with_retry(DEFAULT_GEMINI_MODEL, prompt, max_output_tokens=512)
        parsed = json.loads(strip_json_markdown(raw))
        summary = str(parsed.get("summary", "")).strip()
        key_ideas = [str(k).strip() for k in parsed.get("key_ideas", []) if k][:7]
        return summary, key_ideas
    except Exception as e:
        logger.warning("_gemini_rich failed: %s", e)
        return text[:200], []


async def _extract_link(url: str) -> str:
    try:
        import trafilatura
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        return trafilatura.extract(downloaded, include_comments=False, include_tables=True, no_fallback=False) or ""
    except Exception as e:
        logger.warning("_extract_link failed for %s: %s", url, e)
        return ""


async def _extract_pdf(url: str) -> str:
    import requests
    try:
        resp = requests.get(
            url, timeout=60,
            headers={"User-Agent": "Mozilla/5.0 (compatible; Domino/1.0)"},
            stream=True,
        )
        resp.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            for chunk in resp.iter_content(chunk_size=65536):
                f.write(chunk)
            tmp = f.name
        try:
            import pypdf
            reader = pypdf.PdfReader(tmp)
            return "\n".join(p.extract_text() or "" for p in reader.pages)[:8000]
        finally:
            try:
                os.unlink(tmp)
            except OSError:
                pass
    except Exception as e:
        logger.warning("_extract_pdf failed for %s: %s", url, e)
        return ""


@dataclass
class ProcessedItem:
    input_type: str
    extracted_text: str
    topic: str
    summary: str
    key_ideas: list[str] = field(default_factory=list)
    topics: list[str] = field(default_factory=list)


async def process_url(raw: str) -> ProcessedItem:
    input_type = detect_input_type(raw)

    if input_type == "pdf":
        extracted = await _extract_pdf(raw)
    else:
        extracted = await _extract_link(raw)

    text_for_topic = extracted[:2000] or raw
    topics = await classify_topics(text_for_topic, url=raw)
    topic = topics[0]

    if extracted:
        summary, key_ideas = await _gemini_rich(extracted)
    else:
        summary, key_ideas = "", []

    return ProcessedItem(
        input_type=input_type,
        extracted_text=extracted[:8000],
        topic=topic,
        topics=topics,
        summary=summary,
        key_ideas=key_ideas,
    )


async def process_note(text: str) -> ProcessedItem:
    """Full note processing (topic + optional polish). Prefer fast create + enrich_note for API."""
    enriched = await enrich_note(text, current_topic=None, allow_topic_update=True)
    return ProcessedItem(
        input_type="note",
        extracted_text=text,
        topic=enriched["topic"],
        topics=enriched["topics"],
        summary=enriched["summary"],
        key_ideas=enriched["key_ideas"],
    )


_NOTE_POLISH_PROMPT = """\
Analyze this personal note and return JSON only (no markdown fences).

Return:
{{
  "summary": "1-2 sentence plain summary of what the note is about",
  "key_ideas": ["concise idea 1", "concise idea 2", "concise idea 3"]
}}

Rules:
- summary: plain prose, 1-2 sentences max
- key_ideas: 1 to 3 items, each a single clear sentence; empty array if the note is too short/trivial
- No markdown inside the values

Note:
{text}"""


async def enrich_note(
    text: str,
    *,
    current_topic: str | None = None,
    current_topics: list[str] | None = None,
    allow_topic_update: bool = True,
) -> dict:
    """
    Classify topics + optional light polish for notes.

    If allow_topic_update is False (user already set a folder), keep current_topic/topics.
    Topics are only replaced when current primary is missing/Inbox/General placeholder.
    """
    body = text.strip()
    if allow_topic_update:
        topics = await classify_topics(body) if body else ["General"]
        topic = topics[0]
    else:
        topic = current_topic or "Inbox"
        topics = normalize_topics(
            current_topics or ([topic] if topic else None),
            fallback=topic or "Inbox",
        )
        if topic and topics[0] != topic:
            topics = normalize_topics([topic, *[t for t in topics if t != topic]])

    summary = ""
    key_ideas: list[str] = []
    if len(body) >= 120:
        prompt = _NOTE_POLISH_PROMPT.format(text=body[:6000])
        try:
            raw = await generate_with_retry(DEFAULT_GEMINI_MODEL, prompt, max_output_tokens=384)
            parsed = json.loads(strip_json_markdown(raw))
            summary = str(parsed.get("summary", "")).strip()
            key_ideas = [str(k).strip() for k in parsed.get("key_ideas", []) if k][:3]
        except Exception as e:
            logger.warning("enrich_note polish failed: %s", e)

    return {"topic": topic, "topics": topics, "summary": summary, "key_ideas": key_ideas}


def topic_is_default(topic: str | None) -> bool:
    """True when AI is allowed to overwrite the folder."""
    if not topic:
        return True
    return topic.strip().lower() in ("inbox", "general")


async def process_image(description: str) -> ProcessedItem:
    topics = await classify_topics(description)
    return ProcessedItem(
        input_type="image",
        extracted_text=description,
        topic=topics[0],
        topics=topics,
        summary="",
        key_ideas=[],
    )
