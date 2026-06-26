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
  var getCurrentShichen = _U.getCurrentShichen || function(){ return null; };
  var getCurrentSolarTerm = _U.getCurrentSolarTerm || function(){ return null; };
  var getCurrentSeason = _U.getCurrentSeason || function(){
    var m = new Date().getMonth() + 1;
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'autumn';
    return 'winter';
  };
  var getSeasonPack = _U.getSeasonPack || function(s){
    // fallback: 内置四季原文，防止 packs.js/utils.js 加载异常时原文不显示
    var packs = {
      spring: {name:'春季',emoji:'🌿',focus:'养肝舒展，夜卧早起',months:[2,3,4],quote:'春三月，此谓发陈。天地俱生，万物以荣。夜卧早起，广步于庭，被发缓形，以使志生，生而勿杀，予而勿夺，赏而勿罚，此春气之应，养生之道也；逆之则伤肝。',tip:'春季养生重在养肝。夜卧早起（不超23点），广步于庭（户外散步舒展），使志生（精神舒展不压抑），省酸增甘（多吃甘味养肝脾）。逆之伤肝。'},
      summer: {name:'夏季',emoji:'☀️',focus:'养心静心，无厌于日',months:[5,6,7],quote:'夏三月，此谓蕃秀。天地气交，万物华实。夜卧早起，无厌于日，使志无怒，使华英成秀，使气得泄，若所爱在外，此夏气之应，养长之道也；逆之则伤心。',tip:'夏季养生重在养心。夜卧早起，无厌于日（适当晒太阳不出汗），使志无怒（保持心情愉快不郁怒），饮食清淡多食苦（清心火）。逆之伤心。'},
      autumn: {name:'秋季',emoji:'🍂',focus:'养肺润燥，早卧早起',months:[8,9,10],quote:'秋三月，此谓容平。天气以急，地气以明。早卧早起，与鸡俱兴，使志安宁，以缓秋刑，收敛神气，使秋气平，无外其志，使肺气清，此秋气之应，养收之道也；逆之则伤肺。',tip:'秋季养生重在养肺。早卧早起（与鸡俱兴），使志安宁（保持内心宁静），食酸敛肺防秋燥（多吃白色食物）。逆之伤肺。'},
      winter: {name:'冬季',emoji:'❄️',focus:'养肾保暖，早卧晚起',months:[11,12,1],quote:'冬三月，此谓闭藏。水冰地坼，无扰乎阳。早卧晚起，必待日光，使志若伏若匿，若有私意，若已有得，去寒就温，无泄皮肤，使气亟夺，此冬气之应，养藏之道也；逆之则伤肾。',tip:'冬季养生重在养肾。早卧晚起（必待日光，等太阳升起再起床），使志若伏若匿（情志内藏不外露），食咸补肾（温补食物），去寒就温（注意保暖），无泄皮肤（减少户外出汗）。逆之伤肾。'}
    };
    return packs[s] || packs.spring;
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

  function render() {
    try { renderTodayCard(); } catch(e) { console.error('[render] renderTodayCard 出错:', e); }
    try { renderReminderBanner(); } catch(e) { console.error('[render] renderReminderBanner 出错:', e); }
    try { renderCheckin(); } catch(e) { console.error('[render] renderCheckin 出错:', e); }
    try { renderProfile(); } catch(e) { console.error('[render] renderProfile 出错:', e); }
    try { renderManage(); } catch(e) { console.error('[render] renderManage 出错:', e); }
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

    // 日期行：日期 + 农历 + 节气
    let dateExtras = `${lunar.monthStr}月${lunar.dayStr}`;
    if (solarTerm) {
      dateExtras += ` · ${solarTerm.emoji} ${solarTerm.name}`;
    }
    const dateEl = document.getElementById('todayDate');
    if (dateEl) dateEl.innerHTML = `<span class="day-num">${d.getDate()}</span><span class="weekday">日 ${d.getMonth()+1}月 · 周${weekDay}</span>`;
    const lunarEl = document.getElementById('todayLunar');
    if (lunarEl) lunarEl.textContent = dateExtras;

    // 清除 badges（节气已合并到日期行），改为显示积分
    const badgesEl = document.getElementById('todayBadges');
    if (badgesEl) {
      const points = getUserPoints();
      badgesEl.innerHTML = `<span class="mini-points-badge" title="累计积分">⭐ ${points} 积分</span>`;
    }

    let tipText = pack.quote || (solarTerm ? solarTerm.tip : pack.tip);
    const tipEl = document.getElementById('todaySeasonTip');
    if (tipEl) tipEl.innerHTML = tipText;

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
      const tp = h.timePeriod || 'daytime';
      const defaults = {morning:420, forenoon:600, afternoon:840, evening:1260, daytime:720};
      return defaults[tp] || 720;
    }

    const isChecked = App.Core.Storage.isHabitChecked;

    const items = [];
    const todayDow = now.getDay();
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const repeat = h.repeat || [0,1,2,3,4,5,6];
      if (!repeat.includes(todayDow)) return;
      const checked = isChecked(h, rec);
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
    const ringFg = document.getElementById('ringFg');
    const ringPct = document.getElementById('ringPct');
    if (ringFg) ringFg.style.strokeDashoffset = offset;
    if (ringPct) ringPct.textContent = pct + '%';

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
          <div class="stat-card" style="background:linear-gradient(135deg,rgba(255,215,0,0.08),rgba(255,215,0,0.02));border-color:rgba(255,215,0,0.2)"><div class="stat-val">⭐${points}</div><div class="stat-label">累计积分</div></div>
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

  function renderHeatmap() {
    const year = heatmapDate.getFullYear();
    const month = heatmapDate.getMonth();
    const monthEl = document.getElementById('heatmapMonth');
    if (monthEl) monthEl.textContent = `${year}年${month+1}月`;
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;
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

      const collapsed = false; // Default: all expanded

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

    // Icon picker options
    const iconOptions = ['🌅','☀️','🌙','💧','🏃','🧘','📖','💤','🍵','🍎','💊','💪',
      '🚶','🏋️','🎯','🌿','🧠','❤️','😊','🙏','✍️','🎨','🎵','📝'];

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

    // Icon picker
    html += `<div class="he-label">选择图标</div>
      <div class="he-icon-grid">`;
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
      const activeStyle = isActive ? 'background:var(--accent);color:#fff' : 'background:var(--bg);color:var(--muted)';
      html += `<div class="repeat-day-btn${activeClass}" data-day="${i}" style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;${activeStyle}" onclick="App.UI.Render.toggleEditRepeatDay(this,${i})">${d}</div>`;
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

    // Enabled
    html += `<div class="he-switch-row">
      <span class="he-switch-label">✅ 启用习惯</span>
      <div class="mg-item-toggle ${enabled ? 'on' : ''}" onclick="this.classList.toggle('on')" id="heEnabledToggle"></div>
    </div>`;

    // Actions
    html += `<div class="he-actions">
      <button class="he-btn he-btn-delete" onclick="App.UI.Render.deleteHabitConfirm('${habit.id}')">🗑️ 删除</button>
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

  function toggleEditRepeatDay(el, day) {
    el.classList.toggle('active');
    if (el.classList.contains('active')) {
      el.style.background = 'var(--accent)';
      el.style.color = '#fff';
    } else {
      el.style.background = 'var(--bg)';
      el.style.color = 'var(--muted)';
    }
    // Update hidden field
    const activeDays = [];
    document.querySelectorAll('.repeat-day-btn.active').forEach(btn => {
      activeDays.push(btn.dataset.day);
    });
    document.getElementById('heRepeat').value = activeDays.join(',');
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

    habit.enabled = document.getElementById('heEnabledToggle').classList.contains('on');

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
      { icon:'📊', label:'统计', gradient:'linear-gradient(135deg,#e8f5e9,#c8e6c9)', action:'stats' },
      { icon:'⏳', label:'子午流注', gradient:'linear-gradient(135deg,#e3f2fd,#bbdefb)', action:'clock' },
      { icon:'🛡️', label:'五劳防护', gradient:'linear-gradient(135deg,#fff3e0,#ffe0b2)', action:'wulao' },
      { icon:'🩺', label:'体质测试', gradient:'linear-gradient(135deg,#fce4ec,#f8bbd0)', action:'constitution' },
      { icon:'🎨', label:'皮肤', gradient:'linear-gradient(135deg,#ede7f6,#d1c4e9)', action:'skin' },
      { icon:'📈', label:'健康报告', gradient:'linear-gradient(135deg,#e8eaf6,#c5cae9)', action:'healthReport' },
      { icon:'📋', label:'养生总结', gradient:'linear-gradient(135deg,#f1f8e9,#dcedc8)', action:'healthSummary' },
      { icon:'💾', label:'数据管理', gradient:'linear-gradient(135deg,#efebe9,#d7ccc8)', action:'data' },
      { icon:'📚', label:'参考文献', gradient:'linear-gradient(135deg,#fff8e1,#ffecb3)', action:'ref' },
      { icon:'📖', label:'使用教程', gradient:'linear-gradient(135deg,#f9fbe7,#f0f4c3)', action:'guide' },
    ];

    grid.innerHTML = items.map(item => `
      <button class="profile-grid-item" onclick="handleProfileGridClick('${item.action}')">
        <div class="pg-icon" style="background:${item.gradient}">${item.icon}</div>
        <span class="pg-label">${item.label}</span>
      </button>
    `).join('');
  }

  window.handleProfileGridClick = function(action) {
    switch(action) {
      case 'stats': openStatsDetailPanel(); break;
      case 'clock': App.UI.Panels.openClockPanel(); break;
      case 'wulao': App.UI.Panels.openWulaoPanel(); break;
      case 'constitution': App.Modules.Constitution.openConstitutionPanel(); break;
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

  function renderSdWeekBarChart() {
    const container = document.getElementById('sdWeekBarChart');
    if (!container) return;

    const weekDays = ['日','一','二','三','四','五','六'];
    const today = new Date();
    let html = '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:8px 0">';
    let maxVal = 1;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - today.getDay() + i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      let done = 0;
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        if (rec[h.id] && rec[h.id].done) done++;
      });
      if (done > maxVal) maxVal = done;
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - today.getDay() + i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      let done = 0;
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        if (rec[h.id] && rec[h.id].done) done++;
      });
      const total = habitsConfig.filter(h => h.enabled !== false).length;
      const pct = total > 0 ? (done / total) : 0;
      const h = Math.max(4, Math.round(pct * 100));
      const isToday = key === formatDate(today);
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <span style="font-size:10px;color:var(--muted);font-weight:700">${done}</span>
        <div style="width:100%;max-width:32px;height:${h}px;background:${isToday ? 'linear-gradient(180deg,var(--accent),var(--accent2))' : 'var(--accent-light)'};border-radius:6px 6px 4px 4px;transition:height .5s ease"></div>
        <span style="font-size:10px;color:${isToday ? 'var(--accent)' : 'var(--muted)'};font-weight:${isToday ? 700 : 400}">${weekDays[i]}</span>
      </div>`;
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
    const year = sdHeatmapDate.getFullYear();
    const month = sdHeatmapDate.getMonth();
    const monthEl = document.getElementById('sdHeatmapMonth');
    const grid = document.getElementById('sdHeatmapGrid');
    if (!grid) return;
    if (monthEl) monthEl.textContent = `${year}年${month+1}月`;

    const dayLabels = ['一','二','三','四','五','六','日'];
    let html = dayLabels.map(l => `<div class="heatmap-day-label">${l}</div>`).join('');

    const firstDay = new Date(year, month, 1);
    let startWeekday = firstDay.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDate(new Date());

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

        const rec = (window.checkinRecords && window.checkinRecords[dateStr]) || {};
        const cfg = window.habitsConfig || [];
        let doneCount = 0;
        let total = 0;
        cfg.forEach(h => {
          if (h.enabled === false) return;
          total++;
          if (h.type === 'water') {
            if (((rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000)) doneCount++;
          } else if (h.negative) {
            if ((rec[h.id] && rec[h.id].done) && !rec[h.id].failed) doneCount++;
          } else {
            if (rec[h.id] && rec[h.id].done) doneCount++;
          }
        });

        const ratio = total > 0 ? doneCount / total : -1;
        let level = 0;
        if (ratio > 0 && ratio <= 0.25) level = 1;
        else if (ratio > 0.25 && ratio <= 0.5) level = 2;
        else if (ratio > 0.5 && ratio <= 0.75) level = 3;
        else if (ratio > 0.75) level = 4;

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

      habitsConfig.forEach(h => {
        totalPossible++;
        habitStats[h.id] = habitStats[h.id] || {name:h.name, icon:h.icon, done:0, total:0};
        habitStats[h.id].total++;

        if (h.type === 'water') {
          if (((rec && rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000)) {
            totalCheckins++;
            habitStats[h.id].done++;
            dayHasAny = true;
          }
        } else if (h.negative) {
          if ((rec && rec[h.id] && rec[h.id].done) && !rec[h.id].failed) {
            totalCheckins++;
            habitStats[h.id].done++;
            dayHasAny = true;
          }
        } else {
          if ((rec && rec[h.id] && rec[h.id].done)) {
            totalCheckins++;
            habitStats[h.id].done++;
            dayHasAny = true;
          }
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
    renderSdYearReview
  };

  if (App.registerModule) {
    App.registerModule('ui.render', 'ui', null);
  }
})();

// 全局删除习惯函数（供管理页面调用）
window.deleteHabitFromManage = function(habitId) {
  if (!confirm('确定要删除这个习惯吗？打卡记录会保留。')) return;
  const idx = habitsConfig.findIndex(h => h.id === habitId);
  if (idx >= 0) {
    habitsConfig.splice(idx, 1);
    App.Core.Storage.saveConfig();
    App.UI.Render.renderManage();
    App.UI.Render.renderCheckin();
    App.Core.Utils.showToast('已删除习惯');
  }
};

