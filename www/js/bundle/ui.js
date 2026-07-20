/* ===== ui/render.js ===== */
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

  function _renderHabitCardRow(h, checked, overdue, soon, rec, nextTime) {
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
      return renderWaterTracker(h, rec).replace('class="water-tracker"', `class="water-tracker ${collapsedClass} ${periodClass}"`);
    }

    if (h.type === 'select') {
      const selected = rec[h.id] ? rec[h.id].value : '';
      const tipStr2 = h.tip || '';
      const timeHint = overdue ? '<span class="habit-time-hint overdue">已过期</span>' : soon ? '<span class="habit-time-hint soon">即将</span>' : '';
      const emotionPeriod = h.timePeriod && periodMap[h.timePeriod] ? periodMap[h.timePeriod] + '-period' : '';
      return `<div class="habit-card ${collapsedClass} ${emotionPeriod}" id="card-${h.id}" onclick="openEmotionPanel()">
        <span class="status-ribbon ${ribbonCls}"></span>
        <span class="icon">${esc(h.icon)}</span>
        <div class="info">
          <div class="name">${esc(h.name)}${selected ? '：' + selected : ''}</div>
          <div class="meta"><span style="color:var(--accent)">下次提醒 ${nextTimeStr || '点击记录今日情绪'}</span>${timeHint}</div>
          ${tipStr2 ? `<div style="font-size:11px;color:var(--accent);margin-top:3px;line-height:1.4">💡 ${tipStr2}</div>` : ''}
        </div>
        <button class="checkin-btn ${selected ? 'done' : 'pending'}">${selected ? '✓' : '记录'}</button>
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
          <span>⏰ ${nextTimeStr || '--:--'}</span>
          ${intervalHtml}
          ${streak > 0 ? '<span class="streak">🔥' + streak + '天</span>' : ''}
          ${timeHint}
        </div>
        ${libTip ? '<div class="habit-desc">' + libTip + '</div>' : ''}
      </div>
      <button class="checkin-btn ${btnClass}" onclick="handleCheckin('${h.id}')">${btnText}</button>
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

    if (total > 0) {
      html += _renderEncourageRing(doneCount, total);
    }

    // 所有习惯平铺显示，按 nextTime 排序（已排序）
    html += `<div class="time-group">`;
    items.forEach(({h, checked, overdue, soon, nextTime}) => {
      html += _renderHabitCardRow(h, checked, overdue, soon, rec, nextTime);
    });
    html += `</div>`;

    if (items.length === 0) {
      html = '<div style="text-align:center;padding:40px 20px;color:var(--muted);font-size:14px;">还没有添加习惯<br><br>请先到 <strong style="color:var(--accent);cursor:pointer;" onclick="switchTab(\'manage\')">【管理】</strong> 界面添加习惯</div>';
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
            <div class="ranking-rank ${rankClass}">${i+1}</div>
            <div class="ranking-header"><span class="ranking-name">${esc(h.icon)} ${esc(h.name)}</span><span class="ranking-pct">${rate}%</span></div>
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

  function renderAchievements() {
    const container = document.getElementById('achievements');
    if (!container) return;
    var svgFlame = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
    var svgStar = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
    var svgTrophy = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>';

    const badges = [
      {id:'streak7',label:'7天连续',icon:svgFlame,check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 7)},
      {id:'streak14',label:'14天连续',icon:svgFlame,check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 14)},
      {id:'streak30',label:'30天连续',icon:svgStar,check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 30)},
      {id:'all_done',label:'全部完成',icon:svgTrophy,check: () => {
        const rec = checkinRecords[today()] || {};
        return habitsConfig.length > 0 && habitsConfig.every(h => App.Core.Storage.isHabitChecked(h, rec));
      }}
    ];

    container.innerHTML = badges.map(b => {
      const unlocked = b.check();
      return '<div class="badge">' +
        '<div class="badge-icon ' + (unlocked ? 'unlocked' : 'locked') + '">' + b.icon + '</div>' +
        '<div class="badge-label ' + (unlocked ? 'unlocked' : '') + '">' + b.label + '</div>' +
      '</div>';
    }).join('');
  }

  function renderProfile() {
    renderLevelCard();
    renderProfileStats();
    renderConstitutionSummary();
    renderProfileGrid();
  }

  function renderManage() {
    renderManageStats();
    renderManageWeeklyReport();
    renderManageGroups();
    renderAchievements();
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
        <div class="ranking-header"><span class="ranking-name">${esc(h.icon)} ${esc(h.name)}</span><span class="ranking-pct">${rate}%</span></div>
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

/* ===== ui/panels.js ===== */
(function() {
  let pendingCheckinHabitId = null;
  Object.defineProperty(window, 'pendingCheckinHabitId', {
    get: () => pendingCheckinHabitId,
    set: (val) => { pendingCheckinHabitId = val; },
    configurable: true,
    enumerable: true
  });
  let pendingTimeHabitId = null;

  function openPanel(id) {
    const overlay = document.getElementById('panelOverlay');
    if (overlay) overlay.classList.add('show');
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.add('show');
    document.body.style.overflow = 'hidden';
    attachPanelGesture(panel);
    // 注入皮肤目标类名到面板内的新元素
    if (typeof injectSkinTargetClasses === 'function') injectSkinTargetClasses();
  }

  function closeAllPanels() {
    const overlay = document.getElementById('panelOverlay');
    if (overlay) overlay.classList.remove('show');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
    document.body.style.overflow = '';
    pendingCheckinHabitId = null;
    pendingTimeHabitId = null;
  }

  function attachPanelGesture(panel) {
    if (panel._gestureAttached) return;
    panel._gestureAttached = true;

    let startY = 0, startX = 0, currentY = 0;
    let _locked = false;      // 当前手势是否已锁定为"不关闭面板"

    // 检查触摸点是否在可滚动的 panel-body 内，且 body 还未滚动到顶部
    function shouldLockGesture(touchTarget, deltaY) {
      const body = panel.querySelector('.panel-body');
      if (!body) return false;
      // 触摸点不在 panel-body 内（如在 header 上）→ 允许关闭
      if (!body.contains(touchTarget)) return false;
      // panel-body 没有滚动条 → 允许关闭
      if (body.scrollHeight <= body.clientHeight) return false;
      // panel-body 已滚动过 → 锁定（用户还在滚动内容）
      if (body.scrollTop > 0) return true;
      // panel-body 在顶部且是向上滑 → 锁定（用户想继续滚动）
      if (deltaY < 0) return true;
      // panel-body 在顶部且是向下滑 → 允许关闭
      return false;
    }

    const onTouchStart = e => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      currentY = startY;
      _locked = false;
      panel.style.transition = 'none';
    };

    const onTouchMove = e => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      const deltaX = Math.abs(e.touches[0].clientX - startX);
      if (deltaY <= 0 || deltaY <= deltaX) return;

      // 首次检测到有效下滑时决定是否锁定
      if (!_locked) {
        _locked = shouldLockGesture(e.target, deltaY);
      }
      if (_locked) return;

      panel.style.transform = `translateX(-50%) translateY(${deltaY}px)`;
    };

    const onTouchEnd = () => {
      const deltaY = currentY - startY;
      panel.style.transition = 'transform .25s ease';
      if (!_locked && deltaY > 100) {
        panel.style.transform = 'translateX(-50%) translateY(100%)';
        setTimeout(() => {
          closeAllPanels();
          panel.style.transform = '';
        }, 250);
      } else {
        panel.style.transform = '';
      }
      startY = 0;
      _locked = false;
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: true });
    panel.addEventListener('touchend', onTouchEnd);

    // 存储清理函数，避免内存泄漏
    panel._gestureCleanup = () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel._gestureAttached = false;
      panel._gestureCleanup = null;
    };
  }

  function openLibraryPanel() {
    renderLibraryPanel('');
    openPanel('libraryPanel');
  }

  // 局部更新单个习惯卡片状态，避免重新渲染整个面板
  function updateLibCardState(id, added) {
    // 更新分类卡片
    const cards = document.querySelectorAll(`.lib-card[onclick*="'${id}'"]`);
    cards.forEach(card => {
      if (added) {
        card.classList.add('added');
        const nameSpan = card.querySelector('.lib-card-name');
        if (nameSpan && !card.querySelector('.lib-card-added')) {
          card.insertAdjacentHTML('beforeend', '<span class="lib-card-added">✓ 已添加</span>');
        }
      } else {
        card.classList.remove('added');
        const addedSpan = card.querySelector('.lib-card-added');
        if (addedSpan) addedSpan.remove();
      }
    });
    // 更新健康包中的卡片
    const packCards = document.querySelectorAll(`.health-pack-habit[onclick*="'${id}'"]`);
    packCards.forEach(card => {
      if (added) {
        card.classList.add('added');
        const addBtn = card.querySelector('.health-pack-add-btn');
        if (addBtn) addBtn.remove();
        if (!card.querySelector('span[style*="color:var(--accent)"]')) {
          card.insertAdjacentHTML('beforeend', '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>');
        }
      } else {
        card.classList.remove('added');
      }
    });
    // 更新季节包中的卡片
    const seasonCards = document.querySelectorAll(`.season-pack-habit[onclick*="'${id}'"]`);
    seasonCards.forEach(card => {
      if (added) {
        card.classList.add('added');
        const addBtn = card.querySelector('.season-pack-add-btn');
        if (addBtn) addBtn.remove();
        if (!card.querySelector('span[style*="color:var(--accent)"]')) {
          card.insertAdjacentHTML('beforeend', '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>');
        }
      } else {
        card.classList.remove('added');
      }
    });
  }

  function renderLibraryPanel(search) {
    const body = document.getElementById('libraryPanelBody');
    if (!body) return;
    currentLibSearch = search || '';
    const myIds = new Set(habitsConfig.map(h => h.id));

    let html = `<div class="lib-search-row">
      <input class="lib-search" id="libSearchInput" placeholder="搜索习惯..." value="${esc(currentLibSearch)}">
      <button class="lib-search-btn" onclick="toggleCustomForm()">＋ 自定义</button>
    </div>
    <div id="libCustomForm" style="display:none">
      <div class="lib-custom">
        <div class="lib-custom-title">✨ 自定义习惯</div>
        <div class="lib-custom-input">
          <input id="customHabitName" placeholder="习惯名称" maxlength="20">
          <button onclick="addCustomHabit()">添加</button>
        </div>
        <div class="lib-custom-type" id="customTypeSelector">
          <button class="active" data-type="boolean" onclick="selectCustomType(this)">打卡</button>
          <button data-type="count" onclick="selectCustomType(this)">计数</button>
          <button data-type="timer" onclick="selectCustomType(this)">计时</button>
        </div>
        <div id="customUnitWrap" style="display:none;margin-top:8px">
          <input id="customHabitUnit" placeholder="单位（如：杯、个、分钟）" style="width:100%;padding:10px 14px;border:2px solid var(--rule);border-radius:12px;font-size:14px;background:#fff;outline:none">
        </div>
        <div class="lib-custom-time">
          <label>⏰ 打卡时间</label>
          <input type="time" id="customHabitTime" value="08:00">
        </div>
        <div class="lib-custom-reminders" id="customRemindersWrap">
          <div class="lib-custom-reminders-label">🔔 额外提醒</div>
          <div class="lib-custom-reminders-list" id="customRemindersList"></div>
          <button class="lib-custom-reminder-add" onclick="addCustomReminderTime()">+ 添加提醒</button>
        </div>
        <div class="lib-custom-freq">
          <div class="lib-custom-freq-label">📅 每周频率</div>
          <div class="weekdays" id="customWeekdays">
            ${['日','一','二','三','四','五','六'].map((d,i) => `<button class="active" data-day="${i}" onclick="toggleCustomWeekday(this)">${d}</button>`).join('')}
          </div>
        </div>
        <div class="lib-custom-note">
          <label>📝 备注说明</label>
          <input id="customHabitNote" placeholder="习惯说明（选填）" maxlength="100">
        </div>
        <div class="lib-icon-picker">
          <div class="lib-icon-picker-label">🎨 选择图标 <span id="customIconPreview" class="selected-icon">✅</span></div>
          <div class="preset-icons" id="customIconGrid">
            ${CUSTOM_ICONS.map(ic => `<span data-icon="${esc(ic)}" onclick="selectCustomIcon(this, '${esc(ic)}')" class="${ic === '✅' ? 'selected' : ''}">${esc(ic)}</span>`).join('')}
          </div>
          <input type="hidden" id="customHabitIcon" value="✅">
        </div>
      </div>
    </div>`;

    // 搜索结果区：仅此容器随输入刷新，搜索框/自定义表单/推荐包不再被重建
    html += `<div id="libResults"></div>`;

    // 健康生活建议包
    const packHabits = HEALTH_PACK.habits;
    const packAddedCount = packHabits.filter(ph => myIds.has(ph.id)).length;
    const packAllAdded = packAddedCount === packHabits.length;

    html += `
      <div class="health-pack" id="healthPack">
        <div class="health-pack-header" onclick="toggleHealthPack()">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span style="font-size:28px">💚</span>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--ink)">健康生活建议包</div>
              <div style="font-size:12px;color:var(--muted)">${HEALTH_PACK.description}</div>
            </div>
          </div>
          <span class="health-pack-arrow">▼</span>
        </div>
        <div class="health-pack-body" id="healthPackBody" style="display:none">
          <div class="health-pack-habits">`;
    packHabits.forEach(ph => {
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      const added = myIds.has(ph.id);
      html += `
            <div class="health-pack-habit ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${ph.id}')">
              <span>${lib ? lib.icon : '📌'}</span>
              <span>${lib ? lib.name : ph.id}</span>
              <span style="font-size:11px;color:var(--muted)">${ph.reminder.time}</span>
              ${added ? '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>' : '<span class="health-pack-add-btn">+</span>'}
            </div>`;
    });
    html += `
          </div>
        </div>
        <div class="health-pack-footer">
          <span style="font-size:13px;color:var(--muted)">${packAllAdded ? '✅ 已全部添加' : `已添加 ${packAddedCount}/${packHabits.length} 个习惯`}</span>
          <span class="health-pack-btn ${packAllAdded ? 'added' : ''}" onclick="addHealthPack()">${packAllAdded ? '已添加' : '一键添加'}</span>
        </div>
      </div>
    `;

    // ========== 黄帝内经养生包（顶层容器） ==========
    const currentSeason = getCurrentSeason();
    const seasonOrder = ['spring','summer','autumn','winter'];
    
    html += `
      <div class="neijing-pack" id="neijingPack">
        <div class="neijing-pack-master-header" onclick="toggleNeijingMaster()">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span class="neijing-pack-master-icon">🏛️</span>
            <div>
              <div class="neijing-pack-master-title">${esc(NEIJING_PACK.name)}</div>
              <div class="neijing-pack-master-desc">${NEIJING_PACK.description}</div>
            </div>
          </div>
          <span class="neijing-pack-master-arrow" id="neijingMasterArrow">▼</span>
        </div>
        <div class="neijing-pack-body" id="neijingPackBody" style="display:none">`;
    
    // ---- 子包1: 四季养生 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_seasonal">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('seasonal')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">🌿</span>
                <div>
                  <div style="font-size:14px;font-weight:700">四季养生</div>
                  <div style="font-size:11px;color:var(--muted)">《四气调神大论》春生夏长秋收冬藏</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_seasonal">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_seasonal" style="display:none">`;
    
    seasonOrder.forEach(key => {
      const pack = SEASONAL_PACKS[key];
      const isCurrent = key === currentSeason;
      const packAddedCount = pack.habits.filter(ph => myIds.has(ph.id)).length;
      const packAllAdded = packAddedCount === pack.habits.length;
      
      html += `
              <div class="season-pack-card ${isCurrent ? 'current' : 'other'}" id="seasonPack_${key}">
                <div class="season-pack-header" onclick="toggleSeasonPack('${key}')">
                  <span class="season-pack-icon">${pack.emoji}</span>
                  <div>
                    <div class="season-pack-title">${esc(pack.name)} ${isCurrent ? '<span style="font-size:11px;color:var(--accent);font-weight:600">当前季节</span>' : ''}</div>
                    <div class="season-pack-subtitle">重点：${pack.focus} · ${pack.habits.length}个习惯</div>
                  </div>
                  <span class="season-pack-arrow">▼</span>
                </div>
                <div class="season-pack-quote">${pack.quote}</div>
                <div class="season-pack-body" id="seasonPackBody_${key}" style="display:none">
                  <div class="season-pack-habits">`;
      pack.habits.forEach(ph => {
        const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
        const added = myIds.has(ph.id);
        html += `
                    <div class="season-pack-habit ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${ph.id}')">
                      <span>${lib ? lib.icon : '📌'}</span>
                      <span>${lib ? lib.name : ph.id}</span>
                      <span style="font-size:11px;color:var(--muted)">${ph.reminder.time}</span>
                      ${added ? '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>' : '<span class="season-pack-add-btn">+</span>'}
                    </div>`;
      });
      html += `
                  </div>
                </div>
                <div class="season-pack-footer">
                  <span class="season-pack-count">${packAllAdded ? '✅ 已全部添加' : `已添加 ${packAddedCount}/${pack.habits.length}`}</span>
                  <span class="season-pack-btn ${packAllAdded ? 'added' : ''}" onclick="event.stopPropagation();addSeasonalPack('${key}')">${packAllAdded ? '已添加' : '一键添加'}</span>
                </div>
              </div>`;
    });
    
    html += `
            </div>
          </div>`;
    
    // ---- 子包2: 五色饮食 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_wuse">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('wuse')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">🍽️</span>
                <div>
                  <div style="font-size:14px;font-weight:700">五色饮食</div>
                  <div style="font-size:11px;color:var(--muted)">《藏气法时论》五色入五脏，饮食有节</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_wuse">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_wuse" style="display:none">
              <div class="wuse-grid">`;
    
    NEIJING_PACK.subPacks.find(sp => sp.id === 'wuse').content.forEach(wc => {
      const habitsHtml = wc.habits.map(hid => {
        const lib = HABIT_LIBRARY.find(h => h.id === hid);
        return lib ? `<span style="cursor:pointer;color:var(--accent);font-weight:600" onclick="addHabitFromLib('${hid}')">${esc(lib.icon)} ${esc(lib.name)}</span>` : '';
      }).join(' · ');
      html += `
                <div class="wuse-card">
                  <div class="wuse-card-icon">${wc.emoji}</div>
                  <div class="wuse-card-title">${wc.color}色入${wc.organ} · 味${wc.flavor}</div>
                  <div class="wuse-card-effect">${wc.effect}</div>
                  <div class="wuse-card-foods"><strong>宜食：</strong>${wc.foods}</div>
                  <div class="wuse-card-tip">${esc(wc.tip)}</div>
                  <div class="wuse-card-habits">${habitsHtml}</div>
                </div>`;
    });
    
    html += `
              </div>
            </div>
          </div>`;
    
    // ---- 子包3: 情志养生 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_emotion">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('emotion')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">🧘</span>
                <div>
                  <div style="font-size:14px;font-weight:700">情志养生</div>
                  <div style="font-size:11px;color:var(--muted)">《阴阳应象大论》五志相胜，以情胜情</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_emotion">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_emotion" style="display:none">
              <div class="emotion-mini-grid">`;
    
    EMOTION_DATA.forEach(emo => {
      html += `
                <div class="emotion-mini-card" onclick="openEmotionPanel();setTimeout(()=>selectEmotion('${emo.id}'),400)">
                  <div class="emotion-mini-emoji">${emo.emoji}</div>
                  <div class="emotion-mini-name">${esc(emo.name)}</div>
                  <div class="emotion-mini-relation">伤${emo.organ} · ${emo.cureEmoji}${emo.cure}胜</div>
                </div>`;
    });
    
    html += `
              </div>
              <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--accent);cursor:pointer;font-weight:600" onclick="openEmotionPanel()">📋 进入情志管理 →</div>
            </div>
          </div>`;
    
    // ---- 子包4: 五劳防护 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_wulao">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('wulao')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">💪</span>
                <div>
                  <div style="font-size:14px;font-weight:700">五劳防护</div>
                  <div style="font-size:11px;color:var(--muted)">《宣明五气篇》五劳所伤，日常防护</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_wulao">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_wulao" style="display:none">`;
    
    WULAO_DATA.forEach(wl => {
      html += `
              <div class="wulao-mini-card">
                <div class="wulao-mini-icon">${wl.emoji}</div>
                <div class="wulao-mini-info">
                  <div class="wulao-mini-name">${esc(wl.name)} · 伤${wl.organ}</div>
                  <div class="wulao-mini-scene">💼 ${wl.scene}</div>
                  <div class="wulao-mini-action">✅ ${wl.action}：${esc(wl.tip)}</div>
                </div>
              </div>`;
    });
    
    html += `
              <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--accent);cursor:pointer;font-weight:600" onclick="openWulaoPanel()">📋 查看五劳详情 →</div>
            </div>
          </div>`;
    
    // 关闭黄帝内经包
    html += `
        </div>
      </div>`;

    body.innerHTML = html;
    renderLibraryResults(currentLibSearch);
    bindLibrarySearch();
  }

  // 当前搜索关键词（面板级，避免整面板重渲染时丢失）
  let currentLibSearch = '';

  // 仅刷新搜索结果区，搜索框/自定义表单/推荐包保持原 DOM，不重建
  function renderLibraryResults(search) {
    const container = document.getElementById('libResults');
    if (!container) return;
    const myIds = new Set(habitsConfig.map(h => h.id));
    const q = (search || '').toLowerCase();

    const categories = ['sport','diet','study','sleep','mind','protect','care','home','social','hobby','quit'];
    const catData = [];
    categories.forEach(cat => {
      let items = HABIT_LIBRARY.filter(h => h.category === cat);
      if (q) items = items.filter(h => h.name.toLowerCase().includes(q));
      if (items.length > 0) catData.push({cat, info: CATEGORY_MAP[cat], items});
    });

    let html = '';
    if (catData.length > 0) {
      html += `<div class="lib-tabs" id="libTabs">`;
      catData.forEach((cd, idx) => {
        html += `<button class="lib-tab ${idx === 0 ? 'active' : ''}" data-cat="${cd.cat}" onclick="filterLibCategory('${cd.cat}', this)">${cd.info.emoji} ${cd.info.label}</button>`;
      });
      html += `</div>`;
    } else if (q) {
      html += `<div class="lib-empty">😶 没有找到与「${esc(search)}」相关的习惯</div>`;
    }

    catData.forEach((cd, idx) => {
      html += `<div class="lib-grid" id="libGrid_${cd.cat}" style="${idx !== 0 ? 'display:none' : ''}">`;
      cd.items.forEach(h => {
        const added = myIds.has(h.id);
        html += `
          <div class="lib-card ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${h.id}')">
            <span class="lib-card-icon">${esc(h.icon)}</span>
            <span class="lib-card-name">${esc(h.name)}</span>
            ${h.tip ? `<span class="lib-card-tip">${esc(h.tip)}</span>` : ''}
            ${added ? '<span class="lib-card-added">✓ 已添加</span>' : ''}
          </div>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;
  }

  // 绑定搜索输入：220ms 防抖 + 忽略中文输入法组合期，避免打断拼音输入
  function bindLibrarySearch() {
    const input = document.getElementById('libSearchInput');
    if (!input) return;
    let timer = null;
    const run = () => { currentLibSearch = input.value; renderLibraryResults(currentLibSearch); };
    input.addEventListener('input', (e) => {
      if (e.isComposing || input.composing) return; // 输入法组合中，暂不刷新
      clearTimeout(timer);
      timer = setTimeout(run, 220);
    });
    input.addEventListener('compositionend', () => { clearTimeout(timer); run(); });
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

  function openRefPanel(e) {
    if (e) e.stopPropagation();
    renderRefPanel();
    openPanel('refPanel');
  }

  function renderRefPanel() {
    const body = document.getElementById('refPanelBody');
    const ancient = REF_BOOKS.filter(b => b.type === 'ancient');
    const modern = REF_BOOKS.filter(b => b.type === 'modern');

    let html = `
      <div class="ref-panel-header">
        <h3>📚 18部养生经典</h3>
        <p>汇集先秦至现代养生著作，点击查看详情</p>
      </div>
      <div class="ref-tabs">
        <div class="ref-tab active" id="refTabAncient" onclick="switchRefTab('ancient')">🏛️ 经典古籍（${ancient.length}部）</div>
        <div class="ref-tab" id="refTabModern" onclick="switchRefTab('modern')">📖 现代著作（${modern.length}部）</div>
      </div>
      <div id="refListAncient">`;

    ancient.forEach(b => {
      html += `<a class="ref-card" href="${b.url}" target="_blank" rel="noopener">
        <div class="ref-icon ancient">${b.emoji}</div>
        <div class="ref-info">
          <div class="ref-name">${esc(b.name)}</div>
          <div class="ref-author">${b.author} · ${b.desc}</div>
        </div>
        <div class="ref-arrow">›</div>
      </a>`;
    });

    html += `</div><div id="refListModern" style="display:none">`;
    modern.forEach(b => {
      html += `<a class="ref-card" href="${b.url}" target="_blank" rel="noopener">
        <div class="ref-icon modern">${b.emoji}</div>
        <div class="ref-info">
          <div class="ref-name">${esc(b.name)}</div>
          <div class="ref-author">${b.author} · ${b.desc}</div>
        </div>
        <div class="ref-arrow">›</div>
      </a>`;
    });

    html += `</div><a class="ref-lib-btn" href="references/养生参考文献文库/index.html" target="_blank" rel="noopener">📖 进入参考文献文库</a>`;

    body.innerHTML = html;
  }

  function switchRefTab(tab) {
    document.getElementById('refTabAncient').classList.toggle('active', tab === 'ancient');
    document.getElementById('refTabModern').classList.toggle('active', tab === 'modern');
    document.getElementById('refListAncient').style.display = tab === 'ancient' ? '' : 'none';
    document.getElementById('refListModern').style.display = tab === 'modern' ? '' : 'none';
  }

  function openEmotionPanel() {
    renderEmotionPanel();
    openPanel('emotionPanel');
  }

  function renderEmotionPanel() {
    const body = document.getElementById('emotionPanelBody');
    const todayRec = checkinRecords[today()] || {};
    const emotionRec = todayRec['emotion_check'];
    let selected = null;
    if (emotionRec && emotionRec.value) {
      const map = {'怒':'anger','喜':'joy','思':'thinking','悲':'sorrow','恐':'fear'};
      selected = EMOTION_DATA.find(e => e.id === map[emotionRec.value]);
    }

    let html = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;text-align:center">《素问·阴阳应象大论》：怒伤肝，悲胜怒；喜伤心，恐胜喜...</div>
      <div class="emotion-grid">
    `;

    EMOTION_DATA.forEach(emo => {
      const isSel = selected && selected.id === emo.id;
      html += `<div class="emotion-btn ${isSel ? 'active' : ''}" onclick="selectEmotion('${emo.id}')">
        <span class="emo-icon">${emo.emoji}</span>
        <span class="emo-label">${esc(emo.name)}</span>
      </div>`;
    });

    html += '</div>';

    if (selected) {
      html += `
        <div class="emotion-current">
          <div class="emo">${selected.emoji}</div>
          <div class="emo-name">今日情绪：${esc(selected.name)}</div>
          <div class="emo-organ">伤及脏腑：${selected.organ} · 气机变化：${selected.damage}</div>
          <div class="emo-quote">"${selected.quote}"</div>
        </div>
        <div class="emotion-cure">
          <div class="cure-title">💡 调节建议（情志相胜）</div>
          <div class="cure-text">
            <strong>方法：</strong>以${selected.cureEmoji}${selected.cure}胜${esc(selected.name)}<br>
            <strong>实践：</strong>${selected.cureDesc}<br>
            <strong>原文：</strong>《素问·阴阳应象大论》"${selected.quote}"
          </div>
        </div>
      `;
    } else {
      html += `<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">👆 点击上方情绪图标记录今日心情</div>`;
    }

    body.innerHTML = html;
  }

  function selectEmotion(emotionId) {
    const emo = EMOTION_DATA.find(e => e.id === emotionId);
    if (!emo) return;
    const todayStr = today();
    if (!checkinRecords[todayStr]) checkinRecords[todayStr] = {};
    checkinRecords[todayStr]['emotion_check'] = {value: emo.name, timestamp: Date.now()};
    saveRecords();
    renderEmotionPanel();
    render();
  }

  function openClockPanel() {
    const body = document.getElementById('clockPanelBody');
    const current = getCurrentShichen();

    let html = '<div style="padding:10px 0">';
    html += '<div style="text-align:center;margin-bottom:16px">';
    html += '<div style="font-size:32px;margin-bottom:4px">' + current.icon + '</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--ink)">' + current.name + ' · ' + current.meridian + '</div>';
    html += '<div style="font-size:13px;color:var(--accent);font-weight:600;margin-top:4px">' + current.action + '</div>';
    html += '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + current.detail + '</div>';
    html += '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    BODY_CLOCK.forEach(function(sc) {
      var isActive = sc.id === current.id;
      var endLabel = sc.end === 0 ? 24 : sc.end;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:' + (isActive ? 'var(--accent-light)' : 'var(--bg2)') + ';border:2px solid ' + (isActive ? 'var(--accent)' : 'transparent') + '">';
      html += '<div style="width:36px;text-align:center;font-size:20px">' + sc.icon + '</div>';
      html += '<div style="flex:1">';
      html += '<div style="font-size:13px;font-weight:700;color:' + (isActive ? 'var(--accent)' : 'var(--ink)') + '">' + sc.name + ' ' + sc.start + '-' + endLabel + '时 · ' + sc.meridian + '</div>';
      html += '<div style="font-size:11px;color:var(--muted)">' + sc.action + '</div>';
      html += '</div>';
      if (isActive) html += '<div style="font-size:11px;font-weight:700;background:var(--accent);color:#fff;padding:2px 8px;border-radius:8px">当前</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:12px">依据《黄帝内经》子午流注理论 · 十二时辰养生</div>';
    html += '</div>';

    body.innerHTML = html;
    openPanel('clockPanel');
  }

  function openWulaoPanel() {
    renderWulaoPanel();
    openPanel('wulaoPanel');
  }

  function openDietPanel() {
    const body = document.getElementById('dietPanelBody');
    if (body) {
      if (App.Modules.Diet) {
        body.innerHTML = App.Modules.Diet.renderDietPanel();
        openPanel('dietPanel');
      } else {
        body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">⏳ 加载饮食模块...</div>';
        LazyLoad('js/modules/diet.js', function() {
          if (App.Modules.Diet) body.innerHTML = App.Modules.Diet.renderDietPanel();
          openPanel('dietPanel');
        });
      }
    } else {
      openPanel('dietPanel');
    }
  }

  function openSportsPanel() {
    const body = document.getElementById('sportsPanelBody');
    if (body) {
      if (App.Modules.Sports) {
        body.innerHTML = App.Modules.Sports.renderSportsPanel();
        openPanel('sportsPanel');
      } else {
        body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">⏳ 加载运动模块...</div>';
        LazyLoad('js/modules/sports.js', function() {
          if (App.Modules.Sports) body.innerHTML = App.Modules.Sports.renderSportsPanel();
          openPanel('sportsPanel');
        });
      }
    } else {
      openPanel('sportsPanel');
    }
  }

  /* ========== 皮肤面板 ========== */
  const SKIN_CATEGORIES = [
    {
      id: 'theme',
      label: '主题',
      emoji: '🎨',
      items: [
        { id:'default', name:'竹青', emoji:'🌿', vars:{accent:'#5BB98A',accent2:'#FF9F67','accent-light':'#D4F0E4','accent2-light':'#FFE2CC',bg:'#FFFCF7',bg2:'#F7F3ED'} },
        { id:'ocean', name:'海蓝', emoji:'🌊', vars:{accent:'#4A90D9',accent2:'#48C9B0','accent-light':'#D6EAF8','accent2-light':'#D1F2EB',bg:'#F5F9FC',bg2:'#EBF2F8'} },
        { id:'rose', name:'桃粉', emoji:'🌸', vars:{accent:'#E07B8C',accent2:'#D4A0B5','accent-light':'#FADBD8','accent2-light':'#F5EEF8',bg:'#FFF5F7',bg2:'#FEF0F3'} },
        { id:'sunset', name:'暖橘', emoji:'🌅', vars:{accent:'#E8913A',accent2:'#E05A4B','accent-light':'#FDEBD0','accent2-light':'#FADBD8',bg:'#FFFBF5',bg2:'#FFF3E6'} },
        { id:'modern', name:'现代简约', emoji:'✨', vars:{accent:'#10B981',accent2:'#F59E0B','accent-light':'#D1FAE5','accent2-light':'#FEF3C7',bg:'#F8FAFC',bg2:'#F1F5F9'} },
        { id:'zhongshi', name:'中式养生', emoji:'🍵', vars:{accent:'#7CB69D',accent2:'#C8893E','accent-light':'#DCEDE2','accent2-light':'#FAE6CC',bg:'#FDF8F0',bg2:'#F5EFE3'} },
      ]
    },
    {
      id: 'button',
      label: '按钮',
      emoji: '🔘',
      items: [
{ id:'btn-default', name:'圆角渐变', emoji:'🟢', style:{'btn-style':'default'} },
        { id:'btn-pill', name:'胶囊', emoji:'💊', style:{'btn-style':'pill'} },
        { id:'btn-3d', name:'3D立体', emoji:'📦', style:{'btn-style':'3d'} },
      ]
    },
    {
      id: 'checkbox',
      label: '复选框',
      emoji: '☑️',
      items: [
        { id:'cb-default', name:'圆角', emoji:'✅', style:{'cb-style':'default'} },
        { id:'cb-round', name:'圆形', emoji:'⭕', style:{'cb-style':'round'} },
      ]
    },
    {
      id: 'toggle',
      label: '开关',
      emoji: '🎚️',
      items: [
        { id:'tg-default', name:'标准', emoji:'🔘', style:{'tg-style':'default'} },
        { id:'tg-daynight', name:'日夜切换', emoji:'🌓', style:{'tg-style':'daynight'} },
      ]
    },
    {
      id: 'card',
      label: '卡片',
      emoji: '🃏',
      items: [
        { id:'cd-glass', name:'毛玻璃', emoji:'✨', style:{'cd-style':'glass'} },
        { id:'cd-gradient', name:'渐变边框', emoji:'🌈', style:{'cd-style':'gradient'} },
      ]
    },
    {
      id: 'input',
      label: '输入框',
      emoji: '📝',
      items: [
        { id:'in-glass', name:'毛玻璃', emoji:'✨', style:{'in-style':'glass'} },
        { id:'in-underline', name:'下划线', emoji:'📏', style:{'in-style':'underline'} },
      ]
    },
    {
      id: 'badge',
      label: '徽章',
      emoji: '🏷️',
      items: [
        { id:'bd-pill', name:'药丸', emoji:'💊', style:{'bd-style':'pill'} },
        { id:'bd-gradient', name:'渐变', emoji:'🌈', style:{'bd-style':'gradient'} },
      ]
    },
  ];

  // 默认皮肤样式（用于重置）
  const SKIN_DEFAULTS = {
    'btn-radius': '14px',
    'btn-shadow': '0 2px 8px rgba(0,0,0,.08)',
    'cb-radius': '4px',
    'cb-border': '2px solid var(--accent)',
    'rb-radius': '50%',
    'rb-border': '2px solid var(--rule)',
    'rb-dot-size': '12px',
    'rb-size': '22px',
  };

  /**
   * 初始化所有皮肤设置（主题 + 组件样式）
   * 应在页面启动时调用
   */
  function initAllSkins() {
    const root = document.documentElement;
    const body = document.body;
    const prefixesToClear = ['btn-', 'cb-', 'tg-', 'cd-', 'in-', 'bd-'];
    prefixesToClear.forEach(prefix => {
      [...body.classList].forEach(cls => {
        if (cls.startsWith(prefix)) body.classList.remove(cls);
      });
    });
    const skinId = getCurrentSkin();
    applySkin(skinId);
    SKIN_CATEGORIES.forEach(cat => {
      if (cat.id === 'theme') return;
      const saved = localStorage.getItem('skin_' + cat.id);
      const defaultItem = cat.items[0];
      const item = saved ? cat.items.find(i => i.id === saved) || defaultItem : defaultItem;
      if (item && item.style) {
        for (const [key, val] of Object.entries(item.style)) {
          if (key.endsWith('-style')) {
            const prefix = key.replace('-style', '');
            body.classList.add(prefix + '-' + val);
          } else {
            root.style.setProperty('--' + key, val);
          }
        }
      }
    });
  }

  // 扁平化所有皮肤项（主题类），供 applySkin 查找
  const SKINS = SKIN_CATEGORIES.find(c => c.id === 'theme').items;

  function getCurrentSkin() {
    const saved = localStorage.getItem('app_skin');
    return saved || 'default';
  }

  function applySkin(skinId) {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin) return;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(skin.vars)) {
      root.style.setProperty('--' + key, val);
    }
    localStorage.setItem('app_skin', skinId);
    // 主题 body class 切换（现代简约 / 中式养生）
    document.body.classList.toggle('theme-modern', skinId === 'modern');
    document.body.classList.toggle('theme-zhongshi', skinId === 'zhongshi');
    // 更新选中态
    document.querySelectorAll('.skin-toggle-row').forEach(el => {
      el.classList.toggle('active', el.querySelector('input')?.checked);
    });
  }

  function applyComponentStyle(catId, itemId) {
    const cat = SKIN_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;
    const root = document.documentElement;
    const body = document.body;
    const prefixMap = {
      button: 'btn-',
      checkbox: 'cb-',
      toggle: 'tg-',
      card: 'cd-',
      input: 'in-',
      badge: 'bd-'
    };
    const prefix = prefixMap[catId];
    if (prefix) {
      [...body.classList].forEach(cls => {
        if (cls.startsWith(prefix)) body.classList.remove(cls);
      });
    }
    for (const [key, val] of Object.entries(item.style || {})) {
      if (key.endsWith('-style') && prefix) {
        body.classList.add(prefix + val);
      } else {
        root.style.setProperty('--' + key, val);
      }
    }
    localStorage.setItem('skin_' + catId, itemId);
    // 更新该分类下的选中态
    document.querySelectorAll('.skin-toggle-row').forEach(el => {
      const input = el.querySelector('input');
      if (input && input.name === 'skin_' + catId) {
        el.classList.toggle('active', input.checked);
      }
    });
    if (typeof renderLevelCard === 'function') renderLevelCard();
  }

  function getCurrentComponentStyle(catId) {
    const saved = localStorage.getItem('skin_' + catId);
    const cat = SKIN_CATEGORIES.find(c => c.id === catId);
    if (!cat) return null;
    const def = cat.items[0];
    return saved ? (cat.items.find(i => i.id === saved) || def) : def;
  }

  let currentSkinTab = 'theme';

  function openSkinPanel() {
    const panel = document.getElementById('skinPanel');
    if (panel) {
      const body = panel.querySelector('.panel-body');
      if (body) {
        renderSkinPanel(body);
      }
    }
    openPanel('skinPanel');
  }

  function renderSkinPanel(body) {
    const cat = SKIN_CATEGORIES.find(c => c.id === currentSkinTab);
    if (!cat) return;

    let html = `
      <div style="font-size:16px;font-weight:700;margin-bottom:16px;text-align:center">🎨 皮肤设置</div>
      <div class="skin-tabs">`;
    SKIN_CATEGORIES.forEach((c, idx) => {
      html += `<button class="skin-tab ${c.id === currentSkinTab ? 'active' : ''}" onclick="App.UI.Panels.switchSkinTab('${c.id}')">${c.emoji} ${c.label}</button>`;
    });
    html += `</div>
      <div class="skin-toggle-list" id="skinCat_${cat.id}">`;

    if (cat.id === 'theme') {
      const current = getCurrentSkin();
      cat.items.forEach(s => {
        const isActive = s.id === current;
        html += `
          <div class="skin-toggle-row ${isActive ? 'active' : ''}">
            <div class="skin-toggle-info">
              <div class="skin-toggle-preview" style="background:linear-gradient(135deg,${s.vars.accent},${s.vars.accent2})">
                <div class="skin-toggle-swatch" style="background:${s.vars.bg}"></div>
              </div>
              <span class="skin-toggle-name">${s.emoji} ${esc(s.name)}</span>
            </div>
            <label class="theme-toggle" for="skinToggle_${s.id}">
              <input class="theme-checkbox" type="radio" name="skin_theme" id="skinToggle_${s.id}" ${isActive ? 'checked' : ''} onchange="App.UI.Panels.selectSkin('${s.id}')">
              <span class="theme-slider"></span>
            </label>
          </div>`;
      });
    } else {
      const currentItem = getCurrentComponentStyle(cat.id);
      cat.items.forEach(s => {
        const isActive = currentItem && currentItem.id === s.id;
        html += `
          <div class="skin-toggle-row ${isActive ? 'active' : ''}">
            <div class="skin-toggle-info">
              <span class="skin-toggle-name">${s.emoji} ${esc(s.name)}</span>
            </div>
            <label class="theme-toggle" for="skinComp_${s.id}">
              <input class="theme-checkbox" type="radio" name="skin_${cat.id}" id="skinComp_${s.id}" ${isActive ? 'checked' : ''} onchange="App.UI.Panels.selectComponentStyle('${cat.id}','${s.id}')">
              <span class="theme-slider"></span>
            </label>
          </div>`;
      });
    }

    html += `</div>`;
    body.innerHTML = html;
  }

  function switchSkinTab(tabId) {
    currentSkinTab = tabId;
    const body = document.getElementById('skinPanel').querySelector('.panel-body');
    if (body) renderSkinPanel(body);
  }

  function selectSkin(skinId) {
    applySkin(skinId);
    if (typeof renderLevelCard === 'function') renderLevelCard();
  }

  function selectComponentStyle(catId, itemId) {
    applyComponentStyle(catId, itemId);
  }

  function toggleGroup(period) {
    const group = document.getElementById('group-' + period);
    if (!group) return;
    group.classList.toggle('collapsed-group');
    const cards = group.querySelectorAll('.habit-card, .water-tracker');
    cards.forEach(card => {
      if (card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
      } else {
        card.classList.add('collapsed');
      }
    });
  }

  function renderWulaoPanel() {
    const body = document.getElementById('wulaoPanelBody');

    let html = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;text-align:center">《素问·宣明五气篇》：久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋</div>
    `;

    WULAO_DATA.forEach(wl => {
      html += `
        <div class="wulao-card">
          <div class="wl-icon">${wl.emoji}</div>
          <div class="wl-info">
            <div class="wl-name">${esc(wl.name)} · 伤${wl.organ}</div>
            <div class="wl-scene">💼 现代场景：${wl.scene}</div>
            <div class="wl-action">✅ 防护动作：${wl.action}</div>
            <div class="wl-tip">💡 ${esc(wl.tip)}</div>
          </div>
        </div>
      `;
    });

    html += `<div style="margin-top:14px;font-size:12px;color:var(--muted);text-align:center">依据《黄帝内经》五劳所伤理论 · 日常防护</div>`;
    body.innerHTML = html;
  }

  function openHealthReportPanel() {
    renderHealthReport();
    openPanel('healthReportPanel');
  }

  function renderHealthReport() {
    const body = document.getElementById('healthReportPanelBody');
    let html = '<div style="padding:10px 0">';
    html += '<div style="text-align:center;margin-bottom:16px"><div style="font-size:28px;margin-bottom:8px">📋</div><div style="font-size:20px;font-weight:800">健康报告</div></div>';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:10px">选择报告类型</div>';
    html += `<div style="display:flex;gap:10px;margin-bottom:20px">
      <button class="const-btn" style="flex:1" onclick="App.UI.Render.openStatsDetailPanel();setTimeout(()=>App.UI.Render.switchStatsPeriod('month',document.querySelector('.sd-tab[data-period=month]')),100)">📅 月度报告</button>
      <button class="const-btn" style="flex:1" onclick="App.UI.Render.openStatsDetailPanel();setTimeout(()=>App.UI.Render.switchStatsPeriod('year',document.querySelector('.sd-tab[data-period=year]')),100)">📆 年度报告</button>
    </div>`;

    if (App.Modules && App.Modules.Recommendation) {
      const report = App.Modules.Recommendation.generateHealthReport('week');
      html += renderPersonalizedReportCard(report);
    }

    html += '</div>';
    body.innerHTML = html;
  }

  function renderPersonalizedReportCard(report) {
    let html = '<div style="margin-bottom:20px">';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:10px">🎯 个性化周报</div>';
    html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:15px;font-weight:700">本周完成率</div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">${report.overallRate}%</div>
      </div>
      <div style="width:100%;height:8px;background:var(--rule);border-radius:4px;overflow:hidden">
        <div style="width:${report.overallRate}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:4px;transition:width .6s"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;text-align:right">${report.trendText}</div>
    </div>`;

    if (report.bestCategory || report.worstCategory) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
      if (report.bestCategory) {
        html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">最佳分类</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">${report.bestCategory.icon} ${report.bestCategory.name}</div>
          <div style="font-size:16px;font-weight:800;color:var(--accent)">${report.bestCategory.rate}%</div>
        </div>`;
      }
      if (report.worstCategory) {
        html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">待加强</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">${report.worstCategory.icon} ${report.worstCategory.name}</div>
          <div style="font-size:16px;font-weight:800;color:#E07A5F">${report.worstCategory.rate}%</div>
        </div>`;
      }
      html += '</div>';
    }

    if (report.constInfo) {
      html += `<div style="background:linear-gradient(135deg,${report.constInfo.color || '#7CB69D'}15,transparent);border:1px solid var(--rule);border-radius:12px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">🧬 你的体质</div>
        <div style="font-size:14px;font-weight:700;color:${report.constInfo.color || '#7CB69D'};margin-bottom:4px">${report.constInfo.emoji} ${report.constInfo.name}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">${report.constInfo.advice}</div>
      </div>`;
    }

    if (report.seasonInfo) {
      html += `<div style="background:linear-gradient(135deg,${report.seasonInfo.color || '#7CB69D'}15,transparent);border:1px solid var(--rule);border-radius:12px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">🌿 当季养生重点</div>
        <div style="font-size:14px;font-weight:700;color:${report.seasonInfo.color || '#7CB69D'};margin-bottom:4px">${report.seasonInfo.name}季养${report.seasonInfo.organ}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">${report.seasonInfo.principle}</div>
      </div>`;
    }

    if (report.recommendations && report.recommendations.length > 0) {
      html += '<div style="font-size:14px;font-weight:700;margin:16px 0 10px">💡 为你推荐</div>';
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      report.recommendations.forEach((rec, idx) => {
        html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="font-size:28px">${rec.icon}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700">${rec.name}</div>
              <div style="font-size:11px;color:var(--muted)">${rec.categoryIcon} ${rec.categoryName}</div>
            </div>
            <div style="font-size:10px;padding:2px 8px;background:var(--accent-light);color:var(--accent);border-radius:10px;font-weight:600">推荐</div>
          </div>
          <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:10px">${rec.tip}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
            ${rec.reasons.map(r => `<span style="font-size:10px;padding:2px 8px;background:var(--bg);border:1px solid var(--rule);border-radius:8px">${r}</span>`).join('')}
          </div>
          ${rec.alreadyHas
            ? `<button class="const-btn" style="width:100%;padding:8px;font-size:13px;background:var(--muted);color:#fff">✓ 已添加，继续保持</button>`
            : `<button class="const-btn" style="width:100%;padding:8px;font-size:13px" onclick="App.UI.Events.addHabitFromLib('${rec.id}');setTimeout(function(){ if (App.UI.Panels.renderHealthReport) App.UI.Panels.renderHealthReport(); }, 200)">＋ 添加到习惯</button>`
          }
        </div>`;
      });
      html += '</div>';
    }

    if (report.waterStats) {
      html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px;margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700">💧 饮水达标</div>
          <div style="font-size:14px;font-weight:800;color:#5B8DB8">${Math.round(report.waterStats.reachRate * 100)}%</div>
        </div>
        <div style="font-size:11px;color:var(--muted)">近7天平均 ${report.waterStats.avgAmount}ml / 目标 ${report.waterStats.goal}ml</div>
      </div>`;
    }

    html += '</div>';
    return html;
  }

  function openDataPanel() {
    openPanel('dataPanel');
  }

  function openRetroactivePanel(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    pendingCheckinHabitId = habitId;
    const body = document.getElementById('retroactivePanelBody');
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDate(d);
      const dayNames = ['日','一','二','三','四','五','六'];
      const label = i === 1 ? '昨天' : i === 2 ? '前天' : `${i}天前（周${dayNames[d.getDay()]}）`;
      const rec = checkinRecords[key] || {};
      const done = rec[habitId] && rec[habitId].done;
      dates.push({key, label, done, date: d});
    }

    body.innerHTML = `<div style="font-size:14px;font-weight:700;margin-bottom:12px">${esc(h.icon)} ${esc(h.name)} · 补签</div>` +
      dates.map(d => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--rule)">
          <div>
            <div style="font-size:14px;font-weight:600">${d.label}</div>
            <div style="font-size:12px;color:var(--muted)">${d.key}</div>
          </div>
          <button onclick="doRetroactiveCheckin('${habitId}','${d.key}',${d.done ? 'true' : 'false'})" class="const-btn" style="margin:0;padding:6px 14px;font-size:12px;${d.done ? 'background:var(--muted)' : ''}">
            ${d.done ? '✓ 已签' : '补签'}
          </button>
        </div>
      `).join('');
    openPanel('retroactivePanel');
  }

  function openDailyAchievementCard() {
    const key = today();
    const diary = JSON.parse(localStorage.getItem('daily_diary_' + key) || '""');
    const done = getTodayDone();
    const total = getTodayTotal();

    const body = document.getElementById('achievementPanelBody');
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:48px;margin-bottom:8px">🏆</div>
        <div style="font-size:20px;font-weight:800;color:var(--accent)">今日全部完成！</div>
        <div style="font-size:14px;color:var(--muted)">${done}/${total} 个习惯 · ${key}</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px">📝 今日感想</div>
        <textarea id="dailyDiaryInput" placeholder="记录今天的感受..." style="width:100%;height:80px;border:1px solid var(--rule);border-radius:10px;padding:12px;font-size:14px;resize:none;background:var(--bg);font-family:inherit;line-height:1.6">${diary || ''}</textarea>
      </div>
      <button class="const-btn" onclick="saveDailyDiary()" style="width:100%">💾 保存感想</button>
    `;
    openPanel('achievementPanel');
  }

  function changeReminderMethod(method) {
    if (method === 'notification') {
      if (App.Modules.Notification && App.Modules.Notification.requestPermission) {
        App.Modules.Notification.requestPermission().then(function(granted) {
          if (granted) {
            _applyReminderMethod('notification');
          } else {
            document.getElementById('settingsReminderMethod').value = 'toast';
          }
        });
      } else {
        _applyReminderMethod(method);
      }
    } else {
      _applyReminderMethod(method);
    }
  }

  function _applyReminderMethod(method) {
    habitsConfig.forEach(function(h) {
      if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast', sound:true, vibrate:true};
      h.reminder.method = method;
      if (method !== 'off') h.reminder.enabled = true;
      else h.reminder.enabled = false;
    });
    saveConfig();
    showToast('提醒设置已更新');
    render();
  }

  function openHabitReminderList() {
    const body = document.getElementById('habitReminderBody');
    if (!body) return;

    const enabledCount = habitsConfig.filter(h => h.reminder && h.reminder.enabled).length;
    const total = habitsConfig.length;

    // 提醒方式图标映射
    var methodIcons = { toast: '💬', notification: '🔔', alarm: '⚡', 'in-app': '💬', off: '🔕' };
    var methodNames = { toast: '轻提醒', notification: '系统通知', alarm: '强提醒', 'in-app': '轻提醒', off: '已关闭' };
    var dayLabels = ['日','一','二','三','四','五','六'];

    let html = '<div style="padding:16px">';

    html += '<div style="text-align:center;margin-bottom:16px">' +
      '<div style="font-size:2rem;margin-bottom:.5rem">⏰</div>' +
      '<div style="font-weight:700;font-size:1.1rem">习惯提醒管理</div>' +
      '<div style="color:var(--muted);font-size:.85rem;margin-top:.3rem">已开启 ' + enabledCount + ' / ' + total + ' 个习惯提醒</div>' +
    '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
    html += '<button class="export-btn" style="flex:1;padding:8px;font-size:12px;background:var(--accent-light);color:var(--accent)" onclick="batchToggleReminders(true)">全部开启</button>';
    html += '<button class="export-btn" style="flex:1;padding:8px;font-size:12px;background:var(--rule);color:var(--ink2)" onclick="batchToggleReminders(false)">全部关闭</button>';
    html += '</div>';

    if (total === 0) {
      html += '<div style="text-align:center;padding:30px;color:var(--muted);font-size:14px">暂无习惯，请先添加习惯后再设置提醒</div>';
    }

    habitsConfig.forEach(function(h) {
      const r = h.reminder || {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast'};
      var mIcon = methodIcons[r.method] || '💬';
      var mName = methodNames[r.method] || '轻提醒';

      // 生成重复日期摘要
      var daysStr = '';
      if (!r.days || r.days.length === 7) {
        daysStr = '每天';
      } else if (r.days.length === 5 && !r.days.includes(0) && !r.days.includes(6)) {
        daysStr = '工作日';
      } else if (r.days.length === 2 && r.days.includes(0) && r.days.includes(6)) {
        daysStr = '周末';
      } else if (r.days && r.days.length > 0) {
        daysStr = r.days.slice().sort().map(function(d) { return '周' + dayLabels[d]; }).join(' ');
      } else {
        daysStr = '每天';
      }

      // 额外提醒时间
      var extraStr = '';
      if (r.extraTimes && r.extraTimes.length > 0) {
        extraStr = '<div style="font-size:11px;color:var(--accent);margin-top:2px">+' + r.extraTimes.length + ' 次: ' + r.extraTimes.join(', ') + '</div>';
      }

      html += '<div class="hr-item" onclick="openTimePanel(\'' + h.id + '\')" style="' + (!r.enabled ? 'opacity:0.5;' : '') + '">' +
        '<div class="hr-left">' +
          '<span class="hr-icon">' + h.icon + '</span>' +
          '<div class="hr-info">' +
            '<div class="hr-name">' + esc(h.name) + '</div>' +
            '<div class="hr-time">' + (r.enabled ? mIcon + ' ' + r.time + ' · ' + daysStr : '🔕 未开启') + '</div>' +
            extraStr +
          '</div>' +
        '</div>' +
        '<div class="hr-right">' +
          '<div class="toggle-switch ' + (r.enabled ? 'on' : '') + '" onclick="event.stopPropagation();toggleHabitReminder(\'' + h.id + '\', this)"></div>' +
          '<span class="hr-arrow">›</span>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    body.innerHTML = html;
    openPanel('habitReminderPanel');
  }

  function toggleHabitReminder(habitId, el) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'};
    h.reminder.enabled = !h.reminder.enabled;
    el.classList.toggle('on');
    saveConfig();
    render();
    const body = document.getElementById('habitReminderBody');
    if (body) {
      const enabledCount = habitsConfig.filter(x => x.reminder && x.reminder.enabled).length;
      const total = habitsConfig.length;
      const infoEl = body.querySelector('[style*="font-weight:700"] + div');
      if (infoEl) infoEl.textContent = '已开启 ' + enabledCount + ' / ' + total + ' 个习惯提醒';
    }
  }

  function batchToggleReminders(enable) {
    habitsConfig.forEach(h => {
      if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'};
      h.reminder.enabled = enable;
    });
    saveConfig();
    render();
    openHabitReminderList();
    showToast(enable ? '已开启所有习惯提醒' : '已关闭所有习惯提醒');
  }

  function openTimePanel(habitId) {
    pendingTimeHabitId = habitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;

    const r = h.reminder || {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app', sound:true, vibrate:true};
    var extraTimes = r.extraTimes || [];

    // 额外提醒时间 HTML
    var extraHtml = extraTimes.map(function(t, i) {
      return '<div class="extra-time-row" style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
        '<input type="time" class="extra-time-input" value="' + t + '" style="flex:1;padding:10px;border:1px solid var(--rule);border-radius:8px;font-size:15px;background:var(--bg);color:var(--ink)">' +
        '<button onclick="this.parentElement.remove()" style="width:32px;height:32px;border:none;background:var(--rule);border-radius:8px;color:var(--ink2);font-size:14px;cursor:pointer">✕</button>' +
      '</div>';
    }).join('');

    document.getElementById('timePanelTitle').textContent = `${esc(h.icon)} ${esc(h.name)} 提醒设置`;
    const body = document.getElementById('timePanelBody');
    body.innerHTML = `
      <div class="toggle-row">
        <span class="toggle-label">开启提醒</span>
        <div class="toggle-switch ${r.enabled ? 'on' : ''}" id="reminderToggle" onclick="toggleReminderEnabledPanel()"></div>
      </div>
      <div class="time-picker-wrap">
        <label>主提醒时间</label>
        <input type="time" id="reminderTimeInput" value="${r.time}">
      </div>

      <div style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:13px;color:var(--muted);font-weight:600">额外提醒时间</label>
          <button onclick="addExtraTimeRow()" id="addExtraTimeBtn" style="padding:4px 12px;border:1px dashed var(--accent);background:transparent;color:var(--accent);border-radius:8px;font-size:12px;cursor:pointer">+ 添加</button>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">在主时间之外，额外发送提醒（最多5个）</div>
        <div id="extraTimesContainer">${extraHtml}</div>
      </div>

      <div style="margin-top:20px">
        <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:8px;font-weight:600">提醒方式</label>
        <select id="reminderMethodSelect" style="width:100%;padding:12px;border:1px solid var(--rule);border-radius:10px;font-size:14px;background:var(--bg);color:var(--ink)">
          <option value="toast" ${r.method === 'toast' || r.method === 'in-app' ? 'selected' : ''}>💬 轻提醒（底部滑出提示）</option>
          <option value="notification" ${r.method === 'notification' ? 'selected' : ''}>🔔 系统通知（不打开App也能收到）</option>
          <option value="alarm" ${r.method === 'alarm' ? 'selected' : ''}>⚡ 强提醒（声音+振动+闪烁）</option>
          <option value="off" ${r.method === 'off' ? 'selected' : ''}>🔕 关闭提醒</option>
        </select>
      </div>

      <div style="margin-top:16px;font-size:13px;color:var(--muted);margin-bottom:8px;font-weight:600">重复日期</div>
      <div class="days-selector" id="daysSelector">
        ${DAY_NAMES.map((name, i) => `
          <button class="day-btn ${r.days.includes(i) ? 'active' : ''}" data-day="${i}" onclick="toggleDay(this, ${i})">${name}</button>
        `).join('')}
      </div>

      <div class="toggle-row" style="margin-top:16px">
        <span class="toggle-label">提醒音效</span>
        <div class="toggle-switch ${r.sound !== false ? 'on' : ''}" id="reminderSoundToggle" onclick="this.classList.toggle('on')"></div>
      </div>

      <button class="export-btn" style="margin-top:24px;background:var(--accent);color:#fff;width:100%;padding:14px;font-size:15px;font-weight:600" onclick="saveTimeSettings()">保存设置</button>
    `;
    openPanel('timePanel');
  }

  function addExtraTimeRow() {
    var container = document.getElementById('extraTimesContainer');
    if (!container) return;
    var count = container.querySelectorAll('.extra-time-row').length;
    if (count >= 5) {
      showToast('最多添加5个额外提醒时间');
      return;
    }
    var div = document.createElement('div');
    div.className = 'extra-time-row';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px';
    div.innerHTML = '<input type="time" class="extra-time-input" value="12:00" style="flex:1;padding:10px;border:1px solid var(--rule);border-radius:8px;font-size:15px;background:var(--bg);color:var(--ink)">' +
      '<button onclick="this.parentElement.remove()" style="width:32px;height:32px;border:none;background:var(--rule);border-radius:8px;color:var(--ink2);font-size:14px;cursor:pointer">✕</button>';
    container.appendChild(div);
  }

  function toggleReminderEnabledPanel() {
    const el = document.getElementById('reminderToggle');
    if (el) el.classList.toggle('on');
  }

  function toggleDay(btn, day) {
    btn.classList.toggle('active');
  }

  function saveTimeSettings() {
    const h = habitsConfig.find(x => x.id === pendingTimeHabitId);
    if (!h) return;
    const enabled = document.getElementById('reminderToggle').classList.contains('on');
    const time = document.getElementById('reminderTimeInput').value;
    const method = document.getElementById('reminderMethodSelect').value;
    const sound = document.getElementById('reminderSoundToggle').classList.contains('on');

    // 收集额外时间
    var extraTimes = [];
    document.querySelectorAll('#extraTimesContainer .extra-time-input').forEach(function(inp) {
      if (inp.value) extraTimes.push(inp.value);
    });
    // 去重 + 排序
    extraTimes = extraTimes.filter(function(t, i, arr) {
      return t !== time && arr.indexOf(t) === i;
    }).sort();

    const days = [];
    document.querySelectorAll('#daysSelector .day-btn.active').forEach(btn => {
      days.push(parseInt(btn.dataset.day));
    });

    h.reminder = {
      enabled,
      time: time || '08:00',
      days: days.length > 0 ? days : [0,1,2,3,4,5,6],
      method: method,
      sound: sound,
      vibrate: sound,
      extraTimes: extraTimes
    };
    saveConfig();
    closeAllPanels();
    showToast('提醒设置已保存');
    render();
  }

  function toggleRepeat(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const current = h.repeat || [0,1,2,3,4,5,6];
    if (current.length === 7) {
      h.repeat = [1,2,3,4,5];
      showToast(`${esc(h.icon)} ${esc(h.name)}：改为工作日打卡`);
    } else if (current.length === 5 && !current.includes(0) && !current.includes(6)) {
      h.repeat = [0,6];
      showToast(`${esc(h.icon)} ${esc(h.name)}：改为周末打卡`);
    } else {
      h.repeat = [0,1,2,3,4,5,6];
      showToast(`${esc(h.icon)} ${esc(h.name)}：改为每天打卡`);
    }
    saveConfig();
    renderCheckin();
  }

  function openWaterInputPanel(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    pendingCheckinHabitId = habitId;
    const wc = h.waterConfig || {perCup:250, dailyGoal:2000};
    const perCup = wc.perCup || 250;

    const quickAmounts = [perCup, perCup * 2, perCup / 2];

    let html = `<div class="water-input-panel">
      <div class="water-amount-display">
        <div class="water-quick-row">`;
    quickAmounts.forEach(amt => {
      html += `<button class="water-quick-btn" onclick="quickAddWaterFromPanel(${amt})">+${amt}ml</button>`;
    });
    html += `</div>
        <div class="water-custom-input">
          <input type="number" id="waterCustomAmount" placeholder="自定义" min="10" step="10">
          <div class="checkin-input-unit">ml</div>
        </div>
        <div class="checkin-input-actions">
          <button class="cancel" onclick="closeAllPanels()">取消</button>
          <button class="confirm" onclick="confirmWaterInput()">确认记录</button>
        </div>
      </div>
    </div>`;
    openPanel('checkinPanel');
    setTimeout(() => {
      const field = document.getElementById('waterCustomAmount');
      if (field) field.focus();
    }, 300);
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

  // ============================================================
  // 免打扰设置
  // ============================================================

  function _padTime(n) { return n < 10 ? '0' + n : '' + n; }

  /** 更新设置面板中的免打扰描述文字和开关状态 */
  function _updateQuietHoursUI() {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      var enabled = cfg.enabled !== false;
      var start = cfg.start || 22;
      var end = cfg.end || 7;
      var descEl = document.getElementById('quietHoursDesc');
      var toggleEl = document.getElementById('quietHoursToggle');
      if (descEl) {
        descEl.textContent = enabled
          ? _padTime(start) + ':00 – ' + _padTime(end) + ':00 · 期间不发送提醒'
          : '已关闭 · 提醒将全天候发送';
      }
      if (toggleEl) toggleEl.checked = enabled;
    } catch(e) {}
  }

  /** 打开免打扰设置面板 */
  function openQuietHoursPanel() {
    var cfg;
    try {
      cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
    } catch(e) { cfg = {}; }

    var enabled = cfg.enabled !== false;
    var startH = cfg.start || 22;
    var endH = cfg.end || 7;

    // 设置面板初始值
    var toggle = document.getElementById('qhEnableToggle');
    if (toggle) {
      if (enabled) toggle.classList.add('on');
      else toggle.classList.remove('on');
    }
    var startInput = document.getElementById('qhStartTime');
    var endInput = document.getElementById('qhEndTime');
    if (startInput) startInput.value = _padTime(startH) + ':00';
    if (endInput) endInput.value = _padTime(endH) + ':00';

    _updateQHPreview();
    openPanel('quietHoursPanel');

    // 监听时间变化实时更新预览
    if (startInput) startInput.onchange = _updateQHPreview;
    if (endInput) endInput.onchange = _updateQHPreview;
  }

  /** 更新免打扰预览文字 */
  function _updateQHPreview() {
    var preview = document.getElementById('qhPreview');
    if (!preview) return;
    var toggle = document.getElementById('qhEnableToggle');
    var enabled = toggle && toggle.classList.contains('on');
    var startVal = (document.getElementById('qhStartTime') || {}).value || '22:00';
    var endVal = (document.getElementById('qhEndTime') || {}).value || '07:00';

    if (!enabled) {
      preview.innerHTML = '🔔 免打扰已关闭，提醒将全天候发送';
      preview.style.background = 'var(--card)';
      return;
    }

    // 计算免打扰时长
    var sp = startVal.split(':').map(Number);
    var ep = endVal.split(':').map(Number);
    var startMin = sp[0] * 60 + (sp[1] || 0);
    var endMin = ep[0] * 60 + (ep[1] || 0);

    if (startMin === endMin) {
      preview.innerHTML = '⚠️ 开始和结束时间相同，请调整';
      preview.style.background = 'var(--card)';
      return;
    }

    var duration = endMin > startMin ? endMin - startMin : (24 * 60 - startMin + endMin);
    var hours = Math.floor(duration / 60);
    var mins = duration % 60;
    var durStr = hours > 0 ? hours + '小时' : '';
    if (mins > 0) durStr += mins + '分钟';

    preview.innerHTML = '🌙 每天 <strong>' + startVal + '</strong> 至次日 <strong>' + endVal + '</strong> 静默<br><span style="font-size:12px;color:var(--muted)">持续约 ' + durStr + ' · 强提醒不受影响</span>';
  }

  /** 设置面板中的快速开关 */
  function toggleQuietHours(enabled) {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      cfg.enabled = enabled;
      localStorage.setItem('quiet_hours', JSON.stringify(cfg));
      _updateQuietHoursUI();
      // 触发通知系统重调度
      if (typeof rescheduleAllNotifications === 'function') rescheduleAllNotifications();
      showToast(enabled ? '免打扰已开启' : '免打扰已关闭');
    } catch(e) {}
  }

  /** 保存免打扰面板设置 */
  function saveQuietHours() {
    var toggle = document.getElementById('qhEnableToggle');
    var enabled = toggle && toggle.classList.contains('on');
    var startVal = (document.getElementById('qhStartTime') || {}).value || '22:00';
    var endVal = (document.getElementById('qhEndTime') || {}).value || '07:00';

    var sp = startVal.split(':').map(Number);
    var ep = endVal.split(':').map(Number);

    var cfg = {
      enabled: enabled,
      start: sp[0] || 22,
      end: ep[0] || 7
    };
    localStorage.setItem('quiet_hours', JSON.stringify(cfg));

    _updateQuietHoursUI();
    if (typeof rescheduleAllNotifications === 'function') rescheduleAllNotifications();
    closeAllPanels();
    showToast('免打扰设置已保存');
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  App.UI.Panels = {
    openPanel,
    closeAllPanels,
    attachPanelGesture,
    openLibraryPanel,
    renderLibraryPanel,
    updateLibCardState,
    getPomoTotalStats,
    openRefPanel,
    renderRefPanel,
    switchRefTab,
    openEmotionPanel,
    renderEmotionPanel,
    selectEmotion,
    openClockPanel,
    openWulaoPanel,
    openDietPanel,
    openSportsPanel,
    toggleGroup,
    renderWulaoPanel,
    openSkinPanel,
    switchSkinTab,
    selectSkin,
    selectComponentStyle,
    initAllSkins,
    openHealthReportPanel,
    renderHealthReport,
    openDataPanel,
    openRetroactivePanel,
    openDailyAchievementCard,
    changeReminderMethod,
    openHabitReminderList,
    toggleHabitReminder,
    batchToggleReminders,
    openTimePanel,
    addExtraTimeRow,
    toggleReminderEnabledPanel,
    toggleDay,
    saveTimeSettings,
    toggleRepeat,
    openWaterInputPanel,
    openWaterWeekPanel,
    openQuietHoursPanel,
    toggleQuietHours,
    saveQuietHours,
    updateQuietHoursUI: _updateQuietHoursUI
  };

  // 暴露到全局，供 HTML onclick 直接使用
  window.openPanel = openPanel;
  window.closeAllPanels = closeAllPanels;
  window.changeReminderMethod = changeReminderMethod;
  window.openHabitReminderList = openHabitReminderList;
  window.toggleHabitReminder = toggleHabitReminder;
  window.batchToggleReminders = batchToggleReminders;
  window.openEmotionPanel = openEmotionPanel;
  window.openRetroactivePanel = openRetroactivePanel;
  // 批量暴露其余函数
  Object.keys(App.UI.Panels).forEach(function(k) {
    if (typeof App.UI.Panels[k] === 'function' && !window[k]) window[k] = App.UI.Panels[k];
  });

  if (App.registerModule) {
    App.registerModule('ui.panels', 'ui', null);
  }
})();

/* ===== ui/components.js ===== */
(function() {
  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};
  if (!App.UI.Components) App.UI.Components = {};

  App.UI.Components.Button = {
    create(options) {
      const opts = Object.assign({
        text: '按钮',
        variant: 'primary',
        size: 'md',
        icon: '',
        onClick: null,
        className: '',
        disabled: false
      }, options);

      const btn = document.createElement('button');
      btn.className = `ui-btn ui-btn--${opts.variant} ui-btn--${opts.size} ${opts.className}`;
      if (opts.disabled) btn.disabled = true;

      if (opts.icon) {
        btn.innerHTML = `<span class="ui-btn__icon">${esc(opts.icon)}</span><span class="ui-btn__text">${opts.text}</span>`;
      } else {
        btn.textContent = opts.text;
      }

      if (opts.onClick) {
        btn.addEventListener('click', opts.onClick);
      }

      return btn;
    }
  };

  App.UI.Components.Switch = {
    create(options) {
      const opts = Object.assign({
        checked: false,
        onChange: null,
        label: '',
        className: ''
      }, options);

      const container = document.createElement('label');
      container.className = `ui-switch ${opts.className}`;
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'ui-switch__input';
      if (opts.checked) input.checked = true;

      const slider = document.createElement('span');
      slider.className = 'ui-switch__slider';

      if (opts.label) {
        const labelText = document.createElement('span');
        labelText.className = 'ui-switch__label';
        labelText.textContent = opts.label;
        container.appendChild(labelText);
      }

      container.appendChild(input);
      container.appendChild(slider);

      if (opts.onChange) {
        input.addEventListener('change', (e) => opts.onChange(e.target.checked));
      }

      return container;
    }
  };

  App.UI.Components.Checkbox = {
    create(options) {
      const opts = Object.assign({
        checked: false,
        onChange: null,
        label: '',
        className: ''
      }, options);

      const container = document.createElement('label');
      container.className = `ui-checkbox ${opts.className}`;

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'ui-checkbox__input';
      if (opts.checked) input.checked = true;

      const box = document.createElement('span');
      box.className = 'ui-checkbox__box';

      const check = document.createElement('span');
      check.className = 'ui-checkbox__check';

      box.appendChild(check);

      if (opts.label) {
        const labelText = document.createElement('span');
        labelText.className = 'ui-checkbox__label';
        labelText.textContent = opts.label;
        container.appendChild(labelText);
      }

      container.appendChild(input);
      container.appendChild(box);

      if (opts.onChange) {
        input.addEventListener('change', (e) => opts.onChange(e.target.checked));
      }

      return container;
    }
  };

  App.UI.Components.Card = {
    create(options) {
      const opts = Object.assign({
        title: '',
        content: '',
        icon: '',
        className: '',
        header: null,
        footer: null
      }, options);

      const card = document.createElement('div');
      card.className = `ui-card ${opts.className}`;

      if (opts.header) {
        const header = document.createElement('div');
        header.className = 'ui-card__header';
        header.appendChild(opts.header);
        card.appendChild(header);
      } else if (opts.title || opts.icon) {
        const header = document.createElement('div');
        header.className = 'ui-card__header';
        
        if (opts.icon) {
          const icon = document.createElement('span');
          icon.className = 'ui-card__icon';
          icon.textContent = opts.icon;
          header.appendChild(icon);
        }
        
        if (opts.title) {
          const title = document.createElement('h3');
          title.className = 'ui-card__title';
          title.textContent = opts.title;
          header.appendChild(title);
        }
        
        card.appendChild(header);
      }

      if (opts.content) {
        const body = document.createElement('div');
        body.className = 'ui-card__body';
        if (typeof opts.content === 'string') {
          body.innerHTML = opts.content;
        } else {
          body.appendChild(opts.content);
        }
        card.appendChild(body);
      }

      if (opts.footer) {
        const footer = document.createElement('div');
        footer.className = 'ui-card__footer';
        footer.appendChild(opts.footer);
        card.appendChild(footer);
      }

      return card;
    }
  };

  App.UI.Components.Input = {
    create(options) {
      const opts = Object.assign({
        type: 'text',
        placeholder: '',
        value: '',
        onChange: null,
        className: '',
        label: '',
        icon: ''
      }, options);

      const container = document.createElement('div');
      container.className = `ui-input ${opts.className}`;

      if (opts.label) {
        const label = document.createElement('label');
        label.className = 'ui-input__label';
        label.textContent = opts.label;
        container.appendChild(label);
      }

      const wrapper = document.createElement('div');
      wrapper.className = 'ui-input__wrapper';

      if (opts.icon) {
        const icon = document.createElement('span');
        icon.className = 'ui-input__icon';
        icon.textContent = opts.icon;
        wrapper.appendChild(icon);
      }

      const input = document.createElement('input');
      input.type = opts.type;
      input.className = 'ui-input__field';
      input.placeholder = opts.placeholder;
      input.value = opts.value;

      if (opts.onChange) {
        input.addEventListener('input', (e) => opts.onChange(e.target.value));
      }

      wrapper.appendChild(input);
      container.appendChild(wrapper);

      return container;
    }
  };

  App.UI.Components.Badge = {
    create(options) {
      const opts = Object.assign({
        text: '',
        variant: 'default',
        icon: '',
        className: ''
      }, options);

      const badge = document.createElement('span');
      badge.className = `ui-badge ui-badge--${opts.variant} ${opts.className}`;

      if (opts.icon) {
        badge.innerHTML = `<span class="ui-badge__icon">${esc(opts.icon)}</span><span class="ui-badge__text">${opts.text}</span>`;
      } else {
        badge.textContent = opts.text;
      }

      return badge;
    }
  };

  if (App.registerModule) {
    App.registerModule('ui.components', 'ui', ['ui.panels', 'ui.render']);
  }
})();

