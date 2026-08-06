"""Discover trending endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.auth import get_domino_user
from app.db.session import get_db
from app.models.domino import DominoUser
from app.services.discover import (
    get_discover_status,
    get_friends_trending,
    get_similar_taste_trending,
)

router = APIRouter(prefix="/discover")


@router.get("/status")
async def discover_status(
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_discover_status(current_user, db)


@router.get("/similar-taste")
async def similar_taste(
    window_days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_similar_taste_trending(
        current_user, db, window_days=window_days, limit=limit
    )


@router.get("/friends-trending")
async def friends_trending(
    window_days: int = Query(default=7, ge=1, le=30),
    limit: int = Query(default=20, ge=1, le=50),
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    return await get_friends_trending(
        current_user, db, window_days=window_days, limit=limit
    )
