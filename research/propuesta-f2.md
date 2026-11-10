# TechPulse — Propuesta de implementación F2 (Backend y Frontend)

- **Estado**: propuesto (entregable de la fase F1 — Research).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Propósito**: Especificar qué debe implementar Backend y Frontend en la fase F2, basándose en los entregables de Research. **No se implementa código en esta fase**; es una propuesta de especificación.
- **Restricciones**: no instalar dependencias, no descargar modelos, no hacer commits/push, no modificar worktrees de otros agentes.

---

## 1. Objetivo de F2

Llevar TechPulse de "documentos y contratos" a "aplicación local funcional" con:
- Ingesta real desde GitHub API y RSS/Atom.
- Normalización, deduplicación y almacenamiento en SQLite.
- Ranking configurable y actualización periódica.
- API que alimente el dashboard.
- Dashboard con descubrimientos, noticias, tendencias y recomendaciones.
- Ejecución local en Windows.

---

## 2. Prioridades de implementación (orden sugerido)

| Prioridad | Tarea | Dependencia de Research |
|-----------|-------|-------------------------|
| P1 | Estructura Python/FastAPI + SQLite + migraciones | `docs/data-model.md` (DDL) |
| P1 | Conector GitHub API (search/repositories, repos/{owner}/{repo}, readme) | `research/github-queries.md`, `research/sources.md` |
| P1 | Conector RSS/Atom (fetch condicional, parsing, dedup por `url_hash`) | `research/feeds.md`, `research/sources.md` |
| P1 | Normalización y deduplicación (repos por `github_id`, noticias por `url_hash`) | `docs/data-model.md` §6, `research/sources.md` |
| P1 | Ranking configurable (pesos desde `settings`, no hardcodeados) | `research/ranking.md` |
| P1 | Scheduler/worker con jobs periódicos y cola manual | `docs/source-policy.md` §7, `docs/data-model.md` |
| P1 | API para alimentar dashboard (`/overview`, `/repositories`, `/news`) | `docs/api-contract.md` |
| P1 | Dashboard (Tauri + React) con descubrimientos, noticias, tendencias | Contrato de API |
| P2 | Verificación de enlaces (`link_checks`) | `docs/source-policy.md` §6 |
| P2 | Generación de ideas basada en reglas | `research/ideas-rules.md` |
| P2 | Sidecar de embeddings (opcional, sin descarga automática) | `research/embeddings.md` (licencia pendiente) |

---

## 3. Arquitectura propuesta para F2 (sin cambiar F0)

Se mantiene la arquitectura F0 sin cambios estructurales:

- **UI**: Tauri 2 + React + TypeScript + Vite (WebView2, loopback).
- **API**: FastAPI + Uvicorn en `127.0.0.1:8765`.
- **Worker**: Python independiente con APScheduler, lease en SQLite.
- **DB**: SQLite en WAL, única fuente de verdad.
- **Sidecar embeddings**: `127.0.0.1:8766`, opcional, sin descarga automática (`auto_download=false`).

**No se cambia:**
- Puertos (8765 API, 8766 embeddings).
- Rutas de datos (`%LOCALAPPDATA%\TechPulse`).
- Sin autenticación en v1, CORS restringido a orígenes Tauri.
- GitHub API como fuente primaria; Agent Reach como complemento (sin instalar canales adicionales).

---

## 4. Detalle de tareas para Backend

### 4.1 Estructura base (F2.1 – F2.3)

- `backend/app/`, `backend/pyproject.toml` (o equivalente).
- Servidor FastAPI arrancando en `127.0.0.1:8765`.
- `GET /health` respondiendo.
- SQLite con WAL, `PRAGMA foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`.
- Capa de migraciones versionadas (`schema_migrations`).
- Configuración por `settings` (clave/valor en `settings` table), sin secretos.
- `TECHPULSE_GITHUB_TOKEN` por variable de entorno, nunca en logs/respuestas.

### 4.2 Ingesta GitHub (F2.4 – F2.6)

