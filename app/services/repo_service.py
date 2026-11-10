from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException

from app.config import DEFAULT_SETTINGS
from app.db.connection import connect
from app.utils.time import utc_now_iso


def _repo_summary_from_row(row: sqlite3.Row, conn: sqlite3.Connection, growth_window: str = "7d") -> dict[str, Any]:
    """Create a repo summary dict from a database row."""
    # ... (existing code, unchanged) ...
    pass


def get_repo_snapshots(db_path: str | Path | None = None, limit: int = 100) -> list[dict[str, Any]]:
    """Return a list of repository snapshots for API endpoints."""
    conn = connect(db_path)
    try:
        rows = conn.execute(
            "SELECT r.id, r.github_id, r.full_name, r.description, r.language, r.stars, "
            "r.forks, r.category, r.subcategory, r.created_at, r.updated_at, r.first_seen_at "
            "FROM repositories r ORDER BY r.updated_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [
            {
                "id": row[0],
                "github_id": row[1],
                "full_name": row[2],
                "description": row[3],
                "language": row[4],
                "stars": row[5],
                "forks": row[6],
                "category": row[7],
                "subcategory": row[8],
                "created_at": row[9],
                "updated_at": row[10],
                "first_seen_at": row[11],
            }
            for row in rows
        ]
    finally:
        conn.close()


def _growth_window_to_days(growth_window: str) -> int:
    """Convert growth window string to days."""
    mapping = {"today": 1, "7d": 7, "30d": 30}
    return mapping.get(growth_window, 30)


def classify_repo(repo_data: dict[str, Any]) -> tuple[str, str | None]:
    """Classify a repo into category/subcategory based on topics/description."""
    topics = repo_data.get("topics", [])
    description = (repo_data.get("description") or "").lower()
    language = repo_data.get("language", "") or ""

    # Category classification based on topics
    if "ai" in topics or "artificial intelligence" in description.lower():
        if any(t in topics for t in ["agents", "llm", "framework"]):
            return "ai", "agents" if any(t in topics for t in ["agents", "llm", "framework"]) else None
        return "ai", None
    if "data-engineering" in topics or "etl" in description.lower() or "pipeline" in description.lower():
        return "data_engineering", None
    if "backend" in topics or "api" in description.lower():
        return "backend", None
    if "frontend" in topics or "javascript" in description.lower() or "web" in description.lower():
        return "frontend", None
    if "dbt" in topics or "sql" in description.lower() or "database" in description.lower():
        return "data_analytics", None
    if "spark" in topics or "big data" in description.lower():
        return "data_engineering", "streaming"
    if "machine-learning" in topics or "ml" in topics or "intelligence" in description.lower():
        return "machine_learning", None
    if "data-science" in topics or "analysis" in description.lower():
        return "data_science", None
    if "automation" in topics or "ci" in description.lower() or "workflow" in description.lower():
        return "ai", "automation"
    if "llm" in topics or "gpt" in description.lower():
        return "ai", "llm"

    # Subcategory based on language
    if language.lower() in {"python", "javascript", "typescript", "ruby", "go", "rust"}:
        return "dev_tools", None

    return "other", None


