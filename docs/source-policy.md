# TechPulse — Política de fuentes, frecuencia y verificación

- **Estado**: propuesto, pendiente de aprobación.
- **Autor**: Coordinador.
- **Fecha**: 2026-11-09.
- **Aplica a**: Research, Backend y Worker.

Este documento define **qué fuentes se usan, con qué frecuencia, cómo se limitan, cómo se cachean, cómo se reintentan y cómo se evita inventar información**. Los valores son defaults; el usuario puede ajustarlos dentro de los rangos indicados.

## 1. Principios

1. **Fuentes gratuitas primero.** GitHub API, RSS/Atom y Agent Reach; sin servicios cloud de pago para funciones básicas.
2. **GitHub API es la fuente primaria de GitHub.** Agent Reach complementa, no sustituye.
3. **Nunca inventar.** Si un dato no está en la fuente, se guarda `NULL` y la UI muestra “No disponible”.
4. **Nunca fabricar URLs.** Solo se muestran URLs recibidas de una fuente o verificadas y registradas.
5. **Respetar límites.** Leer cabeceras de rate limit, usar caché, backoff y presupuesto por ejecución.
6. **Deduplicar antes de escribir.** Ver `docs/data-model.md`.
7. **Trazabilidad.** Cada dato conserva fuente, identificador externo y fecha de obtención.
8. **Degradación graceful.** Si una fuente falla, el resto sigue funcionando.

## 2. Inventario y prioridad de fuentes

| Prioridad | Fuente | Uso | Estado |
|---|---|---|---|
| 1 | GitHub REST API | Repos, metadatos, licencia, topics, README | Disponible |
| 1 | RSS/Atom | Noticias y blogs técnicos | Aprobación de feeds por Research |
| 2 | Agent Reach `github` | Apoyo a descubrimiento/contexto | Ready por defecto |
| 2 | Agent Reach `youtube` | Tendencias/vídeos técnicos | Ready por defecto |
| 2 | Agent Reach `web` | Lectura de páginas/documentación | Ready por defecto |
| 3 | Agent Reach `reddit`, `v2ex`, etc. | Descubrimiento comunitario | Opcional; requiere instalación/validación |
| 4 | LLM | Resúmenes enriquecidos | Opcional; deshabilitado |

**Regla:** si una fuente de prioridad 3 no está disponible, la app no debe fallar ni simular datos. Se registra como `skipped` o `not_added` y se continúa.

## 3. GitHub API

### 3.1 Endpoints previstos

- `GET /search/repositories` — descubrimiento por queries.
- `GET /repos/{owner}/{repo}` — detalle y metadatos.
- `GET /repos/{owner}/{repo}/readme` — README (extracto).
- `GET /repos/{owner}/{repo}/commits?per_page=1` — actividad reciente (opcional, solo si el presupuesto lo permite).

No se usan endpoints que requieran permisos especiales ni se accede a datos privados.

### 3.2 Autenticación

- Token opcional en `TECHPULSE_GITHUB_TOKEN`.
- Sin token: límites bajos; la app debe reducir el volumen y priorizar.
- Con token: más presupuesto; nunca se registra el token.
- `GET /capabilities` solo informa si el token está configurado.

### 3.3 Rate limits

Los límites documentados por GitHub cambian con el tiempo. **No se hardcodean**; se leen de las cabeceras:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (cuando exista)

Referencia típica (verificar en runtime):

- REST core sin token: ~60 req/h.
- REST core con token: ~5,000 req/h.
- Search sin token: ~10 req/min.
- Search con token: ~30 req/min.

Reglas:

1. Si `remaining < 10 %` del límite o `< 10`, se cancelan jobs no críticos y se registra `skipped`.
2. Si `remaining = 0`, se espera hasta `reset_at`; no se insiste.
3. El presupuesto se comparte entre búsqueda, detalle y README.
4. El estado se persiste en `rate_limit_state`.

### 3.4 Queries de descubrimiento (plantillas)

Research debe validar y ajustar estas plantillas; no son resultados.

