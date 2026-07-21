(function() {
  // 安全引用积分规则常量（防止 utils.js 加载失败导致整个 events.js 崩溃）
  function getCheckinReward() {
    try { return App.Core.Utils.checkinReward || { perHabit: 1, allDoneBonus: 5 }; }
    catch(e) { return { perHabit: 1, allDoneBonus: 5 }; }
  }

  function switchTab(tab) {
    if (currentTab === tab) return;
    currentTab = tab;
    if (typeof closeAllPanels === 'function') closeAllPanels();
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.bnav-center').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const targetSection = document.getElementById('sec-' + tab);
    if (targetSection) targetSection.classList.add('active');
    const todayCard = document.getElementById('todayCard');
    if (todayCard) todayCard.style.display = (tab === 'profile' || tab === 'ai' || tab === 'pomodoro') ? 'none' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'profile') renderProfile();
    else if (tab === 'manage') renderManage();
    else if (tab === 'checkin') renderCheckin();
    else if (tab === 'ai') { LazyLoad('js/modules/ai.js', function() { renderAiPage(); }); }
    else if (tab === 'pomodoro') { LazyLoad('js/modules/pomodoro.js', function() { renderPomodoroPage(); }); }
  }

  function handleNavClick(el) {
    const tab = el.dataset.tab;
    if (tab) switchTab(tab);
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
        showToast(`✅ ${esc(h.icon)} 今天没${esc(h.name)}，继续保持！`);
        playSound('checkin');
      } else if (rec[habitId] && rec[habitId].done) {
        rec[habitId] = {done: false, failed: true, value: 0};
        showToast(`❌ 今天${esc(h.name)}了，明天加油`);
      } else {
        rec[habitId] = {done: true, failed: false, value: 1};
        const reward = getCheckinReward();
        const pts = App.Core.Utils.addPoints(reward.perHabit, `${esc(h.name)} 克制成功`);
        showToast(`✅ ${esc(h.icon)} 今天没${esc(h.name)}，继续保持！+${reward.perHabit}积分 (总:${pts})`);
        playSound('checkin');
        checkLevelUp();
      }
      checkinRecords[today()] = rec;
      saveRecords();
      animateCheckin(habitId);
      render(['today','checkin']);
      return;
    }

    if (h.type === 'boolean') {
      if (rec[habitId] && rec[habitId].done) {
        delete rec[habitId];
        showToast('已撤销打卡');
      } else {
        rec[habitId] = {done: true, value: 1, lastInterval: Date.now()};
        // 打卡积分奖励
        const reward1 = getCheckinReward();
        const pts = App.Core.Utils.addPoints(reward1.perHabit, `${esc(h.name)} 打卡`);
        showToast(`${esc(h.icon)} ${esc(h.name)} 打卡成功！+${reward1.perHabit}积分 (总:${pts})`);
        playSound('checkin');
        animateCheckin(habitId);
        checkLevelUp();
      }
      checkinRecords[today()] = rec;
      saveRecords();
      render(['today','checkin']);
    } else {
      pendingCheckinHabitId = habitId;
      const titleEl = document.getElementById('checkinPanelTitle');
      const labelEl = document.getElementById('checkinInputLabel');
      const unitEl = document.getElementById('checkinInputUnit');
      const field = document.getElementById('checkinInputField');
      if (titleEl) titleEl.textContent = `${esc(h.icon)} ${esc(h.name)}`;
      if (labelEl) labelEl.textContent = h.type === 'count' ? '请输入数量' : '请输入时长';
      if (unitEl) unitEl.textContent = h.unit;
      if (field) {
        field.value = (rec[habitId] && rec[habitId].done) ? rec[habitId].value : '';
        field.placeholder = h.type === 'count' ? '0' : '0';
      }
      openPanel('checkinPanel');
      if (field) setTimeout(() => field.focus(), 300);
    }
  }

  function confirmCheckinInput() {
    const field = document.getElementById('checkinInputField');
    if (!field) return;
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
      rec[habitId] = {done: true, value: val, lastInterval: Date.now()};
      // 打卡积分奖励
      const reward2 = getCheckinReward();
      const pts = App.Core.Utils.addPoints(reward2.perHabit, `${esc(h.name)} 记录`);
      showToast(`${esc(h.icon)} ${esc(h.name)} 记录 ${val}${esc(h.unit)}！+${reward2.perHabit}积分 (总:${pts})`);
      playSound('checkin');
      checkLevelUp();
    }
    checkinRecords[today()] = rec;
    saveRecords();
    closeAllPanels();
    render(['today','checkin']);
  }

  function checkLevelUp() {
    const oldLevel = parseInt(localStorage.getItem('user_level') || '1');
    const newLevel = getCurrentLevel().level;
    if (newLevel > oldLevel) {
      localStorage.setItem('user_level', String(newLevel));
      const lv = LEVELS.find(l => l.level === newLevel);
      playSound('unlock');
      showToast(`🎉 升级！获得「${esc(lv.icon)} ${esc(lv.name)}」称号！`);
    }
    const done = getTodayDone();
    const total = getTodayTotal();
    if (done === total && total > 0) {
      // 检查全部完成额外积分奖励
      const bonusKey = 'all_done_bonus_' + today();
      if (localStorage.getItem(bonusKey) !== 'true') {
        localStorage.setItem(bonusKey, 'true');
        const reward3 = getCheckinReward();
        const newTotal = App.Core.Utils.addPoints(reward3.allDoneBonus, '完成所有任务额外奖励');
        showToast(`🎉 全部完成！获得 +${reward3.allDoneBonus} 额外积分！当前积分：${newTotal}`);
      }
      setTimeout(() => {
        playSound('complete');
        if (App.UI.Render && App.UI.Render.showCelebration) App.UI.Render.showCelebration();
        else showAllDoneCelebration();
      }, 300);
    }
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
    // 事务性清理：先清打卡记录再删习惯，任一步失败则回滚
    const cleaned = App.Core.Storage.purgeHabitRecords(habitId);
    habitsConfig = habitsConfig.filter(h => h.id !== habitId);
    saveConfig();
    showToast(cleaned > 0 ? `已删除习惯并清理 ${cleaned} 天打卡记录` : '已删除习惯');
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
      tip: lib.tip || '',
      reminder: {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast', sound:true, vibrate:true}
    };
    // 使用库中的默认提醒配置（如果有）
    if (lib.defaultReminder) {
      newHabit.reminder = {
        enabled: lib.defaultReminder.enabled || false,
        time: lib.defaultReminder.time || '08:00',
        days: lib.defaultReminder.days || [0,1,2,3,4,5,6],
        method: lib.defaultReminder.method || 'toast',
        sound: lib.defaultReminder.sound !== false,
        vibrate: lib.defaultReminder.vibrate !== false
      };
    }
    if (lib.type === 'water' && lib.waterConfig) {
      newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
    }
    if (lib.intervalReminder) {
      newHabit.intervalReminder = JSON.parse(JSON.stringify(lib.intervalReminder));
    }
    habitsConfig.push(newHabit);
    saveConfig();
    showToast(`${esc(lib.icon)} ${esc(lib.name)} 已添加`);
    // 只更新卡片状态，不重新渲染整个面板
    updateLibCardState(id, true);
    // 只渲染 manage 和 checkin
    render(['manage', 'checkin']);
  }

  function toggleHabitFromLib(id) {
    const existing = habitsConfig.find(h => h.id === id);
    if (existing) {
      // 已添加，执行删除（同时清理打卡记录）
      if (!confirm('确定要删除这个习惯吗？相关打卡记录将一并清理。')) return;
      const idx = habitsConfig.findIndex(h => h.id === id);
      if (idx >= 0) {
        const cleaned = App.Core.Storage.purgeHabitRecords(id);
        habitsConfig.splice(idx, 1);
        saveConfig();
        showToast(cleaned > 0 ? `已删除习惯并清理 ${cleaned} 天打卡记录` : '已删除习惯');
        // 只更新卡片状态
        updateLibCardState(id, false);
        render(['manage', 'checkin']);
      }
    } else {
      // 未添加，执行添加
      addHabitFromLib(id);
      return; // addHabitFromLib 内部已处理
    }
  }

  function toggleCustomForm() {
    const form = document.getElementById('libCustomForm');
    if (!form) return;
    const shown = form.style.display === 'block';
    form.style.display = shown ? 'none' : 'block';
    // 滚动到表单区域
    if (!shown) {
      setTimeout(() => form.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
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
    // 关闭自定义习惯面板（如果打开）
    const customPanel = document.getElementById('customHabitPanel');
    if (customPanel) customPanel.classList.remove('show');
    // 只渲染 manage 和 checkin
    render(['manage', 'checkin']);
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
        timePeriod: lib.timePeriod || 'daytime',
        type: lib.type,
        unit: lib.unit,
        repeat: [0,1,2,3,4,5,6],
        tip: lib.tip || '',
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
      if (lib.intervalReminder) {
        newHabit.intervalReminder = JSON.parse(JSON.stringify(lib.intervalReminder));
      }

      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });

    if (addedCount > 0) {
      saveConfig();
      showToast(`💚 健康生活建议包：已添加 ${addedCount} 个习惯`);
      // 批量更新卡片状态
      packHabitIds.forEach(id => updateLibCardState(id, true));
      render(['manage', 'checkin']);
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
        timePeriod: lib.timePeriod || 'daytime',
        type: lib.type,
        unit: lib.unit,
        repeat: [0,1,2,3,4,5,6],
        tip: lib.tip || '',
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
      if (lib.intervalReminder) {
        newHabit.intervalReminder = JSON.parse(JSON.stringify(lib.intervalReminder));
      }

      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });

    if (addedCount > 0) {
      saveConfig();
      showToast(`${pack.emoji} ${esc(pack.name)}：已添加 ${addedCount} 个习惯`);
      // 批量更新卡片状态
      pack.habits.forEach(ph => {
        if (!myIds.has(ph.id)) updateLibCardState(ph.id, true);
      });
      render(['manage', 'checkin']);
    } else {
      showToast(`${esc(pack.name)}中的习惯已全部添加`);
    }
  }

  function togglePackMarket() {
    const body = document.getElementById('packMarketBody');
    const arrow = document.getElementById('packMarketArrow');
    if (!body || !arrow) return;
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.style.transform = 'rotate(180deg)';
    } else {
      body.style.display = 'none';
      arrow.style.transform = 'rotate(0deg)';
    }
  }

  function addPackById(packId) {
    const packMarket = PACK_MARKET || [];
    const packInfo = packMarket.find(p => p.id === packId);
    if (!packInfo) return;

    const pack = packInfo.pack;
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
        timePeriod: lib.timePeriod || 'daytime',
        type: lib.type,
        unit: lib.unit,
        repeat: [0,1,2,3,4,5,6],
        tip: lib.tip || '',
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
      if (lib.intervalReminder) {
        newHabit.intervalReminder = JSON.parse(JSON.stringify(lib.intervalReminder));
      }

      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });
    
    if (addedCount > 0) {
      saveConfig();
      showToast(`${packInfo.emoji} ${esc(packInfo.name)}：已添加 ${addedCount} 个习惯`);
      pack.habits.forEach(ph => {
        updateLibCardState(ph.id, true);
      });
      render(['manage', 'checkin']);
    } else {
      showToast(`${esc(packInfo.name)}中的习惯已全部添加`);
    }
  }

  function exportMyHabitPack() {
    if (typeof App.Modules.PackMarket !== 'undefined' && App.Modules.PackMarket.exportCurrentHabitPack) {
      const json = App.Modules.PackMarket.exportCurrentHabitPack();
      if (json) {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '我的习惯包.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('📤 习惯包已导出');
      }
    }
  }

  function openPackImportPanel() {
    const html = `
      <div id="packImportPanel" class="panel-overlay" style="display:block">
        <div class="panel">
          <div class="panel-header">
            <div style="font-size:16px;font-weight:700">📥 导入习惯包</div>
            <button class="panel-close" onclick="closePackImportPanel()">×</button>
          </div>
          <div class="panel-body" style="padding:20px">
            <p style="font-size:13px;color:var(--muted);margin-bottom:16px">将好友分享的习惯包 JSON 文件导入到您的应用中</p>
            <input type="file" id="packImportFile" accept=".json" onchange="handlePackImportFile(this)" style="display:none">
            <button class="pack-import-btn" onclick="document.getElementById('packImportFile').click()" style="width:100%;padding:12px;font-size:14px;margin-bottom:12px">选择文件</button>
            <div style="border:2px dashed var(--rule);border-radius:12px;padding:32px;text-align:center" onclick="document.getElementById('packImportFile').click()">
              <div style="font-size:32px;margin-bottom:8px">📁</div>
              <div style="font-size:13px;color:var(--muted)">点击或拖拽文件到此处</div>
            </div>
            <div style="margin-top:16px">
              <textarea id="packImportText" placeholder="或粘贴习惯包 JSON 内容..." style="width:100%;height:120px;padding:12px;border:2px solid var(--rule);border-radius:12px;font-size:13px;font-family:monospace;resize:none;outline:none"></textarea>
              <button class="pack-import-btn" onclick="handlePackImportText()" style="width:100%;padding:10px;font-size:13px;margin-top:8px">导入</button>
            </div>
          </div>
        </div>
      </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closePackImportPanel() {
    const panel = document.getElementById('packImportPanel');
    if (panel) panel.remove();
  }

  function handlePackImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const json = e.target.result;
        const result = App.Modules.PackMarket.importHabitPack(json);
        if (result.success) {
          showToast(result.message);
          closePackImportPanel();
          render(['manage', 'checkin']);
        } else {
          showToast('❌ ' + result.message);
        }
      } catch(e) {
        showToast('❌ 文件解析失败');
      }
    };
    reader.readAsText(file);
  }

  function handlePackImportText() {
    const text = document.getElementById('packImportText').value.trim();
    if (!text) {
      showToast('请输入习惯包内容');
      return;
    }
    
    try {
      const result = App.Modules.PackMarket.importHabitPack(text);
      if (result.success) {
        showToast(result.message);
        closePackImportPanel();
        render(['manage', 'checkin']);
      } else {
        showToast('❌ ' + result.message);
      }
    } catch(e) {
      showToast('❌ JSON 格式错误');
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
      // 饮水目标达成积分奖励
      const wasDone = ((rec[habitId] && rec[habitId]._doneRewarded));
      if (!wasDone) {
        waterRec._doneRewarded = true;
        rec[habitId] = waterRec;
        const reward4 = getCheckinReward();
        const pts = App.Core.Utils.addPoints(reward4.perHabit, `${esc(h.name)} 目标达成`);
        showToast(`💧 今日饮水目标达成！+${reward4.perHabit}积分 (总:${pts})`);
      }
      playSound('checkin');
      checkLevelUp();
    }
    render();
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

  function toggleDarkMode(enable) {
    const icon = document.getElementById('themeIcon');
    const settingsCheckbox = document.getElementById('settingsThemeCheckbox');
    if (enable) {
      document.body.classList.add('dark');
      localStorage.setItem('dark_mode', 'true');
      if (icon) icon.textContent = '🌙';
      if (settingsCheckbox) settingsCheckbox.checked = true;
    } else {
      document.body.classList.remove('dark');
      localStorage.setItem('dark_mode', 'false');
      if (icon) icon.textContent = '☀️';
      if (settingsCheckbox) settingsCheckbox.checked = false;
    }
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  App.UI.Events = {
    switchTab,
    handleNavClick,
    handleCheckin,
    confirmCheckinInput,
    checkLevelUp,
    toggleDarkMode,
    doRetroactiveCheckin,
    animateCheckin,
    showAllDoneCelebration,
    saveDailyDiary,
    deleteHabit,
    addHabitFromLib,
    toggleHabitFromLib,
    toggleCustomForm,
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
    togglePackMarket,
    addPackById,
    exportMyHabitPack,
    openPackImportPanel,
    closePackImportPanel,
    handlePackImportFile,
    handlePackImportText,
    toggleHabitEnabled,
    quickAddWater,
    quickAddWaterFromPanel,
    confirmWaterInput,
    initTouchSwipe,
    exportCSV,
    toggleReminderEnabled
  };

  // 暴露到全局，供 HTML onclick 直接使用
  window.switchTab = switchTab;
  window.handleCheckin = handleCheckin;
  // 批量暴露其余函数
  Object.keys(App.UI.Events).forEach(function(k) {
    if (typeof App.UI.Events[k] === 'function' && !window[k]) window[k] = App.UI.Events[k];
  });

  if (App.registerModule) {
    App.registerModule('ui.events', 'ui', null);
  }
})();
