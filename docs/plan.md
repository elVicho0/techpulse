# TechPulse — Plan de desarrollo

- **Estado**: propuesto, pendiente de aprobación.
- **Autor**: Coordinador.
- **Fecha**: 2026-11-09.
- **Objetivo**: construir una v1 local, funcional y extensible de TechPulse, con actualización automática real, persistencia y descubrimiento tecnológico verificable.

## 1. Estado actual

| Elemento | Estado |
|---|---|
| Repositorio | Inicializado, commit `c953953` |
| Worktrees | `coordinador`, `backend`, `buscador` (Research), `frontend` |
| Código de producto | No implementado |
| Documentación | `docs/architecture.md`, `docs/data-model.md`, `docs/api-contract.md`, `docs/source-policy.md`, `docs/plan.md` (este documento) |
| Commits de documentación | **No realizados** (pendiente de revisión) |
| Dependencias instaladas | Ninguna por este plan |
| Push | No realizado |

## 2. Supuestos y restricciones

1. Windows es la plataforma objetivo de la v1.
2. Un solo usuario local; no hay multiusuario ni nube.
3. SQLite es la base de datos de la v1.
4. GitHub API, RSS/Atom y Agent Reach son las fuentes principales/complementarias.
5. No se usan servicios de pago para funciones básicas.
6. No se inventan repositorios, URLs, métricas ni licencias.
7. Cada agente trabaja solo en su worktree y no modifica archivos de otros.
8. No se hacen commits ni push sin autorización.
9. Los contratos de `docs/` son la referencia normativa hasta que se aprueben cambios.

## 3. Fases y dependencias

```text
F0 Documentación/contratos
        │
        ▼
F1 Research (fuentes, queries, feeds, ranking, ideas)
        │
        ├──────────────┐
        ▼              ▼
F2 Backend base     F9 Frontend base (puede empezar con mocks del contrato)
        │              │
        ▼              │
F3 GitHub           │
        │              │
        ▼              │
F4 RSS/noticias     │
        │              │
        ▼              │
F5 Agent Reach      │
        │              │
        ▼              │
F6 Scheduler/worker │
        │              │
        ▼              │
F7 Scoring/ideas/links
        │              │
        ▼              │
F8 API completa ────┘
        │
        ▼
F10 Vistas frontend
        │
        ▼
F11 Integración/QA
        │
        ▼
F12 Release candidate
```

**Camino crítico:** F0 → F1 → F2 → F3 → F6 → F7 → F8 → F10 → F11.

Frontend puede avanzar en paralelo con mocks basados en `docs/api-contract.md`, pero no debe asumir campos no definidos.

## 4. Responsabilidades y límites de archivos

| Agente | Worktree/rama | Puede modificar | No puede modificar |
|---|---|---|---|
| Coordinador | `coordinador` / `elVicho0/coordinador` | `docs/`, `README.md` del coordinador, archivos de coordinación | `backend/`, `frontend/`, `buscador/` |
| Research | `buscador` / `techpulse-research` | `research/`, `docs/research/` dentro de su worktree | `backend/`, `frontend/`, `coordinador/` |
| Backend | `backend` / `techpulse-backend` | `backend/` | `frontend/`, `buscador/`, `coordinador/` |
| Frontend | `frontend` / `techpulse-frontend` | `frontend/` | `backend/`, `buscador/`, `coordinador/` |

**Regla de integración:** los cambios de contrato se proponen al Coordinador; no se implementan silenciosamente.

## 5. Fases detalladas

### F0 — Documentación y contratos (Coordinador)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| C0.1 | Arquitectura general | `docs/architecture.md` | Stack, procesos, comunicación y decisiones documentados |
| C0.2 | Modelo de datos | `docs/data-model.md` | DDL, relaciones, dedup, historial y scoring |
| C0.3 | Contrato de API | `docs/api-contract.md` | Endpoints, tipos, errores, filtros y ejemplos |
| C0.4 | Política de fuentes | `docs/source-policy.md` | Frecuencias, rate limits, caché, reintentos y verificación |
| C0.5 | Plan de desarrollo | `docs/plan.md` | Fases, dependencias, tareas y criterios |
| C0.6 | Revisión de suficiencia | Checklist en este documento | Sin ambigüedades bloqueantes para Backend/Frontend |

**Estado:** C0.1–C0.5 creados; C0.6 pendiente de revisión del usuario. **No hay commit.**

