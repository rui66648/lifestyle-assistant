(function() {
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
    if (typeof SEASONAL_PACKS === 'undefined' || !SEASONAL_PACKS || typeof SEASONAL_PACKS !== 'object') return {name:'春季',emoji:'🌸',focus:'',months:[],habits:[],quote:'',tip:''};
    return SEASONAL_PACKS[season] || SEASONAL_PACKS.spring || {name:'春季',emoji:'🌸',focus:'',months:[],habits:[],quote:'',tip:''};
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

  const isChecked = App.Core.Storage.isHabitChecked;

  function getCurrentStreak() {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      const hasAny = rec && habitsConfig.some(h => isChecked(h, rec));
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
      habitsConfig.forEach(h => { if (isChecked(h, rec)) total++; });
    }
    return total;
  }

  function getTodayCompletionRate() {
    const today = new Date();
    today.setDate(today.getDate() + viewDateOffset);
    const key = formatDate(today);
    const rec = checkinRecords[key];
    if (!habitsConfig.length) return 0;
    let done = 0;
    habitsConfig.forEach(h => { if (isChecked(h, rec)) done++; });
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
    getTodayCompletionRate
  };
})();