```text
topic:ai stars:>500 pushed:>YYYY-MM-DD
topic:llm-agents stars:>100
topic:agent-framework stars:>100
topic:mcp stars:>50
topic:rag stars:>100
topic:data-engineering stars:>300
topic:airflow stars:>300
topic:kafka stars:>500
topic:dbt stars:>300
topic:spark stars:>500
topic:machine-learning stars:>500
topic:data-science stars:>300
language:Python stars:>1000 created:>YYYY-MM-DD
language:TypeScript stars:>1000 created:>YYYY-MM-DD
```

Reglas:

- `YYYY-MM-DD` se calcula con la fecha actual y la ventana configurada (7/30 días).
- Cada query debe tener una categoría/subcategoría asociada en `sources.config_json`.
- No se usan queries que busquen secretos, credenciales o datos personales.
- No se pagina más de 2 páginas por query en una ejecución normal.
- `per_page` máximo 50.

### 3.5 Presupuesto por ejecución

| Job | Máximo de requests | Notas |
|---|---|---|
| Búsqueda trending | 6 | 3 queries × 2 páginas |
| Detalle de repos | 50 | Solo repos nuevos/actualizados |
| README | 20 | Solo repos destacados o sin extracto |
| Commits recientes | 20 | Solo si el presupuesto lo permite |

Si el presupuesto se agota, el run termina como `partial` y se reprograma.

### 3.6 Caché

| Dato | TTL | Validación |
|---|---|---|
| Search | 30 min | Cache key = query + página + per_page |
| Repo detail | 60 min | ETag/If-None-Match si está disponible |
| README | 6 h | ETag/If-None-Match |
| Commits | 30 min | Sin ETag; TTL |

- `http_cache` guarda `cache_key`, `etag`, `last_modified`, `status_code`, `payload_json`, `fetched_at`, `expires_at`.
- Un cache hit no consume rate limit.
- Si `304 Not Modified`, se actualiza `fetched_at` y se reutiliza el payload.

### 3.7 Reintentos y errores

| Situación | Acción |
|---|---|
| 200/304 | Éxito |
| 301/302/307/308 | Seguir redirección (máx. 5) |
| 400 | No reintentar; registrar error de query |
| 401/403 (token inválido) | No reintentar; marcar credencial inválida |
| 403/429 (rate limit) | Esperar `Retry-After`/reset; reprogramar |
| 404 | Marcar repo no disponible; no borrar |
| 422 | No reintentar; query inválida |
| 5xx | Reintentar con backoff |
| Timeout/red | Reintentar con backoff |

Reintentos: máximo 3 intentos totales (inicial + 2), backoff 2 s, 8 s, 30 s con jitter de 0–5 s.

### 3.8 Mapeo de datos

- `html_url` debe coincidir con `https://github.com/{full_name}`; si no coincide, se registra error y se conserva el valor de la API con una advertencia.
- `license_spdx` y `license_name` solo desde el campo `license` de la API.
- `topics` desde `topics`; si no existe, `[]`.
- `readme_excerpt` truncado a 2,000 caracteres; no se inventa.
- `commits_recent`: solo si se consultó; si no, `NULL`.
- `docs_url`: ver sección 6.

## 4. RSS/Atom

### 4.1 Feeds

- Research debe proponer una lista inicial de feeds técnicos y de noticias, con URL, categoría y justificación.
- Cada feed se registra como `sources.kind = 'rss'` con `config_json.feed_url`.
- No se incluyen feeds que requieran autenticación, pago o que violen ToS.
- No se scrapea el artículo completo si el feed no lo incluye.

### 4.2 Frecuencia

| Tipo de feed | Default | Mínimo | Máximo |
|---|---|---|---|
| Noticias de alta prioridad | 60 min | 30 min | 360 min |
| Blogs técnicos | 120 min | 60 min | 720 min |
| Feeds de bajo volumen | 180 min | 60 min | 1440 min |

### 4.3 Fetch

- `GET` con `User-Agent: TechPulse/0.1 (+local)`.
- `If-None-Match` / `If-Modified-Since` si el feed soporta ETag/Last-Modified.
- Timeout 15 s; tamaño máximo 5 MB; máximo 100 items por feed por ejecución.
- Seguir redirecciones (máx. 5).
- No usar cookies ni sesiones.

