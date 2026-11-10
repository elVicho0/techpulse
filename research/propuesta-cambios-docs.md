# TechPulse — Propuesta de cambios para documentos de coordinador/docs/

- **Estado**: propuesto (entregable de la fase F1 — Research).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Propósito**: Documentar los cambios que el Coordinador debe aplicar en `coordinador/docs/`. El agente Research **no puede modificar** esos archivos directamente (restricción de worktree).
- **Regla**: cada cambio cita el documento F0, la sección, el cambio propuesto y la justificación.

---

## 1. docs/source-policy.md

### 1.1 §3.5 Presupuesto por ejecución — GitHub búsqueda

**Cambio aplicado:**
> Cambiar "Búsqueda trending: 6 requests (3 queries × 2 páginas)" por "Búsqueda trending: máximo 6 queries lógicas por ciclo. Rotar el subconjunto de queries entre ciclos para distribuir cobertura. Respetar rate limits reales de cabeceras `X-RateLimit-*`. El presupuesto de 6 queries se comparte entre búsqueda, detalle y README (fuente: `docs/source-policy.md` §8.2 Límites)."

**Justificación:** La decisión del Coordinador (F2) establece 6 queries lógicas por ciclo, no 6 requests interpretadas como 3 queries × 2 páginas. Cada query puede devolver hasta 2 páginas (máx. 50 items por página). Se rotan las 15 queries investigadas entre ciclos.

### 1.2 §4.1 Feeds — lista inicial y configurabilidad

**Cambio propuesto:**
> Añadir: "La lista inicial de 16 feeds verificados (ver `buscador/research/feeds.md`) se aprueba como fuente `rss`. Cada feed se registra como `sources.kind='rss'` con `config_json.feed_url`. Los feeds deben ser activables, desactivables y editables desde configuración/base de datos sin modificar código. `interval_minutes` por defecto: 60 min (alta prioridad), 120 min (blogs técnicos), 180 min (bajo volumen)."

**Justificación:** Los 16 feeds ya fueron verificados por Research; Backend debe exponer CRUD de `sources` para gestionarlos sin código.

### 1.3 §3.4 Queries de descubrimiento

**Cambio propuesto:**
> Añadir las 15 queries validadas (ver `buscador/research/github-queries.md`) como plantillas iniciales en `sources.config_json` para `github_search_trending`. Máximo 6 queries por ciclo, rotadas. Ventanas temporales calculadas en runtime (7d, 30d, 90d desde fecha actual).

**Justificación:** Research ya investigó y validó las 15 queries; Backend no debe inventar queries nuevas sin aprobación.

### 1.4 §17.6 Pesos híbridos — aclarar "lexical"

**Cambio propuesto:**
> Aclarar que "0.7 semántico / 0.3 lexical" significa `0.7 * similarity + 0.3 * interest_score`, donde `interest_score` es el ranking por metadatos (crecimiento, actividad, mantenimiento, relevancia, popularidad). Si se quiere búsqueda textual pura (`q` sobre `full_name`/`description`), definirla como tercer componente o dejar para F3.

**Justificación:** El término "lexical" no está definido en F0; Backend necesita claridad para implementar `/search` y `/repositories/{id}/similar`.

### 1.5 §5.2 Agent Reach — estado real de canales

**Cambio propuesto:**
> Añadir nota: "En la verificación real (2026-11-09, Agent Reach 1.6.1), solo `github`, `youtube`, `web` están `ready`. `bilibili` y `v2ex` están `unverified` (requieren `agent-reach check` con red, no ejecutado). `reddit`, `linkedin`, etc. están `not_added`. No instalar canales adicionales en v1."

**Justificación:** El diagnóstico real difiere del supuesto de que todos los canales opcionales estén disponibles.

---

## 2. docs/data-model.md

### 2.1 §8.1 Pesos de scoring — hacerlos configurables

