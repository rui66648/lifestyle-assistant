(function() {
  let habitsConfig = [];
  let checkinRecords = {};

  window.habitsConfig = habitsConfig;
  window.checkinRecords = checkinRecords;

  function loadData() {
    try {
      const cfg = localStorage.getItem('habits_config');
      if (cfg) {
        habitsConfig = JSON.parse(cfg);
        window.habitsConfig = habitsConfig;
      } else {
        habitsConfig = DEFAULT_HABITS.map(id => {
          const lib = HABIT_LIBRARY.find(h => h.id === id);
          return {
            id: lib.id,
            name: lib.name,
            icon: lib.icon,
            category: lib.category,
            type: lib.type,
            unit: lib.unit,
            reminder: {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'}
          };
        });
        window.habitsConfig = habitsConfig;
        saveConfig();
      }

      const rec = localStorage.getItem('checkin_records');
      if (rec) {
        checkinRecords = JSON.parse(rec);
        window.checkinRecords = checkinRecords;
        migrateOldFormat();
      } else {
        checkinRecords = {};
        window.checkinRecords = checkinRecords;
      }
    } catch(e) {
      console.error('Load data error:', e);
      habitsConfig = [];
      checkinRecords = {};
      window.habitsConfig = habitsConfig;
      window.checkinRecords = checkinRecords;
    }
  }

  function migrateOldFormat() {
    for (const dateKey in checkinRecords) {
      const entry = checkinRecords[dateKey];
      if (Array.isArray(entry)) {
        const newObj = {};
        entry.forEach(item => {
          if (item && item.id) {
            newObj[item.id] = {done: true, value: item.value || 1};
          }
        });
        checkinRecords[dateKey] = newObj;
      }
    }
    saveRecords();
  }

  function saveConfig() {
    localStorage.setItem('habits_config', JSON.stringify(habitsConfig));
  }

  function saveRecords() {
    localStorage.setItem('checkin_records', JSON.stringify(checkinRecords));
  }

  function saveData() {
    saveConfig();
    saveRecords();
  }

  function exportData() {
    const data = {
      version: 2,
      exportDate: new Date().toISOString(),
      habitsConfig: habitsConfig,
      checkinRecords: checkinRecords,
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
          habitsConfig = data.habitsConfig;
          window.habitsConfig = habitsConfig;
          saveData();
        }
        if (data.checkinRecords) {
          checkinRecords = data.checkinRecords;
          window.checkinRecords = checkinRecords;
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

  function getHabitsConfig() {
    return habitsConfig;
  }

  function setHabitsConfig(config) {
    habitsConfig = config;
    window.habitsConfig = habitsConfig;
  }

  function getCheckinRecords() {
    return checkinRecords;
  }

  function setCheckinRecords(records) {
    checkinRecords = records;
    window.checkinRecords = checkinRecords;
  }

  if (!window.App) window.App = {};
  if (!App.Core) App.Core = {};

  App.Core.Storage = {
    loadData,
    migrateOldFormat,
    saveConfig,
    saveRecords,
    saveData,
    exportData,
    importData,
    getHabitsConfig,
    setHabitsConfig,
    getCheckinRecords,
    setCheckinRecords
  };
})();