### 4.4 Parsing

- Título, resumen, URL, autor, fecha, GUID.
- Si falta fecha, `published_at = NULL` y se usa `fetched_at` para ordenar.
- Si falta GUID, `external_id = sha256(canonical_url)`.
- `summary` se limpia de HTML peligroso; se conserva texto plano.
- `raw_json` se guarda para auditoría, con límite de tamaño.

### 4.5 Errores

| Situación | Acción |
|---|---|
| 200 | Parsear |
| 304 | Sin cambios; actualizar `last_success_at` |
| 301/302 | Seguir |
| 404/410 | Feed eliminado; deshabilitar tras 3 fallos consecutivos |
| 403/429 | Backoff; respetar `Retry-After` |
| XML inválido | Registrar `parse_error`; no reintentar más de 2 veces |
| Timeout | Reintentar |

## 5. Agent Reach

### 5.1 Diagnóstico

- `agent-reach doctor --text` al arrancar y cada 24 h.
- `agent-reach channels` para listar canales/acciones/parámetros.
- `agent-reach check <channel> --text` solo cuando se autorice una comprobación con red; máximo 1 por canal cada 6 h.
- El resultado se guarda en caché (`capabilities`) y se expone en `GET /capabilities`.

### 5.2 Uso por canal

| Canal | Uso | Frecuencia | Fallback |
|---|---|---|---|
| `github` | Descubrimiento/contexto complementario | 6 h | GitHub API |
| `youtube` | Tendencias/vídeos técnicos | 6 h | RSS/web |
| `web` | Lectura de páginas/documentación | Bajo demanda | No aplica |
| `reddit` | Descubrimiento comunitario | 6 h | Omitir |
| `v2ex` | Descubrimiento comunitario | 6 h | Omitir |

### 5.3 Ejecución

- Subprocess con timeout 60 s.
- Sin shell interactivo; argumentos en lista, no concatenados.
- Salida esperada: JSON. Si no es JSON, se registra error y no se interpreta.
- Concurrencia máxima: 1 proceso Agent Reach a la vez.
- No se ejecutan comandos de escritura (`login`, `add`, `remove`, `update`) desde el worker; esas acciones son del usuario.

### 5.4 Reglas de datos

- Todo resultado de Agent Reach debe conservar `source_key`, `external_id` (si existe), `fetched_at` y `raw_json`/metadata.
- No se mezclan datos de Agent Reach con GitHub API sin deduplicar por `github_id`/URL.
- Si un canal no está disponible, se registra `skipped` y se continúa.
- Nunca se presenta una inferencia de Agent Reach como dato oficial de GitHub.

## 6. Verificación de enlaces y anti-invención

### 6.1 Procedencia obligatoria

| Campo | Origen permitido |
|---|---|
| `html_url` | GitHub API (`html_url`) |
| `homepage_url` | GitHub API (`homepage`) |
| `docs_url` | Enlace explícito del README con texto “docs/documentation/documentación” **o** homepage que sea una URL de documentación explícita; debe pasar verificación |
| `news.url` | Feed (link/guid) |
| `project_ideas` | Datos ya almacenados; sin URLs nuevas |

**Prohibido:** construir URLs por convención (por ejemplo, `https://github.com/{full_name}` en la UI o en el backend si la API no lo devolvió).

### 6.2 Verificación HTTP

- Método: `HEAD`; si el servidor no lo soporta (405/501), usar `GET` con `Range: bytes=0-0`.
- Timeout: 8 s.
- User-Agent: `TechPulse-LinkChecker/0.1`.
- Seguir redirecciones (máx. 5).
- Códigos `200–399`: `ok = 1`.
- `401/403/405/429`: `ok = 0`, estado `unverified` (no “broken”).
- `404/410`: `ok = 0`, estado `broken`.
- `5xx`/timeout: `ok = 0`, estado `unverified`; reintentar en la próxima ventana.

### 6.3 Frecuencia de verificación

| Enlace | Verificación inicial | Re-verificación |
|---|---|---|
| `html_url` | Al ingerir | Cada 7 días |
| `homepage_url` | Al ingerir | Cada 7 días |
| `docs_url` | Antes de publicarlo | Cada 7 días |
| `news.url` | Al ingerir | Cada 7 días |

