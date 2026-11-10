# TechPulse — Arquitectura general

- **Estado**: propuesto, pendiente de aprobación.
- **Autor**: Coordinador.
- **Fecha**: 2026-11-09.
- **Alcance**: arquitectura de la v1 local para Windows y contratos de alto nivel entre agentes.

## 1. Resumen ejecutivo

TechPulse es una aplicación de escritorio **local y persistente** que recopila, normaliza, clasifica y presenta información tecnológica: repositorios de GitHub, herramientas y agentes de IA, proyectos de Data Engineering/ML/Data Science, noticias y ideas de proyectos generadas a partir de repositorios reales.

La arquitectura separa cuatro responsabilidades:

1. **UI de escritorio** (Tauri + React): presentación, filtros, navegación y acciones del usuario.
2. **API local** (FastAPI): lectura/escritura de datos de producto y encolado de trabajos.
3. **Worker independiente** (Python): ingesta, normalización, deduplicación, scoring, verificación de enlaces y generación de ideas.
4. **SQLite**: única fuente de verdad persistente.

La UI y la API no ejecutan tareas largas de red. El worker puede seguir trabajando con la ventana cerrada, siempre que su proceso esté activo.

## 2. Objetivos y no objetivos

### Objetivos de la v1

- Descubrir repositorios y noticias desde fuentes gratuitas y verificables.
- Persistir todo y sobrevivir reinicios sin pérdida de datos.
- Actualizar automáticamente con intervalos configurables y razonables.
- Evitar duplicados y respetar límites de APIs.
- Mostrar fichas completas con enlaces reales, procedencia y explicaciones deterministas.
- Generar ideas de proyectos trazables a repositorios existentes.
- Funcionar en Windows sin depender de servicios cloud de pago.

### No objetivos de la v1

- Multiusuario, autenticación remota o sincronización en la nube.
- Aplicación móvil o web pública.
- Generación de contenido con IA de pago como requisito.
- Scraping agresivo o elusión de paywalls/ToS.
- Edición colaborativa en tiempo real.
- Base de datos PostgreSQL local.

## 3. Decisiones de arquitectura (resumen tipo ADR)

| ID | Decisión | Estado |
|---|---|---|
| ADR-001 | Tauri 2 + React + TypeScript + Vite para la UI | Propuesta |
| ADR-002 | FastAPI + Uvicorn como API local en `127.0.0.1` | Propuesta |
| ADR-003 | SQLite en modo WAL como persistencia única | Propuesta |
| ADR-004 | Worker Python independiente con APScheduler | Propuesta |
| ADR-005 | Cola de trabajos manuales en SQLite (`job_requests`) | Propuesta |
| ADR-006 | GitHub REST API como fuente primaria de GitHub | Propuesta |
| ADR-007 | Agent Reach como fuente complementaria, no única | Propuesta |
| ADR-008 | Resúmenes deterministas por defecto; LLM opcional | Propuesta |
| ADR-009 | Sin autenticación en v1; solo loopback + CORS restringido | Propuesta |
| ADR-010 | Contrato HTTP versionado en `/api/v1` | Propuesta |
| ADR-011 | Embeddings locales vía sidecar `sentence-transformers` | Propuesta |

Las decisiones que requieren aprobación explícita se listan en la sección 15.

## 4. Stack tecnológico y justificación

### 4.1 UI de escritorio: Tauri 2 + React + TypeScript + Vite

**Motivos:**

- Tauri produce binarios nativos ligeros en Windows y usa WebView2, ya presente en Windows moderno.
- React + TypeScript permite construir una UI moderna, con componentes reutilizables y tipado estricto contra el contrato de API.
- Vite ofrece desarrollo rápido y build simple.
- El ecosistema permite implementar el estilo visual solicitado (dark mode, sidebar, tarjetas, gráficos, filtros) sin una plantilla genérica.

**Alternativas descartadas:**

- **Electron**: mayor peso y consumo de memoria; no aporta ventajas para una app local personal.
- **Aplicación web servida en navegador**: no cumple la experiencia de aplicación de escritorio ni el control de ventana/bandeja.
- **WinUI/WPF**: mayor coste de desarrollo de UI moderna y menor portabilidad futura.

### 4.2 API local: Python 3.13 + FastAPI + Uvicorn

