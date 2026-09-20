import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AppState } from '../src/types.js';

const DATA_DIR = process.env.DATA_DIR ?? join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'state.json');

function isValid(state: unknown): state is AppState {
  return (
    typeof state === 'object' &&
    state !== null &&
    typeof (state as AppState).days === 'object' &&
    !Array.isArray((state as AppState).days)
  );
}

export function loadState(): AppState {
  try {
    if (existsSync(FILE)) {
      const raw = readFileSync(FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (isValid(parsed)) {
        return { days: parsed.days, updatedAt: Number(parsed.updatedAt) || 0 };
      }
    }
  } catch (err) {
    console.error('No se pudo leer el estado almacenado:', err);
  }
  return { days: {}, updatedAt: 0 };
}

export function saveState(state: AppState): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2));
}