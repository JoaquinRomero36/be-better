export const ESTADOS = ['NO_HICE', 'A_MEDIAS', 'CASI_COMPLETA', 'COMPLETA'] as const;
export type Estado = (typeof ESTADOS)[number];

export interface Task {
  id: number;
  nombre: string;
  descripcion: string;
  cantidad?: number;
  hora: number;
  minuto: number;
  estado: Estado;
  templateId?: number;
}

export interface AppState {
  days: Record<string, Task[]>;
  updatedAt: number;
}

export const ESTADO_INFO: Record<Estado, { label: string; color: string }> = {
  NO_HICE: { label: 'No hice', color: '#64748b' },
  A_MEDIAS: { label: 'A medias', color: '#f59e0b' },
  CASI_COMPLETA: { label: 'Casi completa', color: '#84cc16' },
  COMPLETA: { label: 'Completa', color: '#22c55e' }
};

/** Avanza al siguiente estado al tocar (ciclo). */
export function estadoNext(e: Estado): Estado {
  const i = ESTADOS.indexOf(e);
  return ESTADOS[(i + 1) % ESTADOS.length];
}

export function emptyState(): AppState {
  return { days: {}, updatedAt: 0 };
}