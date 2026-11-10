# TechPulse — Feeds RSS/Atom iniciales (research/feeds.md)

- **Estado**: propuesto (entregable de la fase F1 — Research, tarea R1.3).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Contrato de referencia**: `docs/source-policy.md` §4 (feeds), `docs/data-model.md` (entidad `news_items`), `docs/api-contract.md` §8 (noticias).
- **Regla**: solo feeds gratuitos, sin login, sin pago, que no violen ToS. No se inventa ningún feed. Cada feed fue verificado el 2026-11-09 con `webfetch` (la URL responde y devuelve XML RSS/Atom parseable).
- **Total**: 16 feeds verificados (dentro del rango 15–20 requerido).

---

## 1. Lista de feeds (16 verificados)

| # | Nombre | URL | Categoría | Idioma | Frecuencia recomendada | Prioridad | Estado |
|---|--------|-----|-----------|--------|------------------------|-----------|--------|
| 1 | Hacker News | https://news.ycombinator.com/rss | Noticias tech / desarrollo | en | 60 min (alta) | Alta | Verificado |
| 2 | The GitHub Blog | https://github.blog/feed/ | Desarrollo / GitHub / IA | en | 120 min (blog técnico) | Alta | Verificado |
| 3 | Hugging Face Blog | https://huggingface.co/blog/feed.xml | IA / ML / modelos | en | 60 min (alta) | Alta | Verificado |
| 4 | TechCrunch | https://techcrunch.com/feed/ | Noticias tech / startups | en | 60 min (alta) | Alta | Verificado |
| 5 | The Verge | https://www.theverge.com/rss/index.xml | Noticias tech / cultura | en | 120 min (blog técnico) | Media | Verificado |
| 6 | Ars Technica | https://arstechnica.com/feed/ | Noticias tech / ciencia / seguridad | en | 120 min (blog técnico) | Media | Verificado |
| 7 | MIT Technology Review | https://www.technologyreview.com/feed/ | IA / tecnología / política | en | 120 min (blog técnico) | Media | Verificado |
| 8 | WIRED | https://www.wired.com/feed/rss | Noticias tech / ciencia / cultura | en | 120 min (blog técnico) | Media | Verificado |
| 9 | arXiv cs.AI | https://export.arxiv.org/rss/cs.AI | IA (papers científicos) | en | 180 min (bajo volumen) | Media | Verificado |
| 10 | Towards Data Science | https://towardsdatascience.com/feed | IA / ML / Data Science | en | 120 min (blog técnico) | Alta | Verificado |
| 11 | HackerNoon | https://hackernoon.com/feed | Desarrollo / tech / herramientas | en | 120 min (blog técnico) | Media | Verificado |
| 12 | Microsoft for Developers | https://devblogs.microsoft.com/feed/ | Desarrollo / herramientas / IA | en | 120 min (blog técnico) | Alta | Verificado |
| 13 | AWS Machine Learning Blog | https://aws.amazon.com/blogs/machine-learning/feed/ | IA / Data Engineering / Cloud | en | 120 min (blog técnico) | Alta | Verificado |
| 14 | TensorFlow Blog | https://blog.tensorflow.org/feeds/posts/default | ML / Data Engineering | en | 180 min (bajo volumen) | Media | Verificado |
| 15 | Kubernetes Blog | https://kubernetes.io/feed.xml | Data Engineering / infra / orquestación | en | 180 min (bajo volumen) | Media | Verificado |
| 16 | Anaconda Blog | https://www.anaconda.com/blog/feed | Data Science / Python | en | 180 min (bajo volumen) | Media | Verificado |

---

## 2. Detalle por feed

### 1. Hacker News
- **URL**: https://news.ycombinator.com/rss
- **Formato**: RSS 2.0
- **Categoría**: noticias tech / desarrollo
- **Idioma**: en
- **Frecuencia recomendada**: 60 min (alta prioridad)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: feed agregador de enlaces votados por la comunidad; muy relevante para detectar repos y herramientas nuevas.

### 2. The GitHub Blog
- **URL**: https://github.blog/feed/
- **Formato**: RSS 2.0 (WordPress)
- **Categoría**: desarrollo / GitHub / IA
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: fuente oficial de GitHub; útil para anuncios de producto, Copilot, Actions, etc.

### 3. Hugging Face Blog
- **URL**: https://huggingface.co/blog/feed.xml
- **Formato**: RSS 2.0
- **Categoría**: IA / ML / modelos
- **Idioma**: en
- **Frecuencia recomendada**: 60 min (alta prioridad)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: anuncios de modelos, datasets, espacios, transformers, diffusers; muy relevante para la categoría `ai` / `machine_learning`.

