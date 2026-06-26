const CACHE_NAME = 'lifestyle-assistant-v14';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/main.js',
  './js/compat.js',
  './js/core/utils.js',
  './js/core/storage.js',
  './js/data/constants.js',
  './js/data/content.js',
  './js/data/habits.js',
  './js/data/packs.js',
  './js/modules/ai.js',
  './js/modules/checkin.js',
  './js/modules/constitution.js',
  './js/modules/guide.js',
  './js/modules/habit.js',
  './js/modules/pomodoro.js',
  './js/modules/poster.js',
  './js/modules/stats.js',
  './js/modules/water.js',
  './js/ui/events.js',
  './js/ui/panels.js',
  './js/ui/render.js',
  './assets/icon-192.jpg',
  './assets/icon-512.jpg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url =>
          cache.add(url).catch(err => {
            console.warn('SW: failed to cache', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      // Network-first for HTML and JS to always get latest updates
      const isDynamic = event.request.destination === 'document'
        || event.request.url.endsWith('.html')
        || event.request.url.endsWith('.js');
      if (isDynamic) {
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
