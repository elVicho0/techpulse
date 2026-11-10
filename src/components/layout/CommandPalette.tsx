import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Bookmark,
  BrainCircuit,
  CornerDownLeft,
  FileText,
  GitBranch,
  Lightbulb,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { ApiError, api, openExternal } from "@/api/client";
import { demo } from "@/api/demo";
import type { SearchMode, SearchResults } from "@/api/types";
import { allNavItems } from "@/lib/navigation";
import { cn, formatDate } from "@/lib/utils";
import { useAppState } from "@/state/AppState";
import { Kbd } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/Controls";
import { useScrollLock } from "@/components/ui/Toast";

type PaletteAction = {
  key: string;
  kind: "nav" | "repository" | "news" | "idea";
  title: string;
  subtitle?: string;
  meta?: string;
  icon: typeof GitBranch;
  run: () => void;
};

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { mode } = useAppState();
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("keyword");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      window.clearTimeout(timer);
      restoreFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        if (mode === "demo") {
          setResults(demo.search(trimmed, searchMode));
        } else {
          setResults(await api.search(trimmed, searchMode, "repository,news,idea", 6, controller.signal));
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setResults(null);
        setError(
          caught instanceof ApiError
            ? caught.code === "EMBEDDINGS_UNAVAILABLE"
              ? "La búsqueda semántica no está disponible. Prueba el modo keyword."
              : caught.message
            : "No se pudo buscar.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, searchMode, open, mode]);

  const actions = useMemo<PaletteAction[]>(() => {
    if (query.trim().length < 2) {
      return allNavItems.map((item) => ({
        key: `nav-${item.to}`,
        kind: "nav",
        title: item.label,
        subtitle: item.description,
        meta: "Ir a",
        icon: item.icon,
        run: () => {
          navigate(item.to);
          onClose();
        },
      }));
    }
    if (!results) return [];
    const list: PaletteAction[] = [];
    for (const repo of results.repositories) {
      list.push({
        key: `repo-${repo.id}`,
        kind: "repository",
        title: repo.full_name,
        subtitle: repo.description ?? "Sin descripción",
        meta: repo.match.similarity !== null ? `${Math.round(repo.match.similarity * 100)}% similitud` : `${repo.stars} estrellas`,
        icon: GitBranch,
        run: () => {
          navigate(`/repo/${repo.id}`);
          onClose();
        },
      });
    }
    for (const item of results.news) {
      list.push({
        key: `news-${item.id}`,
        kind: "news",
        title: item.title,
        subtitle: item.source.name,
        meta: formatDate(item.published_at ?? item.fetched_at),
        icon: FileText,
        run: () => {
          void openExternal(item.url);
          onClose();
        },
      });
    }
    for (const idea of results.ideas) {
      list.push({
        key: `idea-${idea.id}`,
        kind: "idea",
        title: idea.title,
        subtitle: idea.summary,
        meta: idea.category,
        icon: Lightbulb,
        run: () => {
          navigate(`/ideas/${idea.id}`);
          onClose();
        },
      });
    }
    return list;
  }, [query, results, navigate, onClose]);

  useEffect(() => {
    setActive(0);
  }, [query, searchMode]);

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    element?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((current) => (actions.length ? (current + 1) % actions.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((current) => (actions.length ? (current - 1 + actions.length) % actions.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        actions[active]?.run();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, actions, active, onClose]);

  if (!open) return null;

  const modeMismatch = results && results.mode_used !== results.mode_requested;

  return (
    <div className="palette" role="presentation">
      <button type="button" className="palette__backdrop" onClick={onClose} aria-label="Cerrar búsqueda" tabIndex={-1} />
      <div className="palette__dialog" role="dialog" aria-modal="true" aria-label="Búsqueda global">
        <div className="palette__search">
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca repositorios, noticias, ideas o navega…"
            aria-label="Término de búsqueda"
            spellCheck={false}
          />
          {loading ? <LoaderCircle size={16} className="spin" aria-label="Buscando" /> : <Kbd>Esc</Kbd>}
        </div>

        <div className="palette__toolbar">
          <SegmentedControl
            ariaLabel="Modo de búsqueda"
            size="sm"
            value={searchMode}
            onChange={setSearchMode}
            options={[
              { value: "keyword", label: "Keyword" },
              { value: "semantic", label: "Semántico" },
              { value: "hybrid", label: "Híbrido" },
            ]}
          />
          <span className="palette__privacy">
            <Sparkles size={12} aria-hidden />
            {searchMode === "keyword" ? "Búsqueda local por texto" : "Embeddings locales, sin nube"}
          </span>
        </div>

        <div className="palette__body" ref={listRef}>
          {error ? (
            <div className="palette__message">
              <strong>No se pudo completar la búsqueda</strong>
              <p>{error}</p>
            </div>
          ) : null}

          {modeMismatch ? (
            <div className="palette__notice">
              Se pidió <strong>{results?.mode_requested}</strong> y se usó{" "}
              <strong>{results?.mode_used}</strong> porque el índice no está disponible.
            </div>
          ) : null}

          {query.trim().length < 2 ? (
            <div className="palette__group-label">Navegación rápida</div>
          ) : null}

          {actions.length === 0 && !loading && query.trim().length >= 2 && !error ? (
            <div className="palette__message">
              <strong>Sin resultados</strong>
              <p>Prueba otro término o cambia el modo de búsqueda.</p>
            </div>
          ) : null}

          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                type="button"
                key={action.key}
                data-index={index}
                className={cn("palette__item", index === active && "is-active")}
                onMouseEnter={() => setActive(index)}
                onClick={action.run}
              >
                <span className={cn("palette__item-icon", `palette__item-icon--${action.kind}`)} aria-hidden>
                  <Icon size={15} />
                </span>
                <span className="palette__item-copy">
                  <strong>{action.title}</strong>
                  {action.subtitle ? <span>{action.subtitle}</span> : null}
                </span>
                <span className="palette__item-meta">{action.meta}</span>
                <ArrowRight size={13} className="palette__item-arrow" aria-hidden />
              </button>
            );
          })}
        </div>

        <div className="palette__footer">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> navegar
          </span>
          <span>
            <Kbd>
              <CornerDownLeft size={10} />
            </Kbd>{" "}
            abrir
          </span>
          <span className="palette__footer-note">
            {mode === "demo" ? "Resultados de demostración" : "API local · 127.0.0.1:8765"}
          </span>
        </div>
      </div>
    </div>
  );
}
