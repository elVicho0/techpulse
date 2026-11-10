# TechPulse — Modelo de datos

- **Estado**: propuesto, pendiente de aprobación.
- **Motor**: SQLite 3 (WAL).
- **Autor**: Coordinador.
- **Fecha**: 2026-11-09.
- **Documento relacionado**: `docs/architecture.md`, `docs/api-contract.md`.

## 1. Principios

1. **SQLite es la única fuente de verdad.** La UI no accede a la base de datos.
2. **Los datos duros solo provienen de fuentes verificables.** Si un campo no existe en la fuente, se guarda `NULL`; no se rellena con invenciones.
3. **Procedencia explícita.** Cada entidad importada conserva la fuente y el identificador externo.
4. **Historial, no sobrescritura destructiva.** Los repositorios y noticias no se borran al desaparecer de una fuente; se actualiza `last_seen_at`.
5. **Deduplicación determinista.** Claves canónicas documentadas por entidad.
6. **Fechas en ISO-8601 UTC** (`YYYY-MM-DDTHH:MM:SSZ`) almacenadas como `TEXT`.
7. **Booleanos como `INTEGER` 0/1** con `CHECK`.
8. **Puntuaciones en rango 0..1** almacenadas como `REAL`; la UI puede mostrarlas como 0..100.
9. **Migraciones versionadas e idempotentes.**

## 2. Catálogo de enums

### 2.1 Fuentes

- `sources.kind`: `github_api`, `rss`, `agent_reach`, `web`, `internal`.
- `sources.category`: `github`, `ai`, `data_engineering`, `news`, `tools`, `other`.

### 2.2 Repositorios

- `repositories.category`:
  - `ai`
  - `data_engineering`
  - `machine_learning`
  - `data_science`
  - `dev_tools`
  - `web`
  - `other`
- `repositories.subcategory` (vocabulario controlado, puede ser `NULL`):
  - IA: `agents`, `agent_framework`, `models`, `mcp`, `rag`, `llm`, `automation`, `inference`, `evaluation`
  - Datos: `etl`, `elt`, `streaming`, `warehouse`, `lake`, `orchestration`, `quality`, `observability`
  - Desarrollo: `cli`, `sdk`, `framework`, `database`, `infrastructure`
- `repositories.owner_type`: `User`, `Organization` (valores de GitHub; puede ser `NULL`).
- `repository_user_state.status`: `untracked`, `pending`, `tried`, `archived`.

### 2.3 Noticias

- `news_items.category`: `ai`, `data`, `dev`, `product`, `security`, `business`, `other`.
- `news_items.importance_label`: `low`, `medium`, `high`.

### 2.4 Ideas

- `project_ideas.difficulty`: `beginner`, `intermediate`, `advanced`.
- `project_ideas.status`: `pending`, `in_progress`, `completed`.
- `project_ideas.portfolio_value`: `learning`, `portfolio`, `internship`, `commercial`.
- `project_ideas.generated_by`: `rules`, `llm`, `manual`.
- `idea_repositories.role`: `data_source`, `processing`, `ai`, `visualization`, `inspiration`, `tooling`.

### 2.5 Jobs y runs

- `source_runs.trigger`: `schedule`, `manual`, `retry`, `startup`.
- `source_runs.status`: `queued`, `running`, `success`, `partial`, `failed`, `skipped`.
- `job_requests.status`: `pending`, `claimed`, `done`, `failed`, `cancelled`.

## 3. Diagrama entidad-relación (simplificado)

```text
sources 1 ─── N source_runs
sources 1 ─── N job_requests
sources 1 ─── N repository_sources N ─── 1 repositories
sources 1 ─── N news_item_sources N ─── 1 news_items
repositories 1 ─── N repository_snapshots
repositories N ─── N tags (repository_tags)
news_items N ─── N tags (news_tags)
repositories 1 ─── N link_checks (polimórfico por entity_type/entity_id)
repositories 1 ─── 1 repository_user_state
repositories N ─── N project_ideas (idea_repositories)
saved_items ─── polimórfico (repository | news | idea)
```

