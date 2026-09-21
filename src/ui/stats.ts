import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js';
import { dayScore, doneCount, scoreColor, scoreLabel } from '../lib/scoring';
import { dateKey, daysInMonth, keyToDate, monthLabel, pad, todayKey, todayParts } from '../lib/time';
import { getStateObj } from '../store';
import { ESTADOS, ESTADO_INFO } from '../types';
import type { Task } from '../types';

Chart.register(...registerables);

const ROW_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Instancias vivas: la pantalla se re-renderiza entera ante cada notify, así que
// se destruyen las previas al iniciar cada render (evita canvases "fantasma").
const charts: Chart[] = [];

// Mes en vista (persiste entre re-renders). Empieza en el mes actual.
let view = todayParts();

function cssColor(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function rgba(hex: string, a: number): string {
  const m = hex.replace('#', '').match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? [0, 0, 0];
  return `rgba(${m[0]},${m[1]},${m[2]},${a})`;
}

function shiftKey(key: string, delta: number): string {
  const d = keyToDate(key);
  d.setDate(d.getDate() + delta);
  return dateKey(d);
}

function isDoneDay(tasks: Task[]): boolean {
  return tasks.length > 0 && (dayScore(tasks) ?? 0) > 0;
}

function rachaActual(days: Record<string, Task[]>, today: string): number {
  let cursor = isDoneDay(days[today] ?? []) ? today : shiftKey(today, -1);
  let n = 0;
  while (isDoneDay(days[cursor] ?? [])) {
    n++;
    cursor = shiftKey(cursor, -1);
  }
  return n;
}

function heatmapHtml(days: Record<string, Task[]>, today: string): string {
  const monday = new Date(`${today}T00:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(start.getDate() - 13 * 7);

  let cells = '';
  let colLabels = '';
  for (let r = 0; r < 7; r++) {
    let prevMonth = -1;
    let cellRow = '';
    for (let w = 0; w < 14; w++) {
      const d = new Date(start);
      d.setDate(start.getDate() + w * 7 + r);
      const key = dateKey(d);
      const future = key > today;
      const tasks = days[key] ?? [];
      const score = tasks.length ? dayScore(tasks) ?? 0 : null;
      const style = score === null || future ? '' : `style="background:${scoreColor(score)}"`;
      const cls = [
        'hm-cell',
        future ? 'hm-cell--future' : '',
        score === 0 ? 'hm-cell--zero' : '',
        key === today ? 'hm-cell--today' : ''
      ].filter(Boolean).join(' ');
      cellRow += `<div class="${cls}" ${style} title="${key} · ${score === null ? 'Sin datos' : scoreLabel(score)} · ${tasks.filter((t) => t.estado === 'COMPLETA').length}/${tasks.length} completadas"></div>`;
      if (r === 0) {
        const m = d.getMonth();
        if (m !== prevMonth) {
          colLabels += `<span class="hm-month">${monthLabel(d.getFullYear(), d.getMonth())}</span>`;
          prevMonth = m;
        } else {
          colLabels += '<span></span>';
        }
      }
    }
    cells += `<div class="hm-row"><span class="hm-row__lbl">${ROW_LABELS[r]}</span><div class="hm-row__cells">${cellRow}</div></div>`;
  }

  return `
    <div class="hm-scroll">
      <div class="hm">
        <div class="hm-cols" style="grid-template-columns:repeat(14, 1fr)">${colLabels}</div>
        ${cells}
      </div>
    </div>
    <div class="hm-legend">
      <span>Menos</span>
      <div class="hm-legend__sw" style="background:var(--surface-2)"></div>
      <div class="hm-legend__sw" style="background:hsl(120 65% 30%)"></div>
      <div class="hm-legend__sw" style="background:hsl(120 65% 42%)"></div>
      <div class="hm-legend__sw" style="background:hsl(120 60% 32%)"></div>
      <span>Más</span>
      <span class="hint" style="margin-left:10px">Cada casilla es un día</span>
    </div>`;
}

export function renderStats(c: HTMLElement): void {
  charts.forEach((ch) => ch.destroy());
  charts.length = 0;

  const days = getStateObj().days;
  const allKeys = Object.keys(days)
    .filter((k) => (days[k] ?? []).length > 0)
    .sort();
  const today = todayKey();
  const tNow = todayParts();
  if (view.year > tNow.year || (view.year === tNow.year && view.month > tNow.month)) view = { ...tNow };
  const { year, month } = view;
  const isCurrent = year === tNow.year && month === tNow.month;
  const mPrefix = `${year}-${pad(month + 1)}`;
  const passedKeys = allKeys.filter((k) => k <= today); // nunca futuro
  const monthKeys = passedKeys.filter((k) => k.startsWith(mPrefix));
  const monthScores = monthKeys.map((k) => dayScore(days[k]) ?? 0);
  const promMes = monthScores.length ? monthScores.reduce((a, b) => a + b, 0) / monthScores.length : null;
  const perfectMes = monthKeys.filter((k) => dayScore(days[k]) === 1).length;
  const completadasMes = monthKeys.reduce((acc, k) => acc + doneCount(days[k]), 0);
  const totalMes = monthKeys.reduce((acc, k) => acc + days[k].length, 0);
  const racha = rachaActual(days, today);

  const dim = daysInMonth(year, month);
  const todayDay = Number(today.slice(8, 10)); // en el mes actual: solo días pasados + hoy
  const endDay = isCurrent ? Math.min(todayDay, dim) : dim;
  const dayNumbers = Array.from({ length: endDay }, (_, i) => i + 1);
  const perDay = dayNumbers.map((d) => {
    const t = days[`${mPrefix}-${pad(d)}`] ?? [];
    return t.length ? t : null;
  });
  const scoresByDay = perDay.map((t) => (t ? Math.round((dayScore(t) ?? 0) * 100) : null));

  // Tema consistente con el CSS.
  const ACCENT = cssColor('--accent', '#22c55e');
  const SURFACE = cssColor('--surface', '#1e293b');
  const MUTED = cssColor('--muted', '#475569');
  const TEXT = cssColor('--text-dim', '#94a3b8');
  const GRID = rgba('#334155', 0.35);
  const axisBase = { ticksColor: TEXT, gridColor: GRID };
  const axis = (ticksExtra: Record<string, unknown> = {}) => ({
    ticks: { color: axisBase.ticksColor, font: { size: 11 }, ...ticksExtra },
    grid: { color: axisBase.gridColor }
  });

  c.innerHTML = `
    <div class="stats">
    <header class="page-head stats-head">
      <button class="icon-btn" data-stats-nav="-1" aria-label="Mes anterior">‹</button>
      <div class="stats-head__title">
        <h1>Estadísticas</h1>
        <span class="date-line">${monthLabel(year, month)}</span>
      </div>
      <button class="icon-btn" data-stats-nav="1" aria-label="Mes siguiente" ${isCurrent ? 'disabled' : ''}>›</button>
    </header>
    ${monthKeys.length === 0 ? '<p class="hint">No hay registros en este mes.</p>' : ''}

    <section class="card" data-card="kpis">
      <h3>Resumen</h3>
      <div class="kpi-row">
        <div class="kpi"><span class="kpi__lbl">Promedio mes</span><div class="kpi__nums"><strong class="kpi__val">${promMes === null ? '—' : scoreLabel(promMes)}</strong></div></div>
        <div class="kpi"><span class="kpi__lbl">Racha</span><div class="kpi__nums"><strong class="kpi__val">${racha}</strong><span class="kpi__unit">días</span></div></div>
        <div class="kpi"><span class="kpi__lbl">Perfectos</span><div class="kpi__nums"><strong class="kpi__val">${perfectMes}</strong><span class="kpi__unit">días</span></div></div>
        <div class="kpi"><span class="kpi__lbl">Completadas</span><div class="kpi__nums"><strong class="kpi__val">${completadasMes}</strong><span class="kpi__unit">de ${totalMes}</span></div></div>
      </div>
    </section>

    <section class="card" data-card="line">
      <h3>Puntaje diario del mes</h3>
      <div class="chart-box"><canvas data-chart="line"></canvas></div>
    </section>

    <section class="card" data-card="heatmap">
      <h3>Mapa de actividad</h3>
      ${heatmapHtml(days, today)}
    </section>

    <section class="card" data-card="hist">
      <h3>Histograma de puntajes</h3>
      <div class="chart-box chart-box--sm"><canvas data-chart="hist"></canvas></div>
    </section>

    <section class="card" data-card="scatter">
      <h3>Tareas vs puntaje por día</h3>
      <div class="chart-box chart-box--sm"><canvas data-chart="scatter"></canvas></div>
    </section>

    <section class="card" data-card="bars">
      <h3>Completadas por día</h3>
      <div class="chart-box"><canvas data-chart="bars"></canvas></div>
    </section>

    <section class="card" data-card="doughnut">
      <h3>Estados del mes</h3>
      <div class="chart-box chart-box--sm"><canvas data-chart="doughnut"></canvas></div>
    </section>
    </div>
  `;

  const configs: Record<string, Record<string, unknown>> = {
    line: {
      type: 'line',
      data: {
        labels: dayNumbers.map(String),
        datasets: [
          {
            label: 'Puntaje',
            data: scoresByDay,
            borderColor: ACCENT,
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: ACCENT,
            fill: true,
            backgroundColor: rgba(ACCENT, 0.12)
          },
          promMes !== null
            ? {
                label: 'Promedio',
                data: dayNumbers.map(() => Math.round(promMes * 100)),
                borderColor: MUTED,
                borderDash: [6, 6],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false
              }
            : null
        ].filter(Boolean)
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { labels: { color: TEXT, boxWidth: 10, boxHeight: 10 } },
          tooltip: {
            backgroundColor: cssColor('--bg', '#0f172a'),
            borderColor: MUTED,
            borderWidth: 1,
            callbacks: { label: (ctx: { parsed: { y: number | null } }) => (ctx.parsed.y === null ? 'Sin datos' : `${ctx.parsed.y}%`) }
          }
        },
        scales: { x: axis(), y: axis({ stepSize: 20 }) }
      }
    },

    hist: {
      type: 'bar',
      data: {
        labels: ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'],
        datasets: [
          {
            label: 'Días',
            data: (() => {
              const bins = Array(10).fill(0);
              for (const k of monthKeys) {
                const pct = Math.round((dayScore(days[k]) ?? 0) * 100);
                bins[Math.min(9, Math.floor(pct / 10))]++;
              }
              return bins;
            })(),
            backgroundColor: ACCENT,
            borderRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: cssColor('--bg', '#0f172a'), borderColor: MUTED, borderWidth: 1 }
        },
        scales: { x: axis(), y: axis({ stepSize: 1, beginAtZero: true }) }
      }
    },

    scatter: {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Día',
            data: monthKeys.map((k) => ({
              x: (days[k] ?? []).length,
              y: Math.round((dayScore(days[k]) ?? 0) * 100),
              date: k
            })),
            showLine: false,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: monthKeys.map((k) => ((dayScore(days[k]) ?? 0) === 1 ? ACCENT : TEXT)),
            pointBorderColor: 'rgba(0,0,0,0.25)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: cssColor('--bg', '#0f172a'),
            borderColor: MUTED,
            borderWidth: 1,
            callbacks: {
              label: (ctx: { parsed: { x: number; y: number }; raw: { date: string } }) =>
                `${ctx.raw.date} · ${ctx.parsed.y}% con ${ctx.parsed.x} tareas`
            }
          }
        },
        scales: {
          x: { ...axis(), title: { display: true, text: 'Tareas del día', color: TEXT } },
          y: { ...axis({ stepSize: 20 }) }
        }
      }
    },

    bars: {
      type: 'bar',
      data: {
        labels: dayNumbers.map(String),
        datasets: [
          {
            label: 'Completadas',
            data: perDay.map((t) => (t ? doneCount(t) : null)),
            backgroundColor: ACCENT,
            borderRadius: 4
          },
          {
            label: 'Restantes',
            data: perDay.map((t) => (t ? t.length - doneCount(t) : null)),
            backgroundColor: rgba(MUTED, 0.6),
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: TEXT, boxWidth: 10, boxHeight: 10 } },
          tooltip: { backgroundColor: cssColor('--bg', '#0f172a'), borderColor: MUTED, borderWidth: 1 }
        },
        scales: { x: { ...axis(), stacked: true }, y: { ...axis({ beginAtZero: true }), stacked: true } }
      }
    },

    doughnut: {
      type: 'doughnut',
      data: {
        labels: ESTADOS.map((e) => ESTADO_INFO[e].label),
        datasets: [
          {
            data: ESTADOS.map((e) => monthKeys.reduce((acc, k) => acc + days[k].filter((t) => t.estado === e).length, 0)),
            backgroundColor: ESTADOS.map((e) => ESTADO_INFO[e].color),
            borderColor: SURFACE,
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: TEXT, boxWidth: 10, boxHeight: 10, padding: 14 }
          },
          tooltip: {
            backgroundColor: cssColor('--bg', '#0f172a'),
            borderColor: MUTED,
            borderWidth: 1,
            callbacks: {
              label: (ctx: { dataset: { data: number[] }; dataIndex: number }) => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const v = ctx.dataset.data[ctx.dataIndex];
                return `${v} · ${total ? Math.round((v / total) * 100) : 0}%`;
              }
            }
          }
        }
      }
    }
  };

  for (const canvas of c.querySelectorAll<HTMLCanvasElement>('canvas[data-chart]')) {
    const cfg = configs[canvas.dataset.chart ?? ''];
    if (cfg) charts.push(new Chart(canvas, cfg as unknown as ChartConfiguration));
  }

  c.querySelectorAll<HTMLElement>('[data-stats-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = Number(btn.dataset.statsNav);
      const d = new Date(view.year, view.month + dir, 1);
      view = { year: d.getFullYear(), month: d.getMonth() };
      renderStats(c);
    });
  });
}