// Tiempo de enfoque: corre desde 0 al iniciar la partida, pausa cuando la
// pestaña/app pasa a segundo plano. Mostrar u ocultar el display no afecta el conteo.

import { store, flushTimer } from './state.js';

let lastTick = null;   // marca de tiempo del último tick while running
let rafId = null;
let saveAccum = 0;

function now() {
  return performance.timeOrigin + performance.now();
}

function tick() {
  rafId = null;
  if (lastTick == null) return;
  const { game } = store.getState();
  if (!game || game.finished || !game.running) { lastTick = null; return; }

  const t = now();
  const delta = t - lastTick;
  lastTick = t;

  const elapsed = game.elapsedMs + delta;
  saveAccum += delta;
  // Guardar como máximo cada ~3 s para no martillar localStorage
  if (saveAccum >= 3000) {
    saveAccum = 0;
    flushTimer(elapsed);
  } else {
    // actualizar solo el display sin persistir
    store.setState({ game: { ...game, elapsedMs: elapsed } });
  }
  schedule();
}

function schedule() {
  if (rafId == null) rafId = requestAnimationFrame(tick);
}

export function startTimer() {
  const { game } = store.getState();
  if (!game || game.finished || !game.running) return;
  if (lastTick != null) return;
  lastTick = now();
  schedule();
}

export function pauseTimer() {
  if (lastTick == null) return;
  const t = now();
  const { game } = store.getState();
  if (game && !game.finished && game.running) {
    const elapsed = game.elapsedMs + (t - lastTick);
    store.setState({ game: { ...game, elapsedMs } });
    flushTimer(elapsed);
  }
  lastTick = null;
  if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
}

// Pausar al ocultar la pestaña o al cerrar la app (iOS ignora beforeunload)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTimer();
  else startTimer();
});
window.addEventListener('pagehide', pauseTimer);
window.addEventListener('blur', pauseTimer);
window.addEventListener('focus', () => {
  // pequeño retardo: al reenfocar, visibilitychange ya habrá arrancado
  startTimer();
});

export function formatMs(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