**Motivos:**

- Python encaja con ingesta, parsing RSS/HTML, análisis de datos y ejecución de Agent Reach por subprocess.
- FastAPI ofrece validación con Pydantic, documentación OpenAPI automática y buen rendimiento para una app local.
- Permite compartir modelos/validaciones entre API y worker dentro del mismo paquete Python.

**Alternativas descartadas:**

- **Node/Express**: válido, pero obligaría a duplicar lógica de ingesta en otro runtime o a usar JavaScript para todo el backend.
- **Rust puro**: excelente rendimiento, pero mayor coste de desarrollo para la v1.

### 4.3 Persistencia: SQLite

**Motivos:**

- Aplicación personal, monousuario y local.
- Cero administración, backups por copia de archivo, persistencia fiable.
- WAL permite lecturas concurrentes mientras el worker escribe.
- Volumen esperado (miles de repos, noticias y snapshots) está muy por debajo de los límites prácticos de SQLite.

**PostgreSQL local queda descartado para la v1** porque añade instalación, servicio, credenciales y mantenimiento sin beneficio claro para un usuario único. El acceso a datos se encapsula en una capa de repositorio para facilitar una migración futura si el producto cambia de escala.

**Configuración obligatoria de la conexión:**

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

### 4.4 Worker: Python + APScheduler

**Motivos:**

- Permite ejecutar jobs periódicos con intervalos, jitter y control de concurrencia.
- Puede correr como proceso independiente sin servidor HTTP.
- La cola de trabajos manuales vive en SQLite; el worker la sondea cada 2 segundos.
- El estado y los errores quedan auditables en `source_runs` y `job_requests`.

**Alternativa considerada:** Windows Task Scheduler invocando un script por fuente. Se descarta como mecanismo principal porque complica el estado, la concurrencia y los reintentos. Se documentará como opción de arranque del worker, no como scheduler interno.

### 4.5 Integraciones

- **GitHub REST API v3**: fuente primaria para repositorios, metadatos, licencia y actividad.
- **RSS/Atom**: fuente primaria para noticias y blogs técnicos.
- **Agent Reach CLI**: capa complementaria para canales no cubiertos por API/RSS (YouTube, web, GitHub como apoyo) y para lectura de páginas cuando aporte valor.
- **Embeddings locales**: `sentence-transformers` ejecutado en un sidecar local; búsqueda semántica y “repos similares” sin APIs externas. El modelo se descarga una vez y luego funciona offline.
- **LLM**: opcional, deshabilitado por defecto; nunca requisito para funciones básicas.

### 4.6 Embeddings locales y búsqueda semántica

**Objetivo:** responder “busca algo parecido a este repo” y permitir búsqueda en lenguaje natural sin enviar datos a la nube.

**Diseño propuesto:**

- **Sidecar `techpulse-embeddings`**: proceso Python independiente que carga el modelo `sentence-transformers` una sola vez y expone una API HTTP mínima en `127.0.0.1:8766`.
- **Worker**: calcula embeddings de repositorios en lotes y los persiste en SQLite.
- **API**: consulta al sidecar para embeddings de consultas y para el estado del modelo; no carga el modelo pesado.
- **SQLite**: tabla `repository_embeddings` con vector `float32` en BLOB y `content_hash`.
- **Búsqueda**: similitud coseno con NumPy sobre los vectores almacenados. Para miles de repositorios es suficiente; `sqlite-vec` queda como optimización futura.
- **Fallback**: si el sidecar o el modelo no están disponibles, la búsqueda por metadatos sigue funcionando. El modo semántico explícito devuelve `503 EMBEDDINGS_UNAVAILABLE`; el modo híbrido degrada a metadatos.

**Modelo:**

- Default propuesto: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (multilingüe, ~470 MB).
- Alternativa ligera: `sentence-transformers/all-MiniLM-L6-v2` (~80 MB, principalmente inglés).
- El modelo se descarga una vez desde Hugging Face; después no se requiere red.
- La licencia del modelo debe verificarse en su model card antes de distribuirlo.

**Dependencias previstas:** `sentence-transformers`, `torch` (CPU) y `numpy`. Son pesadas; se instalarán solo si el usuario habilita la función. No se instalan en esta fase.

## 5. Diagrama de componentes

