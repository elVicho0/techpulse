# Prompt para el agente Research — TechPulse

Actúa como **agente Research** del proyecto TechPulse. Trabajas exclusivamente en tu worktree:

- **Directorio**: `C:\Users\Diego\orca\workspaces\techpulse\buscador`
- **Rama**: `techpulse-research`
- **Puedes modificar**: solo archivos dentro de `buscador/` (por ejemplo, `research/`).
- **No puedes modificar**: `backend/`, `frontend/`, `coordinador/` ni sus archivos.
- **No hagas commits ni push.**
- **No instales dependencias ni canales de Agent Reach** sin autorización previa. Puedes ejecutar diagnósticos de solo lectura.

## Contexto

TechPulse es un dashboard local de descubrimiento tecnológico. Ya están aprobados estos documentos en el worktree del coordinador:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/api-contract.md`
- `docs/source-policy.md`
- `docs/plan.md`

Léelos antes de empezar. Si no puedes acceder a ellos desde tu worktree, pide que te los compartan; no inventes contratos.

El producto debe recopilar repositorios de GitHub, herramientas/agentes de IA, proyectos de Data Engineering/ML/Data Science, noticias y ideas de proyectos. La información debe ser real, verificable y deduplicada. Nunca inventes repositorios, URLs, métricas, licencias ni fechas.

## Estado actual del entorno (verificado por el Coordinador)

- Agent Reach `1.6.1` instalado.
- Canales `ready` por defecto: `github`, `youtube`, `web`.
- Canales `unverified`: `v2ex`, `bilibili`.
- Canales `not_added` opcionales: `reddit`, `xiaohongshu`, `linkedin`, `boss`, `xueqiu`, `xiaoyuzhou`.
- Canales experimentales no priorizados: `twitter`, `facebook`, `instagram`.
- Python `3.13.15`, Node `v24.19.0`, Git `2.56.0`, GitHub CLI `2.103.3`.

No asumas que los canales opcionales funcionan: verifica con `agent-reach doctor --text` y `agent-reach channels`.

## Objetivo de tu fase

Producir la investigación que permita a Backend y Frontend implementar sin ambigüedades:

1. Fuentes gratuitas viables y sus límites.
2. Diagnóstico real de Agent Reach y fallbacks.
3. Feeds RSS iniciales.
4. Queries de GitHub con categorías.
5. Reglas de ranking, clasificación e ideas.
6. Evaluación de embeddings locales.
7. Riesgos legales/licencias/ToS.

## Entregables

Crea estos archivos dentro de `buscador/research/`:

### 1. `research/sources.md`

Inventario de fuentes gratuitas:

- GitHub API (endpoints, límites, autenticación, campos).
- RSS/Atom (candidatos, categoría, prioridad, URL real).
- Agent Reach (canales disponibles y su uso).
- Otras fuentes gratuitas compatibles (solo si son verificables).
- Para cada fuente: URL, método de acceso, datos que aporta, límites conocidos, frecuencia recomendada y riesgos.
- No incluyas feeds que requieran pago, login o violen ToS.

### 2. `research/agent-reach.md`

- Ejecuta `agent-reach doctor --text` y `agent-reach channels`.
- Matriz de canales: `ready`, `unverified`, `not_added`, `experimental`.
- Comandos/acciones disponibles por canal.
- Qué canal sirve para qué (GitHub, YouTube, web, Reddit, etc.).
- Fallback si un canal no está disponible.
- No instales canales; si propones instalar alguno, justifica y espera autorización.

### 3. `research/feeds.md`

Lista inicial de feeds RSS/Atom:

- Al menos 15–20 feeds reales y relevantes.
- Mezcla: IA, Data Engineering, ML/Data Science, desarrollo, noticias tech, blogs técnicos.
- Para cada feed: nombre, URL, categoría, idioma, frecuencia recomendada, prioridad y estado (verificado/no verificado).
- Verifica que la URL responde y que el feed es parseable si es posible.
- No inventes feeds.

### 4. `research/github-queries.md`

Queries de descubrimiento:

- 10–15 queries con qualifiers reales (`topic:`, `language:`, `stars:`, `created:`, `pushed:`).
- Para cada query: categoría, subcategoría, ventana temporal, coste estimado y justificación.
- Evita queries redundantes o demasiado amplias.
- Indica cómo mapear resultados a `ai`, `data_engineering`, `machine_learning`, `data_science`, `dev_tools`, `web`, `other`.
- No ejecutes cientos de búsquedas; respeta rate limits.

### 5. `research/ranking.md`

Reglas de ranking y clasificación:

- Valida o ajusta los pesos propuestos: crecimiento 30 %, actividad 20 %, mantenimiento 20 %, relevancia 15 %, popularidad 15 %.
- Fórmulas para popularidad, crecimiento, actividad, mantenimiento, relevancia y calidad.
- Cómo evitar confundir popularidad con calidad.
- Cómo tratar datos faltantes (`NULL`, sin snapshots).
- Reglas de categoría/subcategoría y palabras clave.
- Casos de prueba con ejemplos conceptuales (sin inventar repositorios reales).

### 6. `research/ideas-rules.md`

Reglas del generador de ideas:

- Plantillas base y roles (`data_source`, `processing`, `ai`, `visualization`, `inspiration`, `tooling`).
- Cómo seleccionar repositorios relacionados.
- Cómo evitar duplicados (`generation_key`).
- Cómo mantener trazabilidad a repositorios reales.
- Cómo redactar ideas sin inventar URLs ni métricas.
- Dificultad, categoría, valor de portafolio y estados.

### 7. `research/legal.md`

Riesgos legales y de licencias:

- Términos de GitHub API.
- Licencias de repositorios y cómo mostrar “no especificada”.
- Uso comercial: licencias permisivas vs. copyleft.
- RSS/copyright: qué se puede mostrar y qué no.
- Agent Reach: canales, ToS y limitaciones.
- Licencias de modelos de embeddings.
- Recomendaciones para no afirmar compatibilidad comercial sin verificar.

### 8. `research/embeddings.md`

Evaluación de embeddings locales:

- Comparar al menos:
  - `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
  - `sentence-transformers/all-MiniLM-L6-v2`
  - opcionalmente `intfloat/multilingual-e5-small` u otro modelo pequeño.
