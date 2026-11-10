# TechPulse — Reglas del generador de ideas (research/ideas-rules.md)

- **Estado**: propuesto (entregable de la fase F1 — Research, tarea R1.5).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Contrato de referencia**: `docs/data-model.md` §2.4/§5.8, `docs/source-policy.md` §16 (Anexo C), `docs/api-contract.md` §9 (ideas), `docs/architecture.md` §7.4.
- **Regla**: una idea nunca existe sin al menos un repositorio real asociado; `generation_key` determinista; nunca inventar URLs ni métricas.

---

## 1. Roles de repositorio asociados (`idea_repositories.role`)

Vocabulario controlado (ver `docs/data-model.md` §2.4):

| Rol | Significado | Qué aporta a la idea |
|-----|-------------|----------------------|
| `data_source` | Fuente de datos | API, conector, scraper, dataset, repositorio que provee datos de entrada |
| `processing` | Procesamiento | ETL, orquestación, transformación, limpieza, agregación de datos |
| `ai` | IA | Modelo, framework de agentes, LLM, RAG, inferencia, inteligencia artificial |
| `visualization` | Visualización | Dashboard, gráficos, UI, reporte, visualización de datos |
| `inspiration` | Inspiración | Repositorio de referencia que motiva la idea (no es componente técnico obligatorio) |
| `tooling` | Herramienta | CLI, SDK, utilidad, herramienta de desarrollador que soporta el proyecto |

Cada idea debe tener **al menos una fila en `idea_repositories`** con un repositorio real de la tabla `repositories`.

---

## 2. Plantillas base de ideas (`template_id`)

Plantillas propuestas (ver `docs/source-policy.md` §16, Anexo C). Research las valida; Backend las implementa como datos versionados.

| `template_id` | Roles requeridos | Ejemplo de combinación | Dificultad base |
|---------------|------------------|------------------------|-----------------|
| `agent_research_assistant` | `data_source` + `ai` + `processing` | Fuente de datos + framework de agentes + procesamiento | Intermedio |
| `data_pipeline_dashboard` | `data_source` + `processing` + `visualization` | Conector + ETL/orquestación + dashboard | Intermedio |
| `repo_trend_monitor` | `data_source` + `processing` + `visualization` | GitHub API + análisis + dashboard | Principiante |
| `rag_knowledge_base` | `data_source` + `ai` + `tooling` | Documentos + RAG/vector DB + UI | Intermedio |
| `automation_agent` | `tooling` + `ai` + `processing` | API/herramienta + agente + scheduler | Intermedio |
| `multiagent_workflow` | `ai` + `tooling` + `visualization` | Framework multiagente + herramientas + observabilidad | Avanzado |

Research puede ampliar/ajustar estas plantillas. Cada idea generada referencia su `template_id` (implícito en la combinación de roles) y conserva `generation_key`.

---

## 3. Selección de repositorios relacionados

Para generar una idea a partir de una plantilla:

1. **Filtrar repositorios elegibles** de `repositories`:
   - No archivados (`archived = 0`), no disabled (`disabled = 0`).
   - `github_id` y `full_name` presentes (obligatorios).
   - `html_url` presente (verificable, desde GitHub API).
2. **Seleccionar por categoría/subcategoría y tags** que coincidan con los roles requeridos de la plantilla:
   - `data_source`: repos con categoría `ai`/`data_engineering`/`machine_learning`/`data_science` o topics de conectores/API/datos.
   - `processing`: repos con topics de ETL/orquestación/streaming o subcategoría `etl`/`orchestration`/`streaming`.
   - `ai`: repos con categoría `ai`/`machine_learning` o topics `llm`/`agents`/`rag`/`mcp`/`inference`.
   - `visualization`: repos con categoría `web`/`dev_tools` o topics `dashboard`/`visualization`/`frontend`.
   - `tooling`: repos con categoría `dev_tools` o topics `cli`/`sdk`/`framework`.
   - `inspiration`: cualquier repo con alto `interest_score` (referencia opcional).
3. **Ordenar por `interest_score` DESC** y elegir los mejores candidatos por rol.
4. **Verificar combinaciones válidas**: la plantilla requiere al menos los roles marcados como obligatorios; si no hay combinación válida (al menos un repo por rol obligatorio), **no se crea la idea**.
5. **Límite**: `max_ideas` respeta la configuración (`ideas.max_per_run`, default 5).

---

## 4. Deduplicación (`generation_key`)

Fórmula determinista (ver `docs/data-model.md` §6.3):

```
generation_key = SHA-256(template_id + "|" + sorted(repository_ids).join(",") + "|" + difficulty + "|" + category)
```

Reglas:

1. Si la `generation_key` ya existe en `project_ideas`, **no se crea una idea nueva**; se actualiza `updated_at` solo si cambió el contenido.
2. Ideas manuales usan `generation_key = "manual:" + UUID`.
3. Una idea debe tener al menos una fila en `idea_repositories`; si no, se rechaza (regla de aplicación).
4. `generation_key` es `UNIQUE` en `project_ideas`.
5. El `template_id` se deriva de la combinación de roles y la categoría; no es un campo separado en la BD, pero se usa para construir la clave.

---

## 5. Trazabilidad a repositorios reales

Cada idea debe cumplir:

