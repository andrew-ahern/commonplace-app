/* ============================================================
   sw.js — Service Worker
   Caches all app files for offline use.
   Update CACHE_NAME version (e.g. cb-v2) to force a refresh
   on all devices next time they load the app online.
   ============================================================ */

const CACHE_NAME = 'cb-v1';

const APP_SHELL = [
  './index.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/schemas.js',
  './js/utils.js',
  './js/storage.js',
  './js/tags.js',
  './js/entries.js',
  './js/refs.js',
  './js/sync.js',
  './js/ui.newentry.js',
  './js/ui.browse.js',
  './js/ui.settings.js',
  './js/app.js',
];

// Install: cache all app shell files fresh from network
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(
        APP_SHELL.map(url =>
          fetch(url, { cache: 'no-store' }).then(res => cache.put(url, res))
        )
      )
    ).then(() => self.skipWaiting()) // activate immediately after caching
  );
});

// Activate: delete old caches, claim all clients
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

// Fetch: serve from cache; fall back to network for uncached requests
// Requests with cache: no-store bypass the SW (used for GitHub API calls)
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.cache === 'no-store') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => new Response('Offline', { status: 503 }));
    })
  );
});

// Message handler: version check and manual skip waiting
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION')  event.ports[0].postMessage(CACHE_NAME);
});
