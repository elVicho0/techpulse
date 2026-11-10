# TechPulse â€” DiagnÃ³stico de Agent Reach y fallbacks (research/agent-reach.md)

- **Estado**: propuesto (entregable de la fase F1 â€” Research).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **VersiÃ³n de Agent Reach usada**: `1.6.1` (verificado con `agent-reach doctor --text`).
- **Entorno**: Windows, Python `3.13.15`, Node `v24.19.0`, Git `2.56.0`, GitHub CLI `2.103.3`.
- **Contrato de referencia**: `docs/source-policy.md` Â§5, `docs/architecture.md` Â§9.3, `docs/api-contract.md` Â§5.3/5.4.
- **Regla**: no instalar canales sin autorizaciÃ³n previa; no asumir que los canales opcionales funcionan.

---

## 1. DiagnÃ³stico real ejecutado

Los siguientes comandos se ejecutaron en el worktree `buscador` el 2026-11-09:

### 1.1 `agent-reach doctor --text`

Salida completa (texto):

```
Agent Reach 1.6.1

ready        github       default
not_added    twitter      experimental  agent-reach add twitter
ready        youtube      default
not_added    reddit       optional      agent-reach add reddit
not_added    facebook     experimental  agent-reach add facebook
not_added    instagram    experimental  agent-reach add instagram
unverified   bilibili     default       agent-reach check bilibili
not_added    xiaohongshu  optional      agent-reach add xiaohongshu
not_added    linkedin     optional      agent-reach add linkedin
not_added    boss         optional      agent-reach add boss
unverified   v2ex         default       agent-reach check v2ex
not_added    xueqiu       optional      agent-reach add xueqiu
not_added    xiaoyuzhou   optional      agent-reach add xiaoyuzhou
ready        web          default

Tools
bili-cli         0.6.2        agent-reach
cloakbrowser     0.6.3        agent-reach
```

CÃ³digo de salida: 0 (Ã©xito).

### 1.2 `agent-reach channels`

Salida completa (JSON, `{"schema_version":1,"ok":true,...}`). Contiene el catÃ¡logo de canales con sus acciones, parÃ¡metros, backends y URLs pÃºblicas asociadas. CÃ³digo de salida: 0 (Ã©xito).

Canales listados por `agent-reach channels` (resumido en la secciÃ³n 2).

---

## 2. Matriz de canales

| Canal | Nivel | Estado | Login | Comando sugerido para instalar/verificar | Uso principal en TechPulse | Fallback si no disponible |
|-------|-------|--------|-------|------------------------------------------|----------------------------|---------------------------|
| `github` | default | **ready** | No | â€” (ya disponible) | Descubrimiento de repos, contexto complementario | GitHub REST API (fuente primaria) |
| `youtube` | default | **ready** | No | â€” (ya disponible) | Tendencias/vÃ­deos tÃ©cnicos, subtÃ­tulos | RSS/web |
| `web` | default | **ready** | No | â€” (ya disponible) | BÃºsqueda web, lectura de pÃ¡ginas/documentaciÃ³n | No aplica |
| `bilibili` | default | **unverified** | SesiÃ³n (no logueado) | `agent-reach check bilibili` | VÃ­deos/tendencias regionales (CN) | Omitir |
| `v2ex` | default | **unverified** | No | `agent-reach check v2ex` | Descubrimiento comunitario (CN) | Omitir |
| `twitter` | experimental | **not_added** | Navegador | `agent-reach add twitter` | (no priorizado en v1) | No usar |
| `facebook` | experimental | **not_added** | Navegador | `agent-reach add facebook` | (no priorizado en v1) | No usar |
| `instagram` | experimental | **not_added** | Navegador | `agent-reach add instagram` | (no priorizado en v1) | No usar |
| `reddit` | optional | **not_added** | Navegador | `agent-reach add reddit` | Descubrimiento comunitario | Omitir |
| `xiaohongshu` | optional | **not_added** | Navegador | `agent-reach add xiaohongshu` | (no priorizado en v1) | No usar |
| `linkedin` | optional | **not_added** | Navegador | `agent-reach add linkedin` | (no priorizado en v1) | No usar |
| `boss` | optional | **not_added** | Navegador | `agent-reach add boss` | (no priorizado en v1) | No usar |
| `xueqiu` | optional | **not_added** | Navegador | `agent-reach add xueqiu` | (no priorizado en v1) | No usar |
| `xiaoyuzhou` | optional | **not_added** | No | `agent-reach add xiaoyuzhou` | (no priorizado en v1) | No usar |

