// Capa de persistencia en localStorage con validación de forma.
// Degrada a memoria si localStorage no está disponible (modo privado).

const PREFIX = 'sudoku-app:v1:';
const KEYS = { game: `${PREFIX}game`, settings: `${PREFIX}settings`, stats: `${PREFIX}stats` };

const memory = new Map();

const available = (() => {
  try {
    const k = `${PREFIX}__probe`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

function readRaw(key) {
  if (available) return localStorage.getItem(key);
  return memory.get(key) ?? null;
}

function writeRaw(key, value) {
  if (available) {
    try { localStorage.setItem(key, value); } catch { /* cuota llena: ignorar */ }
  } else {
    memory.set(key, value);
  }
}

function parseJSON(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

const isInt81 = (a) => Array.isArray(a) && a.length === 81 && a.every((n) => Number.isInteger(n) && n >= 0 && n <= 9);

/* ---------- Partida ---------- */

export function loadGame() {
  const g = parseJSON(readRaw(KEYS.game));
  if (!g || typeof g !== 'object') return null;
  if (!isInt81(g.puzzle) || !isInt81(g.solution) || !isInt81(g.user)) return null;
  if (!['easy', 'medium', 'hard'].includes(g.difficulty)) return null;
  return {
    id: String(g.id ?? ''),
    difficulty: g.difficulty,
    puzzle: g.puzzle,
    solution: g.solution,
    user: g.user,
    selectedIndex: Number.isInteger(g.selectedIndex) ? g.selectedIndex : null,
    elapsedMs: Number.isFinite(g.elapsedMs) ? g.elapsedMs : 0,
    running: g.finished ? false : true,
    mistakes: Number.isFinite(g.mistakes) ? g.mistakes : 0,
    finished: !!g.finished,
    startedAt: Number.isFinite(g.startedAt) ? g.startedAt : Date.now(),
    clues: Number.isFinite(g.clues) ? g.clues : g.puzzle.filter((n) => n !== 0).length,
  };
}

export function saveGame(game) {
  writeRaw(KEYS.game, JSON.stringify(game));
}

/* ---------- Ajustes ---------- */

export function loadSettings() {
  const s = parseJSON(readRaw(KEYS.settings));
  if (!s || typeof s !== 'object') return {};
  const out = {};
  if (['auto', 'light', 'dark'].includes(s.theme)) out.theme = s.theme;
  if (typeof s.autoCheck === 'boolean') out.autoCheck = s.autoCheck;
  if (typeof s.showTimer === 'boolean') out.showTimer = s.showTimer;
  if (s.colors && typeof s.colors === 'object') {
    const valid = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null);
    out.colors = {
      cellBg: valid(s.colors.cellBg),
      cellAlt: valid(s.colors.cellAlt),
      boardBorder: valid(s.colors.boardBorder),
    };
  }
  return out;
}

export function saveSettings(settings) {
  writeRaw(KEYS.settings, JSON.stringify(settings));
}

/* ---------- Estadísticas ---------- */

export function loadStats() {
  const s = parseJSON(readRaw(KEYS.stats));
  if (!s || typeof s !== 'object' || !s.byDifficulty || !s.total || !Array.isArray(s.recent)) return null;
  return migrateStats(s);
}

// v2 añade `abandoned`: los datos v1 se completan a 0 sin perder nada
function migrateStats(s) {
  if (s.version >= 2) return s;
  const withAbandoned = (b) => ({ ...b, abandoned: Number.isFinite(b?.abandoned) ? b.abandoned : 0 });
  const byDifficulty = Object.fromEntries(Object.entries(s.byDifficulty).map(([d, b]) => [d, withAbandoned(b)]));
  return { ...s, version: 2, byDifficulty, total: withAbandoned(s.total) };
}

export function saveStats(stats) {
  writeRaw(KEYS.stats, JSON.stringify(stats));
}
