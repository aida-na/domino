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

_PDF_RE = re.compile(r"(\.pdf$|/pdf/[\w.\-]+)", re.IGNORECASE)


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
Assign this content to exactly ONE topic from the list below.
Return only the topic name — nothing else.

Topics: {topics}

Content:
{preview}

Topic:"""


async def classify_topic(text: str) -> str:
    preview = text[:800].strip()
    if not preview:
        return "General"

    prompt = _TOPIC_PROMPT.format(topics=", ".join(TOPIC_LIST), preview=preview)
    try:
        raw = (
            await generate_with_retry(DEFAULT_GEMINI_MODEL, prompt, max_output_tokens=32)
        ).strip().strip('"').strip("'")
        options = {t.lower(): t for t in TOPIC_LIST}
        return options.get(raw.lower(), "General")
    except Exception as e:
        logger.warning("classify_topic failed: %s", e)
        return "General"


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


async def process_url(raw: str) -> ProcessedItem:
    input_type = detect_input_type(raw)

    if input_type == "pdf":
        extracted = await _extract_pdf(raw)
    else:
        extracted = await _extract_link(raw)

    text_for_topic = extracted[:2000] or raw
    topic = await classify_topic(text_for_topic)

    if extracted:
        summary, key_ideas = await _gemini_rich(extracted)
    else:
        summary, key_ideas = "", []

    return ProcessedItem(
        input_type=input_type,
        extracted_text=extracted[:8000],
        topic=topic,
        summary=summary,
        key_ideas=key_ideas,
    )


async def process_note(text: str) -> ProcessedItem:
    topic = await classify_topic(text)
    return ProcessedItem(input_type="note", extracted_text=text, topic=topic, summary="", key_ideas=[])


async def process_image(description: str) -> ProcessedItem:
    topic = await classify_topic(description)
    return ProcessedItem(input_type="image", extracted_text=description, topic=topic, summary="", key_ideas=[])
