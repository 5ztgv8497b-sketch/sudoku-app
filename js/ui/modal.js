// Helper genérico para <dialog>s: los muestra/cierra según el estado ui.selectedModal
// y gestiona Esc / clic en el fondo.

const DIALOGS = {
  'confirm-new': document.getElementById('dialog-confirm'),
  win: document.getElementById('dialog-win'),
  settings: document.getElementById('dialog-settings'),
  stats: document.getElementById('dialog-stats'),
  tips: document.getElementById('dialog-tips'),
};

let onOpen = null;
let onClose = null;

export function setHandlers({ open, close }) {
  onOpen = open;
  onClose = close;
}

export function getDialog(name) {
  return DIALOGS[name] ?? null;
}

export function showDialog(name) {
  const dlg = DIALOGS[name];
  if (dlg && !dlg.open) dlg.showModal();
  if (onOpen) onOpen(name);
}

export function hideDialog(name) {
  const dlg = DIALOGS[name];
  if (dlg && dlg.open) dlg.close(); // el evento 'close' notifica a onClose
}

export function hideAll() {
  for (const name of Object.keys(DIALOGS)) hideDialog(name);
}

// Nombre canónico de cada dialog (clave del mapa, no derivado del id)
const NAME_BY_DIALOG = new Map(Object.entries(DIALOGS).map(([name, dlg]) => [dlg, name]));

// Cerrar al hacer clic fuera del contenido
for (const dlg of Object.values(DIALOGS)) {
  if (!dlg) continue;
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  dlg.addEventListener('cancel', (e) => {
    // Esc: dejamos que el cierre se maneje vía estado
    e.preventDefault();
    dlg.close('escape');
  });
  dlg.addEventListener('close', () => {
    if (onClose) onClose(NAME_BY_DIALOG.get(dlg));
  });
}

// Botones ✕ de los paneles
document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const dlg = btn.closest('dialog');
    if (dlg) dlg.close();
  });
});
