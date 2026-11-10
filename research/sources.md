# TechPulse — Inventario de fuentes gratuitas (research/sources.md)

- **Estado**: propuesto (entregable de la fase F1 — Research).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Contratos de referencia**: `docs/architecture.md`, `docs/data-model.md`, `docs/api-contract.md`, `docs/source-policy.md`, `docs/plan.md` (worktree `coordinador`, lectura solo).
- **Entorno verificado**: Agent Reach `1.6.1`, Python `3.13.15`, Node `v24.19.0`, Git `2.56.0`, GitHub CLI `2.103.3`.
- **Regla de oro**: si no se pudo verificar un dato (URL, límite, licencia, fecha), se marca como "no verificado" y no se inventa.

---

## 1. Resumen de fuentes por prioridad

| Prioridad | Fuente | Uso principal | Estado | Verificación |
|-----------|--------|---------------|--------|--------------|
| 1 | GitHub REST API | Repositorios, metadatos, licencia, topics, README, actividad | Disponible | Token opcional; límites leídos de cabeceras en runtime |
| 1 | RSS/Atom | Noticias y blogs técnicos | Aprobación de feeds por Research | 16 feeds verificados (ver `feeds.md`) |
| 2 | Agent Reach `github` | Apoyo a descubrimiento/contexto | Ready (default) | `agent-reach doctor --text` y `channels` ejecutados |
| 2 | Agent Reach `youtube` | Tendencias/vídeos técnicos | Ready (default) | `agent-reach doctor --text` y `channels` ejecutados |
| 2 | Agent Reach `web` | Lectura de páginas/documentación | Ready (default) | `agent-reach doctor --text` y `channels` ejecutados |
| 3 | Agent Reach `bilibili`, `v2ex` | Descubrimiento comunitario (regional) | Unverified (default) | Requieren `agent-reach check <canal>` con red (no ejecutado) |
| 3 | Agent Reach `reddit`, `linkedin`, etc. | Descubrimiento comunitario | Not added (opcional) | No instalados; no asumir que funcionan |

---

## 2. GitHub REST API

### 2.1 Endpoints previstos (ver `docs/source-policy.md` §3.1 y `docs/architecture.md` §9.1)

| Endpoint | Uso | Autenticación | Notas |
|----------|-----|---------------|-------|
| `GET /search/repositories` | Descubrimiento por queries | Token opcional | Rate limit de búsqueda (~10 req/min sin token, ~30 con token, típicos; verificar en runtime) |
| `GET /repos/{owner}/{repo}` | Detalle y metadatos de un repo | Token opcional | Rate limit REST core (~60 req/h sin token, ~5,000 con token, típicos; verificar en runtime) |
| `GET /repos/{owner}/{repo}/readme` | Extracto del README | Token opcional | Truncar a 2.000 caracteres; no inventar |
| `GET /repos/{owner}/{repo}/commits?per_page=1` | Actividad reciente (opcional) | Token opcional | Solo si el presupuesto de requests lo permite |

No se usan endpoints que requieran permisos especiales ni datos privados.

### 2.2 Autenticación

- Token opcional en variable de entorno `TECHPULSE_GITHUB_TOKEN` (ver `docs/architecture.md` §8.2).
- Sin token: límites bajos; la app debe reducir volumen y priorizar.
- Con token: más presupuesto; nunca se registra el token en logs ni respuestas.
- `GET /capabilities` solo informa `github_token_configured: true\|false`, nunca el valor.

### 2.3 Límites (rate limits)

Los límites documentados por GitHub cambian con el tiempo. **No se hardcodean**; se leen de las cabeceras en runtime:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (cuando exista)

Referencia típica (verificar en runtime, `docs/source-policy.md` §3.3):

- REST core sin token: ~60 req/h.
- REST core con token: ~5,000 req/h.
- Search sin token: ~10 req/min.
- Search con token: ~30 req/min.

Reglas:
1. Si `remaining < 10 %` del límite o `< 10`, cancelar jobs no críticos y registrar `skipped`.
2. Si `remaining = 0`, esperar hasta `reset_at`; no insistir.
3. El presupuesto se comparte entre búsqueda, detalle y README.
4. El estado se persiste en `rate_limit_state`.

### 2.4 Campos que aporta (mapeo a `repositories`)

