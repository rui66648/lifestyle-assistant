(function() {
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

  function initApp() {
    checkModules();
    if (App.UI && App.UI.Panels && App.UI.Panels.initAllSkins) {
      App.UI.Panels.initAllSkins();
    }
    initDarkMode();
    if (App.Core && App.Core.Storage && App.Core.Storage.loadData) {
      App.Core.Storage.loadData();
    }
    if (App.UI && App.UI.Render && App.UI.Render.render) {
      App.UI.Render.render();
      // 隐藏骨架屏
      var sk = document.getElementById('skeleton');
      if (sk) { sk.style.display = 'none'; }
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
    startIntervalReminderCheck();
  }

  // ===== 间隔提醒检查 =====
  var _intervalReminderTimer = null;
  var _intervalReminderShown = {};

  function startIntervalReminderCheck() {
    if (_intervalReminderTimer) clearInterval(_intervalReminderTimer);
    _intervalReminderTimer = setInterval(function() {
      checkIntervalReminders();
      checkFixedReminders();
    }, 60000);
    checkIntervalReminders();
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
      if (hm < startMin || hm > endMin) return;

      var rec = (typeof checkinRecords !== 'undefined' ? checkinRecords : {})[todayStr] || {};
      var last = (rec[h.id] && rec[h.id].lastInterval) || (rec[h.id] && rec[h.id].timestamp) || 0;
      var elapsedMin = last ? Math.floor((Date.now() - last) / 60000) : ir.interval;
      if (elapsedMin >= ir.interval) {
        var key = h.id + '_' + todayStr + '_' + hm;
        if (!_intervalReminderShown[key]) {
          _intervalReminderShown[key] = true;
          triggerReminder(h);
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
        if (hm === tMin) {
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
    var method = habit.reminder ? (habit.reminder.method || 'toast') : 'toast';
    if (method === 'off') return;
    var soundOn = habit.reminder ? (habit.reminder.sound !== false) : true;
    var vibrateOn = habit.reminder ? (habit.reminder.vibrate !== false) : true;

    switch (method) {
      case 'toast':
        var msg = habit.icon + ' ' + habit.name + '时间到了！' + (habit.tip ? '（' + habit.tip + '）' : '');
        showToast(msg, 3000);
        break;
      case 'banner':
        if (typeof showReminderBanner === 'function') showReminderBanner(habit);
        if (soundOn && typeof playSound === 'function') playSound('reminder');
        if (vibrateOn && navigator.vibrate) navigator.vibrate([200, 100, 200]);
        break;
      case 'notification':
        if (typeof showLocalNotification === 'function') showLocalNotification(habit.name, habit.icon + ' ' + habit.name + '时间到了！', habit.icon);
        if (soundOn && typeof playSound === 'function') playSound('reminder');
        break;
      case 'alarm':
        if (typeof showReminderBanner === 'function') showReminderBanner(habit);
        if (typeof playAlarmSequence === 'function') playAlarmSequence();
        if (typeof flashScreen === 'function') flashScreen();
        break;
      default:
        var msg2 = habit.icon + ' ' + habit.name + '时间到了！' + (habit.tip ? '（' + habit.tip + '）' : '');
        showToast(msg2, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
