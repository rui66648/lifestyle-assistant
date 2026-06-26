(function() {
  window.__utilsStarted = true;
  let viewDateOffset = 0;
  try {
  Object.defineProperty(window, 'viewDateOffset', {
    get: () => viewDateOffset,
    set: (val) => { viewDateOffset = val; },
    configurable: true,
    enumerable: true
  });
  window.__utilsStep1 = true;
  } catch(e) { window.__utilsError1 = e.message; }

  function getCurrentShichen() {
    if (typeof BODY_CLOCK === 'undefined' || !Array.isArray(BODY_CLOCK) || BODY_CLOCK.length === 0) return {icon:'⏳',name:'未知时辰',meridian:'',action:'',detail:'',start:0,end:24,id:'unknown'};
    const hour = new Date().getHours();
    for (const sc of BODY_CLOCK) {
      if (sc.start <= sc.end) {
        if (hour >= sc.start && hour < sc.end) return sc;
      } else {
        if (hour >= sc.start || hour < sc.end) return sc;
      }
    }
    return BODY_CLOCK[0];
  }

  function getCurrentSolarTerm() {
    if (typeof SOLAR_TERMS === 'undefined' || !Array.isArray(SOLAR_TERMS) || SOLAR_TERMS.length === 0) return null;
    const now = new Date();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    // 精确匹配 ±3 天
    for (const term of SOLAR_TERMS) {
      if (term.month === m && Math.abs(term.day - d) <= 3) {
        return term;
      }
    }
    // 没匹配到精确节气，返回最近的一个节气
    let nearest = null;
    let minDiff = Infinity;
    for (const term of SOLAR_TERMS) {
      const termDate = new Date(now.getFullYear(), term.month - 1, term.day);
      const diff = Math.abs(termDate - now);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = term;
      }
    }
    return nearest;
  }

  function getCurrentSeason() {
    if (typeof SEASONAL_PACKS === 'undefined' || !SEASONAL_PACKS || typeof SEASONAL_PACKS !== 'object') return 'spring';
    const month = new Date().getMonth() + 1;
    for (const [key, pack] of Object.entries(SEASONAL_PACKS)) {
      if (pack && pack.months && pack.months.includes(month)) return key;
    }
    return 'spring';
  }

  function getSeasonPack(season) {
    // 内置四季原文 fallback，防止 packs.js 加载异常时原文不显示
    var builtin = {
      spring: {name:'春季',emoji:'🌿',focus:'养肝舒展，夜卧早起',months:[2,3,4],quote:'春三月，此谓发陈。天地俱生，万物以荣。夜卧早起，广步于庭，被发缓形，以使志生，生而勿杀，予而勿夺，赏而勿罚，此春气之应，养生之道也；逆之则伤肝。',tip:'春季养生重在养肝。夜卧早起（不超23点），广步于庭（户外散步舒展），使志生（精神舒展不压抑），省酸增甘（多吃甘味养肝脾）。逆之伤肝。'},
      summer: {name:'夏季',emoji:'☀️',focus:'养心静心，无厌于日',months:[5,6,7],quote:'夏三月，此谓蕃秀。天地气交，万物华实。夜卧早起，无厌于日，使志无怒，使华英成秀，使气得泄，若所爱在外，此夏气之应，养长之道也；逆之则伤心。',tip:'夏季养生重在养心。夜卧早起，无厌于日（适当晒太阳不出汗），使志无怒（保持心情愉快不郁怒），饮食清淡多食苦（清心火）。逆之伤心。'},
      autumn: {name:'秋季',emoji:'🍂',focus:'养肺润燥，早卧早起',months:[8,9,10],quote:'秋三月，此谓容平。天气以急，地气以明。早卧早起，与鸡俱兴，使志安宁，以缓秋刑，收敛神气，使秋气平，无外其志，使肺气清，此秋气之应，养收之道也；逆之则伤肺。',tip:'秋季养生重在养肺。早卧早起（与鸡俱兴），使志安宁（保持内心宁静），食酸敛肺防秋燥（多吃白色食物）。逆之伤肺。'},
      winter: {name:'冬季',emoji:'❄️',focus:'养肾保暖，早卧晚起',months:[11,12,1],quote:'冬三月，此谓闭藏。水冰地坼，无扰乎阳。早卧晚起，必待日光，使志若伏若匿，若有私意，若已有得，去寒就温，无泄皮肤，使气亟夺，此冬气之应，养藏之道也；逆之则伤肾。',tip:'冬季养生重在养肾。早卧晚起（必待日光，等太阳升起再起床），使志若伏若匿（情志内藏不外露），食咸补肾（温补食物），去寒就温（注意保暖），无泄皮肤（减少户外出汗）。逆之伤肾。'}
    };
    if (typeof SEASONAL_PACKS === 'undefined' || !SEASONAL_PACKS || typeof SEASONAL_PACKS !== 'object') {
      return builtin[season] || builtin.spring;
    }
    return SEASONAL_PACKS[season] || SEASONAL_PACKS.spring || builtin[season] || builtin.spring;
  }

  function getLunarDate(date) {
    if (typeof LUNAR_INFO === 'undefined' || typeof LUNAR_MONTHS === 'undefined' || typeof LUNAR_DAYS === 'undefined') {
      return {year: date.getFullYear(), month: date.getMonth()+1, day: date.getDate(), monthStr: '', dayStr: '', isLeap: false};
    }
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    let year = y, month = m + 1, day = d;
    let offset = (Date.UTC(y, m, d) - Date.UTC(1900, 0, 31)) / 86400000;
    let i, leap = 0, temp = 0;
    for (i = 1900; i < 2100 && offset > 0; i++) {
      temp = lYearDays(i); offset -= temp;
    }
    if (offset < 0) { offset += temp; i--; }
    year = i;
    leap = leapMonth(i);
    let isLeap = false;
    for (i = 1; i < 13 && offset > 0; i++) {
      if (leap > 0 && i === leap + 1 && !isLeap) { i--; isLeap = true; temp = leapDays(year); }
      else { temp = monthDays(year, i); }
      if (isLeap && i === leap + 1) isLeap = false;
      offset -= temp;
    }
    if (offset === 0 && leap > 0 && i === leap + 1) {
      if (isLeap) { isLeap = false; } else { isLeap = true; i--; }
    }
    if (offset < 0) { offset += temp; i--; }
    month = i; day = offset + 1;
    return {year, month, day, monthStr: LUNAR_MONTHS[month-1], dayStr: LUNAR_DAYS[day-1], isLeap};
  }

  function lYearDays(y) { let i, sum = 348; for(i=0x8000;i>0x8;i>>=1) sum += (LUNAR_INFO[y-1900]&i)?1:0; return sum+leapDays(y); }
  function leapDays(y) { if(leapMonth(y)) return (LUNAR_INFO[y-1900]&0x10000)?30:29; return 0; }
  function leapMonth(y) { return LUNAR_INFO[y-1900]&0xf; }
  function monthDays(y,m) { return (LUNAR_INFO[y-1900]&(0x10000>>m))?30:29; }

  function today() {
    const d = new Date();
    if (viewDateOffset !== 0) d.setDate(d.getDate() + viewDateOffset);
    return formatDate(d);
  }

  function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function getDayOfWeek() {
    return new Date().getDay();
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2500);
  }

  function playSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'checkin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
      } else if (type === 'complete') {
        [523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.12, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
          osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.3);
        });
      } else if (type === 'unlock') {
        [523, 659, 784, 1047].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'triangle'; osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.1, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
          osc.start(now + i * 0.1); osc.stop(now + i * 0.1 + 0.4);
        });
      }
    } catch(e) {}
  }

  function _isChecked(habit, rec) {
    if (App.Core && App.Core.Storage && App.Core.Storage.isHabitChecked) {
      return App.Core.Storage.isHabitChecked(habit, rec);
    }
    if (rec && rec[habit.id] !== undefined) {
      if (habit.type === 'boolean') return rec[habit.id] === true || rec[habit.id] === 1;
      if (habit.type === 'number') return (rec[habit.id] || 0) >= (habit.goal || 1);
      return !!rec[habit.id];
    }
    return false;
  }

  function getCurrentStreak() {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      const hasAny = rec && habitsConfig.some(h => _isChecked(h, rec));
      if (hasAny) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function getCurrentLevel() {
    if (typeof LEVELS === 'undefined' || !Array.isArray(LEVELS) || LEVELS.length === 0) return {level:1,name:'新手',icon:'🌱',minDays:0};
    const streak = getCurrentStreak();
    let current = LEVELS[0];
    for (const lv of LEVELS) {
      if (streak >= lv.minDays) current = lv;
    }
    return current;
  }

  function getNextLevel() {
    if (typeof LEVELS === 'undefined' || !Array.isArray(LEVELS)) return null;
    const current = getCurrentLevel();
    const idx = LEVELS.findIndex(l => l.level === current.level);
    return LEVELS[idx + 1] || null;
  }

  function getLevelProgress() {
    const streak = getCurrentStreak();
    const current = getCurrentLevel();
    const next = getNextLevel();
    if (!next) return 100;
    const range = next.minDays - current.minDays;
    const progress = streak - current.minDays;
    return Math.min(100, Math.round((progress / range) * 100));
  }

  function getTotalCheckins() {
    let total = 0;
    for (const key in checkinRecords) {
      const rec = checkinRecords[key];
      habitsConfig.forEach(h => { if (_isChecked(h, rec)) total++; });
    }
    return total;
  }

  // ===== 积分系统 =====
  // 积分规则：每完成一个习惯 +1，当天全部完成额外 +5
  const checkinReward = {
    perHabit: 1,       // 每完成一个习惯的基础积分
    allDoneBonus: 5    // 完成所有任务额外奖励积分
  };

  function getUserPoints() {
    return parseInt(localStorage.getItem('user_points') || '0');
  }

  function addPoints(amount, reason) {
    const current = getUserPoints();
    const newTotal = current + amount;
    localStorage.setItem('user_points', String(newTotal));
    // 记录积分历史
    try {
      const history = JSON.parse(localStorage.getItem('points_history') || '[]');
      history.push({ date: new Date().toISOString(), amount, reason, total: newTotal });
      // 只保留最近 100 条
      if (history.length > 100) history.splice(0, history.length - 100);
      localStorage.setItem('points_history', JSON.stringify(history));
    } catch(e) {}
    return newTotal;
  }

  function checkAllDoneBonus() {
    // 检查今天是否已经给过全部完成奖励
    const todayStr = today();
    const bonusKey = 'all_done_bonus_' + todayStr;
    if (localStorage.getItem(bonusKey) === 'true') return false;
    const total = habitsConfig.filter(h => h.enabled !== false).length;
    if (total === 0) return false;
    // getTodayDone 和 getTodayTotal 来自 checkin.js，通过 compat.js 暴露到 window
    const done = (typeof getTodayDone === 'function') ? getTodayDone() : 0;
    if (done < total) return false;
    // 标记已发放
    localStorage.setItem(bonusKey, 'true');
    return true;
  }

  function getTodayCompletionRate() {
    const today = new Date();
    today.setDate(today.getDate() + viewDateOffset);
    const key = formatDate(today);
    const rec = checkinRecords[key];
    if (!habitsConfig.length) return 0;
    let done = 0;
    habitsConfig.forEach(h => { if (_isChecked(h, rec)) done++; });
    return Math.round((done / habitsConfig.length) * 100);
  }

  function getViewDateOffset() {
    return viewDateOffset;
  }

  function setViewDateOffset(offset) {
    viewDateOffset = offset;
    window.viewDateOffset = viewDateOffset;
  }

  if (!window.App) window.App = {};
  if (!App.Core) App.Core = {};

  App.Core.Utils = {
    getCurrentShichen,
    getCurrentSolarTerm,
    getCurrentSeason,
    getSeasonPack,
    getLunarDate,
    lYearDays,
    leapDays,
    leapMonth,
    monthDays,
    today,
    formatDate,
    getDayOfWeek,
    showToast,
    playSound,
    getCurrentStreak,
    getCurrentLevel,
    getNextLevel,
    getLevelProgress,
    getViewDateOffset,
    setViewDateOffset,
    getTotalCheckins,
    getTodayCompletionRate,
    checkinReward,
    getUserPoints,
    addPoints,
    checkAllDoneBonus
  };
  window.__utilsDone = true;
})();