## 4. DDL completo (v1 propuesta)

> El DDL es la referencia normativa para Backend. Cualquier cambio requiere actualizar este documento y el contrato de API si afecta campos expuestos.

```sql
-- Configuración de conexión obligatoria al abrir la base:
-- PRAGMA foreign_keys = ON;
-- PRAGMA journal_mode = WAL;
-- PRAGMA synchronous = NORMAL;
-- PRAGMA busy_timeout = 5000;

CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

CREATE TABLE sources (
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

CREATE INDEX idx_sources_due ON sources (enabled, next_run_at);
CREATE INDEX idx_sources_kind ON sources (kind, enabled);

CREATE TABLE job_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER REFERENCES sources(id) ON DELETE CASCADE,
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'done', 'failed', 'cancelled')),
    claimed_at TEXT,
    finished_at TEXT,
    requested_by TEXT NOT NULL DEFAULT 'api',
    error_message TEXT
);

CREATE INDEX idx_job_requests_status ON job_requests (status, requested_at);
CREATE INDEX idx_job_requests_source ON job_requests (source_id, requested_at DESC);

CREATE TABLE source_runs (
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

CREATE INDEX idx_runs_source_started ON source_runs (source_id, started_at DESC);
CREATE INDEX idx_runs_status_started ON source_runs (status, started_at DESC);

CREATE TABLE repositories (
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

CREATE INDEX idx_repos_interest ON repositories (interest_score DESC);
CREATE INDEX idx_repos_stars ON repositories (stars DESC);
CREATE INDEX idx_repos_growth ON repositories (growth_score DESC);
CREATE INDEX idx_repos_category ON repositories (category, interest_score DESC);
CREATE INDEX idx_repos_language ON repositories (language, interest_score DESC);
CREATE INDEX idx_repos_first_seen ON repositories (first_seen_at DESC);
CREATE INDEX idx_repos_last_seen ON repositories (last_seen_at DESC);

CREATE TABLE repository_sources (
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    PRIMARY KEY (repository_id, source_id)
);

CREATE INDEX idx_repository_sources_source ON repository_sources (source_id, last_seen_at DESC);

CREATE TABLE repository_snapshots (
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

CREATE INDEX idx_snapshots_repo_time ON repository_snapshots (repository_id, captured_at DESC);

CREATE TABLE repository_embeddings (
    repository_id INTEGER PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    model_version TEXT,
    dimensions INTEGER NOT NULL CHECK (dimensions > 0),
    content_hash TEXT NOT NULL,
    vector BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_repository_embeddings_model ON repository_embeddings (model_name, updated_at DESC);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('technology', 'topic', 'category'))
);

CREATE TABLE repository_tags (
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (repository_id, tag_id)
);

CREATE INDEX idx_repository_tags_tag ON repository_tags (tag_id, repository_id);

CREATE TABLE news_items (
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

CREATE INDEX idx_news_published ON news_items (published_at DESC);
CREATE INDEX idx_news_importance ON news_items (importance_score DESC);
CREATE INDEX idx_news_category ON news_items (category, published_at DESC);

CREATE TABLE news_item_sources (
    news_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    PRIMARY KEY (news_id, source_id),
    UNIQUE (source_id, external_id)
);

CREATE INDEX idx_news_sources_news ON news_item_sources (news_id);

CREATE TABLE news_tags (
    news_id INTEGER NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (news_id, tag_id)
);

CREATE INDEX idx_news_tags_tag ON news_tags (tag_id, news_id);

CREATE TABLE saved_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL CHECK (item_type IN ('repository', 'news', 'idea')),
    item_id INTEGER NOT NULL,
    saved_at TEXT NOT NULL,
    notes TEXT,
    UNIQUE (item_type, item_id)
);

CREATE INDEX idx_saved_type ON saved_items (item_type, saved_at DESC);

CREATE TABLE repository_user_state (
    repository_id INTEGER PRIMARY KEY REFERENCES repositories(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'untracked' CHECK (status IN ('untracked', 'pending', 'tried', 'archived')),
    note TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE project_ideas (
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

CREATE INDEX idx_ideas_status ON project_ideas (status, updated_at DESC);
CREATE INDEX idx_ideas_difficulty ON project_ideas (difficulty, updated_at DESC);
CREATE INDEX idx_ideas_category ON project_ideas (category, updated_at DESC);

CREATE TABLE idea_repositories (
    idea_id INTEGER NOT NULL REFERENCES project_ideas(id) ON DELETE CASCADE,
    repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('data_source', 'processing', 'ai', 'visualization', 'inspiration', 'tooling')),
    PRIMARY KEY (idea_id, repository_id, role)
);

CREATE INDEX idx_idea_repositories_repo ON idea_repositories (repository_id);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE worker_leases (
    lease_key TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('starting', 'idle', 'running', 'stopping')),
    current_job TEXT,
    started_at TEXT NOT NULL,
    heartbeat_at TEXT NOT NULL,
    version TEXT NOT NULL
);

CREATE TABLE http_cache (
    cache_key TEXT PRIMARY KEY,
    etag TEXT,
    last_modified TEXT,
    status_code INTEGER,
    payload_json TEXT,
    fetched_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX idx_http_cache_expiry ON http_cache (expires_at);

CREATE TABLE rate_limit_state (
    provider TEXT PRIMARY KEY,
    remaining INTEGER CHECK (remaining IS NULL OR remaining >= 0),
    limit_total INTEGER CHECK (limit_total IS NULL OR limit_total >= 0),
    reset_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE TABLE link_checks (
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

CREATE INDEX idx_link_checks_entity ON link_checks (entity_type, entity_id, link_type, checked_at DESC);
```

