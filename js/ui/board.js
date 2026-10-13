// Tablero: 81 <button> (nunca inputs — así el teclado del SO no aparece en móvil),
// selección con roving tabindex, resaltado de pares/mismo número y teclado en desktop.

import { store, selectCell, moveSelection, inputDigit, erase, clearCellMarks } from '../state.js';
import { peersOf } from '../game.js';

const boardEl = document.getElementById('board');
const cells = [];

function createCells() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 81; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.index = i;
    btn.dataset.row = Math.floor(i / 9);
    btn.dataset.col = i % 9;
    const br = Math.floor(Math.floor(i / 9) / 3);
    const bc = Math.floor((i % 9) / 3);
    if ((br + bc) % 2 === 1) btn.classList.add('cell--alt');
    btn.setAttribute('role', 'gridcell');
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

function render(game, ui) {
  if (!game) return;
  const selected = game.selectedIndex;
  const selValue = selected != null ? game.user[selected] : 0;
  const peers = selected != null ? peersOf(selected) : null;
  const wrongSet = new Set(ui.verifiedWrong);
  const autoCheck = store.getState().settings.autoCheck;

  for (let i = 0; i < 81; i++) {
    const cell = cells[i];
    const v = game.user[i];
    const given = game.puzzle[i] !== 0;

    cell.textContent = v ? String(v) : '';
    cell.tabIndex = i === selected ? 0 : -1;
    cell.setAttribute('aria-readonly', String(given));

    cell.classList.toggle('cell--user', !given && v !== 0);

    const isPeer = peers?.has(i) ?? false;
    const isSame = v !== 0 && selValue !== 0 && v === selValue && i !== selected;
    cell.classList.toggle('cell--peer', isPeer && !isSame);
    cell.classList.toggle('cell--same', isSame);

    const isSelected = i === selected;
    cell.classList.toggle('cell--selected', isSelected);

    let isError = wrongSet.has(i);
    if (!isError && autoCheck && !given && v !== 0 && v !== game.solution[i]) isError = true;
    cell.classList.toggle('cell--error', isError);

    if (isSelected) {
      cell.setAttribute('aria-label', `Fila ${Math.floor(i / 9) + 1}, columna ${(i % 9) + 1}, valor ${v || 'vacío'}`);
    }
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
store.subscribe((s) => render(s.game, s.ui));

export { focusSelected };
