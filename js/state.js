// Store observable minimalista + acciones del juego.

import * as engine from './game.js';
import { loadGame, saveGame, loadSettings, saveSettings, loadStats, saveStats } from './storage.js';

export const DIFFICULTY_LABEL = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };

export const DEFAULT_SETTINGS = {
  theme: 'auto',
  autoCheck: true,
  showTimer: true,
  colors: { cellBg: null, cellAlt: null, boardBorder: null },
};

const EMPTY_STATS = {
  version: 2,
  byDifficulty: {
    easy: { played: 0, won: 0, abandoned: 0, bestMs: null, totalMs: 0 },
    medium: { played: 0, won: 0, abandoned: 0, bestMs: null, totalMs: 0 },
    hard: { played: 0, won: 0, abandoned: 0, bestMs: null, totalMs: 0 },
  },
  total: { played: 0, won: 0, abandoned: 0 },
  recent: [],
};

// Store observable. `watch(select, fn)` llama a fn al suscribirse y después solo cuando cambia
// el valor seleccionado (igualdad por referencia; en listas, elemento a elemento). Así cada vista
// se repinta cuando cambia SU dato, no en cada actualización del estado.
export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const store = {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      for (const fn of subs) fn(state);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    watch(select, fn) {
      let last = select(state);
      fn(last, state);
      return store.subscribe(() => {
        const next = select(state);
        if (sameValue(last, next)) return;
        last = next;
        fn(next, state);
      });
    },
  };
  return store;
}

// Igualdad superficial: dos listas son iguales si sus elementos lo son por referencia
function sameValue(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  return Object.is(a, b);
}

export const store = createStore({
  game: null,
  settings: DEFAULT_SETTINGS,
  stats: EMPTY_STATS,
  ui: { selectedModal: null, verifiedWrong: [], lastResult: null, timerHidden: false },
});

/* ---------- Inicialización ---------- */

export function init() {
  const loaded = loadSettings();
  const settings = { ...DEFAULT_SETTINGS, ...loaded, colors: { ...DEFAULT_SETTINGS.colors, ...(loaded.colors || {}) } };
  const stats = loadStats() || EMPTY_STATS;
  const game = loadGame();
  store.setState({ settings, stats, game });
  return { game };
}

/* ---------- Reloj de la partida ---------- */
// El tiempo acumulado vive en game.elapsedMs. Mientras corre, el tramo actual se suma al leer:
// el estado no se escribe en cada frame, solo al pausar o cuando el cronómetro guarda (~3 s).

let runStartedAt = null; // marca (ms) desde la que corre el reloj; null si está parado

const nowMs = () => performance.timeOrigin + performance.now();

// Tiempo transcurrido de `game` en el instante `t`
function elapsedAt(game, t) {
  return game.elapsedMs + (runStartedAt != null ? t - runStartedAt : 0);
}

export function elapsedNow() {
  const { game } = store.getState();
  return game ? elapsedAt(game, nowMs()) : 0;
}

export function isClockRunning() {
  return runStartedAt != null;
}

// Arranca el reloj de la partida activa. Devuelve false si no hay nada que contar.
export function resumeClock() {
  const { game } = store.getState();
  if (!game || game.finished || !game.running || runStartedAt != null) return false;
  runStartedAt = nowMs();
  return true;
}

// Para el reloj y guarda el tiempo exacto (pausa, segundo plano, cierre de la app)
export function pauseClock() {
  if (runStartedAt == null) return;
  const { game } = store.getState();
  const elapsed = game ? elapsedAt(game, nowMs()) : 0;
  runStartedAt = null;
  if (game && !game.finished) {
    const next = { ...game, elapsedMs: elapsed };
    store.setState({ game: next });
    saveGame(next);
  }
}

// Guarda el tiempo sin parar el reloj (cada ~3 s: así no se pierde si el sistema cierra la app)
export function saveClock() {
  if (runStartedAt == null) return;
  const { game } = store.getState();
  if (!game || game.finished) return;
  const t = nowMs();
  const next = { ...game, elapsedMs: elapsedAt(game, t) };
  runStartedAt = t;
  store.setState({ game: next });
  saveGame(next);
}

/* ---------- Juego ---------- */

let idCounter = 0;

/** ¿El usuario ha rellenado alguna casilla? Las pistas fijas no cuentan. */
export function hasProgress(game) {
  return game.user.some((v, i) => v !== game.puzzle[i]);
}

// Cuenta como jugada (abandonada) la partida con progreso que se sustituye por otra
function recordAbandoned(difficulty) {
  const { stats } = store.getState();
  const bucket = stats.byDifficulty[difficulty] || { played: 0, won: 0, abandoned: 0, bestMs: null, totalMs: 0 };
  const nextStats = {
    ...stats,
    byDifficulty: {
      ...stats.byDifficulty,
      [difficulty]: { ...bucket, played: bucket.played + 1, abandoned: bucket.abandoned + 1 },
    },
    total: { ...stats.total, played: stats.total.played + 1, abandoned: stats.total.abandoned + 1 },
  };
  store.setState({ stats: nextStats });
  saveStats(nextStats);
}