| Campo API | Campo BD | Puede ser NULL | Notas |
|-----------|----------|----------------|-------|
| `id` | `github_id` | No | Clave natural única |
| `full_name` | `full_name` | No | Único; normalizado para dedup |
| `owner.login` | `owner_login` | No | |
| `owner.type` | `owner_type` | Sí | `User` / `Organization` |
| `name` | `name` | No | |
| `description` | `description` | Sí | |
| `html_url` | `html_url` | No | Debe coincidir con `https://github.com/{full_name}` |
| `homepage` | `homepage_url` | Sí | Solo desde API |
| `language` | `language` | Sí | |
| `license.spdx_id` | `license_spdx` | Sí | Solo desde campo `license` |
| `license.name` | `license_name` | Sí | Solo desde campo `license` |
| `topics` | `topics_json` | Sí (default `[]`) | |
| `stargazers_count` | `stars` | No (default 0) | |
| `forks_count` | `forks` | No (default 0) | |
| `open_issues_count` | `open_issues` | No (default 0) | |
| `watchers_count` | `watchers` | Sí | |
| `created_at` | `created_at` | No | ISO-8601 UTC |
| `updated_at` | `updated_at` | No | ISO-8601 UTC |
| `pushed_at` | `pushed_at` | Sí | ISO-8601 UTC |
| `archived` | `archived` | No (0/1) | |
| `disabled` | `disabled` | No (0/1) | |
| `fork` | `is_fork` | No (0/1) | |
| `default_branch` | `default_branch` | Sí | |

### 2.5 Frecuencia recomendada (ver `docs/source-policy.md` §7.1)

| Job | Default | Mínimo | Máximo |
|-----|---------|--------|--------|
| GitHub búsqueda trending | 240 min (4 h) | 60 min | 1440 min |
| GitHub detalle de repos | 720 min (12 h) | 120 min | 2880 min |
| GitHub README | 360 min (6 h) | 120 min | 1440 min |

### 2.6 Presupuesto por ejecución (ver `docs/source-policy.md` §3.5)

| Job | Máximo de requests | Notas |
|-----|--------------------|-------|
| Búsqueda trending | 6 | 3 queries × 2 páginas |
| Detalle de repos | 50 | Solo repos nuevos/actualizados |
| README | 20 | Solo repos destacados o sin extracto |
| Commits recientes | 20 | Solo si el presupuesto lo permite |

### 2.7 Riesgos

- Rate limit bajo sin token (60 req/h REST core, 10 req/min search).
- 403/429 por límite: esperar `Retry-After`/reset; no insistir.
- 404: repo no disponible; no borrar.
- Campos ausentes: guardar `NULL`, nunca inventar.

---

## 3. RSS/Atom

### 3.1 Feeds verificados (URL responde y es parseable como RSS/Atom)

Ver `research/feeds.md` para la lista completa con categoría, idioma, frecuencia y prioridad. Resumen de los 16 verificados el 2026-11-09:

| # | Feed | URL | Categoría | Idioma | Estado |
|---|------|-----|-----------|--------|--------|
| 1 | Hacker News | https://news.ycombinator.com/rss | Noticias tech | en | Verificado |
| 2 | The GitHub Blog | https://github.blog/feed/ | Desarrollo / GitHub | en | Verificado |
| 3 | Hugging Face Blog | https://huggingface.co/blog/feed.xml | IA / ML | en | Verificado |
| 4 | TechCrunch | https://techcrunch.com/feed/ | Noticias tech / startups | en | Verificado |
| 5 | The Verge | https://www.theverge.com/rss/index.xml | Noticias tech | en | Verificado |
| 6 | Ars Technica | https://arstechnica.com/feed/ | Noticias tech / ciencia | en | Verificado |
| 7 | TensorFlow Blog | https://blog.tensorflow.org/feeds/posts/default | ML / Data Engineering | en | Verificado |
| 8 | MIT Technology Review | https://www.technologyreview.com/feed/ | IA / tecnología | en | Verificado |
| 9 | WIRED | https://www.wired.com/feed/rss | Noticias tech / cultura | en | Verificado |
| 10 | arXiv cs.AI | https://export.arxiv.org/rss/cs.AI | IA (papers) | en | Verificado |
| 11 | Towards Data Science | https://towardsdatascience.com/feed | IA / ML / Data Science | en | Verificado |
| 12 | HackerNoon | https://hackernoon.com/feed | Desarrollo / tech | en | Verificado |
| 13 | Microsoft for Developers | https://devblogs.microsoft.com/feed/ | Desarrollo / herramientas | en | Verificado |
| 14 | AWS Machine Learning Blog | https://aws.amazon.com/blogs/machine-learning/feed/ | IA / Data Engineering / Cloud | en | Verificado |
| 15 | Kubernetes Blog | https://kubernetes.io/feed.xml | Data Engineering / infra | en | Verificado |
| 16 | Anaconda Blog | https://www.anaconda.com/blog/feed | Data Science / Python | en | Verificado |

