/**
 * 主入口模块（平台分化版）
 * - APK: Capacitor LocalNotifications 系统通知
 * - PWA: 浏览器 Notification API + Service Worker Push
 */
(function() {
  'use strict';

  var _platform = window.__PLATFORM__ || 'pwa';

  // ============================================================
  // 通用功能（两个平台共享）
  // ============================================================

  function initDarkMode() {
    const saved = localStorage.getItem('dark_mode');
    const checkbox = document.getElementById('themeCheckbox');
    const settingsCheckbox = document.getElementById('settingsThemeCheckbox');
    const icon = document.getElementById('themeIcon');

    let useDark;
    if (saved !== null) {
      useDark = saved === 'true';
    } else {
      useDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (useDark) {
      if (document.body) document.body.classList.add('dark');
      if (checkbox) checkbox.checked = true;
      if (settingsCheckbox) settingsCheckbox.checked = true;
      if (icon) icon.textContent = '🌙';
    } else {
      if (document.body) document.body.classList.remove('dark');
      if (checkbox) checkbox.checked = false;
      if (settingsCheckbox) settingsCheckbox.checked = false;
      if (icon) icon.textContent = '☀️';
    }
  }

  function checkModules() {
    if (App.checkDependencies) {
      const ok = App.checkDependencies();
      if (!ok) {
        console.warn('[main] 模块依赖不完整，尝试继续运行...');
        if (App.listModules) App.listModules();
      } else {
        console.log('[main] 所有模块加载完成');
        if (App.listModules) App.listModules();
      }
    }
  }

  function injectSkinTargetClasses() {
    var btnSelectors = '.const-btn,.tab,.health-pack-btn,.profile-grid-item,.mg-add-btn,.settings-btn,.checkin-input-actions button,.mini-quote-refresh,.mini-quote-ref,.skin-tab,.export-btn,.day-btn,.panel-close,.bnav-item,.bnav-center,.fab,.lib-tab,.lib-custom-input button,.lib-custom-type button,.lib-custom-reminder-add,.lib-custom-freq .weekdays button,.lib-item .add-btn,.health-pack-add-btn,.season-pack-btn,.season-pack-add-btn,.water-quick-btn,.water-qty-btn,.water-custom-btn,.heatmap-nav button,.edit-bar button,.emotion-btn,.ref-tab,.ref-lib-btn,.sd-tab,.he-btn,.he-btn-save,.skin-option,.rh-btn,.habit-card .checkin-btn,.reminder-option';
    var cardSelectors = '.habit-card,.stat-card,.mini-quote,.profile-stat-item,.mg-group,.mg-stat-card,.ai-message-bubble,.water-tracker,.diet-tip-card,.diet-meal-card,.diet-seasonal-card,.diet-color-card,.diet-habit-item,.diet-book-item,.lib-item';
    try {
      document.querySelectorAll(btnSelectors).forEach(function(el) {
        if (!el.classList.contains('skinnable-btn')) el.classList.add('skinnable-btn');
      });
      document.querySelectorAll(cardSelectors).forEach(function(el) {
        if (!el.classList.contains('skinnable-card')) el.classList.add('skinnable-card');
      });
    } catch(e) { console.warn('[skin-targets] inject failed:', e); }
  }
  window.injectSkinTargetClasses = injectSkinTargetClasses;

  // ============================================================
  // 平台感知的初始化入口
  // ============================================================
  function initApp() {
    console.log('[main] 平台:', _platform.toUpperCase(), '初始化开始');

    checkModules();
    if (App.UI && App.UI.Panels && App.UI.Panels.initAllSkins) {
      App.UI.Panels.initAllSkins();
    }
    injectSkinTargetClasses();
    initDarkMode();
    if (App.Core && App.Core.Storage && App.Core.Storage.loadData) {
      App.Core.Storage.loadData();
    }
    if (App.UI && App.UI.Render && App.UI.Render.render) {
      App.UI.Render.render();
      var sk = document.getElementById('skeleton');
      if (sk) { sk.style.display = 'none'; }
      injectSkinTargetClasses();
      // [新增] 通知模块冷启动队列：UI 就绪后处理排队的通知动作
      if (typeof markNotificationUIReady === 'function') markNotificationUIReady();
    }
    if (App.UI && App.UI.Events && App.UI.Events.initTouchSwipe) {
      App.UI.Events.initTouchSwipe();
    }
    var isFirstUse = !localStorage.getItem('has_seen_guide') && !localStorage.getItem('constitution_result');
    if (isFirstUse) {
      localStorage.setItem('has_seen_guide', 'true');
      if (App.Modules && App.Modules.Constitution && App.Modules.Constitution.openConstitutionPanel) {
        App.Modules.Constitution.openConstitutionPanel();
      }
    } else if (App.Modules && App.Modules.Guide && App.Modules.Guide.showGuide) {
      App.Modules.Guide.showGuide();
    }

    // ============================================================
    // 平台分化初始化
    // ============================================================
    if (_platform === 'apk') {
      initAPK();
    } else {
      initPWA();
    }

    // 共享：启动定时提醒检查
    // - PWA: 优先使用新调度器（setTimeout 链式），旧轮询作为兜底
    // - APK: 间隔提醒由 Capacitor 系统通知负责，旧轮询仅检查固定时间提醒
    startIntervalReminderCheck();
    // PWA 环境：初始化统一提醒调度器
    if (_platform === 'pwa' && App.Modules && App.Modules.Notification && App.Modules.Notification.init) {
      App.Modules.Notification.init();
      scheduleRemindersWithScheduler();
    }

    // 启动后自动检查新版本
    if (App.Modules && App.Modules.Update && App.Modules.Update.check) {
      App.Modules.Update.check(false);
    }
  }

  // ============================================================
  // APK 专用初始化
  // ============================================================
  function initAPK() {
    console.log('[main] APK 初始化：使用 Capacitor LocalNotifications');

    // 初始化 Capacitor 本地通知系统（创建渠道 + 注册动作类型）
    initLocalNotify();

    // [新增] 注册保存钩子：习惯配置变更后自动重新调度通知
    // 这样用户修改提醒时间/开关后，系统通知会立即更新，无需重启 App
    if (App.Core && App.Core.Storage && App.Core.Storage.registerSaveHook) {
      App.Core.Storage.registerSaveHook(function() {
        if (typeof rescheduleAllNotifications === 'function') {
          rescheduleAllNotifications();
        }
      });
    }

    // 启动时重新注册习惯提醒（设备重启后 Capacitor 通知会丢失）
    scheduleHabitRemindersOnStart();
  }

  // ============================================================
  // PWA 专用初始化
  // ============================================================
  function initPWA() {
    console.log('[main] PWA 初始化：使用浏览器 Notification API + Service Worker Push');

    // 初始化 PWA 通知权限（浏览器 Notification API）
    initLocalNotify();

    // 监听 Service Worker postMessage（从推送通知点击）
    setupNotificationClickHandler();

    // 处理启动 URL 中的 habit 参数（从通知点击新窗口打开）
    handleHabitUrlParam();

    // iOS PWA 通知能力警告
    checkIOSPWANotifyWarning();

    // 注册保存钩子：习惯配置变更后重新调度提醒
    if (App.Core && App.Core.Storage && App.Core.Storage.registerSaveHook) {
      App.Core.Storage.registerSaveHook(function() {
        rescheduleRemindersWithScheduler();
      });
    }
  }

  // ============================================================
  // APK 专用功能
  // ============================================================

  function initLocalNotify() {
    if (_platform === 'apk') {
      // APK: 初始化 Capacitor 通知动作、监听器
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.init) {
        App.Modules.LocalNotify.init();
      }
    } else {
      // PWA: 检查浏览器通知权限
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.checkPermission) {
        App.Modules.LocalNotify.checkPermission();
      }
    }
  }

  function scheduleHabitRemindersOnStart() {
    // 仅在 APK 环境中通过 Capacitor 调度未来时间点的通知
    if (_platform !== 'apk') return;
    if (typeof scheduleHabitReminders === 'function' && typeof habitsConfig !== 'undefined' && habitsConfig.length) {
      try {
        scheduleHabitReminders(habitsConfig);
      } catch(e) { console.warn('[notify] APK 启动注册提醒失败:', e); }
    }
  }

  // ============================================================
  // 统一提醒调度器集成（PWA 专用）
  // ============================================================
  function scheduleRemindersWithScheduler() {
    if (_platform !== 'pwa') return;
    if (!App.Modules || !App.Modules.Notification || !App.Modules.Notification.scheduleAll) return;
    if (typeof habitsConfig === 'undefined' || !habitsConfig.length) return;
    try {
      App.Modules.Notification.scheduleAll(habitsConfig);
      console.log('[main] PWA 统一提醒调度器已启动，注册了', habitsConfig.length, '个习惯');
    } catch(e) {
      console.warn('[main] 统一提醒调度器启动失败:', e);
    }
  }

  function rescheduleRemindersWithScheduler() {
    if (_platform !== 'pwa') return;
    if (!App.Modules || !App.Modules.Notification || !App.Modules.Notification.rescheduleAll) return;
    if (typeof habitsConfig === 'undefined' || !habitsConfig.length) return;
    try {
      App.Modules.Notification.rescheduleAll(habitsConfig);
    } catch(e) {
      console.warn('[main] 重新调度提醒失败:', e);
    }
  }

  // ============================================================
  // PWA 专用功能
  // ============================================================

  function setupNotificationClickHandler() {
    if (_platform !== 'pwa') return;
    try {
      // 监听 Service Worker 发来的 postMessage（推送通知点击后聚焦习惯）
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'notification-click' && event.data.habitId) {
            focusHabitById(event.data.habitId);
          }
        });
      }
      // 监听 window postMessage（浏览器 Notification API 点击时发送）
      window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'notification-click' && event.data.habitId) {
          focusHabitById(event.data.habitId);
        }
      });
    } catch(e) {}
  }

  function focusHabitById(habitId) {
    try {
      var el = document.querySelector('[data-habit-id="' + habitId + '"]');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 0 3px var(--accent)';
        setTimeout(function() { el.style.boxShadow = ''; }, 2000);
        if (typeof handleCheckin === 'function') {
          handleCheckin(habitId);
        }
      }
    } catch(e) {}
  }

  function handleHabitUrlParam() {
    if (_platform !== 'pwa') return;
    try {
      var params = new URLSearchParams(window.location.search);
      var habitId = params.get('habit');
      if (habitId) {
        setTimeout(function() { focusHabitById(habitId); }, 800);
        if (window.history && window.history.replaceState) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    } catch(e) {}
  }

  function checkIOSPWANotifyWarning() {
    if (_platform !== 'pwa') return;
    try {
      var isIOS = 'standalone' in navigator && navigator.standalone === true
        && /iPhone|iPad|iPod/.test(navigator.userAgent);
      if (isIOS && (!('Notification' in window) || Notification.permission === 'default')) {
        if (!localStorage.getItem('ios_pwa_notify_tip')) {
          localStorage.setItem('ios_pwa_notify_tip', '1');
          setTimeout(function() {
            if (typeof showToast === 'function') {
              showToast('iOS暂不支持后台提醒，建议开启番茄钟模式进行专注计时', 5000);
            }
          }, 2000);
        }
      }
    } catch(e) {}
  }

  // ============================================================
  // 共享：定时提醒检查
  // ============================================================

  var QUIET_START = 22;
  var QUIET_END = 7;
  function getQuietConfig() {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      if (cfg.enabled !== false) {
        return { enabled: true, start: cfg.start || QUIET_START, end: cfg.end || QUIET_END };
      }
      return { enabled: false, start: QUIET_START, end: QUIET_END };
    } catch(e) { return { enabled: true, start: QUIET_START, end: QUIET_END }; }
  }

  var _intervalReminderTimer = null;
  var _intervalReminderShown = {};

  function startIntervalReminderCheck() {
    if (_intervalReminderTimer) clearInterval(_intervalReminderTimer);
    _intervalReminderTimer = setInterval(function() {
      // APK: 间隔提醒已由 local-notify.js 预调度为系统通知（后台可达），
      // 前台不再重复检查间隔提醒，避免与系统通知产生重复弹窗。
      // 固定时间提醒仍保留前台检查作为兜底（toast 方式等）。
      if (_platform !== 'apk') {
        checkIntervalReminders();
      }
      checkFixedReminders();
    }, 60000);
    // 首次立即执行一次（同样跳过 APK 的间隔检查）
    if (_platform !== 'apk') {
      checkIntervalReminders();
    }
    checkFixedReminders();
  }

  function checkIntervalReminders() {
    if (typeof habitsConfig === 'undefined' || !habitsConfig.length) return;
    var now = new Date();
    var day = now.getDay();
    var hm = now.getHours() * 60 + now.getMinutes();
    var todayStr = (typeof today === 'function') ? today() : formatDate(now);

    habitsConfig.forEach(function(h) {
      var ir = h.intervalReminder;
      if (!ir || !ir.enabled) return;
      if (!ir.days || ir.days.indexOf(day) === -1) return;

      var sh = ir.startTime ? ir.startTime.split(':').map(Number) : [0,0];
      var eh = ir.endTime ? ir.endTime.split(':').map(Number) : [23,59];
      var startMin = sh[0] * 60 + sh[1];
      var endMin = eh[0] * 60 + eh[1];
      // [修复] 跨午夜判断：startMin > endMin 时（如 22:00-08:00），有效窗口是 hm >= startMin 或 hm <= endMin
      if (startMin > endMin) {
        if (hm > endMin && hm < startMin) return; // 在无效区间内，跳过
      } else {
        if (hm < startMin || hm > endMin) return;
      }

      if (typeof checkinRecords === 'undefined') window.checkinRecords = {};
      if (!checkinRecords[todayStr]) checkinRecords[todayStr] = {};
      var rec = checkinRecords[todayStr];
      var last = (rec[h.id] && rec[h.id].lastInterval) || (rec[h.id] && rec[h.id].timestamp) || 0;
      var elapsedMin = last ? Math.floor((Date.now() - last) / 60000) : ir.interval;
      if (elapsedMin >= ir.interval) {
        var key = h.id + '_' + todayStr;
        if (!_intervalReminderShown[key]) {
          _intervalReminderShown[key] = true;
          triggerReminder(h);
          rec[h.id] = rec[h.id] || {};
          rec[h.id].lastInterval = Date.now();
          if (typeof saveData === 'function') saveData();
        }
      }
    });
  }

  var _fixedReminderShown = {};
  function checkFixedReminders() {
    if (typeof habitsConfig === 'undefined' || !habitsConfig.length) return;
    var now = new Date();
    var day = now.getDay();
    var hm = now.getHours() * 60 + now.getMinutes();
    var todayStr = (typeof today === 'function') ? today() : formatDate(now);

    habitsConfig.forEach(function(h) {
      if (!h.reminder || !h.reminder.enabled) return;
      if (!h.reminder.days || h.reminder.days.indexOf(day) === -1) return;
      var times = [h.reminder.time];
      if (h.reminder.extraTimes && h.reminder.extraTimes.length) {
        times = times.concat(h.reminder.extraTimes);
      }
      times.forEach(function(t) {
        if (!t) return;
        var parts = t.split(':');
        var rh = parseInt(parts[0]) || 0;
        var rm = parseInt(parts[1]) || 0;
        var tMin = rh * 60 + rm;
        var diff = Math.abs(hm - tMin);
        if (diff <= 2) {
          var key = h.id + '_' + todayStr + '_' + tMin;
          if (!_fixedReminderShown[key]) {
            _fixedReminderShown[key] = true;
            triggerReminder(h);
          }
        }
      });
    });
  }

  function triggerReminder(habit) {
    var rawMethod = habit.reminder ? (habit.reminder.method || 'toast') : 'toast';
    var method = rawMethod;
    if (rawMethod === 'banner' || rawMethod === 'alarm') method = 'notification';
    if (rawMethod === 'in-app') method = 'toast';
    if (method === 'off' || method === 'none') return;

    var qc = getQuietConfig();
    if (qc.enabled) {
      var nowH = new Date().getHours();
      var isQuiet = nowH >= qc.start || nowH < qc.end;
      if (isQuiet && rawMethod !== 'alarm') {
        return;
      }
    }

    var soundOn = habit.reminder ? (habit.reminder.sound !== false) : true;
    var vibrateOn = habit.reminder ? (habit.reminder.vibrate !== false) : true;

    if (method === 'notification') {
      // === 统一通过 sendLocalNotification 发送 ===
      // APK → Capacitor LocalNotifications
      // PWA → 浏览器 Notification API
      if (typeof sendLocalNotification === 'function') {
        sendLocalNotification(
          (habit.icon || '') + ' ' + habit.name + '时间到了',
          habit.tip || '记得完成打卡哦',
          { extra: { habitId: habit.id }, sound: soundOn }
        );
      }
      if (soundOn && typeof playSound === 'function') playSound('reminder');
      if (vibrateOn && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (rawMethod === 'alarm' && typeof flashScreen === 'function') flashScreen();
    } else {
      var msg = (habit.icon || '') + ' ' + habit.name + '时间到了！' + (habit.tip ? '（' + habit.tip + '）' : '');
      showToast(msg, 3000);
      if (soundOn && typeof playSound === 'function') playSound('reminder');
    }
  }

  // ============================================================
  // 启动
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