Los resultados se guardan en `link_checks` (append-only). La UI usa el último resultado.

### 6.4 Reglas de presentación

- Si `ok = 0` o no hay check: la UI muestra el enlace como texto no clickeable o con advertencia “No verificado”.
- Si `docs_url` es `NULL`: mostrar “Documentación no disponible”; no enlazar a GitHub como si fuera documentación.
- Si `homepage_url` es `NULL`: mostrar “Demo/sitio no disponible”.
- Si una noticia está `broken`: mostrar advertencia; no ocultar el titular.
- Nunca mostrar métricas inventadas; si falta un dato, `—` o “Sin datos”.

### 6.5 Licencias

- `license_spdx`/`license_name` solo desde GitHub API.
- Si es `NULL`: “Licencia no especificada”.
- Solo se puede afirmar compatibilidad comercial para licencias permisivas conocidas (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC) y con la advertencia “verificar requisitos de atribución”.
- GPL/AGPL/SSPL y licencias desconocidas: “Revisar licencia antes de uso comercial”.
- Nunca se inventa una licencia.

### 6.6 Resúmenes y explicaciones

- Sin LLM: se generan desde metadatos (descripción, topics, lenguaje, licencia, actividad, categoría).
- Si no hay descripción: “Descripción no disponible en la fuente”.
- Si no hay datos de actividad: “Sin datos de actividad recientes”.
- Con LLM: se marca `generated_by = "llm"` y se mantiene la posibilidad de volver al resumen determinista.
- El LLM nunca debe completar URLs, métricas ni licencias.

## 7. Programación de tareas

### 7.1 Defaults

| Job | Default | Mínimo | Máximo | Observaciones |
|---|---|---|---|---|
| GitHub búsqueda trending | 240 min (4 h) | 60 min | 1440 min | 3 queries × 2 páginas |
| GitHub detalle de repos | 720 min (12 h) | 120 min | 2880 min | Hasta 50 repos |
| GitHub README | 360 min (6 h) | 120 min | 1440 min | Solo destacados |
| RSS alta prioridad | 60 min | 30 min | 360 min | Condicional |
| RSS normal | 120 min | 60 min | 720 min | Condicional |
| Agent Reach descubrimiento | 360 min (6 h) | 120 min | 1440 min | 1 canal por vez |
| Agent Reach doctor | 1440 min (24 h) | 360 min | 10080 min | Sin red |
| Verificación de enlaces | 10080 min (7 d) | 1440 min | 43200 min | Por lote |
| Recalculo de scores | 1440 min (24 h) | 360 min | 2880 min | Tras ingesta también |
| Indexación de embeddings | 360 min (6 h) | 60 min | 1440 min | Lotes de 32; máx. 200 repos/run |
| Generación automática de ideas | Evento | — | — | Máx. 1 cada 6 h |
| Limpieza/retención | 1440 min | 360 min | 10080 min | No borra guardados |
| Worker poll de jobs | 2 s | 1 s | 10 s | Cola manual |
| Worker heartbeat | 10 s | 5 s | 30 s | Estado |

### 7.2 Reglas de scheduling

- Jitter: 0–30 s para evitar ráfagas.
- `scheduler.max_concurrent_jobs`: default 2; máximo 4.
- Un job de la misma fuente no puede ejecutarse dos veces en paralelo.
- Al arrancar, si `next_run_at` está vencido, se ejecuta una vez (catch-up), no N veces.
- Si un job falla, se aplica backoff y se actualiza `next_run_at`; no se bloquea el resto.
- El usuario puede desactivar una fuente (`enabled = 0`); no se ejecuta.
- La actualización manual crea un `job_request`; no altera el calendario periódico salvo que el usuario lo configure.

### 7.3 Circuit breaker

- 5 fallos consecutivos de una fuente → cooldown 30 min.
- Tras el cooldown, un intento “half-open”; si falla, vuelve al cooldown.
- El estado se refleja en `sources.last_error` y en la UI.

## 8. Caché y límites globales

### 8.1 TTLs

