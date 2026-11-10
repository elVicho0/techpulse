import { Link } from "react-router-dom";
import { Bookmark, BookmarkCheck, Boxes, Clock3, Layers, Star } from "lucide-react";
import type { Idea } from "@/api/types";
import {
  cn,
  difficultyLabels,
  formatRelative,
  ideaStatusLabels,
  portfolioLabels,
} from "@/lib/utils";
import { Badge, IconButton } from "@/components/ui/Button";
import { SpotlightCard } from "@/components/ui/Surface";

const difficultyTone = {
  beginner: "green",
  intermediate: "amber",
  advanced: "rose",
} as const;

const statusTone = {
  pending: "slate",
  in_progress: "blue",
  completed: "green",
} as const;

export function IdeaCard({
  idea,
  favorite,
  pending,
  onToggleFavorite,
  compact = false,
}: {
  idea: Idea;
  favorite: boolean;
  pending?: boolean;
  onToggleFavorite?: (idea: Idea, favorite: boolean) => void;
  compact?: boolean;
}) {
  return (
    <SpotlightCard className={cn("idea-card", compact && "idea-card--compact")}>
      <div className="idea-card__top">
        <div className="idea-card__badges">
          <Badge tone={difficultyTone[idea.difficulty]}>{difficultyLabels[idea.difficulty]}</Badge>
          <Badge tone={statusTone[idea.status]} variant="outline">
            {ideaStatusLabels[idea.status]}
          </Badge>
          <Badge tone="violet" variant="outline">
            {portfolioLabels[idea.portfolio_value]}
          </Badge>
        </div>
        {onToggleFavorite ? (
          <IconButton
            label={favorite ? "Quitar de favoritas" : "Marcar como favorita"}
            tone={favorite ? "accent" : "ghost"}
            size="sm"
            onClick={() => onToggleFavorite(idea, favorite)}
            disabled={pending}
            aria-pressed={favorite}
          >
            {favorite ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </IconButton>
        ) : null}
      </div>

      <Link to={`/ideas/${idea.id}`} className="idea-card__title">
        {idea.title}
      </Link>
      <p className="idea-card__summary">{idea.summary}</p>

      {!compact ? (
        <div className="idea-card__technologies">
          {idea.technologies.slice(0, 5).map((technology) => (
            <span className="tag" key={technology}>
              {technology}
            </span>
          ))}
        </div>
      ) : null}

      <div className="idea-card__footer">
        <span>
          <Boxes size={12} aria-hidden />
          {idea.repositories.length} {idea.repositories.length === 1 ? "repo" : "repos"}
        </span>
        <span>
          <Layers size={12} aria-hidden />
          {idea.category}
        </span>
        <span>
          <Clock3 size={12} aria-hidden />
          {formatRelative(idea.updated_at)}
        </span>
        {idea.generated_by === "rules" ? (
          <span className="idea-card__generated">
            <Star size={11} aria-hidden /> generada por reglas
          </span>
        ) : null}
      </div>
    </SpotlightCard>
  );
}
