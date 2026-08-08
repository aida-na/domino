"""Shared domino chat logic — used by both web endpoint and WhatsApp handler."""

import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import serialize_datetime
from app.models.domino import DominoItem, DominoMessage
from app.services.gemini_client import DEFAULT_GEMINI_MODEL, generate_chat_with_retry
from app.services.search import retrieve_relevant_items

_SYSTEM_PROMPT = (
    "You are the user's second brain (domino). Answer questions based only on what they've saved. "
    "Be concise and helpful. When you reference a saved item, cite it with its ID prefix like [Item abc12345]. "
    "When saved links are relevant, mention them by title and cite the item. "
    "If the answer isn't in their saved content, say so honestly. "
    "Keep responses under 300 characters when replying via WhatsApp."
)

_SYSTEM_PROMPT_WEB = (
    "You are the user's second brain (domino). Answer questions based only on what they've saved. "
    "Give a direct, helpful answer synthesized from their saves. "
    "When saved links or notes are relevant, recommend the most useful ones and explain why briefly. "
    "When you reference a saved item, cite it with its ID prefix like [Item abc12345]. "
    "If the answer isn't in their saved content, say so honestly."
)


def build_item_context(items: list[DominoItem]) -> str:
    parts = []
    for item in items:
        text = item.summary or item.extracted_text or item.raw_input
        date_str = item.created_at.strftime("%b %d") if item.created_at else ""
        block = f"[Item {str(item.id)[:8]}] ({date_str})"
        if item.topic:
            block += f" [{item.topic}]"
        if item.input_type in ("link", "pdf") and item.raw_input:
            block += f"\nURL: {item.raw_input[:200]}"
        if item.key_ideas:
            block += f"\nKey ideas: {', '.join(item.key_ideas[:5])}"
        block += f"\n{text[:500]}"
        parts.append(block)
    return "\n\n".join(parts)


def item_to_source(item: DominoItem) -> dict:
    return {
        "id": str(item.id),
        "summary": item.summary or item.raw_input[:100],
        "raw_input": item.raw_input,
        "input_type": item.input_type,
        "topic": item.topic,
        "created_at": serialize_datetime(item.created_at),
    }


def parse_cited_sources(answer: str, items: list[DominoItem]) -> list[dict]:
    cited_ids = set(re.findall(r"\[Item ([a-f0-9]{8})\]", answer))
    sources = []
    for item in items:
        short_id = str(item.id)[:8]
        if short_id in cited_ids:
            sources.append(item_to_source(item))
    return sources


async def answer_question_whatsapp(
    phone: str,
    question: str,
    db: AsyncSession,
    recent_messages: list[DominoMessage] | None = None,
) -> str:
    """Answer a user question using their saved items + conversation history."""
    items = await retrieve_relevant_items(phone, question, db)

    if not items:
        return "you haven't saved anything yet. text me a link or a thought to get started."

    item_context = build_item_context(items)

    conversation: list[tuple[str, str]] = [
        ("user", f"Here is my saved knowledge:\n\n{item_context}"),
        ("assistant", "I've reviewed your saved items. What would you like to know?"),
    ]

    if recent_messages:
        for msg in recent_messages[-6:]:
            role = "user" if msg.direction == "inbound" else "assistant"
            if msg.intent == "questions" or msg.direction == "outbound":
                conversation.append((role, msg.body[:500]))

    conversation.append(("user", question))

    answer = await generate_chat_with_retry(
        DEFAULT_GEMINI_MODEL,
        system_instruction=_SYSTEM_PROMPT,
        conversation=conversation,
        max_output_tokens=512,
    )

    return answer.strip()[:600]


async def answer_question_web(
    phone: str,
    question: str,
    db: AsyncSession,
) -> tuple[str, list[dict]]:
    """Answer a user question from the web dashboard. Returns (answer, sources)."""
    items = await retrieve_relevant_items(phone, question, db)

    if not items:
        return "You haven't saved anything yet. Text me a link or a thought to get started.", []

    item_context = build_item_context(items)

    answer = await generate_chat_with_retry(
        DEFAULT_GEMINI_MODEL,
        system_instruction=_SYSTEM_PROMPT_WEB,
        conversation=[
            ("user", f"Here is my saved knowledge:\n\n{item_context}"),
            ("assistant", "I've reviewed your saved items. What would you like to know?"),
            ("user", question),
        ],
        max_output_tokens=1024,
    )

    sources = parse_cited_sources(answer, items)
    return answer, sources
