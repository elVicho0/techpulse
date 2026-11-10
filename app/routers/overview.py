from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from app.db.connection import connect
from app.services.repo_service import _repo_summary_from_row
from app.services.news_service import _news_from_row
from app.utils.time import utc_now_iso

router = APIRouter(tags=["dashboard"])


@router.get("/overview")
def overview(limit: int = 5):
    limit = min(20, max(1, limit))
    conn = connect()
    try:
        counts = {
            "repositories": conn.execute("SELECT COUNT(*) c FROM repositories").fetchone()["c"],
            "news": conn.execute("SELECT COUNT(*) c FROM news_items").fetchone()["c"],
            "ideas": conn.execute("SELECT COUNT(*) c FROM project_ideas").fetchone()["c"],
            "saved": conn.execute("SELECT COUNT(*) c FROM saved_items").fetchone()["c"],
            "sources": conn.execute("SELECT COUNT(*) c FROM sources").fetchone()["c"],
        }
        last_success = conn.execute("SELECT MAX(last_success_at) m FROM sources").fetchone()["m"]
        since7 = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
        feat = conn.execute("SELECT * FROM repositories WHERE archived=0 AND disabled=0 AND first_seen_at>=? ORDER BY interest_score DESC LIMIT ?", (since7, limit)).fetchall()
        if not feat:
            feat = conn.execute("SELECT * FROM repositories WHERE archived=0 AND disabled=0 ORDER BY interest_score DESC LIMIT ?", (limit,)).fetchall()
        news = conn.execute("SELECT * FROM news_items ORDER BY importance_score DESC, COALESCE(published_at,fetched_at) DESC LIMIT ?", (limit,)).fetchall()
        ai = conn.execute("SELECT * FROM repositories WHERE category='ai' AND archived=0 ORDER BY interest_score DESC LIMIT ?", (limit,)).fetchall()
        tools = conn.execute("SELECT * FROM repositories WHERE category IN ('dev_tools','ai') AND archived=0 ORDER BY quality_score DESC, created_at DESC LIMIT ?", (limit,)).fetchall()
        runs = conn.execute("SELECT sr.*, s.key source_key, s.name source_name FROM source_runs sr JOIN sources s ON s.id=sr.source_id ORDER BY sr.id DESC LIMIT 5").fetchall()
        recent_runs = [{"id":r["id"],"source_id":r["source_id"],"source_key":r["source_key"],"source_name":r["source_name"],"trigger":r["trigger"],"status":r["status"],"started_at":r["started_at"],"finished_at":r["finished_at"],"items_fetched":r["items_fetched"],"items_new":r["items_new"],"items_updated":r["items_updated"],"items_skipped":r["items_skipped"],"error_code":r["error_code"],"error_message":r["error_message"],"duration_ms":r["duration_ms"]} for r in runs]
        return {
            "generated_at": utc_now_iso(), "last_success_at": last_success, "counts": counts,
            "featured_repositories": [_repo_summary_from_row(r, conn) for r in feat],
            "top_news": [_news_from_row(r, conn) for r in news],
            "ai_trends": [_repo_summary_from_row(r, conn) for r in ai],
            "new_tools": [_repo_summary_from_row(r, conn) for r in tools],
            "recent_runs": recent_runs,
            "summary_text": f"{counts['repositories']} repositorios y {counts['news']} noticias recopiladas. {counts['ideas']} ideas de proyecto disponibles.",
        }
    finally:
        conn.close()
