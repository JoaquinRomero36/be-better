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
- **Modelo de datos** (`src/types.ts`): `AppState = { days: Record<"YYYY-MM-DD", Task[]>, updatedAt }`. `Task`: `id:number`, `nombre`, `descripcion`, `cantidad?`, `hora`, `minuto` (0-59), `estado` (`NO_HICE|A_MEDIAS|CASI_COMPLETA|COMPLETA`), `templateId?`.
- **Rutina**: el onboarding crea el "día perfecto" y lo copia a **todos los días del mes** con el mismo `templateId`. `aplicaRutinaAMes()` (Ajustes) re-copia las tareas de hoy al mes conservando tareas manuales (sin templateId) y estados ya marcados.

## Convenciones y gotchas

- **Re-render global**: cada pantalla se re-renderiza entera ante cualquier `store.notify` (recordar esto al tocar estas funciones, no pensar en "estado local persistente en el DOM").
- **Listeners**: los screens re-crean el innerHTML; los listeners sobre nodos frescos se enlazan en cada render. Para delegación sobre un **contenedor reutilizado** el flag se enlaza **una sola vez** (ver `__dbtasks` en `src/ui/dayTasks.ts`) y el día se lee de `data-day`; no acumular listeners sobre el mismo nodo o las mutaciones se duplican.
- **Estado de una pantalla** (form abierto, draft, mes seleccionado, etc.) vive en variables de módulo (ej. `dayTasks.ts: draft/addOpen/editingId`), no en el DOM — sobrevive a los re-renders.
- **Claves de fecha**: `YYYY-MM-DD` local (no UTC), se comparan lexicográficamente (`isPast`). Tiempos en la zona local de cada dispositivo.
- **Ids**: `newId()` = timestamp+random+contador (`src/lib/ids.ts`); único aproximado entre dispositivos sin DB.
- **Puntaje**: `NO_HICE=0, A_MEDIAS=.25, CASI_COMPLETA=.6, COMPLETA=1` (`src/lib/scoring.ts`); el almanaque colorea días pasados con `hsl(score*120 …)`.
- **PWA**: `vite-plugin-pwa` con `generateSW`; íconos en `public/` (se crean con un script de PowerShell + System.Drawing, no editar a mano). `registerSW` en `src/main.ts`.
- **Render free tier**: disco **efímero** — un redeploy/crash puede borrar `state.json`. Hay botón de exportar/importar respaldo en Ajustes. Para persistencia real haría falta disco persistente (pago).
- Idioma del producto y de strings en UI: **es-AR**.