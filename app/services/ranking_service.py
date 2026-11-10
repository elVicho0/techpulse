from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.db.connection import connect
from app.services.settings_service import get_all_settings
from app.utils.time import utc_now_iso


def _parse_dt(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def compute_popularity(stars: int, forks: int) -> float:
    norm_stars = min(1.0, math.log10(1 + max(0, stars)) / 6.0)
    norm_forks = min(1.0, math.log10(1 + max(0, forks)) / 5.0)
    return 0.7 * norm_stars + 0.3 * norm_forks


def compute_activity(pushed_at: str | None, commits_recent: int | None) -> float:
    now = datetime.now(timezone.utc)
    dt = _parse_dt(pushed_at)
    if not dt:
        recency = 0.0
    else:
        days = (now - dt.astimezone(timezone.utc)).total_seconds() / 86400
        if days <= 7:
            recency = 1.0
        elif days <= 30:
            recency = 0.8
        elif days <= 90:
            recency = 0.5
        elif days <= 365:
            recency = 0.2
        else:
            recency = 0.0
    if commits_recent is None:
        return recency
    commits = min(1.0, max(0, commits_recent) / 20.0)
    return 0.7 * recency + 0.3 * commits


def compute_maintenance(repo: dict[str, Any]) -> float:
    base = 1.0
    if repo.get("archived"):
        base -= 0.60
    if repo.get("disabled"):
        base -= 0.60
    if not repo.get("license_spdx"):
        base -= 0.15
    if not repo.get("description"):
        base -= 0.10
    if not repo.get("homepage_url") and not repo.get("docs_url"):
        base -= 0.10
    pushed = _parse_dt(repo.get("pushed_at"))
    if not pushed or (datetime.now(timezone.utc) - pushed.astimezone(timezone.utc)).days > 365:
        base -= 0.25
    stars = max(1, int(repo.get("stars") or 0))
    issues = int(repo.get("open_issues") or 0)
    if issues / stars > 0.5:
        base -= 0.10
    return max(0.0, min(1.0, base))


def compute_quality(maintenance: float, activity: float, license_spdx: str | None) -> float:
    license_present = 1.0 if license_spdx else 0.0
    return 0.45 * maintenance + 0.35 * activity + 0.20 * license_present


def compute_relevance(category: str | None, tags: list[str], interests: dict[str, Any] | None = None) -> float:
    if not interests or (not interests.get("categories") and not interests.get("tags")):
        return 0.5
    cats = set(interests.get("categories") or [])
    itags = set(interests.get("tags") or [])
    category_match = 1.0 if category and category in cats else 0.0
    if not tags:
        tag_match = 0.0
    else:
        tag_match = len(set(tags) & itags) / max(1, len(set(tags)))
    return 0.6 * category_match + 0.4 * tag_match


def compute_growth_from_snapshots(snapshots: list[dict], window_days: int = 7) -> tuple[float | None, dict]:
    """Returns (growth_score or None, explanation). Never returns 0 for unknown."""
    if len(snapshots) < 2:
        return None, {"available": False, "reason": "insufficient_snapshots"}
    now = datetime.now(timezone.utc)
    # snapshots sorted asc by captured_at
    latest = snapshots[-1]
    target = None
    for s in reversed(snapshots):
        dt = _parse_dt(s["captured_at"])
        if dt and (now - dt.astimezone(timezone.utc)).total_seconds() >= window_days * 86400 * 0.8:
            target = s
            break
    if not target:
        target = snapshots[0]
    dt0 = _parse_dt(target["captured_at"])
    dt1 = _parse_dt(latest["captured_at"])
    if not dt0 or not dt1:
        return None, {"available": False, "reason": "invalid_dates"}
    days = max((dt1 - dt0).total_seconds() / 86400, 0.1)
    delta = int(latest["stars"]) - int(target["stars"])
    per_day = delta / days
    growth = max(0.0, min(1.0, per_day / 100.0))
    return growth, {"available": True, "delta": delta, "per_day": per_day, "days": days, "from": target["stars"], "to": latest["stars"]}


def compute_interest(components: dict[str, float | None], weights: dict[str, float]) -> tuple[float, dict[str, float]]:
    active = {k: v for k, v in components.items() if v is not None and k in weights}
    total = sum(weights[k] for k in active)
    if total <= 0:
        return 0.0, {}
    effective = {k: weights[k] / total for k in active}
    interest = sum((components[k] or 0.0) * w for k, w in effective.items())
    return max(0.0, min(1.0, interest)), effective


def recalculate_repo_scores(repo_id: int, db_path: str | Path | None = None, window_days: int = 7) -> dict | None:
    conn = connect(db_path)
    try:
        r = conn.execute("SELECT * FROM repositories WHERE id=?", (repo_id,)).fetchone()
        if not r:
            return None
        repo = dict(r)
        tags = json.loads(repo.get("tags") or "[]") if isinstance(repo.get("tags"), str) else []
        snaps = [dict(x) for x in conn.execute(
            "SELECT * FROM repository_snapshots WHERE repository_id=? ORDER BY captured_at ASC", (repo_id,)
        ).fetchall()]
        settings = get_all_settings(db_path)
        weights = (settings.get("ranking.weights") or {"growth": 0.3, "activity": 0.2, "maintenance": 0.2, "relevance": 0.15, "popularity": 0.15})
        popularity = compute_popularity(repo.get("stars") or 0, repo.get("forks") or 0)
        growth, growth_exp = compute_growth_from_snapshots(snaps, window_days)
        activity = compute_activity(repo.get("pushed_at"), None)
        maintenance = compute_maintenance(repo)
        relevance = compute_relevance(repo.get("category"), tags)
        quality = compute_quality(maintenance, activity, repo.get("license_spdx"))
        interest, effective = compute_interest(
            {"growth": growth, "activity": activity, "maintenance": maintenance, "relevance": relevance, "popularity": popularity},
            weights,
        )
        explanation = {
            "weights": weights,
            "effective_weights": effective,
            "components": {
                "popularity": popularity, "growth": growth, "activity": activity,
                "maintenance": maintenance, "relevance": relevance, "interest": interest, "quality": quality,
            },
            "growth": growth_exp,
            "missing": [] if growth is not None else ["growth_history"],
        }
        conn.execute(
            """UPDATE repositories SET popularity_score=?, growth_score=?, activity_score=?, maintenance_score=?,
               relevance_score=?, interest_score=?, quality_score=?, score_explanation_json=? WHERE id=?""",
            (popularity, growth, activity, maintenance, relevance, interest, quality, json.dumps(explanation), repo_id),
        )
        conn.commit()
        return explanation
    finally:
        conn.close()
