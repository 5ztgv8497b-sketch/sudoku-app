// Store observable minimalista + acciones del juego.

import * as engine from './game.js';
import { loadGame, saveGame, clearGame, loadSettings, saveSettings, loadStats, saveStats } from './storage.js';

export const DIFFICULTY_LABEL = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };

export const DEFAULT_SETTINGS = {
  theme: 'auto',
  autoCheck: true,
  showTimer: true,
  colors: { cellBg: null, cellAlt: null, boardBorder: null },
};

const EMPTY_STATS = {
  version: 1,
  byDifficulty: {
    easy: { played: 0, won: 0, bestMs: null, totalMs: 0 },
    medium: { played: 0, won: 0, bestMs: null, totalMs: 0 },
    hard: { played: 0, won: 0, bestMs: null, totalMs: 0 },
  },
  total: { played: 0, won: 0 },
  recent: [],
};

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  return {
    getState: () => state,
    setState(patch) {
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      for (const fn of subs) fn(state);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const store = createStore({
  game: null,
  settings: DEFAULT_SETTINGS,
  stats: EMPTY_STATS,
  ui: { selectedModal: null, verifiedWrong: [], lastResult: null },
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

/* ---------- Juego ---------- */

let idCounter = 0;

export function newGame(difficulty) {
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
    ui: { ...store.getState().ui, selectedModal: null, verifiedWrong: [], lastResult: null },
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

export function verify() {
  const { game } = store.getState();
  if (!game) return { empty: 0, filled: 0, mismatches: 0, complete: false, wrongIndices: [] };
  const v = engine.validate(game.user, game.solution);
  store.setState({ ui: { ...store.getState().ui, verifiedWrong: v.wrongIndices, lastResult: v } });
  return v;
}

function flushTimer(elapsedMs) {
  const { game } = store.getState();
  if (!game || game.finished) return;
  const next = { ...game, elapsedMs };
  store.setState({ game: next });
  saveGame(next);
}

export { flushTimer };

export function finishGame() {
  const { game, stats } = store.getState();
  if (!game || game.finished) return;

  const finishedGame = { ...game, finished: true, running: false };
  const d = game.difficulty;
  const bucket = stats.byDifficulty[d] || { played: 0, won: 0, bestMs: null, totalMs: 0 };
  const isBest = bucket.bestMs == null || game.elapsedMs < bucket.bestMs;

  const nextStats = {
    ...stats,
    byDifficulty: {
      ...stats.byDifficulty,
      [d]: {
        played: bucket.played + 1,
        won: bucket.won + 1,
        bestMs: isBest ? game.elapsedMs : bucket.bestMs,
        totalMs: bucket.totalMs + game.elapsedMs,
      },
    },
    total: { played: stats.total.played + 1, won: stats.total.won + 1 },
    recent: [
      { date: Date.now(), difficulty: d, timeMs: game.elapsedMs, mistakes: game.mistakes },
      ...stats.recent,
    ].slice(0, 10),
  };

  store.setState({
    game: finishedGame,
    stats: nextStats,
    ui: { ...store.getState().ui, selectedModal: 'win', verifiedWrong: [], isRecord: isBest },
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