```text
┌──────────────────────────────── Windows ─────────────────────────────────┐
│                                                                           │
│  ┌──────────────────────────┐   HTTP/JSON   ┌─────────────────────────┐  │
│  │ Tauri 2 + React + TS     │ ────────────► │ FastAPI                 │  │
│  │ (WebView2)               │ ◄──────────── │ 127.0.0.1:8765          │  │
│  └────────────┬─────────────┘               └───────────┬─────────────┘  │
│               │ abre enlaces                            │ lee/escribe    │
│               ▼                                         ▼                │
│      Navegador del sistema                     ┌──────────────────────┐  │
│                                                │ SQLite (WAL)         │  │
│  ┌──────────────────────────┐                  │ techpulse.db         │  │
│  │ Worker Python            │ ───────────────► └──────────────────────┘  │
│  │ APScheduler + jobs       │ ◄───────────────                           │
│  └───────┬──────────┬───────┘                                           │
│          │          │                                                    │
│          │          └──HTTP──► ┌──────────────────────────────────────┐  │
│          │                     │ techpulse-embeddings (sidecar)       │  │
│          │                     │ 127.0.0.1:8766                       │  │
│          │                     │ sentence-transformers (CPU, local)   │  │
│          │                     └──────────────────────────────────────┘  │
│          │                                     ▲                        │
│          │                                     │ HTTP (query embedding) │
│          │                                     │                        │
│          ├── GitHub REST API                   │                        │
│          ├── Feeds RSS/Atom                    │                        │
│          ├── Agent Reach CLI (subprocess)      │                        │
│          └── Verificación HTTP de enlaces      │                        │
│                                                │                        │
│  FastAPI ──────────────────────────────────────┘                        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## 6. Procesos y ciclo de vida

### 6.1 Procesos

| Proceso | Responsabilidad | ¿Puede vivir sin la UI? |
|---|---|---|
| `techpulse-api` | Servir `/api/v1`, validar entrada, escribir acciones de usuario y encolar jobs | Sí, pero la UI no puede cargar datos sin él |
| `techpulse-worker` | Ingesta, normalización, dedup, scoring, ideas, verificación de enlaces y cálculo de embeddings | **Sí** |
| `techpulse-embeddings` | Cargar el modelo local y servir embeddings por loopback | **Sí** (opcional; si falta, se desactiva lo semántico) |
| UI Tauri | Presentación y acciones | No aplica |
| SQLite | Persistencia compartida | No aplica |

### 6.2 Arranque en desarrollo

1. `techpulse-api` arranca en `127.0.0.1:8765`.
2. `techpulse-worker` arranca como proceso separado y adquiere un lease.
3. `techpulse-embeddings` arranca opcionalmente en `127.0.0.1:8766` si la función semántica está habilitada y el modelo está instalado.
4. La UI Tauri arranca en modo dev (`http://localhost:1420`) y consume la API.

### 6.3 Arranque empaquetado (Windows)

- La app Tauri puede lanzar la API como sidecar.
- El worker se lanza como proceso **independiente** (script de inicio o Tarea Programada opcional) y **no se detiene al cerrar la ventana**.
- El sidecar de embeddings se lanza de forma independiente o bajo demanda desde Settings. Si no está activo, la app sigue funcionando con búsqueda por metadatos.
- Si la UI detecta que el worker está offline, muestra un aviso y ofrece un botón para iniciarlo en segundo plano.
- El worker usa un **lease** en SQLite para evitar ejecuciones duplicadas. Un lease sin heartbeat durante más de 30 segundos puede ser reclamado por otro worker.

### 6.4 Cierre

- Cerrar la ventana no debe matar al worker.
- La API puede detenerse con la app; el worker sigue recolectando.
- El sidecar de embeddings puede detenerse si no se usa; la app debe reintentar conectarse cuando vuelva.
- Al reabrir, la UI consulta el estado actual y el historial de runs.

## 7. Comunicación entre componentes

### 7.1 Frontend ↔ API

