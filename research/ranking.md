# TechPulse — Reglas de ranking y clasificación (research/ranking.md)

- **Estado**: propuesto (entregable de la fase F1 — Research, tareas R1.5).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Contrato de referencia**: `docs/data-model.md` §8 (modelo de scoring), `docs/source-policy.md`, `docs/api-contract.md` §3.1/7.1.
- **Regla**: todos los scores están en rango 0..1; `growth_score` puede ser `NULL`; nunca inventar datos; distinguir `quality_score` de `popularity_score`.

---

## 1. Pesos del ranking principal (`interest_score`)

Los pesos propuestos en `docs/data-model.md` §8.1 se **validan como base de implementación**:

| Componente | Peso | Rango | Puede ser NULL |
|------------|------|-------|----------------|
| Crecimiento (`growth`) | 30 % | 0..1 | **Sí** |
| Actividad (`activity`) | 20 % | 0..1 | No |
| Mantenimiento (`maintenance`) | 20 % | 0..1 | No |
| Relevancia (`relevance`) | 15 % | 0..1 | No |
| Popularidad (`popularity`) | 15 % | 0..1 | No |
| **Suma** | **100 %** | | |

**Regla de renormalización**: si `growth` es `NULL` (no hay suficientes snapshots), se excluye del cálculo y los pesos restantes se renormalizan para sumar 1.

```
interes = Σ(componente_i × peso_efectivo_i)
peso_efectivo_i = peso_i / (1 - peso_growth)   si growth es NULL
peso_efectivo_i = peso_i                       si growth existe
```

El resultado se guarda en `score_explanation_json` con componentes, pesos efectivos, entradas y campos faltantes.

**Decisión pendiente (usuario/Coordinador):** validar formalmente los pesos 30/20/20/15/15 antes de F7 (ver `docs/plan.md` checklist suficiencia).

---

## 2. Fórmulas por componente

Todas las entradas provienen de `repositories` y `repository_snapshots`; nada se inventa.

### 2.1 Popularidad (`popularity_score`)

```text
norm_stars = min(1, log10(1 + stars) / 6)
norm_forks = min(1, log10(1 + forks) / 5)
popularity = 0.7 * norm_stars + 0.3 * norm_forks
```

- `stars`, `forks` de `repositories` (default 0).
- Si `stars`/`forks` faltan (no deberían, tienen default 0), usar 0.
- Resultado 0..1. Una estrella ya da `log10(2)/6 ≈ 0.05`; no es 0 absoluto.

### 2.2 Crecimiento (`growth_score`)

Requiere al menos 2 snapshots dentro de la ventana (`1d`, `7d`, `30d`).

```text
delta      = stars_actual - stars_inicio_ventana
per_day    = delta / días_transcurridos
growth     = clamp(per_day / 100, 0, 1)
```

- `captured_at` se trunca a la hora (`UNIQUE(repository_id, captured_at)`).
- Máximo 1 snapshot por hora por repositorio.
- Ventanas: `1d`, `7d`, `30d` (ver `api-contract.md` `GrowthWindow`).
- Si no hay snapshots suficientes: `growth_score = NULL` y `star_growth.delta = NULL`.
- `delta` y `per_day` pueden ser negativos (pierde estrellas); `clamp(..., 0, 1)` deja `growth = 0` en ese caso, pero `delta`/`per_day` se reportan con su signo real en la API.

### 2.3 Actividad (`activity_score`)

```text
recency = 1.0 si pushed_at <= 7 días
          0.8 si <= 30 días
          0.5 si <= 90 días
          0.2 si <= 365 días
          0.0 en otro caso
commits = min(1, commits_recent / 20)   si el dato existe
activity = 0.7 * recency + 0.3 * commits   (si commits existe)
activity = recency                          (si commits no existe)
```

- `pushed_at` de `repositories` (puede ser NULL → `recency = 0.0`).
- `commits_recent` de `repository_snapshots` (opcional; puede ser NULL).
- `activity` nunca es NULL: si falta `commits`, usa solo `recency`.

### 2.4 Mantenimiento (`maintenance_score`)

