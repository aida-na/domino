"""Domino auth endpoints — session tokens, magic link, OTP, and optional password."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.db.session import get_db
from app.models.domino import DominoOTP, DominoSession, DominoUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth")

OTP_TTL_MINUTES = 10
MIN_PASSWORD_LEN = 8


def _send_message_safe(to: str, body: str, *, context: str) -> None:
    """Background send — never raises into the request path."""
    try:
        _send_message(to, body)
        logger.info("%s: queued send for phone ending %s", context, to[-4:])
    except Exception as e:
        logger.exception("%s: send failed for phone ending %s: %s", context, to[-4:], e)


def _hash_domino_password(password: str) -> str:
    """bcrypt over SHA-256 hex of password."""
    prehashed = hashlib.sha256(password.encode()).hexdigest().encode("utf-8")
    return bcrypt.hashpw(prehashed, bcrypt.gensalt()).decode("utf-8")


def _verify_domino_password(password: str, hashed: str) -> bool:
    prehashed = hashlib.sha256(password.encode()).hexdigest().encode("utf-8")
    try:
        return bcrypt.checkpw(prehashed, hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_bearer_session_uuid(authorization: str | None) -> UUID | None:
    """Parse Bearer token as a session UUID. None if missing, empty, or not a valid UUID."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    raw = authorization.split(" ", 1)[1].strip()
    if not raw:
        return None
    try:
        return UUID(raw)
    except ValueError:
        return None


def _normalize_inbound_phone(phone: str) -> str:
    """Strip legacy whatsapp: prefix if present; return E.164-ish string."""
    return phone.replace("whatsapp:", "").strip()


# Back-compat for webhook imports
_strip_whatsapp = _normalize_inbound_phone


def normalize_domino_phone(raw: str) -> str:
    """
    Normalize user input to E.164 (+...) to match DominoUser.phone.
    US: 10 digits -> +1; 11 digits starting with 1 -> +1...
    If input starts with +, digits after + are used as E.164.
    """
    s = raw.strip()
    if not s:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    digits = "".join(c for c in s if c.isdigit())
    if not digits:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    if s.startswith("+"):
        if len(digits) < 10 or len(digits) > 15:
            raise HTTPException(status_code=400, detail="Invalid phone number")
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if 10 <= len(digits) <= 15:
        return f"+{digits}"
    raise HTTPException(status_code=400, detail="Invalid phone number")


def _send_message(to: str, body: str) -> None:
    """Send iMessage/SMS via Blooio. Falls back to console in dev."""
    from app.services.blooio import send_message
    send_message(to, body)


# Back-compat alias used by older call sites during migration
_send_whatsapp = _send_message


def _react_message(chat_id: str, message_id: str, emoji: str = "👍") -> None:
    """Send an iMessage tapback via Blooio. Falls back to console in dev."""
    from app.services.blooio import send_reaction
    send_reaction(chat_id, message_id, emoji)


_react_whatsapp = _react_message


