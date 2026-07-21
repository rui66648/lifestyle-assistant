(function() {
  let pomoInterval = null;
  let pomoSeconds = 25 * 60;
  let pomoRunning = false;
  let pomoPaused = false;
  let pomoMode = 'work';
  let pomoCycle = 0;
  const POMO_WORK = 25 * 60;
  const POMO_SHORT = 5 * 60;
  const POMO_LONG = 15 * 60;

  function renderPomodoroPage() {
    populatePomoHabits();
    updatePomoStats();
  }

  function openPomodoroPanel() {
    // 防御：确保 openPanel 可用
    if (typeof openPanel !== 'function') {
      console.error('[pomodoro] openPanel 不可用，尝试从 App.UI.Panels 获取');
      if (window.App && App.UI && App.UI.Panels && App.UI.Panels.openPanel) {
        window.openPanel = App.UI.Panels.openPanel;
      } else {
        alert('番茄钟面板加载失败，请刷新页面重试');
        return;
      }
    }
    populatePomoHabits();
    updatePomoStats();
    openPanel('pomodoroPanel');
  }

  function populatePomoHabits() {
    const sel = document.getElementById('pomoHabit');
    sel.innerHTML = '<option value="">选择要专注的习惯</option>';
    habitsConfig.forEach(h => {
      if (h.enabled !== false) {
        sel.innerHTML += `<option value="${h.id}">${esc(h.icon)} ${esc(h.name)}</option>`;
      }
    });
  }

  function formatPomoTime(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updatePomoDisplay() {
    document.getElementById('pomoTimer').textContent = formatPomoTime(pomoSeconds);
    const total = pomoMode === 'work' ? POMO_WORK : pomoMode === 'shortBreak' ? POMO_SHORT : POMO_LONG;
    const pct = ((total - pomoSeconds) / total) * 100;
    document.getElementById('pomoProgressBar').style.width = pct + '%';
    // 更新环形进度条 (周长 2*PI*90 ≈ 565.49)
    const ring = document.getElementById('pomoRingProgress');
    if (ring) {
      const circumference = 565.49;
      const offset = circumference * (1 - pct / 100);
      ring.style.strokeDashoffset = offset;
    }
  }

  function startPomodoro() {
    if (pomoRunning) return;
    pomoRunning = true;
    pomoPaused = false;
    document.getElementById('pomoStartBtn').style.display = 'none';
    document.getElementById('pomoPauseBtn').style.display = 'inline-block';
    document.getElementById('pomoStopBtn').style.display = 'inline-block';
    document.getElementById('pomoStatus').textContent = pomoMode === 'work' ? '🔥 专注中...' : pomoMode === 'shortBreak' ? '☕ 短休息中...' : '🌿 长休息中...';
    if (pomoMode === 'work') playSound('checkin');
    pomoInterval = setInterval(() => {
      if (pomoSeconds > 0) {
        pomoSeconds--;
        updatePomoDisplay();
      } else {
        onPomoComplete();
      }
    }, 1000);
  }

  function pausePomodoro() {
    if (!pomoRunning || pomoPaused) return;
    pomoPaused = true;
    clearInterval(pomoInterval);
    document.getElementById('pomoPauseBtn').textContent = '▶️ 继续';
    document.getElementById('pomoPauseBtn').onclick = resumePomodoro;
    document.getElementById('pomoStatus').textContent = '⏸️ 已暂停';
  }

  function resumePomodoro() {
    if (!pomoRunning || !pomoPaused) return;
    pomoPaused = false;
    document.getElementById('pomoPauseBtn').textContent = '⏸️ 暂停';
    document.getElementById('pomoPauseBtn').onclick = pausePomodoro;
    document.getElementById('pomoStatus').textContent = pomoMode === 'work' ? '🔥 专注中...' : pomoMode === 'shortBreak' ? '☕ 短休息中...' : '🌿 长休息中...';
    pomoInterval = setInterval(() => {
      if (pomoSeconds > 0) {
        pomoSeconds--;
        updatePomoDisplay();
      } else {
        onPomoComplete();
      }
    }, 1000);
  }

  function stopPomodoro() {
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoPaused = false;
    pomoInterval = null;
    pomoMode = 'work';
    pomoSeconds = POMO_WORK;
    pomoCycle = 0;
    updatePomoDisplay();
    document.getElementById('pomoStartBtn').style.display = 'inline-block';
    document.getElementById('pomoPauseBtn').style.display = 'none';
    document.getElementById('pomoStopBtn').style.display = 'none';
    document.getElementById('pomoPauseBtn').textContent = '⏸️ 暂停';
    document.getElementById('pomoPauseBtn').onclick = pausePomodoro;
    document.getElementById('pomoStatus').textContent = '准备开始专注';
  }

  function onPomoComplete() {
    clearInterval(pomoInterval);
    playSound(pomoMode === 'work' ? 'complete' : 'checkin');
    if (pomoMode === 'work') {
      pomoCycle++;
      savePomoStats(25);
      const habitId = document.getElementById('pomoHabit').value;
      if (habitId) {
        const habit = habitsConfig.find(h => h.id === habitId);
        if (habit) {
          const key = today();
          const rec = checkinRecords[key] || {};
          const existing = rec[habitId] || {done: false, value: 0};
          if (habit.type === 'timer') {
            existing.value = (existing.value || 0) + 25;
            existing.done = true;
          } else if (habit.type === 'count') {
            existing.value = (existing.value || 0) + 1;
            existing.done = true;
          } else {
            existing.done = true;
            existing.value = existing.value || 1;
          }
          rec[habitId] = existing;
          checkinRecords[key] = rec;
          saveRecords();
          render(['today','checkin']);
        }
      }
      if (pomoCycle % 4 === 0) {
        pomoMode = 'longBreak';
        pomoSeconds = POMO_LONG;
        showToast('🎉 完成4个番茄！休息15分钟');
      } else {
        pomoMode = 'shortBreak';
        pomoSeconds = POMO_SHORT;
        showToast('✅ 专注完成！休息5分钟');
      }
    } else {
      pomoMode = 'work';
      pomoSeconds = POMO_WORK;
      showToast('⏰ 休息结束，继续专注！');
    }
    pomoRunning = false;
    pomoPaused = false;
    updatePomoDisplay();
    document.getElementById('pomoStartBtn').style.display = 'inline-block';
    document.getElementById('pomoPauseBtn').style.display = 'none';
    document.getElementById('pomoStopBtn').style.display = 'none';
    document.getElementById('pomoStatus').textContent = pomoMode === 'work' ? '准备开始专注' : pomoMode === 'shortBreak' ? '准备短休息' : '准备长休息';
    updatePomoStats();
  }

  function savePomoStats(minutes) {
    const key = 'pomo_stats_' + formatDate(new Date());
    const stats = JSON.parse(localStorage.getItem(key) || '{"count":0,"minutes":0}');
    stats.count++;
    stats.minutes += minutes;
    localStorage.setItem(key, JSON.stringify(stats));
  }

  function updatePomoStats() {
    const key = 'pomo_stats_' + formatDate(new Date());
    const stats = JSON.parse(localStorage.getItem(key) || '{"count":0,"minutes":0}');
    document.getElementById('pomoStats').textContent = `今日专注：${stats.count} 次 · ${stats.minutes} 分钟`;
  }

  function getPomoTotalStats(since) {
    let count = 0, minutes = 0;
    const d = new Date(since);
    const today = new Date();
    while (d <= today) {
      const key = 'pomo_stats_' + formatDate(d);
      const stats = JSON.parse(localStorage.getItem(key) || '{"count":0,"minutes":0}');
      count += stats.count;
      minutes += stats.minutes;
      d.setDate(d.getDate() + 1);
    }
    return {count, minutes};
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Pomodoro = {
    openPomodoroPanel,
    populatePomoHabits,
    formatPomoTime,
    updatePomoDisplay,
    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    onPomoComplete,
    savePomoStats,
    updatePomoStats,
    getPomoTotalStats
  };

  // 直接暴露到 window，确保 HTML onclick 能调用
  window.renderPomodoroPage = renderPomodoroPage;
  window.openPomodoroPanel = openPomodoroPanel;
  window.startPomodoro = startPomodoro;
  window.pausePomodoro = pausePomodoro;
  window.resumePomodoro = resumePomodoro;
  window.stopPomodoro = stopPomodoro;

  if (App.registerModule) {
    App.registerModule('modules.pomodoro', 'modules', null);
  }
})();
