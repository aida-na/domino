"""Domino weekly digest — Sunday at each user's digest_time in their timezone."""

import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select, update

from app.db.session import AsyncSessionLocal
from app.models.domino import DominoItem, DominoUser
from app.services.gemini_client import DEFAULT_GEMINI_MODEL, generate_with_retry

logger = logging.getLogger(__name__)

_WINDOW_SECONDS = 900  # ±15 min — GitHub Actions cron runs every 15 min


def _parse_digest_time(digest_time: str | None) -> tuple[int, int]:
    """Parse HH:MM digest_time; fall back to 08:00."""
    raw = (digest_time or "08:00").strip()
    try:
        parts = raw.split(":")
        if len(parts) != 2:
            return 8, 0
        hour, minute = int(parts[0]), int(parts[1])
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return 8, 0
        return hour, minute
    except (TypeError, ValueError):
        return 8, 0


def _is_weekly_digest_window(user: DominoUser, now_utc: datetime) -> bool:
    """True if it's Sunday and within ±15 min of the user's digest_time locally."""
    try:
        tz = ZoneInfo(user.timezone)
    except Exception:
        tz = ZoneInfo("America/Los_Angeles")

    user_now = now_utc.astimezone(tz)
    if user_now.weekday() != 6:  # 6 = Sunday
        return False

    hour, minute = _parse_digest_time(user.digest_time)
    target = user_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return abs((user_now - target).total_seconds()) <= _WINDOW_SECONDS


def _digest_to_html(text: str) -> str:
    """Convert Gemini's WhatsApp-style markdown digest to clean email HTML."""
    import re
    lines = text.split("\n")
    html_lines = []
    for line in lines:
        if not line.strip():
            html_lines.append("<br>")
            continue
        # *bold* → <strong>
        line = re.sub(r"\*(.+?)\*", r"<strong>\1</strong>", line)
        # Bullet points
        if line.strip().startswith("•"):
            line = f"<div style='margin:6px 0 6px 0'>• {line.strip()[1:].strip()}</div>"
        else:
            line = f"<p style='margin:4px 0'>{line}</p>"
        html_lines.append(line)

    body = "\n".join(html_lines)
    return f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:580px;margin:40px auto;padding:0 20px">
  {body}
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
  <p style="font-size:12px;color:#999">domino — your second brain</p>
</body>
</html>"""


async def send_weekly_digests(force: bool = False, phone: str | None = None) -> dict:
    """Send weekly digest to users whose local time is Sunday ±15 min of digest_time.

    Pass force=True to bypass the time window check (for testing / email collection).
    Pass phone= to process only that user.
    """
    from app.services.email import send_email

    now_utc = datetime.now(timezone.utc)
    since = now_utc - timedelta(days=7)
    sent_count = 0
    skipped_count = 0

    async with AsyncSessionLocal() as db:
        query = select(DominoUser)
        if phone is not None:
            query = query.where(DominoUser.phone == phone)
        users_result = await db.execute(query)
        users = users_result.scalars().all()

        for user in users:
            try:
                if user.digest_opted_out:
                    skipped_count += 1
                    continue

                if not force and not _is_weekly_digest_window(user, now_utc):
                    skipped_count += 1
                    continue

                items_result = await db.execute(
                    select(DominoItem).where(
                        DominoItem.user_phone == user.phone,
                        DominoItem.digest_sent == False,  # noqa: E712
                        DominoItem.created_at >= since,
                    )
                )
                items = items_result.scalars().all()

                if not items:
                    skipped_count += 1
                    continue

                n = len(items)
                topics_used = list({item.topic for item in items if item.topic})
                all_concepts: list[str] = []
                for item in items:
                    if item.key_ideas:
                        all_concepts.extend(item.key_ideas)
                top_concepts = list(dict.fromkeys(all_concepts))[:8]

                summaries = "\n".join(
                    f"[{item.topic or 'misc'}] {item.summary or item.raw_input[:120]}"
                    for item in items
                )

                prompt = (
                    f"The user saved {n} things this week across domino (their second brain).\n\n"
                    f"Items:\n{summaries}\n\n"
                    "Write a weekly WhatsApp digest. Format exactly like this (use actual newlines, not \\n):\n\n"
                    "your week in domino\n\n"
                    f"you captured {n} things this week.\n\n"
                    "*themes that emerged:*\n"
                    "• [Theme name]: [1-2 sentence synthesis of related items]\n"
                    "• [Theme name]: [1-2 sentence synthesis]\n"
                    "(2-4 themes, only what's genuinely there)\n\n"
                    "*a connection worth noting:*\n"
                    "[1-2 sentences linking two things the user saved that seem unrelated but connect]\n\n"
                    f"*top concepts:* {', '.join(top_concepts) if top_concepts else 'see dashboard'}\n\n"
                    "Rules: be specific and insightful, not generic. Reference actual content. "
                    "Keep total under 600 words. Return only the message text."
                )

                try:
                    digest_text = await generate_with_retry(
                        DEFAULT_GEMINI_MODEL, prompt, max_output_tokens=5000
                    )
                    digest_text = digest_text.strip()
                except Exception as e:
                    logger.warning("Gemini weekly digest failed for %s: %s", user.phone, e)
                    topic_str = ", ".join(topics_used) if topics_used else "various topics"
                    concept_str = ", ".join(top_concepts[:5]) if top_concepts else ""
                    digest_text = (
                        f"your week in domino\n\n"
                        f"you captured {n} thing{'s' if n != 1 else ''} this week "
                        f"across {topic_str}."
                        + (f"\n\ntop concepts: {concept_str}" if concept_str else "")
                    )

                if user.email:
                    ok = send_email(
                        to=user.email,
                        subject="your week in domino",
                        html=_digest_to_html(digest_text),
                    )
                    logger.info("[digest] send_email to %s → %s", user.email, "ok" if ok else "FAILED")
                    if not ok:
                        skipped_count += 1
                        continue
                    item_ids = [item.id for item in items]
                    await db.execute(
                        update(DominoItem)
                        .where(DominoItem.id.in_(item_ids))
                        .values(digest_sent=True)
                    )
                    await db.commit()
                    sent_count += 1
                else:
                    # Ask for email — do NOT mark items as sent yet so they're included when we retry
                    from app.api.endpoints.auth import _send_message
                    from sqlalchemy import update as _update
                    _send_message(user.phone, "what's your email? i'll send your weekly digest there. reply with your email or 'skip'.")
                    await db.execute(_update(DominoUser).where(DominoUser.phone == user.phone).values(email_pending=True))
                    await db.commit()
                    skipped_count += 1

            except Exception as e:
                logger.error("Weekly digest error for user %s: %s", user.phone, e)

    return {"sent": sent_count, "skipped": skipped_count}
