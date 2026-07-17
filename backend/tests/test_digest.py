"""Unit tests for weekly digest window helpers."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.digest import _is_weekly_digest_window, _parse_digest_time


def _user(**kwargs):
    defaults = {
        "timezone": "America/Los_Angeles",
        "digest_time": "08:00",
        "digest_opted_out": False,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("08:00", (8, 0)),
        ("17:30", (17, 30)),
        ("9:05", (9, 5)),
        (None, (8, 0)),
        ("", (8, 0)),
        ("bad", (8, 0)),
        ("25:00", (8, 0)),
        ("12:99", (8, 0)),
    ],
)
def test_parse_digest_time(raw, expected):
    assert _parse_digest_time(raw) == expected


def test_window_matches_sunday_digest_time_pt():
    # Sunday 2026-07-19 08:05 America/Los_Angeles = 15:05 UTC
    now = datetime(2026, 7, 19, 15, 5, tzinfo=timezone.utc)
    user = _user(timezone="America/Los_Angeles", digest_time="08:00")
    assert _is_weekly_digest_window(user, now) is True


def test_window_rejects_outside_15_min():
    # Sunday 2026-07-19 08:20 PT = 15:20 UTC — 20 min past 08:00
    now = datetime(2026, 7, 19, 15, 20, tzinfo=timezone.utc)
    user = _user(timezone="America/Los_Angeles", digest_time="08:00")
    assert _is_weekly_digest_window(user, now) is False


def test_window_rejects_weekday():
    # Monday 2026-07-20 08:00 PT = 15:00 UTC
    now = datetime(2026, 7, 20, 15, 0, tzinfo=timezone.utc)
    user = _user(timezone="America/Los_Angeles", digest_time="08:00")
    assert _is_weekly_digest_window(user, now) is False


def test_window_honors_custom_digest_time():
    # Sunday 2026-07-19 17:00 PT = 00:00 UTC Monday
    now = datetime(2026, 7, 20, 0, 0, tzinfo=timezone.utc)
    user = _user(timezone="America/Los_Angeles", digest_time="17:00")
    assert _is_weekly_digest_window(user, now) is True


def test_window_tokyo_sunday_morning_is_saturday_utc():
    # Sunday 2026-07-19 08:00 Asia/Tokyo = Saturday 2026-07-18 23:00 UTC
    now = datetime(2026, 7, 18, 23, 0, tzinfo=timezone.utc)
    user = _user(timezone="Asia/Tokyo", digest_time="08:00")
    assert _is_weekly_digest_window(user, now) is True


def test_window_invalid_timezone_falls_back_to_pt():
    # Sunday 08:00 PT
    now = datetime(2026, 7, 19, 15, 0, tzinfo=timezone.utc)
    user = _user(timezone="Not/AZone", digest_time="08:00")
    assert _is_weekly_digest_window(user, now) is True
