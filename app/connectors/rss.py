from __future__ import annotations

import json
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

import feedparser
import httpx

from app.config import RSS_MAX_ITEMS_PER_FEED, RSS_TIMEOUT_SECONDS, RSS_USER_AGENT
from app.db.connection import connect
from app.services.news_service import upsert_news_item
from app.utils.time import to_iso, utc_now_iso


def _parse_date(entry) -> str | None:
    for key in ("published", "updated", "created"):
        val = entry.get(key)
        if not val:
            continue
        try:
            return to_iso(parsedate_to_datetime(val))
        except Exception:
            pass
        try:
            # try ISO-ish
            dt = datetime.fromisoformat(str(val).replace("Z", "+00:00"))
            return to_iso(dt)
        except Exception:
            pass
    for key in ("published_parsed", "updated_parsed"):
        t = entry.get(key)
        if t:
            try:
                return to_iso(datetime(*t[:6], tzinfo=timezone.utc))
            except Exception:
                pass
    return None


def run_rss_source(source: dict, db_path: str | Path | None = None, client: httpx.Client | None = None) -> dict[str, Any]:
    cfg = source.get("config") or {}
    feed_url = cfg.get("feed_url")
    if not feed_url:
        return {"items_fetched": 0, "items_new": 0, "items_updated": 0, "items_skipped": 0, "not_modified": False}
    category = cfg.get("category") or "other"
    max_items = min(500, int(cfg.get("max_items") or RSS_MAX_ITEMS_PER_FEED))
    stats = {"items_fetched": 0, "items_new": 0, "items_updated": 0, "items_skipped": 0, "not_modified": False}
    conn = connect(db_path)
    own = client is None
    http = client or httpx.Client(timeout=RSS_TIMEOUT_SECONDS, follow_redirects=True, headers={"User-Agent": RSS_USER_AGENT})
    cache_key = f"rss:{feed_url}"
    try:
        cache = conn.execute("SELECT etag, last_modified FROM http_cache WHERE cache_key=?", (cache_key,)).fetchone()
        headers = {"User-Agent": RSS_USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*"}
        if cache and cache["etag"]:
            headers["If-None-Match"] = cache["etag"]
        if cache and cache["last_modified"]:
            headers["If-Modified-Since"] = cache["last_modified"]
        resp = http.get(feed_url, headers=headers)
        if resp.status_code == 304:
            stats["not_modified"] = True
            conn.execute("UPDATE http_cache SET fetched_at=? WHERE cache_key=?", (utc_now_iso(), cache_key))
            conn.commit()
            return stats
        if resp.status_code >= 400:
            raise RuntimeError(f"HTTP {resp.status_code}")
        # store conditional cache metadata
        conn.execute(
            """INSERT INTO http_cache(cache_key, etag, last_modified, status_code, payload_json, fetched_at, expires_at)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(cache_key) DO UPDATE SET etag=excluded.etag, last_modified=excluded.last_modified, status_code=excluded.status_code,
               fetched_at=excluded.fetched_at, expires_at=excluded.expires_at""",
            (cache_key, resp.headers.get("ETag"), resp.headers.get("Last-Modified"), resp.status_code, "{}", utc_now_iso(), utc_now_iso()),
        )
        parsed = feedparser.parse(resp.content)
        entries = (parsed.entries or [])[:max_items]
        stats["items_fetched"] = len(entries)
        for e in entries:
            try:
                link = e.get("link") or (e.get("links") or [{}])[0].get("href")
                if not link:
                    stats["items_skipped"] += 1; continue
                summary = e.get("summary") or e.get("description")
                item = {
                    "title": e.get("title"), "summary": summary, "url": link, "author": e.get("author"),
                    "published_at": _parse_date(e), "external_id": e.get("id") or e.get("guid") or link,
                    "category": category, "raw": {"feed": feed_url},
                }
                _nid, is_new = upsert_news_item(item, source["id"], source_weight=0.5, db_path=db_path)
                if is_new: stats["items_new"] += 1
                else: stats["items_updated"] += 1
            except Exception:
                stats["items_skipped"] += 1
        conn.commit()
    finally:
        if own:
            http.close()
        conn.close()
    return stats
