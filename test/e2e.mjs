import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const TMP_STATE = join(process.cwd(), 'data', 'state.json');

let serverChild = null;
let weStartedServer = false;

async function isUp() {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

async function killServer() {
  if (!serverChild) return;
  serverChild.kill();
  serverChild = null;
}

async function startServer() {
  if (await isUp()) return; // alguien ya lo dejó corriendo
  if (existsSync(TMP_STATE)) rmSync(TMP_STATE); // el test arranca de cero
  // Un solo proceso node (--import tsx) para poder matarlo limpio en Windows.
  serverChild = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'ignore' });
  weStartedServer = true;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (await isUp()) return;
  }
  throw new Error('El server no arrancó en tiempo razonable');
}

await startServer();

let passed = 0;
let failed = 0;

function ok(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function fetchState() {
  return fetch(`${BASE}/api/state`).then((r) => r.json());
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());

  console.log('\n[1] Onboarding — "día perfecto"');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  ok('onboarding visible', await page.getByRole('heading', { name: /Armemos tu día perfecto/ }).isVisible());

  await page.fill('[data-rf="nombre"]', 'Meditar');

  await page.click('[data-onb-add]');
  const rows = page.locator('[data-routine-index]');
  await rows.nth(1).locator('[data-rf="nombre"]').fill('Leer 20 min');

  await page.click('[data-onb-add]');
  await rows.nth(2).locator('[data-rf="nombre"]').fill('Pasear al perro');

  await rows.nth(1).locator('[data-routine-del]').click();
  ok('filas restantes', (await page.locator('[data-routine-index]').count()) === 2);

  await page.click('form[data-onb] button[type="submit"]');
  await page.waitForLoadState('networkidle');

  console.log('\n[2] Mi día');
  const diaToday = await page.locator('.card__head h2').first().textContent();
  ok(`título del día (${diaToday})`, (diaToday ?? '').toLowerCase().includes(todayKey().slice(8, 10)));
  const taskNames = await page.locator('.task__name').allTextContents();
  ok('Meditar en la lista', taskNames.includes('Meditar'));
  ok('Pasear al perro en la lista', taskNames.includes('Pasear al perro'));
  ok('sin Leer 20 min', !taskNames.includes('Leer 20 min'));
  ok('progreso 0/2', (await page.locator('.progress-card strong').textContent()).includes('0 / 2'));

  console.log('\n[3] Avance de estado del checklist (tap = ciclo)');
  ok('progreso inicial 0%', (await page.locator('.progress-score').textContent()).includes('0%'));
  const first = page.locator('.task').first();
  const dotTitle0 = await first.locator('.task__cycle').getAttribute('title');
  await first.locator('.task__cycle').click();
  await page.waitForTimeout(200);
  const dotTitle1 = (await first.locator('.task__cycle').getAttribute('title'));
  ok(`cicla No hice -> A medias (${dotTitle1})`, dotTitle0 === 'No hice' && dotTitle1 === 'A medias');
  await first.locator('.task__cycle').click();
  await page.waitForTimeout(200);
  ok('avanza a Casi completa', (await first.locator('.task__cycle').getAttribute('title')) === 'Casi completa');
  const pct = await page.locator('.progress-score').textContent();
  ok(`progreso sube (${pct})`, pct.includes('30%'));

  // la mutación se propaga al server
  console.log('\n[4] Sincronización con el server');
  await page.waitForTimeout(2000);
  const st = await fetchState();
  const remoteTasks = st.days?.[todayKey()] ?? [];
  ok('server tiene tareas de hoy', remoteTasks.length === 2);
  ok('server recibió el estado ciclado', remoteTasks.some((t) => t.estado === 'CASI_COMPLETA'));

  console.log('\n[5] CRUD local (agregar / editar / borrar) + contador');
  await page.click('[data-toggle-add]');
  await page.fill('[data-field="nombre"]', 'Ejercicio');
  await page.fill('[data-field="cantidad"]', '10');
  await page.click('form[data-form="task"] button[type="submit"]');
  ok('tarea agregada', (await page.locator('.task__name').allTextContents()).includes('Ejercicio'));

  // Contador de unidades: estado derivado (50% A medias, >75% Casi, 100% Completa) y sync al server
  const ejRow = () => page.locator('.task').filter({ hasText: 'Ejercicio' });
  const ejTxt = () => ejRow().locator('.task__count-num').textContent();
  const ejSt = () => ejRow().locator('.task__cycle').getAttribute('title');
  const clickN = async (loc, n) => {
    for (let i = 0; i < n; i++) {
      await loc.click();
      await page.waitForTimeout(150);
    }
  };

  ok('contador arranca en 0 / 10', (await ejTxt()) === '0 / 10');
  ok('0% -> No hice', (await ejSt()) === 'No hice');
  await clickN(ejRow().locator('[data-action="count"]'), 2);
  ok('2 / 10', (await ejTxt()) === '2 / 10');
  ok('20% sigue No hice', (await ejSt()) === 'No hice');
  await clickN(ejRow().locator('[data-action="count"]'), 3);
  ok('50% -> A medias', (await ejSt()) === 'A medias');
  await clickN(ejRow().locator('[data-action="count"]'), 1);
  ok('60% sigue A medias', (await ejSt()) === 'A medias');
  await clickN(ejRow().locator('[data-action="count"]'), 2);
  ok('80% -> Casi completa', (await ejSt()) === 'Casi completa');
  await clickN(ejRow().locator('[data-action="count"]'), 2);
  ok('100% -> Completa', (await ejSt()) === 'Completa');
  await clickN(ejRow().locator('[data-action="uncount"]'), 1);
  ok('90% -> Casi completa', (await ejSt()) === 'Casi completa');
  ok('9 / 10', (await ejTxt()) === '9 / 10');
  await page.waitForTimeout(1500);
  const stC = await fetchState();
  const ejRemote = stC.days?.[todayKey()]?.find((t) => t.nombre.startsWith('Ejercicio'));
  ok('estado derivado + hecho en el server', ejRemote?.estado === 'CASI_COMPLETA' && ejRemote?.hecho === 9);

  const ej = page.locator('.task').filter({ hasText: 'Ejercicio' });
  await ej.locator('[data-action="edit"]').click();
  await page.waitForTimeout(150);
  await page.fill('[data-field="nombre"]', 'Ejercicio mañana');
  await page.click('form[data-form="task"] button[type="submit"]');
  ok('tarea editada', (await page.locator('.task__name').allTextContents()).includes('Ejercicio mañana'));

  await page.locator('.task').filter({ hasText: 'Ejercicio mañana' }).locator('[data-action="del"]').click();
  await page.waitForTimeout(200);
  ok('tarea borrada', !(await page.locator('.task__name').allTextContents()).includes('Ejercicio mañana'));

  console.log('\n[6] Copiar rutina al mes sin duplicar');
  const maxMeditar = async () => {
    await page.waitForTimeout(1600); // espera el push al server
    const stR = await fetchState();
    let max = 0;
    for (const key of Object.keys(stR.days)) {
      const n = stR.days[key].filter((t) => t.nombre === 'Meditar').length;
      if (n > max) max = n;
    }
    return max;
  };
  await page.click('a[href="#ajustes"]');
  await page.waitForSelector('[data-aj="apply-month"]');
  await page.click('[data-aj="apply-month"]');
  await page.waitForTimeout(300);
  ok('primer copiado: sin duplicados', (await maxMeditar()) <= 1);
  // Reproduce el bug: borrar Meditar de hoy y re-agregarlo a mano (queda sin templateId).
  await page.click('a[href="#dia"]');
  await page.waitForSelector('[data-toggle-add]');
  await page.locator('.task').filter({ hasText: 'Meditar' }).locator('[data-action="del"]').click();
  await page.waitForTimeout(200);
  await page.click('[data-toggle-add]');
  await page.fill('[data-field="nombre"]', 'Meditar');
  await page.click('form[data-form="task"] button[type="submit"]');
  await page.waitForTimeout(300);
  await page.click('a[href="#ajustes"]');
  await page.waitForSelector('[data-aj="apply-month"]');
  await page.click('[data-aj="apply-month"]');
  await page.waitForTimeout(300);
  ok('re-aplicar tras re-agregar a mano: sin duplicados', (await maxMeditar()) <= 1);

  console.log('\n[7] Semana');
  await page.click('a[href="#semana"]');
  await page.waitForSelector('.wk-col');
  const wkCols = await page.locator('.wk-col').count();
  ok(`grilla de 7 días (${wkCols})`, wkCols === 7);
  ok('hoy resaltado', (await page.locator('.wk-col--today').count()) === 1);
  const wkItems = await page.locator('.wk-item').count();
  ok(`tareas por día (${wkItems})`, wkItems >= 2);
  ok('regularidad por tarea', (await page.locator('.reg-list li').count()) >= 2);

  console.log('\n[8] Almanaque');
  await page.click('a[href="#almanaque"]');
  await page.waitForSelector('.cal-day');
  const calDays = await page.locator('.cal-day').count();
  ok(`grilla del mes (${calDays} días)`, calDays >= 28);
  ok('hoy marcado', (await page.locator('.cal-day--today').count()) === 1);
  const colored = await page.locator('.cal-day').evaluateAll((els) =>
    els.filter((el) => el.getAttribute('style')?.includes('hsl')).length
  );
  ok(`ningún día pasado coloreado (rutina arranca hoy) (${colored})`, colored === 0);
  await page.locator('.cal-day--today').click();
  await page.waitForSelector('.card__head h2');
  ok('detalle de hoy editable', (await page.locator('.card__head h2').count()) >= 1);
  await page.locator('.cal-day').first().click();
  await page.waitForSelector('.day-summary');
  ok('resumen de día pasado (qué hice / qué no)', (await page.locator('.day-summary').count()) === 1);

  console.log('\n[9] Ajustes y respaldo');
  await page.click('a[href="#ajustes"]');
  await page.waitForSelector('[data-aj="sync"]'); // selector propio de Ajustes (evita race con el h1 previo)
  ok('panel de ajustes', (await page.locator('h1').textContent()) === 'Ajustes');
  const dl = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-aj="export"]')
  ]);
  ok(`descarga de respaldo (${dl[0].suggestedFilename()})`, dl[0].suggestedFilename().startsWith('be-better-'));
  const backupFile = join(tmpdir(), `be-better-e2e-${Date.now()}.json`);
  await dl[0].saveAs(backupFile);
  await page.evaluate(() => {
    window.confirm = () => true;
    window.alert = () => {};
  });
  await page.locator('[data-aj="import-file"]').setInputFiles(backupFile);
  await page.waitForSelector('.card__head', { timeout: 5000 });
  ok('import de respaldo (vuelve a Mi día)', (await page.locator('.card__head h2').count()) >= 1);
  await page.click('a[href="#ajustes"]');
  await page.waitForSelector('[data-aj="sync"]');
  await page.click('[data-aj="sync"]');
  await page.waitForTimeout(1500);
  ok('estado de sync en línea', (await page.locator('.sync-online').count()) === 1);

  console.log('\n[10] Estadísticas');
  await page.click('a[href="#stats"]');
  await page.waitForSelector('.kpi-row');
  ok('KPIs visibles', (await page.locator('.kpi').count()) >= 4);
  const canvases = await page.locator('.chart-box canvas').count();
  ok(`gráficos Chart.js (${canvases})`, canvases === 5);
  const hmCells = await page.locator('.hm-cell').count();
  ok(`mapa de actividad de 14 semanas (${hmCells} celdas)`, hmCells === 98);
  ok('5 pestañas en la nav', (await page.locator('.nav__item').count()) === 5);
} finally {
  await browser.close();
  await killServer();
}

console.log(`\nRESULTADO: ${passed} pasadas, ${failed} falladas\n`);

// Limpia el estado solo si el server lo levantó el test (no toca un server pre-existente).
if (weStartedServer && existsSync(TMP_STATE)) rmSync(TMP_STATE);

process.exit(failed ? 1 : 0);