import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  CircleHelp,
  Link2Off,
} from "lucide-react";
import type { NewsItem } from "@/api/types";
import { openExternal } from "@/api/client";
import {
  categoryTone,
  cn,
  formatRelative,
  importanceLabels,
  newsCategoryLabels,
} from "@/lib/utils";
import { Badge, IconButton } from "@/components/ui/Button";
import { SpotlightCard } from "@/components/ui/Surface";

const linkStatus = {
  verified: { label: "Enlace verificado", icon: CircleCheck, tone: "green" as const },
  unverified: { label: "Sin verificar", icon: CircleHelp, tone: "amber" as const },
  broken: { label: "Enlace roto", icon: Link2Off, tone: "rose" as const },
};

export function NewsCard({
  item,
  saved,
  pending,
  onToggleSave,
  compact = false,
  lead = false,
}: {
  item: NewsItem;
  saved: boolean;
  pending?: boolean;
  onToggleSave?: (item: NewsItem, saved: boolean) => void;
  compact?: boolean;
  lead?: boolean;
}) {
  const status = linkStatus[item.link_status];
  const StatusIcon = status.icon;

  return (
    <SpotlightCard
      className={cn(
        "news-card",
        compact && "news-card--compact",
        lead && "news-card--lead",
        `news-card--${item.importance_label}`,
      )}
    >
      <span className="news-card__accent" aria-hidden />
      <div className="news-card__main">
        <div className="news-card__meta">
          <Badge tone={categoryTone(item.category)}>{newsCategoryLabels[item.category] ?? item.category}</Badge>
          <Badge tone={item.importance_label === "high" ? "rose" : item.importance_label === "medium" ? "amber" : "slate"}>
            {importanceLabels[item.importance_label]}
          </Badge>
          <span className="news-card__source">{item.source.name}</span>
          <span className="news-card__dot" aria-hidden>·</span>
          <span className="news-card__date">{formatRelative(item.published_at ?? item.fetched_at)}</span>
        </div>

        <button type="button" className="news-card__title" onClick={() => void openExternal(item.url)}>
          {item.title}
          <ArrowUpRight size={14} aria-hidden />
        </button>

        {item.summary ? <p className="news-card__summary">{item.summary}</p> : null}

        <div className="news-card__footer">
          <span className={cn("news-card__link-status", `is-${item.link_status}`)} title={status.label}>
            <StatusIcon size={12} aria-hidden />
            {status.label}
          </span>
          {item.tags.slice(0, compact ? 2 : 3).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
          <span className="news-card__score tabular" title="Importancia calculada por el backend">
            Importancia {Math.round(item.importance_score * 100)}
          </span>
        </div>
      </div>

      {onToggleSave ? (
        <IconButton
          label={saved ? "Quitar noticia de guardados" : "Guardar noticia"}
          tone={saved ? "accent" : "ghost"}
          size="sm"
          className="news-card__save"
          onClick={() => onToggleSave(item, saved)}
          disabled={pending}
          aria-pressed={saved}
        >
          {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </IconButton>
      ) : null}
    </SpotlightCard>
  );
}