- Al menos una fila en `idea_repositories` vinculando a `repositories.id` real.
- Cada fila tiene un `role` válido del vocabulario controlado.
- `repositories.full_name` y `repositories.html_url` provienen de GitHub API (verificables); nunca se construyen URLs por convención (`docs/source-policy.md` §6.1 prohíbe construir `https://github.com/{full_name}` si la API no lo devolvió).
- `idea_repositories` conserva la relación idea → repositorio con rol, para que Frontend pueda mostrar "repositorios inspiradores" o "componentes sugeridos".
- `project_ideas.generated_by` ∈ {`rules`, `llm`, `manual`}; default `rules`.
- Si se usa LLM opcional (`generated_by = "llm"`), el LLM nunca completa URLs, métricas ni licencias; solo enriquece resúmenes/explicaciones (`docs/source-policy.md` §6.6).

---

## 6. Redacción de ideas (sin inventar datos)

Los campos de texto se construyen con metadatos reales de los repositorios asociados:

| Campo | Origen | Regla si falta |
|-------|--------|----------------|
| `title` | Construido desde roles + categorías reales | "Idea de proyecto: <categoría>" |
| `summary` | Descripción real de los repos asociados | "Sin descripción disponible en la fuente" |
| `problem` | Inferencia determinista desde la categoría y roles | Omitir o indicar "no disponible" |
| `how_it_works` | Descripción de cómo se combinarían los roles reales | Omitir partes que no tengan repositorio real |
| `technologies_json` | `language` y `topics` reales de los repos asociados | `[]` si no hay datos |
| `category` | Categoría predominante de los repos asociados | `other` |
| `difficulty` | Desde la plantilla base | `beginner` si no se especifica |
| `portfolio_value` | Configuración o regla | `learning` |
| `expansion` | Texto determinista opcional | `NULL` |

**Prohibido**: inventar URLs, estrellas, forks, fechas, licencias, descripciones o métricas de los repositorios asociados. Si falta un dato, se omite o se indica "no disponible" (`docs/source-policy.md` §11, checklist anti-invención).

---

## 7. Dificultad, categoría, valor de portafolio y estados

### 7.1 Dificultad (`difficulty`)

Vocabulario: `beginner`, `intermediate`, `advanced`.
- Viene de la dificultad base de la plantilla (`docs/source-policy.md` §16).
- Puede ajustarse por la complejidad de la combinación de roles (más roles = mayor dificultad).
- Nunca se inventa; se deriva de la plantilla y los datos reales.

### 7.2 Categoría (`category`)

Categoría de la idea (texto libre, default `other`). Se deriva de la categoría predominante de los repositorios asociados. No es el mismo enum que `repositories.category` (la idea puede tener categoría distinta).

### 7.3 Valor de portafolio (`portfolio_value`)

Vocabulario: `learning`, `portfolio`, `internship`, `commercial`.
- Default: `learning`.
- **Regla legal**: nunca afirmar uso comercial sin verificar la licencia de los repositorios asociados (`docs/legal.md`). Si hay dudas, usar `learning`.

### 7.4 Estado (`status`)

Vocabulario: `pending`, `in_progress`, `completed`.
- Default: `pending`.
- Independiente de si la idea está guardada como favorita (`saved_items`).
- El usuario puede cambiarlo mediante `PATCH /ideas/{id}`.

### 7.5 `generated_by`

Vocabulario: `rules`, `llm`, `manual`.
- Default: `rules` (este motor).
- `manual`: idea creada por el usuario (`generation_key = "manual:" + UUID`).
- `llm`: solo si el LLM opcional está habilitado.

---

## 8. Generación automática tras ingesta

- Trigger: evento del worker después de una ingesta que trae repos nuevos.
- Umbral: `ideas.min_new_repos` (default 10) repos nuevos desde la última generación.
- Frecuencia: máximo 1 cada 6 h (`ideas.auto_generate`, default true).
- Máximo por ejecución: `ideas.max_per_run` (default 5).
- Si no hay repositorios elegibles: `200` con `created: []` y `reason` (no se inventan ideas).

---

## 9. Caso de prueba conceptual (sin repos reales)

Entrada (conceptual): tras ingesta, repos nuevos con alto `interest_score`:
- Repo A: categoría `ai`, subcategoría `agents`, lenguaje Python, topics ["llm","agents"], `interest_score=0.85`.
- Repo B: categoría `data_engineering`, subcategoría `orchestration`, topics ["airflow","etl"], `interest_score=0.70`.
- Repo C: categoría `web`, topics ["dashboard","visualization"], `interest_score=0.60`.

Plantilla `data_pipeline_dashboard` requiere `data_source` + `processing` + `visualization`:
- `data_source` ← Repo A (datos) o Repo B.
- `processing` ← Repo B (ETL/orquestación).
- `visualization` ← Repo C.

`generation_key = SHA-256("data_pipeline_dashboard" + "|" + "A,B,C" + "|" + "intermediate" + "|" + "ai")`.

Si la clave ya existe, no se duplica. Se crea la idea con `difficulty=intermediate`, `category` derivada (p. ej. `ai`), `portfolio_value=learning`, `status=pending`, `generated_by=rules`, y 3 filas en `idea_repositories` con roles `data_source`, `processing`, `visualization`.

---

## 10. Decisiones que necesita el Coordinador

1. ¿Se aprueban las 6 plantillas base y los roles (`data_source`, `processing`, `ai`, `visualization`, `inspiration`, `tooling`)?
2. ¿Se permiten más plantillas definidas por Research sin cambiar el contrato?
3. ¿Se habilita la generación automática de ideas tras ingesta (`ideas.auto_generate = true`) desde v1 o solo generación manual (`POST /ideas/generate`)?
4. Confirmar que `portfolio_value = "commercial"` solo se usa tras verificar licencias (ver `legal.md`).
