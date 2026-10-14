// Panel de estadísticas / resúmenes.

import { store, resetStats } from '../state.js';
import { DIFFICULTY_LABEL } from '../state.js';
import { formatMs } from '../timer.js';
import { toast } from './toast.js';

const content = document.getElementById('stats-content');

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function render(stats) {
  const rows = ['easy', 'medium', 'hard'].map((d) => {
    const b = stats.byDifficulty[d];
    const best = b.bestMs != null ? formatMs(b.bestMs) : '—';
    const cls = b.bestMs != null ? ' class="stats-table__best"' : '';
    return `<tr>
      <td>${DIFFICULTY_LABEL[d]}</td>
      <td>${b.played}</td>
      <td>${b.won}</td>
      <td${cls}>${best}</td>
      <td>${formatMs(b.totalMs)}</td>
    </tr>`;
  }).join('');

  const recent = stats.recent.length
    ? `<ul class="stats-recent">${stats.recent.map((r) => `
        <li>
          <strong>${DIFFICULTY_LABEL[r.difficulty] || r.difficulty}</strong>
          <span>${formatMs(r.timeMs)}</span>
          <span>${r.mistakes} err.</span>
          <span>${fmtDate(r.date)}</span>
        </li>`).join('')}</ul>`
    : '<p class="stats-empty">Aún no hay partidas terminadas.</p>';

  content.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr><th>Dificultad</th><th>Partidas</th><th>Resueltas</th><th>Mejor tiempo</th><th>Total</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td><strong>Total</strong></td><td>${stats.total.played}</td><td>${stats.total.won}</td><td></td><td></td></tr>
      </tfoot>
    </table>
    <h3 class="panel__heading">Últimas partidas</h3>
    ${recent}
  `;
}

document.getElementById('btn-reset-stats').addEventListener('click', () => {
  resetStats();
  toast('Estadísticas borradas');
});

store.watch((s) => s.stats, (stats) => render(stats));
