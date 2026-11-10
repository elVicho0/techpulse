# TechPulse — Informe final de la fase F1 (Research)

- **Estado**: final (entregable de la fase F1 — Research).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Versión de Agent Reach verificada**: 1.6.1.
- **Entorno verificado**: Python 3.13.15, Node v24.19.0, Git 2.56.0, GitHub CLI 2.103.3.
- **Worktree autorizado**: `C:\Users\Diego\orca\workspaces\techpulse\buscador` (rama `techpulse-research`).
- **Restricción respetada**: ningún archivo fuera de `buscador/` fue modificado; no se hicieron commits ni push; no se instalaron dependencias ni canales; no se descargaron modelos.

---

## 1. Archivos creados (dentro de `buscador/research/`)

| Archivo | Contenido |
|---------|-----------|
| `sources.md` | Inventario de fuentes gratuitas: GitHub API (endpoints, límites, auth, campos), RSS/Atom, Agent Reach, matriz URL/método/datos/límites/frecuencia/riesgos. |
| `agent-reach.md` | Diagnóstico real de Agent Reach 1.6.1 (`doctor --text` y `channels`), matriz de canales, comandos/acciones, fallbacks, riesgos. |
| `feeds.md` | 16 feeds RSS/Atom verificados (URL responde y parseable), con categoría, idioma, frecuencia, prioridad y estado. |
| `github-queries.md` | 15 queries con qualifiers reales (`topic:`, `language:`, `stars:`, `created:`, `pushed:`), categoría/subcategoría, ventana, coste, justificación y mapeo a categorías. |
| `ranking.md` | Pesos 30/20/20/15/15 validados, fórmulas de los 6 scores, popularidad vs calidad, datos faltantes, reglas de categoría, 4 casos de prueba conceptuales. |
| `ideas-rules.md` | 6 plantillas base, 6 roles, selección de repos, `generation_key` para dedup, trazabilidad a repos reales, redacción sin inventar datos, dificultad/categoría/portfolio/estados. |
| `legal.md` | ToS de GitHub API, licencias (permisivas vs copyleft, "no especificada"), RSS/copyright, Agent Reach ToS, licencias de embeddings, recomendaciones de uso comercial. |
| `embeddings.md` | Comparativa de 3 modelos locales, texto canónico, `content_hash`, reindexación, umbral 0.25, pesos híbridos 0.7/0.3, funcionamiento offline tras descarga inicial. |
| `discrepancias.md` | Contraste de conclusiones de investigación con `coordinador/docs/` (F0). |
| `propuesta-cambios-docs.md` | Cambios propuestos para `coordinador/docs/` (que el Coordinador aplica; el agente Research no puede modificar esos archivos). |
| `propuesta-f2.md` | Propuesta de implementación F2 para Backend y Frontend (especificación, no código). |
| `informe-final.md` | Este documento. |

---

## 2. Qué se verificó realmente

### 2.1 Comandos ejecutados (solo lectura)

| Comando | Resultado |
|---------|-----------|
| `agent-reach doctor --text` | Versión 1.6.1; canales `ready`: `github`, `youtube`, `web`; `unverified`: `bilibili`, `v2ex`; `not_added`: `reddit`, `xiaohongshu`, `linkedin`, `boss`, `xueqiu`, `xiaoyuzhou`; `experimental`: `twitter`, `facebook`, `instagram`. Herramientas: `bili-cli 0.6.2`, `cloakbrowser 0.6.3`. |
| `agent-reach channels` | JSON completo con acciones, parámetros y backends de cada canal. |

### 2.2 Feeds RSS/Atom verificados (2026-11-09)

Todos responden y devuelven XML RSS/Atom parseable:

1. Hacker News — https://news.ycombinator.com/rss
2. The GitHub Blog — https://github.blog/feed/
3. Hugging Face Blog — https://huggingface.co/blog/feed.xml
4. TechCrunch — https://techcrunch.com/feed/
5. The Verge — https://www.theverge.com/rss/index.xml
6. Ars Technica — https://arstechnica.com/feed/
7. TensorFlow Blog — https://blog.tensorflow.org/feeds/posts/default
8. MIT Technology Review — https://www.technologyreview.com/feed/
9. WIRED — https://www.wired.com/feed/rss
10. arXiv cs.AI — https://export.arxiv.org/rss/cs.AI
11. Towards Data Science — https://towardsdatascience.com/feed
12. HackerNoon — https://hackernoon.com/feed
13. Microsoft for Developers — https://devblogs.microsoft.com/feed/
14. AWS Machine Learning Blog — https://aws.amazon.com/blogs/machine-learning/feed/
15. Kubernetes Blog — https://kubernetes.io/feed.xml
16. Anaconda Blog — https://www.anaconda.com/blog/feed

