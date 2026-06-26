(function() {
  let currentTab = 'checkin';
  Object.defineProperty(window, 'currentTab', {
    get: () => currentTab,
    set: (val) => { currentTab = val; },
    configurable: true,
    enumerable: true
  });
  let heatmapDate = new Date();
  Object.defineProperty(window, 'heatmapDate', {
    get: () => heatmapDate,
    set: (val) => { heatmapDate = val; },
    configurable: true,
    enumerable: true
  });

  function render() {
    renderTodayCard();
    renderReminderBanner();
    renderCheckin();
    renderStats();
    renderManage();
    showGuide();
  }

  function renderAmbientBg() {
    const h = new Date().getHours();
    const el = document.getElementById('ambientBg');
    if (!el) return;
    el.className = 'ambient-bg';
    if (h >= 5 && h < 7) el.classList.add('dawn');
    else if (h >= 7 && h < 11) el.classList.add('morning');
    else if (h >= 11 && h < 14) el.classList.add('midday');
    else if (h >= 14 && h < 17) el.classList.add('afternoon');
    else if (h >= 17 && h < 21) el.classList.add('evening');
    else el.classList.add('night');
  }

  function swipeDate(dir) {
    if (dir === 0) viewDateOffset = 0;
    else viewDateOffset = Math.max(-7, Math.min(1, viewDateOffset + dir));
    render();
  }

  function renderTodayCard() {
    const d = new Date();
    const weekDay = DAY_NAMES[d.getDay()];
    const season = getCurrentSeason();
    const pack = getSeasonPack(season);
    const lunar = getLunarDate(d);

    const card = document.getElementById('todayCard');
    card.className = 'mini-header';

    document.getElementById('todayDate').textContent = `${d.getMonth()+1}月${d.getDate()}日 周${weekDay}`;
    document.getElementById('todayLunar').textContent = `${lunar.monthStr}${lunar.dayStr}`;

    const solarTerm = getCurrentSolarTerm();
    let badgesHtml = '';
    if (solarTerm) {
      badgesHtml = `<span class="mini-badge">${solarTerm.emoji} ${solarTerm.name}</span>`;
    }
    document.getElementById('todayBadges').innerHTML = badgesHtml;

    let tipText = solarTerm ? solarTerm.tip : pack.tip;
    document.getElementById('todaySeasonTip').textContent = tipText;

    refreshQuote();
  }

  function refreshQuote() {
    const qIdx = Math.floor(Math.random() * HEALTH_TIPS.length);
    let qTip = HEALTH_TIPS[qIdx];
    let attempts = 0;
    while (qTip.source.length < 20 && attempts < 10) {
      qTip = HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
      attempts++;
    }
    document.getElementById('quoteText').textContent = qTip.source.split('--')[0];
    document.getElementById('quoteSource').textContent = '--' + (qTip.source.split('--')[1] || '');
  }

  function toggleQuoteExpand() {
    const el = document.getElementById('quoteCard');
    if (el) el.classList.toggle('expanded');
  }

  function renderReminderBanner() {
    const done = getTodayDone();
    const total = getTodayTotal();
    const el = document.getElementById('reminderText');
    const shareBtn = document.getElementById('sharePosterBtn');
    if (total === 0) {
      el.textContent = '还没有添加习惯，点击 + 开始吧';
      if (shareBtn) shareBtn.style.display = 'none';
    } else if (done === 0) {
      el.textContent = `新的一天开始了，今天有 ${total} 个习惯等你完成`;
      if (shareBtn) shareBtn.style.display = 'none';
    } else if (done < total) {
      el.textContent = `已打卡 ${done}/${total}，继续加油！还剩 ${total - done} 个`;
      if (shareBtn) shareBtn.style.display = 'none';
    } else {
      el.textContent = `太棒了！今天 ${total} 个习惯全部完成 🎉`;
      if (shareBtn) shareBtn.style.display = 'inline-block';
    }
  }

  function renderCheckin() {
    const container = document.getElementById('checkinContent');
    const rec = checkinRecords[today()] || {};
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const nav = document.getElementById('dateNavigator');
    const navLabel = document.getElementById('dateNavLabel');
    if (nav && navLabel) {
      const hasHabits = habitsConfig.length > 0;
      nav.style.display = hasHabits ? 'block' : 'none';
      if (viewDateOffset === 0) navLabel.textContent = '📅 今天';
      else if (viewDateOffset === -1) navLabel.textContent = '📅 昨天';
      else if (viewDateOffset === -2) navLabel.textContent = '📅 前天';
      else {
        const vd = new Date();
        vd.setDate(vd.getDate() + viewDateOffset);
        navLabel.textContent = `📅 ${vd.getMonth()+1}/${vd.getDate()}`;
      }
    }

    function getNextTime(h) {
      if (h.type === 'water' && (h.waterConfig && h.waterConfig.schedule)) {
        const doneTimes = new Set(((rec[h.id] && rec[h.id].cups) || []).map(c => c.time));
        for (const s of h.waterConfig.schedule) {
          const [sh, sm] = s.time.split(':').map(Number);
          const schedMin = sh * 60 + sm;
          if (!doneTimes.has(s.time) && schedMin >= nowMinutes) return schedMin;
        }
        return 9999;
      }
      if ((h.reminder && h.reminder.enabled)) {
        const [rh, rm] = h.reminder.time.split(':').map(Number);
        return rh * 60 + rm;
      }
      const tp = (CATEGORY_MAP[h.category] && CATEGORY_MAP[h.category].timePeriod) || 'daytime';
      const defaults = {morning:420, forenoon:600, afternoon:840, evening:1260, daytime:720};
      return defaults[tp] || 720;
    }

    function isChecked(h) {
      if (h.type === 'water') return ((rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000);
      return rec[h.id] && rec[h.id].done;
    }

    const items = [];
    const todayDow = now.getDay();
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const repeat = h.repeat || [0,1,2,3,4,5,6];
      if (!repeat.includes(todayDow)) return;
      const checked = isChecked(h);
      const nextTime = getNextTime(h);
      const overdue = !checked && nextTime < nowMinutes;
      const soon = !checked && !overdue && nextTime <= nowMinutes + 60;
      items.push({h, checked, nextTime, overdue, soon});
    });

    items.sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.soon !== b.soon) return a.soon ? -1 : 1;
      return a.nextTime - b.nextTime;
    });

    const dow = now.getDay();
    let html = '';
    if (dow === 0) {
      html += '<div class="report-card" style="cursor:pointer" onclick="openReportPanel()"><div class="report-title">📋 点击查看本周总结</div></div>';
    }

    const total = items.length;
    const doneCount = items.filter(x => x.checked).length;
    const overdueCount = items.filter(x => x.overdue).length;

    const encourageMsgs = [
      '每一天的坚持，都是对自己最好的投资 💪',
      '养生不是一蹴而就，而是日积月累的功夫 🌱',
      '今天又比昨天更健康了一点点 🌟',
      '你的身体会感谢现在努力的自己 ❤️',
      '好的习惯是最好的医生，坚持下去 🏥',
      '法于阴阳，和于术数，食饮有节 📖',
      '不积跬步，无以至千里 -- 荀子 🚶',
      '上工治未病，不治已病 --《黄帝内经》🌿',
      '坚持就是胜利，你已经很棒了 ✨'
    ];
    const encourageIdx = Math.floor(Date.now() / 86400000 + doneCount) % encourageMsgs.length;
    if (total > 0) {
      const pct = Math.round((doneCount / total) * 100);
      const r = 52, c = 2 * Math.PI * r, offset = c - (pct / 100) * c;
      html += `<div style="text-align:center;padding:16px 16px 6px">
        <svg width="120" height="120" style="display:block;margin:0 auto">
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--rule)" stroke-width="8"/>
          <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .6s ease"/>
          <text x="60" y="55" text-anchor="middle" font-size="28" font-weight="800" fill="var(--accent)">${pct}%</text>
          <text x="60" y="72" text-anchor="middle" font-size="11" fill="var(--muted)">${doneCount}/${total}</text>
        </svg>
        <div style="font-size:13px;color:var(--muted);margin-top:6px;line-height:1.6">${encourageMsgs[encourageIdx]}</div>
        <div style="margin-top:4px"><button onclick="openRetroactivePanel('${(items[0] && items[0].h && items[0].h.id) || (habitsConfig[0] && habitsConfig[0].id) || ''}')" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:600">📅 补签过去7天</button></div>
      </div>`;
    }

    items.forEach(({h, checked, nextTime, overdue, soon}) => {
      const collapsedClass = checked ? 'collapsed' : '';
      const rec2 = rec[h.id] || {};
      const skipped = rec2.skipped;
      const doneCardClass = (checked || skipped) ? 'done-card' : '';

      if (h.type === 'water') {
        html += renderWaterTracker(h, rec).replace('class="water-tracker"', `class="water-tracker ${collapsedClass}"`);
      } else if (h.type === 'select') {
        const selected = rec[h.id] ? rec[h.id].value : '';
        const tipStr2 = h.tip || '';
        const timeHint = overdue ? `<span style="color:#e74c3c;font-size:11px">已过期</span>` : soon ? `<span style="color:#f39c12;font-size:11px">即将</span>` : '';
        html += `
          <div class="habit-card ${collapsedClass}" id="card-${h.id}" onclick="openEmotionPanel()">
            <span class="icon">${h.icon}</span>
            <div class="info">
              <div class="name">${h.name}${selected ? '：' + selected : ''}</div>
              <div class="meta"><span style="color:var(--accent)">点击记录今日情绪</span>${timeHint}</div>
              ${tipStr2 ? `<div style="font-size:11px;color:var(--accent);margin-top:3px;line-height:1.4">💡 ${tipStr2}</div>` : ''}
            </div>
            <button class="checkin-btn ${selected ? 'done' : 'pending'}">${selected ? '✓' : '记录'}</button>
          </div>`;
      } else {
        const streak = getStreak(h.id);
        const reminder = h.reminder;
        const reminderStr = reminder && reminder.enabled ? reminder.time : '';
        const valueStr = checked ? (h.type === 'boolean' ? '' : ` ${rec[h.id].value}${h.unit}`) : '';
        const tipStr = h.tip || '';
        const failed = h.negative && rec[h.id] && rec[h.id].failed;
        const isNegative = h.negative;
        const negClass = isNegative ? ' negative' : '';
        const timeHint = overdue ? `<span style="color:#e74c3c;font-size:11px">已过期</span>` : soon ? `<span style="color:#f39c12;font-size:11px">即将</span>` : '';
        const btnClass = skipped ? 'skip' : failed ? 'failed' : checked ? 'done' : 'pending';
        const btnText = skipped ? '⏭ 跳过' : failed ? '✗ 犯了' : checked ? '✓' : (isNegative ? '没犯' : (h.type === 'boolean' ? '打卡' : h.type === 'count' ? '记录' : '记录'));

        html += `
          <div class="habit-card ${collapsedClass} ${negClass} ${doneCardClass}" id="card-${h.id}" style="position:relative">
            <span class="icon">${isNegative ? '❌' : h.icon}</span>
            <div class="info">
              <div class="name">${isNegative ? '不' + h.name : h.name}${valueStr}</div>
              <div class="meta">
                ${reminderStr ? `<span>⏰ ${reminderStr}</span>` : ''}
                ${streak > 0 ? `<span class="streak">🔥${streak}天</span>` : ''}
                ${timeHint}
              </div>
              ${!checked && !skipped ? '' : ''}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${!isNegative ? `<button class="checkin-btn ${skipped ? 'skip' : 'pending'}" onclick="event.stopPropagation();skipHabit('${h.id}')" title="跳过（不打断连续）">${skipped ? '⏭' : '⏭'}</button>` : ''}
              <button class="checkin-btn ${btnClass}" onclick="handleCheckin('${h.id}')">
                ${btnText}
              </button>
            </div>
          </div>`;
      }
    });

    if (items.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:14px;">还没有添加习惯<br>点击下方 + 按钮开始添加</div>';
    }

    container.innerHTML = html;
  }

  function renderStats() {
    const done = getTodayDone();
    const total = getTodayTotal();
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const circumference = 2 * Math.PI * 68;
    const offset = circumference - (pct / 100) * circumference;
    document.getElementById('ringFg').style.strokeDashoffset = offset;
    document.getElementById('ringPct').textContent = pct + '%';

    let maxStreakAll = 0;
    habitsConfig.forEach(h => {
      maxStreakAll = Math.max(maxStreakAll, getMaxStreak(h.id));
    });
    document.getElementById('statsGrid').innerHTML = `
      <div class="stat-card"><div class="stat-val">${done}/${total}</div><div class="stat-label">今日完成</div></div>
      <div class="stat-card"><div class="stat-val">${maxStreakAll}</div><div class="stat-label">最长连续</div></div>
      <div class="stat-card"><div class="stat-val">${getWeekRate()}%</div><div class="stat-label">本周率</div></div>
      <div class="stat-card"><div class="stat-val">${getMonthRate()}%</div><div class="stat-label">本月率</div></div>
    `;

    const rankHtml = habitsConfig.map(h => {
      const rate = getCompletionRate(h.id, 30);
      const cls = rate >= 70 ? 'high' : rate >= 40 ? 'mid' : 'low';
      return `<div class="ranking-item">
        <div class="ranking-header"><span class="ranking-name">${h.icon} ${h.name}</span><span class="ranking-pct">${rate}%</span></div>
        <div class="ranking-bar"><div class="ranking-fill ${cls}" style="width:${rate}%"></div></div>
      </div>`;
    }).join('');
    document.getElementById('rankingList').innerHTML = rankHtml || '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">暂无数据</div>';

    renderWeekBarChart();
    renderHeatmap();
    renderAchievements();
  }

  function renderHeatmap() {
    const year = heatmapDate.getFullYear();
    const month = heatmapDate.getMonth();
    document.getElementById('heatmapMonth').textContent = `${year}年${month+1}月`;
    const grid = document.getElementById('heatmapGrid');
    const dayLabels = ['一','二','三','四','五','六','日'];
    let html = dayLabels.map(l => `<div class="heatmap-day-label">${l}</div>`).join('');

    const firstDay = new Date(year, month, 1);
    let startWeekday = firstDay.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = today();

    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="heatmap-cell empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const rec = checkinRecords[key] || {};
      const total = habitsConfig.length;
      let doneCount = 0;
      habitsConfig.forEach(h => {
        if (rec[h.id] && rec[h.id].done) doneCount++;
      });
      const ratio = total > 0 ? doneCount / total : 0;
      let cls = '';
      if (ratio > 0 && ratio <= 0.25) cls = 'l1';
      else if (ratio > 0.25 && ratio <= 0.5) cls = 'l2';
      else if (ratio > 0.5 && ratio <= 0.75) cls = 'l3';
      else if (ratio > 0.75) cls = 'l4';
      const todayCls = key === todayStr ? ' today' : '';
      html += `<div class="heatmap-cell ${cls}${todayCls}" title="${key}: ${doneCount}/${total}"></div>`;
    }

    grid.innerHTML = html;
  }

  function changeMonth(delta) {
    heatmapDate.setMonth(heatmapDate.getMonth() + delta);
    renderHeatmap();
  }

  function renderAchievements() {
    const container = document.getElementById('achievements');
    const badges = [
      {id:'streak7',label:'7天连续',icon:'🔥',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 7)},
      {id:'streak14',label:'14天连续',icon:'🔥',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 14)},
      {id:'streak30',label:'30天连续',icon:'⭐',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 30)},
      {id:'all_done',label:'全部完成',icon:'🏆',check: () => {
        const rec = checkinRecords[today()] || {};
        return habitsConfig.length > 0 && habitsConfig.every(h => rec[h.id] && rec[h.id].done);
      }}
    ];

    container.innerHTML = badges.map(b => {
      const unlocked = b.check();
      return `<div class="badge">
        <div class="badge-icon ${unlocked ? 'unlocked' : 'locked'}">${b.icon}</div>
        <div class="badge-label ${unlocked ? 'unlocked' : ''}">${b.label}</div>
      </div>`;
    }).join('');
  }

  function renderManage() {
    renderMyPack();
    renderSystemPacks();
    renderLevelCard();
    renderManageHeatmap();
  }

  function renderLevelCard() {
    const lv = getCurrentLevel();
    const streak = getCurrentStreak();
    const progress = getLevelProgress();
    const next = getNextLevel();

    document.getElementById('levelIcon').textContent = lv.icon;
    document.getElementById('levelName').textContent = lv.name;
    document.getElementById('levelProgressText').textContent = `连续打卡 ${streak} 天`;
    document.getElementById('levelProgressBar').style.width = progress + '%';
    document.getElementById('levelProgressPct').textContent = progress + '%';

    if (next) {
      const need = next.minDays - streak;
      document.getElementById('levelNext').textContent = `再打卡 ${need} 天升级为「${next.name}」`;
    } else {
      document.getElementById('levelNext').textContent = '已达最高等级，继续保持！';
    }
  }

  function renderManageHeatmap() {
    const container = document.getElementById('heatmapInner');
    const card = document.getElementById('heatmapCard');
    if (!container || !card) return;

    const today = new Date();
    const cells = [];
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 52 * 7 - today.getDay());

    for (let w = 0; w < 53; w++) {
      const weekCells = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + w * 7 + d);
        const key = formatDate(date);
        const rec = checkinRecords[key];
        let count = 0;
        if (rec && habitsConfig.length > 0) {
          habitsConfig.forEach(h => {
            if (h.type === 'water') {
              if (((rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000)) count++;
            } else if (h.type === 'select') {
              if ((rec[h.id] && rec[h.id].value)) count++;
            } else {
              if ((rec[h.id] && rec[h.id].done)) count++;
            }
          });
        }
        weekCells.push({ date: key, count, day: date.getDay() });
      }
      cells.push(weekCells);
    }

    const hasData = cells.some(w => w.some(d => d.count > 0));
    if (!hasData) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';

    let html = '<div class="gm-heatmap-row">';

    html += '<div class="gm-heatmap-labels">';
    for (let d = 0; d < 7; d++) {
      html += `<span>${dayNames[d]}</span>`;
    }
    html += '</div>';

    html += '<div class="gm-heatmap-grid">';
    for (let w = 0; w < 53; w++) {
      html += '<div class="gm-heatmap-col">';
      for (let d = 0; d < 7; d++) {
        const cell = cells[w][d];
        let cls = 'gm-heatmap-cell';
        if (cell.count > 0 && cell.count <= 2) cls += ' l1';
        else if (cell.count > 2 && cell.count <= 4) cls += ' l2';
        else if (cell.count > 4 && cell.count <= 6) cls += ' l3';
        else if (cell.count > 6) cls += ' l4';
        if (cell.date === formatDate(today)) cls += ' today';
        html += `<div class="${cls}" title="${cell.date}: ${cell.count}个习惯"></div>`;
      }
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';

    const months = [];
    const monthLabels = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    let lastMonth = -1;
    for (let w = 0; w < 53; w++) {
      const m = new Date(cells[w][0].date).getMonth();
      if (m !== lastMonth) {
        months.push({ label: monthLabels[m], col: w });
        lastMonth = m;
      }
    }

    html += '<div class="gm-heatmap-months">';
    months.forEach(m => {
      html += `<span style="left:${(m.col / 53) * 100}%">${m.label}</span>`;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  App.UI.Render = {
    render,
    renderAmbientBg,
    swipeDate,
    renderTodayCard,
    refreshQuote,
    toggleQuoteExpand,
    renderReminderBanner,
    renderCheckin,
    renderStats,
    renderHeatmap,
    changeMonth,
    renderAchievements,
    renderManage,
    renderLevelCard,
    renderManageHeatmap
  };
})();
