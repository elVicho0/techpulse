import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { useDocumentVisible, useInViewOnce } from "@/api/hooks";
import { cn } from "@/lib/utils";

const MeshGradient = lazy(() =>
  import("@paper-design/shaders-react").then((module) => ({ default: module.MeshGradient })),
);

function supportsWebGl() {
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ??
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    return Boolean(context);
  } catch {
    return false;
  }
}

class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Paper Shaders (Apache-2.0) aurora, used only in the Overview hero.
 *
 * Guards: lazy chunk, viewport intersection, document visibility,
 * prefers-reduced-motion, WebGL capability and a CSS gradient fallback.
 * The shader is never mounted twice and never runs off-screen.
 */
export function AuroraBackground({
  className,
  variant = "hero",
}: {
  className?: string;
  variant?: "hero" | "panel";
}) {
  const reducedMotion = useReducedMotion();
  const visible = useDocumentVisible();
  const { ref, inView } = useInViewOnce<HTMLDivElement>({ threshold: 0.05 });
  const [webgl, setWebgl] = useState<boolean | null>(null);

  useEffect(() => {
    setWebgl(supportsWebGl());
  }, []);

  const active = webgl === true && inView && visible && !reducedMotion;

  const colors = useMemo(
    () =>
      variant === "hero"
        ? ["#06070d", "#0d1a4d", "#2a1a78", "#4c1d95"]
        : ["#06070d", "#0b1538", "#231a5e", "#0e2a5c"],
    [variant],
  );

  return (
    <div
      ref={ref}
      className={cn("aurora", `aurora--${variant}`, className)}
      aria-hidden
      data-shader={active ? "running" : "paused"}
    >
      <div className="aurora__fallback" />
      {webgl && inView ? (
        <ShaderBoundary>
          <Suspense fallback={null}>
            <MeshGradient
              className="aurora__canvas"
              colors={colors}
              speed={active ? (variant === "hero" ? 0.14 : 0.08) : 0}
              distortion={0.75}
              swirl={0.28}
              grainMixer={0.04}
              grainOverlay={0.16}
              maxPixelCount={variant === "hero" ? 1_280 * 720 : 900 * 520}
              minPixelRatio={1}
            />
          </Suspense>
        </ShaderBoundary>
      ) : null}
      <div className="aurora__veil" />
      <div className="aurora__grid" />
    </div>
  );
}
