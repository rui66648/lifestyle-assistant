/**
 * 平台检测模块
 * 在 Capapitor APK 环境中返回 'apk'，在浏览器/PWA 环境中返回 'pwa'
 * 必须同步加载，在 defer 脚本之前执行
 */
(function() {
  'use strict';

  var _platform = 'pwa'; // 默认为 PWA/浏览器

  // 检测 Capacitor 原生环境 (APK)
  try {
    if (typeof Capacitor !== 'undefined' && Capacitor.getPlatform && Capacitor.getPlatform() === 'android') {
      _platform = 'apk';
    } else if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
      _platform = 'apk';
    }
  } catch(e) {}

  // 暴露全局标识
  window.__PLATFORM__ = _platform;

  // 工具方法
  window.isAPK = function() { return window.__PLATFORM__ === 'apk'; };
  window.isPWA = function() { return window.__PLATFORM__ === 'pwa'; };

  console.log('[Platform] 检测到运行环境:', _platform.toUpperCase());
})();
