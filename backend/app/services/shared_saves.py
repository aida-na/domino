"""Opt-in URL index for discover trending."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domino import DominoItem, DominoSharedSave, DominoUser
from app.services.taste_profile import build_taste_profile
from app.services.url_normalize import extract_url_from_raw, title_from_item


async def upsert_shared_save(db: AsyncSession, user: DominoUser, item: DominoItem) -> None:
    """Index a link save for discover if the user opted in."""
    if not user.discover_opt_in:
        return
    url = extract_url_from_raw(item.raw_input, item.input_type)
    if not url:
        return

    topics = list(item.topics or [])
    primary = item.topic or (topics[0] if topics else None)
    title = title_from_item(item.raw_input, item.extracted_text, item.summary)

    existing = await db.execute(
        select(DominoSharedSave).where(
            DominoSharedSave.user_phone == user.phone,
            DominoSharedSave.url_normalized == url,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.item_id = item.id
        row.title = title
        row.topic_primary = primary
        row.saved_at = item.created_at
    else:
        db.add(
            DominoSharedSave(
                user_phone=user.phone,
                item_id=item.id,
                url_normalized=url,
                title=title,
                topic_primary=primary,
                saved_at=item.created_at,
            )
        )
    await db.flush()


async def remove_shared_save_for_item(db: AsyncSession, user_phone: str, item_id) -> None:
    await db.execute(
        delete(DominoSharedSave).where(
            DominoSharedSave.user_phone == user_phone,
            DominoSharedSave.item_id == item_id,
        )
    )


async def clear_shared_saves(db: AsyncSession, user_phone: str) -> None:
    await db.execute(delete(DominoSharedSave).where(DominoSharedSave.user_phone == user_phone))


async def backfill_shared_saves(db: AsyncSession, user: DominoUser) -> int:
    """Rebuild shared save rows from the user's link items."""
    await clear_shared_saves(db, user.phone)
    if not user.discover_opt_in:
        return 0
    result = await db.execute(
        select(DominoItem).where(
            DominoItem.user_phone == user.phone,
            DominoItem.input_type.in_(("link", "pdf")),
        )
    )
    count = 0
    for item in result.scalars().all():
        await upsert_shared_save(db, user, item)
        count += 1
    return count


async def after_item_saved(db: AsyncSession, user: DominoUser, item: DominoItem) -> None:
    await upsert_shared_save(db, user, item)
    await build_taste_profile(user.phone, db)


async def after_item_deleted(db: AsyncSession, user_phone: str, item_id) -> None:
    await remove_shared_save_for_item(db, user_phone, item_id)
    user_result = await db.execute(select(DominoUser).where(DominoUser.phone == user_phone))
    user = user_result.scalar_one_or_none()
    if user:
        await build_taste_profile(user.phone, db)
