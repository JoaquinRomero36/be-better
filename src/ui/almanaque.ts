import { dayScore, scoreColor } from '../lib/scoring';
import { firstWeekOffset, isPast, isToday, monthKeys, monthLabel, todayParts } from '../lib/time';
import { getStateObj } from '../store';
import { renderDayTasks } from './dayTasks';

let view = todayParts();
let selected: string | null = null;

export function renderAlmanaque(c: HTMLElement): void {
  const { year, month } = view;
  const keys = monthKeys(year, month);
  const offset = firstWeekOffset(year, month);
  if (selected && !keys.includes(selected)) selected = null;

  const cells = keys
    .map((key) => {
      const tasks = getStateObj().days[key] ?? [];
      const score = dayScore(tasks);
      const past = isPast(key);
      const todayt = isToday(key);
      const style = score !== null && past ? `style="background:${scoreColor(score)}"` : past ? 'style="background:var(--muted)"' : '';
      return `
        <button class="cal-day${todayt ? ' cal-day--today' : ''}${selected === key ? ' cal-day--sel' : ''}" data-key="${key}" ${style}>
          <span>${key.slice(8)}</span>
          ${tasks.length ? `<i>${score === null ? '' : Math.round(score * 100) + '%'}</i>` : ''}
        </button>`;
    })
    .join('');

  c.innerHTML = `
    <header class="page-head cal-head">
      <button class="btn btn--ghost" data-cal-nav="-1" aria-label="Mes anterior">‹</button>
      <h1>${monthLabel(year, month)}</h1>
      <button class="btn btn--ghost" data-cal-nav="1" aria-label="Mes siguiente">›</button>
    </header>

    <section class="card cal-card">
      <div class="cal-weekdays">
        ${['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((w) => `<span>${w}</span>`).join('')}
      </div>
      <div class="cal-fill" style="--offset:${offset}">
        ${cells}
      </div>
      <p class="hint">Los días pasados se colorean según cuánto cumpliste. Tocá un día para verlo o editarlo.</p>
    </section>

    <div data-detail></div>
  `;

  c.querySelector('[data-cal-nav]')?.addEventListener('click', (ev) => {
    const dir = Number((ev.target as HTMLElement).dataset.calNav);
    const d = new Date(view.year, view.month + dir, 1);
    view = { year: d.getFullYear(), month: d.getMonth() };
    renderAlmanaque(c);
  });

  c.querySelectorAll<HTMLElement>('[data-key]').forEach((el) => {
    el.addEventListener('click', () => {
      selected = el.dataset.key ?? null;
      renderAlmanaque(c);
    });
  });

  const detail = c.querySelector<HTMLElement>('[data-detail]');
  if (selected && detail) {
    renderDayTasks(detail, selected);
  }
}