// Service worker mínimo: permite instalar la app y que abra rápido.
// Siempre intenta traer la versión nueva de internet; si no hay señal, usa la guardada.
const CACHE = 'rugby-v1';
const BASICOS = ['/', '/index.html', '/estilos.css?v=1', '/icons/escudo.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Solo archivos de la app (nada de fotos, API ni Supabase)
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req)
      .then((r) => {
        if (r.ok) {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put(req, copia));
        }
        return r;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('/')))
  );
});
