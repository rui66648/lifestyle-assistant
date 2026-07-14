/**
 * 本地系统通知模块（平台分化版 v2.0）
 * - APK 环境：使用 Capacitor Native Local Notifications（系统级通知，离线可用，App 被杀也能送达）
 * - PWA 环境：使用 Browser Notification API（仅前台）+ Service Worker Push（后台）
 *
 * v2.0 改进：
 *  - 修复 cancelAll() 空数组无效 → 先 getPending 再逐条取消
 *  - 修复星期过滤 bug → 检查目标日期而非当前日期
 *  - 免打扰时段应用到原生调度 → 静默时段不注册通知
 *  - 统一 smallIcon → 移除硬编码，使用 capacitor.config.json 配置
 *  - 通知渠道支持 → habit_reminders / interval_reminders / system 三渠道
 *  - 间隔提醒后台调度 → 预计算未来 72h 触发点，注册为系统通知
 *  - 冷启动动作队列 → 通知回调在 UI 就绪前排队，防止竞态
 *  - ID 碰撞修复 → remindInFiveMinutes 使用安全高位 ID 段
 */
(function() {
  'use strict';

  var _platform = window.__PLATFORM__ || 'pwa';
  var _isCapacitor = false;
  var _LocalNotifications = null;
  var _permissionGranted = false;
  var _uiReady = false;
  var _pendingActions = [];
  var _rescheduleTimer = null;

  // 通知渠道 ID（与 schedule 调用保持一致）
  var CHANNEL_HABIT = 'habit_reminders';
  var CHANNEL_INTERVAL = 'interval_reminders';
  var CHANNEL_SYSTEM = 'system';

  // ============================================================
  // 平台检测
  // ============================================================
  function detectCapacitor() {
    if (_platform !== 'apk') return false;
    try {
      if (typeof Capacitor !== 'undefined' && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications) {
        _isCapacitor = true;
        _LocalNotifications = Capacitor.Plugins.LocalNotifications;
        return true;
      }
    } catch (e) { /* 不在 Capacitor 环境 */ }
    return false;
  }

  // ============================================================
  // 权限管理
  // ============================================================

  // 请求通知权限
  async function requestPermission() {
    // === APK: Capacitor 原生权限 ===
    if (_isCapacitor && _LocalNotifications) {
      try {
        var result = await _LocalNotifications.requestPermissions();
        _permissionGranted = result.display === 'granted';
        return _permissionGranted;
      } catch (e) {
        console.warn('[LocalNotify] APK 请求权限失败:', e);
        return false;
      }
    }

    // === PWA: 浏览器 Notification API ===
    if (_platform === 'pwa') {
      if (!('Notification' in window)) return false;
      if (Notification.permission === 'granted') {
        _permissionGranted = true;
        return true;
      }
      try {
        var perm = await Notification.requestPermission();
        _permissionGranted = perm === 'granted';
        return _permissionGranted;
      } catch(e) {
        return false;
      }
    }

    return false;
  }

  // 检查权限状态
  async function checkPermission() {
    // === APK ===
    if (_isCapacitor && _LocalNotifications) {
      try {
        var result = await _LocalNotifications.checkPermissions();
        _permissionGranted = result.display === 'granted';
        return _permissionGranted;
      } catch (e) {
        return false;
      }
    }

    // === PWA ===
    if (_platform === 'pwa') {
      if (!('Notification' in window)) return false;
      _permissionGranted = Notification.permission === 'granted';
      return _permissionGranted;
    }

    return false;
  }

  // ============================================================
  // 通知渠道管理（APK 专用）
  // ============================================================

  /**
   * 创建三个独立通知渠道，用户可在 Android 系统设置中分别控制
   * - habit_reminders: 习惯提醒（高重要性，有声）
   * - interval_reminders: 间隔提醒（默认重要性）
   * - system: 系统通知（低重要性，静默）
   */
  async function createNotificationChannels() {
    if (!_isCapacitor || !_LocalNotifications) return;
    try {
      await _LocalNotifications.createChannel({
        channels: [
          {
            id: CHANNEL_HABIT,
            name: '习惯提醒',
            description: '每日习惯打卡提醒通知',
            importance: 5,
            sound: 'default',
            vibration: true,
            lights: true,
            lightColor: '#ff6b6b',
            visibility: 1
          },
          {
            id: CHANNEL_INTERVAL,
            name: '间隔提醒',
            description: '定时循环提醒（如每2小时喝水）',
            importance: 4,
            sound: 'default',
            vibration: true,
            lights: false,
            visibility: 1
          },
          {
            id: CHANNEL_SYSTEM,
            name: '系统通知',
            description: '应用系统级通知',
            importance: 3,
            sound: null,
            vibration: false,
            lights: false,
            visibility: 0
          }
        ]
      });
      console.log('[LocalNotify] 通知渠道创建完成');
    } catch (e) {
      console.warn('[LocalNotify] 渠道创建失败:', e);
    }
  }

  // ============================================================
  // 免打扰时段（从 localStorage 直接读取，避免依赖 main.js）
  // ============================================================
  function _getQuietConfig() {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      if (cfg.enabled !== false) {
        return { enabled: true, start: cfg.start || 22, end: cfg.end || 7 };
      }
      return { enabled: false, start: 22, end: 7 };
    } catch(e) { return { enabled: true, start: 22, end: 7 }; }
  }

  /**
   * 判断指定时间是否处于免打扰时段
   * @param {Date} date - 要检查的时间
   * @param {string} method - 提醒方式，'alarm' 类型不受免打扰限制
   * @returns {boolean}
   */
  function _isInQuietHours(date, method) {
    if (method === 'alarm') return false;
    var qc = _getQuietConfig();
    if (!qc.enabled) return false;
    var h = date.getHours();
    return h >= qc.start || h < qc.end;
  }

  // ============================================================
  // 发送即时通知
  // ============================================================
  async function sendNotification(title, body, options) {
    options = options || {};

    // === APK: Capacitor Local Notifications ===
    if (_isCapacitor && _LocalNotifications && _permissionGranted) {
      try {
        // 生成安全 ID：使用 Date.now() 毫秒级时间戳，避免与 schedule 系列碰撞
        var notifId = options.id || (Date.now() % 2000000000);
        await _LocalNotifications.schedule({
          notifications: [{
            title: title,
            body: body,
            id: notifId,
            schedule: { at: new Date(Date.now() + (options.delay || 0)) },
            sound: options.sound !== false ? 'default' : null,
            // 不指定 smallIcon → 使用 capacitor.config.json 中的默认值
            iconColor: '#ff6b6b',
            channelId: options.channelId || CHANNEL_SYSTEM,
            attachments: null,
            actionTypeId: options.actionTypeId || 'habit_actions',
            extra: options.extra || {}
          }]
        });
        return true;
      } catch (e) {
        console.warn('[LocalNotify] APK 原生通知失败:', e);
        return false;
      }
    }

    // === PWA: 浏览器 Notification API ===
    if (_platform === 'pwa' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        var url = './index.html';
        if (options.extra && options.extra.habitId) {
          url += '?habit=' + encodeURIComponent(options.extra.habitId);
        }
        var n = new Notification(title, {
          body: body,
          icon: './assets/icon-192.jpg',
          badge: './assets/icon-192.jpg',
          tag: options.tag || 'lifestyle-reminder',
          requireInteraction: true,
          renotify: true
        });
        n.onclick = function() {
          if (typeof window.postMessage === 'function') {
            window.postMessage({
              type: 'notification-click',
              habitId: options.extra && options.extra.habitId
            }, '*');
          }
          window.focus();
          n.close();
        };
        return true;
      } catch (e) {
        console.warn('[LocalNotify] PWA 通知失败:', e);
        return false;
      }
    }

    return false;
  }

  // ============================================================
  // 取消所有通知（修复：先 getPending 获取 ID 列表再取消）
  // ============================================================
  async function cancelAll() {
    // === APK: 先获取所有待触发通知，再逐条取消 ===
    if (_isCapacitor && _LocalNotifications) {
      try {
        var pending = await _LocalNotifications.getPending();
        var all = (pending.notifications || []);
        if (all.length) {
          var toCancel = all.map(function(n) { return { id: n.id }; });
          await _LocalNotifications.cancel({ notifications: toCancel });
          console.log('[LocalNotify] 已取消 ' + toCancel.length + ' 条待触发通知');
        }
      } catch (e) {
        console.warn('[LocalNotify] cancelAll 失败:', e);
      }
    }
    // === PWA: 浏览器环境无法取消已发送的通知 ===
  }

  // ============================================================
  // 仅取消习惯类通知（供 reschedule 前清理）
  // ============================================================
  async function _cancelHabitNotifications() {
    if (!_isCapacitor || !_LocalNotifications) return;
    try {
      var pending = await _LocalNotifications.getPending();
      var toCancel = (pending.notifications || []).filter(function(n) {
        return n.extra && (n.extra.type === 'habit' || n.extra.type === 'interval');
      }).map(function(n) { return { id: n.id }; });
      if (toCancel.length) {
        await _LocalNotifications.cancel({ notifications: toCancel });
      }
    } catch (e) { /* 忽略 */ }
  }

  // ============================================================
  // 根据习惯配置注册定时提醒（固定时间 + 间隔提醒统一调度）
  // ============================================================
  async function scheduleHabitReminders(habits) {
    if (!habits || !habits.length) return;

    // === APK: Capacitor 原生定时通知 ===
    // 注册未来时间点的系统通知，即使 App 被杀死也能准时送达
    if (_isCapacitor && _LocalNotifications) {
      var hasPerm = await checkPermission();
      if (!hasPerm) return;

      // 先取消旧的习惯 + 间隔通知
      await _cancelHabitNotifications();

      var now = new Date();
      var notifications = [];
      // 使用高位 ID 段避免碰撞：
      //   固定提醒: idBase + idx * 100 + tIdx  (idBase ~1.7×10⁹)
      //   间隔提醒: intervalBase + idx * 100 + sIdx  (intervalBase ~1.8×10⁹)
      //   即时通知: Date.now() % 2×10⁹
      //   5分钟后:  50000 + random(100000)
      var idBase = Math.floor(Date.now() / 1000);
      var intervalBase = idBase + 100000;

      habits.forEach(function(h, idx) {
        // ---- 固定时间提醒 ----
        if (h.reminder && h.reminder.enabled) {
          var times = [];
          if (h.reminder.time) times.push(h.reminder.time);
          if (h.reminder.extraTimes) times = times.concat(h.reminder.extraTimes);

          times.forEach(function(t, tIdx) {
            if (!t) return;
            var parts = t.split(':');
            var hH = parseInt(parts[0]) || 0;
            var hM = parseInt(parts[1]) || 0;

            var scheduledTime = new Date();
            scheduledTime.setHours(hH, hM, 0, 0);
            if (scheduledTime <= now) {
              scheduledTime.setDate(scheduledTime.getDate() + 1);
            }

            // [修复] 检查目标日期的星期，而非当前日期
            if (h.reminder.days && h.reminder.days.indexOf(scheduledTime.getDay()) === -1) return;

            // [修复] 免打扰时段不注册通知（alarm 类型除外）
            var method = h.reminder.method || 'notification';
            if (_isInQuietHours(scheduledTime, method)) return;

            notifications.push({
              title: (h.icon || '') + ' ' + h.name + '时间到了',
              body: h.tip || '记得完成打卡哦',
              id: idBase + idx * 100 + tIdx,
              schedule: { at: scheduledTime },
              sound: 'default',
              iconColor: '#ff6b6b',
              channelId: CHANNEL_HABIT,
              actionTypeId: 'habit_actions',
              extra: { habitId: h.id, type: 'habit', time: t }
            });
          });
        }

        // ---- [新增] 间隔提醒后台调度 ----
        // 预计算未来 72h 内的间隔触发点，注册为系统通知
        // 这样即使 App 被杀，间隔提醒也能准时送达
        if (h.intervalReminder && h.intervalReminder.enabled) {
          var ir = h.intervalReminder;
          var intervalMin = ir.interval || 60;
          var irStartH = ir.startTime ? parseInt(ir.startTime.split(':')[0]) || 0 : 0;
          var irStartM = ir.startTime ? parseInt(ir.startTime.split(':')[1]) || 0 : 0;
          var irEndH = ir.endTime ? parseInt(ir.endTime.split(':')[0]) || 23 : 23;
          var irEndM = ir.endTime ? parseInt(ir.endTime.split(':')[1]) || 59 : 59;
          var startMin = irStartH * 60 + irStartM;
          var endMin = irEndH * 60 + irEndM;

          // 从当前时间或时间窗口起点开始，每隔 intervalMin 计算触发点
          var cursor = new Date(now);
          // 将 cursor 对齐到今天的 startTime（如果当前已过 startTime 则从当前时间开始）
          var todayStart = new Date(cursor);
          todayStart.setHours(irStartH, irStartM, 0, 0);
          if (cursor < todayStart) cursor = new Date(todayStart);

          var maxEnd = new Date(now);
          maxEnd.setHours(maxEnd.getHours() + 72); // 最多调度未来 72 小时
          var sIdx = 0;
          // 是否跨午夜（如 22:00-08:00，startMin > endMin）
          var crossesMidnight = startMin > endMin;

          while (cursor <= maxEnd && sIdx < 50) { // 安全上限 50 条/习惯
            var cHM = cursor.getHours() * 60 + cursor.getMinutes();

            // [修复] 跨午夜时用 OR 逻辑：cHM >= startMin（当晚）或 cHM <= endMin（次日凌晨）
            var inWindow = crossesMidnight
              ? (cHM >= startMin || cHM <= endMin)
              : (cHM >= startMin && cHM <= endMin);

            if (inWindow && cursor > now) {
              var dayOfWeek = cursor.getDay();
              if (!ir.days || ir.days.indexOf(dayOfWeek) !== -1) {
                // 免打扰检查
                if (!_isInQuietHours(cursor, 'notification')) {
                  notifications.push({
                    title: (h.icon || '') + ' ' + h.name,
                    body: h.tip || '该活动一下了',
                    id: intervalBase + idx * 100 + sIdx,
                    schedule: { at: new Date(cursor) },
                    sound: 'default',
                    iconColor: '#ff6b6b',
                    channelId: CHANNEL_INTERVAL,
                    actionTypeId: 'habit_actions',
                    extra: { habitId: h.id, type: 'interval', interval: intervalMin }
                  });
                  sIdx++;
                }
              }
            }

            // 推进到下一个间隔点
            cursor = new Date(cursor.getTime() + intervalMin * 60000);

            // [修复] 跨午夜时：跳过 endMin 之后到 startTime 之前的无效区间
            // 非跨午夜时：超过 endMin 就跳到明天
            var cursorHM = cursor.getHours() * 60 + cursor.getMinutes();
            if (crossesMidnight) {
              // 跨午夜：如果 cursor 在 (endMin, startMin) 区间内，说明是无效区间，跳到 startTime
              if (cursorHM > endMin && cursorHM < startMin) {
                var nextDay = new Date(cursor);
                nextDay.setDate(nextDay.getDate() + 1);
                nextDay.setHours(irStartH, irStartM, 0, 0);
                cursor = nextDay;
              }
            } else {
              if (cursorHM > endMin) {
                var nextDay2 = new Date(cursor);
                nextDay2.setDate(nextDay2.getDate() + 1);
                nextDay2.setHours(irStartH, irStartM, 0, 0);
                cursor = nextDay2;
              }
            }
          }
        }
      });

      if (notifications.length) {
        try {
          await _LocalNotifications.schedule({ notifications: notifications });
          console.log('[LocalNotify] APK 已注册 ' + notifications.length + ' 条提醒（固定+间隔）');
        } catch (e) {
          console.warn('[LocalNotify] APK 注册提醒失败:', e);
        }
      }
      return;
    }

    // === PWA: 不在此处调度 ===
    // PWA 定时提醒通过两个机制实现：
    // 1. Web Push（push.js）：云端 Worker 按时间表推送 → Service Worker 展示通知
    // 2. 页面内定时检查（main.js）：前台时每分钟检查 → 浏览器 Notification API
    if (_platform === 'pwa') {
      console.log('[LocalNotify] PWA 环境：定时提醒由 Push Worker + 前台定时检查负责');
    }
  }

  // ============================================================
  // 防抖重调度（习惯变更后调用，500ms 防抖）
  // ============================================================
  function rescheduleAll() {
    if (!_isCapacitor) return;
    if (_rescheduleTimer) clearTimeout(_rescheduleTimer);
    _rescheduleTimer = setTimeout(function() {
      try {
        if (typeof habitsConfig !== 'undefined' && habitsConfig.length) {
          scheduleHabitReminders(habitsConfig);
        }
      } catch(e) {
        console.warn('[LocalNotify] rescheduleAll 失败:', e);
      }
    }, 500);
  }

  // ============================================================
  // 5分钟后再次提醒（修复：ID 使用安全高位段，避免碰撞）
  // ============================================================
  async function remindInFiveMinutes(extra) {
    extra = extra || {};

    // === APK: Capacitor schedule API（即使 App 被杀也能送达） ===
    if (_isCapacitor && _LocalNotifications) {
      try {
        // [修复] ID 范围 50000~149999，与 scheduleHabitReminders 的 idBase(~1.7×10⁹) 和
        // intervalBase(~1.8×10⁹) 完全不重叠
        var laterId = 50000 + Math.floor(Math.random() * 100000);
        await _LocalNotifications.schedule({
          notifications: [{
            title: '⏰ 提醒',
            body: extra.habitId ? '该完成习惯啦' : '',
            id: laterId,
            schedule: { at: new Date(Date.now() + 5 * 60 * 1000) },
            sound: 'default',
            iconColor: '#ff6b6b',
            channelId: CHANNEL_HABIT,
            actionTypeId: 'habit_actions',
            extra: extra
          }]
        });
        return true;
      } catch(e) {
        console.warn('[LocalNotify] APK 5分钟提醒失败:', e);
      }
    }

    // === PWA: setTimeout + 浏览器 Notification ===
    if (_platform === 'pwa') {
      setTimeout(function() {
        sendNotification(
          '⏰ 提醒',
          extra.habitId ? '该完成习惯啦' : '',
          { id: Math.floor(Math.random() * 100000), extra: extra }
        );
      }, 5 * 60 * 1000);
      return true;
    }

    return false;
  }

  // ============================================================
  // 冷启动动作队列
  // 当通知动作在 UI 模块（handleCheckin）加载前触发时，
  // 将动作放入队列，等 UI 就绪后自动处理
  // ============================================================
  function _queueAction(fn) {
    if (_uiReady) {
      fn();
    } else {
      _pendingActions.push(fn);
      console.log('[LocalNotify] 动作已入队（UI 未就绪），队列长度:', _pendingActions.length);
    }
  }

  /**
   * 标记 UI 已就绪，处理所有排队动作
   * 由 main.js 在渲染完成后调用
   */
  function markUIReady() {
    if (_uiReady) return;
    _uiReady = true;
    console.log('[LocalNotify] UI 就绪，处理 ' + _pendingActions.length + ' 个排队动作');
    while (_pendingActions.length) {
      try { _pendingActions.shift()(); } catch(e) { console.warn('[LocalNotify] 排队动作执行失败:', e); }
    }
  }

  // ============================================================
  // 初始化
  // ============================================================
  async function init() {
    detectCapacitor();

    // === APK: 注册 Capacitor 通知动作、监听器 ===
    if (_isCapacitor && _LocalNotifications) {
      try {
        // [新增] 创建通知渠道
        await createNotificationChannels();

        // 注册通知动作类型（打卡 / 5分钟后）
        await _LocalNotifications.registerActionTypes({
          types: [{
            id: 'habit_actions',
            actions: [{
              id: 'checkin',
              title: '✓ 打卡',
              requiresAuthentication: false,
              foreground: true
            }, {
              id: 'later',
              title: '5分钟后',
              requiresAuthentication: false,
              foreground: false
            }]
          }]
        });

        // 监听通知动作
        _LocalNotifications.addListener('localNotificationActionPerformed', function(action) {
          var extra = action.notification && action.notification.extra;
          if (!extra || !extra.habitId) return;

          if (action.actionId === 'checkin') {
            // [修复] 通过冷启动队列分发，防止 UI 未加载时调用 handleCheckin
            _queueAction(function() {
              if (typeof handleCheckin === 'function') {
                handleCheckin(extra.habitId);
              } else {
                console.warn('[LocalNotify] handleCheckin 不可用');
              }
            });
          } else if (action.actionId === 'later') {
            remindInFiveMinutes(extra);
          }
        });

        // 监听通知收到（日志用）
        _LocalNotifications.addListener('localNotificationReceived', function(notification) {
          console.log('[LocalNotify] 收到通知:', notification.id, notification.title);
        });

        console.log('[LocalNotify] APK 通知系统初始化完成（v2.0）');
      } catch (e) {
        console.warn('[LocalNotify] APK 初始化失败:', e);
      }
    }

    // === PWA: 仅检查浏览器通知权限 ===
    if (_platform === 'pwa') {
      console.log('[LocalNotify] PWA 通知系统初始化完成（浏览器 Notification API）');
    }

    await checkPermission();
  }

  // ============================================================
  // 暴露 API
  // ============================================================

  // 全局函数
  window.sendLocalNotification = sendNotification;
  window.requestLocalNotifyPermission = requestPermission;
  window.scheduleHabitReminders = scheduleHabitReminders;
  window.rescheduleAllNotifications = rescheduleAll;
  window.markNotificationUIReady = markUIReady;

  // App 模块注册
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.LocalNotify = {
    init: init,
    requestPermission: requestPermission,
    checkPermission: checkPermission,
    sendNotification: sendNotification,
    scheduleHabitReminders: scheduleHabitReminders,
    remindInFiveMinutes: remindInFiveMinutes,
    cancelAll: cancelAll,
    rescheduleAll: rescheduleAll,
    markUIReady: markUIReady,
    isCapacitor: function() { return _isCapacitor; },
    platform: function() { return _platform; }
  };

  // 自动初始化
  init();
})();
