from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.db.connection import connect
from app.utils.time import utc_now_iso


def _row_to_source(r) -> dict[str, Any]:
    cfg = {}
    try:
        cfg = json.loads(r["config_json"] or "{}")
    except Exception:
        pass
    # sanitize: never expose secrets (none stored now)
    return {
        "id": r["id"],
        "key": r["key"],
        "name": r["name"],
        "kind": r["kind"],
        "category": r["category"],
        "enabled": bool(r["enabled"]),
        "interval_minutes": r["interval_minutes"],
        "config": cfg,
        "rate_limit_per_hour": r["rate_limit_per_hour"],
        "last_run_at": r["last_run_at"],
        "last_success_at": r["last_success_at"],
        "last_error": r["last_error"],
        "next_run_at": r["next_run_at"],
    }


def list_sources(db_path: str | Path | None = None) -> list[dict[str, Any]]:
    conn = connect(db_path)
    try:
        rows = conn.execute("SELECT * FROM sources ORDER BY kind, name").fetchall()
        return [_row_to_source(r) for r in rows]
    finally:
        conn.close()


def get_source(source_id: int, db_path: str | Path | None = None) -> dict[str, Any]:
    conn = connect(db_path)
    try:
        r = conn.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Source not found"})
        return _row_to_source(r)
    finally:
        conn.close()


def update_source(source_id: int, body: dict[str, Any], db_path: str | Path | None = None) -> dict[str, Any]:
    allowed = {"enabled", "interval_minutes", "config"}
    unknown = [k for k in body if k not in allowed]
    if unknown:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": f"Unknown fields: {unknown}"})
    conn = connect(db_path)
    try:
        r = conn.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Source not found"})
        enabled = bool(body["enabled"]) if "enabled" in body else bool(r["enabled"])
        interval = int(body["interval_minutes"]) if "interval_minutes" in body else int(r["interval_minutes"])
        if interval < 5 or interval > 10080:
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "interval_minutes must be 5..10080"})
        cfg = json.loads(r["config_json"] or "{}")
        if "config" in body:
            if not isinstance(body["config"], dict):
                raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "config must be an object"})
            cfg = body["config"]
        conn.execute(
            "UPDATE sources SET enabled=?, interval_minutes=?, config_json=?, updated_at=? WHERE id=?",
            (1 if enabled else 0, interval, json.dumps(cfg), utc_now_iso(), source_id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_source(source_id, db_path)