- Conector `GET /search/repositories` con las 15 queries de `research/github-queries.md`.
- Máximo **6 queries por ciclo**, rotadas entre ciclos.
- `per_page` máximo 50, máximo 2 páginas por query.
- Leer rate limits de cabeceras `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
- Presupuesto compartido entre búsqueda, detalle y README.
- Caché de search: TTL 30 min, key = query + página + per_page.
- `GET /repos/{owner}/{repo}` para detalle de repos nuevos/actualizados (máx. 50 por ejecución).
- `GET /repos/{owner}/{repo}/readme` para extracto (máx. 20, solo destacados o sin extracto).
- Reintentos: máximo 3 intentos, backoff 2s/8s/30s + jitter.
- Manejo de errores: 403/429 esperar reset; 404 no borrar; 5xx reintentar.

### 4.3 Ingesta RSS/Atom (F2.7 – F2.9)

- Conector RSS/Atom para los 16 feeds de `research/feeds.md`.
- `GET` con `User-Agent: TechPulse/0.1 (+local)`, `If-None-Match`/`If-Modified-Since`.
- Timeout 15 s, tamaño máximo 5 MB, máximo 100 items por feed.
- Parsing: título, resumen, URL, autor, fecha, GUID.
- Canonicalización de URL (minúsculas, sin fragmento, sin puertos por defecto, sin params tracking `utm_*`, etc.).
- `url_hash = SHA-256(canonical_url)`, `UNIQUE(url_hash)`.
- Mismo URL desde distinto feed → `news_item_sources`, no duplicar noticia.
- Frecuencias: 60/120/180 min según tipo de feed.

### 4.4 Normalización y deduplicación (F2.10)

- Repos: clave `github_id`, secundario `full_name` normalizado. Upsert sin duplicar.
- Noticias: `url_hash` canónico. Dedup entre feeds.
- Ideas: `generation_key` determinista (ver `research/ideas-rules.md`).
- Cada entidad conserva `source_key`, `external_id`, `fetched_at`.

### 4.5 Ranking configurable (F2.11)

- Scores: `popularity`, `growth` (NULL si sin snapshots), `activity`, `maintenance`, `relevance`, `interest`, `quality`.
- Fórmulas tal como en `research/ranking.md`.
- Pesos de `interest_score` leídos de `settings` (default 30/20/20/15/15), **no hardcodeados**.
- `score_explanation_json` persistido con componentes, pesos, entradas, campos faltantes.
- Recalculo al finalizar ingesta y job diario.

### 4.6 Scheduler y worker (F2.12 – F2.14)

- APScheduler con intervalos de `docs/source-policy.md` §7.1.
- Jitter 0–30 s para evitar ráfagas.
- Máximo 2 jobs concurrentes (configurable hasta 4).
- Cola manual `job_requests`; worker sondea cada 2 s.
- Lease y heartbeat en `worker_leases` (stale después de 30 s).
- `source_runs` append-only con estado, contadores, duración, error.
- Circuit breaker: 5 fallos consecutivos → cooldown 30 min.

### 4.7 API para el dashboard (F2.15 – F2.17)

Endpoints mínimos para F2:
- `GET /health`, `GET /overview`, `GET /worker/status`, `GET /capabilities`.
- `GET /repositories` (filtros: `q`, `period`, `language`, `category`, `tag`, `sort`, `order`, `page`, `page_size`).
- `GET /repositories/{id}` (detalle completo).
- `GET /news` (filtros: `q`, `period`, `category`, `importance`, `source_id`, `sort`).
- `GET /news/{id}`.
- `GET /sources`, `PATCH /sources/{id}`, `POST /sources/{id}/run`.
- `GET /jobs`, `GET /runs`, `GET /runs/{id}`.
- `GET /settings`, `PUT /settings`.
- `GET /embeddings/status` (degradado si no hay sidecar).

Errores según `docs/api-contract.md` §1.7 (400, 404, 409, 422, 429, 503, 504).

### 4.8 Pruebas (F2.18)

- Tests de conectores con mocks (sin red): casos 200, 304, 403, 429, 5xx, timeout.
- Tests de deduplicación: re-ejecución no duplica repos.
- Tests de ranking: scores en rango 0..1, `growth=NULL` renormaliza pesos.
- Tests de API: contratos de respuesta y errores.

---

## 5. Detalle de tareas para Frontend

### 5.1 Scaffold base (F2.19 – F2.21)

- Tauri 2 + React + TypeScript + Vite.
- App abre en Windows (WebView2).
- Layout: sidebar, tarjetas, dark mode, filtros.
- Cliente API con tipos de `docs/api-contract.md`, base URL `http://127.0.0.1:8765/api/v1`.

### 5.2 Vistas principales (F2.22 – F2.26)

