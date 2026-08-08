#!/usr/bin/env python3
"""Backfill embeddings for existing domino_items."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.domino import DominoItem
from app.services.search import build_embedding_text, maybe_embed_item


async def backfill(*, batch_size: int = 50, limit: int | None = None) -> None:
    updated = 0
    scanned = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DominoItem).where(DominoItem.embedding.is_(None)).order_by(DominoItem.created_at.desc())
        )
        items = result.scalars().all()
        if limit is not None:
            items = items[:limit]

        for item in items:
            scanned += 1
            if len(build_embedding_text(item).strip()) < 20:
                continue
            before = item.embedding
            await maybe_embed_item(item)
            if item.embedding and item.embedding != before:
                updated += 1
            if scanned % batch_size == 0:
                await db.commit()
                print(f"progress: scanned={scanned} embedded={updated}")

        await db.commit()

    print(f"done: scanned={scanned} embedded={updated}")


if __name__ == "__main__":
    asyncio.run(backfill())