export function newGame(difficulty) {
  const prev = store.getState().game;
  if (prev && !prev.finished && hasProgress(prev)) recordAbandoned(prev.difficulty);
  runStartedAt = null; // la partida anterior deja de contar

  const { puzzle, solution, clues } = engine.generatePuzzle(difficulty);
  const game = {
    id: `g${Date.now()}-${idCounter++}`,
    difficulty,
    puzzle,
    solution,
    user: puzzle.slice(),
    elapsedMs: 0,
    running: true,
    mistakes: 0,
    finished: false,
    startedAt: Date.now(),
    clues,
  };
  store.setState({
    game,
    ui: { ...store.getState().ui, selectedModal: null, verifiedWrong: [], lastResult: null, timerHidden: false },
  });
  saveGame(game);
  return game;
}

export function selectCell(index) {
  const { game } = store.getState();
  if (!game || game.finished) return;
  const next = { ...game, selectedIndex: index };
  store.setState({ game: next });
  saveGame(next);
}

export function moveSelection(dRow, dCol) {
  const { game } = store.getState();
  if (!game || game.finished) return;
  const cur = game.selectedIndex ?? 0;
  const row = Math.floor(cur / 9);
  const col = cur % 9;
  const nr = Math.min(8, Math.max(0, row + dRow));
  const nc = Math.min(8, Math.max(0, col + dCol));
  const next = { ...game, selectedIndex: nr * 9 + nc };
  store.setState({ game: next });
  saveGame(next);
}

export function inputDigit(d) {
  const { game } = store.getState();
  if (!game || game.finished) return;
  const idx = game.selectedIndex;
  if (idx == null || game.puzzle[idx] !== 0) return; // casilla fija o nada seleccionado
  if (game.user[idx] === d) { erase(); return; } // mismo número otra vez: se borra y no cuenta como error

  const user = game.user.slice();
  user[idx] = d;

  let mistakes = game.mistakes;
  if (d !== game.solution[idx]) mistakes += 1;

  const next = { ...game, user, mistakes, selectedIndex: idx };
  store.setState({ game: next });
  saveGame(next);

  // ¿tablero completo?
  if (!user.includes(0)) {
    const v = engine.validate(user, game.solution);
    if (v.mismatches === 0) {
      finishGame();
      return;
    }
    import('./ui/toast.js').then(({ toast }) => toast('El tablero está completo pero hay errores. Prueba Verificar.'));
  }
}

export function erase() {
  const { game } = store.getState();
  if (!game || game.finished) return;
  const idx = game.selectedIndex;
  if (idx == null || game.puzzle[idx] !== 0) return;
  if (!game.user[idx]) return;
  const user = game.user.slice();
  user[idx] = 0;
  const next = { ...game, user };
  store.setState({ game: next });
  saveGame(next);
}

export function clearCellMarks() {
  const { ui } = store.getState();
  if (ui.verifiedWrong.length === 0 && ui.lastResult == null) return;
  store.setState({ ui: { ...ui, verifiedWrong: [], lastResult: null } });
}

export function toggleTimerHidden() {
  const { ui } = store.getState();
  store.setState({ ui: { ...ui, timerHidden: !ui.timerHidden } });
}

export function verify() {
  const { game } = store.getState();
  if (!game) return { empty: 0, filled: 0, mismatches: 0, complete: false, wrongIndices: [] };
  const v = engine.validate(game.user, game.solution);
  store.setState({ ui: { ...store.getState().ui, verifiedWrong: v.wrongIndices, lastResult: v } });
  return v;
}

export function finishGame() {
  const { game, stats } = store.getState();
  if (!game || game.finished) return;

  const elapsed = Math.round(elapsedAt(game, nowMs())); // tiempo exacto, aunque el último guardado sea reciente
  runStartedAt = null;

  const finishedGame = { ...game, elapsedMs: elapsed, finished: true, running: false };
  const d = game.difficulty;
  const bucket = stats.byDifficulty[d] || { played: 0, won: 0, abandoned: 0, bestMs: null, totalMs: 0 };
  const isBest = bucket.bestMs == null || elapsed < bucket.bestMs;

  const nextStats = {
    ...stats,
    byDifficulty: {
      ...stats.byDifficulty,
      [d]: {
        ...bucket,
        played: bucket.played + 1,
        won: bucket.won + 1,
        bestMs: isBest ? elapsed : bucket.bestMs,
        totalMs: bucket.totalMs + elapsed,
      },
    },
    total: { ...stats.total, played: stats.total.played + 1, won: stats.total.won + 1 },
    recent: [
      { date: Date.now(), difficulty: d, timeMs: elapsed, mistakes: game.mistakes },
      ...stats.recent,
    ].slice(0, 10),
  };

  store.setState({
    game: finishedGame,
    stats: nextStats,
    ui: { ...store.getState().ui, selectedModal: 'win', verifiedWrong: [], isRecord: isBest, timerHidden: false },
  });
  saveGame(finishedGame);
  saveStats(nextStats);
  return { isBest };
}

export function updateSettings(patch) {
  const { settings } = store.getState();
  const next = { ...settings, ...patch, colors: { ...settings.colors, ...(patch.colors || {}) } };
  store.setState({ settings: next });
  saveSettings(next);
}

export function resetStats() {
  store.setState({ stats: EMPTY_STATS });
  saveStats(EMPTY_STATS);
}

export function requestNewGame(difficulty) {
  const { game } = store.getState();
  if (game && !game.finished) {
    store.setState({ ui: { ...store.getState().ui, selectedModal: 'confirm-new' } });
    return;
  }
  newGame(difficulty);
}

export function closeModal() {
  store.setState({ ui: { ...store.getState().ui, selectedModal: null } });
}

export function openModal(name) {
  store.setState({ ui: { ...store.getState().ui, selectedModal: name } });
}