**Cambio propuesto:**
> Los pesos de `interest_score` (crecimiento 30 %, actividad 20 %, mantenimiento 20 %, relevancia 15 %, popularidad 15 %) son **provisionales y configurables**. Almacenarse en `settings` (ej. `scoring.weights.growth`, etc.) con los valores actuales como default. Backend debe leerlos de configuración, no hardcodearlos.

**Justificación:** Decisión del Coordinador: pesos configurables, no hardcodeados, pendientes de validación con datos reales.

### 2.2 §5.10 settings — añadir claves de scoring y feeds

**Cambio propuesto:**
> Añadir claves sugeridas:
> - `scoring.weights.growth`: 0.30
> - `scoring.weights.activity`: 0.20
> - `scoring.weights.maintenance`: 0.20
> - `scoring.weights.relevance`: 0.15
> - `scoring.weights.popularity`: 0.15
> - `github.max_queries_per_cycle`: 6
> - `embeddings.hybrid_weight_semantic`: 0.7
> - `embeddings.hybrid_weight_lexical`: 0.3
> - `embeddings.min_similarity`: 0.25

**Justificación:** Centralizar valores configurables para que Backend/Frontend no los hardcodeen.

---

## 3. docs/architecture.md

### 3.1 §1.7 / §9.3 — semántica de `period` para repositorios

**Cambio propuesto:**
> Definir explícitamente si `period` para repositorios filtra por `first_seen_at` (descubierto en la ventana) o por `last_seen_at` / `trending_window` (tendencia activa en la ventana). Para detección de repos nuevos en crecimiento, se recomienda añadir `trending_window` separado de `period`.

**Justificación:** `docs/api-contract.md` §1.7 marca esta decisión como pendiente. F2 necesita claridad para el dashboard de tendencias.

### 3.2 §9.3 Agent Reach — degradación graceful

**Cambio propuesto:**
> Reforzar: "Si un canal de Agent Reach no está disponible (`not_added`, `unverified`, o error de runtime), el worker registra `skipped` y continúa con GitHub API y RSS. No se asume cobertura de Reddit, V2EX u otros canales comunitarios en v1."

**Justificación:** El diagnóstico real confirma que esos canales no están disponibles.

---

## 4. docs/api-contract.md

### 4.1 §7.1 `GET /repositories` — parámetro `trending_window`

**Cambio propuesto:**
> Considerar añadir parámetro opcional `trending_window` (`1d`, `7d`, `30d`) separado de `period`, para filtrar repos por actividad reciente (`last_seen_at` o `pushed_at` reciente) independientemente de cuándo se descubrieron.

**Justificación:** Permite detectar "repos nuevos que crecen rápido" sin depender exclusivamente de `first_seen_at`.

### 4.2 §3.9.1 `EmbeddingStatus` — aclarar modo híbrido

**Cambio propuesto:**
> Documentar que `mode=hybrid` combina `similarity` (0.7) y `interest_score` (0.3), y que si el sidecar no está disponible devuelve `mode_used=metadata` con HTTP 200.

**Justificación:** `docs/api-contract.md` §7.4 ya lo menciona, pero conviene dejarlo explícito en el tipo `EmbeddingStatus` o en la descripción del endpoint `/search`.

---

## 5. docs/plan.md

### 5.1 Checklist de suficiencia — marcar completados

**Cambio propuesto:**
> Marcar como completados los ítems bloqueantes para Backend:
> - [x] Lista inicial de feeds RSS (Research) → 16 feeds verificados en `buscador/research/feeds.md`.
> - [x] Queries GitHub definitivas y mapeo de categorías → 15 queries en `buscador/research/github-queries.md`.
> - [x] Plantillas de ideas y umbrales → en `buscador/research/ideas-rules.md`.
> - [x] Modelo de embeddings, licencia y umbrales → en `buscador/research/embeddings.md` (licencia pendiente de verificación por Coordinador).

**Justificación:** F1 ha entregado todos los bloqueantes listados en `docs/plan.md` §8.

---

## 6. Restricción de aplicabilidad

El agente Research **no modifica** `coordinador/docs/`. Este documento es una propuesta que el Coordinador debe revisar y aplicar directamente en los documentos de su worktree.