## 5. Descripción de entidades

### 5.1 `sources`

Define cada fuente configurable. `config_json` contiene parámetros específicos del conector:

- `github_api`: `queries` (lista de búsquedas), `per_page`, `max_pages`, `detail_refresh_limit`.
- `rss`: `feed_url`, `category`, `max_items`.
- `agent_reach`: `channel`, `action`, `params`, `max_items`.
- `web`: `url`, `extract` (reglas de extracción).

`interval_minutes` se valida entre 5 minutos y 7 días. Los defaults se documentan en `docs/source-policy.md`.

### 5.2 `source_runs`

Registro append-only de cada ejecución. `status = partial` significa que se obtuvieron algunos datos pero hubo errores recuperables. `metadata_json` puede incluir intentos, códigos HTTP, cache hits y páginas procesadas.

### 5.3 `job_requests`

Cola de trabajos manuales. `source_id = NULL` significa “todas las fuentes habilitadas”. El worker reclama filas `pending` con transacción y actualiza a `claimed`.

### 5.4 `repositories`

Entidad canónica de repositorio. `github_id` es la clave natural única; `full_name` también es única. `source_id` es la fuente del primer descubrimiento; `repository_sources` conserva todas las fuentes que lo vieron.

Campos obligatorios: `github_id`, `full_name`, `owner_login`, `name`, `html_url`, `created_at`, `updated_at`, `first_seen_at`, `last_seen_at`.

Campos que pueden ser `NULL`: `description`, `homepage_url`, `docs_url`, `language`, `license_spdx`, `license_name`, `pushed_at`, `watchers`, `readme_excerpt`, `subcategory`, `last_synced_at`.

### 5.5 `repository_snapshots`

Serie temporal para calcular crecimiento. Se captura como máximo **una vez por hora** por repositorio; `captured_at` se trunca a la hora (`YYYY-MM-DDTHH:00:00Z`). La restricción `UNIQUE(repository_id, captured_at)` evita duplicados.

### 5.5.1 `repository_embeddings`

Vector semántico por repositorio para el modelo activo.

