// Motor de sudoku — puro, sin DOM. Rejilla plana de 81 enteros, 0 = vacía.

const ROWS = new Uint16Array(9);
const COLS = new Uint16Array(9);
const BOXES = new Uint16Array(9);

export function boxIndex(i) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function createConstraintMasks(grid) {
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const v = grid[i];
    if (v) {
      const bit = 1 << v;
      rows[Math.floor(i / 9)] |= bit;
      cols[i % 9] |= bit;
      boxes[boxIndex(i)] |= bit;
    }
  }
  return { rows, cols, boxes };
}

function candidatesOf(i, masks) {
  const bit = 0b1111111110 &
    ~(masks.rows[Math.floor(i / 9)] | masks.cols[i % 9] | masks.boxes[boxIndex(i)]);
  return bit;
}

/**
 * Resuelve la rejilla por backtracking con orden MRV.
 * Devuelve el número de soluciones encontradas (tope `limit`).
 * Con `randomize`, baraja el orden de candidatos (para generar rejillas).
 * Deja la primera solución escrita en `grid`.
 */
export function solve(grid, { limit = 1, randomize = false } = {}) {
  const masks = createConstraintMasks(grid);
  const empties = [];
  for (let i = 0; i < 81; i++) if (!grid[i]) empties.push(i);

  let found = 0;
  let budget = 400000; // tope de nodos para no colgarse

  function popcount(x) {
    let n = 0;
    while (x) { x &= x - 1; n++; }
    return n;
  }

  function digitsFromMask(bit) {
    const out = [];
    for (let d = 1; d <= 9; d++) if (bit & (1 << d)) out.push(d);
    if (randomize) {
      for (let k = out.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [out[k], out[j]] = [out[j], out[k]];
      }
    }
    return out;
  }

  function backtrack() {
    if (found >= limit || budget-- <= 0) return;
    // MRV: celda vacía con menos candidatos
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let k = 0; k < empties.length; k++) {
      const i = empties[k];
      if (grid[i]) continue;
      const mask = candidatesOf(i, masks);
      const count = popcount(mask);
      if (count === 0) return; // callejón sin salida
      if (count < bestCount) {
        bestCount = count;
        best = i;
        bestMask = mask;
        if (count === 1) break;
      }
    }
    if (best === -1) { found++; return; } // sin vacías: solución completa

    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxIndex(best);
    for (const d of digitsFromMask(bestMask)) {
      grid[best] = d;
      const bit = 1 << d;
      masks.rows[r] |= bit;
      masks.cols[c] |= bit;
      masks.boxes[b] |= bit;
      backtrack();
      if (found >= limit) return; // conservar la rejilla tal como quedó (con la solución)
      masks.rows[r] &= ~bit;
      masks.cols[c] &= ~bit;
      masks.boxes[b] &= ~bit;
      grid[best] = 0;
    }
  }

  backtrack();
  return found;
}

export function generateFullGrid() {
  const grid = new Array(81).fill(0);
  solve(grid, { limit: 1, randomize: true });
  return grid;
}

export function countSolutions(grid, limit = 2) {
  const copy = grid.slice();
  return solve(copy, { limit });
}

const DIFFICULTY = {
  easy: { target: 42, min: 40, max: 45 },
  medium: { target: 34, min: 32, max: 36 },
  hard: { target: 28, min: 26, max: 30 },
};

/**
 * Genera un puzzle con solución única quitando celdas en pares
 * con simetría 180°. Nunca sacrifica unicidad; el conteo de pistas
 * es objetivo blando dentro del rango de la dificultad.
 */
export function generatePuzzle(difficulty = 'easy', { timeBudgetMs = 2000 } = {}) {
  const cfg = DIFFICULTY[difficulty] || DIFFICULTY.easy;
  const start = Date.now();

  const solution = generateFullGrid();
  let best = null;

  const attempt = (symmetric) => {
    const puzzle = solution.slice();
    const order = [];
    for (let i = 0; i < 81; i++) order.push(i);
    shuffle(order);

    const seen = new Set();
    const pairs = symmetric ? [] : null;
    for (const i of order) {
      if (symmetric) {
        const j = 80 - i;
        if (seen.has(i) || seen.has(j)) continue;
        seen.add(i); seen.add(j);
        pairs.push([i, j]);
      }
    }

    const list = symmetric ? pairs : order.map((i) => [i]);
    for (const [a, b] of list) {
      if (countClues(puzzle) <= cfg.target) break;
      if (Date.now() - start > timeBudgetMs) break;
      const va = puzzle[a];
      const vb = b !== undefined ? puzzle[b] : 0;
      puzzle[a] = 0;
      if (b !== undefined && b !== a) puzzle[b] = 0;
      if (countSolutions(puzzle, 2) !== 1) {
        puzzle[a] = va;
        if (b !== undefined && b !== a) puzzle[b] = vb;
      }
    }
    return puzzle;
  };

  // Primer intento simétrico; si queda fuera de rango, reintento asimétrico.
  best = attempt(true);
  const clues1 = countClues(best);
  if ((clues1 < cfg.min || clues1 > cfg.max) && Date.now() - start < timeBudgetMs) {
    best = attempt(false);
  }

  return { puzzle: best, solution, clues: countClues(best) };
}

function countClues(grid) {
  let n = 0;
  for (let i = 0; i < 81; i++) if (grid[i]) n++;
  return n;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function validate(user, solution) {
  const wrongIndices = [];
  let empty = 0;
  for (let i = 0; i < 81; i++) {
    if (!user[i]) { empty++; continue; }
    if (user[i] !== solution[i]) wrongIndices.push(i);
  }
  return {
    complete: empty === 0,
    empty,
    filled: 81 - empty,
    mismatches: wrongIndices.length,
    wrongIndices,
  };
}

export function isGiven(puzzle, i) {
  return puzzle[i] !== 0;
}

const PEERS = (() => {
  const cache = new Array(81);
  for (let i = 0; i < 81; i++) {
    const set = new Set();
    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    for (let k = 0; k < 9; k++) {
      set.add(r * 9 + k);       // fila
      set.add(k * 9 + c);       // columna
      set.add((br + Math.floor(k / 3)) * 9 + bc + (k % 3)); // caja
    }
    set.delete(i);
    cache[i] = set;
  }
  return cache;
})();

export function peersOf(i) {
  return PEERS[i];
}
