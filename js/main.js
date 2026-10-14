// Bootstrap: inicializa estado, conecta eventos globales, diálogos y service worker.

import { store, init, newGame, requestNewGame, openModal, closeModal, verify, updateSettings, toggleTimerHidden } from './state.js';
import { saveGame } from './storage.js';
import { startTimer, pauseTimer, formatMs } from './timer.js';
import { DIFFICULTY_LABEL } from './state.js';
import { showDialog, hideAll, setHandlers } from './ui/modal.js';
import { toast } from './ui/toast.js';
import { fireConfetti } from './ui/confetti.js';
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

const { game } = init();
if (!game) {
  newGame(difficultySelect.value);
} else if (!game.finished) {
  // reanudar: la selección previa se conserva
  requestAnimationFrame(() => startTimer());
} else {
  // había una partida terminada: arrancar una nueva directamente
  newGame(game.difficulty);
}

/* ---------- HUD ---------- */

let lastGameId = null;

store.subscribe((s) => {
  // Partida nueva o reanudada → asegurar timer en marcha
  if (s.game && s.game.id !== lastGameId) {
    lastGameId = s.game.id;
    if (!s.game.finished) requestAnimationFrame(() => startTimer());
  }

  if (s.game) {
    // con el tiempo oculto se muestran guiones, pero el reloj sigue contando
    timerDisplay.textContent = s.ui.timerHidden ? '--:--' : formatMs(s.game.elapsedMs);
    mistakesDisplay.textContent = String(s.game.mistakes);
    // No pisar el select mientras se confirma un cambio de dificultad
    if (difficultySelect.value !== s.game.difficulty && s.ui.selectedModal !== 'confirm-new') {
      difficultySelect.value = s.game.difficulty;
    }
  }
  hudTimer.style.display = s.settings.showTimer ? '' : 'none';
  if (autocheckSwitch.checked !== s.settings.autoCheck) autocheckSwitch.checked = s.settings.autoCheck;
  renderProgress(s);
  syncTimerHidden(s);
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
  let filled = 0;
  for (const v of s.game.user) if (v) filled++;
  const pct = Math.round((filled / 81) * 100);
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

/* ---------- Tap en el cronómetro: ocultar/mostrar el tiempo ---------- */

function syncTimerHidden(s) {
  const attr = String(!!s.ui.timerHidden);
  if (hudTimer.getAttribute('aria-pressed') !== attr) hudTimer.setAttribute('aria-pressed', attr);
}

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

const confirmDialog = document.getElementById('dialog-confirm');
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

store.subscribe((s) => {
  const modal = s.ui.selectedModal;

  if (modal === 'win' && s.game) {
    winTime.textContent = formatMs(s.game.elapsedMs);
    winDifficulty.textContent = DIFFICULTY_LABEL[s.game.difficulty] || s.game.difficulty;
    winMistakes.textContent = String(s.game.mistakes);
    winRecord.hidden = !s.ui.isRecord;
  }

  if (modal !== currentModal) {
    const previous = currentModal;
    hideAll();
    currentModal = modal;
    if (modal) showDialog(modal);
    if (modal === 'win' && previous !== 'win') fireConfetti();
  }

  if (modal === 'confirm-new') {
    const hasProgress = s.game && !s.game.finished && s.game.user.some((v, i) => v !== s.game.puzzle[i]);
    document.getElementById('confirm-text').textContent = hasProgress
      ? 'Perderás el progreso de la partida actual.'
      : 'Se generará un tablero nuevo.';
  }
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

/* ---------- Service worker ---------- */
// No se registra en localhost para no estorbar el desarrollo con la caché;
// se prueba directo en la URL desplegada (HTTPS).

const swSupported = 'serviceWorker' in navigator;
const isProd = location.protocol === 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

if (swSupported && isProd) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* sin SW: la app funciona igual */ });
  });
}
