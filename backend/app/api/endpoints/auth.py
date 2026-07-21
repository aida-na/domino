"""Domino auth endpoints — session tokens, magic link, OTP, and optional password."""

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

import bcrypt
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.datetime_utils import serialize_datetime
from app.core.rate_limiter import limiter
from app.db.session import get_db
from app.models.domino import DominoItem, DominoOTP, DominoSession, DominoUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth")

OTP_TTL_MINUTES = 10
MIN_PASSWORD_LEN = 8
INVITE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"

SIGNUP_FULL_MESSAGE = (
    "we're only letting in a few people a day — join the waitlist or try again tomorrow."
)


class SignupFullError(Exception):
    """Daily new-user cap reached; do not create DominoUser."""


def signup_full_http_detail() -> dict:
    return {"code": "signup_full", "message": SIGNUP_FULL_MESSAGE}


async def count_new_users_today(db: AsyncSession) -> int:
    """Count DominoUser rows created since 00:00 UTC today."""
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count()).select_from(DominoUser).where(DominoUser.created_at >= start)
    )
    return int(result.scalar_one() or 0)


async def assert_can_create_user(db: AsyncSession) -> None:
    limit = settings.DAILY_NEW_USER_LIMIT
    if limit <= 0:
        return
    if await count_new_users_today(db) >= limit:
        raise SignupFullError()


def _generate_invite_code(length: int = 8) -> str:
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(length))


async def ensure_invite_code(user: DominoUser, db: AsyncSession) -> str:
    """Assign a unique invite code if the user doesn't have one yet."""
    if user.invite_code:
        return user.invite_code
    for _ in range(12):
        code = _generate_invite_code()
        existing = await db.execute(select(DominoUser).where(DominoUser.invite_code == code))
        if existing.scalar_one_or_none() is None:
            user.invite_code = code
            await db.commit()
            await db.refresh(user)
            return code
    raise HTTPException(status_code=500, detail="Could not allocate invite code")


async def resolve_referrer_code(ref: str | None, db: AsyncSession) -> str | None:
    if not ref:
        return None
    code = ref.strip().lower()
    if not code or len(code) > 32:
        return None
    result = await db.execute(select(DominoUser).where(DominoUser.invite_code == code))
    referrer = result.scalar_one_or_none()
    return referrer.invite_code if referrer else None


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


async def create_session_for_phone(
    phone: str,
    db: AsyncSession,
    *,
    referred_by: str | None = None,
) -> tuple[str, bool]:
    """
    Upsert DominoUser, create a new 30-day session, commit.
    Returns (session_token, whether the user already had a password set).

    Raises SignupFullError when creating a brand-new user would exceed
    DAILY_NEW_USER_LIMIT (returning users are always allowed).
    """
    user_result = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    user = user_result.scalar_one_or_none()
    has_password = False
    if not user:
        await assert_can_create_user(db)
        user = DominoUser(phone=phone, referred_by=referred_by)
        db.add(user)
        await db.flush()
        await ensure_invite_code(user, db)
    else:
        has_password = bool(user.password_hash)
        if not user.invite_code:
            await ensure_invite_code(user, db)

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


