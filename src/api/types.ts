/**
 * TechPulse API types — mirrors docs/api-contract.md (v1).
 * Do not add fields that are not in the contract.
 */

export type IsoDate = string;
export type Period = "today" | "7d" | "30d" | "all";
export type GrowthWindow = "1d" | "7d" | "30d";

export type RepoCategory =
  | "ai"
  | "data_engineering"
  | "machine_learning"
  | "data_science"
  | "dev_tools"
  | "web"
  | "other";

export type RepoUserStatus = "untracked" | "pending" | "tried" | "archived";

export type NewsCategory =
  | "ai"
  | "data"
  | "dev"
  | "product"
  | "security"
  | "business"
  | "other";

export type Importance = "low" | "medium" | "high";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type IdeaStatus = "pending" | "in_progress" | "completed";
export type PortfolioValue = "learning" | "portfolio" | "internship" | "commercial";
export type SavedItemType = "repository" | "news" | "idea";
export type WorkerState = "online" | "stale" | "offline";
export type SimilarMode = "metadata" | "semantic" | "hybrid";
export type SearchMode = "keyword" | "semantic" | "hybrid";
export type EmbeddingState = "online" | "loading" | "not_downloaded" | "offline" | "error";

export interface ScoreSet {
  popularity: number;
  growth: number | null;
  activity: number;
  maintenance: number;
  relevance: number;
  interest: number;
  quality: number;
}

export interface StarGrowth {
  window: GrowthWindow;
  delta: number | null;
  per_day: number | null;
  from_at: IsoDate | null;
  to_at: IsoDate | null;
}

export interface RepositorySummary {
  id: number;
  github_id: number;
  full_name: string;
  owner_login: string;
  name: string;
  description: string | null;
  html_url: string;
  homepage_url: string | null;
  docs_url: string | null;
  language: string | null;
  license_spdx: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  created_at: IsoDate;
  updated_at: IsoDate;
  pushed_at: IsoDate | null;
  category: RepoCategory;
  subcategory: string | null;
  tags: string[];
  scores: ScoreSet;
  star_growth: StarGrowth;
  first_seen_at: IsoDate;
  last_seen_at: IsoDate;
  saved: boolean;
  user_status: RepoUserStatus;
}

export interface RepositoryMatch extends RepositorySummary {
  match: {
    mode: SimilarMode | SearchMode;
    similarity: number | null;
    score: number;
  };
}

export interface LinkCheck {
  link_type: "html_url" | "homepage_url" | "docs_url";
  url: string;
  ok: boolean;
  status_code: number | null;
  checked_at: IsoDate;
  error: string | null;
}

export interface IdeaRef {
  id: number;
  title: string;
  difficulty: Difficulty;
  category: string;
  status: IdeaStatus;
}

export interface RepositoryDetail extends RepositorySummary {
  owner_type: "User" | "Organization" | null;
  license_name: string | null;
  topics: string[];
  readme_excerpt: string | null;
  archived: boolean;
  disabled: boolean;
  is_fork: boolean;
  default_branch: string | null;
  watchers: number | null;
  last_synced_at: IsoDate | null;
  score_explanation: Record<string, unknown>;
  link_checks: LinkCheck[];
  related_ideas: IdeaRef[];
  similar_repositories: RepositorySummary[];
}

export interface NewsSourceRef {
  id: number;
  key: string;
  name: string;
}

export interface NewsItem {
  id: number;
  title: string;
  summary: string | null;
  url: string;
  source: NewsSourceRef;
  sources: Array<NewsSourceRef & { external_id: string; first_seen_at: IsoDate }>;
  author: string | null;
  published_at: IsoDate | null;
  fetched_at: IsoDate;
  category: NewsCategory;
  importance_score: number;
  importance_label: Importance;
  tags: string[];
  link_status: "verified" | "unverified" | "broken";
  saved: boolean;
}

export interface RepositoryRef {
  id: number;
  full_name: string;
  html_url: string;
  role: "data_source" | "processing" | "ai" | "visualization" | "inspiration" | "tooling";
}

export interface Idea {
  id: number;
  title: string;
  summary: string;
  problem: string;
  how_it_works: string;
  technologies: string[];
  difficulty: Difficulty;
  category: string;
  expansion: string | null;
  portfolio_value: PortfolioValue;
  status: IdeaStatus;
  favorite: boolean;
  generated_by: "rules" | "llm" | "manual";
  repositories: RepositoryRef[];
  created_at: IsoDate;
  updated_at: IsoDate;
}

export interface Source {
  id: number;
  key: string;
  name: string;
  kind: "github_api" | "rss" | "agent_reach" | "web" | "internal";
  category: "github" | "ai" | "data_engineering" | "news" | "tools" | "other";
  enabled: boolean;
  interval_minutes: number;
  config: Record<string, unknown>;
  rate_limit_per_hour: number | null;
  last_run_at: IsoDate | null;
  last_success_at: IsoDate | null;
  last_error: string | null;
  next_run_at: IsoDate | null;
}

