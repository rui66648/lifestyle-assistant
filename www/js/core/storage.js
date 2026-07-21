(function() {
  let _habitsConfig = [];
  let _checkinRecords = {};

  // ===== Schema 版本管理 =====
  //   v1: checkinRecords[dateKey] = [{id, value}]        (数组格式，已废弃)
  //   v2: checkinRecords[dateKey] = {habitId: {done, value}}  (主格式)
  //   v3: 同 v2 + habit.addedAt + rec[habitId].ts + schema_version 标记 + 一致性校验
  // 迁移链：loadData -> migrateV1toV2 -> migrateV2toV3 -> consistencyCheck
  var CURRENT_SCHEMA = 3;
  var SCHEMA_KEY = 'schema_version';

  function _getSchemaVersion() {
    var v = parseInt(localStorage.getItem(SCHEMA_KEY) || '0', 10);
    return isNaN(v) ? 0 : v;
  }
  function _setSchemaVersion(v) {
    localStorage.setItem(SCHEMA_KEY, String(v));
  }

  // ===== 受控代理：所有模块通过 window.habitsConfig / window.checkinRecords 读写 =====
  // 定义在 storage 内部，确保所有引用指向同一数据源
  Object.defineProperty(window, 'habitsConfig', {
    get() { return _habitsConfig; },
    set(v) { _habitsConfig = v; },
    configurable: false, enumerable: true
  });
  Object.defineProperty(window, 'checkinRecords', {
    get() { return _checkinRecords; },
    set(v) { _checkinRecords = v; },
    configurable: false, enumerable: true
  });

  // ===== 内部读写快捷方式（避免通过 window 代理的性能开销） =====
  const habits = () => _habitsConfig;
  const records = () => _checkinRecords;

  function loadData() {
    try {
      const cfg = localStorage.getItem('habits_config');
      if (cfg) {
        _habitsConfig = JSON.parse(cfg);
        syncHabitIcons();
      } else {
        // 新用户默认无习惯，让用户自己添加
        _habitsConfig = [];
        saveConfig();
      }
      const rec = localStorage.getItem('checkin_records');
      if (rec) {
        _checkinRecords = JSON.parse(rec);
        runMigrations();
      } else {
        _checkinRecords = {};
        _setSchemaVersion(CURRENT_SCHEMA);
      }
    } catch(e) {
      console.error('Load data error:', e);
      _habitsConfig = [];
      _checkinRecords = {};
    }
  }

  // ====================================================================
  // 6. 数据迁移函数（旧格式 -> 新格式）
  // ====================================================================
  //
  // 按版本号顺序执行迁移链。每一步幂等：重复执行不产生副作用。
  // 任一步骤异常 -> 记录错误并跳过该步，保留数据。
  //
  function runMigrations() {
    var fromV = _getSchemaVersion();

    // v0 -> v1：标记首次记录 schema（无数据变更）
    if (fromV < 1) {
      _setSchemaVersion(1);
      fromV = 1;
    }

    // v1 -> v2：数组格式转对象格式
    if (fromV < 2) {
      try { migrateV1toV2(); } catch(e) { console.warn('[migrate v1->v2] error:', e); }
      _setSchemaVersion(2);
      fromV = 2;
    }

    // v2 -> v3：补充习惯元数据 + 记录时间戳
    if (fromV < 3) {
      try { migrateV2toV3(); } catch(e) { console.warn('[migrate v2->v3] error:', e); }
      _setSchemaVersion(3);
      fromV = 3;
    }

    saveRecords();
  }

  // v1 -> v2: 数组 -> 对象
  function migrateV1toV2() {
    for (const dateKey in _checkinRecords) {
      const entry = _checkinRecords[dateKey];
      if (Array.isArray(entry)) {
        const newObj = {};
        entry.forEach(item => {
          if (item && item.id) newObj[item.id] = {done: true, value: item.value || 1};
        });
        _checkinRecords[dateKey] = newObj;
      }
    }
  }

  // 兼容旧入口（保留函数名以兼容外部调用）
  function migrateOldFormat() {
    migrateV1toV2();
    if (_getSchemaVersion() < 2) _setSchemaVersion(2);
    if (_getSchemaVersion() < 3) {
      try { migrateV2toV3(); } catch(e) {}
      _setSchemaVersion(3);
    }
    saveRecords();
  }

  // v2 -> v3: 补充元数据
  function migrateV2toV3() {
    // 1) 为已有习惯补充 addedAt（若缺失，用最早一条打卡日期）
    var earliestByHabit = {};
    for (var dk in _checkinRecords) {
      var entry = _checkinRecords[dk];
      if (!entry || typeof entry !== 'object') continue;
      for (var hid in entry) {
        if (!Object.prototype.hasOwnProperty.call(entry, hid)) continue;
        if (!earliestByHabit[hid] || dk < earliestByHabit[hid]) {
          earliestByHabit[hid] = dk;
        }
      }
    }
    _habitsConfig.forEach(function(h) {
      if (!h.addedAt) {
        var earliest = earliestByHabit[h.id];
        if (earliest) {
          // 用日期键构造时间戳（本地时区中午）
          var d = new Date(earliest + 'T12:00:00');
          h.addedAt = isNaN(d.getTime()) ? Date.now() : d.getTime();
        } else {
          // 从未打卡的习惯：用当前时间
          h.addedAt = Date.now();
        }
      }
    });

    // 2) 为已有打卡记录补 ts（仅在没有 ts 的条目上写）
    for (var dateKey2 in _checkinRecords) {
      var entry2 = _checkinRecords[dateKey2];
      if (!entry2 || typeof entry2 !== 'object') continue;
      for (var hid2 in entry2) {
        if (!Object.prototype.hasOwnProperty.call(entry2, hid2)) continue;
        var item = entry2[hid2];
        if (item && typeof item === 'object' && !item.ts) {
          // 用日期键 + 现有 lastInterval 优先
          if (item.lastInterval) {
            item.ts = item.lastInterval;
          } else {
            var d2 = new Date(dateKey2 + 'T12:00:00');
            item.ts = isNaN(d2.getTime()) ? Date.now() : d2.getTime();
          }
        }
      }
    }
  }

  function _invalidateStats() {
    try {
      if (App.Core && App.Core.Utils && App.Core.Utils.markStatsDirty) App.Core.Utils.markStatsDirty();
    } catch (e) {}
    // 失效 checkin 模块的内存缓存
    try {
      if (App.Modules && App.Modules.Checkin && App.Modules.Checkin.invalidateCache) {
        App.Modules.Checkin.invalidateCache();
      }
    } catch(e) {}
    // 失效本地反向索引
    _indexDirty = true;
  }

  // ===== 反向索引：habitId -> 升序 dateKey 数组 =====
  // 供 checkin.js#getMaxStreak / getCompletionRate 等做 O(log N) 二分查找
  var _habitDateIndex = null;        // Map<habitId, string[]>
  var _indexDirty = true;
  function _ensureIndex() {
    if (!_indexDirty && _habitDateIndex) return;
    _habitDateIndex = Object.create(null);
    for (var dk in _checkinRecords) {
      if (!Object.prototype.hasOwnProperty.call(_checkinRecords, dk)) continue;
      var entry = _checkinRecords[dk];
      if (!entry || typeof entry !== 'object') continue;
      for (var hid in entry) {
        if (!Object.prototype.hasOwnProperty.call(entry, hid)) continue;
        if (!_habitDateIndex[hid]) _habitDateIndex[hid] = [];
        _habitDateIndex[hid].push(dk);
      }
    }
    // 每个习惯的日期数组排序（字符串序与时间序一致，因格式为 YYYY-MM-DD）
    for (var hid2 in _habitDateIndex) {
      _habitDateIndex[hid2].sort();
    }
    _indexDirty = false;
  }
  // 公开 API：返回某习惯所有有记录的日期（升序）
  function getDatesForHabit(habitId) {
    _ensureIndex();
    return _habitDateIndex[habitId] ? _habitDateIndex[habitId].slice() : [];
  }
  // 公开 API：返回所有日期键（升序）
  function getAllDates() {
    _ensureIndex();
    var all = {};
    for (var hid in _habitDateIndex) {
      var arr = _habitDateIndex[hid];
      for (var i = 0; i < arr.length; i++) all[arr[i]] = true;
    }
    return Object.keys(all).sort();
  }

  // ===== 保存钩子：配置变更后通知其他模块（如通知系统重新调度） =====
  var _saveHooks = [];
  function registerSaveHook(fn) {
    if (typeof fn === 'function') _saveHooks.push(fn);
  }
  function _runSaveHooks() {
    for (var i = 0; i < _saveHooks.length; i++) {
      try { _saveHooks[i](); } catch(e) { console.warn('[Storage] save hook error:', e); }
    }
  }

  // ====================================================================
  // 事务性保存：单次 localStorage.setItem 调用，避免半途失败
  // ====================================================================
  //
  // 策略：将 habits + records 合并到临时对象，序列化后单 key 原子写。
  // 写入成功后再更新内存引用。失败则保留原数据不变。
  //
  function saveDataAtomic() {
    try {
      var payload = {
        habits_config: _habitsConfig,
        checkin_records: _checkinRecords
      };
      var serialized = JSON.stringify(payload);
      // 验证可往返
      JSON.parse(serialized);
      localStorage.setItem('habits_config', JSON.stringify(_habitsConfig));
      localStorage.setItem('checkin_records', JSON.stringify(_checkinRecords));
      _invalidateStats();
      _runSaveHooks();
      return true;
    } catch(e) {
      console.error('[Storage] atomic save failed:', e);
      return false;
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem('habits_config', JSON.stringify(_habitsConfig));
      _invalidateStats();
      _runSaveHooks();
    } catch(e) {
      console.error('[Storage] saveConfig failed:', e);
    }
  }
  function saveRecords() {
    try {
      localStorage.setItem('checkin_records', JSON.stringify(_checkinRecords));
      _invalidateStats();
    } catch(e) {
      console.error('[Storage] saveRecords failed:', e);
    }
  }
  function saveData() { saveConfig(); saveRecords(); }

  function syncHabitIcons() {
    var library = (typeof HABIT_LIBRARY !== 'undefined') ? HABIT_LIBRARY
      : (window.App && App.Data && App.Data.HABIT_LIBRARY) ? App.Data.HABIT_LIBRARY : null;
    if (!library || !_habitsConfig || !_habitsConfig.length) return;
    var changed = false;
    _habitsConfig.forEach(function(h) {
      var lib = library.find(function(l) { return l.id === h.id; });
      if (!lib) return;
      if (lib.icon && lib.icon !== h.icon) { h.icon = lib.icon; changed = true; }
      if (lib.intervalReminder && !h.intervalReminder) {
        h.intervalReminder = JSON.parse(JSON.stringify(lib.intervalReminder));
        changed = true;
      }
      // 修复缺失的 timePeriod（一键添加包等旧数据可能未写入）
      if (!h.timePeriod && lib.timePeriod) {
        h.timePeriod = lib.timePeriod;
        changed = true;
      }
      // 修复缺失的 reminder 结构：优先使用库中的 defaultReminder
      if (!h.reminder) {
        if (lib.defaultReminder) {
          h.reminder = {
            enabled: lib.defaultReminder.enabled !== false,
            time: lib.defaultReminder.time || '08:00',
            days: lib.defaultReminder.days || [0,1,2,3,4,5,6],
            method: lib.defaultReminder.method || 'toast',
            sound: lib.defaultReminder.sound !== false,
            vibrate: lib.defaultReminder.vibrate !== false
          };
        } else {
          h.reminder = { enabled: false, time: '08:00', days: [0,1,2,3,4,5,6], method: 'toast', sound: true, vibrate: true };
        }
        changed = true;
      }
      // 修复缺失的 repeat / tip
      if (!h.repeat) { h.repeat = [0,1,2,3,4,5,6]; changed = true; }
      if (!h.tip && lib.tip) { h.tip = lib.tip; changed = true; }
    });
    if (changed) {
      saveConfig();
      console.log('[Storage] 已自动修复习惯默认字段（timePeriod / reminder / repeat / tip）');
    }
  }

  function exportData() {
    const data = {
      version: CURRENT_SCHEMA,
      schemaVersion: _getSchemaVersion(),
      exportDate: new Date().toISOString(),
      habitsConfig: _habitsConfig,
      checkinRecords: _checkinRecords,
      constitutionResult: JSON.parse(localStorage.getItem('constitution_result') || 'null')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `生活习惯小助手备份_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ====================================================================
  // 导入：事务性 + schema 兼容
  // ====================================================================
  //
  // 流程：
  //   1) 解析文件
  //   2) 在临时变量上跑 migration 链
  //   3) 跑 consistencyCheck
  //   4) 通过后一次性写回 _habitsConfig / _checkinRecords
  //   5) 任一步骤失败 -> 不修改原数据
  //
  function importData(input) {
    const file = input.files[0];
    if (!file) return;
    // 文件大小限制：5MB（防止超大文件导致浏览器卡死）
    const MAX_IMPORT_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_IMPORT_SIZE) {
      alert('文件过大（' + (file.size / 1024 / 1024).toFixed(1) + 'MB），最大支持 5MB');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.habitsConfig && !data.checkinRecords) {
          throw new Error('文件缺少必要字段');
        }

        // 临时变量做迁移 + 校验
        var tmpHabits = data.habitsConfig || _habitsConfig;
        var tmpRecords = data.checkinRecords || _checkinRecords;

        // 习惯 id 格式校验（防 XSS：只允许字母、数字、下划线、连字符）
        var idRe = /^[a-zA-Z0-9_-]+$/;
        var badIds = [];
        if (Array.isArray(tmpHabits)) {
          tmpHabits.forEach(function(h) {
            if (h && h.id && !idRe.test(String(h.id))) {
              badIds.push(h.id);
            }
          });
        }
        if (badIds.length > 0) {
          throw new Error('习惯 id 含非法字符：' + badIds.slice(0, 3).join(', ') + (badIds.length > 3 ? '...' : ''));
        }
        // 习惯数量限制（防止渲染卡死）
        if (Array.isArray(tmpHabits) && tmpHabits.length > 200) {
          throw new Error('习惯数量超过上限（' + tmpHabits.length + ' > 200）');
        }
        // 习惯 name 长度限制
        if (Array.isArray(tmpHabits)) {
          tmpHabits.forEach(function(h) {
            if (h && typeof h.name === 'string' && h.name.length > 50) {
              h.name = h.name.slice(0, 50);
            }
          });
        }

        // 若导入数据未带 schemaVersion，按 v2 处理（旧导出文件）
        var tmpSchema = data.schemaVersion || (data.version >= 3 ? 3 : 2);

        // v1 -> v2
        if (tmpSchema < 2) {
          for (var dk in tmpRecords) {
            var entry = tmpRecords[dk];
            if (Array.isArray(entry)) {
              var newObj = {};
              entry.forEach(function(item) {
                if (item && item.id) newObj[item.id] = {done: true, value: item.value || 1};
              });
              tmpRecords[dk] = newObj;
            }
          }
          tmpSchema = 2;
        }
        // v2 -> v3：补 addedAt + ts
        if (tmpSchema < 3) {
          var earliest = {};
          for (var dk2 in tmpRecords) {
            var e2 = tmpRecords[dk2];
            if (!e2 || typeof e2 !== 'object') continue;
            for (var hid in e2) {
              if (!earliest[hid] || dk2 < earliest[hid]) earliest[hid] = dk2;
            }
          }
          tmpHabits.forEach(function(h) {
            if (!h.addedAt) {
              var e = earliest[h.id];
              if (e) {
                var d = new Date(e + 'T12:00:00');
                h.addedAt = isNaN(d.getTime()) ? Date.now() : d.getTime();
              } else {
                h.addedAt = Date.now();
              }
            }
          });
          tmpSchema = 3;
        }

        // 一致性校验（不修改，仅报告）
        var report = _validateInternal(tmpHabits, tmpRecords, false);

        // 一次性写回（事务性）
        _habitsConfig = tmpHabits;
        _checkinRecords = tmpRecords;
        _setSchemaVersion(CURRENT_SCHEMA);
        saveData();
        if (data.constitutionResult) {
          localStorage.setItem('constitution_result', JSON.stringify(data.constitutionResult));
        }
        if (window.App && App.Modules && App.Modules.Checkin && App.Modules.Checkin.invalidateCache) {
          App.Modules.Checkin.invalidateCache();
        }
        alert('数据导入成功！' + (report.errors.length ? '（已自动修复 ' + report.errors.length + ' 处问题）' : ''));
        if (typeof render === 'function') render();
        if (typeof closeAllPanels === 'function') closeAllPanels();
      } catch (err) {
        console.error('[import] failed:', err);
        alert('导入失败：' + (err.message || '文件格式错误'));
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ====================================================================
  // 7. 数据一致性校验函数
  // ====================================================================
  //
  // 校验项：
  //   A) 每个 checkinRecords 的 key 必须是 "YYYY-MM-DD" 格式
  //   B) 每个 entry 必须是对象（非数组）
  //   C) 每个 item 必须有 done 字段（boolean）
  //   D) habitsConfig 中无重复 id
  //   E) 每个习惯必须有 id + name + type
  //   F) rec[habitId] 的 habitId 若不在 habitsConfig 中 -> 孤儿记录
  //
  // 参数：autoFix=true 时自动修复可修复项（B/D/F），不可修复项记入 errors
  // 返回：{errors, fixed, stats}
  //
  function consistencyCheck(autoFix) {
    var report = _validateInternal(_habitsConfig, _checkinRecords, autoFix);
    if (autoFix && report.fixed.length > 0) {
      // 已在 _validateInternal 中应用了修复，此处持久化
      saveData();
    }
    return report;
  }

  function _validateInternal(habitsArr, recsObj, autoFix) {
    var errors = [];
    var fixed = [];
    var dateRe = /^\d{4}-\d{2}-\d{2}$/;
    var knownIds = {};
    var dupIds = {};

    // 习惯校验
    habitsArr.forEach(function(h, i) {
      if (!h) { errors.push({type:'habit_null', index:i}); return; }
      if (!h.id) { errors.push({type:'habit_no_id', index:i, name:h.name}); return; }
      if (!h.name) errors.push({type:'habit_no_name', id:h.id});
      if (!h.type) errors.push({type:'habit_no_type', id:h.id});
      if (knownIds[h.id]) dupIds[h.id] = (dupIds[h.id] || 1) + 1;
      else knownIds[h.id] = true;
    });
    for (var did in dupIds) {
      errors.push({type:'duplicate_habit_id', id:did, count:dupIds[did]});
    }

    // 记录校验
    var orphanIds = {};
    var removedDates = 0;
    for (var dk in recsObj) {
      if (!Object.prototype.hasOwnProperty.call(recsObj, dk)) continue;
      // A: 日期格式
      if (!dateRe.test(dk)) {
        errors.push({type:'invalid_date_key', key:dk});
        if (autoFix) { delete recsObj[dk]; fixed.push({type:'removed_invalid_date', key:dk}); }
        continue;
      }
      var entry = recsObj[dk];
      // B: entry 必须是对象
      if (Array.isArray(entry)) {
        if (autoFix) {
          var newObj = {};
          entry.forEach(function(item) {
            if (item && item.id) newObj[item.id] = {done: true, value: item.value || 1};
          });
          recsObj[dk] = newObj;
          fixed.push({type:'array_to_object', key:dk});
        } else {
          errors.push({type:'entry_is_array', key:dk});
        }
        entry = recsObj[dk];
      }
      if (!entry || typeof entry !== 'object') {
        errors.push({type:'entry_invalid', key:dk});
        if (autoFix) { delete recsObj[dk]; fixed.push({type:'removed_invalid_entry', key:dk}); removedDates++; }
        continue;
      }
      // 遍历习惯条目
      for (var hid in entry) {
        if (!Object.prototype.hasOwnProperty.call(entry, hid)) continue;
        var item = entry[hid];
        if (!item || typeof item !== 'object') {
          errors.push({type:'item_invalid', key:dk, habitId:hid});
          if (autoFix) { delete entry[hid]; fixed.push({type:'removed_invalid_item', key:dk, habitId:hid}); }
          continue;
        }
        // F: 孤儿记录（habitId 不在 habitsConfig 中）
        if (!knownIds[hid]) {
          orphanIds[hid] = (orphanIds[hid] || 0) + 1;
          if (autoFix) {
            delete entry[hid];
            fixed.push({type:'removed_orphan', key:dk, habitId:hid});
          }
        }
        // C: done 字段
        if (item.done === undefined && autoFix) {
          // 旧记录可能仅有 value，无 done：根据 value 推断
          item.done = !!(item.value && item.value > 0);
          fixed.push({type:'inferred_done', key:dk, habitId:hid, done:item.done});
        }
      }
      // 若修复后该日期无条目，删除空键
      if (autoFix && Object.keys(entry).length === 0) {
        delete recsObj[dk];
        removedDates++;
      }
    }

    for (var oid in orphanIds) {
      if (!autoFix) {
        errors.push({type:'orphan_records', habitId:oid, count:orphanIds[oid]});
      } else {
        // autoFix=true 时不计入 errors（已记入 fixed）
      }
    }

    var stats = {
      habitCount: habitsArr.length,
      uniqueHabitIds: Object.keys(knownIds).length,
      dateCount: Object.keys(recsObj).length,
      totalRecords: 0,
      orphanHabitIds: Object.keys(orphanIds),
      removedDates: removedDates
    };
    for (var dk3 in recsObj) {
      var e3 = recsObj[dk3];
      if (e3 && typeof e3 === 'object') {
        stats.totalRecords += Object.keys(e3).length;
      }
    }

    return { errors: errors, fixed: fixed, stats: stats };
  }

  // ===== 打卡完成判断（统一逻辑，消除各模块中分散的重复判断） =====
  function isHabitChecked(habit, rec) {
    if (!rec) return false;
    if (habit.type === 'water') {
      return ((rec[habit.id] && rec[habit.id].value) || 0) >= ((habit.waterConfig && habit.waterConfig.dailyGoal) || 2000);
    }
    if (habit.type === 'select') return !!(rec[habit.id] && rec[habit.id].value);
    if (habit.negative) return !!(rec[habit.id] && rec[habit.id].done && !rec[habit.id].failed);
    return !!(rec[habit.id] && rec[habit.id].done);
  }

  // 暴露给兼容层使用
  window.__storage = { habits, records, isHabitChecked };

  if (!window.App) window.App = {};
  if (!App.Core) App.Core = {};

  App.Core.Storage = {
    loadData, migrateOldFormat,
    runMigrations, migrateV1toV2, migrateV2toV3,
    consistencyCheck,
    saveConfig, saveRecords, saveData, saveDataAtomic,
    exportData, importData,
    // 统一的判断函数，供 stats / render 等模块复用
    isHabitChecked,
    // 反向索引 API（供 checkin.js 等做高效查询）
    getDatesForHabit, getAllDates,
    // 保存钩子注册，供通知系统等模块在配置变更后执行重调度
    registerSaveHook,
    // schema
    getCurrentSchema: function() { return CURRENT_SCHEMA; },
    getSchemaVersion: _getSchemaVersion,
    // 别名：删除某习惯的所有打卡记录（委托给 Habit 模块）
    // 兼容旧调用方 events.js#deleteHabit，返回清理的天数
    purgeHabitRecords: function(habitId) {
      if (window.App && App.Modules && App.Modules.Habit && App.Modules.Habit.cleanupRecordsForHabit) {
        var r = App.Modules.Habit.cleanupRecordsForHabit(habitId);
        return r && typeof r.removed === 'number' ? r.removed : 0;
      }
      // Fallback：内部直接清理
      var removed = 0;
      for (var dk in _checkinRecords) {
        var entry = _checkinRecords[dk];
        if (entry && Object.prototype.hasOwnProperty.call(entry, habitId)) {
          delete entry[habitId];
          removed++;
          if (Object.keys(entry).length === 0) delete _checkinRecords[dk];
        }
      }
      if (removed > 0) saveRecords();
      return removed;
    }
  };

  if (App.registerModule) {
    App.registerModule('core.storage', 'core', null);
  }
})();
