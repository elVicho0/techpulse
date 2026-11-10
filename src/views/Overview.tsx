import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bookmark,
  BrainCircuit,
  CalendarClock,
  Compass,
  GitBranch,
  Layers,
  Lightbulb,
  Newspaper,
  Radio,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { api } from "@/api/client";
import { demo } from "@/api/demo";
import { usePageTitle, useResource } from "@/api/hooks";
import type { SnapshotSeries } from "@/api/types";
import { useAppState } from "@/state/AppState";
import { useOverview } from "@/state/OverviewState";
import { useSavedActions } from "@/hooks/useSaved";
import {
  cn,
  formatDate,
  formatRelative,
  repoCategoryLabels,
  workerStateLabels,
} from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { Button, IconButton } from "@/components/ui/Button";
import {
  AnimatedNumber,
  EmptyState,
  ErrorState,
  MetricTile,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatusDot,
} from "@/components/ui/DataDisplay";
import { SegmentedControl } from "@/components/ui/Controls";
import { GlassPanel, SpotlightCard } from "@/components/ui/Surface";
import { AuroraBackground } from "@/components/visual/AuroraBackground";
import { TrendChart } from "@/components/visual/TrendChart";
import { RepoCard, RepoRow } from "@/components/repositories/RepoCard";
import { NewsCard } from "@/components/news/NewsCard";
import { RunTimeline } from "@/components/system/RunTimeline";

type DiscoveryTab = "ai" | "tools";

