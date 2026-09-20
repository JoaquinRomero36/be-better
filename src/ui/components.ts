import { ESTADO_INFO } from '../types';
import type { Estado, Task } from '../types';
import { fmtTime } from '../lib/time';
import { esc } from './common';

export function estadoLabel(e: Estado): string {
  return ESTADO_INFO[e].label;
}

export function taskRow(t: Task, opts: { current?: boolean; overdue?: boolean } = {}): string {
  const info = ESTADO_INFO[t.estado];
  const done = t.estado === 'COMPLETA';
  const qty = typeof t.cantidad === 'number' && t.cantidad > 0 ? `<span class="qty">×${t.cantidad}</span>` : '';
  const desc = t.descripcion ? ` <span class="task__desc">· ${esc(t.descripcion)}</span>` : '';
  const cls = [done && 'task--done', opts.current && 'task--current', opts.overdue && 'task--overdue'].filter(Boolean).join(' ');
  return `
    <li class="task ${cls}" data-id="${t.id}">
      <button class="task__cycle" data-action="cycle" data-id="${t.id}" aria-label="Cambiar estado"
        style="--c:${info.color}" title="${estadoLabel(t.estado)}">
        <span class="cycle-dot"></span>
      </button>
      <div class="task__body">
        <span class="task__name">${esc(t.nombre)}${qty}</span>
        <span class="task__time">${fmtTime(t.hora, t.minuto)}${desc}</span>
      </div>
      <div class="task__actions">
        <button class="icon-btn" data-action="edit" data-id="${t.id}" aria-label="Editar tarea">✎</button>
        <button class="icon-btn icon-btn--danger" data-action="del" data-id="${t.id}" aria-label="Eliminar tarea">✕</button>
      </div>
    </li>`;
}

export function taskList(tasks: Task[], nowMin?: number): string {
  if (!tasks.length) return '<p class="empty">Sin tareas.</p>';
  const rows = [...tasks]
    .sort((a, b) => a.hora * 60 + a.minuto - (b.hora * 60 + b.minuto))
    .map((t) =>
      taskRow(t, {
        current: false,
        overdue: nowMin !== undefined && t.estado !== 'COMPLETA' && t.hora * 60 + t.minuto < nowMin
      })
    )
    .join('');
  return `<ul class="tasks__list">${rows}</ul>`;
}

export { ESTADO_INFO };