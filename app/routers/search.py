from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.db.connection import connect
from app.services.repo_service import _repo_summary_from_row
from app.services.news_service import _news_from_row

router = APIRouter(tags=["search"])


@router.get("/search")
def search(q: str = Query(..., min_length=2, max_length=200), types: str = "repository,news,idea", limit: int = 10, mode: str = "keyword"):
    if mode == "semantic":
        raise HTTPException(status_code=503, detail={"code": "EMBEDDINGS_UNAVAILABLE", "message": "Embeddings sidecar/model not available"})
    mode_requested = mode
    mode_used = "keyword" if mode == "hybrid" else mode
    limit = min(20, max(1, limit))
    tset = {t.strip() for t in types.split(',') if t.strip()}
    like = f"%{q}%"
    conn = connect()
    try:
        out = {"query": q, "mode_requested": mode_requested, "mode_used": mode_used, "repositories": [], "news": [], "ideas": []}
        if "repository" in tset:
            rows = conn.execute("SELECT * FROM repositories WHERE full_name LIKE ? OR description LIKE ? OR topics_json LIKE ? ORDER BY interest_score DESC LIMIT ?", (like,like,like,limit)).fetchall()
            out["repositories"] = [_repo_summary_from_row(r, conn) for r in rows]
        if "news" in tset:
            rows = conn.execute("SELECT * FROM news_items WHERE title LIKE ? OR summary LIKE ? ORDER BY importance_score DESC LIMIT ?", (like,like,limit)).fetchall()
            out["news"] = [_news_from_row(r, conn) for r in rows]
        if "idea" in tset:
            rows = conn.execute("SELECT id,title,difficulty,category,status FROM project_ideas WHERE title LIKE ? OR summary LIKE ? OR problem LIKE ? ORDER BY updated_at DESC LIMIT ?", (like,like,like,limit)).fetchall()
            out["ideas"] = [dict(r) for r in rows]
        return out
    finally:
        conn.close()
