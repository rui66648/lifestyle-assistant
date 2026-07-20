/**
 * 统一提醒调度器（Notification Scheduler v3.0）
 *
 * 功能：
 * - 统一管理 4 种提醒方式：toast / notification / alarm / off
 * - 支持定时提醒（固定时间）和间隔提醒（周期性）
 * - 支持免打扰时段
 * - 支持按星期几配置
 * - 平台自适应：PWA（浏览器Notification+SW） / APK（Capacitor LocalNotifications）
 * - 统一权限请求（先说明原因再请求）
 * - 防重复触发机制
 *
 * v3.0 重构：
 *  - 从分散的 main.js / local-notify.js / push.js 中提取统一调度逻辑
 *  - 引入 ReminderScheduler 类统一管理注册/触发/取消
 *  - 间隔提醒改用 setTimeout 链式调度（替代 setInterval 轮询）
 *  - 强提醒（alarm）完整效果链：声音 + 振动 + 屏幕闪烁
 */
(function() {
  'use strict';

  var _platform = window.__PLATFORM__ || 'pwa';
  var _initialized = false;
  var _permissionGranted = false;

  // ============================================================
  // 提醒方式枚举
  // ============================================================
  var REMINDER_METHODS = {
    TOAST: 'toast',
    NOTIFICATION: 'notification',
    ALARM: 'alarm',
    OFF: 'off'
  };

  // ============================================================
  // 内部状态
  // ============================================================
  var _fixedTimers = {};
  var _intervalTimers = {};
  var _firedKeys = {};
  var _FRIED_KEY_TTL = 24 * 60 * 60 * 1000;

  // ============================================================
  // 免打扰配置（v3.1 增强：支持按习惯配置）
  // ============================================================
  function getQuietConfig() {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      return {
        enabled: cfg.enabled !== false,
        start: cfg.start || 22,
        end: cfg.end || 7,
        perHabit: cfg.perHabit || {}
      };
    } catch(e) { return { enabled: true, start: 22, end: 7, perHabit: {} }; }
  }

  function saveQuietConfig(cfg) {
    try {
      localStorage.setItem('quiet_hours', JSON.stringify(cfg));
    } catch(e) {}
  }

  function isInQuietHours(date, method, habitId) {
    if (method === REMINDER_METHODS.ALARM) return false;
    var qc = getQuietConfig();
    
    // 先检查全局免打扰
    if (qc.enabled) {
      var h = date.getHours();
      var m = date.getMinutes();
      var currentMin = h * 60 + m;
      var startMin = qc.start * 60;
      var endMin = qc.end * 60;
      
      var isQuiet = false;
      if (startMin < endMin) {
        isQuiet = currentMin >= startMin && currentMin < endMin;
      } else {
        isQuiet = currentMin >= startMin || currentMin < endMin;
      }
      
      if (isQuiet) {
        // 如果有按习惯配置的免打扰时段，检查是否覆盖全局
        if (habitId && qc.perHabit[habitId]) {
          var ph = qc.perHabit[habitId];
          if (!ph.enabled) return false;
          if (ph.start !== undefined && ph.end !== undefined) {
            var phStartMin = ph.start * 60;
            var phEndMin = ph.end * 60;
            var isPhQuiet = false;
            if (phStartMin < phEndMin) {
              isPhQuiet = currentMin >= phStartMin && currentMin < phEndMin;
            } else {
              isPhQuiet = currentMin >= phStartMin || currentMin < phEndMin;
            }
            return isPhQuiet;
          }
        }
        return true;
      }
    }
    
    // 检查按习惯配置的免打扰（即使全局关闭）
    if (habitId && qc.perHabit[habitId]) {
      var ph = qc.perHabit[habitId];
      if (!ph.enabled) return false;
      if (ph.start !== undefined && ph.end !== undefined) {
        var h = date.getHours();
        var m = date.getMinutes();
        var currentMin = h * 60 + m;
        var phStartMin = ph.start * 60;
        var phEndMin = ph.end * 60;
        if (phStartMin < phEndMin) {
          return currentMin >= phStartMin && currentMin < phEndMin;
        } else {
          return currentMin >= phStartMin || currentMin < phEndMin;
        }
      }
    }
    
    return false;
  }

  // ============================================================
  // 工具函数
  // ============================================================
  function parseTime(str) {
    if (!str) return null;
    var parts = str.split(':');
    return { h: parseInt(parts[0]) || 0, m: parseInt(parts[1]) || 0 };
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function makeKey(habitId, type, time) {
    return habitId + '_' + type + '_' + getTodayStr() + '_' + (time || '');
  }

  function hasFired(key) {
    if (_firedKeys[key]) {
      if (Date.now() - _firedKeys[key] < _FRIED_KEY_TTL) return true;
      delete _firedKeys[key];
    }
    return false;
  }

  function markFired(key) {
    _firedKeys[key] = Date.now();
  }

  function cleanupFiredKeys() {
    var now = Date.now();
    for (var k in _firedKeys) {
      if (now - _firedKeys[k] >= _FRIED_KEY_TTL) delete _firedKeys[k];
    }
  }
  setInterval(cleanupFiredKeys, 60 * 60 * 1000);

  // ============================================================
  // 权限管理
  // ============================================================
  function checkPermission() {
    if (_platform === 'apk') {
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.checkPermission) {
        return App.Modules.LocalNotify.checkPermission().then(function(granted) {
          _permissionGranted = granted;
          return granted;
        });
      }
      return Promise.resolve(false);
    }
    if ('Notification' in window) {
      _permissionGranted = Notification.permission === 'granted';
      return Promise.resolve(_permissionGranted);
    }
    return Promise.resolve(false);
  }

  function requestPermission(reason) {
    if (_permissionGranted) return Promise.resolve(true);

    if (reason && typeof showToast === 'function') {
      showToast(reason, 2000);
    }

    if (_platform === 'apk') {
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.requestPermission) {
        return App.Modules.LocalNotify.requestPermission().then(function(granted) {
          _permissionGranted = granted;
          return granted;
        });
      }
      return Promise.resolve(false);
    }

    if (!('Notification' in window)) {
      if (typeof showToast === 'function') showToast('您的设备不支持通知功能');
      return Promise.resolve(false);
    }

    if (Notification.permission === 'denied') {
      if (typeof showToast === 'function') showToast('请在系统设置中开启通知权限');
      return Promise.resolve(false);
    }

    return Notification.requestPermission().then(function(perm) {
      _permissionGranted = perm === 'granted';
      if (typeof showToast === 'function') {
        showToast(_permissionGranted ? '通知权限已开启' : '未获得通知权限');
      }
      return _permissionGranted;
    });
  }

  // ============================================================
  // 提醒触发核心
  // ============================================================
  function triggerReminder(habit, options) {
    options = options || {};
    var rawMethod = habit.reminder ? (habit.reminder.method || REMINDER_METHODS.TOAST) : REMINDER_METHODS.TOAST;
    var method = rawMethod;

    if (method === REMINDER_METHODS.OFF || method === 'none') return;

    var now = new Date();
    if (isInQuietHours(now, rawMethod, habit.id)) return;

    var soundOn = habit.reminder ? (habit.reminder.sound !== false) : true;
    var vibrateOn = habit.reminder ? (habit.reminder.vibrate !== false) : true;

    var title = (habit.icon || '') + ' ' + habit.name + '时间到了';
    var body = habit.tip || '记得完成打卡哦';

    switch (method) {
      case REMINDER_METHODS.TOAST:
        _triggerToast(title, body, soundOn);
        break;

      case REMINDER_METHODS.NOTIFICATION:
        _triggerNotification(title, body, habit, soundOn, vibrateOn);
        break;

      case REMINDER_METHODS.ALARM:
        _triggerAlarm(title, body, habit, soundOn, vibrateOn);
        break;

      case 'banner':
      case 'in-app':
        _triggerToast(title, body, soundOn);
        break;
    }
  }

  function _triggerToast(title, body, soundOn) {
    var msg = title + '！' + (body ? '（' + body + '）' : '');
    if (typeof showToast === 'function') {
      showToast(msg, 3000);
    }
    if (soundOn && typeof playSound === 'function') {
      playSound('reminder');
    }
  }

  function _triggerNotification(title, body, habit, soundOn, vibrateOn) {
    if (_platform === 'apk') {
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.sendNotification) {
        App.Modules.LocalNotify.sendNotification(title, body, {
          extra: { habitId: habit.id },
          sound: soundOn
        });
      }
    } else {
      if (_permissionGranted && 'Notification' in window) {
        try {
          var n = new Notification(title, {
            body: body,
            icon: './assets/icon-192.jpg',
            badge: './assets/icon-192.jpg',
            tag: 'lifestyle-reminder',
            requireInteraction: true,
            renotify: true
          });
          n.onclick = function() {
            window.focus();
            n.close();
            if (typeof focusHabitById === 'function') focusHabitById(habit.id);
          };
        } catch(e) { console.warn('通知发送失败:', e); }
      }
    }
    if (soundOn && typeof playSound === 'function') playSound('reminder');
    if (vibrateOn && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function _triggerAlarm(title, body, habit, soundOn, vibrateOn) {
    if (_platform === 'apk' && App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.sendAlarmNotification) {
      App.Modules.LocalNotify.sendAlarmNotification(title, body, {
        extra: { habitId: habit.id },
        sound: soundOn
      });
    } else {
      _triggerNotification(title, body, habit, soundOn, vibrateOn);
    }
    if (typeof playAlarmSequence === 'function') {
      playAlarmSequence();
    }
    if (typeof flashScreen === 'function') {
      flashScreen();
    }
  }

  // ============================================================
  // 固定时间提醒调度
  // ============================================================
  function scheduleFixedReminder(habit) {
    if (!habit || !habit.reminder || !habit.reminder.enabled) return;
    cancelFixedReminder(habit.id);

    if (_platform === 'apk') {
      return;
    }

    var times = [];
    if (habit.reminder.time) times.push(habit.reminder.time);
    if (habit.reminder.extraTimes && habit.reminder.extraTimes.length) {
      times = times.concat(habit.reminder.extraTimes);
    }

    times.forEach(function(t, idx) {
      if (!t) return;
      var tm = parseTime(t);
      if (!tm) return;

      function scheduleNext() {
        var now = new Date();
        var target = new Date();
        target.setHours(tm.h, tm.m, 0, 0);
        if (target <= now) {
          target.setDate(target.getDate() + 1);
        }

        var days = habit.reminder.days;
        while (days && days.length && days.indexOf(target.getDay()) === -1) {
          target.setDate(target.getDate() + 1);
        }

        var delay = target.getTime() - Date.now();
        var timerId = setTimeout(function() {
          var key = makeKey(habit.id, 'fixed', t);
          if (!hasFired(key)) {
            markFired(key);
            triggerReminder(habit);
          }
          scheduleNext();
        }, delay);

        if (!_fixedTimers[habit.id]) _fixedTimers[habit.id] = [];
        _fixedTimers[habit.id].push({ timerId: timerId, time: t, idx: idx });
      }

      scheduleNext();
    });
  }

  function cancelFixedReminder(habitId) {
    if (_fixedTimers[habitId]) {
      _fixedTimers[habitId].forEach(function(t) {
        clearTimeout(t.timerId);
      });
      delete _fixedTimers[habitId];
    }
  }

  // ============================================================
  // 间隔提醒调度（setTimeout 链式，替代 setInterval 轮询）
  // ============================================================
  function scheduleIntervalReminder(habit) {
    if (!habit || !habit.intervalReminder || !habit.intervalReminder.enabled) return;
    cancelIntervalReminder(habit.id);

    if (_platform === 'apk') {
      return;
    }

    var ir = habit.intervalReminder;
    var intervalMs = (ir.interval || 60) * 60 * 1000;
    var startTime = parseTime(ir.startTime) || { h: 0, m: 0 };
    var endTime = parseTime(ir.endTime) || { h: 23, m: 59 };
    var startMin = startTime.h * 60 + startTime.m;
    var endMin = endTime.h * 60 + endTime.m;
    var crossesMidnight = startMin > endMin;
    var days = ir.days;

    function getNextTriggerTime() {
      var now = new Date();
      var cursor = new Date(now.getTime() + intervalMs);

      for (var i = 0; i < 500; i++) {
        var cMin = cursor.getHours() * 60 + cursor.getMinutes();
        var inWindow = crossesMidnight
          ? (cMin >= startMin || cMin <= endMin)
          : (cMin >= startMin && cMin <= endMin);

        if (inWindow) {
          if (!days || days.length === 0 || days.indexOf(cursor.getDay()) !== -1) {
            return cursor;
          }
        }

        cursor = new Date(cursor.getTime() + intervalMs);

        var curMin = cursor.getHours() * 60 + cursor.getMinutes();
        if (crossesMidnight) {
          if (curMin > endMin && curMin < startMin) {
            var nextDay = new Date(cursor);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(startTime.h, startTime.m, 0, 0);
            cursor = nextDay;
          }
        } else {
          if (curMin > endMin) {
            var nextDay2 = new Date(cursor);
            nextDay2.setDate(nextDay2.getDate() + 1);
            nextDay2.setHours(startTime.h, startTime.m, 0, 0);
            cursor = nextDay2;
          }
        }
      }
      return null;
    }

    function scheduleNext() {
      var nextTime = getNextTriggerTime();
      if (!nextTime) return;

      var delay = nextTime.getTime() - Date.now();
      var timerId = setTimeout(function() {
        var key = makeKey(habit.id, 'interval', Math.floor(nextTime.getTime() / 60000));
        if (!hasFired(key)) {
          markFired(key);
          triggerReminder(habit);
          if (typeof checkinRecords !== 'undefined') {
            var todayStr = getTodayStr();
            if (!checkinRecords[todayStr]) checkinRecords[todayStr] = {};
            if (!checkinRecords[todayStr][habit.id]) checkinRecords[todayStr][habit.id] = {};
            checkinRecords[todayStr][habit.id].lastInterval = Date.now();
            if (typeof saveData === 'function') saveData();
          }
        }
        scheduleNext();
      }, delay);

      _intervalTimers[habit.id] = { timerId: timerId, nextTime: nextTime };
    }

    scheduleNext();
  }

  function cancelIntervalReminder(habitId) {
    if (_intervalTimers[habitId]) {
      clearTimeout(_intervalTimers[habitId].timerId);
      delete _intervalTimers[habitId];
    }
  }

  // ============================================================
  // 批量调度 / 取消
  // ============================================================
  function scheduleAll(habits) {
    if (!habits || !habits.length) return;
    habits.forEach(function(h) {
      scheduleFixedReminder(h);
      scheduleIntervalReminder(h);
    });
  }

  function cancelAll() {
    Object.keys(_fixedTimers).forEach(function(id) {
      cancelFixedReminder(id);
    });
    Object.keys(_intervalTimers).forEach(function(id) {
      cancelIntervalReminder(id);
    });
  }

  function rescheduleAll(habits) {
    cancelAll();
    scheduleAll(habits);
  }

  // ============================================================
  // 权限请求引导（先说明原因再请求）
  // ============================================================
  function requestPermissionWithReason(reason, habitName) {
    var msg = reason || ('开启通知后，' + (habitName ? '「' + habitName + '」' : '') + '将准时提醒您');
    return requestPermission(msg);
  }

  // ============================================================
  // 初始化
  // ============================================================
  function init() {
    if (_initialized) return;
    _initialized = true;

    checkPermission().then(function(granted) {
      _permissionGranted = granted;
      console.log('[NotificationScheduler] 初始化完成，平台:', _platform, '权限:', granted ? '已授权' : '未授权');
    });
  }

  // ============================================================
  // 暴露 API
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Notification = {
    init: init,
    METHODS: REMINDER_METHODS,
    trigger: triggerReminder,
    triggerToast: _triggerToast,
    triggerNotification: _triggerNotification,
    triggerAlarm: _triggerAlarm,
    scheduleFixed: scheduleFixedReminder,
    cancelFixed: cancelFixedReminder,
    scheduleInterval: scheduleIntervalReminder,
    cancelInterval: cancelIntervalReminder,
    scheduleAll: scheduleAll,
    cancelAll: cancelAll,
    rescheduleAll: rescheduleAll,
    checkPermission: checkPermission,
    requestPermission: requestPermission,
    requestPermissionWithReason: requestPermissionWithReason,
    isInQuietHours: isInQuietHours,
    getQuietConfig: getQuietConfig,
    isInitialized: function() { return _initialized; },
    hasPermission: function() { return _permissionGranted; }
  };

  window.triggerReminder = triggerReminder;
  window.scheduleFixedReminder = scheduleFixedReminder;
  window.scheduleIntervalReminder = scheduleIntervalReminder;
  window.cancelAllReminders = cancelAll;
  window.rescheduleAllReminders = rescheduleAll;

})();
