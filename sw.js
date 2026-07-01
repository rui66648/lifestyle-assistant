const CACHE_NAME = 'lifestyle-assistant-v24';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/components.css',
  './css/uiverse-raw.css',
  './css/skin-targets.css',
  './css/sports.css',
  './js/app.js',
  './js/lazy.js',
  './js/main.js',
  './js/compat.js',
  './js/core/utils.js',
  './js/core/storage.js',
  './js/bundle/data.js',
  './js/bundle/modules.js',
  './js/bundle/ui.js',
  './js/modules/poster.js',
  './js/modules/pomodoro.js',
  './js/modules/ai.js',
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
      const isHtml = event.request.destination === 'document' || event.request.url.endsWith('.html');
      const isStatic = event.request.destination === 'script' || event.request.destination === 'style'
        || event.request.url.endsWith('.js') || event.request.url.endsWith('.css');

      // Cache-first for JS/CSS: 优先读缓存，快；后台静默更新
      if (isStatic) {
        if (cached) {
          // 后台更新缓存（不阻塞响应）
          fetch(event.request).then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      }

      // Network-first for HTML: 确保获取最新版本
      if (isHtml) {
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      }

      // 其他资源（图片、字体等）
      return cached || fetch(event.request);
    })
  );
});
