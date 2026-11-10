# TechPulse — Evaluación de embeddings locales (research/embeddings.md)

- **Estado**: propuesto (entregable de la fase F1 — Research, tareas R1.8–R1.9).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Contrato de referencia**: `docs/architecture.md` §4.6/§17, `docs/data-model.md` §5.5.1/§8.3/§9/§17, `docs/source-policy.md` §17, `docs/api-contract.md` §3.9.1/§7.4.
- **Regla**: no instalar el modelo en esta fase; solo investigar y documentar. Licencia por verificar en el model card de cada modelo antes de distribuir.

---

## 1. Objetivo

Permitir "busca algo parecido a este repo" y búsqueda en lenguaje natural sin enviar datos a APIs externas. La función es **opcional**: si el sidecar o el modelo no están disponibles, la app sigue funcionando con búsqueda por metadatos (`docs/source-policy.md` §17.1).

---

## 2. Modelos candidatos comparados

| Modelo | Tamaño aprox. | Dimensión | Idioma | Licencia (por verificar) | Rendimiento esperado en CPU | Requisitos | Calidad esperada |
|--------|---------------|-----------|--------|--------------------------|----------------------------|------------|------------------|
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | ~470 MB | 384 | Multilingüe (50+ idiomas) | Por verificar en model card (HF) | Medio-lento; modelo más grande, más RAM/disco | `sentence-transformers`, `torch` (CPU), `numpy` | Buena multilingüe; adecuada para ES/EN mezclados |
| `sentence-transformers/all-MiniLM-L6-v2` | ~80 MB | 384 | Principalmente inglés | Por verificar en model card (HF) | Rápido; modelo pequeño, poca RAM/disco | `sentence-transformers`, `torch` (CPU), `numpy` | Buena en inglés; menor calidad en otros idiomas |
| `intfloat/multilingual-e5-small` (opcional) | ~110 MB (aprox.) | 384 | Multilingüe | Por verificar en model card (HF) | Medio; requiere prefijos `query:` / `passage:` | `sentence-transformers`, `torch` (CPU), `numpy` | Buena multilingüe; E5 es fuerte en benchmarks de retrieval |

> Los tamaños son aproximados y deben verificarse en el model card de Hugging Face antes de distribuir. `paraphrase-multilingual-MiniLM-L12-v2` es el **default propuesto** (`docs/architecture.md` §4.6, `docs/data-model.md` §5.10). `all-MiniLM-L6-v2` es la alternativa ligera. `intfloat/multilingual-e5-small` es opcional.

### 2.1 Requisitos comunes (no instalados en esta fase)

- Paquetes Python: `sentence-transformers`, `torch` (versión CPU), `numpy`.
- Son pesados en disco y RAM; el sidecar es opcional (`docs/architecture.md` §4.6).
- Sidecar `techpulse-embeddings`: carga el modelo una vez y expone API HTTP mínima en `127.0.0.1:8766` (`POST /embed`, `GET /health`, `GET /status`).
- El modelo se descarga una vez desde Hugging Face; después no se requiere red (`docs/source-policy.md` §17.3).

### 2.2 Recomendación

**Modelo recomendado para v1**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.

Justificación:
- Multilingüe: TechPulse maneja contenido en inglés y potencialmente en español (feeds, descripciones, README).
- 384 dimensiones: índice pequeño y rápido en SQLite (BLOB) con NumPy; miles de repos son suficientes (`docs/architecture.md` §4.6).
- Alternativa ligera disponible (`all-MiniLM-L6-v2`) si el usuario tiene restricciones de RAM/disco.

---

## 3. Texto canónico a embeber

Se construye con campos reales del repositorio (`docs/source-policy.md` §17.4, `docs/data-model.md` §5.5.1):

```
full_name
description
topics (separados por comas)
language
category / subcategory
readme_excerpt (máx. 1.000 caracteres)
```

Reglas:
- No incluir estrellas, forks ni fechas (son métricas, no semántica).
- Si un campo es `NULL`, se omite; no se rellena con texto inventado.
- `readme_excerpt` truncado a 1.000 caracteres.
- Ejemplo de estructura (campos reales, valores ilustrativos, no son datos de un repo real):

```
owner/nombre-repo
Una herramienta de análisis de datos en Python.
pandas, jupyter, analytics, data-science
Python
data_science / etl
Este repositorio contiene utilidades para limpiar y transformar datasets...
```

---

## 4. `content_hash` y reindexación

