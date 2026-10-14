// Cronómetro de enfoque: corre mientras la app está visible y enfocada.
// El tiempo y su guardado viven en state.js. Aquí solo se despierta una vez por segundo para
// refrescar el marcador y guardar cada ~3 s (antes repintaba todo el estado 60 veces por segundo).

import { resumeClock, pauseClock, saveClock, elapsedNow, isClockRunning } from './state.js';

const SAVE_EVERY_MS = 2900; // los ticks llegan cada ~1 s: así se guarda cada ~3 s
const listeners = new Set();
let wakeId = null;
let savedAt = 0; // tiempo transcurrido en el último guardado

// fn(ms) se llama al arrancar, al parar y cada vez que cambia el segundo mostrado
export function onClockTick(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  const ms = elapsedNow();
  for (const fn of listeners) fn(ms);
}

function schedule() {
  // despertar justo cuando cambia el segundo mostrado: una vez por segundo
  wakeId = setTimeout(tick, 1000 - (elapsedNow() % 1000) + 1);
}

function tick() {
  wakeId = null;
  if (!isClockRunning()) return;
  const ms = elapsedNow();
  if (ms - savedAt >= SAVE_EVERY_MS) {
    saveClock();
    savedAt = ms;
  }
  notify();
  schedule();
}

export function startTimer() {
  // Con la app oculta no se cuenta: al volver a verla, visibilitychange vuelve a llamar aquí
  if (document.hidden || !resumeClock()) return;
  clearTimeout(wakeId);
  savedAt = elapsedNow();
  notify();
  schedule();
}

export function pauseTimer() {
  if (!isClockRunning()) return;
  pauseClock();
  clearTimeout(wakeId);
  wakeId = null;
  notify();
}

// Pausar al ocultar la pestaña o al cerrar la app (iOS ignora beforeunload)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTimer();
  else startTimer();
});
window.addEventListener('pagehide', pauseTimer);
window.addEventListener('blur', pauseTimer);
window.addEventListener('focus', startTimer);

export function formatMs(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