### F1 — Research (Research)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| R1.1 | Inventario de fuentes gratuitas | `research/sources.md` | URLs reales, método, campos, límites y categoría |
| R1.2 | Diagnóstico Agent Reach | `research/agent-reach.md` | Matriz de canales, comandos, limitaciones y fallback |
| R1.3 | Feeds RSS iniciales | `research/feeds.md` | Lista aprobada con URL, categoría y prioridad |
| R1.4 | Queries GitHub | `research/github-queries.md` | Queries con categoría/subcategoría y justificación |
| R1.5 | Reglas de ranking e ideas | `research/ranking.md`, `research/ideas-rules.md` | Fórmulas, umbrales y plantillas trazables |
| R1.6 | Licencias/ToS/riesgos | `research/legal.md` | Riesgos y reglas de uso comercial |
| R1.7 | Validación de canales opcionales | `research/agent-reach.md` | Estado real de `reddit`, `v2ex`, etc.; sin suposiciones |
| R1.8 | Evaluación de modelos de embeddings | `research/embeddings.md` | Modelo, tamaño, licencia, idioma, rendimiento CPU y requisitos |
| R1.9 | Texto canónico y umbrales semánticos | `research/embeddings.md` | Campos a embeber, `content_hash`, umbral y pesos híbridos |

**Dependencia:** F0 aprobada.
**Salida:** Coordinador revisa y actualiza `docs/source-policy.md` si hace falta.

### F2 — Backend base (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B2.1 | Estructura Python/FastAPI | `backend/app/`, `backend/pyproject.toml` | Servidor arranca; `/health` responde |
| B2.2 | SQLite + migraciones | `backend/migrations/`, capa DB | DB se crea; reinicio conserva datos |
| B2.3 | Configuración | settings + `.env.example` | Defaults y validación; sin secretos |
| B2.4 | Modelos Pydantic | `backend/app/models/` | Coinciden con `docs/api-contract.md` |
| B2.5 | API base | routers de health/settings/sources | Respuestas según contrato |
| B2.6 | Tests base | `backend/tests/` | `pytest` pasa en local |

### F3 — Ingesta GitHub (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B3.1 | Conector GitHub API | `backend/app/connectors/github.py` | Inserta repos reales; URL verificable |
| B3.2 | Normalización/dedup | servicio de ingestión | Re-ejecución no duplica; `github_id` único |
| B3.3 | Snapshots | captura horaria | Historial consultable; growth calculable |
| B3.4 | Rate limit/caché/reintentos | HTTP client | Cabeceras respetadas; cache hit/miss registrado |
| B3.5 | Tests con mocks | tests de conector | Sin red en CI/local; casos 200/304/403/429/5xx |

### F4 — RSS y noticias (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B4.1 | Conector RSS/Atom | `backend/app/connectors/rss.py` | Noticias con título, URL, fecha y fuente |
| B4.2 | Canonicalización/dedup | `url_hash` | Misma URL no duplica; multi-fuente registrada |
| B4.3 | Clasificación de importancia | reglas deterministas | Categoría e importancia consistentes |
| B4.4 | Tests con fixtures | tests RSS | Feeds válidos/inválidos/304 |

### F5 — Agent Reach (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B5.1 | Adaptador CLI | `backend/app/connectors/agent_reach.py` | Ejecuta comandos permitidos con timeout |
| B5.2 | Detección de capacidades | `doctor/channels` | Canales reales; no supuestos |
| B5.3 | Fallback | lógica de degradación | Canal ausente no rompe el worker |
| B5.4 | Tests con salida simulada | tests | JSON válido/inválido/timeout |

### F6 — Scheduler y worker (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B6.1 | Modelo de jobs | `sources`, `job_requests` | CRUD y estados consistentes |
| B6.2 | APScheduler | `backend/worker/` | Jobs periódicos con intervalos y jitter |
| B6.3 | Cola manual | poll de `job_requests` | `POST /sources/{id}/run` se ejecuta |
| B6.4 | Lease/heartbeat | `worker_leases` | Un solo worker activo; estado visible |
| B6.5 | Historial | `source_runs` | Runs con estado, contadores y errores |
| B6.6 | Tests | tests de scheduler | Catch-up, backoff, worker offline |

### F7 — Scoring, enlaces e ideas (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B7.1 | Scoring explicable | servicio de scoring | Scores 0..1 y explicación persistida |
| B7.2 | Verificación de enlaces | `link_checks` | Solo 2xx/3xx `ok=1`; sin URLs inventadas |
| B7.3 | Motor de ideas | `backend/app/ideas/` | Ideas con `generation_key` y repos reales |
| B7.4 | Generación automática | trigger tras ingesta | Máx. 1/6 h; umbral configurable |
| B7.5 | Tests | tests de scoring/ideas | Casos con datos faltantes |
| B7.6 | Sidecar de embeddings | `backend/embeddings_service/` | Carga modelo local; `/embed`, `/health`, `/status`; sin APIs |
| B7.7 | Indexación de embeddings | job `internal_embeddings` | Lotes, `content_hash`, reindexación, fallback |

