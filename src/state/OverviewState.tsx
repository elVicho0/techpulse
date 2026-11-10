import { createContext, useContext, type ReactNode } from "react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { useResource } from "@/api/hooks";
import type { Overview } from "@/api/types";

type OverviewStateValue = ReturnType<typeof useResource<Overview>>;

const OverviewContext = createContext<OverviewStateValue | null>(null);

export function OverviewProvider({ children }: { children: ReactNode }) {
  const resource = useResource<Overview>({
    live: (signal) => api.overview(6, signal),
    demo: () => demo.overview(6),
    pollMs: 60_000,
  });
  return <OverviewContext.Provider value={resource}>{children}</OverviewContext.Provider>;
}

export function useOverview() {
  const context = useContext(OverviewContext);
  if (!context) throw new Error("useOverview must be used inside OverviewProvider");
  return context;
}
