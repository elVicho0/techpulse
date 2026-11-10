import { useLocation } from "react-router-dom";
import { FlaskConical, Menu, RefreshCw, Search } from "lucide-react";
import { navItemForPath } from "@/lib/navigation";
import { cn, formatRelative, workerStateLabels } from "@/lib/utils";
import { useAppState } from "@/state/AppState";
import { useOverview } from "@/state/OverviewState";
import { IconButton, Kbd } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/DataDisplay";

export function Topbar({
  onOpenSearch,
  onOpenMobileNav,
}: {
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
}) {
  const location = useLocation();
  const current = navItemForPath(location.pathname);
  const { mode, worker, refreshing, refreshStatus } = useAppState();
  const overview = useOverview();

  const refresh = () => {
    void refreshStatus();
    overview.refresh();
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="icon-button icon-button--ghost icon-button--md topbar__menu"
          onClick={onOpenMobileNav}
          aria-label="Abrir navegación"
        >
          <Menu size={18} />
        </button>
        <div className="topbar__crumb">
          <span className="topbar__crumb-root">TechPulse</span>
          <span className="topbar__crumb-sep" aria-hidden>
            /
          </span>
          <span className="topbar__crumb-current">{current?.label ?? "Detalle"}</span>
        </div>
      </div>

      <div className="topbar__right">
        {mode === "demo" ? (
          <span className="topbar__demo-pill" title="Los datos mostrados son ejemplos de diseño">
            <FlaskConical size={13} aria-hidden />
            Demo
          </span>
        ) : null}

        <button type="button" className="topbar__search" onClick={onOpenSearch} aria-label="Abrir búsqueda global">
          <Search size={14} aria-hidden />
          <span>Buscar repos, noticias, ideas…</span>
          <Kbd>Ctrl K</Kbd>
        </button>

        <IconButton
          label="Actualizar estado y datos"
          tone="ghost"
          onClick={refresh}
          disabled={refreshing}
          className={cn(refreshing && "is-spinning")}
        >
          <RefreshCw size={16} />
        </IconButton>

        <div
          className={cn("topbar__worker", `topbar__worker--${worker?.state ?? "offline"}`)}
          title={
            worker?.heartbeat_at
              ? `Heartbeat ${formatRelative(worker.heartbeat_at)} · worker ${worker.worker_id ?? "sin id"}`
              : "Sin heartbeat del worker"
          }
        >
          <StatusDot state={worker?.state ?? "offline"} />
          <span>{workerStateLabels[worker?.state ?? "offline"]}</span>
        </div>
      </div>
    </header>
  );
}
