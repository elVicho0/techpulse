import { useEffect, useId, type ReactNode } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { AlertTriangle, Inbox, RefreshCw, type LucideIcon } from "lucide-react";
import { ApiError } from "@/api/client";
import { cn, clamp, formatCompact } from "@/lib/utils";
import { Button } from "./Button";

/** Adapted from motion-primitives AnimatedNumber (MIT). */
export function AnimatedNumber({
  value,
  className,
  format = (current) => formatCompact(Math.round(current)),
}: {
  value: number;
  className?: string;
  format?: (value: number) => string;
}) {
  const reducedMotion = useReducedMotion();
  const spring = useSpring(value, { stiffness: 90, damping: 24, mass: 0.8 });
  const display = useTransform(spring, (current) => format(current));

  useEffect(() => {
    if (reducedMotion) spring.jump(value);
    else spring.set(value);
  }, [spring, value, reducedMotion]);

  if (reducedMotion) {
    return <span className={cn("tabular", className)}>{format(value)}</span>;
  }
  return <motion.span className={cn("tabular", className)}>{display}</motion.span>;
}

export function ScoreRing({
  value,
  size = 46,
  label,
  tone = "blue",
}: {
  value: number | null;
  size?: number;
  label?: string;
  tone?: "blue" | "violet" | "cyan";
}) {
  const id = useId().replace(/:/g, "");
  const stroke = 3.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalized = value === null ? 0 : clamp(value);
  const offset = circumference * (1 - normalized);

  return (
    <span
      className={cn("score-ring", `score-ring--${tone}`)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label ?? "Interés"}: ${value === null ? "sin datos" : Math.round(value * 100) + "%"}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--ring-from)" />
            <stop offset="100%" stopColor="var(--ring-to)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="score-ring__value"
        />
      </svg>
      <span className="score-ring__label">
        {value === null ? "—" : Math.round(value * 100)}
      </span>
    </span>
  );
}

const scoreLabels: Array<[keyof ScoreSetLike, string]> = [
  ["interest", "Interés"],
  ["quality", "Calidad"],
  ["growth", "Crecimiento"],
  ["activity", "Actividad"],
  ["maintenance", "Mantenimiento"],
  ["relevance", "Relevancia"],
  ["popularity", "Popularidad"],
];

type ScoreSetLike = {
  popularity: number;
  growth: number | null;
  activity: number;
  maintenance: number;
  relevance: number;
  interest: number;
  quality: number;
};

export function ScoreBars({ scores, compact = false }: { scores: ScoreSetLike; compact?: boolean }) {
  const items = compact ? scoreLabels.slice(0, 3) : scoreLabels;
  return (
    <div className={cn("score-bars", compact && "score-bars--compact")}>
      {items.map(([key, label]) => {
        const value = scores[key];
        return (
          <div className="score-bar" key={key}>
            <div className="score-bar__head">
              <span>{label}</span>
              <span className="tabular">{value === null ? "Sin datos" : `${Math.round(value * 100)}`}</span>
            </div>
            <div className="score-bar__track">
              <span
                className="score-bar__fill"
                style={{ width: value === null ? "0%" : `${clamp(value) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "blue",
  label,
}: {
  value: number;
  tone?: "blue" | "violet" | "green" | "amber";
  label?: string;
}) {
  return (
    <div
      className={cn("progress", `progress--${tone}`)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp(value) * 100)}
      aria-label={label}
    >
      <span className="progress__fill" style={{ width: `${clamp(value) * 100}%` }} />
    </div>
  );
}

export function StatusDot({ state }: { state: "online" | "stale" | "offline" | "success" | "error" | "idle" }) {
  return <span className={cn("status-dot", `status-dot--${state}`)} aria-hidden />;
}

export function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "blue",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "blue" | "violet" | "cyan" | "green" | "amber";
  children?: ReactNode;
}) {
  return (
    <div className={cn("metric-tile", `metric-tile--${tone}`)}>
      <div className="metric-tile__top">
        <span className="metric-tile__icon" aria-hidden>
          <Icon size={16} />
        </span>
        <span className="metric-tile__label">{label}</span>
      </div>
      <div className="metric-tile__value">{value}</div>
      {hint ? <div className="metric-tile__hint">{hint}</div> : null}
      {children}
    </div>
  );
}

export function Skeleton({
  width,
  height = 14,
  rounded = 8,
  className,
}: {
  width?: string | number;
  height?: number | string;
  rounded?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("skeleton", className)}
      style={{ width, height, borderRadius: rounded }}
      aria-hidden
    />
  );
}

export function LoadingBlock({ rows = 3, label = "Cargando información" }: { rows?: number; label?: string }) {
  return (
    <div className="loading-block" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div className="loading-block__row" key={index}>
          <Skeleton width={44} height={44} rounded={12} />
          <div className="loading-block__copy">
            <Skeleton width={`${58 + (index % 3) * 12}%`} height={12} />
            <Skeleton width={`${34 + (index % 2) * 16}%`} height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("empty-state", compact && "empty-state--compact")}>
      <span className="empty-state__icon" aria-hidden>
        <Icon size={22} />
      </span>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  compact = false,
}: {
  error: ApiError | Error | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const isOffline = apiError?.isOffline ?? false;
  return (
    <div className={cn("error-state", compact && "error-state--compact")} role="alert">
      <span className="error-state__icon" aria-hidden>
        <AlertTriangle size={20} />
      </span>
      <div className="error-state__copy">
        <h3>{isOffline ? "La API local no está disponible" : "No se pudo cargar esta sección"}</h3>
        <p>
          {error?.message ??
            "Comprueba que techpulse-api esté ejecutándose en 127.0.0.1:8765."}
          {apiError?.requestId ? (
            <span className="error-state__request"> · request_id: {apiError.requestId}</span>
          ) : null}
        </p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" leadingIcon={<RefreshCw size={14} />} onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header__main">
        {eyebrow ? <div className="page-header__eyebrow">{eyebrow}</div> : null}
        <h1 className="page-header__title">{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  icon: Icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="section-header">
      <div className="section-header__title">
        {Icon ? (
          <span className="section-header__icon" aria-hidden>
            <Icon size={16} />
          </span>
        ) : null}
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="section-header__action">{action}</div> : null}
    </div>
  );
}