export function OverviewView() {
  usePageTitle("Overview");
  const { data, error, loading, refresh, isDemo } = useOverview();
  const { worker, refreshStatus, lastCheckedAt } = useAppState();
  const savedActions = useSavedActions();
  const toast = useToast();
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [discoveryTab, setDiscoveryTab] = useState<DiscoveryTab>("ai");
  const [updating, setUpdating] = useState(false);

  const featured = data?.featured_repositories ?? [];

  useEffect(() => {
    if (selectedRepoId === null && featured.length > 0) {
      setSelectedRepoId(featured[0].id);
    }
  }, [featured, selectedRepoId]);

  const snapshots = useResource<SnapshotSeries>({
    live: (signal) => api.snapshots(selectedRepoId ?? 0, "30d", signal),
    demo: () => demo.snapshots(selectedRepoId ?? 1, "30d"),
    deps: [selectedRepoId],
    enabled: selectedRepoId !== null,
  });

  const selectedRepo = featured.find((repo) => repo.id === selectedRepoId) ?? featured[0];
  const trendPoints =
    snapshots.data?.points.map((point) => ({ date: point.captured_at, value: point.stars })) ?? [];

  const updateAll = async () => {
    if (isDemo) {
      toast.info("Vista de diseño", "La actualización real necesita la API local y el worker activos.");
      return;
    }
    setUpdating(true);
    try {
      const result = await api.runAll();
      if (result.worker_state === "offline") {
        toast.info("Trabajo encolado", "El worker está desconectado; la actualización quedará pendiente.");
      } else {
        toast.success("Actualización encolada", `Solicitud #${result.request_id} enviada al worker.`);
      }
      refresh();
      void refreshStatus();
    } catch (caught) {
      toast.error("No se pudo encolar la actualización", caught instanceof Error ? caught.message : undefined);
    } finally {
      setUpdating(false);
    }
  };

  if (loading && !data) return <OverviewSkeleton />;

  if (error && !data) {
    return (
      <div className="view">
        <PageHeader title="Overview" description="El pulso general de tu inteligencia tecnológica." />
        <ErrorState error={error} onRetry={refresh} />
      </div>
    );
  }

  const counts = data?.counts;
  const hasData = Boolean(counts && counts.repositories + counts.news + counts.ideas > 0);
  const discoveryItems = discoveryTab === "ai" ? data?.ai_trends ?? [] : data?.new_tools ?? [];

  return (
    <div className="view view--overview">
      <section className="hero">
        <AuroraBackground className="hero__aurora" />
        <div className="hero__content">
          <div className="hero__eyebrow">
            <span className="live-badge">
              <StatusDot state="online" />
              Live intelligence
            </span>
            <span className="hero__date">{formatDate(data?.generated_at ?? new Date().toISOString())}</span>
          </div>
          <h1 className="hero__title">
            El pulso de la tecnología,
            <br />
            <span className="gradient-text">en un solo lugar.</span>
          </h1>
          <p className="hero__summary">
            {data?.summary_text ??
              "Descubre repositorios, noticias e ideas de proyecto con datos locales, procedencia verificable y ranking explicable."}
          </p>
          <div className="hero__actions">
            <Button
              variant="primary"
              size="lg"
              loading={updating}
              leadingIcon={<RefreshCw size={15} />}
              onClick={updateAll}
            >
              Actualizar datos
            </Button>
            <Link to="/repositories" className="btn btn--secondary btn--lg">
              <span className="btn__icon" aria-hidden>
                <Compass size={15} />
              </span>
              <span className="btn__label">Explorar tendencias</span>
              <span className="btn__icon btn__icon--trailing" aria-hidden>
                <ArrowRight size={15} />
              </span>
            </Link>
          </div>
          <div className="hero__chips">
            <span className="hero__chip">
              <Radio size={12} aria-hidden /> Worker {workerStateLabels[worker?.state ?? "offline"].toLowerCase()}
            </span>
            <span className="hero__chip">
              <CalendarClock size={12} aria-hidden /> Última sync{" "}
              {formatRelative(data?.last_success_at ?? null)}
            </span>
            <span className="hero__chip">
              <Layers size={12} aria-hidden /> {counts?.sources ?? 0} fuentes
            </span>
          </div>
        </div>

        <aside className="hero__signal" aria-label="Estado de la inteligencia">
          <div className="hero__signal-head">
            <span>Señal de datos</span>
            <span className={cn("hero__signal-mode", isDemo && "is-demo")}>
              {isDemo ? "demo" : "local"}
            </span>
          </div>
          <div className="hero__signal-chart" aria-hidden>
            <svg viewBox="0 0 280 64" preserveAspectRatio="none">
              <defs>
                <linearGradient id="signal-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="signal-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 48 L24 44 L48 46 L72 32 L96 36 L120 24 L144 28 L168 18 L192 22 L216 12 L240 16 L264 8 L280 10 L280 64 L0 64 Z"
                fill="url(#signal-fill)"
              />
              <path
                d="M0 48 L24 44 L48 46 L72 32 L96 36 L120 24 L144 28 L168 18 L192 22 L216 12 L240 16 L264 8 L280 10"
                fill="none"
                stroke="url(#signal-line)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <dl className="hero__signal-list">
            <div>
              <dt>Repositorios</dt>
              <dd className="tabular">{counts?.repositories ?? 0}</dd>
            </div>
            <div>
              <dt>Noticias</dt>
              <dd className="tabular">{counts?.news ?? 0}</dd>
            </div>
            <div>
              <dt>Ideas</dt>
              <dd className="tabular">{counts?.ideas ?? 0}</dd>
            </div>
          </dl>
          <div className="hero__signal-foot">
            <StatusDot state={worker?.state ?? "offline"} />
            <span>{worker?.current_job ?? "Sin trabajos en curso"}</span>
            <span className="hero__signal-time">
              {lastCheckedAt ? formatRelative(new Date(lastCheckedAt).toISOString()) : ""}
            </span>
          </div>
        </aside>
      </section>

      <div className="stats-grid">
        <MetricTile
          icon={GitBranch}
          label="Repositorios"
          tone="blue"
          value={<AnimatedNumber value={counts?.repositories ?? 0} />}
          hint="descubiertos y normalizados"
        />
        <MetricTile
          icon={Newspaper}
          label="Noticias"
          tone="amber"
          value={<AnimatedNumber value={counts?.news ?? 0} />}
          hint="con fuente y procedencia"
        />
        <MetricTile
          icon={Lightbulb}
          label="Project ideas"
          tone="green"
          value={<AnimatedNumber value={counts?.ideas ?? 0} />}
          hint="trazables a repos reales"
        />
        <MetricTile
          icon={Bookmark}
          label="Guardados"
          tone="violet"
          value={<AnimatedNumber value={counts?.saved ?? 0} />}
          hint="repos, noticias e ideas"
        />
      </div>

      {!hasData ? (
        <GlassPanel className="overview-empty">
          <EmptyState
            icon={Sparkles}
            title="Aún no hay datos en la base local"
            description="La interfaz está lista. Inicia la API y el worker, o ejecuta una actualización manual para empezar a descubrir repositorios y noticias reales."
            action={
              <Button variant="primary" leadingIcon={<RefreshCw size={14} />} onClick={updateAll} loading={updating}>
                Encolar primera actualización
              </Button>
            }
          />
        </GlassPanel>
      ) : null}

      <div className="overview-grid">
        <GlassPanel className="panel panel--trend">
          <SectionHeader
            title="Tendencias de estrellas"
            subtitle={
              selectedRepo
                ? `Snapshots reales · ${selectedRepo.full_name}`
                : "Selecciona un repositorio destacado"
            }
            icon={TrendingUp}
            action={
              <Link to="/repositories?sort=growth" className="link-action">
                Ver ranking <ArrowRight size={13} />
              </Link>
            }
          />
          {featured.length > 1 ? (
            <div className="trend-switcher">
              <SegmentedControl
                size="sm"
                ariaLabel="Repositorio para el gráfico"
                value={String(selectedRepoId ?? featured[0]?.id)}
                onChange={(value) => setSelectedRepoId(Number(value))}
                options={featured.slice(0, 3).map((repo) => ({
                  value: String(repo.id),
                  label: repo.name,
                  title: repo.full_name,
                }))}
              />
              <span className="trend-switcher__window">Ventana 30 d</span>
            </div>
          ) : null}

          {snapshots.loading ? (
            <div className="chart-skeleton">
              <Skeleton width="100%" height={210} rounded={12} />
            </div>
          ) : snapshots.error ? (
            <ErrorState error={snapshots.error} onRetry={snapshots.refresh} compact />
          ) : (
            <TrendChart points={trendPoints} valueLabel="estrellas" height={236} />
          )}

          <div className="trend-footer">
            <span>
              <span className="legend-dot legend-dot--blue" aria-hidden /> Estrellas acumuladas
            </span>
            <span>{snapshots.data?.points.length ?? 0} snapshots en la ventana</span>
            {selectedRepo ? (
              <Link to={`/repo/${selectedRepo.id}`} className="link-action">
                Abrir ficha <ArrowRight size={12} />
              </Link>
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="panel panel--activity">
          <SectionHeader
            title="Actividad del sistema"
            subtitle="Últimas ejecuciones registradas"
            icon={Activity}
            action={
              <Link to="/settings" className="link-action">
                Configurar <ArrowRight size={13} />
              </Link>
            }
          />
          <RunTimeline runs={data?.recent_runs ?? []} compact />
          <div className="activity-worker">
            <div className="activity-worker__head">
              <span className={cn("activity-worker__pulse", `is-${worker?.state ?? "offline"}`)} aria-hidden />
              <strong>Worker {workerStateLabels[worker?.state ?? "offline"].toLowerCase()}</strong>
              <IconButton
                label="Actualizar estado del worker"
                size="sm"
                tone="ghost"
                onClick={() => void refreshStatus()}
              >
                <RefreshCw size={13} />
              </IconButton>
            </div>
            <p>
              {worker?.current_job
                ? `Ejecutando ${worker.current_job}`
                : "Sin trabajos en curso. El polling se detiene cuando la ventana está oculta."}
            </p>
          </div>
        </GlassPanel>
      </div>

      <section className="overview-section">
        <SectionHeader
          title="Descubrimientos destacados"
          subtitle="Seleccionados por interés, actividad y calidad — no por popularidad aislada"
          icon={Sparkles}
          action={
            <Link to="/repositories" className="link-action">
              Ver todos <ArrowRight size={13} />
            </Link>
          }
        />
        {featured.length === 0 ? (
          <EmptyState
            compact
            title="Sin repositorios destacados"
            description="Cuando el worker complete una ingesta aparecerán aquí los repositorios con mejor interés de los últimos 7 días."
          />
        ) : (
          <div className="repo-grid repo-grid--featured">
            {featured.slice(0, 3).map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                featured
                saved={savedActions.isSaved("repository", repo.id, repo.saved)}
                pending={savedActions.isPending("repository", repo.id)}
                onToggleSave={(item, saved) => void savedActions.toggle("repository", item.id, saved, item.full_name)}
              />
            ))}
          </div>
        )}
      </section>

      <div className="overview-split">
        <GlassPanel className="panel">
          <SectionHeader
            title="Tech News"
            subtitle="Importancia calculada por el backend"
            icon={Newspaper}
            action={
              <Link to="/news" className="link-action">
                Ver feed <ArrowRight size={13} />
              </Link>
            }
          />
          <div className="news-stack">
            {(data?.top_news ?? []).slice(0, 4).map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                compact
                saved={savedActions.isSaved("news", item.id, item.saved)}
                pending={savedActions.isPending("news", item.id)}
                onToggleSave={(news, saved) => void savedActions.toggle("news", news.id, saved, news.title)}
              />
            ))}
            {(data?.top_news ?? []).length === 0 ? (
              <EmptyState compact title="Sin noticias en las últimas 48 h" description="El feed se llena cuando las fuentes RSS completan una ejecución." />
            ) : null}
          </div>
        </GlassPanel>

        <GlassPanel className="panel">
          <SectionHeader
            title="Panel de descubrimientos"
            subtitle="Tendencias de IA y herramientas recientes"
            icon={BrainCircuit}
            action={
              <SegmentedControl
                size="sm"
                ariaLabel="Tipo de descubrimiento"
                value={discoveryTab}
                onChange={setDiscoveryTab}
                options={[
                  { value: "ai", label: "AI Radar", icon: BrainCircuit },
                  { value: "tools", label: "Herramientas", icon: Wrench },
                ]}
              />
            }
          />
          <div className="discovery-list">
            {discoveryItems.slice(0, 5).map((repo, index) => (
              <RepoRow
                key={repo.id}
                repo={repo}
                rank={index + 1}
                saved={savedActions.isSaved("repository", repo.id, repo.saved)}
                onToggleSave={(item, saved) => void savedActions.toggle("repository", item.id, saved, item.full_name)}
              />
            ))}
            {discoveryItems.length === 0 ? (
              <EmptyState
                compact
                icon={BrainCircuit}
                title="Sin descubrimientos en esta categoría"
                description="Ajusta las queries de las fuentes o espera a la próxima ingesta."
              />
            ) : null}
          </div>
          <div className="discovery-footer">
            <span>
              Categoría: <strong>{discoveryTab === "ai" ? repoCategoryLabels.ai : "Dev Tools / Web"}</strong>
            </span>
            <Link to={discoveryTab === "ai" ? "/ai-radar" : "/repositories?category=dev_tools,web"} className="link-action">
              Explorar <ArrowRight size={12} />
            </Link>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="view view--overview" aria-busy="true">
      <div className="hero hero--skeleton">
        <div className="hero__content">
          <Skeleton width={160} height={22} rounded={999} />
          <Skeleton width="72%" height={54} rounded={14} />
          <Skeleton width="56%" height={18} />
          <Skeleton width="44%" height={18} />
          <div className="hero__actions">
            <Skeleton width={150} height={42} rounded={12} />
            <Skeleton width={170} height={42} rounded={12} />
          </div>
        </div>
      </div>
      <div className="stats-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="metric-tile" key={index}>
            <Skeleton width={90} height={14} />
            <Skeleton width={110} height={34} />
            <Skeleton width={130} height={12} />
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <div className="glass-panel panel">
          <Skeleton width={220} height={20} />
          <Skeleton width="100%" height={236} rounded={12} />
        </div>
        <div className="glass-panel panel">
          <Skeleton width={190} height={20} />
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} width="100%" height={54} rounded={10} />
          ))}
        </div>
      </div>
    </div>
  );
}
