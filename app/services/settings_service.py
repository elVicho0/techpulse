from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.config import DEFAULT_SETTINGS
from app.db.connection import connect
from app.utils.time import utc_now_iso


def _normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    """Normalize weights so they sum to 1.0. Missing keys get 0.0."""
    required = ["growth", "activity", "maintenance", "relevance", "popularity", "interest", "quality"]
    for k in required:
        if k not in weights:
            weights[k] = 0.0
    total = sum(weights.values())
    if total > 0:
        return {k: round(v / total, 4) for k, v in weights.items()}
    # Fallback: default weights if all are 0
    return {"growth": 0.30, "activity": 0.20, "maintenance": 0.20,
            "relevance": 0.15, "popularity": 0.15, "interest": 0.00, "quality": 0.00}


def get_ranking_weights(db_path: str | Path | None = None) -> dict[str, float]:
    """Return the active ranking weights: user personal if set, else system defaults."""
    all_settings = get_all_settings(db_path)
    raw = all_settings.get("ranking.weights", {})  # Fixed: use ranking.weights key
    if isinstance(raw, dict):
        return _normalize_weights(raw)
    return get_default_ranking_weights()


def get_default_ranking_weights() -> dict[str, float]:
    """Return the hardcoded system default weights."""
    return {"growth": 0.30, "activity": 0.20, "maintenance": 0.20,
            "relevance": 0.15, "popularity": 0.15, "interest": 0.00, "quality": 0.00}


def update_ranking_weights(weights: dict[str, float], db_path: str | Path | None = None) -> dict[str, float]:
    """Update ranking weights in the settings table, normalizing them to sum to 1.0."""
    normalized = _normalize_weights(weights)
    conn = connect(db_path)
    try:
        # Remove any existing ranking keys to avoid stale data
        conn.execute("DELETE FROM settings WHERE key LIKE 'ranking.%'")
        # Store the normalized weights under a specific key
        conn.execute(
            "INSERT INTO settings(key, value, value_json, updated_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, value_json=excluded.value_json",
            ("ranking.weights", json.dumps(normalized), json.dumps(normalized), utc_now_iso()),
        )
        conn.commit()
    finally:
        conn.close()
    # Also update in-memory DEFAULT_SETTINGS so subsequent calls pick it up
    DEFAULT_SETTINGS["ranking.weights"] = normalized
    return normalized


def get_all_settings(db_path: str | Path | None = None) -> dict[str, Any]:
    conn = connect(db_path)
    try:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        out = dict(DEFAULT_SETTINGS)
        for r in rows:
            try:
                out[r["key"]] = json.loads(r["value"])
            except Exception:
                pass
        return out
    finally:
        conn.close()


def update_settings(patch: dict[str, Any], db_path: str | Path | None = None) -> dict[str, Any]:
    if not patch:
        return get_all_settings(db_path)
    current = get_all_settings(db_path)
    unknown = [k for k in patch if k not in DEFAULT_SETTINGS]
    if unknown:
        raise HTTPException(
            status_code=422,
            detail={"code": "VALIDATION_ERROR", "message": f"Unknown setting keys: {', '.join(unknown)}", "details": {"keys": unknown}},
        )
    # Basic type validation
    for k, v in patch.items():
        default = DEFAULT_SETTINGS[k]
        if default is None:
            continue
        if isinstance(default, bool) and not isinstance(v, bool):
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": f"{k} must be boolean"})
        if isinstance(default, int) and not isinstance(v, bool) and not isinstance(v, int):
            raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": f"{k} must be integer"})
        if isinstance(default, (int, float)) and not isinstance(default, bool):
            try:
                fv = float(v)
            except Exception:
                raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": f"{k} must be numeric"})
            if fv < 0:
                raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": f"{k} must be >= 0"})
    now = utc_now_iso()
    conn = connect(db_path)
    try:
        for k, v in patch.items():
            conn.execute(
                "INSERT INTO settings(key, value, value_json, updated_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value, value_json=excluded.value_json, updated_at=excluded.updated_at",
                (k, json.dumps(v), json.dumps(v), now),
            )
        conn.commit()
    finally:
        conn.close()
    return get_all_settings(db_path)