### 4. TechCrunch
- **URL**: https://techcrunch.com/feed/
- **Formato**: RSS 2.0 (WordPress)
- **Categoría**: noticias tech / startups / IA
- **Idioma**: en
- **Frecuencia recomendada**: 60 min (alta prioridad)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: noticias de startups, financiación, lanzamientos de IA.

### 5. The Verge
- **URL**: https://www.theverge.com/rss/index.xml
- **Formato**: Atom
- **Categoría**: noticias tech / cultura
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: cobertura de tecnología de consumo y empresas tecnológicas.

### 6. Ars Technica
- **URL**: https://arstechnica.com/feed/
- **Formato**: RSS 2.0
- **Categoría**: noticias tech / ciencia / seguridad
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Nota**: el `atom:link` apunta a `https://arstechnica.com/feed/`; la URL consultada fue esa y respondió.

### 7. MIT Technology Review
- **URL**: https://www.technologyreview.com/feed/
- **Formato**: RSS 2.0 (WordPress)
- **Categoría**: IA / tecnología / política
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: análisis de IA, política tecnológica, clima y energía.

### 8. WIRED
- **URL**: https://www.wired.com/feed/rss
- **Formato**: RSS 2.0
- **Categoría**: noticias tech / ciencia / cultura
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: profundidad en ciencia, seguridad, IA y cultura digital.

### 9. arXiv cs.AI
- **URL**: https://export.arxiv.org/rss/cs.AI
- **Formato**: RSS 2.0
- **Categoría**: IA (papers científicos)
- **Idioma**: en
- **Frecuencia recomendada**: 180 min (bajo volumen)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: papers de Inteligencia Artificial; canal de bajo volumen (arXiv salta fines de semana). Útil para detectar novedades de investigación.

### 10. Towards Data Science
- **URL**: https://towardsdatascience.com/feed
- **Formato**: RSS 2.0
- **Categoría**: IA / ML / Data Science
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: artículos prácticos de ML, data science, agentes, LLMs; muy relevante para `data_science` y `machine_learning`.

### 11. HackerNoon
- **URL**: https://hackernoon.com/feed
- **Formato**: RSS 2.0
- **Categoría**: desarrollo / tech / herramientas
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: artículos de desarrolladores; incluye desarrollo, IA, blockchain, etc.

### 12. Microsoft for Developers
- **URL**: https://devblogs.microsoft.com/feed/
- **Formato**: RSS 2.0 (WordPress)
- **Categoría**: desarrollo / herramientas / IA
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: anuncios de herramientas de desarrollo, Copilot, Azure, .NET, TypeScript.

### 13. AWS Machine Learning Blog
- **URL**: https://aws.amazon.com/blogs/machine-learning/feed/
- **Formato**: RSS 2.0
- **Categoría**: IA / Data Engineering / Cloud
- **Idioma**: en
- **Frecuencia recomendada**: 120 min (blog técnico)
- **Prioridad**: alta
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: arquitectura de IA en la nube, AgentCore, Bedrock, SageMaker; relevante para Data Engineering e IA.

### 14. TensorFlow Blog
- **URL**: https://blog.tensorflow.org/feeds/posts/default
- **Formato**: Atom (Blogger)
- **Categoría**: ML / Data Engineering
- **Idioma**: en
- **Frecuencia recomendada**: 180 min (bajo volumen)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: publicaciones espaciadas (última entrada de 2025 en el momento de la verificación); feed válido pero bajo volumen.

### 15. Kubernetes Blog
- **URL**: https://kubernetes.io/feed.xml
- **Formato**: RSS 2.0 (Hugo)
- **Categoría**: Data Engineering / infra / orquestación
- **Idioma**: en
- **Frecuencia recomendada**: 180 min (bajo volumen)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: anuncios de Kubernetes, SIGs, IA en Kubernetes (AI Conformance), orquestación.

### 16. Anaconda Blog
- **URL**: https://www.anaconda.com/blog/feed
- **Formato**: RSS 2.0
- **Categoría**: Data Science / Python
- **Idioma**: en
- **Frecuencia recomendada**: 180 min (bajo volumen)
- **Prioridad**: media
- **Estado**: Verificado (2026-11-09, responde y parseable)
- **Notas**: feed de comentarios del blog (canal válido, bajo volumen); relevante para Data Science y Python.

---

## 3. Feeds descartados al verificar (no se incluyen)