export interface SourceRun {
  id: number;
  source_id: number;
  source_key: string;
  source_name: string;
  trigger: "schedule" | "manual" | "retry" | "startup";
  status: "queued" | "running" | "success" | "partial" | "failed" | "skipped";
  started_at: IsoDate | null;
  finished_at: IsoDate | null;
  items_fetched: number;
  items_new: number;
  items_updated: number;
  items_skipped: number;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

export interface JobRequest {
  id: number;
  source_id: number | null;
  source_key: string | null;
  status: "pending" | "claimed" | "done" | "failed" | "cancelled";
  requested_at: IsoDate;
  claimed_at: IsoDate | null;
  finished_at: IsoDate | null;
  error_message: string | null;
}

export interface WorkerStatus {
  state: WorkerState;
  worker_id: string | null;
  heartbeat_at: IsoDate | null;
  current_job: string | null;
  version: string | null;
  stale_after_seconds: number;
}

export interface EmbeddingStatus {
  enabled: boolean;
  sidecar: {
    state: EmbeddingState;
    url: string;
    model: string | null;
    dimensions: number | null;
    device: "cpu" | "cuda" | null;
    version: string | null;
    last_checked_at: IsoDate | null;
  };
  model: {
    name: string;
    downloaded: boolean;
    download_required: boolean;
  };
  index: {
    indexed: number;
    pending: number;
    last_indexed_at: IsoDate | null;
    active_model: string | null;
  };
}

export interface Overview {
  generated_at: IsoDate;
  last_success_at: IsoDate | null;
  counts: {
    repositories: number;
    news: number;
    ideas: number;
    saved: number;
    sources: number;
  };
  featured_repositories: RepositorySummary[];
  top_news: NewsItem[];
  ai_trends: RepositorySummary[];
  new_tools: RepositorySummary[];
  recent_runs: SourceRun[];
  summary_text: string;
}

export interface Health {
  status: string;
  version: string;
  database: string;
  worker: {
    state: WorkerState;
    heartbeat_at: IsoDate | null;
  };
  time: IsoDate;
}

export interface Capabilities {
  github_token_configured: boolean;
  agent_reach: {
    installed: boolean;
    version: string | null;
    last_checked_at: IsoDate | null;
    channels: Array<{
      name: string;
      status: string;
      default: boolean;
    }>;
  };
  llm: {
    enabled: boolean;
    configured: boolean;
  };
  embeddings: {
    enabled: boolean;
    sidecar_state: EmbeddingState;
    model: string | null;
    dimensions: number | null;
    indexed: number;
    pending: number;
  };
}

export interface Settings {
  settings: Record<string, string | number | boolean | null>;
}

export interface SnapshotPoint {
  captured_at: IsoDate;
  stars: number;
  forks: number;
  open_issues: number;
}

export interface SnapshotSeries {
  repository_id: number;
  window: "1d" | "7d" | "30d" | "90d" | "365d";
  points: SnapshotPoint[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
}

export interface SavedItem {
  item_type: SavedItemType;
  item_id: number;
  saved_at: IsoDate;
  notes: string | null;
  repository?: RepositorySummary;
  news?: NewsItem;
  idea?: Idea;
}

export interface SearchResults {
  query: string;
  mode_requested: SearchMode;
  mode_used: SearchMode;
  repositories: RepositoryMatch[];
  news: NewsItem[];
  ideas: Idea[];
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
}

export interface SimilarResponse {
  items: RepositoryMatch[];
  mode_requested: SimilarMode;
  mode_used: SimilarMode;
}

export interface RunDetail extends SourceRun {
  metadata: Record<string, unknown>;
}

export interface JobAccepted {
  request_id: number;
  source_id?: number | null;
  status: string;
  worker_state: WorkerState;
}

export interface GenerateIdeasResponse {
  created: Idea[];
  skipped: number;
  reason?: string;
}

export type RepositoryQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  period?: Period;
  growth_window?: GrowthWindow;
  language?: string;
  category?: string;
  tag?: string;
  saved?: boolean;
  status?: RepoUserStatus;
  min_stars?: number;
  min_growth?: number;
  source_id?: number;
  sort?: "interest" | "stars" | "growth" | "updated" | "created" | "forks";
  order?: "asc" | "desc";
};

export type NewsQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  period?: Period;
  category?: string;
  importance?: string;
  source_id?: number;
  saved?: boolean;
  sort?: "published" | "importance" | "fetched";
  order?: "asc" | "desc";
};

export type IdeaQuery = {
  page?: number;
  page_size?: number;
  q?: string;
  period?: Period;
  difficulty?: string;
  category?: string;
  status?: string;
  favorite?: boolean;
  repository_id?: number;
  sort?: "updated" | "created" | "difficulty" | "title";
  order?: "asc" | "desc";
};
