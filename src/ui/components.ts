import { ESTADO_INFO } from '../types';
import type { Estado, Task } from '../types';
import { esc } from './common';

export function estadoLabel(e: Estado): string {
  return ESTADO_INFO[e].label;
}

export function taskRow(t: Task): string {
  const info = ESTADO_INFO[t.estado];
  const done = t.estado === 'COMPLETA';
  const hasQty = typeof t.cantidad === 'number' && t.cantidad > 0;
  const counter = hasQty ? counterStepper(t) : '';
  const desc = t.descripcion ? ` <span class="task__desc">· ${esc(t.descripcion)}</span>` : '';
  const cls = done ? ' task--done' : '';
  return `
    <li class="task${cls}" data-id="${t.id}">
      <button class="task__cycle" data-action="cycle" data-id="${t.id}" aria-label="Cambiar estado"
        style="--c:${info.color}" title="${estadoLabel(t.estado)}">
        <span class="cycle-dot"></span>
      </button>
      <div class="task__body">
        <span class="task__name">${esc(t.nombre)}</span>
        ${desc}
        ${counter}
      </div>
      <div class="task__actions">
        <button class="icon-btn" data-action="edit" data-id="${t.id}" aria-label="Editar tarea">✎</button>
        <button class="icon-btn icon-btn--danger" data-action="del" data-id="${t.id}" aria-label="Eliminar tarea">✕</button>
      </div>
    </li>`;
}

function counterStepper(t: Task): string {
  const hecho = t.hecho ?? 0;
  const total = t.cantidad ?? 0;
  const pct = Math.min(100, Math.round((hecho / total) * 100));
  return `
    <div class="task__count">
      <button class="icon-btn icon-btn--sm" data-action="uncount" data-id="${t.id}" aria-label="Restar una unidad">−</button>
      <div class="task__count-mid">
        <span class="task__count-num">${hecho} / ${total}</span>
        <div class="count-track"><div class="count-fill" style="width:${pct}%"></div></div>
      </div>
      <button class="icon-btn icon-btn--sm" data-action="count" data-id="${t.id}" aria-label="Sumar una unidad">+</button>
    </div>`;
}

export function taskList(tasks: Task[]): string {
  if (!tasks.length) return '<p class="empty">Sin tareas.</p>';
  const rows = tasks.map((t) => taskRow(t)).join('');
  return `<ul class="tasks__list">${rows}</ul>`;
}

export { ESTADO_INFO };