# TechPulse — Riesgos legales, licencias y ToS (research/legal.md)

- **Estado**: propuesto (entregable de la fase F1 — Research, tarea R1.6).
- **Autor**: agente Research (worktree `buscador`, rama `techpulse-research`).
- **Fecha**: 2026-11-09.
- **Contrato de referencia**: `docs/source-policy.md` §6.5 (licencias), `docs/architecture.md` §11/§17, `docs/api-contract.md` §1.1/§14, `docs/data-model.md`.
- **Regla**: nunca afirmar compatibilidad comercial sin verificar; si la licencia no está especificada, mostrar "Licencia no especificada".

---

## 1. GitHub API — Términos de uso

### 1.1 Términos aplicables

El uso de la GitHub REST API se rige por:
- **GitHub Terms of Service**: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
- **GitHub API Terms**: https://docs.github.com/en/rest/overview/resources-in-the-rest-api#api-terms
- **Acceptable Use Policies**: https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies

> Estos documentos son de GitHub; TechPulse no los hospeda ni los modifica. Se citan como referencia. Research no modifica ningún contrato de terceros.

### 1.2 Reglas clave para TechPulse

- Solo datos públicos: no se acceden a datos privados ni se requieren permisos especiales (`docs/source-policy.md` §3.1).
- Token opcional en `TECHPULSE_GITHUB_TOKEN`; nunca se registra ni se devuelve por la API (`docs/architecture.md` §8.2).
- Respetar cabeceras de rate limit (`X-RateLimit-*`, `Retry-After`); no eludir límites (`docs/source-policy.md` §3.3).
- No usar la API para buscar secretos, credenciales o datos personales (`docs/source-policy.md` §3.4).
- Atribución: no se exige atribución explícita de GitHub por mostrar metadatos públicos, pero no se debe implicar respaldo o afiliación con GitHub.

### 1.3 Riesgos

- Cambio de términos o límites por parte de GitHub sin previo aviso: la app debe leer límites en runtime y degradar graceful.
- Uso del token: si se configura, es responsabilidad del usuario; TechPulse no gestiona claves ajenas.

---

## 2. Licencias de repositorios

### 2.1 Origen de los datos de licencia

- `license_spdx` y `license_name` **solo desde el campo `license` de la GitHub API** (`docs/source-policy.md` §3.8 / §6.5).
- Nunca se infiere la licencia del nombre, la organización ni el contenido.
- Si la API no devuelve licencia: `license_spdx = NULL`, `license_name = NULL`.

### 2.2 Presentación al usuario

| Situación | Mostrar en UI | Afirmar uso comercial |
|-----------|---------------|------------------------|
| Licencia permisiva conocida (MIT, Apache-2.0, BSD-2, BSD-3, ISC) | Nombre de la licencia + SPDX | Solo con advertencia "verificar requisitos de atribución" |
| GPL / AGPL / SSPL | Nombre de la licencia | No; mostrar "Revisar licencia antes de uso comercial" |
| Licencia desconocida / otra | Nombre de la licencia | No |
| `license_spdx = NULL` | "Licencia no especificada" | **No**; nunca afirmar compatibilidad |

### 2.3 Permisivas vs copyleft

| Tipo | Ejemplos (SPDX) | Uso comercial | Requisitos típicos |
|------|-----------------|---------------|--------------------|
| Permisiva | MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC | Generalmente permitida | Atribución, incluir copia de la licencia, aviso de copyright |
| Copyleft fuerte | GPL-2.0, GPL-3.0, AGPL-3.0 | Restringida (derivados deben abrirse) | Copyleft: obras derivadas bajo la misma licencia |
| Copyleft débil / fuente disponible | LGPL, MPL, SSPL, licencias de fuente disponible | Case by case | Revisar términos específicos |
| No especificada | `NULL` | No afirmar | No hay base legal para afirmar nada |

**Regla de producto**: solo se puede afirmar compatibilidad comercial para licencias permisivas conocidas (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC) y con la advertencia "verificar requisitos de atribución". GPL/AGPL/SSPL y desconocidas: "Revisar licencia antes de uso comercial". Nunca se inventa una licencia.

---

## 3. RSS / copyright

### 3.1 Qué se puede mostrar

- Título, resumen, URL, autor, fecha, GUID del feed (datos del propio feed).
- `url_hash = SHA-256(canonical_url)` para dedup; no se duplica la misma URL entre feeds.

### 3.2 Qué NO se puede hacer sin verificación

- No scrapeo del artículo completo si el feed no lo incluye (`docs/source-policy.md` §4.1).
- No mostrar el artículo completo como si fuera propio; se muestra el resumen del feed y se enlaza a la fuente original.
- El `content_hash` se calcula sobre título/resumen/URL; si cambia, se actualiza, pero se conserva la procedencia.