- `vector`: `float32` little-endian, serializado como `BLOB`; longitud = `dimensions * 4` bytes.
- `content_hash`: hash del texto canónico usado para generar el embedding (`full_name`, `description`, `topics`, `language`, `category`, `subcategory`, `readme_excerpt`). Si cambia, se recalcula.
- `model_name`: nombre exacto del modelo (ej. `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`).
- `model_version`: revisión del modelo si está disponible; puede ser `NULL`.
- Una fila por repositorio y modelo activo. Si se cambia de modelo, se puede reindexar; la clave primaria actual asume un solo modelo activo por repo. Para múltiples modelos simultáneos se migrará a `PRIMARY KEY (repository_id, model_name)`.
- Los vectores se normalizan L2 antes de guardarse; la similitud coseno se calcula con producto punto.
- No se guardan textos completos en esta tabla.

### 5.6 `news_items` y `news_item_sources`

`news_items` es la entidad canónica por URL. `news_item_sources` registra cada feed/origen que publicó esa URL, con su `external_id` (GUID o hash del enlace).

### 5.7 `saved_items`

Tabla polimórfica y **fuente única de verdad de “guardado/favorito”** para repositorios, noticias e ideas. No tiene FK a la entidad porque `item_type` varía. La API valida que `item_id` exista antes de insertar. `UNIQUE(item_type, item_id)` impide duplicados.

El campo `Idea.favorite` de la API se deriva de la existencia de una fila `saved_items(item_type='idea', item_id=...)`; no se almacena por separado en `project_ideas`.

### 5.8 `project_ideas`

Ideas generadas o manuales. `generation_key` es único y determinista para evitar duplicados. `idea_repositories` conserva la trazabilidad a repositorios reales; una idea no puede existir sin al menos un repositorio asociado (regla de aplicación). El estado (`pending`/`in_progress`/`completed`) es independiente de que la idea esté guardada como favorita.

### 5.9 `link_checks`

Auditoría de verificación de enlaces. Es append-only; la consulta usa el registro más reciente por `(entity_type, entity_id, link_type)`. `ok = 1` solo para HTTP 2xx/3xx; 403/405 se consideran “no verificados” y no habilitan un enlace como verificado.

### 5.10 `settings`

Pares clave/valor con `value_json` validado por la aplicación. Claves mínimas de la v1:

| Clave | Tipo | Default | Descripción |
|---|---|---|---|
| `scheduler.enabled` | bool | `true` | Activa jobs periódicos |
| `scheduler.max_concurrent_jobs` | int | `2` | Jobs simultáneos máximos |
| `worker.heartbeat_seconds` | int | `10` | Frecuencia de heartbeat |
| `worker.stale_after_seconds` | int | `30` | Umbral para worker offline |
| `http.timeout_seconds` | int | `15` | Timeout HTTP |
| `http.max_concurrent` | int | `4` | Descargas simultáneas |
| `retention.source_runs_days` | int | `90` | Retención de runs |
| `retention.snapshots_days` | int | `400` | Retención de snapshots |
| `retention.news_days` | int | `365` | Retención de noticias (0 = sin límite) |
| `links.verify_interval_days` | int | `7` | Re-verificación de enlaces |
| `ideas.auto_generate` | bool | `true` | Generar ideas tras ingesta |
| `ideas.min_new_repos` | int | `10` | Umbral para auto-generar |
| `ideas.max_per_run` | int | `5` | Ideas máximas por ejecución |
| `ui.theme` | string | `dark` | Tema de UI |
| `llm.enabled` | bool | `false` | LLM opcional |
| `llm.provider` | string/null | `null` | Proveedor opcional |
| `llm.model` | string/null | `null` | Modelo opcional |
| `embeddings.enabled` | bool | `true` | Habilita búsqueda semántica si el sidecar está disponible |
| `embeddings.model` | string | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Modelo local |
| `embeddings.batch_size` | int | `32` | Textos por lote |
| `embeddings.max_repos_per_run` | int | `200` | Repos indexados por ejecución |
| `embeddings.interval_minutes` | int | `360` | Frecuencia del job de indexación |
| `embeddings.auto_download` | bool | `false` | Descargar modelo automáticamente |
| `embeddings.min_similarity` | number | `0.25` | Umbral mínimo para mostrar resultados semánticos |
| `embeddings.sidecar_url` | string | `http://127.0.0.1:8766` | URL local del sidecar |

