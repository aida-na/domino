import logging
from typing import Optional

from pydantic import ConfigDict, model_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    APP_NAME: str = "Domino API"
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

    # Twilio / WhatsApp
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_PHONE_NUMBER: str = ""
    DOMINO_INTERNAL_SECRET: str = ""

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "https://domino.fyi",
        "https://www.domino.fyi",
    ]
    FRONTEND_URL: Optional[str] = None
    BACKEND_CORS_ORIGIN_REGEX: Optional[str] = r"^https://(domino\.fyi|domino[a-z0-9\-]*\.vercel\.app)$"

    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"

    # Monitoring
    SENTRY_DSN: Optional[str] = None

    model_config = ConfigDict(env_file=".env", case_sensitive=True)

    @model_validator(mode="after")
    def _warn_insecure_defaults(self) -> "Settings":
        if not self.DEBUG and self.SECRET_KEY == "your-secret-key-change-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a secure random value in production."
            )
        return self


settings = Settings()
