# AGENTS.md — be-better

App personal de rutina diaria (checklist por estados) que sincroniza entre PC y celular. Frontend Vite + TypeScript vanilla (sin framework UI), backend Express mínimo **sin base de datos** (persiste un JSON), PWA instalable.

## Comandos

```sh
npm run dev        # Vite (5173) + backend tsx watch (3000) con concurrently; /api se proxea a :3000
npm run build      # vite build -> dist/ (frontend + PWA/service worker)
npm start          # backend Express sirve dist/ estáticos y la API (para Render)
npm run typecheck  # tsc --noEmit (aprueba o no el PR; corre este primero)
npm run test:e2e   # E2E con Playwright (Chromium) contra el server real; spawnea/cierra el server y limpia state.json solo
```

- El backend corre TS directo con `tsx` (no hay build propio del server). `dist/` solo es el frontend.
- Verificación estándar: `npm run typecheck` → `npm run build`. Para la suite E2E, instalar el browser una vez: `npx playwright install chromium` (`test/e2e.mjs`).

## Arquitectura

- **Sin DB**: el server guarda `data/state.json` (carpeta gitignored, se crea al primer guardado). API: `GET /api/state`, `PUT /api/state` (`{ days }`), `GET /api/health`. Single user, sin login.
- **Sync** (`src/store.ts`): client guarda caché en `localStorage` (`be-better.state.v1`) y resuelve por `updatedAt` (last-write-wins). Toda mutación pasa por `mutate()`, que persiste y hace debounce del push. `syncNow()` en arranque, cada 60s, y en focus/visibility. La app funciona offline vía caché + PWA.
- **Modelo de datos** (`src/types.ts`): `AppState = { days: Record<"YYYY-MM-DD", Task[]>, updatedAt }`. `Task`: `id:number`, `nombre`, `descripcion`, `cantidad?`, `hecho?` (unidades marcadas de la cantidad; stepper `+`/`−` en la fila de tarea), `estado` (`NO_HICE|A_MEDIAS|CASI_COMPLETA|COMPLETA`), `templateId?`. **No hay horarios**: la app es un checklist puro.
- **Rutina**: el onboarding crea el "día perfecto" y lo copia a los días **desde hoy hasta fin de mes** (los días previos quedan sin datos y no cuentan en estadísticas; mismo `templateId`). `aplicaRutinaAMes()` (Ajustes) re-copia las tareas de hoy al mes **desde hoy en adelante** conservando tareas manuales (sin templateId), estados ya marcados y **reseteando `hecho`** (cada día arranca el contador en cero).
- **Semana** (`src/ui/semana.ts`, ruta `#semana`): grilla de progresión de la semana actual — 7 columnas (`.wk-col`) con fecha, barra de score, % y lista de tareas por día; hoy resaltado; "Cumplimiento por tarea" (`.reg-list`). La grilla scrollea en horizontal en pantallas chicas (`.wk-grid` con `minmax(84px,1fr)` y `overflow-x:auto`, sin scrollbar visible), y en desktop las columnas se ensanchan a `1fr`. Sin cronograma por horas.
- **Stats** (`src/ui/stats.ts`, ruta `#stats`, 5 pestañas: Día·Semana·Stats·Almanaque·Ajustes): KPIs del mes (promedio/racha/perfectos/completadas), **mapa de actividad** (heatmap GitHub de 14 semanas × 7 días, `.hm-cell`; scrollea en horizontal dentro de su tarjeta), y **gráficos Chart.js** (`.chart-box canvas`, `data-chart="line|hist|scatter|bars|doughnut"`): línea de puntaje diario del mes con promedio punteado, histograma de puntajes, dispersión tareas vs puntaje (puntos verdes = día perfecto), barras apiladas completadas/restantes por día, y doughnut de estados. La página **navega meses pasados** con ‹ › en el header (estado `view` en módulo, como el almanaque; el `›` se deshabilita en el mes actual y **nunca se cuentan días futuros**, ni los precargados por la rutina). Layout en **grilla por importancia**: `data-card` `kpis|line|heatmap|hist|scatter|bars|doughnut`; en **mobile es una sola columna** (todo a ancho completo para leer los gráficos) y en ≥1280px la grilla es de 6 columnas con cada par a `span 3` (los KPIs ocupan la fila completa y van de a 4). La racha cuenta días con `dayScore > 0`. **Los gráficos se destruyen al re-renderizar** (lista de instancias `charts` en el módulo; la pantalla se re-renderiza entera ante cualquier `notify`). KPIs como tiles verticales (`kpi__lbl` sobre `kpi__nums`), valor en `--accent`.

## Convenciones y gotchas

- **Re-render global**: cada pantalla se re-renderiza entera ante cualquier `store.notify` (recordar esto al tocar estas funciones, no pensar en "estado local persistente en el DOM").
- **Listeners**: los screens re-crean el innerHTML; los listeners sobre nodos frescos se enlazan en cada render. Para delegación sobre un **contenedor reutilizado** el flag se enlaza **una sola vez** (ver `__dbtasks` en `src/ui/dayTasks.ts`) y el día se lee de `data-day`; no acumular listeners sobre el mismo nodo o las mutaciones se duplican.
- **Estado de una pantalla** (form abierto, draft, mes seleccionado, etc.) vive en variables de módulo (ej. `dayTasks.ts: draft/addOpen/editingId`), no en el DOM — sobrevive a los re-renders.
- **Claves de fecha**: `YYYY-MM-DD` local (no UTC), se comparan lexicográficamente (`isPast`). Tiempos en la zona local de cada dispositivo.
- **Ids**: `newId()` = timestamp+random+contador (`src/lib/ids.ts`); único aproximado entre dispositivos sin DB.
- **Puntaje**: `NO_HICE=0, A_MEDIAS=.25, CASI_COMPLETA=.6, COMPLETA=1` (`src/lib/scoring.ts`); el almanaque colorea días pasados con `hsl(score*120 …)`. En tareas con `cantidad` el `estado` se **deriva del contador** (`estadoParaProgreso`): <50% No hice · ≥50% A medias · >75% Casi completa · ≥100% Completa; el tap del círculo re-sincroniza al derivado (no cicla).
- **PWA**: `vite-plugin-pwa` con `generateSW`; íconos en `public/` (se crean con un script de PowerShell + System.Drawing, no editar a mano). `registerSW` en `src/main.ts`.
- **Render free tier**: disco **efímero** — un redeploy/crash puede borrar `state.json`. Hay botón de exportar/importar respaldo en Ajustes. Para persistencia real haría falta disco persistente (pago).
- Idioma del producto y de strings en UI: **es-AR**.