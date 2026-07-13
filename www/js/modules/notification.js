/**
 * 浏览器通知模块（PWA 专用）
 * - 基于 Web Notification API
 * - APK 环境中不适用（由 Capacitor LocalNotifications 负责）
 */
(function() {
  'use strict';

  // === APK 环境：跳过 ===
  if (window.__PLATFORM__ === 'apk') {
    if (!window.App) window.App = {};
    if (!App.Modules) App.Modules = {};
    App.Modules.Notification = {
      requestPermission: function() { return Promise.resolve(false); },
      showNotification: function() {},
      showLocalNotification: function() {}
    };
    return;
  }

  // ============================================================
  // PWA 环境：浏览器 Notification API
  // ============================================================

  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      showToast('您的浏览器不支持通知功能');
      return Promise.resolve(false);
    }
    if (Notification.permission === 'granted') {
      return Promise.resolve(true);
    }
    if (Notification.permission === 'denied') {
      showToast('请先在浏览器设置中开启通知权限');
      return Promise.resolve(false);
    }
    return Notification.requestPermission().then(function(permission) {
      if (permission === 'granted') {
        showToast('已开启通知权限');
        return true;
      }
      showToast('通知权限未开启');
      return false;
    });
  }

  function showLocalNotification(title, body, icon) {
    if (Notification.permission !== 'granted') return;
    try {
      var notif = new Notification(title, {
        body: body,
        icon: icon || './assets/icon-192.jpg',
        badge: './assets/icon-192.jpg',
        tag: 'lifestyle-reminder',
        requireInteraction: true,
        silent: false,
        renotify: true
      });
      if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 300]);
      notif.onclick = function(){
        window.focus();
        notif.close();
      };
    } catch(e) {
      console.warn('通知发送失败:', e);
    }
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Notification = {
    requestPermission: requestNotificationPermission,
    showNotification: showLocalNotification,
    showLocalNotification: showLocalNotification
  };
})();