### 3.2 Método de acceso

- `GET` con `User-Agent: TechPulse/0.1 (+local)`.
- `If-None-Match` / `If-Modified-Since` si el feed soporta ETag/Last-Modified.
- Timeout 15 s; tamaño máximo 5 MB; máximo 100 items por feed por ejecución.
- Seguir redirecciones (máx. 5). No usar cookies ni sesiones.

### 3.3 Parsing (ver `docs/source-policy.md` §4.4)

- Título, resumen, URL, autor, fecha, GUID.
- Si falta fecha: `published_at = NULL` y se usa `fetched_at` para ordenar.
- Si falta GUID: `external_id = sha256(canonical_url)`.
- `summary` se limpia de HTML peligroso; se conserva texto plano.
- `raw_json` se guarda para auditoría, con límite de tamaño.

### 3.4 Frecuencia recomendada (ver `docs/source-policy.md` §4.2)

| Tipo de feed | Default | Mínimo | Máximo |
|--------------|---------|--------|--------|
| Noticias de alta prioridad | 60 min | 30 min | 360 min |
| Blogs técnicos | 120 min | 60 min | 720 min |
| Feeds de bajo volumen | 180 min | 60 min | 1440 min |

### 3.5 Riesgos

- Feeds que requieran autenticación, pago o que violen ToS: NO incluirse.
- No scrapeo del artículo completo si el feed no lo incluye.
- XML inválido: registrar `parse_error`; no reintentar más de 2 veces.
- 404/410: feed eliminado; deshabilitar tras 3 fallos consecutivos.

---

## 4. Agent Reach (CLI)

### 4.1 Diagnóstico real ejecutado

Comandos ejecutados el 2026-11-09 en `buscador`:

- `agent-reach doctor --text` → versión 1.6.1; lista de canales con estado.
- `agent-reach channels` → JSON completo con canales, acciones, parámetros, backends.

Estado de canales (ver `research/agent-reach.md` para la matriz completa):

| Canal | Nivel | Estado | Login requerido | Acciones principales |
|-------|-------|--------|-----------------|----------------------|
| `github` | default | ready | No | `search`, `read` |
| `youtube` | default | ready | No | `read`, `search`, `subtitle`, `transcribe` |
| `web` | default | ready | No | `search` (Exa), `read` (jina, exa) |
| `bilibili` | default | unverified | Sesión (no logueado) | `search`, `read`, `hot`, `subtitle` |
| `v2ex` | default | unverified | No | `hot`, `node`, `read`, `user` |
| `twitter` | experimental | not_added | Navegador | `search`, `profile`, `tweets`, `thread` |
| `facebook` | experimental | not_added | Navegador | `search`, `profile` |
| `instagram` | experimental | not_added | Navegador | `search`, `profile`, `posts` |
| `reddit` | optional | not_added | Navegador | `search`, `read`, `subreddit` |
| `xiaohongshu` | optional | not_added | Navegador | `search`, `read`, `comments` |
| `linkedin` | optional | not_added | Navegador | `jobs`, `read` |
| `boss` | optional | not_added | Navegador | `search`, `read` |
| `xueqiu` | optional | not_added | Navegador | `quote`, `search`, `hot_posts`, `hot_stocks` |
| `xiaoyuzhou` | optional | not_added | No | `transcribe` |

Herramientas detectadas: `bili-cli 0.6.2`, `cloakbrowser 0.6.3`.

### 4.2 Uso por canal (ver `docs/source-policy.md` §5)

| Canal | Uso | Frecuencia | Fallback |
|-------|-----|------------|----------|
| `github` | Descubrimiento/contexto complementario | 6 h | GitHub API |
| `youtube` | Tendencias/vídeos técnicos | 6 h | RSS/web |
| `web` | Lectura de páginas/documentación | Bajo demanda | No aplica |
| `reddit` | Descubrimiento comunitario | 6 h | Omitir |
| `v2ex` | Descubrimiento comunitario | 6 h | Omitir |

