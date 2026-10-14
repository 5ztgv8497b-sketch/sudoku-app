// Tablero: 81 <button> (nunca inputs — así el teclado del SO no aparece en móvil),
// selección con roving tabindex, resaltado de pares/mismo número y teclado en desktop.

import { store, selectCell, moveSelection, inputDigit, erase, clearCellMarks } from '../state.js';
import { peersOf } from '../game.js';

const boardEl = document.getElementById('board');
const cells = [];
// Estado ya pintado de cada casilla (bits): si no cambia, el DOM no se toca
const painted = new Int16Array(81).fill(-1);

function createCells() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 81; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.index = i;
    btn.dataset.row = Math.floor(i / 9);
    btn.dataset.col = i % 9;
    btn.setAttribute('aria-label', `Fila ${btn.dataset.row * 1 + 1}, columna ${Number(btn.dataset.col) + 1}`);
    btn.addEventListener('click', () => {
      selectCell(i);
      clearCellMarks();
    });
    frag.append(btn);
    cells.push(btn);
  }
  boardEl.append(frag);
}

// Descripción para lectores de pantalla: posición, valor, si es pista fija y si está marcada como error
function cellLabel(i, v, given, isError) {
  const parts = [`Fila ${Math.floor(i / 9) + 1}, columna ${(i % 9) + 1}`, v ? `valor ${v}` : 'vacía'];
  if (given) parts.push('fija');
  if (isError) parts.push('incorrecta');
  return parts.join(', ');
}

// Solo se tocan las casillas cuyo estado cambió (valor, pista, selección, resaltados o error)
function render(game, ui, autoCheck) {
  const selected = game.selectedIndex ?? -1;
  const selValue = selected >= 0 ? game.user[selected] : 0;
  const peers = selected >= 0 ? peersOf(selected) : null;
  const wrongSet = new Set(ui.verifiedWrong);

  for (let i = 0; i < 81; i++) {
    const v = game.user[i];
    const given = game.puzzle[i] !== 0;
    const isSelected = i === selected;
    const isSame = v !== 0 && selValue !== 0 && v === selValue && !isSelected;
    const isTint = (peers?.has(i) ?? false) && !isSame;
    let isError = wrongSet.has(i);
    if (!isError && autoCheck && !given && v !== 0 && v !== game.solution[i]) isError = true;

    const bits = v | (given << 4) | (isSelected << 5) | (isTint << 6) | (isSame << 7) | (isError << 8);
    if (bits === painted[i]) continue;
    painted[i] = bits;

    const cell = cells[i];
    cell.textContent = v ? String(v) : '';
    cell.tabIndex = isSelected ? 0 : -1;
    cell.classList.toggle('cell--given', given);
    cell.classList.toggle('cell--user', !given && v !== 0);
    cell.classList.toggle('cell--peer', isTint);
    cell.classList.toggle('cell--same', isSame);
    cell.classList.toggle('cell--selected', isSelected);
    cell.classList.toggle('cell--error', isError);
    cell.setAttribute('aria-label', cellLabel(i, v, given, isError));
  }
}

/* ---------- Teclado (desktop) ---------- */

document.addEventListener('keydown', (e) => {
  const { game, ui } = store.getState();
  if (!game || ui.selectedModal) return;

  const key = e.key;
  const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
  const isDigit = /^[1-9]$/.test(key);

  if (isArrow) {
    e.preventDefault();
    if (game.selectedIndex == null) selectCell(0);
    else {
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
      moveSelection(d[0], d[1]);
    }
    clearCellMarks();
    focusSelected();
  } else if (isDigit) {
    e.preventDefault();
    inputDigit(Number(key));
    focusSelected();
  } else if (key === 'Backspace' || key === 'Delete' || key === '0') {
    e.preventDefault();
    erase();
    focusSelected();
  } else if (key === 'Escape') {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  }
});

function focusSelected() {
  const { game } = store.getState();
  if (game?.selectedIndex != null) cells[game.selectedIndex].focus({ preventScroll: true });
}

createCells();
// Solo se repinta cuando cambia algo que el tablero muestra (no con el cronómetro ni con los paneles)
store.watch(
  (s) => [s.game && s.game.user, s.game && s.game.selectedIndex, s.game && s.game.puzzle,
    s.game && s.game.solution, s.ui.verifiedWrong, s.settings.autoCheck],
  (_, s) => {
    if (s.game) render(s.game, s.ui, s.settings.autoCheck);
  },
);

export { focusSelected };
