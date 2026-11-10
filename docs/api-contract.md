# TechPulse — Contrato de API

- **Estado**: propuesto, pendiente de aprobación.
- **Base URL**: `http://127.0.0.1:8765/api/v1`
- **Formato**: JSON UTF-8.
- **Autor**: Coordinador.
- **Fecha**: 2026-11-09.
- **Consumidor**: React/Tauri.
- **Implementador**: Backend (FastAPI).

Este documento es normativo. Backend no debe cambiar rutas, campos, enums ni códigos de error sin actualizar este contrato y avisar a Frontend.

## 1. Reglas generales

### 1.1 Transporte

- HTTP/1.1 sobre loopback (`127.0.0.1`).
- `Content-Type: application/json` en requests con cuerpo.
- Respuestas JSON con `Content-Type: application/json; charset=utf-8`.
- Sin autenticación en v1; solo loopback y CORS restringido.
- La API no devuelve secretos.

### 1.2 Fechas

- Todas las fechas son ISO-8601 UTC: `YYYY-MM-DDTHH:MM:SSZ`.
- Los campos de fecha pueden ser `null` cuando la fuente no los proporciona.
- La UI es responsable de mostrarlas en hora local.

### 1.3 IDs

- Los IDs públicos son enteros positivos (`number` en TypeScript).
- `github_id` es el ID estable de GitHub y puede ser mayor que `Number.MAX_SAFE_INTEGER`; se serializa como número JSON. Si en el futuro se detecta pérdida de precisión, se migrará a string; en v1 se documenta como número.

### 1.4 Paginación

Parámetros comunes:

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | int | `1` | `>= 1` |
| `page_size` | int | `20` | `1..100` |

Respuesta de lista:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0,
  "has_next": false
}
```

`has_next = page * page_size < total`.

### 1.5 Filtros comunes

| Parámetro | Tipo | Semántica |
|---|---|---|
| `q` | string | Búsqueda textual; máximo 200 caracteres. |
| `period` | `today \| 7d \| 30d \| all` | Ventana temporal según la entidad. |
| `sort` | string | Campo de orden permitido por endpoint. |
| `order` | `asc \| desc` | Default `desc`. |
| `language` | string CSV | OR entre valores; ej. `Python,TypeScript`. |
| `category` | string CSV | OR entre valores. |
| `tag` | string CSV | OR entre slugs. |
| `saved` | boolean | `true` solo guardados; `false` solo no guardados; omitido = todos. |
| `source_id` | int | Filtra por fuente de descubrimiento. |

Semántica de `period`:

- **Repositorios**: `first_seen_at >= now - period`.
- **Noticias**: `published_at >= now - period`; si `published_at` es `NULL`, usa `fetched_at`.
- **Ideas**: `created_at >= now - period`.
- `today` = últimas 24 horas; `7d` = últimos 7 días; `30d` = últimos 30 días; `all` = sin filtro.

**Decisión de producto pendiente:** en v1 `period` para repositorios significa “descubierto en la ventana” (`first_seen_at`). Si el producto quiere “tendencia activa en la ventana” (repos que siguen apareciendo en las búsquedas), se debe añadir `trending_window` o cambiar la semántica a `last_seen_at`; no se debe inferir sin aprobación.

### 1.6 Orden y valores nulos

- `order=desc` es el default.
- Los valores `NULL` se ordenan al final en `desc` y al principio en `asc`.
- `sort=growth` con `growth_score = NULL` siempre va al final.

### 1.7 Errores

Formato único:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "page_size must be between 1 and 100",
    "details": {
      "field": "page_size"
    },
    "request_id": "req_01J..."
  }
}
```

Códigos:

| HTTP | `code` | Uso |
|---|---|---|
| 400 | `INVALID_QUERY` | Query inválida no cubierta por validación de esquema |
| 404 | `NOT_FOUND` | Entidad inexistente |
| 404 | `REPOSITORY_NOT_FOUND` | Repo inexistente |
| 404 | `NEWS_NOT_FOUND` | Noticia inexistente |
| 404 | `IDEA_NOT_FOUND` | Idea inexistente |
| 409 | `CONFLICT` | Conflicto de estado (ej. ya guardado) |
| 422 | `VALIDATION_ERROR` | Body/query no válido |
| 429 | `RATE_LIMITED` | Límite local de la API |
| 500 | `INTERNAL_ERROR` | Error inesperado |
| 503 | `WORKER_OFFLINE` | Operación requiere worker y está offline |
| 503 | `SOURCE_UNAVAILABLE` | Fuente externa no disponible |
| 503 | `EMBEDDINGS_UNAVAILABLE` | Sidecar/modelo de embeddings no disponible |
| 504 | `UPSTREAM_TIMEOUT` | Timeout de fuente externa |