```text
base = 1.0
- 0.60 si archived = 1
- 0.60 si disabled = 1
- 0.15 si license_spdx IS NULL
- 0.10 si description IS NULL
- 0.10 si homepage_url IS NULL y docs_url IS NULL
- 0.25 si pushed_at > 365 días o IS NULL
- 0.10 si open_issues / max(1, stars) > 0.5
maintenance = clamp(base, 0, 1)
```

- Todas las penalizaciones son acumulativas y se aplican sobre `base = 1.0`.
- `maintenance` nunca es NULL (default 0, rango 0..1).

### 2.5 Relevancia (`relevance_score`)

```text
Si el usuario no configuró intereses: relevance = 0.5 (neutral)

Si configuró categorías/tags:
  category_match = 1 si category está en intereses, si no 0
  tag_match = |tags ∩ intereses| / max(1, |tags|)
  relevance = 0.6 * category_match + 0.4 * tag_match
```

- `category` de `repositories` (enum: `ai`, `data_engineering`, `machine_learning`, `data_science`, `dev_tools`, `web`, `other`).
- `tags` de `repositories` (array de slugs).
- Resultado 0..1. Nunca es NULL.

### 2.6 Calidad (`quality_score`) — señal independiente de popularidad

```text
license_present = 1 si license_spdx IS NOT NULL, si no 0
quality = 0.45 * maintenance + 0.35 * activity + 0.20 * license_present
```

- Rango 0..1. Nunca es NULL (default 0).
- **Regla de producto**: la UI debe mostrar `quality_score` y `popularity_score` por separado. No se debe presentar un repo popular como "de calidad" solo por sus estrellas.

---

## 3. Popularidad vs calidad (cómo no confundirlas)

| Dimensión | Popularidad (`popularity_score`) | Calidad (`quality_score`) |
|-----------|----------------------------------|---------------------------|
| Qué mide | Atención/tracción (estrellas, forks) | Salud del proyecto (mantenimiento, actividad, licencia) |
| Entradas | `stars`, `forks` | `maintenance`, `activity`, `license_present` |
| Puede ser alta con mala calidad | Sí (repo viral abandonado) | No |
| Puede ser baja con alta calidad | Sí (repo nuevo o de nicho) | Sí |
| Uso en UI | "Más populares", "tendencia" | "Bien mantenido", "con licencia" |

**Regla**: `interest_score` combina ambos pero con pesos distintos (crecimiento 30 % y actividad 20 % capturan dinamismo; mantenimiento 20 % captura salud; popularidad solo 15 %). Esto evita que un repo con muchas estrellas pero abandonado domine el ranking.

---

## 4. Tratamiento de datos faltantes

| Campo | Situación | Tratamiento |
|-------|-----------|-------------|
| `growth_score` | < 2 snapshots en ventana | `NULL`; renormalizar pesos; UI muestra "Sin datos suficientes" (no `0`) |
| `pushed_at` | NULL | `activity.recency = 0.0`; `maintenance` penaliza 0.25 |
| `commits_recent` | No consultado / NULL | `activity = recency` (ignora la parte de commits) |
| `license_spdx` | NULL | `maintenance` penaliza 0.15; `quality` usa `license_present = 0`; UI muestra "Licencia no especificada" |
| `description` | NULL | `maintenance` penaliza 0.10; UI muestra "Descripción no disponible" |
| `homepage_url` / `docs_url` | Ambos NULL | `maintenance` penaliza 0.10; UI muestra "No disponible" |
| `open_issues` / `stars` | `stars` default 0 | `open_issues / max(1, stars)` con `max(1, stars)` evita división por cero |
| `category` | Siempre tiene default `other` | Nunca NULL |
| `tags` | Puede ser `[]` | `tag_match = 0` si no hay intereses o no hay coincidencia |

**Regla general**: si falta un dato, se guarda `NULL` (o el default de la tabla) y se calcula sobre lo disponible; nunca se rellena con invenciones.

---

## 5. Reglas de categoría y subcategoría

Clasificación determinista (ver `docs/source-policy.md` §15.1 y §15.2). Orden de prioridad de categoría: `ai` > `data_engineering` > `machine_learning` > `data_science` > `dev_tools` > `web` > `other`.

