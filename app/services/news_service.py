from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.db.connection import connect
from app.utils.time import utc_now_iso
from app.utils.url import canonicalize_url, sha256_text, url_hash


def classify_news_importance(title: str, summary: str | None, category: str, source_weight: float = 0.5, published_at: str | None = None) -> tuple[float, str]:
    recency = 0.0
    if published_at:
        try:
            dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
            hours = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds() / 3600
            if hours <= 6: recency = 1.0
            elif hours <= 24: recency = 0.8
            elif hours <= 72: recency = 0.5
            elif hours <= 168: recency = 0.2
        except Exception:
            pass
    terms = ["release", "launch", "lanzamiento", "vulnerability", "cve", "breach", "acquisition", "funding", "open source", "model", "agent", "framework", "api", "deprecation", "security"]
    hay = f"{title} {summary or ''}".lower()
    hits = sum(1 for t in terms if t in hay)
    keyword_score = min(1.0, hits / 5.0)
    category_relevance = 0.5
    importance = 0.35 * source_weight + 0.35 * recency + 0.20 * keyword_score + 0.10 * category_relevance
    label = "high" if importance >= 0.75 else "medium" if importance >= 0.45 else "low"
    return round(importance, 4), label


def _news_from_row(r, conn) -> dict:
    saved = conn.execute("SELECT 1 FROM saved_items WHERE item_type='news' AND item_id=?", (r["id"],)).fetchone()
    src_rows = conn.execute(
        """SELECT s.id, s.key, s.name, nis.external_id, nis.first_seen_at
           FROM news_item_sources nis JOIN sources s ON s.id=nis.source_id WHERE nis.news_id=?""",
        (r["id"],),
    ).fetchall()
    sources = [dict(x) for x in src_rows]
    primary = sources[0] if sources else {"id": 0, "key": "unknown", "name": "Unknown"}
    link = conn.execute(
        "SELECT ok, status_code FROM link_checks WHERE entity_type='news' AND entity_id=? AND link_type='news_url' ORDER BY checked_at DESC LIMIT 1",
        (r["id"],),
    ).fetchone()
    link_status = "unverified"
    if link:
        link_status = "verified" if link["ok"] else ("broken" if link["status_code"] in (404, 410) else "unverified")
    return {
        "id": r["id"], "title": r["title"], "summary": r["summary"], "url": r["url"],
        "source": {"id": primary["id"], "key": primary["key"], "name": primary["name"]},
        "sources": sources, "author": r["author"], "published_at": r["published_at"], "fetched_at": r["fetched_at"],
        "category": r["category"], "importance_score": r["importance_score"], "importance_label": r["importance_label"],
        "tags": [], "link_status": link_status, "saved": bool(saved),
    }


def upsert_news_item(item: dict[str, Any], source_id: int, source_weight: float = 0.5, db_path: str | Path | None = None) -> tuple[int, bool]:
    url = item.get("url") or ""
    if not url:
        raise ValueError("news item missing url")
    can = canonicalize_url(url)
    uh = url_hash(can)
    now = utc_now_iso()
    title = (item.get("title") or "").strip() or "Untitled"
    summary = item.get("summary")
    category = item.get("category") or "other"
    if category not in {"ai", "data", "dev", "product", "security", "business", "other"}:
        category = "other"
    importance_score, importance_label = classify_news_importance(title, summary, category, source_weight, item.get("published_at"))
    content_hash = sha256_text(f"{title}\n{summary or ''}\n{can}")
    external_id = item.get("external_id") or uh
    conn = connect(db_path)
    try:
        existing = conn.execute("SELECT id FROM news_items WHERE url_hash=?", (uh,)).fetchone()
        if existing:
            nid = existing["id"]
            conn.execute(
                "UPDATE news_items SET title=?, summary=?, author=?, published_at=COALESCE(published_at,?), category=?, importance_score=?, importance_label=?, content_hash=? WHERE id=?",
                (title, summary, item.get("author"), item.get("published_at"), category, importance_score, importance_label, content_hash, nid),
            )
            is_new = False
        else:
            cur = conn.execute(
                """INSERT INTO news_items(title,summary,url,url_hash,author,published_at,fetched_at,category,importance_score,importance_label,content_hash,raw_json)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (title, summary, can, uh, item.get("author"), item.get("published_at"), now, category, importance_score, importance_label, content_hash, json.dumps(item.get("raw") or {})),
            )
            nid = cur.lastrowid
            is_new = True
        conn.execute(
            """INSERT INTO news_item_sources(news_id,source_id,external_id,first_seen_at) VALUES (?,?,?,?)
               ON CONFLICT(news_id,source_id) DO UPDATE SET external_id=excluded.external_id""",
            (nid, source_id, external_id, now),
        )
        conn.commit()
        return nid, is_new
    finally:
        conn.close()


def list_news(page=1, page_size=20, q=None, period="7d", category=None, importance=None, source_id=None, saved=None, sort="published", order="desc", db_path=None):
    page = max(1, page); page_size = min(100, max(1, page_size))
    where = ["1=1"]; params: list[Any] = []
    if q:
        like = f"%{q[:200]}%"; where.append("(n.title LIKE ? OR n.summary LIKE ?)"); params.extend([like, like])
    if period and period != "all":
        days = {"today": 1, "7d": 7, "30d": 30}.get(period, 7)
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        where.append("COALESCE(n.published_at, n.fetched_at) >= ?"); params.append(since)
    if category:
        cats = [x.strip() for x in category.split(",") if x.strip()]
        if cats: where.append(f"n.category IN ({','.join(['?']*len(cats))})"); params.extend(cats)
    if importance:
        imps = [x.strip() for x in importance.split(",") if x.strip()]
        if imps: where.append(f"n.importance_label IN ({','.join(['?']*len(imps))})"); params.extend(imps)
    if source_id is not None:
        where.append("EXISTS (SELECT 1 FROM news_item_sources nis WHERE nis.news_id=n.id AND nis.source_id=?)"); params.append(source_id)
    if saved is True:
        where.append("EXISTS (SELECT 1 FROM saved_items si WHERE si.item_type='news' AND si.item_id=n.id)")
    elif saved is False:
        where.append("NOT EXISTS (SELECT 1 FROM saved_items si WHERE si.item_type='news' AND si.item_id=n.id)")
    sort_map = {"published": "COALESCE(n.published_at,n.fetched_at)", "importance": "n.importance_score", "fetched": "n.fetched_at"}
    scol = sort_map.get(sort, "COALESCE(n.published_at,n.fetched_at)")
    ord_sql = "ASC" if str(order).lower() == "asc" else "DESC"
    wh = " AND ".join(where)
    conn = connect(db_path)
    try:
        total = conn.execute(f"SELECT COUNT(*) c FROM news_items n WHERE {wh}", params).fetchone()["c"]
        rows = conn.execute(f"SELECT n.* FROM news_items n WHERE {wh} ORDER BY {scol} {ord_sql} LIMIT ? OFFSET ?", params + [page_size, (page-1)*page_size]).fetchall()
        return {"items": [_news_from_row(r, conn) for r in rows], "page": page, "page_size": page_size, "total": total, "has_next": page * page_size < total}
    finally:
        conn.close()


def get_news(news_id: int, db_path=None):
    conn = connect(db_path)
    try:
        r = conn.execute("SELECT * FROM news_items WHERE id=?", (news_id,)).fetchone()
        if not r:
            raise HTTPException(status_code=404, detail={"code": "NEWS_NOT_FOUND", "message": "News item not found"})
        return _news_from_row(r, conn)
    finally:
        conn.close()