### F8 — API completa (Backend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| B8.1 | Endpoints de repos | list/detail/snapshots/similar/ideas | Contrato cumplido |
| B8.2 | Endpoints de noticias | list/detail/save | Contrato cumplido |
| B8.3 | Endpoints de ideas/saved | CRUD y favoritos | Contrato cumplido |
| B8.4 | Filtros/paginación | query params | Semántica de `period`, `growth_window`, CSV |
| B8.5 | Errores | formato único | Códigos y HTTP correctos |
| B8.6 | OpenAPI | `/openapi.json` | Esquema coincide con el contrato |
| B8.7 | Tests de API | tests de integración | Casos felices y errores |
| B8.8 | Búsqueda semántica e híbrida | endpoints `similar`/`search` | Modos, `match`, fallback y `503` |

### F9 — Frontend base (Frontend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| F9.1 | Scaffold Tauri+React+TS | `frontend/` | App abre en Windows |
| F9.2 | Design system | tokens, dark theme | Consistente con Linear/GitHub/Vercel |
| F9.3 | Cliente API | `frontend/src/api/` | Tipos del contrato; manejo de errores |
| F9.4 | Layout/sidebar/routing | navegación | Secciones del dashboard |
| F9.5 | Estados | loading/empty/error/offline | Sin pantallas en blanco |

### F10 — Vistas (Frontend)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| F10.1 | Overview | tarjetas, resumen, actividad | Consume `/overview` |
| F10.2 | GitHub Trending | lista/filtros | Filtros por periodo, lenguaje, categoría, popularidad, crecimiento |
| F10.3 | AI Radar | subcategorías IA | Agentes, frameworks, modelos, MCP, RAG, LLM |
| F10.4 | Data Engineering | subcategorías datos | ETL, streaming, warehouse, lake, orquestación |
| F10.5 | Tech News | feed | Titular, resumen, fuente, fecha, categoría, importancia |
| F10.6 | Saved | repos/noticias/ideas | Guardar/quitar persistente |
| F10.7 | Project Ideas | lista/detalle/estado | Favoritas, dificultad, categoría, repos inspiradores |
| F10.8 | Repo detail | ficha completa | Enlaces reales, docs/demo, ideas, similares, estado |
| F10.9 | Settings | intervalos/fuentes/worker | Cambios persisten; actualización manual |
| F10.10 | Búsqueda semántica | toggle y resultados | “Similar a este repo”, modos y estado del modelo |

### F11 — Integración y QA (todos, coordinado)

| ID | Tarea | Entregable | Criterio de aceptación |
|---|---|---|---|
| Q11.1 | E2E básico | flujo overview→repo→guardar→idea | Funciona con API real |
| Q11.2 | Persistencia | reinicio | Datos y guardados sobreviven |
| Q11.3 | Worker con ventana cerrada | prueba manual | Sigue actualizando |
| Q11.4 | Anti-invención | auditoría | Sin URLs/métricas/licencias inventadas |
| Q11.5 | Rendimiento | medición local | Vistas < 2 s con datos de prueba |
| Q11.6 | Seguridad | revisión | Sin secretos; loopback; CORS |
| Q11.7 | Empaquetado/runbook | `docs/runbook.md` | Arranque reproducible en Windows |
| Q11.8 | Semántica offline | prueba con red desactivada | Modelo descargado; búsqueda funciona sin APIs |

### F12 — Release candidate

| ID | Tarea | Criterio |
|---|---|---|
| R12.1 | Checklist de aceptación global | Todo cumplido |
| R12.2 | Revisión de docs | Contratos actualizados |
| R12.3 | Tag/commit autorizado | Solo con aprobación explícita |

## 6. Dependencias entre agentes

| Necesita | Proporciona | Artefacto |
|---|---|---|
| Backend | Research | Feeds, queries, categorías, reglas de ranking/ideas |
| Frontend | Backend | OpenAPI + contrato estable |
| Backend | Coordinador | Contratos aprobados |
| Coordinador | Research/Backend/Frontend | Revisiones, decisiones, desbloqueos |
| QA | Backend/Frontend | Builds ejecutables y datos de prueba |

**Regla:** Frontend no empieza una vista si el endpoint no está definido en `docs/api-contract.md`. Puede usar mocks, pero debe migrar al endpoint real antes de cerrar la tarea.

## 7. Criterios de aceptación globales (v1)

