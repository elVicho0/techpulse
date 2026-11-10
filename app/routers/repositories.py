from __future__ import annotations

from fastapi import APIRouter, Query, Response

from app.services.repo_service import get_repo_snapshots, get_repository, list_repositories, set_repo_state
from app.services.saved_service import save_item, unsave_item

router = APIRouter(tags=["repositories"])


@router.get("/repositories")
def repositories(
    page: int = 1, page_size: int = 20, q: str | None = None, period: str = "30d", growth_window: str = "7d",
    language: str | None = None, category: str | None = None, tag: str | None = None, saved: bool | None = None,
    status: str | None = None, min_stars: int | None = None, min_growth: float | None = None, source_id: int | None = None,
    sort: str = "interest", order: str = "desc",
):
    return list_repositories(page=page, page_size=page_size, q=q, period=period, growth_window=growth_window, language=language,
                             category=category, tag=tag, saved=saved, status=status, min_stars=min_stars, min_growth=min_growth,
                             source_id=source_id, sort=sort, order=order)


@router.get("/repositories/{repo_id}")
def repository_detail(repo_id: int):
    return get_repository(repo_id)


@router.get("/repositories/{repo_id}/snapshots")
def repository_snapshots(repo_id: int, window: str = "30d"):
    return get_repo_snapshots(repo_id, window)


@router.get("/repositories/{repo_id}/similar")
def repository_similar(repo_id: int, limit: int = 6, mode: str = "metadata"):
    # F2: metadata mode + graceful fallback for semantic/hybrid (no embeddings sidecar download/index required)
    from app.db.connection import connect
    from app.services.repo_service import _repo_summary_from_row
    limit = min(20, max(1, limit))
    conn = connect()
    try:
        r = conn.execute("SELECT * FROM repositories WHERE id=?", (repo_id,)).fetchone()
        if not r:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail={"code": "REPOSITORY_NOT_FOUND", "message": "Repository not found"})
        mode_requested = mode
        mode_used = "metadata" if mode in ("metadata", "hybrid") else mode
        if mode == "semantic":
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail={"code": "EMBEDDINGS_UNAVAILABLE", "message": "Embeddings sidecar/model not available"})
        rows = conn.execute(
            "SELECT * FROM repositories WHERE id!=? AND (category=? OR language=COALESCE(?,language)) ORDER BY interest_score DESC LIMIT ?",
            (repo_id, r["category"], r["language"], limit),
        ).fetchall()
        items = []
        for row in rows:
            s = _repo_summary_from_row(row, conn)
            s["match"] = {"mode": mode_used, "similarity": None, "score": s["scores"]["interest"]}
            items.append(s)
        return {"items": items, "mode_requested": mode_requested, "mode_used": mode_used}
    finally:
        conn.close()


@router.get("/repositories/{repo_id}/ideas")
def repository_ideas(repo_id: int):
    from app.db.connection import connect
    conn = connect()
    try:
        rows = conn.execute(
            "SELECT pi.id, pi.title, pi.difficulty, pi.category, pi.status FROM idea_repositories ir JOIN project_ideas pi ON pi.id=ir.idea_id WHERE ir.repository_id=? GROUP BY pi.id",
            (repo_id,),
        ).fetchall()
        return {"items": [dict(r) for r in rows]}
    finally:
        conn.close()


@router.post("/repositories/{repo_id}/save", status_code=201)
def save_repo(repo_id: int):
    return save_item("repository", repo_id)


@router.delete("/repositories/{repo_id}/save", status_code=204)
def unsave_repo(repo_id: int):
    unsave_item("repository", repo_id)
    return Response(status_code=204)


@router.patch("/repositories/{repo_id}/state")
def patch_repo_state(repo_id: int, body: dict):
    return set_repo_state(repo_id, body.get("status", ""), body.get("note"))
