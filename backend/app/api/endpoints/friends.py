"""Friends graph endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.endpoints.auth import get_domino_user
from app.db.session import get_db
from app.models.domino import DominoUser
from app.services import friends as friends_service

router = APIRouter(prefix="/friends")


class FriendRequestBody(BaseModel):
    phone: str | None = Field(default=None, max_length=40)
    invite_code: str | None = Field(default=None, max_length=32)


class FriendActionBody(BaseModel):
    request_id: str


@router.get("")
async def list_friends(
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    users = await friends_service.list_friends(db, current_user.phone)
    return {
        "friends": [
            {
                **friends_service.serialize_friend(user),
                "friendship_id": str(friendship.id),
            }
            for friendship, user in users
        ]
    }


@router.get("/pending")
async def list_pending(
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    return await friends_service.list_pending(db, current_user.phone)


@router.post("/request")
async def send_friend_request(
    body: FriendRequestBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    target: DominoUser | None = None
    if body.invite_code:
        target = await friends_service.resolve_user_by_invite_code(db, body.invite_code)
        if not target:
            raise HTTPException(status_code=404, detail="Invite code not found")
    elif body.phone:
        target = await friends_service.resolve_user_by_phone(db, body.phone)
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
    else:
        raise HTTPException(status_code=400, detail="phone or invite_code required")

    friendship = await friends_service.send_request(db, current_user, target.phone)
    await db.commit()
    return {
        "request_id": str(friendship.id),
        "status": friendship.status,
        "user": friends_service.serialize_friend(target),
    }


@router.post("/accept")
async def accept_friend_request(
    body: FriendActionBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        request_id = UUID(body.request_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid request_id") from e
    friendship = await friends_service.accept_request(db, current_user.phone, request_id)
    await db.commit()
    return {"request_id": str(friendship.id), "status": friendship.status}


@router.post("/decline")
async def decline_friend_request(
    body: FriendActionBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        request_id = UUID(body.request_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid request_id") from e
    await friends_service.decline_request(db, current_user.phone, request_id)
    await db.commit()
    return {"success": True}


@router.delete("/{friendship_id}")
async def remove_friend(
    friendship_id: UUID,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    await friends_service.remove_friend(db, current_user.phone, friendship_id)
    await db.commit()
    return {"success": True}
