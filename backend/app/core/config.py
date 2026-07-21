import logging
from typing import Literal, Optional

from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)

EnvironmentName = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    APP_NAME: str = "Domino API"
    ENVIRONMENT: EnvironmentName = "development"
    DEBUG: bool = True
    SQLALCHEMY_ECHO: bool = False
    TESTING: bool = False
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str = "sqlite+aiosqlite:///./domino.db"
    RUN_STARTUP_SCHEMA: bool = True

    GEMINI_API_KEY: str = ""

    # Google Cloud Storage (media / images)
    GCS_BUCKET_NAME: Optional[str] = None
    GCS_SERVICE_ACCOUNT_JSON: Optional[str] = None

    # Email (Resend)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Domino <noreply@resend.dev>"

    # Blooio (iMessage / SMS)
    BLOOIO_API_KEY: str = ""
    BLOOIO_PHONE_NUMBER: str = ""  # optional; omit to use API key's default number
    BLOOIO_WEBHOOK_SECRET: str = ""  # signing_secret from webhook create (whsec_…)
    DOMINO_INTERNAL_SECRET: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://domino.fyi",
        "https://www.domino.fyi",
    ]
    # Prefer www while apex→www redirect remains (Apple AASA cannot follow redirects).
    FRONTEND_URL: Optional[str] = "https://www.domino.fyi"
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = (
        r"^https://((www\.)?domino\.fyi|domino[a-z0-9\-]*\.vercel\.app)$"
    )

    # Max new DominoUser rows created per UTC day (0 = unlimited). Invites count.
    DAILY_NEW_USER_LIMIT: int = 5

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"

    # Monitoring
    SENTRY_DSN: Optional[str] = None

    model_config = ConfigDict(env_file=".env", case_sensitive=True)

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_staging(self) -> bool:
        return self.ENVIRONMENT == "staging"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"

    @property
    def allow_unsigned_webhooks(self) -> bool:
        """Only local dev may accept unsigned Blooio webhooks."""
        return self.is_development and not self.BLOOIO_WEBHOOK_SECRET

    @model_validator(mode="after")
    def _apply_environment_rules(self) -> "Settings":
        if self.TESTING:
            return self

        if self.is_production:
            if self.DEBUG:
                raise ValueError("DEBUG must be false when ENVIRONMENT=production")
            if self.SECRET_KEY == "your-secret-key-change-in-production":
                raise ValueError(
                    "SECRET_KEY must be set to a secure random value in production."
                )
            if not self.BLOOIO_WEBHOOK_SECRET:
                raise ValueError(
                    "BLOOIO_WEBHOOK_SECRET is required when ENVIRONMENT=production"
                )
            if not self.DOMINO_INTERNAL_SECRET:
                raise ValueError(
                    "DOMINO_INTERNAL_SECRET is required when ENVIRONMENT=production"
                )

        if self.is_staging and not self.BLOOIO_WEBHOOK_SECRET:
            logger.warning(
                "BLOOIO_WEBHOOK_SECRET unset in staging — configure before exposing staging webhooks"
            )

        if not self.DEBUG and self.SECRET_KEY == "your-secret-key-change-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a secure random value when DEBUG=false."
            )
        return self


settings = Settings()