### 3.3 Riesgos

- Los feeds están protegidos por copyright de sus editores. TechPulse solo indexa y enlaza; no reproduce contenido completo sin permiso.
- Feed eliminado (404/410): deshabilitar tras 3 fallos consecutivos.
- Nunca afirmar que TechPulse es propiedad o está afiliado con los editores de los feeds.

---

## 4. Agent Reach — canales, ToS y limitaciones

### 4.1 Estado de canales (verificado, 2026-11-09)

- Versión: `1.6.1`.
- `ready`: `github`, `youtube`, `web`.
- `unverified`: `bilibili`, `v2ex` (requieren `agent-reach check <canal>` con red).
- `not_added` opcional: `reddit`, `xiaohongshu`, `linkedin`, `boss`, `xueqiu`, `xiaoyuzhou`.
- `experimental` no priorizado: `twitter`, `facebook`, `instagram`.

### 4.2 Términos y limitaciones

- Cada canal de Agent Reach puede tener sus propios ToS y requisitos de login (por ejemplo, `twitter`/`facebook`/`instagram`/`linkedin` requieren login vía navegador; `bilibili` requiere sesión).
- TechPulse no ejecuta comandos de escritura (`login`, `add`, `remove`, `update`) desde el worker (`docs/source-policy.md` §5.3).
- Agent Reach complementa, no sustituye, GitHub API ni RSS (`docs/architecture.md` ADR-007).
- Si un canal no está disponible, el worker registra `skipped` y continúa; no simula datos.

### 4.3 Riesgos

- Canales opcionales no instalados: no asumir que funcionan; verificar solo con autorización previa.
- Canales con login: los datos obtenidos pueden estar sujetos a ToS de la plataforma (Reddit, LinkedIn, etc.); no usarlos en v1 sin revisión legal.
- Backends externos (`exa`, `jina`, `yt-dlp`, `whisper`, `bili-cli`): dependen de servicios de terceros con sus propios ToS y posibles cuotas (ej. `youtube transcribe` usa Groq/OpenAI Whisper).

---

## 5. Licencias de modelos de embeddings

### 5.1 Modelos candidatos (ver `research/embeddings.md`)

| Modelo | Licencia (por verificar en model card) |
|--------|----------------------------------------|
| `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Por verificar en Hugging Face model card |
| `sentence-transformers/all-MiniLM-L6-v2` | Por verificar en Hugging Face model card |
| `intfloat/multilingual-e5-small` (opcional) | Por verificar en Hugging Face model card |

### 5.2 Reglas

- Verificar la licencia del modelo en su model card **antes de distribuirlo** (`docs/source-policy.md` §17.3 / `docs/architecture.md` §4.6).
- El modelo se descarga una vez desde Hugging Face; después funciona offline (sidecar local en `127.0.0.1:8766`).
- `embeddings.auto_download = false` por defecto: la descarga se inicia desde Settings (`docs/data-model.md` §5.10).
- No se envían textos a ningún servicio externo; todo el procesamiento es local (`docs/source-policy.md` §17.8).

### 5.3 Riesgos

- Licencia de modelo restrictiva podría impedir la redistribución del empaquetado de la app (PyInstaller/MSI).
- Descarga inicial requiere red; si no hay red, el modo semántico no está disponible y se degrada a metadatos.

---

## 6. Recomendaciones para no afirmar compatibilidad comercial

1. **Licencia nula**: mostrar "Licencia no especificada"; nunca afirmar que se puede usar comercialmente.
2. **Permisivas conocidas**: solo afirmar uso comercial con advertencia "verificar requisitos de atribución".
3. **Copyleft/desconocidas**: mostrar "Revisar licencia antes de uso comercial".
4. **Repositorios asociados a ideas**: el valor de portafolio `commercial` solo se asigna tras verificar licencias de los repos implicados (`ideas-rules.md` §7.3).
5. **LLM opcional**: nunca completar URLs, métricas ni licencias con el LLM.
6. **Datos duros**: solo provienen de fuentes verificables; si falta, `NULL` y "No disponible".

---

## 7. Decisiones que necesita el Coordinador

1. ¿Se aprueba la regla de licencias permisivas para uso comercial (MIT, Apache-2.0, BSD-2, BSD-3, ISC con advertencia de atribución)?
2. ¿Se revisan las licencias de los modelos de embeddings antes de incluir el sidecar en el empaquetado?
3. ¿Se autoriza el uso de canales de Agent Reach que requieran login (Reddit, LinkedIn, etc.) en versiones futuras, sujeto a revisión de ToS?
4. ¿Se añade un aviso legal en la UI sobre "datos de terceros, verificar licencias antes de uso comercial"?
