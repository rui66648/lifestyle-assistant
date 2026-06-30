(function() {
  var REMINDER_PRESETS = [
    { id: 'water', title: '💧 该喝水啦', body: '根据你的体质，每天按时喝水很重要哦', icon: './assets/icon-192.jpg', hour: 10, minute: 0 },
    { id: 'lunch', title: '🍚 午餐时间', body: '记得按时吃饭，饮食有节', icon: './assets/icon-192.jpg', hour: 12, minute: 0 },
    { id: 'walk', title: '🚶 起来走走', body: '久坐伤身，起来活动一下吧', icon: './assets/icon-192.jpg', hour: 15, minute: 0 },
    { id: 'footbath', title: '🦶 该泡脚啦', body: '睡前泡脚，助眠养生', icon: './assets/icon-192.jpg', hour: 21, minute: 0 },
    { id: 'sleep', title: '🌙 该睡觉啦', body: '早睡早起，养护阳气', icon: './assets/icon-192.jpg', hour: 22, minute: 30 }
  ];

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

  function scheduleNotification(preset) {
    if (!preset) return;
    var now = new Date();
    var target = new Date();
    target.setHours(preset.hour, preset.minute, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    var delay = target - now;
    setTimeout(function() {
      showLocalNotification(preset.title, preset.body, preset.icon);
      // 每天重复
      setInterval(function() {
        showLocalNotification(preset.title, preset.body, preset.icon);
      }, 24 * 60 * 60 * 1000);
    }, delay);
  }

  function showLocalNotification(title, body, icon) {
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, {
        body: body,
        icon: icon || './assets/icon-192.jpg',
        badge: './assets/icon-192.jpg',
        tag: 'lifestyle-reminder',
        requireInteraction: false
      });
    } catch(e) {
      console.warn('通知发送失败:', e);
    }
  }

  function initReminders() {
    var enabled = localStorage.getItem('notification_reminders');
    if (enabled !== 'true') return;
    if (Notification.permission !== 'granted') return;

    REMINDER_PRESETS.forEach(function(preset) {
      scheduleNotification(preset);
    });
  }

  function openNotificationSettings() {
    var enabled = localStorage.getItem('notification_reminders') === 'true';
    var body = document.getElementById('notificationSettingsBody');
    if (!body) return;

    var html = '<div style="padding:1rem">' +
      '<div style="text-align:center;margin-bottom:1.5rem">' +
        '<div style="font-size:2.5rem;margin-bottom:.5rem">🔔</div>' +
        '<div style="font-weight:700;font-size:1.1rem">每日养生提醒</div>' +
        '<div style="color:var(--muted);font-size:.85rem;margin-top:.3rem">像App一样的本地提醒，PWA也能做到</div>' +
      '</div>';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">' +
      '<div>' +
        '<div style="font-weight:600">开启每日提醒</div>' +
        '<div style="font-size:.8rem;color:var(--muted)">喝水、走路、泡脚、睡觉等</div>' +
      '</div>' +
      '<label class="theme-toggle">' +
        '<input type="checkbox" class="theme-checkbox" id="notifToggle" ' + (enabled ? 'checked' : '') + ' onchange="toggleNotificationReminders()">' +
        '<span class="theme-slider"></span>' +
      '</label>' +
    '</div>';

    html += '<div style="margin-top:1rem">';
    REMINDER_PRESETS.forEach(function(p) {
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light)">' +
        '<span style="font-size:1.2rem">' + p.title.split(' ')[0] + '</span>' +
        '<div style="flex:1">' +
          '<div style="font-size:.9rem;font-weight:600">' + p.title.split(' ').slice(1).join(' ') + '</div>' +
          '<div style="font-size:.75rem;color:var(--muted)">' + p.body + '</div>' +
        '</div>' +
        '<span style="font-size:.8rem;color:var(--accent);font-weight:600;background:var(--accent-light);padding:2px 8px;border-radius:8px">' + String(p.hour).padStart(2,'0') + ':' + String(p.minute).padStart(2,'0') + '</span>' +
      '</div>';
    });
    html += '</div>';

    html += '<div style="margin-top:1rem;font-size:.75rem;color:var(--muted);text-align:center">' +
      '提醒基于浏览器本地通知，无需网络<br>请确保浏览器通知权限已开启' +
    '</div>';

    html += '</div>';
    body.innerHTML = html;
    openPanel('notificationSettingsPanel');
  }

  function toggleNotificationReminders() {
    var toggle = document.getElementById('notifToggle');
    var enabled = toggle && toggle.checked;
    if (enabled) {
      requestNotificationPermission().then(function(granted) {
        if (granted) {
          localStorage.setItem('notification_reminders', 'true');
          showToast('已开启每日养生提醒');
          initReminders();
        } else {
          toggle.checked = false;
        }
      });
    } else {
      localStorage.removeItem('notification_reminders');
      showToast('已关闭提醒');
    }
  }

  // 页面加载时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReminders);
  } else {
    initReminders();
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Notification = {
    requestPermission: requestNotificationPermission,
    showNotification: showLocalNotification,
    initReminders: initReminders,
    openSettings: openNotificationSettings,
    toggleReminders: toggleNotificationReminders
  };

  window.openNotificationSettings = openNotificationSettings;
  window.toggleNotificationReminders = toggleNotificationReminders;
})();
