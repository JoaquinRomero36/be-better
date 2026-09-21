import { dayScore, doneCount, scoreColor, scoreLabel } from '../lib/scoring';
import { addDays, dateKey, todayKey } from '../lib/time';
import { getStateObj } from '../store';
import { ESTADO_INFO } from '../types';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function renderSemana(c: HTMLElement): void {
  const now = new Date();
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => dateKey(addDays(monday, i)));
  const today = todayKey();

  const cols = days
    .map((key) => {
      const d = new Date(`${key}T00:00:00`);
      const tasks = getStateObj().days[key] ?? [];
      const score = dayScore(tasks);
      const done = doneCount(tasks);
      const isToday = key === today;
      const pct = score ?? 0;
      const items = tasks.length
        ? tasks
            .map((t) => {
              const isDone = t.estado === 'COMPLETA';
              const cnt =
                typeof t.cantidad === 'number' && t.cantidad > 0
                  ? ` <span class="wk-item__cnt">${t.hecho ?? 0}/${t.cantidad}</span>`
                  : '';
              return `
                <li class="wk-item${isDone ? ' wk-item--done' : ''}" title="${ESTADO_INFO[t.estado].label}">
                  <span class="wk-item__dot" style="--c:${ESTADO_INFO[t.estado].color}"></span>${escapeHtml(t.nombre)}${cnt}
                </li>`;
            })
            .join('')
        : '<li class="wk-item wk-item--empty">—</li>';
      return `
        <div class="wk-col${isToday ? ' wk-col--today' : ''}">
          <div class="wk-col__head">
            <span class="wk-col__day">${WEEKDAYS[d.getDay()]}</span>
            <strong class="wk-col__date">${d.getDate()}</strong>
          </div>
          <div class="wk-col__bar" title="${score === null ? 'Sin datos' : scoreLabel(pct)}">
            <i style="width:${Math.round(pct * 100)}%;background:${scoreColor(pct)}"></i>
          </div>
          <span class="wk-col__pct">${score === null ? '—' : scoreLabel(pct)}</span>
          ${tasks.length ? `<span class="wk-col__count">${done}/${tasks.length}</span>` : ''}
          <ul class="wk-col__list">${items}</ul>
        </div>`;
    })
    .join('');

  c.innerHTML = `
    <header class="page-head">
      <h1>Semana</h1>
      <span class="date-line">${weekRangeLabel(monday, addDays(monday, 6))}</span>
    </header>

    <section class="card">
      <div class="wk-grid">${cols}</div>
      <p class="hint">Progresión de cada día. Tocá un día en el almanaque para verlo o editarlo.</p>
    </section>

    <section class="card">
      <h3>Cumplimiento por tarea</h3>
      ${regularityHtml(days)}
    </section>
  `;
}

function regularityHtml(days: string[]): string {
  const map = new Map<string, { nombre: string; ok: number; total: number }>();
  for (const key of days) {
    for (const t of getStateObj().days[key] ?? []) {
      const gk = t.templateId !== undefined ? `t${t.templateId}` : `n${t.nombre}`;
      const g = map.get(gk) ?? { nombre: t.nombre, ok: 0, total: 0 };
      g.total++;
      if (t.estado === 'COMPLETA') g.ok++;
      map.set(gk, g);
    }
  }
  const weekly = [...map.values()];
  if (!weekly.length) return '<p class="hint">Sin datos esta semana.</p>';
  return `
    <ul class="reg-list">
      ${weekly
        .sort((a, b) => b.ok / b.total - a.ok / a.total)
        .map(
          (w) => `
        <li>
          <span class="reg-list__name">${escapeHtml(w.nombre)}</span>
          <div class="reg-list__right">
            <strong>${Math.round((w.ok / w.total) * 100)}%</strong>
            <span class="hint">${w.ok}/${w.total} días</span>
          </div>
        </li>`
        )
        .join('')}
    </ul>`;
}

function weekRangeLabel(a: Date, b: Date): string {
  const st = a.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  const en = b.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  return `del ${st} al ${en}`;
}

function escapeHtml(s: string): string {
  const r: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return s.replace(/[&<>"']/g, (c) => r[c]);
}