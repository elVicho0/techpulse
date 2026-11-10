from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.db.connection import connect
from app.utils.time import utc_now_iso

ENTITY_TABLES = {"repository": "repositories", "news": "news_items", "idea": "project_ideas"}


def _ensure_entity(item_type: str, item_id: int, conn):
    table = ENTITY_TABLES.get(item_type)
    if not table:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION_ERROR", "message": "Invalid item_type"})
    if not conn.execute(f"SELECT 1 FROM {table} WHERE id=?", (item_id,)).fetchone():
        code = {"repository": "REPOSITORY_NOT_FOUND", "news": "NEWS_NOT_FOUND", "idea": "IDEA_NOT_FOUND"}.get(item_type, "NOT_FOUND")
        raise HTTPException(status_code=404, detail={"code": code, "message": "Entity not found"})


def save_item(item_type: str, item_id: int, notes: str | None = None, db_path: str | Path | None = None) -> dict:
    conn = connect(db_path)
    try:
        _ensure_entity(item_type, item_id, conn)
        exists = conn.execute("SELECT 1 FROM saved_items WHERE item_type=? AND item_id=?", (item_type, item_id)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail={"code": "CONFLICT", "message": "Item already saved"})
        now = utc_now_iso()
        conn.execute("INSERT INTO saved_items(item_type,item_id,saved_at,notes) VALUES (?,?,?,?)", (item_type, item_id, now, notes))
        conn.commit()
        return {"item_type": item_type, "item_id": item_id, "saved_at": now}
    finally:
        conn.close()


def unsave_item(item_type: str, item_id: int, db_path: str | Path | None = None) -> None:
    conn = connect(db_path)
    try:
        conn.execute("DELETE FROM saved_items WHERE item_type=? AND item_id=?", (item_type, item_id))
        conn.commit()
    finally:
        conn.close()


def list_saved(item_type: str | None = None, page: int = 1, page_size: int = 20, db_path: str | Path | None = None) -> dict:
    from app.services.repo_service import _repo_summary_from_row
    from app.services.news_service import _news_from_row
    page = max(1, page); page_size = min(100, max(1, page_size))
    conn = connect(db_path)
    try:
        where = "WHERE 1=1"; params: list[Any] = []
        if item_type:
            where += " AND item_type=?"; params.append(item_type)
        total = conn.execute(f"SELECT COUNT(*) c FROM saved_items {where}", params).fetchone()["c"]
        rows = conn.execute(f"SELECT * FROM saved_items {where} ORDER BY saved_at DESC LIMIT ? OFFSET ?", params + [page_size, (page-1)*page_size]).fetchall()
        items = []
        for r in rows:
            it = {"item_type": r["item_type"], "item_id": r["item_id"], "saved_at": r["saved_at"], "notes": r["notes"]}
            if r["item_type"] == "repository":
                rr = conn.execute("SELECT * FROM repositories WHERE id=?", (r["item_id"],)).fetchone()
                if rr: it["repository"] = _repo_summary_from_row(rr, conn)
            elif r["item_type"] == "news":
                nr = conn.execute("SELECT * FROM news_items WHERE id=?", (r["item_id"],)).fetchone()
                if nr: it["news"] = _news_from_row(nr, conn)
            if "repository" in it or "news" in it or r["item_type"] == "idea":
                items.append(it)
        return {"items": items, "page": page, "page_size": page_size, "total": total, "has_next": page * page_size < total}
    finally:
        conn.close()
