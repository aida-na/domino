"""Privacy helpers — redact identifiers in logs."""


def mask_phone(phone: str | None) -> str:
    """Return a log-safe phone label (last 4 digits only)."""
    if not phone:
        return "****"
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) >= 4:
        return f"***{digits[-4:]}"
    return "****"
