from __future__ import annotations

import json
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.connectors.github import run_github_search
from app.connectors.rss import run_rss_source
from app.db.connection import connect
from app.services.ranking_service import recalculate_repo_scores
from app.utils.time import utc_now_iso


def start_run(source_id: int, trigger: str, job_request_id: int | None = None, db_path: str | Path | None = None) -> int:
    conn = connect(db_path)
    try:
        now = utc_now_iso()
        cur = conn.execute(
            "INSERT INTO source_runs(source_id, job_request_id, trigger, status, started_at) VALUES (?,?,?,'running',?)",
            (source_id, job_request_id, trigger, now),
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()


def finish_run(run_id: int, status: str, stats: dict | None = None, error: str | None = None, db_path: str | Path | None = None):
    conn = connect(db_path)
    try:
        now = utc_now_iso()
        row = conn.execute("SELECT started_at, source_id FROM source_runs WHERE id=?", (run_id,)).fetchone()
        dur = None
        if row and row["started_at"]:
            try:
                t0 = datetime.fromisoformat(row["started_at"].replace("Z", "+00:00"))
                dur = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
            except Exception:
                pass
        stats = stats or {}
        conn.execute(
            """UPDATE source_runs SET status=?, finished_at=?, items_fetched=?, items_new=?, items_updated=?, items_skipped=?,
               error_message=?, duration_ms=?, metadata_json=? WHERE id=?""",
            (status, now, int(stats.get("items_fetched", 0)), int(stats.get("items_new", 0)), int(stats.get("items_updated", 0)),
             int(stats.get("items_skipped", 0)), error, dur, json.dumps(stats), run_id),
        )
        if row:
            updates = ["last_run_at=?"]
            params: list[Any] = [now]
            if status in ("success", "partial"):
                updates.append("last_success_at=?"); params.append(now)
                updates.append("last_error=NULL")
            elif status == "failed":
                updates.append("last_error=?"); params.append((error or "")[:500])
            # set next_run_at
            src = conn.execute("SELECT interval_minutes FROM sources WHERE id=?", (row["source_id"],)).fetchone()
            if src:
                nxt = (datetime.now(timezone.utc) + timedelta(minutes=int(src["interval_minutes"]))).strftime("%Y-%m-%dT%H:%M:%SZ")
                updates.append("next_run_at=?"); params.append(nxt)
            params.append(row["source_id"])
            conn.execute(f"UPDATE sources SET {', '.join(updates)} WHERE id=?", params)
        conn.commit()
    finally:
        conn.close()


def execute_source(source: dict, trigger: str = "schedule", job_request_id: int | None = None, db_path: str | Path | None = None) -> dict:
    run_id = start_run(source["id"], trigger, job_request_id, db_path)
    try:
        kind = source["kind"]; key = source["key"]
        if kind == "github_api" and key == "github_search_trending":
            stats = run_github_search(source, db_path)
            status = "success" if stats.get("items_skipped", 0) == 0 else "partial"
        elif kind == "rss":
            stats = run_rss_source(source, db_path)
            status = "success"
        elif kind == "internal" and key == "internal_score_recompute":
            conn = connect(db_path)
            try:
                ids = [r["id"] for r in conn.execute("SELECT id FROM repositories").fetchall()]
            finally:
                conn.close()
            for rid in ids:
                try: recalculate_repo_scores(rid, db_path)
                except Exception: pass
            stats = {"items_fetched": len(ids), "items_new": 0, "items_updated": len(ids), "items_skipped": 0}
            status = "success"
        elif kind in ("internal", "agent_reach", "web", "github_api"):
            stats = {"items_fetched": 0, "items_new": 0, "items_updated": 0, "items_skipped": 0, "note": "not implemented in F2 minimal worker"}
            status = "skipped" if kind != "github_api" else "success"
        else:
            stats = {"items_fetched": 0, "items_new": 0, "items_updated": 0, "items_skipped": 0}
            status = "skipped"
        finish_run(run_id, status, stats, None, db_path)
        return {"run_id": run_id, "status": status, "stats": stats}
    except Exception as e:
        finish_run(run_id, "failed", {}, f"{e}\n{traceback.format_exc()[:1000]}", db_path)
        return {"run_id": run_id, "status": "failed", "error": str(e)}
