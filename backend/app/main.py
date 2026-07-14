import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.core.config import settings
from app.core.rate_limiter import limiter
from app.api.api import api_router
from app.db.session import engine
from sqlalchemy import text

logger = logging.getLogger(__name__)

# Keep Cloud Run boot unbound by DB — unix-socket hangs can exceed startup probes.
_SCHEMA_TIMEOUT_SECONDS = 20


async def _apply_startup_schema() -> None:
    """Create tables if needed. Never raises — logs and returns on failure."""
    try:
        async with asyncio.timeout(_SCHEMA_TIMEOUT_SECONDS):
            async with engine.begin() as conn:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_users (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        phone VARCHAR NOT NULL UNIQUE,
                        timezone VARCHAR NOT NULL DEFAULT 'America/Los_Angeles',
                        digest_time VARCHAR NOT NULL DEFAULT '08:00',
                        password_hash VARCHAR,
                        email VARCHAR,
                        email_pending BOOLEAN NOT NULL DEFAULT false,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
                await conn.execute(text("""
                    CREATE UNIQUE INDEX IF NOT EXISTS ix_domino_users_phone
                    ON domino_users (phone)
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_items (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_phone VARCHAR NOT NULL REFERENCES domino_users(phone) ON DELETE CASCADE,
                        raw_input TEXT NOT NULL,
                        input_type VARCHAR NOT NULL,
                        extracted_text TEXT,
                        summary TEXT,
                        topic VARCHAR,
                        key_ideas TEXT[],
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        digest_sent BOOLEAN NOT NULL DEFAULT false,
                        is_pinned BOOLEAN NOT NULL DEFAULT false,
                        is_favorited BOOLEAN NOT NULL DEFAULT false
                    )
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_domino_items_user_phone
                    ON domino_items (user_phone)
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_otps (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        phone VARCHAR NOT NULL,
                        code VARCHAR(6) NOT NULL,
                        expires_at TIMESTAMPTZ NOT NULL,
                        used BOOLEAN NOT NULL DEFAULT false,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_domino_otps_phone
                    ON domino_otps (phone)
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_sessions (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_phone VARCHAR NOT NULL REFERENCES domino_users(phone) ON DELETE CASCADE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        expires_at TIMESTAMPTZ NOT NULL
                    )
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS ix_domino_sessions_user_phone
                    ON domino_sessions (user_phone)
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_messages (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_phone VARCHAR NOT NULL REFERENCES domino_users(phone) ON DELETE CASCADE,
                        direction VARCHAR NOT NULL,
                        body TEXT NOT NULL,
                        intent VARCHAR,
                        related_item_id UUID,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_domino_messages_user_recent
                    ON domino_messages (user_phone, created_at)
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_reminders (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_phone VARCHAR NOT NULL REFERENCES domino_users(phone) ON DELETE CASCADE,
                        item_id UUID REFERENCES domino_items(id) ON DELETE SET NULL,
                        message TEXT NOT NULL,
                        next_fire_at TIMESTAMPTZ NOT NULL,
                        cron_pattern VARCHAR,
                        is_recurring BOOLEAN NOT NULL DEFAULT false,
                        is_active BOOLEAN NOT NULL DEFAULT true,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
                await conn.execute(text("""
                    CREATE INDEX IF NOT EXISTS idx_domino_reminders_due
                    ON domino_reminders (next_fire_at, is_active)
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS domino_waitlist (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        email VARCHAR NOT NULL UNIQUE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
        logger.info("Startup schema applied successfully")
    except Exception:
        logger.exception(
            "Startup schema failed (check Cloud SQL, VPC connector, DATABASE_URL)"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Boot immediately; apply schema in the background so PORT can bind."""
    schema_task: asyncio.Task | None = None
    if settings.RUN_STARTUP_SCHEMA:
        schema_task = asyncio.create_task(_apply_startup_schema())

    yield

    if schema_task and not schema_task.done():
        schema_task.cancel()
        with suppress(asyncio.CancelledError):
            await schema_task


app = FastAPI(
    title="Domino API",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    redirect_slashes=False,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
cors_origins = list(settings.BACKEND_CORS_ORIGINS)
if settings.FRONTEND_URL:
    cors_origins.append(settings.FRONTEND_URL)

cors_kwargs: dict = {
    "allow_origins": cors_origins,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings.BACKEND_CORS_ORIGIN_REGEX:
    cors_kwargs["allow_origin_regex"] = settings.BACKEND_CORS_ORIGIN_REGEX

app.add_middleware(CORSMiddleware, **cors_kwargs)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    return {"message": "Domino API is running", "status": "healthy"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/health/db")
async def health_db():
    """Diagnose Cloud SQL connectivity without touching auth/Twilio."""
    try:
        async with asyncio.timeout(10):
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "ok"}
    except Exception as exc:
        logger.exception("health/db failed")
        return {
            "status": "unhealthy",
            "database": "error",
            "error": type(exc).__name__,
            "detail": str(exc)[:300],
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
