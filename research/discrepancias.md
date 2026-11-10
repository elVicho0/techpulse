# TechPulse — Discrepancias entre la investigación (F1) y los documentos de arquitectura (F0)

- **Estado**: propuesto (entregable de la fase F1 — Research).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Propósito**: Contrastar las conclusiones de la investigación con los documentos aprobados en `coordinador/docs/` y destacar discrepancias que el Coordinador debe resolver antes de F2.
- **Regla**: este documento solo describe diferencias; no modifica ningún archivo de `coordinador/docs/`.

---

## 1. Resumen de coincidencias

Los documentos F0 ya cubren la mayoría de los entregables de F1. La investigación valida lo siguiente como **coincidente**:

| Área | Documento F0 | Estado en investigación |
|------|--------------|-------------------------|
| Pesos de scoring | `docs/data-model.md` §8.1 (crecimiento 30 %, actividad 20 %, mantenimiento 20 %, relevancia 15 %, popularidad 15 %) | Validado como base (`research/ranking.md`) |
| Modelo de embeddings default | `docs/architecture.md` §4.6 y `docs/data-model.md` §5.10 (`paraphrase-multilingual-MiniLM-L12-v2`) | Confirmado (`research/embeddings.md`) |
| Alternativa ligera | `docs/architecture.md` §4.6 (`all-MiniLM-L6-v2`) | Confirmado |
| `auto_download = false` | `docs/data-model.md` §5.10 y `docs/source-policy.md` §17.3 | Confirmado |
| Umbral similitud | `docs/data-model.md` §5.10 (`embeddings.min_similarity = 0.25`) | Confirmado |
| Pesos híbridos | `docs/source-policy.md` §17.6 (0.7 similarity + 0.3 interest_score, propuesto) | Confirmado |
| Licencias permisivas comerciales | `docs/source-policy.md` §6.5 (MIT, Apache-2.0, BSD-2, BSD-3, ISC) | Confirmado (`research/legal.md`) |
| Agent Reach como complemento | `docs/architecture.md` ADR-007 y `docs/source-policy.md` §5 | Confirmado (`research/agent-reach.md`) |
| GitHub API fuente primaria | `docs/architecture.md` ADR-006 y `docs/source-policy.md` §2 | Confirmado |
| 16 feeds RSS verificados | `docs/source-policy.md` §4 (Research propone lista inicial) | Cumplido (`research/feeds.md`) |
| 15 queries GitHub | `docs/source-policy.md` §3.4 (Research valida plantillas) | Cumplido (`research/github-queries.md`) |

---

## 2. Discrepancias encontradas

### 2.1 Pesos de scoring: hardcodeados vs. configurables

**Documentos F0:**
- `docs/data-model.md` §8.1 define los pesos como fórmulas fijas en el modelo de scoring.
- `docs/source-policy.md` §7.1 define intervalos y presupuestos fijos.

**Decisión del Coordinador (F2):**
- Los pesos **deben ser configurables, no hardcodeados**.
- Se consideran **provisionales hasta validarlos con datos reales**.

**Discrepancia:** `data-model.md` presenta los pesos como parte del modelo de datos fijo. Backend no debe hardcodear `0.30`, `0.20`, etc.; debe leerse de `settings` o `config_json` con los valores por defecto actuales.

**Archivo donde se documenta:** `research/ranking.md` (sección 8 indica que los pesos son provisionales y deben validarse con datos reales).

---

### 2.2 Presupuesto de queries GitHub: 6 queries por ciclo vs. 6 requests

**Documentos F0:**
- `docs/source-policy.md` §3.5 "Presupuesto por ejecución": Búsqueda trending = **6 requests** (3 queries × 2 páginas).
- `docs/source-policy.md` §3.4: máximo 2 páginas por query, `per_page` máximo 50.

**Decisión del Coordinador (F2):**
- Ejecutar un **máximo de 6 queries por ciclo**.
- Rotarlas entre ciclos para distribuir cobertura.

**Discrepancia:** El doc habla de "6 requests" interpretadas como 3 queries × 2 páginas. El Coordinador aclara que son "6 queries por ciclo". Esto duplica el volumen de búsqueda permitido por ciclo respecto a la lectura literal de §3.5. Backend debe implementar el límite como "máximo 6 queries por ciclo" y rotar el subconjunto de las 15 queries investigadas.

