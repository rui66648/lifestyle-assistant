(function() {
  const isChecked = App.Core.Storage.isHabitChecked;

  function getStreak(habitId) {
    let streak = 0;
    const d = new Date();
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return 0;
    while (true) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (isChecked(h, rec)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function getMaxStreak(habitId) {
    let max = 0, cur = 0;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return 0;
    const dates = Object.keys(checkinRecords).sort();
    if (dates.length === 0) return 0;
    const start = new Date(dates[0]);
    const end = new Date();
    const d = new Date(start);
    while (d <= end) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (isChecked(h, rec)) { cur++; max = Math.max(max, cur); }
      else cur = 0;
      d.setDate(d.getDate() + 1);
    }
    return max;
  }

  function getCompletionRate(habitId, days) {
    let done = 0;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return 0;
    const d = new Date();
    for (let i = 0; i < days; i++) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (isChecked(h, rec)) done++;
      d.setDate(d.getDate() - 1);
    }
    return Math.round((done / days) * 100);
  }

  function getWeekRate() {
    if (habitsConfig.length === 0) return 0;
    let total = 0, done = 0;
    const d = new Date();
    for (let i = 0; i < 7; i++) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      habitsConfig.forEach(h => {
        total++;
        if (isChecked(h, rec)) done++;
      });
      d.setDate(d.getDate() - 1);
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function getMonthRate() {
    if (habitsConfig.length === 0) return 0;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let total = 0, done = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      const rec = checkinRecords[key];
      habitsConfig.forEach(h => {
        total++;
        if (isChecked(h, rec)) done++;
      });
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function getTodayDone() {
    const rec = checkinRecords[today()] || {};
    return habitsConfig.filter(h => h.enabled !== false && isChecked(h, rec)).length;
  }

  function getTodayTotal() {
    return habitsConfig.filter(h => h.enabled !== false).length;
  }

  function getMaxStreakAll() {
    let max = 0, cur = 0;
    const dates = Object.keys(checkinRecords).sort();
    if (dates.length === 0) return 0;
    const start = new Date(dates[0]);
    const end = new Date();
    const d = new Date(start);
    while (d <= end) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      const hasAny = rec && habitsConfig.some(h => isChecked(h, rec));
      if (hasAny) { cur++; max = Math.max(max, cur); }
      else cur = 0;
      d.setDate(d.getDate() + 1);
    }
    return max;
  }

  function getHealthTipText(habitId, existingTip) {
    if (existingTip) return existingTip;
    const tips = HEALTH_TIPS.filter(t => t.habit === habitId);
    if (tips.length > 0) return tips[Math.floor(Date.now() / 86400000) % tips.length].text;
    return '';
  }

  function getHealthTipSource(habitId) {
    const tips = HEALTH_TIPS.filter(t => t.habit === habitId);
    if (tips.length > 0) return tips[Math.floor(Date.now() / 86400000) % tips.length].refBook;
    return '建议';
  }

  /** 一键完成：为各类型习惯生成打卡记录；select 需手动选择，返回 null */
  function buildBatchCompleteRecord(h) {
    if (!h || h.type === 'select') return null;
    if (h.type === 'water') {
      var goal = (h.waterConfig && h.waterConfig.dailyGoal) || 2000;
      return { done: true, value: goal };
    }
    if (h.negative) return { done: true, failed: false, value: 1 };
    if (h.type === 'boolean') return { done: true, value: 1 };
    if (h.type === 'count' || h.type === 'timer') {
      return { done: true, value: h.goal || 1 };
    }
    return { done: true, value: 1 };
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Checkin = {
    getStreak,
    getMaxStreak,
    getCompletionRate,
    getWeekRate,
    getMonthRate,
    getTodayDone,
    getTodayTotal,
    getMaxStreakAll,
    getHealthTipText,
    getHealthTipSource,
    buildBatchCompleteRecord
  };

  if (App.registerModule) {
    App.registerModule('modules.checkin', 'modules', null);
  }
})();
// habit.js - 习惯管理模块（所有功能已迁移至 js/ui/events.js 和 js/ui/panels.js）
// 此文件仅保留空占位，避免其他模块引用报错
(function() {
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};
  if (!App.Modules.Habit) App.Modules.Habit = {};

  if (App.registerModule) {
    App.registerModule('modules.habit', 'modules', null);
  }
})();
// stats.js - 统计模块（函数定义已统一至 js/ui/render.js 和 js/ui/events.js）
// 仅保留 renderWeekBarChart（唯一未被重复定义的函数）
(function() {
  function renderWeekBarChart(containerId) {
    const container = document.getElementById(containerId || 'weekBarChart');
    if (!container) return;

    const dayNames = ['日','一','二','三','四','五','六'];
    const today = new Date();
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      let done = 0, total = 0;
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        total++;
        if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec)) done++;
      });
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      data.push({ day: dayNames[d.getDay()], date: `${d.getMonth()+1}/${d.getDate()}`, pct, isToday: i === 0 });
    }

    const maxH = 120;
    let html = '<div style="display:flex;align-items:flex-end;justify-content:space-between;height:' + (maxH + 30) + 'px;gap:8px">';
    data.forEach(d => {
      const h = Math.max(2, (d.pct / 100) * maxH);
      const isToday = d.isToday;
      const color = isToday ? 'background:linear-gradient(180deg,var(--accent),var(--accent2))' : 'background:var(--accent-light)';
      html += `<div style="flex:1;text-align:center">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;font-weight:${isToday?'700':'400'}">${d.pct}%</div>
        <div style="width:100%;height:${h}px;${color};border-radius:6px 6px 4px 4px;margin:0 auto;transition:height .5s"></div>
        <div style="font-size:11px;color:${isToday?'var(--accent)':'var(--muted)'};margin-top:4px;font-weight:${isToday?'700':'400'}">${d.isToday ? '今天' : d.day}</div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Stats = {
    renderWeekBarChart
  };

  if (App.registerModule) {
    App.registerModule('modules.stats', 'modules', null);
  }
})();
// water.js - 饮水追踪模块
(function() {
  function renderWaterTracker(h, rec) {
    const wc = h.waterConfig || {dailyGoal:2000, perCup:250};
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

    let cupsViz = `<div class="water-cups-row">`;
    for (let i = 0; i < totalCups; i++) {
      const filled = i < doneCups;
      const isNext = i === doneCups;
      const clickAttr = filled ? '' : `onclick="quickAddWater('${h.id}',${perCup})"`;

      cupsViz += `<div class="water-cup-item">
        <div class="water-cup ${filled ? 'filled' : ''} ${isNext ? 'next' : ''}" ${clickAttr} title="${filled ? '已喝 ✓' : '点击记录一杯'}">
          <span class="water-cup-num">${i+1}</span>
          ${filled ? '<span class="water-cup-check">✓</span>' : ''}
        </div>
      </div>`;
    }
    cupsViz += `</div>`;

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
      <div class="water-quick-row" style="margin:8px 0">
        <span class="water-qty-group">
          <button class="water-qty-btn" onclick="quickAddWater('${h.id}',${Math.round(perCup/2)})">${Math.round(perCup/2)}ml</button>
          <button class="water-qty-btn primary" onclick="quickAddWater('${h.id}',${perCup})">${perCup}ml</button>
          <button class="water-qty-btn" onclick="quickAddWater('${h.id}',${perCup*2})">${perCup*2}ml</button>
        </span>
        <button class="water-custom-btn" onclick="openWaterInputPanel('${h.id}')" title="自定义量">✏️ 自定义</button>
      </div>
      ${cupsHtml}
    </div>`;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Water = {
    renderWaterTracker
  };

  if (App.registerModule) {
    App.registerModule('modules.water', 'modules', null);
  }
})();
(function() {
  const dietTips = [
    {tip:'五谷为养，五果为助，五畜为益，五菜为充。',source:'《素问·藏气法时论》'},
    {tip:'饮食自倍，肠胃乃伤。',source:'《素问·痹论》'},
    {tip:'早饭好，午饭饱，晚饭少。',source:'民间养生谚语'},
    {tip:'进食顺序：先吃蔬菜→再吃蛋白质→最后吃碳水，可降低血糖峰值。',source:'《控糖革命》'},
    {tip:'成年人每天建议饮水1500-2000ml，少量多次。',source:'现代营养学'},
    {tip:'胃以喜为补，适合自己的才是最好的。',source:'中医养生理念'},
    {tip:'早饭吃得像皇帝，午饭吃得像平民，晚饭吃得像乞丐。',source:'民间养生谚语'},
    {tip:'细嚼慢咽，每口饭咀嚼20次以上，有助于消化吸收。',source:'传统养生智慧'},
    {tip:'春季省酸增甘，以养脾气；夏季省苦增辛，以养肺气。',source:'《黄帝内经》四季养生'},
    {tip:'秋季省辛增酸，以养肝气；冬季省咸增苦，以养心气。',source:'《黄帝内经》四季养生'},
    {tip:'五色入五脏：青入肝、赤入心、黄入脾、白入肺、黑入肾。',source:'中医五行理论'},
    {tip:'不渴也要喝水，不饿也要吃饭，不累也要休息，无病也要锻炼。',source:'民间养生谚语'},
  ];

  const fiveColorsFoods = [
    {color:'青',organ:'肝',icon:'🥬',foods:['菠菜','西兰花','芹菜','黄瓜','绿豆']},
    {color:'赤',organ:'心',icon:'🍅',foods:['西红柿','红枣','红豆','胡萝卜','草莓']},
    {color:'黄',organ:'脾',icon:'🌽',foods:['小米','玉米','南瓜','山药','黄豆']},
    {color:'白',organ:'肺',icon:'🥔',foods:['白萝卜','银耳','百合','梨','豆腐']},
    {color:'黑',organ:'肾',icon:'🫘',foods:['黑豆','黑芝麻','黑米','黑木耳','紫菜']},
  ];

  const mealTips = {
    breakfast: {
      title:'早餐',
      time:'7:00-9:00',
      icon:'🥣',
      desc:'辰时胃经当令，营养吸收最佳',
      tips:['一定要吃早餐','碳水+蛋白质+蔬果搭配','不要吃得太急','温热食物为宜'],
    },
    lunch: {
      title:'午餐',
      time:'11:30-13:30',
      icon:'🍱',
      desc:'午时心经当令，午餐后宜小憩',
      tips:['吃饱但不要过饱','荤素搭配均衡','饭后散步10分钟','避免马上午睡'],
    },
    dinner: {
      title:'晚餐',
      time:'17:30-19:30',
      icon:'🍲',
      desc:'酉时肾经当令，晚餐宜早宜少',
      tips:['七分饱即可','清淡少油少盐','睡前3小时不吃东西','多吃蔬菜少吃肉'],
    },
  };

  function getDietTipOfDay() {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return dietTips[dayOfYear % dietTips.length];
  }

  function getCurrentMeal() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 10) return 'breakfast';
    if (hour >= 11 && hour < 14) return 'lunch';
    if (hour >= 17 && hour < 20) return 'dinner';
    return null;
  }

  function getSeasonalTip() {
    const month = new Date().getMonth() + 1;
    const tips = {
      '春季':{months:[2,3,4],tip:'省酸增甘，以养脾气。多吃甘味食物如红枣、山药、小米。',icon:'🌱'},
      '夏季':{months:[5,6,7],tip:'清淡为主，适当食苦味清心火。多吃苦瓜、莲子、绿豆。',icon:'☀️'},
      '秋季':{months:[8,9,10],tip:'省辛增酸，以养肝气。多吃酸味食物如山楂、乌梅、石榴。',icon:'🍂'},
      '冬季':{months:[11,12,1],tip:'省咸增苦，以养心气。多吃黑色食物如黑豆、黑芝麻、核桃。',icon:'❄️'},
    };
    for (const [season, info] of Object.entries(tips)) {
      if (info.months.includes(month)) {
        return {season,...info};
      }
    }
    return {season:'四季',tip:'饮食有节，起居有常。',icon:'🌍'};
  }

  function renderDietPanel() {
    const tipOfDay = getDietTipOfDay();
    const currentMeal = getCurrentMeal();
    const seasonal = getSeasonalTip();

    let mealSection = '';
    if (currentMeal && mealTips[currentMeal]) {
      const meal = mealTips[currentMeal];
      mealSection = `
        <div class="diet-meal-card">
          <div class="diet-meal-header">
            <span class="diet-meal-icon">${meal.icon}</span>
            <div>
              <div class="diet-meal-title">${meal.title} · ${meal.time}</div>
              <div class="diet-meal-desc">${meal.desc}</div>
            </div>
          </div>
          <div class="diet-meal-tips">
            ${meal.tips.map(t => `<div class="diet-meal-tip">✅ ${t}</div>`).join('')}
          </div>
        </div>
      `;
    }

    let fiveColorsHtml = '';
    fiveColorsFoods.forEach(item => {
      fiveColorsHtml += `
        <div class="diet-color-card">
          <div class="diet-color-icon">${item.icon}</div>
          <div class="diet-color-name">${item.color}色入${item.organ}</div>
          <div class="diet-color-foods">${item.foods.join('、')}</div>
        </div>
      `;
    });

    const dietHabits = habitsConfig.filter(h => h.category === 'diet' || h.category === 'quit');
    let todayDietRec = checkinRecords[App.Core.Utils.today()] || {};
    let completedDiet = 0;
    dietHabits.forEach(h => {
      if (todayDietRec[h.id] && todayDietRec[h.id].done) completedDiet++;
    });

    return `
      <div class="diet-panel">
        <div class="diet-tip-card">
          <div class="diet-tip-icon">💡</div>
          <div class="diet-tip-content">
            <div class="diet-tip-text">"${tipOfDay.tip}"</div>
            <div class="diet-tip-source">—— ${tipOfDay.source}</div>
          </div>
        </div>

        <div class="diet-summary">
          <div class="diet-summary-item">
            <span class="diet-summary-val">${completedDiet}/${dietHabits.length}</span>
            <span class="diet-summary-label">今日饮食习惯</span>
          </div>
          <div class="diet-summary-divider"></div>
          <div class="diet-summary-item">
            <span class="diet-summary-val">${seasonal.icon} ${seasonal.season}</span>
            <span class="diet-summary-label">当前节气</span>
          </div>
        </div>

        <div class="diet-section-title">🌿 节气饮食</div>
        <div class="diet-seasonal-card">
          <span class="diet-seasonal-icon">${seasonal.icon}</span>
          <div class="diet-seasonal-text">${seasonal.tip}</div>
        </div>

        ${mealSection}

        <div class="diet-section-title">🎨 五色饮食</div>
        <div class="diet-colors-grid">
          ${fiveColorsHtml}
        </div>

        <div class="diet-section-title">📚 饮食相关习惯</div>
        <div class="diet-habits-list">
          ${dietHabits.map(h => {
            const done = todayDietRec[h.id] && todayDietRec[h.id].done;
            return `
              <div class="diet-habit-item ${done ? 'done' : ''}" onclick="handleCheckin('${h.id}')">
                <span class="diet-habit-icon">${h.icon}</span>
                <span class="diet-habit-name">${h.name}</span>
                <span class="diet-habit-check">${done ? '✓' : '打卡'}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="diet-section-title">📖 推荐阅读</div>
        <div class="diet-books-list">
          <div class="diet-book-item" onclick="window.open('references/饮膳正要/饮膳正要.html','_blank')">
            <span class="diet-book-emoji">🍲</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《饮膳正要》</div>
              <div class="diet-book-desc">元代宫廷营养学专著</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
          <div class="diet-book-item" onclick="window.open('references/你是你吃出来的/你是你吃出来的.html','_blank')">
            <span class="diet-book-emoji">🥗</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《你是你吃出来的》</div>
              <div class="diet-book-desc">细胞营养与七大营养素</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
          <div class="diet-book-item" onclick="window.open('references/控糖革命/控糖革命.html','_blank')">
            <span class="diet-book-emoji">🍬</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《控糖革命》</div>
              <div class="diet-book-desc">血糖管理与健康饮食</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    `;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Diet = {
    renderDietPanel,
    getDietTipOfDay,
    getCurrentMeal,
    getSeasonalTip,
  };

  if (App.registerModule) {
    App.registerModule('modules.diet', 'modules', null);
  }
})();(function() {
  function loadSportsData() {
    if (!App.Data.Sports) {
      App.Data.Sports = {
        records: [],
        weeklyStats: { aerobic: 0, strength: 0, coordination: 0 },
      };
    }
    const saved = localStorage.getItem('sports_records');
    if (saved) {
      try {
        App.Data.Sports.records = JSON.parse(saved);
      } catch(e) {}
    }
  }

  function updateWeeklyStats() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const records = App.Data.Sports.records || [];
    const weekRecords = records.filter(r => r.date >= weekStartStr);

    const stats = { aerobic: 0, strength: 0, coordination: 0 };
    weekRecords.forEach(r => {
      if (stats[r.category] !== undefined) {
        stats[r.category] += r.value;
      }
    });

    App.Data.Sports.weeklyStats = stats;
    return stats;
  }

  function quickCheckin(sportId) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    const today = new Date().toISOString().split('T')[0];
    const record = {
      id: `sport_${sportId}_${Date.now()}`,
      sportId: sportId,
      sportName: sport.name,
      sportIcon: sport.icon,
      category: sport.category,
      value: sport.target,
      unit: sport.unit,
      date: today,
      time: new Date().toTimeString().slice(0, 5),
    };

    if (!App.Data.Sports.records) App.Data.Sports.records = [];
    App.Data.Sports.records.push(record);
    localStorage.setItem('sports_records', JSON.stringify(App.Data.Sports.records));

    if (App.Core && App.Core.Utils && App.Core.Utils.showToast) {
      App.Core.Utils.showToast(`${sport.icon} ${sport.name} 已打卡 ${sport.target}${sport.unit}！`);
    }
    updateWeeklyStats();
  }

  function showCheckinDialog(sportId) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog">
        <div class="dialog-header">
          <span>${sport.icon} ${sport.name}</span>
          <button class="dialog-close">✕</button>
        </div>
        <div class="dialog-body">
          <div class="dialog-tip">${sport.tip}</div>
          <div class="dialog-input-group">
            <label>完成 ${sport.unit}</label>
            <input type="number" id="sportsValueInput" value="${sport.target}" min="1" placeholder="输入数值">
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn cancel">取消</button>
          <button class="dialog-btn confirm">确认打卡</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.cancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.confirm').addEventListener('click', () => {
      const value = parseInt(document.getElementById('sportsValueInput').value) || sport.target;
      confirmCheckin(sportId, value);
      dialog.remove();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  function confirmCheckin(sportId, value) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    const today = new Date().toISOString().split('T')[0];
    const record = {
      id: `sport_${sportId}_${Date.now()}`,
      sportId: sportId,
      sportName: sport.name,
      sportIcon: sport.icon,
      category: sport.category,
      value: value,
      unit: sport.unit,
      date: today,
      time: new Date().toTimeString().slice(0, 5),
    };

    if (!App.Data.Sports.records) App.Data.Sports.records = [];
    App.Data.Sports.records.push(record);
    localStorage.setItem('sports_records', JSON.stringify(App.Data.Sports.records));

    if (App.Core && App.Core.Utils && App.Core.Utils.showToast) {
      App.Core.Utils.showToast(`${sport.icon} ${sport.name} 已打卡 ${value}${sport.unit}！`);
    }
    updateWeeklyStats();
  }

  function getCurrentMeridian() {
    const meridianSports = App.Data.MeridianSports;
    const now = new Date();
    const hour = now.getHours();
    return meridianSports.find(m => hour >= m.start && hour < m.end) || meridianSports[0];
  }

  function getRandomQuote() {
    const quotes = App.Data.SportQuotes;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  function getSportsHabits() {
    if (!window.habitsConfig || !window.checkinRecords || !App || !App.Core || !App.Core.Utils) {
      return { habits: [], completed: 0, total: 0 };
    }
    const sportsHabits = habitsConfig.filter(h => h.category === 'sports');
    const today = App.Core.Utils.today();
    const todayRec = checkinRecords[today] || {};
    let completed = 0;
    sportsHabits.forEach(h => {
      if (todayRec[h.id] && todayRec[h.id].done) completed++;
    });
    return { habits: sportsHabits, completed, total: sportsHabits.length };
  }

  function renderSportsPanel() {
    loadSportsData();
    updateWeeklyStats();

    const categories = App.Data.SportsCategories;
    const prescriptions = App.Data.SportPrescriptions;
    const meridianSports = App.Data.MeridianSports;
    const dailyTargets = App.Data.DailyTargets;
    const currentMeridian = getCurrentMeridian();
    const quote = getRandomQuote();
    const hour = new Date().getHours();
    const sportsHabits = getSportsHabits();

    return `
      <div class="sports-panel">
        <div class="sports-prescription">
          <div class="sports-prescription-header">
            <span class="sports-prescription-icon">${currentMeridian.icon}</span>
            <div>
              <div class="sports-prescription-title">${currentMeridian.name} · ${currentMeridian.meridian}</div>
              <div class="sports-prescription-desc">${currentMeridian.highlight ? '⭐ 最佳运动时段' : currentMeridian.action}</div>
            </div>
          </div>
          <div class="sports-daily-targets">
            ${Object.entries(dailyTargets).map(([key, target]) => `
              <div class="sports-target-item">
                <span class="sports-target-label">${target.label}</span>
                <span class="sports-target-value">${target.target}${target.unit}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="sports-quote">
          <div class="sports-quote-text">"${quote.text}"</div>
          <div class="sports-quote-source">—— ${quote.source}</div>
        </div>

        ${sportsHabits.total > 0 ? `
          <div class="sports-summary">
            <div class="sports-summary-item">
              <span class="sports-summary-val">${sportsHabits.completed}/${sportsHabits.total}</span>
              <span class="sports-summary-label">今日运动习惯</span>
            </div>
            <div class="sports-summary-divider"></div>
            <div class="sports-summary-item">
              <span class="sports-summary-val">${currentMeridian.icon} ${currentMeridian.name}</span>
              <span class="sports-summary-label">当前时辰</span>
            </div>
          </div>
        ` : ''}

        <div class="sports-section-title">⚡ 快速打卡</div>
        <div class="sports-quick-cards">
          ${Object.entries(categories).map(([key, cat]) => {
            const sports = App.Data.SportsTypes.filter(s => s.category === key).slice(0, 3);
            return `
              <div class="sports-quick-card" style="--cat-color: ${cat.color}">
                <div class="sports-quick-card-header">
                  <span>${cat.icon}</span>
                  <span>${cat.label}</span>
                </div>
                <div class="sports-quick-card-items">
                  ${sports.map(s => `
                    <button class="sports-quick-btn" onclick="App.Modules.Sports.quickCheckin('${s.id}')">
                      ${s.icon} ${s.name}
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="sports-section-title">📋 全部运动类型</div>
        <div class="sports-type-list">
          ${Object.entries(categories).map(([key, cat]) => `
            <div class="sports-category" style="--cat-color: ${cat.color}">
              <div class="sports-category-header">
                <span>${cat.icon}</span>
                <span>${cat.label}</span>
                <span class="sports-category-desc">${cat.desc}</span>
              </div>
              <div class="sports-category-items">
                ${App.Data.SportsTypes.filter(s => s.category === key).map(s => `
                  <div class="sports-type-item">
                    <span class="sports-type-icon">${s.icon}</span>
                    <div class="sports-type-info">
                      <span class="sports-type-name">${s.name}</span>
                      <span class="sports-type-tip">${s.tip}</span>
                    </div>
                    <button class="sports-type-checkin-btn" onclick="App.Modules.Sports.showCheckinDialog('${s.id}')">打卡</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">💊 运动处方</div>
        <div class="sports-prescription-cards">
          ${Object.values(prescriptions).map(p => `
            <div class="sports-prescription-card">
              <div class="sports-prescription-card-header">
                <span class="sports-prescription-card-icon">${p.icon}</span>
                <span class="sports-prescription-card-title">${p.title}</span>
              </div>
              <div class="sports-prescription-card-body">
                <div class="sports-prescription-card-row">
                  <span>时长</span>
                  <span>${p.duration}</span>
                </div>
                <div class="sports-prescription-card-row">
                  <span>强度</span>
                  <span>${p.intensity}</span>
                </div>
                <div class="sports-prescription-card-row">
                  <span>效果</span>
                  <span>${p.effect}</span>
                </div>
              </div>
              <div class="sports-prescription-card-tip">${p.tip}</div>
              <div class="sports-prescription-card-ref">📖 ${p.ref}</div>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">⏰ 子午流注运动指南</div>
        <div class="sports-meridian-list">
          ${meridianSports.map(m => `
            <div class="sports-meridian-item ${m.highlight ? 'highlight' : ''} ${hour >= m.start && hour < m.end ? 'current' : ''}">
              <span class="sports-meridian-icon">${m.icon}</span>
              <span class="sports-meridian-time">${m.name}</span>
              <span class="sports-meridian-meridian">${m.meridian}</span>
              <span class="sports-meridian-action">${m.action}</span>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">🥗 运动营养</div>
        <div class="sports-nutrition-cards">
          ${Object.values(App.Data.SportNutrition).map(n => `
            <div class="sports-nutrition-card">
              <div class="sports-nutrition-card-header">${n.title}</div>
              <div class="sports-nutrition-card-time">${n.time}</div>
              <div class="sports-nutrition-card-detail">
                <div><strong>碳水</strong>: ${n.carbs}</div>
                <div><strong>蛋白</strong>: ${n.protein}</div>
              </div>
              <div class="sports-nutrition-card-tip">${n.tip}</div>
            </div>
          `).join('')}
        </div>

        ${sportsHabits.total > 0 ? `
          <div class="sports-section-title">📚 运动相关习惯</div>
          <div class="sports-habits-list">
            ${sportsHabits.habits.map(h => {
              const today = App.Core.Utils.today();
              const todayRec = checkinRecords[today] || {};
              const done = todayRec[h.id] && todayRec[h.id].done;
              return `
                <div class="sports-habit-item ${done ? 'done' : ''}" onclick="handleCheckin('${h.id}')">
                  <span class="sports-habit-icon">${h.icon}</span>
                  <span class="sports-habit-name">${h.name}</span>
                  <span class="sports-habit-check">${done ? '✓' : '打卡'}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <div class="sports-section-title">📖 参考文献</div>
        <div class="sports-refs">
          ${App.Data.SportReferences.map(r => `
            <a class="sports-ref-item" href="${r.url}" target="_blank">
              <span>${r.emoji}</span>
              <div class="sports-ref-info">
                <span class="sports-ref-name">${r.name}</span>
                <span class="sports-ref-desc">${r.desc}</span>
              </div>
              <span class="sports-ref-arrow">›</span>
            </a>
          `).join('')}
        </div>

        <div style="height:20px"></div>
      </div>
    `;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Sports = {
    renderSportsPanel,
    quickCheckin,
    showCheckinDialog,
    updateWeeklyStats,
    loadSportsData,
  };

  if (App.registerModule) {
    App.registerModule('modules.sports', 'modules', null);
  }
})();
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
    sel.innerHTML = '<option value="">-- 选择要专注的习惯 --</option>';
    habitsConfig.forEach(h => {
      if (h.enabled !== false) {
        sel.innerHTML += `<option value="${h.id}">${h.icon} ${h.name}</option>`;
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
  window.openPomodoroPanel = openPomodoroPanel;
  window.startPomodoro = startPomodoro;
  window.pausePomodoro = pausePomodoro;
  window.resumePomodoro = resumePomodoro;
  window.stopPomodoro = stopPomodoro;

  if (App.registerModule) {
    App.registerModule('modules.pomodoro', 'modules', null);
  }
})();
(function() {
  'use strict';

  // ============================================================
  // 配置说明
  // ============================================================
  // 用户可在 AI 面板配置界面自行填写 API Key
  // 配置信息存储在 localStorage 中，不会暴露在代码里
  // ============================================================

  // 默认模型（必须在 getConfig 之前定义，避免 TDZ 错误）
  const DEFAULT_MODEL = 'qwen-turbo';

  // 从 localStorage 读取配置
  function getConfig() {
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) {
        const config = JSON.parse(saved);
        return {
          workerUrl: config.workerUrl || '',
          apiKey: config.apiKey || '',
          model: config.model || DEFAULT_MODEL
        };
      }
    } catch (e) {
      console.warn('[AI] 读取配置失败:', e);
    }
    return { workerUrl: '', apiKey: '', model: DEFAULT_MODEL };
  }

  function saveConfig(workerUrl, apiKey, model) {
    try {
      localStorage.setItem('ai_config', JSON.stringify({
        workerUrl: workerUrl || '',
        apiKey: apiKey || '',
        model: model || DEFAULT_MODEL
      }));
    } catch (e) {
      console.warn('[AI] 保存配置失败:', e);
    }
  }

  // 获取当前配置
  let currentConfig = getConfig();

  // 动态获取 Worker URL
  function getWorkerUrl() {
    currentConfig = getConfig();
    return currentConfig.workerUrl;
  }

  // 动态获取 API Key
  function getApiKey() {
    currentConfig = getConfig();
    return currentConfig.apiKey;
  }

  // AI 系统提示词
  const SYSTEM_PROMPT = `你是一位精通以下9部中医古籍和15部现代养生著作的养生顾问。

【古籍经典】
1.《黄帝内经》（《素问》《灵枢》）——中医养生理论之源，阴阳五行、脏腑经络、治未病
2.《遵生八笺》明·高濂——四时调摄、起居安乐、饮馔服食
3.《老老恒言》清·曹庭栋——老年养生，饮食起居导引
4.《饮膳正要》元·忽思慧——宫廷营养学，食疗配方
5.《养生论》三国·嵇康——形神相亲、导引吐纳
6.《寿世青编》清·尤乘——五脏养生，养心为本
7.《备急千金要方·养性》唐·孙思邈——养性之道，饮食药饵
8.《抱朴子》晋·葛洪——道家养生，不伤为本
9.《闲情偶寄》清·李渔——生活美学，颐养之道

【现代著作】
10.《你是你吃出来的》夏萌——细胞营养饮食
11.《九种体质养生全书》王琦——体质分类与调养
12.《科学休息》亚历克斯·索勇-庞——高效休息科学
13.《求医不如求己》中里巴人——经络穴位自愈法
14.《拉伸》鲍勃·安德森——科学拉伸运动
15.《人体运动生理学》——运动科学基础
16.《高级运动营养学》——科学运动营养
17.《力量训练基础》——力量训练方法
18.《运动医学与康复》——运动损伤与康复
19.《睡眠革命》Nick Littlehales——R90睡眠方案
20.《运动改造大脑》John Ratey——运动与脑科学
21.《正念的奇迹》一行禅师——正念冥想
22.《抗炎生活》池谷敏郎——慢性炎症预防
23.《肠子的小心思》朱莉娅·恩德斯——肠道菌群
24.《深度营养》凯瑟琳·沙纳汉——传统饮食智慧

回答时请结合以上经典理论给出建议，并注明引用出处。回答简洁实用，每次控制在200字以内。`;

  // 配置参数
  const MAX_INPUT_LENGTH = 500;      // 最大输入长度
  const MAX_HISTORY = 20;           // 对话历史保留条数
  const MAX_TOKENS = 500;           // AI 回复最大 token 数
  const TEMPERATURE = 0.7;          // 创造性参数

  // 可用模型列表
  const MODEL_OPTIONS = [
    { value: 'qwen-turbo', label: 'qwen-turbo（轻量快速）' },
    { value: 'qwen-plus', label: 'qwen-plus（标准推荐）' },
    { value: 'qwen-max', label: 'qwen-max（最强智能）' },
    { value: 'qwen-coder-plus', label: 'qwen-coder-plus（编程专用）' },
    { value: 'deepseek-v3', label: 'deepseek-v3（深度推理）' },
    { value: 'deepseek-r1', label: 'deepseek-r1（推理增强）' }
  ];

  // 状态
  let aiChatHistory = [];
  let isLoading = false;

  // ============================================================
  // 存储管理
  // ============================================================
  const STORAGE_KEY = 'ai_chat_history';

  function loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        aiChatHistory = JSON.parse(saved);
        if (!Array.isArray(aiChatHistory)) {
          aiChatHistory = [];
        }
      }
    } catch (e) {
      console.warn('[AI] 加载历史记录失败:', e);
      aiChatHistory = [];
    }
  }

  function saveHistory() {
    try {
      // 只保存最近的消息，避免 localStorage 溢出
      const toSave = aiChatHistory.slice(-MAX_HISTORY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('[AI] 保存历史记录失败:', e);
    }
  }

  function clearHistory() {
    aiChatHistory = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  // ============================================================
  // 验证配置
  // ============================================================
  function isConfigured() {
    const cfg = getConfig();
    return cfg.apiKey.trim() !== '';
  }

  function isUsingWorker() {
    const cfg = getConfig();
    return cfg.workerUrl.trim() !== '' && cfg.apiKey.trim() !== '';
  }

  // ============================================================
  // UI 渲染（使用 textContent 防止 XSS）
  // ============================================================
  function openAiChatPanel() {
    const inputArea = document.getElementById('aiChatInputArea');
    const unconfiguredArea = document.getElementById('aiChatUnconfigured');
    const msgContainer = document.getElementById('aiChatMessages');

    // 检查配置状态
    if (!isConfigured()) {
      if (inputArea) inputArea.style.display = 'none';
      if (unconfiguredArea) unconfiguredArea.style.display = 'block';
      if (msgContainer) msgContainer.innerHTML = '';
    } else {
      if (inputArea) inputArea.style.display = 'flex';
      if (unconfiguredArea) unconfiguredArea.style.display = 'none';
    }

    // 渲染历史消息或欢迎语
    if (msgContainer) {
      msgContainer.innerHTML = '';

      if (aiChatHistory.length === 0) {
        // 添加日期分隔线
        renderDateDivider();
        // 欢迎语（带特殊样式）
        renderAiMessage('ai', '你好！我是你的 AI 养生顾问 🌿\n\n精通《黄帝内经》等24部中医经典与现代养生著作，有任何养生问题都可以问我：\n\n• 失眠怎么调理？\n• 夏天应该注意什么？\n• 久坐怎么保护身体？', true);
      } else {
        // 渲染历史消息
        renderDateDivider();
        aiChatHistory.forEach(msg => {
          renderAiMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, false);
        });
      }
    }

    openPanel('aiChatPanel');

    // 聚焦输入框
    setTimeout(() => {
      const input = document.getElementById('aiChatInput');
      if (input) input.focus();
    }, 300);
  }

  // 日期分隔线
  function renderDateDivider() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-divider';
    const now = new Date();
    const hours = now.getHours();
    let timeStr = '今天 ';
    if (hours < 6) timeStr += '凌晨';
    else if (hours < 12) timeStr += '上午';
    else if (hours < 14) timeStr += '中午';
    else if (hours < 18) timeStr += '下午';
    else timeStr += '晚上';
    div.innerHTML = '<span>' + timeStr + '</span>';
    container.appendChild(div);
  }

  function renderAiMessage(role, text, isWelcome = false) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-msg ' + role + (isWelcome ? ' welcome-msg' : '');

    // XSS 安全：使用 textContent 转义用户内容和 AI 回复
    const avatar = role === 'ai' ? '🤖' : '👤';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = avatar;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    // textContent 会自动转义 HTML 标签
    bubbleEl.textContent = text;
    // 把换行符转回 <br>
    bubbleEl.innerHTML = bubbleEl.innerHTML.replace(/\n/g, '<br>');

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);

    // 滚动到底部
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);
  }

  function renderAiError(text) {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'ai-msg ai ai-error';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = '🤖';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    bubbleEl.textContent = '⚠️ ' + text;
    bubbleEl.innerHTML = bubbleEl.innerHTML.replace(/\n/g, '<br>');

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function renderAiLoading() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    const div = document.createElement('div');
    div.id = 'aiLoading';
    div.className = 'ai-msg ai';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = '🤖';

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    bubbleEl.innerHTML = '<div class="ai-loading"><span></span><span></span><span></span></div>';

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeAiLoading() {
    const el = document.getElementById('aiLoading');
    if (el) el.remove();
  }

  // ============================================================
  // 发送消息
  // ============================================================
  async function sendAiMessage() {
    if (!isConfigured()) {
      return;
    }

    if (isLoading) {
      return;
    }

    const input = document.getElementById('aiChatInput');
    const sendBtn = document.getElementById('aiSendBtn');
    if (!input) return;

    let text = input.value.trim();

    // 检查输入长度
    if (text.length === 0) {
      return;
    }

    if (text.length > MAX_INPUT_LENGTH) {
      renderAiError('输入太长了，请控制在 ' + MAX_INPUT_LENGTH + ' 字以内。');
      return;
    }

    // 清空输入框并禁用按钮
    input.value = '';
    isLoading = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn._originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = '⏳';
    }

    // 显示用户消息
    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text });

    // 显示加载动画
    renderAiLoading();

    try {
      let response;
      let data;

      if (isUsingWorker()) {
        // 方式1：使用 Worker 代理（安全）
        const workerUrl = getWorkerUrl();
        const apiKey = getApiKey();
        const userMessages = aiChatHistory;

        const model = currentConfig.model || DEFAULT_MODEL;
        response = await fetch(workerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: model,
            messages: userMessages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE
          })
        });

        data = await response.json();

        // 检查业务错误
        if (data.error) {
          const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || data.error);
          throw new Error(errMsg || 'AI 服务返回错误');
        }

        // 解析 OpenAI 格式响应
        const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!reply) {
          throw new Error('AI 没有返回有效回答');
        }

        removeAiLoading();
        renderAiMessage('ai', reply);
        aiChatHistory.push({ role: 'assistant', content: reply });

      } else {
        // 方式2：直接调用阿里百炼 API
        const apiKey = getApiKey();
        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          ...aiChatHistory
        ];

        const model = currentConfig.model || DEFAULT_MODEL;
        response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: MAX_TOKENS,
            temperature: TEMPERATURE
          })
        });

        data = await response.json();

        if (data.error) {
          throw new Error(data.error.message || 'API 错误');
        }

        const reply = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

        if (!reply) {
          throw new Error('AI 没有返回有效回答');
        }

        removeAiLoading();
        renderAiMessage('ai', reply);
        aiChatHistory.push({ role: 'assistant', content: reply });
      }

      // 保存历史
      saveHistory();

      // 限制历史长度
      if (aiChatHistory.length > MAX_HISTORY * 2) {
        aiChatHistory = aiChatHistory.slice(-MAX_HISTORY * 2);
      }

    } catch (err) {
      removeAiLoading();
      console.error('[AI] 请求失败:', err);

      let errorMsg = '网络错误，请检查网络连接。';
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorMsg = '网络连接失败，请检查网络后重试。';
      } else if (err.message.includes('429')) {
        errorMsg = '请求太频繁，请稍后再试。';
      } else if (err.message.includes('401') || err.message.includes('403')) {
        errorMsg = 'API 认证失败，请检查配置。';
      } else if (err.message.includes('500')) {
        errorMsg = 'AI 服务暂时不可用，请稍后再试。';
      } else if (err.message) {
        errorMsg = err.message;
      }

      renderAiError(errorMsg);
    } finally {
      isLoading = false;
      // 恢复发送按钮（使用函数开头已获取的 sendBtn 变量）
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendBtn._originalHTML || '➤';
      }
      // 重新聚焦输入框
      if (input) input.focus();
    }
  }

  // 滚动到底部
  function scrollAiToBottom() {
    const container = document.getElementById('aiChatMessages');
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
    // 隐藏滚动按钮
    const btn = document.getElementById('aiScrollBottom');
    if (btn) btn.classList.remove('show');
  }

  // 监听滚动，显示/隐藏"回到底部"按钮
  function initAiScrollListener() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    container.addEventListener('scroll', function() {
      const btn = document.getElementById('aiScrollBottom');
      if (!btn) return;

      const threshold = 100;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

      if (isNearBottom) {
        btn.classList.remove('show');
      } else {
        btn.classList.add('show');
      }
    });
  }

  // ============================================================
  // 清空对话
  // ============================================================
  function clearAiChat() {
    if (confirm('确定要清空所有对话记录吗？')) {
      clearHistory();
      const msgContainer = document.getElementById('aiChatMessages');
      if (msgContainer) {
        msgContainer.innerHTML = '';
        renderDateDivider();
        renderAiMessage('ai', '对话记录已清空，有任何养生问题都可以问我！', true);
      }
    }
  }

  // ============================================================
  // 保存用户配置
  // ============================================================
  function saveAiConfig() {
    const workerUrl = document.getElementById('configWorkerUrl');
    const apiKey = document.getElementById('configApiKey');
    const modelEl = document.getElementById('configModel');

    const url = workerUrl ? workerUrl.value.trim() : '';
    const key = apiKey ? apiKey.value.trim() : '';
    const model = modelEl ? modelEl.value : DEFAULT_MODEL;

    if (!key) {
      alert('请填写 API Key');
      return;
    }

    saveConfig(url, key, model);
    currentConfig = getConfig();

    // 更新设置面板状态
    const statusEl = document.getElementById('settingsAiStatus');
    if (statusEl) {
      statusEl.textContent = '✅ 已配置 · API Key: ' + key.substring(0, 6) + '...';
      statusEl.style.color = 'var(--accent)';
    }
    updateProfileAiStatus();

    alert('配置已保存！AI 养生顾问已就绪。');
  }

  // ============================================================
  // 更新"我的"页面设置入口状态
  // ============================================================
  function updateProfileAiStatus() {
    const cfg = getConfig();
    const el = document.getElementById('pseAiStatus');
    if (!el) return;
    if (cfg.apiKey) {
      el.textContent = 'AI 已配置 ✅';
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = 'AI 未配置';
      el.style.color = 'var(--muted)';
    }
  }

  // ============================================================
  // 设置面板
  // ============================================================
  function openSettingsPanel() {
    // 回填已保存的配置
    const cfg = getConfig();
    const workerEl = document.getElementById('configWorkerUrl');
    const apiKeyEl = document.getElementById('configApiKey');
    const modelEl = document.getElementById('configModel');
    if (workerEl) workerEl.value = cfg.workerUrl || '';
    if (apiKeyEl) apiKeyEl.value = cfg.apiKey || '';
    if (modelEl) modelEl.value = cfg.model || DEFAULT_MODEL;

    // 同步提醒方式
    const reminderMethodEl = document.getElementById('settingsReminderMethod');
    if (reminderMethodEl && typeof habitsConfig !== 'undefined' && habitsConfig.length > 0) {
      const firstHabit = habitsConfig[0];
      const method = (firstHabit.reminder && firstHabit.reminder.method) ? firstHabit.reminder.method : 'in-app';
      reminderMethodEl.value = method;
    }

    // 显示配置状态
    const statusEl = document.getElementById('settingsAiStatus');
    if (statusEl) {
      if (cfg.apiKey) {
        const modelLabel = MODEL_OPTIONS.find(m => m.value === (cfg.model || DEFAULT_MODEL));
        statusEl.textContent = '✅ 已配置 · ' + (modelLabel ? modelLabel.label : cfg.model) + ' · API Key: ' + cfg.apiKey.substring(0, 6) + '...';
        statusEl.style.color = 'var(--accent)';
      } else {
        statusEl.textContent = '⚠️ 尚未配置 API Key';
        statusEl.style.color = 'var(--muted)';
      }
    }

    openPanel('settingsPanel');
  }

  // ============================================================
  // 导出模块
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.AI = {
    openAiChatPanel,
    openSettingsPanel,
    sendAiMessage,
    clearAiChat,
    saveAiConfig,
    isConfigured,
    isUsingWorker
  };

  // 全局暴露（兼容 HTML onclick）
  window.openAiChatPanel = openAiChatPanel;
  window.openSettingsPanel = openSettingsPanel;
  window.sendAiMessage = sendAiMessage;
  window.clearAiChat = clearAiChat;
  window.saveAiConfig = saveAiConfig;
  window.scrollAiToBottom = scrollAiToBottom;

  // 初始化：加载历史记录 + 滚动监听 + 更新状态
  loadHistory();
  initAiScrollListener();
  updateProfileAiStatus();

  if (App.registerModule) {
    App.registerModule('modules.ai', 'modules', null);
  }
})();
(function() {
  var constitutionAnswers = [];
  var constitutionResult = null;
  var constitutionGender = null;
  var currentQuizSet = null;
  var currentQuizName = '';
  var TYPES = App.Data.CONSTITUTION_TYPES;

  /* ========== 体质分享海报 ========== */
  function generateConstitutionPoster() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = TYPES.find(function(c) { return c.id === result.typeId; });
    if (!mainType) return;

    var canvas = document.getElementById('posterCanvas');
    var ctx = canvas.getContext('2d');
    var w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    // 背景
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 顶部色条
    ctx.fillStyle = mainType.color || '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    // 标题
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('我的体质报告', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《中医体质分类与判定》标准', w/2, 115);

    // 分割线
    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    // 日期
    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日', w/2, 175);

    // 体质大emoji和名称
    ctx.font = '120px sans-serif';
    ctx.fillText(mainType.emoji, w/2, 310);

    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText(mainType.name, w/2, 370);

    // 体质描述（换行处理）
    ctx.fillStyle = '#5B5B5B';
    ctx.font = '22px sans-serif';
    var desc = mainType.desc;
    var maxW = 480;
    var words = desc.split('');
    var line = '', y = 410;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    // 分割线2
    ctx.strokeStyle = '#E0D8CC';
    ctx.beginPath();
    ctx.moveTo(120, y+30); ctx.lineTo(w-120, y+30);
    ctx.stroke();

    // 调理建议标题
    var ay = y + 70;
    ctx.fillStyle = mainType.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('💡 调理建议', w/2, ay);

    // 调理建议内容
    ctx.fillStyle = '#4A4A4A';
    ctx.font = '20px sans-serif';
    var advice = mainType.advice;
    var awords = advice.split('');
    var aline = '', ay2 = ay + 35;
    for (var j = 0; j < awords.length; j++) {
      var atest = aline + awords[j];
      if (ctx.measureText(atest).width > maxW && j > 0) {
        ctx.fillText(aline, w/2, ay2);
        aline = awords[j];
        ay2 += 30;
      } else {
        aline = atest;
      }
    }
    ctx.fillText(aline, w/2, ay2);

    // 底部扫码提示
    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码测测你的体质 → rui66648.github.io/lifestyle-assistant', w/2, h-40);

    // 显示canvas
    var img = document.getElementById('posterImg');
    if (img) img.src = canvas.toDataURL('image/png');
  }

  function openConstitutionPosterPanel() {
    generateConstitutionPoster();
    openPanel('posterPanel');
  }

  function downloadConstitutionPoster() {
    var canvas = document.getElementById('posterCanvas');
    var link = document.createElement('a');
    link.download = '体质报告_' + new Date().toISOString().slice(0,10) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  /* ========== 分享到微信/复制链接 ========== */
  function shareConstitutionResult() {
    var result = constitutionResult;
    if (!result) return;
    var mainType = TYPES.find(function(c) { return c.id === result.typeId; });
    var url = window.location.origin + window.location.pathname + '?type=' + result.typeId;
    var text = '我测出来是「' + mainType.name + '」' + mainType.emoji + '，你也来测测你的体质吧！' + url;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast('链接已复制，快去分享吧！');
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showToast('链接已复制，快去分享吧！'); }
    catch(e) { showToast('复制失败，请手动分享'); }
    document.body.removeChild(ta);
  }

  /* ========== 智能浏览器检测 ========== */
  function getBrowserInfo() {
    var ua = navigator.userAgent.toLowerCase();
    var isAndroid = ua.indexOf('android') > -1;
    var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    var isChrome = ua.indexOf('chrome') > -1 && ua.indexOf('edg') === -1;
    var isEdge = ua.indexOf('edg') > -1;
    var isFirefox = ua.indexOf('firefox') > -1;
    var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    var isWeChat = ua.indexOf('micromessenger') > -1;
    var isQQ = ua.indexOf('qq') > -1 && ua.indexOf('mqqbrowser') > -1;
    var isUC = ua.indexOf('ucbrowser') > -1 || ua.indexOf('ucweb') > -1;
    var isBaidu = ua.indexOf('baidu') > -1 && ua.indexOf('baidubrowser') > -1;
    var isMiBrowser = ua.indexOf('xiaomi') > -1 || ua.indexOf('miui') > -1;
    var isHuaweiBrowser = ua.indexOf('huawei') > -1 || ua.indexOf('honor') > -1;
    var isOppoBrowser = ua.indexOf('oppobrowser') > -1;
    var isVivoBrowser = ua.indexOf('vivobrowser') > -1;

    return {
      isAndroid: isAndroid,
      isIos: isIos,
      isChrome: isChrome,
      isEdge: isEdge,
      isFirefox: isFirefox,
      isSafari: isSafari,
      isWeChat: isWeChat,
      isQQ: isQQ,
      isUC: isUC,
      isBaidu: isBaidu,
      isMiBrowser: isMiBrowser,
      isHuaweiBrowser: isHuaweiBrowser,
      isOppoBrowser: isOppoBrowser,
      isVivoBrowser: isVivoBrowser,
      supportsInstallPrompt: (isAndroid && (isChrome || isEdge)) && !isWeChat && !isQQ && !isUC
    };
  }

  /* ========== 获取安装引导文案 ========== */
  function getInstallGuideText() {
    var info = getBrowserInfo();
    if (info.isWeChat) {
      return {
        title: '微信内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'wechat'
      };
    }
    if (info.isQQ) {
      return {
        title: 'QQ内无法直接安装',
        desc: '请点击右上角 ··· → 在浏览器中打开 → 再添加到桌面',
        button: '了解如何打开',
        type: 'qq'
      };
    }
    if (info.isSafari && info.isIos) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'ios_safari'
      };
    }
    if (info.isUC) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'uc'
      };
    }
    if (info.isBaidu) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'baidu'
      };
    }
    if (info.isMiBrowser) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'mi'
      };
    }
    if (info.isHuaweiBrowser) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '加桌面',
        type: 'huawei'
      };
    }
    if (info.supportsInstallPrompt) {
      return {
        title: '📲 添加到桌面',
        desc: '每天按体质提醒你喝什么茶',
        button: '立即添加',
        type: 'auto'
      };
    }
    return {
      title: '📲 添加到桌面',
      desc: '每天按体质提醒你喝什么茶',
      button: '加桌面',
      type: 'manual'
    };
  }

  /* ========== 添加到桌面引导 ========== */
  function showInstallPrompt() {
    var info = getBrowserInfo();
    var deferredPrompt = window._deferredInstallPrompt;

    if (info.supportsInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choiceResult) {
        if (choiceResult.outcome === 'accepted') {
          showToast('🎉 已添加到桌面！');
          localStorage.setItem('pwa_installed', 'true');
        }
        window._deferredInstallPrompt = null;
      });
    } else {
      showInstallGuideModal();
    }
  }

  function showInstallGuideModal() {
    var info = getBrowserInfo();
    var old = document.getElementById('installGuideModal');
    if (old) old.remove();

    var browserName, steps;

    if (info.isWeChat) {
      browserName = '微信';
      steps = [
        {icon:'1️⃣', text:'点击右上角「···」'},
        {icon:'2️⃣', text:'选择「在浏览器中打开」'},
        {icon:'3️⃣', text:'在浏览器中添加到桌面'}
      ];
    } else if (info.isSafari && info.isIos) {
      browserName = 'Safari';
      steps = [
        {icon:'1️⃣', text:'点击底部「分享」按钮 ↗'},
        {icon:'2️⃣', text:'上滑找到「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isChrome && info.isAndroid) {
      browserName = 'Chrome';
      steps = [
        {icon:'1️⃣', text:'点击右上角「⋮」菜单'},
        {icon:'2️⃣', text:'选择「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isEdge && info.isAndroid) {
      browserName = 'Edge';
      steps = [
        {icon:'1️⃣', text:'点击右下角「⋯」菜单'},
        {icon:'2️⃣', text:'选择「应用」→「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isFirefox) {
      browserName = 'Firefox';
      steps = [
        {icon:'1️⃣', text:'点击右上角「☰」菜单'},
        {icon:'2️⃣', text:'选择「安装」或「添加到主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isUC) {
      browserName = 'UC浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isBaidu) {
      browserName = '百度浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isMiBrowser) {
      browserName = '小米浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isHuaweiBrowser) {
      browserName = '华为浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isOppoBrowser) {
      browserName = 'OPPO浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else if (info.isVivoBrowser) {
      browserName = 'vivo浏览器';
      steps = [
        {icon:'1️⃣', text:'点击底部「菜单」按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    } else {
      browserName = '您的浏览器';
      steps = [
        {icon:'1️⃣', text:'点击浏览器菜单按钮'},
        {icon:'2️⃣', text:'选择「添加到桌面/主屏幕」'},
        {icon:'3️⃣', text:'点击「添加」完成'}
      ];
    }

    var html = '<div id="installGuideModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this){this.remove()}">' +
      '<div style="background:var(--bg);border-radius:20px;padding:24px;max-width:320px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.2);animation:modalIn .3s ease">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
          '<div style="font-size:16px;font-weight:700">📲 加到桌面</div>' +
          '<span style="font-size:20px;cursor:pointer;color:var(--muted)" onclick="document.getElementById(\'installGuideModal\').remove()">✕</span>' +
        '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-bottom:16px">' + browserName + ' 用户请按以下步骤操作：</div>' +
        steps.map(function(s){return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg2);border-radius:12px;margin-bottom:10px">' +
          '<span style="font-size:20px">' + s.icon + '</span>' +
          '<span style="font-size:14px;color:var(--ink)">' + s.text + '</span>' +
        '</div>'}).join('') +
        '<button class="const-btn" style="width:100%;margin-top:8px" onclick="document.getElementById(\'installGuideModal\').remove()">知道了</button>' +
      '</div>' +
    '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  function shouldShowInstallPrompt() {
    var installed = localStorage.getItem('pwa_installed');
    var dismissed = localStorage.getItem('install_prompt_dismissed');
    var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return !installed && !dismissed && !standalone;
  }

  /* ========== 版本选择入口 ========== */
  function openConstitutionPanel() {
    constitutionAnswers = [];
    constitutionResult = JSON.parse(localStorage.getItem('constitution_result') || 'null');
    if (constitutionResult) {
      renderConstitutionResult();
    } else {
      renderVersionSelect();
    }
    openPanel('constitutionPanel');
  }

  function renderVersionSelect() {
    var body = document.getElementById('constitutionPanelBody');
    var svgFlash = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
    var svgList = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>';
    var svgMicro = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"></path><path d="M7 14.5c.5 2.5 2.5 3.5 5 3.5s4.5-1 5-3.5"></path><circle cx="12" cy="8" r="2"></circle><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="M12 2v2"></path></svg>';
    body.innerHTML =
      '<div style="padding:1.5rem;text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
        '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识</div>' +
        '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6">基于王琦教授《中医体质分类与判定》标准<br>请选择适合您的测试版本</div>' +
        '<div class="const-version-list">' +
          '<div class="const-version-card" onclick="selectConstitutionVersion(\'quick\')">' +
            '<div class="const-version-emoji">' + svgFlash + '</div>' +
            '<div style="flex:1">' +
              '<div class="const-version-name">快筛版</div>' +
              '<div class="const-version-meta">10题 · 约1分钟</div>' +
              '<div class="const-version-desc">快速了解主要体质倾向</div>' +
            '</div>' +
          '</div>' +
          '<div class="const-version-card" onclick="selectConstitutionVersion(\'std\')">' +
            '<div class="const-version-emoji">' + svgList + '</div>' +
            '<div style="flex:1">' +
              '<div class="const-version-name">标准版</div>' +
              '<div class="const-version-meta">30题 · 约3分钟</div>' +
              '<div class="const-version-desc">较全面的体质评估</div>' +
            '</div>' +
          '</div>' +
          '<div class="const-version-card" onclick="selectConstitutionVersion(\'full\')">' +
            '<div class="const-version-emoji">' + svgMicro + '</div>' +
            '<div style="flex:1">' +
              '<div class="const-version-name">完整版</div>' +
              '<div class="const-version-meta">67题 · 约10分钟</div>' +
              '<div class="const-version-desc">国标完整量表，最精准</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:1rem;font-size:0.8rem;color:var(--muted)">💡 首次建议从快筛版开始</div>' +
      '</div>';
  }

  function selectConstitutionVersion(version) {
    var data = App.Data;
    if (version === 'quick' && data.CONSTITUTION_QUICK_QUIZ) {
      currentQuizSet = data.CONSTITUTION_QUICK_QUIZ;
      currentQuizName = '快筛版';
    } else if (version === 'std' && data.CONSTITUTION_STD_QUIZ) {
      currentQuizSet = data.CONSTITUTION_STD_QUIZ;
      currentQuizName = '标准版';
    } else {
      currentQuizSet = data.CONSTITUTION_QUIZ;
      currentQuizName = '完整版';
    }
    renderGenderSelect();
  }

  function renderGenderSelect() {
    var body = document.getElementById('constitutionPanelBody');
    var count = currentQuizSet ? currentQuizSet.length : 67;
    body.innerHTML = '<div style="padding:1.5rem;text-align:center">' +
      '<div style="font-size:2rem;margin-bottom:0.8rem">🩺</div>' +
      '<div style="font-weight:700;font-size:1.1rem;margin-bottom:0.5rem">九种体质辨识 · ' + currentQuizName + '</div>' +
      '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:1.5rem;line-height:1.6">共' + count + '道题目，请根据近一年的体验和感觉回答</div>' +
      '<div style="font-size:0.9rem;margin-bottom:1rem;color:var(--ink)">请选择您的性别（部分题目需性别筛选）</div>' +
      '<div style="display:flex;gap:1rem;justify-content:center">' +
        '<button class="const-option" style="flex:1;padding:1rem;font-size:1rem" onclick="startConstitutionQuiz(\'female\')">♀ 女性</button>' +
        '<button class="const-option" style="flex:1;padding:1rem;font-size:1rem" onclick="startConstitutionQuiz(\'male\')">♂ 男性</button>' +
      '</div>' +
    '</div>';
  }

  function startConstitutionQuiz(gender) {
    constitutionGender = gender;
    renderConstitutionQuiz(0);
  }

  function getFilteredQuiz() {
    var quiz = currentQuizSet || App.Data.CONSTITUTION_QUIZ;
    return quiz.filter(function(q) {
      if (q.gender) return q.gender === constitutionGender;
      return true;
    });
  }

  function renderConstitutionQuiz(qIdx) {
    var body = document.getElementById('constitutionPanelBody');
    var quiz = getFilteredQuiz();
    var q = quiz[qIdx];
    var progress = Math.round((qIdx / quiz.length) * 100);
    var typeName = TYPES.find(function(c) { return c.id === q.type; });

    var html = '<div class="const-progress">' +
      '<div class="const-progress-bar"><div class="const-progress-fill" style="width:' + progress + '%"></div></div>' +
      '<span class="const-progress-text">' + (qIdx + 1) + '/' + quiz.length + ' ' + (typeName ? typeName.name : '') + '</span>' +
      '</div>' +
      '<div class="const-question">' +
        '<div class="const-question-text">' + q.question + '</div>' +
        '<div class="const-options">';

    q.options.forEach(function(opt, i) {
      html += '<div class="const-option" onclick="selectConstitutionOption(' + qIdx + ',' + i + ')">' + opt.text + '</div>';
    });

    html += '</div></div>';
    body.innerHTML = html;
  }

  function selectConstitutionOption(qIdx, optIdx) {
    constitutionAnswers.push({ qIdx: qIdx, optIdx: optIdx });

    var quiz = getFilteredQuiz();
    if (qIdx + 1 < quiz.length) {
      renderConstitutionQuiz(qIdx + 1);
    } else {
      calculateConstitution();
    }
  }

  function calculateConstitution() {
    var quiz = getFilteredQuiz();
    var rawScores = {};
    var questionCounts = {};
    TYPES.forEach(function(c) {
      rawScores[c.id] = 0;
      questionCounts[c.id] = 0;
    });

    constitutionAnswers.forEach(function(ans) {
      var q = quiz[ans.qIdx];
      var score = q.options[ans.optIdx].score;
      rawScores[q.type] = (rawScores[q.type] || 0) + score;
      questionCounts[q.type] = (questionCounts[q.type] || 0) + 1;
    });

    // 转化分 = (原始分 - 题数) / (题数 × 4) × 100
    var convertedScores = {};
    TYPES.forEach(function(c) {
      var raw = rawScores[c.id] || 0;
      var count = questionCounts[c.id] || 1;
      convertedScores[c.id] = Math.round((raw - count) / (count * 4) * 100);
    });

    // 快筛版和平质判定阈值适当降低
    var isQuick = currentQuizSet && currentQuizSet.length === 10;
    var pingheThreshold = isQuick ? 50 : 60;
    var biasThreshold = isQuick ? 35 : 40;

    var resultTypes = [];
    TYPES.forEach(function(c) {
      if (c.id === 'pinghe') return;
      if (convertedScores[c.id] >= biasThreshold) {
        resultTypes.push({
          id: c.id,
          name: c.name,
          emoji: c.emoji,
          color: c.color,
          score: convertedScores[c.id],
          level: convertedScores[c.id] >= 60 ? '重度倾向' : '轻度倾向'
        });
      }
    });

    var isPinghe = convertedScores['pinghe'] >= pingheThreshold && resultTypes.length === 0;
    var mainType = isPinghe ? 'pinghe' : (resultTypes.length > 0 ? resultTypes[0].id : 'pinghe');

    constitutionResult = {
      typeId: mainType,
      isPinghe: isPinghe,
      rawScores: rawScores,
      convertedScores: convertedScores,
      questionCounts: questionCounts,
      resultTypes: resultTypes,
      gender: constitutionGender,
      totalQuestions: quiz.length,
      quizVersion: currentQuizName,
      date: new Date().toISOString()
    };
    localStorage.setItem('constitution_result', JSON.stringify(constitutionResult));
    renderConstitutionResult();
  }

  function renderConstitutionResult() {
    var body = document.getElementById('constitutionPanelBody');
    var result = constitutionResult;
    var mainType = TYPES.find(function(c) { return c.id === result.typeId; });

    function getTendencyLevel(score, typeId) {
      if (typeId === 'pinghe') {
        if (score >= 60) return '是';
        if (score >= 40) return '倾向';
        return '否';
      } else {
        if (score >= 60) return '重度倾向';
        if (score >= 40) return '中度倾向';
        if (score >= 30) return '轻度倾向';
        return '否';
      }
    }

    var allTypes = TYPES.map(function(c) {
      var score = result.convertedScores[c.id] || 0;
      var level = getTendencyLevel(score, c.id);
      return {
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        desc: c.desc,
        score: score,
        level: level
      };
    }).sort(function(a, b) {
      if (a.id === 'pinghe') return 1;
      if (b.id === 'pinghe') return -1;
      return b.score - a.score;
    });

    // 体质钩子文案
    var hookText = {
      pinghe: '阴阳调和，气血充盈，继续保持！',
      qixu: '不是懒，是气虚容易累',
      yangxu: '手脚冰凉不是你脆弱，是阳虚在作祟',
      yinxu: '口干失眠不是小事，阴虚需要滋阴',
      tanshi: '不是你胖，是痰湿体质容易囤',
      shire: '油光满面不是不讲卫生，是湿热体质',
      xueyu: '黑眼圈不一定是熬夜，血瘀需要活血',
      qiyu: '闷闷不乐不是你的错，气郁需要疏解',
      tebing: '过敏不是矫情，特禀体质需要呵护'
    };

    var html = '<div class="const-result">' +
      '<div style="text-align:center;padding:1rem 0">' +
        '<div class="const-result-emoji" style="font-size:3rem">' + mainType.emoji + '</div>' +
        '<div class="const-result-name" style="color:' + mainType.color + ';font-size:1.3rem;font-weight:700">' + mainType.name + '</div>' +
        '<div class="const-result-desc" style="margin:0.3rem 0;color:var(--muted);font-size:0.85rem">' + mainType.desc + '</div>' +
        '<div style="font-size:0.9rem;color:' + mainType.color + ';font-weight:600;margin-top:0.3rem">💬 ' + (hookText[mainType.id] || '') + '</div>' +
      '</div>';

    // 添加到桌面引导（结果页最有认同感时）
    if (shouldShowInstallPrompt()) {
      var guide = getInstallGuideText();
      var cardBg = guide.type === 'wechat' || guide.type === 'qq' 
        ? 'background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3)' 
        : 'background:linear-gradient(135deg,var(--accent-light),var(--accent2-light))';
      html += '<div class="install-prompt-card" style="margin:0.5rem 0;padding:12px 16px;' + cardBg + ';border-radius:12px;display:flex;align-items:center;gap:10px">' +
        '<span style="font-size:1.5rem">' + (guide.title.startsWith('📲') ? '📲' : '⚠️') + '</span>' +
        '<div style="flex:1">' +
          '<div style="font-weight:700;font-size:0.9rem">' + guide.title.replace('📲 ','') + '</div>' +
          '<div style="font-size:0.8rem;color:var(--ink2)">' + guide.desc + '</div>' +
        '</div>' +
        '<button class="const-btn" style="padding:6px 14px;font-size:0.8rem;white-space:nowrap" onclick="showInstallPrompt()">' + guide.button + '</button>' +
      '</div>';
    }

    // 九种体质得分详情
    html += '<div style="background:var(--bg2);border-radius:10px;padding:0.8rem;margin:0.5rem 0">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:0.5rem">📊 九种体质得分详情</div>';
    allTypes.forEach(function(t, i) {
      var isMain = t.id === result.typeId;
      var barWidth = Math.max(5, Math.min(100, t.score));
      var barColor = t.score >= 40 ? t.color : '#ccc';
      html += '<div style="margin-bottom:0.6rem' + (i < allTypes.length - 1 ? ';padding-bottom:0.6rem;border-bottom:1px solid var(--border)' : '') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.25rem">' +
          '<span style="font-size:0.85rem;font-weight:' + (isMain ? '700' : '400') + '">' + t.emoji + ' ' + t.name + (isMain ? ' ★' : '') + '</span>' +
          '<span style="font-size:0.8rem;color:' + (t.level === '否' ? 'var(--muted)' : t.color) + ';font-weight:600">' + t.score + '分 <span style="font-weight:400">' + t.level + '</span></span>' +
        '</div>' +
        '<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">' +
          '<div style="height:100%;width:' + barWidth + '%;background:' + barColor + ';border-radius:3px;transition:width 0.3s"></div>' +
        '</div>' +
        '<div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem">' + t.desc + '</div>' +
      '</div>';
    });
    html += '</div>';

    // 调理建议
    html += '<div class="const-result-advice" style="margin:0.8rem 0">' +
      '<strong>调理建议：</strong><br>' + mainType.advice +
      '</div>';

    // 推荐习惯
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:8px;text-align:left">🎯 推荐习惯（点击添加）</div>' +
      '<div class="const-result-habits">';

    mainType.habits.forEach(function(hid) {
      var habit = HABIT_LIBRARY.find(function(h) { return h.id === hid; });
      if (!habit) return;
      var exists = habitsConfig.some(function(h) { return h.id === hid; });
      html += '<div class="const-result-habit">' +
        '<span class="rh-icon">' + habit.icon + '</span>' +
        '<span class="rh-name">' + habit.name + '</span>' +
        (exists ? '<span style="font-size:12px;color:var(--accent)">✓ 已添加</span>' : '<span class="rh-btn" onclick="addHabitFromConstitution(\'' + hid + '\')">+ 添加</span>') +
        '</div>';
    });

    html += '</div>' +
      // 分享和海报按钮
      '<div style="display:flex;gap:0.6rem;margin:1rem 0">' +
        '<button class="const-btn" style="flex:1;background:var(--accent);color:#fff" onclick="openConstitutionPosterPanel()">🎨 生成体质卡</button>' +
        '<button class="const-btn" style="flex:1;background:var(--bg2);color:var(--ink)" onclick="shareConstitutionResult()">🔗 分享结果</button>' +
      '</div>' +
      '<div style="display:flex;gap:0.8rem;margin-top:0.5rem">' +
        '<button class="const-btn" style="flex:1" onclick="retakeConstitutionQuiz()">重新测试</button>' +
        '<button class="const-btn" style="flex:1;background:var(--bg2);color:var(--ink)" onclick="closeAllPanels()">关闭</button>' +
      '</div>' +
      // 合规声明
      '<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid var(--border);font-size:0.7rem;color:var(--muted);text-align:center;line-height:1.5">' +
        '本测试仅供参考，如有不适请就医<br>' +
        '参考《中医体质分类与判定》（中华中医药学会2009版）' +
      '</div>' +
    '</div>';

    body.innerHTML = html;
  }

  function addHabitFromConstitution(hid) {
    var habit = HABIT_LIBRARY.find(function(h) { return h.id === hid; });
    if (!habit || habitsConfig.some(function(h) { return h.id === hid; })) return;

    var newHabit = {
      id: habit.id,
      name: habit.name,
      icon: habit.icon,
      category: habit.category,
      type: habit.type,
      unit: habit.unit || '',
      timePeriod: habit.timePeriod || 'daytime',
      tip: habit.tip || ''
    };
    if (habit.defaultReminder) {
      newHabit.reminder = Object.assign(
        { enabled: false, time: '08:00', days: [0,1,2,3,4,5,6], method: 'in-app' },
        habit.defaultReminder,
        { enabled: true }
      );
    } else {
      newHabit.reminder = { enabled: false, time: '08:00', days: [0,1,2,3,4,5,6], method: 'in-app' };
    }
    if (habit.type === 'water') {
      newHabit.waterConfig = { perCup: 250, dailyGoal: 2000 };
      newHabit.intervalReminder = { interval: 120, unit: 'minute', enabled: true, startTime: '07:00', endTime: '22:00', days: [0,1,2,3,4,5,6] };
    }
    if (habit.options) newHabit.options = habit.options;

    habitsConfig.push(newHabit);
    saveData();
    renderConstitutionResult();
    render();
  }

  function retakeConstitutionQuiz() {
    constitutionAnswers = [];
    constitutionResult = null;
    localStorage.removeItem('constitution_result');
    renderVersionSelect();
  }

  /* ========== 监听 PWA install 事件 ========== */
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window._deferredInstallPrompt = e;
  });

  /* ========== URL参数解析：带参落地 ========== */
  function checkUrlParams() {
    var params = new URLSearchParams(window.location.search);
    var type = params.get('type');
    if (type && TYPES.some(function(c) { return c.id === type; })) {
      // 有体质参数，预设结果并打开面板
      var ct = TYPES.find(function(c) { return c.id === type; });
      constitutionResult = {
        typeId: type,
        isPinghe: type === 'pinghe',
        convertedScores: {},
        resultTypes: type === 'pinghe' ? [] : [{id:type,name:ct.name,emoji:ct.emoji,color:ct.color,score:50,level:'中度倾向'}],
        quizVersion: '分享导入',
        date: new Date().toISOString()
      };
      // 不保存到localStorage，让用户自己测
      renderConstitutionResult();
      openPanel('constitutionPanel');
      // 清理URL参数
      window.history.replaceState({}, document.title, window.location.pathname);
      return true;
    }
    return false;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  window.selectConstitutionVersion = selectConstitutionVersion;
  window.startConstitutionQuiz = startConstitutionQuiz;
  window.selectConstitutionOption = selectConstitutionOption;
  window.retakeConstitutionQuiz = retakeConstitutionQuiz;
  window.addHabitFromConstitution = addHabitFromConstitution;
  window.showInstallPrompt = showInstallPrompt;
  window.openConstitutionPosterPanel = openConstitutionPosterPanel;
  window.shareConstitutionResult = shareConstitutionResult;

  App.Modules.Constitution = {
    openConstitutionPanel: openConstitutionPanel,
    selectConstitutionVersion: selectConstitutionVersion,
    startConstitutionQuiz: startConstitutionQuiz,
    renderConstitutionQuiz: renderConstitutionQuiz,
    selectConstitutionOption: selectConstitutionOption,
    calculateConstitution: calculateConstitution,
    renderConstitutionResult: renderConstitutionResult,
    addHabitFromConstitution: addHabitFromConstitution,
    retakeConstitutionQuiz: retakeConstitutionQuiz,
    generateConstitutionPoster: generateConstitutionPoster,
    openConstitutionPosterPanel: openConstitutionPosterPanel,
    downloadConstitutionPoster: downloadConstitutionPoster,
    shareConstitutionResult: shareConstitutionResult,
    showInstallPrompt: showInstallPrompt,
    checkUrlParams: checkUrlParams
  };
})();
(function() {
  function openPosterPanel() {
    generatePoster();
    openPanel('posterPanel');
  }

  function generatePoster() {
    const canvas = document.getElementById('posterCanvas');
    const ctx = canvas.getContext('2d');
    const w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('生活习惯小助手', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《黄帝内经》的养生习惯追踪', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    const d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`, w/2, 175);

    const done = getTodayDone();
    const total = getTodayTotal();
    const streak = getMaxStreakAll();

    ctx.font = '80px sans-serif';
    ctx.fillText('🎉', w/2, 280);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`今日 ${done}/${total} 个习惯完成`, w/2, 340);

    if (streak > 0) {
      ctx.fillStyle = '#F4A683';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`连续打卡 ${streak} 天 🔥`, w/2, 390);
    }

    ctx.beginPath();
    ctx.moveTo(120, 430); ctx.lineTo(w-120, 430);
    ctx.stroke();

    const dayOfYear = Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000);
    const quote = QUOTES[dayOfYear % QUOTES.length];
    ctx.fillStyle = '#5B8DB8';
    ctx.font = 'italic 22px sans-serif';
    ctx.fillText('📖 今日养生名言', w/2, 475);

    ctx.fillStyle = '#2D3436';
    ctx.font = '22px sans-serif';
    const maxWidth = 480;
    const words = quote.split('');
    let line = '', y = 515;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i];
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码体验 → rui66648.github.io/lifestyle-assistant', w/2, h-40);
  }

  function downloadPoster() {
    const canvas = document.getElementById('posterCanvas');
    const link = document.createElement('a');
    link.download = `打卡海报_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Poster = {
    openPosterPanel,
    generatePoster,
    downloadPoster
  };

  // 暴露全局函数供点击调用
  window.openPosterPanel = openPosterPanel;
  window.downloadPoster = downloadPoster;

  if (App.registerModule) {
    App.registerModule('modules.poster', 'modules', null);
  }
})();
(function() {

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

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Notification = {
    requestPermission: requestNotificationPermission,
    showNotification: showLocalNotification
  };

})();(function() {
  const GUIDE_STEPS = [
    { emoji: '🌟', title: '欢迎使用健康习惯助手', text: '融合《黄帝内经》智慧与 AI 技术，帮助你养成科学养生习惯。共 6 步，约 2 分钟完成。' },
    { emoji: '🩺', title: 'Step 1：中医体质测评', text: '在「我的」页面进行体质测评，回答 8 道题，辨识体质类型，获取专属养生建议。' },
    { emoji: '✨', title: 'Step 2：添加养生习惯', text: '在「管理」页面添加习惯，支持从习惯库一键添加（按时间分类），也支持自定义创建。' },
    { emoji: '📦', title: 'Step 3：导入习惯包', text: '在习惯库中可一键导入「健康生活包」或「四季养生包」，快速获得多个科学搭配的习惯。' },
    { emoji: '✅', title: 'Step 4：每日打卡', text: '在「打卡」页面记录完成情况，支持三种模式：完成/未完成、计数（如喝水量）、计时（如运动时长）。' },
    { emoji: '📊', title: 'Step 5：查看进度', text: '在「我的」页面查看打卡统计、等级、成就和热力图。每周自动生成总结报告。' },
    { emoji: '🤖', title: 'Step 6：AI 健康顾问', text: '点击底部 AI 按钮，随时咨询养生问题，获取基于《黄帝内经》和现代医学的个性化建议。' }
  ];
  let guideStep = 0;

  function showGuide() {
    // 首次自动弹出：检查是否已看过
    if (localStorage.getItem('has_seen_guide')) return;
    startGuide();
  }

  function replayGuide() {
    // 手动重看：不检查，始终显示
    startGuide();
  }

  function startGuide() {
    guideStep = 0;
    renderGuideStep();
    document.getElementById('guideOverlay').style.display = 'flex';
  }

  function renderGuideStep() {
    const step = GUIDE_STEPS[guideStep];
    document.getElementById('guideEmoji').textContent = step.emoji;
    document.getElementById('guideTitle').textContent = step.title;
    document.getElementById('guideText').textContent = step.text;
    document.getElementById('guideBtn').textContent = guideStep < GUIDE_STEPS.length - 1 ? '下一步' : '开始使用';

    const dots = document.getElementById('guideDots');
    const stepCount = GUIDE_STEPS.length;
    let dotsHtml = '';
    for (let i = 0; i < stepCount; i++) {
      const bg = i === guideStep ? 'var(--accent)' : 'var(--rule)';
      dotsHtml += `<span style="width:7px;height:7px;border-radius:50%;background:${bg};flex-shrink:0"></span>`;
    }
    dots.innerHTML = dotsHtml;
  }

  function nextGuideStep() {
    guideStep++;
    if (guideStep >= GUIDE_STEPS.length) {
      localStorage.setItem('has_seen_guide', 'true');
      document.getElementById('guideOverlay').style.display = 'none';
    } else {
      renderGuideStep();
    }
  }

  function skipGuide() {
    localStorage.setItem('has_seen_guide', 'true');
    document.getElementById('guideOverlay').style.display = 'none';
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Guide = {
    showGuide,
    replayGuide,
    renderGuideStep,
    nextGuideStep,
    skipGuide
  };

  if (App.registerModule) {
    App.registerModule('modules.guide', 'modules', null);
  }
})();
