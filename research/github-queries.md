# TechPulse — Queries de descubrimiento GitHub (research/github-queries.md)

- **Estado**: propuesto (entregable de la fase F1 — Research, tarea R1.4).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09 (fecha base para calcular ventanas `created:` / `pushed:`).
- **Contrato de referencia**: `docs/source-policy.md` §3.4 (plantillas de queries), `docs/api-contract.md` §7.1 (filtros `GET /repositories`), `docs/data-model.md` §2.2 (categorías/subcategorías).
- **Regla**: no ejecutar cientos de búsquedas; respetar rate limits. Cada query usa qualifiers reales de GitHub Search (`topic:`, `language:`, `stars:`, `created:`, `pushed:`). Máximo 2 páginas por query, `per_page` máximo 50 (`docs/source-policy.md` §3.4).

---

## 1. Ventanas temporales calculadas (fecha base 2026-11-09)

| Ventana | Fecha de corte | Uso |
|---------|----------------|-----|
| 7 días | `2026-11-02` | `pushed:>2026-11-02` (actividad muy reciente) |
| 30 días | `2026-10-10` | `pushed:>2026-10-10` (actividad reciente) |
| 90 días | `2026-08-11` | `created:>2026-08-11` (repos recién creados) |

> Estas fechas se recomputan en runtime con la fecha actual y la ventana configurada; no se hardcodean.

---

## 2. Queries de descubrimiento (15)

| # | Query | Categoría | Subcategoría | Ventana | Coste estimado (requests de búsqueda) | Justificación |
|---|-------|-----------|--------------|---------|--------------------------------------|---------------|
| Q1 | `topic:ai stars:>500 pushed:>2026-11-02` | `ai` | `agents` / `llm` | 7 d | 1–2 | Repos de IA muy activos y con tracción; ventana corta captura tendencias actuales. |
| Q2 | `topic:llm-agents stars:>100 pushed:>2026-10-10` | `ai` | `agents` | 30 d | 1–2 | Agentes LLM (tema clave v1); umbral moderado para incluir proyectos emergentes. |
| Q3 | `topic:agent-framework stars:>100 pushed:>2026-10-10` | `ai` | `agent_framework` | 30 d | 1–2 | Frameworks de agentes (LangChain, CrewAI, Autogen, etc.); subcategoria controlada. |
| Q4 | `topic:mcp stars:>50 pushed:>2026-10-10` | `ai` | `mcp` | 30 d | 1–2 | Model Context Protocol (tema emergente); umbral bajo por ser nicho nuevo. |
| Q5 | `topic:rag stars:>100 pushed:>2026-10-10` | `ai` | `rag` | 30 d | 1–2 | Retrieval-Augmented Generation; subcategoria de IA con demanda. |
| Q6 | `topic:evaluation stars:>100 pushed:>2026-10-10` | `ai` | `evaluation` | 30 d | 1–2 | Evaluación de modelos/agentes; subcategoria de IA. |
| Q7 | `topic:machine-learning stars:>500 pushed:>2026-10-10` | `machine_learning` | `models` / `inference` | 30 d | 1–2 | Machine Learning general con tracción; umbral alto para ruido bajo. |
| Q8 | `topic:data-science stars:>300 pushed:>2026-10-10` | `data_science` | — | 30 d | 1–2 | Data Science general; subcategoría NULL si no coincide con topics de datos. |
| Q9 | `topic:data-engineering stars:>300 pushed:>2026-10-10` | `data_engineering` | `etl` / `elt` / `pipeline` | 30 d | 1–2 | Data Engineering principal; tema prioritario del producto. |
| Q10 | `topic:airflow stars:>300 pushed:>2026-10-10` | `data_engineering` | `orchestration` | 30 d | 1–2 | Orquestación (Airflow); subcategoria controlada. |
| Q11 | `topic:kafka stars:>500 pushed:>2026-10-10` | `data_engineering` | `streaming` | 30 d | 1–2 | Streaming (Kafka); tracción alta. |
| Q12 | `topic:dbt stars:>300 pushed:>2026-10-10` | `data_engineering` | `warehouse` | 30 d | 1–2 | Transformación de datos (dbt); subcategoria warehouse. |
| Q13 | `topic:spark stars:>500 pushed:>2026-10-10` | `data_engineering` | `streaming` | 30 d | 1–2 | Spark (streaming/batch); tracción alta. |
| Q14 | `language:Python stars:>1000 created:>2026-08-11` | `dev_tools` / `other` | `sdk` / `framework` / `cli` | 90 d | 1–2 | Repos Python recientes con tracción; detección de herramientas nuevas. |
| Q15 | `language:TypeScript stars:>1000 created:>2026-08-11` | `dev_tools` / `web` | `framework` / `sdk` | 90 d | 1–2 | Repos TypeScript recientes con tracción; cubre web y dev tools. |