**Archivo donde se documenta:** `research/github-queries.md` y `research/propuesta-cambios-docs.md`.

---

### 2.3 Feeds RSS: lista fija vs. configurables desde BD/configuración

**Documentos F0:**
- `docs/source-policy.md` §4.1: Research debe proponer la lista inicial de feeds.
- `docs/data-model.md` §5.1: `sources.config_json` contiene `feed_url` por feed.

**Decisión del Coordinador (F2):**
- Los 16 feeds verificados se aprueban como lista inicial.
- Deben mantenerse **configurables desde la base de datos o configuración**.
- Permitir activar, desactivar y agregar fuentes **sin modificar código**.

**Discrepancia:** F0 ya contempla `sources` configurables, pero no deja explícito que la lista de 16 feeds deba ser manejable desde UI/settings sin código. Backend debe exponer endpoints CRUD para `sources` (`PATCH /sources/{id}`, `POST /sources/{id}/run`) y Frontend debe permitir gestionar fuentes desde Settings.

**Archivo donde se documenta:** `research/feeds.md` y `research/propuesta-cambios-docs.md`.

---

### 2.4 Pesos híbridos: "0.7 semántico / 0.3 lexical" vs. "0.7 similarity + 0.3 interest_score"

**Documentos F0:**
- `docs/source-policy.md` §17.6: pesos híbridos propuesta inicial 0.7/0.3 (similarity + interest_score).
- `docs/data-model.md` §8.3: combina `similarity` con `interest_score`.

**Decisión del Coordinador (F2):**
- Pesos híbridos: **0.7 semántico / 0.3 lexical**.

**Discrepancia:** El término "lexical" no está definido en F0. Asumimos que se refiere a `interest_score` (ranking por metadatos) o a búsqueda por palabras clave. Backend debe aclarar si "lexical" = `interest_score` o si se añade un componente de búsqueda textual pura (`q` sobre `full_name`/`description`).

**Archivo donde se documenta:** `research/embeddings.md` y `research/propuesta-cambios-docs.md`.

---

### 2.5 Agent Reach: canales `unverified` sin verificación con red

**Documentos F0:**
- `docs/source-policy.md` §5.1: `agent-reach check <canal>` solo cuando se autorice una comprobación con red; máximo 1 por canal cada 6 h.
- `docs/architecture.md` §9.3: canales `github`, `youtube`, `web` disponibles por defecto; opcionales requieren instalación y validación.

**Estado real verificado (F1):**
- `bilibili` y `v2ex` están `unverified` (default). Requieren `agent-reach check <canal>` con red, lo cual **no se ejecutó** por falta de autorización.
- `reddit`, `linkedin`, etc. están `not_added`.

**Discrepancia:** F0 asume que Agent Reach puede usarse para descubrimiento comunitario (`reddit`, `v2ex`). En la realidad actual, esos canales no están verificados ni añadidos. Backend debe degradar graceful si Agent Reach no está disponible y no asumir cobertura de Reddit/V2EX en v1.

**Archivo donde se documenta:** `research/agent-reach.md`.

---

### 2.6 Modelo de embeddings: licencia pendiente de verificación

**Documentos F0:**
- `docs/architecture.md` §4.6: "La licencia del modelo debe verificarse en su model card antes de distribuirlo."
- `docs/source-policy.md` §17.3: verificar licencia antes de distribuir.

**Estado real (F1):**
- No se verificó la licencia en los model cards porque no se instala ni descarga el modelo en esta fase.

**Discrepancia:** F0 deja la verificación de licencia como paso pendiente. El Coordinador debe autorizar la verificación de licencias de `paraphrase-multilingual-MiniLM-L12-v2`, `all-MiniLM-L6-v2` y opcionalmente `intfloat/multilingual-e5-small` antes de incluir el sidecar en el empaquetado.

**Archivo donde se documenta:** `research/embeddings.md` y `research/legal.md`.

---

### 2.7 Datos faltantes en `growth_score`: NULL vs. 0

**Documentos F0:**
- `docs/data-model.md` §8.1: `growth_score = NULL` si no hay snapshots suficientes.
- `docs/api-contract.md` §3.1: `growth: number | null`.