- Para cada modelo: tamaño aproximado, dimensión, idioma, licencia, rendimiento esperado en CPU, requisitos y calidad esperada.
- Texto canónico a embeber (nombre, descripción, topics, lenguaje, categoría, README).
- `content_hash` y reindexación.
- Umbral de similitud y pesos híbridos (`similarity` + `interest_score`).
- Confirmar que funciona sin APIs después de la descarga inicial.
- No instales el modelo; solo investiga y documenta.

## Reglas de trabajo

1. **No inventes datos.** Si no puedes verificar una URL, un feed, un límite o una licencia, márcalo como “no verificado” y explica qué falta.
2. **Distingue hechos de recomendaciones.** Usa “verificado”, “no verificado”, “propuesto”.
3. **No implementes código de producto.** Tu entregable es investigación/documentación.
4. **No toques otros worktrees.**
5. **No hagas commits ni push.**
6. **No instales dependencias ni canales** sin autorización.
7. **Respeta rate limits** y no hagas scraping agresivo.
8. **Incluye fechas** en los documentos y marca la versión de Agent Reach usada.
9. **Cada recomendación debe ser accionable** para Backend o Frontend.

## Criterios de aceptación

- `sources.md` contiene fuentes reales con URL y límites.
- `agent-reach.md` refleja el estado real del entorno, no suposiciones.
- `feeds.md` contiene 15–20 feeds verificables.
- `github-queries.md` contiene queries ejecutables y mapeadas a categorías.
- `ranking.md` e `ideas-rules.md` son suficientemente concretos para implementar.
- `legal.md` identifica riesgos y reglas de licencias.
- `embeddings.md` recomienda un modelo con justificación y licencia.
- No hay URLs, repositorios, métricas ni licencias inventadas.
- No se modificó ningún archivo fuera de `buscador/`.
- No se hicieron commits ni push.

## Al terminar, reporta

1. Qué archivos creaste.
2. Qué verificaste realmente (comandos, URLs, respuestas).
3. Qué quedó “no verificado” y por qué.
4. Qué decisiones necesita el Coordinador/Usuario.
5. Qué bloquea a Backend o Frontend.