/* ===== ui/events.js ===== */
(function() {
  // 安全引用积分规则常量（防止 utils.js 加载失败导致整个 events.js 崩溃）
  function getCheckinReward() {
    try { return App.Core.Utils.checkinReward || { perHabit: 1, allDoneBonus: 5 }; }
    catch(e) { return { perHabit: 1, allDoneBonus: 5 }; }
  }

  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-' + tab).classList.add('active');
    // 我的页面隐藏顶部日期卡片，其他页面显示
    const todayCard = document.getElementById('todayCard');
    if (todayCard) todayCard.style.display = tab === 'profile' ? 'none' : '';
    if (tab === 'profile') renderProfile();
    if (tab === 'manage') renderManage();
    if (tab === 'checkin') renderCheckin();
  }

  function handleCheckin(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const rec = checkinRecords[today()] || {};

    if (h.type === 'water') {
      openWaterInputPanel(habitId);
      return;
    }

    if (h.negative) {
      if (rec[habitId] && rec[habitId].failed) {
        delete rec[habitId];
        showToast(`✅ ${esc(h.icon)} 今天没${esc(h.name)}，继续保持！`);
        playSound('checkin');
      } else if (rec[habitId] && rec[habitId].done) {
        rec[habitId] = {done: false, failed: true, value: 0};
        showToast(`❌ 今天${esc(h.name)}了，明天加油`);
      } else {
        rec[habitId] = {done: true, failed: false, value: 1};
        const reward = getCheckinReward();
        const pts = App.Core.Utils.addPoints(reward.perHabit, `${esc(h.name)} 克制成功`);
        showToast(`✅ ${esc(h.icon)} 今天没${esc(h.name)}，继续保持！+${reward.perHabit}积分 (总:${pts})`);
        playSound('checkin');
        checkLevelUp();
      }
      checkinRecords[today()] = rec;
      saveRecords();
      animateCheckin(habitId);
      render(['today','checkin']);
      return;
    }

    if (h.type === 'boolean') {
      if (rec[habitId] && rec[habitId].done) {
        delete rec[habitId];
        showToast('已撤销打卡');
      } else {
        rec[habitId] = {done: true, value: 1, lastInterval: Date.now()};
        // 打卡积分奖励
        const reward1 = getCheckinReward();
        const pts = App.Core.Utils.addPoints(reward1.perHabit, `${esc(h.name)} 打卡`);
        showToast(`${esc(h.icon)} ${esc(h.name)} 打卡成功！+${reward1.perHabit}积分 (总:${pts})`);
        playSound('checkin');
        animateCheckin(habitId);
        checkLevelUp();
      }
      checkinRecords[today()] = rec;
      saveRecords();
      render(['today','checkin']);
    } else {
      pendingCheckinHabitId = habitId;
      const titleEl = document.getElementById('checkinPanelTitle');
      const labelEl = document.getElementById('checkinInputLabel');
      const unitEl = document.getElementById('checkinInputUnit');
      const field = document.getElementById('checkinInputField');
      if (titleEl) titleEl.textContent = `${esc(h.icon)} ${esc(h.name)}`;
      if (labelEl) labelEl.textContent = h.type === 'count' ? '请输入数量' : '请输入时长';
      if (unitEl) unitEl.textContent = h.unit;
      if (field) {
        field.value = (rec[habitId] && rec[habitId].done) ? rec[habitId].value : '';
        field.placeholder = h.type === 'count' ? '0' : '0';
      }
      openPanel('checkinPanel');
      if (field) setTimeout(() => field.focus(), 300);
    }
  }

  function confirmCheckinInput() {
    const field = document.getElementById('checkinInputField');
    if (!field) return;
    const val = parseInt(field.value);
    if (isNaN(val) || val < 0) {
      showToast('请输入有效的数值');
      return;
    }
    const habitId = pendingCheckinHabitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;

    const rec = checkinRecords[today()] || {};
    if (val === 0) {
      delete rec[habitId];
      showToast('已撤销记录');
    } else {
      rec[habitId] = {done: true, value: val, lastInterval: Date.now()};
      // 打卡积分奖励
      const reward2 = getCheckinReward();
      const pts = App.Core.Utils.addPoints(reward2.perHabit, `${esc(h.name)} 记录`);
      showToast(`${esc(h.icon)} ${esc(h.name)} 记录 ${val}${esc(h.unit)}！+${reward2.perHabit}积分 (总:${pts})`);
      playSound('checkin');
      checkLevelUp();
    }
    checkinRecords[today()] = rec;
    saveRecords();
    closeAllPanels();
    render(['today','checkin']);
  }

  function checkLevelUp() {
    const oldLevel = parseInt(localStorage.getItem('user_level') || '1');
    const newLevel = getCurrentLevel().level;
    if (newLevel > oldLevel) {
      localStorage.setItem('user_level', String(newLevel));
      const lv = LEVELS.find(l => l.level === newLevel);
      playSound('unlock');
      showToast(`🎉 升级！获得「${esc(lv.icon)} ${esc(lv.name)}」称号！`);
    }
    const done = getTodayDone();
    const total = getTodayTotal();
    if (done === total && total > 0) {
      // 检查全部完成额外积分奖励
      const bonusKey = 'all_done_bonus_' + today();
      if (localStorage.getItem(bonusKey) !== 'true') {
        localStorage.setItem(bonusKey, 'true');
        const reward3 = getCheckinReward();
        const newTotal = App.Core.Utils.addPoints(reward3.allDoneBonus, '完成所有任务额外奖励');
        showToast(`🎉 全部完成！获得 +${reward3.allDoneBonus} 额外积分！当前积分：${newTotal}`);
      }
      setTimeout(() => {
        playSound('complete');
        if (App.UI.Render && App.UI.Render.showCelebration) App.UI.Render.showCelebration();
        else showAllDoneCelebration();
      }, 300);
    }
  }

  function doRetroactiveCheckin(habitId, dateKey, alreadyDone) {
    const rec = checkinRecords[dateKey] || {};
    if (alreadyDone) {
      delete rec[habitId];
      showToast('已取消补签');
    } else {
      rec[habitId] = {done: true, value: 1, retroactive: true};
      playSound('checkin');
      showToast('✅ 补签成功！');
    }
    checkinRecords[dateKey] = rec;
    saveRecords();
    render();
    openRetroactivePanel(habitId);
  }

  function animateCheckin(habitId) {
    const card = document.getElementById('card-' + habitId);
    if (!card) return;
    card.classList.add('flip');
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => card.classList.remove('flip'), 500);

    setTimeout(() => {
      const emojis = ['⭐','✨','🌟','💫','🔥'];
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const star = document.createElement('div');
          star.className = 'star-particle';
          star.textContent = emojis[i % emojis.length];
          star.style.left = (card.offsetWidth / 2 + (Math.random() - 0.5) * 40) + 'px';
          star.style.top = (card.offsetHeight / 2) + 'px';
          star.style.animationDelay = (i * 0.05) + 's';
          card.appendChild(star);
          setTimeout(() => star.remove(), 600);
        }, i * 50);
      }
    }, 250);
  }

  function showAllDoneCelebration() {
    const banner = document.createElement('div');
    banner.className = 'all-done-banner';
    banner.innerHTML = '<span class="emoji">🎉</span><span class="text">全部完成！</span>';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2000);

    const colors = ['#7CB69D','#F4A683','#5B8DB8','#E07A5F','#C19A6B','#FFD700'];
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'confetti-particle';
        p.style.background = colors[i % colors.length];
        p.style.left = (Math.random() * 100) + 'vw';
        p.style.top = (50 + Math.random() * 20) + 'vh';
        p.style.animationDuration = (0.8 + Math.random() * 0.5) + 's';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1500);
      }, i * 30);
    }

    setTimeout(() => openDailyAchievementCard(), 1500);
  }

  function saveDailyDiary() {
    const input = document.getElementById('dailyDiaryInput');
    if (input) {
      localStorage.setItem('daily_diary_' + today(), JSON.stringify(input.value));
      showToast('✅ 日记已保存！');
      closeAllPanels();
    }
  }

  function deleteHabit(habitId) {
    // 事务性清理：先清打卡记录再删习惯，任一步失败则回滚
    const cleaned = App.Core.Storage.purgeHabitRecords(habitId);
    habitsConfig = habitsConfig.filter(h => h.id !== habitId);
    saveConfig();
    showToast(cleaned > 0 ? `已删除习惯并清理 ${cleaned} 天打卡记录` : '已删除习惯');
    render();
  }

  function addHabitFromLib(id) {
    if (habitsConfig.find(h => h.id === id)) {
      showToast('该习惯已添加');
      return;
    }
    const lib = HABIT_LIBRARY.find(h => h.id === id);
    if (!lib) return;
    const newHabit = {
      id: lib.id,
      name: lib.name,
      icon: lib.icon,
      category: lib.category,
      timePeriod: lib.timePeriod || 'daytime',
      type: lib.type,
      unit: lib.unit,
      repeat: [0,1,2,3,4,5,6],
      reminder: {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast', sound:true, vibrate:true}
    };
    if (lib.type === 'water' && lib.waterConfig) {
      newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
      newHabit.reminder = {enabled:true, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast', sound:true, vibrate:true};
    }
    if (lib.intervalReminder) {
      newHabit.intervalReminder = JSON.parse(JSON.stringify(lib.intervalReminder));
    }
    habitsConfig.push(newHabit);
    saveConfig();
    showToast(`${esc(lib.icon)} ${esc(lib.name)} 已添加`);
    // 只更新卡片状态，不重新渲染整个面板
    updateLibCardState(id, true);
    // 只渲染 manage 和 checkin
    render(['manage', 'checkin']);
  }

  function toggleHabitFromLib(id) {
    const existing = habitsConfig.find(h => h.id === id);
    if (existing) {
      // 已添加，执行删除（同时清理打卡记录）
      if (!confirm('确定要删除这个习惯吗？相关打卡记录将一并清理。')) return;
      const idx = habitsConfig.findIndex(h => h.id === id);
      if (idx >= 0) {
        const cleaned = App.Core.Storage.purgeHabitRecords(id);
        habitsConfig.splice(idx, 1);
        saveConfig();
        showToast(cleaned > 0 ? `已删除习惯并清理 ${cleaned} 天打卡记录` : '已删除习惯');
        // 只更新卡片状态
        updateLibCardState(id, false);
        render(['manage', 'checkin']);
      }
    } else {
      // 未添加，执行添加
      addHabitFromLib(id);
      return; // addHabitFromLib 内部已处理
    }
  }

  function toggleCustomForm() {
    const form = document.getElementById('libCustomForm');
    if (!form) return;
    const shown = form.style.display === 'block';
    form.style.display = shown ? 'none' : 'block';
    // 滚动到表单区域
    if (!shown) {
      setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }

  function addCustomHabit() {
    const name = document.getElementById('customHabitName').value.trim();
    const icon = document.getElementById('customHabitIcon').value || '✅';
    const typeBtn = document.querySelector('#customTypeSelector button.active');
    const type = typeBtn ? typeBtn.dataset.type : 'boolean';
    const unit = (document.getElementById('customHabitUnit') && document.getElementById('customHabitUnit').value).trim() || (type === 'count' ? '个' : type === 'timer' ? '分钟' : '');
    const timeEl = document.getElementById('customHabitTime');
    const time = timeEl ? timeEl.value : '08:00';
    // 收集选中的星期
    const activeDays = document.querySelectorAll('#customWeekdays button.active');
    const repeat = [];
    activeDays.forEach(btn => repeat.push(parseInt(btn.dataset.day)));
    const repeatDays = repeat.length > 0 ? repeat : [0,1,2,3,4,5,6];
    // 收集额外提醒时间
    const reminderInputs = document.querySelectorAll('#customRemindersList input[type="time"]');
    const extraReminders = [];
    reminderInputs.forEach(inp => {
      if (inp.value) extraReminders.push(inp.value);
    });
    // 备注说明
    const noteEl = document.getElementById('customHabitNote');
    const note = noteEl ? noteEl.value.trim() : '';

    if (!name) {
      showToast('请输入习惯名称');
      return;
    }

    if (habitsConfig.find(h => h.name === name)) {
      showToast('已存在同名习惯，请使用不同名称');
      return;
    }

    const id = 'custom_' + Date.now();
    habitsConfig.push({
      id,
      name,
      icon,
      category: 'daytime',
      timePeriod: 'daytime',
      type,
      unit,
      repeat: repeatDays,
      note: note,
      extraReminders: extraReminders,
      reminder: {enabled:true, time, days:repeatDays, method:'in-app'}
    });
    saveConfig();
    showToast(`${icon} ${name} 已添加`);
    // 关闭自定义习惯面板（如果打开）
    const customPanel = document.getElementById('customHabitPanel');
    if (customPanel) customPanel.classList.remove('show');
    // 只渲染 manage 和 checkin
    render(['manage', 'checkin']);
  }

  function addCustomReminderTime() {
    const list = document.getElementById('customRemindersList');
    if (!list) return;
    const count = list.children.length;
    if (count >= 5) { showToast('最多添加5个额外提醒'); return; }
    const div = document.createElement('div');
    div.className = 'lib-custom-reminder-item';
    div.innerHTML = `<input type="time" value="12:00"><span class="reminder-remove" onclick="this.parentElement.remove()">✕</span>`;
    list.appendChild(div);
  }

  function selectCustomType(btn) {
    document.querySelectorAll('#customTypeSelector button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.type;
    document.getElementById('customUnitWrap').style.display = (type === 'boolean') ? 'none' : 'block';
  }

  function toggleCustomWeekday(btn) {
    btn.classList.toggle('active');
  }

  function selectCustomIcon(el, icon) {
    document.querySelectorAll('#customIconGrid span').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('customIconPreview').textContent = icon;
    document.getElementById('customHabitIcon').value = icon;
  }

  function filterLibCategory(cat, tabBtn) {
    // 切换标签 active 状态
    document.querySelectorAll('#libTabs .lib-tab').forEach(t => t.classList.remove('active'));
    if (tabBtn) tabBtn.classList.add('active');
    // 隐藏所有网格，只显示对应分类
    document.querySelectorAll('.lib-grid').forEach(g => g.style.display = 'none');
    const grid = document.getElementById('libGrid_' + cat);
    if (grid) grid.style.display = 'grid';
  }

  function toggleNeijingMaster() {
    const body = document.getElementById('neijingPackBody');
    const arrow = document.getElementById('neijingMasterArrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function toggleNeijingSub(subId) {
    const body = document.getElementById('neijingSubBody_' + subId);
    const arrow = document.getElementById('neijingSubArrow_' + subId);
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function toggleSeasonPack(season) {
    const body = document.getElementById('seasonPackBody_' + season);
    const arrow = document.querySelector('#seasonPack_' + season + ' .season-pack-arrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function toggleHealthPack() {
    const body = document.getElementById('healthPackBody');
    const arrow = document.querySelector('.health-pack-arrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function addHealthPack() {
    const myIds = new Set(habitsConfig.map(h => h.id));
    let addedCount = 0;
    
    HEALTH_PACK.habits.forEach(ph => {
      if (myIds.has(ph.id)) return;
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      if (!lib) return;
      
      const newHabit = {
        id: lib.id,
        name: lib.name,
        icon: lib.icon,
        category: lib.category,
        type: lib.type,
        unit: lib.unit,
        reminder: {
          enabled: ph.reminder.enabled,
          time: ph.reminder.time,
          days: [0,1,2,3,4,5,6],
          method: 'in-app'
        }
      };
      
      if (lib.type === 'water' && lib.waterConfig) {
        newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
      }
      
      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });
    
    if (addedCount > 0) {
      saveConfig();
      showToast(`💚 健康生活建议包：已添加 ${addedCount} 个习惯`);
      // 批量更新卡片状态
      packHabitIds.forEach(id => updateLibCardState(id, true));
      render(['manage', 'checkin']);
    } else {
      showToast('建议包中的习惯已全部添加');
    }
  }

  function addSeasonalPack(season) {
    const pack = SEASONAL_PACKS[season];
    if (!pack) return;
    const myIds = new Set(habitsConfig.map(h => h.id));
    let addedCount = 0;
    
    pack.habits.forEach(ph => {
      if (myIds.has(ph.id)) return;
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      if (!lib) return;
      
      const newHabit = {
        id: lib.id,
        name: lib.name,
        icon: lib.icon,
        category: lib.category,
        type: lib.type,
        unit: lib.unit,
        reminder: {
          enabled: ph.reminder.enabled,
          time: ph.reminder.time,
          days: [0,1,2,3,4,5,6],
          method: 'in-app'
        }
      };
      
      if (lib.type === 'water' && lib.waterConfig) {
        newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
      }
      
      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });
    
    if (addedCount > 0) {
      saveConfig();
      showToast(`${pack.emoji} ${esc(pack.name)}：已添加 ${addedCount} 个习惯`);
      // 批量更新卡片状态
      pack.habits.forEach(ph => {
        if (!myIds.has(ph.id)) updateLibCardState(ph.id, true);
      });
      render(['manage', 'checkin']);
    } else {
      showToast(`${esc(pack.name)}中的习惯已全部添加`);
    }
  }

  function toggleHabitEnabled(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    h.enabled = h.enabled === false ? true : false;
    const enabled = h.enabled !== false;
    // 立即更新开关视觉状态，避免等待重渲染
    const toggleEl = document.querySelector(`.mg-item-toggle[onclick*="${habitId}"]`);
    if (toggleEl) {
      if (enabled) toggleEl.classList.add('on');
      else toggleEl.classList.remove('on');
    }
    // 异步保存配置
    setTimeout(() => saveConfig(), 0);
    // 重新渲染管理页和打卡页
    renderManage();
    renderCheckin();
  }

  function quickAddWater(habitId, amount) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const rec = checkinRecords[today()] || {};
    const waterRec = rec[habitId] || {value: 0, cups: []};
    waterRec.value = (waterRec.value || 0) + amount;
    waterRec.cups = waterRec.cups || [];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    waterRec.cups.push({time: timeStr, amount});
    waterRec.done = waterRec.value >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000);
    rec[habitId] = waterRec;
    checkinRecords[today()] = rec;
    saveRecords();
    if (waterRec.done) {
      // 饮水目标达成积分奖励
      const wasDone = ((rec[habitId] && rec[habitId]._doneRewarded));
      if (!wasDone) {
        waterRec._doneRewarded = true;
        rec[habitId] = waterRec;
        const reward4 = getCheckinReward();
        const pts = App.Core.Utils.addPoints(reward4.perHabit, `${esc(h.name)} 目标达成`);
        showToast(`💧 今日饮水目标达成！+${reward4.perHabit}积分 (总:${pts})`);
      }
      playSound('checkin');
      checkLevelUp();
    }
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

  function initTouchSwipe() {
    let startX = 0, startY = 0;
    document.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, {passive: true});
    document.addEventListener('touchend', function(e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
        const checkinSec = document.getElementById('sec-checkin');
        if (checkinSec && checkinSec.classList.contains('active')) {
          swipeDate(dx > 0 ? -1 : 1);
        }
      }
    }, {passive: true});
  }

  function exportCSV() {
    const dates = Object.keys(checkinRecords).sort();
    if (dates.length === 0) {
      showToast('暂无数据可导出');
      return;
    }

    const headers = ['日期', ...habitsConfig.map(h => h.name)];
    const rows = [headers.join(',')];

    dates.forEach(date => {
      const rec = checkinRecords[date];
      const row = [date];
      habitsConfig.forEach(h => {
        if (rec && rec[h.id] && rec[h.id].done) {
          if (h.type === 'water') {
            row.push(rec[h.id].value + 'ml');
          } else {
            row.push(h.type === 'boolean' ? '✓' : rec[h.id].value);
          }
        } else {
          row.push('');
        }
      });
      rows.push(row.join(','));
    });

    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `习惯打卡_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV已导出');
  }


  function toggleReminderEnabled() {
    const el = document.getElementById('reminderToggle');
    el.classList.toggle('on');
  }

  function toggleDarkMode(enable) {
    const icon = document.getElementById('themeIcon');
    const settingsCheckbox = document.getElementById('settingsThemeCheckbox');
    if (enable) {
      document.body.classList.add('dark');
      localStorage.setItem('dark_mode', 'true');
      if (icon) icon.textContent = '🌙';
      if (settingsCheckbox) settingsCheckbox.checked = true;
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('dark_mode', 'false');
      if (icon) icon.textContent = '☀️';
      if (settingsCheckbox) settingsCheckbox.checked = false;
    }
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  App.UI.Events = {
    switchTab,
    handleCheckin,
    confirmCheckinInput,
    checkLevelUp,
    toggleDarkMode,
    doRetroactiveCheckin,
    animateCheckin,
    showAllDoneCelebration,
    saveDailyDiary,
    deleteHabit,
    addHabitFromLib,
    toggleHabitFromLib,
    toggleCustomForm,
    addCustomHabit,
    addCustomReminderTime,
    selectCustomType,
    toggleCustomWeekday,
    selectCustomIcon,
    filterLibCategory,
    toggleNeijingMaster,
    toggleNeijingSub,
    toggleHealthPack,
    toggleSeasonPack,
    addHealthPack,
    addSeasonalPack,
    toggleHabitEnabled,
    quickAddWater,
    quickAddWaterFromPanel,
    confirmWaterInput,
    initTouchSwipe,
    exportCSV,
    toggleReminderEnabled
  };

  // 暴露到全局，供 HTML onclick 直接使用
  window.switchTab = switchTab;
  window.handleCheckin = handleCheckin;
  // 批量暴露其余函数
  Object.keys(App.UI.Events).forEach(function(k) {
    if (typeof App.UI.Events[k] === 'function' && !window[k]) window[k] = App.UI.Events[k];
  });

  if (App.registerModule) {
    App.registerModule('ui.events', 'ui', null);
  }
})();