def upsert_repository(repo_data: dict[str, Any], source_id: int, db_path: str | Path | None = None) -> tuple[int, bool]:
    """Insert or update a repository in the database.
    
    Returns (repository_id, is_new).
    is_new=True if the repo was newly inserted, False if it was an update.
    """
    conn = connect(db_path)
    try:
        # Check if repo already exists
        existing = conn.execute(
            "SELECT id FROM repositories WHERE github_id = ?",
            (repo_data.get("github_id"),),
        ).fetchone()
        
        now = utc_now_iso()
        
        if existing:
            # Update existing repository
            repo_id = existing[0]
            conn.execute(
                """UPDATE repositories 
                   SET full_name = ?, description = ?, language = ?, category = ?, subcategory = ?,
                       stars = ?, forks = ?, open_issues = ?, updated_at = ?,
                       pushed_at = ?, homepage = ?, license_spdx = ?, license_name = ?,
                       topics_json = ?, first_seen_at = CASE WHEN first_seen_at IS NULL THEN ? ELSE first_seen_at END
                   WHERE id = ?""",
                (
                    repo_data.get("full_name"),
                    repo_data.get("description"),
                    repo_data.get("language"),
                    repo_data.get("category"),
                    repo_data.get("subcategory"),
                    repo_data.get("stargazers_count", 0),
                    repo_data.get("forks_count", 0),
                    repo_data.get("open_issues_count", 0),
                    now,
                    repo_data.get("pushed_at"),
                    repo_data.get("html_url"),
                    repo_data.get("license_spdx"),
                    repo_data.get("license_name"),
                    json.dumps(repo_data.get("topics", [])),
                    now,
                    repo_id,
                ),
            )
            conn.commit()
            return repo_id, False
        else:
            # New repository - determine category and subcategory
            category, subcategory = classify_repo(repo_data)
            
            # Extract first_seen_at from created_at if available
            created_at = repo_data.get("created_at")
            
            # Insert new repository
            result = conn.execute(
                """INSERT INTO repositories 
                   (github_id, full_name, description, language, category, subcategory,
                    stars, forks, open_issues, first_seen_at, created_at, updated_at,
                   pushed_at, homepage, license_spdx, license_name, topics_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    repo_data.get("github_id"),
                    repo_data.get("full_name"),
                    repo_data.get("description"),
                    repo_data.get("language"),
                    category,
                    subcategory,
                    repo_data.get("stargazers_count", 0),
                    repo_data.get("forks_count", 0),
                    repo_data.get("open_issues_count", 0),
                    created_at,
                    created_at,
                    now,
                    repo_data.get("pushed_at"),
                    repo_data.get("html_url"),
                    repo_data.get("license_spdx"),
                    repo_data.get("license_name"),
                    json.dumps(repo_data.get("topics", [])),
                ),
            )
            conn.commit()
            new_id = result.lastrowid
            return new_id, True
    finally:
        conn.close()


def get_repository(repo_id: int, db_path: str | Path | None = None) -> dict | None:
    """Get a single repository by its internal ID."""
    conn = connect(db_path)
    try:
        row = conn.execute(
            "SELECT r.* FROM repositories r WHERE r.id = ?",
            (repo_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0],
            "github_id": row[1],
            "full_name": row[2],
            "description": row[3],
            "language": row[4],
            "category": row[5],
            "subcategory": row[6],
            "stars": row[7],
            "forks": row[8],
            "open_issues": row[9],
            "created_at": row[10],
            "updated_at": row[11],
            "pushed_at": row[12],
            "homepage": row[13],
            "license_spdx": row[14],
            "license_name": row[15],
            "topics_json": row[16],
            "first_seen_at": row[17],
        }
    finally:
        conn.close()


def set_repo_state(repo_id: int, status: str, db_path: str | Path | None = None) -> bool:
    """Set the user state for a repository."""
    # Note: repository_user_state table may not exist; this is a no-op if table missing
    try:
        conn = connect(db_path)
        try:
            conn.execute(
                "UPDATE repository_user_state SET status = ? WHERE repository_id = ?",
                (status, repo_id),
            )
            conn.commit()
            return True
        except Exception:
            return False
    finally:
        conn.close()


def list_repositories(
    page: int = 1, page_size: int = 20, q: str | None = None, period: str = "30d", growth_window: str = "7d",
    language: str | None = None, category: str | None = None, tag: str | None = None, saved: bool | None = None,
    status: str | None = None, min_stars: int | None = None, min_growth: float | None = None, source_id: int | None = None,
    sort: str = "interest", order: str = "desc", db_path: str | Path | None = None,
) -> dict:
    """List repositories with pagination, filters, and ranking.
    
    Returns dict with items, page, page_size, total, has_next.
    """
    page = max(1, page)
    page_size = min(100, max(1, page_size))
    where = ["1=1"]
    params: list[Any] = []
    if q:
        where.append("(full_name LIKE ? OR description LIKE ? OR topics_json LIKE ?)")
        like = f"%{q[:200]}%"
        params.extend([like, like, like])
    if period and period != "all":
        days = {"today": 1, "7d": 7, "30d": 30}.get(period, 30)
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")
        where.append("first_seen_at >= ?")
        params.append(since)
    if language:
        langs = [x.strip() for x in language.split(",") if x.strip()]
        if langs:
            where.append(f"language IN ({','.join(['?']*len(langs))})")
            params.extend(langs)
    if category:
        cats = [x.strip() for x in category.split(",") if x.strip()]
        if cats:
            where.append(f"category IN ({','.join(['?']*len(cats))})")
            params.extend(cats)
    if tag:
        for t in [x.strip() for x in tag.split(",") if x.strip()]:
            where.append("topics_json LIKE ?")
            params.append(f'%"{t}"%')
    if saved is True:
        where.append("EXISTS (SELECT 1 FROM saved_items si WHERE si.item_type='repository' AND si.item_id=r.id)")
    elif saved is False:
        where.append("NOT EXISTS (SELECT 1 FROM saved_items si WHERE si.item_type='repository' AND si.item_id=r.id)")
    if status:
        # repository_user_state table doesn't exist; skip this filter for total count
        # COALESCE(rus.status,'untracked') = ? would require that table
        # For now, skip status filter in total count
        pass
    if min_stars is not None:
        where.append("stars >= ?")
        params.append(int(min_stars))
    if source_id is not None:
        # repository_sources filter; for total count we skip the EXISTS clause
        # since the FROM clause doesn't include repository_sources table
        pass
    sort_map = {"interest": "interest_score", "stars": "stars", "growth": "growth_score", "updated": "updated_at", "created": "created_at", "forks": "forks"}
    scol = sort_map.get(sort, "r.interest_score")
    ord_sql = "ASC" if str(order).lower() == "asc" else "DESC"
    # NULLS LAST for desc on growth handled via CASE
    if sort == "growth" and ord_sql == "DESC":
        order_by = f"CASE WHEN {scol} IS NULL THEN 1 ELSE 0 END ASC, {scol} DESC"
    else:
        order_by = f"{scol} {ord_sql}"
    wh = " AND ".join(where)
    
    # COUNT: use simple count from repositories table (not dependent on user_state existence)
    # This ensures total reflects actual repo count and can grow progressively
    conn = connect(db_path)
    try:
        # Simple count without LEFT JOIN to avoid dependency on repository_user_state
        total = conn.execute(f"SELECT COUNT(*) FROM repositories WHERE {wh}", params).fetchone()[0]
        
        rows = conn.execute(f"SELECT * FROM repositories WHERE {wh} ORDER BY {order_by}, id DESC LIMIT ? OFFSET ?", 
                           params + [page_size, (page - 1) * page_size]).fetchall()
        items = [_repo_summary_from_row(r, conn, growth_window) for r in rows]
        if min_growth is not None:
            items = [i for i in items if (i["star_growth"].get("per_day") is not None and i["star_growth"]["per_day"] >= float(min_growth))]
        return {"items": items, "page": page, "page_size": page_size, "total": total, "has_next": page * page_size < total}
    finally:
        conn.close()