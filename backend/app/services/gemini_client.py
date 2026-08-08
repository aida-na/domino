import asyncio
import logging
import random
from collections.abc import Callable

from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_EMBEDDING_MODEL = "text-embedding-004"

_semaphore = asyncio.Semaphore(20)
_client: genai.Client | None = None


def strip_json_markdown(text: str) -> str:
    t = text.strip()
    if "```json" in t:
        t = t.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in t:
        t = t.split("```", 1)[1].split("```", 1)[0].strip()
    return t


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def generate_with_retry(
    model: str,
    contents: str,
    max_retries: int = 5,
    max_output_tokens: int = 16384,
    on_usage: Callable[[dict], None] | None = None,
) -> str:
    client = get_gemini_client()

    for attempt in range(max_retries + 1):
        try:
            async with _semaphore:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(max_output_tokens=max_output_tokens),
                )
            return (response.text or "").strip()
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str.upper()
            if is_rate_limit and attempt < max_retries:
                base = min(32, 2 ** (attempt + 1))
                wait = random.uniform(base / 2, base)
                logger.warning("Gemini rate limit, retrying in %.1fs (attempt %d/%d)", wait, attempt + 1, max_retries)
                await asyncio.sleep(wait)
            else:
                raise


async def generate_with_retry_multimodal(
    model: str,
    prompt: str,
    media_bytes: bytes,
    mime_type: str,
    max_retries: int = 3,
    max_output_tokens: int = 4096,
) -> str:
    client = get_gemini_client()

    contents = [
        types.Content(role="user", parts=[
            types.Part(inline_data=types.Blob(mime_type=mime_type, data=media_bytes)),
            types.Part(text=prompt),
        ])
    ]

    for attempt in range(max_retries + 1):
        try:
            async with _semaphore:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(max_output_tokens=max_output_tokens),
                )
            return (response.text or "").strip()
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str.upper()
            if is_rate_limit and attempt < max_retries:
                base = min(32, 2 ** (attempt + 1))
                wait = random.uniform(base / 2, base)
                logger.warning("Gemini rate limit (multimodal), retrying in %.1fs", wait)
                await asyncio.sleep(wait)
            else:
                raise


async def generate_chat_with_retry(
    model: str,
    *,
    system_instruction: str | None,
    conversation: list[tuple[str, str]],
    max_output_tokens: int = 2000,
    max_retries: int = 5,
) -> str:
    client = get_gemini_client()

    contents: list[types.Content] = []
    for role, text in conversation:
        if not text.strip():
            continue
        gemini_role = "model" if role == "assistant" else "user"
        contents.append(types.Content(role=gemini_role, parts=[types.Part(text=text)]))

    if not contents:
        raise ValueError("No messages to send")

    if contents[0].role != "user":
        contents.insert(0, types.Content(role="user", parts=[types.Part(text="Please respond to the following conversation.")]))

    config_kwargs: dict = {"max_output_tokens": max_output_tokens}
    if system_instruction and system_instruction.strip():
        config_kwargs["system_instruction"] = system_instruction.strip()

    config = types.GenerateContentConfig(**config_kwargs)

    for attempt in range(max_retries + 1):
        try:
            async with _semaphore:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=config,
                )
            return (response.text or "").strip()
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str.upper()
            if is_rate_limit and attempt < max_retries:
                base = min(32, 2 ** (attempt + 1))
                wait = random.uniform(base / 2, base)
                logger.warning("Gemini rate limit (chat), retrying in %.1fs", wait)
                await asyncio.sleep(wait)
            else:
                raise


async def embed_text_with_retry(
    text: str,
    *,
    model: str = DEFAULT_EMBEDDING_MODEL,
    max_retries: int = 3,
) -> list[float]:
    """Return an embedding vector for the given text."""
    client = get_gemini_client()
    contents = text.strip()
    if not contents:
        raise ValueError("Cannot embed empty text")

    for attempt in range(max_retries + 1):
        try:
            async with _semaphore:
                response = await client.aio.models.embed_content(
                    model=model,
                    contents=contents,
                )
            embeddings = response.embeddings or []
            if not embeddings or not embeddings[0].values:
                raise ValueError("Empty embedding response")
            return list(embeddings[0].values)
        except Exception as e:
            err_str = str(e)
            is_rate_limit = "429" in err_str or "RESOURCE_EXHAUSTED" in err_str.upper()
            if is_rate_limit and attempt < max_retries:
                base = min(32, 2 ** (attempt + 1))
                wait = random.uniform(base / 2, base)
                logger.warning("Gemini rate limit (embed), retrying in %.1fs", wait)
                await asyncio.sleep(wait)
            else:
                raise