**Decisión del Coordinador (F2):**
- Detectar repositorios nuevos que estén creciendo rápidamente, incluso con pocas estrellas.

**Discrepancia:** Un repositorio nuevo no tendrá snapshots suficientes, por lo que `growth_score = NULL`. El ranking debe manejar esto renormalizando pesos (como ya documenta `data-model.md` §8.1), pero Frontend debe mostrar "Sin datos suficientes" en lugar de `0` o ignorar el repo en listas de "crecimiento rápido". Backend debe garantizar que repos nuevos con alta actividad pero sin historial de crecimiento no queden excluidos del descubrimiento.

**Archivo donde se documenta:** `research/ranking.md` (caso C) y `research/propuesta-f2.md`.

---

### 2.8 `period` para repositorios: "descubierto en la ventana" vs. "tendencia activa"

**Documentos F0:**
- `docs/api-contract.md` §1.7: `period` para repositorios significa `first_seen_at >= now - period` (descubierto en la ventana).
- Decisión pendiente: cambiar a "tendencia activa en la ventana" (`last_seen_at`) requiere aprobación.

**Decisión del Coordinador (F2):**
- Detectar repositorios nuevos que crezcan rápidamente (tendencia).

**Discrepancia:** Si `period` se basa solo en `first_seen_at`, un repo descubierto hace 6 meses pero que sigue creciendo no aparecerá en "tendencias de los últimos 7 días". Backend/Frontend deben aclarar si el filtro de tendencias usa `first_seen_at` o `last_seen_at`, o añadir un parámetro separado `trending_window`.

**Archivo donde se documenta:** `research/propuesta-cambios-docs.md`.

---

### 2.9 `docs_url` y `homepage_url`: no construir URLs por convención

**Documentos F0:**
- `docs/source-policy.md` §6.1: prohibido construir `https://github.com/{full_name}` en UI o backend si la API no lo devolvió.
- `docs/api-contract.md` §1.9: la UI solo abre URLs recibidas de la fuente o verificadas.

**Estado real (F1):**
- Ninguna discrepancia; la investigación respeta esta regla. Se documenta en `research/sources.md` y `research/legal.md`.

**Discrepancia:** Ninguna. Se confirma el cumplimiento.

---

### 2.10 Agent Reach: no instalar canales adicionales

**Documentos F0:**
- `docs/source-policy.md` §5: canales opcionales requieren instalación y validación.

**Decisión del Coordinador (F2):**
- No instalar canales adicionales todavía.
- Mantener GitHub y RSS como fuentes principales iniciales.

**Discrepancia:** Ninguna. La investigación confirma que solo `github`, `youtube`, `web` están `ready`; los demás no se tocan.

**Archivo donde se documenta:** `research/agent-reach.md`.

---

## 3. Archivos de investigación que recogen estas discrepancias

| Archivo | Discrepancias que aborda |
|---------|-------------------------|
| `research/ranking.md` | 2.1 (pesos configurables), 2.7 (growth NULL) |
| `research/github-queries.md` | 2.2 (6 queries por ciclo) |
| `research/feeds.md` | 2.3 (feeds configurables) |
| `research/embeddings.md` | 2.4 (pesos híbridos 0.7/0.3), 2.6 (licencia pendiente) |
| `research/agent-reach.md` | 2.5 (canales unverified/not_added), 2.10 (no instalar) |
| `research/legal.md` | 2.6 (licencia embeddings), 2.9 (no construir URLs) |
| `research/sources.md` | 2.9 (procedencia de URLs) |

---

## 4. Acciones requeridas del Coordinador

1. Aclarar si los pesos de scoring se guardan en `settings` (configurables) o se mantienen como defaults hardcodeados con posibilidad de override.
2. Confirmar que el presupuesto de GitHub es "máximo 6 queries por ciclo" y no "6 requests".
3. Confirmar si "lexical" en pesos híbridos = `interest_score` o búsqueda textual pura.
4. Autorizar la verificación de licencias de modelos de embeddings antes de distribuir el sidecar.
5. Resolver la semántica de `period` para repositorios (`first_seen_at` vs `last_seen_at` / `trending_window`).
6. Aplicar los cambios propuestos en `research/propuesta-cambios-docs.md` a `coordinador/docs/` (el agente Research no puede modificar esos archivos).
