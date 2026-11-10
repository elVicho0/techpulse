from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from app.config import API_VERSION, WORKER_STALE_AFTER_SECONDS
from app.db.connection import connect


def get_worker_status(db_path: str | Path | None = None) -> dict:
    conn = connect(db_path)
    try:
        row = conn.execute(
            "SELECT * FROM worker_leases WHERE lease_key = 'main' ORDER BY heartbeat_at DESC LIMIT 1"
        ).fetchone()
        stale_after = WORKER_STALE_AFTER_SECONDS
        if not row:
            return {
                "state": "offline",
                "worker_id": None,
                "heartbeat_at": None,
                "current_job": None,
                "version": API_VERSION,
                "stale_after_seconds": stale_after,
            }
        hb = row["heartbeat_at"]
        state = "offline"
        if hb:
            try:
                dt = datetime.fromisoformat(hb.replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
                if age <= stale_after:
                    state = "online"
                elif age <= stale_after * 3:
                    state = "stale"
            except Exception:
                state = "offline"
        return {
            "state": state,
            "worker_id": row["worker_id"],
            "heartbeat_at": row["heartbeat_at"],
            "current_job": row["current_job"],
            "version": row["version"],
            "stale_after_seconds": stale_after,
        }
    finally:
        conn.close()
