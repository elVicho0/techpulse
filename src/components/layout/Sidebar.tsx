import { NavLink } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import { navigation } from "@/lib/navigation";
import { cn, formatRelative, workerStateLabels } from "@/lib/utils";
import { useAppState } from "@/state/AppState";
import { useOverview } from "@/state/OverviewState";
import { StatusDot } from "@/components/ui/DataDisplay";
import { BrandMark } from "./BrandMark";

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { worker, mode, lastCheckedAt } = useAppState();
  const { data: overview } = useOverview();
  const counts = overview?.counts;

  return (
    <>
      <button
        type="button"
        className={cn("sidebar-scrim", mobileOpen && "is-open")}
        onClick={onCloseMobile}
        aria-label="Cerrar navegación"
        tabIndex={mobileOpen ? 0 : -1}
      />
      <aside
        className={cn("sidebar", collapsed && "is-collapsed", mobileOpen && "is-mobile-open")}
        aria-label="Navegación principal"
      >
        <div className="sidebar__brand">
          <NavLink to="/" className="sidebar__brand-link" onClick={onCloseMobile} aria-label="TechPulse, ir al overview">
            <BrandMark size={36} />
            <span className="sidebar__wordmark">
              <strong>TechPulse</strong>
              <small>Developer Intelligence</small>
            </span>
          </NavLink>
          <button
            type="button"
            className="icon-button icon-button--ghost icon-button--sm sidebar__mobile-close"
            onClick={onCloseMobile}
            aria-label="Cerrar navegación"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navigation.map((section) => (
            <div className="sidebar__section" key={section.title}>
              <div className="sidebar__section-title">{section.title}</div>
              <ul>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const badge = item.badgeKey && counts ? counts[item.badgeKey] : undefined;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : item.description}
                        className={({ isActive }) =>
                          cn(
                            "sidebar__link",
                            isActive && "is-active",
                            item.accent && `sidebar__link--${item.accent}`,
                          )
                        }
                      >
                        <span className="sidebar__link-icon" aria-hidden>
                          <Icon size={17} strokeWidth={1.8} />
                        </span>
                        <span className="sidebar__link-copy">
                          <span className="sidebar__link-label">{item.label}</span>
                          <span className="sidebar__link-description">{item.description}</span>
                        </span>
                        {badge !== undefined ? (
                          <span className="sidebar__badge tabular">{badge > 999 ? `${Math.round(badge / 100) / 10}k` : badge}</span>
                        ) : null}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__system">
            <div className="sidebar__system-head">
              <span className="sidebar__system-icon" aria-hidden>
                <Radio size={14} />
              </span>
              <span className="sidebar__system-title">Sistema</span>
              <span className={cn("sidebar__mode", mode === "demo" && "is-demo")}>
                {mode === "demo" ? "demo" : "local"}
              </span>
            </div>
            <div className="sidebar__system-row">
              <StatusDot state={worker?.state ?? "offline"} />
              <span>{workerStateLabels[worker?.state ?? "offline"]}</span>
              <span className="sidebar__system-sep">·</span>
              <span>{formatRelative(worker?.heartbeat_at ?? null)}</span>
            </div>
            <div className="sidebar__system-row sidebar__system-row--muted">
              <Database size={12} aria-hidden />
              <span>{counts ? `${counts.sources} fuentes` : "API local"}</span>
              <span className="sidebar__system-sep">·</span>
              <span>{lastCheckedAt ? formatRelative(new Date(lastCheckedAt).toISOString()) : "sin comprobar"}</span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar__collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expandir navegación" : "Colapsar navegación"}
            title={collapsed ? "Expandir navegación" : "Colapsar navegación"}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            <span>{collapsed ? "" : "Colapsar"}</span>
          </button>

          {!collapsed ? (
            <p className="sidebar__privacy">
              <Sparkles size={12} aria-hidden />
              Datos y búsqueda semántica permanecen en tu equipo.
            </p>
          ) : null}
        </div>
      </aside>
    </>
  );
}
