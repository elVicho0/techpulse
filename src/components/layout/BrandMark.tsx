import { useId } from "react";
import { cn } from "@/lib/utils";

export function BrandMark({ size = 34, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={cn("brand-mark", className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 40 40" width={size} height={size} fill="none">
        <defs>
          <linearGradient id={`mark-bg-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0b1226" />
            <stop offset="100%" stopColor="#151a3a" />
          </linearGradient>
          <linearGradient id={`mark-line-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="11" fill={`url(#mark-bg-${id})`} stroke="rgba(120,140,255,0.34)" strokeWidth="1.2" />
        <path
          d="M7.5 21h5.2l3.2-8.4 4.6 16.2 3.3-8.4h8.7"
          stroke={`url(#mark-line-${id})`}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