- `content_hash = SHA-256(texto_canónico)` (`docs/data-model.md` §5.5.1 / source-policy §17.4).
- Si el `content_hash` no cambia, no se recalcula el embedding (`docs/data-model.md` §6.7).
- Si cambia algún campo del texto canónico (descripción, topics, categoría, extracto README), el hash cambia y se recalcula el vector.
- Si se cambia el modelo configurado (`embeddings.model`), se reindexa; el vector anterior se reemplaza (`docs/data-model.md` §6.7, source-policy §17.5).
- Una fila por repositorio y modelo activo (`repository_embeddings.repository_id` es PK; para múltiples modelos simultáneos se migraría a `PRIMARY KEY (repository_id, model_name)`).

---

## 5. Indexación

- Job `internal_embeddings` cada 360 min (mín. 60, máx. 1440) (`docs/source-policy.md` §7.1).
- Lotes de 32 textos; máximo 200 repositorios por ejecución (`docs/data-model.md` §5.10).
- Prioridad: repos nuevos, luego repos con `content_hash` distinto, luego repos sin embedding (`docs/source-policy.md` §17.5).
- Si el sidecar no está disponible, el job termina `skipped` y se reintenta en la próxima ventana.
- La indexación no bloquea la ingesta ni la UI.
- Los vectores se normalizan L2 antes de guardarse; la similitud coseno se calcula como producto punto (`docs/data-model.md` §5.5.1).

---

## 6. Búsqueda y similitud

- Vectores normalizados L2; `cosine(a, b) = dot(a, b)`.
- `similarity` se expone como número 0..1.
- Modos de búsqueda (`docs/api-contract.md` §7.4):
  - `metadata`: mismo `category`, tags en común o mismo `language`; ordena por `interest_score`.
  - `semantic`: solo similitud coseno contra embeddings; requiere sidecar y modelo. Si no disponible: `503 EMBEDDINGS_UNAVAILABLE`.
  - `hybrid`: combina `similarity` y `interest_score`; si no hay embeddings, degrada a `metadata` con `mode_used=metadata`.
- Umbral mínimo por defecto: `embeddings.min_similarity = 0.25`; resultados por debajo se omiten (`docs/source-policy.md` §17.6).
- Pesos híbridos propuesta inicial: `0.7 * similarity + 0.3 * interest_score` (pendiente de aprobación, `docs/data-model.md` §8.3).

---

## 7. Funcionamiento sin APIs (después de la descarga inicial)

**Confirmado por diseño (no se instala el modelo en esta fase):**

1. Descarga única del modelo desde Hugging Face al habilitar la función desde Settings (`embeddings.auto_download = false` por defecto).
2. Tras la descarga, el sidecar funciona totalmente offline: escucha solo en `127.0.0.1:8766`, no accede a Internet ni a APIs de embeddings (`docs/source-policy.md` §17.8).
3. La búsqueda semántica compara la consulta (embegeida por el sidecar local) contra los vectores almacenados en SQLite con NumPy; no requiere red.
4. Si el sidecar/modelo no está disponible:
   - `mode=semantic` → `503 EMBEDDINGS_UNAVAILABLE`.
   - `mode=hybrid` → `200` con `mode_used=metadata`.
   - La búsqueda por metadatos sigue funcionando (`docs/api-contract.md` §7.4).

---

## 8. Riesgos y limitaciones

- `torch` CPU es pesado en disco y RAM; el sidecar es opcional y se instala solo si el usuario habilita la función.
- Indexar 1.000 repos cortos puede tardar varios minutos en CPU; se hace por lotes y en segundo plano.
- La búsqueda sobre 10.000 vectores de 384 dimensiones es rápida (milisegundos) con NumPy.
- Si el volumen crece, evaluar `sqlite-vec` o un índice ANN; no necesario en v1 (`docs/source-policy.md` §17.9).
- Licencia del modelo: verificar en el model card antes de distribuir (`docs/source-policy.md` §17.3).

---

## 9. Decisiones que necesita el Coordinador

1. ¿Se confirma `paraphrase-multilingual-MiniLM-L12-v2` como modelo default y `all-MiniLM-L6-v2` como alternativa ligera?
2. ¿Se aprueba `embeddings.auto_download = false` (descarga manual desde Settings)?
3. ¿Se aprueba el umbral `embeddings.min_similarity = 0.25` y los pesos híbridos 0.7/0.3 (pendiente de validación)?
4. ¿Se verifica la licencia de cada modelo en su model card antes de incluir el sidecar en el empaquetado?