- Protocolo: HTTP/JSON sobre loopback.
- Base URL: `http://127.0.0.1:8765/api/v1`.
- La UI **nunca** accede directamente a SQLite.
- La UI **nunca** ejecuta conectores ni llamadas a GitHub/RSS/Agent Reach.
- Operaciones largas se encolan y la UI consulta estado; no se bloquea la petición HTTP.
- Formato de fechas: ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SSZ`).
- Formato de errores: ver `docs/api-contract.md`.

### 7.2 API ↔ SQLite

- La API usa la misma capa de acceso a datos que el worker.
- Escrituras cortas y transaccionales.
- La API no ejecuta migraciones en caliente; las migraciones se aplican al arrancar el proceso que corresponda, con bloqueo de migración.
- La API escribe: acciones de usuario, settings, `job_requests`.
- La API lee: todo lo necesario para las vistas.

### 7.3 Worker ↔ SQLite

- El worker es el único proceso que ejecuta ingesta y escribe datos de fuentes.
- También escribe snapshots, scores, ideas, verificaciones de enlaces y `source_runs`.
- La API puede leer mientras el worker escribe gracias a WAL.
- El worker nunca sirve HTTP.

### 7.4 API ↔ Worker

No hay llamada directa. La comunicación es **asíncrona vía SQLite**:

1. La UI llama `POST /sources/{id}/run`.
2. La API inserta una fila `pending` en `job_requests`.
3. El worker sondea `job_requests` cada 2 segundos.
4. El worker reclama la fila, ejecuta el job y actualiza `source_runs`/`job_requests`.
5. La UI consulta `GET /jobs` o `GET /runs`.

Ventaja: si el worker está caído, el pedido no se pierde; queda pendiente y la UI lo informa.

**Excepción controlada:** la generación manual de ideas (`POST /ideas/generate`) es síncrona en la API porque solo usa datos ya almacenados y reglas deterministas, sin red. La generación automática tras una ingesta sigue ejecutándose en el worker.

### 7.5 Worker ↔ fuentes externas

- GitHub API vía HTTPS con token opcional.
- RSS/Atom vía HTTPS con GET condicional.
- Agent Reach vía subprocess CLI, salida JSON, timeout y captura de errores.
- Verificación de enlaces vía HTTP HEAD/GET con timeout.

### 7.6 API/Worker ↔ sidecar de embeddings

- Protocolo: HTTP/JSON sobre `127.0.0.1:8766`.
- El sidecar carga el modelo `sentence-transformers` una sola vez.
- `POST /embed` recibe `{ "texts": ["..."], "model": "..." }` y devuelve vectores `float32` como arrays JSON.
- `GET /health` y `GET /status` informan modelo, dimensiones, dispositivo y estado de carga.
- El sidecar no accede a SQLite ni a fuentes externas.
- Si el sidecar no responde, la API degrada a búsqueda por metadatos y la UI muestra el estado.
- El modelo se descarga una vez; después el sidecar funciona offline.

## 8. Persistencia, configuración y rutas

### 8.1 Rutas en Windows

| Dato | Ruta por defecto | Override |
|---|---|---|
| Base de datos | `%LOCALAPPDATA%\TechPulse\data\techpulse.db` | `TECHPULSE_DB_PATH` |
| Logs | `%LOCALAPPDATA%\TechPulse\logs\` | `TECHPULSE_LOG_DIR` |
| Configuración no secreta | `%LOCALAPPDATA%\TechPulse\config.toml` | `TECHPULSE_CONFIG_PATH` |
| Backups | `%LOCALAPPDATA%\TechPulse\backups\` | `TECHPULSE_BACKUP_DIR` |

### 8.2 Secretos

- El token de GitHub se lee de `TECHPULSE_GITHUB_TOKEN` (variable de entorno) o de un archivo local no versionado.
- Nunca se escribe en logs, respuestas de API ni repositorio.
- `GET /capabilities` solo informa `github_token_configured: true|false`, nunca el valor.
- Las claves de LLM, si se añaden en el futuro, siguen la misma política.

### 8.3 Migraciones

- Tabla `schema_migrations` con versión y fecha.
- Migraciones idempotentes y ordenadas.
- Al arrancar API/worker: si hay migraciones pendientes, se aplican antes de servir/ejecutar.
- Un lock de migración evita que API y worker migren a la vez.

### 8.4 Backups

- Copia diaria opcional del archivo SQLite (incluyendo `-wal`/`-shm` o usando la API de backup de SQLite).
- Retención configurable (por defecto 7 copias).
- Los backups no se versionan en Git.

## 9. Integraciones externas

### 9.1 GitHub API

- **Uso**: búsqueda de repositorios, detalle, README, licencia, topics, actividad.
- **Autenticación**: token opcional; sin token los límites son mucho menores.
- **Rate limits**: se leen de cabeceras `X-RateLimit-*` y se persisten en `rate_limit_state`.
- **Errores**: 403/429 por límite, 404 por repo inexistente, 5xx/red reintentables.
- **Caché**: ETag/Last-Modified cuando el endpoint lo permita.
- **Regla**: no se inventan campos; si la API no devuelve un dato, se almacena `NULL`.

### 9.2 RSS/Atom

- **Uso**: noticias y blogs técnicos.
- **Descubrimiento**: lista de feeds aprobada por Research y configurable.
- **GET condicional**: `ETag`/`If-Modified-Since`.
- **Parsing**: título, resumen, URL canónica, autor, fecha, GUID.
- **Límites**: un request por feed por intervalo; timeout y tamaño máximo.
- **Regla**: solo se usa el contenido del feed; no se scrapea el artículo completo si el feed no lo incluye.

### 9.3 Agent Reach

- **Uso complementario**: canales que no cubren GitHub API/RSS, lectura de páginas y enriquecimiento.
- **Detección**: `agent-reach doctor --text` (sin red) al arrancar y cada 24 h; `agent-reach channels` para capacidades.
- **Ejecución**: subprocess con timeout de 60 s, salida JSON, sin shell interactivo.
- **Canales**: `github`, `youtube`, `web` están disponibles por defecto; los opcionales (`reddit`, etc.) requieren instalación y validación. La app debe degradar si un canal no está disponible.
- **Regla**: Agent Reach complementa, no sustituye, GitHub API ni RSS.

### 9.4 LLM opcional

- Deshabilitado por defecto.
- Si se configura, se usa solo para enriquecer resúmenes/explicaciones; los datos duros siempre provienen de fuentes.
- Si falla o no está configurado, se usan resúmenes deterministas.
- Nunca se envía información sensible ni secretos al modelo.

## 10. Flujo de datos

```text
Fuente (GitHub/RSS/Agent Reach)
        │
        ▼
