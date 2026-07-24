/* ===== modules/checkin.js ===== */
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

/* ===== modules/habit.js ===== */
// habit.js - 习惯管理模块
// 职责：
//   1) 习惯分组排序（按完成时间 / 按分类 / 按频率）
//   2) 习惯删除时的打卡记录清理（修复 events.js#deleteHabit 的孤儿数据问题）
//   3) 习惯元数据维护（addedAt / lastDoneAt / archived）
//
// 设计要点：
//   - 排序函数不修改 habitsConfig 原顺序，返回新数组（避免 UI 副作用）
//   - 删除清理是事务性的：先克隆 records，清理后一次性 saveRecords
//   - CATEGORY_MAP / TIME_PERIOD_MAP 在 data/habits.js 中定义
(function() {
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  // ===== 工具：今日日期键（与 utils.today 保持一致） =====
  function _todayKey() {
    try { if (typeof today === 'function') return today(); } catch(e) {}
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // ===== 排序键：取某习惯最近一次完成时间（用于"按完成时间排序"） =====
  // 优先级：rec[habitId].lastInterval > rec[habitId].ts > dateKey 字符串
  // 返回 -1 表示从未完成
  function _lastDoneTimestamp(habitId) {
    var recs = (typeof checkinRecords !== 'undefined') ? checkinRecords : null;
    if (!recs) return -1;
    var latest = -1;
    // 反向遍历日期键（最近的在末尾），找到第一条已完成的即返回
    var keys = Object.keys(recs).sort().reverse();
    for (var i = 0; i < keys.length; i++) {
      var dk = keys[i];
      var entry = recs[dk];
      if (!entry || !entry[habitId]) continue;
      var item = entry[habitId];
      // 不论 done 状态，只要有记录条目即视为"操作过"
      var ts = item.lastInterval || item.ts || 0;
      if (ts > latest) latest = ts;
      // 若习惯条目存在但无 ts，用日期键字符串估算
      if (ts === 0 && dk) {
        var t = Date.parse(dk + 'T23:59:59');
        if (!isNaN(t) && t > latest) latest = t;
      }
    }
    return latest;
  }

  // ====================================================================
  // 5. 习惯分组排序逻辑
  // ====================================================================
  //
  // 支持三种 sortKey:
  //   - 'time'      按完成时间倒序（最近完成的排在前）
  //   - 'category'  按 CATEGORY_MAP 顺序分组，组内按 timePeriod 排序
  //   - 'frequency' 按 7 天完成率倒序
  //
  // 可选 groupBy:
  //   - 'none'      平铺返回
  //   - 'category'  按 CATEGORY_MAP 分组返回 {category, items}[]
  //   - 'timePeriod' 按 TIME_PERIOD_MAP 分组返回 {timePeriod, items}[]
  //
  function sortHabits(habits, sortKey, groupBy) {
    habits = habits || (typeof habitsConfig !== 'undefined' ? habitsConfig : []);
    var arr = habits.slice().filter(function(h){ return h && h.archived !== true; });

    var cmp;
    if (sortKey === 'time') {
      cmp = function(a, b) {
        var ta = _lastDoneTimestamp(a.id);
        var tb = _lastDoneTimestamp(b.id);
        return tb - ta; // 倒序
      };
    } else if (sortKey === 'frequency') {
      cmp = function(a, b) {
        var ra = _safeRate7(a.id);
        var rb = _safeRate7(b.id);
        return rb - ra;
      };
    } else if (sortKey === 'category') {
      cmp = function(a, b) {
        var ca = _categoryOrder(a.category);
        var cb = _categoryOrder(b.category);
        if (ca !== cb) return ca - cb;
        // 组内：按 timePeriod
        return _timePeriodOrder(a.timePeriod) - _timePeriodOrder(b.timePeriod);
      };
    } else {
      // 默认按 timePeriod -> category
      cmp = function(a, b) {
        var t = _timePeriodOrder(a.timePeriod) - _timePeriodOrder(b.timePeriod);
        if (t !== 0) return t;
        return _categoryOrder(a.category) - _categoryOrder(b.category);
      };
    }
    arr.sort(cmp);

    if (groupBy === 'category') return _groupByCategory(arr);
    if (groupBy === 'timePeriod') return _groupByTimePeriod(arr);
    return arr;
  }

  function _safeRate7(habitId) {
    try {
      if (App.Modules && App.Modules.Checkin && App.Modules.Checkin.getRate7) {
        return App.Modules.Checkin.getRate7(habitId);
      }
    } catch(e) {}
    return 0;
  }

  function _categoryOrder(cat) {
    var map = (typeof CATEGORY_MAP !== 'undefined') ? CATEGORY_MAP
      : (window.App && App.Data && App.Data.CATEGORY_MAP) ? App.Data.CATEGORY_MAP : null;
    if (!map || !map[cat]) return 99;
    // 按 CATEGORY_MAP 定义顺序：构造一次顺序表
    if (!_categoryOrder._seq) {
      _categoryOrder._seq = {};
      var idx = 0;
      for (var k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k)) {
          _categoryOrder._seq[k] = idx++;
        }
      }
    }
    return _categoryOrder._seq[cat] !== undefined ? _categoryOrder._seq[cat] : 99;
  }

  function _timePeriodOrder(tp) {
    var map = (typeof TIME_PERIOD_MAP !== 'undefined') ? TIME_PERIOD_MAP
      : (window.App && App.Data && App.Data.TIME_PERIOD_MAP) ? App.Data.TIME_PERIOD_MAP : null;
    if (!map || !map[tp]) return 99;
    return map[tp].order !== undefined ? map[tp].order : 99;
  }

  function _groupByCategory(arr) {
    var groups = [];
    var seen = {};
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i].category || 'daytime';
      if (!seen[c]) {
        seen[c] = { category: c, items: [] };
        groups.push(seen[c]);
      }
      seen[c].items.push(arr[i]);
    }
    return groups;
  }

  function _groupByTimePeriod(arr) {
    var groups = [];
    var seen = {};
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i].timePeriod || 'daytime';
      if (!seen[t]) {
        seen[t] = { timePeriod: t, items: [] };
        groups.push(seen[t]);
      }
      seen[t].items.push(arr[i]);
    }
    return groups;
  }

  // ====================================================================
  // 删除习惯时的孤儿记录清理（事务性）
  // ====================================================================
  //
  // 修复 events.js#deleteHabit 仅过滤 habitsConfig 未清理 records 的缺陷。
  // 调用方应在 deleteHabit 中调用本函数。
  //
  function cleanupRecordsForHabit(habitId) {
    var recs = (typeof checkinRecords !== 'undefined') ? checkinRecords : null;
    if (!recs) return { removed: 0 };

    // 克隆一份记录做修改，避免半途失败污染原数据
    var snapshot = JSON.parse(JSON.stringify(recs));
    var removed = 0;
    for (var dk in snapshot) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, dk)) continue;
      var entry = snapshot[dk];
      if (entry && Object.prototype.hasOwnProperty.call(entry, habitId)) {
        delete entry[habitId];
        removed++;
        // 若该日期已无任何习惯记录，删除空日期键（避免 _sortedDateKeys 膨胀）
        if (Object.keys(entry).length === 0) {
          delete snapshot[dk];
        }
      }
    }

    // 事务性写回：一次 localStorage.setItem
    // 注意：需通过 storage 模块的统一入口，触发缓存失效
    if (window.App && App.Core && App.Core.Storage) {
      // 直接替换内部引用并 saveRecords
      // 由于 storage 内部 _checkinRecords 通过 Object.defineProperty 代理到 window.checkinRecords
      // 我们直接赋值即可同步
      checkinRecords = snapshot;
      App.Core.Storage.saveRecords();
      if (App.Modules && App.Modules.Checkin && App.Modules.Checkin.invalidateCache) {
        App.Modules.Checkin.invalidateCache();
      }
    } else {
      // Fallback：直接写 localStorage（极端降级）
      try {
        localStorage.setItem('checkin_records', JSON.stringify(snapshot));
        checkinRecords = snapshot;
      } catch(e) {
        console.error('[Habit.cleanup] save failed:', e);
        return { removed: removed, error: 'save_failed' };
      }
    }
    return { removed: removed };
  }

  // ====================================================================
  // 软删除：归档习惯而非物理删除（保留历史统计完整性）
  // ====================================================================
  //
  // 推荐：UI 应优先调用 archiveHabit 而非 deleteHabit
  // 归档后：习惯不出现在打卡列表，但 stats 模块仍可查询历史
  //
  function archiveHabit(habitId) {
    if (typeof habitsConfig === 'undefined') return false;
    var h = habitsConfig.find(function(x){ return x.id === habitId; });
    if (!h) return false;
    h.archived = true;
    h.enabled = false;
    h.archivedAt = Date.now();
    if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveConfig();
    return true;
  }

  // 恢复归档习惯
  function unarchiveHabit(habitId) {
    if (typeof habitsConfig === 'undefined') return false;
    var h = habitsConfig.find(function(x){ return x.id === habitId; });
    if (!h) return false;
    h.archived = false;
    h.enabled = true;
    delete h.archivedAt;
    if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveConfig();
    return true;
  }

  // 物理删除：先清理记录，再删配置（事务性）
  function deleteHabitWithCleanup(habitId) {
    if (typeof habitsConfig === 'undefined') return { ok: false, error: 'no_config' };
    var exists = habitsConfig.some(function(h){ return h.id === habitId; });
    if (!exists) return { ok: false, error: 'not_found' };

    var cleanupResult = cleanupRecordsForHabit(habitId);
    // 移除习惯配置
    habitsConfig = habitsConfig.filter(function(h){ return h.id !== habitId; });
    if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveConfig();
    return { ok: true, removedRecords: cleanupResult.removed };
  }

  // ====================================================================
  // 习惯元数据维护：记录最后一次完成时间戳（写入 ts 字段）
  // ====================================================================
  //
  // 供 events.js 在打卡时调用（可选增强，不强制）
  //
  function touchLastDone(habitId, dateKey) {
    var recs = (typeof checkinRecords !== 'undefined') ? checkinRecords : null;
    if (!recs) return;
    var dk = dateKey || _todayKey();
    var entry = recs[dk];
    if (!entry) return;
    var item = entry[habitId];
    if (!item) return;
    if (!item.ts) {
      item.ts = Date.now();
      if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveRecords();
    }
  }

  // 标记习惯添加时间（供完成率分母裁剪用）
  function markAddedAt(habitId) {
    if (typeof habitsConfig === 'undefined') return;
    var h = habitsConfig.find(function(x){ return x.id === habitId; });
    if (!h || h.addedAt) return;
    h.addedAt = Date.now();
    if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveConfig();
  }

  function createHabitFromSuggestion(suggestion) {
    if (typeof habitsConfig === 'undefined') return null;
    var newId = 'habit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    var categoryMap = {
      '饮食': 'diet', '运动': 'sports', '睡眠': 'sleep', '情绪': 'emotion',
      '作息': 'sleep', '养生': 'wulao', '学习': 'pomodoro', '工作': 'pomodoro'
    };
    var categoryKey = categoryMap[suggestion.category] || 'wulao';
    var newHabit = {
      id: newId,
      name: suggestion.habit_name,
      icon: suggestion.icon || '🌱',
      category: categoryKey,
      desc: suggestion.description || '',
      target: suggestion.target || 1,
      unit: suggestion.unit || '次',
      freq: suggestion.frequency || 'daily',
      enabled: true,
      addedAt: Date.now()
    };
    habitsConfig.push(newHabit);
    if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveConfig();
    return newHabit;
  }

  function adjustHabitFromSuggestion(suggestion) {
    if (typeof habitsConfig === 'undefined') return null;
    var h = habitsConfig.find(function(x){ return x.id === suggestion.targetHabitId; });
    if (!h) return null;
    if (suggestion.newTarget !== undefined && suggestion.newTarget !== null) h.target = suggestion.newTarget;
    if (suggestion.newFrequency) h.freq = suggestion.newFrequency;
    if (suggestion.newName) h.name = suggestion.newName;
    if (window.App && App.Core && App.Core.Storage) App.Core.Storage.saveConfig();
    return h;
  }

  // ===== 暴露 =====
  App.Modules.Habit = {
    sortHabits: sortHabits,
    cleanupRecordsForHabit: cleanupRecordsForHabit,
    archiveHabit: archiveHabit,
    unarchiveHabit: unarchiveHabit,
    deleteHabitWithCleanup: deleteHabitWithCleanup,
    touchLastDone: touchLastDone,
    markAddedAt: markAddedAt,
    createHabitFromSuggestion: createHabitFromSuggestion,
    adjustHabitFromSuggestion: adjustHabitFromSuggestion,
    // 调试
    _lastDoneTimestamp: _lastDoneTimestamp
  };

  if (App.registerModule) {
    App.registerModule('modules.habit', 'modules', null);
  }
})();

/* ===== modules/stats.js ===== */
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

