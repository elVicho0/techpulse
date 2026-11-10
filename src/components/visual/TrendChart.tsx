import { useId, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useElementSize } from "@/lib/useElementSize";
import { cn, formatDate, formatNumber } from "@/lib/utils";

export type TrendPoint = {
  date: string;
  value: number;
};

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const after = points[index + 2] ?? next;
    const control1X = current.x + (next.x - previous.x) / 6;
    const control1Y = current.y + (next.y - previous.y) / 6;
    const control2X = next.x - (after.x - current.x) / 6;
    const control2Y = next.y - (after.y - current.y) / 6;
    path += ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
  }
  return path;
}

function niceTicks(min: number, max: number, count = 4) {
  if (min === max) return [min];
  const span = max - min;
  const step = Math.pow(10, Math.floor(Math.log10(span / count)));
  const normalized = span / count / step;
  const multiplier = normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1;
  const niceStep = multiplier * step;
  const start = Math.floor(min / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let value = start; value <= max + niceStep * 0.5; value += niceStep) {
    if (value >= min - niceStep * 0.5) ticks.push(Number(value.toFixed(6)));
  }
  return ticks;
}

export function TrendChart({
  points,
  height = 230,
  tone = "blue",
  valueLabel = "valor",
  formatValue = (value) => formatNumber(value),
  className,
}: {
  points: TrendPoint[];
  height?: number;
  tone?: "blue" | "violet" | "cyan";
  valueLabel?: string;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const { ref, width } = useElementSize<HTMLDivElement>();
  const reducedMotion = useReducedMotion();
  const gradientId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const chartWidth = Math.max(width, 280);
  const padding = { top: 18, right: 14, bottom: 28, left: 46 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = maxValue - minValue || Math.max(1, maxValue * 0.05);
    const domainMin = Math.max(0, minValue - spread * 0.18);
    const domainMax = maxValue + spread * 0.12;
    const ticks = niceTicks(domainMin, domainMax, 4);
    const scaleY = (value: number) =>
      padding.top + innerHeight - ((value - domainMin) / (domainMax - domainMin)) * innerHeight;
    const scaleX = (index: number) =>
      padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
    const coords = points.map((point, index) => ({
      x: scaleX(index),
      y: scaleY(point.value),
      point,
      index,
    }));
    const line = buildSmoothPath(coords);
    const area = `${line} L ${coords[coords.length - 1].x} ${padding.top + innerHeight} L ${coords[0].x} ${padding.top + innerHeight} Z`;
    return { coords, line, area, ticks, scaleY, domainMin, domainMax };
  }, [points, innerWidth, innerHeight, padding.left, padding.top]);

  const labelTicks = useMemo(() => {
    if (points.length === 0) return [];
    const desired = Math.min(4, points.length);
    return Array.from({ length: desired }).map((_, index) => {
      const pointIndex = Math.round((index / Math.max(desired - 1, 1)) * (points.length - 1));
      return { index: pointIndex, label: formatDate(points[pointIndex].date) };
    });
  }, [points]);

  if (!geometry) {
    return (
      <div className={cn("trend-chart trend-chart--empty", className)} style={{ height }}>
        <p>Sin snapshots suficientes para dibujar una tendencia.</p>
      </div>
    );
  }

  const hovered = hover !== null ? geometry.coords[hover] : null;

  return (
    <div
      ref={ref}
      className={cn("trend-chart", `trend-chart--${tone}`, className)}
      style={{ height }}
      onPointerLeave={() => setHover(null)}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const relative = event.clientX - rect.left - padding.left;
        const ratio = Math.min(1, Math.max(0, relative / innerWidth));
        setHover(Math.round(ratio * (points.length - 1)));
      }}
    >
      <svg
        width={chartWidth}
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
        role="img"
        aria-label={`Tendencia de ${valueLabel}. ${points.length} puntos de ${formatDate(points[0].date)} a ${formatDate(points[points.length - 1].date)}.`}
      >
        <defs>
          <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--trend-from)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--trend-from)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`line-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--trend-from)" />
            <stop offset="100%" stopColor="var(--trend-to)" />
          </linearGradient>
        </defs>

        {geometry.ticks.map((tick) => {
          const y = geometry.scaleY(tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={y}
                y2={y}
                className="trend-chart__grid"
              />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" className="trend-chart__axis">
                {formatValue(tick)}
              </text>
            </g>
          );
        })}

        <motion.path
          d={geometry.area}
          fill={`url(#area-${gradientId})`}
          initial={{ opacity: reducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.7 }}
        />
        <motion.path
          d={geometry.line}
          fill="none"
          stroke={`url(#line-${gradientId})`}
          strokeWidth={2.2}
          strokeLinecap="round"
          initial={{ pathLength: reducedMotion ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reducedMotion ? 0 : 1.1, ease: "easeOut" }}
        />

        {hovered ? (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={padding.top}
              y2={padding.top + innerHeight}
              className="trend-chart__crosshair"
            />
            <circle cx={hovered.x} cy={hovered.y} r={5.5} className="trend-chart__dot" />
            <circle cx={hovered.x} cy={hovered.y} r={2} fill="#fff" />
          </g>
        ) : (
          <circle
            cx={geometry.coords[geometry.coords.length - 1].x}
            cy={geometry.coords[geometry.coords.length - 1].y}
            r={4}
            className="trend-chart__dot"
          />
        )}

        {labelTicks.map((tick) => {
          const coord = geometry.coords[tick.index];
          return (
            <text
              key={`${tick.index}-${tick.label}`}
              x={coord.x}
              y={height - 8}
              textAnchor={tick.index === 0 ? "start" : tick.index === points.length - 1 ? "end" : "middle"}
              className="trend-chart__axis"
            >
              {tick.label}
            </text>
          );
        })}
      </svg>

      {hovered ? (
        <div
          className="trend-chart__tooltip"
          style={{
            left: `${Math.min(Math.max(hovered.x, 70), chartWidth - 70)}px`,
            top: `${Math.max(hovered.y - 18, 8)}px`,
          }}
        >
          <strong>{formatValue(hovered.point.value)}</strong>
          <span>{formatDate(hovered.point.date, true)}</span>
        </div>
      ) : null}
    </div>
  );
}