`request_id` es opcional pero recomendado para correlación de logs.

### 1.8 Idempotencia

- `POST /saved` devuelve `201` la primera vez y `409 CONFLICT` si ya existe.
- `DELETE /saved/{item_type}/{item_id}` devuelve `204` aunque no existiera.
- `POST /repositories/{id}/save` y `DELETE` siguen la misma regla.
- `POST /sources/{id}/run` siempre crea una nueva solicitud y devuelve `202`.
- `PATCH` es idempotente para el mismo body.

### 1.9 Enlaces externos

- La API solo devuelve URLs que provienen de una fuente o de una verificación registrada.
- `html_url`, `homepage_url`, `docs_url` y `url` pueden ser `null`; la UI debe mostrar “No disponible” y **no construir** una URL alternativa.
- La UI solo abre URLs con esquema `http://` o `https://`.

## 2. Enums y tipos TypeScript

```ts
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
```

## 3. Tipos de respuesta

### 3.1 Scores

```ts
export interface ScoreSet {
  popularity: number;      // 0..1
  growth: number | null;   // 0..1; null si no hay historial suficiente
  activity: number;        // 0..1
  maintenance: number;     // 0..1
  relevance: number;       // 0..1
  interest: number;        // 0..1
  quality: number;         // 0..1
}
```

### 3.2 Crecimiento de estrellas

```ts
export interface StarGrowth {
  window: GrowthWindow;
  delta: number | null;
  per_day: number | null;
  from_at: IsoDate | null;
  to_at: IsoDate | null;
}
```

Si no hay snapshots suficientes: `delta`, `per_day`, `from_at`, `to_at` son `null`.

### 3.3 Repositorio (resumen)

```ts
export interface RepositorySummary {
  id: number;
  github_id: number;
  full_name: string;              // "owner/name"
  owner_login: string;
  name: string;
  description: string | null;
  html_url: string;               // URL verificable de GitHub
  homepage_url: string | null;    // solo si la fuente la proporciona
  docs_url: string | null;        // solo si fue verificada
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
    similarity: number | null; // 0..1; null en modo metadata
    score: number;             // 0..1; combinación usada para ordenar
  };
}
```

### 3.4 Repositorio (detalle)

```ts
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
```

### 3.5 Noticia

```ts
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
  importance_score: number;       // 0..1
  importance_label: Importance;
  tags: string[];
  link_status: "verified" | "unverified" | "broken";
  saved: boolean;
}
```

### 3.6 Idea

```ts
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
```

### 3.7 Fuente

```ts
export interface Source {
  id: number;
  key: string;
  name: string;
  kind: "github_api" | "rss" | "agent_reach" | "web" | "internal";
  category: "github" | "ai" | "data_engineering" | "news" | "tools" | "other";
  enabled: boolean;
  interval_minutes: number;
  config: Record<string, unknown>; // sanitizado, sin secretos
  rate_limit_per_hour: number | null;
  last_run_at: IsoDate | null;
  last_success_at: IsoDate | null;
  last_error: string | null;
  next_run_at: IsoDate | null;
}
```

### 3.8 Run y job

```ts
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
```

### 3.9 Worker

```ts
export interface WorkerStatus {
  state: WorkerState;
  worker_id: string | null;
  heartbeat_at: IsoDate | null;
  current_job: string | null;
  version: string | null;
  stale_after_seconds: number;
}
```

### 3.9.1 Embeddings

```ts
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
```

### 3.10 Overview

```ts
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
```

`summary_text` es determinista y se construye con conteos y categorías; no debe inventar datos.