**Resumen por categorÃ­a:**

- **ready (3)**: `github`, `youtube`, `web`. Son los Ãºnicos que se pueden usar sin instalaciÃ³n ni verificaciÃ³n adicional.
- **unverified (2)**: `bilibili`, `v2ex`. EstÃ¡n por defecto pero requieren `agent-reach check <canal>` con red (mÃ¡ximo 1 por canal cada 6 h, solo si se autoriza). Hasta entonces: tratar como no disponibles.
- **not_added opcional (6)**: `reddit`, `xiaohongshu`, `linkedin`, `boss`, `xueqiu`, `xiaoyuzhou`. Requieren `agent-reach add <canal>` y autorizaciÃ³n previa. No instalados en este worktree.
- **experimental no priorizado (3)**: `twitter`, `facebook`, `instagram`. Requieren `agent-reach add <canal>`; login vÃ­a navegador. No se usan en v1.

---

## 3. Comandos y acciones disponibles por canal

ExtraÃ­do de `agent-reach channels` (JSON). Formato general:

- `agent-reach read <url>` â€” elige el canal a partir de la URL.
- `agent-reach <canal> <acciÃ³n> [args] [--timeout SECONDS]`.

### 3.1 `github` (ready, default)

| AcciÃ³n | Uso | ParÃ¡metros | Backends |
|--------|-----|------------|----------|
| `search` | Buscar repositorios | `query` (requerido, str), `limit` (opcional, int, default 5) | `gh`, `github-api` |
| `read` | Leer un repo (con README) o issue/PR | `target` (requerido, str: owner/repo o enlace) | `gh`, `github-api` |

### 3.2 `youtube` (ready, default)

| AcciÃ³n | Uso | ParÃ¡metros | Backends |
|--------|-----|------------|----------|
| `read` | TÃ­tulo, canal, fecha y descripciÃ³n de un vÃ­deo | `target` (requerido, str) | `yt-dlp` |
| `search` | Buscar vÃ­deos | `query` (requerido, str), `limit` (opcional, int, default 5) | `yt-dlp` |
| `subtitle` | SubtÃ­tulos completos de un vÃ­deo | `target` (requerido, str), `lang` (opcional, str, default `zh-Hans,zh,en,en-orig`) | `yt-dlp` |
| `transcribe` | Speech-to-text del audio | `target` (requerido, str) | `whisper` (usa cuota Groq/OpenAI) |

### 3.3 `web` (ready, default)

| AcciÃ³n | Uso | ParÃ¡metros | Backends |
|--------|-----|------------|----------|
| `search` | BÃºsqueda web (semÃ¡ntica) | `query` (requerido, str), `limit` (opcional, int, default 5) | `exa` |
| `read` | Leer pÃ¡gina web como texto limpio | `target` (requerido, str: URL) | `jina`, `exa` |

### 3.4 Canales no instalados / no verificados (no usar sin autorizaciÃ³n)

`twitter`, `facebook`, `instagram` (experimental), `reddit`, `xiaohongshu`, `linkedin`, `boss`, `xueqiu`, `xiaoyuzhou` (opcional), `bilibili` y `v2ex` (unverified). Sus acciones solo se documentan a tÃ­tulo informativo; no se invocan desde el worker hasta que estÃ©n `ready` y verificados.

---

## 4. QuÃ© canal sirve para quÃ©

| Necesidad de TechPulse | Canal recomendado | Por quÃ© | Fallback |
|------------------------|-------------------|---------|----------|
| Repositorios de GitHub, metadatos, licencia, topics | `github` (Agent Reach) como apoyo | `search`/`read` con backends `gh`/`github-api` | **GitHub REST API** (fuente primaria, ADR-006) |
| VÃ­deos tÃ©cnicos, tutoriales, charlas | `youtube` | `search`/`read`/`subtitle` vÃ­a `yt-dlp` | RSS/web |
| Lectura de pÃ¡ginas, documentaciÃ³n, enriquecimiento | `web` | `read` (texto limpio) vÃ­a `jina`/`exa` | No aplica |
| Descubrimiento comunitario (Reddit, V2EX, etc.) | `reddit` / `v2ex` | Solo si se instalan y verifican | Omitir; no romper el worker |
| IA/ML/Data Engineering (blogs, papers) | RSS/Atom | Ver `feeds.md` | GitHub API |

