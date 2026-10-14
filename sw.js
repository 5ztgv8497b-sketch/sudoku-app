// Service worker: precache versionado + cache-first con autocuración.
// Bump VERSION en cada release para invalidar la caché.

const VERSION = 'v6';
const CACHE = `sudoku-app:${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/main.js',
  './js/game.js',
  './js/state.js',
  './js/storage.js',
  './js/timer.js',
  './js/theme.js',
  './js/ui/board.js',
  './js/ui/controls.js',
  './js/ui/modal.js',
  './js/ui/settings.js',
  './js/ui/stats.js',
  './js/ui/confetti.js',
  './js/ui/toast.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Navegación: servir el shell desde caché para funcionar offline
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((hit) => hit || fetch(req))
    );
    return;
  }

  // Assets: caché primero; si falta, red y guardar para la próxima
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