Coincidencias por topics (case-insensitive), luego por descripción:

| Categoría | Topics / keywords |
|-----------|-------------------|
| `ai` | `ai`, `artificial-intelligence`, `llm`, `agents`, `agent`, `agentic`, `mcp`, `rag`, `automation`, `inference`, `evaluation` |
| `data_engineering` | `data-engineering`, `etl`, `elt`, `airflow`, `kafka`, `spark`, `dbt`, `warehouse`, `data-lake`, `pipeline`, `postgres`, `postgresql`, `big-data` |
| `machine_learning` | `machine-learning`, `deep-learning`, `pytorch`, `tensorflow`, `scikit-learn`, `mlops` |
| `data_science` | `data-science`, `pandas`, `jupyter`, `analytics`, `visualization` |
| `dev_tools` | `cli`, `sdk`, `developer-tools`, `framework`, `database`, `infrastructure` |
| `web` | `web`, `react`, `vue`, `nextjs`, `frontend`, `backend` |

Subcategoría (primera coincidencia, caso-insensitive; si no hay, `NULL`):

| Subcategoría | Señales |
|--------------|---------|
| `agents` | `agent`, `agents`, `agentic`, `multi-agent` |
| `agent_framework` | `langchain`, `llamaindex`, `crewai`, `autogen`, `semantic-kernel`, `pydantic-ai` |
| `models` | `model`, `llm`, `transformer`, `diffusion` |
| `mcp` | `mcp`, `model-context-protocol` |
| `rag` | `rag`, `retrieval`, `vector` |
| `llm` | `llm`, `gpt`, `llama` |
| `automation` | `automation`, `workflow` |
| `etl` / `elt` | `etl`, `elt` |
| `streaming` | `kafka`, `streaming`, `flink` |
| `warehouse` | `warehouse`, `snowflake`, `bigquery`, `redshift` |
| `lake` | `lake`, `delta-lake`, `iceberg`, `hudi` |
| `orchestration` | `airflow`, `dagster`, `prefect`, `orchestration` |
| `quality` | `quality`, `great-expectations`, `validation` |
| `observability` | `observability`, `monitoring`, `lineage` |

---

## 6. Recalculo y persistencia

- Se recalcula al finalizar cada ingesta que afecte al repositorio.
- Se recalcula también en un job diario (`internal_score_recompute`, 1440 min).
- Los snapshots se capturan antes de recalcular crecimiento.
- `score_explanation_json` guarda: pesos, componentes, entradas y campos faltantes (para trazabilidad y depuración).
- Los scores se almacenan en `repositories`: `popularity_score`, `growth_score`, `activity_score`, `maintenance_score`, `relevance_score`, `interest_score`, `quality_score`.

---

## 7. Casos de prueba conceptuales (sin repositorios reales)

Estos casos ilustran el comportamiento esperado. Los nombres son **conceptuales**, no repos reales.

### Caso A — Repo activo, con crecimiento y licencia (ideal)
- Entradas: `stars=1200`, `forks=80`, `pushed_at` (hace 2 días), snapshots con `delta=+240` en 7d, `license_spdx="MIT"`, `description` presente, `homepage_url` presente, `category="ai"`, tags=["llm","agents"], intereses del usuario: categoría `ai`.
- Popularidad: `norm_stars=min(1,log10(1201)/6)=min(1,0.505)=0.505`; `norm_forks=min(1,log10(81)/5)=min(1,0.362)=0.362`; `popularity=0.7*0.505+0.3*0.362=0.462`.
- Crecimiento: `per_day=240/7=34.3`; `growth=clamp(34.3/100,0,1)=0.343`.
- Actividad: `recency=1.0` (<=7 d); supongo `commits_recent=15` → `commits=min(1,15/20)=0.75`; `activity=0.7*1.0+0.3*0.75=0.925`.
- Mantenimiento: base 1.0; no archived/disabled; licencia presente (-0); descripción presente (-0); homepage presente (-0); pushed<=365 (-0); `open_issues/stars` asumido 0.1 (<=0.5, -0); `maintenance=1.0`.
- Relevancia: `category_match=1`, `tag_match` según intereses; `relevance=0.6*1+0.4*tag_match`.
- Calidad: `0.45*1.0+0.35*0.925+0.20*1=0.45+0.324+0.20=0.974`.
- Interés (con growth): `0.3*0.343+0.2*0.925+0.2*1.0+0.15*relevance+0.15*0.462`.

