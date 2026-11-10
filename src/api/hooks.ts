import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { useAppState } from "@/state/AppState";

type ResourceOptions<T> = {
  live: (signal: AbortSignal) => Promise<T>;
  demo?: () => T;
  deps?: unknown[];
  pollMs?: number;
  enabled?: boolean;
};

type ResourceResult<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
  isDemo: boolean;
};

/**
 * Small typed data hook: abortable requests, visible-only polling and an
 * explicit demo fallback. Live data is never silently replaced by demo data
 * outside the labelled demo mode.
 */
export function useResource<T>({
  live,
  demo,
  deps = [],
  pollMs,
  enabled = true,
}: ResourceOptions<T>): ResourceResult<T> {
  const { mode } = useAppState();
  const isDemo = mode === "demo" && Boolean(demo);
  const [data, setData] = useState<T | null>(() => (isDemo && demo ? demo() : null));
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const liveRef = useRef(live);
  const demoRef = useRef(demo);
  liveRef.current = live;
  demoRef.current = demo;

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (isDemo) {
      setData(demoRef.current ? demoRef.current() : null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const run = async (background = false) => {
      if (background) setRefreshing(true);
      else setLoading(true);
      try {
        const result = await liveRef.current(controller.signal);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (caught) {
        if (cancelled || controller.signal.aborted) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError("INTERNAL_ERROR", "No se pudo cargar la información."),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void run();
    let interval: number | undefined;
    if (pollMs && pollMs > 0) {
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void run(true);
      }, pollMs);
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, enabled, pollMs, tick, ...deps]);

  return { data, error, loading, refreshing, refresh, isDemo };
}

/** True while the document is visible; used to pause decorative effects. */
export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

/** True when the element has been intersecting the viewport. */
export function useInViewOnce<T extends Element>(options: IntersectionObserverInit = { threshold: 0.15 }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setInView(true);
        observer.disconnect();
      }
    }, options);
    observer.observe(element);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}

/** Page title helper. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · TechPulse`;
  }, [title]);
}
