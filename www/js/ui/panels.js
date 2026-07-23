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
    // 注入皮肤目标类名到面板内的新元素
    if (typeof injectSkinTargetClasses === 'function') injectSkinTargetClasses();
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
    let _locked = false;      // 当前手势是否已锁定为"不关闭面板"

    // 检查触摸点是否在可滚动的 panel-body 内，且 body 还未滚动到顶部
    function shouldLockGesture(touchTarget, deltaY) {
      const body = panel.querySelector('.panel-body');
      if (!body) return false;
      // 触摸点不在 panel-body 内（如在 header 上）→ 允许关闭
      if (!body.contains(touchTarget)) return false;
      // panel-body 没有滚动条 → 允许关闭
      if (body.scrollHeight <= body.clientHeight) return false;
      // panel-body 已滚动过 → 锁定（用户还在滚动内容）
      if (body.scrollTop > 0) return true;
      // panel-body 在顶部且是向上滑 → 锁定（用户想继续滚动）
      if (deltaY < 0) return true;
      // panel-body 在顶部且是向下滑 → 允许关闭
      return false;
    }

    const onTouchStart = e => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      currentY = startY;
      _locked = false;
      panel.style.transition = 'none';
    };

    const onTouchMove = e => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      const deltaX = Math.abs(e.touches[0].clientX - startX);
      if (deltaY <= 0 || deltaY <= deltaX) return;

      // 首次检测到有效下滑时决定是否锁定
      if (!_locked) {
        _locked = shouldLockGesture(e.target, deltaY);
      }
      if (_locked) return;

      panel.style.transform = `translateX(-50%) translateY(${deltaY}px)`;
    };

    const onTouchEnd = () => {
      const deltaY = currentY - startY;
      panel.style.transition = 'transform .25s ease';
      if (!_locked && deltaY > 100) {
        panel.style.transform = 'translateX(-50%) translateY(100%)';
        setTimeout(() => {
          closeAllPanels();
          panel.style.transform = '';
        }, 250);
      } else {
        panel.style.transform = '';
      }
      startY = 0;
      _locked = false;
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

  // 局部更新单个习惯卡片状态，避免重新渲染整个面板
  function updateLibCardState(id, added) {
    // 更新分类卡片
    const cards = document.querySelectorAll(`.lib-card[onclick*="'${id}'"]`);
    cards.forEach(card => {
      if (added) {
        card.classList.add('added');
        const nameSpan = card.querySelector('.lib-card-name');
        if (nameSpan && !card.querySelector('.lib-card-added')) {
          card.insertAdjacentHTML('beforeend', '<span class="lib-card-added">✓ 已添加</span>');
        }
      } else {
        card.classList.remove('added');
        const addedSpan = card.querySelector('.lib-card-added');
        if (addedSpan) addedSpan.remove();
      }
    });
    // 更新健康包中的卡片
    const packCards = document.querySelectorAll(`.health-pack-habit[onclick*="'${id}'"]`);
    packCards.forEach(card => {
      if (added) {
        card.classList.add('added');
        const addBtn = card.querySelector('.health-pack-add-btn');
        if (addBtn) addBtn.remove();
        if (!card.querySelector('span[style*="color:var(--accent)"]')) {
          card.insertAdjacentHTML('beforeend', '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>');
        }
      } else {
        card.classList.remove('added');
      }
    });
    // 更新季节包中的卡片
    const seasonCards = document.querySelectorAll(`.season-pack-habit[onclick*="'${id}'"]`);
    seasonCards.forEach(card => {
      if (added) {
        card.classList.add('added');
        const addBtn = card.querySelector('.season-pack-add-btn');
        if (addBtn) addBtn.remove();
        if (!card.querySelector('span[style*="color:var(--accent)"]')) {
          card.insertAdjacentHTML('beforeend', '<span style="font-size:11px;color:var(--accent)">✓ 已添加</span>');
        }
      } else {
        card.classList.remove('added');
      }
    });
  }

  function renderLibraryPanel(search) {
    const body = document.getElementById('libraryPanelBody');
    if (!body) return;
    currentLibSearch = search || '';
    const myIds = new Set(habitsConfig.map(h => h.id));

    let html = `<div class="lib-search-row">
      <input class="lib-search" id="libSearchInput" placeholder="搜索习惯..." value="${esc(currentLibSearch)}">
      <button class="lib-search-btn" onclick="toggleCustomForm()">＋ 自定义</button>
    </div>
    <div id="libCustomForm" style="display:none">
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
            ${CUSTOM_ICONS.map(ic => `<span data-icon="${esc(ic)}" onclick="selectCustomIcon(this, '${esc(ic)}')" class="${ic === '✅' ? 'selected' : ''}">${esc(ic)}</span>`).join('')}
          </div>
          <input type="hidden" id="customHabitIcon" value="✅">
        </div>
      </div>
    </div>`;

    // 搜索结果区：仅此容器随输入刷新，搜索框/自定义表单/推荐包不再被重建
    html += `<div id="libResults"></div>`;

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
              <div class="neijing-pack-master-title">${esc(NEIJING_PACK.name)}</div>
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
                    <div class="season-pack-title">${esc(pack.name)} ${isCurrent ? '<span style="font-size:11px;color:var(--accent);font-weight:600">当前季节</span>' : ''}</div>
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
        return lib ? `<span style="cursor:pointer;color:var(--accent);font-weight:600" onclick="addHabitFromLib('${hid}')">${esc(lib.icon)} ${esc(lib.name)}</span>` : '';
      }).join(' · ');
      html += `
                <div class="wuse-card">
                  <div class="wuse-card-icon">${wc.emoji}</div>
                  <div class="wuse-card-title">${wc.color}色入${wc.organ} · 味${wc.flavor}</div>
                  <div class="wuse-card-effect">${wc.effect}</div>
                  <div class="wuse-card-foods"><strong>宜食：</strong>${wc.foods}</div>
                  <div class="wuse-card-tip">${esc(wc.tip)}</div>
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
                  <div class="emotion-mini-name">${esc(emo.name)}</div>
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
                  <div class="wulao-mini-name">${esc(wl.name)} · 伤${wl.organ}</div>
                  <div class="wulao-mini-scene">💼 ${wl.scene}</div>
                  <div class="wulao-mini-action">✅ ${wl.action}：${esc(wl.tip)}</div>
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

    // ========== 习惯包市场 ==========
    const packMarket = PACK_MARKET || [];
    
    html += `
      <div class="pack-market" id="packMarket">
        <div class="pack-market-header" onclick="togglePackMarket()">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span style="font-size:28px">📦</span>
            <div>
              <div style="font-size:16px;font-weight:700;color:var(--ink)">习惯包市场</div>
              <div style="font-size:12px;color:var(--muted)">精选体质调理、职场、学生、健身等场景包</div>
            </div>
          </div>
          <span class="pack-market-arrow" id="packMarketArrow">▼</span>
        </div>
        <div class="pack-market-body" id="packMarketBody" style="display:none">`;
    
    const packCategories = [
      { type: 'specialty', name: '场景专属', emoji: '🎯' },
      { type: 'constitution', name: '体质调理', emoji: '🧪' },
      { type: 'seasonal', name: '季节养生', emoji: '🍃' },
      { type: 'daily', name: '日常习惯', emoji: '📅' }
    ];
    
    packCategories.forEach(cat => {
      const packs = packMarket.filter(p => p.type === cat.type);
      if (packs.length === 0) return;
      
      html += `
          <div class="pack-market-category">
            <div class="pack-market-category-header">
              <span style="font-size:18px">${cat.emoji}</span>
              <span style="font-size:14px;font-weight:600">${cat.name}</span>
            </div>
            <div class="pack-market-grid">`;
      
      packs.forEach(pack => {
        const packHabits = pack.pack.habits || [];
        const packAddedCount = packHabits.filter(ph => myIds.has(ph.id)).length;
        const packAllAdded = packAddedCount === packHabits.length;
        
        html += `
                <div class="pack-card" id="packCard_${pack.id}">
                  <div class="pack-card-icon">${pack.emoji}</div>
                  <div class="pack-card-name">${esc(pack.name)}</div>
                  <div class="pack-card-desc">${esc(pack.desc)}</div>
                  <div class="pack-card-count">${packHabits.length}个习惯 · ${packAddedCount}/${packHabits.length}已添加</div>
                  <button class="pack-card-btn ${packAllAdded ? 'added' : ''}" onclick="addPackById('${pack.id}')">${packAllAdded ? '已添加' : '一键添加'}</button>
                </div>`;
      });
      
      html += `
            </div>
          </div>`;
    });
    
    html += `
          <div class="pack-market-export" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--rule)">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px">📤 导出我的习惯包</div>
            <p style="font-size:12px;color:var(--muted);margin-bottom:8px">将您当前的习惯配置导出分享给好友</p>
            <button class="pack-export-btn" onclick="exportMyHabitPack()">导出习惯包</button>
            <button class="pack-import-btn" onclick="openPackImportPanel()">导入习惯包</button>
          </div>
        </div>
      </div>`;

    body.innerHTML = html;
    renderLibraryResults(currentLibSearch);
    bindLibrarySearch();
  }

  // 当前搜索关键词（面板级，避免整面板重渲染时丢失）
  let currentLibSearch = '';

  // 仅刷新搜索结果区，搜索框/自定义表单/推荐包保持原 DOM，不重建
  function renderLibraryResults(search) {
    const container = document.getElementById('libResults');
    if (!container) return;
    const myIds = new Set(habitsConfig.map(h => h.id));
    const q = (search || '').toLowerCase();

    const categories = ['sport','diet','study','sleep','mind','protect','care','home','social','hobby','quit'];
    const catData = [];
    categories.forEach(cat => {
      let items = HABIT_LIBRARY.filter(h => h.category === cat);
      if (q) items = items.filter(h => h.name.toLowerCase().includes(q));
      if (items.length > 0) catData.push({cat, info: CATEGORY_MAP[cat], items});
    });

    let html = '';
    if (catData.length > 0) {
      html += `<div class="lib-tabs" id="libTabs">`;
      catData.forEach((cd, idx) => {
        html += `<button class="lib-tab ${idx === 0 ? 'active' : ''}" data-cat="${cd.cat}" onclick="filterLibCategory('${cd.cat}', this)">${cd.info.emoji} ${cd.info.label}</button>`;
      });
      html += `</div>`;
    } else if (q) {
      html += `<div class="lib-empty">😶 没有找到与「${esc(search)}」相关的习惯</div>`;
    }

    catData.forEach((cd, idx) => {
      html += `<div class="lib-grid" id="libGrid_${cd.cat}" style="${idx !== 0 ? 'display:none' : ''}">`;
      cd.items.forEach(h => {
        const added = myIds.has(h.id);
        html += `
          <div class="lib-card ${added ? 'added' : ''}" onclick="App.UI.Events.toggleHabitFromLib('${h.id}')">
            <span class="lib-card-icon">${esc(h.icon)}</span>
            <span class="lib-card-name">${esc(h.name)}</span>
            ${h.tip ? `<span class="lib-card-tip">${esc(h.tip)}</span>` : ''}
            ${added ? '<span class="lib-card-added">✓ 已添加</span>' : ''}
          </div>`;
      });
      html += `</div>`;
    });

    container.innerHTML = html;
  }

  // 绑定搜索输入：220ms 防抖 + 忽略中文输入法组合期，避免打断拼音输入
  function bindLibrarySearch() {
    const input = document.getElementById('libSearchInput');
    if (!input) return;
    let timer = null;
    const run = () => { currentLibSearch = input.value; renderLibraryResults(currentLibSearch); };
    input.addEventListener('input', (e) => {
      if (e.isComposing || input.composing) return; // 输入法组合中，暂不刷新
      clearTimeout(timer);
      timer = setTimeout(run, 220);
    });
    input.addEventListener('compositionend', () => { clearTimeout(timer); run(); });
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
      html += `<div class="ref-card" onclick="openReference('${b.url}')">
        <div class="ref-icon ancient">${b.emoji}</div>
        <div class="ref-info">
          <div class="ref-name">${esc(b.name)}</div>
          <div class="ref-author">${b.author} · ${b.desc}</div>
        </div>
        <div class="ref-arrow">›</div>
      </div>`;
    });

    html += `</div><div id="refListModern" style="display:none">`;
    modern.forEach(b => {
      html += `<div class="ref-card" onclick="openReference('${b.url}')">
        <div class="ref-icon modern">${b.emoji}</div>
        <div class="ref-info">
          <div class="ref-name">${esc(b.name)}</div>
          <div class="ref-author">${b.author} · ${b.desc}</div>
        </div>
        <div class="ref-arrow">›</div>
      </div>`;
    });

    html += `</div><div class="ref-lib-btn" onclick="openReference('references/养生参考文献文库/index.html')">📖 进入参考文献文库</div>`;

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
        <span class="emo-label">${esc(emo.name)}</span>
      </div>`;
    });

    html += '</div>';

    if (selected) {
      html += `
        <div class="emotion-current">
          <div class="emo">${selected.emoji}</div>
          <div class="emo-name">今日情绪：${esc(selected.name)}</div>
          <div class="emo-organ">伤及脏腑：${selected.organ} · 气机变化：${selected.damage}</div>
          <div class="emo-quote">"${selected.quote}"</div>
        </div>
        <div class="emotion-cure">
          <div class="cure-title">💡 调节建议（情志相胜）</div>
          <div class="cure-text">
            <strong>方法：</strong>以${selected.cureEmoji}${selected.cure}胜${esc(selected.name)}<br>
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
    if (body) {
      if (App.Modules.Diet) {
        body.innerHTML = App.Modules.Diet.renderDietPanel();
        openPanel('dietPanel');
      } else {
        body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">⏳ 加载饮食模块...</div>';
        LazyLoad('js/modules/diet.js', function() {
          if (App.Modules.Diet) body.innerHTML = App.Modules.Diet.renderDietPanel();
          openPanel('dietPanel');
        });
      }
    } else {
      openPanel('dietPanel');
    }
  }

  function openSportsPanel() {
    const body = document.getElementById('sportsPanelBody');
    if (body) {
      if (App.Modules.Sports) {
        body.innerHTML = App.Modules.Sports.renderSportsPanel();
        openPanel('sportsPanel');
      } else {
        body.innerHTML = '<div style="text-align:center;color:var(--muted);padding:30px">⏳ 加载运动模块...</div>';
        LazyLoad('js/modules/sports.js', function() {
          if (App.Modules.Sports) body.innerHTML = App.Modules.Sports.renderSportsPanel();
          openPanel('sportsPanel');
        });
      }
    } else {
      openPanel('sportsPanel');
    }
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
        { id:'zhongshi', name:'中式养生', emoji:'🍵', vars:{accent:'#7CB69D',accent2:'#C8893E','accent-light':'#DCEDE2','accent2-light':'#FAE6CC',bg:'#FDF8F0',bg2:'#F5EFE3'} },
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
      ]
    },
    {
      id: 'checkbox',
      label: '复选框',
      emoji: '☑️',
      items: [
        { id:'cb-default', name:'圆角', emoji:'✅', style:{'cb-style':'default'} },
        { id:'cb-round', name:'圆形', emoji:'⭕', style:{'cb-style':'round'} },
      ]
    },
    {
      id: 'toggle',
      label: '开关',
      emoji: '🎚️',
      items: [
        { id:'tg-default', name:'标准', emoji:'🔘', style:{'tg-style':'default'} },
        { id:'tg-daynight', name:'日夜切换', emoji:'🌓', style:{'tg-style':'daynight'} },
      ]
    },
    {
      id: 'card',
      label: '卡片',
      emoji: '🃏',
      items: [
        { id:'cd-glass', name:'毛玻璃', emoji:'✨', style:{'cd-style':'glass'} },
        { id:'cd-gradient', name:'渐变边框', emoji:'🌈', style:{'cd-style':'gradient'} },
      ]
    },
    {
      id: 'input',
      label: '输入框',
      emoji: '📝',
      items: [
        { id:'in-glass', name:'毛玻璃', emoji:'✨', style:{'in-style':'glass'} },
        { id:'in-underline', name:'下划线', emoji:'📏', style:{'in-style':'underline'} },
      ]
    },
    {
      id: 'badge',
      label: '徽章',
      emoji: '🏷️',
      items: [
        { id:'bd-pill', name:'药丸', emoji:'💊', style:{'bd-style':'pill'} },
        { id:'bd-gradient', name:'渐变', emoji:'🌈', style:{'bd-style':'gradient'} },
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
    // 主题 body class 切换（现代简约 / 中式养生）
    document.body.classList.toggle('theme-modern', skinId === 'modern');
    document.body.classList.toggle('theme-zhongshi', skinId === 'zhongshi');
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
    // 更新该分类下的选中态
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
              <span class="skin-toggle-name">${s.emoji} ${esc(s.name)}</span>
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
              <span class="skin-toggle-name">${s.emoji} ${esc(s.name)}</span>
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
            <div class="wl-name">${esc(wl.name)} · 伤${wl.organ}</div>
            <div class="wl-scene">💼 现代场景：${wl.scene}</div>
            <div class="wl-action">✅ 防护动作：${wl.action}</div>
            <div class="wl-tip">💡 ${esc(wl.tip)}</div>
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

    if (App.Modules && App.Modules.Recommendation) {
      const report = App.Modules.Recommendation.generateHealthReport('week');
      html += renderPersonalizedReportCard(report);
    }

    html += '</div>';
    body.innerHTML = html;
  }

  function renderPersonalizedReportCard(report) {
    let html = '<div style="margin-bottom:20px">';
    html += '<div style="font-size:14px;font-weight:700;margin-bottom:10px">🎯 个性化周报</div>';
    html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:15px;font-weight:700">本周完成率</div>
        <div style="font-size:22px;font-weight:800;color:var(--accent)">${report.overallRate}%</div>
      </div>
      <div style="width:100%;height:8px;background:var(--rule);border-radius:4px;overflow:hidden">
        <div style="width:${report.overallRate}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:4px;transition:width .6s"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:6px;text-align:right">${report.trendText}</div>
    </div>`;

    if (report.bestCategory || report.worstCategory) {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">';
      if (report.bestCategory) {
        html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">最佳分类</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">${report.bestCategory.icon} ${report.bestCategory.name}</div>
          <div style="font-size:16px;font-weight:800;color:var(--accent)">${report.bestCategory.rate}%</div>
        </div>`;
      }
      if (report.worstCategory) {
        html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">待加强</div>
          <div style="font-size:13px;font-weight:700;margin-bottom:4px">${report.worstCategory.icon} ${report.worstCategory.name}</div>
          <div style="font-size:16px;font-weight:800;color:#E07A5F">${report.worstCategory.rate}%</div>
        </div>`;
      }
      html += '</div>';
    }

    if (report.constInfo) {
      html += `<div style="background:linear-gradient(135deg,${report.constInfo.color || '#7CB69D'}15,transparent);border:1px solid var(--rule);border-radius:12px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">🧬 你的体质</div>
        <div style="font-size:14px;font-weight:700;color:${report.constInfo.color || '#7CB69D'};margin-bottom:4px">${report.constInfo.emoji} ${report.constInfo.name}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">${report.constInfo.advice}</div>
      </div>`;
    }

    if (report.seasonInfo) {
      html += `<div style="background:linear-gradient(135deg,${report.seasonInfo.color || '#7CB69D'}15,transparent);border:1px solid var(--rule);border-radius:12px;padding:12px;margin-bottom:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">🌿 当季养生重点</div>
        <div style="font-size:14px;font-weight:700;color:${report.seasonInfo.color || '#7CB69D'};margin-bottom:4px">${report.seasonInfo.name}季养${report.seasonInfo.organ}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">${report.seasonInfo.principle}</div>
      </div>`;
    }

    if (report.recommendations && report.recommendations.length > 0) {
      html += '<div style="font-size:14px;font-weight:700;margin:16px 0 10px">💡 为你推荐</div>';
      html += '<div style="display:flex;flex-direction:column;gap:10px">';
      report.recommendations.forEach((rec, idx) => {
        html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <div style="font-size:28px">${rec.icon}</div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700">${rec.name}</div>
              <div style="font-size:11px;color:var(--muted)">${rec.categoryIcon} ${rec.categoryName}</div>
            </div>
            <div style="font-size:10px;padding:2px 8px;background:var(--accent-light);color:var(--accent);border-radius:10px;font-weight:600">推荐</div>
          </div>
          <div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:10px">${rec.tip}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
            ${rec.reasons.map(r => `<span style="font-size:10px;padding:2px 8px;background:var(--bg);border:1px solid var(--rule);border-radius:8px">${r}</span>`).join('')}
          </div>
          ${rec.alreadyHas
            ? `<button class="const-btn" style="width:100%;padding:8px;font-size:13px;background:var(--muted);color:#fff">✓ 已添加，继续保持</button>`
            : `<button class="const-btn" style="width:100%;padding:8px;font-size:13px" onclick="App.UI.Events.addHabitFromLib('${rec.id}');setTimeout(function(){ if (App.UI.Panels.renderHealthReport) App.UI.Panels.renderHealthReport(); }, 200)">＋ 添加到习惯</button>`
          }
        </div>`;
      });
      html += '</div>';
    }

    if (report.waterStats) {
      html += `<div style="background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px;margin-top:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700">💧 饮水达标</div>
          <div style="font-size:14px;font-weight:800;color:#5B8DB8">${Math.round(report.waterStats.reachRate * 100)}%</div>
        </div>
        <div style="font-size:11px;color:var(--muted)">近7天平均 ${report.waterStats.avgAmount}ml / 目标 ${report.waterStats.goal}ml</div>
      </div>`;
    }

    html += '</div>';
    return html;
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

    body.innerHTML = `<div style="font-size:14px;font-weight:700;margin-bottom:12px">${esc(h.icon)} ${esc(h.name)} · 补签</div>` +
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

  function changeReminderMethod(method) {
    if (method === 'notification') {
      if (App.Modules.Notification && App.Modules.Notification.requestPermission) {
        App.Modules.Notification.requestPermission().then(function(granted) {
          if (granted) {
            _applyReminderMethod('notification');
          } else {
            updateReminderSegment('toast');
          }
        });
      } else {
        _applyReminderMethod(method);
      }
    } else {
      _applyReminderMethod(method);
    }
  }

  function updateReminderSegment(method) {
    var segment = document.getElementById('reminderMethodSegment');
    if (!segment) return;
    segment.querySelectorAll('.seg-btn').forEach(function(btn) {
      btn.classList.remove('active');
    });
    var activeBtn = segment.querySelector('.seg-' + method);
    if (activeBtn) activeBtn.classList.add('active');
  }

  function _applyReminderMethod(method) {
    habitsConfig.forEach(function(h) {
      if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast', sound:true, vibrate:true};
      h.reminder.method = method;
      if (method !== 'off') h.reminder.enabled = true;
      else h.reminder.enabled = false;
    });
    saveConfig();
    showToast('提醒设置已更新');
    updateReminderSegment(method);
    render();
  }

  function openHabitReminderList() {
    const body = document.getElementById('habitReminderBody');
    if (!body) return;

    const enabledCount = habitsConfig.filter(h => h.reminder && h.reminder.enabled).length;
    const total = habitsConfig.length;

    // 提醒方式图标映射
    var methodIcons = { toast: '💬', notification: '🔔', alarm: '⚡', 'in-app': '💬', off: '🔕' };
    var methodNames = { toast: '轻提醒', notification: '系统通知', alarm: '强提醒', 'in-app': '轻提醒', off: '已关闭' };
    var dayLabels = ['日','一','二','三','四','五','六'];

    let html = '<div style="padding:16px">';

    html += '<div style="text-align:center;margin-bottom:16px">' +
      '<div style="font-size:2rem;margin-bottom:.5rem">⏰</div>' +
      '<div style="font-weight:700;font-size:1.1rem">习惯提醒管理</div>' +
      '<div style="color:var(--muted);font-size:.85rem;margin-top:.3rem">已开启 ' + enabledCount + ' / ' + total + ' 个习惯提醒</div>' +
    '</div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
    html += '<button class="export-btn" style="flex:1;padding:8px;font-size:12px;background:var(--accent-light);color:var(--accent)" onclick="batchToggleReminders(true)">全部开启</button>';
    html += '<button class="export-btn" style="flex:1;padding:8px;font-size:12px;background:var(--rule);color:var(--ink2)" onclick="batchToggleReminders(false)">全部关闭</button>';
    html += '</div>';

    if (total === 0) {
      html += '<div style="text-align:center;padding:30px;color:var(--muted);font-size:14px">暂无习惯，请先添加习惯后再设置提醒</div>';
    }

    habitsConfig.forEach(function(h) {
      const r = h.reminder || {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'toast'};
      var mIcon = methodIcons[r.method] || '💬';
      var mName = methodNames[r.method] || '轻提醒';

      // 生成重复日期摘要
      var daysStr = '';
      if (!r.days || r.days.length === 7) {
        daysStr = '每天';
      } else if (r.days.length === 5 && !r.days.includes(0) && !r.days.includes(6)) {
        daysStr = '工作日';
      } else if (r.days.length === 2 && r.days.includes(0) && r.days.includes(6)) {
        daysStr = '周末';
      } else if (r.days && r.days.length > 0) {
        daysStr = r.days.slice().sort().map(function(d) { return '周' + dayLabels[d]; }).join(' ');
      } else {
        daysStr = '每天';
      }

      // 额外提醒时间
      var extraStr = '';
      if (r.extraTimes && r.extraTimes.length > 0) {
        extraStr = '<div style="font-size:11px;color:var(--accent);margin-top:2px">+' + r.extraTimes.length + ' 次: ' + r.extraTimes.join(', ') + '</div>';
      }

      html += '<div class="hr-item" onclick="openTimePanel(\'' + h.id + '\')" style="' + (!r.enabled ? 'opacity:0.5;' : '') + '">' +
        '<div class="hr-left">' +
          '<span class="hr-icon">' + h.icon + '</span>' +
          '<div class="hr-info">' +
            '<div class="hr-name">' + esc(h.name) + '</div>' +
            '<div class="hr-time">' + (r.enabled ? mIcon + ' ' + r.time + ' · ' + daysStr : '🔕 未开启') + '</div>' +
            extraStr +
          '</div>' +
        '</div>' +
        '<div class="hr-right">' +
          '<div class="toggle-switch ' + (r.enabled ? 'on' : '') + '" onclick="event.stopPropagation();toggleHabitReminder(\'' + h.id + '\', this)"></div>' +
          '<span class="hr-arrow">›</span>' +
        '</div>' +
      '</div>';
    });

    html += '</div>';
    body.innerHTML = html;
    openPanel('habitReminderPanel');
  }

  function toggleHabitReminder(habitId, el) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'};
    h.reminder.enabled = !h.reminder.enabled;
    el.classList.toggle('on');
    saveConfig();
    render();
    const body = document.getElementById('habitReminderBody');
    if (body) {
      const enabledCount = habitsConfig.filter(x => x.reminder && x.reminder.enabled).length;
      const total = habitsConfig.length;
      const infoEl = body.querySelector('[style*="font-weight:700"] + div');
      if (infoEl) infoEl.textContent = '已开启 ' + enabledCount + ' / ' + total + ' 个习惯提醒';
    }
  }

  function batchToggleReminders(enable) {
    habitsConfig.forEach(h => {
      if (!h.reminder) h.reminder = {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'};
      h.reminder.enabled = enable;
    });
    saveConfig();
    render();
    openHabitReminderList();
    showToast(enable ? '已开启所有习惯提醒' : '已关闭所有习惯提醒');
  }

  function openTimePanel(habitId) {
    pendingTimeHabitId = habitId;
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;

    const r = h.reminder || {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app', sound:true, vibrate:true};
    var extraTimes = r.extraTimes || [];

    // 额外提醒时间 HTML
    var extraHtml = extraTimes.map(function(t, i) {
      return '<div class="extra-time-row" style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
        '<input type="time" class="extra-time-input" value="' + t + '" style="flex:1;padding:10px;border:1px solid var(--rule);border-radius:8px;font-size:15px;background:var(--bg);color:var(--ink)">' +
        '<button onclick="this.parentElement.remove()" style="width:32px;height:32px;border:none;background:var(--rule);border-radius:8px;color:var(--ink2);font-size:14px;cursor:pointer">✕</button>' +
      '</div>';
    }).join('');

    document.getElementById('timePanelTitle').textContent = `${esc(h.icon)} ${esc(h.name)} 提醒设置`;
    const body = document.getElementById('timePanelBody');
    body.innerHTML = `
      <div class="toggle-row">
        <span class="toggle-label">开启提醒</span>
        <div class="toggle-switch ${r.enabled ? 'on' : ''}" id="reminderToggle" onclick="toggleReminderEnabledPanel()"></div>
      </div>
      <div class="time-picker-wrap">
        <label>主提醒时间</label>
        <input type="time" id="reminderTimeInput" value="${r.time}">
      </div>

      <div style="margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:13px;color:var(--muted);font-weight:600">额外提醒时间</label>
          <button onclick="addExtraTimeRow()" id="addExtraTimeBtn" style="padding:4px 12px;border:1px dashed var(--accent);background:transparent;color:var(--accent);border-radius:8px;font-size:12px;cursor:pointer">+ 添加</button>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px">在主时间之外，额外发送提醒（最多5个）</div>
        <div id="extraTimesContainer">${extraHtml}</div>
      </div>

      <div style="margin-top:20px">
        <label style="font-size:13px;color:var(--muted);display:block;margin-bottom:8px;font-weight:600">提醒方式</label>
        <select id="reminderMethodSelect" style="width:100%;padding:12px;border:1px solid var(--rule);border-radius:10px;font-size:14px;background:var(--bg);color:var(--ink)">
          <option value="toast" ${r.method === 'toast' || r.method === 'in-app' ? 'selected' : ''}>💬 轻提醒（底部滑出提示）</option>
          <option value="notification" ${r.method === 'notification' ? 'selected' : ''}>🔔 系统通知（不打开App也能收到）</option>
          <option value="alarm" ${r.method === 'alarm' ? 'selected' : ''}>⚡ 强提醒（声音+振动+闪烁）</option>
          <option value="off" ${r.method === 'off' ? 'selected' : ''}>🔕 关闭提醒</option>
        </select>
      </div>

      <div style="margin-top:16px;font-size:13px;color:var(--muted);margin-bottom:8px;font-weight:600">重复日期</div>
      <div class="days-selector" id="daysSelector">
        ${DAY_NAMES.map((name, i) => `
          <button class="day-btn ${r.days.includes(i) ? 'active' : ''}" data-day="${i}" onclick="toggleDay(this, ${i})">${name}</button>
        `).join('')}
      </div>

      <div class="toggle-row" style="margin-top:16px">
        <span class="toggle-label">提醒音效</span>
        <div class="toggle-switch ${r.sound !== false ? 'on' : ''}" id="reminderSoundToggle" onclick="this.classList.toggle('on')"></div>
      </div>

      <button class="export-btn" style="margin-top:24px;background:var(--accent);color:#fff;width:100%;padding:14px;font-size:15px;font-weight:600" onclick="saveTimeSettings()">保存设置</button>
    `;
    openPanel('timePanel');
  }

  function addExtraTimeRow() {
    var container = document.getElementById('extraTimesContainer');
    if (!container) return;
    var count = container.querySelectorAll('.extra-time-row').length;
    if (count >= 5) {
      showToast('最多添加5个额外提醒时间');
      return;
    }
    var div = document.createElement('div');
    div.className = 'extra-time-row';
    div.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:8px';
    div.innerHTML = '<input type="time" class="extra-time-input" value="12:00" style="flex:1;padding:10px;border:1px solid var(--rule);border-radius:8px;font-size:15px;background:var(--bg);color:var(--ink)">' +
      '<button onclick="this.parentElement.remove()" style="width:32px;height:32px;border:none;background:var(--rule);border-radius:8px;color:var(--ink2);font-size:14px;cursor:pointer">✕</button>';
    container.appendChild(div);
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
    const method = document.getElementById('reminderMethodSelect').value;
    const sound = document.getElementById('reminderSoundToggle').classList.contains('on');

    // 收集额外时间
    var extraTimes = [];
    document.querySelectorAll('#extraTimesContainer .extra-time-input').forEach(function(inp) {
      if (inp.value) extraTimes.push(inp.value);
    });
    // 去重 + 排序
    extraTimes = extraTimes.filter(function(t, i, arr) {
      return t !== time && arr.indexOf(t) === i;
    }).sort();

    const days = [];
    document.querySelectorAll('#daysSelector .day-btn.active').forEach(btn => {
      days.push(parseInt(btn.dataset.day));
    });

    h.reminder = {
      enabled,
      time: time || '08:00',
      days: days.length > 0 ? days : [0,1,2,3,4,5,6],
      method: method,
      sound: sound,
      vibrate: sound,
      extraTimes: extraTimes
    };
    saveConfig();
    closeAllPanels();
    showToast('提醒设置已保存');
    render();
  }

  function toggleRepeat(habitId) {
    const h = habitsConfig.find(x => x.id === habitId);
    if (!h) return;
    const current = h.repeat || [0,1,2,3,4,5,6];
    if (current.length === 7) {
      h.repeat = [1,2,3,4,5];
      showToast(`${esc(h.icon)} ${esc(h.name)}：改为工作日打卡`);
    } else if (current.length === 5 && !current.includes(0) && !current.includes(6)) {
      h.repeat = [0,6];
      showToast(`${esc(h.icon)} ${esc(h.name)}：改为周末打卡`);
    } else {
      h.repeat = [0,1,2,3,4,5,6];
      showToast(`${esc(h.icon)} ${esc(h.name)}：改为每天打卡`);
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

  // ============================================================
  // 免打扰设置
  // ============================================================

  function _padTime(n) { return n < 10 ? '0' + n : '' + n; }

  /** 将分钟数转为 HH:MM 字符串 */
  function _minToTime(min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    return _padTime(h) + ':' + _padTime(m);
  }

  /** 更新设置面板中的免打扰描述文字和开关状态 */
  function _updateQuietHoursUI() {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      var enabled = cfg.enabled !== false;
      // 兼容旧的整点格式（number）和新的分钟格式（startMin/endMin）
      var startMin = cfg.startMin != null ? cfg.startMin : (cfg.start || 22) * 60;
      var endMin = cfg.endMin != null ? cfg.endMin : (cfg.end || 7) * 60;
      var descEl = document.getElementById('quietHoursDesc');
      var toggleEl = document.getElementById('quietHoursToggle');
      if (descEl) {
        descEl.textContent = enabled
          ? _minToTime(startMin) + ' – ' + _minToTime(endMin) + ' · 期间不发送提醒'
          : '已关闭 · 提醒将全天候发送';
      }
      if (toggleEl) toggleEl.checked = enabled;
    } catch(e) {}
  }

  /** 打开免打扰设置面板 */
  function openQuietHoursPanel() {
    var cfg;
    try {
      cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
    } catch(e) { cfg = {}; }

    var enabled = cfg.enabled !== false;
    var startMin = cfg.startMin != null ? cfg.startMin : (cfg.start || 22) * 60;
    var endMin = cfg.endMin != null ? cfg.endMin : (cfg.end || 7) * 60;

    // 设置面板初始值
    var toggle = document.getElementById('qhEnableToggle');
    if (toggle) {
      if (enabled) toggle.classList.add('on');
      else toggle.classList.remove('on');
    }
    var startInput = document.getElementById('qhStartTime');
    var endInput = document.getElementById('qhEndTime');
    if (startInput) startInput.value = _minToTime(startMin);
    if (endInput) endInput.value = _minToTime(endMin);

    _updateQHPreview();
    openPanel('quietHoursPanel');

    // 监听时间变化实时更新预览
    if (startInput) startInput.onchange = _updateQHPreview;
    if (endInput) endInput.onchange = _updateQHPreview;
  }

  /** 更新免打扰预览文字 */
  function _updateQHPreview() {
    var preview = document.getElementById('qhPreview');
    if (!preview) return;
    var toggle = document.getElementById('qhEnableToggle');
    var enabled = toggle && toggle.classList.contains('on');
    var startVal = (document.getElementById('qhStartTime') || {}).value || '22:00';
    var endVal = (document.getElementById('qhEndTime') || {}).value || '07:00';

    if (!enabled) {
      preview.innerHTML = '🔔 免打扰已关闭，提醒将全天候发送';
      preview.style.background = 'var(--card)';
      return;
    }

    // 计算免打扰时长
    var sp = startVal.split(':').map(Number);
    var ep = endVal.split(':').map(Number);
    var startMin = sp[0] * 60 + (sp[1] || 0);
    var endMin = ep[0] * 60 + (ep[1] || 0);

    if (startMin === endMin) {
      preview.innerHTML = '⚠️ 开始和结束时间相同，请调整';
      preview.style.background = 'var(--card)';
      return;
    }

    var duration = endMin > startMin ? endMin - startMin : (24 * 60 - startMin + endMin);
    var hours = Math.floor(duration / 60);
    var mins = duration % 60;
    var durStr = hours > 0 ? hours + '小时' : '';
    if (mins > 0) durStr += mins + '分钟';

    preview.innerHTML = '🌙 每天 <strong>' + startVal + '</strong> 至次日 <strong>' + endVal + '</strong> 静默<br><span style="font-size:12px;color:var(--muted)">持续约 ' + durStr + ' · 强提醒不受影响</span>';
  }

  /** 设置面板中的快速开关 */
  function toggleQuietHours(enabled) {
    try {
      var cfg = JSON.parse(localStorage.getItem('quiet_hours') || '{}');
      cfg.enabled = enabled;
      localStorage.setItem('quiet_hours', JSON.stringify(cfg));
      _updateQuietHoursUI();
      // 触发通知系统重调度
      if (typeof rescheduleAllNotifications === 'function') rescheduleAllNotifications();
      showToast(enabled ? '免打扰已开启' : '免打扰已关闭');
    } catch(e) {}
  }

  /** 保存免打扰面板设置（存储分钟数，兼容旧格式） */
  function saveQuietHours() {
    var toggle = document.getElementById('qhEnableToggle');
    var enabled = toggle && toggle.classList.contains('on');
    var startVal = (document.getElementById('qhStartTime') || {}).value || '22:00';
    var endVal = (document.getElementById('qhEndTime') || {}).value || '07:00';

    var sp = startVal.split(':').map(Number);
    var ep = endVal.split(':').map(Number);
    var startMin = (sp[0] || 22) * 60 + (sp[1] || 0);
    var endMin = (ep[0] || 7) * 60 + (ep[1] || 0);

    // 校验：开始和结束时间相同则无效
    if (enabled && startMin === endMin) {
      showToast('开始和结束时间相同，请调整');
      return;
    }

    var cfg = {
      enabled: enabled,
      startMin: startMin,
      endMin: endMin
    };
    localStorage.setItem('quiet_hours', JSON.stringify(cfg));

    _updateQuietHoursUI();
    if (typeof rescheduleAllNotifications === 'function') rescheduleAllNotifications();
    closeAllPanels();
    showToast('免打扰设置已保存');
  }

  /** 打开通知诊断面板 */
  function openNotifyDiagnosticsPanel() {
    var body = document.getElementById('notifyDiagnosticsBody');
    if (!body) return;
    openPanel('notifyDiagnosticsPanel');

    body.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted)">正在收集诊断信息...</div>';

    setTimeout(function() {
      var info = {};
      // 平台信息
      try {
        if (window.App && App.Modules && App.Modules.LocalNotify) {
          info = App.Modules.LocalNotify.getDiagnostics() || {};
        }
      } catch(e) { info.lastError = e.message; }

      // 统计已配置的习惯提醒
      var habitCount = 0, enabledCount = 0, intervalCount = 0;
      try {
        var habits = JSON.parse(localStorage.getItem('habits') || '[]');
        habitCount = habits.length;
        habits.forEach(function(h) {
          if (h.reminder && h.reminder.enabled) enabledCount++;
          if (h.intervalReminder && h.intervalReminder.enabled) intervalCount++;
        });
      } catch(e) {}

      // 免打扰状态
      var qh = info.quietHours || {};
      var qhText = qh.enabled
        ? '已开启 ' + _minToTime(qh.startMin || 22 * 60) + '–' + _minToTime(qh.endMin || 7 * 60)
        : '已关闭';

      var platformText = info.isCapacitor ? 'APK (Capacitor)' : 'PWA (浏览器)';
      var permText = info.permission === 'granted' ? '✅ 已授权' : (info.permission === 'denied' ? '❌ 已拒绝' : '⚠️ 未确认');

      body.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:12px">' +
          '<div style="padding:12px;border-radius:8px;background:var(--bg2)">' +
            '<div style="font-weight:600;margin-bottom:8px">📋 基本信息</div>' +
            '<div style="font-size:13px;line-height:1.8">' +
              '<div>运行平台：<strong>' + platformText + '</strong></div>' +
              '<div>通知权限：' + permText + '</div>' +
              '<div>UI 就绪：<strong>' + (info.uiReady ? '是' : '否') + '</strong></div>' +
              '<div>最近错误：<span style="color:' + (info.lastError && info.lastError !== '无' ? '#e74c3c' : 'var(--muted)') + '">' + (info.lastError || '无') + '</span></div>' +
            '</div>' +
          '</div>' +
          '<div style="padding:12px;border-radius:8px;background:var(--bg2)">' +
            '<div style="font-weight:600;margin-bottom:8px">⏰ 提醒配置</div>' +
            '<div style="font-size:13px;line-height:1.8">' +
              '<div>习惯总数：<strong>' + habitCount + '</strong></div>' +
              '<div>已启用固定提醒：<strong>' + enabledCount + '</strong></div>' +
              '<div>已启用间隔提醒：<strong>' + intervalCount + '</strong></div>' +
              '<div>免打扰状态：<strong>' + qhText + '</strong></div>' +
            '</div>' +
          '</div>' +
          '<div style="padding:12px;border-radius:8px;background:var(--bg2)">' +
            '<div style="font-weight:600;margin-bottom:8px">📡 系统通知</div>' +
            '<div style="font-size:13px;line-height:1.8">' +
              '<div>待触发通知数：<strong id="diagPendingCount">' + info.pendingCount + '</strong></div>' +
              '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + (info.isCapacitor ? '由 Capacitor 系统通知调度' : '由浏览器 setTimeout 调度') + '</div>' +
            '</div>' +
          '</div>' +
          '<button class="const-btn" onclick="openNotifyDiagnosticsPanel()" style="width:100%">🔄 刷新诊断信息</button>' +
        '</div>';
    }, 100);
  }

  if (!window.App) window.App = {};
  if (!App.UI) App.UI = {};

  // ============================================================
  // AI 成长闭环面板
  // ============================================================

  let currentAnalysisResult = null;

  function openAiGrowthPanel() {
    renderAiGrowthLoading();
    openPanel('aiGrowthPanel');
    triggerWeeklyAnalysis();
  }

  function renderAiGrowthLoading() {
    const body = document.getElementById('aiGrowthPanelBody');
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px">
        <div class="loading-spinner"></div>
        <div style="margin-top:20px;font-size:14px;color:var(--muted)">AI正在分析你的数据...</div>
        <div id="aiGrowthProgress" style="margin-top:8px;font-size:12px;color:var(--muted)">正在整理本周记录</div>
      </div>
    `;
  }

  async function triggerWeeklyAnalysis() {
    try {
      const data = App.Modules.Recommendation.generateWeeklyAnalysisData();
      updateAiGrowthProgress('AI正在分析数据...');

      const result = await App.Modules.AI.analyzeWeeklyData(data, updateAiGrowthProgress);
      updateAiGrowthProgress('整理分析结果...');

      currentAnalysisResult = result;
      renderAiGrowthPanel(result);
    } catch (err) {
      console.error('[AI Growth] 分析失败:', err);
      renderAiGrowthError();
    }
  }

  function updateAiGrowthProgress(text) {
    const el = document.getElementById('aiGrowthProgress');
    if (el) el.textContent = text;
  }

  function renderAiGrowthError() {
    const body = document.getElementById('aiGrowthPanelBody');
    if (!body) return;
    body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">🤖</div>
        <div style="font-size:16px;color:var(--ink);font-weight:600;margin-bottom:8px">AI暂时休息中</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.6">网络连接不稳定，已为你准备了精选建议</div>
        <button class="const-btn" onclick="triggerWeeklyAnalysis()" style="margin-top:20px">重试</button>
      </div>
    `;
  }

  function renderAiGrowthPanel(result) {
    const body = document.getElementById('aiGrowthPanelBody');
    if (!body || !result) return;

    let html = '';

    html += renderGrowthSummary(result.summary);

    if (result.insights && result.insights.length > 0) {
      html += '<div style="margin-top:24px">';
      result.insights.forEach((insight, idx) => {
        html += renderInsightCard(insight, idx);
      });
      html += '</div>';
    }

    if (result.suggestions && result.suggestions.length > 0) {
      html += '<div style="margin-top:20px">';
      result.suggestions.forEach((suggestion, idx) => {
        html += renderSuggestionCard(suggestion, idx);
      });
      html += '</div>';
    }

    html += `
      <div style="margin-top:24px;padding-bottom:24px;text-align:center">
        <div style="font-size:12px;color:var(--muted)">数据来源：${result.dataSource ? result.dataSource.join(' · ') : '本周打卡记录'}</div>
      </div>
    `;

    body.innerHTML = html;
  }

  function renderGrowthSummary(summary) {
    if (!summary) return '';

    const trendColor = summary.trend === 'up' ? '#7CB69D' : summary.trend === 'down' ? '#E07A5F' : '#9CA3AF';
    const trendIcon = summary.trend === 'up' ? '📈' : summary.trend === 'down' ? '📉' : '📊';

    return `
      <div style="background:var(--accent-light);border-radius:16px;padding:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div>
            <div style="font-size:12px;color:var(--muted)">${summary.periodLabel || '本周'}完成率</div>
            <div style="font-size:32px;font-weight:700;color:var(--ink)">${summary.overallRate || 0}%</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:12px;color:var(--muted)">${trendIcon} 趋势</div>
            <div style="font-size:14px;font-weight:600;color:${trendColor}">${summary.trendText || '与上周持平'}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px">
          ${summary.bestHabit ? `
            <div style="flex:1;background:var(--bg);border-radius:12px;padding:12px">
              <div style="font-size:10px;color:var(--muted)">最佳习惯</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                <span>${summary.bestHabit.icon || '🌟'}</span>
                <span style="font-size:13px;font-weight:600;color:var(--ink)">${summary.bestHabit.name || ''}</span>
              </div>
              ${summary.bestHabit.streak ? `<div style="font-size:11px;color:#7CB69D;margin-top:4px">🔥 ${summary.bestHabit.streak}天连续</div>` : ''}
            </div>
          ` : ''}
          ${summary.weakestHabit ? `
            <div style="flex:1;background:var(--bg);border-radius:12px;padding:12px">
              <div style="font-size:10px;color:var(--muted)">需加油</div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
                <span>${summary.weakestHabit.icon || '💪'}</span>
                <span style="font-size:13px;font-weight:600;color:var(--ink)">${summary.weakestHabit.name || ''}</span>
              </div>
              <div style="font-size:11px;color:#E07A5F;margin-top:4px">📉 完成率${summary.weakestHabit.rate || 0}%</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderInsightCard(insight, index) {
    const typeColors = {
      correlation: '#5B8DB8',
      milestone: '#7CB69D',
      warning: '#E07A5F',
      encouragement: '#D4A373'
    };

    const bgColor = typeColors[insight.type] || '#9CA3AF';

    return `
      <div class="insight-card" style="animation:slideUp .3s ease ${index * 0.1}s both">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:40px;height:40px;border-radius:12px;background:${bgColor}20;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">
            ${insight.icon || '💡'}
          </div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--ink)">${insight.title}</div>
            <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-top:4px">${insight.description}</div>
            ${insight.confidence ? `
              <div style="display:flex;align-items:center;gap:4px;margin-top:8px">
                <div style="width:60px;height:4px;background:var(--bg);border-radius:2px;overflow:hidden">
                  <div style="width:${Math.round(insight.confidence * 100)}%;height:100%;background:${bgColor};border-radius:2px"></div>
                </div>
                <span style="font-size:10px;color:var(--muted)">置信度${Math.round(insight.confidence * 100)}%</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderSuggestionCard(suggestion, index) {
    const isNewHabit = suggestion.type === 'new_habit';
    const habit = suggestion.newHabit || suggestion.adjustment || {};

    return `
      <div class="suggestion-card" style="animation:slideUp .3s ease ${index * 0.15}s both">
        <div style="padding:16px 20px">
          <div style="display:flex;align-items:flex-start;gap:12px">
            <div style="width:44px;height:44px;border-radius:14px;background:var(--accent-light);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">
              ${habit.icon || (isNewHabit ? '✨' : '🔧')}
            </div>
            <div style="flex:1">
              <div style="font-size:14px;font-weight:600;color:var(--ink)">💡 ${suggestion.title}</div>
              <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-top:4px">${suggestion.description}</div>
            </div>
          </div>

          ${habit.name ? `
            <div style="margin-top:16px;padding:12px;background:var(--bg);border-radius:12px;border:1px solid var(--border);cursor:pointer" onclick="editSuggestionHabit('${suggestion.id}')">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--ink)">${habit.name}</div>
                  <div style="font-size:12px;color:var(--muted);margin-top:2px">
                    ${habit.category ? getCategoryName(habit.category) + ' · ' : ''}
                    ${habit.timePeriod ? getTimePeriodName(habit.timePeriod) + ' · ' : ''}
                    ${habit.reminderTime ? habit.reminderTime + '提醒' : ''}
                  </div>
                </div>
                <div style="font-size:12px;color:var(--muted)">✏️ 点击编辑</div>
              </div>
            </div>
          ` : ''}

          ${suggestion.expectedImpact ? `
            <div style="margin-top:12px;font-size:12px;color:#7CB69D">🎯 ${suggestion.expectedImpact}</div>
          ` : ''}

          <div style="display:flex;gap:12px;margin-top:20px">
            <button class="btn-secondary" onclick="handleSuggestionReject('${suggestion.id}')">暂不需要</button>
            <button class="btn-primary" onclick="handleSuggestionAccept('${suggestion.id}')">✅ 采纳并创建</button>
          </div>
        </div>
      </div>
    `;
  }

  function getCategoryName(cat) {
    const map = {
      sport: '运动健身', diet: '饮食营养', study: '学习成长',
      sleep: '睡眠作息', mind: '心灵修养', protect: '五劳防护',
      care: '个人护理', home: '居家生活', social: '社交人际'
    };
    return map[cat] || cat;
  }

  function getTimePeriodName(tp) {
    const map = {
      morning: '早晨', noon: '午间', evening: '傍晚', night: '睡前'
    };
    return map[tp] || tp;
  }

  function editSuggestionHabit(suggestionId) {
    alert('编辑功能将在后续版本中提供，当前直接采纳即可');
  }

  function handleSuggestionAccept(suggestionId) {
    if (!currentAnalysisResult) return;
    const suggestion = currentAnalysisResult.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    try {
      if (suggestion.action === 'create_habit' && suggestion.newHabit) {
        App.Modules.Habit.createHabitFromSuggestion(suggestion);
      } else if (suggestion.action === 'adjust_habit' && suggestion.targetHabitId) {
        App.Modules.Habit.adjustHabitFromSuggestion(suggestion);
      }

      recordSuggestionFeedback(suggestionId, 'accepted');

      const card = document.querySelector(`.suggestion-card button[onclick*="'${suggestionId}'"]`).closest('.suggestion-card');
      if (card) {
        card.innerHTML = `
          <div style="padding:20px;text-align:center">
            <div style="font-size:36px;margin-bottom:12px">✅</div>
            <div style="font-size:16px;font-weight:600;color:var(--ink)">已添加到今日清单</div>
            <div style="font-size:13px;color:var(--muted);margin-top:8px">快去完成今天的打卡吧！</div>
            <button class="const-btn" onclick="closeAllPanels();renderHomePage()" style="margin-top:16px">查看详情</button>
          </div>
        `;
      }

      if (typeof App.Modules.Achievement !== 'undefined') App.Modules.Achievement.checkAchievements();
      if (typeof renderHomePage === 'function') renderHomePage();
    } catch (err) {
      console.error('[AI Growth] 采纳建议失败:', err);
      alert('创建习惯失败，请稍后重试');
    }
  }

  function handleSuggestionReject(suggestionId) {
    recordSuggestionFeedback(suggestionId, 'rejected');

    const card = document.querySelector(`.suggestion-card button[onclick*="'${suggestionId}'"]`).closest('.suggestion-card');
    if (card) {
      card.style.opacity = '0';
      card.style.transform = 'translateY(-10px)';
      setTimeout(() => card.remove(), 300);
    }
  }

  function recordSuggestionFeedback(suggestionId, action) {
    try {
      const feedback = JSON.parse(localStorage.getItem('ai_growth_feedback') || '[]');
      feedback.push({
        suggestionId,
        action,
        timestamp: Date.now()
      });
      localStorage.setItem('ai_growth_feedback', JSON.stringify(feedback.slice(-50)));
    } catch (e) {}
  }

  App.UI.Panels = {
    openPanel,
    closeAllPanels,
    attachPanelGesture,
    openLibraryPanel,
    renderLibraryPanel,
    updateLibCardState,
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
    openSportsPanel,
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
    changeReminderMethod,
    openHabitReminderList,
    toggleHabitReminder,
    batchToggleReminders,
    openTimePanel,
    addExtraTimeRow,
    toggleReminderEnabledPanel,
    toggleDay,
    saveTimeSettings,
    toggleRepeat,
    openWaterInputPanel,
    openWaterWeekPanel,
    openQuietHoursPanel,
    toggleQuietHours,
    saveQuietHours,
    openNotifyDiagnosticsPanel,
    updateQuietHoursUI: _updateQuietHoursUI,
    openAiGrowthPanel,
    renderAiGrowthPanel
  };

  // 暴露到全局，供 HTML onclick 直接使用
  window.openPanel = openPanel;
  window.closeAllPanels = closeAllPanels;
  window.changeReminderMethod = changeReminderMethod;
  window.updateReminderSegment = updateReminderSegment;
  window.openHabitReminderList = openHabitReminderList;
  window.toggleHabitReminder = toggleHabitReminder;
  window.batchToggleReminders = batchToggleReminders;
  window.openEmotionPanel = openEmotionPanel;
  window.openRetroactivePanel = openRetroactivePanel;
  window.openAiGrowthPanel = openAiGrowthPanel;
  window.handleSuggestionAccept = handleSuggestionAccept;
  window.handleSuggestionReject = handleSuggestionReject;
  window.editSuggestionHabit = editSuggestionHabit;
  // 批量暴露其余函数
  Object.keys(App.UI.Panels).forEach(function(k) {
    if (typeof App.UI.Panels[k] === 'function' && !window[k]) window[k] = App.UI.Panels[k];
  });

  if (App.registerModule) {
    App.registerModule('ui.panels', 'ui', null);
  }
})();