**Regla de producto (ADR-007 / source-policy Â§5):** Agent Reach complementa, no sustituye, GitHub API ni RSS. Si un canal no estÃ¡ disponible, el worker debe registrar `skipped` y continuar.

---

## 5. Fallback si un canal no estÃ¡ disponible

| SituaciÃ³n | DeteciÃ³n | AcciÃ³n del worker | Fallback |
|-----------|----------|-------------------|----------|
| Canal `not_added` (ej. `reddit`) | `agent-reach doctor` lo reporta como `not_added` | No intentar invocarlo; registrar `skipped` en `source_runs` | GitHub API / RSS / omitir |
| Canal `unverified` (ej. `bilibili`, `v2ex`) | `agent-reach doctor` lo reporta como `unverified` | No invocar sin `agent-reach check` previo y autorizaciÃ³n | Omitir; registrar `skipped` |
| Canal `ready` falla en runtime (error de subprocess, salida no JSON, timeout 60 s) | ExcepciÃ³n / salida no JSON / cÃ³digo de salida â‰  0 | Registrar `error_code`/`error_message` en `source_runs`; marcar `partial` o `failed` | Degradar a las demÃ¡s fuentes; no abortar el worker |
| Agent Reach no instalado | `doctor` falla o `/capabilities` devuelve `installed: false` | Desactivar integraciÃ³n Agent Reach; seguir con GitHub API + RSS | GitHub API + RSS (suficientes para v1) |
| LÃ­mite de cuota (ej. `youtube transcribe` usa Whisper) | Error de backend | Registrar error; no reintentar ciegamente | Usar `read`/`subtitle` sin `transcribe`, o RSS/web |

**Flujos clave:**
1. Al arrancar y cada 24 h: ejecutar `agent-reach doctor --text` (sin red) y guardar en cachÃ© (`capabilities`).
2. `agent-reach channels` para listar acciones/capacidades.
3. `POST /capabilities/agent-reach/refresh` ejecuta `doctor` de forma sÃ­ncrona (timeout 10 s) y actualiza la cachÃ©.
4. El worker ejecuta Agent Reach como subprocess con timeout 60 s, salida JSON, 1 proceso a la vez.

---

## 6. Reglas de datos para Agent Reach (ver source-policy Â§5.4)

- Todo resultado debe conservar `source_key`, `external_id` (si existe), `fetched_at` y `raw_json`/metadata.
- No mezclar datos de Agent Reach con GitHub API sin deduplicar por `github_id`/URL.
- Nunca presentar una inferencia de Agent Reach como dato oficial de GitHub.
- No ejecutar comandos de escritura (`login`, `add`, `remove`, `update`) desde el worker.

---

## 7. Riesgos y limitaciones identificados

1. **Canales opcionales no instalados**: `reddit`, `linkedin`, `xiaohongshu`, `boss`, `xueqiu`, `xiaoyuzhou` estÃ¡n `not_added`. No asumir que funcionan; verificar con `agent-reach add` + `doctor` solo con autorizaciÃ³n.
2. **Canales unverified**: `bilibili` y `v2ex` requieren `agent-reach check <canal>` con red (mÃ¡ximo 1 por canal cada 6 h). Hasta verificar, tratar como no disponibles.
3. **Canales experimentales**: `twitter`, `facebook`, `instagram` requieren login vÃ­a navegador; no priorizados en v1.
4. **Dependencia de backends externos**: `web` usa `exa`/`jina`; `youtube transcribe` usa cuota Groq/OpenAI Whisper; `bilibili` usa `bili-cli`. Si un backend falla, el canal se degrada.
5. **Un solo proceso a la vez**: concurrencia mÃ¡xima 1 proceso Agent Reach; planificar intervalos para evitar colas.
6. **No comandos de escritura**: el worker no puede instalar ni loguear canales; eso es acciÃ³n del usuario.

---

## 8. Decisiones que necesita el Coordinador

1. Â¿Se autoriza instalar y verificar canales opcionales (`reddit`, `linkedin`, etc.)? Si sÃ­, cuÃ¡l y con quÃ© presupuesto de red.
2. Â¿Se permite usar `agent-reach check <canal>` para `bilibili`/`v2ex` (requiere red, mÃ¡ximo 1 cada 6 h)?
3. Â¿Se usa `youtube transcribe` sabiendo que consume cuota de Groq/OpenAI Whisper?
4. Confirmar que Agent Reach es solo complementario y que GitHub API + RSS son suficientes para el MVP de v1.
