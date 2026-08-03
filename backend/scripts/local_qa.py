#!/usr/bin/env python3
"""
Local QA helpers — delete users, peek OTPs, seed App Review accounts.

Requires DATABASE_URL in the environment (or backend/.env). For Cloud SQL from
your Mac, start the Auth Proxy first:

  cloud-sql-proxy domino-500918:us-central1:domino-db --port 5433
  DATABASE_URL='postgresql+asyncpg://USER:PASS@127.0.0.1:5433/domino' python scripts/local_qa.py ...

Examples:

  python scripts/local_qa.py delete-user +13392081349
  python scripts/local_qa.py peek-otp +15551234567
  python scripts/local_qa.py magic-link +15551234567
  python scripts/local_qa.py setup-review-account +15551234567 'ReviewPass1!' \\
      --frontend-url https://www.domino.fyi
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow `python scripts/local_qa.py` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import delete, select

from app.api.endpoints.auth import (
    _hash_domino_password,
    build_magic_link,
    create_session_for_phone,
    ensure_invite_code,
    normalize_domino_phone,
)
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.domino import DominoItem, DominoOTP, DominoSession, DominoUser

SAMPLE_SAVES = [
    {
        "raw_input": "https://paulgraham.com/greatwork.html",
        "input_type": "link",
        "summary": "How to do great work — curiosity, taste, and sustained effort.",
        "topic": "Ideas",
        "topics": ["Ideas", "Career"],
        "key_ideas": ["Follow curiosity", "Work on hard problems", "Keep showing up"],
    },
    {
        "raw_input": "remember to send the weekly digest test before TestFlight",
        "input_type": "note",
        "extracted_text": "remember to send the weekly digest test before TestFlight",
        "summary": "Pre-launch checklist reminder for digest email.",
        "topic": "Inbox",
        "topics": ["Inbox"],
        "key_ideas": [],
    },
    {
        "raw_input": "https://domino.fyi/faq",
        "input_type": "link",
        "summary": "Domino FAQ — capture via iMessage, browse on iOS/web.",
        "topic": "Product",
        "topics": ["Product"],
        "key_ideas": ["iMessage capture", "Weekly digest", "Share extension"],
    },
]


async def delete_user(phone_raw: str) -> None:
    phone = normalize_domino_phone(phone_raw)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
        user = result.scalar_one_or_none()
        if not user:
            print(f"no user for {phone}")
            return
        await db.execute(delete(DominoOTP).where(DominoOTP.phone == phone))
        await db.delete(user)
        await db.commit()
        print(f"deleted user {phone} (items/sessions cascade)")


async def peek_otp(phone_raw: str) -> None:
    phone = normalize_domino_phone(phone_raw)
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(DominoOTP)
            .where(
                DominoOTP.phone == phone,
                DominoOTP.used == False,  # noqa: E712
                DominoOTP.expires_at > now,
            )
            .order_by(DominoOTP.created_at.desc())
            .limit(3)
        )
        rows = result.scalars().all()
        if not rows:
            print(f"no active OTP for {phone}")
            return
        for otp in rows:
            print(f"code={otp.code}  expires={otp.expires_at.isoformat()}")


async def magic_link(phone_raw: str, *, frontend_url: str | None) -> None:
    phone = normalize_domino_phone(phone_raw)
    if frontend_url:
        settings.FRONTEND_URL = frontend_url.rstrip("/")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
        if result.scalar_one_or_none() is None:
            print(f"no user for {phone} — create via OTP first")
            return
        token, _ = await create_session_for_phone(phone, db)
        link = build_magic_link(token)
        print("magic link (web universal link):")
        print(link)
        print("custom scheme:")
        print(f"domino://dashboard?token={token}")


async def setup_review_account(
    phone_raw: str,
    password: str,
    *,
    frontend_url: str | None,
    reseed: bool,
) -> None:
    if len(password) < 8:
        raise SystemExit("password must be at least 8 characters")

    phone = normalize_domino_phone(phone_raw)
    if frontend_url:
        settings.FRONTEND_URL = frontend_url.rstrip("/")

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
        user = result.scalar_one_or_none()

        if user and reseed:
            await db.execute(delete(DominoItem).where(DominoItem.user_phone == phone))
            await db.commit()
            print(f"cleared existing saves for {phone}")
        elif user is None:
            user = DominoUser(phone=phone)
            db.add(user)
            await db.flush()
            await ensure_invite_code(user, db)
            print(f"created user {phone}")

        user.password_hash = _hash_domino_password(password)
        await db.commit()
        await db.refresh(user)

        existing = await db.execute(
            select(DominoItem).where(DominoItem.user_phone == phone).limit(1)
        )
        if existing.scalar_one_or_none() is None:
            for sample in SAMPLE_SAVES:
                db.add(DominoItem(user_phone=phone, **sample))
            await db.commit()
            print(f"seeded {len(SAMPLE_SAVES)} sample saves")

        token, _ = await create_session_for_phone(phone, db)
        base = (settings.FRONTEND_URL or "https://www.domino.fyi").rstrip("/")

        print("\n--- App Review account ready ---")
        print(f"Phone:    {phone}")
        print(f"Password: {password}")
        print(f"Login:    {base}/login (password tab)")
        print(f"Magic:    {build_magic_link(token)}")
        print("\nPaste phone + password into ios/AppStore/README.md §5 and App Store Connect review notes.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Domino local QA utilities")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("delete-user").add_argument("phone")
    sub.add_parser("peek-otp").add_argument("phone")

    p_link = sub.add_parser("magic-link")
    p_link.add_argument("phone")
    p_link.add_argument(
        "--frontend-url",
        default=settings.FRONTEND_URL or "http://localhost:3000",
        help="FRONTEND_URL for link host (default from env)",
    )

    p_review = sub.add_parser("setup-review-account")
    p_review.add_argument("phone")
    p_review.add_argument("password")
    p_review.add_argument(
        "--frontend-url",
        default=settings.FRONTEND_URL or "https://www.domino.fyi",
    )
    p_review.add_argument(
        "--reseed",
        action="store_true",
        help="clear existing saves before seeding samples",
    )

    args = parser.parse_args()
    print(f"database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else settings.DATABASE_URL}")

    if args.cmd == "delete-user":
        asyncio.run(delete_user(args.phone))
    elif args.cmd == "peek-otp":
        asyncio.run(peek_otp(args.phone))
    elif args.cmd == "magic-link":
        asyncio.run(magic_link(args.phone, frontend_url=args.frontend_url))
    elif args.cmd == "setup-review-account":
        asyncio.run(
            setup_review_account(
                args.phone,
                args.password,
                frontend_url=args.frontend_url,
                reseed=args.reseed,
            )
        )


if __name__ == "__main__":
    main()
