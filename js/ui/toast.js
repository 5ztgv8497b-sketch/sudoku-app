// Mensajes transitorios tipo píldora.

const region = document.getElementById('toast-region');

export function toast(message, { duration = 2600 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  region.append(el);

  setTimeout(() => {
    el.classList.add('toast--leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);

  // no acumular más de 2
  while (region.children.length > 2) region.firstElementChild.remove();
}
