(function() {
  let pendingCheckinHabitId = null;
  Object.defineProperty(window, 'pendingCheckinHabitId', {
    get: () => pendingCheckinHabitId,
    set: (val) => { pendingCheckinHabitId = val; },
    configurable: true,
    enumerable: true
  });
  let pendingTimeHabitId = null;

  function openPanel(id) {
    const overlay = document.getElementById('panelOverlay');
    if (overlay) overlay.classList.add('show');
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.add('show');
    document.body.style.overflow = 'hidden';
    attachPanelGesture(panel);
  }

  function closeAllPanels() {
    const overlay = document.getElementById('panelOverlay');
    if (overlay) overlay.classList.remove('show');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
    document.body.style.overflow = '';
    pendingCheckinHabitId = null;
    pendingTimeHabitId = null;
  }

  function attachPanelGesture(panel) {
    if (panel._gestureAttached) return;
    panel._gestureAttached = true;

    let startY = 0, startX = 0, currentY = 0;

    const onTouchStart = e => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      currentY = startY;
      panel.style.transition = 'none';
    };

    const onTouchMove = e => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      const deltaX = Math.abs(e.touches[0].clientX - startX);
      if (deltaY > 0 && deltaY > deltaX) {
        panel.style.transform = `translateY(${deltaY}px)`;
      }
    };

    const onTouchEnd = () => {
      const deltaY = currentY - startY;
      panel.style.transition = 'transform .25s ease';
      if (deltaY > 100) {
        panel.style.transform = `translateY(100%)`;
        setTimeout(() => {
          closeAllPanels();
          panel.style.transform = '';
        }, 250);
      } else {
        panel.style.transform = '';
      }
      startY = 0;
    };

    panel.addEventListener('touchstart', onTouchStart, { passive: true });
    panel.addEventListener('touchmove', onTouchMove, { passive: true });
    panel.addEventListener('touchend', onTouchEnd);

    // 存储清理函数，避免内存泄漏
    panel._gestureCleanup = () => {
      panel.removeEventListener('touchstart', onTouchStart);
      panel.removeEventListener('touchmove', onTouchMove);
      panel.removeEventListener('touchend', onTouchEnd);
      panel._gestureAttached = false;
      panel._gestureCleanup = null;
    };
  }

  function openLibraryPanel() {
    renderLibraryPanel('');
    openPanel('libraryPanel');
  }

  function renderLibraryPanel(search) {
    const body = document.getElementById('libraryPanelBody');
    if (!body) return;
    const myIds = new Set(habitsConfig.map(h => h.id));
    const q = search.toLowerCase();

    let html = `<input class="lib-search" placeholder="搜索习惯..." value="${search}" oninput="renderLibraryPanel(this.value)">`;

    // 收集所有分类及其习惯
    const categories = ['sport','diet','study','sleep','mind','protect','care','home','social','hobby','quit'];
    const catData = [];
    categories.forEach(cat => {
      let items = HABIT_LIBRARY.filter(h => h.category === cat);
      if (q) items = items.filter(h => h.name.toLowerCase().includes(q));
      if (items.length > 0) catData.push({cat, info: CATEGORY_MAP[cat], items});
    });

    // 横向分类标签栏
    if (catData.length > 0) {
      html += `<div class="lib-tabs" id="libTabs">`;
      catData.forEach((cd, idx) => {
        html += `<button class="lib-tab ${idx === 0 ? 'active' : ''}" data-cat="${cd.cat}" onclick="filterLibCategory('${cd.cat}', this)">${cd.info.emoji} ${cd.info.label}</button>`;
      });
      html += `</div>`;
    }

    // 网格卡片区域
    catData.forEach((cd, idx) => {
      html += `<div class="lib-grid" id="libGrid_${cd.cat}" style="${idx !== 0 ? 'display:none' : ''}">`;
      cd.items.forEach(h => {
        const added = myIds.has(h.id);
        html += `
          <div class="lib-card ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${h.id}')">
            <span class="lib-card-icon">${h.icon}</span>
            <span class="lib-card-name">${h.name}</span>
            ${h.tip ? `<span class="lib-card-tip">${h.tip}</span>` : ''}
            ${added ? '<span class="lib-card-added">✓ 已添加</span>' : ''}
          </div>`;
      });
      html += `</div>`;
    });

    // 健康生活建议包
    const packHabits = HEALTH_PACK.habits;
    const packAddedCount = packHabits.filter(ph => myIds.has(ph.id)).length;
    const packAllAdded = packAddedCount === packHabits.length;

    html += `
      <div class="health-pack" id="healthPack">
        <div class="health-pack-header" onclick="toggleHealthPack()">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span style="font-size:28px">💚</span>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--ink)">健康生活建议包</div>
              <div style="font-size:12px;color:var(--muted)">${HEALTH_PACK.description}</div>
            </div>
          </div>
          <span class="health-pack-arrow">▼</span>
        </div>
        <div class="health-pack-body" id="healthPackBody" style="display:none">
          <div class="health-pack-habits">`;
    packHabits.forEach(ph => {
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      const added = myIds.has(ph.id);
      html += `
            <div class="health-pack-habit ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${ph.id}')">
              <span>${lib ? lib.icon : '📌'}</span>
              <span>${lib ? lib.name : ph.id}</span>
              <span style="font-size:11px;color:var(--muted)">${ph.reminder.time}</span>
              ${added ? '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>' : '<span class="health-pack-add-btn">+</span>'}
            </div>`;
    });
    html += `
          </div>
        </div>
        <div class="health-pack-footer">
          <span style="font-size:13px;color:var(--muted)">${packAllAdded ? '✅ 已全部添加' : `已添加 ${packAddedCount}/${packHabits.length} 个习惯`}</span>
          <span class="health-pack-btn ${packAllAdded ? 'added' : ''}" onclick="addHealthPack()">${packAllAdded ? '已添加' : '一键添加'}</span>
        </div>
      </div>
    `;

    // ========== 黄帝内经养生包（顶层容器） ==========
    const currentSeason = getCurrentSeason();
    const seasonOrder = ['spring','summer','autumn','winter'];
    
    html += `
      <div class="neijing-pack" id="neijingPack">
        <div class="neijing-pack-master-header" onclick="toggleNeijingMaster()">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span class="neijing-pack-master-icon">🏛️</span>
            <div>
              <div class="neijing-pack-master-title">${NEIJING_PACK.name}</div>
              <div class="neijing-pack-master-desc">${NEIJING_PACK.description}</div>
            </div>
          </div>
          <span class="neijing-pack-master-arrow" id="neijingMasterArrow">▼</span>
        </div>
        <div class="neijing-pack-body" id="neijingPackBody" style="display:none">`;
    
    // ---- 子包1: 四季养生 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_seasonal">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('seasonal')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">🌿</span>
                <div>
                  <div style="font-size:14px;font-weight:700">四季养生</div>
                  <div style="font-size:11px;color:var(--muted)">《四气调神大论》春生夏长秋收冬藏</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_seasonal">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_seasonal" style="display:none">`;
    
    seasonOrder.forEach(key => {
      const pack = SEASONAL_PACKS[key];
      const isCurrent = key === currentSeason;
      const packAddedCount = pack.habits.filter(ph => myIds.has(ph.id)).length;
      const packAllAdded = packAddedCount === pack.habits.length;
      
      html += `
              <div class="season-pack-card ${isCurrent ? 'current' : 'other'}" id="seasonPack_${key}">
                <div class="season-pack-header" onclick="toggleSeasonPack('${key}')">
                  <span class="season-pack-icon">${pack.emoji}</span>
                  <div>
                    <div class="season-pack-title">${pack.name} ${isCurrent ? '<span style="font-size:11px;color:var(--accent);font-weight:600">当前季节</span>' : ''}</div>
                    <div class="season-pack-subtitle">重点：${pack.focus} · ${pack.habits.length}个习惯</div>
                  </div>
                  <span class="season-pack-arrow">▼</span>
                </div>
                <div class="season-pack-quote">${pack.quote}</div>
                <div class="season-pack-body" id="seasonPackBody_${key}" style="display:none">
                  <div class="season-pack-habits">`;
      pack.habits.forEach(ph => {
        const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
        const added = myIds.has(ph.id);
        html += `
                    <div class="season-pack-habit ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${ph.id}')">
                      <span>${lib ? lib.icon : '📌'}</span>
                      <span>${lib ? lib.name : ph.id}</span>
                      <span style="font-size:11px;color:var(--muted)">${ph.reminder.time}</span>
                      ${added ? '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>' : '<span class="season-pack-add-btn">+</span>'}
                    </div>`;
      });
      html += `
                  </div>
                </div>
                <div class="season-pack-footer">
                  <span class="season-pack-count">${packAllAdded ? '✅ 已全部添加' : `已添加 ${packAddedCount}/${pack.habits.length}`}</span>
                  <span class="season-pack-btn ${packAllAdded ? 'added' : ''}" onclick="event.stopPropagation();addSeasonalPack('${key}')">${packAllAdded ? '已添加' : '一键添加'}</span>
                </div>
              </div>`;
    });
    
    html += `
            </div>
          </div>`;
    
    // ---- 子包2: 五色饮食 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_wuse">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('wuse')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">🍽️</span>
                <div>
                  <div style="font-size:14px;font-weight:700">五色饮食</div>
                  <div style="font-size:11px;color:var(--muted)">《藏气法时论》五色入五脏，饮食有节</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_wuse">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_wuse" style="display:none">
              <div class="wuse-grid">`;
    
    NEIJING_PACK.subPacks.find(sp => sp.id === 'wuse').content.forEach(wc => {
      const habitsHtml = wc.habits.map(hid => {
        const lib = HABIT_LIBRARY.find(h => h.id === hid);
        return lib ? `<span style="cursor:pointer;color:var(--accent);font-weight:600" onclick="addHabitFromLib('${hid}')">${lib.icon} ${lib.name}</span>` : '';
      }).join(' · ');
      html += `
                <div class="wuse-card">
                  <div class="wuse-card-icon">${wc.emoji}</div>
                  <div class="wuse-card-title">${wc.color}色入${wc.organ} · 味${wc.flavor}</div>
                  <div class="wuse-card-effect">${wc.effect}</div>
                  <div class="wuse-card-foods"><strong>宜食：</strong>${wc.foods}</div>
                  <div class="wuse-card-tip">${wc.tip}</div>
                  <div class="wuse-card-habits">${habitsHtml}</div>
                </div>`;
    });
    
    html += `
              </div>
            </div>
          </div>`;
    
    // ---- 子包3: 情志养生 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_emotion">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('emotion')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">🧘</span>
                <div>
                  <div style="font-size:14px;font-weight:700">情志养生</div>
                  <div style="font-size:11px;color:var(--muted)">《阴阳应象大论》五志相胜，以情胜情</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_emotion">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_emotion" style="display:none">
              <div class="emotion-mini-grid">`;
    
    EMOTION_DATA.forEach(emo => {
      html += `
                <div class="emotion-mini-card" onclick="openEmotionPanel();setTimeout(()=>selectEmotion('${emo.id}'),400)">
                  <div class="emotion-mini-emoji">${emo.emoji}</div>
                  <div class="emotion-mini-name">${emo.name}</div>
                  <div class="emotion-mini-relation">伤${emo.organ} · ${emo.cureEmoji}${emo.cure}胜</div>
                </div>`;
    });
    
    html += `
              </div>
              <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--accent);cursor:pointer;font-weight:600" onclick="openEmotionPanel()">📋 进入情志管理 →</div>
            </div>
          </div>`;
    
    // ---- 子包4: 五劳防护 ----
    html += `
          <div class="neijing-sub-pack" id="neijingSub_wulao">
            <div class="neijing-sub-pack-header" onclick="toggleNeijingSub('wulao')">
              <div style="display:flex;align-items:center;gap:8px;flex:1">
                <span style="font-size:22px">💪</span>
                <div>
                  <div style="font-size:14px;font-weight:700">五劳防护</div>
                  <div style="font-size:11px;color:var(--muted)">《宣明五气篇》五劳所伤，日常防护</div>
                </div>
              </div>
              <span class="neijing-sub-arrow" id="neijingSubArrow_wulao">▼</span>
            </div>
            <div class="neijing-sub-body" id="neijingSubBody_wulao" style="display:none">`;
    
    WULAO_DATA.forEach(wl => {
      html += `
              <div class="wulao-mini-card">
                <div class="wulao-mini-icon">${wl.emoji}</div>
                <div class="wulao-mini-info">
                  <div class="wulao-mini-name">${wl.name} · 伤${wl.organ}</div>
                  <div class="wulao-mini-scene">💼 ${wl.scene}</div>
                  <div class="wulao-mini-action">✅ ${wl.action}：${wl.tip}</div>
                </div>
              </div>`;
    });
    
    html += `
              <div style="text-align:center;margin-top:8px;font-size:12px;color:var(--accent);cursor:pointer;font-weight:600" onclick="openWulaoPanel()">📋 查看五劳详情 →</div>
            </div>
          </div>`;
    
    // 关闭黄帝内经包
    html += `
        </div>
      </div>`;

    // 自定义习惯输入区（放在最后）
    html += `
      <div class="lib-custom">
        <div class="lib-custom-title">✨ 自定义习惯</div>
        <div class="lib-custom-input">
          <input id="customHabitName" placeholder="习惯名称" maxlength="20">
          <button onclick="addCustomHabit()">添加</button>
        </div>
        <div class="lib-custom-type" id="customTypeSelector">
          <button class="active" data-type="boolean" onclick="selectCustomType(this)">打卡</button>
          <button data-type="count" onclick="selectCustomType(this)">计数</button>
          <button data-type="timer" onclick="selectCustomType(this)">计时</button>
        </div>
        <div id="customUnitWrap" style="display:none;margin-top:8px">
          <input id="customHabitUnit" placeholder="单位（如：杯、个、分钟）" style="width:100%;padding:10px 14px;border:2px solid var(--rule);border-radius:12px;font-size:14px;background:#fff;outline:none">
        </div>
        <div class="lib-custom-time">
          <label>⏰ 打卡时间</label>
          <input type="time" id="customHabitTime" value="08:00">
        </div>
        <div class="lib-custom-reminders" id="customRemindersWrap">
          <div class="lib-custom-reminders-label">🔔 额外提醒</div>
          <div class="lib-custom-reminders-list" id="customRemindersList"></div>
          <button class="lib-custom-reminder-add" onclick="addCustomReminderTime()">+ 添加提醒</button>
        </div>
        <div class="lib-custom-freq">
          <div class="lib-custom-freq-label">📅 每周频率</div>
          <div class="weekdays" id="customWeekdays">
            ${['日','一','二','三','四','五','六'].map((d,i) => `<button class="active" data-day="${i}" onclick="toggleCustomWeekday(this)">${d}</button>`).join('')}
          </div>
        </div>
        <div class="lib-custom-note">
          <label>📝 备注说明</label>
          <input id="customHabitNote" placeholder="习惯说明（选填）" maxlength="100">
        </div>
        <div class="lib-icon-picker">
          <div class="lib-icon-picker-label">🎨 选择图标 <span id="customIconPreview" class="selected-icon">✅</span></div>
          <div class="preset-icons" id="customIconGrid">
            ${CUSTOM_ICONS.map(ic => `<span data-icon="${ic}" onclick="selectCustomIcon(this, '${ic}')" class="${ic === '✅' ? 'selected' : ''}">${ic}</span>`).join('')}
          </div>
          <input type="hidden" id="customHabitIcon" value="✅">
        </div>
      </div>`;

    body.innerHTML = html;
  }

  function openReportPanel() {
    const body = document.getElementById('reportPanelBody');
    const d = new Date();
    const dow = d.getDay();
    const mondayOffset = dow === 0 ? 6 : dow - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - mondayOffset);

    let totalDone = 0, totalAll = 0;
    const habitStats = {};

    habitsConfig.forEach(h => {
      habitStats[h.id] = {done: 0, total: 7, name: h.name, icon: h.icon};
    });

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const key = formatDate(day);
      const rec = checkinRecords[key] || {};
      habitsConfig.forEach(h => {
        totalAll++;
        if (rec[h.id] && rec[h.id].done) {
          totalDone++;
          habitStats[h.id].done++;
        }
      });
    }

    const weekRate = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

    let best = null, worst = null;
    habitsConfig.forEach(h => {
      const s = habitStats[h.id];
      if (!best || s.done > best.done) best = s;
      if (!worst || s.done < worst.done) worst = s;
    });

    body.innerHTML = `
      <div class="report-card">
        <div class="report-title">📊 本周总结</div>
        <div class="report-stat">
          <div><div class="report-stat-val">${weekRate}%</div><div class="report-stat-label">完成率</div></div>
          <div><div class="report-stat-val">${totalDone}</div><div class="report-stat-label">总打卡</div></div>
          <div><div class="report-stat-val">${totalAll}</div><div class="report-stat-label">总任务</div></div>
        </div>
        ${best ? `<div class="report-item"><span class="emoji">🌟</span><span class="text">最佳习惯：${best.icon} ${best.name}（完成${best.done}天）</span></div>` : ''}
        ${worst && worst.done < 7 ? `<div class="report-item"><span class="emoji">💪</span><span class="text">需加油：${worst.icon} ${worst.name}（完成${worst.done}天）</span></div>` : ''}
      </div>
      <div style="font-size:13px;color:var(--muted);text-align:center;margin-top:8px">继续保持，下周会更好！</div>
    `;
    openPanel('reportPanel');
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

  function openRefPanel(e) {
    if (e) e.stopPropagation();
    renderRefPanel();
    openPanel('refPanel');
  }

  function renderRefPanel() {
    const body = document.getElementById('refPanelBody');
    const ancient = REF_BOOKS.filter(b => b.type === 'ancient');
    const modern = REF_BOOKS.filter(b => b.type === 'modern');

    let html = `
      <div class="ref-panel-header">
        <h3>📚 18部养生经典</h3>
        <p>汇集先秦至现代养生著作，点击查看详情</p>
      </div>
      <div class="ref-tabs">
        <div class="ref-tab active" id="refTabAncient" onclick="switchRefTab('ancient')">🏛️ 经典古籍（${ancient.length}部）</div>
        <div class="ref-tab" id="refTabModern" onclick="switchRefTab('modern')">📖 现代著作（${modern.length}部）</div>
      </div>
      <div id="refListAncient">`;

    ancient.forEach(b => {
      html += `<a class="ref-card" href="${b.url}" target="_blank" rel="noopener">
        <div class="ref-icon ancient">${b.emoji}</div>
        <div class="ref-info">
          <div class="ref-name">${b.name}</div>
          <div class="ref-author">${b.author} · ${b.desc}</div>
        </div>
        <div class="ref-arrow">›</div>
      </a>`;
    });

    html += `</div><div id="refListModern" style="display:none">`;
    modern.forEach(b => {
      html += `<a class="ref-card" href="${b.url}" target="_blank" rel="noopener">
        <div class="ref-icon modern">${b.emoji}</div>
        <div class="ref-info">
          <div class="ref-name">${b.name}</div>
          <div class="ref-author">${b.author} · ${b.desc}</div>
        </div>
        <div class="ref-arrow">›</div>
      </a>`;
    });

    html += `</div><a class="ref-lib-btn" href="https://rui66648.github.io/lifestyle-assistant/养生参考文献文库/index.html" target="_blank" rel="noopener">📖 进入参考文献文库</a>`;

    body.innerHTML = html;
  }

  function switchRefTab(tab) {
    document.getElementById('refTabAncient').classList.toggle('active', tab === 'ancient');
    document.getElementById('refTabModern').classList.toggle('active', tab === 'modern');
    document.getElementById('refListAncient').style.display = tab === 'ancient' ? '' : 'none';
    document.getElementById('refListModern').style.display = tab === 'modern' ? '' : 'none';
  }

  function openEmotionPanel() {
    renderEmotionPanel();
    openPanel('emotionPanel');
  }

  function renderEmotionPanel() {
    const body = document.getElementById('emotionPanelBody');
    const todayRec = checkinRecords[today()] || {};
    const emotionRec = todayRec['emotion_check'];
    let selected = null;
    if (emotionRec && emotionRec.value) {
      const map = {'怒':'anger','喜':'joy','思':'thinking','悲':'sorrow','恐':'fear'};
      selected = EMOTION_DATA.find(e => e.id === map[emotionRec.value]);
    }

    let html = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;text-align:center">《素问·阴阳应象大论》：怒伤肝，悲胜怒；喜伤心，恐胜喜...</div>
      <div class="emotion-grid">
    `;

    EMOTION_DATA.forEach(emo => {
      const isSel = selected && selected.id === emo.id;
      html += `<div class="emotion-btn ${isSel ? 'active' : ''}" onclick="selectEmotion('${emo.id}')">
        <span class="emo-icon">${emo.emoji}</span>
        <span class="emo-label">${emo.name}</span>
      </div>`;
    });

    html += '</div>';

    if (selected) {
      html += `
        <div class="emotion-current">
          <div class="emo">${selected.emoji}</div>
          <div class="emo-name">今日情绪：${selected.name}</div>
          <div class="emo-organ">伤及脏腑：${selected.organ} · 气机变化：${selected.damage}</div>
          <div class="emo-quote">"${selected.quote}"</div>
        </div>
        <div class="emotion-cure">
          <div class="cure-title">💡 调节建议（情志相胜）</div>
          <div class="cure-text">
            <strong>方法：</strong>以${selected.cureEmoji}${selected.cure}胜${selected.name}<br>
            <strong>实践：</strong>${selected.cureDesc}<br>
            <strong>原文：</strong>《素问·阴阳应象大论》"${selected.quote}"
          </div>
        </div>
      `;
    } else {
      html += `<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px">👆 点击上方情绪图标记录今日心情</div>`;
    }

    body.innerHTML = html;
  }

  function selectEmotion(emotionId) {
    const emo = EMOTION_DATA.find(e => e.id === emotionId);
    if (!emo) return;
    const todayStr = today();
    if (!checkinRecords[todayStr]) checkinRecords[todayStr] = {};
    checkinRecords[todayStr]['emotion_check'] = {value: emo.name, timestamp: Date.now()};
    saveRecords();
    renderEmotionPanel();
    render();
  }

  function openClockPanel() {
    const body = document.getElementById('clockPanelBody');
    const current = getCurrentShichen();

    let html = '<div style="padding:10px 0">';
    html += '<div style="text-align:center;margin-bottom:16px">';
    html += '<div style="font-size:32px;margin-bottom:4px">' + current.icon + '</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--ink)">' + current.name + ' · ' + current.meridian + '</div>';
    html += '<div style="font-size:13px;color:var(--accent);font-weight:600;margin-top:4px">' + current.action + '</div>';
    html += '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + current.detail + '</div>';
    html += '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    BODY_CLOCK.forEach(function(sc) {
      var isActive = sc.id === current.id;
      var endLabel = sc.end === 0 ? 24 : sc.end;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:' + (isActive ? 'var(--accent-light)' : 'var(--bg2)') + ';border:2px solid ' + (isActive ? 'var(--accent)' : 'transparent') + '">';
      html += '<div style="width:36px;text-align:center;font-size:20px">' + sc.icon + '</div>';
      html += '<div style="flex:1">';
      html += '<div style="font-size:13px;font-weight:700;color:' + (isActive ? 'var(--accent)' : 'var(--ink)') + '">' + sc.name + ' ' + sc.start + '-' + endLabel + '时 · ' + sc.meridian + '</div>';
      html += '<div style="font-size:11px;color:var(--muted)">' + sc.action + '</div>';
      html += '</div>';
      if (isActive) html += '<div style="font-size:11px;font-weight:700;background:var(--accent);color:#fff;padding:2px 8px;border-radius:8px">当前</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:12px">依据《黄帝内经》子午流注理论 · 十二时辰养生</div>';
    html += '</div>';

    body.innerHTML = html;
    openPanel('clockPanel');
  }

  function openWulaoPanel() {
    renderWulaoPanel();
    openPanel('wulaoPanel');
  }

  function openDietPanel() {
    const body = document.getElementById('dietPanelBody');
    if (body && App.Modules.Diet) {
      body.innerHTML = App.Modules.Diet.renderDietPanel();
    }
    openPanel('dietPanel');
  }

  /* ========== 皮肤面板 ========== */
  const SKIN_CATEGORIES = [
    {
      id: 'theme',
      label: '主题',
      emoji: '🎨',
      items: [
        { id:'default', name:'竹青', emoji:'🌿', vars:{accent:'#5BB98A',accent2:'#FF9F67','accent-light':'#D4F0E4','accent2-light':'#FFE2CC',bg:'#FFFCF7',bg2:'#F7F3ED'} },
        { id:'ocean', name:'海蓝', emoji:'🌊', vars:{accent:'#4A90D9',accent2:'#48C9B0','accent-light':'#D6EAF8','accent2-light':'#D1F2EB',bg:'#F5F9FC',bg2:'#EBF2F8'} },
        { id:'rose', name:'桃粉', emoji:'🌸', vars:{accent:'#E07B8C',accent2:'#D4A0B5','accent-light':'#FADBD8','accent2-light':'#F5EEF8',bg:'#FFF5F7',bg2:'#FEF0F3'} },
        { id:'sunset', name:'暖橘', emoji:'🌅', vars:{accent:'#E8913A',accent2:'#E05A4B','accent-light':'#FDEBD0','accent2-light':'#FADBD8',bg:'#FFFBF5',bg2:'#FFF3E6'} },
        { id:'modern', name:'现代简约', emoji:'✨', vars:{accent:'#10B981',accent2:'#F59E0B','accent-light':'#D1FAE5','accent2-light':'#FEF3C7',bg:'#F8FAFC',bg2:'#F1F5F9'} },
      ]
    },
    {
      id: 'button',
      label: '按钮',
      emoji: '🔘',
      items: [
        { id:'btn-default', name:'圆角渐变', emoji:'🟢', style:{'btn-style':'default'} },
        { id:'btn-pill', name:'胶囊', emoji:'💊', style:{'btn-style':'pill'} },
        { id:'btn-3d', name:'3D立体', emoji:'📦', style:{'btn-style':'3d'} },
        { id:'btn-aurora', name:'🌌 极光Aurora', emoji:'🌌', style:{'btn-style':'aurora'} },
        { id:'btn-neu', name:'🎯 拟态Neumorphic', emoji:'🎯', style:{'btn-style':'neu'} },
        { id:'btn-minimal', name:'📏 极简Minimal', emoji:'📏', style:{'btn-style':'minimal'} },
      ]
    },
    {
      id: 'checkbox',
      label: '复选框',
      emoji: '☑️',
      items: [
        { id:'cb-default', name:'圆角', emoji:'✅', style:{'cb-style':'default'} },
        { id:'cb-round', name:'圆形', emoji:'⭕', style:{'cb-style':'round'} },
        { id:'cb-aurora', name:'🌌 极光Aurora', emoji:'🌌', style:{'cb-style':'aurora'} },
        { id:'cb-neu', name:'🎯 拟态Neumorphic', emoji:'🎯', style:{'cb-style':'neu'} },
        { id:'cb-minimal', name:'📏 极简Minimal', emoji:'📏', style:{'cb-style':'minimal'} },
      ]
    },
    {
      id: 'toggle',
      label: '开关',
      emoji: '🎚️',
      items: [
        { id:'tg-default', name:'标准', emoji:'🔘', style:{'tg-style':'default'} },
        { id:'tg-daynight', name:'日夜切换', emoji:'🌓', style:{'tg-style':'daynight'} },
        { id:'tg-aurora', name:'🌌 极光Aurora', emoji:'🌌', style:{'tg-style':'aurora'} },
        { id:'tg-neu', name:'🎯 拟态Neumorphic', emoji:'🎯', style:{'tg-style':'neu'} },
        { id:'tg-minimal', name:'📏 极简Minimal', emoji:'📏', style:{'tg-style':'minimal'} },
      ]
    },
    {
      id: 'card',
      label: '卡片',
      emoji: '🃏',
      items: [
        { id:'cd-glass', name:'毛玻璃', emoji:'✨', style:{'cd-style':'glass'} },
        { id:'cd-gradient', name:'渐变边框', emoji:'🌈', style:{'cd-style':'gradient'} },
        { id:'cd-aurora', name:'🌌 极光Aurora', emoji:'🌌', style:{'cd-style':'aurora'} },
        { id:'cd-neu', name:'🎯 拟态Neumorphic', emoji:'🎯', style:{'cd-style':'neu'} },
        { id:'cd-minimal', name:'📏 极简Minimal', emoji:'📏', style:{'cd-style':'minimal'} },
      ]
    },
    {
      id: 'input',
      label: '输入框',
      emoji: '📝',
      items: [
        { id:'in-glass', name:'毛玻璃', emoji:'✨', style:{'in-style':'glass'} },
        { id:'in-underline', name:'下划线', emoji:'📏', style:{'in-style':'underline'} },
        { id:'in-aurora', name:'🌌 极光Aurora', emoji:'🌌', style:{'in-style':'aurora'} },
        { id:'in-neu', name:'🎯 拟态Neumorphic', emoji:'🎯', style:{'in-style':'neu'} },
        { id:'in-minimal', name:'📏 极简Minimal', emoji:'◻️', style:{'in-style':'minimal'} },
      ]
    },
    {
      id: 'badge',
      label: '徽章',
      emoji: '🏷️',
      items: [
        { id:'bd-pill', name:'药丸', emoji:'💊', style:{'bd-style':'pill'} },
        { id:'bd-gradient', name:'渐变', emoji:'🌈', style:{'bd-style':'gradient'} },
        { id:'bd-aurora', name:'🌌 极光Aurora', emoji:'🌌', style:{'bd-style':'aurora'} },
        { id:'bd-neu', name:'🎯 拟态Neumorphic', emoji:'🎯', style:{'bd-style':'neu'} },
        { id:'bd-minimal', name:'📏 极简Minimal', emoji:'📏', style:{'bd-style':'minimal'} },
      ]
    },
  ];

  // 默认皮肤样式（用于重置）
  const SKIN_DEFAULTS = {
    'btn-radius': '14px',
    'btn-shadow': '0 2px 8px rgba(0,0,0,.08)',
    'cb-radius': '4px',
    'cb-border': '2px solid var(--accent)',
    'rb-radius': '50%',
    'rb-border': '2px solid var(--rule)',
    'rb-dot-size': '12px',
    'rb-size': '22px',
  };

  /**
   * 初始化所有皮肤设置（主题 + 组件样式）
   * 应在页面启动时调用
   */
  function initAllSkins() {
    const root = document.documentElement;
    const body = document.body;
    const prefixesToClear = ['btn-', 'cb-', 'tg-', 'cd-', 'in-', 'bd-'];
    prefixesToClear.forEach(prefix => {
      [...body.classList].forEach(cls => {
        if (cls.startsWith(prefix)) body.classList.remove(cls);
      });
    });
    const skinId = getCurrentSkin();
    applySkin(skinId);
    SKIN_CATEGORIES.forEach(cat => {
      if (cat.id === 'theme') return;
      const saved = localStorage.getItem('skin_' + cat.id);
      const defaultItem = cat.items[0];
      const item = saved ? cat.items.find(i => i.id === saved) || defaultItem : defaultItem;
      if (item && item.style) {
        for (const [key, val] of Object.entries(item.style)) {
          if (key.endsWith('-style')) {
            const prefix = key.replace('-style', '');
            body.classList.add(prefix + '-' + val);
          } else {
            root.style.setProperty('--' + key, val);
          }
        }
      }
    });
  }

  // 扁平化所有皮肤项（主题类），供 applySkin 查找
  const SKINS = SKIN_CATEGORIES.find(c => c.id === 'theme').items;

  function getCurrentSkin() {
    const saved = localStorage.getItem('app_skin');
    return saved || 'default';
  }

  function applySkin(skinId) {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin) return;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(skin.vars)) {
      root.style.setProperty('--' + key, val);
    }
    localStorage.setItem('app_skin', skinId);
    // 现代简约主题添加 body class
    document.body.classList.toggle('theme-modern', skinId === 'modern');
    // 更新选中态
    document.querySelectorAll('.skin-toggle-row').forEach(el => {
      el.classList.toggle('active', el.querySelector('input')?.checked);
    });
  }

  function applyComponentStyle(catId, itemId) {
    const cat = SKIN_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item) return;
    const root = document.documentElement;
    const body = document.body;
    const prefixMap = {
      button: 'btn-',
      checkbox: 'cb-',
      toggle: 'tg-',
      card: 'cd-',
      input: 'in-',
      badge: 'bd-'
    };
    const prefix = prefixMap[catId];
    if (prefix) {
      [...body.classList].forEach(cls => {
        if (cls.startsWith(prefix)) body.classList.remove(cls);
      });
    }
    for (const [key, val] of Object.entries(item.style || {})) {
      if (key.endsWith('-style') && prefix) {
        body.classList.add(prefix + val);
      } else {
        root.style.setProperty('--' + key, val);
      }
    }
    localStorage.setItem('skin_' + catId, itemId);
    document.querySelectorAll('.skin-toggle-row').forEach(el => {
      const input = el.querySelector('input');
      if (input && input.name === 'skin_' + catId) {
        el.classList.toggle('active', input.checked);
      }
    });
    if (typeof renderLevelCard === 'function') renderLevelCard();
  }

  function getCurrentComponentStyle(catId) {
    const saved = localStorage.getItem('skin_' + catId);
    const cat = SKIN_CATEGORIES.find(c => c.id === catId);
    if (!cat) return null;
    const def = cat.items[0];
    return saved ? (cat.items.find(i => i.id === saved) || def) : def;
  }

  let currentSkinTab = 'theme';

  function openSkinPanel() {
    const panel = document.getElementById('skinPanel');
    if (panel) {
      const body = panel.querySelector('.panel-body');
      if (body) {
        renderSkinPanel(body);
      }
    }
    openPanel('skinPanel');
  }

  function renderSkinPanel(body) {
    const cat = SKIN_CATEGORIES.find(c => c.id === currentSkinTab);
    if (!cat) return;

    let html = `
      <div style="font-size:16px;font-weight:700;margin-bottom:16px;text-align:center">🎨 皮肤设置</div>
      <div class="skin-tabs">`;
    SKIN_CATEGORIES.forEach((c, idx) => {
      html += `<button class="skin-tab ${c.id === currentSkinTab ? 'active' : ''}" onclick="App.UI.Panels.switchSkinTab('${c.id}')">${c.emoji} ${c.label}</button>`;
    });
    html += `</div>
      <div class="skin-toggle-list" id="skinCat_${cat.id}">`;

    if (cat.id === 'theme') {
      const current = getCurrentSkin();
      cat.items.forEach(s => {
        const isActive = s.id === current;
        html += `
          <div class="skin-toggle-row ${isActive ? 'active' : ''}">
            <div class="skin-toggle-info">
              <div class="skin-toggle-preview" style="background:linear-gradient(135deg,${s.vars.accent},${s.vars.accent2})">
                <div class="skin-toggle-swatch" style="background:${s.vars.bg}"></div>
              </div>
              <span class="skin-toggle-name">${s.emoji} ${s.name}</span>
            </div>
            <label class="theme-toggle" for="skinToggle_${s.id}">
              <input class="theme-checkbox" type="radio" name="skin_theme" id="skinToggle_${s.id}" ${isActive ? 'checked' : ''} onchange="App.UI.Panels.selectSkin('${s.id}')">
              <span class="theme-slider"></span>
            </label>
          </div>`;
      });
    } else {
      const currentItem = getCurrentComponentStyle(cat.id);
      cat.items.forEach(s => {
        const isActive = currentItem && currentItem.id === s.id;
        html += `
          <div class="skin-toggle-row ${isActive ? 'active' : ''}">
            <div class="skin-toggle-info">
              <span class="skin-toggle-name">${s.emoji} ${s.name}</span>
            </div>
            <label class="theme-toggle" for="skinComp_${s.id}">
              <input class="theme-checkbox" type="radio" name="skin_${cat.id}" id="skinComp_${s.id}" ${isActive ? 'checked' : ''} onchange="App.UI.Panels.selectComponentStyle('${cat.id}','${s.id}')">
              <span class="theme-slider"></span>
            </label>
          </div>`;
      });
    }

    html += `</div>`;
    body.innerHTML = html;
  }

  function switchSkinTab(tabId) {
    currentSkinTab = tabId;
    const body = document.getElementById('skinPanel').querySelector('.panel-body');
    if (body) renderSkinPanel(body);
  }

  function selectSkin(skinId) {
    applySkin(skinId);
    if (typeof renderLevelCard === 'function') renderLevelCard();
  }

  function selectComponentStyle(catId, itemId) {
    applyComponentStyle(catId, itemId);
  }

  function toggleGroup(period) {
    const group = document.getElementById('group-' + period);
    if (!group) return;
    group.classList.toggle('collapsed-group');
    const cards = group.querySelectorAll('.habit-card, .water-tracker');
    cards.forEach(card => {
      if (card.classList.contains('collapsed')) {
        card.classList.remove('collapsed');
      } else {
        card.classList.add('collapsed');
      }
    });
  }

  function renderWulaoPanel() {
    const body = document.getElementById('wulaoPanelBody');

    let html = `
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px;text-align:center">《素问·宣明五气篇》：久视伤血，久卧伤气，久坐伤肉，久立伤骨，久行伤筋</div>
    `;

    WULAO_DATA.forEach(wl => {
      html += `
        <div class="wulao-card">
          <div class="wl-icon">${wl.emoji}</div>
          <div class="wl-info">
            <div class="wl-name">${wl.name} · 伤${wl.organ}</div>
            <div class="wl-scene">💼 现代场景：${wl.scene}</div>
            <div class="wl-action">✅ 防护动作：${wl.action}</div>
            <div class="wl-tip">💡 ${wl.tip}</div>
          </div>
        </div>
      `;
    });

    html += `<div style="margin-top:14px;font-size:12px;color:var(--muted);text-align:center">依据《黄帝内经》五劳所伤理论 · 日常防护</div>`;
    body.innerHTML = html;
  }

  function openHealthReportPanel() {
    renderHealthReport();
    openPanel('healthReportPanel');
  }

  function renderHealthReport() {
    const body = document.getElementById('healthReportPanelBody');
    let html = '<div style="padding:10px 0">';
    html += '<div style="text-align:center;margin-bottom:16px"><div style="font-size:28px;margin-bottom:8px">📋</div><div style="font-size:20px;font-weight:800">健康报告</div></div>';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:10px">选择报告类型</div>';
    html += `<div style="display:flex;gap:10px;margin-bottom:20px">
      <button class="const-btn" style="flex:1" onclick="App.UI.Render.openStatsDetailPanel();setTimeout(()=>App.UI.Render.switchStatsPeriod('month',document.querySelector('.sd-tab[data-period=month]')),100)">📅 月度报告</button>
      <button class="const-btn" style="flex:1" onclick="App.UI.Render.openStatsDetailPanel();setTimeout(()=>App.UI.Render.switchStatsPeriod('year',document.querySelector('.sd-tab[data-period=year]')),100)">📆 年度报告</button>
    </div>`;
    html += '</div>';
    body.innerHTML = html;
  }

  function openDataPanel() {
    openPanel('dataPanel');
  }

  function openRetroactivePanel(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    pendingCheckinHabitId = habitId;
    const body = document.getElementById('retroactivePanelBody');
    const dates = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDate(d);
      const dayNames = ['日','一','二','三','四','五','六'];
      const label = i === 1 ? '昨天' : i === 2 ? '前天' : `${i}天前（周${dayNames[d.getDay()]}）`;
      const rec = checkinRecords[key] || {};
      const done = rec[habitId] && rec[habitId].done;
      dates.push({key, label, done, date: d});
    }

    body.innerHTML = `<div style="font-size:14px;font-weight:700;margin-bottom:12px">${h.icon} ${h.name} · 补签</div>` +
      dates.map(d => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--rule)">
          <div>
            <div style="font-size:14px;font-weight:600">${d.label}</div>
            <div style="font-size:12px;color:var(--muted)">${d.key}</div>
          </div>
          <button onclick="doRetroactiveCheckin('${habitId}','${d.key}',${d.done ? 'true' : 'false'})" class="const-btn" style="margin:0;padding:6px 14px;font-size:12px;${d.done ? 'background:var(--muted)' : ''}">
            ${d.done ? '✓ 已签' : '补签'}
          </button>
        </div>
      `).join('');
    openPanel('retroactivePanel');
  }

  function openDailyAchievementCard() {
    const key = today();
    const diary = JSON.parse(localStorage.getItem('daily_diary_' + key) || '""');
    const done = getTodayDone();
    const total = getTodayTotal();

    const body = document.getElementById('achievementPanelBody');
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:48px;margin-bottom:8px">🏆</div>
        <div style="font-size:20px;font-weight:800;color:var(--accent)">今日全部完成！</div>
        <div style="font-size:14px;color:var(--muted)">${done}/${total} 个习惯 · ${key}</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px">📝 今日感想</div>
        <textarea id="dailyDiaryInput" placeholder="记录今天的感受..." style="width:100%;height:80px;border:1px solid var(--rule);border-radius:10px;padding:12px;font-size:14px;resize:none;background:var(--bg);font-family:inherit;line-height:1.6">${diary || ''}</textarea>
      </div>
      <button class="const-btn" onclick="saveDailyDiary()" style="width:100%">💾 保存感想</button>
    `;
    openPanel('achievementPanel');
  }

  function openReminderPanel() {
    const body = document.getElementById('reminderPanelBody');
    const methods = [
      {value:'in-app', label:'应用内横幅', desc:'在应用内显示提醒横幅'},
      {value:'notification', label:'浏览器通知', desc:'通过浏览器推送通知提醒'},
      {value:'off', label:'关闭提醒', desc:'不接收任何提醒'}
    ];

    let currentMethod = 'in-app';
    if (habitsConfig.length > 0 && habitsConfig[0].reminder) {
      currentMethod = habitsConfig[0].reminder.method || 'in-app';
    }

    body.innerHTML = `
      <div style="margin-bottom:16px;font-size:13px;color:var(--muted)">选择提醒方式（将应用到所有习惯）</div>
      ${methods.map(m => `
        <div class="reminder-option" onclick="setGlobalReminder('${m.value}')">
          <div class="radio ${currentMethod === m.value ? 'active' : ''}"></div>
          <div>
            <div class="label">${m.label}</div>
            <div class="desc">${m.desc}</div>
          </div>
        </div>
      `).join('')}
    `;
    openPanel('reminderPanel');
  }

  function setGlobalReminder(method) {
    habitsConfig.forEach(h => {
      if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'};
      h.reminder.method = method;
      if (method !== 'off') h.reminder.enabled = true;
      else h.reminder.enabled = false;
    });
    saveConfig();
    closeAllPanels();
    showToast('提醒设置已更新');
    render();
  }

  function openTimePanel(habitId) {
    pendingTimeHabitId = habitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;

    if (h.type === 'water') {
      openWaterSettingsPanel(habitId);
      return;
    }

    const r = h.reminder || {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'};

    document.getElementById('timePanelTitle').textContent = `${h.icon} ${h.name} 提醒设置`;
    const body = document.getElementById('timePanelBody');
    body.innerHTML = `
      <div class="toggle-row">
        <span class="toggle-label">开启提醒</span>
        <div class="toggle-switch ${r.enabled ? 'on' : ''}" id="reminderToggle" onclick="toggleReminderEnabledPanel()"></div>
      </div>
      <div class="time-picker-wrap">
        <label>提醒时间</label>
        <input type="time" id="reminderTimeInput" value="${r.time}">
      </div>
      <div style="margin-top:16px;font-size:13px;color:var(--muted);margin-bottom:8px">重复日期</div>
      <div class="days-selector" id="daysSelector">
        ${DAY_NAMES.map((name, i) => `
          <button class="day-btn ${r.days.includes(i) ? 'active' : ''}" data-day="${i}" onclick="toggleDay(this, ${i})">${name}</button>
        `).join('')}
      </div>
      <button class="export-btn" style="margin-top:20px;background:var(--accent);color:#fff" onclick="saveTimeSettings()">保存设置</button>
    `;
    openPanel('timePanel');
  }

  function toggleReminderEnabledPanel() {
    const el = document.getElementById('reminderToggle');
    if (el) el.classList.toggle('on');
  }

  function toggleDay(btn, day) {
    btn.classList.toggle('active');
  }

  function saveTimeSettings() {
    const h = habitsConfig.find(x => x.id === pendingTimeHabitId);
    if (!h) return;
    const enabled = document.getElementById('reminderToggle').classList.contains('on');
    const time = document.getElementById('reminderTimeInput').value;
    const days = [];
    document.querySelectorAll('#daysSelector .day-btn.active').forEach(btn => {
      days.push(parseInt(btn.dataset.day));
    });

    h.reminder = {
      enabled,
      time: time || '08:00',
      days: days.length > 0 ? days : [0,1,2,3,4,5,6],
      method: h.reminder ? h.reminder.method : 'in-app'
    };
    saveConfig();
    closeAllPanels();
    showToast('提醒时间已保存');
    render();
  }

  function toggleRepeat(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const current = h.repeat || [0,1,2,3,4,5,6];
    if (current.length === 7) {
      h.repeat = [1,2,3,4,5];
      showToast(`${h.icon} ${h.name}：改为工作日打卡`);
    } else if (current.length === 5 && !current.includes(0) && !current.includes(6)) {
      h.repeat = [0,6];
      showToast(`${h.icon} ${h.name}：改为周末打卡`);
    } else {
      h.repeat = [0,1,2,3,4,5,6];
      showToast(`${h.icon} ${h.name}：改为每天打卡`);
    }
    saveConfig();
    renderCheckin();
  }

  function openWaterInputPanel(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    pendingCheckinHabitId = habitId;
    const wc = h.waterConfig || {perCup:250, dailyGoal:2000};
    const perCup = wc.perCup || 250;

    const quickAmounts = [perCup, perCup * 2, perCup / 2];

    let html = `<div class="water-input-panel">
      <div class="water-amount-display">
        <div class="water-quick-row">`;
    quickAmounts.forEach(amt => {
      html += `<button class="water-quick-btn" onclick="quickAddWaterFromPanel(${amt})">+${amt}ml</button>`;
    });
    html += `</div>
        <div class="water-custom-input">
          <input type="number" id="waterCustomAmount" placeholder="自定义" min="10" step="10">
          <div class="checkin-input-unit">ml</div>
        </div>
        <div class="checkin-input-actions">
          <button class="cancel" onclick="closeAllPanels()">取消</button>
          <button class="confirm" onclick="confirmWaterInput()">确认记录</button>
        </div>
      </div>
    </div>`;
    openPanel('checkinPanel');
    setTimeout(() => {
      const field = document.getElementById('waterCustomAmount');
      if (field) field.focus();
    }, 300);
  }

  function openWaterWeekPanel(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    const wc = h.waterConfig || {dailyGoal:2000};
    const goal = wc.dailyGoal || 2000;
    const todayD = new Date();

    let html = '<div style="padding:10px 0">';
    html += `<div style="text-align:center;margin-bottom:16px"><div style="font-size:18px;font-weight:700">📊 本周饮水</div><div style="font-size:12px;color:var(--muted);margin-top:4px">目标：${goal}ml/天</div></div>`;

    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayD);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const dayRec = checkinRecords[ds] || {};
      const waterRec = dayRec[habitId] || {};
      const val = waterRec.value || 0;
      const dayPct = Math.min(100, Math.round((val / goal) * 100));
      const isToday = i === 0;
      const dayName = ['日','一','二','三','四','五','六'][d.getDay()];

      html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px;background:${isToday ? 'var(--accent-light)' : 'var(--bg2)'};border-radius:12px">
        <div style="width:40px;text-align:center">
          <div style="font-size:12px;font-weight:700;color:var(--ink)">${dayName}</div>
          <div style="font-size:10px;color:var(--muted)">${d.getMonth()+1}/${d.getDate()}</div>
        </div>
        <div style="flex:1">
          <div style="height:20px;background:var(--bg);border-radius:10px;overflow:hidden;position:relative">
            <div style="height:100%;width:${dayPct}%;background:${dayPct >= 100 ? 'var(--accent)' : dayPct >= 50 ? '#7CB69D' : '#F4A683'};border-radius:10px;transition:width .5s"></div>
            <div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:var(--ink)">${val}ml (${dayPct}%)</div>
          </div>
        </div>
        <div style="font-size:16px">${dayPct >= 100 ? '✅' : dayPct > 0 ? '💧' : '⭕'}</div>
      </div>`;
    }

    html += '</div>';
    document.getElementById('checkinPanelTitle').textContent = '💧 饮水周统计';
    document.getElementById('checkinPanelBody').innerHTML = html;
    openPanel('checkinPanel');
  }

  function openWaterSettingsPanel(habitId) {
    pendingCheckinHabitId = habitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const wc = h.waterConfig || {dailyGoal:2000, perCup:250, schedule:[]};
    const body = document.getElementById('checkinPanelBody');
    document.getElementById('checkinPanelTitle').textContent = '💧 饮水设置';

    let html = `<div style="padding:10px 0">`;
    html += `<div style="font-size:14px;color:var(--muted);margin-bottom:12px">为「${h.name}」设置饮水计划</div>`;

    html += `<div style="margin-bottom:16px">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:6px">每日目标 (ml)</label>
      <input type="number" id="waterDailyGoal" value="${wc.dailyGoal || 2000}" min="500" max="5000" step="100" style="width:100%;padding:12px;border:2px solid var(--rule);border-radius:12px;font-size:16px;background:#fff;outline:none">
    </div>`;

    html += `<div style="margin-bottom:16px">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:6px">每杯容量 (ml)</label>
      <input type="number" id="waterPerCup" value="${wc.perCup || 250}" min="50" max="1000" step="50" style="width:100%;padding:12px;border:2px solid var(--rule);border-radius:12px;font-size:16px;background:#fff;outline:none">
    </div>`;

    html += `<div style="margin-bottom:16px">
      <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:6px">饮水时间表</label>
      <div id="waterScheduleList" style="display:flex;flex-direction:column;gap:6px">`;
    const schedule = wc.schedule || [];
    schedule.forEach((s, idx) => {
      html += `<div class="water-schedule-row" data-idx="${idx}" style="display:flex;gap:6px;align-items:center">
        <input type="time" class="ws-time" value="${s.time}" style="flex:1;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
        <input type="text" class="ws-label" value="${s.label}" placeholder="标签" style="flex:2;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
        <input type="number" class="ws-amount" value="${s.amount}" min="50" max="1000" step="50" placeholder="ml" style="width:70px;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
        <button onclick="removeWaterScheduleRow(${idx})" style="width:32px;height:32px;border-radius:8px;background:var(--bg2);color:#e74c3c;font-size:16px;border:none;cursor:pointer">✕</button>
      </div>`;
    });
    html += `</div>`;
    html += `<button onclick="addWaterScheduleRow()" style="width:100%;padding:8px;margin-top:6px;border-radius:8px;background:var(--bg2);color:var(--accent);font-size:13px;font-weight:600;border:none;cursor:pointer">+ 添加时间点</button>`;
    html += `</div>`;

    html += `<div style="display:flex;gap:10px;margin-top:20px">
      <button class="checkin-btn pending" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:600" onclick="closeAllPanels()">取消</button>
      <button class="checkin-btn done" style="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:600" onclick="saveWaterSettings()">保存</button>
    </div>`;

    html += `</div>`;

    body.innerHTML = html;
    openPanel('checkinPanel');
  }

  function addWaterScheduleRow() {
    const list = document.getElementById('waterScheduleList');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.className = 'water-schedule-row';
    div.dataset.idx = idx;
    div.style.cssText = 'display:flex;gap:6px;align-items:center';
    div.innerHTML = `<input type="time" class="ws-time" value="08:00" style="flex:1;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
      <input type="text" class="ws-label" value="" placeholder="标签" style="flex:2;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
      <input type="number" class="ws-amount" value="250" min="50" max="1000" step="50" placeholder="ml" style="width:70px;padding:8px;border:2px solid var(--rule);border-radius:8px;font-size:14px;background:#fff;outline:none">
      <button onclick="this.parentElement.remove()" style="width:32px;height:32px;border-radius:8px;background:var(--bg2);color:#e74c3c;font-size:16px;border:none;cursor:pointer">✕</button>`;
    list.appendChild(div);
  }

  function removeWaterScheduleRow(idx) {
    const row = document.querySelector(`.water-schedule-row[data-idx="${idx}"]`);
    if (row) row.remove();
  }

  function saveWaterSettings() {
    const h = habitsConfig.find(x => x.id === pendingCheckinHabitId);
    if (!h) return;
    const goal = parseInt(document.getElementById('waterDailyGoal').value) || 2000;
    const perCup = parseInt(document.getElementById('waterPerCup').value) || 250;
    const rows = document.querySelectorAll('.water-schedule-row');
    const schedule = [];
    rows.forEach(row => {
      const time = row.querySelector('.ws-time').value;
      const label = row.querySelector('.ws-label').value;
      const amount = parseInt(row.querySelector('.ws-amount').value) || 250;
      if (time) schedule.push({time, label: label || '喝水', amount});
    });
    schedule.sort((a, b) => a.time.localeCompare(b.time));
    h.waterConfig = {dailyGoal: goal, perCup, schedule};
    saveConfig();
    showToast('饮水设置已保存');
    closeAllPanels();
    render();
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  App.UI.Panels = {
    openPanel,
    closeAllPanels,
    attachPanelGesture,
    openLibraryPanel,
    renderLibraryPanel,
    openReportPanel,
    getPomoTotalStats,
    openRefPanel,
    renderRefPanel,
    switchRefTab,
    openEmotionPanel,
    renderEmotionPanel,
    selectEmotion,
    openClockPanel,
    openWulaoPanel,
    openDietPanel,
    toggleGroup,
    renderWulaoPanel,
    openSkinPanel,
    switchSkinTab,
    selectSkin,
    selectComponentStyle,
    initAllSkins,
    openHealthReportPanel,
    renderHealthReport,
    openDataPanel,
    openRetroactivePanel,
    openDailyAchievementCard,
    openReminderPanel,
    setGlobalReminder,
    openTimePanel,
    toggleReminderEnabledPanel,
    toggleDay,
    saveTimeSettings,
    toggleRepeat,
    openWaterInputPanel,
    openWaterWeekPanel,
    openWaterSettingsPanel,
    addWaterScheduleRow,
    removeWaterScheduleRow,
    saveWaterSettings
  };

  if (App.registerModule) {
    App.registerModule('ui.panels', 'ui', null);
  }
})();
