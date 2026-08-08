"""Mutual friend requests and friend graph."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.domino import DominoFriendship, DominoUser


def friendship_pair_key(phone_a: str, phone_b: str) -> str:
    a, b = sorted([phone_a, phone_b])
    return f"{a}|{b}"


def mask_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) >= 4:
        return f"***{digits[-4:]}"
    return "***"


def serialize_friend(user: DominoUser) -> dict:
    label = (user.display_name or "").strip() or mask_phone(user.phone)
    return {
        "id": str(user.id),
        "display_name": label,
    }


async def get_friendship_by_pair(
    db: AsyncSession, phone_a: str, phone_b: str
) -> DominoFriendship | None:
    pair_key = friendship_pair_key(phone_a, phone_b)
    result = await db.execute(
        select(DominoFriendship).where(DominoFriendship.pair_key == pair_key)
    )
    return result.scalar_one_or_none()


async def list_friends(db: AsyncSession, user_phone: str) -> list[tuple[DominoFriendship, DominoUser]]:
    result = await db.execute(
        select(DominoFriendship).where(
            DominoFriendship.status == "accepted",
            or_(
                DominoFriendship.requester_phone == user_phone,
                DominoFriendship.addressee_phone == user_phone,
            ),
        )
    )
    friendships = list(result.scalars().all())
    friend_phones: list[str] = []
    friendship_by_phone: dict[str, DominoFriendship] = {}
    for f in friendships:
        other = f.addressee_phone if f.requester_phone == user_phone else f.requester_phone
        friend_phones.append(other)
        friendship_by_phone[other] = f
    if not friend_phones:
        return []
    users_result = await db.execute(
        select(DominoUser).where(DominoUser.phone.in_(friend_phones))
    )
    users = {u.phone: u for u in users_result.scalars().all()}
    return [(friendship_by_phone[p], users[p]) for p in friend_phones if p in users]


async def list_pending(db: AsyncSession, user_phone: str) -> dict:
    incoming = await db.execute(
        select(DominoFriendship, DominoUser)
        .join(DominoUser, DominoUser.phone == DominoFriendship.requester_phone)
        .where(
            DominoFriendship.addressee_phone == user_phone,
            DominoFriendship.status == "pending",
        )
        .order_by(DominoFriendship.created_at.desc())
    )
    outgoing = await db.execute(
        select(DominoFriendship, DominoUser)
        .join(DominoUser, DominoUser.phone == DominoFriendship.addressee_phone)
        .where(
            DominoFriendship.requester_phone == user_phone,
            DominoFriendship.status == "pending",
        )
        .order_by(DominoFriendship.created_at.desc())
    )
    return {
        "incoming": [
            {
                "request_id": str(f.id),
                "user": serialize_friend(u),
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f, u in incoming.all()
        ],
        "outgoing": [
            {
                "request_id": str(f.id),
                "user": serialize_friend(u),
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f, u in outgoing.all()
        ],
    }


async def friend_phones(db: AsyncSession, user_phone: str) -> list[str]:
    pairs = await list_friends(db, user_phone)
    return [user.phone for _, user in pairs]


async def send_request(db: AsyncSession, requester: DominoUser, target_phone: str) -> DominoFriendship:
    if target_phone == requester.phone:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")
    target_result = await db.execute(select(DominoUser).where(DominoUser.phone == target_phone))
    target = target_result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await get_friendship_by_pair(db, requester.phone, target_phone)
    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        if existing.status == "pending":
            if existing.requester_phone == requester.phone:
                raise HTTPException(status_code=400, detail="Friend request already sent")
            # Other party already sent — auto-accept
            existing.status = "accepted"
            existing.accepted_at = datetime.now(timezone.utc)
            await db.flush()
            return existing
        raise HTTPException(status_code=400, detail="Cannot send friend request")

    friendship = DominoFriendship(
        requester_phone=requester.phone,
        addressee_phone=target_phone,
        pair_key=friendship_pair_key(requester.phone, target_phone),
        status="pending",
    )
    db.add(friendship)
    await db.flush()
    return friendship


async def auto_friend_on_referral(
    db: AsyncSession,
    new_user: DominoUser,
    referrer: DominoUser,
) -> DominoFriendship | None:
    """Create an accepted friendship when a user signs up via invite link."""
    if referrer.phone == new_user.phone:
        return None
    existing = await get_friendship_by_pair(db, referrer.phone, new_user.phone)
    if existing:
        if existing.status != "accepted":
            existing.status = "accepted"
            existing.accepted_at = datetime.now(timezone.utc)
            await db.flush()
        return existing
    friendship = DominoFriendship(
        requester_phone=referrer.phone,
        addressee_phone=new_user.phone,
        pair_key=friendship_pair_key(referrer.phone, new_user.phone),
        status="accepted",
        accepted_at=datetime.now(timezone.utc),
    )
    db.add(friendship)
    await db.flush()
    return friendship


async def count_referral_signups(db: AsyncSession, invite_code: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(DominoUser).where(DominoUser.referred_by == invite_code)
    )
    return int(result.scalar_one() or 0)


async def resolve_user_by_invite_code(db: AsyncSession, invite_code: str) -> DominoUser | None:
    code = invite_code.strip().lower()
    if not code:
        return None
    result = await db.execute(select(DominoUser).where(DominoUser.invite_code == code))
    return result.scalar_one_or_none()


def phone_lookup_variants(raw: str) -> list[str]:
    """E.164 and legacy webhook formats for the same handset."""
    variants: list[str] = []
    stripped = raw.strip().replace("whatsapp:", "").strip()
    if stripped:
        variants.append(stripped)
    digits = "".join(c for c in raw if c.isdigit())
    if len(digits) == 10:
        variants.append(f"+1{digits}")
    if len(digits) == 11 and digits.startswith("1"):
        variants.append(f"+{digits}")
    if digits and stripped.startswith("+"):
        variants.append(f"+{digits}")
    # Preserve order, drop duplicates
    return list(dict.fromkeys(v for v in variants if v))


async def resolve_user_by_phone(db: AsyncSession, raw_phone: str) -> DominoUser | None:
    from app.api.endpoints.auth import normalize_domino_phone

    try:
        normalized = normalize_domino_phone(raw_phone)
    except HTTPException:
        normalized = None

    candidates = phone_lookup_variants(raw_phone)
    if normalized and normalized not in candidates:
        candidates.insert(0, normalized)

    if not candidates:
        return None

    result = await db.execute(select(DominoUser).where(DominoUser.phone.in_(candidates)))
    users = list(result.scalars().all())
    if not users:
        return None
    if len(users) == 1:
        return users[0]
    # Prefer exact normalized match when duplicates exist (legacy data)
    if normalized:
        for user in users:
            if user.phone == normalized:
                return user
    return users[0]

async def accept_request(db: AsyncSession, user_phone: str, request_id: UUID) -> DominoFriendship:
    result = await db.execute(
        select(DominoFriendship).where(
            DominoFriendship.id == request_id,
            DominoFriendship.addressee_phone == user_phone,
            DominoFriendship.status == "pending",
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    friendship.status = "accepted"
    friendship.accepted_at = datetime.now(timezone.utc)
    await db.flush()
    return friendship


async def decline_request(db: AsyncSession, user_phone: str, request_id: UUID) -> None:
    result = await db.execute(
        select(DominoFriendship).where(
            DominoFriendship.id == request_id,
            or_(
                and_(
                    DominoFriendship.addressee_phone == user_phone,
                    DominoFriendship.status == "pending",
                ),
                and_(
                    DominoFriendship.requester_phone == user_phone,
                    DominoFriendship.status == "pending",
                ),
            ),
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friend request not found")
    await db.delete(friendship)


async def remove_friend(db: AsyncSession, user_phone: str, friendship_id: UUID) -> None:
    result = await db.execute(
        select(DominoFriendship).where(
            DominoFriendship.id == friendship_id,
            DominoFriendship.status == "accepted",
            or_(
                DominoFriendship.requester_phone == user_phone,
                DominoFriendship.addressee_phone == user_phone,
            ),
        )
    )
    friendship = result.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")
    await db.delete(friendship)