Conector (fetch + parse + rate limit + cache)
        │
        ▼
Normalizador (modelo canónico, campos nulos explícitos)
        │
        ▼
Deduplicador (github_id / url_hash / generation_key)
        │
        ▼
Persistencia (upsert + snapshots + procedencia)
        │
        ▼
Scoring (popularidad, crecimiento, actividad, mantenimiento, relevancia)
        │
        ▼
Generador de ideas (reglas + repositorios relacionados)
        │
        ▼
API local (lectura/filtros/paginación)
        │
        ▼
UI (dashboard, fichas, saved, ideas, settings)
```

## 11. Seguridad local

- La API escucha **solo** en `127.0.0.1`, nunca en `0.0.0.0`.
- CORS restringido a orígenes de la app:
  - `http://localhost:1420` (dev)
  - `http://127.0.0.1:1420` (dev)
  - `tauri://localhost`
  - `http://tauri.localhost`
- No se aceptan peticiones de orígenes arbitrarios.
- La v1 no implementa autenticación porque el acceso es local; se documenta como riesgo aceptado. Si se expone la API fuera de loopback, se debe añadir token.
- El sidecar de embeddings escucha **solo** en `127.0.0.1:8766`, no acepta orígenes externos y no accede a Internet después de descargar el modelo.
- Enlaces externos: solo `http://` y `https://`; se abren con el plugin `opener` de Tauri con allowlist.
- No hay telemetría ni envío de datos a terceros. Los textos enviados al sidecar de embeddings no salen de la máquina.
- Los secretos nunca se registran ni se devuelven por API.

## 12. Observabilidad y manejo de errores

- Logs estructurados (JSON o clave-valor) con `timestamp`, `level`, `component`, `source_key`, `run_id`, `message`.
- Cada ejecución de fuente crea un registro en `source_runs` con estado, contadores, duración y error.
- Cada job manual crea un registro en `job_requests`.
- `GET /health` informa estado de API, DB y worker.
- `GET /embeddings/status` informa estado del sidecar, modelo, dimensión y progreso del índice.
- Errores de fuente no tumban el worker: se registran y se aplica backoff.
- La UI muestra:
  - última actualización exitosa,
  - estado del worker,
  - estado del modelo de embeddings,
  - último error por fuente,
  - runs recientes.

