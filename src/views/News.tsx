import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  FilterX,
  Newspaper,
  RefreshCw,
  Rss,
  SearchX,
} from "lucide-react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { NewsItem, NewsQuery, Paginated, Period } from "@/api/types";
import { useAppState } from "@/state/AppState";
import { useSavedActions } from "@/hooks/useSaved";
import { cn, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/DataDisplay";
import { FilterChip, SearchField, SegmentedControl, SelectField } from "@/components/ui/Controls";
import { GlassPanel } from "@/components/ui/Surface";
import { NewsCard } from "@/components/news/NewsCard";

const categories = [
  { value: "", label: "Todas" },
  { value: "ai", label: "IA" },
  { value: "data", label: "Data" },
  { value: "dev", label: "Desarrollo" },
  { value: "product", label: "Producto" },
  { value: "security", label: "Seguridad" },
  { value: "business", label: "Negocio" },
];

const importances = [
  { value: "", label: "Todas" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
];

export function NewsView() {
  usePageTitle("Tech News");
  const { mode } = useAppState();
  const savedActions = useSavedActions();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [category, setCategory] = useState("");
  const [importance, setImportance] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<NonNullable<NewsQuery["sort"]>>("published");
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [period, category, importance, savedOnly, sort, debounced]);

  const query = useMemo<NewsQuery>(
    () => ({
      page,
      page_size: 12,
      q: debounced || undefined,
      period,
      category: category || undefined,
      importance: importance || undefined,
      saved: savedOnly || undefined,
      sort,
      order: "desc",
    }),
    [page, debounced, period, category, importance, savedOnly, sort],
  );

  const resource = useResource<Paginated<NewsItem>>({
    live: (signal) => api.news(query, signal),
    demo: () => demo.news(query),
    deps: [query],
  });

  const reset = () => {
    setSearch("");
    setCategory("");
    setImportance("");
    setSavedOnly(false);
    setSort("published");
    setPeriod("7d");
  };

  const runFeeds = async () => {
    if (mode === "demo") return;
    setRunning(true);
    try {
      await api.runAll();
      resource.refresh();
    } finally {
      setRunning(false);
    }
  };

  const items = resource.data?.items ?? [];
  const hasFilters = Boolean(debounced || category || importance || savedOnly);

  return (
    <div className="view">
      <PageHeader
        eyebrow={
          <>
            <Rss size={13} aria-hidden /> Feed verificado
          </>
        }
        title="Tech News"
        description="Noticias con fuente, fecha y nivel de importancia calculado. La procedencia múltiple se conserva; los enlaces rotos se marcan."
        actions={
          <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} loading={running} onClick={runFeeds}>
            Actualizar feeds
          </Button>
        }
      />

      <GlassPanel className="filter-panel filter-panel--news">
        <div className="filter-panel__row">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar titulares y resúmenes…"
            ariaLabel="Buscar noticias"
            className="filter-panel__search"
          />
          <SegmentedControl
            size="sm"
            ariaLabel="Periodo de noticias"
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: "24 h" },
              { value: "7d", label: "7 d" },
              { value: "30d", label: "30 d" },
              { value: "all", label: "Todo" },
            ]}
          />
          <SelectField
            label="Orden"
            value={sort}
            onChange={(value) => setSort(value as NonNullable<NewsQuery["sort"]>)}
          >
            <option value="published">Publicación</option>
            <option value="importance">Importancia</option>
            <option value="fetched">Recogida</option>
          </SelectField>
        </div>
        <div className="filter-panel__row filter-panel__row--chips">
          <div className="chip-group">
            <span className="filter-panel__label">Categoría</span>
            {categories.map((item) => (
              <FilterChip key={item.value} active={category === item.value} onClick={() => setCategory(item.value)}>
                {item.label}
              </FilterChip>
            ))}
          </div>
          <div className="chip-group">
            <span className="filter-panel__label">Importancia</span>
            {importances.map((item) => (
              <FilterChip key={item.value} active={importance === item.value} onClick={() => setImportance(item.value)}>
                {item.label}
              </FilterChip>
            ))}
          </div>
          <div className="chip-group">
            <FilterChip active={savedOnly} onClick={() => setSavedOnly((value) => !value)} icon={Bookmark}>
              Guardadas
            </FilterChip>
            {hasFilters ? (
              <button type="button" className="filter-reset" onClick={reset}>
                <FilterX size={13} aria-hidden /> Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </GlassPanel>

      <div className="results-bar">
        <span>
          <strong className="tabular">{formatNumber(resource.data?.total ?? 0)}</strong> noticias · página{" "}
          {resource.data?.page ?? 1}
        </span>
        <span className="results-bar__hint">
          <Newspaper size={12} aria-hidden /> Si published_at es nulo se usa fetched_at para la ventana.
        </span>
      </div>

      {resource.error ? (
        <ErrorState error={resource.error} onRetry={resource.refresh} />
      ) : resource.loading && items.length === 0 ? (
        <div className="news-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="news-card news-card--skeleton" key={index}>
              <Skeleton width="42%" height={18} />
              <Skeleton width="88%" height={22} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="74%" height={12} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={SearchX}
            title="Sin noticias para estos filtros"
            description="Amplía el periodo, cambia la categoría o desactiva el filtro de guardadas."
            action={
              <Button variant="secondary" leadingIcon={<FilterX size={14} />} onClick={reset}>
                Limpiar filtros
              </Button>
            }
          />
        </GlassPanel>
      ) : (
        <div className={cn("news-grid", items.length > 1 && "news-grid--lead")}>
          {items.map((item, index) => (
            <NewsCard
              key={item.id}
              item={item}
              lead={index === 0}
              saved={savedActions.isSaved("news", item.id, item.saved)}
              pending={savedActions.isPending("news", item.id)}
              onToggleSave={(news, saved) => void savedActions.toggle("news", news.id, saved, news.title)}
            />
          ))}
        </div>
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
            {resource.data?.has_next ? "hay más noticias" : "fin del feed"}
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
    </div>
  );
}
