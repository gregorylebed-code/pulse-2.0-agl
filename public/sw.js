// ShortHand Service Worker
// - Caches app shell for offline load
// - Serves offline fallback page for navigation requests
// - Handles notification clicks

const CACHE = 'shorthand-v4';
const OFFLINE_URL = '/offline.html';

// App shell assets to pre-cache (the index.html + offline page)
const PRECACHE = ['/', '/offline.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Remove old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // For navigation requests (page loads), use network-first with offline fallback
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Cache a fresh copy of the root
          if (url.pathname === '/') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(async () => {
          // Offline — try cache first, then offline page
          const cached = await caches.match(e.request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // For JS/CSS/image assets from same origin, cache-first
  if (url.origin === self.location.origin && (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  )) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
  }
});

// Notification click — focus or open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow('/');
      })
  );
});