## 4. Catálogo de endpoints

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/health` | Salud de API/DB/worker |
| GET | `/worker/status` | Estado detallado del worker |
| GET | `/overview` | Datos agregados del dashboard |
| GET | `/repositories` | Lista filtrable de repositorios |
| GET | `/repositories/{id}` | Ficha completa |
| GET | `/repositories/{id}/snapshots` | Serie temporal |
| GET | `/repositories/{id}/similar` | Repos similares |
| GET | `/repositories/{id}/ideas` | Ideas relacionadas |
| POST | `/repositories/{id}/save` | Guardar repo |
| DELETE | `/repositories/{id}/save` | Quitar repo guardado |
| PATCH | `/repositories/{id}/state` | Estado de usuario |
| GET | `/news` | Lista de noticias |
| GET | `/news/{id}` | Detalle de noticia |
| POST | `/news/{id}/save` | Guardar noticia |
| DELETE | `/news/{id}/save` | Quitar noticia guardada |
| GET | `/ideas` | Lista de ideas |
| POST | `/ideas/generate` | Generar ideas desde repos |
| GET | `/ideas/{id}` | Detalle de idea |
| PATCH | `/ideas/{id}` | Actualizar idea |
| POST | `/ideas/{id}/favorite` | Marcar favorita |
| DELETE | `/ideas/{id}/favorite` | Quitar favorita |
| GET | `/saved` | Lista polimórfica de guardados |
| POST | `/saved` | Guardar cualquier entidad |
| DELETE | `/saved/{item_type}/{item_id}` | Quitar guardado |
| GET | `/search` | Búsqueda global |
| GET | `/sources` | Lista de fuentes |
| PATCH | `/sources/{id}` | Configurar fuente |
| POST | `/sources/{id}/run` | Encolar actualización |
| POST | `/jobs/run-all` | Encolar todas las fuentes |
| GET | `/jobs` | Cola de trabajos |
| GET | `/runs` | Historial de ejecuciones |
| GET | `/runs/{id}` | Detalle de ejecución |
| GET | `/settings` | Leer configuración |
| PUT | `/settings` | Actualizar configuración |
| GET | `/capabilities` | Capacidades y estado de integraciones |
| POST | `/capabilities/agent-reach/refresh` | Refrescar diagnóstico de Agent Reach |
| GET | `/embeddings/status` | Estado del sidecar, modelo e índice |
| POST | `/embeddings/reindex` | Encolar reindexación de embeddings |

## 5. Endpoints de sistema

### 5.1 `GET /health`

Respuesta `200`:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "ok",
  "worker": {
    "state": "online",
    "heartbeat_at": "2026-11-09T15:00:00Z"
  },
  "time": "2026-11-09T15:00:05Z"
}
```

Si la DB falla: `503` con `SOURCE_UNAVAILABLE` o `INTERNAL_ERROR` y `database: "error"`.

### 5.2 `GET /worker/status`

Respuesta `200`:

```json
{
  "state": "online",
  "worker_id": "worker-01",
  "heartbeat_at": "2026-11-09T15:00:00Z",
  "current_job": "github_search_trending",
  "version": "0.1.0",
  "stale_after_seconds": 30
}
```

`state`:

- `online`: heartbeat dentro del umbral.
- `stale`: heartbeat antiguo pero menor a 3× el umbral.
- `offline`: sin heartbeat o mayor a 3× el umbral.

### 5.3 `GET /capabilities`

Respuesta `200`:

```json
{
  "github_token_configured": false,
  "agent_reach": {
    "installed": true,
    "version": "1.6.1",
    "last_checked_at": "2026-11-09T14:00:00Z",
    "channels": [
      { "name": "github", "status": "ready", "default": true },
      { "name": "youtube", "status": "ready", "default": true },
      { "name": "web", "status": "ready", "default": true },
      { "name": "reddit", "status": "not_added", "default": false }
    ]
  },
  "llm": {
    "enabled": false,
    "configured": false
  },
  "embeddings": {
    "enabled": true,
    "sidecar_state": "online",
    "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "dimensions": 384,
    "indexed": 1240,
    "pending": 12
  }
}
```

No incluye tokens ni rutas sensibles.

### 5.4 `POST /capabilities/agent-reach/refresh`

Ejecuta `agent-reach doctor --text` de forma síncrona (timeout 10 s) y actualiza la caché de capacidades.

Respuesta `200`: mismo esquema que `/capabilities`.
Errores: `503 SOURCE_UNAVAILABLE` si Agent Reach no está instalado o falla.

### 5.5 `GET /embeddings/status`

Respuesta `200`: `EmbeddingStatus`.

