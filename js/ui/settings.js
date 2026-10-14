// Panel de ajustes: tema, auto-comprobación, cronómetro y colores del tablero.

import { store, updateSettings } from '../state.js';
import { PRESETS } from '../theme.js';
import { toast } from './toast.js';

const themeBtns = document.querySelectorAll('[data-theme-choice]');
const autocheckInput = document.getElementById('settings-autocheck');
const showtimerInput = document.getElementById('settings-showtimer');
const colorCell = document.getElementById('color-cell');
const colorBorder = document.getElementById('color-border');
const presetBtns = document.querySelectorAll('.preset');

const FALLBACKS = { cellBg: '#ffffff', cellAlt: '#e8ebf4', boardBorder: '#3a4152' };

function resolvedColors(colors) {
  const dark = document.documentElement.dataset.theme === 'dark';
  const preset = colors.preset && colors.preset !== 'default' ? PRESETS[colors.preset] : null;
  return preset ? preset[dark ? 'dark' : 'light'] : colors;
}

function render(settings) {
  for (const btn of themeBtns) {
    btn.setAttribute('aria-checked', String(btn.dataset.themeChoice === settings.theme));
  }
  autocheckInput.checked = settings.autoCheck;
  showtimerInput.checked = settings.showTimer;

  const c = resolvedColors(settings.colors);
  colorCell.value = c.cellBg || FALLBACKS.cellBg;
  colorBorder.value = c.boardBorder || FALLBACKS.boardBorder;

  const activePreset = settings.colors.preset || 'default';
  for (const btn of presetBtns) {
    btn.classList.toggle('preset--active', btn.dataset.preset === activePreset);
  }
}

for (const btn of themeBtns) {
  btn.addEventListener('click', () => updateSettings({ theme: btn.dataset.themeChoice }));
}

autocheckInput.addEventListener('change', () => updateSettings({ autoCheck: autocheckInput.checked }));
showtimerInput.addEventListener('change', () => updateSettings({ showTimer: showtimerInput.checked }));

for (const btn of presetBtns) {
  btn.addEventListener('click', () => {
    // limpiar valores personalizados: el preset manda
    updateSettings({ colors: { preset: btn.dataset.preset, cellBg: null, cellAlt: null, boardBorder: null } });
  });
}

for (const [input, key] of [[colorCell, 'cellBg'], [colorBorder, 'boardBorder']]) {
  input.addEventListener('input', () => updateSettings({ colors: { [key]: input.value, preset: null } }));
}

document.getElementById('btn-reset-colors').addEventListener('click', () => {
  updateSettings({ colors: { preset: 'default', cellBg: null, cellAlt: null, boardBorder: null } });
  toast('Colores restablecidos');
});

store.watch((s) => s.settings, (settings) => render(settings));
