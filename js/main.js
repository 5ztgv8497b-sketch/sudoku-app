// Bootstrap: conecta el HUD, los diálogos y el service worker al store, y arranca la partida.

import { store, init, newGame, requestNewGame, openModal, closeModal, verify, updateSettings, toggleTimerHidden, elapsedNow } from './state.js';
import { saveGame } from './storage.js';
import { startTimer, onClockTick, formatMs } from './timer.js';
import { DIFFICULTY_LABEL, hasProgress } from './state.js';
import { showDialog, hideAll, setHandlers } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { fireConfetti } from './ui/confetti.js';
import { watchForUpdates } from './ui/update.js';
import './theme.js';
import './ui/board.js';
import './ui/controls.js';
import './ui/settings.js';
import './ui/stats.js';

/* ---------- Inicio ---------- */

const difficultySelect = document.getElementById('difficulty-select');
const timerDisplay = document.getElementById('timer-display');
const mistakesDisplay = document.getElementById('mistakes-display');
const hudTimer = document.getElementById('hud-timer');
const autocheckSwitch = document.getElementById('autocheck-switch');

// Atajos de la pantalla de inicio (?new=easy|medium|hard): se leen una vez y se quitan de la URL
function takeShortcut() {
  const level = new URLSearchParams(location.search).get('new');
  if (!['easy', 'medium', 'hard'].includes(level)) return null;
  history.replaceState(null, '', location.pathname);
  return level;
}

/* ---------- HUD: cada parte se repinta solo cuando cambia su dato ---------- */

store.watch((s) => s.game && s.game.mistakes, (mistakes) => {
  if (mistakes != null) mistakesDisplay.textContent = String(mistakes);
});

// Cronómetro: el marcador cambia al cambiar el segundo, no en cada frame.
// Con el tiempo oculto se muestran guiones, pero el reloj sigue contando.
function showClock(ms) {
  const text = store.getState().ui.timerHidden ? '--:--' : formatMs(ms);
  if (timerDisplay.textContent !== text) timerDisplay.textContent = text;
}
onClockTick(showClock);
store.watch((s) => [s.game && s.game.id, s.game && s.game.finished, s.ui.timerHidden], () => showClock(elapsedNow()));

// Partida nueva o reanudada: el reloj corre desde ya (antes solo arrancaba con el primer toque)
store.watch((s) => s.game && s.game.id, () => {
  const { game: current } = store.getState();
  if (current && !current.finished) startTimer();
});

// Selector de dificultad al día, salvo mientras se confirma un cambio
store.watch((s) => [s.game && s.game.difficulty, s.ui.selectedModal], ([difficulty, modal]) => {
  if (difficulty && difficultySelect.value !== difficulty && modal !== 'confirm-new') {
    difficultySelect.value = difficulty;
  }
});

store.watch((s) => [s.settings.showTimer, s.settings.autoCheck, s.ui.timerHidden], ([showTimer, autoCheck, timerHidden]) => {
  hudTimer.style.display = showTimer ? '' : 'none';
  if (autocheckSwitch.checked !== autoCheck) autocheckSwitch.checked = autoCheck;
  hudTimer.setAttribute('aria-pressed', String(timerHidden));
});

autocheckSwitch.addEventListener('change', () => {
  updateSettings({ autoCheck: autocheckSwitch.checked });
});

/* ---------- Barra de progreso (relleno líquido + temblor al avanzar) ---------- */

const progressEl = document.getElementById('board-progress');
const progressFill = progressEl.querySelector('.progress__fill');
let lastProgress = null;
let lastProgressGameId = null;

function renderProgress(s) {
  if (!s.game) return;
  // El avance cuenta solo las casillas que el usuario descubre: las pistas fijas no suman
  let solved = 0;
  let pending = 0;
  for (let i = 0; i < 81; i++) {
    if (s.game.puzzle[i]) continue;
    if (s.game.user[i]) solved++;
    else pending++;
  }
  const pct = solved + pending > 0 ? Math.round((solved / (solved + pending)) * 100) : 0;
  if (s.game.id === lastProgressGameId && pct === lastProgress) return;

  progressEl.setAttribute('aria-valuenow', String(pct));

  if (s.game.id !== lastProgressGameId) {
    // partida nueva o reanudada: fijar el nivel sin animación ni temblor
    lastProgressGameId = s.game.id;
    lastProgress = pct;
    progressFill.style.transition = 'none';
    progressFill.style.width = `${pct}%`;
    void progressFill.offsetWidth;
    progressFill.style.transition = '';
    return;
  }

  progressFill.style.width = `${pct}%`;
  if (pct > lastProgress) {
    // reactivar el temblor en cada avance
    progressEl.classList.remove('progress--charging');
    void progressEl.offsetWidth;
    progressEl.classList.add('progress--charging');
  } else if (pct < lastProgress) {
    progressEl.classList.remove('progress--charging');
  }
  lastProgress = pct;
}

