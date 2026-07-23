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

  // 打卡页面视图：habits | diet
  let checkinCurrentView = 'habits';
  Object.defineProperty(window, 'checkinCurrentView', {
    get: () => checkinCurrentView,
    set: (val) => { checkinCurrentView = val; },
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

    // 农历 + 节气 + 养生提示
    let dateExtras = `${lunar.monthStr}月${lunar.dayStr}`;
    if (solarTerm) {
      dateExtras += ` · ${solarTerm.emoji} ${esc(solarTerm.name)}`;
      if (solarTerm.tip) {
        dateExtras += ` · ${esc(solarTerm.tip)}`;
      }
    } else if (pack.tip) {
      dateExtras += ` · ${esc(pack.tip)}`;
    }
    const lunarEl = document.getElementById('todayLunar');
    if (lunarEl) lunarEl.textContent = dateExtras;

    // 积分徽章
    const badgesEl = document.getElementById('todayBadges');
    if (badgesEl) {
      const points = getUserPoints();
      badgesEl.innerHTML = `<span class="mini-points-badge" title="累计积分">⭐ ${points} 积分</span>`;
    }

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
    const quoteSourceEl = document.getElementById('quoteSourceText');
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
    if (h.reminder && h.reminder.enabled && h.reminder.time) {
      const [rh, rm] = h.reminder.time.split(':').map(Number);
      return rh * 60 + rm;
    }
    // 间隔提醒：按下次提醒时间计算
    if (h.intervalReminder && h.intervalReminder.enabled) {
      const ir = h.intervalReminder;
      const last = (rec[h.id] && rec[h.id].lastInterval) || (rec[h.id] && rec[h.id].timestamp) || 0;
      const intervalMs = ir.interval * 60000;
      let next = last + intervalMs;
      const nowMs = Date.now();
      // 如果下次时间已过，按当前时间推算下一个
      if (next < nowMs) {
        const elapsed = nowMs - last;
        const count = Math.ceil(elapsed / intervalMs);
        next = last + count * intervalMs;
      }
      const nextDate = new Date(next);
      const nextMinutes = nextDate.getHours() * 60 + nextDate.getMinutes();
      return nextMinutes;
    }
    const tp = h.timePeriod || 'daytime';
    const defaults = {morning:420, forenoon:570, afternoon:780, evening:1110, daytime:720};
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
      if (!isViewToday && !checked) return;
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

  function _renderEncourageRing(doneCount, total) {
    const pct = Math.round((doneCount / total) * 100);
    const r = 52, c = 2 * Math.PI * r, offset = c - (pct / 100) * c;
    return `<div style="text-align:center;padding:16px 16px 6px">
      <svg width="120" height="120" style="display:block;margin:0 auto">
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--rule)" stroke-width="8"/>
        <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--accent)" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 60 60)" style="transition:stroke-dashoffset .6s ease"/>
        <text x="60" y="55" text-anchor="middle" font-size="28" font-weight="800" fill="var(--accent)">${pct}%</text>
        <text x="60" y="72" text-anchor="middle" font-size="11" fill="var(--muted)">${doneCount}/${total}</text>
      </svg>
    </div>`;
  }

  function _renderHabitCardRow(h, checked, overdue, soon, rec, nextTime, isViewToday) {
    const collapsedClass = checked ? 'collapsed' : '';
    const doneCardClass = checked ? 'done-card' : '';
    const ribbonCls = checked ? 'done' : overdue ? 'overdue' : 'pending';
    // 时间段 class 映射（用于现代简约主题渐变边框）
    const periodMap = { morning:'morning', forenoon:'morning', afternoon:'afternoon', evening:'evening', night:'night' };
    const periodClass = h.timePeriod && periodMap[h.timePeriod] ? periodMap[h.timePeriod] + '-period' : '';

    // 查找习惯描述（从 HABIT_LIBRARY）
    var libTip = '';
    if (typeof HABIT_LIBRARY !== 'undefined' && Array.isArray(HABIT_LIBRARY)) {
      var found = HABIT_LIBRARY.find(function(lib) { return lib.id === h.id; });
      if (found && found.tip) libTip = found.tip;
    }

    // 下次提醒时间
    let nextTimeStr = '';
    if (typeof nextTime === 'number') {
      const nh = Math.floor(nextTime / 60);
      const nm = nextTime % 60;
      nextTimeStr = (nh < 10 ? '0' : '') + nh + ':' + (nm < 10 ? '0' : '') + nm;
    }

    if (h.type === 'water') {
      return renderWaterTracker(h, rec, isViewToday).replace('class="water-tracker"', `class="water-tracker ${collapsedClass} ${periodClass}"`);
    }

    if (h.type === 'select') {
      const selected = rec[h.id] ? rec[h.id].value : '';
      const tipStr2 = h.tip || '';
      const timeHint = overdue ? '<span class="habit-time-hint overdue">已过期</span>' : soon ? '<span class="habit-time-hint soon">即将</span>' : '';
      const emotionPeriod = h.timePeriod && periodMap[h.timePeriod] ? periodMap[h.timePeriod] + '-period' : '';
      const emotionBtnHtml = isViewToday ? `<button class="checkin-btn ${selected ? 'done' : 'pending'}">${selected ? '✓' : '记录'}</button>` : '';

      let emotionHistoryDetail = '';
      if (!isViewToday && selected && rec[h.id] && rec[h.id].ts) {
        const dt = new Date(rec[h.id].ts);
        const hour = dt.getHours().toString().padStart(2, '0');
        const minute = dt.getMinutes().toString().padStart(2, '0');
        emotionHistoryDetail = `<div class="history-detail"><span class="history-checkin-time">🕐 ${hour}:${minute}</span></div>`;
      }

      return `<div class="habit-card ${collapsedClass} ${emotionPeriod}" id="card-${h.id}" onclick="${isViewToday ? 'openEmotionPanel()' : ''}">
        <span class="status-ribbon ${ribbonCls}"></span>
        <span class="icon">${esc(h.icon)}</span>
        <div class="info">
          <div class="name">${esc(h.name)}${selected ? '：' + selected : ''}</div>
          <div class="meta"><span style="color:var(--accent)">下次提醒 ${nextTimeStr || '点击记录今日情绪'}</span>${timeHint}</div>
          ${tipStr2 ? `<div style="font-size:11px;color:var(--accent);margin-top:3px;line-height:1.4">💡 ${tipStr2}</div>` : ''}
          ${emotionHistoryDetail}
        </div>
        ${emotionBtnHtml}
      </div>`;
    }

    // 通用类型：boolean / count / timer
    const streak = getStreak(h.id);
    const valueStr = checked ? (h.type === 'boolean' ? '' : ` ${rec[h.id].value}${esc(h.unit)}`) : '';
    const failed = h.negative && rec[h.id] && rec[h.id].failed;
    const isNegative = h.negative;
    const negClass = isNegative ? ' negative' : '';
    const timeHint = overdue ? '<span class="habit-time-hint overdue">已过期</span>' : soon ? '<span class="habit-time-hint soon">即将</span>' : '';
    const btnClass = failed ? 'failed' : checked ? 'done' : 'pending';
    const btnText = failed ? '✗ 犯了' : checked ? '✓' : (isNegative ? '没犯' : '打卡');

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

    let historyDetailHtml = '';
    if (!isViewToday && checked && rec[h.id]) {
      const record = rec[h.id];
      let checkinTimeStr = '';
      if (record.ts) {
        const dt = new Date(record.ts);
        const hour = dt.getHours().toString().padStart(2, '0');
        const minute = dt.getMinutes().toString().padStart(2, '0');
        checkinTimeStr = `<span class="history-checkin-time">🕐 ${hour}:${minute}</span>`;
      }
      let checkinValueStr = '';
      if (h.type !== 'boolean' && record.value) {
        checkinValueStr = `<span class="history-checkin-value">${record.value}${esc(h.unit)}</span>`;
      }
      if (checkinTimeStr || checkinValueStr) {
        historyDetailHtml = `<div class="history-detail">${checkinTimeStr}${checkinValueStr ? ' · ' + checkinValueStr : ''}</div>`;
      }
    }

    const btnHtml = isViewToday ? `<button class="checkin-btn ${btnClass}" onclick="handleCheckin('${h.id}')">${btnText}</button>` : '';
    return `<div class="habit-card ${collapsedClass} ${negClass} ${doneCardClass} ${periodClass}" id="card-${h.id}" style="position:relative">
      <span class="status-ribbon ${ribbonCls}"></span>
      <span class="icon">${isNegative ? '❌' : h.icon}</span>
      <div class="info">
        <div class="name">${isNegative ? '不' + h.name : h.name}${valueStr}</div>
        <div class="meta">
          <span>⏰ ${nextTimeStr || '--:--'}</span>
          ${intervalHtml}
          ${streak > 0 ? '<span class="streak">🔥' + streak + '天</span>' : ''}
          ${timeHint}
        </div>
        ${libTip ? '<div class="habit-desc">' + libTip + '</div>' : ''}
        ${historyDetailHtml}
      </div>
      ${btnHtml}
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

    const viewDate = new Date();
    viewDate.setDate(viewDate.getDate() + viewDateOffset);
    const viewDateStr = formatDate(viewDate);
    const isViewToday = viewDateOffset === 0;

    let html = '';

    // 分段切换器（习惯打卡 / 饮食记录）
    html += _renderCheckinSegmented();

    // 饮食记录视图
    if (checkinCurrentView === 'diet') {
      html += _renderCheckinDietContent(viewDateStr);
      container.innerHTML = html;
      return;
    }

    const items = _buildCheckinItems(rec, nowMinutes, viewDateOffset);
    const total = items.length;
    const doneCount = items.filter(x => x.checked).length;
    const buildRecord = App.Modules.Checkin && App.Modules.Checkin.buildBatchCompleteRecord;
    const batchPending = buildRecord
      ? items.filter(function(x) { return !x.checked && buildRecord(x.h); }).length
      : 0;

    if (isViewToday && total > 0) {
      html += _renderEncourageRing(doneCount, total);
    }

    // 所有习惯平铺显示，按 nextTime 排序（已排序）
    html += `<div class="time-group">`;
    items.forEach(({h, checked, overdue, soon, nextTime}) => {
      html += _renderHabitCardRow(h, checked, overdue, soon, rec, nextTime, isViewToday);
    });
    html += `</div>`;

    if (items.length === 0) {
      if (isViewToday) {
        html = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:14px;">还没有添加习惯<br><br>请先到 <strong style="color:var(--accent);cursor:pointer;" onclick="switchTab(\'manage\')">【管理】</strong> 界面添加习惯</div>';
      } else {
        html = '<div style="text-align:center;padding:60px 20px;color:var(--muted);font-size:14px;">📅 当天无打卡记录</div>';
      }
    }

    container.innerHTML = html;
  }

  /* ========== 打卡页面分段切换器 ========== */
  function _renderCheckinSegmented() {
    return `
      <div class="checkin-segmented">
        <div class="checkin-segment ${checkinCurrentView === 'habits' ? 'active' : ''}" onclick="switchCheckinView('habits')">
          打卡
        </div>
        <div class="checkin-segment ${checkinCurrentView === 'diet' ? 'active' : ''}" onclick="switchCheckinView('diet')">
          记录
        </div>
      </div>
    `;
  }

  function _renderCheckinDietContent(viewDateStr) {
    if (App.Modules && App.Modules.Diet && App.Modules.Diet.renderRecordView) {
      return App.Modules.Diet.renderRecordView(viewDateStr);
    }
    // 懒加载 diet.js
    LazyLoad('js/modules/diet.js', function() {
      if (App.Modules && App.Modules.Diet && App.Modules.Diet.renderRecordView) {
        const container = document.getElementById('checkinContent');
        if (container) {
          const html = _renderCheckinSegmented() + App.Modules.Diet.renderRecordView(viewDateStr);
          container.innerHTML = html;
        }
      }
    });
    return '<div style="text-align:center;padding:40px;color:var(--muted)">⏳ 加载饮食模块...</div>';
  }

  window.switchCheckinView = function(view) {
    checkinCurrentView = view;
    renderCheckin();
  };

  function renderStats() {
    const done = getTodayDone();
    const total = getTodayTotal();
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    let maxStreakAll = 0;
    habitsConfig.forEach(h => {
      maxStreakAll = Math.max(maxStreakAll, getMaxStreak(h.id));
    });
    renderWeekBarChart();
    renderHeatmap();
    renderAchievements();
  }

  

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
      var futureCls = new Date(year, month, d) > new Date() ? ' future' : '';
      // 添加 data-* 属性支持点击查看详情
      html += '<div class="heatmap-cell ' + cls + todayCls + futureCls + '" data-date="' + key + '" data-done="' + doneCount + '" data-total="' + totalHabits + '" title="' + key + ': ' + doneCount + '/' + totalHabits + '"></div>';
    }

    gridEl.innerHTML = html;
    // 绑定点击事件（事件委托）
    _attachHeatmapCellClick(gridEl);
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

  // ========== 成就徽章系统 ==========
  var BADGE_SVGS = {
    flame: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
    star: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
    trophy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>',
    heart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
    calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    zap: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    crown: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"></path><polyline points="12 2 12 15"></polyline></svg>',
    gem: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 6l-4.5 10.5-4.5-10.5L3 13.5l6 3 6-3 6-7.5z"></path></svg>',
    award: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="10"></circle></svg>',
    sparkles: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path></svg>',
    leaf: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path></svg>',
    moon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    sun: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
    tree: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    snow: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path><path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path><path d="M12 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path><path d="M4 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path><path d="M20 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"></path><path d="M6.34 6.34a2 2 0 1 0-2.83-2.83 2 2 0 0 0 2.83 2.83z"></path><path d="M17.66 17.66a2 2 0 1 0-2.83-2.83 2 2 0 0 0 2.83 2.83z"></path><path d="M6.34 17.66a2 2 0 1 0-2.83 2.83 2 2 0 0 0 2.83-2.83z"></path><path d="M17.66 6.34a2 2 0 1 0-2.83 2.83 2 2 0 0 0 2.83-2.83z"></path></svg>',
    flower: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>',
    book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>'
  };

  function _getTotalCheckinsCount() {
    let total = 0;
    for (const key in checkinRecords) {
      const rec = checkinRecords[key];
      for (const hId in rec) {
        if (rec[hId] && rec[hId].done) total++;
      }
    }
    return total;
  }

  function _hasConstitutionTest() {
    return localStorage.getItem('constitution_result') !== null;
  }

  function _hasPerfectWeek() {
    const todayDate = new Date();
    for (let w = 0; w < 4; w++) {
      let allDaysDone = true;
      for (let d = 0; d < 7; d++) {
        const date = new Date(todayDate);
        date.setDate(date.getDate() - w * 7 - d);
        const key = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
        const rec = checkinRecords[key] || {};
        if (!habitsConfig.every(h => App.Core.Storage.isHabitChecked(h, rec))) {
          allDaysDone = false;
          break;
        }
      }
      if (allDaysDone) return true;
    }
    return false;
  }

  function _hasPerfectMonth() {
    const todayDate = new Date();
    const daysInMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
    let perfectCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(todayDate.getFullYear(), todayDate.getMonth(), d);
      const key = date.getFullYear() + '-' + String(date.getMonth()+1).padStart(2,'0') + '-' + String(date.getDate()).padStart(2,'0');
      const rec = checkinRecords[key] || {};
      if (habitsConfig.length > 0 && habitsConfig.every(h => App.Core.Storage.isHabitChecked(h, rec))) {
        perfectCount++;
      }
    }
    return perfectCount >= 28;
  }

  function _getActiveDaysCount() {
    let count = 0;
    for (const key in checkinRecords) {
      const rec = checkinRecords[key];
      if (Object.keys(rec).some(hId => rec[hId] && rec[hId].done)) {
        count++;
      }
    }
    return count;
  }

  function _getBadgeList() {
    var svgs = BADGE_SVGS;
    return [
      {id:'streak7',label:'7天连续',icon:svgs.flame,category:'streak',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 7)},
      {id:'streak14',label:'14天连续',icon:svgs.flame,category:'streak',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 14)},
      {id:'streak30',label:'30天连续',icon:svgs.star,category:'streak',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 30)},
      {id:'streak100',label:'百日坚持',icon:svgs.crown,category:'streak',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 100)},
      {id:'all_done',label:'今日全勤',icon:svgs.trophy,category:'perfect',check: () => {
        const rec = checkinRecords[today()] || {};
        return habitsConfig.length > 0 && habitsConfig.every(h => App.Core.Storage.isHabitChecked(h, rec));
      }},
      {id:'perfect_week',label:'完美一周',icon:svgs.calendar,category:'perfect',check: _hasPerfectWeek},
      {id:'perfect_month',label:'完美一月',icon:svgs.zap,category:'perfect',check: _hasPerfectMonth},
      {id:'total_100',label:'百次打卡',icon:svgs.heart,category:'total',check: () => _getTotalCheckinsCount() >= 100},
      {id:'total_500',label:'五百次',icon:svgs.gem,category:'total',check: () => _getTotalCheckinsCount() >= 500},
      {id:'total_1000',label:'千次打卡',icon:svgs.award,category:'total',check: () => _getTotalCheckinsCount() >= 1000},
      {id:'active_30',label:'30天活跃',icon:svgs.sparkles,category:'active',check: () => _getActiveDaysCount() >= 30},
      {id:'active_90',label:'90天活跃',icon:svgs.sparkles,category:'active',check: () => _getActiveDaysCount() >= 90},
      {id:'active_180',label:'半年活跃',icon:svgs.sparkles,category:'active',check: () => _getActiveDaysCount() >= 180},
      {id:'constitution',label:'体质达人',icon:svgs.book,category:'special',check: _hasConstitutionTest},
      {id:'spring_health',label:'春日养生',icon:svgs.flower,category:'season',check: () => (typeof getCurrentSeason === 'function') ? getCurrentSeason() === 'spring' : false},
      {id:'summer_health',label:'夏日养生',icon:svgs.sun,category:'season',check: () => (typeof getCurrentSeason === 'function') ? getCurrentSeason() === 'summer' : false},
      {id:'autumn_health',label:'秋日养生',icon:svgs.tree,category:'season',check: () => (typeof getCurrentSeason === 'function') ? getCurrentSeason() === 'autumn' : false},
      {id:'winter_health',label:'冬日养生',icon:svgs.snow,category:'season',check: () => (typeof getCurrentSeason === 'function') ? getCurrentSeason() === 'winter' : false},
      {id:'early_bird',label:'早起达人',icon:svgs.sun,category:'special',check: () => {
        const h = habitsConfig.find(h => h.id === 'early_rise');
        return h && getMaxStreak(h.id) >= 21;
      }},
      {id:'night_owl',label:'早睡达人',icon:svgs.moon,category:'special',check: () => {
        const h = habitsConfig.find(h => h.id === 'early_sleep');
        return h && getMaxStreak(h.id) >= 21;
      }},
      {id:'water_master',label:'喝水大师',icon:svgs.leaf,category:'special',check: () => {
        const h = habitsConfig.find(h => h.id === 'daily_water');
        return h && getMaxStreak(h.id) >= 30;
      }}
    ];
  }

  function _renderBadgeItem(b, size) {
    const unlocked = b.check();
    const cls = size === 'mini' ? 'badge-mini' : 'badge';
    const iconCls = size === 'mini' ? 'badge-mini-icon' : 'badge-icon';
    const labelCls = size === 'mini' ? 'badge-mini-label' : 'badge-label';
    const labelHtml = size === 'mini' ? '' : '<div class="' + labelCls + ' ' + (unlocked ? 'unlocked' : '') + '">' + esc(b.label) + '</div>';
    return '<div class="' + cls + '" title="' + esc(b.label) + '">' +
      '<div class="' + iconCls + ' ' + (unlocked ? 'unlocked' : 'locked') + '">' + b.icon + '</div>' +
      labelHtml +
    '</div>';
  }

  function renderProfileBadgesMini() {
    const listEl = document.getElementById('profileBadgesMiniList');
    const countEl = document.getElementById('profileBadgesMiniCount');
    if (!listEl || !countEl) return;

    const badges = _getBadgeList();
    const unlocked = badges.filter(b => b.check());
    const showBadges = unlocked.length > 0 ? unlocked.slice(0, 5) : badges.slice(0, 5);

    const moreCount = Math.max(0, unlocked.length - 5);
    const moreHtml = moreCount > 0 ? '<div class="badge-mini more">+' + moreCount + '</div>' : '';

    listEl.innerHTML = showBadges.map(b => _renderBadgeItem(b, 'mini')).join('') + moreHtml;
    countEl.textContent = unlocked.length + '/' + badges.length;
  }

  function renderBadgePanel() {
    const summaryEl = document.getElementById('badgeSummary');
    const categoriesEl = document.getElementById('badgeCategories');
    if (!summaryEl || !categoriesEl) return;

    const badges = _getBadgeList();
    const unlocked = badges.filter(b => b.check());
    const categories = [
      {id:'streak',name:'🔥 连续打卡',desc:'坚持就是力量'},
      {id:'perfect',name:'✨ 完美记录',desc:'全勤与周期挑战'},
      {id:'total',name:'💎 累计成就',desc:'点滴积累的结果'},
      {id:'active',name:'🌟 活跃达人',desc:'持续参与的天数'},
      {id:'season',name:'🍃 季节养生',desc:'顺应时节调理'},
      {id:'special',name:'🎯 专项挑战',desc:'特定习惯突破'}
    ];

    const pct = Math.round(unlocked.length / badges.length * 100);
    summaryEl.innerHTML = '<div class="badge-progress-ring" style="--pct:' + pct + '">' +
      '<div class="bpr-inner"><div class="bpr-num">' + unlocked.length + '</div><div class="bpr-total">/' + badges.length + '</div></div>' +
      '</div>' +
      '<div class="badge-progress-info">' +
      '<div class="bpi-title">已获得 ' + Math.round(unlocked.length / badges.length * 100) + '% 成就</div>' +
      '<div class="bpi-desc">继续打卡解锁更多徽章吧</div>' +
      '</div>';

    categoriesEl.innerHTML = categories.map(cat => {
      const catBadges = badges.filter(b => b.category === cat.id);
      if (catBadges.length === 0) return '';
      const catUnlocked = catBadges.filter(b => b.check()).length;
      return '<div class="badge-category">' +
        '<div class="badge-category-header">' +
          '<div><span class="badge-category-name">' + cat.name + '</span><span class="badge-category-count">' + catUnlocked + '/' + catBadges.length + '</span></div>' +
          '<div class="badge-category-desc">' + cat.desc + '</div>' +
        '</div>' +
        '<div class="badge-category-grid">' + catBadges.map(b => _renderBadgeItem(b, 'normal')).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  function renderAchievements() {
    renderProfileBadgesMini();
    renderBadgePanel();
  }

  function openBadgePanel() {
    if (typeof openPanel === 'function') {
      renderBadgePanel();
      openPanel('badgePanel');
    }
  }

  function renderProfile() {
    renderLevelCard();
    renderProfileBadgesMini();
    renderProfileStats();
    renderConstitutionSummary();
    renderProfileGrid();
  }

  function renderManage() {
    renderManageStats();
    renderManageGroups();
    renderDailyCardPreview();
  }

  function renderManageStats() {
    const container = document.getElementById('mgStats');
    if (!container) return;
    container.innerHTML = '';
  }

  // 计算本周（周一到周日）打卡统计
  function _computeWeekStats() {
    const d = new Date();
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? 6 : dow - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - mondayOffset);

    let totalDone = 0, totalAll = 0;
    const habitStats = {};
    habitsConfig.forEach(h => {
      habitStats[h.id] = {done: 0, total: 7, name: h.name, icon: h.icon, enabled: h.enabled !== false};
    });

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const key = formatDate(day);
      const rec = checkinRecords[key] || {};
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        totalAll++;
        if (rec[h.id] && rec[h.id].done) {
          totalDone++;
          habitStats[h.id].done++;
        }
      });
    }

    let best = null, worst = null;
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const s = habitStats[h.id];
      if (!best || s.done > best.done) best = s;
      if (!worst || s.done < worst.done) worst = s;
    });

    return {totalDone, totalAll, habitStats, best, worst};
  }

  function renderManageWeeklyReport() {
    const container = document.getElementById('mgWeeklyReport');
    if (!container) return;
    const data = _computeWeekStats();
    if (data.totalAll === 0) {
      container.innerHTML = '';
      return;
    }
    const weekRate = Math.round((data.totalDone / data.totalAll) * 100);
    const best = data.best;
    const worst = (data.worst && data.worst.done < 7) ? data.worst : null;

    container.innerHTML = `
      <div class="mg-weekly-report">
        <div class="mg-weekly-header">
          <span class="mg-weekly-title">📊 本周总结</span>
          <span class="mg-weekly-rate">${weekRate}%</span>
        </div>
        <div class="mg-weekly-progress">
          <div class="mg-weekly-progress-bar" style="width:${weekRate}%"></div>
        </div>
        <div class="mg-weekly-summary">
          <span>总打卡 <strong>${data.totalDone}</strong>/${data.totalAll}</span>
        </div>
        ${best ? `<div class="mg-weekly-item best"><span class="emoji">🌟</span><span class="text">最佳：${esc(best.icon)} ${esc(best.name)}（${best.done}天）</span></div>` : ''}
        ${worst ? `<div class="mg-weekly-item worst"><span class="emoji">💪</span><span class="text">需加油：${esc(worst.icon)} ${esc(worst.name)}（${worst.done}天）</span></div>` : ''}
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
      { id: 'morning', name: '卯辰时', icon: '🌅', emoji: '🌅', range: [5, 9] },
      { id: 'forenoon', name: '巳时', icon: '🌤️', emoji: '🌤️', range: [9, 11] },
      { id: 'afternoon', name: '午未申', icon: '☀️', emoji: '☀️', range: [11, 17] },
      { id: 'evening', name: '酉戌亥', icon: '🌙', emoji: '🌙', range: [17, 24] }
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
            <span class="mg-group-name">${esc(period.name)}</span>
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
          const typeLabel = h.type === 'boolean' ? '打卡' : h.type === 'count' ? `计数·${esc(h.unit)}` : h.type === 'water' ? '饮水追踪' : `计时·${esc(h.unit)}`;
          const reminder = h.reminder;
          const reminderStr = reminder && reminder.enabled ? `⏰ ${reminder.time}` : '';
          const repeatArr = h.repeat || [0,1,2,3,4,5,6];
          const repeatLabel = repeatArr.length === 7 ? '每天' : repeatArr.length === 5 && !repeatArr.includes(0) && !repeatArr.includes(6) ? '工作日' : repeatArr.length === 2 && repeatArr.includes(0) && repeatArr.includes(6) ? '周末' : `每周${repeatArr.length}天`;

          html += `<div class="mg-item" onclick="openHabitEditPanel('${h.id}')">
            <span class="mg-item-icon">${esc(h.icon)}</span>
            <div class="mg-item-info">
              <div class="mg-item-name">${esc(h.name)}</div>
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
    const ir = habit.intervalReminder;
    const irEnabled = ir && ir.enabled;
    // 互斥：优先间隔提醒，若间隔开启则定点显示为关闭
    const reminderEnabled = irEnabled ? false : (habit.reminder && habit.reminder.enabled);
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
      <input class="he-input" id="heName" value="${esc(habit.name)}" maxlength="20">`;

    // Icon picker (collapsible)
    const selectedIconLabel = habit.icon || '⭐';
    html += `<div class="he-label" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'grid':'none';this.querySelector('.he-collapse-arrow').classList.toggle('collapsed')">
      <span>选择图标 <span style="font-size:20px;margin-left:4px">${esc(selectedIconLabel)}</span></span>
      <span class="he-collapse-arrow">▼</span>
    </div>
      <div class="he-icon-grid" style="display:none">`;
    iconOptions.forEach(ico => {
      const sel = habit.icon === ico ? ' selected' : '';
      html += `<div class="he-icon-opt${sel}" data-icon="${esc(ico)}" onclick="App.UI.Render.selectEditIcon(this,'${esc(ico)}')">${esc(ico)}</div>`;
    });
    html += `</div><input type="hidden" id="heIcon" value="${esc(habit.icon)}">`;

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
      <input class="he-input" id="heUnit" value="${esc(habit.unit || '')}" placeholder="如：杯、分钟">
    </div>`;

    // Target (for count/timer types)
    html += `<div id="heTargetWrap" style="display:${(habit.type === 'count' || habit.type === 'timer') ? 'block' : 'none'}">
      <div class="he-label">每日目标</div>
      <input class="he-input" id="heTarget" type="number" value="${esc(habit.target || '')}" placeholder="每日目标数量">
    </div>`;

    // Water config (for water type)
    const wc = habit.waterConfig || {dailyGoal: 2000, perCup: 250};
    html += `<div id="heWaterWrap" style="display:${habit.type === 'water' ? 'block' : 'none'}">
      <div class="he-row">
        <div class="he-row-item">
          <div class="he-label">每日目标 (ml)</div>
          <input class="he-input" id="heWaterGoal" type="number" value="${wc.dailyGoal}" min="500" max="5000" step="100">
        </div>
        <div class="he-row-item">
          <div class="he-label">每杯容量 (ml)</div>
          <input class="he-input" id="heWaterPerCup" type="number" value="${wc.perCup}" min="50" max="1000" step="50">
        </div>
      </div>
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

    // Reminder - 统一提醒区域
    const irInterval = (ir && ir.interval) || 45;
    const irStart = (ir && ir.startTime) || '09:00';
    const irEnd = (ir && ir.endTime) || '18:00';
    const irDays = (ir && ir.days) || [0,1,2,3,4,5,6];
    const hasAnyReminder = reminderEnabled || irEnabled;

    html += `<div class="he-switch-row">
      <span class="he-switch-label">🔔 开启提醒</span>
      <div class="mg-item-toggle ${hasAnyReminder ? 'on' : ''}" onclick="toggleEditReminder()" id="heReminderToggle"></div>
    </div>`;

    html += `<div id="heReminderWrap" style="display:${hasAnyReminder ? 'block' : 'none'};padding-left:4px">`;

    // 定点提醒
    html += `<div class="he-reminder-section">
      <div class="he-reminder-sec-title">
        <span>⏰ 定点提醒</span>
        <div class="mg-item-toggle-sm ${reminderEnabled ? 'on' : ''}" onclick="toggleEditFixedReminder(this)" id="heFixedToggle"></div>
      </div>
      <div id="heFixedWrap" style="display:${reminderEnabled ? 'block' : 'none'};margin-top:8px">
        <div class="he-time-row">
          <span style="font-size:14px;color:var(--muted)">⏰</span>
          <input class="he-time-input" id="heReminderTime" type="time" value="${reminderTime}">
        </div>
        <div class="he-extra-reminders" id="heExtraRemindersList" style="margin-top:8px">`;
    extraReminders.forEach(t => {
      html += `<div class="he-extra-reminder-item">
          <input type="time" value="${t}">
          <span class="he-reminder-remove" onclick="this.parentElement.remove()">✕</span>
        </div>`;
    });
    html += `</div>
        <button class="he-add-reminder-btn" onclick="App.UI.Render.addEditReminderTime()" style="margin-top:6px">+ 添加提醒</button>
      </div>
    </div>`;

    // 间隔提醒
    html += `<div class="he-reminder-section">
      <div class="he-reminder-sec-title">
        <span>⏱️ 间隔提醒</span>
        <div class="mg-item-toggle-sm ${irEnabled ? 'on' : ''}" onclick="toggleEditIntervalReminder(this)" id="heIntervalToggle"></div>
      </div>
      <div id="heIntervalWrap" style="display:${irEnabled ? 'block' : 'none'};margin-top:8px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:6px">每 <input id="irInterval" type="number" value="${irInterval}" min="5" max="180" style="width:50px;padding:4px 8px;border:1px solid var(--rule);border-radius:6px;font-size:13px;text-align:center"> 分钟</div>
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
    html += `</div>
      </div>
    </div>`;

    html += `</div>`;

    // Note
    html += `<div class="he-label">📝 备注说明</div>
      <input class="he-input" id="heNote" value="${esc(note)}" placeholder="习惯说明（选填）" maxlength="100">`;

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
    const waterWrap = document.getElementById('heWaterWrap');
    if (type === 'count' || type === 'timer') {
      if (unitWrap) unitWrap.style.display = 'block';
      if (targetWrap) targetWrap.style.display = 'block';
      if (waterWrap) waterWrap.style.display = 'none';
    } else if (type === 'water') {
      if (unitWrap) unitWrap.style.display = 'none';
      if (targetWrap) targetWrap.style.display = 'none';
      if (waterWrap) waterWrap.style.display = 'block';
    } else {
      if (unitWrap) unitWrap.style.display = 'none';
      if (targetWrap) targetWrap.style.display = 'none';
      if (waterWrap) waterWrap.style.display = 'none';
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

  function toggleEditReminder() {
    const toggle = document.getElementById('heReminderToggle');
    if (!toggle) return;
    const wrap = document.getElementById('heReminderWrap');
    const isOn = toggle.classList.toggle('on');
    if (wrap) wrap.style.display = isOn ? 'block' : 'none';
    if (isOn) {
      // 开启总开关时，默认只开启定点提醒
      const fixedToggle = document.getElementById('heFixedToggle');
      const intervalToggle = document.getElementById('heIntervalToggle');
      if (fixedToggle && !fixedToggle.classList.contains('on') && intervalToggle && !intervalToggle.classList.contains('on')) {
        fixedToggle.classList.add('on');
        const fixedWrap = document.getElementById('heFixedWrap');
        if (fixedWrap) fixedWrap.style.display = 'block';
      }
    } else {
      const fixedToggle = document.getElementById('heFixedToggle');
      const intervalToggle = document.getElementById('heIntervalToggle');
      if (fixedToggle) fixedToggle.classList.remove('on');
      if (intervalToggle) intervalToggle.classList.remove('on');
      const fixedWrap = document.getElementById('heFixedWrap');
      const intervalWrap = document.getElementById('heIntervalWrap');
      if (fixedWrap) fixedWrap.style.display = 'none';
      if (intervalWrap) intervalWrap.style.display = 'none';
    }
  }

  function toggleEditFixedReminder(el) {
    const isOn = el.classList.toggle('on');
    const wrap = document.getElementById('heFixedWrap');
    if (wrap) wrap.style.display = isOn ? 'block' : 'none';
    // 互斥：开启定点时关闭间隔
    if (isOn) {
      const intervalToggle = document.getElementById('heIntervalToggle');
      if (intervalToggle && intervalToggle.classList.contains('on')) {
        intervalToggle.classList.remove('on');
        const intervalWrap = document.getElementById('heIntervalWrap');
        if (intervalWrap) intervalWrap.style.display = 'none';
      }
    }
  }
  window.toggleEditFixedReminder = toggleEditFixedReminder;

  function toggleEditIntervalReminder(el) {
    const isOn = el.classList.toggle('on');
    const wrap = document.getElementById('heIntervalWrap');
    if (wrap) wrap.style.display = isOn ? 'block' : 'none';
    // 互斥：开启间隔时关闭定点
    if (isOn) {
      const fixedToggle = document.getElementById('heFixedToggle');
      if (fixedToggle && fixedToggle.classList.contains('on')) {
        fixedToggle.classList.remove('on');
        const fixedWrap = document.getElementById('heFixedWrap');
        if (fixedWrap) fixedWrap.style.display = 'none';
      }
    }
  }
  window.toggleEditIntervalReminder = toggleEditIntervalReminder;

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

    if (habit.type === 'water') {
      const goalInput = document.getElementById('heWaterGoal');
      const perCupInput = document.getElementById('heWaterPerCup');
      habit.waterConfig = {
        dailyGoal: goalInput ? parseInt(goalInput.value) || 2000 : 2000,
        perCup: perCupInput ? parseInt(perCupInput.value) || 250 : 250
      };
    }

    const repeatStr = document.getElementById('heRepeat').value;
    habit.repeat = repeatStr ? repeatStr.split(',').map(Number) : [0,1,2,3,4,5,6];

    const reminderMainOn = document.getElementById('heReminderToggle').classList.contains('on');
    const fixedOn = document.getElementById('heFixedToggle').classList.contains('on');
    const irToggle = document.getElementById('heIntervalToggle');
    const irOn = irToggle ? irToggle.classList.contains('on') : false;

    // 定点/间隔互斥保存
    if (reminderMainOn && irOn) {
      // 优先间隔提醒
      habit.reminder = { enabled: false, time: document.getElementById('heReminderTime').value };
    } else if (reminderMainOn && fixedOn) {
      // 定点提醒
      habit.reminder = { enabled: true, time: document.getElementById('heReminderTime').value };
    } else {
      habit.reminder = { enabled: false, time: document.getElementById('heReminderTime').value };
    }

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
    if (irToggle) {
      const irOn = reminderMainOn && irToggle.classList.contains('on');
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
    const idx = habitsConfig.findIndex(h => h.id === habitId);
    if (idx >= 0) {
      const cleaned = App.Core.Storage.purgeHabitRecords(habitId);
      habitsConfig.splice(idx, 1);
      App.Core.Storage.saveConfig();
      App.UI.Panels.closeAllPanels();
      App.UI.Render.renderManage();
      App.UI.Render.renderCheckin();
      showToast(cleaned > 0 ? `已删除习惯并清理 ${cleaned} 天打卡记录` : '已删除习惯');
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
        nextEl.textContent = `再打卡 ${need} 天升级为「${esc(next.name)}」`;
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
    const points = getUserPoints();

    const streakEl = document.getElementById('psStreak');
    const totalEl = document.getElementById('psTotal');
    const rateEl = document.getElementById('psRate');
    const habitsEl = document.getElementById('psHabits');
    const pointsEl = document.getElementById('psPoints');

    if (streakEl) streakEl.textContent = streak;
    if (totalEl) totalEl.textContent = total;
    if (rateEl) rateEl.textContent = rate + '%';
    if (habitsEl) habitsEl.textContent = count;
    if (pointsEl) pointsEl.textContent = points;
  }

  function renderConstitutionSummary() {
    var card = document.getElementById('constitutionSummaryCard');
    if (!card) return;

    var result = null;
    try { result = JSON.parse(localStorage.getItem('constitution_result') || 'null'); } catch(e) {}

    if (!result || !result.typeId) {
      card.style.display = 'block';
      card.innerHTML =
        '<div class="const-summary-card entry-card" onclick="App.Modules.Constitution.openConstitutionPanel()">' +
          '<div class="csc-left">' +
            '<div class="csc-emoji">🩺</div>' +
            '<div class="csc-info">' +
              '<div class="csc-title">测测你的体质</div>' +
              '<div class="csc-sub">九种体质辨识，获取专属养生方案</div>' +
            '</div>' +
          '</div>' +
          '<span class="csc-arrow">›</span>' +
        '</div>';
      return;
    }

    var ct = null;
    if (typeof CONSTITUTION_TYPES !== 'undefined' && Array.isArray(CONSTITUTION_TYPES)) {
      ct = CONSTITUTION_TYPES.find(function(c) { return c.id === result.typeId; });
    }

    if (!ct) {
      card.style.display = 'none';
      return;
    }

    var dateStr = result.date ? new Date(result.date).toLocaleDateString('zh-CN') : '';
    var version = result.quizVersion || '';

    card.style.display = 'block';
    card.innerHTML =
      '<div class="const-summary-card" style="border-left-color:' + (ct.color || 'var(--accent)') + '" onclick="App.Modules.Constitution.openConstitutionPanel()">' +
        '<div class="csc-header">' +
          '<span class="csc-badge" style="background:' + (ct.color || 'var(--accent)') + '">' + ct.name + '</span>' +
          '<span class="csc-date">' + version + ' · ' + dateStr + '</span>' +
        '</div>' +
        '<div class="csc-body">' +
          '<div class="csc-emoji-lg">' + ct.emoji + '</div>' +
          '<div class="csc-content">' +
            '<div class="csc-desc">' + ct.desc + '</div>' +
            '<div class="csc-advice">💡 ' + (ct.advice ? ct.advice.substring(0, 30) + '...' : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="csc-footer">' +
          '<span class="csc-more">查看详情 ›</span>' +
        '</div>' +
      '</div>';
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

    const plat = window.__PLATFORM__ || 'pwa';
    if (plat === 'pwa') {
    }

    grid.innerHTML = items.map((item, i) => `
      <button class="profile-grid-item pg-i-${i}" onclick="handleProfileGridClick('${item.action}')">
        <div class="pg-icon">${esc(item.icon)}</div>
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
      case 'downloadApk': window.open('app-release.apk', '_blank'); break;
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

  // ===== 数字递增动画（500~800ms，requestAnimationFrame 驱动，不阻塞交互） =====
  function _animateNumber(el, target, duration, suffix) {
    if (!el) return;
    target = Number(target) || 0;
    duration = duration || 700;
    suffix = suffix || '';
    var start = 0;
    var startTime = null;
    // 标记动画中，避免重复触发
    el._animTarget = target;
    function step(ts) {
      if (startTime === null) startTime = ts;
      var progress = Math.min(1, (ts - startTime) / duration);
      // easeOutCubic 缓动
      var eased = 1 - Math.pow(1 - progress, 3);
      var cur = Math.round(start + (target - start) * eased);
      el.textContent = cur + suffix;
      if (progress < 1 && el._animTarget === target) {
        requestAnimationFrame(step);
      } else if (el._animTarget === target) {
        el.textContent = target + suffix;
      }
    }
    requestAnimationFrame(step);
  }

  // 批量动画容器内所有 [data-anim-target]
  function _animateNumbersIn(container) {
    if (!container) return;
    var nodes = container.querySelectorAll('[data-anim-target]');
    nodes.forEach(function(n) {
      var t = n.getAttribute('data-anim-target');
      var sfx = n.getAttribute('data-anim-suffix') || '';
      var dur = Number(n.getAttribute('data-anim-duration')) || 700;
      _animateNumber(n, t, dur, sfx);
    });
  }

  // ===== 热力图格子点击查看详情（事件委托，单次绑定） =====
  function _attachHeatmapCellClick(gridEl) {
    if (!gridEl) return;
    if (gridEl._heatmapBound) return;
    gridEl._heatmapBound = true;
    gridEl.addEventListener('click', function(e) {
      var cell = e.target.closest && e.target.closest('[data-date]');
      if (!cell) return;
      if (cell.classList.contains('empty') || cell.classList.contains('yh-empty')) return;
      var date = cell.getAttribute('data-date');
      var done = Number(cell.getAttribute('data-done') || 0);
      var total = Number(cell.getAttribute('data-total') || 0);
      _showHeatmapTooltip(cell, date, done, total);
    });
  }

  // 热力图详情浮层（单例，复用 #heatmapTooltip）
  function _showHeatmapTooltip(cell, date, done, total) {
    var tip = document.getElementById('heatmapTooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'heatmapTooltip';
      tip.className = 'heatmap-tooltip';
      tip.addEventListener('click', function() { tip.style.display = 'none'; });
      document.body.appendChild(tip);
    }
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var parts = date.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var weekDay = ['日','一','二','三','四','五','六'][d.getDay()];
    var pctColor = pct >= 75 ? 'var(--accent)' : pct >= 50 ? 'var(--accent2)' : 'var(--muted)';
    tip.innerHTML =
      '<div class="ht-date">' + parts[1] + '月' + parts[2] + '日 · 周' + weekDay + '</div>' +
      '<div class="ht-detail">完成 <b style="color:' + pctColor + '">' + done + '</b> / ' + total + ' 项</div>' +
      '<div class="ht-bar"><div class="ht-bar-fill" style="width:' + pct + '%;background:' + pctColor + '"></div></div>' +
      '<div class="ht-hint">点击空白处关闭</div>';
    var rect = cell.getBoundingClientRect();
    var tipW = 200, tipH = 96;
    var left = rect.left + rect.width / 2 - tipW / 2;
    var top = rect.bottom + window.scrollY + 8;
    if (left + tipW > window.innerWidth - 8) left = window.innerWidth - tipW - 8;
    if (left < 8) left = 8;
    // 若下方溢出，则显示在上方
    if (rect.bottom + tipH + 12 > window.innerHeight) {
      top = rect.top + window.scrollY - tipH - 8;
    }
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
    tip.style.display = 'block';
    clearTimeout(tip._timer);
    tip._timer = setTimeout(function() { tip.style.display = 'none'; }, 5000);
  }

  function renderSdWeekBarChart() {
    var container = document.getElementById('sdWeekBarChart');
    if (!container) return;

    var weekDays = ['日','一','二','三','四','五','六'];
    var today = new Date();
    var todayStr = formatDate(today);
    var totalHabits = habitsConfig.filter(function(h) { return h.enabled !== false; }).length;

    // 容器高 110px（含上下间距），柱体区域 100px，最高 80px = 80%
    var BAR_AREA_H = 100;
    var BAR_MAX_H = 80;

    // 收集 7 天数据
    var data = [];
    var maxDone = 1;
    for (var i = 0; i < 7; i++) {
      var d = new Date(today);
      d.setDate(d.getDate() - today.getDay() + i);
      var key = formatDate(d);
      var rec = checkinRecords[key] || {};
      var done = _countDayDone(rec);
      var pct = totalHabits > 0 ? (done / totalHabits) : 0;
      // 柱高 = 完成率 × 最大柱高（确保不超过 80%）
      var h = Math.max(4, Math.round(pct * BAR_MAX_H));
      data.push({
        day: weekDays[i],
        done: done,
        total: totalHabits,
        pct: Math.round(pct * 100),
        h: h,
        key: key,
        isToday: key === todayStr,
        isFuture: d > today
      });
      if (done > maxDone) maxDone = done;
    }

    // 渲染：初始 height:0，下一帧切换到目标高度实现渐进动画
    var html = '<div class="sd-bar-chart" style="display:flex;align-items:flex-end;gap:6px;height:' + BAR_AREA_H + 'px;padding:8px 0 4px">';
    data.forEach(function(d) {
      var barCls = 'sd-bar' + (d.isToday ? ' sd-bar-today' : '');
      var barBg = d.isFuture
        ? 'var(--bg2)'
        : (d.isToday
            ? 'linear-gradient(180deg,var(--accent),var(--accent2))'
            : 'linear-gradient(180deg,var(--accent-light),var(--accent))');
      html += '<div class="sd-bar-col" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" data-date="' + d.key + '" data-done="' + d.done + '" data-total="' + d.total + '">'
        + '<span class="sd-bar-num" style="font-size:10px;color:var(--muted);font-weight:700">' + (d.done > 0 ? d.done : '–') + '</span>'
        + '<div class="' + barCls + '" style="width:100%;max-width:32px;height:0;background:' + barBg + ';border-radius:6px 6px 4px 4px;transition:height .6s var(--ease-out);" data-target-h="' + d.h + '"></div>'
        + '<span style="font-size:10px;color:' + (d.isToday ? 'var(--accent)' : 'var(--muted)') + ';font-weight:' + (d.isToday ? 700 : 400) + '">' + (d.isToday ? '今天' : d.day) + '</span>'
        + '</div>';
    });
    html += '</div>';
    container.innerHTML = html;

    // 触发渐进显示动画：下一帧设置目标高度
    requestAnimationFrame(function() {
      var bars = container.querySelectorAll('.sd-bar[data-target-h]');
      bars.forEach(function(bar, idx) {
        setTimeout(function() {
          bar.style.height = bar.getAttribute('data-target-h') + 'px';
        }, idx * 60);  // 每根柱子依次延迟 60ms
      });
    });
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

    // 容器 100px，柱体最高 80px = 80%
    const BAR_AREA_H = 100;
    const BAR_MAX_H = 80;

    let html = `<div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:12px">目标：${goal}ml/天</div>`;
    html += `<div style="display:flex;align-items:flex-end;gap:6px;height:${BAR_AREA_H}px;padding:8px 0 4px">`;

    // 第一遍收集数据，第二遍渲染（确保渐进动画初始 height:0）
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      const waterRec = rec[waterHabit.id] || {};
      const value = waterRec.value || 0;
      const pct = Math.min(100, (value / goal));
      const h = Math.max(4, Math.round(pct * BAR_MAX_H));
      weekData.push({
        day: dayNames[i],
        key,
        value,
        pct: Math.round(pct * 100),
        h,
        isToday: key === formatDate(today),
        isFuture: d > today
      });
    }

    weekData.forEach((d, idx) => {
      const done = d.pct >= 100;
      // 水位柱体：双层结构 - 外层渐变背景 + 内层波浪（CSS 伪元素实现）
      // isFuture：空槽位；done：金绿渐变 + ✓；中间：蓝色水位 + 波浪
      const barCls = 'water-bar' + (d.isToday ? ' water-bar-today' : '') + (done ? ' water-bar-done' : '');
      const bgStyle = d.isFuture
        ? 'background:var(--bg2)'
        : (done
            ? 'background:linear-gradient(180deg,var(--accent),var(--accent2))'
            : 'background:linear-gradient(180deg,rgba(91,141,184,.25),rgba(91,141,184,.55))');
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px" data-date="${d.key}" data-done="${d.value}" data-total="${goal}">
        <span style="font-size:10px;color:${done ? 'var(--accent)' : 'var(--muted)'};font-weight:700">${d.value > 0 ? d.value + 'ml' : '–'}</span>
        <div class="${barCls}" style="width:100%;max-width:32px;height:0;${bgStyle};border-radius:6px 6px 4px 4px;transition:height .6s var(--ease-out);position:relative;overflow:hidden" data-target-h="${d.h}">
          ${done ? '<span style="position:absolute;top:4px;left:0;right:0;text-align:center;font-size:11px;color:#fff;z-index:2">✓</span>' : ''}
        </div>
        <span style="font-size:10px;color:${d.isToday ? 'var(--accent)' : 'var(--muted)'};font-weight:${d.isToday ? 700 : 400}">${d.isToday ? '今天' : d.day}</span>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;

    // 渐进显示动画
    requestAnimationFrame(() => {
      const bars = container.querySelectorAll('.water-bar[data-target-h]');
      bars.forEach((bar, idx) => {
        setTimeout(() => {
          bar.style.height = bar.getAttribute('data-target-h') + 'px';
        }, idx * 60);
      });
    });
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
    const wrap = grid ? grid.parentElement : null;
    if (!grid) return;

    const fmt = formatDate;
    const today = new Date();
    const endDate = new Date(today);
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    const dayOfWeek = startDate.getDay();
    const off = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(startDate.getDate() + off);

    const weeks = [];
    const current = new Date(startDate);
    let currentMonth = -1;
    let monthLabels = [];
    let totalCheckins = 0;
    let activeDays = 0;

    while (current <= endDate) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = fmt(current);
        const month = current.getMonth();
        const year = current.getFullYear();
        const dayOfMonth = current.getDate();

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

        totalCheckins += doneCount;
        if (doneCount > 0) activeDays++;

        const ratio = total > 0 ? doneCount / total : -1;
        const level = App.Core.Utils.getHeatmapLevel(ratio);
        const cellDate = new Date(current.getFullYear(), current.getMonth(), current.getDate());
        const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const isFuture = cellDate > todayDate;

        week.push({
          dateStr,
          level,
          doneCount,
          total,
          isToday: dateStr === fmt(today),
          isFuture
        });

        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    if (monthsEl) {
      const cellW = 17;
      let mHtml = '';
      monthLabels.forEach(m => {
        mHtml += `<span style="position:absolute;left:${32 + m.weekIndex * cellW}px">${esc(m.name)}</span>`;
      });
      monthsEl.innerHTML = mHtml;
    }

    const dayLabels = ['一', '', '三', '', '五', '', '日'];
    let html = '<div style="display:flex;gap:3px">';

    html += '<div style="display:flex;flex-direction:column;gap:3px;padding-right:6px;font-size:10px;color:var(--muted);width:24px;flex-shrink:0;line-height:14px">';
    for (let d = 0; d < 7; d++) {
      html += `<div>${dayLabels[d]}</div>`;
    }
    html += '</div>';

    html += '<div style="display:flex;gap:3px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;flex:1">';
    weeks.forEach(week => {
      html += '<div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">';
      week.forEach(cell => {
        const title = `${cell.dateStr}\n完成 ${cell.doneCount}/${cell.total} 个习惯`;
        const futureCls = cell.isFuture ? ' yh-empty' : '';
        const todayStyle = cell.isToday ? 'outline:2px solid var(--accent);outline-offset:2px;' : '';
        const levelCls = cell.level >= 0 ? ` yh-l${cell.level}` : ' yh-empty';
        html += `<div class="yh-cell${levelCls}${futureCls}" data-date="${cell.dateStr}" data-done="${cell.doneCount}" data-total="${cell.total}" title="${title}" style="${todayStyle}"></div>`;
      });
      html += '</div>';
    });
    html += '</div></div>';

    grid.innerHTML = html;

    if (wrap) {
      let totalHtml = wrap.querySelector('.year-heatmap-total');
      if (!totalHtml) {
        totalHtml = document.createElement('div');
        totalHtml.className = 'year-heatmap-total';
        wrap.appendChild(totalHtml);
      }
      totalHtml.innerHTML = `过去一年共完成 <strong>${totalCheckins}</strong> 次打卡，活跃 <strong>${activeDays}</strong> 天`;
    }

    _attachHeatmapCellClick(grid);
    _attachHeatmapHover(grid);
  }

  function _attachHeatmapHover(grid) {
    if (!grid) return;
    const tooltip = document.createElement('div');
    tooltip.className = 'year-heatmap-tooltip';
    document.body.appendChild(tooltip);

    grid.addEventListener('mouseover', function(e) {
      const cell = e.target.closest('.yh-cell');
      if (!cell || cell.classList.contains('yh-empty')) {
        tooltip.classList.remove('show');
        return;
      }
      const date = cell.dataset.date;
      const done = cell.dataset.done;
      const total = cell.dataset.total;
      const rect = cell.getBoundingClientRect();
      tooltip.textContent = `${date}\n完成 ${done}/${total} 个习惯`;
      tooltip.style.left = rect.left + window.scrollX + 'px';
      tooltip.style.top = rect.top + window.scrollY - 40 + 'px';
      tooltip.classList.add('show');
    });

    grid.addEventListener('mouseout', function() {
      tooltip.classList.remove('show');
    });

    grid.addEventListener('touchstart', function(e) {
      const cell = e.target.closest('.yh-cell');
      if (!cell || cell.classList.contains('yh-empty')) return;
      const date = cell.dataset.date;
      const done = cell.dataset.done;
      const total = cell.dataset.total;
      showToast(`${date}: 完成 ${done}/${total} 个习惯`, 2000);
    });
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
        <div style="font-size:28px;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent"><span data-anim-target="${completionRate}" data-anim-suffix="%" data-anim-duration="800">0</span></div>
        <div style="font-size:12px;color:var(--muted)">总完成率</div>
      </div>
      <div class="report-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="report-card"><div class="rc-num"><span data-anim-target="${activeDays}" data-anim-duration="700">0</span>/${totalDays}</div><div class="rc-label">活跃天</div></div>
        <div class="report-card"><div class="rc-num"><span data-anim-target="${maxStreak}" data-anim-duration="700">0</span></div><div class="rc-label">最长连续</div></div>
        <div class="report-card"><div class="rc-num"><span data-anim-target="${totalPomo.count}" data-anim-duration="700">0</span></div><div class="rc-label">番茄数</div></div>
      </div>`;

    if (bestHabit) {
      html += `
        <div style="margin-top:14px;font-size:13px;font-weight:700;margin-bottom:8px">🏆 最常完成的习惯</div>
        <div style="background:var(--bg2);border-radius:12px;padding:12px;text-align:center;margin-bottom:14px">
          <span style="font-size:22px">${esc(bestHabit.icon)}</span>
          <div style="font-size:14px;font-weight:700;margin:4px 0">${esc(bestHabit.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${bestHabit.done}/${bestHabit.total} 天</div>
        </div>`;
    }

    html += `<div style="font-size:13px;font-weight:700;margin-bottom:8px">📊 习惯排行</div>`;

    Object.values(habitStats).sort((a,b) => (b.done/b.total) - (a.done/a.total)).slice(0, 5).forEach(s => {
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      html += `<div class="report-habit-row">
        <span class="report-habit-name">${esc(s.icon)} ${esc(s.name)}</span>
        <div class="report-habit-bar"><div class="report-habit-fill" style="width:${pct}%;background:var(--accent);transition:width .8s var(--ease-out)"></div></div>
        <span class="report-habit-pct">${pct}%</span>
      </div>`;
    });

    container.innerHTML = html;
    // 触发数字递增动画（500~800ms，rAF 驱动，不阻塞交互）
    _animateNumbersIn(container);
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
    switchCheckinView,
    renderProfile,
    renderProfileGrid,
    renderStats,
    renderHeatmap,
    changeMonth,
    renderAchievements,
    renderManage,
    renderManageStats,
    renderManageWeeklyReport,
    renderManageGroups,
    toggleMgGroup,
    renderLevelCard,
    renderDailyCardCollection,
    renderDailyCardPreview,
    openDailyCardCollection,
    openBadgePanel,
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
    renderSdHeatmap,
    sdChangeMonth,
    renderYearHeatmap,
    renderSdMonthReview,
    renderSdYearReview,
    debouncedRenderManage,
    showCelebration,
    dismissCelebration
  };

  // 暴露到全局，供 HTML onclick 直接使用
  window.toggleMgGroup = toggleMgGroup;
  window.openHabitEditPanel = openHabitEditPanel;
  window.toggleEditReminder = toggleEditReminder;
  // 批量暴露其余函数
  Object.keys(App.UI.Render).forEach(function(k) {
    if (typeof App.UI.Render[k] === 'function' && !window[k]) window[k] = App.UI.Render[k];
  });

  if (App.registerModule) {
    App.registerModule('ui.render', 'ui', null);
  }
})();