/* ===== modules/water.js ===== */
// water.js - 饮水追踪模块
(function() {
  function renderWaterTracker(h, rec, isViewToday) {
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
      const clickAttr = (isViewToday !== false && !filled) ? `onclick="quickAddWater('${h.id}',${perCup})"` : '';

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
        <div class="water-title">${esc(h.icon)} ${esc(h.name)} ${streak > 0 ? `<span style="font-size:11px;color:var(--accent);background:var(--accent-light);padding:2px 8px;border-radius:10px;font-weight:600">🔥${streak}天</span>` : ''}</div>
        <div class="water-amount">${doneCups}杯(${value}ml) / ${totalCups}杯(${goal}ml)</div>
      </div>
      <div class="water-progress">
        <div class="water-progress-fill ${fillClass}" style="width:${pct}%"></div>
        <div class="water-progress-text">${pct}%</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${remaining > 0 ? `还需 ${remainingCups}杯(${remaining}ml)` : '今日目标已达成！🎉'}</div>
      ${smartTip}
      ${cupsViz}
      ${isViewToday !== false ? `<div class="water-quick-row" style="margin:8px 0">
        <span class="water-qty-group">
          <button class="water-qty-btn" onclick="quickAddWater('${h.id}',${Math.round(perCup/2)})">${Math.round(perCup/2)}ml</button>
          <button class="water-qty-btn primary" onclick="quickAddWater('${h.id}',${perCup})">${perCup}ml</button>
          <button class="water-qty-btn" onclick="quickAddWater('${h.id}',${perCup*2})">${perCup*2}ml</button>
        </span>
        <button class="water-custom-btn" onclick="openWaterInputPanel('${h.id}')" title="自定义量">✏️ 自定义</button>
      </div>` : ''}
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

/* ===== modules/diet.js ===== */
(function() {
  /* ========== 原有数据 ========== */
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
    breakfast: { title:'早餐', time:'7:00-9:00', icon:'🥣', desc:'辰时胃经当令，营养吸收最佳', tips:['一定要吃早餐','碳水+蛋白质+蔬果搭配','不要吃得太急','温热食物为宜'] },
    lunch: { title:'午餐', time:'11:30-13:30', icon:'🍱', desc:'午时心经当令，午餐后宜小憩', tips:['吃饱但不要过饱','荤素搭配均衡','饭后散步10分钟','避免马上午睡'] },
    dinner: { title:'晚餐', time:'17:30-19:30', icon:'🍲', desc:'酉时肾经当令，晚餐宜早宜少', tips:['七分饱即可','清淡少油少盐','睡前3小时不吃东西','多吃蔬菜少吃肉'] },
  };

  /* ========== 新增：饮食记录配置 ========== */
  const STORAGE_KEY = 'diet_photo_records';
  const MAX_RECORDS = 60;
  const MEAL_OPTIONS = [
    {id:'breakfast',label:'早餐',icon:'🌅'},
    {id:'lunch',label:'午餐',icon:'☀️'},
    {id:'dinner',label:'晚餐',icon:'🌙'},
    {id:'snack',label:'加餐',icon:'🍎'}
  ];

  let currentDietView = 'knowledge';
  let tempPhotoBase64 = null;

  function today() {
    try { return App.Core.Utils.today(); }
    catch(e) {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
  }

  /* ========== 原有辅助函数 ========== */
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

  const SOLAR_TERM_FOODS = {
    '立春':{foods:['韭菜','豆芽','香椿','春笋','荠菜'],tag:'春'},
    '雨水':{foods:['山药','薏米','红枣','蜂蜜','南瓜'],tag:'湿'},
    '惊蛰':{foods:['梨','银耳','百合','莲子','蜂蜜'],tag:'燥'},
    '春分':{foods:['春笋','菠菜','芹菜','荠菜','枸杞'],tag:'平'},
    '清明':{foods:['青团','艾草','马兰头','螺蛳','河蚌'],tag:'清'},
    '谷雨':{foods:['香椿','豆芽','草莓','菠萝','桑葚'],tag:'湿'},
    '立夏':{foods:['苦瓜','黄瓜','绿豆','西瓜','莲子'],tag:'夏'},
    '小满':{foods:['苦瓜','绿豆','冬瓜','薏米','丝瓜'],tag:'湿'},
    '芒种':{foods:['杨梅','青梅','西瓜','绿豆汤','酸梅汤'],tag:'暑'},
    '夏至':{foods:['西瓜','苦瓜','绿豆','荷叶茶','鸭肉'],tag:'热'},
    '小暑':{foods:['绿豆','苦瓜','冬瓜','莲子','荷叶'],tag:'暑'},
    '大暑':{foods:['绿豆','苦瓜','莲子','冬瓜','西瓜'],tag:'热'},
    '立秋':{foods:['梨','银耳','百合','蜂蜜','柚子'],tag:'燥'},
    '处暑':{foods:['百合','银耳','莲子','梨','鸭肉'],tag:'润'},
    '白露':{foods:['山药','红枣','核桃','百合','银耳'],tag:'养'},
    '秋分':{foods:['秋梨','百合','银耳','蜂蜜','芝麻'],tag:'平'},
    '寒露':{foods:['芝麻','核桃','山药','红枣','栗子'],tag:'温'},
    '霜降':{foods:['柿子','栗子','萝卜','牛肉','羊肉'],tag:'补'},
    '立冬':{foods:['羊肉','牛肉','核桃','栗子','红薯'],tag:'补'},
    '小雪':{foods:['羊肉','牛肉','白萝卜','山药','核桃'],tag:'温'},
    '大雪':{foods:['羊肉','牛肉','萝卜','核桃','黑芝麻'],tag:'补'},
    '冬至':{foods:['饺子','羊肉','汤圆','核桃','黑芝麻'],tag:'补'},
    '小寒':{foods:['羊肉','牛肉','黑豆','黑芝麻','核桃'],tag:'温'},
    '大寒':{foods:['羊肉','牛肉','糯米','红枣','桂圆'],tag:'补'}
  };

  function getSeasonalTip() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    let term = null;
    let minDiff = Infinity;
    if (typeof SOLAR_TERMS !== 'undefined' && Array.isArray(SOLAR_TERMS)) {
      for (const t of SOLAR_TERMS) {
        const tDate = new Date(now.getFullYear(), t.month - 1, t.day);
        const diff = Math.abs(tDate - now);
        if (diff < minDiff) { minDiff = diff; term = t; }
      }
    }
    const seasonMap = {spring:'春季',summer:'夏季',autumn:'秋季',winter:'冬季'};
    const seasonEmojis = {spring:'🌱',summer:'☀️',autumn:'🍂',winter:'❄️'};
    const seasonTips = {
      '春季':'省酸增甘，以养脾气。多吃甘味食物如红枣、山药、小米。',
      '夏季':'清淡为主，适当食苦味清心火。多吃苦瓜、莲子、绿豆。',
      '秋季':'省辛增酸，以养肝气。多吃酸味食物如山楂、乌梅、石榴。',
      '冬季':'省咸增苦，以养心气。多吃黑色食物如黑豆、黑芝麻、核桃。'
    };
    if (term) {
      const season = seasonMap[term.season] || '四季';
      const seasonEmoji = seasonEmojis[term.season] || '🌍';
      const seasonTip = seasonTips[season] || '饮食有节，起居有常。';
      const termFoods = SOLAR_TERM_FOODS[term.name] || {foods:[],tag:''};
      return {
        season,
        icon: seasonEmoji,
        tip: seasonTip,
        termName: term.name,
        termEmoji: term.emoji,
        termTip: term.tip,
        foods: termFoods.foods,
        foodTag: termFoods.tag
      };
    }
    const season = month >= 2 && month <= 4 ? '春季' : month >= 5 && month <= 7 ? '夏季' : month >= 8 && month <= 10 ? '秋季' : '冬季';
    return {
      season,
      icon: seasonEmojis[season] || '🌍',
      tip: seasonTips[season] || '饮食有节，起居有常。',
      termName: null,
      termEmoji: null,
      termTip: null,
      foods: [],
      foodTag: ''
    };
  }

  /* ========== 新增：存储管理 ========== */
  function loadRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  }

  function saveRecords(records) {
    try {
      if (records.length > MAX_RECORDS) records = records.slice(0, MAX_RECORDS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch(e) {
      if (records.length > 5) {
        records = records.slice(0, Math.floor(records.length / 2));
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); return; }
        catch(e2) {}
      }
      if (typeof showToast === 'function') showToast('保存失败，存储空间已满');
    }
  }

  function addRecord(record) {
    const records = loadRecords();
    records.unshift(record);
    saveRecords(records);
  }

  function deleteRecord(id) {
    let records = loadRecords();
    records = records.filter(r => r.id !== id);
    saveRecords(records);
  }

  function getRecordsByDate(date) {
    return loadRecords().filter(r => r.date === date);
  }

  function getAllDates() {
    const records = loadRecords();
    const dates = [...new Set(records.map(r => r.date))];
    return dates.sort((a,b) => b.localeCompare(a));
  }

  /* ========== 新增：图片压缩 ========== */
  function compressImage(file, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ========== 新增：本地分析 ========== */
  function buildLocalAnalysis(records) {
    if (!records || records.length === 0) return null;
    const meals = records.map(r => r.meal);
    const hasBreakfast = meals.includes('breakfast');
    const hasLunch = meals.includes('lunch');
    const hasDinner = meals.includes('dinner');
    let score = 0, tips = [];

    if (hasBreakfast) score += 25; else tips.push('❌ 未记录早餐，辰时胃经当令，不吃早餐伤胃气');
    if (hasLunch) score += 25; else tips.push('❌ 未记录午餐，午时心经当令，午餐要吃饱');
    if (hasDinner) score += 25; else tips.push('❌ 未记录晚餐，酉时肾经当令，晚餐宜早宜少');

    const dinnerRec = records.find(r => r.meal === 'dinner');
    if (dinnerRec) {
      const hour = parseInt(dinnerRec.time.split(':')[0]);
      if (hour >= 20) tips.push('⚠️ 晚餐时间较晚，建议19:30前吃完');
      else score += 10;
    }

    const allDesc = records.map(r => r.description || '').join(' ');
    const hasVeggie = /菜|蔬|果|瓜|豆|菇|茄|椒|菠|芹|萝|西兰|生菜|白菜|青|绿/i.test(allDesc);
    if (hasVeggie) score += 15; else tips.push('💡 建议每餐搭配蔬菜，五谷为养，五菜为充');

    if (tips.length === 0) tips.push('✅ 今日饮食规律，继续保持！');

    return {
      score: Math.min(100, score),
      mealCount: records.length,
      hasBreakfast, hasLunch, hasDinner,
      tips,
      summary: `今日记录 ${records.length} 餐${hasBreakfast && hasLunch && hasDinner ? '，三餐规律' : ''}`
    };
  }

  /* ========== 新增：AI 分析 ========== */
  async function callDietAI(prompt) {
    let cfg = {};
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) cfg = JSON.parse(saved);
    } catch(e) {}

    const workerUrl = cfg.workerUrl || '';
    const apiKey = cfg.apiKey || '';
    const model = cfg.model || 'qwen-turbo';

    if (!workerUrl && !apiKey) throw new Error('AI 未配置');

    const messages = [
      {role:'system', content:'你是一位精通《黄帝内经》的中医养生顾问，擅长饮食调理建议。回答简洁实用，控制在200字以内。'},
      {role:'user', content:prompt}
    ];

    if (workerUrl) {
      const res = await fetch(workerUrl, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({model, messages, max_tokens:500, temperature:0.7})
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'Worker 错误');
      return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    } else {
      const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer ' + apiKey},
        body: JSON.stringify({model, messages, max_tokens:500, temperature:0.7})
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'API 错误');
      return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    }
  }



  /* ========== 原有：饮食知识视图 ========== */
  function renderKnowledgeView() {
    const tipOfDay = getDietTipOfDay();
    const currentMeal = getCurrentMeal();
    const seasonal = getSeasonalTip();

    let mealSection = '';
    if (currentMeal && mealTips[currentMeal]) {
      const meal = mealTips[currentMeal];
      mealSection = `
        <div class="diet-meal-card">
          <div class="diet-meal-header">
            <span class="diet-meal-icon">${esc(meal.icon)}</span>
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
          <div class="diet-color-icon">${esc(item.icon)}</div>
          <div class="diet-color-name">${item.color}色入${item.organ}</div>
          <div class="diet-color-foods">${item.foods.join('、')}</div>
        </div>
      `;
    });

    const dietHabits = habitsConfig.filter(h => h.category === 'diet' || h.category === 'quit');
    let todayDietRec = checkinRecords[today()] || {};
    let completedDiet = 0;
    dietHabits.forEach(h => { if (todayDietRec[h.id] && todayDietRec[h.id].done) completedDiet++; });

    return `
      <div class="diet-panel">
        <div class="diet-tip-card">
          <div class="diet-tip-icon">💡</div>
          <div class="diet-tip-content">
            <div class="diet-tip-text">"${esc(tipOfDay.tip)}"</div>
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
            <span class="diet-summary-val">${esc(seasonal.icon)} ${seasonal.season}</span>
            <span class="diet-summary-label">当前节气</span>
          </div>
        </div>

        <div class="diet-section-title">🌿 节气饮食</div>
        <div class="diet-seasonal-card">
          <span class="diet-seasonal-icon">${esc(seasonal.icon)}</span>
          <div class="diet-seasonal-text">${esc(seasonal.tip)}</div>
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
                <span class="diet-habit-icon">${esc(h.icon)}</span>
                <span class="diet-habit-name">${esc(h.name)}</span>
                <span class="diet-habit-check">${done ? '✓' : '打卡'}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="diet-section-title">📖 推荐阅读</div>
        <div class="diet-books-list">
          <div class="diet-book-item" onclick="openReference('references/饮膳正要/饮膳正要.html')">
            <span class="diet-book-emoji">🍲</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《饮膳正要》</div>
              <div class="diet-book-desc">元代宫廷营养学专著</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
          <div class="diet-book-item" onclick="openReference('references/你是你吃出来的/你是你吃出来的.html')">
            <span class="diet-book-emoji">🥗</span>
            <div class="diet-book-info">
              <div class="diet-book-name">《你是你吃出来的》</div>
              <div class="diet-book-desc">细胞营养与七大营养素</div>
            </div>
            <span class="diet-book-arrow">›</span>
          </div>
          <div class="diet-book-item" onclick="openReference('references/控糖革命/控糖革命.html')">
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

  function renderMealProgress(records) {
    const mealStats = {};
    MEAL_OPTIONS.forEach(m => { mealStats[m.id] = { label: m.label, icon: m.icon, count: 0 }; });
    records.forEach(r => { if (mealStats[r.meal]) mealStats[r.meal].count++; });
    const total = MEAL_OPTIONS.length;
    const done = MEAL_OPTIONS.filter(m => mealStats[m.id].count > 0).length;

    return `
      <div class="diet-meal-progress">
        <div class="diet-meal-progress-bar">
          ${MEAL_OPTIONS.map(m => `
            <div class="diet-meal-seg ${mealStats[m.id].count > 0 ? 'done' : ''}" title="${m.label}">
              <span class="diet-meal-seg-icon">${m.icon}</span>
              <span class="diet-meal-seg-label">${m.label}</span>
            </div>
          `).join('')}
        </div>
        <div class="diet-meal-progress-info">
          <span class="diet-meal-progress-text">已记录 ${done}/${total} 餐</span>
          <span class="diet-meal-progress-count">共 ${records.length} 张</span>
        </div>
      </div>
    `;
  }

  let _dietDietCollapsed = true;
  let _dietSportCollapsed = true;

  window.toggleDietKnowledge = function() {
    _dietDietCollapsed = !_dietDietCollapsed;
    const content = document.getElementById('dkCollapsibleContent');
    const arrow = document.getElementById('dkCollapseArrow');
    if (content) content.style.display = _dietDietCollapsed ? 'none' : 'block';
    if (arrow) arrow.style.transform = _dietDietCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  };

  window.toggleDietSport = function() {
    _dietSportCollapsed = !_dietSportCollapsed;
    const content = document.getElementById('dkSportContent');
    const arrow = document.getElementById('dkSportArrow');
    if (content) content.style.display = _dietSportCollapsed ? 'none' : 'block';
    if (arrow) arrow.style.transform = _dietSportCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
  };

  /* ========== 新增：饮食记录视图 ========== */
  function renderRecordView(targetDate) {
    const date = targetDate || today();
    const todayRecords = getRecordsByDate(date);
    const analysis = buildLocalAnalysis(todayRecords);
    const allDates = getAllDates();
    const seasonal = getSeasonalTip();
    const currentMeal = getCurrentMeal();
    const mealTip = currentMeal && mealTips[currentMeal] ? mealTips[currentMeal] : null;

    let tipCard = '';
    if (mealTip) {
      tipCard = `
        <div class="diet-tip-advice-card">
          <div class="diet-tip-advice-header">
            <span class="diet-tip-advice-icon">${esc(mealTip.icon)}</span>
            <span class="diet-tip-advice-title">${mealTip.title} · ${mealTip.time}</span>
          </div>
          <div class="diet-tip-advice-text">${esc(mealTip.tips[0])}</div>
          <div class="diet-tip-advice-tags">
            ${mealTip.tips.slice(1, 4).map(t => `<span class="diet-tip-tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
      `;
    } else if (seasonal) {
      tipCard = `
        <div class="diet-tip-advice-card">
          <div class="diet-tip-advice-header">
            <span class="diet-tip-advice-icon">${esc(seasonal.termEmoji || seasonal.icon)}</span>
            <span class="diet-tip-advice-title">${seasonal.termName || seasonal.season}饮食</span>
          </div>
          <div class="diet-tip-advice-text">${esc(seasonal.termTip || seasonal.tip)}</div>
        </div>
      `;
    }

    return `
      <div class="diet-record-view">
        <div class="diet-photo-hero">
          <input type="file" id="dietPhotoInput" accept="image/*" capture="environment" style="display:none" onchange="handleDietPhotoSelect(this)">
          <button class="diet-photo-hero-btn" onclick="document.getElementById('dietPhotoInput').click()">
            <div class="diet-photo-hero-icon">📷</div>
            <div class="diet-photo-hero-text">
              <div class="diet-photo-hero-title">拍照记录</div>
              <div class="diet-photo-hero-sub">记录每一餐 · 养成健康饮食习惯</div>
            </div>
            <div class="diet-photo-hero-arrow">›</div>
          </button>
        </div>

        ${tipCard}

        ${analysis ? renderAnalysisCard(analysis) : ''}

        <div class="diet-today-card">
          <div class="diet-today-header">
            <span class="diet-today-title">${date === today() ? '今日记录' : date + ' 记录'}</span>
          </div>
          ${renderMealProgress(todayRecords)}
          ${todayRecords.length > 0 ? renderRecordGrid(todayRecords) : '<div class="diet-empty-tip">' + (date === today() ? '今天还没有记录哦，点击上方按钮开始记录 📷' : '该日期暂无记录') + '</div>'}
        </div>

        ${renderHistorySection(allDates)}

        <div class="dk-collapse-wrap">
          <div class="dk-collapse-header" onclick="toggleDietKnowledge()">
            <span class="dk-collapse-title">🍃 饮食建议</span>
            <span class="dk-collapse-arrow" id="dkCollapseArrow">›</span>
          </div>
          <div class="dk-collapse-content" id="dkCollapsibleContent" style="display:${_dietDietCollapsed ? 'none' : 'block'}">
            ${renderDietKnowledgeCompact(seasonal, mealTip)}
          </div>
        </div>

        <div class="dk-collapse-wrap">
          <div class="dk-collapse-header" onclick="toggleDietSport()">
            <span class="dk-collapse-title">🏃 运动养生</span>
            <span class="dk-collapse-arrow" id="dkSportArrow">›</span>
          </div>
          <div class="dk-collapse-content" id="dkSportContent" style="display:${_dietSportCollapsed ? 'none' : 'block'}">
            ${renderSportsKnowledgeCompact()}
          </div>
        </div>

        <div style="height:20px"></div>
      </div>
    `;
  }

  function renderAnalysisCard(analysis) {
    const scoreColor = analysis.score >= 80 ? '#7CB69D' : analysis.score >= 60 ? '#F4A683' : '#E07A5F';
    return `
      <div class="diet-analysis-card">
        <div class="diet-analysis-header">
          <div class="diet-analysis-score-ring" style="--score-color:${scoreColor}">
            <span class="diet-analysis-score">${analysis.score}</span>
          </div>
          <div class="diet-analysis-info">
            <div class="diet-analysis-title">今日饮食评分</div>
            <div class="diet-analysis-summary">${esc(analysis.summary)}</div>
          </div>
        </div>
        <div class="diet-analysis-tags">
          ${analysis.tips.map(t => `<span class="diet-analysis-tag">${esc(t)}</span>`).join('')}
        </div>
        <div class="diet-analysis-footer">
          <button class="diet-analysis-ai-link" onclick="analyzeDietToday()">
            <span>🤖</span> AI 深度分析建议
          </button>
        </div>
      </div>
    `;
  }

  function renderRecordGrid(records) {
    return `
      <div class="diet-photo-grid">
        ${records.map(r => {
          const meal = MEAL_OPTIONS.find(m => m.id === r.meal);
          return `
            <div class="diet-photo-item" onclick="showDietPhotoDetail('${r.id}')">
              <img src="${r.image}" class="diet-photo-img" alt="">
              <div class="diet-photo-overlay">
                <span>${meal ? meal.icon : '🍽️'} ${esc(meal ? meal.label : '')}</span>
                <span>${esc(r.time)}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderHistorySection(allDates) {
    const otherDates = allDates.filter(d => d !== today());
    if (otherDates.length === 0) return '';

    return `
      <div class="diet-section-title">📆 历史记录</div>
      <div class="diet-history-list">
        ${otherDates.slice(0, 7).map((date, idx) => {
          const records = getRecordsByDate(date);
          const mealCount = records.length;
          const firstImg = records[0] ? records[0].image : '';
          const isLast = idx === otherDates.slice(0, 7).length - 1;
          return `
            <div class="diet-history-row">
              <div class="diet-history-timeline">
                <div class="diet-history-dot"></div>
                ${!isLast ? '<div class="diet-history-line"></div>' : ''}
              </div>
              <div class="diet-history-body">
                <div class="diet-history-item" onclick="toggleDietHistoryDate('${date}')">
                  <div class="diet-history-thumb" style="background-image:url('${firstImg}')"></div>
                  <div class="diet-history-info">
                    <div class="diet-history-date">${date}</div>
                    <div class="diet-history-count">共 ${mealCount} 餐</div>
                  </div>
                  <span class="diet-history-arrow" id="dietHistoryArrow_${date}">›</span>
                </div>
                <div class="diet-history-detail" id="dietHistoryDetail_${date}" style="display:none">
                  ${renderRecordGrid(records)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /* ========== 修改：主渲染函数（饮食面板只保留知识内容） ========== */
  function renderDietPanel() {
    return renderKnowledgeView();
  }

  /* ========== 新增：记录页底部知识精简卡 ========== */
  function renderDietKnowledgeCompact(seasonal, mealTip) {
    // 五色饮食精简
    const colorsHtml = fiveColorsFoods.map(item => `
      <div class="dk-color-item">
        <span class="dk-color-icon">${esc(item.icon)}</span>
        <span class="dk-color-name">${item.color}色·${item.organ}</span>
        <span class="dk-color-foods">${item.foods.slice(0,3).join('、')}</span>
      </div>
    `).join('');

    // 当餐建议精简
    let mealHtml = '';
    if (mealTip) {
      mealHtml = `
        <div class="dk-meal-card">
          <div class="dk-meal-header">
            <span class="dk-meal-icon">${esc(mealTip.icon)}</span>
            <span class="dk-meal-title">${mealTip.title} · ${mealTip.time}</span>
          </div>
          <div class="dk-meal-tips">
            ${mealTip.tips.map(t => `<span class="dk-meal-tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    return `
      <div class="dk-section">
        <div class="dk-section-title">饮食建议</div>
        <div class="dk-seasonal-card">
          <span class="dk-seasonal-icon">${esc(seasonal.icon)}</span>
          <div class="dk-seasonal-body">
            <div class="dk-seasonal-name">${seasonal.season}饮食</div>
            <div class="dk-seasonal-text">${esc(seasonal.tip)}</div>
          </div>
        </div>
        ${mealHtml}
        <div class="dk-colors-grid">${colorsHtml}</div>
      </div>
    `;
  }

  function renderSportsKnowledgeCompact() {
    if (!App.Data || !App.Data.MeridianSports) return '';
    const currentMeridian = App.Data.MeridianSports.find(m => {
      const h = new Date().getHours();
      return h >= m.start && h < m.end;
    }) || App.Data.MeridianSports[0];

    const dailyTargets = App.Data.DailyTargets || {};
    const targetsHtml = Object.entries(dailyTargets).map(([key, t]) => `
      <div class="dk-sport-target">
        <span class="dk-sport-target-label">${t.label}</span>
        <span class="dk-sport-target-val">${esc(t.target)}${esc(t.unit)}</span>
      </div>
    `).join('');

    // 运动处方精简（取前2个）
    const prescriptions = App.Data.SportPrescriptions || {};
    const prescriptionHtml = Object.values(prescriptions).slice(0, 2).map(p => `
      <div class="dk-prescription-card">
        <div class="dk-prescription-header">
          <span class="dk-prescription-icon">${esc(p.icon)}</span>
          <span class="dk-prescription-title">${p.title}</span>
        </div>
        <div class="dk-prescription-rows">
          <span>时长 ${p.duration}</span>
          <span>强度 ${p.intensity}</span>
        </div>
        <div class="dk-prescription-tip">${esc(p.tip)}</div>
      </div>
    `).join('');

    return `
      <div class="dk-section">
        <div class="dk-section-title">运动养生</div>
        <div class="dk-meridian-card">
          <span class="dk-meridian-icon">${esc(currentMeridian.icon)}</span>
          <div class="dk-meridian-body">
            <div class="dk-meridian-name">${esc(currentMeridian.name)} · ${currentMeridian.meridian}</div>
            <div class="dk-meridian-action">${currentMeridian.highlight ? '⭐ 最佳运动时段' : esc(currentMeridian.action)}</div>
          </div>
        </div>
        ${targetsHtml ? `<div class="dk-sport-targets">${targetsHtml}</div>` : ''}
        ${prescriptionHtml ? `<div class="dk-prescriptions">${prescriptionHtml}</div>` : ''}
      </div>
    `;
  }

  /* ========== 新增：全局交互函数 ========== */
  window.switchDietView = function(view) {
    currentDietView = view;
    const body = document.getElementById('dietPanelBody');
    if (body && App.Modules.Diet) {
      body.innerHTML = App.Modules.Diet.renderDietPanel();
    }
  };

  window.handleDietPhotoSelect = async function(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      if (typeof showToast === 'function') showToast('正在处理图片...');
      const base64 = await compressImage(file, 800, 0.7);
      tempPhotoBase64 = base64;
      showDietRecordForm(base64);
    } catch(e) {
      if (typeof showToast === 'function') showToast('图片处理失败');
      console.error(e);
    }
    input.value = '';
  };

  window.showDietRecordForm = function(base64) {
    const body = document.getElementById('dietPanelBody');
    const existing = document.getElementById('dietRecordFormOverlay');
    if (existing) existing.remove();

    const html = `
      <div id="dietRecordFormOverlay" class="diet-form-overlay" onclick="if(event.target===this)closeDietRecordForm()">
        <div class="diet-form-panel" onclick="event.stopPropagation()">
          <div class="diet-form-header">
            <span>📝 记录饮食</span>
            <button class="diet-form-close" onclick="closeDietRecordForm()">✕</button>
          </div>
          <div class="diet-form-body">
            <img src="${base64}" class="diet-form-preview">
            <div class="diet-form-group">
              <label>选择餐次</label>
              <div class="diet-meal-options">
                ${MEAL_OPTIONS.map(m => `
                  <div class="diet-meal-option" data-meal="${m.id}" onclick="selectDietMeal('${m.id}')">
                    <span class="diet-meal-option-icon">${m.icon}</span>
                    <span>${m.label}</span>
                  </div>
                `).join('')}
              </div>
            </div>
            <div class="diet-form-group">
              <label>食物描述（可选）</label>
              <textarea id="dietFormDesc" placeholder="例如：米饭、青菜、红烧肉、紫菜蛋花汤" rows="2"></textarea>
            </div>
            <button class="diet-form-save" onclick="saveDietRecord()">💾 保存记录</button>
          </div>
        </div>
      </div>
    `;
    body.insertAdjacentHTML('beforeend', html);

    const now = new Date();
    const hour = now.getHours();
    let defaultMeal = 'snack';
    if (hour >= 5 && hour < 10) defaultMeal = 'breakfast';
    else if (hour >= 10 && hour < 15) defaultMeal = 'lunch';
    else if (hour >= 15 && hour < 21) defaultMeal = 'dinner';
    selectDietMeal(defaultMeal);
  };

  window.selectDietMeal = function(mealId) {
    document.querySelectorAll('.diet-meal-option').forEach(el => {
      el.classList.toggle('selected', el.dataset.meal === mealId);
    });
    window._selectedDietMeal = mealId;
  };

  window.closeDietRecordForm = function() {
    const el = document.getElementById('dietRecordFormOverlay');
    if (el) el.remove();
    tempPhotoBase64 = null;
    window._selectedDietMeal = null;
  };

  window.saveDietRecord = function() {
    if (!tempPhotoBase64) return;
    const mealId = window._selectedDietMeal || 'snack';
    const descEl = document.getElementById('dietFormDesc');
    const desc = descEl ? descEl.value.trim() : '';
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

    const record = {
      id: 'diet_' + now.getTime(),
      date: today(),
      time: timeStr,
      meal: mealId,
      image: tempPhotoBase64,
      description: desc,
      createdAt: now.toISOString()
    };

    addRecord(record);
    closeDietRecordForm();
    if (typeof showToast === 'function') showToast('✅ 记录已保存');
    switchDietView('record');
  };

  window.deleteDietRecord = function(id) {
    if (!confirm('确定删除这条记录吗？')) return;
    deleteRecord(id);
    switchDietView('record');
    if (typeof showToast === 'function') showToast('已删除');
  };

  window.showDietPhotoDetail = function(id) {
    const records = loadRecords();
    const record = records.find(r => r.id === id);
    if (!record) return;
    const meal = MEAL_OPTIONS.find(m => m.id === record.meal);

    const html = `
      <div id="dietPhotoDetailOverlay" class="diet-form-overlay" onclick="if(event.target===this)closeDietPhotoDetail()">
        <div class="diet-detail-panel" onclick="event.stopPropagation()">
          <button class="diet-detail-close" onclick="closeDietPhotoDetail()">✕</button>
          <img src="${record.image}" class="diet-detail-img">
          <div class="diet-detail-info">
            <div class="diet-detail-meal">${meal ? meal.icon : '🍽️'} ${esc(meal ? meal.label : record.meal)} · ${esc(record.time)}</div>
            ${record.description ? `<div class="diet-detail-desc">${esc(record.description)}</div>` : ''}
            <button class="diet-detail-delete" onclick="deleteDietRecord('${record.id}'); closeDietPhotoDetail();">🗑️ 删除记录</button>
          </div>
        </div>
      </div>
    `;
    const body = document.getElementById('dietPanelBody');
    const existing = document.getElementById('dietPhotoDetailOverlay');
    if (existing) existing.remove();
    body.insertAdjacentHTML('beforeend', html);
  };

  window.closeDietPhotoDetail = function() {
    const el = document.getElementById('dietPhotoDetailOverlay');
    if (el) el.remove();
  };

  window.toggleDietHistoryDate = function(date) {
    const detail = document.getElementById('dietHistoryDetail_' + date);
    const arrow = document.getElementById('dietHistoryArrow_' + date);
    if (!detail) return;
    const showing = detail.style.display !== 'none';
    detail.style.display = showing ? 'none' : 'block';
    if (arrow) arrow.style.transform = showing ? '' : 'rotate(90deg)';
  };

  window.analyzeDietToday = async function() {
    const todayRecords = getRecordsByDate(today());
    if (todayRecords.length === 0) {
      if (typeof showToast === 'function') showToast('今天还没有记录');
      return;
    }

    let cfg = {};
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) cfg = JSON.parse(saved);
    } catch(e) {}
    if ((!cfg.workerUrl || cfg.workerUrl.trim() === '') && (!cfg.apiKey || cfg.apiKey.trim() === '')) {
      if (typeof showToast === 'function') showToast('请先配置AI（我的 → 设置 → AI配置）');
      return;
    }

    if (typeof showToast === 'function') showToast('AI 分析中...');

    try {
      const lines = todayRecords.map(r => {
        const meal = MEAL_OPTIONS.find(m => m.id === r.meal);
        return `- ${meal ? meal.label : r.meal}（${r.time}）：${r.description || '未描述'}`;
      });

      const prompt = `请作为中医养生顾问，根据以下今日饮食记录给出简短分析和建议（控制在200字以内）：\n\n${lines.join('\n')}\n\n请从以下角度分析：\n1. 三餐是否规律、时间是否合适\n2. 食物搭配是否合理（五谷、蔬果、蛋白质等）\n3. 从《黄帝内经》等中医角度给出建议\n4. 具体的改进建议`;

      const reply = await callDietAI(prompt);
      if (reply) {
        const body = document.getElementById('dietPanelBody');
        const html = `
          <div id="dietAIResultOverlay" class="diet-form-overlay" onclick="if(event.target===this)this.remove()">
            <div class="diet-ai-result-panel" onclick="event.stopPropagation()">
              <div class="diet-ai-result-header">
                <span>🤖 AI 饮食分析</span>
                <button onclick="document.getElementById('dietAIResultOverlay').remove()">✕</button>
              </div>
              <div class="diet-ai-result-body"><pre>${esc(reply)}</pre></div>
            </div>
          </div>
        `;
        const existing = document.getElementById('dietAIResultOverlay');
        if (existing) existing.remove();
        body.insertAdjacentHTML('beforeend', html);
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('AI分析失败：' + (e.message || '请检查网络或配置'));
      console.error(e);
    }
  };

  /* ========== 模块导出 ========== */
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Diet = {
    renderDietPanel,
    renderRecordView,
    getDietTipOfDay,
    getCurrentMeal,
    getSeasonalTip,
    switchDietView,
    loadRecords
    // 注意：saveRecords 不导出，避免与 App.Core.Storage.saveRecords 冲突
    // （compat.js 会把模块函数暴露到 window，导致 window.saveRecords 被覆盖）
  };

  if (App.registerModule) {
    App.registerModule('modules.diet', 'modules', null);
  }
})();

/* ===== modules/sports.js ===== */
(function() {
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
      App.Core.Utils.showToast(`${esc(sport.icon)} ${esc(sport.name)} 已打卡 ${esc(sport.target)}${esc(sport.unit)}！`);
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
          <span>${esc(sport.icon)} ${esc(sport.name)}</span>
          <button class="dialog-close">✕</button>
        </div>
        <div class="dialog-body">
          <div class="dialog-tip">${esc(sport.tip)}</div>
          <div class="dialog-input-group">
            <label>完成 ${esc(sport.unit)}</label>
            <input type="number" id="sportsValueInput" value="${esc(sport.target)}" min="1" placeholder="输入数值">
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
      App.Core.Utils.showToast(`${esc(sport.icon)} ${esc(sport.name)} 已打卡 ${value}${esc(sport.unit)}！`);
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
            <span class="sports-prescription-icon">${esc(currentMeridian.icon)}</span>
            <div>
              <div class="sports-prescription-title">${esc(currentMeridian.name)} · ${currentMeridian.meridian}</div>
              <div class="sports-prescription-desc">${currentMeridian.highlight ? '⭐ 最佳运动时段' : currentMeridian.action}</div>
            </div>
          </div>
          <div class="sports-daily-targets">
            ${Object.entries(dailyTargets).map(([key, target]) => `
              <div class="sports-target-item">
                <span class="sports-target-label">${target.label}</span>
                <span class="sports-target-value">${esc(target.target)}${esc(target.unit)}</span>
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
              <span class="sports-summary-val">${esc(currentMeridian.icon)} ${esc(currentMeridian.name)}</span>
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
                  <span>${esc(cat.icon)}</span>
                  <span>${cat.label}</span>
                </div>
                <div class="sports-quick-card-items">
                  ${sports.map(s => `
                    <button class="sports-quick-btn" onclick="App.Modules.Sports.quickCheckin('${s.id}')">
                      ${esc(s.icon)} ${esc(s.name)}
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
                <span>${esc(cat.icon)}</span>
                <span>${cat.label}</span>
                <span class="sports-category-desc">${cat.desc}</span>
              </div>
              <div class="sports-category-items">
                ${App.Data.SportsTypes.filter(s => s.category === key).map(s => `
                  <div class="sports-type-item">
                    <span class="sports-type-icon">${esc(s.icon)}</span>
                    <div class="sports-type-info">
                      <span class="sports-type-name">${esc(s.name)}</span>
                      <span class="sports-type-tip">${esc(s.tip)}</span>
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
                <span class="sports-prescription-card-icon">${esc(p.icon)}</span>
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
              <div class="sports-prescription-card-tip">${esc(p.tip)}</div>
              <div class="sports-prescription-card-ref">📖 ${p.ref}</div>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">⏰ 子午流注运动指南</div>
        <div class="sports-meridian-list">
          ${meridianSports.map(m => `
            <div class="sports-meridian-item ${m.highlight ? 'highlight' : ''} ${hour >= m.start && hour < m.end ? 'current' : ''}">
              <span class="sports-meridian-icon">${esc(m.icon)}</span>
              <span class="sports-meridian-time">${esc(m.name)}</span>
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
              <div class="sports-nutrition-card-tip">${esc(n.tip)}</div>
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
                  <span class="sports-habit-icon">${esc(h.icon)}</span>
                  <span class="sports-habit-name">${esc(h.name)}</span>
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
                <span class="sports-ref-name">${esc(r.name)}</span>
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

/* ===== modules/pomodoro.js ===== */
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

  function renderPomodoroPage() {
    populatePomoHabits();
    updatePomoStats();
  }

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
    sel.innerHTML = '<option value="">选择要专注的习惯</option>';
    habitsConfig.forEach(h => {
      if (h.enabled !== false) {
        sel.innerHTML += `<option value="${h.id}">${esc(h.icon)} ${esc(h.name)}</option>`;
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
    // 更新环形进度条 (周长 2*PI*90 ≈ 565.49)
    const ring = document.getElementById('pomoRingProgress');
    if (ring) {
      const circumference = 565.49;
      const offset = circumference * (1 - pct / 100);
      ring.style.strokeDashoffset = offset;
    }
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
  window.renderPomodoroPage = renderPomodoroPage;
  window.openPomodoroPanel = openPomodoroPanel;
  window.startPomodoro = startPomodoro;
  window.pausePomodoro = pausePomodoro;
  window.resumePomodoro = resumePomodoro;
  window.stopPomodoro = stopPomodoro;

  if (App.registerModule) {
    App.registerModule('modules.pomodoro', 'modules', null);
  }
})();

/* ===== modules/ai.js ===== */
(function() {
  'use strict';

  // ============================================================
// 配置说明
// ============================================================
// 安全策略：不内置任何 API Key / 代理地址，避免密钥泄露。
// 首次使用请在「设置」中填写你自己的阿里百炼 API Key，
// 并部署自己的 Cloudflare Worker 代理（或留空 Worker 走本地模型）。
// ============================================================

const DEFAULT_MODEL = 'qwen-turbo';

// 内置 Worker 地址：部署你自己的 serverless/cloudflare-workers/ai-proxy.js 后填入（例如 https://ai-proxy.xxx.workers.dev）。
// 仅放”你自己的” Worker 端点（不含任何密钥）；AI Key 由 Worker 服务端持有（环境变量 QWEN_API_KEY）。
// 留空则用户需自行在「设置」中填写；填入后即实现 AI / 推送”开箱即用”。
const DEFAULT_WORKER_URL = '';

// 自动初始化配置：确保有可用配置
function autoInitConfig() {
  try {
    let cfg = {};
    const saved = localStorage.getItem('ai_config');
    if (saved) {
      try { cfg = JSON.parse(saved); } catch(e){}
    }
    // App 内置云端配置（构建时由 Gradle 注入；纯 Web/PWA 环境为空对象）
    const builtin = (typeof window.__APP_CONFIG__ !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};
    // 补全缺省值；若内置提供了云端 Key / Worker，则一并注入（实现 App 内置 AI 零配置）
    const needsUpdate = !cfg.workerUrl || cfg.workerUrl.trim() === '' ||
                        !cfg.model || cfg.model.trim() === '' ||
                        (!cfg.apiKey || cfg.apiKey.trim() === '') && builtin.cloudAiKey;
    if (needsUpdate) {
      localStorage.setItem('ai_config', JSON.stringify({
        workerUrl: cfg.workerUrl || builtin.cloudAiUrl || DEFAULT_WORKER_URL,
        apiKey: cfg.apiKey || builtin.cloudAiKey || '',
        model: cfg.model || builtin.cloudAiModel || DEFAULT_MODEL
      }));
      console.log('[AI] 已补全默认配置' + (builtin.cloudAiKey ? '（含内置云端 Key）' : '（未注入密钥）'));
    }
  } catch (e) {
    console.warn('[AI] 自动初始化配置失败:', e);
  }
}
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
  // 兜底：localStorage 无配置时，使用 App 内置云端配置（如有）
  const builtin = (typeof window.__APP_CONFIG__ !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};
  return {
    workerUrl: builtin.cloudAiUrl || '',
    apiKey: builtin.cloudAiKey || '',
    model: builtin.cloudAiModel || DEFAULT_MODEL
  };
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

  // ============================================================
  // MCP 工具调用（通过 Worker 代理）
  // ============================================================
  async function callWorkerMcp(route, action, params) {
    const workerUrl = getWorkerUrl();
    if (!workerUrl) return null;
    try {
      const response = await fetch(workerUrl.replace(/\/$/, '') + route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });
      const data = await response.json();
      if (data.error) {
        console.warn('[AI MCP] 调用失败:', data.error);
        return null;
      }
      return data.data || data;
    } catch (e) {
      console.warn('[AI MCP] 请求异常:', e);
      return null;
    }
  }

  function callHowToCookMCP(action, params) {
    return callWorkerMcp('/mcp/howtocook', action, params);
  }

  function callKnowledgeMCP(action, params) {
    return callWorkerMcp('/mcp/knowledge', action, params);
  }

  function callStravaMCP(action, params) {
    return callWorkerMcp('/mcp/strava', action, params);
  }

  // 简单意图识别
  function detectHowToCookIntent(text) {
    const t = text.toLowerCase();
    const cookKeywords = ['菜', '菜谱', '食谱', '吃什么', '菜单', '做饭', '做饭', '晚餐', '午餐', '早餐', '一周菜谱', '推荐菜', ' dietary', 'recipe'];
    return cookKeywords.some(k => t.includes(k));
  }

  function detectKnowledgeIntent(text) {
    const t = text.toLowerCase();
    const healthKeywords = ['黄帝内经', '养生', '中医', '体质', '经络', '食疗', '节气', '阴阳', '脏腑', '睡眠', '失眠', '疲劳', '进补', '季节养生'];
    return healthKeywords.some(k => t.includes(k));
  }

  function detectStravaIntent(text) {
    const t = text.toLowerCase();
    const sportsKeywords = ['跑步', '骑行', '骑行', '游泳', '活动', '锻炼', '心率', '功率', '踏频', '海拔', '路段', '路线', 'gpx', 'tcx', '训练', 'strava'];
    return sportsKeywords.some(k => t.includes(k));
  }

  function extractCategory(text) {
    const categories = ['水产', '早餐', '荤菜', '素菜', '主食', '汤', '粥', '面食', '米饭'];
    for (const c of categories) if (text.includes(c)) return c;
    return '';
  }

  // AI 系统提示词（CREATE 框架优化版 v2.0）
  const SYSTEM_PROMPT = `【角色】
你是「养生小助手」AI 养生顾问，精通中医养生经典与现代健康科学，以「治未病」为核心理念，为用户提供实用、安全、有依据的养生建议。

你的说话风格：温和亲切、条理清晰、像一位经验丰富的养生师，不说空话套话，每条建议都具体可操作。

---

【核心原则 · 必须遵守】
1. 安全第一：不提供医疗诊断，不开处方药物，涉及疾病问题务必建议就医
2. 言必有据：每条养生建议至少标注一个引用出处（典籍或著作名称）
3. 实用至上：建议要具体到「做什么、做多久、什么时候做」，不泛泛而谈
4. 因人而异：结合体质、季节、时段给出差异化建议
5. 简洁高效：回答控制在 200 字以内，重点突出

---

【知识范围】
精通 9 部中医古籍与 15 部现代养生著作，涵盖：
- 中医基础：阴阳五行、脏腑经络、九种体质、二十四节气
- 生活方式：饮食营养、运动健身、睡眠调理、情志调养
- 道家养生：导引吐纳、形神兼养、不伤为本
- 现代科学：运动生理、营养科学、睡眠医学、正念冥想、肠道健康

主要典籍：《黄帝内经》《遵生八笺》《老老恒言》《饮膳正要》《养生论》《寿世青编》《备急千金要方·养性》《抱朴子》《闲情偶寄》
现代著作：《你是你吃出来的》《九种体质养生全书》《科学休息》《求医不如求己》《拉伸》《人体运动生理学》《高级运动营养学》《力量训练基础》《运动医学与康复》《睡眠革命》《运动改造大脑》《正念的奇迹》《抗炎生活》《肠子的小心思》《深度营养》

---

【能力边界 · 明确不能做的事】
- 不诊断疾病、不开药方、不替代专业医疗建议
- 不推荐具体药物、保健品品牌
- 对严重症状（持续疼痛、高烧、呼吸困难等）立即建议就医
- 不确定的知识坦诚说明，不编造理论或引用
- 不讨论与养生健康无关的话题

---

【回答格式】
按以下结构组织回答（用简短的小标题，不用 Markdown 标记）：

1. 核心建议（1-2 句点明主旨）
2. 具体方法（分点列出 2-3 条可操作建议）
3. 引用出处（标注参考的典籍或著作）

如果问题涉及疾病风险，在末尾加一行：⚠️ 以上建议仅供参考，症状持续请及时就医。

---

【输出前自检清单】
回答前请逐条检查，不满足的立即修正：
□ 是否给出了具体可操作的建议（不是空话）
□ 是否标注了至少一个引用出处
□ 字数是否控制在 200 字以内
□ 涉及健康风险是否有免责提醒
□ 是否超出了能力边界（如涉及医疗诊断）

---

【MCP 工具使用规则】
如果上下文提供了工具检索结果，请按以下规则使用：

1. HowToCook 菜谱数据：用户问饮食/菜谱时优先结合，推荐具体菜品和做法
2. 养生知识库检索结果：作为权威引用来源，优先使用检索到的内容
3. Strava 运动数据：结合用户实际运动数据给出个性化建议，如运动强度调整、恢复建议

工具结果是补充，不是全部。结合你的专业知识整合输出，不要原样堆砌工具返回的数据。如果没有提供工具结果，按你的知识正常回答，不要编造。

---

【最后提醒】
记住：你是养生顾问，不是医生。安全永远是第一位的。用你的专业知识帮助用户建立健康的生活习惯，这才是「治未病」的真谛。`;

  // MCP 上下文提示词（动态插入）
  function buildMcpContextPrompt(howtocookResult, knowledgeResult, stravaResult) {
    let parts = [];
    if (howtocookResult) {
      parts.push('【HowToCook 菜谱参考】\n' + JSON.stringify(howtocookResult).slice(0, 1200));
    }
    if (knowledgeResult) {
      parts.push('【养生知识库参考】\n' + JSON.stringify(knowledgeResult).slice(0, 1200));
    }
    if (stravaResult) {
      parts.push('【Strava 运动数据】\n' + JSON.stringify(stravaResult).slice(0, 1500));
    }
    return parts.join('\n\n');
  }

  // 配置参数
  const MAX_INPUT_LENGTH = 500;      // 最大输入长度
  const MAX_HISTORY_ROUNDS = 10;     // 对话历史保留轮数（1轮=用户+AI各1条）
  const MAX_HISTORY = MAX_HISTORY_ROUNDS * 2; // 消息条数（每轮2条）
  const MAX_TOKENS = 500;           // AI 回复最大 token 数
  const TEMPERATURE = 0.7;          // 创造性参数
  const MAX_RETRIES = 1;            // 网络错误自动重试次数
  const TYPING_SPEED = 15;          // 打字机效果速度（毫秒/字符）

  // 可用模型列表
  const MODEL_OPTIONS = [
    { value: 'qwen-turbo', label: 'qwen-turbo（轻量快速）' },
    { value: 'qwen-plus', label: 'qwen-plus（标准推荐）' },
    { value: 'qwen-max', label: 'qwen-max（最强智能）' },
    { value: 'qwen-coder-plus', label: 'qwen-coder-plus（编程专用）' },
    { value: 'deepseek-v3', label: 'deepseek-v3（深度推理）' },
    { value: 'deepseek-r1', label: 'deepseek-r1（推理增强）' },
    { value: 'local', label: '📱 本地模型（离线运行）' }
  ];

  // 本地模型配置
  const LOCAL_MODEL_CONFIG = {
    modelPath: '/data/data/com.rui66648.lifestyle/files/model.gguf',
    maxTokens: 512,
    temperature: 0.7
  };

  // 检测本地模型插件是否可用
  function isLocalModelAvailable() {
    try {
      return typeof Capacitor !== 'undefined' &&
        Capacitor.Plugins &&
        Capacitor.Plugins.LocalModel;
    } catch (e) { return false; }
  }

  // 本地模型调用
  async function callLocalModel(messages) {
    if (!isLocalModelAvailable()) {
      throw new Error('本地模型插件未安装，请在设置中切换到云端模型');
    }
    try {
      const result = await Capacitor.Plugins.LocalModel.chat({
        messages: messages,
        maxTokens: LOCAL_MODEL_CONFIG.maxTokens,
        temperature: LOCAL_MODEL_CONFIG.temperature
      });
      return result.response || '本地模型未返回内容';
    } catch (e) {
      throw new Error('本地模型调用失败: ' + (e.message || e));
    }
  }

  // 状态
  let aiChatHistory = [];
  let isLoading = false;
  let abortController = null;

  // ============================================================
  // API 用量监控
  // ============================================================
  const USAGE_KEY = 'ai_usage_stats';
  const USAGE_WARN_THRESHOLD = 50; // 每日提醒阈值（次）

  function loadUsageStats() {
    try {
      const saved = localStorage.getItem(USAGE_KEY);
      if (saved) {
        const stats = JSON.parse(saved);
        const today = new Date().toDateString();
        if (stats.date !== today) {
          return { date: today, count: 0, totalTokens: 0 };
        }
        return stats;
      }
    } catch (e) {}
    return { date: new Date().toDateString(), count: 0, totalTokens: 0 };
  }

  function saveUsageStats(stats) {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  function recordApiUsage(tokens = 0) {
    const stats = loadUsageStats();
    stats.count++;
    stats.totalTokens += tokens;
    saveUsageStats(stats);
    return stats;
  }

  function checkUsageWarning() {
    const stats = loadUsageStats();
    if (stats.count >= USAGE_WARN_THRESHOLD && stats.count % USAGE_WARN_THRESHOLD === 0) {
      return `今日已使用 ${stats.count} 次 AI 对话，请注意用量。`;
    }
    return null;
  }

  // ============================================================
  // 内容安全过滤
  // ============================================================
  const UNSAFE_KEYWORDS = [
    '处方', '开药', '剂量', 'mg', '毫克', '注射',
    '诊断', '治疗方案', '手术', '化疗', '放疗',
    '自杀', '自残', '毒品', '违禁'
  ];

  function filterUnsafeContent(text) {
    let filtered = text;
    for (const kw of UNSAFE_KEYWORDS) {
      const regex = new RegExp(kw, 'gi');
      filtered = filtered.replace(regex, '***');
    }
    return filtered;
  }

  function hasUnsafeUserInput(text) {
    const lower = text.toLowerCase();
    const highRisk = ['自杀', '自残', '毒品'];
    return highRisk.some(k => lower.includes(k));
  }

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
    // Worker 代理模式只需 workerUrl 即可（密钥在服务端），无需客户端 apiKey
    return (cfg.workerUrl && cfg.workerUrl.trim() !== '') || (cfg.apiKey && cfg.apiKey.trim() !== '');
  }

  function isUsingWorker() {
    const cfg = getConfig();
    return cfg.workerUrl.trim() !== '';
  }

  // ============================================================
  // UI 渲染（使用 textContent 防止 XSS）
  // ============================================================
  function renderAiPage() {
    const inputBar = document.querySelector('.ai-input-bar');
    const unconfiguredArea = document.getElementById('aiUnconfigured');
    const msgContainer = document.getElementById('aiChatMessages');

    // 检查配置状态
    if (!isConfigured()) {
      if (inputBar) inputBar.style.display = 'none';
      if (unconfiguredArea) unconfiguredArea.style.display = 'flex';
      if (msgContainer) msgContainer.innerHTML = '';
    } else {
      if (inputBar) inputBar.style.display = 'flex';
      if (unconfiguredArea) unconfiguredArea.style.display = 'none';
    }

    // 渲染历史消息或欢迎语
    if (msgContainer) {
      msgContainer.innerHTML = '';

      if (aiChatHistory.length === 0) {
        // 添加日期分隔线
        renderDateDivider();
        // 欢迎语（带特殊样式）
        renderAiMessage('ai', '你好！我是你的 AI 养生顾问 🌿\n\n以「治未病」为核心理念，精通24部中医经典与现代养生著作，为你提供实用、安全的养生建议。\n\n试试问我这些问题：\n• 失眠怎么调理？\n• 夏天吃什么好？\n• 久坐族怎么养生？\n• 气虚体质怎么补？', true);
      } else {
        // 渲染历史消息
        renderDateDivider();
        aiChatHistory.forEach(msg => {
          renderAiMessage(msg.role === 'user' ? 'user' : 'ai', msg.content, false);
        });
      }
    }

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
    if (!container) return null;

    const div = document.createElement('div');
    div.className = 'ai-msg ' + role + (isWelcome ? ' welcome-msg' : '');

    const avatar = role === 'ai' ? '🤖' : '👤';

    const avatarEl = document.createElement('div');
    avatarEl.className = 'ai-avatar';
    avatarEl.textContent = avatar;

    const bubbleEl = document.createElement('div');
    bubbleEl.className = 'ai-bubble';
    bubbleEl.textContent = text;

    div.appendChild(avatarEl);
    div.appendChild(bubbleEl);
    container.appendChild(div);

    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 50);

    return { div, bubbleEl };
  }

  function updateAiBubble(bubbleEl, text, isStreaming = false) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text;
    if (isStreaming) {
      bubbleEl.classList.add('typing');
    } else {
      bubbleEl.classList.remove('typing');
    }
    const container = document.getElementById('aiChatMessages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
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
  // SSE 流式响应解析
  // ============================================================
  async function parseSSEStream(reader, onChunk, onDone, onError) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            onDone && onDone();
            return;
          }

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices && data.choices[0] &&
              (data.choices[0].delta && data.choices[0].delta.content ||
               data.choices[0].message && data.choices[0].message.content);
            if (content) {
              onChunk && onChunk(content);
            }
          } catch (e) {
          }
        }
      }

      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr !== '[DONE]') {
            try {
              const data = JSON.parse(dataStr);
              const content = data.choices && data.choices[0] &&
                (data.choices[0].delta && data.choices[0].delta.content ||
                 data.choices[0].message && data.choices[0].message.content);
              if (content) {
                onChunk && onChunk(content);
              }
            } catch (e) {}
          }
        }
      }

      onDone && onDone();
    } catch (err) {
      onError && onError(err);
    }
  }

  // ============================================================
  // 打字机效果
  // ============================================================
  function typewriterEffect(bubbleEl, fullText, speed = TYPING_SPEED) {
    return new Promise((resolve) => {
      let index = 0;
      const totalLen = fullText.length;

      function typeNext() {
        if (index < totalLen) {
          const chunkSize = Math.min(3, totalLen - index);
          index += chunkSize;
          updateAiBubble(bubbleEl, fullText.slice(0, index), true);
          setTimeout(typeNext, speed);
        } else {
          updateAiBubble(bubbleEl, fullText, false);
          resolve();
        }
      }

      typeNext();
    });
  }

  // ============================================================
  // 滑动窗口：截断对话上下文（保留最近 N 轮）
  // ============================================================
  function trimConversationHistory(history) {
    if (history.length <= MAX_HISTORY) return history;
    return history.slice(-MAX_HISTORY);
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

    if (text.length === 0) {
      return;
    }

    if (text.length > MAX_INPUT_LENGTH) {
      renderAiError('输入太长了，请控制在 ' + MAX_INPUT_LENGTH + ' 字以内。');
      return;
    }

    if (hasUnsafeUserInput(text)) {
      renderAiError('您的问题涉及敏感内容，请调整后再试。如有紧急情况，请立即寻求专业帮助。');
      return;
    }

    input.value = '';
    isLoading = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn._originalHTML = sendBtn.innerHTML;
      sendBtn.innerHTML = '⏳';
    }

    renderAiMessage('user', text);
    aiChatHistory.push({ role: 'user', content: text, timestamp: Date.now() });

    const usageWarn = checkUsageWarning();

    renderAiLoading();

    let reply = '';
    let aiBubbleEl = null;
    let retryCount = 0;

    try {
      const model = currentConfig.model || DEFAULT_MODEL;

      let mcpContext = '';
      if (isUsingWorker()) {
        const [howtocookResult, knowledgeResult, stravaResult] = await Promise.all([
          detectHowToCookIntent(text)
            ? callHowToCookMCP(extractCategory(text) ? 'search' : 'today', {
                category: extractCategory(text),
                peopleCount: 2
              })
            : Promise.resolve(null),
          detectKnowledgeIntent(text)
            ? callKnowledgeMCP('search', { query: text, limit: 3 })
            : Promise.resolve(null),
          detectStravaIntent(text)
            ? callStravaMCP('recent-activities', { perPage: 5 })
            : Promise.resolve(null)
        ]);
        mcpContext = buildMcpContextPrompt(howtocookResult, knowledgeResult, stravaResult);
      }

      // 体质+季节+打卡数据联动注入（v2.2 增强）
      const constitution = JSON.parse(localStorage.getItem('constitution_result') || 'null');
      const ctype = constitution && window.App && App.Data && App.Data.CONSTITUTION_TYPES
        ? App.Data.CONSTITUTION_TYPES.find(c => c.id === constitution.typeId) : null;
      const solarTerm = (typeof getCurrentSolarTerm === 'function') ? getCurrentSolarTerm() : null;
      const season = (typeof getCurrentSeason === 'function') ? getCurrentSeason() : null;
      const seasonPack = (typeof getSeasonPack === 'function') ? getSeasonPack(season) : null;

      // 打卡数据统计
      let streak = 0, totalCheckins = 0, todayDone = 0, todayTotal = 0, levelName = '新手';
      if (typeof getCurrentStreak === 'function') streak = getCurrentStreak();
      if (typeof getTotalCheckins === 'function') totalCheckins = getTotalCheckins();
      if (typeof getTodayDone === 'function') todayDone = getTodayDone();
      if (typeof getTodayTotal === 'function') todayTotal = getTodayTotal();
      if (typeof getCurrentLevel === 'function') {
        const lv = getCurrentLevel();
        levelName = lv.name;
      }

      // 最近7天打卡趋势
      let weeklyTrend = [];
      try {
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
          const rec = (typeof checkinRecords !== 'undefined' && checkinRecords[key]) || {};
          let done = 0, total = 0;
          if (typeof habitsConfig !== 'undefined' && Array.isArray(habitsConfig)) {
            habitsConfig.forEach(h => {
              if (h.enabled === false) return;
              total++;
              if (App.Core.Storage && App.Core.Storage.isHabitChecked && App.Core.Storage.isHabitChecked(h, rec)) done++;
            });
          }
          weeklyTrend.push({ date: key, done, total, rate: total > 0 ? Math.round((done/total)*100) : 0 });
        }
      } catch(e) {}

      // 习惯分类统计
      let habitCategories = {};
      try {
        if (typeof habitsConfig !== 'undefined' && Array.isArray(habitsConfig)) {
          habitsConfig.forEach(h => {
            if (h.enabled === false) return;
            const cat = h.category || '其他';
            habitCategories[cat] = (habitCategories[cat] || 0) + 1;
          });
        }
      } catch(e) {}

      let userContext = '';
      if (ctype || solarTerm || season || streak > 0 || totalCheckins > 0) {
        userContext = '\n\n【用户上下文 · 必须融入建议】\n';
        
        // 体质信息
        if (ctype) {
          userContext += '体质：' + ctype.name + '（' + ctype.desc + '）\n';
          userContext += '体质特征：' + ctype.features + '\n';
          userContext += '调理方向：' + ctype.advice + '\n';
          if (ctype.foods) userContext += '宜食食物：' + ctype.foods + '\n';
          if (ctype.avoid) userContext += '忌食食物：' + ctype.avoid + '\n';
        }
        
        // 季节节气
        if (seasonPack) userContext += '季节：' + seasonPack.name + seasonPack.emoji + ' · ' + seasonPack.focus + '\n';
        if (solarTerm) userContext += '当前节气：' + solarTerm.emoji + solarTerm.name + (solarTerm.tip ? ' · ' + solarTerm.tip : '') + '\n';
        
        // 打卡数据
        userContext += '养生等级：' + levelName + '\n';
        userContext += '连续打卡：' + streak + '天\n';
        userContext += '累计打卡：' + totalCheckins + '次\n';
        userContext += '今日进度：' + todayDone + '/' + todayTotal + '（' + (todayTotal > 0 ? Math.round((todayDone/todayTotal)*100) : 0) + '%）\n';
        
        // 习惯分类
        if (Object.keys(habitCategories).length > 0) {
          userContext += '习惯分类：';
          Object.keys(habitCategories).forEach(cat => {
            userContext += cat + '(' + habitCategories[cat] + ')、';
          });
          userContext = userContext.slice(0, -1) + '\n';
        }
        
        // 周趋势（如果有数据）
        if (weeklyTrend.length === 7) {
          const avgRate = Math.round(weeklyTrend.reduce((sum, d) => sum + d.rate, 0) / 7);
          const bestDay = weeklyTrend.reduce((best, d) => d.rate > best.rate ? d : best, weeklyTrend[0]);
          const worstDay = weeklyTrend.reduce((worst, d) => d.rate < worst.rate ? d : worst, weeklyTrend[0]);
          userContext += '本周平均完成率：' + avgRate + '%\n';
          userContext += '最佳：' + bestDay.date + '（' + bestDay.rate + '%）\n';
          if (worstDay.rate < 100) userContext += '需加油：' + worstDay.date + '（' + worstDay.rate + '%）\n';
        }
        
        userContext += '\n请基于以上用户上下文给出针对性建议，结合用户的体质特点、当前季节养生要点和打卡数据，给出个性化的养生指导。';
      }
      const systemContent = SYSTEM_PROMPT + userContext + (mcpContext ? '\n\n' + mcpContext : '');

      const trimmedHistory = trimConversationHistory(aiChatHistory);
      const messagesForApi = [
        { role: 'system', content: systemContent },
        ...trimmedHistory.map(m => ({ role: m.role, content: m.content }))
      ];

      const executeRequest = async () => {
        if (model === 'local') {
          const result = await callLocalModel(messagesForApi);
          return { text: result, streamed: false };
        } else if (isUsingWorker()) {
          const workerUrl = getWorkerUrl();
          abortController = new AbortController();

          const response = await fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              max_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              stream: true
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const errMsg = data.error ? (typeof data.error === 'string' ? data.error : (data.error.message || data.error)) : '请求失败';
            const error = new Error(errMsg || 'AI 服务返回错误');
            error.status = response.status;
            throw error;
          }

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader();
            let fullText = '';

            removeAiLoading();
            const rendered = renderAiMessage('ai', '');
            aiBubbleEl = rendered.bubbleEl;
            updateAiBubble(aiBubbleEl, '', true);

            await new Promise((resolve, reject) => {
              parseSSEStream(
                reader,
                (chunk) => {
                  fullText += chunk;
                  updateAiBubble(aiBubbleEl, fullText, true);
                },
                () => resolve(),
                (err) => reject(err)
              );
            });

            return { text: fullText, streamed: true };
          } else {
            const data = await response.json();
            if (data.error) {
              const errMsg = typeof data.error === 'string' ? data.error : (data.error.message || data.error);
              throw new Error(errMsg || 'AI 服务返回错误');
            }
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) throw new Error('AI 没有返回有效回答');
            return { text: content, streamed: false };
          }
        } else {
          const apiKey = getApiKey();
          abortController = new AbortController();

          const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
              model: model,
              messages: messagesForApi,
              max_tokens: MAX_TOKENS,
              temperature: TEMPERATURE,
              stream: true
            }),
            signal: abortController.signal
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            const errMsg = data.error ? data.error.message || 'API 错误' : '请求失败';
            const error = new Error(errMsg);
            error.status = response.status;
            throw error;
          }

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/event-stream') && response.body) {
            const reader = response.body.getReader();
            let fullText = '';

            removeAiLoading();
            const rendered = renderAiMessage('ai', '');
            aiBubbleEl = rendered.bubbleEl;
            updateAiBubble(aiBubbleEl, '', true);

            await new Promise((resolve, reject) => {
              parseSSEStream(
                reader,
                (chunk) => {
                  fullText += chunk;
                  updateAiBubble(aiBubbleEl, fullText, true);
                },
                () => resolve(),
                (err) => reject(err)
              );
            });

            return { text: fullText, streamed: true };
          } else {
            const data = await response.json();
            if (data.error) throw new Error(data.error.message || 'API 错误');
            const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
            if (!content) throw new Error('AI 没有返回有效回答');
            return { text: content, streamed: false };
          }
        }
      };

      while (retryCount <= MAX_RETRIES) {
        try {
          const result = await executeRequest();
          reply = result.text;

          if (!result.streamed) {
            removeAiLoading();
            const filteredReply = filterUnsafeContent(reply);
            const rendered = renderAiMessage('ai', '');
            aiBubbleEl = rendered.bubbleEl;
            await typewriterEffect(aiBubbleEl, filteredReply);
            reply = filteredReply;
          } else {
            const filteredReply = filterUnsafeContent(reply);
            if (filteredReply !== reply) {
              updateAiBubble(aiBubbleEl, filteredReply, false);
              reply = filteredReply;
            } else {
              updateAiBubble(aiBubbleEl, reply, false);
            }
          }

          break;
        } catch (err) {
          if (retryCount < MAX_RETRIES &&
              (err.message.includes('Failed to fetch') ||
               err.message.includes('NetworkError') ||
               err.message.includes('网络请求失败') ||
               (err.status && err.status >= 500))) {
            retryCount++;
            console.warn('[AI] 第 ' + retryCount + ' 次重试...');
            await new Promise(r => setTimeout(r, 1000 * retryCount));
            continue;
          }
          throw err;
        }
      }

      aiChatHistory.push({ role: 'assistant', content: reply, timestamp: Date.now() });
      saveHistory();

      recordApiUsage(Math.round(reply.length / 2));

      if (usageWarn) {
        setTimeout(() => {
          renderAiError(usageWarn);
        }, 500);
      }

    } catch (err) {
      removeAiLoading();
      if (aiBubbleEl) {
        aiBubbleEl.parentElement && aiBubbleEl.parentElement.remove();
      }
      console.error('[AI] 请求失败:', err);

      let errorMsg = '网络错误，请检查网络连接。';
      let showConfigButton = false;

      if (err.name === 'AbortError') {
        errorMsg = '请求已取消。';
      } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('网络请求失败')) {
        errorMsg = '网络连接失败，请检查网络后重试。';
      } else if (err.message.includes('429') || err.status === 429) {
        errorMsg = '请求太频繁，请稍后再试。';
      } else if (err.message.includes('401') || err.message.includes('403') || err.status === 401 || err.status === 403) {
        errorMsg = 'API 认证失败，请检查配置或前往设置重新配置。';
        showConfigButton = true;
      } else if (err.message.includes('500') || (err.status && err.status >= 500)) {
        errorMsg = 'AI 服务暂时不可用，请稍后再试。';
      } else if (err.message) {
        errorMsg = err.message;
      }

      renderAiError(errorMsg);

      if (showConfigButton) {
        setTimeout(() => {
          const container = document.getElementById('aiChatMessages');
          if (container) {
            const btnDiv = document.createElement('div');
            btnDiv.style.textAlign = 'center';
            btnDiv.style.padding = '8px 0';
            btnDiv.innerHTML = '<button class="const-btn" onclick="closeAllPanels();openSettingsPanel()">前往设置</button>';
            container.appendChild(btnDiv);
            container.scrollTop = container.scrollHeight;
          }
        }, 100);
      }
    } finally {
      isLoading = false;
      abortController = null;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = sendBtn._originalHTML || '➤';
      }
      if (input) input.focus();
    }
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
      statusEl.textContent = '✅ 已配置 · API Key: ****' + key.slice(-4);
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
    const el = document.getElementById('profileAiStatus');
    if (!el) return;
    if (cfg.apiKey) {
      el.textContent = '✨ AI 已配置';
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = '🤖 AI 未配置';
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
    if (typeof habitsConfig !== 'undefined' && habitsConfig.length > 0) {
      const firstHabit = habitsConfig[0];
      const method = (firstHabit.reminder && firstHabit.reminder.method) ? firstHabit.reminder.method : 'in-app';
      if (window.updateReminderSegment) updateReminderSegment(method);
    }

    // 更新 AI 配置摘要
    const summaryEl = document.getElementById('settingsAiSummary');
    if (summaryEl) {
      if (cfg.apiKey) {
        const modelLabel = MODEL_OPTIONS.find(m => m.value === (cfg.model || DEFAULT_MODEL));
        summaryEl.textContent = '已配置 · ' + (modelLabel ? modelLabel.label : cfg.model);
      } else {
        summaryEl.textContent = '未配置';
      }
    }

    // 显示配置状态
    const statusEl = document.getElementById('settingsAiStatus');
    if (statusEl) {
      if (cfg.apiKey) {
        const modelLabel = MODEL_OPTIONS.find(m => m.value === (cfg.model || DEFAULT_MODEL));
        statusEl.textContent = '✅ 已配置 · ' + (modelLabel ? modelLabel.label : cfg.model) + ' · API Key: ****' + cfg.apiKey.slice(-4);
        statusEl.style.color = 'var(--accent)';
      } else {
        statusEl.textContent = '⚠️ 尚未配置 API Key';
        statusEl.style.color = 'var(--muted)';
      }
    }

    // 同步免打扰设置 UI
    if (typeof updateQuietHoursUI === 'function') updateQuietHoursUI();

    // 更新账号区域（APK 环境）
    if (typeof window.updateAccountUI === 'function') window.updateAccountUI();

    // 更新自动打卡区域（APK 环境）
    if (typeof window.updateAutoCheckinUI === 'function') window.updateAutoCheckinUI();

    openPanel('settingsPanel');
  }

  function openAiConfigPanel() {
    // 回填配置到二级页面
    const cfg = getConfig();
    const workerEl = document.getElementById('configWorkerUrl');
    const apiKeyEl = document.getElementById('configApiKey');
    const modelEl = document.getElementById('configModel');
    if (workerEl) workerEl.value = cfg.workerUrl || '';
    if (apiKeyEl) apiKeyEl.value = cfg.apiKey || '';
    if (modelEl) modelEl.value = cfg.model || DEFAULT_MODEL;

    openPanel('aiConfigPanel');
  }

  // ============================================================
  // AI 成长闭环：周报分析引擎
  // ============================================================
  const ANALYSIS_SYSTEM_PROMPT = `你是一位专业的习惯养成教练，擅长从数据中发现行为模式并给出实用建议。

【核心原则】
1. 语气温和，用"我们发现..."代替"你应该..."
2. 洞察要有数据支撑，不说空话
3. 建议要可执行，具体到"做什么、什么时候做、做多久"
4. 优先推荐"调整现有习惯"而非"新增习惯"
5. 周报最多2条建议，宁缺毋滥

【输出格式】
必须返回纯JSON格式，不要包含markdown代码块标记：

{
  "summary": {
    "overallRate": 72,
    "trend": "up|down|stable",
    "trendText": "比上周提升8% 👍",
    "bestHabit": {"id": "habit_id", "name": "习惯名称", "streak": 21},
    "weakestHabit": {"id": "habit_id", "name": "习惯名称", "rate": 40}
  },
  "insights": [
    {
      "id": "ins_001",
      "type": "correlation|milestone|warning|encouragement",
      "icon": "emoji",
      "title": "一句话洞察",
      "description": "详细说明（含数据支撑）",
      "confidence": 0.87,
      "dataSource": ["数据来源1", "数据来源2"]
    }
  ],
  "suggestions": [
    {
      "id": "sug_001",
      "insightId": "ins_001",
      "type": "adjust_existing|new_habit",
      "title": "建议标题",
      "description": "为什么给这个建议",
      "action": "adjust_habit|create_habit",
      "targetHabitId": "string|null",
      "adjustment": {"name": "新名称", "timePeriod": "noon", "reminderTime": "12:30"} | null,
      "newHabit": {
        "name": "习惯名称",
        "icon": "📋",
        "category": "sport|diet|study|sleep|mind|protect|care|home|social",
        "frequency": "daily",
        "timePeriod": "morning|noon|evening|night",
        "reminderTime": "07:00",
        "type": "boolean|number|time|water",
        "tip": "提示文字",
        "linkedData": ["data_source1", "data_source2"]
      } | null,
      "confidence": 0.82,
      "expectedImpact": "预期效果描述"
    }
  ]
}`;

  async function analyzeWeeklyData(weeklyData, onProgress) {
    if (!isConfigured()) {
      return generateFallbackAnalysis(weeklyData);
    }

    try {
      onProgress && onProgress('正在分析本周数据...');

      const promptData = {
        period: weeklyData.periodLabel,
        dateRange: weeklyData.startDate + ' ~ ' + weeklyData.endDate,
        summary: weeklyData.summary,
        userContext: weeklyData.userContext,
        bestHabit: weeklyData.bestHabit,
        weakestHabit: weeklyData.weakestHabit,
        highFailDay: weeklyData.highFailDay,
        categoryStats: weeklyData.categoryStats,
        waterStats: weeklyData.waterStats,
        emotionDist: weeklyData.emotionDist
      };

      const userPrompt = JSON.stringify(promptData, null, 2);

      const messages = [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ];

      onProgress && onProgress('AI正在生成建议...');

      const response = await callAiApi(messages);

      onProgress && onProgress('整理分析结果...');

      return parseAnalysisResponse(response);
    } catch (err) {
      console.error('[AI Growth] 分析失败:', err);
      return generateFallbackAnalysis(weeklyData);
    }
  }

  async function callAiApi(messages) {
    const cfg = getConfig();
    const model = cfg.model || DEFAULT_MODEL;

    if (model === 'local') {
      return await callLocalModel(messages);
    }

    const workerUrl = getWorkerUrl();
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('AI服务返回错误: ' + response.status);
    }

    const data = await response.json();
    return data.choices && data.choices[0] &&
      (data.choices[0].message && data.choices[0].message.content ||
       data.choices[0].text) || '';
  }

  function parseAnalysisResponse(response) {
    try {
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      const result = JSON.parse(jsonStr);
      return validateAnalysisResult(result);
    } catch (e) {
      console.warn('[AI Growth] JSON解析失败，使用fallback:', e);
      return null;
    }
  }

  function validateAnalysisResult(result) {
    if (!result || typeof result !== 'object') return null;

    const validResult = {
      summary: result.summary || {},
      insights: Array.isArray(result.insights) ? result.insights : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions.slice(0, 2) : []
    };

    validResult.suggestions.forEach((sug, idx) => {
      if (!sug.id) sug.id = 'sug_' + Date.now() + '_' + idx;
      if (!sug.insightId && validResult.insights[0]) sug.insightId = validResult.insights[0].id;
      if (!sug.confidence) sug.confidence = 0.7;
    });

    return validResult;
  }

  function generateFallbackAnalysis(weeklyData) {
    const suggestions = [];
    const insights = [];

    if (weeklyData.weakestHabit && weeklyData.weakestHabit.rate < 60) {
      insights.push({
        id: 'ins_fallback_1',
        type: 'warning',
        icon: '⚠️',
        title: `${weeklyData.weakestHabit.name}完成率偏低`,
        description: `本周${weeklyData.weakestHabit.name}完成率仅${weeklyData.weakestHabit.rate}%，建议加强这方面的习惯养成`,
        confidence: 0.85,
        dataSource: ['本周打卡记录']
      });

      suggestions.push({
        id: 'sug_fallback_1',
        insightId: 'ins_fallback_1',
        type: 'adjust_existing',
        title: '调整习惯执行时间',
        description: `我们发现${weeklyData.weakestHabit.name}完成率偏低，可能是时间安排不太合适。建议尝试调整到更适合的时间段。`,
        action: 'adjust_habit',
        targetHabitId: weeklyData.weakestHabit.id,
        adjustment: { name: weeklyData.weakestHabit.name, timePeriod: 'morning' },
        newHabit: null,
        confidence: 0.75,
        expectedImpact: '预计完成率提升20%'
      });
    }

    if (weeklyData.bestHabit && weeklyData.bestHabit.streak >= 7) {
      insights.push({
        id: 'ins_fallback_2',
        type: 'milestone',
        icon: '🎉',
        title: `${weeklyData.bestHabit.name}已连续${weeklyData.bestHabit.streak}天`,
        description: `太棒了！${weeklyData.bestHabit.name}已经形成了稳定的习惯回路`,
        confidence: 0.95,
        dataSource: ['打卡记录']
      });
    }

    if (weeklyData.highFailDay) {
      insights.push({
        id: 'ins_fallback_3',
        type: 'correlation',
        icon: '🔍',
        title: `${weeklyData.highFailDay.dayName}是你的低谷日`,
        description: `${weeklyData.highFailDay.dayName}的失败率高达${weeklyData.highFailDay.failRate}%，建议在这一天减少任务量或调整计划`,
        confidence: 0.8,
        dataSource: ['本周打卡记录']
      });
    }

    return {
      summary: weeklyData.summary || {},
      insights: insights,
      suggestions: suggestions.slice(0, 2)
    };
  }

  // ============================================================
  // 导出模块
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.AI = {
    openSettingsPanel,
    openAiConfigPanel,
    sendAiMessage,
    clearAiChat,
    saveAiConfig,
    isConfigured,
    isUsingWorker,
    analyzeWeeklyData
  };

  // 全局暴露（兼容 HTML onclick）
  window.renderAiPage = renderAiPage;
  window.openSettingsPanel = openSettingsPanel;
  window.openAiConfigPanel = openAiConfigPanel;
  window.sendAiMessage = sendAiMessage;
  window.clearAiChat = clearAiChat;
  window.saveAiConfig = saveAiConfig;

  // ============================================================
  // 键盘弹出自动滚动与输入框上移
  // ============================================================
  function initKeyboardScroll() {
    const input = document.getElementById('aiChatInput');
    const inputBar = document.querySelector('.ai-input-bar');
    const container = document.getElementById('aiChatMessages');
    if (!input) return;

    function scrollToBottom() {
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }

    function updateInputBarPosition() {
      if (!inputBar || !window.visualViewport) return;
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      if (keyboardHeight > 50) {
        inputBar.style.bottom = (keyboardHeight + 20) + 'px';
      } else {
        inputBar.style.bottom = '70px';
      }
    }

    input.addEventListener('focus', function() {
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
      setTimeout(scrollToBottom, 500);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function() {
        updateInputBarPosition();
        scrollToBottom();
      });
      window.visualViewport.addEventListener('scroll', scrollToBottom);
    }

    window.addEventListener('resize', function() {
      updateInputBarPosition();
      scrollToBottom();
    });
  }

  // 初始化：自动补全配置 + 加载历史记录 + 更新状态
autoInitConfig();
loadHistory();
updateProfileAiStatus();
initKeyboardScroll();

  if (App.registerModule) {
    App.registerModule('modules.ai', 'modules', null);
  }
})();

/* ===== modules/constitution.js ===== */
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
        '<span class="rh-name">' + esc(habit.name) + '</span>' +
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

/* ===== modules/poster.js ===== */
(function() {
  // 中文字体栈：覆盖 iOS / Android / Windows / macOS 主流中文字体
  var CN_FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans CN", "Noto Sans CJK SC", sans-serif';

  // roundRect polyfill（旧版浏览器兼容）
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
  }

  function openPosterPanel() {
    generatePoster();
    openPanel('posterPanel');
  }

  function generatePoster() {
    var canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = 640, h = 960;
    // 高 DPR 渲染保证清晰：物理像素 = 逻辑像素 × dpr
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. 背景：4 stop 渐变营造层次（暖米色 → 浅米 → 浅米 → 暖白）
    var bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#FDF8F0');
    bgGrad.addColorStop(0.45, '#FAF1E2');
    bgGrad.addColorStop(0.85, '#F5EDE0');
    bgGrad.addColorStop(1, '#FFFDF8');
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();

    // 2. 顶部圆角装饰条（渐变绿）
    var topGrad = ctx.createLinearGradient(0, 0, w, 0);
    topGrad.addColorStop(0, '#7CB69D');
    topGrad.addColorStop(0.5, '#A8D5BA');
    topGrad.addColorStop(1, '#7CB69D');
    ctx.fillStyle = topGrad;
    roundRect(ctx, 0, 0, w, 10, { tl: 24, tr: 24, br: 0, bl: 0 });
    ctx.fill();

    // 3. 标题（带柔和阴影提升可读性）
    ctx.save();
    ctx.shadowColor = 'rgba(124, 182, 157, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 38px ' + CN_FONT;
    ctx.textAlign = 'center';
    ctx.fillText('生活习惯小助手', w / 2, 84);
    ctx.restore();

    // 4. 副标题
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px ' + CN_FONT;
    ctx.fillText('基于《黄帝内经》的养生习惯追踪', w / 2, 118);

    // 5. 分隔线（带圆角端点的渐变细线）
    var lineGrad = ctx.createLinearGradient(80, 0, w - 80, 0);
    lineGrad.addColorStop(0, 'rgba(224, 216, 204, 0)');
    lineGrad.addColorStop(0.5, '#E0D8CC');
    lineGrad.addColorStop(1, 'rgba(224, 216, 204, 0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(80, 145);
    ctx.lineTo(w - 80, 145);
    ctx.stroke();

    // 6. 日期
    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px ' + CN_FONT;
    ctx.fillText(d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日', w / 2, 180);

    // 7. 数据准备
    var done = getTodayDone();
    var total = getTodayTotal();
    var streak = getMaxStreakAll();
    var completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    // 8. 完成率圆环（环形进度条）
    var ringCx = w / 2, ringCy = 290, ringR = 56;
    // 底环
    ctx.strokeStyle = 'rgba(124, 182, 157, 0.18)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // 进度环（渐变）
    var ringGrad = ctx.createLinearGradient(ringCx - ringR, ringCy, ringCx + ringR, ringCy);
    ringGrad.addColorStop(0, '#7CB69D');
    ringGrad.addColorStop(1, '#F4A683');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (completionPct / 100));
    ctx.stroke();
    // 中心百分比
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 32px ' + CN_FONT;
    ctx.fillText(completionPct + '%', ringCx, ringCy + 6);
    ctx.fillStyle = '#8D9196';
    ctx.font = '14px ' + CN_FONT;
    ctx.fillText('今日完成', ringCx, ringCy + 28);

    // 9. 今日完成数
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 26px ' + CN_FONT;
    ctx.fillText('今日 ' + done + '/' + total + ' 个习惯', w / 2, 388);

    // 10. 连续打卡
    if (streak > 0) {
      ctx.fillStyle = '#F4A683';
      ctx.font = 'bold 24px ' + CN_FONT;
      ctx.fillText('连续打卡 ' + streak + ' 天 🔥', w / 2, 425);
    }

    // 11. 分隔线
    ctx.beginPath();
    ctx.moveTo(120, 460);
    ctx.lineTo(w - 120, 460);
    ctx.stroke();

    // 12. 今日养生名言
    var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    var quote = QUOTES[dayOfYear % QUOTES.length];

    // 名言卡片（圆角矩形背景）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    roundRect(ctx, 70, 490, w - 140, 220, 16);
    ctx.fill();

    ctx.fillStyle = '#5B8DB8';
    ctx.font = 'italic 22px ' + CN_FONT;
    ctx.fillText('📖 今日养生名言', w / 2, 525);

    ctx.fillStyle = '#2D3436';
    ctx.font = '22px ' + CN_FONT;
    var maxWidth = w - 200;
    var words = quote.split('');
    var line = '', y = 565;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, w / 2, y);
        line = words[i];
        y += 34;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w / 2, y);

    // 13. 底部圆角装饰条
    var botGrad = ctx.createLinearGradient(0, 0, w, 0);
    botGrad.addColorStop(0, '#7CB69D');
    botGrad.addColorStop(0.5, '#A8D5BA');
    botGrad.addColorStop(1, '#7CB69D');
    ctx.fillStyle = botGrad;
    roundRect(ctx, 0, h - 10, w, 10, { tl: 0, tr: 0, br: 24, bl: 24 });
    ctx.fill();

    // 14. 底部说明
    ctx.fillStyle = '#8D9196';
    ctx.font = '18px ' + CN_FONT;
    ctx.fillText('扫码体验 → rui66648.github.io/lifestyle-assistant', w / 2, h - 40);
  }

  function downloadPoster() {
    var canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    var link = document.createElement('a');
    link.download = '打卡海报_' + new Date().toISOString().slice(0, 10) + '.png';
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

/* ===== modules/notification.js ===== */
/**
 * 统一提醒调度器（Notification Scheduler v3.0）
 *
 * 功能：
 * - 统一管理 4 种提醒方式：toast / notification / alarm / off
 * - 支持定时提醒（固定时间）和间隔提醒（周期性）
 * - 支持免打扰时段
 * - 支持按星期几配置
 * - 平台自适应：PWA（浏览器Notification+SW） / APK（Capacitor LocalNotifications）
 * - 统一权限请求（先说明原因再请求）
 * - 防重复触发机制
 *
 * v3.0 重构：
 *  - 从分散的 main.js / local-notify.js / push.js 中提取统一调度逻辑
 *  - 引入 ReminderScheduler 类统一管理注册/触发/取消
 *  - 间隔提醒改用 setTimeout 链式调度（替代 setInterval 轮询）
 *  - 强提醒（alarm）完整效果链：声音 + 振动 + 屏幕闪烁
 */
(function() {
  'use strict';

  var _platform = window.__PLATFORM__ || 'pwa';
  var _initialized = false;
  var _permissionGranted = false;

  // ============================================================
  // 提醒方式枚举
  // ============================================================
  var REMINDER_METHODS = {
    TOAST: 'toast',
    NOTIFICATION: 'notification',
    ALARM: 'alarm',
    OFF: 'off'
  };

  // ============================================================
  // 内部状态
  // ============================================================
  var _fixedTimers = {};
  var _intervalTimers = {};
  var _FIRED_KEY_STORAGE = 'notify_fired_keys';
  var _FIRED_KEY_TTL = 24 * 60 * 60 * 1000;

  // 从 sessionStorage 恢复已触发记录，避免页面刷新后重复触发
  function _loadFiredKeys() {
    try {
      return JSON.parse(sessionStorage.getItem(_FIRED_KEY_STORAGE) || '{}');
    } catch(e) { return {}; }
  }
  function _saveFiredKeys(keys) {
    try {
      sessionStorage.setItem(_FIRED_KEY_STORAGE, JSON.stringify(keys));
    } catch(e) {}
  }
  var _firedKeys = _loadFiredKeys();

  // ============================================================
  // 免打扰配置（v3.1 增强：支持按习惯配置）
  // ============================================================
  function getQuietConfig() {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      // 兼容旧的整点格式（start/end 为小时数）和新的分钟格式（startMin/endMin）
      var startMin = cfg.startMin != null ? cfg.startMin : (cfg.start || 22) * 60;
      var endMin = cfg.endMin != null ? cfg.endMin : (cfg.end || 7) * 60;
      return {
        enabled: cfg.enabled !== false,
        start: startMin / 60,
        end: endMin / 60,
        startMin: startMin,
        endMin: endMin,
        perHabit: cfg.perHabit || {}
      };
    } catch(e) { return { enabled: true, start: 22, end: 7, startMin: 22*60, endMin: 7*60, perHabit: {} }; }
  }

  function saveQuietConfig(cfg) {
    try {
      localStorage.setItem('quiet_hours', JSON.stringify(cfg));
    } catch(e) {}
  }

  function isInQuietHours(date, method, habitId) {
    if (method === REMINDER_METHODS.ALARM) return false;
    var qc = getQuietConfig();

    // 先检查全局免打扰
    if (qc.enabled) {
      var currentMin = date.getHours() * 60 + date.getMinutes();
      var startMin = qc.startMin;
      var endMin = qc.endMin;

      var isQuiet = false;
      if (startMin < endMin) {
        isQuiet = currentMin >= startMin && currentMin < endMin;
      } else {
        isQuiet = currentMin >= startMin || currentMin < endMin;
      }

      if (isQuiet) {
        // 如果有按习惯配置的免打扰时段，检查是否覆盖全局
        if (habitId && qc.perHabit[habitId]) {
          var ph = qc.perHabit[habitId];
          if (!ph.enabled) return false;
          if (ph.startMin !== undefined && ph.endMin !== undefined) {
            var isPhQuiet = false;
            if (ph.startMin < ph.endMin) {
              isPhQuiet = currentMin >= ph.startMin && currentMin < ph.endMin;
            } else {
              isPhQuiet = currentMin >= ph.startMin || currentMin < ph.endMin;
            }
            return isPhQuiet;
          }
        }
        return true;
      }
    }

    // 检查按习惯配置的免打扰（即使全局关闭）
    if (habitId && qc.perHabit[habitId]) {
      var ph = qc.perHabit[habitId];
      if (!ph.enabled) return false;
      if (ph.startMin !== undefined && ph.endMin !== undefined) {
        var currentMin = date.getHours() * 60 + date.getMinutes();
        if (ph.startMin < ph.endMin) {
          return currentMin >= ph.startMin && currentMin < ph.endMin;
        } else {
          return currentMin >= ph.startMin || currentMin < ph.endMin;
        }
      }
    }

    return false;
  }

  // ============================================================
  // 工具函数
  // ============================================================
  function parseTime(str) {
    if (!str) return null;
    var parts = str.split(':');
    return { h: parseInt(parts[0]) || 0, m: parseInt(parts[1]) || 0 };
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function makeKey(habitId, type, time) {
    return habitId + '_' + type + '_' + getTodayStr() + '_' + (time || '');
  }

  function hasFired(key) {
    if (_firedKeys[key]) {
      if (Date.now() - _firedKeys[key] < _FIRED_KEY_TTL) return true;
      delete _firedKeys[key];
      _saveFiredKeys(_firedKeys);
    }
    return false;
  }

  function markFired(key) {
    _firedKeys[key] = Date.now();
    _saveFiredKeys(_firedKeys);
  }

  function cleanupFiredKeys() {
    var now = Date.now();
    var changed = false;
    for (var k in _firedKeys) {
      if (now - _firedKeys[k] >= _FIRED_KEY_TTL) { delete _firedKeys[k]; changed = true; }
    }
    if (changed) _saveFiredKeys(_firedKeys);
  }
  setInterval(cleanupFiredKeys, 60 * 60 * 1000);

  // ============================================================
  // 权限管理
  // ============================================================
  function checkPermission() {
    if (_platform === 'apk') {
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.checkPermission) {
        return App.Modules.LocalNotify.checkPermission().then(function(granted) {
          _permissionGranted = granted;
          return granted;
        });
      }
      return Promise.resolve(false);
    }
    if ('Notification' in window) {
      _permissionGranted = Notification.permission === 'granted';
      return Promise.resolve(_permissionGranted);
    }
    return Promise.resolve(false);
  }

  function requestPermission(reason) {
    if (_permissionGranted) return Promise.resolve(true);

    if (reason && typeof showToast === 'function') {
      showToast(reason, 2000);
    }

    if (_platform === 'apk') {
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.requestPermission) {
        return App.Modules.LocalNotify.requestPermission().then(function(granted) {
          _permissionGranted = granted;
          return granted;
        });
      }
      return Promise.resolve(false);
    }

    if (!('Notification' in window)) {
      if (typeof showToast === 'function') showToast('您的设备不支持通知功能');
      return Promise.resolve(false);
    }

    if (Notification.permission === 'denied') {
      if (typeof showToast === 'function') showToast('请在系统设置中开启通知权限');
      return Promise.resolve(false);
    }

    return Notification.requestPermission().then(function(perm) {
      _permissionGranted = perm === 'granted';
      if (typeof showToast === 'function') {
        showToast(_permissionGranted ? '通知权限已开启' : '未获得通知权限');
      }
      return _permissionGranted;
    });
  }

  // ============================================================
  // 提醒触发核心
  // ============================================================
  function triggerReminder(habit, options) {
    options = options || {};
    var rawMethod = habit.reminder ? (habit.reminder.method || REMINDER_METHODS.TOAST) : REMINDER_METHODS.TOAST;
    var method = rawMethod;

    if (method === REMINDER_METHODS.OFF || method === 'none') return;

    var now = new Date();
    if (isInQuietHours(now, rawMethod, habit.id)) return;

    var soundOn = habit.reminder ? (habit.reminder.sound !== false) : true;
    var vibrateOn = habit.reminder ? (habit.reminder.vibrate !== false) : true;

    var title = (habit.icon || '') + ' ' + habit.name + '时间到了';
    var body = habit.tip || '记得完成打卡哦';

    switch (method) {
      case REMINDER_METHODS.TOAST:
        _triggerToast(title, body, soundOn);
        break;

      case REMINDER_METHODS.NOTIFICATION:
        _triggerNotification(title, body, habit, soundOn, vibrateOn);
        break;

      case REMINDER_METHODS.ALARM:
        _triggerAlarm(title, body, habit, soundOn, vibrateOn);
        break;

      case 'banner':
      case 'in-app':
        _triggerToast(title, body, soundOn);
        break;
    }
  }

  function _triggerToast(title, body, soundOn) {
    var msg = title + '！' + (body ? '（' + body + '）' : '');
    if (typeof showToast === 'function') {
      showToast(msg, 3000);
    }
    if (soundOn && typeof playSound === 'function') {
      playSound('reminder');
    }
  }

  function _triggerNotification(title, body, habit, soundOn, vibrateOn) {
    if (_platform === 'apk') {
      if (App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.sendNotification) {
        App.Modules.LocalNotify.sendNotification(title, body, {
          extra: { habitId: habit.id },
          sound: soundOn
        });
      }
    } else {
      if (_permissionGranted && 'Notification' in window) {
        try {
          var n = new Notification(title, {
            body: body,
            icon: './assets/icon-192.png',
            badge: './assets/icon-192.png',
            tag: 'lifestyle-reminder',
            requireInteraction: true,
            renotify: true
          });
          n.onclick = function() {
            window.focus();
            n.close();
            if (typeof focusHabitById === 'function') focusHabitById(habit.id);
          };
        } catch(e) { console.warn('通知发送失败:', e); }
      }
    }
    if (soundOn && typeof playSound === 'function') playSound('reminder');
    if (vibrateOn && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  }

  function _triggerAlarm(title, body, habit, soundOn, vibrateOn) {
    if (_platform === 'apk' && App.Modules && App.Modules.LocalNotify && App.Modules.LocalNotify.sendAlarmNotification) {
      App.Modules.LocalNotify.sendAlarmNotification(title, body, {
        extra: { habitId: habit.id },
        sound: soundOn
      });
    } else {
      _triggerNotification(title, body, habit, soundOn, vibrateOn);
    }
    if (typeof playAlarmSequence === 'function') {
      playAlarmSequence();
    }
    if (typeof flashScreen === 'function') {
      flashScreen();
    }
  }

  // ============================================================
  // 固定时间提醒调度
  // ============================================================
  function scheduleFixedReminder(habit) {
    if (!habit || !habit.reminder || !habit.reminder.enabled) return;
    cancelFixedReminder(habit.id);

    if (_platform === 'apk') {
      return;
    }

    var times = [];
    if (habit.reminder.time) times.push(habit.reminder.time);
    if (habit.reminder.extraTimes && habit.reminder.extraTimes.length) {
      times = times.concat(habit.reminder.extraTimes);
    }

    times.forEach(function(t, idx) {
      if (!t) return;
      var tm = parseTime(t);
      if (!tm) return;

      function scheduleNext() {
        var now = new Date();
        var target = new Date();
        target.setHours(tm.h, tm.m, 0, 0);
        if (target <= now) {
          target.setDate(target.getDate() + 1);
        }

        var days = habit.reminder.days;
        while (days && days.length && days.indexOf(target.getDay()) === -1) {
          target.setDate(target.getDate() + 1);
        }

        var delay = target.getTime() - Date.now();
        var timerId = setTimeout(function() {
          var key = makeKey(habit.id, 'fixed', t);
          if (!hasFired(key)) {
            markFired(key);
            triggerReminder(habit);
          }
          scheduleNext();
        }, delay);

        if (!_fixedTimers[habit.id]) _fixedTimers[habit.id] = [];
        _fixedTimers[habit.id].push({ timerId: timerId, time: t, idx: idx });
      }

      scheduleNext();
    });
  }

  function cancelFixedReminder(habitId) {
    if (_fixedTimers[habitId]) {
      _fixedTimers[habitId].forEach(function(t) {
        clearTimeout(t.timerId);
      });
      delete _fixedTimers[habitId];
    }
  }

  // ============================================================
  // 间隔提醒调度（setTimeout 链式，替代 setInterval 轮询）
  // ============================================================
  function scheduleIntervalReminder(habit) {
    if (!habit || !habit.intervalReminder || !habit.intervalReminder.enabled) return;
    cancelIntervalReminder(habit.id);

    if (_platform === 'apk') {
      return;
    }

    var ir = habit.intervalReminder;
    var intervalMs = (ir.interval || 60) * 60 * 1000;
    var startTime = parseTime(ir.startTime) || { h: 0, m: 0 };
    var endTime = parseTime(ir.endTime) || { h: 23, m: 59 };
    var startMin = startTime.h * 60 + startTime.m;
    var endMin = endTime.h * 60 + endTime.m;
    var crossesMidnight = startMin > endMin;
    var days = ir.days;

    function getNextTriggerTime() {
      var now = new Date();
      var cursor = new Date(now.getTime() + intervalMs);

      for (var i = 0; i < 500; i++) {
        var cMin = cursor.getHours() * 60 + cursor.getMinutes();
        var inWindow = crossesMidnight
          ? (cMin >= startMin || cMin <= endMin)
          : (cMin >= startMin && cMin <= endMin);

        if (inWindow) {
          if (!days || days.length === 0 || days.indexOf(cursor.getDay()) !== -1) {
            return cursor;
          }
        }

        cursor = new Date(cursor.getTime() + intervalMs);

        var curMin = cursor.getHours() * 60 + cursor.getMinutes();
        if (crossesMidnight) {
          if (curMin > endMin && curMin < startMin) {
            var nextDay = new Date(cursor);
            nextDay.setDate(nextDay.getDate() + 1);
            nextDay.setHours(startTime.h, startTime.m, 0, 0);
            cursor = nextDay;
          }
        } else {
          if (curMin > endMin) {
            var nextDay2 = new Date(cursor);
            nextDay2.setDate(nextDay2.getDate() + 1);
            nextDay2.setHours(startTime.h, startTime.m, 0, 0);
            cursor = nextDay2;
          }
        }
      }
      return null;
    }

    function scheduleNext() {
      var nextTime = getNextTriggerTime();
      if (!nextTime) return;

      var delay = nextTime.getTime() - Date.now();
      var timerId = setTimeout(function() {
        var key = makeKey(habit.id, 'interval', Math.floor(nextTime.getTime() / 60000));
        if (!hasFired(key)) {
          markFired(key);
          triggerReminder(habit);
          if (typeof checkinRecords !== 'undefined') {
            var todayStr = getTodayStr();
            if (!checkinRecords[todayStr]) checkinRecords[todayStr] = {};
            if (!checkinRecords[todayStr][habit.id]) checkinRecords[todayStr][habit.id] = {};
            checkinRecords[todayStr][habit.id].lastInterval = Date.now();
            if (typeof saveData === 'function') saveData();
          }
        }
        scheduleNext();
      }, delay);

      _intervalTimers[habit.id] = { timerId: timerId, nextTime: nextTime };
    }

    scheduleNext();
  }

  function cancelIntervalReminder(habitId) {
    if (_intervalTimers[habitId]) {
      clearTimeout(_intervalTimers[habitId].timerId);
      delete _intervalTimers[habitId];
    }
  }

  // ============================================================
  // 批量调度 / 取消
  // ============================================================
  function scheduleAll(habits) {
    if (!habits || !habits.length) return;
    habits.forEach(function(h) {
      scheduleFixedReminder(h);
      scheduleIntervalReminder(h);
    });
  }

  function cancelAll() {
    Object.keys(_fixedTimers).forEach(function(id) {
      cancelFixedReminder(id);
    });
    Object.keys(_intervalTimers).forEach(function(id) {
      cancelIntervalReminder(id);
    });
  }

  function rescheduleAll(habits) {
    cancelAll();
    scheduleAll(habits);
  }

  // ============================================================
  // 权限请求引导（先说明原因再请求）
  // ============================================================
  function requestPermissionWithReason(reason, habitName) {
    var msg = reason || ('开启通知后，' + (habitName ? '「' + habitName + '」' : '') + '将准时提醒您');
    return requestPermission(msg);
  }

  // ============================================================
  // 初始化
  // ============================================================
  function init() {
    if (_initialized) return;
    _initialized = true;

    checkPermission().then(function(granted) {
      _permissionGranted = granted;
      console.log('[NotificationScheduler] 初始化完成，平台:', _platform, '权限:', granted ? '已授权' : '未授权');
    });
  }

  // ============================================================
  // 暴露 API
  // ============================================================
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Notification = {
    init: init,
    METHODS: REMINDER_METHODS,
    trigger: triggerReminder,
    triggerToast: _triggerToast,
    triggerNotification: _triggerNotification,
    triggerAlarm: _triggerAlarm,
    scheduleFixed: scheduleFixedReminder,
    cancelFixed: cancelFixedReminder,
    scheduleInterval: scheduleIntervalReminder,
    cancelInterval: cancelIntervalReminder,
    scheduleAll: scheduleAll,
    cancelAll: cancelAll,
    rescheduleAll: rescheduleAll,
    checkPermission: checkPermission,
    requestPermission: requestPermission,
    requestPermissionWithReason: requestPermissionWithReason,
    isInQuietHours: isInQuietHours,
    getQuietConfig: getQuietConfig,
    isInitialized: function() { return _initialized; },
    hasPermission: function() { return _permissionGranted; }
  };

  window.triggerReminder = triggerReminder;
  window.scheduleFixedReminder = scheduleFixedReminder;
  window.scheduleIntervalReminder = scheduleIntervalReminder;
  window.cancelAllReminders = cancelAll;
  window.rescheduleAllReminders = rescheduleAll;

})();

/* ===== modules/guide.js ===== */
(function() {
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

/* ===== modules/update.js ===== */
// 应用内"检查更新"模块（纯前端，无需后端）
// 版本信息 JSON 托管在 UPDATE_JSON_URL（android/local.properties 配置），格式：
// {
//   "versionCode": 4,
//   "versionName": "1.4",
//   "apkUrl": "https://example.com/app-release.apk",
//   "whatsNew": ["新增八段锦/太极拳等中医导引习惯", "优化通知权限请求流程"],
//   "publishedAt": "2026-07-18",
//   "forceUpdate": false,           // 可选：true 时用户不可跳过
//   "minVersionCode": 3             // 可选：低于此版本强制更新
// }
(function () {
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  const LOCAL_CODE = (window.__APP_CONFIG__ && window.__APP_CONFIG__.appVersionCode) || 1;
  const LOCAL_NAME = (window.__APP_CONFIG__ && window.__APP_CONFIG__.appVersionName) || '1.0';
  const UPDATE_URL = (window.__APP_CONFIG__ && window.__APP_CONFIG__.updateJsonUrl)
    || (window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'version.json');

  const CHECK_INTERVAL = 24 * 3600 * 1000; // 自动检查每天最多一次

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fillVersionInfo() {
    const n = document.getElementById('currentVersionName');
    if (n) n.textContent = LOCAL_NAME;
    const c = document.getElementById('currentVersionCode');
    if (c) c.textContent = LOCAL_CODE;
  }

  function getLocalVersion() {
    return { code: LOCAL_CODE, name: LOCAL_NAME };
  }

  function lastCheck() {
    return parseInt(localStorage.getItem('update_last_check') || '0', 10);
  }

  // 用户是否已跳过此版本
  function isSkipped(versionCode) {
    return parseInt(localStorage.getItem('update_skipped') || '0', 10) === versionCode;
  }

  function markSkipped(versionCode) {
    localStorage.setItem('update_skipped', String(versionCode));
  }

  // 判断是否需要强制更新
  function isForceUpdate(info) {
    if (info.forceUpdate === true) return true;
    if (typeof info.minVersionCode === 'number' && LOCAL_CODE < info.minVersionCode) return true;
    return false;
  }

  async function check(manual) {
    if (!UPDATE_URL) {
      if (manual) showToast('未配置更新地址', 2000);
      return;
    }
    if (!manual && Date.now() - lastCheck() < CHECK_INTERVAL) return; // 节流：每天最多一次
    localStorage.setItem('update_last_check', String(Date.now()));
    let info;
    try {
      const res = await fetch(UPDATE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      info = await res.json();
    } catch (e) {
      if (manual) showToast('检查更新失败：' + e.message, 2500);
      return;
    }
    if (!info || typeof info.versionCode !== 'number') {
      if (manual) showToast('更新信息格式错误', 2000);
      return;
    }
    if (info.versionCode > LOCAL_CODE) {
      // 强制更新 → 始终弹窗，不可跳过
      // 手动检查 → 始终弹窗
      // 自动检查且用户曾跳过此版本 → 不弹窗
      var force = isForceUpdate(info);
      if (force || manual || !isSkipped(info.versionCode)) {
        showUpdateModal(info, force);
      }
    } else if (manual) {
      showToast('已是最新版本 v' + LOCAL_NAME, 2000);
    }
  }

  function showUpdateModal(info, force) {
    if (document.getElementById('updateModal')) return; // 避免重复弹窗
    const overlay = document.createElement('div');
    overlay.id = 'updateModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    const vName = info.versionName || info.versionCode;
    const whats = (Array.isArray(info.whatsNew) && info.whatsNew.length)
      ? '<ul style="margin:10px 0 0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.7">' +
        info.whatsNew.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'
      : '';
    // 强制更新时不显示"跳过"和"稍后"按钮
    var skipBtn = force
      ? ''
      : '<button id="updateSkip" style="flex:1;padding:12px;border:2px solid var(--rule);background:#fff;border-radius:12px;font-size:14px;color:var(--muted)">跳过此版</button>';
    var laterBtn = force
      ? ''
      : '<button id="updateLater" style="flex:1;padding:12px;border:2px solid var(--rule);background:#fff;border-radius:12px;font-size:14px;color:var(--muted)">稍后</button>';
    var btnRow = force
      ? '<div style="margin-top:18px"><button id="updateNow" style="width:100%;padding:12px;border:none;background:var(--accent);color:#fff;border-radius:12px;font-size:14px;font-weight:700">立即更新</button></div>'
      : '<div style="display:flex;gap:10px;margin-top:18px">' + skipBtn + laterBtn +
        '<button id="updateNow" style="flex:1;padding:12px;border:none;background:var(--accent);color:#fff;border-radius:12px;font-size:14px;font-weight:700">立即更新</button></div>';
    var title = force ? '⚠️ 需要更新到 v' + esc(vName) : '🎉 发现新版本 v' + esc(vName);
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:18px;max-width:340px;width:100%;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
        '<div style="font-size:18px;font-weight:800;color:var(--ink)">' + title + '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:6px">当前 v' + esc(LOCAL_NAME) + ' → 新版本 v' + esc(vName) + '</div>' +
        whats +
        btnRow +
      '</div>';
    document.body.appendChild(overlay);
    const close = function () { if (overlay.parentElement) overlay.remove(); };
    // 稍后
    var laterEl = overlay.querySelector('#updateLater');
    if (laterEl) laterEl.addEventListener('click', close);
    // 跳过此版本
    var skipEl = overlay.querySelector('#updateSkip');
    if (skipEl) skipEl.addEventListener('click', function () {
      markSkipped(info.versionCode);
      close();
      showToast('已跳过 v' + vName + '，可在设置页手动检查', 2000);
    });
    // 立即更新
    overlay.querySelector('#updateNow').addEventListener('click', function () {
      const url = info.apkUrl || UPDATE_URL;
      if (url) {
        showToast('正在打开下载…', 1500);
        setTimeout(function () { window.location.href = url; }, 800);
      }
    });
    // 强制更新时点击遮罩不关闭
    if (!force) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillVersionInfo);
  } else {
    fillVersionInfo();
  }

  App.Modules.Update = { check: check, getLocalVersion: getLocalVersion };
})();

/* ===== modules/recommendation.js ===== */
(function() {
  'use strict';

  const CATEGORY_NAMES = {
    sport:    { name: '运动健身', icon: '🏃' },
    diet:     { name: '饮食营养', icon: '🥗' },
    study:    { name: '学习成长', icon: '📚' },
    sleep:    { name: '睡眠作息', icon: '🌙' },
    mind:     { name: '心灵修养', icon: '🧘' },
    protect:  { name: '五劳防护', icon: '🛡️' },
    care:     { name: '个人护理', icon: '🧴' },
    home:     { name: '居家生活', icon: '🏠' },
    social:   { name: '社交人际', icon: '🤝' }
  };

  const CONSTITUTION_FOCUS = {
    pinghe:  { focus: '阴阳调和',   organ: '五脏',       adviceTemplate: '继续保持均衡生活，顺应四时养生' },
    qixu:    { focus: '补气养元',   organ: '脾肺',       adviceTemplate: '气虚质需健脾益气，避免过度劳累' },
    yangxu:  { focus: '温阳散寒',   organ: '脾肾',       adviceTemplate: '阳虚质当温补阳气，注意保暖多晒太阳' },
    yinxu:   { focus: '滋阴降火',   organ: '肺肾',       adviceTemplate: '阴虚质宜滋阴润燥，忌熬夜和辛辣' },
    tanshi:  { focus: '健脾祛湿',   organ: '脾胃',       adviceTemplate: '痰湿质应化痰祛湿，少油腻多运动' },
    shire:   { focus: '清热利湿',   organ: '肝胆脾胃',   adviceTemplate: '湿热质需清热利湿，忌辛辣油腻' },
    xueyu:   { focus: '活血化瘀',   organ: '心肝',       adviceTemplate: '血瘀质宜行气活血，保持心情舒畅' },
    qiyu:    { focus: '疏肝解郁',   organ: '肝',         adviceTemplate: '气郁质应疏肝理气，多社交多晒太阳' },
    tebing:  { focus: '益气固表',   organ: '肺脾',       adviceTemplate: '特禀质需益气固表，远离过敏原' }
  };

  const SEASON_FOCUS = {
    spring:  { name: '春', organ: '肝', principle: '养肝舒展，夜卧早起，广步于庭', color: '#7CB69D' },
    summer:  { name: '夏', organ: '心', principle: '养心安神，夜卧早起，无厌于日', color: '#E07A5F' },
    autumn:  { name: '秋', organ: '肺', principle: '养肺润燥，早卧早起，与鸡俱兴', color: '#D4A373' },
    winter:  { name: '冬', organ: '肾', principle: '养肾藏精，早卧晚起，必待日光', color: '#5B8DB8' }
  };

  const LEVEL_HABIT_LIMIT = { 1: 3, 2: 5, 3: 7, 4: 10, 5: 15 };

  function getUserLevel() {
    const levels = App.Data.LEVELS || [];
    const maxStreak = _getMaxStreakAll();
    let level = 1;
    for (let i = 0; i < levels.length; i++) {
      if (maxStreak >= levels[i].minDays) level = levels[i].level;
    }
    return level;
  }

  function _getMaxStreakAll() {
    let max = 0;
    if (!habitsConfig || !habitsConfig.length) return 0;
    habitsConfig.forEach(h => {
      const s = _getStreak(h.id);
      if (s > max) max = s;
    });
    return max;
  }

  function _getStreak(habitId) {
    let streak = 0;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return 0;
    const d = new Date();
    while (true) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (App.Core.Storage.isHabitChecked(h, rec)) { streak++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return streak;
  }

  function getCategoryCompletion(days) {
    days = days || 30;
    const result = {};
    if (!habitsConfig || !habitsConfig.length) return result;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        const cat = h.category || 'other';
        if (!result[cat]) result[cat] = { done: 0, total: 0 };
        result[cat].total++;
        if (App.Core.Storage.isHabitChecked(h, rec)) result[cat].done++;
      });
    }
    for (const cat in result) {
      result[cat].rate = result[cat].total > 0 ? result[cat].done / result[cat].total : 0;
    }
    return result;
  }

  function findWeakCategories(days) {
    days = days || 30;
    const rates = getCategoryCompletion(days);
    const arr = [];
    for (const cat in rates) {
      if (rates[cat].total >= 3) {
        arr.push({ category: cat, rate: rates[cat].rate, total: rates[cat].total });
      }
    }
    arr.sort((a, b) => a.rate - b.rate);
    return arr;
  }

  function getConstitution() {
    try {
      const saved = localStorage.getItem('constitution_result');
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return null;
  }

  function getCurrentSeason() {
    if (App.Core.Utils && App.Core.Utils.getCurrentSeason) {
      return App.Core.Utils.getCurrentSeason();
    }
    const month = new Date().getMonth() + 1;
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  function getCurrentSolarTerm() {
    if (App.Core.Utils && App.Core.Utils.getCurrentSolarTerm) {
      return App.Core.Utils.getCurrentSolarTerm();
    }
    return null;
  }

  function getWaterStats(days) {
    days = days || 7;
    const waterHabit = habitsConfig.find(h => h.type === 'water');
    if (!waterHabit) return null;
    const goal = (waterHabit.waterConfig && waterHabit.waterConfig.dailyGoal) || 2000;
    let reachedDays = 0, totalDays = 0, avgAmount = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[waterHabit.id]) {
        const val = rec[waterHabit.id].value || 0;
        if (val >= goal) reachedDays++;
        avgAmount += val;
        totalDays++;
      } else {
        totalDays++;
      }
    }
    return {
      goal,
      reachedDays,
      totalDays,
      reachRate: totalDays > 0 ? reachedDays / totalDays : 0,
      avgAmount: totalDays > 0 ? Math.round(avgAmount / totalDays) : 0
    };
  }

  function getEmotionDistribution(days) {
    days = days || 30;
    const emotionHabit = habitsConfig.find(h => h.id === 'emotion_check');
    if (!emotionHabit) return null;
    const counts = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key];
      if (rec && rec[emotionHabit.id] && rec[emotionHabit.id].value) {
        const v = rec[emotionHabit.id].value;
        counts[v] = (counts[v] || 0) + 1;
      }
    }
    return counts;
  }

  function _getConstitutionHabits() {
    const c = getConstitution();
    if (!c || !c.typeId) return [];
    const types = App.Data.CONSTITUTION_TYPES || [];
    const t = types.find(x => x.id === c.typeId);
    return (t && t.habits) ? t.habits : [];
  }

  function _getSeasonalHabits() {
    const season = getCurrentSeason();
    const packs = typeof SEASONAL_PACKS !== 'undefined' ? SEASONAL_PACKS : null;
    if (!packs || !packs[season]) return [];
    return packs[season].habits.map(h => h.id);
  }

  function _habitLibrary() {
    return typeof HABIT_LIBRARY !== 'undefined' ? HABIT_LIBRARY : (App.Data && App.Data.HABIT_LIBRARY ? App.Data.HABIT_LIBRARY : []);
  }

  function _findHabit(id) {
    const lib = _habitLibrary();
    return lib.find(h => h.id === id);
  }

  function _userHasHabit(id) {
    return habitsConfig.some(h => h.id === id);
  }

  function generateRecommendations(opts) {
    opts = opts || {};
    const limit = opts.limit || 3;
    const level = getUserLevel();
    const season = getCurrentSeason();
    const term = getCurrentSolarTerm();
    const constitution = getConstitution();
    const weakCats = findWeakCategories(30);
    const waterStats = getWaterStats(7);
    const emotionDist = getEmotionDistribution(30);

    const candidates = [];

    const constHabits = _getConstitutionHabits();
    const seasonHabits = _getSeasonalHabits();
    const lib = _habitLibrary();

    const constSet = new Set(constHabits);
    const seasonSet = new Set(seasonHabits);

    lib.forEach(h => {
      let score = 0;
      const reasons = [];

      if (constSet.has(h.id)) {
        score += 40;
        reasons.push('体质调养');
      }

      if (seasonSet.has(h.id)) {
        score += 30;
        reasons.push('当季养生');
      }

      if (weakCats.length > 0) {
        const weakest = weakCats[0];
        if (h.category === weakest.category && weakest.rate < 0.5) {
          score += 25;
          reasons.push('改善弱项');
        }
      }

      if (waterStats && waterStats.reachRate < 0.5 && h.type === 'water') {
        score += 30;
        reasons.push('饮水不足');
      }

      if (emotionDist && (emotionDist['😠怒'] || emotionDist['😢悲']) && (h.category === 'mind' || h.id === 'meditation')) {
        score += 20;
        reasons.push('情绪调节');
      }

      if (level <= 2 && (h.category === 'sleep' || h.category === 'diet')) {
        score += 10;
        reasons.push('新手友好');
      }
      if (level >= 4 && (h.category === 'sport' || h.id === 'baduanjin' || h.id === 'taiji')) {
        score += 10;
        reasons.push('进阶挑战');
      }

      const userHabit = habitsConfig.find(x => x.id === h.id);
      if (userHabit) {
        const streak = _getStreak(h.id);
        if (streak >= 7) {
          score -= 15;
          reasons.push('已坚持');
        }
      }

      if (score >= 20) {
        candidates.push({
          habit: h,
          score,
          reasons,
          alreadyHas: !!userHabit
        });
      }
    });

    candidates.sort((a, b) => b.score - a.score);

    const selected = [];
    const seenCats = new Set();
    for (const c of candidates) {
      if (selected.length >= limit) break;
      if (selected.length < 2 && seenCats.has(c.habit.category)) continue;
      selected.push(c);
      seenCats.add(c.habit.category);
    }

    return {
      level,
      season,
      term,
      constitution,
      weakCats,
      waterStats,
      emotionDist,
      recommendations: selected.map(c => ({
        id: c.habit.id,
        name: c.habit.name,
        icon: c.habit.icon,
        category: c.habit.category,
        categoryName: (CATEGORY_NAMES[c.habit.category] || {}).name || c.habit.category,
        categoryIcon: (CATEGORY_NAMES[c.habit.category] || {}).icon || '📋',
        tip: c.habit.tip || '',
        timePeriod: c.habit.timePeriod || '',
        unit: c.habit.unit || '',
        type: c.habit.type || 'boolean',
        score: c.score,
        reasons: c.reasons,
        alreadyHas: c.alreadyHas,
        actionText: c.alreadyHas ? '继续保持' : '添加习惯'
      }))
    };
  }

  function generateHealthReport(period) {
    period = period || 'week';
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const level = getUserLevel();
    const levels = App.Data.LEVELS || [];
    const levelInfo = levels.find(l => l.level === level) || levels[0];
    const season = getCurrentSeason();
    const seasonInfo = SEASON_FOCUS[season];
    const constitution = getConstitution();
    const constInfo = constitution && constitution.typeId
      ? (App.Data.CONSTITUTION_TYPES || []).find(t => t.id === constitution.typeId)
      : null;
    const weakCats = findWeakCategories(days);
    const recs = generateRecommendations({ limit: 3 });
    const catRates = getCategoryCompletion(days);

    let overallRate = 0, overallTotal = 0, overallDone = 0;
    for (const cat in catRates) {
      overallDone += catRates[cat].done;
      overallTotal += catRates[cat].total;
    }
    overallRate = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0;

    const bestCat = weakCats.length > 0
      ? [...weakCats].sort((a, b) => b.rate - a.rate)[0]
      : null;
    const worstCat = weakCats.length > 0 ? weakCats[0] : null;

    let trend = 'stable';
    if (days >= 14) {
      const firstHalf = getCategoryCompletion(Math.floor(days / 2));
      let firstRate = 0, firstTotal = 0, firstDone = 0;
      for (const cat in firstHalf) {
        firstDone += firstHalf[cat].done;
        firstTotal += firstHalf[cat].total;
      }
      firstRate = firstTotal > 0 ? firstDone / firstTotal : 0;
      const recentRate = overallRate / 100;
      if (recentRate - firstRate > 0.05) trend = 'up';
      else if (firstRate - recentRate > 0.05) trend = 'down';
    }

    const waterStats = getWaterStats(Math.min(days, 7));

    return {
      period,
      days,
      level,
      levelInfo,
      season,
      seasonInfo,
      constitution,
      constInfo,
      overallRate,
      overallDone,
      overallTotal,
      bestCategory: bestCat ? {
        category: bestCat.category,
        name: (CATEGORY_NAMES[bestCat.category] || {}).name || bestCat.category,
        icon: (CATEGORY_NAMES[bestCat.category] || {}).icon || '📋',
        rate: Math.round(bestCat.rate * 100)
      } : null,
      worstCategory: worstCat ? {
        category: worstCat.category,
        name: (CATEGORY_NAMES[worstCat.category] || {}).name || worstCat.category,
        icon: (CATEGORY_NAMES[worstCat.category] || {}).icon || '📋',
        rate: Math.round(worstCat.rate * 100)
      } : null,
      trend,
      trendText: trend === 'up' ? '上升趋势 👍' : trend === 'down' ? '下降趋势 ⚠️' : '保持稳定 📊',
      categoryRates: catRates,
      waterStats,
      recommendations: recs.recommendations,
      weakCategories: weakCats.map(w => ({
        category: w.category,
        name: (CATEGORY_NAMES[w.category] || {}).name || w.category,
        icon: (CATEGORY_NAMES[w.category] || {}).icon || '📋',
        rate: Math.round(w.rate * 100)
      }))
    };
  }

  function getDailyTip() {
    const season = getCurrentSeason();
    const seasonInfo = SEASON_FOCUS[season];
    const constitution = getConstitution();
    const constInfo = constitution && constitution.typeId
      ? CONSTITUTION_FOCUS[constitution.typeId]
      : null;
    const term = getCurrentSolarTerm();

    const tips = [];

    if (term) {
      tips.push({
        type: 'solar_term',
        icon: term.emoji || '🌿',
        title: `${term.name}养生`,
        content: term.tip || ''
      });
    }

    if (seasonInfo) {
      tips.push({
        type: 'season',
        icon: season === 'spring' ? '🌿' : season === 'summer' ? '☀️' : season === 'autumn' ? '🍂' : '❄️',
        title: `${seasonInfo.name}季养${seasonInfo.organ}`,
        content: seasonInfo.principle
      });
    }

    if (constInfo) {
      tips.push({
        type: 'constitution',
        icon: constInfo.organ ? '🧬' : '😊',
        title: `${constInfo.focus}`,
        content: constInfo.adviceTemplate
      });
    }

    const weakCats = findWeakCategories(7);
    if (weakCats.length > 0 && weakCats[0].rate < 0.5) {
      const wc = weakCats[0];
      const catInfo = CATEGORY_NAMES[wc.category] || { name: wc.category, icon: '📋' };
      tips.push({
        type: 'weakness',
        icon: '💪',
        title: `本周${catInfo.name}完成率偏低`,
        content: `本周完成率仅 ${Math.round(wc.rate * 100)}%，建议加强${catInfo.name}方面的习惯养成`
      });
    }

    return tips;
  }

  function _formatDate(date) {
    return date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function _getWeekRange(date) {
    const d = date || new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
  }

  function generateWeeklyAnalysisData(date) {
    const range = _getWeekRange(date);
    const thisWeekStart = range.start;
    const thisWeekEnd = range.end;

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekEnd);
    lastWeekEnd.setDate(thisWeekEnd.getDate() - 7);

    const thisWeekDays = [];
    const d = new Date(thisWeekStart);
    while (d <= thisWeekEnd) {
      thisWeekDays.push(_formatDate(d));
      d.setDate(d.getDate() + 1);
    }

    const lastWeekDays = [];
    const ld = new Date(lastWeekStart);
    while (ld <= lastWeekEnd) {
      lastWeekDays.push(_formatDate(ld));
      ld.setDate(ld.getDate() + 1);
    }

    const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

    let thisWeekDone = 0, thisWeekTotal = 0;
    let lastWeekDone = 0, lastWeekTotal = 0;

    const dailyStats = [];
    const habitStats = {};
    const dayFailStats = {};

    weekDayNames.forEach((name, idx) => {
      dayFailStats[name] = { fail: 0, total: 0 };
    });

    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const id = h.id;
      habitStats[id] = {
        name: h.name,
        icon: h.icon || '📋',
        category: h.category || 'other',
        type: h.type || 'boolean',
        thisWeekDone: 0,
        thisWeekTotal: 0,
        lastWeekDone: 0,
        lastWeekTotal: 0,
        streak: _getStreak(id),
        fails: []
      };
    });

    thisWeekDays.forEach((dateKey, idx) => {
      const rec = checkinRecords[dateKey] || {};
      const dayName = weekDayNames[idx];
      let dayDone = 0, dayTotal = 0;

      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        dayTotal++;
        thisWeekTotal++;

        const isChecked = App.Core.Storage.isHabitChecked(h, rec);
        if (isChecked) {
          dayDone++;
          thisWeekDone++;
          habitStats[h.id].thisWeekDone++;
        } else {
          habitStats[h.id].fails.push(dateKey);
          dayFailStats[dayName].fail++;
        }
        habitStats[h.id].thisWeekTotal++;
        dayFailStats[dayName].total++;
      });

      dailyStats.push({
        date: dateKey,
        dayName: dayName,
        done: dayDone,
        total: dayTotal,
        rate: dayTotal > 0 ? Math.round((dayDone / dayTotal) * 100) : 0
      });
    });

    lastWeekDays.forEach(dateKey => {
      const rec = checkinRecords[dateKey] || {};
      habitsConfig.forEach(h => {
        if (h.enabled === false) return;
        lastWeekTotal++;
        habitStats[h.id].lastWeekTotal++;
        if (App.Core.Storage.isHabitChecked(h, rec)) {
          lastWeekDone++;
          habitStats[h.id].lastWeekDone++;
        }
      });
    });

    const thisWeekRate = thisWeekTotal > 0 ? Math.round((thisWeekDone / thisWeekTotal) * 100) : 0;
    const lastWeekRate = lastWeekTotal > 0 ? Math.round((lastWeekDone / lastWeekTotal) * 100) : 0;

    let trend = 'stable';
    let trendText = '与上周持平';
    const rateDiff = thisWeekRate - lastWeekRate;
    if (rateDiff > 5) {
      trend = 'up';
      trendText = `比上周提升${rateDiff}% 👍`;
    } else if (rateDiff < -5) {
      trend = 'down';
      trendText = `比上周下降${Math.abs(rateDiff)}% ⚠️`;
    }

    const habitRateList = [];
    for (const id in habitStats) {
      const hs = habitStats[id];
      const thisRate = hs.thisWeekTotal > 0 ? Math.round((hs.thisWeekDone / hs.thisWeekTotal) * 100) : 0;
      const lastRate = hs.lastWeekTotal > 0 ? Math.round((hs.lastWeekDone / hs.lastWeekTotal) * 100) : 0;
      habitRateList.push({
        id,
        name: hs.name,
        icon: hs.icon,
        category: hs.category,
        thisWeekRate: thisRate,
        lastWeekRate: lastRate,
        streak: hs.streak,
        fails: hs.fails,
        failCount: hs.fails.length
      });
    }

    habitRateList.sort((a, b) => b.thisWeekRate - a.thisWeekRate);

    const bestHabit = habitRateList.length > 0 ? habitRateList[0] : null;
    const weakestHabit = habitRateList.length > 0 ? habitRateList[habitRateList.length - 1] : null;

    const failDayList = [];
    for (const day in dayFailStats) {
      const stats = dayFailStats[day];
      if (stats.total > 0) {
        failDayList.push({
          dayName: day,
          failRate: stats.total > 0 ? Math.round((stats.fail / stats.total) * 100) : 0,
          failCount: stats.fail,
          total: stats.total
        });
      }
    }
    failDayList.sort((a, b) => b.failRate - a.failRate);

    const highFailDay = failDayList.length > 0 && failDayList[0].failRate > 50 ? failDayList[0] : null;

    const categoryStats = {};
    habitsConfig.forEach(h => {
      if (h.enabled === false) return;
      const cat = h.category || 'other';
      if (!categoryStats[cat]) {
        categoryStats[cat] = {
          name: (CATEGORY_NAMES[cat] || {}).name || cat,
          icon: (CATEGORY_NAMES[cat] || {}).icon || '📋',
          thisWeekDone: 0,
          thisWeekTotal: 0,
          lastWeekDone: 0,
          lastWeekTotal: 0
        };
      }
      const hs = habitStats[h.id];
      categoryStats[cat].thisWeekDone += hs.thisWeekDone;
      categoryStats[cat].thisWeekTotal += hs.thisWeekTotal;
      categoryStats[cat].lastWeekDone += hs.lastWeekDone;
      categoryStats[cat].lastWeekTotal += hs.lastWeekTotal;
    });

    for (const cat in categoryStats) {
      const cs = categoryStats[cat];
      cs.thisWeekRate = cs.thisWeekTotal > 0 ? Math.round((cs.thisWeekDone / cs.thisWeekTotal) * 100) : 0;
      cs.lastWeekRate = cs.lastWeekTotal > 0 ? Math.round((cs.lastWeekDone / cs.lastWeekTotal) * 100) : 0;
    }

    const waterStats = getWaterStats(7);
    const emotionDist = getEmotionDistribution(7);
    const constitution = getConstitution();
    const level = getUserLevel();
    const season = getCurrentSeason();

    return {
      period: 'week',
      periodLabel: '本周',
      startDate: _formatDate(thisWeekStart),
      endDate: _formatDate(thisWeekEnd),
      summary: {
        overallRate: thisWeekRate,
        lastWeekRate: lastWeekRate,
        trend,
        trendText,
        totalHabits: habitsConfig.filter(h => h.enabled !== false).length,
        thisWeekDone,
        thisWeekTotal
      },
      dailyStats,
      habitStats: habitRateList,
      bestHabit: bestHabit ? {
        id: bestHabit.id,
        name: bestHabit.name,
        icon: bestHabit.icon,
        rate: bestHabit.thisWeekRate,
        streak: bestHabit.streak
      } : null,
      weakestHabit: weakestHabit ? {
        id: weakestHabit.id,
        name: weakestHabit.name,
        icon: weakestHabit.icon,
        rate: weakestHabit.thisWeekRate,
        failCount: weakestHabit.failCount
      } : null,
      highFailDay,
      categoryStats,
      waterStats,
      emotionDist,
      userContext: {
        level,
        season,
        constitutionType: constitution ? constitution.typeId : null,
        constitutionName: constitution && constitution.typeName ? constitution.typeName : null
      },
      dataSource: ['本周打卡记录', '上周打卡记录', '睡眠记录', '情绪记录']
    };
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Recommendation = {
    CATEGORY_NAMES,
    CONSTITUTION_FOCUS,
    SEASON_FOCUS,
    getUserLevel,
    getCategoryCompletion,
    findWeakCategories,
    getConstitution,
    getCurrentSeason,
    getWaterStats,
    getEmotionDistribution,
    generateRecommendations,
    generateHealthReport,
    getDailyTip,
    generateWeeklyAnalysisData
  };

  if (App.registerModule) {
    App.registerModule('modules.recommendation', 'modules', null);
  }
})();

/* ===== modules/auth.js ===== */
// ============================================================
// 用户认证与云同步模块（前端）
// ============================================================
// 功能：
//   1. 用户注册/登录/登出
//   2. Token 管理（accessToken 存内存，refreshToken 存 Capacitor Preferences）
//   3. 自动 token 刷新
//   4. 数据云同步（上传/下载）
//
// 仅在 APK 环境激活；PWA 环境下所有方法返回安全默认值
//
// 挂载命名空间: window.App.Modules.Auth
// ============================================================

(function() {
  'use strict';

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};
  if (App.Modules.Auth) return; // 防止重复加载

  // ---- 状态 ----
  let _accessToken = null;
  let _refreshToken = null;
  let _user = null;          // { id, phone, nickname }
  let _initialized = false;
  let _refreshing = false;
  let _refreshPromise = null;

  // 同步状态
  let _lastSyncAt = 0;
  let _autoSync = true;
  let _syncing = false;

  // 事件监听
  const _listeners = {};

  // ---- 工具函数 ----

  /**
   * 获取 Worker URL（复用 AI 模块的配置）
   */
  function getWorkerUrl() {
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.workerUrl) return cfg.workerUrl.replace(/\/$/, '');
      }
    } catch(e) {}
    // 兜底：App 内置配置
    const builtin = (typeof window.__APP_CONFIG__ !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};
    return (builtin.cloudAiUrl || '').replace(/\/$/, '');
  }

  /**
   * Capacitor Preferences 安全访问
   */
  async function prefGet(key) {
    if (!window.isAPK()) return null;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key });
      return result.value;
    } catch(e) {
      console.warn('[Auth] Preferences.get 失败，回退到 localStorage:', e.message);
      return localStorage.getItem('auth_' + key);
    }
  }

  async function prefSet(key, value) {
    if (!window.isAPK()) return;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    } catch(e) {
      console.warn('[Auth] Preferences.set 失败，回退到 localStorage:', e.message);
      localStorage.setItem('auth_' + key, value);
    }
  }

  async function prefRemove(key) {
    if (!window.isAPK()) return;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    } catch(e) {
      localStorage.removeItem('auth_' + key);
    }
  }

  /**
   * API 请求封装
   */
  async function apiRequest(method, path, body, withAuth) {
    const baseUrl = getWorkerUrl();
    if (!baseUrl) throw new Error('未配置 Worker URL，请在设置中配置');

    const headers = { 'Content-Type': 'application/json' };
    if (withAuth && _accessToken) {
      headers['Authorization'] = 'Bearer ' + _accessToken;
    }

    const resp = await fetch(baseUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await resp.json().catch(() => ({ error: '响应解析失败' }));

    // 401 时尝试自动刷新
    if (resp.status === 401 && withAuth && path !== '/auth/refresh') {
      const refreshed = await tryRefresh();
      if (refreshed) {
        // 重试请求
        headers['Authorization'] = 'Bearer ' + _accessToken;
        const retryResp = await fetch(baseUrl + path, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        return { ok: retryResp.ok, status: retryResp.status, data: await retryResp.json().catch(() => ({ error: '响应解析失败' })) };
      }
    }

    return { ok: resp.ok, status: resp.status, data };
  }

  /**
   * 触发事件
   */
  function emit(event, data) {
    const cbs = _listeners[event];
    if (cbs) cbs.forEach(cb => { try { cb(data); } catch(e) { console.warn('[Auth] 事件回调异常:', e); } });
  }

  // ---- Token 管理 ----

  /**
   * 尝试用 refreshToken 刷新 accessToken
   */
  async function tryRefresh() {
    if (_refreshing) return _refreshPromise;
    if (!_refreshToken) return false;

    _refreshing = true;
    _refreshPromise = (async () => {
      try {
        const { ok, data } = await apiRequest('POST', '/auth/refresh', { refreshToken: _refreshToken }, false);
        if (ok && data.accessToken) {
          _accessToken = data.accessToken;
          return true;
        }
        // 刷新失败，清除登录状态
        await clearAuth();
        return false;
      } catch(e) {
        console.warn('[Auth] 刷新 token 失败:', e.message);
        await clearAuth();
        return false;
      } finally {
        _refreshing = false;
        _refreshPromise = null;
      }
    })();

    return _refreshPromise;
  }

  /**
   * 清除认证状态
   */
  async function clearAuth() {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    await prefRemove('refresh_token');
    emit('logout', null);
  }

  // ---- 公开 API ----

  /**
   * 初始化模块（仅 APK 环境）
   * 从 Capacitor Preferences 恢复登录状态
   */
  async function init() {
    if (_initialized) return;
    if (!window.isAPK()) { _initialized = true; return; }

    _initialized = true;
    _refreshToken = await prefGet('refresh_token');
    _autoSync = (await prefGet('auto_sync')) !== 'false';

    if (_refreshToken) {
      // 尝试恢复登录状态
      const refreshed = await tryRefresh();
      if (refreshed) {
        // 获取用户信息
        const { ok, data } = await apiRequest('GET', '/auth/me', null, true);
        if (ok && data.user) {
          _user = data.user;
          emit('login', _user);
        }
      }
    }
    console.log('[Auth] 初始化完成，登录状态:', !!_user);
  }

  /**
   * 是否已登录
   */
  function isLoggedIn() {
    return !!_user;
  }

  /**
   * 获取当前用户信息
   */
  function getCurrentUser() {
    return _user;
  }

  /**
   * 注册
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @param {string} [nickname] - 昵称
   * @returns {Promise<{ok: boolean, error?: string, user?: object}>}
   */
  async function register(phone, password, nickname) {
    const { ok, status, data } = await apiRequest('POST', '/auth/register', { phone, password, nickname }, false);
    if (ok) {
      _accessToken = data.accessToken;
      _refreshToken = data.refreshToken;
      _user = data.user;
      await prefSet('refresh_token', _refreshToken);
      emit('login', _user);
      return { ok: true, user: _user };
    }
    return { ok: false, error: data.error || '注册失败' };
  }

  /**
   * 登录
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @returns {Promise<{ok: boolean, error?: string, user?: object}>}
   */
  async function login(phone, password) {
    const { ok, data } = await apiRequest('POST', '/auth/login', { phone, password }, false);
    if (ok) {
      _accessToken = data.accessToken;
      _refreshToken = data.refreshToken;
      _user = data.user;
      await prefSet('refresh_token', _refreshToken);
      emit('login', _user);
      return { ok: true, user: _user };
    }
    return { ok: false, error: data.error || '登录失败' };
  }

  /**
   * 登出
   */
  async function logout() {
    if (_accessToken && _refreshToken) {
      await apiRequest('POST', '/auth/logout', { refreshToken: _refreshToken }, true);
    }
    await clearAuth();
  }

  /**
   * 更新昵称
   */
  async function updateNickname(nickname) {
    const { ok, data } = await apiRequest('PUT', '/auth/me', { nickname }, true);
    if (ok && data.user) {
      _user = data.user;
      emit('profileUpdate', _user);
      return { ok: true, user: _user };
    }
    return { ok: false, error: data.error || '更新失败' };
  }

  // ---- 数据同步 ----

  /**
   * 上传本地数据到云端
   * @returns {Promise<{ok: boolean, error?: string, syncedKeys?: number}>}
   */
  async function syncUp() {
    if (!isLoggedIn()) return { ok: false, error: '未登录' };
    if (_syncing) return { ok: false, error: '正在同步中' };
    _syncing = true;

    try {
      const payload = {};
      const habitsConfig = localStorage.getItem('habits_config');
      if (habitsConfig) payload.habits_config = habitsConfig;

      const checkinRecords = localStorage.getItem('checkin_records');
      if (checkinRecords) payload.checkin_records = checkinRecords;

      const constitutionResult = localStorage.getItem('constitution_result');
      if (constitutionResult) payload.constitution_result = constitutionResult;

      const { ok, data } = await apiRequest('POST', '/sync/upload', payload, true);
      if (ok) {
        _lastSyncAt = data.timestamp || Date.now();
        emit('syncComplete', { direction: 'up', timestamp: _lastSyncAt });
        return { ok: true, syncedKeys: data.syncedKeys };
      }
      return { ok: false, error: data.error || '上传失败' };
    } catch(e) {
      return { ok: false, error: e.message };
    } finally {
      _syncing = false;
    }
  }

  /**
   * 从云端下载数据到本地
   * @returns {Promise<{ok: boolean, error?: string, data?: object}>}
   */
  async function syncDown() {
    if (!isLoggedIn()) return { ok: false, error: '未登录' };
    if (_syncing) return { ok: false, error: '正在同步中' };
    _syncing = true;

    try {
      const { ok, data } = await apiRequest('GET', '/sync/download', null, true);
      if (ok && data.data) {
        const cloudData = data.data;
        // 合并策略：Last-Write-Wins per key
        // 云端有数据时覆盖本地（用户可选择性地合并）
        if (cloudData.habits_config) {
          localStorage.setItem('habits_config', typeof cloudData.habits_config === 'string' ? cloudData.habits_config : JSON.stringify(cloudData.habits_config));
        }
        if (cloudData.checkin_records) {
          localStorage.setItem('checkin_records', typeof cloudData.checkin_records === 'string' ? cloudData.checkin_records : JSON.stringify(cloudData.checkin_records));
        }
        if (cloudData.constitution_result) {
          localStorage.setItem('constitution_result', typeof cloudData.constitution_result === 'string' ? cloudData.constitution_result : JSON.stringify(cloudData.constitution_result));
        }
        _lastSyncAt = data.lastSyncAt || Date.now();
        emit('syncComplete', { direction: 'down', timestamp: _lastSyncAt });
        return { ok: true, data: cloudData };
      }
      return { ok: false, error: data.error || '下载失败' };
    } catch(e) {
      return { ok: false, error: e.message };
    } finally {
      _syncing = false;
    }
  }

  /**
   * 获取同步状态
   */
  function getSyncStatus() {
    return {
      lastSyncAt: _lastSyncAt,
      syncing: _syncing,
      autoSync: _autoSync,
    };
  }

  /**
   * 设置自动同步
   */
  async function setAutoSync(enabled) {
    _autoSync = !!enabled;
    await prefSet('auto_sync', String(_autoSync));
  }

  /**
   * 注册事件监听
   * @param {string} event - 'login' | 'logout' | 'syncComplete' | 'profileUpdate'
   * @param {function} cb
   */
  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
  }

  /**
   * 取消事件监听
   */
  function off(event, cb) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(fn => fn !== cb);
  }

  // ---- 导出 ----
  App.Modules.Auth = {
    init,
    isLoggedIn,
    getCurrentUser,
    register,
    login,
    logout,
    updateNickname,
    syncUp,
    syncDown,
    getSyncStatus,
    setAutoSync,
    on,
    off,
  };

  console.log('[Auth] 模块已加载');

  // ============================================================
  // UI 交互函数（挂载到 window，供 index.html onclick 调用）
  // ============================================================

  let _isRegisterMode = false;

  /**
   * 更新设置面板中的账号区域显示
   * 在 openSettingsPanel 中调用
   */
  window.updateAccountUI = function() {
    if (!window.isAPK()) {
      const grp = document.getElementById('accountGroup');
      if (grp) grp.style.display = 'none';
      return;
    }
    const grp = document.getElementById('accountGroup');
    if (grp) grp.style.display = '';
    const loggedOut = document.getElementById('accountLoggedOut');
    const loggedIn = document.getElementById('accountLoggedIn');
    if (isLoggedIn()) {
      if (loggedOut) loggedOut.style.display = 'none';
      if (loggedIn) loggedIn.style.display = '';
      const user = getCurrentUser();
      const nickEl = document.getElementById('accountNickname');
      const phoneEl = document.getElementById('accountPhone');
      if (nickEl) nickEl.textContent = user.nickname || '已登录';
      if (phoneEl) phoneEl.textContent = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '--';
    } else {
      if (loggedOut) loggedOut.style.display = '';
      if (loggedIn) loggedIn.style.display = 'none';
    }
  };

  window.openLoginPanel = function() {
    _isRegisterMode = false;
    const titleEl = document.getElementById('loginPanelTitle');
    const btnEl = document.getElementById('loginSubmitBtn');
    const switchEl = document.getElementById('switchAuthMode');
    const nickWrap = document.getElementById('nicknameInputWrap');
    const errEl = document.getElementById('authError');
    if (titleEl) titleEl.textContent = '登录';
    if (btnEl) btnEl.textContent = '登录';
    if (switchEl) switchEl.textContent = '没有账号？去注册';
    if (nickWrap) nickWrap.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    openPanel('loginPanel');
  };

  window.switchAuthMode = function() {
    _isRegisterMode = !_isRegisterMode;
    const titleEl = document.getElementById('loginPanelTitle');
    const btnEl = document.getElementById('loginSubmitBtn');
    const switchEl = document.getElementById('switchAuthMode');
    const nickWrap = document.getElementById('nicknameInputWrap');
    const errEl = document.getElementById('authError');
    if (_isRegisterMode) {
      if (titleEl) titleEl.textContent = '注册';
      if (btnEl) btnEl.textContent = '注册';
      if (switchEl) switchEl.textContent = '已有账号？去登录';
      if (nickWrap) nickWrap.style.display = '';
    } else {
      if (titleEl) titleEl.textContent = '登录';
      if (btnEl) btnEl.textContent = '登录';
      if (switchEl) switchEl.textContent = '没有账号？去注册';
      if (nickWrap) nickWrap.style.display = 'none';
    }
    if (errEl) errEl.style.display = 'none';
  };

  window.handleLoginSubmit = async function() {
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('authError');
    const btnEl = document.getElementById('loginSubmitBtn');

    if (!phone || !password) {
      if (errEl) { errEl.textContent = '请填写手机号和密码'; errEl.style.display = 'block'; }
      return;
    }
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '处理中...'; }
    if (errEl) errEl.style.display = 'none';

    try {
      let result;
      if (_isRegisterMode) {
        const nickname = document.getElementById('registerNickname').value.trim();
        result = await register(phone, password, nickname);
      } else {
        result = await login(phone, password);
      }
      if (result.ok) {
        closeAllPanels();
        if (typeof showToast === 'function') showToast(_isRegisterMode ? '注册成功！' : '登录成功！');
        window.updateAccountUI();
      } else {
        if (errEl) { errEl.textContent = result.error || '操作失败'; errEl.style.display = 'block'; }
      }
    } catch(e) {
      if (errEl) { errEl.textContent = e.message || '网络错误'; errEl.style.display = 'block'; }
    } finally {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = _isRegisterMode ? '注册' : '登录'; }
    }
  };

  window.handleLogout = async function() {
    if (typeof showToast === 'function') showToast('正在退出...');
    await logout();
    if (typeof showToast === 'function') showToast('已退出登录');
    window.updateAccountUI();
  };

  window.handleSyncUp = async function() {
    const statusEl = document.getElementById('syncUpStatus');
    if (statusEl) statusEl.textContent = '正在上传...';
    const result = await syncUp();
    if (result.ok) {
      const time = new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      if (statusEl) statusEl.textContent = '已上传 · ' + time;
      if (typeof showToast === 'function') showToast('上传成功！');
    } else {
      if (statusEl) statusEl.textContent = '上传失败：' + (result.error || '');
      if (typeof showToast === 'function') showToast('上传失败：' + (result.error || ''));
    }
  };

  window.handleSyncDown = async function() {
    if (!confirm('从云端下载数据将覆盖本地当前数据，确定继续？')) return;
    if (typeof showToast === 'function') showToast('正在下载...');
    const result = await syncDown();
    if (result.ok) {
      if (typeof showToast === 'function') showToast('恢复成功！即将刷新页面...');
      setTimeout(() => location.reload(), 1500);
    } else {
      if (typeof showToast === 'function') showToast('下载失败：' + (result.error || ''));
    }
  };

  window.openNicknameEditPanel = function() {
    const user = getCurrentUser();
    const input = document.getElementById('nicknameEditInput');
    if (input && user) input.value = user.nickname || '';
    openPanel('nicknamePanel');
  };

  window.handleNicknameUpdate = async function() {
    const nickname = document.getElementById('nicknameEditInput').value.trim();
    const result = await updateNickname(nickname);
    if (result.ok) {
      closeAllPanels();
      if (typeof showToast === 'function') showToast('昵称已更新');
      window.updateAccountUI();
    } else {
      if (typeof showToast === 'function') showToast('更新失败：' + (result.error || ''));
    }
  };

  // APK 环境下自动初始化
  if (window.isAPK && window.isAPK()) {
    document.addEventListener('DOMContentLoaded', function() {
      // 延迟初始化，等待 Capacitor 插件加载
      setTimeout(() => init().catch(e => console.warn('[Auth] 初始化失败:', e)), 1000);
    });
  }
})();

/* ===== modules/auto-checkin.js ===== */
/**
 * 自动打卡模块（仅 APK 端生效）
 * 监听屏幕开关事件，自动完成早起/早睡打卡
 *
 * 逻辑：
 *   - 解锁（USER_PRESENT）→ 4:00~12:00 之间首次解锁 → 自动打卡 early_rise
 *   - 关屏（SCREEN_OFF）→ 20:00~次日2:00 之间关屏 → 10分钟后打卡 early_sleep
 *   - 10分钟内亮屏 → 取消睡觉打卡
 *   - 当天已手动打卡则跳过
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'auto_checkin_config';
  var DEFAULT_CONFIG = {
    enabled: false,
    wakeStartHour: 4,
    wakeEndHour: 12,
    sleepStartHour: 20,
    sleepEndHour: 2,
    sleepDelayMinutes: 10
  };

  var _config = null;
  var _initialized = false;
  var _sleepTimer = null;
  var _screenWatcher = null;

  /**
   * 加载配置
   */
  function loadConfig() {
    if (_config) return _config;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      _config = raw ? JSON.parse(raw) : Object.assign({}, DEFAULT_CONFIG);
      // 合并缺失字段
      for (var k in DEFAULT_CONFIG) {
        if (_config[k] === undefined) _config[k] = DEFAULT_CONFIG[k];
      }
    } catch(e) {
      _config = Object.assign({}, DEFAULT_CONFIG);
    }
    return _config;
  }

  /**
   * 保存配置
   */
  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loadConfig()));
    } catch(e) {}
  }

  /**
   * 获取今天的日期 key（YYYY-MM-DD）
   */
  function getTodayKey() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /**
   * 检查习惯今天是否已打卡
   */
  function isHabitDoneToday(habitId) {
    var records = window.checkinRecords || {};
    var todayKey = getTodayKey();
    var rec = records[todayKey];
    if (!rec || !rec[habitId]) return false;
    return !!rec[habitId].done;
  }

  /**
   * 执行打卡（boolean 类型习惯）
   */
  function doAutoCheckin(habitId) {
    var habits = window.habitsConfig || [];
    var h = habits.find(function(x) { return x.id === habitId; });
    if (!h) return false;

    var records = window.checkinRecords || {};
    var todayKey = getTodayKey();
    var rec = records[todayKey] || {};

    // 已打卡则跳过
    if (rec[habitId] && rec[habitId].done) return false;

    // 执行打卡
    rec[habitId] = { done: true, value: 1, lastInterval: Date.now(), ts: Date.now() };
    records[todayKey] = rec;
    window.checkinRecords = records;

    // 保存
    if (typeof saveRecords === 'function') {
      saveRecords();
    } else if (App.Core && App.Core.Storage && App.Core.Storage.saveRecords) {
      App.Core.Storage.saveRecords();
    }

    // 触发积分
    if (App.Core && App.Core.Utils && typeof App.Core.Utils.addPoints === 'function') {
      App.Core.Utils.addPoints(5, h.name + ' 自动打卡');
    }

    // 显示通知
    if (typeof showToast === 'function') {
      var emoji = h.icon || '✅';
      showToast(emoji + ' 自动打卡：' + h.name);
    }

    // 播放音效
    if (typeof playSound === 'function') {
      playSound('checkin');
    }

    // 触发重新渲染
    if (typeof render === 'function') {
      render(['today', 'checkin']);
    }

    return true;
  }

  /**
   * 处理解锁事件（起床打卡）
   */
  function onScreenOn() {
    if (!_config || !_config.enabled) return;

    var hour = new Date().getHours();
    // 4:00~12:00 之间首次解锁 → 打卡早起
    if (hour < _config.wakeStartHour || hour >= _config.wakeEndHour) return;

    // 取消待执行的睡觉打卡
    cancelSleepTimer();

    // 检查是否已打卡
    if (isHabitDoneToday('early_rise')) return;

    // 执行早起打卡
    doAutoCheckin('early_rise');
  }

  /**
   * 处理关屏事件（睡觉打卡）
   */
  function onScreenOff() {
    if (!_config || !_config.enabled) return;

    var hour = new Date().getHours();
    // 20:00~次日2:00 之间关屏 → 延迟打卡
    var inSleepWindow = (hour >= _config.sleepStartHour || hour < _config.sleepEndHour);
    if (!inSleepWindow) return;

    // 检查是否已打卡
    if (isHabitDoneToday('early_sleep')) return;

    // 启动延迟计时器
    cancelSleepTimer();
    var delay = (_config.sleepDelayMinutes || 10) * 60 * 1000;
    _sleepTimer = setTimeout(function() {
      _sleepTimer = null;
      if (!_config || !_config.enabled) return;
      if (isHabitDoneToday('early_sleep')) return;
      doAutoCheckin('early_sleep');
    }, delay);
  }

  /**
   * 取消睡觉打卡计时器
   */
  function cancelSleepTimer() {
    if (_sleepTimer) {
      clearTimeout(_sleepTimer);
      _sleepTimer = null;
    }
  }

  /**
   * 初始化模块（仅 APK 环境）
   */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // 仅 APK 环境
    if (!window.isAPK || !window.isAPK()) return;

    loadConfig();

    // 获取 Capacitor 插件实例
    if (typeof Capacitor === 'undefined' || !Capacitor.Plugins || !Capacitor.Plugins.ScreenWatcher) {
      return;
    }
    _screenWatcher = Capacitor.Plugins.ScreenWatcher;

    // 如果已启用，自动启动服务
    if (_config.enabled) {
      startService();
    }

    // 注册事件监听
    _screenWatcher.addListener('screenWatcherEvent', function(data) {
      if (!data || !data.type) return;
      if (data.type === 'screenOn') {
        onScreenOn();
      } else if (data.type === 'screenOff') {
        onScreenOff();
      }
    });
  }

  /**
   * 启动原生监听服务
   */
  function startService() {
    if (!_screenWatcher) return;
    _screenWatcher.start().then(function(result) {
      if (result && result.ok) {
        if (typeof showToast === 'function') {
          showToast('🤖 自动打卡已启用');
        }
      } else if (result && result.error) {
        if (typeof showToast === 'function') {
          showToast('⚠️ ' + result.error);
        }
      }
    }).catch(function(e) {
      console.error('[AutoCheckin] 启动失败:', e);
    });
  }

  /**
   * 停止原生监听服务
   */
  function stopService() {
    if (!_screenWatcher) return;
    cancelSleepTimer();
    _screenWatcher.stop().then(function() {
      if (typeof showToast === 'function') {
        showToast('🤖 自动打卡已关闭');
      }
    }).catch(function(e) {
      console.error('[AutoCheckin] 停止失败:', e);
    });
  }

  /**
   * 切换启用状态
   */
  function toggle(callback) {
    if (!window.isAPK || !window.isAPK()) {
      if (typeof showToast === 'function') {
        showToast('⚠️ 自动打卡仅支持 App 版');
      }
      if (callback) callback(false);
      return;
    }

    var cfg = loadConfig();
    cfg.enabled = !cfg.enabled;
    saveConfig();

    if (cfg.enabled) {
      startService();
      if (callback) callback(true);
    } else {
      stopService();
      if (callback) callback(false);
    }
  }

  /**
   * 更新配置
   */
  function updateConfig(newConfig) {
    var cfg = loadConfig();
    for (var k in newConfig) {
      if (cfg[k] !== undefined) cfg[k] = newConfig[k];
    }
    saveConfig();
  }

  /**
   * 获取配置
   */
  function getConfig() {
    return Object.assign({}, loadConfig());
  }

  /**
   * 检查服务运行状态
   */
  function checkRunning(callback) {
    if (!_screenWatcher) {
      if (callback) callback(false);
      return;
    }
    _screenWatcher.isRunning().then(function(result) {
      if (callback) callback(result && result.running);
    }).catch(function() {
      if (callback) callback(false);
    });
  }

  /**
   * 请求忽略电池优化
   */
  function requestIgnoreBatteryOptimization(callback) {
    if (!_screenWatcher) {
      if (callback) callback(false);
      return;
    }
    _screenWatcher.requestIgnoreBatteryOptimization().then(function(result) {
      if (callback) callback(result && result.ok);
    }).catch(function() {
      if (callback) callback(false);
    });
  }

  /**
   * 检查电池优化状态
   */
  function isBatteryOptimizationIgnored(callback) {
    if (!_screenWatcher) {
      if (callback) callback(true);
      return;
    }
    _screenWatcher.isBatteryOptimizationIgnored().then(function(result) {
      if (callback) callback(result && result.ignored);
    }).catch(function() {
      if (callback) callback(true);
    });
  }

  // 注册到 App.Modules
  if (typeof App !== 'undefined' && App.registerModule) {
    App.registerModule('modules.autoCheckin', 'modules', function() {
      return {
        init: init,
        toggle: toggle,
        getConfig: getConfig,
        updateConfig: updateConfig,
        checkRunning: checkRunning,
        requestIgnoreBatteryOptimization: requestIgnoreBatteryOptimization,
        isBatteryOptimizationIgnored: isBatteryOptimizationIgnored,
        isHabitDoneToday: isHabitDoneToday,
        doAutoCheckin: doAutoCheckin
      };
    });
  }

  // ---- UI 交互函数（暴露到 window 供 HTML onclick 调用） ----

  /**
   * 更新自动打卡 UI 状态
   */
  function updateAutoCheckinUI() {
    var isAPK = window.isAPK && window.isAPK();
    var group = document.getElementById('autoCheckinGroup');
    if (!group) return;

    if (!isAPK) {
      group.style.display = 'none';
      return;
    }

    group.style.display = '';

    var cfg = getConfig();
    var toggleEl = document.getElementById('autoCheckinToggle');
    if (toggleEl) toggleEl.checked = cfg.enabled;

    var descEl = document.getElementById('autoCheckinStatusDesc');
    if (descEl) {
      descEl.textContent = cfg.enabled
        ? '运行中 · 早起 ' + cfg.wakeStartHour + ':00-' + cfg.wakeEndHour + ':00 · 早睡 ' + cfg.sleepStartHour + ':00-' + cfg.sleepEndHour + ':00'
        : '开屏自动打卡早起，关屏自动打卡早睡';
    }

    // 检查电池优化状态
    var batteryRow = document.getElementById('batteryOptRow');
    if (batteryRow) {
      isBatteryOptimizationIgnored(function(ignored) {
        if (ignored) {
          batteryRow.style.display = 'none';
        } else {
          batteryRow.style.display = '';
          var batteryDesc = document.getElementById('batteryOptDesc');
          if (batteryDesc) batteryDesc.textContent = '⚠️ 未关闭电池优化，可能影响后台运行';
        }
      });
    }
  }

  /**
   * 切换自动打卡开关
   */
  function toggleAutoCheckin(checked) {
    var cfg = loadConfig();
    var wasEnabled = cfg.enabled;
    cfg.enabled = checked;
    saveConfig();

    if (checked && !wasEnabled) {
      startService();
    } else if (!checked && wasEnabled) {
      stopService();
    }

    // 更新描述
    var descEl = document.getElementById('autoCheckinStatusDesc');
    if (descEl) {
      descEl.textContent = checked
        ? '运行中 · 早起 ' + cfg.wakeStartHour + ':00-' + cfg.wakeEndHour + ':00 · 早睡 ' + cfg.sleepStartHour + ':00-' + cfg.sleepEndHour + ':00'
        : '开屏自动打卡早起，关屏自动打卡早睡';
    }

    // 如果启用，检查电池优化
    if (checked) {
      var batteryRow = document.getElementById('batteryOptRow');
      if (batteryRow) {
        isBatteryOptimizationIgnored(function(ignored) {
          batteryRow.style.display = ignored ? 'none' : '';
        });
      }
    }
  }

  /**
   * 处理电池优化点击
   */
  function handleBatteryOptimization() {
    requestIgnoreBatteryOptimization(function(ok) {
      if (ok) {
        // 延迟检查状态（用户可能需要时间操作）
        setTimeout(function() {
          var batteryRow = document.getElementById('batteryOptRow');
          if (batteryRow) {
            isBatteryOptimizationIgnored(function(ignored) {
              batteryRow.style.display = ignored ? 'none' : '';
              if (!ignored && typeof showToast === 'function') {
                showToast('⚠️ 仍需在系统设置中允许后台运行');
              }
            });
          }
        }, 2000);
      }
    });
  }

  // 暴露到 window（供 HTML onclick 调用）
  window.AutoCheckin = {
    init: init,
    toggle: toggle,
    getConfig: getConfig,
    updateConfig: updateConfig,
    checkRunning: checkRunning,
    requestIgnoreBatteryOptimization: requestIgnoreBatteryOptimization,
    isBatteryOptimizationIgnored: isBatteryOptimizationIgnored
  };
  window.updateAutoCheckinUI = updateAutoCheckinUI;
  window.toggleAutoCheckin = toggleAutoCheckin;
  window.handleBatteryOptimization = handleBatteryOptimization;
})();
