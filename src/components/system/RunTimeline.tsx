import type { SourceRun } from "@/api/types";
import { cn, formatDuration, formatRelative, runStatusLabels } from "@/lib/utils";
import { StatusDot } from "@/components/ui/DataDisplay";

const statusState = {
  queued: "idle",
  running: "online",
  success: "success",
  partial: "stale",
  failed: "error",
  skipped: "idle",
} as const;

export function RunTimeline({ runs, compact = false }: { runs: SourceRun[]; compact?: boolean }) {
  if (runs.length === 0) {
    return <p className="run-timeline__empty">Todavía no hay ejecuciones registradas.</p>;
  }
  return (
    <ol className={cn("run-timeline", compact && "run-timeline--compact")}>
      {runs.map((run) => (
        <li className={cn("run-timeline__item", `run-timeline__item--${run.status}`)} key={run.id}>
          <span className="run-timeline__rail" aria-hidden>
            <StatusDot state={statusState[run.status]} />
          </span>
          <div className="run-timeline__body">
            <div className="run-timeline__head">
              <strong>{run.source_name}</strong>
              <span className={cn("run-timeline__status", `is-${run.status}`)}>{runStatusLabels[run.status]}</span>
            </div>
            <div className="run-timeline__meta">
              <span>{formatRelative(run.started_at ?? run.finished_at)}</span>
              <span aria-hidden>·</span>
              <span>{run.trigger}</span>
              {run.duration_ms !== null ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatDuration(run.duration_ms)}</span>
                </>
              ) : null}
            </div>
            {!compact ? (
              <div className="run-timeline__counts">
                <span>{run.items_new} nuevos</span>
                <span>{run.items_updated} actualizados</span>
                <span>{run.items_fetched} leídos</span>
              </div>
            ) : null}
            {run.error_message ? <p className="run-timeline__error">{run.error_message}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
