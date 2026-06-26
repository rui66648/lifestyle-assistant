(function() {
  let packFilter = 'all';
  let packExpanded = {myPack: false};
  let pendingCheckinHabitId = null;
  Object.defineProperty(window, 'pendingCheckinHabitId', {
    get: () => pendingCheckinHabitId,
    set: (val) => { pendingCheckinHabitId = val; },
    configurable: true,
    enumerable: true
  });
  let pendingTimeHabitId = null;
  let waterScheduleTemp = [];

  function openPanel(id) {
    document.getElementById('panelOverlay').classList.add('show');
    const panel = document.getElementById(id);
    panel.classList.add('show');
    document.body.style.overflow = 'hidden';
    attachPanelGesture(panel);
  }

  function closeAllPanels() {
    document.getElementById('panelOverlay').classList.remove('show');
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('show'));
    document.body.style.overflow = '';
    pendingCheckinHabitId = null;
    pendingTimeHabitId = null;
  }

  function attachPanelGesture(panel) {
    if (panel._gestureAttached) return;
    panel._gestureAttached = true;

    let startY = 0, startX = 0, currentY = 0;

    panel.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      currentY = startY;
      panel.style.transition = 'none';
    }, { passive: true });

    panel.addEventListener('touchmove', e => {
      if (startY === 0) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      const deltaX = Math.abs(e.touches[0].clientX - startX);
      if (deltaY > 0 && deltaY > deltaX) {
        panel.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: true });

    panel.addEventListener('touchend', () => {
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
    });
  }

  function openLibraryPanel() {
    renderLibraryPanel('');
    openPanel('libraryPanel');
  }

  function renderLibraryPanel(search) {
    const body = document.getElementById('libraryPanelBody');
    const myIds = new Set(habitsConfig.map(h => h.id));
    const q = search.toLowerCase();

    let html = `<input class="lib-search" placeholder="搜索习惯..." value="${search}" oninput="renderLibraryPanel(this.value)">`;

    html += `
      <div class="lib-custom" style="margin-top:12px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:8px">✨ 自定义习惯</div>
        <div class="lib-custom-input">
          <input id="customHabitName" placeholder="习惯名称" maxlength="20">
          <input id="customHabitIcon" placeholder="图标" maxlength="4" style="width:60px">
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
      </div>`;

    const packHabits = HEALTH_PACK.habits;
    const packAddedCount = packHabits.filter(ph => myIds.has(ph.id)).length;
    const packAllAdded = packAddedCount === packHabits.length;

    html += `
      <div style="background:linear-gradient(135deg,var(--accent-light),var(--accent2-light));border-radius:16px;padding:16px;margin-bottom:16px;cursor:pointer;box-shadow:var(--shadow)" onclick="addHealthPack()">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:28px">💚</span>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--ink)">健康生活建议包</div>
            <div style="font-size:12px;color:var(--muted)">${HEALTH_PACK.description}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:13px;color:var(--muted)">${packAllAdded ? '✅ 已全部添加' : `已添加 ${packAddedCount}/${packHabits.length} 个习惯`}</span>
          <span style="padding:6px 16px;border-radius:16px;font-size:13px;font-weight:600;background:${packAllAdded ? 'var(--bg2)' : 'var(--accent)'};color:${packAllAdded ? 'var(--muted)' : '#fff'}">${packAllAdded ? '已添加' : '一键添加'}</span>
        </div>
      </div>
    `;

    const currentSeason = getCurrentSeason();
    const seasonOrder = ['spring','summer','autumn','winter'];

    html += `<div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:8px;margin-top:4px">🌿 四季养生（黄帝内经）</div>`;

    seasonOrder.forEach(key => {
      const pack = SEASONAL_PACKS[key];
      const isCurrent = key === currentSeason;
      const packAddedCount = pack.habits.filter(ph => myIds.has(ph.id)).length;
      const packAllAdded = packAddedCount === pack.habits.length;
      
      html += `
        <div class="season-pack-card ${isCurrent ? 'current' : 'other'}" onclick="addSeasonalPack('${key}')">
          <div class="season-pack-header">
            <span class="season-pack-icon">${pack.emoji}</span>
            <div>
              <div class="season-pack-title">${pack.name} ${isCurrent ? '<span style="font-size:11px;color:var(--accent);font-weight:600">当前季节</span>' : ''}</div>
              <div class="season-pack-subtitle">重点：${pack.focus} · ${pack.habits.length}个习惯</div>
            </div>
          </div>
          <div class="season-pack-quote">${pack.quote}</div>
          <div class="season-pack-footer">
            <span class="season-pack-count">${packAllAdded ? '✅ 已全部添加' : `已添加 ${packAddedCount}/${pack.habits.length}`}</span>
            <span class="season-pack-btn ${packAllAdded ? 'added' : ''}">${packAllAdded ? '已添加' : '一键添加'}</span>
          </div>
        </div>`;
    });

    const categories = ['morning','forenoon','afternoon','evening','fitness','study','health'];
    categories.forEach(cat => {
      const catInfo = CATEGORY_MAP[cat];
      let items = HABIT_LIBRARY.filter(h => h.category === cat);
      if (q) items = items.filter(h => h.name.toLowerCase().includes(q));
      if (items.length === 0) return;

      html += `<div class="lib-category"><div class="lib-cat-label">${catInfo.emoji} ${catInfo.label}</div>`;
      items.forEach(h => {
        const added = myIds.has(h.id);
        const typeLabel = h.type === 'boolean' ? '打卡' : h.type === 'count' ? `计数(${h.unit})` : h.type === 'water' ? '饮水追踪' : `计时(${h.unit})`;
        html += `
          <div class="lib-item">
            <span class="icon">${h.icon}</span>
            <span class="name">${h.name}</span>
            <span class="type-tag">${typeLabel}</span>
            <button class="add-btn ${added ? 'added' : ''}" onclick="${added ? '' : `addHabitFromLib('${h.id}')`}">${added ? '已添加' : '添加'}</button>
          </div>`;
      });
      html += '</div>';
    });

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

  function openReviewPanel(mode) {
    renderReview(mode);
    openPanel('reviewPanel');
  }

  function renderReview(mode) {
    const body = document.getElementById('reviewPanelBody');
    const today = new Date();
    const isMonthly = mode === 'monthly';

    const startDate = new Date(today);
    if (isMonthly) {
      startDate.setDate(1);
    } else {
      startDate.setMonth(0, 1);
    }
    startDate.setHours(0,0,0,0);

    let totalDays = 0, activeDays = 0, totalHabits = habitsConfig.length;
    let totalCheckins = 0, totalPossible = 0;
    const habitStats = {};
    let bestHabit = null, bestCount = 0;
    let maxStreak = 0, currentStreak = 0;

    const d = new Date(startDate);
    while (d <= today) {
      const key = formatDate(d);
      const rec = checkinRecords[key];
      totalDays++;

      let dayHasAny = false;
      habitsConfig.forEach(h => {
        totalPossible++;
        habitStats[h.id] = habitStats[h.id] || {name:h.name, icon:h.icon, done:0, total:0};
        habitStats[h.id].total++;

        if (h.type === 'water') {
          if (((rec && rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000)) {
            totalCheckins++;
            habitStats[h.id].done++;
            dayHasAny = true;
          }
        } else if (h.negative) {
          if ((rec && rec[h.id] && rec[h.id].done) && !rec[h.id].failed) {
            totalCheckins++;
            habitStats[h.id].done++;
            dayHasAny = true;
          }
        } else {
          if ((rec && rec[h.id] && rec[h.id].done)) {
            totalCheckins++;
            habitStats[h.id].done++;
            dayHasAny = true;
          }
        }
      });

      if (dayHasAny) {
        activeDays++;
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }

      d.setDate(d.getDate() + 1);
    }

    const completionRate = totalPossible > 0 ? Math.round((totalCheckins / totalPossible) * 100) : 0;

    Object.values(habitStats).forEach(s => {
      if (s.done > bestCount) { bestCount = s.done; bestHabit = s; }
    });

    const periodLabel = isMonthly ? `${today.getMonth()+1}月` : `${today.getFullYear()}年`;
    const totalPomo = getPomoTotalStats(startDate);

    let html = `
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:14px;color:var(--muted)">${periodLabel}回顾</div>
        <div style="font-size:28px;font-weight:800;background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent">${completionRate}%</div>
        <div style="font-size:13px;color:var(--muted)">总完成率</div>
      </div>
      <div class="report-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="report-card"><div class="rc-num">${activeDays}/${totalDays}</div><div class="rc-label">活跃天</div></div>
        <div class="report-card"><div class="rc-num">${maxStreak}</div><div class="rc-label">最长连续</div></div>
        <div class="report-card"><div class="rc-num">${totalPomo.count}</div><div class="rc-label">番茄数</div></div>
      </div>
      <div style="margin-top:20px;font-size:14px;font-weight:700;margin-bottom:10px">🏆 最常完成的习惯</div>
      ${bestHabit ? `<div style="background:var(--bg2);border-radius:12px;padding:14px;text-align:center;margin-bottom:16px">
        <span style="font-size:24px">${bestHabit.icon}</span>
        <div style="font-size:15px;font-weight:700;margin:4px 0">${bestHabit.name}</div>
        <div style="font-size:13px;color:var(--muted)">${bestHabit.done}/${bestHabit.total} 天</div>
      </div>` : '<div style="color:var(--muted);font-size:13px">暂无数据</div>'}
      <div style="font-size:14px;font-weight:700;margin-bottom:10px">📊 习惯排行</div>
    `;

    Object.values(habitStats).sort((a,b) => (b.done/b.total) - (a.done/a.total)).slice(0, 5).forEach(s => {
      const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      html += `<div class="report-habit-row">
        <span class="report-habit-name">${s.icon} ${s.name}</span>
        <div class="report-habit-bar"><div class="report-habit-fill" style="width:${pct}%;background:var(--accent)"></div></div>
        <span class="report-habit-pct">${pct}%</span>
      </div>`;
    });

    body.innerHTML = html;
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
        <h3>📚 14部养生经典</h3>
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
      <button class="const-btn" style="flex:1" onclick="openReviewPanel('monthly')">📅 月度报告</button>
      <button class="const-btn" style="flex:1" onclick="openReviewPanel('annual')">📆 年度报告</button>
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
        <div class="toggle-switch ${r.enabled ? 'on' : ''}" id="reminderToggle" onclick="toggleReminderEnabled()"></div>
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

  function toggleReminderEnabled() {
    const el = document.getElementById('reminderToggle');
    el.classList.toggle('on');
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

  function togglePack(packId) {
    packExpanded[packId] = !packExpanded[packId];
    const body = document.getElementById(packId + 'Body');
    const toggle = document.getElementById(packId + 'Toggle');
    if (body) body.classList.toggle('expanded', packExpanded[packId]);
    if (toggle) toggle.classList.toggle('expanded', packExpanded[packId]);
  }

  function setPackFilter(filter) {
    packFilter = filter;
    document.querySelectorAll('#myPackFilter .pack-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderMyPack();
  }

  function renderMyPack() {
    const container = document.getElementById('myPackContent');
    const search = (document.getElementById('myPackSearch') && document.getElementById('myPackSearch').value).toLowerCase() || '';
    const enabledCount = habitsConfig.filter(h => h.enabled !== false).length;
    document.getElementById('myPackSubtitle').textContent = `当前 ${habitsConfig.length} 个习惯 · ${enabledCount} 个启用`;

    let filtered = habitsConfig;
    if (packFilter !== 'all') {
      filtered = filtered.filter(h => (CATEGORY_MAP[h.category] && CATEGORY_MAP[h.category].timePeriod) === packFilter);
    }
    if (search) {
      filtered = filtered.filter(h => h.name.toLowerCase().includes(search));
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div class="pack-empty">没有找到习惯<br>点击上方"+ 添加新习惯"</div>';
      return;
    }

    let html = '';
    filtered.forEach(h => {
      const enabled = h.enabled !== false;
      const reminder = h.reminder;
      const reminderStr = reminder && reminder.enabled ? `⏰ ${reminder.time}` : '';
      const typeStr = h.type === 'boolean' ? '打卡' : h.type === 'count' ? `计数(${h.unit})` : h.type === 'water' ? '饮水追踪' : `计时(${h.unit})`;
      const repeatArr = h.repeat || [0,1,2,3,4,5,6];
      const repeatLabel = repeatArr.length === 7 ? '每天' : repeatArr.length === 5 && !repeatArr.includes(0) && !repeatArr.includes(6) ? '工作日' : repeatArr.length === 2 && repeatArr.includes(0) && repeatArr.includes(6) ? '周末' : `每周${repeatArr.length}天`;
      html += `
        <div class="my-habit-item" id="myhabit-${h.id}">
          <span class="mh-icon">${h.icon}</span>
          <div class="mh-info">
            <div class="mh-name">${h.name}</div>
            <div class="mh-meta"><span>${typeStr}</span><span style="cursor:pointer" onclick="toggleRepeat('${h.id}')">${repeatLabel}</span>${reminderStr ? `<span>${reminderStr}</span>` : ''}</div>
          </div>
          <div class="mh-toggle ${enabled ? 'on' : ''}" onclick="toggleHabitEnabled('${h.id}')"></div>
          <div class="mh-actions">
            <button onclick="openTimePanel('${h.id}')">设置</button>
            <button class="mh-delete" onclick="deleteHabit('${h.id}')">删除</button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
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
    renderMyPack();
    renderCheckin();
  }

  function renderSystemPacks() {
    const container = document.getElementById('systemPacks');
    const myIds = new Set(habitsConfig.map(h => h.id));

    const neijingSubPacks = [
      {id:'neijing_spring', name:'春季养生包', emoji:'🌿', data: SEASONAL_PACKS.spring},
      {id:'neijing_summer', name:'夏季养生包', emoji:'☀️', data: SEASONAL_PACKS.summer},
      {id:'neijing_autumn', name:'秋季养生包', emoji:'🍂', data: SEASONAL_PACKS.autumn},
      {id:'neijing_winter', name:'冬季养生包', emoji:'❄️', data: SEASONAL_PACKS.winter},
      {id:'neijing_color', name:'五色饮食包', emoji:'🎨', data:{habits:HABIT_LIBRARY.filter(h=>h.category==='color_diet').map(h=>({id:h.id}))}},
      {id:'neijing_emotion', name:'情志养生包', emoji:'💭', data:{habits:HABIT_LIBRARY.filter(h=>h.category==='emotion').map(h=>({id:h.id}))}},
      {id:'neijing_wulao', name:'五劳防护包', emoji:'🛡️', data:{habits:HABIT_LIBRARY.filter(h=>h.category==='wulao').map(h=>({id:h.id}))}}
    ];

    const packs = [
      {id:'healthPack', name:'健康生活建议包', emoji:'💚', desc:'基于医学研究的一日健康作息方案', data: HEALTH_PACK},
      {id:'neijingPack', name:'黄帝内经养生包', emoji:'📜', desc:'四季养生·五色饮食·情志调理·五劳防护', subPacks: neijingSubPacks}
    ];

    let html = '';
    packs.forEach(pack => {
      if (pack.subPacks) {
        const isExpanded = packExpanded[pack.id] || false;
        let allSubAdded = 0, allSubTotal = 0;
        pack.subPacks.forEach(sp => {
          const spHabits = sp.data.habits || [];
          allSubTotal += spHabits.length;
          allSubAdded += spHabits.filter(ph => myIds.has(ph.id)).length;
        });
        const allAdded = allSubTotal > 0 && allSubAdded === allSubTotal;

        html += `
          <div class="pack-card" id="${pack.id}Card">
            <div class="pack-header" onclick="togglePack('${pack.id}')">
              <div class="pack-header-left">
                <span class="pack-emoji">${pack.emoji}</span>
                <div>
                  <div class="pack-title">${pack.name}</div>
                  <div class="pack-subtitle">${allAdded ? '✅ 已全部添加' : `${allSubTotal}个习惯 · 已添加 ${allSubAdded}/${allSubTotal}`}</div>
                </div>
              </div>
              <span class="pack-toggle ${isExpanded ? 'expanded' : ''}" id="${pack.id}Toggle">▼</span>
            </div>
            <div class="pack-body ${isExpanded ? 'expanded' : ''}" id="${pack.id}Body">
              <div class="pack-quote">《黄帝内经》："法于阴阳，和于术数，食饮有节，起居有常，不妄作劳。"</div>
              <div class="pack-tip">涵盖四季养生（春夏秋冬）、五色饮食（青赤黄白黑养五脏）、情志养生（怒喜思悲恐）、五劳防护（久视久坐久立久卧久行）。</div>`;

        pack.subPacks.forEach(sp => {
          const spExpanded = packExpanded[sp.id] || false;
          const spHabits = sp.data.habits || [];
          const spAdded = spHabits.filter(ph => myIds.has(ph.id)).length;
          const spAllAdded = spAdded === spHabits.length;

          html += `
              <div class="sub-pack-card" id="${sp.id}Card" style="border:1px solid var(--rule);border-radius:var(--radius);margin-bottom:10px;overflow:hidden">
                <div class="pack-header" onclick="togglePack('${sp.id}')" style="padding:10px 14px;background:var(--bg2)">
                  <div class="pack-header-left">
                    <span class="pack-emoji" style="font-size:20px">${sp.emoji}</span>
                    <div>
                      <div class="pack-title" style="font-size:14px">${sp.name}</div>
                      <div class="pack-subtitle" style="font-size:11px">${spAllAdded ? '✅ 已全部添加' : `${spHabits.length}个习惯 · 已添加 ${spAdded}/${spHabits.length}`}</div>
                    </div>
                  </div>
                  <span class="pack-toggle ${spExpanded ? 'expanded' : ''}" id="${sp.id}Toggle" style="font-size:12px">▼</span>
                </div>
                <div class="pack-body ${spExpanded ? 'expanded' : ''}" id="${sp.id}Body" style="padding:10px 14px">
                  <div class="pack-actions" style="margin-bottom:8px">
                    ${spAllAdded ?
                      `<button class="custom-import" style="flex:1" onclick="removeSubPack('${sp.id}')">📤 解除导入</button>` :
                      `<button class="custom-import" style="flex:1" onclick="importPack('${sp.id}')">📥 一键导入</button>`
                    }
                  </div>`;

          spHabits.forEach(ph => {
            const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
            if (!lib) return;
            const isAdded = myIds.has(ph.id);
            const tipStr = lib.tip || '';
            html += `
                  <div class="sub-pack-habit" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--rule)">
                    <span style="font-size:18px">${lib.icon}</span>
                    <div style="flex:1">
                      <div style="font-size:13px;font-weight:600">${lib.name}</div>
                      ${tipStr ? `<div style="font-size:11px;color:var(--accent);margin-top:2px;line-height:1.4">💡 ${tipStr}</div>` : ''}
                    </div>
                    <span class="ph-status ${isAdded ? 'added' : 'add'}">${isAdded ? '✓ 已添加' : '未添加'}</span>
                  </div>`;
          });

          html += `
                </div>
              </div>`;
        });

        if (allAdded) {
          html += `
              <div class="pack-actions">
                <button class="custom-import" style="flex:1" onclick="showToast('该包习惯已全部添加')">✅ 已全部导入</button>
              </div>`;
        }
        html += `</div></div>`;
      }
    });
    container.innerHTML = html;
  }

  function importPack(packId) {
    const packMap = {
      'healthPack': HEALTH_PACK,
      'neijingPack': (() => {
        const h = [];
        Object.values(SEASONAL_PACKS).forEach(sp => {
          sp.habits.forEach(x => { if (!h.find(y=>y.id===x.id)) h.push(x); });
        });
        HABIT_LIBRARY.filter(x=>['color_diet','emotion','wulao'].includes(x.category)).forEach(x => {
          if (!h.find(y=>y.id===x.id)) h.push({id:x.id});
        });
        return {habits: h};
      })(),
      'neijing_spring': SEASONAL_PACKS.spring,
      'neijing_summer': SEASONAL_PACKS.summer,
      'neijing_autumn': SEASONAL_PACKS.autumn,
      'neijing_winter': SEASONAL_PACKS.winter,
      'neijing_color': {habits: HABIT_LIBRARY.filter(h=>h.category==='color_diet').map(h=>({id:h.id}))},
      'neijing_emotion': {habits: HABIT_LIBRARY.filter(h=>h.category==='emotion').map(h=>({id:h.id}))},
      'neijing_wulao': {habits: HABIT_LIBRARY.filter(h=>h.category==='wulao').map(h=>({id:h.id}))}
    };
    const pack = packMap[packId];
    if (!pack) return;

    const packIds = new Set(pack.habits.map(ph => ph.id));
    let removedCount = 0;
    habitsConfig = habitsConfig.filter(h => {
      if (packIds.has(h.id)) {
        removedCount++;
        return false;
      }
      return true;
    });

    const myIds = new Set(habitsConfig.map(h => h.id));
    let addedCount = 0;
    pack.habits.forEach(ph => {
      if (myIds.has(ph.id)) return;
      const lib = HABIT_LIBRARY.find(h => h.id === ph.id);
      if (!lib) return;
      const newHabit = {
        id: lib.id, name: lib.name, icon: lib.icon, category: lib.category,
        type: lib.type, unit: lib.unit, enabled: true,
        reminder: {enabled:false, time:'08:00', days:[0,1,2,3,4,5,6], method:'in-app'}
      };
      if (ph.reminder) {
        newHabit.reminder = {enabled: ph.reminder.enabled, time: ph.reminder.time, days:[0,1,2,3,4,5,6], method:'in-app'};
      }
      if (lib.type === 'water' && lib.waterConfig) {
        newHabit.waterConfig = JSON.parse(JSON.stringify(lib.waterConfig));
        newHabit.reminder = {enabled:true, method:'in-app'};
      }
      habitsConfig.push(newHabit);
      myIds.add(ph.id);
      addedCount++;
    });
    if (addedCount > 0 || removedCount > 0) {
      saveConfig();
      const msg = [];
      if (removedCount > 0) msg.push(`已替换 ${removedCount} 个现有习惯`);
      if (addedCount > 0) msg.push(`已导入 ${addedCount} 个新习惯`);
      showToast(msg.join('，'));
      renderSystemPacks();
      renderMyPack();
      render();
    } else {
      showToast('包内习惯已全部添加');
    }
  }

  function removeSubPack(spId) {
    const spMap = {
      'neijing_spring': SEASONAL_PACKS.spring,
      'neijing_summer': SEASONAL_PACKS.summer,
      'neijing_autumn': SEASONAL_PACKS.autumn,
      'neijing_winter': SEASONAL_PACKS.winter,
      'neijing_color': {habits: HABIT_LIBRARY.filter(h=>h.category==='color_diet').map(h=>({id:h.id}))},
      'neijing_emotion': {habits: HABIT_LIBRARY.filter(h=>h.category==='emotion').map(h=>({id:h.id}))},
      'neijing_wulao': {habits: HABIT_LIBRARY.filter(h=>h.category==='wulao').map(h=>({id:h.id}))}
    };
    const sp = spMap[spId];
    if (!sp) return;
    const ids = new Set(sp.habits.map(ph => ph.id));
    const before = habitsConfig.length;
    habitsConfig = habitsConfig.filter(h => !ids.has(h.id));
    const removed = before - habitsConfig.length;
    if (removed > 0) {
      saveConfig();
      showToast(`已解除导入 ${removed} 个习惯`);
      renderSystemPacks();
      renderMyPack();
      render();
    } else {
      showToast('该子包没有习惯需要解除');
    }
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
    openReviewPanel,
    renderReview,
    getPomoTotalStats,
    openRefPanel,
    renderRefPanel,
    switchRefTab,
    openEmotionPanel,
    renderEmotionPanel,
    selectEmotion,
    openClockPanel,
    openWulaoPanel,
    toggleGroup,
    renderWulaoPanel,
    openHealthReportPanel,
    renderHealthReport,
    openDataPanel,
    openRetroactivePanel,
    openDailyAchievementCard,
    openReminderPanel,
    setGlobalReminder,
    openTimePanel,
    toggleReminderEnabled,
    toggleDay,
    saveTimeSettings,
    togglePack,
    setPackFilter,
    renderMyPack,
    toggleRepeat,
    renderSystemPacks,
    importPack,
    removeSubPack,
    openWaterInputPanel,
    openWaterWeekPanel,
    openWaterSettingsPanel,
    addWaterScheduleRow,
    removeWaterScheduleRow,
    saveWaterSettings
  };
})();
