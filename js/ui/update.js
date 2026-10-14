// Aviso de versión nueva. La SW nueva espera hasta que el usuario pulsa "Actualizar":
// así no conviven en una misma sesión módulos de dos versiones.

import { toast } from './toast.js';

let reloadWhenControlled = false;

export function watchForUpdates(reg) {
  const offer = (worker) => toast('Hay una versión nueva', {
    duration: 10000,
    action: {
      label: 'Actualizar',
      onClick: () => {
        reloadWhenControlled = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
    },
  });

  // versión ya descargada en una visita anterior
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      // "installed" con controlador activo = actualización; en la primera instalación no hay aviso
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadWhenControlled) location.reload();
  });
}
