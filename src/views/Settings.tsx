import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  RefreshCw,
  Settings2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { Capabilities, Settings } from "@/api/types";
import { useAppState } from "@/state/AppState";
import { Badge, Button } from "@/components/ui/Button";
import { ErrorState, PageHeader } from "@/components/ui/DataDisplay";
import { FilterChip } from "@/components/ui/Controls";
import { GlassPanel } from "@/components/ui/Surface";
import { StatusDot } from "@/components/ui/DataDisplay";
import { workerStateLabels } from "@/lib/utils";
import { cn } from "@/lib/utils";

type SettingRow = {
  key: string;
  label: string;
  description: string;
  input: React.ReactNode;
};

export function SettingsView() {
  usePageTitle("Settings");
  const { capabilities, mode, health, setMode, demoReason } = useAppState();
  const settingsResult = useResource<Settings>({
    live: (signal) => api.settings(signal),
    demo: () => demo.settings(),
    deps: [],
  });
  const capabilitiesResult = useResource<Capabilities>({
    live: (signal) => api.capabilities(signal),
    demo: () => demo.capabilities(),
    deps: [],
  });
  const [pending, setPending] = useState<Partial<Record<string, unknown>>>({});
  const [saving, setSaving] = useState(false);
  const [rankingWeights, setRankingWeights] = useState<{
    growth: number;
    activity: number;
    maintenance: number;
    relevance: number;
    popularity: number;
    interest: number;
    quality: number;
  }>({ growth: 0.3, activity: 0.2, maintenance: 0.2, relevance: 0.15, popularity: 0.15, interest: 0, quality: 0 });

  const settings = settingsResult.data?.settings ?? {};
  const caps = capabilitiesResult.data;

  // Cargar weights de ranking desde API al iniciar
  useEffect(() => {
    async function loadRankingWeights() {
      try {
        const resp = await api.getSettingsWeights();
        const userWeights = resp.weights;
        // Guardar en localStorage para persistencia de sesión
        if (typeof window !== "undefined") {
          localStorage.setItem("techpulse_ranking_weights", JSON.stringify(userWeights));
          // Fusionar: si el usuario tiene weights guardados, usarlos; sino, defaults
          setRankingWeights(userWeights);
        }
      } catch (e) {
        // Si la API falla, intentar recuperar de localStorage
        if (typeof window !== "undefined") {
          const saved = localStorage.getItem("techpulse_ranking_weights");
          if (saved) {
            setRankingWeights(JSON.parse(saved));
          }
        }
      }
    }
    loadRankingWeights();
  }, []);

  // Sincronizar weights a localStorage cuando cambian
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("techpulse_ranking_weights", JSON.stringify(rankingWeights));
    }
  }, [rankingWeights]);

  const settings = settingsResult.data?.settings ?? {};
  const caps = capabilitiesResult.data;

  const updateSetting = (key: string, value: unknown) => {
    setPending((current) => ({ ...current, [key]: value }));
  };

  const saveAll = async () => {
    if (mode === "demo") return;
    setSaving(true);
    try {
      await api.putSettings({ "scheduler.enabled": settings["scheduler.enabled"] });
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo<SettingRow[]>(() => {
    const schedulerEnabled = settings["scheduler.enabled"] ?? true;
    const maxConcurrent = settings["scheduler.max_concurrent_jobs"] ?? 2;
    const heartbeatSeconds = settings["worker.heartbeat_seconds"] ?? 10;
    const staleSeconds = settings["worker.stale_after_seconds"] ?? 30;
    const ideasAutoGenerate = settings["ideas.auto_generate"] ?? true;
    const llmEnabled = settings["llm.enabled"] ?? false;
    const embeddingsEnabled = settings["embeddings.enabled"] ?? true;

    return [
      {
        key: "ui.theme",
        label: "Tema de la aplicación",
        description: "TechPulse está optimizado para modo oscuro del sistema.",
        input: (
          <span className="setting-chip">
            <Sparkles size={12} aria-hidden /> Dark
          </span>
        ),
      },
      {
        key: "scheduler.enabled",
        label: "Actualizaciones programadas",
        description: "El worker ejecuta las fuentes automáticamente en segundo plano.",
        input: (
          <div className="setting-switch">
            <input
              id="scheduler-enabled"
              type="checkbox"
              defaultChecked={Boolean(schedulerEnabled)}
              readOnly
              aria-label={schedulerEnabled ? "Activado" : "Desactivado"}
            />
          </div>
        ),
      },
      {
        key: "scheduler.max_concurrent_jobs",
        label: "Trabajos concurrentes",
        description: "Máximo de fuentes que el worker procesa al mismo tiempo.",
        input: (
          <span className="setting-value">{maxConcurrent}</span>
        ),
      },
      {
        key: "worker.heartbeat_seconds",
        label: "Intervalo de heartbeat del worker",
        description: "Cada cuántos segundos el worker actualiza su señal de vida.",
        input: (
          <span className="setting-value">{heartbeatSeconds} s</span>
        ),
      },
      {
        key: "worker.stale_after_seconds",
        label: "Umbral de worker obsoleto",
        description: "Tiempo sin heartbeat antes de considerar al worker sin señal.",
        input: (
          <span className="setting-value">{staleSeconds} s</span>
        ),
      },
      {
        key: "ideas.auto_generate",
        label: "Generación automática de ideas",
        description: "Crea ideas de proyectos tras detectar repositorios nuevos sin ideas asociadas.",
        input: (
          <div className="setting-switch">
            <input
              id="ideas-auto-generate"
              type="checkbox"
              defaultChecked={Boolean(ideasAutoGenerate)}
              readOnly
              aria-label={ideasAutoGenerate ? "Activado" : "Desactivado"}
            />
          </div>
        ),
      },
      {
        key: "llm.enabled",
        label: "Modelo de lenguaje opcional",
        description: "Desactivado por defecto. Nunca es requisito para funciones básicas.",
        input: (
          <div className="setting-switch">
            <input
              id="llm-enabled"
              type="checkbox"
              defaultChecked={Boolean(llmEnabled)}
              readOnly
              disabled
              aria-label="Desactivado"
            />
          </div>
        ),
      },
      {
        key: "embeddings.enabled",
        label: "Búsqueda semántica local",
        description: "Embeddings locales para "dejar repos" sin enviar datos a la nube.",
        input: (
          <div className="setting-switch">
            <input
              id="embeddings-enabled"
              type="checkbox"
              defaultChecked={Boolean(embeddingsEnabled)}
              readOnly
              aria-label={embeddingsEnabled ? "Activado" : "Desactivado"}
            />
          </div>
        ),
      },
      // NUEVO: Panel de weights de ranking F4.2
      {
        key: "ranking.weights",
        label: "Weights de ranking personalizados",
        description: "Ajusta la importancia de cada señal en el ranking de repositorios. La suma debe ser 1.0.",
        input: (
          <div className="setting__weights-panel">
            <strong>Growth (crecimiento)</strong>
            <span className="setting__weight-value">{rankingWeights.growth}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.growth}
              onChange={(e) => {
                const growth = parseFloat(e.target.value);
                const newWeights = {
                  ...rankingWeights,
                  growth,
                  activity: (Number(rankingWeights.activity) + Number(rankingWeights.relevance + popularity + interest + quality) * 0.01).toFixed(2),
                  maintenance: (Number(rankingWeights.maintenance) + Number(rankingWeights.relevance + popularity + interest + quality) * 0.01).toFixed(2),
                };
                // Recalcular para mantener suma ~1.0 (handled by API)
                setRankingWeights({
                  ...rankingWeights,
                  growth,
                });
                updateSetting("ranking.weights", newWeights);
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.growth}</span>
          </div>
          <div className="setting__weights-panel">
            <strong>Activity (actividad)</strong>
            <span className="setting__weight-value">{rankingWeights.activity}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.activity}
              onChange={(e) => {
                const activity = parseFloat(e.target.value);
                setRankingWeights({
                  ...rankingWeights,
                  activity,
                });
                updateSetting("ranking.weights", {
                  ...rankingWeights,
                  activity,
                });
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.activity}</span>
          </div>
          <div className="setting__weights-panel">
            <strong>Maintenance (mantenimiento)</strong>
            <span className="setting__weight-value">{rankingWeights.maintenance}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.maintenance}
              onChange={(e) => {
                const maintenance = parseFloat(e.target.value);
                setRankingWeights({
                  ...rankingWeights,
                  maintenance,
                });
                updateSetting("ranking.weights", {
                  ...rankingWeights,
                  maintenance,
                });
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.maintenance}</span>
          </div>
          <div className="setting__weights-panel">
            <strong>Relevance (relevancia)</strong>
            <span className="setting__weight-value">{rankingWeights.relevance}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.relevance}
              onChange={(e) => {
                const relevance = parseFloat(e.target.value);
                setRankingWeights({
                  ...rankingWeights,
                  relevance,
                });
                updateSetting("ranking.weights", {
                  ...rankingWeights,
                  relevance,
                });
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.relevance}</span>
          </div>
          <div className="setting__weights-panel">
            <strong>Popularity (popularidad)</strong>
            <span className="setting__weight-value">{rankingWeights.popularity}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.popularity}
              onChange={(e) => {
                const popularity = parseFloat(e.target.value);
                setRankingWeights({
                  ...rankingWeights,
                  popularity,
                });
                updateSetting("ranking.weights", {
                  ...rankingWeights,
                  popularity,
                });
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.popularity}</span>
          </div>
          <div className="setting__weights-panel">
            <strong>Interest (interés)</strong>
            <span className="setting__weight-value">{rankingWeights.interest}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.interest}
              onChange={(e) => {
                const interest = parseFloat(e.target.value);
                setRankingWeights({
                  ...rankingWeights,
                  interest,
                });
                updateSetting("ranking.weights", {
                  ...rankingWeights,
                  interest,
                });
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.interest}</span>
          </div>
          <div className="setting__weights-panel">
            <strong>Quality (calidad)</strong>
            <span className="setting__weight-value">{rankingWeights.quality}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={rankingWeights.quality}
              onChange={(e) => {
                const quality = parseFloat(e.target.value);
                setRankingWeights({
                  ...rankingWeights,
                  quality,
                });
                updateSetting("ranking.weights", {
                  ...rankingWeights,
                  quality,
                });
              }}
            />
            <span className="setting__weight-value-large">{rankingWeights.quality}</span>
          </div>
        </div>
      },
    ];
  }, [settings, rankingWeights]);

  return (
    <div className="view">
      <PageHeader
        eyebrow={<Settings2 size={13} aria-hidden />}
        title="Settings"
        description="Fuentes, intervalos de actualización, worker y búsqueda semántica local."
      />

      <GlassPanel className="settings-panel">
        <div className="settings-header">
          <div className="settings-system">
            <div className="settings-system__title">Estado del sistema</div>
            <dl className="settings-system__list">
              <div>
                <dt>API local</dt>
                <dd>
                  <StatusDot
                    state={health?.status === "ok" ? ("online" as const) : ("offline" as const)}
                  />
                  {health?.status === "ok" ? "Conectada en 127.0.0.1:8765" : "No responde"}
                </dd>
              </div>
              <div>
                <dt>Worker</dt>
                <dd>
                  <StatusDot state={health?.worker.state ?? "offline"} />
                  {workerStateLabels[health?.worker.state ?? "offline"]}
                </dd>
              </div>
              <div>
                <dt>Embeddings</dt>
                <dd>
                  <StatusDot
                    state={caps?.embeddings?.sidecar_state === "online" ? ("online" as const) : ("offline" as const)}
                  />
                  {caps?.embeddings?.sidecar_state ?? "sin datos"}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="settings-grid">
          {rows.map((row) => (
            <div className="setting" key={row.key}>
              <div className="setting__copy">
                <strong>{row.label}</strong>
                <p>{row.description}</p>
              </div>
              <div className="setting__control">{row.input}</div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {mode === "demo" ? (
        <GlassPanel className="settings-demo-note" role="status">
          <span className="demo-pill" aria-hidden>
            <WifiOff size={13} /> Demo
          </span>
          <div>
            <strong>Vista de diseño · datos de ejemplo</strong>
            <p>
              {demoReason ?? "La API local no está disponible."} Los cambios de configuración no se
              persisten en este modo.
            </p>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<WifiOff size={13} />}
              trailingIcon={<ArrowRight size={13} />}
              onClick={() => setMode("live")}
            >
              Ver solo estados reales
            </Button>
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}