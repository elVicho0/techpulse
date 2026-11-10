import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, BookmarkCheck, FilterX, Lightbulb } from "lucide-react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { Idea, IdeaQuery, Paginated } from "@/api/types";
import { useAppState } from "@/state/AppState";
import { useSavedActions } from "@/hooks/useSaved";
import { cn, difficultyLabels, formatNumber, ideaStatusLabels, portfolioLabels } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/DataDisplay";
import { FilterChip, SearchField, SegmentedControl, SelectField } from "@/components/ui/Controls";
import { GlassPanel } from "@/components/ui/Surface";
import { IdeaCard } from "@/components/ideas/IdeaCard";

const difficulties = [
  { value: "", label: "Todas" },
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

const statuses = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "in_progress", label: "En curso" },
  { value: "completed", label: "Completada" },
];

export function IdeasView() {
  usePageTitle("Project Ideas");
  const { mode } = useAppState();
  const savedActions = useSavedActions();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [difficulty, category, status, favoritesOnly, debounced]);

  const query = useMemo<IdeaQuery>(
    () => ({
      page,
      page_size: 12,
      q: debounced || undefined,
      difficulty: difficulty || undefined,
      category: category || undefined,
      status: status || undefined,
      favorite: favoritesOnly || undefined,
      sort: "updated",
      order: "desc",
    }),
    [page, debounced, difficulty, category, status, favoritesOnly],
  );

  const resource = useResource<Paginated<Idea>>({
    live: (signal) => api.ideas(query, signal),
    demo: () => demo.ideas(query),
    deps: [query],
  });

  const reset = () => {
    setSearch("");
    setDifficulty("");
    setCategory("");
    setStatus("");
    setFavoritesOnly(false);
  };

  const runGenerate = async () => {
    if (mode === "demo") return;
    setRunning(true);
    try {
      const result = await api.generateIdeas();
      if (result.created.length > 0) {
        resource.refresh();
      }
    } finally {
      setRunning(false);
    }
  };

  const items = resource.data?.items ?? [];
  const hasFilters = Boolean(debounced || difficulty || category || status || favoritesOnly);

  return (
    <div className="view">
      <PageHeader
        eyebrow={<Lightbulb size={13} aria-hidden />}
        title="Project Ideas"
        description="Ideas trazables a repositorios reales, con dificultad, tecnologías y estado de desarrollo."
        actions={
          <Button variant="secondary" leadingIcon={<Lightbulb size={14} />} loading={running} onClick={runGenerate}>
            Generar ideas
          </Button>
        }
      />

      <GlassPanel className="filter-panel filter-panel--ideas">
        <div className="filter-panel__row">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar títulos, resúmenes y tecnologías…"
            ariaLabel="Buscar ideas"
            className="filter-panel__search"
          />
          <SelectField label="Dificultad" value={difficulty} onChange={(value) => setDifficulty(value)}>
            {difficulties.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Categoría" value={category} onChange={(value) => setCategory(value)}>
            <option value="">Todas</option>
            <option value="ai">IA</option>
            <option value="data_engineering">Data Engineering</option>
            <option value="machine_learning">Machine Learning</option>
            <option value="data_science">Data Science</option>
            <option value="dev_tools">Dev Tools</option>
            <option value="web">Web</option>
            <option value="other">Otros</option>
          </SelectField>
          <SelectField label="Estado" value={status} onChange={(value) => setStatus(value)}>
            {statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="filter-panel__row filter-panel__row--chips">
          <div className="chip-group">
            <FilterChip active={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} icon={Bookmark}>
              Favoritas
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
          <strong className="tabular">{formatNumber(resource.data?.total ?? 0)}</strong> ideas · página{" "}
          {resource.data?.page ?? 1}
        </span>
        <span className="results-bar__hint">
          <Lightbulb size={12} aria-hidden /> Cada idea conserva al menos un repositorio real de origen.
        </span>
      </div>

      {resource.error ? (
        <ErrorState error={resource.error} onRetry={resource.refresh} />
      ) : resource.loading && items.length === 0 ? (
        <div className="idea-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="idea-card idea-card--skeleton" key={index}>
              <Skeleton width="44%" height={18} />
              <Skeleton width="90%" height={22} />
              <Skeleton width="100%" height={12} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={Lightbulb}
            title="Sin ideas para estos filtros"
            description="Amplía los filtros o genera nuevas ideas desde los repositorios existentes."
            action={
              <Button variant="secondary" leadingIcon={<FilterX size={14} />} onClick={reset}>
                Limpiar filtros
              </Button>
            }
          />
        </GlassPanel>
      ) : (
        <div className="idea-grid">
          {items.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              favorite={idea.favorite ?? savedActions.isSaved("idea", idea.id, idea.favorite)}
              pending={savedActions.isPending("idea", idea.id)}
              onToggleFavorite={(item, favorite) =>
                void savedActions.toggle("idea", item.id, favorite, item.title)
              }
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
            {resource.data?.has_next ? "hay más ideas" : "fin de la lista"}
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
