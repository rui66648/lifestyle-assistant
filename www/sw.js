const CACHE_NAME = 'lifestyle-assistant-v82';
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
  './css/theme-zhongshi.min.css',
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
  // references 目录的请求不经过 SW，直接由浏览器处理
  if (event.request.url.includes('/references/')) {
    return;
  }
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
// ============================================================
self.addEventListener('push', function(event) {
  var data = {};
  try {
    if (event.data) {
      try {
        data = event.data.json();
      } catch(e) {
        data = { title: '习惯小助手提醒', body: event.data.text() };
      }
    }
  } catch(e) {
    data = { title: '习惯小助手提醒', body: '' };
  }
  
  var title = data.title || '习惯小助手提醒';
  var body = data.body || '该完成习惯啦';
  
  var options = {
    body: body,
    icon: './assets/icon-192.jpg',
    badge: './assets/icon-192.jpg',
    vibrate: data.vibrate || [200, 100, 200, 100, 300],
    tag: data.tag || 'habit-reminder',
    renotify: data.requireInteraction ? true : false,
    requireInteraction: data.requireInteraction || false,
    timestamp: Date.now(),
    actions: data.actions || [
      { action: 'open', title: '查看' },
      { action: 'dismiss', title: '稍后' }
    ],
    data: { 
      habitId: data.habitId, 
      url: data.url || './index.html',
      action: data.action || 'reminder'
    }
  };
  
  if (data.badge) options.badge = data.badge;
  if (data.icon) options.icon = data.icon;
  if (data.image) options.image = data.image;
  
  event.waitUntil(
    self.registration.showNotification(title, options).catch(function(e) {
      console.error('[SW] Push notification failed:', e);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  var data = event.notification.data || {};
  var habitId = data.habitId;
  var targetUrl = data.url || './index.html';
  var action = event.action;
  
  if (habitId) {
    var hash = '?habit=' + encodeURIComponent(habitId);
    if (targetUrl.indexOf('?') >= 0) {
      targetUrl += '&' + hash.substring(1);
    } else {
      targetUrl += hash;
    }
  }
  
  if (action === 'dismiss') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('/index.html') >= 0 && 'focus' in client) {
          client.postMessage({ 
            type: 'notification-click', 
            habitId: habitId,
            action: action
          });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    }).catch(function(e) {
      console.error('[SW] Notification click failed:', e);
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  var data = event.notification.data || {};
  console.log('[SW] Notification closed:', data.habitId);
});

self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-habit-schedule') {
    event.waitUntil(
      fetchScheduleFromServer().then(function(schedule) {
        if (schedule) {
          return self.registration.pushManager.getSubscription().then(function(sub) {
            if (sub) {
              return sendScheduleToServer(sub, schedule);
            }
          });
        }
      }).catch(function(e) {
        console.error('[SW] Sync failed:', e);
      })
    );
  }
});

async function fetchScheduleFromServer() {
  try {
    var clients = await self.clients.matchAll({ type: 'window' });
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      if (client.url.indexOf('/index.html') >= 0) {
        return new Promise(function(resolve) {
          var channel = new MessageChannel();
          channel.port1.onmessage = function(e) {
            resolve(e.data);
          };
          client.postMessage({ type: 'get-habit-schedule' }, [channel.port2]);
        });
      }
    }
  } catch(e) {}
  return null;
}

async function sendScheduleToServer(sub, schedule) {
  try {
    var pushConfig = await getPushConfig();
    if (!pushConfig || !pushConfig.workerUrl) return;
    
    var res = await fetch(pushConfig.workerUrl + '/push/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: sub,
        schedule: schedule,
        offset: -new Date().getTimezoneOffset()
      })
    });
    return res.ok;
  } catch(e) {
    return false;
  }
}

async function getPushConfig() {
  try {
    var clients = await self.clients.matchAll({ type: 'window' });
    for (var i = 0; i < clients.length; i++) {
      var client = clients[i];
      if (client.url.indexOf('/index.html') >= 0) {
        return new Promise(function(resolve) {
          var channel = new MessageChannel();
          channel.port1.onmessage = function(e) {
            resolve(e.data);
          };
          client.postMessage({ type: 'get-push-config' }, [channel.port2]);
        });
      }
    }
  } catch(e) {}
  return null;
}
