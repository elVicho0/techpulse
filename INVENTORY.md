# TechPulse — Inventario de componentes, licencias y dependencias

Estado: entregado como parte de la actualización visual del frontend.
Repositorio de trabajo: `frontend/` (worktree `techpulse-frontend`). Sin commits ni push.

## 1. Repositorios estudiados y decisión de uso

| Repositorio | Licencia | ¿Se integra? | Motivo / uso |
|---|---|---|---|
| **paper-design/shaders** | Apache-2.0 | ✅ Sí | Fondos generativos ("aurora") en el Overview hero. Se conserva el aviso de licencia (NOTICE/LICENSE). |
| **ibelick/motion-primitives** | MIT | ✅ Sí (patrones) | Patrones de movimiento (grupo escalonado, número animado, entrada en viewport, tilt) reimplementados con `motion` y adaptados al sistema TechPulse. Atribución por MIT. |
| **ui-layouts/uilayouts** | MIT | ✅ Sí (patrones) | Tarjetas glass/spotlight, barras de puntuación, controles segmentados, timeline y sliders adaptados. Atribución por MIT. |
| **DavidHDev/canvas-ui** | MIT + Commons Clause | ❌ No | Efectos Glass/Liquid/Ripple/Particle Reveal dependen de la API experimental `html-in-canvas` (WebView2 en Windows no la garantiza) y la licencia Commons Clause prohíbe redistribuir los componentes. Se implementó un glass propio en CSS con fallback. |
| **ui-layouts/cursify** | Sin licencia declarada | ❌ No | No hay LICENSE ni campo `license` en `package.json`. No se integra hasta resolver condiciones de uso. |

## 2. Dependencias instaladas (frontend/package.json)

### Producción
| Paquete | Versión | Licencia | Propósito |
|---|---|---|---|
| `@paper-design/shaders-react` | ^0.0.82 | Apache-2.0 | Shader mount + mesh-gradient para el fondo aurora del Overview. |
| `@tauri-apps/api` | ^2.12.4 | MIT | API de Tauri (invoke, etc.). |
| `@tauri-apps/plugin-opener` | ^2.7.2 | MIT | Apertura segura de enlaces externos (`http/https`). |
| `lucide-react` | ^1.70.0 | ISC | Iconografía. |
| `motion` | ^14.11.1 | MIT | Animaciones, transiciones de ruta, números animados, entrada en viewport. |
| `react` / `react-dom` | ^19.3.1 | MIT | Framework de UI. |
| `react-router-dom` | ^7.18.5 | MIT | Ruteo de la aplicación de escritorio. |

### Desarrollo
| Paquete | Versión | Propósito |
|---|---|---|
| `@tauri-apps/cli` | ^2.12.4 | Empaquetado Tauri 2. |
| `vite` | ^8.3.7 | Servidor de desarrollo y build. |
| `@vitejs/plugin-react` | ^6.3.0 | Plugin React para Vite. |
| `typescript` | ~5.9.3 | Tipado estático. |
| `@types/*` | — | Tipos de Node, React, React DOM. |
| `esbuild` | 0.28.2 | Requerido por Vite 8 (rolldown) para el build de producción. |

Nota: no se instalaron dependencias de cursor, Canvas UI, ni shaders adicionales más allá de `@paper-design/shaders-react`.

## 3. Contrato de API respetado

Se creó `src/api/types.ts` reflejando exactamente `docs/api-contract.md` (v1) y `src/api/client.ts` como cliente tipado sobre `http://127.0.0.1:8765/api/v1`. No se inventaron endpoints ni campos. El frontend nunca accede a SQLite ni llama directamente a fuentes externas.

## 4. Modo demostración (datos de ejemplo)

Mientras la API local no esté disponible, la app opera en "Modo demostración" con un banner visible y un aviso en pantalla. Los datos de `src/api/demo.ts` son **ejemplos de diseño**, nunca se presentan como información real y no sustituyen a los datos del backend. Al conectar la API, se usan los datos reales.

## 5. Restricciones de rendimiento cumplidas

- Un solo shader (aurora) solo en el Overview hero.
- El shader se pausa cuando no está visible, cuando la pestaña está oculta, con `prefers-reduced-motion` o sin WebGL.
- Backdrop blur limitado a paneles; no hay capas de blur excesivas.
- Animaciones respetan `prefers-reduced-motion` y se detienen fuera de pantalla (IntersectionObserver + `visibilitychange`).
- Polling solo visible (`/worker/status` cada 10 s, `/overview` cada 60 s).
- Lazy loading del shader mediante `React.lazy` + `Suspense`.

## 6. Accesibilidad

- Enlaces "saltar al contenido", roles ARIA, `aria-label` en botones de icono, `prefers-reduced-motion`, contraste sobre fondo oscuro, indicadores de enfoque.

## 7. Licencias y atribución

El código adaptado de **paper-shaders** (Apache-2.0), **motion-primitives** (MIT) y **ui-layouts** (MIT) conserva los avisos de licencia correspondientes. No se incluyó código de **canvas-ui** (Commons Clause) ni de **cursify** (sin licencia).