```json
{
  "enabled": true,
  "sidecar": {
    "state": "online",
    "url": "http://127.0.0.1:8766",
    "model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "dimensions": 384,
    "device": "cpu",
    "version": "0.1.0",
    "last_checked_at": "2026-11-09T15:00:00Z"
  },
  "model": {
    "name": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "downloaded": true,
    "download_required": false
  },
  "index": {
    "indexed": 1240,
    "pending": 12,
    "last_indexed_at": "2026-11-09T14:00:00Z",
    "active_model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
  }
}
```

### 5.6 `POST /embeddings/reindex`

Body opcional:

```json
{
  "repository_ids": [1, 2, 3],
  "force": false
}
```

- Si no se envían `repository_ids`, se indexan todos los repositorios pendientes (sin embedding o con `content_hash` distinto).
- `force=true` reindexa aunque el hash no haya cambiado.
- Respuesta `202`:

```json
{
  "request_id": 44,
  "source_id": 9,
  "status": "pending",
  "worker_state": "online"
}
```

Errores: `503 EMBEDDINGS_UNAVAILABLE` si el sidecar/modelo no está disponible; `422 VALIDATION_ERROR` si un ID no existe.

## 6. Dashboard

### 6.1 `GET /overview`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `limit` | int 1..20 | `5` |

Respuesta `200`:

```json
{
  "generated_at": "2026-11-09T15:00:00Z",
  "last_success_at": "2026-11-09T14:45:00Z",
  "counts": {
    "repositories": 1240,
    "news": 320,
    "ideas": 18,
    "saved": 42,
    "sources": 12
  },
  "featured_repositories": [],
  "top_news": [],
  "ai_trends": [],
  "new_tools": [],
  "recent_runs": [],
  "summary_text": "1240 repositorios y 320 noticias recopiladas. 18 ideas de proyecto disponibles."
}
```

Reglas de selección:

- `featured_repositories`: top por `interest_score` de los últimos 7 días, excluyendo archivados/disabled.
- `top_news`: top por `importance_score` de las últimas 48 h.
- `ai_trends`: repos `category=ai` top por crecimiento/interés.
- `new_tools`: repos `category=dev_tools` o `ai` con `created_at` reciente y buen `quality_score`.
- `recent_runs`: últimos 5 runs.

## 7. Repositorios

### 7.1 `GET /repositories`

Query:

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `page` | int | `1` | `>= 1` |
| `page_size` | int | `20` | `1..100` |
| `q` | string | — | `full_name`, `description`, `tags` |
| `period` | enum | `30d` | `today/7d/30d/all` |
| `growth_window` | enum | `7d` | `1d/7d/30d` |
| `language` | CSV | — | OR |
| `category` | CSV | — | OR |
| `tag` | CSV | — | OR |
| `saved` | bool | — | — |
| `status` | enum | — | `untracked/pending/tried/archived` |
| `min_stars` | int | — | `>= 0` |
| `min_growth` | number | — | delta por día de la ventana |
| `source_id` | int | — | — |
| `sort` | enum | `interest` | `interest/stars/growth/updated/created/forks` |
| `order` | enum | `desc` | `asc/desc` |

Respuesta `200`:

```json
{
  "items": [
    {
      "id": 1,
      "github_id": 123456,
      "full_name": "owner/repo",
      "owner_login": "owner",
      "name": "repo",
      "description": "Descripción real proveniente de GitHub.",
      "html_url": "https://github.com/owner/repo",
      "homepage_url": null,
      "docs_url": null,
      "language": "Python",
      "license_spdx": "MIT",
      "stars": 1200,
      "forks": 80,
      "open_issues": 12,
      "created_at": "2025-01-10T00:00:00Z",
      "updated_at": "2026-11-08T10:00:00Z",
      "pushed_at": "2026-11-08T09:00:00Z",
      "category": "ai",
      "subcategory": "agents",
      "tags": ["agents", "llm"],
      "scores": {
        "popularity": 0.62,
        "growth": 0.71,
        "activity": 0.9,
        "maintenance": 0.85,
        "relevance": 0.5,
        "interest": 0.74,
        "quality": 0.8
      },
      "star_growth": {
        "window": "7d",
        "delta": 240,
        "per_day": 34.28,
        "from_at": "2026-11-02T00:00:00Z",
        "to_at": "2026-11-09T00:00:00Z"
      },
      "first_seen_at": "2026-11-01T12:00:00Z",
      "last_seen_at": "2026-11-09T14:00:00Z",
      "saved": false,
      "user_status": "untracked"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1,
  "has_next": false
}
```

Reglas:

