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

  // ===== 暴露 =====
  App.Modules.Habit = {
    sortHabits: sortHabits,
    cleanupRecordsForHabit: cleanupRecordsForHabit,
    archiveHabit: archiveHabit,
    unarchiveHabit: unarchiveHabit,
    deleteHabitWithCleanup: deleteHabitWithCleanup,
    touchLastDone: touchLastDone,
    markAddedAt: markAddedAt,
    // 调试
    _lastDoneTimestamp: _lastDoneTimestamp
  };

  if (App.registerModule) {
    App.registerModule('modules.habit', 'modules', null);
  }
})();
