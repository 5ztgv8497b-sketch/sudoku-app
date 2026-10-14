// Confeti en canvas, sin dependencias. Respeta prefers-reduced-motion.
// Se puede pasar un <dialog> abierto como anfitrión: al vivir en la top layer,
// el confeti se pinta por encima del velo del diálogo en lugar de quedar oculto.

export function fireConfetti(host = document.body) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  host.append(canvas);
  const ctx = canvas.getContext('2d');

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();

  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue('--accent').trim() || '#4f46e5';
  const palette = [accent, '#f59e0b', '#ec4899', '#10b981', '#3b82f6', '#f97316'];

  const N = 150;
  const parts = Array.from({ length: N }, () => ({
    x: (0.2 + Math.random() * 0.6) * canvas.width,
    y: (-0.1 + Math.random() * 0.25) * canvas.height,
    w: (6 + Math.random() * 6) * dpr,
    h: (9 + Math.random() * 8) * dpr,
    vx: (Math.random() - 0.5) * 2.4 * dpr,
    vy: (1.6 + Math.random() * 2.4) * dpr,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.22,
    color: palette[Math.floor(Math.random() * palette.length)],
    drag: 0.992 + Math.random() * 0.006,
  }));

  const t0 = performance.now();
  const DURATION = 3200;
  let raf = null;

  function frame(t) {
    const elapsed = t - t0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fade = elapsed > DURATION - 600 ? Math.max(0, (DURATION - elapsed) / 600) : 1;
    ctx.globalAlpha = fade;

    for (const p of parts) {
      p.vy += 0.035 * dpr;      // gravedad
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (elapsed < DURATION) {
      raf = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.remove();
      window.removeEventListener('resize', resize);
    }
  }

  window.addEventListener('resize', resize);
  raf = requestAnimationFrame(frame);
  void raf;
}
