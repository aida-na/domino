"""Domino waitlist endpoint."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.domino import DominoWaitlist

logger = logging.getLogger(__name__)
router = APIRouter()


class WaitlistBody(BaseModel):
    email: EmailStr


@router.post("/waitlist")
async def join_waitlist(
    body: WaitlistBody,
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(DominoWaitlist).where(DominoWaitlist.email == body.email.lower())
    )
    if existing.scalar_one_or_none():
        return {"ok": True, "already_registered": True}

    entry = DominoWaitlist(email=body.email.lower())
    db.add(entry)
    await db.commit()
    return {"ok": True, "already_registered": False}
