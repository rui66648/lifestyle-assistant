/**
 * Web Push 后台提醒模块（PWA 专用）
 * - 仅在 PWA/浏览器环境中生效
 * - APK 环境中直接跳过，由 Capacitor LocalNotifications 负责
 * - 订阅推送服务
 * - 上传习惯提醒时间表到云端，由 Cron 定时推送
 * iOS 需"添加到主屏幕"后才支持；Android Chrome 直接支持。
 */
(function(){
  'use strict';

  // === APK 环境：跳过，不注册任何 PWA 推送功能 ===
  if (window.__PLATFORM__ === 'apk') {
    console.log('[Push] APK 环境，跳过 Web Push 初始化（由 Capacitor 负责通知）');
    // 暴露空壳 API 防止调用报错
    if (!window.App) window.App = {};
    if (!App.Modules) App.Modules = {};
    App.Modules.Push = {
      init: function(){},
      subscribe: async function(){ return null; },
      requestPermissionAndSubscribe: async function(){ return null; },
      uploadSchedule: async function(){},
      buildSchedule: function(){ return []; },
      getWorkerUrl: function(){ return ''; },
      setWorkerUrl: function(){},
      testPush: async function(){},
      checkHealth: async function(){ return false; },
      enabled: false
    };
    return;
  }

  // ============================================================
  // PWA 环境：Web Push 推送
  // ============================================================

  var VAPID_PUBLIC_KEY = 'BM-yFa2y8NJ8iob-46qSH2sCjkRxr43gUgGbRAFJkoivKJ076fuXAHohFuCKh5pAp-UtLJYIztN9HU9oU6dJchg';
  var DEFAULT_WORKER_URL = '';

  var UPLOAD_THROTTLE = 60 * 1000;
  var _lastUpload = 0;

  function getWorkerUrl(){
    try {
      var cfg = JSON.parse(localStorage.getItem('push_config') || '{}');
      if (cfg.workerUrl) return cfg.workerUrl.replace(/\/$/, '');
    } catch(e){}
    return DEFAULT_WORKER_URL;
  }
  function setWorkerUrl(url){
    localStorage.setItem('push_config', JSON.stringify({ workerUrl: url }));
  }

  function urlBase64ToUint8Array(base64String){
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i=0; i<raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function buildSchedule(habits){
    var list = [];
    if (!habits || !habits.length) return list;
    habits.forEach(function(h){
      var item = { id: h.id, name: h.name, icon: h.icon, tip: h.tip || '' };
      if (h.reminder && h.reminder.enabled && h.reminder.time){
        item.fixed = {
          time: h.reminder.time,
          extraTimes: h.reminder.extraTimes || [],
          days: h.reminder.days || [0,1,2,3,4,5,6]
        };
      }
      if (h.intervalReminder && h.intervalReminder.enabled){
        item.interval = {
          interval: h.intervalReminder.interval || 120,
          startTime: h.intervalReminder.startTime || '08:00',
          endTime: h.intervalReminder.endTime || '22:00',
          days: h.intervalReminder.days || [0,1,2,3,4,5,6]
        };
      }
      if (item.fixed || item.interval) list.push(item);
    });
    return list;
  }

  async function subscribe(){
    if (!('serviceWorker' in navigator) || !('PushManager' in window)){
      throw new Error('浏览器不支持推送');
    }
    var reg = await navigator.serviceWorker.ready;
    var existing = await reg.pushManager.getSubscription();
    if (existing){
      await sendSubscription(existing);
      return existing;
    }
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    await sendSubscription(sub);
    return sub;
  }

  async function sendSubscription(sub){
    var url = getWorkerUrl();
    if (!url) throw new Error('请先在推送设置中填写 Worker URL');
    var res = await fetch(url + '/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    if (!res.ok) throw new Error('订阅上传失败(' + res.status + ')');
    return res.json();
  }

  async function uploadSchedule(habits, force){
    var now = Date.now();
    if (!force && now - _lastUpload < UPLOAD_THROTTLE) return;
    _lastUpload = now;
    var schedule = buildSchedule(habits);
    var offset = -new Date().getTimezoneOffset();
    var url = getWorkerUrl();
    if (!url) throw new Error('请先在推送设置中填写 Worker URL');

    var body = { schedule: schedule, offset: offset };
    try {
      var qh = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      if (qh && qh.enabled !== false) {
        body.quietHours = {
          enabled: true,
          start: qh.start || 22,
          end: qh.end || 7
        };
      }
    } catch(e) {}

    var res = await fetch(url + '/push/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('时间表上传失败(' + res.status + ')');
    return res.json();
  }

  async function testPush(){
    var url = getWorkerUrl();
    if (!url) throw new Error('请先在推送设置中填写 Worker URL');
    var res = await fetch(url + '/push/test', { method: 'POST' });
    if (!res.ok) throw new Error('测试推送失败(' + res.status + ')');
    return res.json();
  }

  async function checkWorkerHealth(){
    try {
      var url = getWorkerUrl();
      if (!url) return false;
      var res = await fetch(url + '/push/status');
      return res.ok;
    } catch(e){
      return false;
    }
  }

  async function requestPermissionAndSubscribe(){
    if (!('Notification' in window)) throw new Error('浏览器不支持通知');
    if (Notification.permission === 'denied') throw new Error('通知权限已被拒绝，请在浏览器设置中开启');
    if (Notification.permission === 'default'){
      var perm = await Notification.requestPermission();
      if (perm !== 'granted') throw new Error('未获得通知权限');
    }
    return await subscribe();
  }

  function setPushStatus(msg, color){
    var el = document.getElementById('pushStatus');
    if (el){
      el.textContent = msg || '';
      el.style.color = color || '';
    }
  }
  function updateEntryStatus(){
    var el = document.getElementById('pushSettingsStatus');
    if (!el) return;
    if (Notification.permission === 'granted') el.textContent = '已开启 · 后台提醒已生效';
    else el.textContent = '未开启 · 点击一键开启';
  }

  function updateToggleBtn(){
    var btn = document.getElementById('pushToggleBtn');
    if (!btn) return;
    if (Notification.permission === 'granted'){
      btn.textContent = '🔕 关闭推送';
      btn.style.background = 'linear-gradient(135deg,#666,#555)';
    } else {
      btn.textContent = '🔔 一键开启推送';
      btn.style.background = 'linear-gradient(135deg,#ff6b6b,#ee5a5a)';
    }
  }

  function showCustomUrlInput(show){
    var el = document.getElementById('pushCustomUrlContainer');
    if (!el) return;
    el.style.display = show ? 'block' : 'none';
  }

  window.openPushSettings = function(){
    if (typeof openPanel === 'function') openPanel('settingsPanel');
    if (typeof updateQuietHoursUI === 'function') setTimeout(updateQuietHoursUI, 50);
    setTimeout(function(){
      var el = document.getElementById('pushSettingsPanel');
      if (el){
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.boxShadow = '0 0 0 2px var(--accent)';
        setTimeout(function(){ el.style.boxShadow = ''; }, 1500);
      }
    }, 300);
    setTimeout(loadPushConfig, 100);
  };

  async function loadPushConfig(){
    updateEntryStatus();
    updateToggleBtn();
    var cfg = JSON.parse(localStorage.getItem('push_config') || '{}');
    var input = document.getElementById('pushWorkerUrl');
    if (input) input.value = cfg.workerUrl || '';
    var health = await checkWorkerHealth();
    if (!health && !cfg.workerUrl){
      setPushStatus('⚠️ 内置服务暂不可用，请手动配置 Worker URL', '#ff9f43');
      showCustomUrlInput(true);
    } else {
      setPushStatus('');
      showCustomUrlInput(!!cfg.workerUrl);
    }
  }

  window.savePushUrl = function(){
    var input = document.getElementById('pushWorkerUrl');
    var url = (input && input.value || '').trim();
    if (!url){
      localStorage.removeItem('push_config');
      setPushStatus('已恢复使用内置服务', '#2ecc71');
      showCustomUrlInput(false);
      return;
    }
    try { new URL(url); } catch(e){ setPushStatus('URL 格式不正确', '#ff6b6b'); return; }
    setWorkerUrl(url);
    setPushStatus('URL 已保存，正在验证...', '#2ecc71');
    checkWorkerHealth().then(function(ok){
      if (ok) setPushStatus('✅ URL 验证成功', '#2ecc71');
      else setPushStatus('❌ URL 不可访问', '#ff6b6b');
    });
  };

  window.togglePushNotification = async function(){
    var btn = document.getElementById('pushToggleBtn');
    if (btn) btn.disabled = true;

    try {
      if (!('Notification' in window)){
        throw new Error('浏览器不支持通知，请升级浏览器');
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window)){
        throw new Error('浏览器不支持推送功能');
      }

      if (Notification.permission === 'granted'){
        setPushStatus('正在关闭推送...', '#ff9f43');
        var reg = await navigator.serviceWorker.ready;
        var sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        setPushStatus('已关闭推送', '#666');
        updateEntryStatus();
        updateToggleBtn();
        return;
      }

      setPushStatus('正在开启推送...', '#2ecc71');
      await requestPermissionAndSubscribe();
      try {
        if (typeof habitsConfig !== 'undefined') await uploadSchedule(habitsConfig, true);
      } catch(e){ /* 忽略 */ }
      setPushStatus('✅ 推送已开启！', '#2ecc71');
      updateEntryStatus();
      updateToggleBtn();
    } catch(e){
      console.error('[push] toggle error:', e);
      setPushStatus('⚠️ ' + e.message, '#ff9f43');
      updateEntryStatus();
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.testPushNotification = async function(){
    if (Notification.permission !== 'granted'){
      setPushStatus('请先开启推送', '#ff6b6b');
      return;
    }
    setPushStatus('正在发送测试推送...', 'var(--accent)');
    try {
      var r = await testPush();
      setPushStatus(r.ok ? '✅ 测试推送已发送，注意查收' : '❌ 发送失败 ' + (r.status||''), r.ok ? '#2ecc71' : '#ff6b6b');
    } catch(e){
      setPushStatus('❌ ' + e.message, '#ff6b6b');
    }
  };

  window.syncPushSchedule = async function(){
    if (Notification.permission !== 'granted'){
      setPushStatus('请先开启推送', '#ff6b6b');
      return;
    }
    setPushStatus('正在同步时间表...', 'var(--accent)');
    try {
      var r = await uploadSchedule(typeof habitsConfig !== 'undefined' ? habitsConfig : [], true);
      setPushStatus('✅ 已同步 ' + (r.count||0) + ' 条习惯', '#2ecc71');
    } catch(e){
      setPushStatus('❌ ' + e.message, '#ff6b6b');
    }
  };

  async function init(){
    // PWA 环境初始化
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    updateEntryStatus();
    updateToggleBtn();
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (sub){
        await sendSubscription(sub);
        if (typeof habitsConfig !== 'undefined'){
          try { await uploadSchedule(habitsConfig); } catch(e){ /* 忽略 */ }
        }
      }
    } catch(e){ console.warn('[push] init error:', e.message); }
  }

  var _syncTimer = null;
  function scheduleSync(){
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function(){
      if (typeof habitsConfig !== 'undefined') uploadSchedule(habitsConfig).catch(function(){});
    }, 3000);
  }

  try {
    var origSave = window.saveData;
    if (typeof origSave === 'function'){
      window.saveData = function(){
        var r = origSave.apply(this, arguments);
        scheduleSync();
        return r;
      };
    }
  } catch(e){}

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};
  App.Modules.Push = {
    init: init,
    subscribe: subscribe,
    requestPermissionAndSubscribe: requestPermissionAndSubscribe,
    uploadSchedule: uploadSchedule,
    buildSchedule: buildSchedule,
    getWorkerUrl: getWorkerUrl,
    setWorkerUrl: setWorkerUrl,
    testPush: testPush,
    checkHealth: checkWorkerHealth,
    vapidPublicKey: VAPID_PUBLIC_KEY,
    enabled: true
  };
})();