- `growth_window` solo afecta `star_growth` y `sort=growth`.
- `min_growth` compara `star_growth.per_day`; si es `null`, el repo se excluye.
- `sort=growth` pone `null` al final.

### 7.2 `GET /repositories/{id}`

Respuesta `200`: `RepositoryDetail`.

```json
{
  "id": 1,
  "github_id": 123456,
  "full_name": "owner/repo",
  "owner_login": "owner",
  "owner_type": "Organization",
  "name": "repo",
  "description": "Descripción real.",
  "html_url": "https://github.com/owner/repo",
  "homepage_url": "https://example.com",
  "docs_url": null,
  "language": "Python",
  "license_spdx": "MIT",
  "license_name": "MIT License",
  "topics": ["agents", "llm"],
  "stars": 1200,
  "forks": 80,
  "open_issues": 12,
  "watchers": 1200,
  "created_at": "2025-01-10T00:00:00Z",
  "updated_at": "2026-11-08T10:00:00Z",
  "pushed_at": "2026-11-08T09:00:00Z",
  "archived": false,
  "disabled": false,
  "is_fork": false,
  "default_branch": "main",
  "readme_excerpt": "Extracto real del README, truncado.",
  "category": "ai",
  "subcategory": "agents",
  "tags": ["agents", "llm"],
  "scores": {
    "popularity": 0.62,
    "growth": 0.71,
    "activity": 0.9,
    "maintenance": 0.85,
    "relevance": 0.5,
    "interest": 0.74,
    "quality": 0.8
  },
  "score_explanation": {
    "weights": { "growth": 0.3, "activity": 0.2, "maintenance": 0.2, "relevance": 0.15, "popularity": 0.15 },
    "missing": [],
    "inputs": { "stars": 1200, "forks": 80, "pushed_at": "2026-11-08T09:00:00Z" }
  },
  "star_growth": {
    "window": "7d",
    "delta": 240,
    "per_day": 34.28,
    "from_at": "2026-11-02T00:00:00Z",
    "to_at": "2026-11-09T00:00:00Z"
  },
  "first_seen_at": "2026-11-01T12:00:00Z",
  "last_seen_at": "2026-11-09T14:00:00Z",
  "last_synced_at": "2026-11-09T14:00:00Z",
  "saved": false,
  "user_status": "untracked",
  "link_checks": [
    {
      "link_type": "html_url",
      "url": "https://github.com/owner/repo",
      "ok": true,
      "status_code": 200,
      "checked_at": "2026-11-09T14:00:00Z",
      "error": null
    }
  ],
  "related_ideas": [],
  "similar_repositories": []
}
```

Errores: `404 REPOSITORY_NOT_FOUND`.

### 7.3 `GET /repositories/{id}/snapshots`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `window` | `1d \| 7d \| 30d \| 90d \| 365d` | `30d` |

Respuesta `200`:

```json
{
  "repository_id": 1,
  "window": "30d",
  "points": [
    { "captured_at": "2026-11-01T00:00:00Z", "stars": 900, "forks": 70, "open_issues": 10 },
    { "captured_at": "2026-11-09T00:00:00Z", "stars": 1200, "forks": 80, "open_issues": 12 }
  ]
}
```

### 7.4 `GET /repositories/{id}/similar`

Query:

| Parámetro | Tipo | Default | Reglas |
|---|---|---|---|
| `limit` | int | `6` | `1..20` |
| `mode` | enum | `metadata` | `metadata`, `semantic`, `hybrid` |

Semántica:

- `metadata`: mismo `category`, tags en común o mismo `language`; ordena por `interest_score`.
- `semantic`: similitud coseno contra los embeddings; requiere sidecar/modelo.
- `hybrid`: combina similitud semántica y `interest_score`; si no hay embeddings, degrada a `metadata`.

Respuesta `200`:

```json
{
  "items": [
    {
      "...": "RepositoryMatch",
      "match": {
        "mode": "semantic",
        "similarity": 0.82,
        "score": 0.82
      }
    }
  ],
  "mode_requested": "semantic",
  "mode_used": "semantic"
}
```

Errores:

- `mode=semantic` y sidecar/modelo no disponible: `503 EMBEDDINGS_UNAVAILABLE`.
- `mode=hybrid` y sidecar no disponible: `200` con `mode_used: "metadata"`.

### 7.5 `GET /repositories/{id}/ideas`

Respuesta `200`: `{ "items": IdeaRef[] }`.

