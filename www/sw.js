const CACHE_NAME = 'lifestyle-assistant-v31';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.min.css',
  './css/components.min.css',
  './css/uiverse-raw.min.css',
  './css/skin-targets.min.css',
  './css/sports.min.css',
  './css/ui-enhance.min.css',
  './js/app.js',
  './js/lazy.js',
  './js/main.js',
  './js/compat.js',
  './js/core/utils.js',
  './js/core/storage.js',
  './js/bundle/data.min.js',
  './js/bundle/modules.min.js',
  './js/bundle/ui.min.js',
  './js/modules/poster.js',
  './js/modules/pomodoro.js',
  './js/modules/ai.js',
  './js/modules/local-notify.js',
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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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

// ============================================================
// Web Push 事件处理（PWA 专用·后台推送）
// 仅在浏览器/PWA 环境中生效
// APK 环境由 Capacitor LocalNotifications 负责，此事件不会触发
// ============================================================
self.addEventListener('push', function(event) {
  var data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch(e) {
    data = { title: '习惯小助手提醒', body: event.data ? event.data.text() : '' };
  }
  var title = data.title || '习惯小助手提醒';
  var options = {
    body: data.body || '该完成习惯啦',
    icon: './assets/icon-192.jpg',
    badge: './assets/icon-192.jpg',
    vibrate: [200, 100, 200, 100, 300],
    tag: data.tag || 'habit-reminder',
    renotify: data.requireInteraction ? true : false,
    requireInteraction: data.requireInteraction || false,
    data: { habitId: data.habitId, url: data.url || './index.html' }
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var habitId = event.notification.data && event.notification.data.habitId;
  var targetUrl = './index.html';
  if (habitId) {
    targetUrl += '?habit=' + encodeURIComponent(habitId);
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/index.html') >= 0 && 'focus' in client) {
          // 如果已有打开的窗口，发送消息告知要聚焦哪个习惯
          client.postMessage({ type: 'notification-click', habitId: habitId });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