store.watch((s) => [s.game && s.game.id, s.game && s.game.user, s.game && s.game.puzzle], () => renderProgress(store.getState()));

/* ---------- Tap en el cronómetro: ocultar/mostrar el tiempo ---------- */

hudTimer.addEventListener('click', () => {
  toggleTimerHidden();
  toast(store.getState().ui.timerHidden ? 'Cronómetro oculto' : 'Cronómetro visible');
});

hudTimer.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    hudTimer.click();
  }
});

/* ---------- Acciones principales ---------- */

const confirmOk = document.getElementById('confirm-ok');

// Dificultad elegida mientras se confirma el reinicio
let pendingDifficulty = null;

document.getElementById('btn-new').addEventListener('click', () => {
  pendingDifficulty = difficultySelect.value;
  requestNewGame(difficultySelect.value);
});

difficultySelect.addEventListener('change', () => {
  // cambiar dificultad desde el select arranca partida nueva (con confirmación si procede)
  pendingDifficulty = difficultySelect.value;
  requestNewGame(difficultySelect.value);
});

confirmOk.addEventListener('click', () => {
  newGame(pendingDifficulty || difficultySelect.value);
  pendingDifficulty = null;
});

document.getElementById('btn-verify').addEventListener('click', () => {
  const v = verify();
  if (v.filled === 0) {
    toast('El tablero está vacío');
    return;
  }
  const parts = [`${v.filled - v.mismatches} correctas`, `${v.mismatches} incorrectas`, `${v.empty} vacías`];
  toast(parts.join(' · '));
});

/* ---------- Botones de paneles ---------- */

document.getElementById('btn-settings').addEventListener('click', () => openModal('settings'));
document.getElementById('btn-stats').addEventListener('click', () => openModal('stats'));
document.getElementById('btn-tips').addEventListener('click', () => openModal('tips'));

/* ---------- Diálogo de victoria ---------- */

const winDialog = document.getElementById('dialog-win');
const winTime = document.getElementById('win-time');
const winDifficulty = document.getElementById('win-difficulty');
const winMistakes = document.getElementById('win-mistakes');
const winRecord = document.getElementById('win-record');

document.getElementById('btn-win-new').addEventListener('click', () => {
  newGame(difficultySelect.value);
});

document.getElementById('btn-win-exit').addEventListener('click', () => {
  closeModal();
});

/* ---------- Sincronización de diálogos con el estado ---------- */

let currentModal = null;

store.watch((s) => s.ui.selectedModal, (modal) => {
  const s = store.getState();

  if (modal === 'win' && s.game) {
    winTime.textContent = formatMs(s.game.elapsedMs);
    winDifficulty.textContent = DIFFICULTY_LABEL[s.game.difficulty] || s.game.difficulty;
    winMistakes.textContent = String(s.game.mistakes);
    winRecord.hidden = !s.ui.isRecord;
  }

  if (modal === 'confirm-new') {
    const pending = s.game && !s.game.finished && hasProgress(s.game);
    document.getElementById('confirm-text').textContent = pending
      ? 'Perderás el progreso de la partida actual.'
      : 'Se generará un tablero nuevo.';
  }

  const previous = currentModal;
  currentModal = modal;
  hideAll();
  if (modal) showDialog(modal);
  if (modal === 'win' && previous !== 'win') fireConfetti(winDialog);
});

setHandlers({
  close: (name) => {
    // Si se cierra la confirmación sin aceptar, volver a la dificultad anterior del select
    if (name === 'confirm-new' && store.getState().ui.selectedModal === 'confirm-new') {
      closeModal();
      const { game } = store.getState();
      if (game) difficultySelect.value = game.difficulty;
    } else if (name === 'win' && store.getState().ui.selectedModal === 'win') {
      closeModal();
    } else if (name && ['settings', 'stats', 'tips'].includes(name) && store.getState().ui.selectedModal === name) {
      closeModal();
    }
  },
});

/* ---------- Guardar al salir (iOS standalone) ---------- */

window.addEventListener('pagehide', () => {
  const { game } = store.getState();
  if (game) saveGame(game);
});

/* ---------- Arranque: al final, con todas las vistas ya suscritas ---------- */

const { game } = init();
const shortcut = takeShortcut();
if (!game || game.finished) {
  // sin partida en curso (o terminada): arrancar una nueva; el atajo elige la dificultad
  const level = shortcut ?? game?.difficulty ?? difficultySelect.value;
  newGame(level);
  difficultySelect.value = level;
} else if (shortcut) {
  // reanudar: con partida en curso, el atajo pide confirmación antes de perderla
  pendingDifficulty = shortcut;
  requestNewGame(shortcut);
}

/* ---------- Service worker ---------- */
// No se registra en localhost para no estorbar el desarrollo con la caché;
// se prueba directo en la URL desplegada (HTTPS).

const swSupported = 'serviceWorker' in navigator;
const isProd = location.protocol === 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

if (swSupported && isProd) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(watchForUpdates)
      .catch(() => { /* sin SW: la app funciona igual */ });
  });
}
