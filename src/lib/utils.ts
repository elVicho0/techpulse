export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const compactFormatter = new Intl.NumberFormat("es-ES", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const numberFormatter = new Intl.NumberFormat("es-ES");
const percentFormatter = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 0,
});

export function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value >= 10_000 ? compactFormatter.format(value) : numberFormatter.format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (digits === 0) return percentFormatter.format(value);
  return `${(value * 100).toFixed(digits)} %`;
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "No disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

const relativeFormatter = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

export function formatRelative(value: string | null | undefined) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin datos";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (abs < minute) return "ahora";
  if (abs < hour) return relativeFormatter.format(Math.round(diff / minute), "minute");
  if (abs < day) return relativeFormatter.format(Math.round(diff / hour), "hour");
  if (abs < day * 30) return relativeFormatter.format(Math.round(diff / day), "day");
  if (abs < day * 365) return relativeFormatter.format(Math.round(diff / (day * 30)), "month");
  return relativeFormatter.format(Math.round(diff / (day * 365)), "year");
}

export function formatDuration(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function hueFromString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return hash;
}

export const repoCategoryLabels: Record<string, string> = {
  ai: "IA",
  data_engineering: "Data Engineering",
  machine_learning: "Machine Learning",
  data_science: "Data Science",
  dev_tools: "Dev Tools",
  web: "Web",
  other: "Otros",
};

export const newsCategoryLabels: Record<string, string> = {
  ai: "IA",
  data: "Data",
  dev: "Desarrollo",
  product: "Producto",
  security: "Seguridad",
  business: "Negocio",
  other: "Otros",
};

export const importanceLabels: Record<string, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export const difficultyLabels: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

export const ideaStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
};

export const portfolioLabels: Record<string, string> = {
  learning: "Aprendizaje",
  portfolio: "Portafolio",
  internship: "Prácticas",
  commercial: "Comercial",
};

export const repoStatusLabels: Record<string, string> = {
  untracked: "Sin seguimiento",
  pending: "Pendiente",
  tried: "Probado",
  archived: "Archivado",
};

export const workerStateLabels: Record<string, string> = {
  online: "En línea",
  stale: "Sin señal",
  offline: "Desconectado",
};

export const runStatusLabels: Record<string, string> = {
  queued: "En cola",
  running: "Ejecutando",
  success: "Correcto",
  partial: "Parcial",
  failed: "Fallido",
  skipped: "Omitido",
};

export const sourceKindLabels: Record<string, string> = {
  github_api: "GitHub API",
  rss: "RSS / Atom",
  agent_reach: "Agent Reach",
  web: "Web",
  internal: "Interno",
};

export const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Elixir: "#6e4a7e",
  Zig: "#ec915c",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
};

export function languageColor(language: string | null) {
  if (!language) return "#8b93a7";
  return languageColors[language] ?? `hsl(${hueFromString(language)} 62% 58%)`;
}

export function categoryTone(category: string) {
  switch (category) {
    case "ai":
      return "violet";
    case "data_engineering":
    case "data":
      return "cyan";
    case "machine_learning":
      return "blue";
    case "data_science":
      return "teal";
    case "dev_tools":
    case "dev":
      return "amber";
    case "web":
      return "indigo";
    case "security":
      return "rose";
    default:
      return "slate";
  }
}

export function initials(value: string) {
  return value
    .split(/[/\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
