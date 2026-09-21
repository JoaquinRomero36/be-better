import { registerSW } from 'virtual:pwa-register';
import './styles.css';
import { hasRoutine, startAutoSync, subscribe } from './store';
import { renderOnboarding } from './ui/onboarding';
import { renderDia } from './ui/dia';
import { renderSemana } from './ui/semana';
import { renderAlmanaque } from './ui/almanaque';
import { renderStats } from './ui/stats';
import { renderAjustes } from './ui/ajustes';

registerSW({ immediate: true });

const app = document.getElementById('app')!;

type Route = 'dia' | 'semana' | 'stats' | 'almanaque' | 'ajustes';

const NAV: { route: Route; label: string }[] = [
  { route: 'dia', label: 'Día' },
  { route: 'semana', label: 'Semana' },
  { route: 'stats', label: 'Stats' },
  { route: 'almanaque', label: 'Almanaque' },
  { route: 'ajustes', label: 'Ajustes' }
];

function currentRoute(): Route {
  const h = location.hash.replace('#', '') as Route;
  return NAV.some((n) => n.route === h) ? h : 'dia';
}

function renderShell(): void {
  const route = currentRoute();
  app.innerHTML = `
    <div class="app-shell">
      <main class="content" id="content"></main>
      <nav class="nav">
        ${NAV.map((n) => `<a class="nav__item${n.route === route ? ' nav__item--active' : ''}" href="#${n.route}">${n.label}</a>`).join('')}
      </nav>
    </div>`;
}

function routeHandler(): void {
  if (!hasRoutine()) {
    app.innerHTML = `<main class="content"><div id="screen"></div></main>`;
    renderOnboarding(app.querySelector('#screen')!);
    return;
  }
  renderShell();
  const content = app.querySelector<HTMLElement>('#content')!;
  const route = currentRoute();
  if (route === 'dia') renderDia(content);
  else if (route === 'semana') renderSemana(content);
  else if (route === 'stats') renderStats(content);
  else if (route === 'almanaque') renderAlmanaque(content);
  else renderAjustes(content);
}

// Re-render de la ruta actual ante cualquier cambio de estado.
subscribe(() => routeHandler());

window.addEventListener('hashchange', routeHandler);

startAutoSync();
routeHandler();