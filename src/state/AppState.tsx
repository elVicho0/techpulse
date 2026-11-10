import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api } from "@/api/client";
import { demo } from "@/api/demo";
import type { Capabilities, Health, WorkerStatus } from "@/api/types";

export type DataMode = "live" | "demo";

type AppStateValue = {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  demoReason: string | null;
  health: Health | null;
  worker: WorkerStatus | null;
  capabilities: Capabilities | null;
  booting: boolean;
  refreshing: boolean;
  lastCheckedAt: number | null;
  refreshStatus: () => Promise<void>;
  retryLive: () => Promise<boolean>;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function initialMode(): DataMode {
  const params = new URLSearchParams(window.location.search);
  if (params.get("demo") === "1") return "demo";
  if (params.get("demo") === "0") return "live";
  return "live";
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>(initialMode);
  const [demoReason, setDemoReason] = useState<string | null>(() =>
    initialMode() === "demo" ? "Vista de diseño solicitada con ?demo=1." : null,
  );
  const [health, setHealth] = useState<Health | null>(null);
  const [worker, setWorker] = useState<WorkerStatus | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const forcedLive = useRef(new URLSearchParams(window.location.search).get("demo") === "0");

  const setMode = useCallback((next: DataMode) => {
    setModeState(next);
    if (next === "live") setDemoReason(null);
  }, []);

  const loadStatus = useCallback(async (signal?: AbortSignal) => {
    const [healthResult, workerResult, capabilitiesResult] = await Promise.allSettled([
      api.health(signal),
      api.workerStatus(signal),
      api.capabilities(signal),
    ]);
    return { healthResult, workerResult, capabilitiesResult };
  }, []);

  const refreshStatus = useCallback(async () => {
    if (mode === "demo") {
      setHealth(demo.health());
      setWorker(demo.worker());
      setCapabilities(demo.capabilities());
      setLastCheckedAt(Date.now());
      return;
    }
    setRefreshing(true);
    try {
      const { healthResult, workerResult, capabilitiesResult } = await loadStatus();
      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      if (workerResult.status === "fulfilled") setWorker(workerResult.value);
      if (capabilitiesResult.status === "fulfilled") setCapabilities(capabilitiesResult.value);
      setLastCheckedAt(Date.now());
    } finally {
      setRefreshing(false);
    }
  }, [loadStatus, mode]);

  const retryLive = useCallback(async () => {
    try {
      const health = await api.health();
      setHealth(health);
      setMode("live");
      setDemoReason(null);
      const [workerResult, capabilitiesResult] = await Promise.allSettled([
        api.workerStatus(),
        api.capabilities(),
      ]);
      if (workerResult.status === "fulfilled") setWorker(workerResult.value);
      if (capabilitiesResult.status === "fulfilled") setCapabilities(capabilitiesResult.value);
      setLastCheckedAt(Date.now());
      return true;
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "La API local sigue sin responder.";
      setDemoReason(message);
      return false;
    }
  }, [setMode]);

  // Initial boot: decide live vs demo without blocking the UI.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const boot = async () => {
      if (initialMode() === "demo") {
        if (!cancelled) {
          setHealth(demo.health());
          setWorker(demo.worker());
          setCapabilities(demo.capabilities());
          setLastCheckedAt(Date.now());
          setBooting(false);
        }
        return;
      }
      try {
        const [healthResult, workerResult, capabilitiesResult] = await Promise.allSettled([
          api.health(controller.signal),
          api.workerStatus(controller.signal),
          api.capabilities(controller.signal),
        ]);
        if (cancelled) return;
        if (healthResult.status === "rejected") {
          if (!forcedLive.current) {
            setModeState("demo");
            setDemoReason(
              healthResult.reason instanceof ApiError
                ? healthResult.reason.message
                : "La API local no está disponible.",
            );
            setHealth(demo.health());
            setWorker(demo.worker());
            setCapabilities(demo.capabilities());
          } else {
            setHealth(null);
          }
        } else {
          setHealth(healthResult.value);
          if (workerResult.status === "fulfilled") setWorker(workerResult.value);
          if (capabilitiesResult.status === "fulfilled") setCapabilities(capabilitiesResult.value);
        }
        setLastCheckedAt(Date.now());
      } finally {
        if (!cancelled) setBooting(false);
      }
    };
    void boot();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Poll worker status every 10 s only while the document is visible.
  useEffect(() => {
    if (mode !== "live") return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      api
        .workerStatus()
        .then((status) => {
          setWorker(status);
          setLastCheckedAt(Date.now());
        })
        .catch(() => {
          setWorker((current) => (current ? { ...current, state: "offline" } : current));
        });
    };
    const interval = window.setInterval(tick, 10_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [mode]);

  const value = useMemo<AppStateValue>(
    () => ({
      mode,
      setMode,
      demoReason,
      health,
      worker,
      capabilities,
      booting,
      refreshing,
      lastCheckedAt,
      refreshStatus,
      retryLive,
    }),
    [
      mode,
      setMode,
      demoReason,
      health,
      worker,
      capabilities,
      booting,
      refreshing,
      lastCheckedAt,
      refreshStatus,
      retryLive,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}