| Recurso | TTL |
|---|---|
| GitHub search | 30 min |
| GitHub repo detail | 60 min |
| GitHub README | 6 h |
| GitHub commits | 30 min |
| RSS feed | 30 min (condicional) |
| Agent Reach doctor | 24 h |
| Agent Reach búsqueda | 6 h |
| Embeddings: estado del sidecar | 30 s |
| Embeddings: vectores | Sin TTL; se invalidan por `content_hash` o cambio de modelo |
| Link checks | 7 días |
| Capabilities | 24 h (o refresh manual) |

### 8.2 Límites

- HTTP global: 4 requests concurrentes.
- Por host: 2 requests concurrentes.
- GitHub: 2 concurrentes.
- RSS: 5 concurrentes.
- Agent Reach: 1 proceso.
- Embeddings: 1 sidecar; 1 request de embeddings a la vez; lotes de 32; timeout 30 s por lote.
- Tamaño máximo de respuesta: 5 MB (RSS) / 2 MB (JSON).
- Timeout HTTP: 15 s (default), 8 s para link checks.
- **Máximo 6 queries lógicas de GitHub por ciclo** (rotadas entre ciclos para distribuir cobertura de las 15 queries investigadas).
- Caché de search: TTL 30 min; cache key = query + página + per_page.
- Reintentos: 3 intentos totales.
- `http_cache` se purga por `expires_at` en el job de limpieza.

## 9. Reintentos y backoff

| Error | ¿Reintentar? | Backoff |
|---|---|---|
| Timeout / red | Sí | 2 s, 8 s, 30 s + jitter |
| 5xx | Sí | 2 s, 8 s, 30 s + jitter |
| 429 | Sí | `Retry-After` o reset |
| 403 rate limit | Sí | reset |
| 408/425 | Sí | backoff |
| 400/401/404/422 | No | Registrar |
| XML/JSON inválido | Máx. 2 | backoff corto |

- Cada intento se registra en `source_runs.metadata_json`.
- Si se agotan los intentos, el run termina `failed` con `error_code` y `error_message`.
- Un fallo de una fuente no debe abortar el worker.

## 10. Deduplicación y procedencia

- Repos: `github_id`; fallback `full_name`.
- Noticias: `url_hash` canónico; `external_id` por feed.
- Ideas: `generation_key`.
- Tags: `slug`.
- Snapshots: `(repository_id, captured_at)` con `captured_at` truncado a la hora.
- Cada entidad conserva `source_key`, `external_id` (cuando exista), `fetched_at` y metadata.
- No se sobrescribe un dato verificado con una inferencia.

## 11. Reglas anti-invención (checklist)

Antes de guardar o mostrar un dato:

- [ ] ¿El valor viene de la fuente o de un cálculo sobre datos almacenados?
- [ ] ¿La URL fue recibida de la fuente o verificada?
- [ ] ¿La fecha existe en la fuente?
- [ ] ¿La licencia existe en la API?
- [ ] ¿El crecimiento tiene snapshots suficientes?
- [ ] ¿La idea referencia repositorios reales?
- [ ] ¿El resumen evita afirmar cosas no presentes en los metadatos?
- [ ] ¿La UI distingue “sin datos” de “cero”?

Si alguna respuesta es “no”, se guarda `NULL`/se omite y se muestra “No disponible”.

## 12. Observabilidad

Cada ejecución debe registrar:

- `source_key`, `run_id`, `trigger`, inicio/fin, duración.
- `items_fetched/new/updated/skipped`.
- Códigos HTTP y rate limit restante.
- Cache hits/misses.
- Error code/message.
- Para Agent Reach: canal, comando, duración, código de salida.

La UI muestra:

- última actualización exitosa,
- estado del worker,
- último error por fuente,
- runs recientes,
- fuentes deshabilitadas o con cooldown.

## 13. Configuración inicial sugerida

