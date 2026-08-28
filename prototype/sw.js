// zenpai · service worker (PWA offline)
const CACHE = 'zenpai-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icono-zenpai.svg', './icono-maskable.svg', './marca-zenpai.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // imágenes, fuentes y CDN → cache-first (offline tras el primer uso)
  if (/\.(jpg|jpeg|png|webp|svg|woff2?)$/.test(url.pathname) || url.origin !== location.origin) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
      catch (_) { return hit || Response.error(); }
    }));
    return;
  }

  // navegación / HTML → network-first, con respaldo al shell cacheado
  e.respondWith(
    fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