### 2.3 Feeds descartados (no se incluyen)

- OpenAI blog (404), PyTorch blog (404), InfoQ (404), DZone (403), Apache Airflow (404), dbt (404).

### 2.4 Documentos F0 leídos (solo lectura, en `coordinador/`)

- `docs/architecture.md`, `docs/data-model.md`, `docs/api-contract.md`, `docs/source-policy.md`, `docs/plan.md`.

---

## 3. Qué quedó "no verificado" y por qué

| Ítem | Motivo |
|------|--------|
| Límites exactos de rate limit de GitHub | Son "típicos" (60 req/h sin token, 5000 con token, etc.); `docs/source-policy.md` exige leerlos de cabeceras en runtime. |
| Canales Agent Reach `unverified` (`bilibili`, `v2ex`) | Requieren `agent-reach check <canal>` con red (máx. 1 cada 6 h); no se ejecutó por falta de autorización de red. |
| Canales `not_added` (`reddit`, `linkedin`, etc.) | No instalados; no se asume que funcionen. Requerirían `agent-reach add` + autorización previa. |
| Licencias de modelos de embeddings | Deben verificarse en los model cards de Hugging Face antes de distribuir; no se instala ni descarga el modelo en esta fase. |
| Feeds en español | No se incluyeron por no tener URLs candidatas verificables; los 16 verificados están en inglés. |

---

## 4. Decisiones adoptadas (del Coordinador, recogidas en los entregables)

1. **Scoring de repositorios**: Crecimiento 30 %, Actividad 20 %, Mantenimiento 20 %, Relevancia 15 %, Popularidad 15 %. Pesos **configurables** (en `settings`), no hardcodeados; provisionales hasta validar con datos reales.
2. **GitHub API**: Usar las 15 queries investigadas. Máximo 6 queries por ciclo, rotadas entre ciclos. Respetar rate limits reales de cabeceras de respuesta. Priorizar descubrimiento y calidad frente a volumen.
3. **RSS**: Aprobar los 16 feeds verificados como lista inicial. Mantenerlos configurables desde BD/configuración. Permitir activar, desactivar y agregar fuentes sin modificar código.
4. **Embeddings**: Modelo default `paraphrase-multilingual-MiniLM-L12-v2`; alternativa ligera `all-MiniLM-L6-v2`; `auto_download = false`; pesos híbridos 0.7 semántico / 0.3 lexical (interpretado como `interest_score`); umbral inicial 0.25 configurable y pendiente de calibración. Verificar licencias de modelos antes de distribuirlos.
5. **Licencias de repositorios**: Considerar comercialmente compatibles únicamente MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause e ISC (con advertencia de atribución). Repositorios sin licencia identificada: marcar como "unknown"/"no especificada". Nunca afirmar uso comercial sin evidencia suficiente.
6. **Agent Reach**: No instalar canales adicionales todavía. No instalar dependencias ni descargar modelos en esta fase. Mantener GitHub y RSS como fuentes principales iniciales. Evaluar posteriormente otras fuentes.

---

## 5. Discrepancias encontradas entre la investigación y los documentos F0

| # | Área | Documento F0 | Decisión del Coordinador | Discrepancia |
|---|------|--------------|--------------------------|--------------|
| 1 | Pesos de scoring | `data-model.md` §8.1 (pesos fijos) | Configurables, no hardcodeados | Backend debe leer pesos de `settings`, no hardcodear `0.30`/`0.20`, etc. |
| 2 | Presupuesto GitHub | `source-policy.md` §3.5 (6 requests = 3 queries × 2 páginas) | Máximo 6 queries por ciclo, rotadas | El Coordinador aclara 6 queries, no 6 requests; duplica el volumen de búsqueda permitido. |
| 3 | Feeds RSS | `source-policy.md` §4 (lista inicial por Research) | Configurables desde BD/UI, activar/desactivar/agregar sin código | Backend debe exponer CRUD de `sources`; Frontend debe permitir gestionar fuentes desde Settings. |
| 4 | Pesos híbridos | `source-policy.md` §17.6 (0.7 similarity + 0.3 interest_score) | 0.7 semántico / 0.3 lexical | "Lexical" no definido en F0; asumido = `interest_score`; requiere aclaración para `/search`. |
| 5 | Agent Reach canales | `source-policy.md` §5 (opcionales disponibles) | No instalar canales adicionales | `bilibili`/`v2ex` están `unverified`; `reddit`/`linkedin` etc. `not_added`. No se asume cobertura en v1. |
| 6 | Licencia embeddings | `architecture.md` §4.6 (verificar en model card) | Verificar antes de distribuir | Pendiente de verificación en model cards; no se descarga el modelo en F1. |
| 7 | `growth_score` NULL | `data-model.md` §8.1 (`NULL` si sin snapshots) | Detectar repos nuevos en crecimiento | Repos nuevos no tienen snapshots suficientes → `growth=NULL`; Frontend debe mostrar "Sin datos suficientes", no `0`. |
| 8 | `period` repositorios | `api-contract.md` §1.7 (`first_seen_at`, decisión pendiente) | Detectar tendencia activa | Repos antiguos pero en crecimiento no aparecen si solo se filtra por `first_seen_at`; considerar `trending_window`. |
| 9 | URLs por convención | `source-policy.md` §6.1 (prohibido construir URLs) | Ninguna (se cumple) | Sin discrepancia; se respeta estrictamente. |

