"""Domino scheduled reminders — process due reminders and advance recurring ones."""

import logging
from datetime import datetime, timezone

from croniter import croniter
from sqlalchemy import select, update
from zoneinfo import ZoneInfo

from app.db.session import AsyncSessionLocal
from app.models.domino import DominoItem, DominoReminder, DominoUser

logger = logging.getLogger(__name__)


async def process_due_reminders() -> int:
    """Find and send all reminders where next_fire_at <= now. Returns count sent."""
    from app.api.endpoints.auth import _send_whatsapp

    now = datetime.now(timezone.utc)
    sent = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DominoReminder).where(
                DominoReminder.is_active == True,  # noqa: E712
                DominoReminder.next_fire_at <= now,
            )
        )
        reminders = result.scalars().all()

        for reminder in reminders:
            try:
                text = reminder.message

                if reminder.item_id:
                    item_result = await db.execute(
                        select(DominoItem).where(DominoItem.id == reminder.item_id)
                    )
                    item = item_result.scalar_one_or_none()
                    if item:
                        preview = (item.summary or item.raw_input)[:80]
                        text = f"🔔 reminder: {text}\n\n→ {preview}"
                    else:
                        text = f"🔔 reminder: {text}"
                else:
                    text = f"🔔 reminder: {text}"

                _send_whatsapp(reminder.user_phone, text)
                sent += 1

                if reminder.is_recurring and reminder.cron_pattern:
                    _advance_recurring(reminder, now)
                else:
                    reminder.is_active = False

            except Exception as e:
                logger.error(
                    "Reminder send failed for %s (id=%s): %s",
                    reminder.user_phone, reminder.id, e,
                )

        await db.commit()

    return sent


def _advance_recurring(reminder: DominoReminder, now: datetime) -> None:
    """Compute and set the next fire time from the cron pattern."""
    try:
        cron = croniter(reminder.cron_pattern, now)
        next_dt = cron.get_next(datetime)
        if next_dt.tzinfo is None:
            next_dt = next_dt.replace(tzinfo=timezone.utc)
        reminder.next_fire_at = next_dt
    except Exception as e:
        logger.warning(
            "Invalid cron '%s' for reminder %s, deactivating: %s",
            reminder.cron_pattern, reminder.id, e,
        )
        reminder.is_active = False
