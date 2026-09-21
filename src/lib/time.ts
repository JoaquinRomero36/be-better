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

export function fmtDate(key: string): string {
  return keyToDate(key).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

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

export function monthKeys(year: number, month: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    out.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  return out;
}

/** Desplazamiento del primer día del mes (domingo=0). */
export function firstWeekOffset(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}