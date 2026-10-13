// Teclado numérico 1-9 + borrar, con conteo restante por dígito.

import { store, inputDigit, erase } from '../state.js';

const numpadEl = document.getElementById('numpad');
const digitButtons = new Map();

function createNumpad() {
  const frag = document.createDocumentFragment();
  for (let d = 1; d <= 9; d++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'num-btn';
    btn.dataset.digit = d;
    btn.setAttribute('aria-label', `Número ${d}`);
    btn.innerHTML = `<span class="num-btn__digit">${d}</span><span class="num-btn__count" aria-hidden="true"></span>`;
    btn.addEventListener('click', () => {
      inputDigit(d);
      const { game } = store.getState();
      if (game && !game.finished) void 0; // la selección se mantiene para escribir en cadena
    });
    frag.append(btn);
    digitButtons.set(d, { btn, countEl: btn.querySelector('.num-btn__count') });
  }
  const eraseBtn = document.createElement('button');
  eraseBtn.type = 'button';
  eraseBtn.className = 'num-btn num-btn--erase';
  eraseBtn.setAttribute('aria-label', 'Borrar casilla');
  eraseBtn.innerHTML = '⌫';
  eraseBtn.addEventListener('click', erase);
  frag.append(eraseBtn);
  numpadEl.append(frag);
}

function render(game) {
  if (!game) return;
  const counts = new Array(10).fill(0);
  for (const v of game.user) if (v) counts[v]++;

  for (let d = 1; d <= 9; d++) {
    const { btn, countEl } = digitButtons.get(d);
    const remaining = 9 - counts[d];
    countEl.textContent = remaining > 0 ? String(remaining) : '✓';
    btn.classList.toggle('num-btn--done', remaining <= 0);
    btn.setAttribute('aria-label', `Número ${d}, quedan ${Math.max(0, remaining)}`);
  }
}

createNumpad();
store.subscribe((s) => render(s.game));
