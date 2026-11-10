from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

RepoCategory = Literal["ai", "data_engineering", "machine_learning", "data_science", "dev_tools", "web", "other"]
RepoUserStatus = Literal["untracked", "pending", "tried", "archived"]
NewsCategory = Literal["ai", "data", "dev", "product", "security", "business", "other"]
Importance = Literal["low", "medium", "high"]
Difficulty = Literal["beginner", "intermediate", "advanced"]
IdeaStatus = Literal["pending", "in_progress", "completed"]
PortfolioValue = Literal["learning", "portfolio", "internship", "commercial"]
WorkerState = Literal["online", "stale", "offline"]


class ScoreSet(BaseModel):
    popularity: float
    growth: float | None
    activity: float
    maintenance: float
    relevance: float
    interest: float
    quality: float


class StarGrowth(BaseModel):
    window: Literal["1d", "7d", "30d"]
    delta: int | None
    per_day: float | None
    from_at: str | None
    to_at: str | None


class RepositorySummary(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: int
    github_id: int
    full_name: str
    owner_login: str
    name: str
    description: str | null
    html_url: str
    homepage_url: str | None
    docs_url: str | None
    language: str | None
    license_spdx: str | None
    stars: int
    forks: int
    open_issues: int
    created_at: str
    updated_at: str
    pushed_at: str | None
    category: str
    subcategory: str | None
    tags: list[str]
    scores: ScoreSet
    star_growth: StarGrowth
    first_seen_at: str
    last_seen_at: str
    saved: bool
    user_status: RepoUserStatus


class LinkCheck(BaseModel):
    link_type: Literal["html_url", "homepage_url", "docs_url"]
    url: str
    ok: bool
    status_code: int | None
    checked_at: str
    error: str | None


class IdeaRef(BaseModel):
    id: int
    title: str
    difficulty: Difficulty
    category: str
    status: IdeaStatus


class RepositoryDetail(RepositorySummary):
    owner_type: Literal["User", "Organization"] | None = None
    license_name: str | None = None
    topics: list[str] = Field(default_factory=list)
    readme_excerpt: str | None = None
    archived: bool = False
    disabled: bool = False
    is_fork: bool = False
    default_branch: str | None = None
    watchers: int | None = None
    last_synced_at: str | None = None
    score_explanation: dict[str, Any] = Field(default_factory=dict)
    link_checks: list[LinkCheck] = Field(default_factory=list)
    related_ideas: list[IdeaRef] = Field(default_factory=list)
    similar_repositories: list[RepositorySummary] = Field(default_factory=list)


class NewsSourceRef(BaseModel):
    id: int
    key: str
    name: str


class NewsItem(BaseModel):
    id: int
    title: str
    summary: str | null
    url: str
    source: NewsSourceRef
    sources: list[dict[str, Any]] = Field(default_factory=list)
    author: str | None
    published_at: str | None
    fetched_at: str
    category: NewsCategory
    importance_score: float
    importance_label: Importance
    tags: list[str] = Field(default_factory=list)
    link_status: Literal["verified", "unverified", "broken"] = "unverified"
    saved: bool = False


class RepositoryRef(BaseModel):
    id: int
    full_name: str
    html_url: str
    role: Literal["data_source", "processing", "ai", "visualization", "inspiration", "tooling"]


class Idea(BaseModel):
    id: int
    title: str
    summary: str
    problem: str
    how_it_works: str
    technologies: list[str]
    difficulty: Difficulty
    category: str
    expansion: str | None
    portfolio_value: PortfolioValue
    status: IdeaStatus
    favorite: bool
    generated_by: Literal["rules", "llm", "manual"]
    repositories: list[RepositoryRef] = Field(default_factory=list)
    created_at: str
    updated_at: str


class Source(BaseModel):
    id: int
    key: str
    name: str
    kind: Literal["github_api", "rss", "agent_reach", "web", "internal"]
    category: Literal["github", "ai", "data_engineering", "news", "tools", "other"]
    enabled: bool
    interval_minutes: int
    config: dict[str, Any]
    rate_limit_per_hour: int | None
    last_run_at: str | null
    last_success_at: str | null
    last_error: str | null
    next_run_at: str | null


class SourceRun(BaseModel):
    id: int
    source_id: int
    source_key: str
    source_name: str
    trigger: Literal["schedule", "manual", "retry", "startup"]
    status: Literal["queued", "running", "success", "partial", "failed", "skipped"]
    started_at: str | null
    finished_at: str | null
    items_fetched: int
    items_new: int
    items_updated: int
    items_skipped: int
    error_code: str | None
    error_message: str | None
    duration_ms: int | None


class JobRequest(BaseModel):
    id: int
    source_id: int | None
    source_key: str | null
    status: Literal["pending", "claimed", "done", "failed", "cancelled"]
    requested_at: str
    claimed_at: str | None
    finished_at: str | null
    error_message: str | null


class WorkerStatus(BaseModel):
    state: WorkerState
    worker_id: str | None
    heartbeat_at: str | None
    current_job: str | None
    version: str | None
    stale_after_seconds: int
