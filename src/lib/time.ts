import type { Task } from '../types';

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fmtTime(hora: number, minuto: number): string {
  return `${pad(hora)}:${pad(minuto)}`;
}

export function fmtDate(key: string): string {
  return keyToDate(key).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtDateShort(key: string): string {
  return keyToDate(key).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
}

export function weekDayLetter(key: string): string {
  return keyToDate(key).toLocaleDateString('es-AR', { weekday: 'narrow' });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function longToday(): string {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function minutesOfDay(t: Pick<Task, 'hora' | 'minuto'>): number {
  return t.hora * 60 + t.minuto;
}

export function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

/** Las claves YYYY-MM-DD se comparan lexicográficamente. */
export function isPast(key: string): boolean {
  return key < todayKey();
}

export function isToday(key: string): boolean {
  return key === todayKey();
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function todayParts(): { year: number; month: number } {
  const n = new Date();
  return { year: n.getFullYear(), month: n.getMonth() };
}

/** Días del mes actual navegables, respetando el mes real de hoy. */
export function monthKeys(year: number, month: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    out.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  return out;
}

/** Desplazamiento del primer día del mes (lunes=0 ... domingo=6) en formato domingo=0. */
export function firstWeekOffset(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const wd = r.getDay();
  r.setDate(r.getDate() - wd);
  return r;
}