---

## 6. Arquitectura y prioridades propuestas para F2

Se mantiene la arquitectura F0 sin cambios estructurales (Tauri 2 + React, FastAPI 127.0.0.1:8765, worker Python independiente, SQLite WAL, sidecar embeddings 127.0.0.1:8766 opcional, sin autenticación en v1).

**Prioridades F2 (orden):**
1. Estructura base FastAPI + SQLite + migraciones.
2. Conector GitHub API (15 queries, máximo 6 por ciclo, rate limits de cabeceras).
3. Conector RSS/Atom (16 feeds, fetch condicional, dedup por `url_hash`).
4. Normalización y deduplicación.
5. Ranking configurable (pesos desde `settings`).
6. Scheduler/worker con jobs periódicos y cola manual.
7. API para dashboard (`/overview`, `/repositories`, `/news`, `/sources`, `/settings`, `/embeddings/status`).
8. Dashboard (descubrimientos, noticias, tendencias, guardados, settings).
9. (P2) Verificación de enlaces, generación de ideas, sidecar de embeddings opcional.

**Qué NO se implementa en F2:** descarga automática de modelos, LLM opcional, canales Agent Reach adicionales, scraping agresivo, multiusuario, PostgreSQL.

---

## 7. Tareas concretas para Backend

1. Estructura Python/FastAPI, `GET /health`, SQLite WAL, migraciones versionadas.
2. Conector GitHub: `search/repositories`, `repos/{owner}/{repo}`, `readme`; máximo 6 queries/ciclo, rotadas; leer `X-RateLimit-*`; caché 30 min; reintentos 3 con backoff.
3. Conector RSS/Atom: 16 feeds, `User-Agent`, `If-None-Match`, canonicalización de URL, `url_hash`, dedup entre feeds.
4. Normalización/deduplicación: repos por `github_id`, noticias por `url_hash`, ideas por `generation_key`.
5. Ranking: 6 scores en rango 0..1; pesos de `interest_score` desde `settings` (no hardcodeados); `score_explanation_json`.
6. Scheduler/worker: APScheduler, jitter 0–30 s, máximo 2 jobs concurrentes, cola `job_requests`, lease/heartbeat, `source_runs`, circuit breaker 5 fallos/30 min.
7. API: `/health`, `/overview`, `/worker/status`, `/capabilities`, `/repositories`, `/repositories/{id}`, `/news`, `/news/{id}`, `/sources`, `PATCH /sources/{id}`, `POST /sources/{id}/run`, `/jobs`, `/runs`, `/settings`, `PUT /settings`, `/embeddings/status`.
8. Tests con mocks (sin red): 200/304/403/429/5xx/timeout, deduplicación, ranking con `growth=NULL`.

---

## 8. Tareas concretas para Frontend

1. Scaffold Tauri 2 + React + TypeScript + Vite; app abre en Windows.
2. Cliente API con tipos de `docs/api-contract.md`; base URL `http://127.0.0.1:8765/api/v1`.
3. Vistas: Overview (conteos, resumen, actividad), GitHub Trending/Descubrimientos (filtros por periodo/lenguaje/categoría/popularidad/crecimiento), Tech News (titular, resumen, fuente, fecha, categoría, importancia), Saved (persistente), Settings (intervalos, activar/desactivar fuentes, ranking).
4. Estados: loading, empty, error, offline; distinguir "sin datos" de "worker offline" y "fuente con error".
5. Crecimiento: si `star_growth.delta` es `null`, mostrar "Sin datos suficientes" (no `0`).
6. Licencia: si `license_spdx` es `null`, mostrar "Licencia no especificada"; no afirmar uso comercial.
7. Enlaces: solo `http/https`, abrir con Tauri `opener`, validar antes de abrir; no construir `https://github.com/{full_name}` por convención.
8. Paginación: usar `has_next`; no asumir `items.length === page_size`.
9. Build de frontend pasa; vistas < 2 s con datos de prueba.

