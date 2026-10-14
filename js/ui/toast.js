// Mensajes transitorios tipo píldora. Con `action` añade un botón;
// con `duration: 0` no se cierra solo.

const region = document.getElementById('toast-region');

export function toast(message, { duration = 2600, action = null } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;

  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => {
      action.onClick();
      dismiss(el);
    });
    el.append(' ', btn);
  }

  region.append(el);
  if (duration > 0) setTimeout(() => dismiss(el), duration);

  // no acumular más de 2
  while (region.children.length > 2) region.firstElementChild.remove();
}

function dismiss(el) {
  if (!el.isConnected || el.classList.contains('toast--leaving')) return;
  el.classList.add('toast--leaving');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
