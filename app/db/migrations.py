from __future__ import annotations

import sqlite3
from pathlib import Path

from app.db.connection import connect
from app.utils.time import utc_now_iso

# Version 1: full schema aligned with data-model.md (v1 proposed) + pragmatic fields
MIGRATIONS: list[tuple[int, str]] = [
    (
        1,
        r"""
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('github_api', 'rss', 'agent_reach', 'web', 'internal')),
    category TEXT NOT NULL CHECK (category IN ('github', 'ai', 'data_engineering', 'news', 'tools', 'other')),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    interval_minutes INTEGER NOT NULL CHECK (interval_minutes BETWEEN 5 AND 10080),
    config_json TEXT NOT NULL DEFAULT '{}',
    rate_limit_per_hour INTEGER CHECK (rate_limit_per_hour IS NULL OR rate_limit_per_hour > 0),
    last_run_at TEXT,
    last_success_at TEXT,
    last_error TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sources_due ON sources (enabled, next_run_at);
CREATE INDEX IF NOT EXISTS idx_sources_kind ON sources (kind, enabled);

CREATE TABLE IF NOT EXISTS job_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'done', 'failed', 'cancelled')),
    claimed_at TEXT,
    finished_at TEXT,
    requested_by TEXT NOT NULL DEFAULT 'api',
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests (status, requested_at);
CREATE INDEX IF NOT EXISTS idx_job_requests_source ON job_requests (source_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS source_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    job_request_id INTEGER REFERENCES job_requests(id) ON DELETE SET NULL,
    trigger TEXT NOT NULL CHECK (trigger IN ('schedule', 'manual', 'retry', 'startup')),
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'success', 'partial', 'failed', 'skipped')),
    started_at TEXT,
    finished_at TEXT,
    items_fetched INTEGER NOT NULL DEFAULT 0 CHECK (items_fetched >= 0),
    items_new INTEGER NOT NULL DEFAULT 0 CHECK (items_new >= 0),
    items_updated INTEGER NOT NULL DEFAULT 0 CHECK (items_updated >= 0),
    items_skipped INTEGER NOT NULL DEFAULT 0 CHECK (items_skipped >= 0),
    error_code TEXT,
    error_message TEXT,
    duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
    metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_runs_source_started ON source_runs (source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status_started ON source_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    github_id INTEGER NOT NULL UNIQUE,
    full_name TEXT NOT NULL UNIQUE,
    owner_login TEXT NOT NULL,
    owner_type TEXT CHECK (owner_type IN ('User', 'Organization') OR owner_type IS NULL),
    name TEXT NOT NULL,
    description TEXT,
    html_url TEXT NOT NULL,
    homepage_url TEXT,
    docs_url TEXT,
    language TEXT,
    license_spdx TEXT,
    license_name TEXT,
    topics_json TEXT NOT NULL DEFAULT '[]',
    stars INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0),
    forks INTEGER NOT NULL DEFAULT 0 CHECK (forks >= 0),
    open_issues INTEGER NOT NULL DEFAULT 0 CHECK (open_issues >= 0),
    watchers INTEGER CHECK (watchers IS NULL OR watchers >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pushed_at TEXT,
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
    is_fork INTEGER NOT NULL DEFAULT 0 CHECK (is_fork IN (0, 1)),
    default_branch TEXT,
    readme_excerpt TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    subcategory TEXT,
    popularity_score REAL NOT NULL DEFAULT 0 CHECK (popularity_score BETWEEN 0 AND 1),
    growth_score REAL CHECK (growth_score IS NULL OR growth_score BETWEEN 0 AND 1),
    activity_score REAL NOT NULL DEFAULT 0 CHECK (activity_score BETWEEN 0 AND 1),
    maintenance_score REAL NOT NULL DEFAULT 0 CHECK (maintenance_score BETWEEN 0 AND 1),
    relevance_score REAL NOT NULL DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 1),
    interest_score REAL NOT NULL DEFAULT 0 CHECK (interest_score BETWEEN 0 AND 1),
    quality_score REAL NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 1),
    score_explanation_json TEXT NOT NULL DEFAULT '{}',
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_repos_interest ON repositories (interest_score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_stars ON repositories (stars DESC);
CREATE INDEX IF NOT EXISTS idx_repos_growth ON repositories (growth_score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_category ON repositories (category, interest_score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_language ON repositories (language, interest_score DESC);
CREATE INDEX IF NOT EXISTS idx_repos_first_seen ON repositories (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_repos_last_seen ON repositories (last_seen_at DESC);

CREATE TABLE IF NOT EXISTS repository_sources (
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (repository_id, source_id)
);
CREATE INDEX IF NOT EXISTS idx_repository_sources_source ON repository_sources (source_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS repository_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    captured_at TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK (stars >= 0),
    forks INTEGER NOT NULL CHECK (forks >= 0),
    open_issues INTEGER NOT NULL CHECK (open_issues >= 0),
    pushed_at TEXT,
    commits_recent INTEGER CHECK (commits_recent IS NULL OR commits_recent >= 0),
    UNIQUE (repository_id, captured_at)
);
CREATE INDEX IF NOT EXISTS idx_snapshots_repo_time ON repository_snapshots (repository_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS repository_embeddings (
    repository_id INTEGER PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    model_version TEXT,
    dimensions INTEGER NOT NULL CHECK (dimensions > 0),
    content_hash TEXT NOT NULL,
    vector BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_repository_embeddings_model ON repository_embeddings (model_name, updated_at DESC);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('technology', 'topic', 'category'))
);

CREATE TABLE IF NOT EXISTS repository_tags (
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (repository_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_repository_tags_tag ON repository_tags (tag_id, repository_id);

CREATE TABLE IF NOT EXISTS news_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL UNIQUE,
    author TEXT,
    published_at TEXT,
    fetched_at TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('ai', 'data', 'dev', 'product', 'security', 'business', 'other')),
    importance_score REAL NOT NULL DEFAULT 0 CHECK (importance_score BETWEEN 0 AND 1),
    importance_label TEXT NOT NULL DEFAULT 'low' CHECK (importance_label IN ('low', 'medium', 'high')),
    content_hash TEXT NOT NULL,
    raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_published ON news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_importance ON news_items (importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_items (category, published_at DESC);

CREATE TABLE IF NOT EXISTS news_item_sources (
    news_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    PRIMARY KEY (news_id, source_id),
    UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_news_sources_news ON news_item_sources (news_id);

CREATE TABLE IF NOT EXISTS news_tags (
    news_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_news_tags_tag ON news_tags (tag_id, news_id);

CREATE TABLE IF NOT EXISTS saved_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL CHECK (item_type IN ('repository', 'news', 'idea')),
    item_id INTEGER NOT NULL,
    saved_at TEXT NOT NULL,
    notes TEXT,
    UNIQUE (item_type, item_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_type ON saved_items (item_type, saved_at DESC);

CREATE TABLE IF NOT EXISTS repository_user_state (
    repository_id INTEGER PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'untracked' CHECK (status IN ('untracked', 'pending', 'tried', 'archived')),
    note TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    problem TEXT NOT NULL,
    how_it_works TEXT NOT NULL,
    technologies_json TEXT NOT NULL DEFAULT '[]',
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    category TEXT NOT NULL DEFAULT 'other',
    expansion TEXT,
    portfolio_value TEXT NOT NULL DEFAULT 'learning' CHECK (portfolio_value IN ('learning', 'portfolio', 'internship', 'commercial')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    generated_by TEXT NOT NULL DEFAULT 'rules' CHECK (generated_by IN ('rules', 'llm', 'manual')),
    generation_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON project_ideas (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_difficulty ON project_ideas (difficulty, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON project_ideas (category, updated_at DESC);

CREATE TABLE IF NOT EXISTS idea_repositories (
    idea_id INTEGER NOT NULL REFERENCES project_ideas(id) ON DELETE CASCADE,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('data_source', 'processing', 'ai', 'visualization', 'inspiration', 'tooling')),
    PRIMARY KEY (idea_id, repository_id, role)
);
CREATE INDEX IF NOT EXISTS idx_idea_repositories_repo ON idea_repositories (repository_id);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS worker_leases (
    lease_key TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('starting', 'idle', 'running', 'stopping')),
    current_job TEXT,
    started_at TEXT NOT NULL,
    heartbeat_at TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS http_cache (
    cache_key TEXT PRIMARY KEY,
    etag TEXT,
    last_modified TEXT,
    status_code INTEGER,
    payload_json TEXT,
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_http_cache_expiry ON http_cache (expires_at);

CREATE TABLE IF NOT EXISTS rate_limit_state (
    provider TEXT PRIMARY KEY,
    remaining INTEGER CHECK (remaining IS NULL OR remaining >= 0),
    limit_total INTEGER CHECK (limit_total IS NULL OR limit_total >= 0),
    reset_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS link_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('repository', 'news', 'idea')),
    entity_id INTEGER NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('html_url', 'homepage_url', 'docs_url', 'news_url')),
    url TEXT NOT NULL,
    status_code INTEGER,
    ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
    checked_at TEXT NOT NULL,
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_link_checks_entity ON link_checks (entity_type, entity_id, link_type, checked_at DESC);
        """,
    ),
]


def apply_migrations(db_path: str | Path | None = None) -> list[int]:
    conn = connect(db_path)
    applied: list[int] = []
    try:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
        )
        existing = {row[0] for row in conn.execute("SELECT version FROM schema_migrations").fetchall()}
        for version, sql in MIGRATIONS:
            if version in existing:
                continue
            conn.executescript(sql)
            conn.execute(
                "INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)",
                (version, utc_now_iso()),
            )
            applied.append(version)
        conn.commit()
        return applied
    finally:
        conn.close()