### Caso B — Repo popular pero abandonado (popularidad alta, calidad baja)
- Entradas: `stars=5000`, `forks=400`, `pushed_at` (hace 400 días), sin snapshots suficientes, `license_spdx=NULL`, `description=NULL`, `category="web"`, intereses del usuario: categoría `ai`.
- Popularidad alta: `norm_stars=min(1,log10(5001)/6)=min(1,0.568)=0.568`.
- Crecimiento: `NULL` (sin snapshots) → renormalizar pesos (excluir 30 % de growth).
- Actividad: `recency=0.0` (>365 d); `activity=0.0`.
- Mantenimiento: archived=no, disabled=no, `license_spdx=NULL` (-0.15), `description=NULL` (-0.10), `homepage_url` NULL y `docs_url` NULL (-0.10), `pushed_at>365` (-0.25), `open_issues/stars` asumido bajo (-0); `maintenance=clamp(1.0-0.15-0.10-0.10-0.25,0,1)=0.40`.
- Relevancia: `category_match=0` (web no está en intereses `ai`); `tag_match=0`; `relevance=0.0`.
- Calidad: `0.45*0.40+0.35*0.0+0.20*0=0.18`.
- Interés (sin growth): pesos renormalizados `activity=0.2/0.7=0.286`, `maintenance=0.2/0.7=0.286`, `relevance=0.15/0.7=0.214`, `popularity=0.15/0.7=0.214`.
- Resultado: popularidad alta pero interés bajo por falta de actividad, mantenimiento y relevancia. **No se presenta como "de calidad".**

### Caso C — Repo nuevo, sin historial (datos faltantes)
- Entradas: `stars=15`, `forks=2`, `pushed_at` (hace 1 día), sin snapshots, `license_spdx="Apache-2.0"`, `description` presente, `category="machine_learning"`, intereses: categoría `machine_learning`.
- Crecimiento: `NULL` (no hay snapshots) → renormalizar; UI muestra "Sin datos suficientes".
- Actividad: `recency=1.0`; `activity=0.7*1.0=0.7` (sin commits_recent).
- Mantenimiento: licencia presente (-0), descripción presente (-0), `homepage_url`/`docs_url` NULL (-0.10), `pushed_at<=365` (-0); `maintenance=clamp(1.0-0.10,0,1)=0.90`.
- Relevancia: `category_match=1`; `relevance=0.6`.
- Calidad: `0.45*0.90+0.35*0.7+0.20*1=0.405+0.245+0.20=0.85`.
- Resultado: crecimiento `NULL` pero calidad alta; el repo puede aparecer bien posicionado por actividad y mantenimiento, no por crecimiento.

### Caso D — Repo archivado (mantenimiento colapsado)
- Entradas: `archived=1`, cualquiera sea el resto.
- Mantenimiento: `base=1.0-0.60=0.40` por `archived=1` (más otras penalizaciones si aplican).
- Resultado: `maintenance` bajo; `quality` bajo; interés bajo aunque tenga muchas estrellas.

---

## 8. Decisiones que necesita el Coordinador / Usuario

1. Validar formalmente los pesos 30/20/20/15/15 antes de F7.
2. Confirmar si `period` para repositorios significa "descubierto en la ventana" (`first_seen_at`) o "tendencia activa" (`last_seen_at`) — afecta qué repos entran en el ranking de tendencias (`docs/api-contract.md` §1.7).
3. Confirmar los pesos del modo híbrido `similarity` + `interest_score` (propuesta inicial 0.7/0.3 en `docs/data-model.md` §8.3 / source-policy §17.6).
4. Confirmar el umbral `embeddings.min_similarity = 0.25` (settings).
