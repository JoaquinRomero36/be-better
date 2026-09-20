import { dayScore, doneCount, scoreLabel } from '../lib/scoring';
import { addDays, dateKey, fmtDateShort } from '../lib/time';
import { getStateObj } from '../store';

export function renderSemana(c: HTMLElement): void {
  const today = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) days.push(dateKey(addDays(today, -i)));

  const rows = days
    .map((key) => {
      const tasks = getStateObj().days[key] ?? [];
      const score = dayScore(tasks);
      return { key, tasks, score, done: doneCount(tasks) };
    })
    .reverse()
    .sort((a, b) => a.key.localeCompare(b.key));

  // Regularidad por tarea: agrupa por templateId (copias de rutina) o por nombre.
  const map = new Map<string, { nombre: string; ok: number; total: number }>();
  for (const r of rows) {
    for (const t of r.tasks) {
      const key = t.templateId !== undefined ? `t${t.templateId}` : `n${t.nombre}`;
      const g = map.get(key) ?? { nombre: t.nombre, ok: 0, total: 0 };
      g.total++;
      if (t.estado === 'COMPLETA') g.ok++;
      map.set(key, g);
    }
  }
  const weekly = [...map.values()];

  c.innerHTML = `
    <header class="page-head">
      <h1>Semana</h1>
      <span class="date-line">Últimos 7 días</span>
    </header>

    <section class="card">
      <ul class="week-list">
        ${rows
          .map((r) => {
            const s = r.score;
            const color = s === null ? 'var(--surface-2)' : scoreColorCss(s);
            const doneStr = r.tasks.length ? `${r.done}/${r.tasks.length}` : '—';
            const todayTag = r.key === dateKey(today) ? ' hoy' : '';
            return `
            <li class="week-item">
              <span class="week-item__dot" style="background:${color}"></span>
              <span class="week-item__date">${fmtDateShort(r.key)}${todayTag}</span>
              <span class="week-item__bar"><i style="width:${s === null ? 0 : Math.round(s * 100)}%"></i></span>
              <span class="week-item__score">${s === null ? '—' : scoreLabel(s)}</span>
              <span class="week-item__count">${doneStr}</span>
            </li>`;
          })
          .join('')}
      </ul>
    </section>

    <section class="card">
      <h3>Cumplimiento por tarea</h3>
      ${
        weekly.length
          ? `<ul class="reg-list">
              ${weekly
                .sort((a, b) => b.ok / b.total - a.ok / a.total)
                .map(
                  (w) => `
                <li>
                  <span class="reg-list__name">${w.nombre}</span>
                  <strong>${w.ok}/${w.total} días</strong>
                </li>`
                )
                .join('')}
            </ul>`
          : '<p class="hint">Sin datos esta semana.</p>'
      }
    </section>
  `;
}

function scoreColorCss(score: number): string {
  const h = Math.round(score * 120);
  return `hsl(${h} 65% 42%)`;
}