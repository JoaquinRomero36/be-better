import { dayScore, doneCount, scoreLabel } from '../lib/scoring';
import { pad, todayKey } from '../lib/time';
import { getStateObj, mutate } from '../store';
import { newId } from '../lib/ids';
import { getDayTasks, renderDayTasks } from './dayTasks';

export function renderDia(c: HTMLElement): void {
  const day = todayKey();
  const tasks = getDayTasks(day);
  const score = dayScore(tasks);
  const done = doneCount(tasks);
  const pct = score ?? 0;
  const allDone = tasks.length > 0 && done === tasks.length;

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
      allDone
        ? '<section class="card day-done"><span class="day-done__tag">Todo listo 🎉</span><p>Día completo. Tocá el círculo de una tarea para retroceder si cambiás de idea.</p></section>'
        : tasks.length
          ? ''
          : '<section class="card empty-state"><p>No tenés tareas para hoy.</p><p class="hint">Agregalas acá abajo, o copiá la rutina de otro día desde Ajustes.</p></section>'
    }

    <div data-tasks></div>
  `;

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
    `¿Copiar las ${hoy.length} tareas de hoy al resto del mes actual? Se conservan tus tareas manuales y se respeta el estado ya marcado en cada día.`
  );
  if (!ok) return;

  const year = new Date().getFullYear();
  const month = new Date().getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const startDay = new Date().getDate();

  mutate((s) => {
    // Solo del día de hoy en adelante: los días previos quedan sin datos.
    for (let d = startDay; d <= days; d++) {
      const key = `${year}-${pad(month + 1)}-${pad(d)}`;
      if (key === todayKey()) continue;
      const exist = s.days[key] ?? [];
      const keep = exist.filter((t) => !(t.templateId && monthTemplates.has(t.templateId)));
      const copies = hoy.map((t) => ({ ...t, id: newId(), estado: 'NO_HICE' as const, hecho: undefined }));
      s.days[key] = [...keep, ...copies];
    }
  });
}