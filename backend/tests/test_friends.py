"""Friends graph helper and state tests."""

from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.services.friends import (
    friendship_pair_key,
    mask_phone,
    serialize_friend,
    send_request,
)


def test_friendship_pair_key_order_independent():
    assert friendship_pair_key("+2", "+1") == friendship_pair_key("+1", "+2")


def test_mask_phone():
    assert mask_phone("+15551234567") == "***4567"


def test_serialize_friend_never_includes_phone():
    user = SimpleNamespace(id=uuid4(), phone="+15551234567", display_name="Alex")
    data = serialize_friend(user)
    assert "phone" not in data
    assert data["display_name"] == "Alex"


def test_serialize_friend_masks_when_no_display_name():
    user = SimpleNamespace(id=uuid4(), phone="+15559876543", display_name=None)
    assert serialize_friend(user)["display_name"] == "***6543"


@pytest.mark.asyncio
async def test_send_request_auto_accepts_reverse_pending():
    requester = SimpleNamespace(phone="+15551111111")
    target_phone = "+15552222222"
    existing = SimpleNamespace(
        id=uuid4(),
        requester_phone=target_phone,
        addressee_phone=requester.phone,
        status="pending",
        accepted_at=None,
    )

    db = AsyncMock()
    target_user = SimpleNamespace(phone=target_phone)

    async def fake_execute(stmt):
        result = MagicMock()
        # First call: target lookup; second: existing pair
        if not hasattr(fake_execute, "n"):
            fake_execute.n = 0
        fake_execute.n += 1
        if fake_execute.n == 1:
            result.scalar_one_or_none = MagicMock(return_value=target_user)
        else:
            result.scalar_one_or_none = MagicMock(return_value=existing)
        return result

    db.execute = fake_execute
    db.flush = AsyncMock()

    friendship = await send_request(db, requester, target_phone)
    assert friendship.status == "accepted"
    assert friendship.accepted_at is not None
