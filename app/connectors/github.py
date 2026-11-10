from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import GITHUB_API_BASE, GITHUB_MAX_PAGES, GITHUB_MAX_QUERIES_PER_CYCLE, GITHUB_PER_PAGE, GITHUB_SEARCH_CACHE_MINUTES, GITHUB_TIMEOUT_SECONDS, GITHUB_TOKEN
from app.db.connection import connect
from app.services.repo_service import upsert_repository
from app.utils.time import utc_now_iso


def _subst_dates(q: str) -> str:
    today = datetime.now(timezone.utc).date()
    return q.replace("__DATE_30__", (today - timedelta(days=30)).isoformat()).replace("__DATE_7__", (today - timedelta(days=7)).isoformat())


def _headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "TechPulse/0.1", "X-GitHub-Api-Version": "2022-11-28"}
    if GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return h


def _save_rate_limit(conn, headers: httpx.Headers):
    try:
        remaining = headers.get("X-RateLimit-Remaining")
        limit = headers.get("X-RateLimit-Limit")
        reset = headers.get("X-RateLimit-Reset")
        reset_at = None
        if reset:
            reset_at = datetime.fromtimestamp(int(reset), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        conn.execute(
            """INSERT INTO rate_limit_state(provider, remaining, limit_total, reset_at, updated_at)
               VALUES ('github', ?, ?, ?, ?)
               ON CONFLICT(provider) DO UPDATE SET remaining=excluded.remaining, limit_total=excluded.limit_total, reset_at=excluded.reset_at, updated_at=excluded.updated_at""",
            (int(remaining) if remaining is not None else None, int(limit) if limit is not None else None, reset_at, utc_now_iso()),
        )
    except Exception:
        pass


def _cache_get(conn, key: str) -> dict | None:
    row = conn.execute("SELECT payload_json, expires_at, etag FROM http_cache WHERE cache_key=?", (key,)).fetchone()
    if not row:
        return None
    if row["expires_at"] <= utc_now_iso():
        return None
    try:
        return json.loads(row["payload_json"])
    except Exception:
        return None


def _cache_set(conn, key: str, payload: dict, headers: httpx.Headers, ttl_minutes: int):
    expires = (datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")
    conn.execute(
        """INSERT INTO http_cache(cache_key, etag, last_modified, status_code, payload_json, fetched_at, expires_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(cache_key) DO UPDATE SET etag=excluded.etag, last_modified=excluded.last_modified, status_code=excluded.status_code,
           payload_json=excluded.payload_json, fetched_at=excluded.fetched_at, expires_at=excluded.expires_at""",
        (key, headers.get("ETag"), headers.get("Last-Modified"), 200, json.dumps(payload), utc_now_iso(), expires),
    )


def run_github_search(source: dict, db_path: str | Path | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    cfg = source.get("config") or {}
    queries = list(cfg.get("queries") or [])
    if not queries:
        return {"items_fetched": 0, "items_new": 0, "items_updated": 0, "items_skipped": 0, "pages": 0, "cache_hits": 0, "queries_used": 0}
    rot = int(cfg.get("rotation_index") or 0) % max(1, len(queries))
    selected = [queries[(rot + i) % len(queries)] for i in range(min(GITHUB_MAX_QUERIES_PER_CYCLE, len(queries)))]
    new_rot = (rot + len(selected)) % len(queries)
    per_page = min(100, int(cfg.get("per_page") or GITHUB_PER_PAGE))
    max_pages = min(10, int(cfg.get("max_pages") or GITHUB_MAX_PAGES))
    stats = {"items_fetched": 0, "items_new": 0, "items_updated": 0, "items_skipped": 0, "pages": 0, "cache_hits": 0, "queries_used": len(selected)}
    conn = connect(db_path)
    own_client = client is None
    http = client or httpx.Client(timeout=GITHUB_TIMEOUT_SECONDS, headers=_headers(), follow_redirects=True)
    try:
        for qobj in selected:
            q = _subst_dates(qobj.get("q") or "")
            if not q:
                continue
            for page in range(1, max_pages + 1):
                cache_key = f"gh_search:{q}|{page}|{per_page}"
                cached = _cache_get(conn, cache_key)
                if cached is not None:
                    stats["cache_hits"] += 1
                    payload = cached
                else:
                    # rate limit guard
                    rl = conn.execute("SELECT remaining FROM rate_limit_state WHERE provider='github'").fetchone()
                    if rl and rl["remaining"] is not None and rl["remaining"] < 2 and not GITHUB_TOKEN:
                        stats["items_skipped"] += 1
                        break
                    resp = http.get(f"{GITHUB_API_BASE}/search/repositories", params={"q": q, "per_page": per_page, "page": page, "sort": "stars", "order": "desc"}, headers=_headers())
                    _save_rate_limit(conn, resp.headers)
                    conn.commit()
                    if resp.status_code == 304:
                        stats["cache_hits"] += 1
                        continue
                    if resp.status_code in (403, 429):
                        stats["items_skipped"] += 1
                        break
                    if resp.status_code >= 400:
                        stats["items_skipped"] += 1
                        break
                    payload = resp.json()
                    _cache_set(conn, cache_key, payload, resp.headers, GITHUB_SEARCH_CACHE_MINUTES)
                    conn.commit()
                stats["pages"] += 1
                items = payload.get("items") or []
                stats["items_fetched"] += len(items)
                for gh in items:
                    try:
                        _rid, is_new = upsert_repository(gh, source["id"], db_path)
                        if is_new: stats["items_new"] += 1
                        else: stats["items_updated"] += 1
                    except Exception:
                        stats["items_skipped"] += 1
                if len(items) < per_page:
                    break
        # persist rotation
        cfg["rotation_index"] = new_rot
        conn.execute("UPDATE sources SET config_json=?, updated_at=? WHERE id=?", (json.dumps(cfg), utc_now_iso(), source["id"]))
        conn.commit()
    finally:
        if own_client:
            http.close()
        conn.close()
    return stats
