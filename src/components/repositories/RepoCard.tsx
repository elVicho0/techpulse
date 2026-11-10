import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  GitFork,
  Scale,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import type { RepositoryMatch, RepositorySummary } from "@/api/types";
import {
  categoryTone,
  cn,
  formatCompact,
  formatRelative,
  languageColor,
  repoCategoryLabels,
} from "@/lib/utils";
import { Badge, IconButton } from "@/components/ui/Button";

import { Monogram, SpotlightCard } from "@/components/ui/Surface";
import { ScoreRing } from "@/components/ui/DataDisplay";
import { openExternal } from "@/api/client";

export function RepoCard({
  repo,
  saved,
  pending,
  onToggleSave,
  featured = false,
}: {
  repo: RepositorySummary;
  saved: boolean;
  pending?: boolean;
  onToggleSave?: (repo: RepositorySummary, saved: boolean) => void;
  featured?: boolean;
}) {
  const growth = repo.star_growth;
  const positive = growth.delta !== null && growth.delta >= 0;

  return (
    <SpotlightCard className={cn("repo-card", featured && "repo-card--featured")}>
      <div className="repo-card__top">
        <Monogram name={repo.full_name} size={featured ? "lg" : "md"} />
        <div className="repo-card__identity">
          <Link to={`/repo/${repo.id}`} className="repo-card__name">
            {repo.full_name}
          </Link>
          <div className="repo-card__meta">
            <Badge tone={categoryTone(repo.category)} variant="soft">
              {repoCategoryLabels[repo.category] ?? repo.category}
            </Badge>
            {repo.subcategory ? <span className="repo-card__subcategory">{repo.subcategory}</span> : null}
          </div>
        </div>
        <div className="repo-card__actions">
          <IconButton
            label={saved ? "Quitar de guardados" : "Guardar repositorio"}
            tone={saved ? "accent" : "ghost"}
            size="sm"
            onClick={() => onToggleSave?.(repo, saved)}
            disabled={pending}
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </IconButton>
          <IconButton label="Abrir en GitHub" tone="ghost" size="sm" onClick={() => void openExternal(repo.html_url)}>
            <ArrowUpRight size={15} />
          </IconButton>
        </div>
      </div>

      <p className="repo-card__description">{repo.description ?? "Sin descripción proporcionada por la fuente."}</p>

      {repo.tags.length > 0 ? (
        <div className="repo-card__tags">
          {repo.tags.slice(0, featured ? 4 : 3).map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
          {repo.tags.length > (featured ? 4 : 3) ? (
            <span className="tag tag--muted">+{repo.tags.length - (featured ? 4 : 3)}</span>
          ) : null}
        </div>
      ) : null}

      <div className="repo-card__metrics">
        <div className="repo-card__metric">
          <Star size={13} aria-hidden />
          <strong className="tabular">{formatCompact(repo.stars)}</strong>
          <span>estrellas</span>
        </div>
        <div className="repo-card__metric">
          <GitFork size={13} aria-hidden />
          <strong className="tabular">{formatCompact(repo.forks)}</strong>
          <span>forks</span>
        </div>
        <div className={cn("repo-card__metric repo-card__growth", growth.delta === null && "is-empty")}>
          {growth.delta === null ? (
            <>
              <span>Sin datos suficientes</span>
            </>
          ) : (
            <>
              {positive ? <TrendingUp size={13} aria-hidden /> : <TrendingDown size={13} aria-hidden />}
              <strong className="tabular">
                {positive ? "+" : ""}
                {formatCompact(growth.delta)}
              </strong>
              <span>/ {growth.window}</span>
            </>
          )}
        </div>
        <ScoreRing value={repo.scores.interest} size={featured ? 48 : 42} label="Interés" />
      </div>

      <div className="repo-card__footer">
        <span className="repo-card__language">
          <span className="language-dot" style={{ background: languageColor(repo.language) }} aria-hidden />
          {repo.language ?? "Sin lenguaje"}
        </span>
        <span className="repo-card__license" title={repo.license_spdx ? `Licencia ${repo.license_spdx}` : "Licencia no especificada"}>
          <Scale size={12} aria-hidden />
          {repo.license_spdx ?? "No especificada"}
        </span>
        <span className="repo-card__updated">Actualizado {formatRelative(repo.pushed_at ?? repo.updated_at)}</span>
      </div>
    </SpotlightCard>
  );
}

export function RepoRow({
  repo,
  rank,
  onToggleSave,
  saved,
}: {
  repo: RepositorySummary;
  rank?: number;
  onToggleSave?: (repo: RepositorySummary, saved: boolean) => void;
  saved?: boolean;
}) {
  const growth = repo.star_growth;
  return (
    <div className="repo-row">
      {rank !== undefined ? <span className="repo-row__rank tabular">{String(rank).padStart(2, "0")}</span> : null}
      <Monogram name={repo.full_name} size="sm" />
      <div className="repo-row__main">
        <Link to={`/repo/${repo.id}`} className="repo-row__name">
          {repo.full_name}
        </Link>
        <span className="repo-row__desc">{repo.description ?? "Sin descripción"}</span>
      </div>
      <div className="repo-row__stats">
        <span className="repo-row__stat">
          <Star size={11} aria-hidden /> {formatCompact(repo.stars)}
        </span>
        <span className={cn("repo-row__stat repo-row__growth", growth.delta === null && "is-empty")}>
          {growth.per_day === null ? "—" : `+${growth.per_day.toFixed(1)}/d`}
        </span>
        {onToggleSave ? (
          <IconButton
            label={saved ? "Quitar de guardados" : "Guardar repositorio"}
            tone={saved ? "accent" : "ghost"}
            size="sm"
            onClick={() => onToggleSave(repo, Boolean(saved))}
          >
            {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </IconButton>
        ) : null}
      </div>
    </div>
  );
}

/** Fila ligera para repositorios similares — sin botón de guardar, usa la URL real de la API. */
export function SimilarRepoRow({
  repo,
  rank,
}: {
  repo: RepositoryMatch;
  rank?: number;
}) {
  const growth = repo.star_growth;
  return (
    <div className="repo-row">
      {rank !== undefined ? <span className="repo-row__rank tabular">{String(rank).padStart(2, "0")}</span> : null}
      <Monogram name={repo.full_name} size="sm" />
      <div className="repo-row__main">
        <Link to={`/repo/${repo.id}`} className="repo-row__name">
          {repo.full_name}
        </Link>
        <span className="repo-row__desc">{repo.description ?? "Sin descripción"}</span>
      </div>
      <div className="repo-row__stats">
        <span className="repo-row__stat">
          <Star size={11} aria-hidden /> {formatCompact(repo.stars)}
        </span>
        {repo.match.similarity !== null ? (
          <span className="repo-row__stat repo-row__similarity">
            {Math.round(repo.match.similarity * 100)}%
          </span>
        ) : (
          <span className={cn("repo-row__stat repo-row__growth", "is-empty")}>
            {growth.per_day === null ? "—" : `+${growth.per_day.toFixed(1)}/d`}
          </span>
        )}
        <IconButton label="Abrir en GitHub" tone="ghost" size="sm" onClick={() => void openExternal(repo.html_url)}>
          <ArrowUpRight size={13} />
        </IconButton>
      </div>
    </div>
  );
}
