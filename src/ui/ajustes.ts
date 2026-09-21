import { todayKey } from '../lib/time';
import { getStateObj, getSync, pushNow, replaceState, syncNow } from '../store';
import type { AppState } from '../types';
import { aplicaRutinaAMes } from './dia';

export function renderAjustes(c: HTMLElement): void {
  const { status, lastSyncAt } = getSync();

  c.innerHTML = `
    <header class="page-head">
      <h1>Ajustes</h1>
    </header>

    <section class="card">
      <h3>Sincronización</h3>
      <p class="hint">La app guarda en caché y sincroniza con el server automáticamente.</p>
      <ul class="setting-list">
        <li><span>Estado</span><strong class="sync-${status}">${syncLabel(status)}</strong></li>
        <li><span>Última sincronización</span><strong>${lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('es-AR') : '—'}</strong></li>
      </ul>
      <div class="form-actions">
        <button class="btn" data-aj="sync">Sincronizar ahora</button>
      </div>
    </section>

    <section class="card">
      <h3>Rutina</h3>
      <p class="hint">Copiá las tareas de hoy a todos los días del mes actual.</p>
      <div class="form-actions">
        <button class="btn" data-aj="apply-month">Copiar rutina de hoy al mes</button>
      </div>
    </section>

    <section class="card">
      <h3>Respaldo</h3>
      <p class="hint">En Render gratis el archivo puede borrarse al redesplegar. Guardá un respaldo de vez en cuando.</p>
      <div class="form-actions">
        <button class="btn" data-aj="export">Exportar respaldo (.json)</button>
        <button class="btn" data-aj="import-choose">Importar respaldo</button>
        <input type="file" accept="application/json" data-aj="import-file" hidden />
      </div>
    </section>
  `;

  c.querySelector('[data-aj="sync"]')?.addEventListener('click', () => {
    void (async () => {
      await syncNow();
      renderAjustes(c);
    })();
  });

  c.querySelector('[data-aj="apply-month"]')?.addEventListener('click', () => {
    aplicaRutinaAMes();
    renderAjustes(c);
  });

  c.querySelector('[data-aj="export"]')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getStateObj(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `be-better-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  c.querySelector('[data-aj="import-choose"]')?.addEventListener('click', () => {
    c.querySelector<HTMLInputElement>('[data-aj="import-file"]')?.click();
  });

  c.querySelector('[data-aj="import-file"]')?.addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void (async () => {
      try {
        const parsed = JSON.parse(await file.text()) as unknown;
        const state = parsed as AppState;
        if (typeof state !== 'object' || state === null || typeof state.days !== 'object' || Array.isArray(state.days)) {
          throw new Error('Formato inválido');
        }
        if (!window.confirm('¿Reemplazar todos los datos locales con este respaldo?')) return;
        replaceState({ days: state.days, updatedAt: 0 });
        await pushNow();
        renderAjustes(c);
        window.location.hash = '#dia';
      } catch {
        window.alert('El archivo no es un respaldo válido de be-better.');
      }
    })();
  });
}

function syncLabel(status: 'syncing' | 'online' | 'offline'): string {
  switch (status) {
    case 'syncing':
      return 'Sincronizando…';
    case 'online':
      return 'En línea';
    case 'offline':
      return 'Sin conexión';
  }
}