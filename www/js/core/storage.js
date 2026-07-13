(function() {
  let _habitsConfig = [];
  let _checkinRecords = {};

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
        migrateOldFormat();
      } else {
        _checkinRecords = {};
      }
    } catch(e) {
      console.error('Load data error:', e);
      _habitsConfig = [];
      _checkinRecords = {};
    }
  }

  function migrateOldFormat() {
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
    saveRecords();
  }

  function _invalidateStats() {
    try {
      if (App.Core && App.Core.Utils && App.Core.Utils.markStatsDirty) App.Core.Utils.markStatsDirty();
    } catch (e) {}
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

  function saveConfig() { localStorage.setItem('habits_config', JSON.stringify(_habitsConfig)); _invalidateStats(); _runSaveHooks(); }
  function saveRecords() { localStorage.setItem('checkin_records', JSON.stringify(_checkinRecords)); _invalidateStats(); }
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
    });
    if (changed) saveConfig();
  }

  function exportData() {
    const data = {
      version: 2,
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

  function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = JSON.parse(e.target.result);
        if (data.habitsConfig) {
          _habitsConfig = data.habitsConfig;
          saveData();
        }
        if (data.checkinRecords) {
          _checkinRecords = data.checkinRecords;
          saveData();
        }
        if (data.constitutionResult) {
          localStorage.setItem('constitution_result', JSON.stringify(data.constitutionResult));
        }
        alert('数据导入成功！');
        render();
        closeAllPanels();
      } catch (err) {
        alert('导入失败：文件格式错误');
      }
    };
    reader.readAsText(file);
    input.value = '';
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
    saveConfig, saveRecords, saveData,
    exportData, importData,
    // 统一的判断函数，供 stats / render 等模块复用
    isHabitChecked,
    // 保存钩子注册，供通知系统等模块在配置变更后执行重调度
    registerSaveHook
  };

  if (App.registerModule) {
    App.registerModule('core.storage', 'core', null);
  }
})();