## 13. Empaquetado y ejecución local en Windows

### Desarrollo

- Backend: entorno virtual Python, `uvicorn` en `127.0.0.1:8765`.
- Worker: proceso Python separado.
- Embeddings: sidecar opcional en `127.0.0.1:8766`; solo si se habilita la función.
- Frontend: `npm run tauri dev` (Vite en `1420`).

### Distribución v1

- Backend/worker empaquetados con PyInstaller (o equivalente) como ejecutables.
- UI Tauri empaquetada como instalador MSI/NSIS.
- La app puede lanzar la API como sidecar.
- El worker se inicia con un script o Tarea Programada; la UI muestra su estado.
- Los datos viven en `%LOCALAPPDATA%`, no dentro del directorio de instalación.

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Rate limit de GitHub | Datos incompletos | Token opcional, caché, intervalos, backoff, presupuesto por run |
| Canales Agent Reach no disponibles | Cobertura reducida | Detección dinámica, fallback a GitHub API/RSS |
| Datos incompletos o ambiguos | Fichas pobres | Campos `NULL` explícitos, UI “no disponible”, nunca inventar |
| Worker no iniciado | No hay actualizaciones | Aviso en UI, botón de inicio, lease/heartbeat |
| Enlaces roto o malicioso | Mala experiencia/seguridad | Verificación HTTP, solo http/https, allowlist Tauri |
| Licencia desconocida | Uso comercial indebido | Mostrar licencia o “No especificada”; no afirmar compatibilidad |
| Crecimiento sin historial | Métrica engañosa | `growth_score`/delta `NULL` hasta tener snapshots suficientes |
| Modelo de embeddings pesado | Instalación/RAM altas | Sidecar opcional, CPU, modelo pequeño, carga bajo demanda |
| Modelo no descargado / sin red | Búsqueda semántica no disponible | Estado visible, fallback a metadatos, descarga manual |
| Indexación costosa en CPU | Worker lento | Lotes, límite por run, job cada 6 h, prioridad a repos nuevos |
| Similitud semántica mal interpretada | Falsas expectativas | Mostrar “similitud”, no “verdad”; combinar con ranking y metadatos |
| Solapamiento de agentes | Conflictos de código | Límites de archivos y contratos aprobados |

## 15. Decisiones pendientes de aprobación

1. **Stack**: Tauri 2 + React + TS + Vite, FastAPI y SQLite.
2. **Proceso worker independiente**: no se detiene al cerrar la ventana; arranque por script/Tarea Programada y botón de inicio desde la UI.
3. **SQLite en lugar de PostgreSQL** para la v1.
4. **API sin autenticación en loopback** en v1, con CORS restringido.
5. **Cola de jobs en SQLite** (`job_requests`) en lugar de llamadas directas API→worker.
6. **GitHub API como fuente primaria** y Agent Reach como complemento.
7. **Resúmenes deterministas por defecto** y LLM opcional.
8. **Pesos iniciales del ranking** (ver `docs/data-model.md` y `docs/source-policy.md`): crecimiento 30 %, actividad 20 %, mantenimiento 20 %, relevancia 15 %, popularidad 15 %.
9. **Intervalos por defecto** (ver `docs/source-policy.md`): GitHub búsqueda 4 h, detalle 12 h, RSS 60–120 min, Agent Reach 6 h.
10. **Puerto local 8765** y ruta de datos en `%LOCALAPPDATA%\TechPulse`.
11. **Embeddings locales con sidecar** en `127.0.0.1:8766` y `sentence-transformers`; modelo multilingüe pequeño por defecto.
12. **Modelo de embeddings**: `paraphrase-multilingual-MiniLM-L12-v2` vs. `all-MiniLM-L6-v2`.
13. **Descarga del modelo**: manual desde Settings (recomendado) vs. automática al habilitar la función.

## 16. Referencias internas

- Modelo de datos: `docs/data-model.md`.
- Contrato de API: `docs/api-contract.md`.
- Política de fuentes: `docs/source-policy.md`.
- Plan de desarrollo: `docs/plan.md`.
