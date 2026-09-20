import { getState, putState } from './lib/api';
import { emptyState, type AppState } from './types';

const LS_KEY = 'be-better.state.v1';

export type SyncStatus = 'syncing' | 'online' | 'offline';

let state: AppState = loadLocal();
let syncStatus: SyncStatus = 'syncing';
let lastSyncAt: number | null = null;

const subs = new Set<() => void>();

function loadLocal(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.days === 'object' && !Array.isArray(parsed.days)) {
        return { days: parsed.days, updatedAt: Number(parsed.updatedAt) || 0 };
      }
    }
  } catch {
    /* caché corrupta -> estado vacío */
  }
  return emptyState();
}

function persist(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* sin espacio / privado */
  }
}

function notify(): void {
  for (const fn of subs) fn();
}

export function getStateObj(): AppState {
  return state;
}

export function getSync(): { status: SyncStatus; lastSyncAt: number | null } {
  return { status: syncStatus, lastSyncAt };
}

export function subscribe(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** Aplica un cambio local, guarda en caché y encola la subida al server. */
export function mutate(fn: (s: AppState) => void): void {
  fn(state);
  state.updatedAt = Date.now();
  persist();
  notify();
  schedulePush();
}

export function replaceState(s: AppState): void {
  state = s;
  state.updatedAt = Date.now();
  persist();
  notify();
  schedulePush();
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushNow();
  }, 700);
}

/** Sube el estado local al server (last-write-wins). */
export async function pushNow(): Promise<void> {
  if (!navigator.onLine) {
    syncStatus = 'offline';
    notify();
    return;
  }
  syncStatus = 'syncing';
  notify();
  try {
    const saved = await putState(state);
    state.updatedAt = saved.updatedAt;
    persist();
    syncStatus = 'online';
    lastSyncAt = Date.now();
  } catch {
    syncStatus = 'offline';
  }
  notify();
}

/**
 * Descarga el estado del server y resuelve conflictos por fecha.
 * Si el server está más nuevo lo adopta; si el local es más nuevo lo sube.
 */
export async function syncNow(): Promise<void> {
  if (!navigator.onLine) {
    syncStatus = 'offline';
    notify();
    return;
  }
  syncStatus = 'syncing';
  notify();
  try {
    const remote = await getState();
    if (remote.updatedAt > state.updatedAt) {
      state = remote;
      persist();
    } else if (state.updatedAt > remote.updatedAt) {
      const saved = await putState(state);
      state.updatedAt = saved.updatedAt;
      persist();
    }
    syncStatus = 'online';
    lastSyncAt = Date.now();
  } catch {
    syncStatus = 'offline';
  }
  notify();
}

export function startAutoSync(): void {
  void syncNow();
  window.setInterval(() => void syncNow(), 60_000);
  window.addEventListener('focus', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
}

/** True si todavía no existe una rutina (para mostrar el onboarding). */
export function hasRoutine(): boolean {
  for (const key of Object.keys(state.days)) {
    if (state.days[key].length > 0) return true;
  }
  return false;
}