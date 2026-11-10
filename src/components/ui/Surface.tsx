import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function GlassPanel({
  children,
  className,
  tone = "default",
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  tone?: "default" | "strong" | "flat";
}) {
  return (
    <section className={cn("glass-panel", `glass-panel--${tone}`, className)} {...props}>
      {children}
    </section>
  );
}

/**
 * Pointer-tracked highlight. Adapted from the pattern used by
 * motion-primitives (MIT) and ui-layouts (MIT); rewritten for CSS variables
 * and rAF throttling so it stays cheap and never intercepts input.
 */
export function SpotlightCard({
  children,
  className,
  interactive = true,
  ...props
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const [pointerFine, setPointerFine] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(pointer: fine)");
    const update = () => setPointerFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !pointerFine || reducedMotion) return;
      const element = ref.current;
      if (!element || frame.current !== null) return;
      const { clientX, clientY } = event;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = null;
        const rect = element.getBoundingClientRect();
        element.style.setProperty("--spot-x", `${clientX - rect.left}px`);
        element.style.setProperty("--spot-y", `${clientY - rect.top}px`);
        element.style.setProperty("--spot-opacity", "1");
      });
    },
    [interactive, pointerFine, reducedMotion],
  );

  const onPointerLeave = useCallback(() => {
    if (frame.current !== null) {
      window.cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    ref.current?.style.setProperty("--spot-opacity", "0");
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    },
    [],
  );

  return (
    <div
      ref={ref}
      className={cn("spotlight-card", interactive && "spotlight-card--interactive", className)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ "--spot-opacity": 0 } as CSSProperties}
      {...props}
    >
      {interactive ? <span className="spotlight-card__glow" aria-hidden /> : null}
      {children}
    </div>
  );
}

export function Monogram({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hue = Array.from(name).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={cn("monogram", `monogram--${size}`, className)}
      style={
        {
          "--mono-hue": hue,
        } as CSSProperties
      }
      aria-hidden
    >
      {name
        .split(/[/\s._-]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("divider", className)} role="separator" />;
}