```json
{
  "scheduler.enabled": true,
  "scheduler.max_concurrent_jobs": 2,
  "http.timeout_seconds": 15,
  "http.max_concurrent": 4,
  "links.verify_interval_days": 7,
  "ideas.auto_generate": true,
  "ideas.min_new_repos": 10,
  "ideas.max_per_run": 5,
  "retention.source_runs_days": 90,
  "retention.snapshots_days": 400,
  "retention.news_days": 365,
  "embeddings.enabled": true,
  "embeddings.model": "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  "embeddings.batch_size": 32,
  "embeddings.max_repos_per_run": 200,
  "embeddings.interval_minutes": 360,
  "embeddings.auto_download": false,
  "embeddings.min_similarity": 0.25,
  "embeddings.sidecar_url": "http://127.0.0.1:8766"
}
```

## 14. Anexo A — Claves de fuentes y `config_json`

Las claves son estables y las usa el worker para identificar jobs. Los valores de `config_json` son ejemplos; Research valida los definitivos.

| `sources.key` | `kind` | `category` | Intervalo default | `config_json` mínimo |
|---|---|---|---|---|
| `github_search_trending` | `github_api` | `github` | 240 min | `{"queries":[{"q":"topic:ai stars:>500","category":"ai","subcategory":"agents"}],"per_page":50,"max_pages":2}` |
| `github_repo_details` | `github_api` | `github` | 720 min | `{"refresh_limit":50,"include_readme":true,"include_commits":true}` |
| `rss_<slug>` | `rss` | `news` | 60–120 min | `{"feed_url":"https://...","category":"ai","max_items":100}` |
| `agent_reach_<channel>` | `agent_reach` | `other` | 360 min | `{"channel":"youtube","action":"search","params":{"query":"AI agents","limit":10},"max_items":20}` |
| `internal_score_recompute` | `internal` | `other` | 1440 min | `{"job_type":"score_recompute"}` |
| `internal_embeddings` | `internal` | `other` | 360 min | `{"job_type":"embeddings","batch_size":32,"max_repos_per_run":200}` |
| `internal_link_verification` | `internal` | `other` | 10080 min | `{"job_type":"link_verification","batch_size":100}` |
| `internal_retention_cleanup` | `internal` | `other` | 1440 min | `{"job_type":"retention_cleanup"}` |
| `internal_ideas_auto` | `internal` | `other` | 360 min | `{"job_type":"ideas_auto","min_new_repos":10,"max_per_run":5}` |

Reglas:

- `kind='internal'` representa jobs del sistema, no fuentes externas. La UI puede agruparlos como “Sistema”.
- `config_json` nunca contiene secretos.
- El worker valida `config_json` contra un esquema por `kind` y registra `VALIDATION_ERROR` si no cumple.

## 15. Anexo B — Clasificación determinista base

Research puede refinar estas reglas; Backend debe implementarlas como configuración, no como código hardcodeado cuando sea posible.

### 15.1 Categoría de repositorio

Orden de prioridad: `ai` > `data_engineering` > `machine_learning` > `data_science` > `dev_tools` > `web` > `other`.

Coincidencias por topics (case-insensitive), luego por descripción:

| Categoría | Topics/keywords |
|---|---|
| `ai` | `ai`, `artificial-intelligence`, `llm`, `agents`, `agent`, `agentic`, `mcp`, `rag`, `automation`, `inference`, `evaluation` |
| `data_engineering` | `data-engineering`, `etl`, `elt`, `airflow`, `kafka`, `spark`, `dbt`, `warehouse`, `data-lake`, `pipeline`, `postgres`, `postgresql`, `big-data` |
| `machine_learning` | `machine-learning`, `deep-learning`, `pytorch`, `tensorflow`, `scikit-learn`, `mlops` |
| `data_science` | `data-science`, `pandas`, `jupyter`, `analytics`, `visualization` |
| `dev_tools` | `cli`, `sdk`, `developer-tools`, `framework`, `database`, `infrastructure` |
| `web` | `web`, `react`, `vue`, `nextjs`, `frontend`, `backend` |

### 15.2 Subcategoría de repositorio

| Subcategoría | Señales |
|---|---|
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

Si hay varias coincidencias, se elige la primera según el orden de la tabla. Si no hay coincidencia, `subcategory = NULL`.

### 15.3 Importancia de noticias

