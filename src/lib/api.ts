import type { AppState } from '../types';

export async function getState(): Promise<AppState> {
  const r = await fetch('/api/state', { cache: 'no-store' });
  if (!r.ok) throw new Error(`GET /api/state falló: ${r.status}`);
  return (await r.json()) as AppState;
}

export async function putState(state: AppState): Promise<AppState> {
  const r = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days: state.days })
  });
  if (!r.ok) throw new Error(`PUT /api/state falló: ${r.status}`);
  return (await r.json()) as AppState;
}