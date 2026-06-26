(function() {
  function getStreak(habitId) {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[habitId] && rec[habitId].done) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function getMaxStreak(habitId) {
    let max = 0, cur = 0;
    const dates = Object.keys(checkinRecords).sort();
    if (dates.length === 0) return 0;
    const start = new Date(dates[0]);
    const end = new Date();
    const d = new Date(start);
    while (d <= end) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[habitId] && rec[habitId].done) {
        cur++;
        max = Math.max(max, cur);
      } else {
        cur = 0;
      }
      d.setDate(d.getDate() + 1);
    }
    return max;
  }

  function getCompletionRate(habitId, days) {
    let done = 0;
    const d = new Date();
    for (let i = 0; i < days; i++) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[habitId] && rec[habitId].done) done++;
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
        if (rec && rec[h.id] && rec[h.id].done) done++;
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
        if (rec && rec[h.id] && rec[h.id].done) done++;
      });
    }
    return total > 0 ? Math.round((done / total) * 100) : 0;
  }

  function getTodayDone() {
    const rec = checkinRecords[today()] || {};
    return habitsConfig.filter(h => h.enabled !== false && rec[h.id] && rec[h.id].done).length;
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
      const hasAny = rec && habitsConfig.some(h => {
        if (h.type === 'water') return ((rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000);
        return (rec[h.id] && rec[h.id].done);
      });
      if (hasAny) { cur++; max = Math.max(max, cur); }
      else { cur = 0; }
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
    getHealthTipSource
  };
})();
