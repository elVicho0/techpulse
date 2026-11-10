import { useCallback, useState } from "react";
import { ApiError, api } from "@/api/client";
import type { SavedItemType } from "@/api/types";
import { useAppState } from "@/state/AppState";
import { useToast } from "@/components/ui/Toast";

type Key = `${SavedItemType}:${number}`;

export function useSavedActions() {
  const { mode } = useAppState();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Partial<Record<Key, boolean>>>({});
  const [pending, setPending] = useState<Partial<Record<Key, boolean>>>({});

  const isSaved = useCallback(
    (type: SavedItemType, id: number, fallback: boolean) => overrides[`${type}:${id}` as Key] ?? fallback,
    [overrides],
  );

  const isPending = useCallback(
    (type: SavedItemType, id: number) => Boolean(pending[`${type}:${id}` as Key]),
    [pending],
  );

  const toggle = useCallback(
    async (type: SavedItemType, id: number, current: boolean, label: string) => {
      const key = `${type}:${id}` as Key;
      const target = !current;
      setOverrides((state) => ({ ...state, [key]: target }));
      setPending((state) => ({ ...state, [key]: true }));

      if (mode === "demo") {
        setPending((state) => ({ ...state, [key]: false }));
        toast.info(
          target ? "Guardado en la vista de diseño" : "Eliminado de la vista de diseño",
          "Los guardados reales se habilitan cuando la API local está conectada.",
        );
        return;
      }

      try {
        if (type === "repository") {
          if (target) await api.saveRepository(id);
          else await api.unsaveRepository(id);
        } else if (type === "news") {
          if (target) await api.saveNews(id);
          else await api.unsaveNews(id);
        } else {
          if (target) await api.favoriteIdea(id);
          else await api.unfavoriteIdea(id);
        }
        toast.success(target ? "Guardado" : "Eliminado de guardados", label);
      } catch (error) {
        if (error instanceof ApiError && error.code === "CONFLICT" && target) {
          setOverrides((state) => ({ ...state, [key]: true }));
          return;
        }
        setOverrides((state) => ({ ...state, [key]: current }));
        toast.error(
          target ? "No se pudo guardar" : "No se pudo quitar",
          error instanceof Error ? error.message : undefined,
        );
      } finally {
        setPending((state) => ({ ...state, [key]: false }));
      }
    },
    [mode, toast],
  );

  return { isSaved, isPending, toggle };
}