async def create_session_for_phone(phone: str, db: AsyncSession) -> tuple[str, bool]:
    """
    Upsert DominoUser, create a new 30-day session, commit.
    Returns (session_token, whether the user already had a password set).
    """
    user_result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = user_result.scalar_one_or_none()
    has_password = False
    if not user:
        user = DominoUser(phone=phone)
        db.add(user)
        await db.flush()
    else:
        has_password = bool(user.password_hash)

    session = DominoSession(
        user_phone=phone,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return str(session.id), has_password


def build_magic_link(session_token: str) -> str:
    base = (settings.FRONTEND_URL or "https://domino.fyi").rstrip("/")
    return f"{base}/dashboard?token={session_token}"


async def get_domino_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> DominoUser:
    """Dependency: validate Bearer session token, return DominoUser."""
    session_uuid = _parse_bearer_session_uuid(authorization)
    if session_uuid is None:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(DominoSession).where(
            DominoSession.id == session_uuid,
            DominoSession.expires_at > now,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    user_result = await db.execute(
        select(DominoUser).where(DominoUser.phone == session.user_phone)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


class MagicLinkRequest(BaseModel):
    phone: str = Field(..., min_length=8, max_length=40)


@router.post("/magic-link")
@limiter.limit("5/minute")
async def request_magic_link(
    request: Request,
    body: MagicLinkRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    If this phone already has a domino account, create a new session and text a dashboard link.
    Response is always the same to avoid account enumeration.
    """
    phone = normalize_domino_phone(body.phone)
    result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = result.scalar_one_or_none()
    if not user:
        # Still 200 — do not reveal whether the account exists
        logger.info("magic-link: no account for phone ending %s — skipped send", phone[-4:])
        return {"ok": True}
    try:
        session_token, _ = await create_session_for_phone(phone, db)
        link = build_magic_link(session_token)
        background_tasks.add_task(
            _send_message_safe,
            phone,
            f"here's your dashboard link:\n{link}",
            context="magic-link",
        )
    except Exception as e:
        logger.exception("magic-link prepare failed for phone ending %s: %s", phone[-4:], e)
    return {"ok": True}


@router.get("/me")
async def get_me(current_user: DominoUser = Depends(get_domino_user)):
    return {
        "phone": current_user.phone,
        "timezone": current_user.timezone,
        "digest_time": current_user.digest_time,
        "has_password": bool(current_user.password_hash),
    }


@router.post("/logout")
async def logout(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    session_uuid = _parse_bearer_session_uuid(authorization)
    if session_uuid is None:
        return {"success": True}
    result = await db.execute(select(DominoSession).where(DominoSession.id == session_uuid))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.commit()
    return {"success": True}


# ---------------------------------------------------------------------------
# OTP sign-in (iMessage / SMS code)
# ---------------------------------------------------------------------------


class OtpRequestBody(BaseModel):
    phone: str = Field(..., min_length=8, max_length=40)


@router.post("/otp/request")
@limiter.limit("3/minute")
async def request_otp(
    request: Request,
    body: OtpRequestBody,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Send a 6-digit sign-in code via Blooio. User is created on first successful verify."""
    phone = normalize_domino_phone(body.phone)
    code = f"{secrets.randbelow(900_000) + 100_000:06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES)

    otp = DominoOTP(phone=phone, code=code, expires_at=expires_at)
    db.add(otp)
    await db.commit()

    background_tasks.add_task(
        _send_message_safe,
        phone,
        f"your domino sign-in code: {code}\n\nit expires in {OTP_TTL_MINUTES} minutes.",
        context="OTP",
    )
    return {"ok": True}


class OtpVerifyBody(BaseModel):
    phone: str = Field(..., min_length=8, max_length=40)
    code: str = Field(..., min_length=4, max_length=8)

    @field_validator("code")
    @classmethod
    def digits_only(cls, v: str) -> str:
        s = v.strip().replace(" ", "")
        if not s.isdigit():
            raise ValueError("Code must be digits only")
        return s


@router.post("/otp/verify")
@limiter.limit("10/minute")
async def verify_otp(
    request: Request,
    body: OtpVerifyBody,
    db: AsyncSession = Depends(get_db),
):
    phone = normalize_domino_phone(body.phone)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(DominoOTP)
        .where(
            DominoOTP.phone == phone,
            DominoOTP.used == False,  # noqa: E712
            DominoOTP.expires_at > now,
            DominoOTP.code == body.code,
        )
        .order_by(DominoOTP.created_at.desc())
        .limit(1)
    )
    otp = result.scalar_one_or_none()
    if not otp:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    otp.used = True
    await db.commit()

    session_token, has_password = await create_session_for_phone(phone, db)

    return {
        "access_token": session_token,
        "token_type": "bearer",
        "phone": phone,
        "has_password": has_password,
    }


# ---------------------------------------------------------------------------
# Password (optional)
# ---------------------------------------------------------------------------


class SetPasswordBody(BaseModel):
    password: str = Field(..., min_length=MIN_PASSWORD_LEN, max_length=128)
    password_confirm: str = Field(..., min_length=MIN_PASSWORD_LEN, max_length=128)


@router.post("/password/set")
async def set_password(
    body: SetPasswordBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    if body.password != body.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    current_user.password_hash = _hash_domino_password(body.password)
    await db.commit()
    return {"ok": True}


class PasswordLoginBody(BaseModel):
    phone: str = Field(..., min_length=8, max_length=40)
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/password/login")
@limiter.limit("5/minute")
async def password_login(
    request: Request,
    body: PasswordLoginBody,
    db: AsyncSession = Depends(get_db),
):
    phone = normalize_domino_phone(body.phone)
    result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = result.scalar_one_or_none()
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid phone or password")
    if not _verify_domino_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    session_token, _ = await create_session_for_phone(phone, db)
    return {
        "access_token": session_token,
        "token_type": "bearer",
        "phone": phone,
        "has_password": True,
    }
