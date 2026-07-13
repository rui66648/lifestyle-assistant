(function() {
  // 统一 HTML 转义（防 XSS）：转义 & < > " '
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }
  window.esc = esc;

  // 统计轻量缓存：数据变更（saveConfig/saveRecords）时通过 markStatsDirty 失效，
  // 单次渲染内多次调用 streak/总打卡 等只计算一次，避免每次打卡全量重算。
  let _statCache = {};
  let _statDirty = true;
  function markStatsDirty() { _statDirty = true; }
  function _cachedStat(key, fn) {
    if (_statDirty) { _statCache = {}; _statDirty = false; }
    if (!(key in _statCache)) _statCache[key] = fn();
    return _statCache[key];
  }

  let viewDateOffset = 0;
  Object.defineProperty(window, 'viewDateOffset', {
    get: () => viewDateOffset,
    set: (val) => { viewDateOffset = val; },
    configurable: true,
    enumerable: true
  });

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
    if (typeof SEASONAL_PACKS !== 'undefined' && SEASONAL_PACKS && typeof SEASONAL_PACKS === 'object') {
      return SEASONAL_PACKS[season] || SEASONAL_PACKS.spring;
    }
    // packs.js 未加载时的最小占位（完整数据见 js/data/packs.js）
    var stub = {
      spring: {name:'春季',emoji:'🌿',focus:'养肝',months:[2,3,4],quote:'',tip:'春季养生重在养肝。'},
      summer: {name:'夏季',emoji:'☀️',focus:'养心',months:[5,6,7],quote:'',tip:'夏季养生重在养心。'},
      autumn: {name:'秋季',emoji:'🍂',focus:'养肺',months:[8,9,10],quote:'',tip:'秋季养生重在养肺。'},
      winter: {name:'冬季',emoji:'❄️',focus:'养肾',months:[11,12,1],quote:'',tip:'冬季养生重在养肾。'}
    };
    return stub[season] || stub.spring;
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

  // 复用单例 AudioContext，避免每次 new 导致浏览器达到实例上限后音效静默失效
  let _audioCtx = null;
  function getAudioCtx() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (_audioCtx === null) {
      try { _audioCtx = new AudioCtx(); } catch (e) { _audioCtx = false; }
    }
    if (_audioCtx === false) return null;
    if (_audioCtx.state === 'suspended') { try { _audioCtx.resume(); } catch (e) {} }
    return _audioCtx;
  }

  function playSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { console.warn('[playSound] 浏览器不支持 Web Audio API'); return; }
      const ctx = getAudioCtx();
      if (!ctx) return;
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
      } else if (type === 'reminder') {
        // 双音调提醒音，更尖锐
        [880, 1100].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now + i * 0.15);
          gain.gain.setValueAtTime(0.18, now + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.25);
          osc.start(now + i * 0.15); osc.stop(now + i * 0.15 + 0.25);
        });
      } else if (type === 'alarm') {
        // 三音调渐强，紧迫感
        [523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'square'; osc.frequency.setValueAtTime(freq, now + i * 0.2);
          gain.gain.setValueAtTime(0.2, now + i * 0.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.35);
          osc.start(now + i * 0.2); osc.stop(now + i * 0.2 + 0.35);
        });
      }
    } catch(e) {
      // 音频播放失败不阻塞主流程，仅记录日志
      console.warn('[playSound] 音频播放失败:', e.message);
    }
  }

  /* ========== 屏幕闪烁 ========== */
  function flashScreen() {
    var overlay = document.createElement('div');
    overlay.className = 'alarm-flash';
    document.body.appendChild(overlay);
    setTimeout(function() { overlay.remove(); }, 2000);
  }

  /* ========== 报警序列（声音+振动） ========== */
  function playAlarmSequence() {
    var count = 0;
    var interval = setInterval(function() {
      playSound('alarm');
      if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      count++;
      if (count >= 3) clearInterval(interval);
    }, 700);
  }

  function _isChecked(habit, rec) {
    if (App.Core && App.Core.Storage && App.Core.Storage.isHabitChecked) {
      return App.Core.Storage.isHabitChecked(habit, rec);
    }
    return false;
  }

  function getCurrentStreak() {
    return _cachedStat('streak', function() {
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
    });
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
    return _cachedStat('total', function() {
      let total = 0;
      for (const key in checkinRecords) {
        const rec = checkinRecords[key];
        habitsConfig.forEach(h => { if (_isChecked(h, rec)) total++; });
      }
      return total;
    });
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
    return _cachedStat('todayRate', function() {
      const today = new Date();
      today.setDate(today.getDate() + viewDateOffset);
      const key = formatDate(today);
      const rec = checkinRecords[key];
      if (!habitsConfig.length) return 0;
      let done = 0;
      habitsConfig.forEach(h => { if (_isChecked(h, rec)) done++; });
      return Math.round((done / habitsConfig.length) * 100);
    });
  }

  function getViewDateOffset() {
    return viewDateOffset;
  }

  function setViewDateOffset(offset) {
    viewDateOffset = offset;
    window.viewDateOffset = viewDateOffset;
  }

  function getHeatmapLevel(ratio) {
    if (ratio <= 0) return 0;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  if (!window.App) window.App = {};
  if (!App.Core) App.Core = {};

  App.Core.Utils = {
    esc,
    markStatsDirty,
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
    flashScreen,
    playAlarmSequence,
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
    checkAllDoneBonus,
    getHeatmapLevel
  };
  if (App.registerModule) {
    App.registerModule('core.utils', 'core', null);
  }
})();
