import { dayScore, doneCount, scoreLabel } from '../lib/scoring';
import { nowMinutes, minutesOfDay, pad, todayKey } from '../lib/time';
import { getStateObj, mutate } from '../store';
import { newId } from '../lib/ids';
import { getDayTasks, renderDayTasks } from './dayTasks';

export function renderDia(c: HTMLElement): void {
  const day = todayKey();
  const tasks = getDayTasks(day);
  const score = dayScore(tasks);
  const done = doneCount(tasks);
  const now = nowMinutes();
  const pending = tasks.filter((t) => t.estado !== 'COMPLETA').sort((a, b) => minutesOfDay(a) - minutesOfDay(b));
  const overdue = pending.filter((t) => minutesOfDay(t) < now);
  const upcoming = pending.filter((t) => minutesOfDay(t) >= now);
  const current = overdue.length ? overdue[overdue.length - 1] : upcoming[0];
  const pct = score ?? 0;

  c.innerHTML = `
    <header class="page-head">
      <span class="date-line">${dateHeading()}</span>
    </header>

    ${tasks.length ? `
    <section class="card progress-card">
      <div class="progress-card__top">
        <span>Avance de hoy</span>
        <strong>${done} / ${tasks.length} completadas</strong>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.round(pct * 100)}%"></div></div>
      <span class="progress-score">${scoreLabel(pct)} del día</span>
    </section>
    ` : ''}

    ${
      current
        ? `
    <section class="card now-card">
      <span class="now-card__tag">${overdue.includes(current) ? 'Deberías estar haciendo ahora · vencida' : 'Sigue ahora'}</span>
      <div class="now-card__body">
        <span class="now-card__time">${pad(current.hora)}:${pad(current.minuto)}</span>
        <div>
          <div class="now-card__name">${current.nombre}</div>
          <div class="now-card__meta">${current.descripcion || 'Mantené el foco'}</div>
        </div>
      </div>
      <label class="check-giant"><input type="checkbox" data-done-current /> <span>Marcar completa</span></label>
    </section>`
        : tasks.length
          ? '<section class="card now-card now-card--done"><span class="now-card__tag">Por ahora, todo listo</span></section>'
          : '<section class="card empty-state"><p>No tenés tareas para hoy.</p><p class="hint">Agregalas acá abajo, o copiá la rutina de otro día desde Ajustes.</p></section>'
    }

    <div data-tasks></div>
  `;

  const doneToggle = c.querySelector<HTMLInputElement>('[data-done-current]');
  if (current && doneToggle) {
    doneToggle.addEventListener('change', () => {
      mutate((s) => {
        const list = s.days[day];
        const t = list?.find((x) => x.id === current.id);
        if (t) t.estado = doneToggle.checked ? 'COMPLETA' : 'NO_HICE';
      });
    });
  }

  const listEl = c.querySelector<HTMLElement>('[data-tasks]');
  if (listEl) renderDayTasks(listEl, day);
}

export function dateHeading(): string {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Copia las tareas de hoy a todos los días del mes actual. */
export function aplicaRutinaAMes(): void {
  const hoy = getStateObj().days[todayKey()] ?? [];
  if (!hoy.length) {
    window.alert('Primero agregá tareas al día de hoy.');
    return;
  }
  const monthTemplates = new Set(hoy.map((t) => t.templateId).filter((x): x is number => typeof x === 'number'));
  const ok = window.confirm(
    `¿Copiar las ${hoy.length} tareas de hoy a todos los días del mes actual? Se conservan tus tareas manuales y se respeta el estado ya marcado en cada día.`
  );
  if (!ok) return;

  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const days = new Date(year, month + 1, 0).getDate();

  mutate((s) => {
    for (let d = 1; d <= days; d++) {
      const key = `${year}-${pad(month + 1)}-${pad(d)}`;
      if (key === todayKey()) continue;
      const exist = s.days[key] ?? [];
      const keep = exist.filter((t) => !(t.templateId && monthTemplates.has(t.templateId)));
      const copies = hoy.map((t) => ({ ...t, id: newId(), estado: 'NO_HICE' as const }));
      s.days[key] = [...keep, ...copies];
    }
  });
}