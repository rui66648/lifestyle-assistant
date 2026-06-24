const CACHE_NAME = 'lifestyle-assistant-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/hero_1280x720.jpg',
  './assets/icon-192.jpg',
  './assets/icon-512.jpg',
  './assets/charts.js',
  './_shared/fonts/InstrumentSans-Regular.ttf',
  './_shared/fonts/InstrumentSans-Bold.ttf',
  './_shared/fonts/GeistMono-Regular.ttf'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      // Network-first for HTML to get latest updates
      if (event.request.destination === 'document' || event.request.url.endsWith('.html')) {
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      }
      return cached || fetch(event.request);
    })
  );
});
