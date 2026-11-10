import type {
  ApiErrorPayload,
  Capabilities,
  EmbeddingStatus,
  GenerateIdeasResponse,
  Health,
  Idea,
  IdeaQuery,
  JobAccepted,
  JobRequest,
  NewsItem,
  NewsQuery,
  Overview,
  Paginated,
  RepositoryDetail,
  RepositoryMatch,
  RepositoryQuery,
  RepositorySummary,
  RunDetail,
  SavedItem,
  SavedItemType,
  SearchMode,
  SearchResults,
  Settings,
  SimilarMode,
  SimilarResponse,
  SnapshotSeries,
  Source,
  SourceRun,
  WorkerStatus,
} from "./types";

const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://127.0.0.1:8765/api/v1";

export const API_BASE_URL = BASE_URL;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status = 0,
    requestId?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }

  get isOffline() {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT";
  }
}

type QueryValue = string | number | boolean | null | undefined;

function buildQuery(query?: Record<string, QueryValue>) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, timeoutMs = 15_000 } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("timeout"), timeoutMs);
  const abort = () => controller.abort(signal?.reason ?? "aborted");

  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }

  try {
    const response = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (response.status === 204) return undefined as T;

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);

    if (!response.ok) {
      const parsed = payload as ApiErrorPayload | null;
      const apiError = parsed?.error;
      throw new ApiError(
        apiError?.code ?? `HTTP_${response.status}`,
        apiError?.message ?? `La API respondió ${response.status}`,
        response.status,
        apiError?.request_id,
        apiError?.details,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (signal?.aborted) throw error;
      throw new ApiError("TIMEOUT", "La API local no respondió a tiempo.", 0);
    }
    throw new ApiError(
      "NETWORK_ERROR",
      "No se pudo conectar con la API local en 127.0.0.1:8765.",
      0,
    );
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

function csv(value?: string[] | string) {
  if (!value) return undefined;
  return Array.isArray(value) ? value.join(",") : value;
}

export const api = {
  baseUrl: BASE_URL,

  health: (signal?: AbortSignal) => request<Health>("/health", { signal, timeoutMs: 4_000 }),
  workerStatus: (signal?: AbortSignal) => request<WorkerStatus>("/worker/status", { signal }),
  capabilities: (signal?: AbortSignal) => request<Capabilities>("/capabilities", { signal }),
  embeddingsStatus: (signal?: AbortSignal) =>
    request<EmbeddingStatus>("/embeddings/status", { signal }),
  refreshAgentReach: () => request<Capabilities>("/capabilities/agent-reach/refresh", { method: "POST" }),

  overview: (limit = 6, signal?: AbortSignal) =>
    request<Overview>("/overview", { query: { limit }, signal }),

  repositories: (query: RepositoryQuery = {}, signal?: AbortSignal) =>
    request<Paginated<RepositorySummary>>("/repositories", {
      query: {
        ...query,
        language: csv(query.language),
        category: csv(query.category),
        tag: csv(query.tag),
      },
      signal,
    }),
  repository: (id: number, signal?: AbortSignal) =>
    request<RepositoryDetail>(`/repositories/${id}`, { signal }),
  snapshots: (id: number, window: "1d" | "7d" | "30d" | "90d" | "365d" = "30d", signal?: AbortSignal) =>
    request<SnapshotSeries>(`/repositories/${id}/snapshots`, { query: { window }, signal }),
  similar: (id: number, mode: SimilarMode = "metadata", limit = 6, signal?: AbortSignal) =>
    request<SimilarResponse>(`/repositories/${id}/similar`, {
      query: { mode, limit },
      signal,
    }),
  repositoryIdeas: (id: number, signal?: AbortSignal) =>
    request<{ items: Idea[] }>(`/repositories/${id}/ideas`, { signal }),
  saveRepository: (id: number) =>
    request<{ item_type: SavedItemType; item_id: number; saved_at: string }>(
      `/repositories/${id}/save`,
      { method: "POST" },
    ),
  unsaveRepository: (id: number) =>
    request<void>(`/repositories/${id}/save`, { method: "DELETE" }),
  patchRepositoryState: (id: number, body: { status: string; note?: string }) =>
    request<{ repository_id: number; status: string; note: string | null; updated_at: string }>(
      `/repositories/${id}/state`,
      { method: "PATCH", body },
    ),

  news: (query: NewsQuery = {}, signal?: AbortSignal) =>
    request<Paginated<NewsItem>>("/news", {
      query: { ...query, category: csv(query.category), importance: csv(query.importance) },
      signal,
    }),
  newsItem: (id: number, signal?: AbortSignal) => request<NewsItem>(`/news/${id}`, { signal }),
  saveNews: (id: number) =>
    request<{ item_type: SavedItemType; item_id: number; saved_at: string }>(`/news/${id}/save`, {
      method: "POST",
    }),
  unsaveNews: (id: number) => request<void>(`/news/${id}/save`, { method: "DELETE" }),

  ideas: (query: IdeaQuery = {}, signal?: AbortSignal) =>
    request<Paginated<Idea>>("/ideas", {
      query: {
        ...query,
        difficulty: csv(query.difficulty),
        category: csv(query.category),
        status: csv(query.status),
      },
      signal,
    }),
  idea: (id: number, signal?: AbortSignal) => request<Idea>(`/ideas/${id}`, { signal }),
  generateIdeas: (body: { repository_ids?: number[]; category?: string; difficulty?: string; max_ideas?: number } = {}) =>
    request<GenerateIdeasResponse>("/ideas/generate", { method: "POST", body }),
  patchIdea: (id: number, body: Partial<Pick<Idea, "title" | "summary" | "problem" | "how_it_works" | "technologies" | "difficulty" | "category" | "expansion" | "portfolio_value" | "status" | "favorite">>) =>
    request<Idea>(`/ideas/${id}`, { method: "PATCH", body }),
  favoriteIdea: (id: number) => request<Idea>(`/ideas/${id}/favorite`, { method: "POST" }),
  unfavoriteIdea: (id: number) => request<Idea>(`/ideas/${id}/favorite`, { method: "DELETE" }),

  saved: (type?: SavedItemType, page = 1, pageSize = 20, signal?: AbortSignal) =>
    request<Paginated<SavedItem>>("/saved", {
      query: { type, page, page_size: pageSize },
      signal,
    }),
  deleteSaved: (type: SavedItemType, id: number) =>
    request<void>(`/saved/${type}/${id}`, { method: "DELETE" }),

  search: (q: string, mode: SearchMode = "keyword", types = "repository,news,idea", limit = 8, signal?: AbortSignal) =>
    request<SearchResults>("/search", { query: { q, mode, types, limit }, signal }),

  sources: (signal?: AbortSignal) => request<{ items: Source[] }>("/sources", { signal }),
  patchSource: (id: number, body: { enabled?: boolean; interval_minutes?: number; config?: Record<string, unknown> }) =>
    request<Source>(`/sources/${id}`, { method: "PATCH", body }),
  runSource: (id: number) => request<JobAccepted>(`/sources/${id}/run`, { method: "POST" }),
  runAll: () => request<JobAccepted>("/jobs/run-all", { method: "POST" }),
  jobs: (query: { status?: string; source_id?: number; page?: number; page_size?: number } = {}, signal?: AbortSignal) =>
    request<Paginated<JobRequest>>("/jobs", { query, signal }),
  runs: (query: { source_id?: number; status?: string; page?: number; page_size?: number; order?: "asc" | "desc" } = {}, signal?: AbortSignal) =>
    request<Paginated<SourceRun>>("/runs", { query, signal }),
  run: (id: number, signal?: AbortSignal) => request<RunDetail>(`/runs/${id}`, { signal }),

  settings: (signal?: AbortSignal) => request<Settings>("/settings", { signal }),
  putSettings: (body: Record<string, string | number | boolean | null>) =>
    request<Settings>("/settings", { method: "PUT", body }),
  reindexEmbeddings: (body: { repository_ids?: number[]; force?: boolean } = {}) =>
    request<JobAccepted>("/embeddings/reindex", { method: "POST", body }),
};

export function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Opens links through the Tauri opener when available, with a browser fallback. */
export async function openExternal(url: string | null | undefined) {
  if (!isSafeExternalUrl(url)) return false;
  try {
    const opener = await import("@tauri-apps/plugin-opener");
    await opener.openUrl(url);
    return true;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return true;
  }
}
