import { newId } from '../lib/ids';
import { fmtDate, nowMinutes, todayKey } from '../lib/time';
import { mutate, getStateObj } from '../store';
import type { Task } from '../types';
import { ESTADOS } from '../types';
import { clamp, esc, num } from './common';
import { taskList } from './components';

interface Draft {
  nombre: string;
  hora: string;
  minuto: string;
  cantidad: string;
  descripcion: string;
}

const emptyDraft: Draft = { nombre: '', hora: '09', minuto: '00', cantidad: '', descripcion: '' };

let addOpen = false;
let editingId: number | null = null;
let draft: Draft = { ...emptyDraft };

export function getDayTasks(day: string): Task[] {
  return getStateObj().days[day] ?? [];
}

function taskFromDraft(existing?: Task): Task {
  const d = draft;
  return {
    id: existing?.id ?? newId(),
    templateId: existing?.templateId,
    nombre: d.nombre.trim() || 'Tarea',
    descripcion: d.descripcion.trim(),
    cantidad: d.cantidad.trim() ? Math.max(1, num(d.cantidad, 1)) : undefined,
    hora: clamp(num(d.hora, 9), 0, 23),
    minuto: clamp(num(d.minuto, 0), 0, 59),
    estado: existing?.estado ?? 'NO_HICE'
  };
}

function formHtml(isEdit: boolean): string {
  const d = draft;
  return `
    <form class="task-form" data-form="task">
      <div class="field">
        <label for="f-nombre">Nombre</label>
        <input id="f-nombre" data-field="nombre" required placeholder="Ej: Meditar" value="${esc(d.nombre)}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="f-hora">Hora</label>
          <input id="f-hora" data-field="hora" type="number" min="0" max="23" inputmode="numeric" value="${Number(d.hora)}" />
        </div>
        <div class="field">
          <label for="f-minuto">Minuto</label>
          <input id="f-minuto" data-field="minuto" type="number" min="0" max="59" inputmode="numeric" value="${Number(d.minuto)}" />
        </div>
        <div class="field">
          <label for="f-cantidad">Cantidad (opc.)</label>
          <input id="f-cantidad" data-field="cantidad" type="number" min="1" inputmode="numeric" placeholder="—" value="${esc(d.cantidad)}" />
        </div>
      </div>
      <div class="field">
        <label for="f-desc">Descripción (opc.)</label>
        <input id="f-desc" data-field="descripcion" placeholder="Detalle…" value="${esc(d.descripcion)}" />
      </div>
      <div class="form-actions">
        <button class="btn btn--primary" type="submit">${isEdit ? 'Guardar' : 'Agregar'}</button>
        <button class="btn" type="button" data-action="cancel-edit">Cancelar</button>
      </div>
    </form>`;
}

/**
 * Lista de tareas de un día con CRUD completo.
 * La delegación de clicks se enlaza una sola vez por contenedor (el día se
 * lee de `data-day`), así los re-renders no acumulan listeners duplicados.
 */
export function renderDayTasks(c: HTMLElement, day: string): void {
  c.dataset.day = day;
  const isEdit = editingId !== null;

  c.innerHTML = `
    <div class="card">
      <div class="card__head">
        <h2>${esc(fmtDate(day))}</h2>
        <button class="btn btn--ghost" data-toggle-add>${addOpen ? 'Cerrar' : '+ Agregar tarea'}</button>
      </div>
      ${addOpen ? formHtml(isEdit) : ''}
      <div data-task-list>${taskList(getDayTasks(day), day === todayKey() ? nowMinutes() : undefined)}</div>
    </div>`;

  c.querySelector('[data-toggle-add]')?.addEventListener('click', () => {
    addOpen = !addOpen;
    editingId = null;
    if (addOpen) draft = { ...emptyDraft };
    renderDayTasks(c, day);
  });

  const form = c.querySelector<HTMLFormElement>('form[data-form="task"]');
  if (form) {
    form.querySelectorAll<HTMLInputElement>('[data-field]').forEach((input) => {
      const field = input.dataset.field!;
      input.addEventListener('input', () => {
        draft = { ...draft, [field]: input.value };
      });
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const existing = editingId !== null ? getDayTasks(day).find((t) => t.id === editingId) : undefined;
      const task = taskFromDraft(existing);
      mutate((s) => {
        const list = (s.days[day] ??= []);
        const i = existing ? list.findIndex((t) => t.id === existing.id) : -1;
        if (i >= 0) list[i] = task;
        else list.push(task);
      });
      addOpen = false;
      editingId = null;
      draft = { ...emptyDraft };
    });
  }

  const bound = c as HTMLElement & { __dbtasks?: boolean };
  if (bound.__dbtasks) return;
  bound.__dbtasks = true;

  c.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    const btn = target.closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const d = (c as HTMLElement).dataset.day!;
    const action = btn.dataset.action;

    if (action === 'cancel-edit') {
      editingId = null;
      addOpen = false;
      draft = { ...emptyDraft };
      renderDayTasks(c, d);
      return;
    }

    const task = getDayTasks(d).find((t) => t.id === Number(btn.dataset.id));
    if (!task) return;

    if (action === 'cycle') {
      mutate((s) => {
        const list = s.days[d];
        const t = list?.find((x) => x.id === task.id);
        if (!t) return;
        const i = ESTADOS.indexOf(t.estado);
        t.estado = ESTADOS[(i + 1) % ESTADOS.length];
      });
    } else if (action === 'edit') {
      editingId = task.id;
      addOpen = true;
      draft = {
        nombre: task.nombre,
        hora: String(task.hora),
        minuto: String(task.minuto),
        cantidad: task.cantidad ? String(task.cantidad) : '',
        descripcion: task.descripcion
      };
      renderDayTasks(c, d);
    } else if (action === 'del') {
      const ok = window.confirm(`¿Eliminar "${task.nombre}"?`);
      if (!ok) return;
      mutate((s) => {
        const list = s.days[d] ?? [];
        s.days[d] = list.filter((x) => x.id !== task.id);
      });
      if (editingId === task.id) {
        editingId = null;
        addOpen = false;
      }
    }
  });
}