### 7.6 `POST /repositories/{id}/save`

Sin body. Respuesta `201`:

```json
{ "item_type": "repository", "item_id": 1, "saved_at": "2026-11-09T15:00:00Z" }
```

Si ya está guardado: `409 CONFLICT`.

### 7.7 `DELETE /repositories/{id}/save`

Respuesta `204` sin body. Idempotente.

### 7.8 `PATCH /repositories/{id}/state`

Body:

```json
{ "status": "pending", "note": "Probar esta semana" }
```

`status` obligatorio; `note` opcional (máx. 1000 caracteres).

Respuesta `200`:

```json
{ "repository_id": 1, "status": "pending", "note": "Probar esta semana", "updated_at": "2026-11-09T15:00:00Z" }
```

## 8. Noticias

### 8.1 `GET /news`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `page` | int | `1` |
| `page_size` | int | `20` |
| `q` | string | — |
| `period` | enum | `7d` |
| `category` | CSV | — |
| `importance` | enum CSV | — |
| `source_id` | int | — |
| `saved` | bool | — |
| `sort` | enum | `published` |
| `order` | enum | `desc` |

`sort`: `published`, `importance`, `fetched`.

Respuesta `200`: paginada con `NewsItem[]`.

### 8.2 `GET /news/{id}`

Respuesta `200`: `NewsItem` (incluye `sources`).

### 8.3 `POST /news/{id}/save` y `DELETE /news/{id}/save`

Mismo comportamiento que repositorios: `201`/`409` y `204`.

## 9. Ideas

### 9.1 `GET /ideas`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `page` | int | `1` |
| `page_size` | int | `20` |
| `q` | string | — |
| `period` | enum | `all` |
| `difficulty` | enum CSV | — |
| `category` | CSV | — |
| `status` | enum CSV | — |
| `favorite` | bool | — |
| `repository_id` | int | — |
| `sort` | enum | `updated` |
| `order` | enum | `desc` |

`sort`: `updated`, `created`, `difficulty`, `title`.

Respuesta `200`: paginada con `Idea[]`.

### 9.2 `POST /ideas/generate`

Genera ideas de forma **síncrona** usando solo datos ya almacenados (reglas, sin red). El worker también puede generarlas automáticamente tras una ingesta.

Body:

```json
{
  "repository_ids": [1, 2, 3],
  "category": "ai",
  "difficulty": "intermediate",
  "max_ideas": 5
}
```

Todos los campos son opcionales. Si no se envían `repository_ids`, se usan los repositorios con mayor `interest_score` que aún no tengan ideas asociadas.

Respuesta `200`:

```json
{
  "created": [],
  "skipped": 2,
  "reason": "No hay suficientes repositorios relacionados."
}
```

Reglas:

- Cada idea creada debe tener al menos un repositorio real en `repositories`.
- `max_ideas` 1..20, default 5.
- Si `repository_ids` contiene un ID inexistente: `422 VALIDATION_ERROR`.
- Si no hay repositorios elegibles: `200` con `created: []` y `reason`.

### 9.3 `GET /ideas/{id}`

Respuesta `200`: `Idea`.

### 9.4 `PATCH /ideas/{id}`

Body parcial:

```json
{
  "title": "Nuevo título",
  "status": "in_progress",
  "favorite": true,
  "difficulty": "advanced"
}
```

Campos permitidos: `title`, `summary`, `problem`, `how_it_works`, `technologies`, `difficulty`, `category`, `expansion`, `portfolio_value`, `status`, `favorite`.

Respuesta `200`: `Idea`.

### 9.5 `POST /ideas/{id}/favorite` y `DELETE /ideas/{id}/favorite`

Respuesta `200`: `Idea` actualizada. Idempotente.

`Idea.favorite` se deriva de `saved_items` (`item_type='idea'`). Estos endpoints y `PATCH /ideas/{id}` con `favorite` son alias funcionales de guardar/quitar la idea en `saved_items`; no existe una columna `favorite` separada en la base de datos.

## 10. Guardados

### 10.1 `GET /saved`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `type` | `repository \| news \| idea` | — |
| `page` | int | `1` |
| `page_size` | int | `20` |

Respuesta `200`:

```json
{
  "items": [
    {
      "item_type": "repository",
      "item_id": 1,
      "saved_at": "2026-11-09T15:00:00Z",
      "notes": null,
      "repository": { "...": "RepositorySummary" }
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1,
  "has_next": false
}
```