```text
source_weight = peso configurado del feed (0..1; default 0.5)
recency = 1.0 si published_at <= 6 h
          0.8 si <= 24 h
          0.5 si <= 72 h
          0.2 si <= 7 d
          0.0 en otro caso
keyword_score = min(1, coincidencias / 5)
category_relevance = 1.0 si la categoría está en intereses del usuario, si no 0.5
importance = 0.35 * source_weight
           + 0.35 * recency
           + 0.20 * keyword_score
           + 0.10 * category_relevance
```

Etiquetas:

- `high` si `importance >= 0.75`
- `medium` si `importance >= 0.45`
- `low` en otro caso

Términos de alta señal (conteo, no ponderación): `release`, `launch`, `lanzamiento`, `vulnerability`, `CVE`, `breach`, `acquisition`, `funding`, `open source`, `model`, `agent`, `framework`, `API`, `deprecation`, `security`. Research puede ampliar la lista; no se usa para inventar contenido.

### 15.4 Extracción de `docs_url`

1. Se parsean enlaces Markdown del README (`[texto](url)`).
2. Se consideran candidatos solo si el texto del enlace coincide con `(?i)\b(docs?|documentation|documentación|guide|manual|reference)\b`.
3. Se resuelven URLs relativas contra `html_url`.
4. Se aceptan solo `http://` o `https://`.
5. Se verifica el primer candidato con la política de la sección 6.
6. Si no hay candidato válido, `docs_url = NULL`.

No se usa `https://github.com/{full_name}#readme` como documentación. No se inventan subdominios `docs.*`.

## 16. Anexo C — Plantillas base de ideas

Research puede ampliar/ajustar. Backend implementa las plantillas como datos versionados. Cada idea debe referenciar repositorios reales y conservar `generation_key`.

| `template_id` | Roles requeridos | Ejemplo de combinación | Dificultad base |
|---|---|---|---|
| `agent_research_assistant` | `data_source` + `ai` + `processing` | Fuente de datos + framework de agentes + procesamiento | Intermedio |
| `data_pipeline_dashboard` | `data_source` + `processing` + `visualization` | Conector + ETL/orquestación + dashboard | Intermedio |
| `repo_trend_monitor` | `data_source` + `processing` + `visualization` | GitHub API + análisis + dashboard | Principiante |
| `rag_knowledge_base` | `data_source` + `ai` + `tooling` | Documentos + RAG/vector DB + UI | Intermedio |
| `automation_agent` | `tooling` + `ai` + `processing` | API/herramienta + agente + scheduler | Intermedio |
| `multiagent_workflow` | `ai` + `tooling` + `visualization` | Framework multiagente + herramientas + observabilidad | Avanzado |

Reglas de generación:

- Seleccionar repositorios por `category`/`subcategory`, `interest_score` y tags.
- No repetir una idea si `generation_key` ya existe.
- `max_ideas` respeta la configuración.
- El texto se construye con metadatos reales; si falta un dato, se omite o se indica “no disponible”.
- Cada idea debe tener al menos un repositorio; si no hay combinación válida, no se crea.

## 17. Anexo D — Embeddings locales y búsqueda semántica

### 17.1 Objetivo

Permitir “busca algo parecido a este repo” y búsqueda en lenguaje natural sin enviar datos a APIs externas. La función es **opcional**: si el sidecar o el modelo no están disponibles, la app sigue funcionando con búsqueda por metadatos.

### 17.2 Componentes

- **Sidecar `techpulse-embeddings`**: carga el modelo una vez y expone `POST /embed`, `GET /health` y `GET /status` en `127.0.0.1:8766`.
- **Worker**: indexa repositorios en lotes y persiste vectores en `repository_embeddings`.
- **API**: consulta el sidecar para embeddings de consultas y calcula similitud coseno contra los vectores almacenados.
- **SQLite**: vectores `float32` normalizados L2.

### 17.3 Modelos

| Modelo | Tamaño aprox. | Idioma | Uso |
|---|---|---|---|
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | ~470 MB | Multilingüe | Default propuesto |
| `sentence-transformers/all-MiniLM-L6-v2` | ~80 MB | Principalmente inglés | Alternativa ligera |

Reglas:

