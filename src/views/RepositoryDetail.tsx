import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  GitBranch,
  Layers,
  Lightbulb,
  RefreshCw,
  Star,
  TrendingUp,
} from "lucide-react";
import { api, ApiError, openExternal } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { RepositoryDetail, RepositoryMatch } from "@/api/types";
import { cn, formatCompact, languageColor, repoCategoryLabels } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ErrorState, PageHeader, ScoreBars, Skeleton } from "@/components/ui/DataDisplay";
import { GlassPanel } from "@/components/ui/Surface";
import { TrendChart } from "@/components/visual/TrendChart";
import { RepoRow, SimilarRepoRow } from "@/components/repositories/RepoCard";

export function RepositoryDetailView() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  const repositoryId = Number(id);
  usePageTitle("Repositorio");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const detail = useResource<RepositoryDetail>({
    live: (signal) => api.repository(repositoryId, signal),
    demo: () => demo.repository(repositoryId),
    deps: [repositoryId],
  });

  const ideas = useResource<{ items: RepositoryDetail["related_ideas"] }>({
    live: (signal) => api.repositoryIdeas(repositoryId, signal),
    demo: () => demo.repositoryIdeas(repositoryId),
    deps: [repositoryId],
  });

  const snapshots = useResource<{ points: Array<{ date: string; value: number }>; total: number }>({
    live: (signal) =>
      api.snapshots(repositoryId, "30d", signal).then((series) => ({
        points: series.points.map((point) => ({ date: point.captured_at, value: point.stars })),
        total: series.points.length,
      })),
    demo: () => {
      const series = demo.snapshots(repositoryId, "30d");
      return {
        points: series.points.map((point) => ({ date: point.captured_at, value: point.stars })),
        total: series.points.length,
      };
    },
    deps: [repositoryId],
  });

  const similar = useResource<RepositoryMatch[]>({
    live: (signal) =>
      api.similar(repositoryId, "metadata", 6, signal).then((res) => res.items),
    demo: () => demo.similar(repositoryId, "metadata").items,
    deps: [repositoryId],
  });

  const { data: repository } = detail;

  useEffect(() => {
    if (repository) setSaved(repository.saved);
  }, [repository]);

  const toggleSave = async () => {
    if (detail.isDemo) return;
    setPending(true);
    try {
      if (!saved) {
        await api.saveRepository(repositoryId);
        setSaved(true);
      } else {
        await api.unsaveRepository(repositoryId);
        setSaved(false);
      }
    } catch {
      setPending(false);
    } finally {
      setPending(false);
    }
  };

  if (detail.loading && !repository) {
    return (
      <div className="view" aria-busy="true">
        <PageHeader title="Repositorio" description="Cargando ficha…" />
        <div className="repo-detail-skeleton">
          <Skeleton width="60%" height={20} />
          <Skeleton width="44%" height={14} />
          <Skeleton width="100%" height={120} rounded={14} />
          <Skeleton width="100%" height={40} rounded={10} />
        </div>
      </div>
    );
  }

  if (detail.error && !repository) {
    return (
      <div className="view">
        <PageHeader title="Repositorio" description="No se pudo cargar la ficha." />
        <ErrorState error={detail.error} onRetry={detail.refresh} />
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="view">
        <PageHeader title="Repositorio" description="No encontrado." />
        <ErrorState
          error={new ApiError("NOT_FOUND", `No existe el repositorio ${repositoryId}.`, 404)}
          onRetry={detail.refresh}
        />
      </div>
    );
  }

  return (
    <div className="view">
      <div className="repo-detail__banner">
        <div className="repo-detail__banner-inner">
          <div className="repo-detail__monogram" style={{ background: languageColor(repository.language) }}>
            {repository.full_name.split("/")[0][0]}{repository.name[0]}
          </div>
          <div className="repo-detail__head">
            <div className="repo-detail__identity">
              <span
                className="repo-detail__badge"
                style={{ borderColor: `hsl(${categoryHash(repository.category)} 70% 35%)` }}
              >
                {repoCategoryLabels[repository.category]}
              </span>
              <h1>{repository.full_name}</h1>
              <div className="repo-detail__meta">
                <span>{repository.language ?? "Sin lenguaje"}</span>
                <span aria-hidden>·</span>
                <span>{repository.license_spdx ?? "Sin licencia"}</span>
                <span aria-hidden>·</span>
                <span>{repository.stars} estrellas · {repository.forks} forks</span>
              </div>
            </div>
            <div className="repo-detail__actions">
              <Button
                variant={saved ? "secondary" : "primary"}
                size="lg"
                loading={pending}
                leadingIcon={saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                onClick={toggleSave}
                disabled={detail.isDemo}
                aria-pressed={saved}
              >
                {saved ? "Guardado" : "Guardar repositorio"}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                leadingIcon={<ExternalLink size={15} />}
                onClick={() => void openExternal(repository.html_url)}
              >
                Abrir en GitHub
              </Button>
            </div>
          </div>
          <p className="repo-detail__description">{repository.description ?? "Sin descripción."}</p>
        </div>
      </div>

      <div className="repo-detail__grid">
        <GlassPanel className="panel panel--wide">
          <h2 className="repo-detail__section-title">
            <GitBranch size={14} aria-hidden /> Métricas explicables
          </h2>
          <ScoreBars scores={repository.scores} />
          <p className="repo-detail__score-note">
            Cada score va de 0 a 1 y es calculado por el backend con los pesos del modelo de ranking.
            Si el crecimiento es nulo, el backend no tiene snapshots suficientes para calcularlo.
          </p>
          <div className="repo-detail__star-growth">
            <span className="repo-detail__star-growth__label">Crecimiento de estrellas</span>
            {repository.star_growth.delta === null ? (
              <span>Sin datos suficientes</span>
            ) : (
              <>
                <span className="tabular">{repository.star_growth.delta}</span>
                {" "+repository.star_growth.window} (
                <span className="tabular">{repository.star_growth.per_day?.toFixed(1)}</span>/día)
              </>
            )}
            <div className="repo-detail__growth-note">{repository.star_growth.from_at ?? "—"} → {repository.star_growth.to_at ?? "—"}</div>
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="repo-detail__section-title">
            <Layers size={14} aria-hidden /> Topics
          </h2>
          <div className="repo-detail__topics">
            {repository.topics.map((topic) => (
              <span className="tag" key={topic}>
                {topic}
              </span>
            ))}
            {repository.topics.length === 0 && <span className="tag tag--muted">Sin topics</span>}
          </div>
          <div className="repo-detail__links repo-detail__links--separated">
            <div className="repo-detail__link-row">
              <span>Repositorio</span>
              <a href={repository.html_url} target="_blank" rel="noreferrer" className="repo-detail__link">
                {repository.html_url}
              </a>
            </div>
            {repository.homepage_url ? (
              <div className="repo-detail__link-row">
                <span>Sitio oficial</span>
                <a href={repository.homepage_url} target="_blank" rel="noreferrer" className="repo-detail__link">
                  {repository.homepage_url}
                </a>
              </div>
            ) : null}
            {repository.docs_url ? (
              <div className="repo-detail__link-row">
                <span>Docs verificadas</span>
                <a href={repository.docs_url} target="_blank" rel="noreferrer" className="repo-detail__link">
                  {repository.docs_url}
                </a>
              </div>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="repo-detail__section-title">
            <TrendingUp size={14} aria-hidden /> Tendencia de estrellas
          </h2>
          {snapshots.loading ? (
            <Skeleton width="100%" height={236} rounded={12} />
          ) : snapshots.error ? (
            <p className="repo-detail__empty-hint">No se pudieron cargar los snapshots.</p>
          ) : (
            <TrendChart
              points={snapshots.data?.points ?? []}
              valueLabel="estrellas"
              height={236}
            />
          )}
          <p className="repo-detail__trend-note">
            {snapshots.data?.total ?? 0} snapshots en ventana 30 días. Los puntos sin datos reales se omiten.
          </p>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="repo-detail__section-title">
            <GitBranch size={14} aria-hidden /> Repos similares
          </h2>
          {similar.loading ? (
            <div className="repo-detail-skeleton">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="repo-row repo-row--skeleton" key={index}>
                  <Skeleton width="42" height={42} rounded={11} />
                  <div className="repo-row__skeleton-copy">
                    <Skeleton width="55%" height={16} />
                    <Skeleton width="100%" height={12} />
                  </div>
                </div>
              ))}
            </div>
          ) : similar.error ? (
            <p className="repo-detail__empty-hint">No se pudieron cargar repos similares.</p>
          ) : (similar.data?.length ?? 0) === 0 ? (
            <p className="repo-detail__empty-hint">
              No hay repositorios similares detectados con metadatos actuales.
            </p>
          ) : (
            <div className="repo-list-panel">
              {(similar.data ?? []).map((repo, index) => (
                <SimilarRepoRow key={repo.full_name} repo={repo} rank={index + 1} />
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="repo-detail__section-title">
            <Lightbulb size={14} aria-hidden /> Ideas relacionadas
          </h2>
          {ideas.loading ? (
            <div className="repo-detail-skeleton" style={{ minHeight: 120 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="idea-card-skeleton" key={index}>
                  <Skeleton width="44%" height={16} />
                  <Skeleton width="90%" height={12} />
                  <Skeleton width="70%" height={10} />
                </div>
              ))}
            </div>
          ) : ideas.error ? (
            <p className="repo-detail__empty-hint">No se pudieron cargar las ideas relacionadas.</p>
          ) : (ideas.data?.items?.length ?? 0) === 0 ? (
            <p className="repo-detail__empty-hint">
              No hay ideas de proyecto relacionadas con este repositorio todavía.
            </p>
          ) : (
            <div className="repo-detail__ideas">
              {(ideas.data?.items ?? []).map((idea) => (
                <div className="idea-chip" key={idea.id}>
                  <div className="idea-chip__title">{idea.title}</div>
                  <div className="idea-chip__meta">
                    {idea.difficulty} · {idea.category} · {idea.status}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

function categoryHash(category: string) {
  return category.split("").reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0) % 360;
}
