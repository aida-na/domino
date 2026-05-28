"""Email sending via Resend API."""
import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(
    to: str | list[str],
    subject: str,
    html: str,
    from_email: Optional[str] = None,
) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set, skipping email send")
        return False

    try:
        import resend

        resend.api_key = settings.RESEND_API_KEY
        to_list = [to] if isinstance(to, str) else to
        params = {
            "from": from_email or settings.EMAIL_FROM,
            "to": to_list,
            "subject": subject,
            "html": html,
        }
        resend.Emails.send(params)
        return True
    except Exception as e:
        logger.exception("Failed to send email via Resend: %s", e)
        return False
