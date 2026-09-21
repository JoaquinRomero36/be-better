import type { Estado, Task } from '../types';

export const ESTADO_SCORE: Record<Estado, number> = {
  NO_HICE: 0,
  A_MEDIAS: 0.25,
  CASI_COMPLETA: 0.6,
  COMPLETA: 1
};

export function dayScore(tasks: Task[]): number | null {
  if (!tasks.length) return null;
  const sum = tasks.reduce((acc, t) => acc + ESTADO_SCORE[t.estado], 0);
  return sum / tasks.length;
}

export function doneCount(tasks: Task[]): number {
  return tasks.filter((t) => t.estado === 'COMPLETA').length;
}

/**
 * Estado que corresponde al avance del contador de una tarea con cantidad:
 * <50% No hice · ≥50% A medias · >75% Casi completa · ≥100% Completa.
 * Devuelve null si la tarea no tiene cantidad (el estado se maneja a mano).
 */
export function estadoParaProgreso(hecho: number | undefined, cantidad: number | undefined): Estado | null {
  if (!(typeof cantidad === 'number' && cantidad > 0)) return null;
  const p = (hecho ?? 0) / cantidad;
  if (p >= 1) return 'COMPLETA';
  if (p > 0.75) return 'CASI_COMPLETA';
  if (p >= 0.5) return 'A_MEDIAS';
  return 'NO_HICE';
}

/** Color de un día según su nivel de cumplimiento (rojo -> verde). */
export function scoreColor(score: number): string {
  const h = Math.round(score * 120);
  return `hsl(${h} 65% 42%)`;
}

export function scoreLabel(score: number): string {
  return `${Math.round(score * 100)}%`;
}