- **Overview**: tarjetas de conteos, resumen, actividad reciente (consume `/overview`).
- **GitHub Trending / Descubrimientos**: lista de repos con filtros por periodo, lenguaje, categoría, popularidad, crecimiento.
- **Tech News**: feed de noticias con titular, resumen, fuente, fecha, categoría, importancia.
- **Saved**: repositorios/noticias guardadas (persistente).
- **Settings**: intervalos de fuentes, activar/desactivar fuentes, configurar ranking.

### 5.3 Estados y UX (F2.27 – F2.30)

- Estados: loading, empty, error, offline (sin pantallas en blanco).
- Distinguir "sin datos" de "worker offline" y de "fuente con error".
- Crecimiento: si `star_growth.delta` es `null`, mostrar "Sin datos suficientes" (no `0`).
- Licencia: si `license_spdx` es `null`, mostrar "Licencia no especificada"; no afirmar uso comercial.
- Enlaces: solo `http/https`, abrir con Tauri `opener`, validar antes de abrir.
- Paginar con `has_next`; no asumir `items.length === page_size`.

### 5.4 Pruebas (F2.31)

- Build de frontend pasa.
- Vistas responden < 2 s con datos de prueba.
- Manejo de errores de API con reintento.

---

## 6. Qué NO implementar en F2

- Sidecar de embeddings con descarga automática (`auto_download=false`; solo `GET /embeddings/status` reportando `not_downloaded`).
- LLM opcional (deshabilitado por defecto).
- Canales Agent Reach adicionales (no instalar `reddit`, `linkedin`, etc.).
- Scraping agresivo o elusión de paywalls/ToS.
- Multiusuario, autenticación remota, sincronización en la nube.
- PostgreSQL local.
- Edición colaborativa en tiempo real.

---

## 7. Criterios de aceptación para F2

1. La app abre en Windows y muestra el dashboard.
2. Los datos persisten tras reiniciar app y worker.
3. El worker actualiza información con la ventana cerrada.
4. La actualización manual funciona y queda registrada.
5. Los intervalos se pueden configurar desde Settings.
6. No hay duplicados de repositorios ni noticias.
7. Los enlaces mostrados son reales y verificables; los no verificados se marcan.
8. Cada repo tiene ficha con descripción, tecnologías, actividad, calidad, licencia y enlaces.
9. Las fuentes con error no tumban el sistema y se muestran en la UI.
10. No se usan APIs de pago para funciones básicas.
11. No hay secretos en el repositorio.
12. Tests de backend pasan; build de frontend pasa.
13. Búsqueda por metadatos funciona sin sidecar de embeddings.

---

## 8. Bloqueos y riesgos para F2

| Bloqueo / Riesgo | Origen | Mitigación |
|------------------|--------|------------|
| Pesos de scoring no validados con datos reales | Decisión Coordinador | Implementar como configurables en `settings` con defaults actuales |
| Licencia de modelos de embeddings pendiente | `research/embeddings.md`, `research/legal.md` | Sidecar opcional; `auto_download=false`; no descargar en F2 |
| Semántica de `period` (`first_seen_at` vs `trending_window`) | `docs/api-contract.md` §1.7 | Definir antes de implementar filtros de tendencias |
| Agent Reach canales opcionales no disponibles | `research/agent-reach.md` | Degradar a GitHub API + RSS; no bloquear el worker |
| 6 queries GitHub por ciclo vs. cobertura de 15 queries | `research/github-queries.md` | Rotar subconjunto entre ciclos |
| Backend no puede modificar `coordinador/docs/` | Restricción de worktree | Coordinador aplica cambios de `research/propuesta-cambios-docs.md` |

---

## 9. Confirmación de enfoque original

Esta propuesta mantiene el enfoque original de TechPulse:
- No es un simple lector RSS ni listado de repos populares.
- Es un sistema inteligente de descubrimiento: encuentra repos nuevos en crecimiento, detecta tendencias emergentes, recopila noticias, analiza, clasifica, puntúa y prioriza.
- Genera ideas de proyecto basadas en repositorios y noticias reales.
- Evita duplicados y rastrea la evolución de cada descubrimiento.
- Se actualiza automáticamente mediante ciclos programados.
- Diferencia popularidad, crecimiento, calidad y relevancia.
- Todo se presenta en un dashboard local de escritorio para Windows.
