import { newId } from '../lib/ids';
import { daysInMonth, pad } from '../lib/time';
import { hasRoutine, mutate } from '../store';
import type { Task } from '../types';
import { clamp, esc, num } from './common';

export interface OnbRow {
  nombre: string;
  hora: string;
  minuto: string;
  cantidad: string;
  descripcion: string;
}

export function routineRowHTML(index: number, r: OnbRow): string {
  return `
    <div class="routine-row" data-routine-index="${index}">
      <div class="routine-row__main">
        <input class="routine-row__nombre" data-rf="nombre" placeholder="Tarea del día perfecto" required value="${esc(r.nombre)}" />
        <div class="routine-row__fields">
          <span>a las
            <input data-rf="hora" type="number" min="0" max="23" inputmode="numeric" value="${Number(r.hora)}" size="2" /> :
            <input data-rf="minuto" type="number" min="0" max="59" inputmode="numeric" value="${Number(r.minuto)}" size="2" />
          </span>
          <label>×<input data-rf="cantidad" type="number" min="1" inputmode="numeric" placeholder="—" value="${esc(r.cantidad)}" size="3" /></label>
        </div>
        <input data-rf="descripcion" placeholder="descripción (opc.)" value="${esc(r.descripcion)}" />
      </div>
      <button class="icon-btn icon-btn--danger" data-routine-del type="button" aria-label="Quitar tarea">✕</button>
    </div>`;
}

export function routineState(r: OnbRow): Pick<Task, 'nombre' | 'descripcion' | 'cantidad' | 'hora' | 'minuto'> {
  return {
    nombre: r.nombre.trim() || 'Tarea',
    descripcion: r.descripcion.trim(),
    cantidad: r.cantidad.trim() ? num(r.cantidad, 1) : undefined,
    hora: clamp(num(r.hora, 9), 0, 23),
    minuto: clamp(num(r.minuto, 0), 0, 59)
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
  let rows: OnbRow[] = [
    { nombre: '', hora: '09', minuto: '00', cantidad: '', descripcion: '' }
  ];

  const draw = () => {
    c.innerHTML = `
      <div class="onboarding">
        <h1>Armemos tu día perfecto</h1>
        <p class="hint">Contame qué tareas componen un día ideal (nombre y horario). Este plan se copiará a todos los días del mes actual y después lo ajustás a mano.</p>
        <form data-onb>
          <div data-onb-rows>
            ${rows.map((r, i) => routineRowHTML(i, r)).join('')}
          </div>
          <button class="btn btn--ghost" data-onb-add type="button">+ Agregar otra tarea</button>
          <p class="hint">Terminá con <strong>Crear mi rutina</strong>.<br />Tip: tocá el círculo de cada tarea en tu día para avanzar su estado: No hice → A medias → Casi completa → Completa.</p>
          <button class="btn btn--primary btn--block" type="submit">Crear mi rutina</button>
        </form>
      </div>`;

    c.querySelector('[data-onb-add]')?.addEventListener('click', () => {
      rows = [...rows, { nombre: '', hora: '09', minuto: '00', cantidad: '', descripcion: '' }];
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
      mutate((s) => {
        for (let d = 1; d <= daysInMonth(year, month); d++) {
          const key = `${year}-${pad(month + 1)}-${pad(d)}`;
          s.days[key] = routine.map((t) => ({ ...t, id: newId() }));
        }
      });
      window.location.hash = '#dia';
    });
  };

  draw();
}