## 6. Reglas de deduplicación

### 6.1 Repositorios

1. Clave primaria natural: `github_id`.
2. Clave secundaria: `full_name` normalizado (trim, sin espacios, comparación case-insensitive).
3. Si llega un repo existente:
   - actualizar metadatos,
   - conservar `first_seen_at`,
   - actualizar `last_seen_at`,
   - agregar/actualizar `repository_sources`,
   - no crear una fila nueva.
4. Si `github_id` cambia pero `full_name` coincide, se trata como el mismo repo y se actualiza `github_id` solo si la API lo confirma; si hay conflicto, se registra error y se conserva el registro existente.
5. Repos eliminados/renombrados: no se borran; se actualiza `full_name` si la API lo confirma y se conserva el anterior en `metadata_json`/log.

### 6.2 Noticias

1. Canonicalización de URL:
   - esquema y host en minúsculas,
   - eliminar fragmento (`#...`),
   - eliminar puerto por defecto (`:80`, `:443`),
   - eliminar parámetros de tracking: `utm_*`, `fbclid`, `gclid`, `mc_cid`, `mc_eid`, `ref_src`, `ref_url`,
   - ordenar parámetros de query restantes,
   - eliminar barra final salvo en la raíz.
2. `url_hash = SHA-256(canonical_url)`; `UNIQUE(url_hash)`.
3. Si la misma URL llega desde otro feed, se agrega a `news_item_sources`; no se duplica la noticia.
4. Si el título/resumen cambia en el mismo `url_hash`, se actualiza `content_hash` y los campos de texto; se conserva `first_seen_at` del origen.
5. `external_id` debe ser el GUID del feed o, si no existe, el hash de la URL canónica.

### 6.3 Ideas

1. `generation_key = SHA-256(template_id + "|" + sorted(repository_ids).join(",") + "|" + difficulty + "|" + category)`.
2. Si la clave ya existe, no se crea una idea nueva; se actualiza `updated_at` solo si cambió el contenido.
3. Ideas manuales usan `generation_key = "manual:" + UUID`.
4. Una idea debe tener al menos una fila en `idea_repositories`; si no, se rechaza.

### 6.4 Tags

- `slug` único, generado a partir del nombre en minúsculas, sin acentos, con guiones.
- Si el tag ya existe, se reutiliza.

### 6.5 Snapshots

- `captured_at` truncado a la hora.
- `UNIQUE(repository_id, captured_at)`.
- Si ya existe, se actualiza el registro con los valores más recientes de esa hora (no se crea otro).

### 6.6 Runs y jobs

- `source_runs` es append-only; no se deduplica.
- `job_requests` puede tener varias solicitudes para la misma fuente; el worker puede agruparlas si están pendientes, pero debe registrar cada una como `done` o `cancelled`.

### 6.7 Embeddings

1. Clave: `repository_id` (un vector por repo y modelo activo).
2. `content_hash` se calcula sobre el texto canónico; si no cambia, no se recalcula.
3. Si cambia el modelo configurado, se reindexa; el vector anterior se reemplaza.
4. Los vectores se normalizan L2; la similitud coseno es el producto punto.
5. Si el sidecar no está disponible, no se borran los vectores existentes; la búsqueda semántica se desactiva.
6. La indexación es incremental: solo repos sin embedding o con `content_hash` distinto.

## 7. Historial y retención