**Total estimado por ciclo completo**: ~15–30 requests de búsqueda (1–2 por query). Esto excede el presupuesto por ejecución de "Búsqueda trending: 6 requests" (`docs/source-policy.md` §3.5), por lo que el worker debe rotar/seleccionar un subconjunto por ciclo o respetar el presupuesto y dejar el resto para el próximo ciclo.

---

## 3. Mapeo de resultados a categorías y subcategorías

El mapeo se aplica tras recibir los resultados, usando la clasificación determinista de `docs/source-policy.md` §15.1/§15.2 (topics y luego descripción, case-insensitive):

| Categoría | Subcategorías posibles | Señales (topics / descripción) |
|-----------|------------------------|--------------------------------|
| `ai` | `agents`, `agent_framework`, `models`, `mcp`, `rag`, `llm`, `automation`, `inference`, `evaluation` | `ai`, `llm`, `agents`, `agent`, `agentic`, `mcp`, `rag`, `automation`, `inference`, `evaluation` |
| `machine_learning` | `models`, `inference` | `machine-learning`, `deep-learning`, `pytorch`, `tensorflow`, `scikit-learn`, `mlops` |
| `data_science` | — | `data-science`, `pandas`, `jupyter`, `analytics`, `visualization` |
| `data_engineering` | `etl`, `elt`, `streaming`, `warehouse`, `lake`, `orchestration`, `quality`, `observability` | `data-engineering`, `etl`, `elt`, `airflow`, `kafka`, `spark`, `dbt`, `warehouse`, `data-lake`, `pipeline` |
| `dev_tools` | `cli`, `sdk`, `framework`, `database`, `infrastructure` | `cli`, `sdk`, `developer-tools`, `framework`, `database`, `infrastructure` |
| `web` | — | `web`, `react`, `vue`, `nextjs`, `frontend`, `backend` |
| `other` | NULL | Ninguna coincidencia anterior |

**Orden de prioridad de categoría**: `ai` > `data_engineering` > `machine_learning` > `data_science` > `dev_tools` > `web` > `other`.

**Subcategoría**: primera coincidencia según tabla de `docs/source-policy.md` §15.2; si no hay coincidencia, `NULL`.

---

## 4. Reglas de ejecución y rate limit

- `per_page` máximo 50; máximo 2 páginas por query en una ejecución normal.
- No usar queries que busquen secretos, credenciales o datos personales.
- Cada query debe tener categoría/subcategoría asociada en `sources.config_json` (ver Anexo A de source-policy).
- Rate limit de búsqueda: leer cabeceras `X-RateLimit-*`; sin token ~10 req/min, con token ~30 req/min (típicos, verificar en runtime).
- Si `remaining < 10 %` o `< 10`, cancelar queries no críticas y registrar `skipped`.
- Presupuesto compartido entre búsqueda, detalle y README (`docs/source-policy.md` §3.3).
- Caché de search: TTL 30 min; cache key = query + página + per_page.

---

## 5. Ejemplo de `config_json` para la fuente `github_search_trending`

```json
{
  "queries": [
    { "q": "topic:ai stars:>500 pushed:>2026-11-02", "category": "ai", "subcategory": "agents" },
    { "q": "topic:data-engineering stars:>300 pushed:>2026-10-10", "category": "data_engineering", "subcategory": "etl" },
    { "q": "topic:machine-learning stars:>500 pushed:>2026-10-10", "category": "machine_learning", "subcategory": null }
  ],
  "per_page": 50,
  "max_pages": 2
}
```

> Las fechas `pushed:`/`created:` se recalculan en runtime; este bloque es solo ilustrativo.

---

## 6. Queries NO incluidas (por ser redundantes o demasiado amplias)

- `topic:ai stars:>0` — demasiado amplia, miles de resultados, bajo ratio señal/ruido.
- `language:Python` sin filtro de estrellas — sin acotar por tracción ni actividad.
- Queries duplicadas que difieren solo en `stars:` umbral cercano (p. ej. `stars:>400` y `stars:>500` sobre el mismo topic y ventana).
- Queries sin `pushed:` ni `created:` sobre topics muy grandes (riesgo de paginación infinita y rate limit).

---

## 7. Decisiones que necesita el Coordinador

1. ¿Se aprueban estas 15 queries como plantillas iniciales para `github_search_trending`?
2. ¿Cuál es el presupuesto real de queries por ciclo (dado que 15 exceden las 6 requests de "búsqueda trending")? ¿Se rotan queries entre ciclos?
3. ¿Se priorizan algunas categorías (p. ej. `ai` y `data_engineering`) sobre otras cuando el presupuesto es limitado?
