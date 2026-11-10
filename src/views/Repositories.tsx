import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BrainCircuit,
  Database,
  FilterX,
  GitBranch,
  Grid2X2,
  List,
  RefreshCw,
  SearchX,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { Paginated, Period, RepositoryQuery, RepositorySummary } from "@/api/types";
import { useAppState } from "@/state/AppState";
import { useSavedActions } from "@/hooks/useSaved";
import { cn, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from "@/components/ui/DataDisplay";
import { FilterChip, SearchField, SegmentedControl, SelectField } from "@/components/ui/Controls";
import { GlassPanel } from "@/components/ui/Surface";
import { RepoCard, RepoRow } from "@/components/repositories/RepoCard";

type Scope = "all" | "ai" | "data";
type Layout = "grid" | "list";

const scopeConfig = {
  all: {
    eyebrow: "Descubrimiento",
    title: "GitHub Trending",
    description:
      "Repositorios reales ordenados por interés, crecimiento y actividad. Cada métrica proviene de la API y conserva su procedencia.",
    icon: GitBranch,
    categories: [] as string[],
    categoryLabel: "Categoría",
  },
  ai: {
    eyebrow: "AI Radar",
    title: "Inteligencia artificial, sin ruido",
    description:
      "Agentes, frameworks, modelos, RAG y herramientas de IA descubiertas desde GitHub. El ranking combina señales, no solo estrellas.",
    icon: BrainCircuit,
    categories: ["ai"],
    categoryLabel: "Categoría IA",
  },
  data: {
    eyebrow: "Data Engineering",
    title: "El stack de datos, en perspectiva",
    description:
      "ETL, streaming, lakehouse, orquestación, ML y data science. Explora actividad real y crecimiento verificado.",
    icon: Database,
    categories: ["data_engineering", "machine_learning", "data_science"],
    categoryLabel: "Categoría de datos",
  },
};

const categoryOptions = [
  { value: "", label: "Todas" },
  { value: "ai", label: "IA" },
  { value: "data_engineering", label: "Data Engineering" },
  { value: "machine_learning", label: "Machine Learning" },
  { value: "data_science", label: "Data Science" },
  { value: "dev_tools", label: "Dev Tools" },
  { value: "web", label: "Web" },
  { value: "other", label: "Otros" },
];

const languageOptions = ["", "Python", "TypeScript", "JavaScript", "Rust", "Go", "Java", "C++"];

export function RepositoriesView({ scope = "all" }: { scope?: Scope }) {
  const config = scopeConfig[scope];
  usePageTitle(scope === "all" ? "GitHub Trending" : config.title);
  const { worker } = useAppState();
  const savedActions = useSavedActions();
  const [layout, setLayout] = useState<Layout>("grid");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [period, setPeriod] = useState<Period>("30d");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [minStars, setMinStars] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<NonNullable<RepositoryQuery["sort"]>>("interest");
  const [growthWindow, setGrowthWindow] = useState<"1d" | "7d" | "30d">("7d");
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [scope, period, category, language, minStars, savedOnly, sort, growthWindow, debouncedSearch]);

  const query = useMemo<RepositoryQuery>(() => {
    const categories = scope === "all" ? (category ? [category] : undefined) : config.categories;
    return {
      page,
      page_size: layout === "grid" ? 12 : 16,
      q: debouncedSearch || undefined,
      period,
      category: categories?.join(","),
      language: language || undefined,
      min_stars: minStars ? Number(minStars) : undefined,
      saved: savedOnly || undefined,
      sort,
      growth_window: growthWindow,
      order: "desc",
    };
  }, [
    page,
    layout,
    debouncedSearch,
    period,
    category,
    language,
    minStars,
    savedOnly,
    sort,
    growthWindow,
    scope,
    config.categories,
  ]);

  const resource = useResource<Paginated<RepositorySummary>>({
    live: (signal) => api.repositories(query, signal),
    demo: () => demo.repositories(query),
    deps: [query],
  });

  const filtersActive =
    Boolean(debouncedSearch) || Boolean(category) || Boolean(language) || Boolean(minStars) || savedOnly;

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setLanguage("");
    setMinStars("");
    setSavedOnly(false);
    setSort("interest");
    setPeriod("30d");
    setGrowthWindow("7d");
  };

  const runUpdate = async () => {
    setRunning(true);
    try {
      await api.runAll();
      resource.refresh();
    } finally {
      setRunning(false);
    }
  };

  const Icon = config.icon;
  const items = resource.data?.items ?? [];

  return (
    <div className="view">
      <div className={cn("scope-banner", `scope-banner--${scope}`)}>
        <div className="scope-banner__copy">
          <div className="page-header__eyebrow">
            <Icon size={13} aria-hidden /> {config.eyebrow}
          </div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div className="scope-banner__stats">
          <div>
            <span className="tabular">{resource.data ? formatNumber(resource.data.total) : "—"}</span>
            <small>resultados</small>
          </div>
          <div>
            <span className="tabular">{worker?.state === "online" ? "live" : "—"}</span>
            <small>worker</small>
          </div>
        </div>
      </div>

      <GlassPanel className="filter-panel">
        <div className="filter-panel__row">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre, descripción o tag…"
            ariaLabel="Buscar repositorios"
            className="filter-panel__search"
          />
          <div className="filter-panel__group">
            <span className="filter-panel__label">Periodo</span>
            <SegmentedControl
              size="sm"
              ariaLabel="Periodo de descubrimiento"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "today", label: "24 h" },
                { value: "7d", label: "7 d" },
                { value: "30d", label: "30 d" },
                { value: "all", label: "Todo" },
              ]}
            />
          </div>
          <div className="filter-panel__layout" role="group" aria-label="Vista de resultados">
            <button
              type="button"
              className={cn("layout-toggle", layout === "grid" && "is-active")}
              onClick={() => setLayout("grid")}
              aria-pressed={layout === "grid"}
              aria-label="Vista de tarjetas"
            >
              <Grid2X2 size={15} />
            </button>
            <button
              type="button"
              className={cn("layout-toggle", layout === "list" && "is-active")}
              onClick={() => setLayout("list")}
              aria-pressed={layout === "list"}
              aria-label="Vista de lista"
            >
              <List size={15} />
            </button>
          </div>
        </div>

        <div className="filter-panel__row filter-panel__row--secondary">
          {scope === "all" ? (
            <SelectField label="Categoría" value={category} onChange={(value) => setCategory(value)}>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
          ) : (
            <div className="filter-panel__scope-note">
              <Sparkles size={13} aria-hidden />
              {config.categoryLabel}: {config.categories.join(" · ")}
            </div>
          )}
          <SelectField label="Lenguaje" value={language} onChange={(value) => setLanguage(value)}>
            {languageOptions.map((option) => (
              <option key={option || "all"} value={option}>
                {option || "Todos"}
              </option>
            ))}
          </SelectField>
          <SelectField label="Estrellas mín." value={minStars} onChange={(value) => setMinStars(value)}>
            <option value="">Sin mínimo</option>
            <option value="100">100+</option>
            <option value="500">500+</option>
            <option value="1000">1.000+</option>
            <option value="5000">5.000+</option>
          </SelectField>
          <SelectField
            label="Ordenar por"
            value={sort}
            onChange={(value) => setSort(value as NonNullable<RepositoryQuery["sort"]>)}
          >
            <option value="interest">Interés</option>
            <option value="growth">Crecimiento</option>
            <option value="stars">Estrellas</option>
            <option value="forks">Forks</option>
            <option value="updated">Actualizado</option>
            <option value="created">Creado</option>
          </SelectField>
          <SelectField
            label="Ventana de crecimiento"
            value={growthWindow}
            onChange={(value) => setGrowthWindow(value as "1d" | "7d" | "30d")}
          >
            <option value="1d">1 día</option>
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
          </SelectField>
          <div className="filter-panel__chips">
            <FilterChip active={savedOnly} onClick={() => setSavedOnly((value) => !value)} icon={Bookmark}>
              Solo guardados
            </FilterChip>
            {filtersActive ? (
              <button type="button" className="filter-reset" onClick={resetFilters}>
                <FilterX size={13} aria-hidden /> Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </GlassPanel>

      <div className="results-bar">
        <span>
          {resource.loading ? (
            "Cargando repositorios…"
          ) : (
            <>
              <strong className="tabular">{formatNumber(resource.data?.total ?? 0)}</strong> repositorios · página{" "}
              {resource.data?.page ?? 1}
            </>
          )}
        </span>
        <span className="results-bar__hint">
          <SlidersHorizontal size={12} aria-hidden /> El ranking se calcula en el backend y se explica en cada ficha.
        </span>
      </div>

      {resource.error ? (
        <ErrorState error={resource.error} onRetry={resource.refresh} />
      ) : resource.loading && items.length === 0 ? (
        <div className={layout === "grid" ? "repo-grid" : "repo-list"}>
          {Array.from({ length: layout === "grid" ? 6 : 8 }).map((_, index) => (
            <div className="repo-card repo-card--skeleton" key={index}>
              <Skeleton width={46} height={46} rounded={13} />
              <Skeleton width="65%" height={16} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="82%" height={12} />
              <Skeleton width="100%" height={40} rounded={10} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={SearchX}
            title="Sin resultados para estos filtros"
            description="Prueba una ventana temporal más amplia, otro lenguaje o elimina los filtros activos."
            action={
              <Button variant="secondary" onClick={resetFilters} leadingIcon={<FilterX size={14} />}>
                Limpiar filtros
              </Button>
            }
          />
        </GlassPanel>
      ) : layout === "grid" ? (
        <div className="repo-grid">
          {items.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              saved={savedActions.isSaved("repository", repo.id, repo.saved)}
              pending={savedActions.isPending("repository", repo.id)}
              onToggleSave={(item, saved) => void savedActions.toggle("repository", item.id, saved, item.full_name)}
            />
          ))}
        </div>
      ) : (
        <GlassPanel className="repo-list-panel">
          {items.map((repo, index) => (
            <RepoRow
              key={repo.id}
              repo={repo}
              rank={(page - 1) * (query.page_size ?? 16) + index + 1}
              saved={savedActions.isSaved("repository", repo.id, repo.saved)}
              onToggleSave={(item, saved) => void savedActions.toggle("repository", item.id, saved, item.full_name)}
            />
          ))}
        </GlassPanel>
      )}

      {(resource.data?.total ?? 0) > 0 ? (
        <div className="pagination">
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<ArrowLeft size={14} />}
            disabled={page <= 1 || resource.loading}
            onClick={() => {
              setPage((value) => Math.max(1, value - 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Anterior
          </Button>
          <span className="pagination__info">
            Página <strong className="tabular">{page}</strong> ·{" "}
            {resource.data?.has_next ? "hay más resultados" : "fin de los resultados"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ArrowRight size={14} />}
            disabled={!resource.data?.has_next || resource.loading}
            onClick={() => {
              setPage((value) => value + 1);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            Siguiente
          </Button>
        </div>
      ) : null}

      <div className="view-footer-action">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<RefreshCw size={13} />}
          loading={running}
          onClick={runUpdate}
        >
          Encolar actualización de fuentes
        </Button>
        <span>
          <TrendingUp size={12} aria-hidden /> Los valores nulos se muestran como “sin datos suficientes”.
        </span>
      </div>
    </div>
  );
}