| Dato | Política |
|---|---|
| `source_runs` | Se conservan 90 días por defecto; configurable. |
| `repository_snapshots` | Se conservan 400 días; configurable. |
| `repository_embeddings` | Se conservan mientras exista el repositorio; se reemplazan al cambiar el modelo. |
| `news_items` | Se conservan 365 días; configurable (0 = sin límite). |
| `repositories` | No se borran automáticamente; se marca `last_seen_at`. |
| `saved_items` | No se borran automáticamente. |
| `project_ideas` | No se borran automáticamente. |
| `link_checks` | Se conservan 180 días; la UI usa el último. |
| `http_cache` | Se purga por `expires_at`. |

La limpieza se ejecuta como job diario del worker y registra un `source_run` interno o log; nunca elimina datos guardados por el usuario.

## 8. Modelo de scoring

### 8.1 Componentes (0..1)

**Popularidad** (`popularity_score`):

```text
norm_stars = min(1, log10(1 + stars) / 6)
norm_forks = min(1, log10(1 + forks) / 5)
popularity = 0.7 * norm_stars + 0.3 * norm_forks
```

**Crecimiento** (`growth_score`):

- Requiere al menos 2 snapshots dentro de la ventana (`1d`, `7d`, `30d`).
- `delta = stars_actual - stars_inicio_ventana`
- `per_day = delta / días_transcurridos`
- `growth = clamp(per_day / 100, 0, 1)`
- Si no hay snapshots suficientes: `growth_score = NULL` y `star_growth.delta = NULL` en la API.

**Actividad** (`activity_score`):

```text
recency = 1.0 si pushed_at <= 7 días
          0.8 si <= 30 días
          0.5 si <= 90 días
          0.2 si <= 365 días
          0.0 en otro caso
commits = min(1, commits_recent / 20) si el dato existe
activity = 0.7 * recency + 0.3 * commits   (si commits existe)
activity = recency                          (si commits no existe)
```

**Mantenimiento** (`maintenance_score`):

```text
base = 1.0
- 0.60 si archived = 1
- 0.60 si disabled = 1
- 0.15 si license_spdx IS NULL
- 0.10 si description IS NULL
- 0.10 si homepage_url IS NULL y docs_url IS NULL
- 0.25 si pushed_at > 365 días o IS NULL
- 0.10 si open_issues / max(1, stars) > 0.5
maintenance = clamp(base, 0, 1)
```

**Relevancia** (`relevance_score`):

- Si el usuario no configuró intereses: `0.5` neutral.
- Si configuró categorías/tags:
  - `category_match = 1` si `category` está en intereses, si no `0`.
  - `tag_match = |tags ∩ intereses| / max(1, |tags|)`.
  - `relevance = 0.6 * category_match + 0.4 * tag_match`.

**Calidad** (`quality_score`): señal independiente de popularidad.

```text
quality = 0.45 * maintenance + 0.35 * activity + 0.20 * license_present
license_present = 1 si license_spdx IS NOT NULL, si no 0
```

**Interés** (`interest_score`): ranking principal, explicable. **No confundir con similitud léxica**.

```text
pesos = {
  growth: 0.30,
  activity: 0.20,
  maintenance: 0.20,
  relevance: 0.15,
  popularity: 0.15
}
```

- Si `growth` es `NULL`, se excluye y los pesos restantes se renormalizan a suma 1.
- `interest = Σ(componente * peso_efectivo)`.
- `score_explanation_json` guarda componentes, pesos efectivos, entradas y campos faltantes.

> **Importante:** `interest_score` es un ranking personalizado por metadatos (categorías, tags, crecimiento, actividad, mantenimiento). **No es una medida de similitud léxica** sobre el texto del repositorio. Para búsqueda por texto/keywords, usar modo `metadata` en `/repositories/{id}/similar` o la API `/search?mode=keyword`.

> **Regla de producto:** la UI debe mostrar `quality_score` y `popularity_score` por separado. No se debe presentar un repo popular como “de calidad” solo por sus estrellas.

### 8.2 Recalculo

