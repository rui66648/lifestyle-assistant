(function() {
  function addHabitFromLib(id) {
    if (habitsConfig.find(h => h.id === id)) {
      showToast('该习惯已添加');
      return;
    }
    const lib = HABIT_LIBRARY.find(h => h.id === id);
    if (!lib) return;
    const newHabit = {
      id: lib.id,
      name: lib.name,
      icon: lib.icon,
      category: lib.category,
      type: lib.type,
      unit: lib.unit,
      repeat: [0,1,2,3,4,5,6],
      reminder: {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'}
    };
    if (lib.type === 'water' && lib.waterConfig) {
      newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
      newHabit.reminder = {enabled:true, method:'in-app'};
    }
    habitsConfig.push(newHabit);
    saveConfig();
    showToast(`${lib.icon} ${lib.name} 已添加`);
    renderLibraryPanel((document.querySelector('.lib-search') && document.querySelector('.lib-search').value) || '');
    render();
  }

  function addCustomHabit() {
    const name = document.getElementById('customHabitName').value.trim();
    const icon = document.getElementById('customHabitIcon').value.trim() || '✅';
    const typeBtn = document.querySelector('#customTypeSelector button.active');
    const type = typeBtn ? typeBtn.dataset.type : 'boolean';
    const unit = (document.getElementById('customHabitUnit') && document.getElementById('customHabitUnit').value).trim() || (type === 'count' ? '个' : type === 'timer' ? '分钟' : '');

    if (!name) {
      showToast('请输入习惯名称');
      return;
    }

    if (habitsConfig.find(h => h.name === name)) {
      showToast('已存在同名习惯，请使用不同名称');
      return;
    }

    const id = 'custom_' + Date.now();
    habitsConfig.push({
      id,
      name,
      icon,
      category: 'daytime',
      type,
      unit,
      repeat: [0,1,2,3,4,5,6],
      reminder: {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'}
    });
    saveConfig();
    showToast(`${icon} ${name} 已添加`);
    renderLibraryPanel('');
    render();
  }

  function addHealthPack() {
    const myIds = new Set(habitsConfig.map(h => h.id));
    let addedCount = 0;
    
    HEALTH_PACK.habits.forEach(ph => {
      if (myIds.has(ph.id)) return;
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      if (!lib) return;
      
      const newHabit = {
        id: lib.id,
        name: lib.name,
        icon: lib.icon,
        category: lib.category,
        type: lib.type,
        unit: lib.unit,
        reminder: {
          enabled: ph.reminder.enabled,
          time: ph.reminder.time,
          days: [0,1,2,3,4,5,6],
          method: 'in-app'
        }
      };
      
      if (lib.type === 'water' && lib.waterConfig) {
        newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
      }
      
      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });
    
    if (addedCount > 0) {
      saveConfig();
      showToast(`💚 健康生活建议包：已添加 ${addedCount} 个习惯`);
      renderLibraryPanel('');
      render();
    } else {
      showToast('建议包中的习惯已全部添加');
    }
  }

  function addSeasonalPack(season) {
    const pack = SEASONAL_PACKS[season];
    if (!pack) return;
    const myIds = new Set(habitsConfig.map(h => h.id));
    let addedCount = 0;
    
    pack.habits.forEach(ph => {
      if (myIds.has(ph.id)) return;
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      if (!lib) return;
      
      const newHabit = {
        id: lib.id,
        name: lib.name,
        icon: lib.icon,
        category: lib.category,
        type: lib.type,
        unit: lib.unit,
        reminder: {
          enabled: ph.reminder.enabled,
          time: ph.reminder.time,
          days: [0,1,2,3,4,5,6],
          method: 'in-app'
        }
      };
      
      if (lib.type === 'water' && lib.waterConfig) {
        newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
      }
      
      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });
    
    if (addedCount > 0) {
      saveConfig();
      showToast(`${pack.emoji} ${pack.name}：已添加 ${addedCount} 个习惯`);
      renderLibraryPanel('');
      render();
    } else {
      showToast(`${pack.name}中的习惯已全部添加`);
    }
  }

  function selectCustomType(btn) {
    document.querySelectorAll('#customTypeSelector button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.type;
    document.getElementById('customUnitWrap').style.display = (type === 'boolean') ? 'none' : 'block';
  }

  function deleteHabit(habitId) {
    if (!confirm('确定要删除这个习惯吗？打卡记录会保留。')) return;
    habitsConfig = habitsConfig.filter(h => h.id !== habitId);
    saveConfig();
    showToast('已删除习惯');
    render();
  }

  function toggleHabitEnabled(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    h.enabled = h.enabled === false ? true : false;
    saveConfig();
    renderMyPack();
    renderCheckin();
    showToast(h.enabled !== false ? `${h.icon} ${h.name} 已启用` : `${h.icon} ${h.name} 已禁用`);
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Habit = {
    addHabitFromLib,
    addCustomHabit,
    addHealthPack,
    addSeasonalPack,
    selectCustomType,
    deleteHabit,
    toggleHabitEnabled
  };
})();