El objeto embebido (`repository`, `news` o `idea`) corresponde al tipo. Si la entidad ya no existe, se omite y se registra una advertencia.

### 10.2 `POST /saved`

Body:

```json
{ "item_type": "repository", "item_id": 1, "notes": "Revisar" }
```

Respuesta `201`; `409 CONFLICT` si ya existe; `404` si la entidad no existe; `422` si `item_type` no es válido.

### 10.3 `DELETE /saved/{item_type}/{item_id}`

Respuesta `204` idempotente.

## 11. Búsqueda global

### 11.1 `GET /search`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `q` | string | requerido, 2..200 |
| `types` | CSV | `repository,news,idea` |
| `limit` | int | `10` (1..20 por tipo) |
| `mode` | enum | `keyword` (`keyword`, `semantic`, `hybrid`) |

Respuesta `200`:

```json
{
  "query": "agentes para investigar noticias",
  "mode_requested": "hybrid",
  "mode_used": "hybrid",
  "repositories": [],
  "news": [],
  "ideas": []
}
```

Semántica:

- `keyword`: búsqueda case-insensitive en campos de texto.
- `semantic`: repositorios ordenados por similitud coseno; noticias e ideas se siguen buscando por texto.
- `hybrid`: combina similitud + `interest_score` para repositorios; noticias e ideas por texto.
- Si `mode=semantic` y el sidecar/modelo no está disponible: `503 EMBEDDINGS_UNAVAILABLE`.
- Si `mode=hybrid` y no hay embeddings: `200` con `mode_used: "keyword"`.

Campos de búsqueda:

- Repos: `full_name`, `description`, tags, y embedding semántico si aplica.
- Noticias: `title`, `summary`.
- Ideas: `title`, `summary`, `problem`, technologies.

## 12. Fuentes, jobs y runs

### 12.1 `GET /sources`

Respuesta `200`: `{ "items": Source[] }`.

### 12.2 `PATCH /sources/{id}`

Body:

```json
{
  "enabled": true,
  "interval_minutes": 240,
  "config": { "queries": ["topic:ai stars:>500"] }
}
```

Reglas:

- `interval_minutes` 5..10080.
- `config` se valida según `kind`; nunca contiene secretos.
- Respuesta `200`: `Source`.
- `422` si el intervalo o la config son inválidos.

### 12.3 `POST /sources/{id}/run`

Sin body. Inserta un `job_request` y responde `202`:

```json
{
  "request_id": 42,
  "source_id": 3,
  "status": "pending",
  "worker_state": "online"
}
```

Si el worker está offline, igualmente `202` con `worker_state: "offline"`; la UI debe avisar que el trabajo quedará pendiente.

### 12.4 `POST /jobs/run-all`

Sin body. Encola todas las fuentes habilitadas (`source_id = NULL` en `job_requests`). Respuesta `202`:

```json
{ "request_id": 43, "status": "pending", "worker_state": "online" }
```

### 12.5 `GET /jobs`

Query: `status` (CSV), `source_id`, `page`, `page_size`.

Respuesta `200`: paginada con `JobRequest[]`.

### 12.6 `GET /runs`

Query:

| Parámetro | Tipo | Default |
|---|---|---|
| `source_id` | int | — |
| `status` | CSV | — |
| `page` | int | `1` |
| `page_size` | int | `20` |
| `order` | enum | `desc` |

Respuesta `200`: paginada con `SourceRun[]`.

### 12.7 `GET /runs/{id}`

Respuesta `200`: `SourceRun` + `metadata`:

```json
{
  "id": 10,
  "source_id": 3,
  "source_key": "github_search_trending",
  "source_name": "GitHub Trending",
  "trigger": "schedule",
  "status": "success",
  "started_at": "2026-11-09T14:00:00Z",
  "finished_at": "2026-11-09T14:00:12Z",
  "items_fetched": 50,
  "items_new": 12,
  "items_updated": 38,
  "items_skipped": 0,
  "error_code": null,
  "error_message": null,
  "duration_ms": 12000,
  "metadata": {
    "pages": 2,
    "cache_hits": 3,
    "rate_limit_remaining": 4800
  }
}
```

## 13. Configuración

### 13.1 `GET /settings`

Respuesta `200`:

```json
{
  "settings": {
    "scheduler.enabled": true,
    "scheduler.max_concurrent_jobs": 2,
    "worker.heartbeat_seconds": 10,
    "worker.stale_after_seconds": 30,
    "http.timeout_seconds": 15,
    "http.max_concurrent": 4,
    "retention.source_runs_days": 90,
    "retention.snapshots_days": 400,
    "retention.news_days": 365,
    "links.verify_interval_days": 7,
    "ideas.auto_generate": true,
    "ideas.min_new_repos": 10,
    "ideas.max_per_run": 5,
    "ui.theme": "dark",
    "llm.enabled": false,
    "llm.provider": null,
    "llm.model": null,
    "embeddings.enabled": true,
    "embeddings.model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    "embeddings.batch_size": 32,
    "embeddings.max_repos_per_run": 200,
    "embeddings.interval_minutes": 360,
    "embeddings.auto_download": false,
    "embeddings.min_similarity": 0.25,
    "embeddings.sidecar_url": "http://127.0.0.1:8766"
  }
}
```

### 13.2 `PUT /settings`

Body parcial con las claves a actualizar:

```json
{
  "scheduler.enabled": false,
  "retention.news_days": 180
}
```

Respuesta `200`: mismo esquema que `GET /settings` con los valores finales.

Reglas:

- Claves desconocidas: `422 VALIDATION_ERROR`.
- Tipos y rangos validados.
- `github.token` nunca se acepta por API; el token se configura por variable de entorno.

## 14. Notas para Frontend

1. **Base URL** configurable con `VITE_API_BASE_URL`; default `http://127.0.0.1:8765/api/v1`.
2. **Polling**:
   - `/worker/status` cada 10 s mientras la ventana está visible.
   - `/overview` cada 60 s.
   - `/runs` cada 30 s si se muestra actividad.
   - Detener polling cuando la ventana está oculta.
3. **Acciones optimistas**: guardar/favorito puede actualizar la UI al instante, pero debe revertir si la API devuelve error.
4. **Enlaces**: abrir con el plugin `opener` de Tauri; validar `http/https` antes.
5. **Estados vacíos**: distinguir “sin datos” de “worker offline” y de “fuente con error”.
6. **Crecimiento**: si `star_growth.delta` es `null`, mostrar “Sin datos suficientes”; no mostrar `0`.
7. **Licencia**: si `license_spdx` es `null`, mostrar “No especificada”; no afirmar uso comercial.
8. **Paginación**: usar `has_next`; no asumir que `items.length === page_size`.
9. **Errores**: mostrar `error.message` y ofrecer reintento; registrar `request_id` en consola.
10. **No construir URLs**: si un campo de enlace es `null`, no derivar `https://github.com/{full_name}` en la UI; usar `html_url` de la API.
11. **Semántica**: el toggle “Metadatos / Semántico / Híbrido” debe leer `mode_used`; si se pidió semántico y no está disponible, mostrar aviso y ofrecer fallback.
12. **Similitud**: mostrar `match.similarity` como porcentaje solo si no es `null`; no presentarla como “calidad”.
13. **Modelo local**: mostrar estado (`online`, `loading`, `not_downloaded`, `offline`) y ofrecer “Descargar modelo” si `download_required=true`.
14. **Privacidad**: indicar que la búsqueda semántica es local y no envía textos a la nube.

## 15. Cambios de contrato

- Cualquier cambio de ruta, campo, enum o error requiere:
  1. actualizar este documento,
  2. avisar a Frontend y Backend,
  3. versionar si es incompatible (`/api/v2`).
- Campos nuevos: aditivos y opcionales; nunca eliminar campos existentes en v1.

## 16. Decisiones pendientes de aprobación

1. Rutas y nombres exactos de endpoints.
2. Esquema de paginación y errores.
3. `POST /ideas/generate` síncrono para generación manual.
4. `POST /sources/{id}/run` devuelve `202` incluso con worker offline.
5. IDs numéricos y `github_id` como número JSON.
6. `period` basado en `first_seen_at` para repositorios.
7. `growth_window` separado de `period`.
8. Campos `docs_url`/`homepage_url` solo si están verificados/provistos.
9. Modos `metadata`/`semantic`/`hybrid` y campo `match`.
10. Respuesta `503 EMBEDDINGS_UNAVAILABLE` en modo semántico.
11. Endpoints `/embeddings/status` y `/embeddings/reindex`.
12. Pesos del modo híbrido (`similarity` + `interest_score`).
