(function() {
  const isChecked = App.Core.Storage.isHabitChecked;
  // 复用 utils.js 的统计缓存层：saveRecords/saveConfig 触发 markStatsDirty 时自动失效
  const _cachedStat = App.Core.Utils.cachedStat;

  // ===== 工具：本地日期加减，避免时区影响 =====
  // 入参 dateKey "YYYY-MM-DD"，返回新的 dateKey
  function _shiftDate(dateKey, deltaDays) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${dt.getFullYear()}-${mm}-${dd}`;
  }

  function _todayKey() {
    const d = new Date();
    if (typeof viewDateOffset !== 'undefined' && viewDateOffset) d.setDate(d.getDate() + viewDateOffset);
    return formatDate(d);
  }

  // ===== 连续打卡天数（支持补签后重算 + 跨年夜不中断） =====
  // 算法：从今天向前回溯；若今天未打卡，则从昨天开始（避免刚过零点 streak 归零）。
  // 补签过去日期会自动反映到结果中（因为直接读 checkinRecords）。
  // 复用 utils.js 的 _cachedStat 缓存：saveRecords 时 markStatsDirty 已失效缓存。
  function getStreak(habitId) {
    return _cachedStat('streak:' + habitId, function() {
      const h = habitsConfig.find(x => x.id === habitId);
      if (!h) return 0;
      let streak = 0;
      let key = _todayKey();
      // 今天未打卡则从昨天起算（防止跨日跳变）
      if (!isChecked(h, checkinRecords[key])) key = _shiftDate(key, -1);
      while (true) {
        const rec = checkinRecords[key];
        if (isChecked(h, rec)) { streak++; key = _shiftDate(key, -1); }
        else break;
      }
      return streak;
    });
  }

  // ===== 历史最大连续天数：使用反向索引 O(D_h) 而非 O(D × H) =====
  function getMaxStreak(habitId) {
    return _cachedStat('maxStreak:' + habitId, function() {
      const h = habitsConfig.find(x => x.id === habitId);
      if (!h) return 0;
      // 反向索引给出该习惯所有"有记录"的日期（升序）
      // 注意："有记录"≠"打卡完成"（如 negative 习惯 failed=true 时不算完成）
      // 所以仍需对每个候选日期调用 isChecked 过滤
      const dates = App.Core.Storage.getDatesForHabit(habitId);
      if (dates.length === 0) return 0;
      // 把"今天"也纳入（若今天已打卡，索引已含；若未打卡则不影响）
      let max = 0, cur = 0;
      let prev = null;
      for (let i = 0; i < dates.length; i++) {
        const key = dates[i];
        if (!isChecked(h, checkinRecords[key])) { cur = 0; prev = key; continue; }
        if (prev !== null) {
          // 连续条件：前一打卡日与当前相差 1 天
          const expected = _shiftDate(prev, 1);
          if (key === expected) cur++;
          else cur = 1;
        } else {
          cur = 1;
        }
        if (cur > max) max = cur;
        prev = key;
      }
      return max;
    });
  }

  // ===== 滑动窗口完成率：支持 7/30/365 天，使用反向索引 =====
  // 返回 0-100 整数
  function getCompletionRate(habitId, days) {
    return _cachedStat('rate:' + habitId + ':' + days, function() {
      const h = habitsConfig.find(x => x.id === habitId);
      if (!h) return 0;
      const today = _todayKey();
      const startKey = _shiftDate(today, -(days - 1));
      const dates = App.Core.Storage.getDatesForHabit(habitId);
      // 二分定位 ≥ startKey 的起点
      let lo = 0, hi = dates.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (dates[mid] < startKey) lo = mid + 1; else hi = mid; }
      let done = 0;
      for (let i = lo; i < dates.length; i++) {
        const key = dates[i];
        if (key > today) break; // 不计未来
        if (isChecked(h, checkinRecords[key])) done++;
      }
      return Math.round((done / days) * 100);
    });
  }

  // ===== 滑动窗口聚合：一次返回 7/30/365 三档完成率 =====
  function getSlidingRate(habitId) {
    return _cachedStat('sliding:' + habitId, function() {
      return {
        d7:  getCompletionRate(habitId, 7),
        d30: getCompletionRate(habitId, 30),
        d365: getCompletionRate(habitId, 365)
      };
    });
  }

  function getWeekRate() {
    return _cachedStat('weekRate', function() {
      if (habitsConfig.length === 0) return 0;
      let total = 0, done = 0;
      const d = new Date();
      if (typeof viewDateOffset !== 'undefined' && viewDateOffset) d.setDate(d.getDate() + viewDateOffset);
      for (let i = 0; i < 7; i++) {
        const key = formatDate(d);
        const rec = checkinRecords[key];
        habitsConfig.forEach(h => {
          if (h.enabled === false) return;
          total++;
          if (isChecked(h, rec)) done++;
        });
        d.setDate(d.getDate() - 1);
      }
      return total > 0 ? Math.round((done / total) * 100) : 0;
    });
  }

  function getMonthRate() {
    return _cachedStat('monthRate', function() {
      if (habitsConfig.length === 0) return 0;
      const now = new Date();
      if (typeof viewDateOffset !== 'undefined' && viewDateOffset) now.setDate(now.getDate() + viewDateOffset);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      let total = 0, done = 0;
      for (let i = 1; i <= daysInMonth; i++) {
        const key = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        const rec = checkinRecords[key];
        habitsConfig.forEach(h => {
          if (h.enabled === false) return;
          total++;
          if (isChecked(h, rec)) done++;
        });
      }
      return total > 0 ? Math.round((done / total) * 100) : 0;
    });
  }

  // ===== 全局最大连续天数：使用聚合日期集，避免 O(D × H) =====
  function getMaxStreakAll() {
    return _cachedStat('maxStreakAll', function() {
      // 收集所有"至少有一个习惯完成"的日期（升序去重）
      const doneDays = new Set();
      const enabledHabits = habitsConfig.filter(h => h.enabled !== false);
      for (const h of enabledHabits) {
        const dates = App.Core.Storage.getDatesForHabit(h.id);
        for (const k of dates) {
          if (isChecked(h, checkinRecords[k])) doneDays.add(k);
        }
      }
      if (doneDays.size === 0) return 0;
      const sorted = [...doneDays].sort();
      let max = 0, cur = 1;
      for (let i = 1; i < sorted.length; i++) {
        if (_shiftDate(sorted[i - 1], 1) === sorted[i]) cur++;
        else cur = 1;
        if (cur > max) max = cur;
      }
      return Math.max(max, cur);
    });
  }

  function getTodayDone() {
    return _cachedStat('todayDone', function() {
      const rec = checkinRecords[_todayKey()] || {};
      return habitsConfig.filter(h => h.enabled !== false && isChecked(h, rec)).length;
    });
  }

  function getTodayTotal() {
    return habitsConfig.filter(h => h.enabled !== false).length;
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

  // ===== 单习惯聚合统计（供详情面板使用） =====
  function getHabitStats(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return null;
    return {
      id: habitId,
      streak: getStreak(habitId),
      maxStreak: getMaxStreak(habitId),
      sliding: getSlidingRate(habitId),
      totalDays: App.Core.Storage.getDatesForHabit(habitId).filter(k => isChecked(h, checkinRecords[k])).length
    };
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Checkin = {
    getStreak,
    getMaxStreak,
    getCompletionRate,
    getSlidingRate,
    getWeekRate,
    getMonthRate,
    getTodayDone,
    getTodayTotal,
    getMaxStreakAll,
    getHealthTipText,
    getHealthTipSource,
    buildBatchCompleteRecord,
    getHabitStats
  };

  if (App.registerModule) {
    App.registerModule('modules.checkin', 'modules', null);
  }
})();