1. La app abre en Windows y muestra el dashboard.
2. Los datos persisten tras reiniciar la app y el worker.
3. El worker actualiza información con la ventana cerrada.
4. La actualización manual funciona y queda registrada.
5. Los intervalos se pueden configurar desde Settings.
6. No hay duplicados de repositorios ni noticias.
7. Los enlaces mostrados son reales y verificables; los no verificados se marcan.
8. Cada repo tiene ficha con descripción, utilidad, tecnologías, actividad, calidad, licencia y enlaces.
9. `Project Ideas` muestra ideas trazables a repositorios reales y permite estados/favoritos.
10. Los filtros de GitHub Trending funcionan (periodo, lenguaje, categoría, popularidad, crecimiento).
11. Las fuentes con error no tumban el sistema y se muestran en la UI.
12. No se usan APIs de pago para funciones básicas.
13. No hay secretos en el repositorio.
14. Tests de backend pasan; build de frontend pasa.
15. La documentación de ejecución local está actualizada.
16. La búsqueda semántica funciona sin APIs externas una vez descargado el modelo.
17. Si el sidecar/modelo no está disponible, la búsqueda por metadatos sigue funcionando.
18. “Similar a este repo” y la búsqueda semántica respetan el modo y el fallback definidos.

## 8. Checklist de suficiencia de contratos

Antes de implementar, verificar:

- [x] Stack y procesos definidos.
- [x] Rutas de datos y configuración definidas.
- [x] DDL completo con claves, constraints e índices.
- [x] Reglas de deduplicación e historial.
- [x] Endpoints, métodos, parámetros, respuestas y errores.
- [x] Tipos TypeScript para el consumo desde React.
- [x] Frecuencias, rate limits, caché y reintentos.
- [x] Reglas anti-invención y verificación de enlaces.
- [x] Fases, dependencias y criterios de aceptación.
- [ ] Lista inicial de feeds RSS (Research).
- [ ] Queries GitHub definitivas y mapeo de categorías (Research).
- [ ] Plantillas de ideas y umbrales (Research).
- [ ] Modelo de embeddings, licencia y umbrales (Research R1.8–R1.9).
- [ ] Aprobación de pesos de scoring (usuario).
- [x] Semántica de `period` para repositorios: `period` = `first_seen_at` (descubierto en la ventana); `trending_window` = `last_seen_at` / `pushed_at` (tendencia activa). Afecta qué repos aparecen en ranking de tendencias. Definir antes de implementar filtros de tendencias.
- [ ] Aprobación de la política de autenticación local (usuario).
- [ ] Decisión de empaquetado final (Tauri sidecar vs. scripts).
- [ ] Aprobación de sidecar de embeddings vs. modelo en proceso.

**Bloqueantes para Backend:** R1.3, R1.4, R1.5 y R1.8–R1.9. Backend puede implementar conectores genéricos y dejar la configuración concreta como datos, pero no debe hardcodear feeds/queries/modelos no aprobados.

## 9. Protocolo de handoff

1. **Research** entrega documentos en su worktree.
2. **Coordinador** revisa, valida que no haya invención y actualiza `docs/source-policy.md` si corresponde.
3. **Backend** implementa contra `docs/data-model.md` y `docs/api-contract.md`.
4. **Backend** publica OpenAPI; **Frontend** compara tipos y reporta discrepancias.
5. **Frontend** implementa vistas contra endpoints reales.
6. **QA** ejecuta criterios globales.
7. **Coordinador** autoriza commit/tag/push solo al final.

## 10. Definition of Done por tarea

Una tarea se considera terminada cuando:

- El código está en el worktree correcto.
- Cumple el contrato/documento correspondiente.
- Tiene tests o verificación manual documentada.
- No introduce secretos ni datos inventados.
- No rompe tareas existentes.
- Se actualizó la documentación si cambió un contrato.
- El agente reporta: qué hizo, cómo verificarlo y qué queda pendiente.

## 11. Riesgos del plan

| Riesgo | Mitigación |
|---|---|
| Research tarda en validar fuentes | Backend implementa conectores genéricos; configuración por datos |
| Rate limits de GitHub | Token opcional, caché, presupuesto, intervalos |
| Modelo de embeddings pesado | Sidecar opcional, modelo pequeño, carga bajo demanda |
| Modelo no descargado | Fallback a metadatos, descarga manual desde Settings |
| Indexación costosa | Lotes, máximo por run, job cada 6 h |
| Agent Reach cambia de versión | Adaptador aislado, detección de capacidades, fallback |
| Contrato ambiguo | Checklist de suficiencia y revisión antes de F2 |
| Frontend bloqueado | Mocks basados en contrato; no inventar endpoints |
| Worker no arranca | Runbook, botón de inicio, heartbeat visible |
| Datos incompletos | `NULL` + UI “No disponible”; sin invención |
| Solapamiento de archivos | Límites por worktree y revisión del Coordinador |

## 12. Próximos pasos

1. Revisar y aprobar los cinco documentos.
2. Autorizar el commit de documentación (si se desea).
3. Lanzar F1 (Research) con las tareas R1.1–R1.9.
4. Revisar entregables de Research y actualizar contratos si hace falta.
5. Iniciar F2 (Backend base) y F9 (Frontend base) en paralelo.

**No se ha modificado código de producto, no se instalaron dependencias, no se hizo commit ni push.**
