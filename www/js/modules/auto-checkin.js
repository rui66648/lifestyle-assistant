/**
 * 自动打卡模块（仅 APK 端生效）
 * 监听屏幕开关事件，自动完成早起/早睡打卡
 *
 * 逻辑：
 *   - 解锁（USER_PRESENT）→ 4:00~12:00 之间首次解锁 → 自动打卡 early_rise
 *   - 关屏（SCREEN_OFF）→ 20:00~次日2:00 之间关屏 → 10分钟后打卡 early_sleep
 *   - 10分钟内亮屏 → 取消睡觉打卡
 *   - 当天已手动打卡则跳过
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'auto_checkin_config';
  var DEFAULT_CONFIG = {
    enabled: false,
    wakeStartHour: 4,
    wakeEndHour: 12,
    sleepStartHour: 20,
    sleepEndHour: 2,
    sleepDelayMinutes: 10
  };

  var _config = null;
  var _initialized = false;
  var _sleepTimer = null;
  var _screenWatcher = null;

  /**
   * 加载配置
   */
  function loadConfig() {
    if (_config) return _config;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      _config = raw ? JSON.parse(raw) : Object.assign({}, DEFAULT_CONFIG);
      // 合并缺失字段
      for (var k in DEFAULT_CONFIG) {
        if (_config[k] === undefined) _config[k] = DEFAULT_CONFIG[k];
      }
    } catch(e) {
      _config = Object.assign({}, DEFAULT_CONFIG);
    }
    return _config;
  }

  /**
   * 保存配置
   */
  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadConfig()));
    } catch(e) {}
  }

  /**
   * 获取今天的日期 key（YYYY-MM-DD）
   */
  function getTodayKey() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * 检查习惯今天是否已打卡
   */
  function isHabitDoneToday(habitId) {
    var records = window.checkinRecords || {};
    var todayKey = getTodayKey();
    var rec = records[todayKey];
    if (!rec || !rec[habitId]) return false;
    return !!rec[habitId].done;
  }

  /**
   * 执行打卡（boolean 类型习惯）
   */
  function doAutoCheckin(habitId) {
    var habits = window.habitsConfig || [];
    var h = habits.find(function(x) { return x.id === habitId; });
    if (!h) return false;

    var records = window.checkinRecords || {};
    var todayKey = getTodayKey();
    var rec = records[todayKey] || {};

    // 已打卡则跳过
    if (rec[habitId] && rec[habitId].done) return false;

    // 执行打卡
    rec[habitId] = { done: true, value: 1, lastInterval: Date.now(), ts: Date.now() };
    records[todayKey] = rec;
    window.checkinRecords = records;

    // 保存
    if (typeof saveRecords === 'function') {
      saveRecords();
    } else if (App.Core && App.Core.Storage && App.Core.Storage.saveRecords) {
      App.Core.Storage.saveRecords();
    }

    // 触发积分
    if (App.Core && App.Core.Utils && typeof App.Core.Utils.addPoints === 'function') {
      App.Core.Utils.addPoints(5, h.name + ' 自动打卡');
    }

    // 显示通知
    if (typeof showToast === 'function') {
      var emoji = h.icon || '✅';
      showToast(emoji + ' 自动打卡：' + h.name);
    }

    // 播放音效
    if (typeof playSound === 'function') {
      playSound('checkin');
    }

    // 触发重新渲染
    if (typeof render === 'function') {
      render(['today', 'checkin']);
    }

    return true;
  }

  /**
   * 处理解锁事件（起床打卡）
   */
  function onScreenOn() {
    if (!_config || !_config.enabled) return;

    var hour = new Date().getHours();
    // 4:00~12:00 之间首次解锁 → 打卡早起
    if (hour < _config.wakeStartHour || hour >= _config.wakeEndHour) return;

    // 取消待执行的睡觉打卡
    cancelSleepTimer();

    // 检查是否已打卡
    if (isHabitDoneToday('early_rise')) return;

    // 执行早起打卡
    doAutoCheckin('early_rise');
  }

  /**
   * 处理关屏事件（睡觉打卡）
   */
  function onScreenOff() {
    if (!_config || !_config.enabled) return;

    var hour = new Date().getHours();
    // 20:00~次日2:00 之间关屏 → 延迟打卡
    var inSleepWindow = (hour >= _config.sleepStartHour || hour < _config.sleepEndHour);
    if (!inSleepWindow) return;

    // 检查是否已打卡
    if (isHabitDoneToday('early_sleep')) return;

    // 启动延迟计时器
    cancelSleepTimer();
    var delay = (_config.sleepDelayMinutes || 10) * 60 * 1000;
    _sleepTimer = setTimeout(function() {
      _sleepTimer = null;
      if (!_config || !_config.enabled) return;
      if (isHabitDoneToday('early_sleep')) return;
      doAutoCheckin('early_sleep');
    }, delay);
  }

  /**
   * 取消睡觉打卡计时器
   */
  function cancelSleepTimer() {
    if (_sleepTimer) {
      clearTimeout(_sleepTimer);
      _sleepTimer = null;
    }
  }

  /**
   * 初始化模块（仅 APK 环境）
   */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // 仅 APK 环境
    if (!window.isAPK || !window.isAPK()) return;

    loadConfig();

    // 获取 Capacitor 插件实例
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.ScreenWatcher) {
      return;
    }
    _screenWatcher = Capacitor.Plugins.ScreenWatcher;

    // 如果已启用，自动启动服务
    if (_config.enabled) {
      startService();
    }

    // 注册事件监听
    _screenWatcher.addListener('screenWatcherEvent', function(data) {
      if (!data || !data.type) return;
      if (data.type === 'screenOn') {
        onScreenOn();
      } else if (data.type === 'screenOff') {
        onScreenOff();
      }
    });
  }

  /**
   * 启动原生监听服务
   */
  function startService() {
    if (!_screenWatcher) return;
    _screenWatcher.start().then(function(result) {
      if (result && result.ok) {
        if (typeof showToast === 'function') {
          showToast('🤖 自动打卡已启用');
        }
      } else if (result && result.error) {
        if (typeof showToast === 'function') {
          showToast('⚠️ ' + result.error);
        }
      }
    }).catch(function(e) {
      console.error('[AutoCheckin] 启动失败:', e);
    });
  }

  /**
   * 停止原生监听服务
   */
  function stopService() {
    if (!_screenWatcher) return;
    cancelSleepTimer();
    _screenWatcher.stop().then(function() {
      if (typeof showToast === 'function') {
        showToast('🤖 自动打卡已关闭');
      }
    }).catch(function(e) {
      console.error('[AutoCheckin] 停止失败:', e);
    });
  }

  /**
   * 切换启用状态
   */
  function toggle(callback) {
    if (!window.isAPK || !window.isAPK()) {
      if (typeof showToast === 'function') {
        showToast('⚠️ 自动打卡仅支持 App 版');
      }
      if (callback) callback(false);
      return;
    }

    var cfg = loadConfig();
    cfg.enabled = !cfg.enabled;
    saveConfig();

    if (cfg.enabled) {
      startService();
      if (callback) callback(true);
    } else {
      stopService();
      if (callback) callback(false);
    }
  }

  /**
   * 更新配置
   */
  function updateConfig(newConfig) {
    var cfg = loadConfig();
    for (var k in newConfig) {
      if (cfg[k] !== undefined) cfg[k] = newConfig[k];
    }
    saveConfig();
  }

  /**
   * 获取配置
   */
  function getConfig() {
    return Object.assign({}, loadConfig());
  }

  /**
   * 检查服务运行状态
   */
  function checkRunning(callback) {
    if (!_screenWatcher) {
      if (callback) callback(false);
      return;
    }
    _screenWatcher.isRunning().then(function(result) {
      if (callback) callback(result && result.running);
    }).catch(function() {
      if (callback) callback(false);
    });
  }

  /**
   * 请求忽略电池优化
   */
  function requestIgnoreBatteryOptimization(callback) {
    if (!_screenWatcher) {
      if (callback) callback(false);
      return;
    }
    _screenWatcher.requestIgnoreBatteryOptimization().then(function(result) {
      if (callback) callback(result && result.ok);
    }).catch(function() {
      if (callback) callback(false);
    });
  }

  /**
   * 检查电池优化状态
   */
  function isBatteryOptimizationIgnored(callback) {
    if (!_screenWatcher) {
      if (callback) callback(true);
      return;
    }
    _screenWatcher.isBatteryOptimizationIgnored().then(function(result) {
      if (callback) callback(result && result.ignored);
    }).catch(function() {
      if (callback) callback(true);
    });
  }

  // 注册到 App.Modules
  if (typeof App !== 'undefined' && App.registerModule) {
    App.registerModule('modules.autoCheckin', 'modules', function() {
      return {
        init: init,
        toggle: toggle,
        getConfig: getConfig,
        updateConfig: updateConfig,
        checkRunning: checkRunning,
        requestIgnoreBatteryOptimization: requestIgnoreBatteryOptimization,
        isBatteryOptimizationIgnored: isBatteryOptimizationIgnored,
        isHabitDoneToday: isHabitDoneToday,
        doAutoCheckin: doAutoCheckin
      };
    });
  }

  // ---- UI 交互函数（暴露到 window 供 HTML onclick 调用） ----

  /**
   * 更新自动打卡 UI 状态
   */
  function updateAutoCheckinUI() {
    var isAPK = window.isAPK && window.isAPK();
    var group = document.getElementById('autoCheckinGroup');
    if (!group) return;

    if (!isAPK) {
      group.style.display = 'none';
      return;
    }

    group.style.display = '';

    var cfg = getConfig();
    var toggleEl = document.getElementById('autoCheckinToggle');
    if (toggleEl) toggleEl.checked = cfg.enabled;

    var descEl = document.getElementById('autoCheckinStatusDesc');
    if (descEl) {
      descEl.textContent = cfg.enabled
        ? '运行中 · 早起 ' + cfg.wakeStartHour + ':00-' + cfg.wakeEndHour + ':00 · 早睡 ' + cfg.sleepStartHour + ':00-' + cfg.sleepEndHour + ':00'
        : '开屏自动打卡早起，关屏自动打卡早睡';
    }

    // 检查电池优化状态
    var batteryRow = document.getElementById('batteryOptRow');
    if (batteryRow) {
      isBatteryOptimizationIgnored(function(ignored) {
        if (ignored) {
          batteryRow.style.display = 'none';
        } else {
          batteryRow.style.display = '';
          var batteryDesc = document.getElementById('batteryOptDesc');
          if (batteryDesc) batteryDesc.textContent = '⚠️ 未关闭电池优化，可能影响后台运行';
        }
      });
    }
  }

  /**
   * 切换自动打卡开关
   */
  function toggleAutoCheckin(checked) {
    var cfg = loadConfig();
    var wasEnabled = cfg.enabled;
    cfg.enabled = checked;
    saveConfig();

    if (checked && !wasEnabled) {
      startService();
    } else if (!checked && wasEnabled) {
      stopService();
    }

    // 更新描述
    var descEl = document.getElementById('autoCheckinStatusDesc');
    if (descEl) {
      descEl.textContent = checked
        ? '运行中 · 早起 ' + cfg.wakeStartHour + ':00-' + cfg.wakeEndHour + ':00 · 早睡 ' + cfg.sleepStartHour + ':00-' + cfg.sleepEndHour + ':00'
        : '开屏自动打卡早起，关屏自动打卡早睡';
    }

    // 如果启用，检查电池优化
    if (checked) {
      var batteryRow = document.getElementById('batteryOptRow');
      if (batteryRow) {
        isBatteryOptimizationIgnored(function(ignored) {
          batteryRow.style.display = ignored ? 'none' : '';
        });
      }
    }
  }

  /**
   * 处理电池优化点击
   */
  function handleBatteryOptimization() {
    requestIgnoreBatteryOptimization(function(ok) {
      if (ok) {
        // 延迟检查状态（用户可能需要时间操作）
        setTimeout(function() {
          var batteryRow = document.getElementById('batteryOptRow');
          if (batteryRow) {
            isBatteryOptimizationIgnored(function(ignored) {
              batteryRow.style.display = ignored ? 'none' : '';
              if (!ignored && typeof showToast === 'function') {
                showToast('⚠️ 仍需在系统设置中允许后台运行');
              }
            });
          }
        }, 2000);
      }
    });
  }

  // 暴露到 window（供 HTML onclick 调用）
  window.AutoCheckin = {
    init: init,
    toggle: toggle,
    getConfig: getConfig,
    updateConfig: updateConfig,
    checkRunning: checkRunning,
    requestIgnoreBatteryOptimization: requestIgnoreBatteryOptimization,
    isBatteryOptimizationIgnored: isBatteryOptimizationIgnored
  };
  window.updateAutoCheckinUI = updateAutoCheckinUI;
  window.toggleAutoCheckin = toggleAutoCheckin;
  window.handleBatteryOptimization = handleBatteryOptimization;
})();
