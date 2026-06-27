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
