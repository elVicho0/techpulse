from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.db.connection import connect
from app.services.worker_service import get_worker_status
from app.utils.time import utc_now_iso


def enqueue_job(source_id: int | None, db_path: str | Path | None = None, requested_by: str = "api") -> dict[str, Any]:
    conn = connect(db_path)
    try:
        now = utc_now_iso()
        cur = conn.execute(
            "INSERT INTO job_requests(source_id, requested_at, status, requested_by) VALUES (?, ?, 'pending', ?)",
            (source_id, now, requested_by),
        )
        conn.commit()
        jid = cur.lastrowid
    finally:
        conn.close()
    ws = get_worker_status(db_path)
    return {"request_id": jid, "source_id": source_id, "status": "pending", "worker_state": ws["state"]}


def list_jobs(status: str | None = None, source_id: int | None = None, page: int = 1, page_size: int = 20, db_path: str | Path | None = None):
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    where = []
    params: list[Any] = []
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        where.append(f"jr.status IN ({','.join(['?']*len(statuses))})")
        params.extend(statuses)
    if source_id is not None:
        where.append("jr.source_id=?")
        params.append(source_id)
    wh = ("WHERE " + " AND ".join(where)) if where else ""
    conn = connect(db_path)
    try:
        total = conn.execute(f"SELECT COUNT(*) c FROM job_requests jr {wh}", params).fetchone()["c"]
        rows = conn.execute(
            f"""SELECT jr.*, s.key as source_key FROM job_requests jr
                LEFT JOIN sources s ON s.id=jr.source_id
                {wh} ORDER BY jr.requested_at DESC LIMIT ? OFFSET ?""",
            params + [page_size, (page - 1) * page_size],
        ).fetchall()
        items = [
            {
                "id": r["id"],
                "source_id": r["source_id"],
                "source_key": r["source_key"],
                "status": r["status"],
                "requested_at": r["requested_at"],
                "claimed_at": r["claimed_at"],
                "finished_at": r["finished_at"],
                "error_message": r["error_message"],
            }
            for r in rows
        ]
        return {"items": items, "page": page, "page_size": page_size, "total": total, "has_next": page * page_size < total}
    finally:
        conn.close()


def list_runs(source_id: int | None = None, status: str | None = None, page: int = 1, page_size: int = 20, order: str = "desc", db_path: str | Path | None = None):
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    where = []
    params: list[Any] = []
    if source_id is not None:
        where.append("sr.source_id=?")
        params.append(source_id)
    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        where.append(f"sr.status IN ({','.join(['?']*len(statuses))})")
        params.extend(statuses)
    wh = ("WHERE " + " AND ".join(where)) if where else ""
    ord_sql = "ASC" if str(order).lower() == "asc" else "DESC"
    conn = connect(db_path)
    try:
        total = conn.execute(f"SELECT COUNT(*) c FROM source_runs sr {wh}", params).fetchone()["c"]
        rows = conn.execute(
            f"""SELECT sr.*, s.key as source_key, s.name as source_name FROM source_runs sr
                JOIN sources s ON s.id=sr.source_id
                {wh} ORDER BY sr.started_at {ord_sql}, sr.id {ord_sql} LIMIT ? OFFSET ?""",
            params + [page_size, (page - 1) * page_size],
        ).fetchall()
        items = [
            {
                "id": r["id"],
                "source_id": r["source_id"],
                "source_key": r["source_key"],
                "source_name": r["source_name"],
                "trigger": r["trigger"],
                "status": r["status"],
                "started_at": r["started_at"],
                "finished_at": r["finished_at"],
                "items_fetched": r["items_fetched"],
                "items_new": r["items_new"],
                "items_updated": r["items_updated"],
                "items_skipped": r["items_skipped"],
                "error_code": r["error_code"],
                "error_message": r["error_message"],
                "duration_ms": r["duration_ms"],
            }
            for r in rows
        ]
        return {"items": items, "page": page, "page_size": page_size, "total": total, "has_next": page * page_size < total}
    finally:
        conn.close()


def get_run(run_id: int, db_path: str | Path | None = None):
    conn = connect(db_path)
    try:
        r = conn.execute(
            """SELECT sr.*, s.key as source_key, s.name as source_name FROM source_runs sr
               JOIN sources s ON s.id=sr.source_id WHERE sr.id=?""",
            (run_id,),
        ).fetchone()
        if not r:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Run not found"})
        meta = {}
        try:
            meta = json.loads(r["metadata_json"] or "{}")
        except Exception:
            pass
        return {
            "id": r["id"], "source_id": r["source_id"], "source_key": r["source_key"], "source_name": r["source_name"],
            "trigger": r["trigger"], "status": r["status"], "started_at": r["started_at"], "finished_at": r["finished_at"],
            "items_fetched": r["items_fetched"], "items_new": r["items_new"], "items_updated": r["items_updated"],
            "items_skipped": r["items_skipped"], "error_code": r["error_code"], "error_message": r["error_message"],
            "duration_ms": r["duration_ms"], "metadata": meta,
        }
    finally:
        conn.close()
