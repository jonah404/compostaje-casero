// Los módulos JS same-origin (p. ej. huerta-catalogo.js) van network-first: la caché
// es solo respaldo sin conexión, así que un deploy no deja a index.html con un módulo viejo.
// El resto de los archivos del shell (manifest, íconos, etc.) siguen cache-first:
// si cambian, hay que subir esta versión.
const CACHE = 'compost-tracker-v3';
const APP_SHELL = [
  '/',
  '/index.html',
  '/huerta-catalogo.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
// Fuentes de Google e íconos Tabler: se sirven de la caché y se refrescan en segundo plano.
const EXTERNAL_CACHE = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // Firebase/Open-Meteo: siempre a la red. Solo fuentes e íconos van por caché.
    if (EXTERNAL_CACHE.includes(url.hostname)) {
      event.respondWith(
        caches.open(CACHE).then(cache => cache.match(req).then(cached => {
          const red = fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
            return res;
          }).catch(() => cached);
          return cached || red;
        }))
      );
    }
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE).then(cache => cache.put('/index.html', res.clone()));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(req).then(res => {
        const copia = res.clone();
        caches.open(CACHE).then(c => c.put(req, copia));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      caches.open(CACHE).then(cache => cache.put(req, res.clone()));
      return res;
    }))
  );
});
