from __future__ import annotations

import json
import os
import signal
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Ensure backend root on path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.config import API_VERSION, WORKER_HEARTBEAT_SECONDS, WORKER_POLL_SECONDS, WORKER_STALE_AFTER_SECONDS
from app.db.connection import connect
from app.db.migrations import apply_migrations
from app.db.seed import seed_defaults
from app.utils.time import utc_now_iso
from worker.jobs import execute_source

STOP = threading.Event()


def _handle_stop(*_a):
    STOP.set()


def heartbeat_loop(worker_id: str):
    while not STOP.is_set():
        try:
            conn = connect()
            conn.execute(
                """INSERT INTO worker_leases(lease_key, worker_id, status, current_job, started_at, heartbeat_at, version)
                   VALUES ('main', ?, 'idle', NULL, ?, ?, ?)
                   ON CONFLICT(lease_key) DO UPDATE SET worker_id=excluded.worker_id, heartbeat_at=excluded.heartbeat_at, version=excluded.version,
                   status=CASE WHEN status='running' THEN status ELSE 'idle' END""",
                (worker_id, utc_now_iso(), utc_now_iso(), API_VERSION),
            )
            conn.commit(); conn.close()
        except Exception:
            pass
        STOP.wait(WORKER_HEARTBEAT_SECONDS)


def process_job_requests(worker_id: str, pool: ThreadPoolExecutor):
    conn = connect()
    try:
        # claim one pending
        row = conn.execute("SELECT * FROM job_requests WHERE status='pending' ORDER BY requested_at ASC LIMIT 1").fetchone()
        if not row:
            return
        conn.execute("UPDATE job_requests SET status='claimed', claimed_at=? WHERE id=? AND status='pending'", (utc_now_iso(), row["id"]))
        conn.commit()
    finally:
        conn.close()
    def _run():
        c = connect()
        try:
            source_id = row["source_id"]
            if source_id is None:
                # run all enabled
                srcs = c.execute("SELECT * FROM sources WHERE enabled=1 AND kind!='internal'").fetchall()
            else:
                s = c.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
                srcs = [s] if s else []
            c.execute("UPDATE worker_leases SET status='running', current_job=? WHERE lease_key='main'", (f"job:{row['id']}",))
            c.commit()
            for s in srcs:
                src = dict(s)
                try: src["config"] = json.loads(src.get("config_json") or "{}")
                except Exception: src["config"] = {}
                execute_source(src, trigger="manual", job_request_id=row["id"])
            c.execute("UPDATE job_requests SET status='done', finished_at=? WHERE id=?", (utc_now_iso(), row["id"]))
            c.execute("UPDATE worker_leases SET status='idle', current_job=NULL WHERE lease_key='main'")
            c.commit()
        except Exception as e:
            c.execute("UPDATE job_requests SET status='failed', finished_at=?, error_message=? WHERE id=?", (utc_now_iso(), str(e)[:500], row["id"]))
            c.execute("UPDATE worker_leases SET status='idle', current_job=NULL WHERE lease_key='main'")
            c.commit()
        finally:
            c.close()
    pool.submit(_run)


def process_due_schedules(worker_id: str, pool: ThreadPoolExecutor):
    conn = connect()
    try:
        now = utc_now_iso()
        rows = conn.execute(
            """SELECT * FROM sources WHERE enabled=1
               AND kind IN ('rss','github_api')
               AND key NOT IN ('github_repo_details')
               AND (next_run_at IS NULL OR next_run_at <= ?)
               ORDER BY next_run_at ASC LIMIT 2""",
            (now,),
        ).fetchall()
        for r in rows:
            nxt = (datetime.now(timezone.utc) + timedelta(minutes=int(r["interval_minutes"]))).strftime("%Y-%m-%dT%H:%M:%SZ")
            conn.execute("UPDATE sources SET next_run_at=? WHERE id=? AND (next_run_at IS NULL OR next_run_at<=?)", (nxt, r["id"], now))
        conn.commit()
        srcs = [dict(r) for r in rows]
    finally:
        conn.close()
    for s in srcs:
        try: s["config"] = json.loads(s.get("config_json") or "{}")
        except Exception: s["config"] = {}
        pool.submit(execute_source, s, "schedule", None)


def main():
    signal.signal(signal.SIGINT, _handle_stop)
    try:
        signal.signal(signal.SIGTERM, _handle_stop)
    except Exception:
        pass
    apply_migrations()
    seed_defaults()
    worker_id = f"worker-{uuid.uuid4().hex[:8]}"
    print(f"[TechPulse Worker] starting {worker_id}")
    t = threading.Thread(target=heartbeat_loop, args=(worker_id,), daemon=True)
    t.start()
    with ThreadPoolExecutor(max_workers=2) as pool:
        while not STOP.is_set():
            try:
                process_job_requests(worker_id, pool)
                process_due_schedules(worker_id, pool)
            except Exception as e:
                print(f"[worker] loop error: {e}")
            STOP.wait(WORKER_POLL_SECONDS)
    print("[TechPulse Worker] stopped")


if __name__ == "__main__":
    main()