### 4.3 Reglas de ejecución (ver `docs/source-policy.md` §5.3)

- Subprocess con timeout 60 s.
- Sin shell interactivo; argumentos en lista, no concatenados.
- Salida esperada: JSON. Si no es JSON, registrar error y no interpretar.
- Concurrencia máxima: 1 proceso Agent Reach a la vez.
- No se ejecutan comandos de escritura (`login`, `add`, `remove`, `update`) desde el worker.

### 4.4 Riesgos

- Canales `not_added` no instalados: no asumir que funcionan; degradar graceful.
- Canales `unverified`: requieren `agent-reach check <canal>` con red (máximo 1 por canal cada 6 h, solo si se autoriza).
- Canales experimentales (`twitter`, `facebook`, `instagram`): no priorizados; no usar en v1.

---

## 5. Otras fuentes gratuitas compatibles (solo si verificables)

Ninguna adicional verificada más allá de GitHub API, RSS/Atom y Agent Reach. Las fuentes opcionales de Agent Reach (`reddit`, `linkedin`, `xiaohongshu`, `boss`, `xueqiu`, `xiaoyuzhou`, `twitter`, `facebook`, `instagram`) están `not_added` o `experimental`; no se incluyen hasta que se instalen y verifiquen con autorización previa.

---

## 6. Matriz resumen: URL, método, datos, límites, frecuencia, riesgos

| Fuente | URL / acceso | Método | Datos que aporta | Límites conocidos | Frecuencia recomendada | Riesgos |
|--------|-------------|--------|------------------|-------------------|------------------------|---------|
| GitHub REST API | `https://api.github.com` | HTTPS GET, token opcional en `TECHPULSE_GITHUB_TOKEN` | Repos, metadatos, licencia, topics, README, actividad | ~60 req/h REST sin token; ~5,000 con token; ~10 req/min search sin token; ~30 con token (típicos, verificar en runtime) | Búsqueda 240 min; detalle 720 min; README 360 min | Rate limit, 403/429, campos ausentes (`NULL`), no inventar URLs |
| RSS/Atom | Lista en `feeds.md` | HTTPS GET condicional (ETag/Last-Modified) | Título, resumen, URL, autor, fecha, GUID | 5 MB máx; 100 items/feed; timeout 15 s | 60–180 min según tipo | Feed eliminado (404/410), XML inválido, no scrapeo completo |
| Agent Reach `github` | CLI `agent-reach github search/read` | Subprocess JSON, timeout 60 s | Repos y código (backend `gh`, `github-api`) | 1 proceso a la vez | 6 h | Canal no disponible → fallback a GitHub API |
| Agent Reach `youtube` | CLI `agent-reach youtube search/read/subtitle` | Subprocess JSON, timeout 60 s (backend `yt-dlp`, `whisper`) | Vídeos, títulos, subtítulos | `transcribe` usa cuota Groq/OpenAI Whisper | 6 h | Cuota de transcripción, canal no disponible → RSS/web |
| Agent Reach `web` | CLI `agent-reach web search/read` | Subprocess JSON, timeout 60 s (backend `exa`, `jina`) | Búsqueda web, lectura de páginas | 1 proceso a la vez | Bajo demanda | Dependencia de backends externos (Exa/Jina) |
| Agent Reach `bilibili` | CLI `agent-reach bilibili ...` | Subprocess JSON (backend `bili-cli`, `bilibili-api`) | Vídeos, subtítulos (regional CN) | Login de sesión requerido, no logueado | 6 h | `unverified`; requiere `check` con red |
| Agent Reach `v2ex` | CLI `agent-reach v2ex hot/node/read/user` | Subprocess JSON (backend `v2ex-api`) | Temas, nodos, respuestas (regional CN) | — | 6 h | `unverified`; requiere `check` con red |

---

## 7. Reglas de inclusión / exclusión

- Incluir solo fuentes gratuitas, sin pago y sin login obligatorio para el uso básico.
- No incluir feeds que requieran autenticación, pago o que violen ToS.
- No hacer scraping agresivo; respetar `Retry-After`, cabeceras de rate limit y timeouts.
- Si un dato no está en la fuente, guardar `NULL`; nunca inventar repositorios, URLs, métricas, licencias ni fechas.
- Cada fuente debe tener trazabilidad: `source_key`, `external_id`, `fetched_at` y metadata.
