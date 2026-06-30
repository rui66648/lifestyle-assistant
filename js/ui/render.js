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

  // 安全引用 utils.js 中的函数（兼容 compat.js 未生效的情况）
  var _U = (App.Core && App.Core.Utils) || {};
  var getCurrentSolarTerm = _U.getCurrentSolarTerm || function(){ return null; };
  var getCurrentSeason = _U.getCurrentSeason || function(){
    var m = new Date().getMonth() + 1;
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'autumn';
    return 'winter';
  };
  var getSeasonPack = _U.getSeasonPack || function(s) {
    return { name: '春季', emoji: '🌿', quote: '', tip: '顺应自然，健康生活' };
  };
  var getLunarDate = _U.getLunarDate || function(d){ return {monthStr:'',dayStr:''}; };
  var today = _U.today || function(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  var formatDate = _U.formatDate || function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  var getCurrentStreak = _U.getCurrentStreak || function(){ return 0; };
  var getCurrentLevel = _U.getCurrentLevel || function(){ return {level:1,name:'新手',icon:'🌱',minDays:0}; };
  var getNextLevel = _U.getNextLevel || function(){ return null; };
  var getLevelProgress = _U.getLevelProgress || function(){ return 0; };
  var getTotalCheckins = _U.getTotalCheckins || function(){ return 0; };
  var getTodayCompletionRate = _U.getTodayCompletionRate || function(){ return 0; };
  var showToast = _U.showToast || function(){};
  var getUserPoints = _U.getUserPoints || function(){ return 0; };

  function render(scopes) {
    // 无参数 = 全量渲染（向后兼容）
    if (!scopes) scopes = ['today', 'checkin', 'profile', 'manage'];
    if (typeof scopes === 'string') scopes = [scopes];

    if (scopes.indexOf('today') >= 0) {
      try { renderTodayCard(); } catch(e) { console.error('[render] renderTodayCard 出错:', e); }
      try { renderReminderBanner(); } catch(e) { console.error('[render] renderReminderBanner 出错:', e); }
    }
    if (scopes.indexOf('checkin') >= 0) {
      try { renderCheckin(); } catch(e) { console.error('[render] renderCheckin 出错:', e); }
    }
    if (scopes.indexOf('profile') >= 0) {
      try { renderProfile(); } catch(e) { console.error('[render] renderProfile 出错:', e); }
    }
    if (scopes.indexOf('manage') >= 0) {
      try { renderManage(); } catch(e) { console.error('[render] renderManage 出错:', e); }
    }
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
    const solarTerm = getCurrentSolarTerm();

    const card = document.getElementById('todayCard');
    if (card) card.className = 'mini-header';

    // 日期行：大号日期 + 月份/星期
    const dateEl = document.getElementById('todayDate');
    if (dateEl) dateEl.innerHTML = `<span class="day-num">${d.getDate()}</span><span class="weekday">日 ${d.getMonth()+1}月 · 周${weekDay}</span>`;

    // 农历 + 节气倒计时
    let dateExtras = `${lunar.monthStr}月${lunar.dayStr}`;
    if (solarTerm) {
      dateExtras += ` · ${solarTerm.emoji} ${solarTerm.name}`;
      // 计算节气天数
      var daysSince = _getDaysSinceTerm(d, solarTerm);
      if (daysSince === 0) {
        dateExtras += ' · 今天';
      } else if (daysSince > 0 && daysSince <= 15) {
        dateExtras += '后第' + daysSince + '天';
      }
    }
    const lunarEl = document.getElementById('todayLunar');
    if (lunarEl) lunarEl.textContent = dateExtras;

    // 积分徽章
    const badgesEl = document.getElementById('todayBadges');
    if (badgesEl) {
      const points = getUserPoints();
      badgesEl.innerHTML = `<span class="mini-points-badge" title="累计积分">⭐ ${points} 积分</span>`;
    }

    // 原文引用
    let tipText = pack.quote || (solarTerm ? solarTerm.tip : pack.tip);
    const tipEl = document.getElementById('todaySeasonTip');
    if (tipEl) tipEl.innerHTML = tipText;

    refreshQuote();
  }

  // 计算距离当前节气的天数
  function _getDaysSinceTerm(now, term) {
    if (typeof SOLAR_TERMS === 'undefined' || !Array.isArray(SOLAR_TERMS)) return 0;
    var termDate = new Date(now.getFullYear(), term.month - 1, term.day);
    var diff = Math.floor((now - termDate) / 86400000);
    if (diff < 0) {
      // 当前日期在节气之前，尝试用去年的日期
      termDate = new Date(now.getFullYear() - 1, term.month - 1, term.day);
      diff = Math.floor((now - termDate) / 86400000);
    }
    return Math.max(0, Math.min(15, diff));
  }



  function refreshQuote() {
    const qIdx = Math.floor(Math.random() * HEALTH_TIPS.length);
    let qTip = HEALTH_TIPS[qIdx];
    let attempts = 0;
    while (qTip.source.length < 20 && attempts < 10) {
      qTip = HEALTH_TIPS[Math.floor(Math.random() * HEALTH_TIPS.length)];
      attempts++;
    }
    const quoteTextEl = document.getElementById('quoteText');
    const quoteSourceEl = document.getElementById('quoteSource');
    if (quoteTextEl) quoteTextEl.textContent = qTip.source.split('--')[0];
    if (quoteSourceEl) quoteSourceEl.textContent = '--' + (qTip.source.split('--')[1] || '');
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
    if (!el) return;
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

  // ---- 打卡项辅助 ----
  function _getNextTime(h, rec, nowMinutes) {
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
    const tp = h.timePeriod || 'daytime';
    const defaults = {morning:420, forenoon:600, afternoon:840, evening:1260, daytime:720};
    return defaults[tp] || 720;
  }

  function _buildCheckinItems(rec, nowMinutes, viewOffset) {
    const isChecked = App.Core.Storage.isHabitChecked;
    const viewDate = new Date();
    viewDate.setDate(viewDate.getDate() + (viewOffset || 0));
    const viewDow = viewDate.getDay();
    const isViewToday = (viewOffset || 0) === 0;
    const items = [];
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const repeat = h.repeat || [0,1,2,3,4,5,6];
      if (!repeat.includes(viewDow)) return;
      const checked = isChecked(h, rec);
      const nextTime = _getNextTime(h, rec, nowMinutes);
      const overdue = isViewToday && !checked && nextTime < nowMinutes;
      const soon = isViewToday && !checked && !overdue && nextTime <= nowMinutes + 60;
      items.push({h, checked, nextTime, overdue, soon});
    });
    items.sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (a.soon !== b.soon) return a.soon ? -1 : 1;
      return a.nextTime - b.nextTime;
    });
    return items;
  }

  function _renderEncourageRing(doneCount, total, firstHabitId) {
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
    const pct = Math.round((doneCount / total) * 100);
    const r = 52, c = 2 * Math.PI * r, offset = c - (pct / 100) * c;
    const retroBtn = firstHabitId
      ? `<div style="margin-top:4px"><button onclick="openRetroactivePanel('${firstHabitId}')" style="font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;font-weight:600">📅 补签过去7天</button></div>`
      : '';
    return `<div style="text-align:center;padding:16px 16px 6px">
      <svg width="120" height="120" style="display:block;margin:0 auto">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--rule)" stroke-width="8"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .6s ease"/>
        <text x="60" y="55" text-anchor="middle" font-size="28" font-weight="800" fill="var(--accent)">${pct}%</text>
        <text x="60" y="72" text-anchor="middle" font-size="11" fill="var(--muted)">${doneCount}/${total}</text>
      </svg>
      <div style="font-size:13px;color:var(--muted);margin-top:6px;line-height:1.6">${encourageMsgs[encourageIdx]}</div>
      ${retroBtn}
    </div>`;
  }

  function _renderHabitCardRow(h, checked, overdue, soon, rec) {
    const collapsedClass = checked ? 'collapsed' : '';
    const rec2 = rec[h.id] || {};
    const skipped = rec2.skipped;
    const doneCardClass = (checked || skipped) ? 'done-card' : '';
    const ribbonCls = checked ? 'done' : skipped ? 'skipped' : overdue ? 'overdue' : 'pending';
    // 时间段 class 映射（用于现代简约主题渐变边框）
    const periodMap = { morning:'morning', forenoon:'morning', afternoon:'afternoon', evening:'evening', night:'night' };
    const periodClass = h.timePeriod && periodMap[h.timePeriod] ? periodMap[h.timePeriod] + '-period' : '';

    // 查找习惯描述（从 HABIT_LIBRARY）
    var libTip = '';
    if (typeof HABIT_LIBRARY !== 'undefined' && Array.isArray(HABIT_LIBRARY)) {
      var found = HABIT_LIBRARY.find(function(lib) { return lib.id === h.id; });
      if (found && found.tip) libTip = found.tip;
    }

    if (h.type === 'water') {
      return renderWaterTracker(h, rec).replace('class="water-tracker"', `class="water-tracker ${collapsedClass} ${periodClass}"`);
    }

    if (h.type === 'select') {
      const selected = rec[h.id] ? rec[h.id].value : '';
      const tipStr2 = h.tip || '';
      const timeHint = overdue ? '<span class="habit-time-hint overdue">已过期</span>' : soon ? '<span class="habit-time-hint soon">即将</span>' : '';
      const emotionPeriod = h.timePeriod && periodMap[h.timePeriod] ? periodMap[h.timePeriod] + '-period' : '';
      return `<div class="habit-card ${collapsedClass} ${emotionPeriod}" id="card-${h.id}" onclick="openEmotionPanel()">
        <span class="status-ribbon ${ribbonCls}"></span>
        <span class="icon">${h.icon}</span>
        <div class="info">
          <div class="name">${h.name}${selected ? '：' + selected : ''}</div>
          <div class="meta"><span style="color:var(--accent)">点击记录今日情绪</span>${timeHint}</div>
          ${tipStr2 ? `<div style="font-size:11px;color:var(--accent);margin-top:3px;line-height:1.4">💡 ${tipStr2}</div>` : ''}
        </div>
        <button class="checkin-btn ${selected ? 'done' : 'pending'}">${selected ? '✓' : '记录'}</button>
      </div>`;
    }

    // 通用类型：boolean / count / timer
    const streak = getStreak(h.id);
    const reminder = h.reminder;
    const reminderStr = reminder && reminder.enabled ? reminder.time : '';
    const valueStr = checked ? (h.type === 'boolean' ? '' : ` ${rec[h.id].value}${h.unit}`) : '';
    const failed = h.negative && rec[h.id] && rec[h.id].failed;
    const isNegative = h.negative;
    const negClass = isNegative ? ' negative' : '';
    const timeHint = overdue ? '<span class="habit-time-hint overdue">已过期</span>' : soon ? '<span class="habit-time-hint soon">即将</span>' : '';
    const btnClass = skipped ? 'skip' : failed ? 'failed' : checked ? 'done' : 'pending';
    const btnText = skipped ? '⏭ 跳过' : failed ? '✗ 犯了' : checked ? '✓' : (isNegative ? '没犯' : '打卡');
    const skipBtn = !isNegative ? `<button class="checkin-btn ${skipped ? 'skip' : 'pending'}" onclick="event.stopPropagation();skipHabit('${h.id}')" title="跳过（不打断连续）">⏭</button>` : '';

    // 间隔提醒倒计时
    let intervalHtml = '';
    if (h.intervalReminder && h.intervalReminder.enabled) {
      const ir = h.intervalReminder;
      const last = (rec[h.id] && rec[h.id].lastInterval) || (rec[h.id] && rec[h.id].timestamp) || 0;
      const elapsedMin = last ? Math.floor((Date.now() - last) / 60000) : ir.interval;
      const remainMin = Math.max(0, ir.interval - elapsedMin);
      const pct = last ? Math.min(100, Math.round((elapsedMin / ir.interval) * 100)) : 0;
      const isOverdue = elapsedMin >= ir.interval;
      const label = isOverdue ? '已到期' : remainMin + '分钟后';
      intervalHtml = `<span style="font-size:11px;color:${isOverdue ? '#e74c3c' : 'var(--muted)'};background:var(--bg2);padding:2px 6px;border-radius:6px;display:inline-flex;align-items:center;gap:3px"><span style="display:inline-block;width:${pct/5}px;height:6px;background:${isOverdue ? '#e74c3c' : 'var(--accent)'};border-radius:3px"></span>⏰ ${label}</span>`;
    }

    return `<div class="habit-card ${collapsedClass} ${negClass} ${doneCardClass} ${periodClass}" id="card-${h.id}" style="position:relative">
      <span class="status-ribbon ${ribbonCls}"></span>
      <span class="icon">${isNegative ? '❌' : h.icon}</span>
      <div class="info">
        <div class="name">${isNegative ? '不' + h.name : h.name}${valueStr}</div>
        <div class="meta">
          ${reminderStr ? '<span>⏰ ' + reminderStr + '前</span>' : ''}
          ${intervalHtml}
          ${streak > 0 ? '<span class="streak">🔥' + streak + '天</span>' : ''}
          ${timeHint}
        </div>
        ${libTip ? '<div class="habit-desc">' + libTip + '</div>' : ''}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${skipBtn}
        <button class="checkin-btn ${btnClass}" onclick="handleCheckin('${h.id}')">${btnText}</button>
      </div>
    </div>`;
  }

  function renderCheckin() {
    const container = document.getElementById('checkinContent');
    if (!container) return;
    // 防御：确保 checkinRecords 存在
    if (typeof checkinRecords === 'undefined') { window.checkinRecords = {}; }
    if (typeof habitsConfig === 'undefined' || !Array.isArray(habitsConfig)) {
      console.warn('[renderCheckin] habitsConfig 无效，尝试从 localStorage 恢复');
      try {
        var cfg = localStorage.getItem('habits_config');
        if (cfg) window.habitsConfig = JSON.parse(cfg);
        else window.habitsConfig = [];
      } catch(e) { window.habitsConfig = []; }
    }
    const rec = (typeof checkinRecords !== 'undefined' ? checkinRecords : {})[today()] || {};
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // 日期导航器
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

    const items = _buildCheckinItems(rec, nowMinutes, viewDateOffset);
    const viewDate = new Date();
    viewDate.setDate(viewDate.getDate() + viewDateOffset);
    const dow = viewDate.getDay();

    let html = '';

    // 周日显示周报入口
    if (dow === 0) {
      html += '<div class="report-card" style="cursor:pointer" onclick="openReportPanel()"><div class="report-title">📋 点击查看本周总结</div></div>';
    }

    // 体质推荐（仅当天显示）
    if (viewDateOffset === 0) {
      html += renderConstitutionEntry();
      html += renderConstitutionTips();
    }

    const total = items.length;
    const doneCount = items.filter(x => x.checked).length;
    const buildRecord = App.Modules.Checkin && App.Modules.Checkin.buildBatchCompleteRecord;
    const batchPending = buildRecord
      ? items.filter(function(x) { return !x.checked && buildRecord(x.h); }).length
      : 0;

    // 一键全选按钮（当天且有可自动完成的习惯时显示）
    if (viewDateOffset === 0 && batchPending > 0) {
      html += '<button class="batch-complete-btn" onclick="App.UI.Render.batchCompleteAll()">✨ 一键全部完成（' + batchPending + '项）</button>';
    }

    if (total > 0) {
      const firstId = (items[0] && items[0].h) ? items[0].h.id : ((habitsConfig[0] && habitsConfig[0].id) || '');
      html += _renderEncourageRing(doneCount, total, firstId);
    }

    // 按时间段分组
    const periods = [
      { id: 'morning', name: '早晨', icon: '🌅', emoji: '🌅', range: [4, 10] },
      { id: 'forenoon', name: '上午', icon: '🌤️', emoji: '🌤️', range: [10, 12] },
      { id: 'afternoon', name: '下午', icon: '☀️', emoji: '☀️', range: [12, 18] },
      { id: 'evening', name: '晚上', icon: '🌙', emoji: '🌙', range: [18, 24] }
    ];

    const periodMap = { morning:'morning', forenoon:'morning', afternoon:'afternoon', evening:'evening', night:'evening' };

    periods.forEach(period => {
      const groupItems = items.filter(({h}) => {
        const tp = h.timePeriod || 'daytime';
        if (tp === period.id) return true;
        if (periodMap[tp] === period.id) return true;
        if (tp === 'daytime' && h.reminder && h.reminder.enabled && h.reminder.time) {
          const [hr, min] = h.reminder.time.split(':').map(Number);
          const minutes = hr * 60 + min;
          const rangeStart = period.range[0] * 60;
          const rangeEnd = period.range[1] * 60;
          return minutes >= rangeStart && minutes < rangeEnd;
        }
        if (h.reminder && h.reminder.enabled && h.reminder.time) {
          const [hr, min] = h.reminder.time.split(':').map(Number);
          const minutes = hr * 60 + min;
          const rangeStart = period.range[0] * 60;
          const rangeEnd = period.range[1] * 60;
          return minutes >= rangeStart && minutes < rangeEnd;
        }
        return false;
      });

      const doneInGroup = groupItems.filter(x => x.checked).length;
      const totalInGroup = groupItems.length;

      if (totalInGroup === 0 && total > 0) return;
      if (totalInGroup === 0) return;

      html += `<div class="time-group">
        <div class="time-group-header">
          <div class="time-group-left">
            <span class="time-group-icon">${period.emoji}</span>
            <span class="time-group-name">${period.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="time-group-count">${doneInGroup}/${totalInGroup}</span>
          </div>
        </div>`;

      groupItems.forEach(({h, checked, overdue, soon}) => {
        html += _renderHabitCardRow(h, checked, overdue, soon, rec);
      });

      html += `</div>`;
    });

    if (items.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:14px;">还没有添加习惯<br><br>请先到 <strong style="color:var(--accent);cursor:pointer;" onclick="switchTab(\'manage\')">【管理】</strong> 界面添加习惯</div>';
    }

    container.innerHTML = html;
  }

  function renderStats() {
    const done = getTodayDone();
    const total = getTodayTotal();
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let maxStreakAll = 0;
    habitsConfig.forEach(h => {
      maxStreakAll = Math.max(maxStreakAll, getMaxStreak(h.id));
    });
    const statsGrid = document.getElementById('statsGrid');
    if (statsGrid) {
      if (total === 0) {
        statsGrid.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px;grid-column:1/-1">还没有习惯数据</div>';
      } else {
        const points = getUserPoints();
        statsGrid.innerHTML = `
          <div class="stat-card"><div class="stat-val">${done}/${total}</div><div class="stat-label">今日完成</div></div>
          <div class="stat-card"><div class="stat-val">${maxStreakAll}</div><div class="stat-label">最长连续</div></div>
          <div class="stat-card"><div class="stat-val">${getWeekRate()}%</div><div class="stat-label">本周率</div></div>
          <div class="stat-card"><div class="stat-val">${getMonthRate()}%</div><div class="stat-label">本月率</div></div>
          <div class="stat-card points-card"><div class="stat-val">⭐${points}</div><div class="stat-label">累计积分</div></div>
        `;
      }
    }

    const rankingList = document.getElementById('rankingList');
    if (rankingList) {
      if (habitsConfig.length === 0) {
        rankingList.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">还没有习惯，点击 + 开始添加吧</div>';
      } else {
        const sorted = [...habitsConfig].sort((a, b) => getCompletionRate(b.id, 30) - getCompletionRate(a.id, 30));
        const rankHtml = sorted.map((h, i) => {
          const rate = getCompletionRate(h.id, 30);
          const cls = rate >= 70 ? 'high' : rate >= 40 ? 'mid' : 'low';
          let rankClass = 'normal';
          if (i === 0) rankClass = 'gold';
          else if (i === 1) rankClass = 'silver';
          else if (i === 2) rankClass = 'bronze';
          return `<div class="ranking-item">
            <div class="ranking-rank ${rankClass}">${i < 3 ? ['🥇','🥈','🥉'][i] : i+1}</div>
            <div class="ranking-header"><span class="ranking-name">${h.icon} ${h.name}</span><span class="ranking-pct">${rate}%</span></div>
            <div class="ranking-bar"><div class="ranking-fill ${cls}" style="width:${rate}%"></div></div>
          </div>`;
        }).join('');
        rankingList.innerHTML = rankHtml || '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">暂无数据</div>';
      }
    }

    renderWeekBarChart();
    renderHeatmap();
    renderAchievements();
  }

  function toggleRanking() {
    const section = document.getElementById('rankingSection');
    if (section) {
      section.classList.toggle('collapsed');
    }
  }
  window.toggleRanking = toggleRanking;

  // ===== 共享月度热力图渲染（DRY掉 renderHeatmap 和 renderSdHeatmap 的80%重复） =====
  function _renderMonthlyHeatmap(gridEl, monthLabelEl, dateObj, todayStr) {
    if (!gridEl) return;
    var year = dateObj.getFullYear();
    var month = dateObj.getMonth();
    if (monthLabelEl) monthLabelEl.textContent = year + '年' + (month + 1) + '月';

    var dayLabels = ['一','二','三','四','五','六','日'];
    var html = dayLabels.map(function(l) { return '<div class="heatmap-day-label">' + l + '</div>'; }).join('');

    var firstDay = new Date(year, month, 1);
    var startWeekday = firstDay.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

    var daysInMonth = new Date(year, month + 1, 0).getDate();

    for (var i = 0; i < startWeekday; i++) {
      html += '<div class="heatmap-cell empty"></div>';
    }

    var totalHabits = habitsConfig.filter(function(h) { return h.enabled !== false; }).length;
    for (var d = 1; d <= daysInMonth; d++) {
      var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var rec = checkinRecords[key] || {};
      var doneCount = 0;
      habitsConfig.forEach(function(h) {
        if (h.enabled === false) return;
        if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec)) doneCount++;
      });
      var ratio = totalHabits > 0 ? doneCount / totalHabits : 0;
      var lv = App.Core.Utils.getHeatmapLevel(ratio);
      var cls = lv > 0 ? 'l' + lv : '';
      var todayCls = key === todayStr ? ' today' : '';
      html += '<div class="heatmap-cell ' + cls + todayCls + '" title="' + key + ': ' + doneCount + '/' + totalHabits + '"></div>';
    }

    gridEl.innerHTML = html;
  }

  function renderHeatmap() {
    _renderMonthlyHeatmap(
      document.getElementById('heatmapGrid'),
      document.getElementById('heatmapMonth'),
      heatmapDate,
      today()
    );
  }

  function changeMonth(delta) {
    heatmapDate.setMonth(heatmapDate.getMonth() + delta);
    renderHeatmap();
  }

  function renderAchievements() {
    const container = document.getElementById('achievements');
    if (!container) return;
    const badges = [
      {id:'streak7',label:'7天连续',icon:'🔥',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 7)},
      {id:'streak14',label:'14天连续',icon:'🔥',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 14)},
      {id:'streak30',label:'30天连续',icon:'⭐',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 30)},
      {id:'all_done',label:'全部完成',icon:'🏆',check: () => {
        const rec = checkinRecords[today()] || {};
        return habitsConfig.length > 0 && habitsConfig.every(h => App.Core.Storage.isHabitChecked(h, rec));
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

  function renderProfile() {
    renderLevelCard();
    renderProfileStats();
    renderProfileGrid();
    renderStats();
    renderDailyCardPreview();
  }

  function renderManage() {
    renderManageStats();
    renderManageGroups();
  }

  function renderManageStats() {
    const container = document.getElementById('mgStats');
    if (!container) return;
    const total = habitsConfig.length;
    const enabled = habitsConfig.filter(h => h.enabled !== false).length;
    const todayStr = today();
    const rec = checkinRecords[todayStr] || {};
    let doneToday = 0;
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      if (rec[h.id] && rec[h.id].done) doneToday++;
    });
    const activeCount = enabled || 0;

    container.innerHTML = `
      <div class="mg-stat-card">
        <div class="mg-stat-num">${total}</div>
        <div class="mg-stat-label">全部习惯</div>
      </div>
      <div class="mg-stat-card">
        <div class="mg-stat-num">${activeCount}</div>
        <div class="mg-stat-label">已启用</div>
      </div>
      <div class="mg-stat-card">
        <div class="mg-stat-num">${doneToday}</div>
        <div class="mg-stat-label">今日完成</div>
      </div>
      <div class="mg-stat-card">
        <div class="mg-stat-num">${todayStr.split('-')[2]}日</div>
        <div class="mg-stat-label">今天</div>
      </div>`;
  }

  function renderManageGroups() {
    const container = document.getElementById('mgGroups');
    const search = (document.getElementById('mgSearch') && document.getElementById('mgSearch').value || '').toLowerCase();

    if (habitsConfig.length === 0) {
      container.innerHTML = `<div class="mg-empty">
        <span class="mg-empty-icon">📦</span>
        还没有添加任何习惯<br>
        点击右上角「+ 添加」开始吧
      </div>`;
      return;
    }

    // Time period definitions
    const periods = [
      { id: 'morning', name: '早晨', icon: '🌅', emoji: '🌅', range: [4, 10] },
      { id: 'forenoon', name: '上午', icon: '🌤️', emoji: '🌤️', range: [10, 12] },
      { id: 'afternoon', name: '下午', icon: '☀️', emoji: '☀️', range: [12, 18] },
      { id: 'evening', name: '晚上', icon: '🌙', emoji: '🌙', range: [18, 24] }
    ];

    let html = '';
    periods.forEach(period => {
      const groupHabits = [];

      habitsConfig.forEach(h => {
        if (search && !h.name.toLowerCase().includes(search)) return;

        const tp = h.timePeriod || 'daytime';

        // Direct match by timePeriod
        if (tp === period.id) {
          if (!groupHabits.find(x => x.id === h.id)) groupHabits.push(h);
          return;
        }

        // For 'daytime' or habits with no timePeriod, try to match by reminder time
        if (tp === 'daytime') {
          if (h.reminder && h.reminder.enabled && h.reminder.time) {
            const [hr, min] = h.reminder.time.split(':').map(Number);
            const minutes = hr * 60 + min;
            const rangeStart = period.range[0] * 60;
            const rangeEnd = period.range[1] * 60;
            if (minutes >= rangeStart && minutes < rangeEnd) {
              if (!groupHabits.find(x => x.id === h.id)) groupHabits.push(h);
            }
          }
          return;
        }

        // Reminder-based cross-period match
        if (h.reminder && h.reminder.enabled && h.reminder.time) {
          const [hr, min] = h.reminder.time.split(':').map(Number);
          const minutes = hr * 60 + min;
          const rangeStart = period.range[0] * 60;
          const rangeEnd = period.range[1] * 60;
          if (minutes >= rangeStart && minutes < rangeEnd) {
            if (!groupHabits.find(x => x.id === h.id)) groupHabits.push(h);
          }
        }
      });

      const enabledCount = groupHabits.filter(h => h.enabled !== false).length;
      const totalCount = groupHabits.length;

      // Skip empty groups when searching
      if (search && totalCount === 0) return;

      html += `<div class="mg-group" id="mg-group-${period.id}">
        <div class="mg-group-header" onclick="toggleMgGroup('${period.id}')">
          <div class="mg-group-left">
            <span class="mg-group-icon">${period.emoji}</span>
            <span class="mg-group-name">${period.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="mg-group-count">${enabledCount}/${totalCount}</span>
            <span class="mg-group-arrow" id="mg-arrow-${period.id}">▼</span>
          </div>
        </div>
        <div class="mg-group-body" id="mg-body-${period.id}">`;

      if (totalCount === 0) {
        html += `<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">暂无习惯</div>`;
      } else {
        groupHabits.forEach(h => {
          const enabled = h.enabled !== false;
          const typeLabel = h.type === 'boolean' ? '打卡' : h.type === 'count' ? `计数·${h.unit}` : h.type === 'water' ? '饮水追踪' : `计时·${h.unit}`;
          const reminder = h.reminder;
          const reminderStr = reminder && reminder.enabled ? `⏰ ${reminder.time}` : '';
          const repeatArr = h.repeat || [0,1,2,3,4,5,6];
          const repeatLabel = repeatArr.length === 7 ? '每天' : repeatArr.length === 5 && !repeatArr.includes(0) && !repeatArr.includes(6) ? '工作日' : repeatArr.length === 2 && repeatArr.includes(0) && repeatArr.includes(6) ? '周末' : `每周${repeatArr.length}天`;

          html += `<div class="mg-item" onclick="openHabitEditPanel('${h.id}')">
            <span class="mg-item-icon">${h.icon}</span>
            <div class="mg-item-info">
              <div class="mg-item-name">${h.name}</div>
              <div class="mg-item-meta">
                <span class="mg-item-type">${typeLabel}</span>
                <span>${repeatLabel}</span>
                ${reminderStr ? `<span>${reminderStr}</span>` : ''}
              </div>
            </div>
            <div class="mg-item-actions">
              <div class="mg-item-toggle ${enabled ? 'on' : ''}" onclick="event.stopPropagation();toggleHabitEnabled('${h.id}')"></div>
            </div>
          </div>`;
        });
      }

      html += `</div></div>`;
    });

    container.innerHTML = html;
  }

  function toggleMgGroup(periodId) {
    const body = document.getElementById('mg-body-' + periodId);
    const arrow = document.getElementById('mg-arrow-' + periodId);
    if (!body || !arrow) return;
    body.classList.toggle('collapsed');
    arrow.classList.toggle('expanded');
  }

  function renderDailyCardCollection() {
    const body = document.getElementById('dailyCardPanelBody');
    const cards = [];
    const dates = Object.keys(localStorage).filter(k => k.startsWith('daily_diary_'));

    dates.forEach(key => {
      const date = key.replace('daily_diary_', '');
      const diary = JSON.parse(localStorage.getItem(key) || '""');
      const rec = checkinRecords[date] || {};
      let allDone = true;
      let anyDone = false;
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        if (rec[h.id] && rec[h.id].done) anyDone = true;
        else allDone = false;
      });
      if (anyDone || diary) {
        cards.push({ date, diary, allDone, anyDone });
      }
    });

    cards.sort((a, b) => b.date.localeCompare(a.date));

    if (cards.length === 0) {
      body.innerHTML = '<div class="dc-empty">🎴 还没有每日卡片<br>全部完成当天习惯后会自动生成</div>';
      return;
    }

    const emojis = ['🌟','🏆','💪','🌿','🎯','✨','💎','🔥','🌈','🌻'];
    let html = '';
    cards.forEach((card, idx) => {
      const emoji = card.allDone ? '🏆' : emojis[idx % emojis.length];
      html += `<div class="dc-full-card">
        <span class="dc-full-emoji">${emoji}</span>
        <div class="dc-full-date">${card.date}</div>
        <div class="dc-full-title">${card.allDone ? '全部完成！太棒了' : '继续加油'}</div>
        <div class="dc-full-subtitle">${card.allDone ? '今天所有习惯都已完成，给自己一个大大的赞！' : '今天有坚持打卡，明天继续努力哦~'}</div>
        ${card.diary ? `<div class="dc-full-diary">📝 ${card.diary}</div>` : ''}
      </div>`;
    });

    body.innerHTML = html;
  }

  function renderDailyCardPreview() {
    const entry = document.getElementById('dailyCardsEntry');
    const preview = document.getElementById('dcPreview');
    const countEl = document.getElementById('dcCount');
    if (!entry || !preview || !countEl) return;

    const dates = Object.keys(localStorage).filter(k => k.startsWith('daily_diary_'));
    if (dates.length === 0) {
      entry.style.display = 'none';
      return;
    }

    entry.style.display = 'block';
    countEl.textContent = dates.length + '张';

    const recent = dates.sort().reverse().slice(0, 4);
    const emojis = ['🌟','🏆','💪','🌿'];
    preview.innerHTML = recent.map((_, i) => `<div class="dc-card-mini">${emojis[i % 4]}</div>`).join('');
  }

  function openDailyCardCollection() {
    renderDailyCardCollection();
    App.UI.Panels.openPanel('dailyCardPanel');
  }

  function openHabitEditPanel(habitId) {
    renderHabitEditPanel(habitId);
    App.UI.Panels.openPanel('habitEditPanel');
  }

  function renderHabitEditPanel(habitId) {
    const body = document.getElementById('habitEditPanelBody');
    const habit = habitsConfig.find(h => h.id === habitId);
    if (!habit) { body.innerHTML = '<p style="color:var(--muted);text-align:center">习惯未找到</p>'; return; }

    const enabled = habit.enabled !== false;
    const reminderEnabled = habit.reminder && habit.reminder.enabled;
    const reminderTime = (habit.reminder && habit.reminder.time) || '08:00';
    const repeatArr = habit.repeat || [0,1,2,3,4,5,6];
    const repeatDays = ['日','一','二','三','四','五','六'];
    const extraReminders = habit.extraReminders || [];
    const note = habit.note || '';

    const iconOptions = App.Data.CUSTOM_ICONS || ['✅','🎯','⭐','💪','🏃','🚶','🧘','🏋️','🚴','🏊',
      '📚','✍️','🎨','🎵','🎸','📝','💻','📱','💧','🥤','☕','🍵','🥗','🍎','🥦','💊',
      '😴','🛏️','🌅','🌙','☀️','🌿','🌸','💡','❤️','🔥','🧹','🪴','🐕','🐈','🍳','🧑‍🍳','🫧','💆','🦷','👀',
      '📓','💭','🙏','🧠','🎒','💼','🛒','✈️','🎂'];

    const categories = [
      {id:'sport',label:'运动健身 💪'},
      {id:'diet',label:'饮食营养 🥗'},
      {id:'study',label:'学习成长 📚'},
      {id:'sleep',label:'睡眠作息 😴'},
      {id:'mind',label:'心灵修养 🧠'},
      {id:'protect',label:'五劳防护 🛡️'},
      {id:'care',label:'个人护理 🧴'},
      {id:'home',label:'居家生活 🏠'},
      {id:'social',label:'社交人际 💬'},
      {id:'hobby',label:'兴趣爱好 🎯'},
      {id:'quit',label:'戒除改善 🚫'},
      {id:'daytime',label:'自定义 ✨'}
    ];

    const types = [
      {id:'boolean',label:'打卡（完成/未完成）'},
      {id:'count',label:'计数'},
      {id:'timer',label:'计时'},
      {id:'water',label:'饮水追踪'}
    ];

    let html = '';
    // Name
    html += `<div class="he-label">习惯名称</div>
      <input class="he-input" id="heName" value="${habit.name}" maxlength="20">`;

    // Icon picker (collapsible)
    const selectedIconLabel = habit.icon || '⭐';
    html += `<div class="he-label" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'grid':'none';this.querySelector('.he-collapse-arrow').classList.toggle('collapsed')">
      <span>选择图标 <span style="font-size:20px;margin-left:4px">${selectedIconLabel}</span></span>
      <span class="he-collapse-arrow">▼</span>
    </div>
      <div class="he-icon-grid" style="display:none">`;
    iconOptions.forEach(ico => {
      const sel = habit.icon === ico ? ' selected' : '';
      html += `<div class="he-icon-opt${sel}" data-icon="${ico}" onclick="App.UI.Render.selectEditIcon(this,'${ico}')">${ico}</div>`;
    });
    html += `</div><input type="hidden" id="heIcon" value="${habit.icon}">`;

    // Category
    html += `<div class="he-row">
      <div class="he-row-item">
        <div class="he-label">分类</div>
        <select class="he-select" id="heCategory">`;
    categories.forEach(c => {
      const sel = habit.category === c.id ? ' selected' : '';
      html += `<option value="${c.id}"${sel}>${c.label}</option>`;
    });
    html += `</select></div>`;

    // Type
    html += `<div class="he-row-item">
        <div class="he-label">类型</div>
        <select class="he-select" id="heType" onchange="App.UI.Render.onEditTypeChange()">`;
    types.forEach(t => {
      const sel = habit.type === t.id ? ' selected' : '';
      html += `<option value="${t.id}"${sel}>${t.label}</option>`;
    });
    html += `</select></div></div>`;

    // Unit (for count/timer types)
    html += `<div id="heUnitWrap" style="display:${(habit.type === 'count' || habit.type === 'timer') ? 'block' : 'none'}">
      <div class="he-label">单位</div>
      <input class="he-input" id="heUnit" value="${habit.unit || ''}" placeholder="如：杯、分钟">
    </div>`;

    // Target (for count/timer types)
    html += `<div id="heTargetWrap" style="display:${(habit.type === 'count' || habit.type === 'timer') ? 'block' : 'none'}">
      <div class="he-label">每日目标</div>
      <input class="he-input" id="heTarget" type="number" value="${habit.target || ''}" placeholder="每日目标数量">
    </div>`;

    // Repeat days
    html += `<div class="he-label">重复日</div>
      <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">`;
    repeatDays.forEach((d, i) => {
      const isActive = repeatArr.includes(i);
      const activeClass = isActive ? ' active' : '';
      html += `<div class="repeat-day-btn${activeClass}" data-day="${i}" onclick="App.UI.Render.toggleEditRepeatDay(this,${i})">${d}</div>`;
    });
    html += `</div><input type="hidden" id="heRepeat" value="${repeatArr.join(',')}">`;

    // Reminder
    html += `<div class="he-switch-row">
      <span class="he-switch-label">🔔 开启提醒</span>
      <div class="mg-item-toggle ${reminderEnabled ? 'on' : ''}" onclick="this.classList.toggle('on');document.getElementById('heReminderTimeWrap').style.display=this.classList.contains('on')?'flex':'none'" id="heReminderToggle"></div>
    </div>`;
    html += `<div id="heReminderTimeWrap" style="display:${reminderEnabled ? 'flex' : 'none'}" class="he-time-row">
      <span style="font-size:14px;color:var(--muted)">⏰</span>
      <input class="he-time-input" id="heReminderTime" type="time" value="${reminderTime}">
    </div>`;

    // Interval reminder
    const ir = habit.intervalReminder;
    const irEnabled = ir && ir.enabled;
    const irInterval = (ir && ir.interval) || 45;
    const irStart = (ir && ir.startTime) || '09:00';
    const irEnd = (ir && ir.endTime) || '18:00';
    const irDays = (ir && ir.days) || [0,1,2,3,4,5,6];
    html += `<div style="margin-top:10px;padding:10px;background:var(--bg2);border-radius:12px">
      <div class="he-switch-row" style="margin-bottom:8px">
        <span class="he-switch-label">⏰ 间隔提醒（每${irInterval}分钟）</span>
        <div class="mg-item-toggle ${irEnabled ? 'on' : ''}" onclick="this.classList.toggle('on');document.getElementById('irWrap').style.display=this.classList.contains('on')?'block':'none'" id="heIntervalToggle"></div>
      </div>
      <div id="irWrap" style="display:${irEnabled ? 'block' : 'none'}">
        <div style="font-size:13px;color:var(--muted);margin-bottom:6px">间隔 <input id="irInterval" type="number" value="${irInterval}" min="5" max="180" style="width:50px;padding:4px 8px;border:1px solid var(--rule);border-radius:6px;font-size:13px;text-align:center"> 分钟</div>
        <div style="display:flex;gap:8px;margin-bottom:6px">
          <input id="irStart" type="time" value="${irStart}" style="flex:1;padding:6px;border:1px solid var(--rule);border-radius:6px;font-size:13px">
          <span style="color:var(--muted);align-self:center">~</span>
          <input id="irEnd" type="time" value="${irEnd}" style="flex:1;padding:6px;border:1px solid var(--rule);border-radius:6px;font-size:13px">
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">`;
    repeatDays.forEach((d, i) => {
      const isActive = irDays.includes(i);
      html += `<div class="repeat-day-btn${isActive ? ' active' : ''}" data-irday="${i}" onclick="this.classList.toggle('active')" style="width:28px;height:28px;font-size:11px">${d}</div>`;
    });
    html += `</div></div></div>`;

    // Extra reminders
    html += `<div class="he-label" style="margin-top:6px">🔔 额外提醒</div>
      <div class="he-extra-reminders" id="heExtraRemindersList">`;
    extraReminders.forEach(t => {
      html += `<div class="he-extra-reminder-item">
          <input type="time" value="${t}">
          <span class="he-reminder-remove" onclick="this.parentElement.remove()">✕</span>
        </div>`;
    });
    html += `</div>
      <button class="he-add-reminder-btn" onclick="App.UI.Render.addEditReminderTime()">+ 添加提醒</button>`;

    // Note
    html += `<div class="he-label">📝 备注说明</div>
      <input class="he-input" id="heNote" value="${note}" placeholder="习惯说明（选填）" maxlength="100">`;

    // Enabled
    html += `<div class="he-switch-row">
      <span class="he-switch-label">✅ 启用习惯</span>
      <div class="mg-item-toggle ${enabled ? 'on' : ''}" onclick="this.classList.toggle('on')" id="heEnabledToggle"></div>
    </div>`;

    // Actions
    html += `<div class="he-actions">
      <button class="he-btn he-btn-delete delete-btn" onclick="App.UI.Render.deleteHabitConfirm('${habit.id}')" title="删除习惯"><svg class="svgIcon" viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
      <button class="he-btn he-btn-save" onclick="App.UI.Render.saveHabitEdit('${habit.id}')">💾 保存</button>
    </div>`;

    body.innerHTML = html;
  }

  function selectEditIcon(el, icon) {
    document.querySelectorAll('.he-icon-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('heIcon').value = icon;
  }

  function onEditTypeChange() {
    const type = document.getElementById('heType').value;
    const unitWrap = document.getElementById('heUnitWrap');
    const targetWrap = document.getElementById('heTargetWrap');
    if (type === 'count' || type === 'timer') {
      if (unitWrap) unitWrap.style.display = 'block';
      if (targetWrap) targetWrap.style.display = 'block';
    } else {
      if (unitWrap) unitWrap.style.display = 'none';
      if (targetWrap) targetWrap.style.display = 'none';
    }
  }

  function toggleEditRepeatDay(el) {
    el.classList.toggle('active');
    // CSS class 控制激活态样式，无需 JS 内联
    // Update hidden field
    const activeDays = [];
    document.querySelectorAll('.repeat-day-btn.active').forEach(btn => {
      activeDays.push(btn.dataset.day);
    });
    document.getElementById('heRepeat').value = activeDays.join(',');
  }

  function addEditReminderTime() {
    const list = document.getElementById('heExtraRemindersList');
    if (!list) return;
    const count = list.children.length;
    if (count >= 5) { showToast('最多添加5个额外提醒'); return; }
    const div = document.createElement('div');
    div.className = 'he-extra-reminder-item';
    div.innerHTML = `<input type="time" value="12:00"><span class="he-reminder-remove" onclick="this.parentElement.remove()">✕</span>`;
    list.appendChild(div);
  }

  function saveHabitEdit(habitId) {
    const habit = habitsConfig.find(h => h.id === habitId);
    if (!habit) return;
    const name = document.getElementById('heName').value.trim();
    if (!name) return;

    habit.name = name;
    habit.icon = document.getElementById('heIcon').value;
    habit.category = document.getElementById('heCategory').value;
    habit.type = document.getElementById('heType').value;

    if (habit.type === 'count' || habit.type === 'timer') {
      habit.unit = document.getElementById('heUnit').value || '次';
      habit.target = parseInt(document.getElementById('heTarget').value) || 1;
    }

    const repeatStr = document.getElementById('heRepeat').value;
    habit.repeat = repeatStr ? repeatStr.split(',').map(Number) : [0,1,2,3,4,5,6];

    const reminderEnabled = document.getElementById('heReminderToggle').classList.contains('on');
    const reminderTime = document.getElementById('heReminderTime').value;
    habit.reminder = { enabled: reminderEnabled, time: reminderTime };

    // 额外提醒
    const extraReminderInputs = document.querySelectorAll('#heExtraRemindersList input[type="time"]');
    const extraReminders = [];
    extraReminderInputs.forEach(inp => {
      if (inp.value) extraReminders.push(inp.value);
    });
    habit.extraReminders = extraReminders;

    // 备注
    const noteEl = document.getElementById('heNote');
    habit.note = noteEl ? noteEl.value.trim() : '';

    habit.enabled = document.getElementById('heEnabledToggle').classList.contains('on');

    // Interval reminder
    const irToggle = document.getElementById('heIntervalToggle');
    if (irToggle) {
      const irOn = irToggle.classList.contains('on');
      if (irOn) {
        const irIntervalVal = parseInt(document.getElementById('irInterval').value) || 45;
        const irStartVal = document.getElementById('irStart').value || '09:00';
        const irEndVal = document.getElementById('irEnd').value || '18:00';
        const irDaysEls = document.querySelectorAll('[data-irday].active');
        const irDaysArr = [];
        irDaysEls.forEach(function(el) { irDaysArr.push(parseInt(el.dataset.irday)); });
        habit.intervalReminder = {
          interval: irIntervalVal,
          unit: 'minute',
          enabled: true,
          startTime: irStartVal,
          endTime: irEndVal,
          days: irDaysArr.length ? irDaysArr : [0,1,2,3,4,5,6]
        };
      } else {
        if (habit.intervalReminder) habit.intervalReminder.enabled = false;
      }
    }

    // Save to localStorage
    App.Core.Storage.saveConfig();
    App.UI.Panels.closeAllPanels();
    App.UI.Render.renderManage();
    App.UI.Render.renderCheckin();
  }

  function deleteHabitConfirm(habitId) {
    if (!confirm('确定要删除这个习惯吗？此操作不可撤销。')) return;
    const idx = habitsConfig.findIndex(h => h.id === habitId);
    if (idx >= 0) {
      habitsConfig.splice(idx, 1);
      App.Core.Storage.saveConfig();
      App.UI.Panels.closeAllPanels();
      App.UI.Render.renderManage();
      App.UI.Render.renderCheckin();
    }
  }

  function renderLevelCard() {
    const lv = getCurrentLevel();
    const streak = getCurrentStreak();
    const progress = getLevelProgress();
    const next = getNextLevel();

    const avatarEl = document.getElementById('profileAvatar');
    const nameEl = document.getElementById('levelName');
    const textEl = document.getElementById('levelProgressText');
    const barEl = document.getElementById('levelProgressBar');
    const pctEl = document.getElementById('levelProgressPct');
    const nextEl = document.getElementById('levelNext');

    if (avatarEl) avatarEl.textContent = lv.icon;
    if (nameEl) nameEl.textContent = lv.name;
    if (textEl) {
      const points = getUserPoints();
      textEl.textContent = `连续打卡 ${streak} 天 · ⭐ ${points} 积分`;
    }
    if (barEl) barEl.style.width = progress + '%';
    if (pctEl) pctEl.textContent = progress + '%';

    if (nextEl) {
      if (next) {
        const need = next.minDays - streak;
        nextEl.textContent = `再打卡 ${need} 天升级为「${next.name}」`;
      } else {
        nextEl.textContent = '已达最高等级，继续保持！';
      }
    }
  }

  function renderProfileStats() {
    const streak = getCurrentStreak();
    const total = getTotalCheckins();
    const rate = habitsConfig.length ? Math.round(getTodayCompletionRate()) : 0;
    const count = habitsConfig.length;

    const streakEl = document.getElementById('psStreak');
    const totalEl = document.getElementById('psTotal');
    const rateEl = document.getElementById('psRate');
    const habitsEl = document.getElementById('psHabits');

    if (streakEl) streakEl.textContent = streak;
    if (totalEl) totalEl.textContent = total;
    if (rateEl) rateEl.textContent = rate + '%';
    if (habitsEl) habitsEl.textContent = count;
  }

  /* ========== Profile Grid (图标宫格) ========== */
  function renderProfileGrid() {
    const grid = document.getElementById('profileGrid');
    if (!grid) return;

    const items = [
      { icon:'📊', label:'统计', action:'stats' },
      { icon:'🥗', label:'饮食建议', action:'diet' },
      { icon:'🏃', label:'运动养生', action:'sports' },
      { icon:'⏳', label:'子午流注', action:'clock' },
      { icon:'🛡️', label:'五劳防护', action:'wulao' },
      { icon:'🩺', label:'体质测试', action:'constitution' },
      { icon:'🎨', label:'皮肤', action:'skin' },
      { icon:'📈', label:'健康报告', action:'healthReport' },
      { icon:'📋', label:'养生总结', action:'healthSummary' },
      { icon:'💾', label:'数据管理', action:'data' },
      { icon:'📚', label:'参考文献', action:'ref' },
      { icon:'📖', label:'使用教程', action:'guide' },
    ];

    grid.innerHTML = items.map((item, i) => `
      <button class="profile-grid-item pg-i-${i}" onclick="handleProfileGridClick('${item.action}')">
        <div class="pg-icon">${item.icon}</div>
        <span class="pg-label">${item.label}</span>
      </button>
    `).join('');
  }

  window.handleProfileGridClick = function(action) {
    switch(action) {
      case 'stats': openStatsDetailPanel(); break;
      case 'diet': App.UI.Panels.openDietPanel(); break;
      case 'sports': App.UI.Panels.openSportsPanel(); break;
      case 'clock': App.UI.Panels.openClockPanel(); break;
      case 'wulao': App.UI.Panels.openWulaoPanel(); break;
      case 'constitution': 
      if (App.Modules && App.Modules.Constitution) {
        App.Modules.Constitution.openConstitutionPanel();
      } else {
        LazyLoad('js/modules/constitution.js', function() {
          if (App.Modules && App.Modules.Constitution) App.Modules.Constitution.openConstitutionPanel();
        });
      }
      break;
      case 'skin': App.UI.Panels.openSkinPanel(); break;
      case 'healthReport': App.UI.Panels.openHealthReportPanel(); break;
      case 'healthSummary': location.href = 'references/养生总结/养生总结.html'; break;
      case 'data': App.UI.Panels.openDataPanel(); break;
      case 'ref': openRefPanel(); break;
      case 'guide': App.Modules.Guide.replayGuide(); break;
    }
  };

  /* ========== Stats Detail Panel ========== */
  let sdHeatmapDate = new Date();

  function openStatsDetailPanel() {
    App.UI.Panels.openPanel('statsDetailPanel');
    renderStatsDetail();
  }

  function switchStatsPeriod(period, btnEl) {
    // 更新标签样式
    document.querySelectorAll('.sd-tab').forEach(tab => tab.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    
    // 切换内容显示
    document.getElementById('sdWeekContent').style.display = period === 'week' ? 'block' : 'none';
    document.getElementById('sdMonthContent').style.display = period === 'month' ? 'block' : 'none';
    document.getElementById('sdYearContent').style.display = period === 'year' ? 'block' : 'none';
    
    // 根据选中时段渲染对应内容
    if (period === 'week') {
      renderSdWeekContent();
    } else if (period === 'month') {
      renderSdHeatmap();
      renderSdMonthReview();
    } else if (period === 'year') {
      renderYearHeatmap();
      renderSdYearReview();
    }
  }

  function renderStatsDetail() {
    // 默认显示周统计
    const weekTab = document.querySelector('.sd-tab[data-period="week"]');
    if (weekTab) {
      switchStatsPeriod('week', weekTab);
    }
  }

  function renderSdWeekContent() {
    renderSdWeekBarChart();
    renderSdWaterWeekChart();
    renderSdRankingList();
  }

  // ===== 共享周柱状图数据获取（DRY掉两处数据收集重复） =====
  function _countDayDone(rec) {
    var done = 0;
    habitsConfig.forEach(function(h) {
      if (h.enabled === false) return;
      if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec)) done++;
    });
    return done;
  }

  function renderSdWeekBarChart() {
    var container = document.getElementById('sdWeekBarChart');
    if (!container) return;

    var weekDays = ['日','一','二','三','四','五','六'];
    var today = new Date();
    var todayStr = formatDate(today);
    var totalHabits = habitsConfig.filter(function(h) { return h.enabled !== false; }).length;
    var maxVal = 1;

    // 第一遍：找最大值
    for (var i = 0; i < 7; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() - today.getDay() + i);
      var key = formatDate(d);
      var rec = checkinRecords[key] || {};
      var done = _countDayDone(rec);
      if (done > maxVal) maxVal = done;
    }

    // 第二遍：渲染
    var html = '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:8px 0">';
    for (var i = 0; i < 7; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() - today.getDay() + i);
      var key = formatDate(d);
      var rec = checkinRecords[key] || {};
      var done = _countDayDone(rec);
      var pct = totalHabits > 0 ? (done / totalHabits) : 0;
      var h = Math.max(4, Math.round(pct * 100));
      var isToday = key === todayStr;
      html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">\
        <span style="font-size:10px;color:var(--muted);font-weight:700">' + done + '</span>\
        <div style="width:100%;max-width:32px;height:' + h + 'px;background:' + (isToday ? 'linear-gradient(180deg,var(--accent),var(--accent2))' : 'var(--accent-light)') + ';border-radius:6px 6px 4px 4px;transition:height .5s ease"></div>\
        <span style="font-size:10px;color:' + (isToday ? 'var(--accent)' : 'var(--muted)') + ';font-weight:' + (isToday ? 700 : 400) + '">' + weekDays[i] + '</span>\
      </div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function renderSdWaterWeekChart() {
    const container = document.getElementById('sdWaterWeekChart');
    const section = document.getElementById('sdWaterWeekSection');
    if (!container || !section) return;

    const waterHabit = habitsConfig.find(h => h.type === 'water' && h.enabled !== false);
    if (!waterHabit) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';

    const wc = waterHabit.waterConfig || {dailyGoal:2000};
    const goal = wc.dailyGoal || 2000;
    const dayNames = ['日','一','二','三','四','五','六'];
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    let html = `<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:12px">目标：${goal}ml/天</div>`;
    html += '<div style="display:flex;align-items:flex-end;gap:6px;height:130px;padding:8px 0">';

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      const waterRec = rec[waterHabit.id] || {};
      const value = waterRec.value || 0;
      const pct = Math.min(100, Math.round((value / goal) * 100));
      const h = Math.max(4, Math.round((value / goal) * 120));
      const isToday = key === formatDate(today);
      const isFuture = d > today;

      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:10px;color:${pct >= 100 ? 'var(--accent)' : 'var(--muted)'};font-weight:700">${value > 0 ? value + 'ml' : '--'}</span>
        <div style="width:100%;max-width:32px;height:${h}px;background:${isFuture ? 'var(--bg2)' : pct >= 100 ? 'linear-gradient(180deg,var(--accent),var(--accent2))' : pct >= 50 ? 'var(--accent-light)' : 'var(--bg2)'};border-radius:6px 6px 4px 4px;transition:height .5s ease;position:relative">
          ${pct >= 100 ? '<span style="position:absolute;top:4px;left:0;right:0;text-align:center;font-size:10px">✓</span>' : ''}
        </div>
        <span style="font-size:10px;color:${isToday ? 'var(--accent)' : 'var(--muted)'};font-weight:${isToday ? 700 : 400}">${dayNames[i]}</span>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function renderSdRankingList() {
    const container = document.getElementById('sdRankingList');
    if (!container) return;

    const rankHtml = habitsConfig.map((h, i) => {
      const rate = getCompletionRate(h.id, 30);
      const cls = rate >= 70 ? 'high' : rate >= 40 ? 'mid' : 'low';
      let rankClass = 'normal';
      if (i === 0) rankClass = 'gold';
      else if (i === 1) rankClass = 'silver';
      else if (i === 2) rankClass = 'bronze';
      return `<div class="ranking-item">
        <div class="ranking-rank ${rankClass}">${i < 3 ? ['🥇','🥈','🥉'][i] : i+1}</div>
        <div class="ranking-header"><span class="ranking-name">${h.icon} ${h.name}</span><span class="ranking-pct">${rate}%</span></div>
        <div class="ranking-bar"><div class="ranking-fill ${cls}" style="width:${rate}%"></div></div>
      </div>`;
    }).join('');
    container.innerHTML = rankHtml || '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">暂无数据</div>';
  }

  function renderSdHeatmap() {
    _renderMonthlyHeatmap(
      document.getElementById('sdHeatmapGrid'),
      document.getElementById('sdHeatmapMonth'),
      sdHeatmapDate,
      formatDate(new Date())
    );
  }

  function sdChangeMonth(delta) {
    sdHeatmapDate.setMonth(sdHeatmapDate.getMonth() + delta);
    renderSdHeatmap();
  }

  /* ========== 年度热力图 ========== */
  function renderYearHeatmap() {
    const grid = document.getElementById('yearHeatmapGrid');
    const monthsEl = document.getElementById('yearHeatmapMonths');
    if (!grid) return;

    const fmt = formatDate;
    const today = new Date();
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364); // 过去约52周

    // 调整到最近的周一
    const dayOfWeek = startDate.getDay();
    const off = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + off);

    // 收集所有日期数据
    const weeks = [];
    const current = new Date(startDate);
    let currentMonth = -1;
    let monthLabels = [];

    while (current <= endDate) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = fmt(current);
        const month = current.getMonth();
        const year = current.getFullYear();
        const dayOfMonth = current.getDate();

        // 记录月份标签（每周的第一天如果是月初或新月份）
        if (d === 0 && (month !== currentMonth || dayOfMonth <= 7)) {
          const weekIndex = weeks.length;
          const monthName = `${month + 1}月`;
          if (!monthLabels.find(m => m.month === month && m.year === year)) {
            monthLabels.push({ month, year, weekIndex, name: monthName });
          }
          currentMonth = month;
        }

        const rec = checkinRecords[dateStr] || {};
        var doneCount = 0, total = 0;
        habitsConfig.forEach(function(h) {
          if (h.enabled === false) return;
          total++;
          if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec)) doneCount++;
        });

        const ratio = total > 0 ? doneCount / total : -1;
        const level = App.Core.Utils.getHeatmapLevel(ratio);

        week.push({
          dateStr,
          level,
          doneCount,
          total,
          isToday: dateStr === fmt(today)
        });

        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    // 渲染月份标签
    if (monthsEl) {
      const cellW = 16; // 13px cell + 3px gap
      let mHtml = '<div style="position:relative;height:16px;padding-left:32px;margin-bottom:4px">';
      monthLabels.forEach(m => {
        mHtml += `<span style="position:absolute;left:${32 + m.weekIndex * cellW}px;font-size:10px;color:var(--muted)">${m.name}</span>`;
      });
      mHtml += '</div>';
      monthsEl.innerHTML = mHtml;
    }

    // 渲染热力图网格
    const dayLabels = ['一', '', '三', '', '五', '', ''];
    let html = '<div style="display:flex;gap:3px">';

    // 星期标签列
    html += '<div style="display:flex;flex-direction:column;gap:3px;padding-right:4px;font-size:9px;color:var(--muted);width:28px;flex-shrink:0">';
    for (let d = 0; d < 7; d++) {
      html += `<div style="height:13px;display:flex;align-items:center;line-height:13px">${dayLabels[d]}</div>`;
    }
    html += '</div>';

    // 热力图格子
    html += '<div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:4px">';
    weeks.forEach(week => {
      html += '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">';
      week.forEach(cell => {
        const title = `${cell.dateStr}: ${cell.doneCount}/${cell.total}`;
        const extra = cell.isToday ? ' style="outline:2px solid var(--accent);border-radius:2px"' : '';
        html += `<div class="yh-cell yh-l${cell.level}" title="${title}"${extra}></div>`;
      });
      html += '</div>';
    });
    html += '</div></div>';

    grid.innerHTML = html;
  }

  /* ========== 统计 Panel 中的月度/年度回顾 ========== */
  function renderReviewSummary(mode) {
    const isMonthly = mode === 'monthly';
    const containerId = isMonthly ? 'sdMonthReview' : 'sdYearReview';
    const container = document.getElementById(containerId);
    if (!container) return;

    const today = new Date();
    const startDate = new Date(today);
    if (isMonthly) {
      startDate.setDate(1);
    } else {
      startDate.setMonth(0, 1);
    }
    startDate.setHours(0,0,0,0);

    let totalDays = 0, activeDays = 0;
    let totalCheckins = 0, totalPossible = 0;
    const habitStats = {};
    let bestHabit = null, bestCount = 0;
    let maxStreak = 0, currentStreak = 0;

    const d = new Date(startDate);
    while (d <= today) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      totalDays++;
      let dayHasAny = false;

      habitsConfig.forEach(function(h) {
        totalPossible++;
        habitStats[h.id] = habitStats[h.id] || {name:h.name, icon:h.icon, done:0, total:0};
        habitStats[h.id].total++;

        if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec || {})) {
          totalCheckins++;
          habitStats[h.id].done++;
          dayHasAny = true;
        }
      });

      if (dayHasAny) {
        activeDays++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
      d.setDate(d.getDate() + 1);
    }

    const completionRate = totalPossible > 0 ? Math.round((totalCheckins / totalPossible) * 100) : 0;

    Object.values(habitStats).forEach(s => {
      if (s.done > bestCount) { bestCount = s.done; bestHabit = s; }
    });

    const totalPomo = App.UI.Panels.getPomoTotalStats(startDate);

    let html = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:28px;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${completionRate}%</div>
        <div style="font-size:12px;color:var(--muted)">总完成率</div>
      </div>
      <div class="report-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="report-card"><div class="rc-num">${activeDays}/${totalDays}</div><div class="rc-label">活跃天</div></div>
        <div class="report-card"><div class="rc-num">${maxStreak}</div><div class="rc-label">最长连续</div></div>
        <div class="report-card"><div class="rc-num">${totalPomo.count}</div><div class="rc-label">番茄数</div></div>
      </div>`;

    if (bestHabit) {
      html += `
        <div style="margin-top:14px;font-size:13px;font-weight:700;margin-bottom:8px">🏆 最常完成的习惯</div>
        <div style="background:var(--bg2);border-radius:12px;padding:12px;text-align:center;margin-bottom:14px">
          <span style="font-size:22px">${bestHabit.icon}</span>
          <div style="font-size:14px;font-weight:700;margin:4px 0">${bestHabit.name}</div>
          <div style="font-size:12px;color:var(--muted)">${bestHabit.done}/${bestHabit.total} 天</div>
        </div>`;
    }

    html += `<div style="font-size:13px;font-weight:700;margin-bottom:8px">📊 习惯排行</div>`;

    Object.values(habitStats).sort((a,b) => (b.done/b.total) - (a.done/a.total)).slice(0, 5).forEach(s => {
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      html += `<div class="report-habit-row">
        <span class="report-habit-name">${s.icon} ${s.name}</span>
        <div class="report-habit-bar"><div class="report-habit-fill" style="width:${pct}%;background:var(--accent)"></div></div>
        <span class="report-habit-pct">${pct}%</span>
      </div>`;
    });

    container.innerHTML = html;
  }

  function renderSdMonthReview() {
    renderReviewSummary('monthly');
  }

  function renderSdYearReview() {
    renderReviewSummary('yearly');
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  // ===== 全屏庆祝动画（薄荷健康风格） =====
  function showCelebration() {
    // 移除已有覆盖层
    var existing = document.querySelector('.celebration-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'celebration-overlay';
    overlay.onclick = function() { dismissCelebration(overlay); };

    var points = (App.Core.Utils && App.Core.Utils.getUserPoints) ? App.Core.Utils.getUserPoints() : 0;

    overlay.innerHTML = '<div style="font-size:64px;animation:mhBounceIn .4s cubic-bezier(.18,.89,.32,1.28)">🎉</div>\
      <div class="ce-text">太棒了！</div>\
      <div class="ce-sub">今日所有习惯全部完成</div>\
      <div class="ce-badge">⭐ +5 积分 · 当前 ' + points + ' 积分</div>\
      <button class="ce-close" onclick="event.stopPropagation();dismissCelebration(this.parentElement)">点击任意处关闭</button>';

    document.body.appendChild(overlay);

    // 烟花粒子
    var fwColors = ['var(--fw-1)','var(--fw-2)','var(--fw-3)','var(--fw-4)','var(--fw-5)','var(--fw-6)','var(--fw-7)','var(--fw-8)'];
    var rect = overlay.getBoundingClientRect();
    for (var i = 0; i < 40; i++) {
      setTimeout(function() {
        var p = document.createElement('div');
        p.className = 'mh-firework';
        p.style.background = fwColors[Math.floor(Math.random() * fwColors.length)];
        p.style.left = (rect.width / 2 + (Math.random() - 0.5) * 200) + 'px';
        p.style.top = (rect.height / 2 - 50) + 'px';
        p.style.setProperty('--tx', ((Math.random() - 0.5) * 300) + 'px');
        p.style.setProperty('--ty', ((Math.random() - 0.5) * 300 - 100) + 'px');
        p.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
        overlay.appendChild(p);
        setTimeout(function() { if (p.parentElement) p.remove(); }, 1500);
      }, i * 20);
    }

    // 3秒后自动消失
    setTimeout(function() { dismissCelebration(overlay); }, 3500);
  }

  function dismissCelebration(overlay) {
    if (!overlay || overlay.classList.contains('fading')) return;
    overlay.classList.add('fading');
    setTimeout(function() { if (overlay.parentElement) overlay.remove(); }, 500);
  }

  // ===== 一键全部完成（参考薄荷健康快捷操作理念） =====
  function batchCompleteAll() {
    var buildRecord = App.Modules.Checkin && App.Modules.Checkin.buildBatchCompleteRecord;
    if (!buildRecord) return;

    var dateKey = today();
    var rec = checkinRecords[dateKey] || {};
    var viewDow = new Date().getDay();
    var reward = App.Core.Utils.checkinReward || { perHabit: 1, allDoneBonus: 5 };
    var completed = 0;
    var skipped = 0;

    habitsConfig.forEach(function(h) {
      if (h.enabled === false) return;
      var repeat = h.repeat || [0, 1, 2, 3, 4, 5, 6];
      if (!repeat.includes(viewDow)) return;
      if (App.Core.Storage.isHabitChecked(h, rec)) return;

      var entry = buildRecord(h);
      if (!entry) { skipped++; return; }

      rec[h.id] = entry;
      App.Core.Utils.addPoints(reward.perHabit, h.name + ' 打卡');
      completed++;
    });

    if (completed === 0) {
      if (skipped > 0) showToast('剩余 ' + skipped + ' 项需手动完成（如情绪记录）');
      return;
    }

    checkinRecords[dateKey] = rec;
    saveRecords();
    playSound('checkin');
    showToast('已完成 ' + completed + ' 项习惯' + (skipped ? '，' + skipped + ' 项需手动完成' : '') + '！');
    if (typeof checkLevelUp === 'function') checkLevelUp();
    render(['today', 'checkin']);
  }

  // ===== 体质测试入口卡片（未测过时显示） =====
  function renderConstitutionEntry() {
    var result = null;
    try { result = JSON.parse(localStorage.getItem('constitution_result') || 'null'); } catch(e) {}
    if (result && result.typeId) return ''; // 已测过不显示

    return '<div class="constitution-entry-card" onclick="App.Modules.Constitution.openConstitutionPanel()">' +
      '<div class="ce-left">' +
        '<div class="ce-emoji">🩺</div>' +
        '<div class="ce-text">' +
          '<div class="ce-title">还没测过体质？</div>' +
          '<div class="ce-sub">10秒测出你的体质，获取专属养生方案 →</div>' +
        '</div>' +
      '</div>' +
      '<div class="ce-arrow">›</div>' +
    '</div>';
  }

  // ===== 体质测试结果联动每日推荐（参考薄荷健康个性化方案） =====
  function renderConstitutionTips() {
    var result = null;
    try { result = JSON.parse(localStorage.getItem('constitution_result') || 'null'); } catch(e) {}
    if (!result || !result.typeId) return '';

    // 从 CONSTITUTION_TYPES 获取体质数据
    var ct = null;
    if (typeof CONSTITUTION_TYPES !== 'undefined' && Array.isArray(CONSTITUTION_TYPES)) {
      ct = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    }
    if (!ct) return '';

    // 查找推荐的关联习惯（在现有习惯中高亮）
    var recommendedHabitIds = ct.habits || [];
    var matchedHabits = [];
    if (habitsConfig && recommendedHabitIds.length > 0) {
      habitsConfig.forEach(function(h) {
        if (h.enabled === false) return;
        // 通过名称模糊匹配或ID精确匹配
        if (recommendedHabitIds.indexOf(h.id) >= 0) {
          matchedHabits.push({ name: h.name, icon: h.icon, id: h.id, direct: true });
        }
      });
    }

    // 如果体质有通用推荐习惯标签也可以展示
    var tags = [];
    if (matchedHabits.length > 0) {
      tags = matchedHabits.map(function(h) {
        return '<span class="ct-habit-tag recommended" title="体质推荐习惯">' + h.icon + ' ' + h.name + '</span>';
      });
    }

    // 体质建议作为额外标签
    if (ct.advice) {
      var adviceWords = ct.advice.replace(/[，、。；]/g, '|').split('|').filter(function(w) { return w.length > 2 && w.length < 12; });
      adviceWords.slice(0, 3).forEach(function(w) {
        tags.push('<span class="ct-habit-tag">' + w + '</span>');
      });
    }

    return '<div class="constitution-tips">\
      <div class="ct-card" style="border-left-color:' + (ct.color || 'var(--accent)') + ';background:rgba(' + (ct.color ? _hexToRgb(ct.color) + ',0.05' : '91,185,138,0.05') + ')">\
        <div class="ct-header">\
          <span class="ct-emoji">' + ct.emoji + '</span>\
          <span class="ct-name" style="color:' + (ct.color || 'var(--accent)') + '">' + ct.name + '</span>\
        </div>\
        <div class="ct-desc">' + ct.desc + '</div>\
        ' + (tags.length > 0 ? '<div class="ct-habits">' + tags.join('') + '</div>' : '') + '\
      </div>\
    </div>';
  }

  // 辅助：hex颜色转rgb
  function _hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? parseInt(result[1], 16) + ',' + parseInt(result[2], 16) + ',' + parseInt(result[3], 16) : '91,185,138';
  }

  // 防抖渲染管理（搜索输入用）
  var _manageRenderTimer = null;
  function debouncedRenderManage() {
    if (_manageRenderTimer) clearTimeout(_manageRenderTimer);
    _manageRenderTimer = setTimeout(function() { renderManage(); }, 200);
  }

  App.UI.Render = {
    render,
    renderAmbientBg,
    swipeDate,
    renderTodayCard,
    refreshQuote,
    toggleQuoteExpand,
    renderReminderBanner,
    renderCheckin,
    renderProfile,
    renderProfileGrid,
    renderStats,
    renderHeatmap,
    changeMonth,
    renderAchievements,
    renderManage,
    renderManageStats,
    renderManageGroups,
    toggleMgGroup,
    renderLevelCard,
    renderDailyCardCollection,
    renderDailyCardPreview,
    openDailyCardCollection,
    openHabitEditPanel,
    renderHabitEditPanel,
    selectEditIcon,
    onEditTypeChange,
    toggleEditRepeatDay,
    saveHabitEdit,
    deleteHabitConfirm,
    openStatsDetailPanel,
    renderStatsDetail,
    switchStatsPeriod,
    renderSdWeekBarChart,
    renderSdWaterWeekChart,
    renderSdRankingList,
    renderSdHeatmap,
    sdChangeMonth,
    renderYearHeatmap,
    renderSdMonthReview,
    renderSdYearReview,
    debouncedRenderManage,
    showCelebration,
    dismissCelebration,
    renderConstitutionTips,
    batchCompleteAll
  };

  if (App.registerModule) {
    App.registerModule('ui.render', 'ui', null);
  }
})();