async def purge_expired_otps(db: AsyncSession) -> int:
    """Delete used or expired OTP rows. Returns rows removed."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        delete(DominoOTP).where(
            (DominoOTP.used == True) | (DominoOTP.expires_at <= now)  # noqa: E712
        )
    )
    await db.commit()
    return int(result.rowcount or 0)


async def revoke_other_sessions(
    db: AsyncSession,
    *,
    user_phone: str,
    keep_session_id: UUID | None = None,
) -> None:
    """Invalidate all sessions for user except optionally the current one."""
    stmt = delete(DominoSession).where(DominoSession.user_phone == user_phone)
    if keep_session_id is not None:
        stmt = stmt.where(DominoSession.id != keep_session_id)
    await db.execute(stmt)


async def get_domino_user_with_session(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> tuple[DominoUser, DominoSession]:
    """Like get_domino_user but also returns the validated session row."""
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
    return user, session


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


@router.get("/signup-status")
async def signup_status(db: AsyncSession = Depends(get_db)):
    """Whether new signups are blocked for the rest of today (UTC)."""
    limit = settings.DAILY_NEW_USER_LIMIT
    if limit <= 0:
        return {"full": False, "limit": 0, "count": 0}
    count = await count_new_users_today(db)
    return {"full": count >= limit, "limit": limit, "count": count}


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


def _serialize_me(user: DominoUser) -> dict:
    base = (settings.FRONTEND_URL or "https://domino.fyi").rstrip("/")
    code = user.invite_code
    return {
        "phone": user.phone,
        "email": user.email,
        "timezone": user.timezone,
        "digest_time": user.digest_time,
        "digest_opted_out": bool(user.digest_opted_out),
        "has_password": bool(user.password_hash),
        "invite_code": code,
        "invite_url": f"{base}/login?ref={code}" if code else None,
    }


@router.get("/me")
async def get_me(
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_invite_code(current_user, db)
    return _serialize_me(current_user)


class UpdateMeBody(BaseModel):
    email: str | None = Field(default=None, max_length=254)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    digest_time: str | None = Field(default=None, min_length=4, max_length=5)
    digest_opted_out: bool | None = None

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        if not s:
            return None
        if "@" not in s or "." not in s.split("@")[-1]:
            raise ValueError("Invalid email")
        return s

    @field_validator("digest_time")
    @classmethod
    def valid_digest_time(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        parts = s.split(":")
        if len(parts) != 2:
            raise ValueError("digest_time must be HH:MM")
        try:
            h, m = int(parts[0]), int(parts[1])
        except ValueError as e:
            raise ValueError("digest_time must be HH:MM") from e
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("digest_time must be HH:MM")
        return f"{h:02d}:{m:02d}"


@router.patch("/me")
async def update_me(
    body: UpdateMeBody,
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    fields = body.model_fields_set
    if "email" in fields:
        current_user.email = body.email
        current_user.email_pending = False
    if "timezone" in fields and body.timezone is not None:
        current_user.timezone = body.timezone.strip()
    if "digest_time" in fields and body.digest_time is not None:
        current_user.digest_time = body.digest_time
    if "digest_opted_out" in fields and body.digest_opted_out is not None:
        current_user.digest_opted_out = body.digest_opted_out
    await db.commit()
    await db.refresh(current_user)
    await ensure_invite_code(current_user, db)
    return _serialize_me(current_user)


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
    ref: str | None = Field(default=None, max_length=32)

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

    # Cap check before consuming OTP so a full day doesn't burn the code.
    existing = await db.execute(select(DominoUser).where(DominoUser.phone == phone))
    if existing.scalar_one_or_none() is None:
        try:
            await assert_can_create_user(db)
        except SignupFullError:
            raise HTTPException(status_code=403, detail=signup_full_http_detail()) from None

    otp.used = True
    await db.commit()

    referred_by = await resolve_referrer_code(body.ref, db)
    try:
        session_token, has_password = await create_session_for_phone(
            phone, db, referred_by=referred_by
        )
    except SignupFullError:
        raise HTTPException(status_code=403, detail=signup_full_http_detail()) from None

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
    user_session: tuple[DominoUser, DominoSession] = Depends(get_domino_user_with_session),
    db: AsyncSession = Depends(get_db),
):
    current_user, session = user_session
    if body.password != body.password_confirm:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    current_user.password_hash = _hash_domino_password(body.password)
    await revoke_other_sessions(db, user_phone=current_user.phone, keep_session_id=session.id)
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


# ---------------------------------------------------------------------------
# Account data (export / deletion)
# ---------------------------------------------------------------------------


class DeleteAccountBody(BaseModel):
    confirm: str = Field(..., min_length=1, max_length=32)
    password: str | None = Field(default=None, max_length=128)


@router.get("/me/export")
async def export_account(
    current_user: DominoUser = Depends(get_domino_user),
    db: AsyncSession = Depends(get_db),
):
    """Download a JSON export of profile + all saved items (CCPA right to access)."""
    items_result = await db.execute(
        select(DominoItem)
        .where(DominoItem.user_phone == current_user.phone)
        .order_by(DominoItem.created_at.desc())
    )
    items = items_result.scalars().all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "profile": _serialize_me(current_user),
        "items": [
            {
                "id": str(item.id),
                "raw_input": item.raw_input,
                "input_type": item.input_type,
                "extracted_text": item.extracted_text,
                "summary": item.summary,
                "topic": item.topic,
                "topics": item.topics,
                "key_ideas": item.key_ideas or [],
                "created_at": serialize_datetime(item.created_at),
                "is_pinned": item.is_pinned,
                "is_favorited": item.is_favorited,
            }
            for item in items
        ],
        "item_count": len(items),
    }


@router.post("/me/delete")
async def delete_account(
    body: DeleteAccountBody,
    user_session: tuple[DominoUser, DominoSession] = Depends(get_domino_user_with_session),
    db: AsyncSession = Depends(get_db),
):
    """
    Permanently delete the account and all associated data.
    Requires confirm='delete' and password when a password is set.
    """
    current_user, _session = user_session
    if body.confirm.strip().lower() != "delete":
        raise HTTPException(status_code=400, detail="Type 'delete' to confirm account deletion")

    if current_user.password_hash:
        if not body.password or not _verify_domino_password(body.password, current_user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")

    phone = current_user.phone
    await db.execute(delete(DominoOTP).where(DominoOTP.phone == phone))
    await db.delete(current_user)
    await db.commit()
    logger.info("Account deleted for phone ending %s", phone[-4:])
    return {"success": True}