- Se recalcula al finalizar cada ingesta que afecte al repositorio.
- Se recalcula también en un job diario.
- Los snapshots se capturan antes de recalcular crecimiento.

### 8.3 Similitud semántica

- El vector del repositorio se genera desde un texto canónico que incluye nombre, descripción, topics, lenguaje, categoría, subcategoría y extracto de README.
- La similitud entre dos repositorios es `cosine(a, b) = dot(a, b)` porque los vectores están normalizados L2.
- La búsqueda semántica por texto requiere embeber la consulta en el sidecar y comparar contra la matriz de vectores.
- `similarity` se expone en la API como número 0..1; no implica calidad ni relevancia absoluta.

**Modos de búsqueda** (api-contract.md §7.4):

| Modo | Qué usa | Requisito | Si no hay embeddings |
|------|---------|-----------|----------------------|
| `metadata` | Mismo `category`, tags en común o mismo `language`; ordena por `interest_score` | Ninguno | Funciona normally |
| `semantic` | Similitud coseno contra los embeddings | Sidecar + modelo cargado | `503 EMBEDDINGS_UNAVAILABLE` |
| `hybrid` | `0.7 * similarity + 0.3 * interest_score` | Sidecar + modelo cargado | `200` con `mode_used: "metadata"` |

- `similarity` no es una medida de calidad; la UI debe etiquetarla como "similitud semántica".
- Umbral mínimo por defecto: `embeddings.min_similarity = 0.25`; resultados por debajo se omiten.
- Los pesos híbridos propuestas iniciales: `0.7 * similarity + 0.3 * interest_score` (pendiente de aprobación formal en F7).
- Si cambia el modelo configurado, se reindexa; el vector anterior se reemplaza.

## 9. Reglas de integridad y transacciones

1. `PRAGMA foreign_keys = ON` en cada conexión.
2. Upsert de repositorio + tags + `repository_sources` + snapshot en una transacción.
3. Upsert de noticia + `news_item_sources` + tags en una transacción.
4. Creación de idea + `idea_repositories` en una transacción.
5. `saved_items` se valida contra la entidad antes de insertar.
6. No se permite `source_id = NULL` en `source_runs`.
7. No se permite una idea sin repositorios.
8. No se permite un `link_check` con `ok = 1` y `status_code` fuera de 200–399.
9. Los campos `*_json` deben ser JSON válido; la aplicación los valida antes de escribir.
10. `repository_embeddings.vector` debe tener exactamente `dimensions * 4` bytes y corresponder al `model_name` activo.
11. No se guarda un embedding si el `content_hash` no coincide con el texto canónico actual.
12. La búsqueda semántica no debe devolver resultados si el modelo del vector no coincide con el modelo configurado.

## 10. Migraciones y evolución

- Versión inicial: `1`.
- Cada migración incrementa `schema_migrations.version`.
- Las migraciones deben ser:
  - idempotentes,
  - transaccionales cuando SQLite lo permita,
  - compatibles con datos existentes.
- Cambios de contrato que afecten la API requieren actualizar `docs/api-contract.md` antes de implementar.
- Campos nuevos: `NULL` por defecto o default explícito; nunca romper filas existentes.

## 11. Decisiones pendientes de aprobación

1. DDL completo y nombres de tablas/campos.
2. Pesos de scoring (crecimiento 30 %, actividad 20 %, mantenimiento 20 %, relevancia 15 %, popularidad 15 %).
3. Fórmula de `quality_score` separada de popularidad.
4. Retención por defecto (90/400/365 días).
5. Uso de `INTEGER` autoincremental como IDs públicos de API.
6. Política de snapshots horarios y ventanas de crecimiento 1d/7d/30d.
7. Canonicalización de URLs de noticias (lista de parámetros de tracking).
8. Modelo de embeddings y dimensión (multilingüe vs. inglés).
9. Una fila por repo/modelo activo vs. múltiples modelos simultáneos.
10. Pesos del modo híbrido (`similarity` + `interest_score`).
