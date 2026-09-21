import { newId } from '../lib/ids';
import { daysInMonth, pad } from '../lib/time';
import { hasRoutine, mutate } from '../store';
import type { Task } from '../types';
import { esc, num } from './common';

export interface OnbRow {
  nombre: string;
  cantidad: string;
  descripcion: string;
}

export function routineRowHTML(index: number, r: OnbRow): string {
  return `
    <div class="routine-row" data-routine-index="${index}">
      <div class="routine-row__main">
        <input class="routine-row__nombre" data-rf="nombre" placeholder="Tarea del día perfecto" required value="${esc(r.nombre)}" />
        <div class="routine-row__fields">
          <label>×<input data-rf="cantidad" type="number" min="1" inputmode="numeric" placeholder="cantidad opc." value="${esc(r.cantidad)}" size="6" /></label>
          <input data-rf="descripcion" placeholder="descripción (opc.)" value="${esc(r.descripcion)}" />
        </div>
      </div>
      <button class="icon-btn icon-btn--danger" data-routine-del type="button" aria-label="Quitar tarea">✕</button>
    </div>`;
}

export function routineState(r: OnbRow): Pick<Task, 'nombre' | 'descripcion' | 'cantidad'> {
  return {
    nombre: r.nombre.trim() || 'Tarea',
    descripcion: r.descripcion.trim(),
    cantidad: r.cantidad.trim() ? num(r.cantidad, 1) : undefined
  };
}

export function buildRoutineRows(rows: OnbRow[]): Task[] {
  return rows.map((r, i) => {
    const base = routineState(r);
    const id = newId();
    return { id, templateId: id, estado: 'NO_HICE', ...base };
  });
}

export function renderOnboarding(c: HTMLElement): void {
  if (hasRoutine()) return;
  let rows: OnbRow[] = [{ nombre: '', cantidad: '', descripcion: '' }];

  const draw = () => {
    c.innerHTML = `
      <div class="onboarding">
        <h1>Armemos tu día perfecto</h1>
        <p class="hint">Contame qué tareas componen un día ideal. Este plan se copiará a los días de hoy hasta fin de mes y después lo ajustás a mano.</p>
        <form data-onb>
          <div data-onb-rows>
            ${rows.map((r, i) => routineRowHTML(i, r)).join('')}
          </div>
          <button class="btn btn--ghost" data-onb-add type="button">+ Agregar otra tarea</button>
          <p class="hint">Terminá con <strong>Crear mi rutina</strong>.<br />Tip: tocá el círculo de cada tarea para avanzar su estado: No hice → A medias → Casi completa → Completa.</p>
          <button class="btn btn--primary btn--block" type="submit">Crear mi rutina</button>
        </form>
      </div>`;

    c.querySelector('[data-onb-add]')?.addEventListener('click', () => {
      rows = [...rows, { nombre: '', cantidad: '', descripcion: '' }];
      draw();
    });

    c.querySelector('[data-onb-rows]')?.addEventListener('click', (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('[data-routine-del]');
      if (!btn) return;
      const idx = Number(btn.closest<HTMLElement>('[data-routine-index]')?.dataset.routineIndex);
      if (rows.length > 1) {
        rows = rows.filter((_, i) => i !== idx);
        draw();
      }
    });

    c.querySelector('[data-onb-rows]')?.addEventListener('input', (ev) => {
      const el = ev.target as HTMLElement;
      const row = el.closest<HTMLElement>('[data-routine-index]');
      const field = el.dataset.rf;
      if (!row || !field) return;
      const idx = Number(row.dataset.routineIndex);
      rows[idx] = { ...rows[idx], [field]: (el as HTMLInputElement).value };
    });

    c.querySelector('form[data-onb]')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const valid = rows.filter((r) => r.nombre.trim());
      if (!valid.length) {
        window.alert('Agregá al menos una tarea con nombre.');
        return;
      }
      const routine = buildRoutineRows(valid);
      const year = new Date().getFullYear();
      const month = new Date().getMonth();
      const startDay = new Date().getDate();
      mutate((s) => {
        // La rutina arranca desde hoy (no desde el 1ro): los días previos
        // quedan sin datos y no cuentan en las estadísticas.
        for (let d = startDay; d <= daysInMonth(year, month); d++) {
          const key = `${year}-${pad(month + 1)}-${pad(d)}`;
          s.days[key] = routine.map((t) => ({ ...t, id: newId() }));
        }
      });
      window.location.hash = '#dia';
    });
  };

  draw();
}