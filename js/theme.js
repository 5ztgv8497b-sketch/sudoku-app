// Tema: resolución auto/light/dark, sincronía con meta theme-color
// y overrides de color personalizados del tablero.
// Los presets tienen variante clara y oscura para garantizar contraste.

import { store } from './state.js';

const mq = window.matchMedia('(prefers-color-scheme: dark)');

export const PRESETS = {
  default: {
    light: { cellBg: null, cellAlt: null, boardBorder: null },
    dark: { cellBg: null, cellAlt: null, boardBorder: null },
  },
  classic: {
    light: { cellBg: '#fffdf7', cellAlt: '#f3e9d9', boardBorder: '#8a5a2b' },
    dark: { cellBg: '#2b2420', cellAlt: '#211b17', boardBorder: '#c89b6a' },
  },
  ocean: {
    light: { cellBg: '#f0f9ff', cellAlt: '#dbeefe', boardBorder: '#0369a1' },
    dark: { cellBg: '#17293b', cellAlt: '#101f2e', boardBorder: '#7dd3fc' },
  },
  rose: {
    light: { cellBg: '#fff5f7', cellAlt: '#ffe1e8', boardBorder: '#be123c' },
    dark: { cellBg: '#321c23', cellAlt: '#251519', boardBorder: '#fda4af' },
  },
};

function isDark() {
  const { settings } = store.getState();
  return settings.theme === 'dark' || (settings.theme === 'auto' && mq.matches);
}

function resolve() {
  const { settings } = store.getState();
  const dark = isDark();
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  syncMetaColor(dark);
}

function syncMetaColor(dark) {
  // Actualiza ambos meta theme-color para la chrome de iOS standalone
  const value = dark ? '#0e1118' : '#eef1f8';
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute('content', value);
  }
}

function applyColors() {
  const { settings } = store.getState();
  const root = document.documentElement.style;
  const c = settings.colors;

  // Si hay un preset activo, usar su variante según el tema resuelto
  const preset = c.preset && c.preset !== 'default' ? PRESETS[c.preset] : null;
  const colors = preset ? preset[isDark() ? 'dark' : 'light'] : c;

  if (colors.cellBg) root.setProperty('--cell-bg', colors.cellBg); else root.removeProperty('--cell-bg');
  if (colors.cellAlt) root.setProperty('--cell-bg-alt', colors.cellAlt); else root.removeProperty('--cell-bg-alt');
  if (colors.boardBorder) root.setProperty('--board-border', colors.boardBorder); else root.removeProperty('--board-border');
}

// Cambia el sistema entre claro y oscuro: en modo automático cambian también los presets
mq.addEventListener('change', () => {
  if (store.getState().settings.theme === 'auto') {
    resolve();
    applyColors();
  }
});

// Se aplica de inmediato con el estado actual y cada vez que cambian el tema o los colores
store.watch((s) => [s.settings.theme, s.settings.colors], () => {
  resolve();
  applyColors();
});
