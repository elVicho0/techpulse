from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def utc_now_iso() -> str:
    return utc_now().strftime("%Y-%m-%dT%H:%M:%SZ")


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")


def truncate_hour_iso(dt: datetime | str | None = None) -> str:
    if dt is None:
        d = utc_now()
    elif isinstance(dt, str):
        # Accept Z suffix
        s = dt.replace("Z", "+00:00")
        d = datetime.fromisoformat(s)
    else:
        d = dt
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    d = d.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")
