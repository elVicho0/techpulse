import { useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Clock3,
  ExternalLink,
  Layers,
  Lightbulb,
  Scale,
  Star,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { api, openExternal } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { Idea } from "@/api/types";
import { cn, difficultyLabels, formatRelative, ideaStatusLabels, portfolioLabels } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ErrorState, PageHeader, Skeleton } from "@/components/ui/DataDisplay";
import { GlassPanel } from "@/components/ui/Surface";
import { RepoCard } from "@/components/repositories/RepoCard";

export function IdeaDetailView() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  const repositoryId = Number(id);
  usePageTitle("Idea");
  const [favorite, setFavorite] = useState(false);
  const [pending, setPending] = useState(false);

  const ideaResult = useResource<Idea>({
    live: (signal) => api.idea(repositoryId, signal),
    demo: () => demo.idea(repositoryId),
    deps: [repositoryId],
  });

  useEffectSyncFavorite(ideaResult.data ?? undefined, setFavorite);

  const toggleFavorite = async () => {
    if (ideaResult.isDemo) return;
    setPending(true);
    try {
      if (!favorite) {
        await api.favoriteIdea(repositoryId);
        setFavorite(true);
      } else {
        await api.unfavoriteIdea(repositoryId);
        setFavorite(false);
      }
    } finally {
      setPending(false);
    }
  };

  if (ideaResult.loading && !ideaResult.data) {
    return (
      <div className="view" aria-busy="true">
        <PageHeader title="Idea" description="Cargando detalle…" />
        <div className="idea-detail-skeleton">
          <Skeleton width="60%" height={20} />
          <Skeleton width="44%" height={14} />
          <Skeleton width="100%" height={140} rounded={14} />
          <Skeleton width="100%" height={40} rounded={10} />
        </div>
      </div>
    );
  }

  if (ideaResult.error && !ideaResult.data) {
    return (
      <div className="view">
        <PageHeader title="Idea" description="No se pudo cargar el detalle." />
        <ErrorState error={ideaResult.error} onRetry={ideaResult.refresh} />
      </div>
    );
  }

  const idea = ideaResult.data;
  if (!idea) return null;

  return (
    <div className="view">
      <div className="idea-detail__banner">
        <div className="idea-detail__badge">
          {difficultyLabels[idea.difficulty]} · {idea.portfolio_value}
        </div>
        <h1>{idea.title}</h1>
        <p className="idea-detail__lead">
          {idea.summary} ·
          {idea.generated_by === "rules" ? "Generada por reglas deterministas" : idea.generated_by}
        </p>
        <div className="idea-detail__meta">
          <span>{ideaStatusLabels[idea.status]}</span>
          <span aria-hidden>·</span>
          <span>{formatRelative(idea.updated_at)}</span>
          <span aria-hidden>·</span>
          <span>{idea.repositories.length} repositorio{idea.repositories.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      <div className="idea-detail__grid">
        <GlassPanel className="panel panel--wide">
          <h2 className="idea-detail__section-title">
            <Lightbulb size={13} aria-hidden /> Resumen
          </h2>
          <p className="idea-detail__text">{idea.summary}</p>
          <div className="idea-detail__meta-grid">
            <div>
              <strong>Dificultad</strong>
              <span>{difficultyLabels[idea.difficulty]}</span>
            </div>
            <div>
              <strong>Portafolio</strong>
              <span>{portfolioLabels[idea.portfolio_value]}</span>
            </div>
            <div>
              <strong>Estado</strong>
              <span>{ideaStatusLabels[idea.status]}</span>
            </div>
            <div>
              <strong>Categoría</strong>
              <span>{idea.category}</span>
            </div>
            <div>
              <strong>Generado por</strong>
              <span>{idea.generated_by}</span>
            </div>
            <div>
              <strong>Creada</strong>
              <span>{formatRelative(idea.created_at)}</span>
            </div>
            <div>
              <strong>Actualizada</strong>
              <span>{formatRelative(idea.updated_at)}</span>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="idea-detail__section-title">
            <Layers size={13} aria-hidden /> Tecnologías
          </h2>
          <div className="idea-detail__tags">
            {idea.technologies.map((technology) => (
              <span className="tag" key={technology}>
                {technology}
              </span>
            ))}
            {idea.technologies.length === 0 && <span className="tag tag--muted">Sin tecnologías registradas</span>}
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="idea-detail__section-title">
            <Scale size={13} aria-hidden /> Propuesta de valor
          </h2>
          <p className="idea-detail__text">{idea.portfolio_value}</p>
          <div className="idea-detail__tagline">
            <strong>{ideaStatusLabels[idea.status]}</strong>{" "}
            {idea.generated_by === "rules" ? "· Generada por reglas" : "· Generada por LLM"}
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="idea-detail__section-title">
            <Layers size={13} aria-hidden /> Repositorios de origen
          </h2>
          <p className="idea-detail__text">
            Cada idea traza al menos un repositorio real que la inspiró o provee datos.
          </p>
          <div className="idea-detail__repos">
            {idea.repositories.map((repo) => (
              <div className="idea-detail__repo" key={repo.id}>
                <div className="idea-detail__repo__main">
                  <span className="idea-detail__repo__role">{repo.role}</span>
                  <span className="idea-detail__repo__name">
                    {repo.full_name}
                    <ArrowRight size={13} className="idea-detail__repo__arrow" aria-hidden />
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<ExternalLink size={12} />}
                  onClick={() => void openExternal(repo.html_url)}
                >
                  Abrir
                </Button>
              </div>
            ))}
            {idea.repositories.length === 0 && <p>Sin repositorios asociados.</p>}
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="idea-detail__section-title">
            <Clock3 size={13} aria-hidden /> Problema y solución
          </h2>
          <div className="idea-detail__columns">
            <div className="idea-detail__column">
              <strong>Problema</strong>
              <p className="idea-detail__text">{idea.problem}</p>
            </div>
            <div className="idea-detail__column">
              <strong>Cómo funciona</strong>
              <p className="idea-detail__text">{idea.how_it_works}</p>
            </div>
          </div>
          {idea.expansion ? (
            <div className="idea-detail__expansion">
              <strong>Expansión sugerida</strong>
              <p className="idea-detail__text">{idea.expansion}</p>
            </div>
          ) : null}
        </GlassPanel>

        <GlassPanel className="panel panel--wide">
          <h2 className="idea-detail__section-title">
            <Star size={13} aria-hidden /> Estado y favoritos
          </h2>
          <div className="idea-detail__status">
            <div className="idea-detail__status__chip">
              {idea.favorite ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              <span>{idea.favorite ? "Marcada como favorita" : "No marcada como favorita"}</span>
            </div>
            <Button
              variant={idea.favorite ? "secondary" : "primary"}
              size="lg"
              loading={pending}
              leadingIcon={idea.favorite ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
              onClick={toggleFavorite}
              disabled={ideaResult.isDemo}
            >
              {idea.favorite ? "Quitar de favoritas" : "Marcar como favorita"}
            </Button>

          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function useEffectSyncFavorite(
  idea: Idea | null | undefined,
  setFavorite: (value: boolean) => void,
) {
  if (idea) setFavorite(idea.favorite ?? false);
}
