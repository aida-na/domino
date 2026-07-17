"""Domino waitlist endpoint."""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.domino import DominoWaitlist

logger = logging.getLogger(__name__)
router = APIRouter()


class WaitlistBody(BaseModel):
    email: EmailStr
    ref: str | None = Field(default=None, max_length=32)


@router.post("/waitlist")
async def join_waitlist(
    body: WaitlistBody,
    db: AsyncSession = Depends(get_db),
):
    email = body.email.lower()
    existing = await db.execute(
        select(DominoWaitlist).where(DominoWaitlist.email == email)
    )
    if existing.scalar_one_or_none():
        return {"ok": True, "already_registered": True}

    referred_by = (body.ref or "").strip().lower() or None
    entry = DominoWaitlist(email=email, referred_by=referred_by)
    db.add(entry)
    await db.commit()
    return {"ok": True, "already_registered": False}
