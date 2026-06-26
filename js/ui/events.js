(function() {
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-' + tab).classList.add('active');
    // 我的页面隐藏顶部日期卡片，其他页面显示
    const todayCard = document.getElementById('todayCard');
    if (todayCard) todayCard.style.display = tab === 'profile' ? 'none' : '';
    if (tab === 'profile') renderProfile();
    if (tab === 'manage') renderManage();
    if (tab === 'checkin') renderCheckin();
  }

  function handleCheckin(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const rec = checkinRecords[today()] || {};

    if (h.type === 'water') {
      openWaterInputPanel(habitId);
      return;
    }

    if (h.negative) {
      if (rec[habitId] && rec[habitId].failed) {
        delete rec[habitId];
        showToast(`✅ ${h.icon} 今天没${h.name}，继续保持！`);
        playSound('checkin');
      } else if (rec[habitId] && rec[habitId].done) {
        rec[habitId] = {done: false, failed: true, value: 0};
        showToast(`❌ 今天${h.name}了，明天加油`);
      } else {
        rec[habitId] = {done: true, failed: false, value: 1};
        showToast(`✅ ${h.icon} 今天没${h.name}，继续保持！`);
        playSound('checkin');
        checkLevelUp();
      }
      checkinRecords[today()] = rec;
      saveRecords();
      animateCheckin(habitId);
      render();
      return;
    }

    if (h.type === 'boolean') {
      if (rec[habitId] && rec[habitId].done) {
        delete rec[habitId];
        showToast('已撤销打卡');
      } else {
        rec[habitId] = {done: true, value: 1};
        showToast(`${h.icon} ${h.name} 打卡成功！`);
        playSound('checkin');
        animateCheckin(habitId);
        checkLevelUp();
      }
      checkinRecords[today()] = rec;
      saveRecords();
      render();
    } else {
      pendingCheckinHabitId = habitId;
      document.getElementById('checkinPanelTitle').textContent = `${h.icon} ${h.name}`;
      document.getElementById('checkinInputLabel').textContent = h.type === 'count' ? '请输入数量' : '请输入时长';
      document.getElementById('checkinInputUnit').textContent = h.unit;
      const field = document.getElementById('checkinInputField');
      field.value = (rec[habitId] && rec[habitId].done) ? rec[habitId].value : '';
      field.placeholder = h.type === 'count' ? '0' : '0';
      openPanel('checkinPanel');
      setTimeout(() => field.focus(), 300);
    }
  }

  function confirmCheckinInput() {
    const field = document.getElementById('checkinInputField');
    const val = parseInt(field.value);
    if (isNaN(val) || val < 0) {
      showToast('请输入有效的数值');
      return;
    }
    const habitId = pendingCheckinHabitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;

    const rec = checkinRecords[today()] || {};
    if (val === 0) {
      delete rec[habitId];
      showToast('已撤销记录');
    } else {
      rec[habitId] = {done: true, value: val};
      showToast(`${h.icon} ${h.name} 记录 ${val}${h.unit}！`);
      playSound('checkin');
      checkLevelUp();
    }
    checkinRecords[today()] = rec;
    saveRecords();
    closeAllPanels();
    render();
  }

  function checkLevelUp() {
    const oldLevel = parseInt(localStorage.getItem('user_level') || '1');
    const newLevel = getCurrentLevel().level;
    if (newLevel > oldLevel) {
      localStorage.setItem('user_level', String(newLevel));
      const lv = LEVELS.find(l => l.level === newLevel);
      playSound('unlock');
      showToast(`🎉 升级！获得「${lv.icon} ${lv.name}」称号！`);
    }
    const done = getTodayDone();
    const total = getTodayTotal();
    if (done === total && total > 0) {
      setTimeout(() => {
        playSound('complete');
        showAllDoneCelebration();
      }, 300);
    }
  }

  function skipHabit(habitId) {
    const rec = checkinRecords[today()] || {};
    if (rec[habitId] && rec[habitId].skipped) {
      delete rec[habitId];
      showToast('已取消跳过');
    } else {
      rec[habitId] = {skipped: true};
      showToast(`⏭ 已跳过，不打断连续记录`);
    }
    checkinRecords[today()] = rec;
    saveRecords();
    render();
  }

  function doRetroactiveCheckin(habitId, dateKey, alreadyDone) {
    const rec = checkinRecords[dateKey] || {};
    if (alreadyDone) {
      delete rec[habitId];
      showToast('已取消补签');
    } else {
      rec[habitId] = {done: true, value: 1, retroactive: true};
      playSound('checkin');
      showToast('✅ 补签成功！');
    }
    checkinRecords[dateKey] = rec;
    saveRecords();
    render();
    openRetroactivePanel(habitId);
  }

  function animateCheckin(habitId) {
    const card = document.getElementById('card-' + habitId);
    if (!card) return;
    card.classList.add('flip');
    if (navigator.vibrate) navigator.vibrate(10);
    setTimeout(() => card.classList.remove('flip'), 500);

    setTimeout(() => {
      const emojis = ['⭐','✨','🌟','💫','🔥'];
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const star = document.createElement('div');
          star.className = 'star-particle';
          star.textContent = emojis[i % emojis.length];
          star.style.left = (card.offsetWidth / 2 + (Math.random() - 0.5) * 40) + 'px';
          star.style.top = (card.offsetHeight / 2) + 'px';
          star.style.animationDelay = (i * 0.05) + 's';
          card.appendChild(star);
          setTimeout(() => star.remove(), 600);
        }, i * 50);
      }
    }, 250);
  }

  function showAllDoneCelebration() {
    const banner = document.createElement('div');
    banner.className = 'all-done-banner';
    banner.innerHTML = '<span class="emoji">🎉</span><span class="text">全部完成！</span>';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2000);

    const colors = ['#7CB69D','#F4A683','#5B8DB8','#E07A5F','#C19A6B','#FFD700'];
    for (let i = 0; i < 30; i++) {
      setTimeout(() => {
        const p = document.createElement('div');
        p.className = 'confetti-particle';
        p.style.background = colors[i % colors.length];
        p.style.left = (Math.random() * 100) + 'vw';
        p.style.top = (50 + Math.random() * 20) + 'vh';
        p.style.animationDuration = (0.8 + Math.random() * 0.5) + 's';
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1500);
      }, i * 30);
    }

    setTimeout(() => openDailyAchievementCard(), 1500);
  }

  function saveDailyDiary() {
    const input = document.getElementById('dailyDiaryInput');
    if (input) {
      localStorage.setItem('daily_diary_' + today(), JSON.stringify(input.value));
      showToast('✅ 日记已保存！');
      closeAllPanels();
    }
  }

  function deleteHabit(habitId) {
    if (!confirm('确定要删除这个习惯吗？打卡记录会保留。')) return;
    habitsConfig = habitsConfig.filter(h => h.id !== habitId);
    saveConfig();
    showToast('已删除习惯');
    render();
  }

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
      timePeriod: lib.timePeriod || 'daytime',
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

  function toggleHabitFromLib(id) {
    const existing = habitsConfig.find(h => h.id === id);
    if (existing) {
      // 已添加，执行删除
      if (!confirm('确定要删除这个习惯吗？打卡记录会保留。')) return;
      const idx = habitsConfig.findIndex(h => h.id === id);
      if (idx >= 0) {
        habitsConfig.splice(idx, 1);
        saveConfig();
        showToast('已删除习惯');
      }
    } else {
      // 未添加，执行添加
      addHabitFromLib(id);
      return; // addHabitFromLib 内部已调用 renderLibraryPanel
    }
    // 重新渲染习惯库
    renderLibraryPanel((document.querySelector('.lib-search') && document.querySelector('.lib-search').value) || '');
    render();
  }

  function addCustomHabit() {
    const name = document.getElementById('customHabitName').value.trim();
    const icon = document.getElementById('customHabitIcon').value || '✅';
    const typeBtn = document.querySelector('#customTypeSelector button.active');
    const type = typeBtn ? typeBtn.dataset.type : 'boolean';
    const unit = (document.getElementById('customHabitUnit') && document.getElementById('customHabitUnit').value).trim() || (type === 'count' ? '个' : type === 'timer' ? '分钟' : '');
    const timeEl = document.getElementById('customHabitTime');
    const time = timeEl ? timeEl.value : '08:00';
    // 收集选中的星期
    const activeDays = document.querySelectorAll('#customWeekdays button.active');
    const repeat = [];
    activeDays.forEach(btn => repeat.push(parseInt(btn.dataset.day)));
    const repeatDays = repeat.length > 0 ? repeat : [0,1,2,3,4,5,6];
    // 收集额外提醒时间
    const reminderInputs = document.querySelectorAll('#customRemindersList input[type="time"]');
    const extraReminders = [];
    reminderInputs.forEach(inp => {
      if (inp.value) extraReminders.push(inp.value);
    });
    // 备注说明
    const noteEl = document.getElementById('customHabitNote');
    const note = noteEl ? noteEl.value.trim() : '';

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
      timePeriod: 'daytime',
      type,
      unit,
      repeat: repeatDays,
      note: note,
      extraReminders: extraReminders,
      reminder: {enabled:true, time, days:repeatDays, method:'in-app'}
    });
    saveConfig();
    showToast(`${icon} ${name} 已添加`);
    renderLibraryPanel('');
    render();
  }

  function addCustomReminderTime() {
    const list = document.getElementById('customRemindersList');
    if (!list) return;
    const count = list.children.length;
    if (count >= 5) { showToast('最多添加5个额外提醒'); return; }
    const div = document.createElement('div');
    div.className = 'lib-custom-reminder-item';
    div.innerHTML = `<input type="time" value="12:00"><span class="reminder-remove" onclick="this.parentElement.remove()">✕</span>`;
    list.appendChild(div);
  }

  function selectCustomType(btn) {
    document.querySelectorAll('#customTypeSelector button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const type = btn.dataset.type;
    document.getElementById('customUnitWrap').style.display = (type === 'boolean') ? 'none' : 'block';
  }

  function toggleCustomWeekday(btn) {
    btn.classList.toggle('active');
  }

  function selectCustomIcon(el, icon) {
    document.querySelectorAll('#customIconGrid span').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('customIconPreview').textContent = icon;
    document.getElementById('customHabitIcon').value = icon;
  }

  function filterLibCategory(cat, tabBtn) {
    // 切换标签 active 状态
    document.querySelectorAll('#libTabs .lib-tab').forEach(t => t.classList.remove('active'));
    if (tabBtn) tabBtn.classList.add('active');
    // 隐藏所有网格，只显示对应分类
    document.querySelectorAll('.lib-grid').forEach(g => g.style.display = 'none');
    const grid = document.getElementById('libGrid_' + cat);
    if (grid) grid.style.display = 'grid';
  }

  function toggleNeijingMaster() {
    const body = document.getElementById('neijingPackBody');
    const arrow = document.getElementById('neijingMasterArrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function toggleNeijingSub(subId) {
    const body = document.getElementById('neijingSubBody_' + subId);
    const arrow = document.getElementById('neijingSubArrow_' + subId);
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function toggleSeasonPack(season) {
    const body = document.getElementById('seasonPackBody_' + season);
    const arrow = document.querySelector('#seasonPack_' + season + ' .season-pack-arrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function toggleHealthPack() {
    const body = document.getElementById('healthPackBody');
    const arrow = document.querySelector('.health-pack-arrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
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

  function toggleHabitEnabled(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    h.enabled = h.enabled === false ? true : false;
    const enabled = h.enabled !== false;
    // 立即更新开关视觉状态，避免等待重渲染
    const toggleEl = document.querySelector(`.mg-item-toggle[onclick*="${habitId}"]`);
    if (toggleEl) {
      if (enabled) toggleEl.classList.add('on');
      else toggleEl.classList.remove('on');
    }
    // 异步保存配置
    setTimeout(() => saveConfig(), 0);
    // 重新渲染管理页和打卡页
    renderManage();
    renderCheckin();
  }

  function quickAddWater(habitId, amount) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const rec = checkinRecords[today()] || {};
    const waterRec = rec[habitId] || {value: 0, cups: []};
    waterRec.value = (waterRec.value || 0) + amount;
    waterRec.cups = waterRec.cups || [];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    waterRec.cups.push({time: timeStr, amount});
    waterRec.done = waterRec.value >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000);
    rec[habitId] = waterRec;
    checkinRecords[today()] = rec;
    saveRecords();
    if (waterRec.done) {
      playSound('checkin');
      checkLevelUp();
    }
    render();
    showToast(`💧 +${amount}ml，已喝 ${waterRec.value}ml`);
  }

  function quickAddWaterFromPanel(amount) {
    if (!pendingCheckinHabitId) return;
    quickAddWater(pendingCheckinHabitId, amount);
    closeAllPanels();
  }

  function confirmWaterInput() {
    const field = document.getElementById('waterCustomAmount');
    const val = parseInt(field.value);
    if (isNaN(val) || val <= 0) {
      showToast('请输入有效的数值');
      return;
    }
    if (!pendingCheckinHabitId) return;
    quickAddWater(pendingCheckinHabitId, val);
    closeAllPanels();
  }

  function initTouchSwipe() {
    let startX = 0, startY = 0;
    document.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, {passive: true});
    document.addEventListener('touchend', function(e) {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
        const checkinSec = document.getElementById('sec-checkin');
        if (checkinSec && checkinSec.classList.contains('active')) {
          swipeDate(dx > 0 ? -1 : 1);
        }
      }
    }, {passive: true});
  }

  function exportCSV() {
    const dates = Object.keys(checkinRecords).sort();
    if (dates.length === 0) {
      showToast('暂无数据可导出');
      return;
    }

    const headers = ['日期', ...habitsConfig.map(h => h.name)];
    const rows = [headers.join(',')];

    dates.forEach(date => {
      const rec = checkinRecords[date];
      const row = [date];
      habitsConfig.forEach(h => {
        if (rec && rec[h.id] && rec[h.id].done) {
          if (h.type === 'water') {
            row.push(rec[h.id].value + 'ml');
          } else {
            row.push(h.type === 'boolean' ? '✓' : rec[h.id].value);
          }
        } else {
          row.push('');
        }
      });
      rows.push(row.join(','));
    });

    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `习惯打卡_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV已导出');
  }

  function toggleReminderEnabled() {
    const el = document.getElementById('reminderToggle');
    el.classList.toggle('on');
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  App.UI.Events = {
    switchTab,
    handleCheckin,
    confirmCheckinInput,
    checkLevelUp,
    skipHabit,
    doRetroactiveCheckin,
    animateCheckin,
    showAllDoneCelebration,
    saveDailyDiary,
    deleteHabit,
    addHabitFromLib,
    toggleHabitFromLib,
    addCustomHabit,
    addCustomReminderTime,
    selectCustomType,
    toggleCustomWeekday,
    selectCustomIcon,
    filterLibCategory,
    toggleNeijingMaster,
    toggleNeijingSub,
    toggleHealthPack,
    toggleSeasonPack,
    addHealthPack,
    addSeasonalPack,
    toggleHabitEnabled,
    quickAddWater,
    quickAddWaterFromPanel,
    confirmWaterInput,
    initTouchSwipe,
    exportCSV,
    toggleReminderEnabled
  };
})();