| Feed | URL probada | Resultado | Motivo |
|------|-------------|-----------|--------|
| OpenAI Blog | https://openai.com/blog/rss | 404 | URL no disponible; no incluir |
| PyTorch Blog | https://pytorch.org/blog/rss.xml | 404 | URL no disponible; no incluir |
| InfoQ | https://www.infoq.com/articles/feed/ | 404 | URL no disponible; no incluir |
| DZone | https://dzone.com/feeds/all | 403 | Acceso denegado; no incluir |
| Apache Airflow blog | https://airflow.apache.org/blog/feed.xml | 404 | URL no disponible; no incluir |
| dbt blog | https://www.getdbt.com/blog/feed.xml | 404 | URL no disponible; no incluir |

---

## 4. Reglas de ingestión (ver `docs/source-policy.md` §4)

### 4.1 Frecuencia por tipo de feed

| Tipo de feed | Default | Mínimo | Máximo |
|--------------|---------|--------|--------|
| Noticias de alta prioridad | 60 min | 30 min | 360 min |
| Blogs técnicos | 120 min | 60 min | 720 min |
| Feeds de bajo volumen | 180 min | 60 min | 1440 min |

### 4.2 Fetch

- `GET` con `User-Agent: TechPulse/0.1 (+local)`.
- `If-None-Match` / `If-Modified-Since` si el feed soporta ETag/Last-Modified.
- Timeout 15 s; tamaño máximo 5 MB; máximo 100 items por feed por ejecución.
- Seguir redirecciones (máx. 5). No usar cookies ni sesiones.

### 4.3 Parsing y deduplicación

- Título, resumen, URL, autor, fecha, GUID.
- Si falta fecha: `published_at = NULL` y se usa `fetched_at` para ordenar.
- Si falta GUID: `external_id = sha256(canonical_url)`.
- `url_hash = SHA-256(canonical_url)`; `UNIQUE(url_hash)` (ver `docs/data-model.md` §6.2).
- Si la misma URL llega desde otro feed, se agrega a `news_item_sources`; no se duplica la noticia.
- `summary` se limpia de HTML peligroso; se conserva texto plano.
- `raw_json` se guarda para auditoría, con límite de tamaño.

### 4.4 Errores

| Situación | Acción |
|-----------|--------|
| 200 | Parsear |
| 304 | Sin cambios; actualizar `last_success_at` |
| 301/302 | Seguir redirección |
| 404/410 | Feed eliminado; deshabilitar tras 3 fallos consecutivos |
| 403/429 | Backoff; respetar `Retry-After` |
| XML inválido | Registrar `parse_error`; no reintentar más de 2 veces |
| Timeout | Reintentar |

---

## 5. Clasificación de noticias (ver `docs/source-policy.md` §15.3)

Fórmula de importancia:

```
importance = 0.35 * source_weight
          + 0.35 * recency
          + 0.20 * keyword_score
          + 0.10 * category_relevance
```

- `source_weight`: peso del feed (0..1; default 0.5).
- `recency`: 1.0 si publicado <= 6 h; 0.8 si <= 24 h; 0.5 si <= 72 h; 0.2 si <= 7 d; 0.0 en otro caso.
- `keyword_score = min(1, coincidencias / 5)` sobre términos de alta señal.
- `category_relevance = 1.0` si la categoría está en intereses del usuario, si no 0.5.

Etiquetas: `high` si >= 0.75; `medium` si >= 0.45; `low` en otro caso.

Términos de alta señal (conteo, no ponderación): `release`, `launch`, `lanzamiento`, `vulnerability`, `CVE`, `breach`, `acquisition`, `funding`, `open source`, `model`, `agent`, `framework`, `API`, `deprecation`, `security`.

---

## 6. Riesgos

- Feeds que requieran autenticación, pago o que violen ToS: no incluirse.
- No scrapeo del artículo completo si el feed no lo incluye.
- Feed eliminado (404/410): deshabilitar tras 3 fallos consecutivos.
- Campos ausentes (`NULL`): nunca inventar título, URL ni fecha.

---

## 7. Decisiones que necesita el Coordinador

1. ¿Se aprueban estos 16 feeds como lista inicial para `sources` (`kind='rss'`)?
2. ¿Se añaden más feeds en español (p. ej. blogs técnicos locales)? Actualmente todos son en inglés; no se verificaron feeds en español por no tener URLs candidatas verificables.
3. ¿Se ajustan los intervalos por defecto (60/120/180 min)?
4. ¿Se define el `source_weight` por feed para el cálculo de importancia?
