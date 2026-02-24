/* The Endless Dreams — Service Worker */
const CACHE_NAME = 'endless-dreams-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/favicon.svg', '/logo.svg'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy — always fetch fresh, cache as fallback
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Skip API and WebSocket requests
  if (url.pathname.startsWith('/api/') || url.protocol === 'ws:' || url.protocol === 'wss:') return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cache successful responses for static assets
        if (res.ok && (url.pathname.match(/\.(svg|png|jpg|ico|woff2?)$/))) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
