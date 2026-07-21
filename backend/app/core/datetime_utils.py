"""Datetime helpers for API serialization."""

from datetime import datetime, timezone


def serialize_datetime(dt: datetime | None) -> str | None:
    """RFC 3339 UTC string safe for strict ISO8601 parsers (e.g. iOS).

    SQLite returns naive datetimes; clients like Swift's ISO8601DateFormatter
    reject strings without a timezone offset.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    # Trim to milliseconds — enough precision, avoids exotic fractional formats.
    ms = dt.microsecond // 1000
    return dt.replace(microsecond=ms * 1000).isoformat().replace("+00:00", "Z")
