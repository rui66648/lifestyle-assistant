(function() {
  let waterScheduleTemp = [];

  function renderWaterTracker(h, rec) {
    const wc = h.waterConfig || {dailyGoal:2000, perCup:250, schedule:[]};
    const goal = wc.dailyGoal || 2000;
    const perCup = wc.perCup || 250;
    const waterRec = rec[h.id] || {};
    const value = waterRec.value || 0;
    const cups = waterRec.cups || [];
    const pct = Math.min(100, Math.round((value / goal) * 100));
    const remaining = Math.max(0, goal - value);
    const remainingCups = Math.ceil(remaining / perCup);
    const totalCups = Math.round(goal / perCup);
    const doneCups = Math.round(value / perCup);
    const streak = getStreak(h.id);

    let fillClass = '';
    if (pct >= 80) fillClass = 'high';
    else if (pct >= 50) fillClass = 'mid';

    let cupsViz = '<div class="water-cups-row">';
    for (let i = 0; i < totalCups; i++) {
      const filled = i < doneCups;
      cupsViz += `<div class="water-cup ${filled ? 'filled' : ''}"><span class="water-cup-num">${i+1}</span></div>`;
    }
    cupsViz += '</div>';

    let timelineHtml = '';
    if (wc.schedule && wc.schedule.length > 0) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      timelineHtml = '<div class="water-timeline">';
      wc.schedule.forEach(s => {
        const [sh, sm] = s.time.split(':').map(Number);
        const schedMinutes = sh * 60 + sm;
        const isPast = currentMinutes >= schedMinutes;
        const cupNum = Math.round(s.amount / perCup) || 1;
        timelineHtml += `<div class="water-timeline-item ${isPast ? 'done' : ''}">
          <span class="water-timeline-time">${s.time}</span>
          <span class="water-timeline-icon">${isPast ? '💧' : '⭕'}</span>
          <span class="water-timeline-amount">${cupNum}杯</span>
        </div>`;
      });
      timelineHtml += '</div>';
    }

    let smartTip = '';
    if (cups.length > 0) {
      const lastCup = cups[cups.length - 1];
      const [lh, lm] = lastCup.time.split(':').map(Number);
      const lastMinutes = lh * 60 + lm;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const diffMinutes = currentMinutes - lastMinutes;
      if (diffMinutes >= 120) {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        smartTip = `<div class="water-smart-tip">⏰ 距离上次喝水已 ${hours}小时${mins > 0 ? mins + '分钟' : ''}，建议补充${perCup}ml</div>`;
      }
    } else if (value === 0) {
      smartTip = `<div class="water-smart-tip">💧 今天还没喝水哦，来一杯吧！</div>`;
    }

    let cupsHtml = '';
    if (cups.length > 0) {
      cupsHtml = '<div style="font-size:11px;color:var(--muted);margin-top:6px">今日：';
      cups.forEach((c, i) => {
        if (i > 0) cupsHtml += '、';
        cupsHtml += `${c.time} ${c.amount}ml`;
      });
      cupsHtml += '</div>';
    }

    return `<div class="water-tracker" id="card-${h.id}">
      <div class="water-header">
        <div class="water-title">${h.icon} ${h.name} ${streak > 0 ? `<span style="font-size:11px;color:var(--accent);background:var(--accent-light);padding:2px 8px;border-radius:10px;font-weight:600">🔥${streak}天</span>` : ''}</div>
        <div class="water-amount">${doneCups}杯(${value}ml) / ${totalCups}杯(${goal}ml)</div>
      </div>
      <div class="water-progress">
        <div class="water-progress-fill ${fillClass}" style="width:${pct}%"></div>
        <div class="water-progress-text">${pct}%</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${remaining > 0 ? `还需 ${remainingCups}杯(${remaining}ml)` : '今日目标已达成！🎉'}</div>
      ${smartTip}
      ${cupsViz}
      <div style="text-align:center;margin:8px 0">
        <button onclick="openWaterInputPanel('${h.id}')" style="padding:10px 24px;border-radius:12px;font-size:14px;font-weight:600;background:var(--accent);color:#fff;border:none;cursor:pointer">💧 记录喝水</button>
      </div>
      ${cupsHtml}
      ${timelineHtml}
      <div class="water-week-link" onclick="openWaterWeekPanel('${h.id}')">📊 查看本周饮水趋势</div>
    </div>`;
  }

  function quickAddWater(habitId, amount) {
    const rec = checkinRecords[today()] || {};
    const waterRec = rec[habitId] || {done: true, value: 0, cups: []};
    if (!waterRec.cups) waterRec.cups = [];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    waterRec.cups.push({time: timeStr, amount: amount});
    waterRec.value = (waterRec.value || 0) + amount;
    waterRec.done = true;
    rec[habitId] = waterRec;
    checkinRecords[today()] = rec;
    saveRecords();
    showToast(`💧 已记录 ${amount}ml`);
    render();
  }

  function quickAddWaterFromPanel(amount) {
    if (!pendingCheckinHabitId) return;
    quickAddWater(pendingCheckinHabitId, amount);
    closeAllPanels();
  }

  function confirmWaterInput() {
    const field = document.getElementById('waterCustomAmount');
    const val = parseInt(field.value);
    if (isNaN(val) || val <= 0) {
      showToast('请输入有效的数值');
      return;
    }
    if (!pendingCheckinHabitId) return;
    quickAddWater(pendingCheckinHabitId, val);
    closeAllPanels();
  }

  function openWaterWeekPanel(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    const wc = h.waterConfig || {dailyGoal:2000};
    const goal = wc.dailyGoal || 2000;
    const todayD = new Date();

    let html = '<div style="padding:10px 0">';
    html += `<div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:700">📊 本周饮水</div><div style="font-size:12px;color:var(--muted);margin-top:4px">目标：${goal}ml/天</div></div>`;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayD);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayRec = checkinRecords[ds] || {};
      const waterRec = dayRec[habitId] || {};
      const val = waterRec.value || 0;
      const dayPct = Math.min(100, Math.round((val / goal) * 100));
      const isToday = i === 0;
      const dayName = ['日','一','二','三','四','五','六'][d.getDay()];

      html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:${isToday ? 'var(--accent-light)' : 'var(--bg2)'};border-radius:12px">
        <div style="width:40px;text-align:center">
          <div style="font-size:12px;font-weight:700;color:var(--ink)">${dayName}</div>
          <div style="font-size:10px;color:var(--muted)">${d.getMonth()+1}/${d.getDate()}</div>
        </div>
        <div style="flex:1">
          <div style="height:20px;background:var(--bg);border-radius:10px;overflow:hidden;position:relative">
            <div style="height:100%;width:${dayPct}%;background:${dayPct >= 100 ? 'var(--accent)' : dayPct >= 50 ? '#7CB69D' : '#F4A683'};border-radius:10px;transition:width .5s"></div>
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--ink)">${val}ml (${dayPct}%)</div>
          </div>
        </div>
        <div style="font-size:16px">${dayPct >= 100 ? '✅' : dayPct > 0 ? '💧' : '⭕'}</div>
      </div>`;
    }

    html += '</div>';
    document.getElementById('checkinPanelTitle').textContent = '💧 饮水周统计';
    document.getElementById('checkinPanelBody').innerHTML = html;
    openPanel('checkinPanel');
  }

  function openWaterSettingsPanel(habitId) {
    pendingCheckinHabitId = habitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const wc = h.waterConfig || {dailyGoal:2000, perCup:250, schedule:[]};
    const body = document.getElementById('checkinPanelBody');
    document.getElementById('checkinPanelTitle').textContent = '💧 饮水设置';

    let html = `<div style="padding:10px 0">`;
    html += `<div style="font-size:14px;color:var(--muted);margin-bottom:12px">为「${h.name}」设置饮水计划</div>`;

    html += `<div style="margin-bottom:16px">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:6px">每日目标 (ml)</label>
      <input type="number" id="waterDailyGoal" value="${wc.dailyGoal || 2000}" min="500" max="5000" step="100" style="width:100%;padding:12px;border:2px solid var(--rule);border-radius:12px;font-size:16px;background:#fff;outline:none">
    </div>`;

    html += `<div style="margin-bottom:16px">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:6px">每杯容量 (ml)</label>
      <input type="number" id="waterPerCup" value="${wc.perCup || 250}" min="50" max="1000" step="50" style="width:100%;padding:12px;border:2px solid var(--rule);border-radius:12px;font-size:16px;background:#fff;outline:none">
    </div>`;

    html += `<div style="margin-bottom:16px">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:6px">饮水时间表</label>
      <div id="waterScheduleList" style="display:flex;flex-direction:column;gap:6px">`;
    const schedule = wc.schedule || [];
    schedule.forEach((s, idx) => {
      html += `<div class="water-schedule-row" data-idx="${idx}" style="display:flex;gap:6px;align-items:center">
        <input type="time" class="ws-time" value="${s.time}" style="flex:1;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
        <input type="text" class="ws-label" value="${s.label}" placeholder="标签" style="flex:2;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
        <input type="number" class="ws-amount" value="${s.amount}" min="50" max="1000" step="50" placeholder="ml" style="width:70px;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
        <button onclick="removeWaterScheduleRow(${idx})" style="width:32px;height:32px;border-radius:8px;background:var(--bg2);color:#e74c3c;font-size:16px;border:none;cursor:pointer">✕</button>
      </div>`;
    });
    html += `</div>`;
    html += `<button onclick="addWaterScheduleRow()" style="width:100%;padding:8px;margin-top:6px;border-radius:8px;background:var(--bg2);color:var(--accent);font-size:13px;font-weight:600;border:none;cursor:pointer">+ 添加时间点</button>`;
    html += `</div>`;

    html += `<div style="display:flex;gap:10px;margin-top:20px">
      <button class="checkin-btn pending" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:600" onclick="closeAllPanels()">取消</button>
      <button class="checkin-btn done" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:600" onclick="saveWaterSettings()">保存</button>
    </div>`;

    html += `</div>`;

    body.innerHTML = html;
    openPanel('checkinPanel');
  }

  function addWaterScheduleRow() {
    const list = document.getElementById('waterScheduleList');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.className = 'water-schedule-row';
    div.dataset.idx = idx;
    div.style.cssText = 'display:flex;gap:6px;align-items:center';
    div.innerHTML = `<input type="time" class="ws-time" value="08:00" style="flex:1;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
      <input type="text" class="ws-label" value="" placeholder="标签" style="flex:2;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
      <input type="number" class="ws-amount" value="250" min="50" max="1000" step="50" placeholder="ml" style="width:70px;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
      <button onclick="this.parentElement.remove()" style="width:32px;height:32px;border-radius:8px;background:var(--bg2);color:#e74c3c;font-size:16px;border:none;cursor:pointer">✕</button>`;
    list.appendChild(div);
  }

  function removeWaterScheduleRow(idx) {
    const row = document.querySelector(`.water-schedule-row[data-idx="${idx}"]`);
    if (row) row.remove();
  }

  function saveWaterSettings() {
    const h = habitsConfig.find(x => x.id === pendingCheckinHabitId);
    if (!h) return;
    const goal = parseInt(document.getElementById('waterDailyGoal').value) || 2000;
    const perCup = parseInt(document.getElementById('waterPerCup').value) || 250;
    const rows = document.querySelectorAll('.water-schedule-row');
    const schedule = [];
    rows.forEach(row => {
      const time = row.querySelector('.ws-time').value;
      const label = row.querySelector('.ws-label').value;
      const amount = parseInt(row.querySelector('.ws-amount').value) || 250;
      if (time) schedule.push({time, label: label || '喝水', amount});
    });
    schedule.sort((a, b) => a.time.localeCompare(b.time));
    h.waterConfig = {dailyGoal: goal, perCup, schedule};
    saveConfig();
    showToast('饮水设置已保存');
    closeAllPanels();
    render();
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Water = {
    renderWaterTracker,
    quickAddWater,
    quickAddWaterFromPanel,
    confirmWaterInput,
    openWaterWeekPanel,
    openWaterSettingsPanel,
    addWaterScheduleRow,
    removeWaterScheduleRow,
    saveWaterSettings
  };
})();