---

## 9. Bloqueos y riesgos pendientes

| Bloqueo / Riesgo | Origen | Mitigación |
|------------------|--------|------------|
| Pesos de scoring sin validar con datos reales | Decisión Coordinador | Implementar como configurables en `settings` con defaults actuales |
| Licencia de modelos de embeddings pendiente | `embeddings.md`, `legal.md` | Sidecar opcional; `auto_download=false`; no descargar en F2 |
| Semántica de `period` (`first_seen_at` vs `trending_window`) | `api-contract.md` §1.7 | Coordinador debe definir antes de implementar filtros de tendencias |
| Agent Reach canales opcionales no disponibles | `agent-reach.md` | Degradar a GitHub API + RSS; no bloquear el worker |
| 6 queries GitHub/ciclo vs. 15 queries investigadas | `github-queries.md` | Rotar subconjunto entre ciclos para distribuir cobertura |
| Coordinador debe aplicar cambios en `coordinador/docs/` | Restricción de worktree del agente Research | Los cambios están propuestos en `research/propuesta-cambios-docs.md` |

---

## 10. Confirmación del enfoque original de TechPulse (PRIORIDAD MÁXIMA)

**Se confirma que se ha mantenido el enfoque original de TechPulse:**

- ✅ **No es un simple lector RSS ni listado de repos populares.** Los entregables contemplan descubrimiento automático de repos, detección de crecimiento, tendencias emergentes, noticias, análisis, clasificación, puntuación y generación de ideas.
- ✅ **Descubre automáticamente repositorios interesantes de GitHub.** Las 15 queries están diseñadas para encontrar repos por topic, lenguaje, estrellas y actividad reciente.
- ✅ **Detecta repositorios nuevos creciendo rápidamente, incluso con pocas estrellas.** El scoring da 30 % a crecimiento y 20 % a actividad; `growth_score=NULL` para repos nuevos se maneja renormalizando pesos (no excluyéndolos).
- ✅ **Identifica tendencias emergentes en IA, agentes autónomos, programación, Data Engineering, Cloud, herramientas y tecnologías.** Las queries cubren `topic:ai`, `topic:llm-agents`, `topic:mcp`, `topic:rag`, `topic:data-engineering`, `topic:airflow`, `topic:kafka`, etc.
- ✅ **Recopila noticias tecnológicas relevantes de diferentes fuentes.** Los 16 feeds verificados cubren IA, desarrollo, ML, Data Science, noticias tech y blogs técnicos.
- ✅ **Analiza, clasifica, puntúa y prioriza los descubrimientos.** Ranking con 6 componentes diferenciados (popularidad ≠ calidad).
- ✅ **Detecta proyectos, herramientas y tecnologías que merezcan ser investigados.** A través de scores y feeds.
- ✅ **Genera ideas de proyectos construibles a partir de descubrimientos.** Plantillas base con roles (`data_source`, `processing`, `ai`, `visualization`, `inspiration`, `tooling`), trazabilidad a repos reales y `generation_key` para dedup.
- ✅ **Evita duplicados y permite rastrear la evolución de cada descubrimiento.** Dedup por `github_id`, `url_hash`, `generation_key`; snapshots para historial.
- ✅ **Mantiene historial de tendencias y permite identificar qué tecnologías crecen o pierden interés.** `repository_snapshots` y `growth_score`.
- ✅ **Dashboard moderno, visual, rápido y fácil de explorar.** Propuesto en F2 con Tauri + React.
- ✅ **Actualización automática mediante ciclos programados.** Scheduler/worker con intervalos de `source-policy.md`.
- ✅ **Diferencia popularidad, crecimiento, calidad y relevancia.** `quality_score` separado de `popularity_score`; regla de producto explícita.
- ✅ **Generación de ideas fundamentada en repositorios y noticias reales.** No se inventan tendencias, métricas ni características.

---

## 11. Confirmación de restricciones respetadas

- ✅ Solo se modificaron archivos dentro de `buscador/research/`.
- ✅ No se modificó `backend/`, `frontend/` ni `coordinador/` (ni sus archivos).
- ✅ No se hicieron commits ni push.
- ✅ No se instalaron dependencias ni canales de Agent Reach.
- ✅ No se descargaron modelos de embeddings.
- ✅ No se implementó código de producto (solo investigación, documentación y propuestas de especificación).
- ✅ No se eliminaron decisiones ni funcionalidades existentes sin justificación.

---

**Siguiente paso:** El Coordinador debe revisar los entregables, aplicar los cambios propuestos en `coordinador/docs/` (vía `research/propuesta-cambios-docs.md`) y autorizar el inicio de F2 para Backend y Frontend basándose en `research/propuesta-f2.md`.