- Verificar la licencia del modelo en su model card antes de distribuirlo.
- El modelo se descarga una vez desde Hugging Face; después no se requiere red.
- `embeddings.auto_download = false` por defecto: la descarga se inicia desde Settings.
- Si el modelo no está descargado, `EmbeddingStatus.model.download_required = true` y el modo semántico no está disponible.
- No se envían textos a ningún servicio externo.

### 17.4 Texto canónico a embeber

Se construye con campos reales del repositorio:

```text
full_name
description
topics (separados por comas)
language
category / subcategory
readme_excerpt (máx. 1,000 caracteres)
```

- No se incluyen estrellas, forks ni fechas: son métricas, no semántica.
- Si un campo es `NULL`, se omite; no se rellena con texto inventado.
- `content_hash = SHA-256(texto_canónico)`; si no cambia, no se recalcula.

### 17.5 Indexación

- Job `internal_embeddings` cada 360 min (mín. 60, máx. 1440).
- Lotes de 32 textos; máximo 200 repositorios por ejecución.
- Prioridad: repos nuevos, luego repos con `content_hash` distinto, luego repos sin embedding.
- Si el sidecar no está disponible, el job termina `skipped` y se reintenta en la próxima ventana.
- Si se cambia de modelo, se reindexa; los vectores del modelo anterior se reemplazan.
- La indexación no bloquea la ingesta ni la UI.

### 17.6 Búsqueda y similitud

- Vectores normalizados L2; `cosine = dot`.
- `similarity` se expone como 0..1.
- `mode=metadata`: comportamiento actual.
- `mode=semantic`: solo similitud; requiere sidecar/modelo.
- `mode=hybrid`: combina `similarity` y `interest_score`; pesos pendientes de aprobación (propuesta inicial: 0.7/0.3).
- Umbral mínimo por defecto: `embeddings.min_similarity = 0.25`; los resultados por debajo se omiten.
- La similitud no es una medida de calidad; la UI debe etiquetarla como “similitud semántica”.

### 17.7 Fallback y errores

| Situación | Comportamiento |
|---|---|
| Sidecar offline | `mode=semantic` → `503 EMBEDDINGS_UNAVAILABLE`; `mode=hybrid` → metadatos con `mode_used=metadata` |
| Modelo no descargado | Igual que offline; UI ofrece descarga |
| Modelo cargando | `503` o `202` según endpoint; UI muestra `loading` |
| Vector ausente para un repo | Se excluye de resultados semánticos; se indexa en el próximo job |
| Modelo distinto al del vector | Se excluye; se requiere reindexar |
| Error de sidecar | Se registra en logs; no se borran vectores |

### 17.8 Privacidad y seguridad

- Todo el procesamiento es local.
- El sidecar escucha solo en `127.0.0.1:8766`.
- No hay telemetría ni llamadas a APIs de embeddings.
- La única red es la descarga inicial del modelo desde Hugging Face.
- Los textos de repositorios son públicos; aun así, no se envían a terceros.

### 17.9 Coste y rendimiento

- `torch` CPU es pesado en disco y RAM; el sidecar es opcional.
- Indexar 1,000 repos cortos puede tardar varios minutos en CPU; se hace por lotes y en segundo plano.
- La búsqueda sobre 10,000 vectores de 384 dimensiones es rápida (milisegundos) con NumPy.
- Si el volumen crece, evaluar `sqlite-vec` o un índice ANN; no es necesario en v1.

## 18. Decisiones pendientes de aprobación

1. Lista inicial de feeds RSS (Research).
2. Queries de GitHub y categorías asociadas (Research).
3. Intervalos por defecto y rangos.
4. Presupuesto de requests por ejecución.
5. Política de verificación de `docs_url` (solo enlaces explícitos del README).
6. Uso de Agent Reach `github/youtube/web` como complemento y canales opcionales.
7. Reintentos (3) y circuit breaker (5 fallos/30 min).
8. TTLs de caché.
9. Regla de licencias permisivas para uso comercial.
10. Modelo de embeddings y licencia.
11. Frecuencia de indexación (6 h), lote (32) y máximo por run (200).
12. Umbral de similitud (0.25) y pesos híbridos (0.7/0.3 propuesto).
