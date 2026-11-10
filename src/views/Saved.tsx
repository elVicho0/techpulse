import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, BookmarkCheck, FilterX, SearchX } from "lucide-react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { Idea, NewsItem, RepositorySummary, SavedItem, SavedItemType } from "@/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui/DataDisplay";
import { GlassPanel } from "@/components/ui/Surface";

type SavedTab = "all" | "repository" | "news" | "idea";

const tabs: Array<{ key: SavedTab; label: string }> = [
  { key: "all", label: "Todo" },
  { key: "repository", label: "Repositorios" },
  { key: "news", label: "Noticias" },
  { key: "idea", label: "Ideas" },
];

export function SavedView() {
  usePageTitle("Guardados");
  const [tab, setTab] = useState<SavedTab>("all");
  const [running, setRunning] = useState(false);

  const saved = useResource<{ items: SavedItem[]; total: number }>({
    live: (signal) => api.saved(tab === "all" ? undefined : tab, 1, 50, signal),
    demo: () => demo.saved(tab === "all" ? undefined : tab),
    deps: [tab],
  });

  const items = useMemo<SavedItem[]>(() => {
    if (!saved.data) return [];
    return saved.data.items.filter(
      (item) => tab === "all" || item.item_type === tab,
    );
  }, [saved.data, tab]);

  const remove = useCallback(
    async (itemType: SavedItemType, id: number, label: string) => {
      setRunning(true);
      try {
        await api.deleteSaved(itemType, id);
        saved.refresh();
      } finally {
        setRunning(false);
      }
    },
    [saved.refresh],
  );

  const counts = useMemo<Partial<Record<SavedItemType, number>>>(
    () => {
      const result: Partial<Record<SavedItemType, number>> = {};
      for (const item of items) {
        result[item.item_type] = (result[item.item_type] ?? 0) + 1;
      }
      return result;
    },
    [items],
  );

  const tabsWithCount = tabs.map((entry) => ({
    ...entry,
    count: entry.key === "all" ? items.length : (counts[entry.key] ?? 0),
  }));

  const total = saved.data?.total ?? 0;

  return (
    <div className="view">
      <PageHeader
        eyebrow={<BookmarkCheck size={13} aria-hidden />}
        title="Guardados"
        description="Repositorios, noticias e ideas guardadas para revisar después."
        actions={
          <div className="saved-header-actions">
            <Button variant="secondary" size="sm" leadingIcon={<ArrowLeft size={13} />}>
              Volver
            </Button>
            <Button variant="ghost" leadingIcon={<SearchX size={13} />}>
              Buscar entre guardados
            </Button>
          </div>
        }
      />

      <GlassPanel className="filter-panel filter-panel--saved">
        <div className="filter-panel__row filter-panel__row--tabs">
          {tabsWithCount.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={cn("tab-button", tab === entry.key && "is-active")}
              onClick={() => setTab(entry.key)}
              aria-pressed={tab === entry.key}
            >
              {entry.label}
              <span className="tab-button__count">{entry.count}</span>
            </button>
          ))}
        </div>
        <div className="filter-panel__row filter-panel__row--actions">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<FilterX size={13} />}
            disabled={running || saved.loading || saved.refreshing}
            onClick={() => {
              setRunning(true);
              void api
                .runAll()
                .then(() => {})
                .finally(() => setRunning(false));
            }}
          >
            Refrescar fuentes
          </Button>
        </div>
      </GlassPanel>

      {saved.loading && items.length === 0 ? (
        <GlassPanel>
          <div className="saved-list">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="saved-item saved-item--skeleton" key={index}>
                <Skeleton width={44} height={44} rounded={12} />
                <div className="saved-item__copy-skeleton">
                  <Skeleton width="55%" height={18} />
                  <Skeleton width="100%" height={12} />
                  <Skeleton width="70%" height={10} />
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>
      ) : saved.error ? (
        <ErrorState error={saved.error} onRetry={saved.refresh} />
      ) : items.length === 0 ? (
        <GlassPanel>
          <EmptyState
            icon={SearchX}
            title="No tienes elementos guardados"
            description="Guarda repositorios, noticias o ideas y aparecerán aquí."
          />
        </GlassPanel>
      ) : (
        <div className="saved-list" role="list" aria-label="Guardados">
          {items.map((item, itemIndex) => {
            const entity =
              item.item_type === "repository" ? item.repository :
              item.item_type === "news" ? item.news :
              item.item_type === "idea" ? item.idea :
              null;
            if (!entity) return null;
            const title =
              item.item_type === "repository"
                ? (entity as RepositorySummary).full_name
                : (entity as NewsItem | Idea).title;
            return (
              <div className="saved-item" key={`${item.item_type}:${item.item_id}`} role="listitem">
                <div className="saved-item__main">
                  <div
                    className="saved-item__avatar saved-item__avatar--color"
                    style={{
                      background: `hsl(${(itemIndex * 137) % 360} 62% 16%)`,
                    }}
                  >
                    {String(entity.id ?? "?").padStart(2, "0")}
                  </div>
                  <div className="saved-item__copy">
                    <strong className="saved-item__title">{title}</strong>
                    <span className="saved-item__meta">
                      {item.item_type} · guardado{" "}
                      {item.saved_at ? new Date(item.saved_at).toLocaleDateString("es-ES") : "—"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="saved-item__remove"
                    onClick={() => void remove(item.item_type, item.item_id, title)}
                    aria-label={`Quitar ${title} de guardados`}
                  >
                    <BookmarkCheck size={13} />
                  </button>
                </div>
                <div className="saved-item__note">
                  <small>{item.notes ?? "Sin notas"}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="saved-footer">
        {items.length} de {total} elementos guardados.{" "}
        <span className="saved-footer__muted">
          Los guardados persisten en la base local tras reinicios.
        </span>
      </p>
    </div>
  );
}
