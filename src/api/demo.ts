import type {
  Capabilities,
  EmbeddingStatus,
  Idea,
  IdeaQuery,
  NewsItem,
  NewsQuery,
  Overview,
  Paginated,
  RepositoryDetail,
  RepositoryQuery,
  RepositorySummary,
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

/**
 * Explicitly labelled design-preview dataset.
 *
 * It is ONLY served while the local API is unreachable, always behind the
 * "Modo demostración" banner. It never overwrites live data. Names and metrics
 * are illustrative and must not be presented as real information.
 */

const now = Date.now();
const iso = (daysAgo: number, hoursAgo = 0) =>
  new Date(now - daysAgo * 86_400_000 - hoursAgo * 3_600_000).toISOString();

const score = (over: Partial<RepositorySummary["scores"]> = {}) => ({
  popularity: 0.72,
  growth: 0.68,
  activity: 0.84,
  maintenance: 0.79,
  relevance: 0.74,
  interest: 0.78,
  quality: 0.81,
  ...over,
});

function growth(delta: number | null, window: "1d" | "7d" | "30d" = "7d") {
  if (delta === null) {
    return { window, delta: null, per_day: null, from_at: null, to_at: null };
  }
  return {
    window,
    delta,
    per_day: Number((delta / (window === "1d" ? 1 : window === "7d" ? 7 : 30)).toFixed(2)),
    from_at: iso(window === "1d" ? 1 : window === "7d" ? 7 : 30),
    to_at: iso(0),
  };
}

type RepoSeed = Partial<RepositorySummary> & {
  id: number;
  full_name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  growth: number | null;
};

function makeRepo(seed: RepoSeed): RepositorySummary {
  const [owner, name] = seed.full_name.split("/");
  const base: RepositorySummary = {
    id: seed.id,
    github_id: 900_000 + seed.id * 137,
    full_name: seed.full_name,
    owner_login: owner,
    name,
    description: seed.description,
    html_url: `https://github.com/${seed.full_name}`,
    homepage_url: seed.homepage_url ?? null,
    docs_url: seed.docs_url ?? null,
    language: seed.language,
    license_spdx: seed.license_spdx ?? "MIT",
    stars: seed.stars,
    forks: seed.forks,
    open_issues: seed.open_issues ?? Math.round(seed.forks * 0.12),
    created_at: seed.created_at ?? iso(520),
    updated_at: seed.updated_at ?? iso(0, 4),
    pushed_at: seed.pushed_at ?? iso(0, 9),
    category: seed.category ?? "ai",
    subcategory: seed.subcategory ?? null,
    tags: seed.tags ?? [],
    scores: score(seed.scores),
    star_growth: seed.star_growth ?? growth(seed.growth),
    first_seen_at: seed.first_seen_at ?? iso(9),
    last_seen_at: seed.last_seen_at ?? iso(0, 2),
    saved: seed.saved ?? false,
    user_status: seed.user_status ?? "untracked",
  };
  return { ...base, ...seed, scores: base.scores, star_growth: base.star_growth };
}

const repositories: RepositorySummary[] = [
  makeRepo({
    id: 1,
    full_name: "aurora-labs/agent-forge",
    description:
      "Runtime modular para agentes autónomos con trazas, herramientas tipadas y evaluación reproducible. Diseñado para equipos que necesitan observar cada decisión.",
    language: "TypeScript",
    stars: 18_420,
    forks: 1_284,
    growth: 412,
    category: "ai",
    subcategory: "agents",
    tags: ["agents", "llm", "orchestration", "observability"],
    scores: score({ popularity: 0.88, growth: 0.91, interest: 0.93, quality: 0.9 }),
    license_spdx: "Apache-2.0",
    saved: true,
    first_seen_at: iso(4),
  }),
  makeRepo({
    id: 2,
    full_name: "vectorwave/streamforge",
    description:
      "Motor de streaming incremental con conectores declarativos, exactly-once local y validación de esquemas en tiempo real.",
    language: "Python",
    stars: 9_310,
    forks: 742,
    growth: 186,
    category: "data_engineering",
    subcategory: "streaming",
    tags: ["streaming", "etl", "kafka", "schema"],
    scores: score({ popularity: 0.71, growth: 0.76, interest: 0.82, quality: 0.85 }),
    license_spdx: "Apache-2.0",
    first_seen_at: iso(6),
  }),
  makeRepo({
    id: 3,
    full_name: "nimbus-ml/tensorpilot",
    description:
      "Orquestación de entrenamientos distribuidos con presupuestos de GPU, checkpoints incrementales y comparación de experimentos.",
    language: "Python",
    stars: 12_480,
    forks: 968,
    growth: 305,
    category: "machine_learning",
    subcategory: "training",
    tags: ["training", "gpu", "experiments", "mlops"],
    scores: score({ popularity: 0.79, growth: 0.84, interest: 0.87, quality: 0.86 }),
    license_spdx: "MIT",
    first_seen_at: iso(2),
  }),
  makeRepo({
    id: 4,
    full_name: "prism-dev/edgekit",
    description:
      "Toolkit de rendimiento para aplicaciones edge: perfilado de arranque, análisis de bundles y simulación de latencia regional.",
    language: "Rust",
    stars: 6_120,
    forks: 318,
    growth: 91,
    category: "dev_tools",
    subcategory: "performance",
    tags: ["performance", "edge", "profiling", "cli"],
    scores: score({ popularity: 0.58, growth: 0.55, interest: 0.66, quality: 0.79 }),
    license_spdx: "MIT",
    first_seen_at: iso(8),
  }),
  makeRepo({
    id: 5,
    full_name: "orbit-data/lakehouse-cli",
    description:
      "CLI para inspeccionar tablas Iceberg, validar particiones y comparar planes de ejecución sin abrir un notebook.",
    language: "Go",
    stars: 4_470,
    forks: 264,
    growth: null,
    category: "data_engineering",
    subcategory: "lakehouse",
    tags: ["iceberg", "cli", "lakehouse", "sql"],
    scores: score({ popularity: 0.49, growth: null, interest: 0.57, quality: 0.68 }),
    license_spdx: null,
    first_seen_at: iso(1),
  }),
  makeRepo({
    id: 6,
    full_name: "monolith/webgpu-ui",
    description:
      "Primitivas de interfaz aceleradas por WebGPU con fallbacks CSS y un sistema de motion que respeta prefers-reduced-motion.",
    language: "TypeScript",
    stars: 7_830,
    forks: 512,
    growth: 210,
    category: "web",
    subcategory: "rendering",
    tags: ["webgpu", "ui", "motion", "shaders"],
    scores: score({ popularity: 0.63, growth: 0.72, interest: 0.77, quality: 0.82 }),
    license_spdx: "MIT",
    first_seen_at: iso(5),
  }),
  makeRepo({
    id: 7,
    full_name: "synapse-ai/rag-mesh",
    description:
      "Capa de recuperación híbrida con enrutado por consulta, citas verificables y evaluación continua de contexto.",
    language: "Python",
    stars: 15_240,
    forks: 1_102,
    growth: 388,
    category: "ai",
    subcategory: "rag",
    tags: ["rag", "retrieval", "citations", "evaluation"],
    scores: score({ popularity: 0.84, growth: 0.89, interest: 0.91, quality: 0.88 }),
    license_spdx: "Apache-2.0",
    saved: true,
    first_seen_at: iso(3),
  }),
  makeRepo({
    id: 8,
    full_name: "quantum-stack/flowviz",
    description:
      "Visualización interactiva de pipelines de datos con vistas de linaje, cuellos de botella y calidad por etapa.",
    language: "JavaScript",
    stars: 3_280,
    forks: 198,
    growth: 44,
    category: "data_science",
    subcategory: "visualization",
    tags: ["visualization", "lineage", "pipelines", "d3"],
    scores: score({ popularity: 0.41, growth: 0.39, interest: 0.52, quality: 0.64 }),
    license_spdx: null,
    first_seen_at: iso(11),
  }),
];

const news: NewsItem[] = [
  {
    id: 1,
    title: "Los agentes de IA abandonan el chat y entran en el IDE",
    summary:
      "Una nueva generación de herramientas integra planificación, ejecución y revisión dentro del flujo de desarrollo, con trazas auditables como requisito.",
    url: "https://example.com/demo/agents-in-the-ide",
    source: { id: 3, key: "ai-frontier", name: "AI Frontier" },
    sources: [
      { id: 3, key: "ai-frontier", name: "AI Frontier", external_id: "af-1", first_seen_at: iso(0, 5) },
    ],
    author: "Redacción",
    published_at: iso(0, 3),
    fetched_at: iso(0, 2),
    category: "ai",
    importance_score: 0.94,
    importance_label: "high",
    tags: ["agents", "ide", "developer-tools"],
    link_status: "verified",
    saved: false,
  },
  {
    id: 2,
    title: "WebGPU se consolida como base de interfaces generativas",
    summary:
      "Los frameworks de UI empiezan a tratar los shaders como primitivas de diseño, con presupuestos de GPU y degradación explícita.",
    url: "https://example.com/demo/webgpu-interfaces",
    source: { id: 4, key: "render-weekly", name: "Render Weekly" },
    sources: [
      { id: 4, key: "render-weekly", name: "Render Weekly", external_id: "rw-2", first_seen_at: iso(0, 8) },
    ],
    author: null,
    published_at: iso(0, 7),
    fetched_at: iso(0, 6),
    category: "dev",
    importance_score: 0.86,
    importance_label: "high",
    tags: ["webgpu", "frontend", "shaders"],
    link_status: "verified",
    saved: true,
  },
  {
    id: 3,
    title: "El streaming híbrido por lotes gana terreno en data engineering",
    summary:
      "Equipos de datos adoptan procesamiento incremental con ventanas de recuperación, reduciendo costes sin renunciar a la consistencia.",
    url: "https://example.com/demo/hybrid-streaming",
    source: { id: 5, key: "data-weekly", name: "Data Engineering Weekly" },
    sources: [
      { id: 5, key: "data-weekly", name: "Data Engineering Weekly", external_id: "dw-3", first_seen_at: iso(1, 2) },
    ],
    author: "Equipo editorial",
    published_at: iso(1),
    fetched_at: iso(1),
    category: "data",
    importance_score: 0.74,
    importance_label: "medium",
    tags: ["streaming", "lakehouse", "cost"],
    link_status: "verified",
    saved: false,
  },
  {
    id: 4,
    title: "Rust mejora la compilación incremental en proyectos grandes",
    summary:
      "La nueva versión reduce el trabajo repetido entre crates y mejora la experiencia en monorepos con cientos de dependencias.",
    url: "https://example.com/demo/rust-incremental",
    source: { id: 6, key: "systems-note", name: "Systems Note" },
    sources: [
      { id: 6, key: "systems-note", name: "Systems Note", external_id: "sn-4", first_seen_at: iso(1, 6) },
    ],
    author: null,
    published_at: iso(1, 5),
    fetched_at: iso(1, 4),
    category: "dev",
    importance_score: 0.68,
    importance_label: "medium",
    tags: ["rust", "compiler", "monorepo"],
    link_status: "verified",
    saved: false,
  },
  {
    id: 5,
    title: "Nuevos estándares para evaluar la fiabilidad de pipelines RAG",
    summary:
      "Métricas de cobertura de citas y trazabilidad de contexto buscan separar la recuperación útil de la coincidencia superficial.",
    url: "https://example.com/demo/rag-evaluation",
    source: { id: 3, key: "ai-frontier", name: "AI Frontier" },
    sources: [
      { id: 3, key: "ai-frontier", name: "AI Frontier", external_id: "af-5", first_seen_at: iso(2) },
    ],
    author: "Investigación",
    published_at: iso(2),
    fetched_at: iso(2),
    category: "ai",
    importance_score: 0.81,
    importance_label: "high",
    tags: ["rag", "evaluation", "citations"],
    link_status: "verified",
    saved: false,
  },
  {
    id: 6,
    title: "La observabilidad de modelos entra en el ciclo de desarrollo",
    summary:
      "Las herramientas de trazas se integran con tests y revisión de código para detectar regresiones antes del despliegue.",
    url: "https://example.com/demo/model-observability",
    source: { id: 7, key: "product-signal", name: "Product Signal" },
    sources: [
      { id: 7, key: "product-signal", name: "Product Signal", external_id: "ps-6", first_seen_at: iso(3) },
    ],
    author: null,
    published_at: iso(3),
    fetched_at: iso(3),
    category: "product",
    importance_score: 0.59,
    importance_label: "low",
    tags: ["observability", "mlops", "testing"],
    link_status: "unverified",
    saved: false,
  },
];

const ideas: Idea[] = [
  {
    id: 1,
    title: "Radar de repositorios con ranking explicable",
    summary:
      "Un panel que combina señales de actividad, mantenimiento y crecimiento, y explica por qué un repositorio sube o baja.",
    problem:
      "Las listas de tendencias muestran popularidad agregada sin explicar el contexto ni la calidad del mantenimiento.",
    how_it_works:
      "Normaliza snapshots diarios, calcula componentes de score y presenta la contribución de cada señal junto a la serie histórica.",
    technologies: ["TypeScript", "SQLite", "SVG", "FastAPI"],
    difficulty: "advanced",
    category: "ai",
    expansion: "Añadir alertas cuando el crecimiento se acelera sin un aumento proporcional de issues abiertos.",
    portfolio_value: "portfolio",
    status: "in_progress",
    favorite: true,
    generated_by: "rules",
    repositories: [
      { id: 1, full_name: "aurora-labs/agent-forge", html_url: "https://github.com/aurora-labs/agent-forge", role: "data_source" },
      { id: 7, full_name: "synapse-ai/rag-mesh", html_url: "https://github.com/synapse-ai/rag-mesh", role: "inspiration" },
    ],
    created_at: iso(5),
    updated_at: iso(0, 6),
  },
  {
    id: 2,
    title: "Pipeline local de noticias con deduplicación semántica",
    summary:
      "Un recolector de feeds que agrupa la misma noticia publicada en varias fuentes y conserva la procedencia original.",
    problem:
      "Los agregadores repiten titulares y pierden la relación entre coberturas, lo que dificulta evaluar importancia real.",
    how_it_works:
      "Canonicaliza URLs, calcula embeddings locales y agrupa por similitud con umbral configurable; cada grupo conserva todas las fuentes.",
    technologies: ["Python", "FastAPI", "sentence-transformers", "SQLite"],
    difficulty: "intermediate",
    category: "data_engineering",
    expansion: "Añadir un modo de resumen comparativo entre fuentes sin inventar contenido.",
    portfolio_value: "learning",
    status: "pending",
    favorite: false,
    generated_by: "rules",
    repositories: [
      { id: 2, full_name: "vectorwave/streamforge", html_url: "https://github.com/vectorwave/streamforge", role: "processing" },
    ],
    created_at: iso(7),
    updated_at: iso(1),
  },
  {
    id: 3,
    title: "Asistente de evaluación de agentes con trazas",
    summary:
      "Una herramienta que reproduce ejecuciones de agentes, compara decisiones y detecta regresiones entre versiones.",
    problem:
      "Los agentes cambian de comportamiento sin que los tests tradicionales capturen la calidad de sus decisiones.",
    how_it_works:
      "Registra trazas estructuradas, las reproduce con herramientas simuladas y compara resultados contra una línea base aprobada.",
    technologies: ["TypeScript", "OpenTelemetry", "React", "SQLite"],
    difficulty: "advanced",
    category: "ai",
    expansion: "Integrar presupuestos de tokens y latencia por escenario.",
    portfolio_value: "commercial",
    status: "pending",
    favorite: true,
    generated_by: "rules",
    repositories: [
      { id: 1, full_name: "aurora-labs/agent-forge", html_url: "https://github.com/aurora-labs/agent-forge", role: "tooling" },
      { id: 3, full_name: "nimbus-ml/tensorpilot", html_url: "https://github.com/nimbus-ml/tensorpilot", role: "inspiration" },
    ],
    created_at: iso(10),
    updated_at: iso(2),
  },
  {
    id: 4,
    title: "Explorador visual de snapshots de GitHub",
    summary:
      "Un visor que convierte series de estrellas, forks e issues en comparaciones legibles entre proyectos similares.",
    problem:
      "Las métricas aisladas ocultan si el crecimiento viene acompañado de mantenimiento saludable.",
    how_it_works:
      "Carga snapshots por ventana, normaliza escalas y superpone series con anotaciones de eventos relevantes.",
    technologies: ["React", "SVG", "FastAPI"],
    difficulty: "beginner",
    category: "data_science",
    expansion: "Exportar comparaciones como imágenes para documentación técnica.",
    portfolio_value: "internship",
    status: "completed",
    favorite: false,
    generated_by: "manual",
    repositories: [
      { id: 8, full_name: "quantum-stack/flowviz", html_url: "https://github.com/quantum-stack/flowviz", role: "visualization" },
    ],
    created_at: iso(14),
    updated_at: iso(4),
  },
];

const sources: Source[] = [
  {
    id: 1,
    key: "github_search_trending",
    name: "GitHub Trending",
    kind: "github_api",
    category: "github",
    enabled: true,
    interval_minutes: 240,
    config: { queries: ["topic:ai stars:>500", "topic:data-engineering stars:>300"] },
    rate_limit_per_hour: 60,
    last_run_at: iso(0, 1),
    last_success_at: iso(0, 1),
    last_error: null,
    next_run_at: iso(-0.12),
  },
  {
    id: 2,
    key: "github_ai_radar",
    name: "GitHub AI Radar",
    kind: "github_api",
    category: "ai",
    enabled: true,
    interval_minutes: 360,
    config: { queries: ["topic:llm stars:>800", "topic:agents stars:>400"] },
    rate_limit_per_hour: 60,
    last_run_at: iso(0, 2),
    last_success_at: iso(0, 2),
    last_error: null,
    next_run_at: iso(-0.2),
  },
  {
    id: 3,
    key: "ai_frontier_rss",
    name: "AI Frontier",
    kind: "rss",
    category: "news",
    enabled: true,
    interval_minutes: 60,
    config: { url: "https://example.com/demo/feed.xml" },
    rate_limit_per_hour: null,
    last_run_at: iso(0, 3),
    last_success_at: iso(0, 3),
    last_error: null,
    next_run_at: iso(-0.02),
  },
  {
    id: 4,
    key: "data_weekly_rss",
    name: "Data Engineering Weekly",
    kind: "rss",
    category: "news",
    enabled: true,
    interval_minutes: 120,
    config: { url: "https://example.com/demo/data-feed.xml" },
    rate_limit_per_hour: null,
    last_run_at: iso(0, 5),
    last_success_at: iso(0, 5),
    last_error: null,
    next_run_at: iso(-0.06),
  },
  {
    id: 5,
    key: "agent_reach_youtube",
    name: "Agent Reach · YouTube",
    kind: "agent_reach",
    category: "other",
    enabled: false,
    interval_minutes: 360,
    config: { channel: "youtube" },
    rate_limit_per_hour: 30,
    last_run_at: iso(1),
    last_success_at: iso(1),
    last_error: "Canal no disponible en la última comprobación.",
    next_run_at: null,
  },
];

const runs: SourceRun[] = [
  {
    id: 104,
    source_id: 1,
    source_key: "github_search_trending",
    source_name: "GitHub Trending",
    trigger: "schedule",
    status: "success",
    started_at: iso(0, 1),
    finished_at: iso(0, 0.98),
    items_fetched: 50,
    items_new: 12,
    items_updated: 38,
    items_skipped: 0,
    error_code: null,
    error_message: null,
    duration_ms: 12_400,
  },
  {
    id: 103,
    source_id: 3,
    source_key: "ai_frontier_rss",
    source_name: "AI Frontier",
    trigger: "schedule",
    status: "success",
    started_at: iso(0, 3),
    finished_at: iso(0, 2.98),
    items_fetched: 18,
    items_new: 4,
    items_updated: 14,
    items_skipped: 0,
    error_code: null,
    error_message: null,
    duration_ms: 2_100,
  },
  {
    id: 102,
    source_id: 2,
    source_key: "github_ai_radar",
    source_name: "GitHub AI Radar",
    trigger: "manual",
    status: "partial",
    started_at: iso(0, 4),
    finished_at: iso(0, 3.95),
    items_fetched: 40,
    items_new: 7,
    items_updated: 30,
    items_skipped: 3,
    error_code: "RATE_LIMITED",
    error_message: "Se alcanzó el presupuesto de peticiones; se reintentará en el próximo ciclo.",
    duration_ms: 18_900,
  },
  {
    id: 101,
    source_id: 5,
    source_key: "agent_reach_youtube",
    source_name: "Agent Reach · YouTube",
    trigger: "schedule",
    status: "failed",
    started_at: iso(1),
    finished_at: iso(0.999),
    items_fetched: 0,
    items_new: 0,
    items_updated: 0,
    items_skipped: 0,
    error_code: "SOURCE_UNAVAILABLE",
    error_message: "El canal no está disponible; la fuente permanece deshabilitada.",
    duration_ms: 1_200,
  },
  {
    id: 100,
    source_id: 4,
    source_key: "data_weekly_rss",
    source_name: "Data Engineering Weekly",
    trigger: "schedule",
    status: "success",
    started_at: iso(1, 2),
    finished_at: iso(1, 1.99),
    items_fetched: 22,
    items_new: 6,
    items_updated: 16,
    items_skipped: 0,
    error_code: null,
    error_message: null,
    duration_ms: 1_800,
  },
];

const worker: WorkerStatus = {
  state: "online",
  worker_id: "worker-demo",
  heartbeat_at: iso(0, 0.01),
  current_job: "github_search_trending",
  version: "0.1.0",
  stale_after_seconds: 30,
};

const settings: Settings = {
  settings: {
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
    "embeddings.sidecar_url": "http://127.0.0.1:8766",
  },
};

const embeddings: EmbeddingStatus = {
  enabled: true,
  sidecar: {
    state: "online",
    url: "http://127.0.0.1:8766",
    model: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    dimensions: 384,
    device: "cpu",
    version: "0.1.0",
    last_checked_at: iso(0, 0.05),
  },
  model: {
    name: "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
    downloaded: true,
    download_required: false,
  },
  index: { indexed: 1_240, pending: 12, last_indexed_at: iso(0, 2), active_model: "paraphrase-multilingual-MiniLM-L12-v2" },
};

const capabilities: Capabilities = {
  github_token_configured: false,
  agent_reach: {
    installed: true,
    version: "1.6.1",
    last_checked_at: iso(0, 6),
    channels: [
      { name: "github", status: "ready", default: true },
      { name: "youtube", status: "ready", default: true },
      { name: "web", status: "ready", default: true },
      { name: "reddit", status: "not_added", default: false },
    ],
  },
  llm: { enabled: false, configured: false },
  embeddings: {
    enabled: true,
    sidecar_state: "online",
    model: "paraphrase-multilingual-MiniLM-L12-v2",
    dimensions: 384,
    indexed: 1_240,
    pending: 12,
  },
};

function paginate<T>(items: T[], page = 1, pageSize = 20): Paginated<T> {
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return {
    items: slice,
    page,
    page_size: pageSize,
    total: items.length,
    has_next: page * pageSize < items.length,
  };
}

function matchText(haystack: Array<string | null | undefined>, q?: string) {
  if (!q?.trim()) return true;
  const needle = q.toLowerCase();
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

function filterRepositories(query: RepositoryQuery) {
  let result = [...repositories];
  if (query.q) {
    result = result.filter((repo) =>
      matchText([repo.full_name, repo.description, repo.tags.join(" "), repo.language], query.q),
    );
  }
  if (query.category) {
    const cats = query.category.split(",");
    result = result.filter((repo) => cats.includes(repo.category));
  }
  if (query.language) {
    const langs = query.language.split(",").map((l) => l.toLowerCase());
    result = result.filter((repo) => repo.language && langs.includes(repo.language.toLowerCase()));
  }
  if (query.tag) {
    const tags = query.tag.split(",");
    result = result.filter((repo) => repo.tags.some((tag) => tags.includes(tag)));
  }
  if (query.saved !== undefined) result = result.filter((repo) => repo.saved === query.saved);
  if (query.status) result = result.filter((repo) => repo.user_status === query.status);
  if (query.min_stars !== undefined) result = result.filter((repo) => repo.stars >= query.min_stars!);
  if (query.min_growth !== undefined) {
    result = result.filter(
      (repo) => repo.star_growth.per_day !== null && repo.star_growth.per_day >= query.min_growth!,
    );
  }
  const sort = query.sort ?? "interest";
  const direction = query.order === "asc" ? 1 : -1;
  result.sort((a, b) => {
    const value = (repo: RepositorySummary): number | null => {
      switch (sort) {
        case "stars":
          return repo.stars;
        case "growth":
          return repo.star_growth.per_day;
        case "updated":
          return new Date(repo.updated_at).getTime();
        case "created":
          return new Date(repo.created_at).getTime();
        case "forks":
          return repo.forks;
        default:
          return repo.scores.interest;
      }
    };
    const av = value(a);
    const bv = value(b);
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * direction;
  });
  return result;
}

function detailOf(repo: RepositorySummary): RepositoryDetail {
  return {
    ...repo,
    owner_type: "Organization",
    license_name: repo.license_spdx ? `${repo.license_spdx} License` : null,
    topics: repo.tags,
    readme_excerpt:
      `# ${repo.name}\n\n${repo.description}\n\n## Why this exists\n\n` +
      "Este extracto pertenece al modo de demostración y sirve para validar la jerarquía visual del detalle de repositorio. " +
      "Con la API local activa, este campo se rellena con el README real, truncado por el backend.",
    archived: false,
    disabled: false,
    is_fork: false,
    default_branch: "main",
    watchers: repo.stars,
    last_synced_at: iso(0, 1),
    score_explanation: {
      weights: { growth: 0.3, activity: 0.2, maintenance: 0.2, relevance: 0.15, popularity: 0.15 },
      missing: repo.scores.growth === null ? ["growth"] : [],
      inputs: { stars: repo.stars, forks: repo.forks, pushed_at: repo.pushed_at },
    },
    link_checks: [
      {
        link_type: "html_url",
        url: repo.html_url,
        ok: true,
        status_code: 200,
        checked_at: iso(0, 2),
        error: null,
      },
      ...(repo.homepage_url
        ? [
            {
              link_type: "homepage_url" as const,
              url: repo.homepage_url,
              ok: true,
              status_code: 200,
              checked_at: iso(0, 2),
              error: null,
            },
          ]
        : []),
    ],
    related_ideas: ideas
      .filter((idea) => idea.repositories.some((ref) => ref.id === repo.id))
      .map((idea) => ({
        id: idea.id,
        title: idea.title,
        difficulty: idea.difficulty,
        category: idea.category,
        status: idea.status,
      })),
    similar_repositories: repositories
      .filter((other) => other.id !== repo.id && (other.category === repo.category || other.language === repo.language))
      .slice(0, 4),
  };
}

export const demo = {
  overview(limit = 6): Overview {
    return {
      generated_at: iso(0),
      last_success_at: iso(0, 1),
      counts: {
        repositories: repositories.length,
        news: news.length,
        ideas: ideas.length,
        saved: repositories.filter((r) => r.saved).length + news.filter((n) => n.saved).length + ideas.filter((i) => i.favorite).length,
        sources: sources.length,
      },
      featured_repositories: repositories.slice(0, limit),
      top_news: news.slice(0, limit),
      ai_trends: repositories.filter((r) => r.category === "ai").slice(0, 4),
      new_tools: repositories.filter((r) => ["dev_tools", "web"].includes(r.category)).slice(0, 4),
      recent_runs: runs.slice(0, 5),
      summary_text:
        "8 repositorios y 6 noticias de ejemplo recopilados en el modo de demostración. 4 ideas de proyecto disponibles para explorar la interfaz.",
    };
  },

  repositories(query: RepositoryQuery = {}) {
    return paginate(filterRepositories(query), query.page ?? 1, query.page_size ?? 20);
  },

  repository(id: number) {
    const repo = repositories.find((item) => item.id === id);
    if (!repo) throw new Error("REPOSITORY_NOT_FOUND");
    return detailOf(repo);
  },

  snapshots(id: number, window: "1d" | "7d" | "30d" | "90d" | "365d" = "30d"): SnapshotSeries {
    const repo = repositories.find((item) => item.id === id) ?? repositories[0];
    const days = window === "1d" ? 1 : window === "7d" ? 7 : window === "30d" ? 30 : window === "90d" ? 90 : 365;
    const points = [];
    const perDay = repo.star_growth.per_day ?? 0;
    const total = perDay * days;
    const step = days <= 30 ? 1 : Math.ceil(days / 30);
    for (let offset = days; offset >= 0; offset -= step) {
      const ratio = (days - offset) / Math.max(days, 1);
      points.push({
        captured_at: iso(offset),
        stars: Math.max(0, Math.round(repo.stars - total + total * ratio)),
        forks: Math.max(0, Math.round(repo.forks - repo.forks * 0.08 + repo.forks * 0.08 * ratio)),
        open_issues: Math.max(0, Math.round(repo.open_issues - 2 + 2 * ratio)),
      });
    }
    return { repository_id: repo.id, window, points };
  },

  similar(id: number, mode: SimilarMode = "metadata"): SimilarResponse {
    const repo = repositories.find((item) => item.id === id) ?? repositories[0];
    const items = repositories
      .filter((other) => other.id !== id)
      .slice(0, 4)
      .map((other, index) => ({
        ...other,
        match: {
          mode,
          similarity: mode === "metadata" ? null : Number((0.82 - index * 0.09).toFixed(2)),
          score: Number((0.78 - index * 0.07).toFixed(2)),
        },
      }));
    return { items, mode_requested: mode, mode_used: mode };
  },

  repositoryIdeas(id: number) {
    return {
      items: ideas.filter((idea) => idea.repositories.some((ref) => ref.id === id)),
    };
  },

  news(query: NewsQuery = {}) {
    let result = [...news];
    if (query.q) result = result.filter((item) => matchText([item.title, item.summary, item.tags.join(" ")], query.q));
    if (query.category) {
      const cats = query.category.split(",");
      result = result.filter((item) => cats.includes(item.category));
    }
    if (query.importance) {
      const labels = query.importance.split(",");
      result = result.filter((item) => labels.includes(item.importance_label));
    }
    if (query.saved !== undefined) result = result.filter((item) => item.saved === query.saved);
    if (query.sort === "importance") {
      result.sort((a, b) => (query.order === "asc" ? 1 : -1) * (a.importance_score - b.importance_score));
    } else if (query.sort === "fetched") {
      result.sort((a, b) => (query.order === "asc" ? 1 : -1) * (new Date(a.fetched_at).getTime() - new Date(b.fetched_at).getTime()));
    } else {
      result.sort(
        (a, b) =>
          (query.order === "asc" ? 1 : -1) *
          (new Date(a.published_at ?? a.fetched_at).getTime() - new Date(b.published_at ?? b.fetched_at).getTime()),
      );
    }
    return paginate(result, query.page ?? 1, query.page_size ?? 20);
  },

  newsItem(id: number) {
    const item = news.find((entry) => entry.id === id);
    if (!item) throw new Error("NEWS_NOT_FOUND");
    return item;
  },

  ideas(query: IdeaQuery = {}) {
    let result = [...ideas];
    if (query.q) result = result.filter((idea) => matchText([idea.title, idea.summary, idea.problem, idea.technologies.join(" ")], query.q));
    if (query.difficulty) {
      const values = query.difficulty.split(",");
      result = result.filter((idea) => values.includes(idea.difficulty));
    }
    if (query.category) {
      const values = query.category.split(",");
      result = result.filter((idea) => values.includes(idea.category));
    }
    if (query.status) {
      const values = query.status.split(",");
      result = result.filter((idea) => values.includes(idea.status));
    }
    if (query.favorite !== undefined) result = result.filter((idea) => idea.favorite === query.favorite);
    result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return paginate(result, query.page ?? 1, query.page_size ?? 20);
  },

  idea(id: number) {
    const item = ideas.find((entry) => entry.id === id);
    if (!item) throw new Error("IDEA_NOT_FOUND");
    return item;
  },

  saved(type?: SavedItemType): Paginated<SavedItem> {
    const items: SavedItem[] = [];
    if (!type || type === "repository") {
      for (const repo of repositories.filter((r) => r.saved)) {
        items.push({ item_type: "repository", item_id: repo.id, saved_at: iso(1), notes: null, repository: repo });
      }
    }
    if (!type || type === "news") {
      for (const item of news.filter((n) => n.saved)) {
        items.push({ item_type: "news", item_id: item.id, saved_at: iso(1), notes: null, news: item });
      }
    }
    if (!type || type === "idea") {
      for (const idea of ideas.filter((i) => i.favorite)) {
        items.push({ item_type: "idea", item_id: idea.id, saved_at: iso(2), notes: null, idea });
      }
    }
    return paginate(items, 1, 40);
  },

  search(q: string, mode: SearchMode = "keyword"): SearchResults {
    const needle = q.toLowerCase();
    const repoHits = repositories
      .filter((repo) => matchText([repo.full_name, repo.description, repo.tags.join(" ")], q))
      .slice(0, 6)
      .map((repo, index) => ({
        ...repo,
        match: {
          mode,
          similarity: mode === "keyword" ? null : Number((0.88 - index * 0.05).toFixed(2)),
          score: repo.scores.interest,
        },
      }));
    return {
      query: q,
      mode_requested: mode,
      mode_used: mode,
      repositories: repoHits,
      news: news.filter((item) => matchText([item.title, item.summary], q)).slice(0, 4),
      ideas: ideas.filter((idea) => matchText([idea.title, idea.summary, idea.technologies.join(" ")], q)).slice(0, 4),
    };
  },

  sources: () => ({ items: sources }),
  runs: () => paginate(runs, 1, 20),
  worker: () => worker,
  settings: () => settings,
  embeddings: () => embeddings,
  capabilities: () => capabilities,
  health: () => ({
    status: "ok",
    version: "0.1.0-demo",
    database: "ok",
    worker: { state: "online" as const, heartbeat_at: iso(0, 0.01) },
    time: iso(0),
  }),
};

export const demoRepositoryCount = repositories.length;
