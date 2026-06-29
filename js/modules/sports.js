(function() {
  function loadSportsData() {
    if (!App.Data.Sports) {
      App.Data.Sports = {
        records: [],
        weeklyStats: { aerobic: 0, strength: 0, coordination: 0 },
      };
    }
    const saved = localStorage.getItem('sports_records');
    if (saved) {
      try {
        App.Data.Sports.records = JSON.parse(saved);
      } catch(e) {}
    }
  }

  function updateWeeklyStats() {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const records = App.Data.Sports.records || [];
    const weekRecords = records.filter(r => r.date >= weekStartStr);

    const stats = { aerobic: 0, strength: 0, coordination: 0 };
    weekRecords.forEach(r => {
      if (stats[r.category] !== undefined) {
        stats[r.category] += r.value;
      }
    });

    App.Data.Sports.weeklyStats = stats;
    return stats;
  }

  function quickCheckin(sportId) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    const today = new Date().toISOString().split('T')[0];
    const record = {
      id: `sport_${sportId}_${Date.now()}`,
      sportId: sportId,
      sportName: sport.name,
      sportIcon: sport.icon,
      category: sport.category,
      value: sport.target,
      unit: sport.unit,
      date: today,
      time: new Date().toTimeString().slice(0, 5),
    };

    if (!App.Data.Sports.records) App.Data.Sports.records = [];
    App.Data.Sports.records.push(record);
    localStorage.setItem('sports_records', JSON.stringify(App.Data.Sports.records));

    if (App.Core && App.Core.Utils && App.Core.Utils.showToast) {
      App.Core.Utils.showToast(`${sport.icon} ${sport.name} 已打卡 ${sport.target}${sport.unit}！`);
    }
    updateWeeklyStats();
  }

  function showCheckinDialog(sportId) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
      <div class="dialog">
        <div class="dialog-header">
          <span>${sport.icon} ${sport.name}</span>
          <button class="dialog-close">✕</button>
        </div>
        <div class="dialog-body">
          <div class="dialog-tip">${sport.tip}</div>
          <div class="dialog-input-group">
            <label>完成 ${sport.unit}</label>
            <input type="number" id="sportsValueInput" value="${sport.target}" min="1" placeholder="输入数值">
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn cancel">取消</button>
          <button class="dialog-btn confirm">确认打卡</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.cancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.confirm').addEventListener('click', () => {
      const value = parseInt(document.getElementById('sportsValueInput').value) || sport.target;
      confirmCheckin(sportId, value);
      dialog.remove();
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  function confirmCheckin(sportId, value) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    const today = new Date().toISOString().split('T')[0];
    const record = {
      id: `sport_${sportId}_${Date.now()}`,
      sportId: sportId,
      sportName: sport.name,
      sportIcon: sport.icon,
      category: sport.category,
      value: value,
      unit: sport.unit,
      date: today,
      time: new Date().toTimeString().slice(0, 5),
    };

    if (!App.Data.Sports.records) App.Data.Sports.records = [];
    App.Data.Sports.records.push(record);
    localStorage.setItem('sports_records', JSON.stringify(App.Data.Sports.records));

    if (App.Core && App.Core.Utils && App.Core.Utils.showToast) {
      App.Core.Utils.showToast(`${sport.icon} ${sport.name} 已打卡 ${value}${sport.unit}！`);
    }
    updateWeeklyStats();
  }

  function getCurrentMeridian() {
    const meridianSports = App.Data.MeridianSports;
    const now = new Date();
    const hour = now.getHours();
    return meridianSports.find(m => hour >= m.start && hour < m.end) || meridianSports[0];
  }

  function getRandomQuote() {
    const quotes = App.Data.SportQuotes;
    return quotes[Math.floor(Math.random() * quotes.length)];
  }

  function getSportsHabits() {
    if (!window.habitsConfig || !window.checkinRecords || !App || !App.Core || !App.Core.Utils) {
      return { habits: [], completed: 0, total: 0 };
    }
    const sportsHabits = habitsConfig.filter(h => h.category === 'sports');
    const today = App.Core.Utils.today();
    const todayRec = checkinRecords[today] || {};
    let completed = 0;
    sportsHabits.forEach(h => {
      if (todayRec[h.id] && todayRec[h.id].done) completed++;
    });
    return { habits: sportsHabits, completed, total: sportsHabits.length };
  }

  function renderSportsPanel() {
    loadSportsData();
    updateWeeklyStats();

    const categories = App.Data.SportsCategories;
    const prescriptions = App.Data.SportPrescriptions;
    const meridianSports = App.Data.MeridianSports;
    const dailyTargets = App.Data.DailyTargets;
    const currentMeridian = getCurrentMeridian();
    const quote = getRandomQuote();
    const hour = new Date().getHours();
    const sportsHabits = getSportsHabits();

    return `
      <div class="sports-panel">
        <div class="sports-prescription">
          <div class="sports-prescription-header">
            <span class="sports-prescription-icon">${currentMeridian.icon}</span>
            <div>
              <div class="sports-prescription-title">${currentMeridian.name} · ${currentMeridian.meridian}</div>
              <div class="sports-prescription-desc">${currentMeridian.highlight ? '⭐ 最佳运动时段' : currentMeridian.action}</div>
            </div>
          </div>
          <div class="sports-daily-targets">
            ${Object.entries(dailyTargets).map(([key, target]) => `
              <div class="sports-target-item">
                <span class="sports-target-label">${target.label}</span>
                <span class="sports-target-value">${target.target}${target.unit}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="sports-quote">
          <div class="sports-quote-text">"${quote.text}"</div>
          <div class="sports-quote-source">—— ${quote.source}</div>
        </div>

        ${sportsHabits.total > 0 ? `
          <div class="sports-summary">
            <div class="sports-summary-item">
              <span class="sports-summary-val">${sportsHabits.completed}/${sportsHabits.total}</span>
              <span class="sports-summary-label">今日运动习惯</span>
            </div>
            <div class="sports-summary-divider"></div>
            <div class="sports-summary-item">
              <span class="sports-summary-val">${currentMeridian.icon} ${currentMeridian.name}</span>
              <span class="sports-summary-label">当前时辰</span>
            </div>
          </div>
        ` : ''}

        <div class="sports-section-title">⚡ 快速打卡</div>
        <div class="sports-quick-cards">
          ${Object.entries(categories).map(([key, cat]) => {
            const sports = App.Data.SportsTypes.filter(s => s.category === key).slice(0, 3);
            return `
              <div class="sports-quick-card" style="--cat-color: ${cat.color}">
                <div class="sports-quick-card-header">
                  <span>${cat.icon}</span>
                  <span>${cat.label}</span>
                </div>
                <div class="sports-quick-card-items">
                  ${sports.map(s => `
                    <button class="sports-quick-btn" onclick="App.Modules.Sports.quickCheckin('${s.id}')">
                      ${s.icon} ${s.name}
                    </button>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="sports-section-title">📋 全部运动类型</div>
        <div class="sports-type-list">
          ${Object.entries(categories).map(([key, cat]) => `
            <div class="sports-category" style="--cat-color: ${cat.color}">
              <div class="sports-category-header">
                <span>${cat.icon}</span>
                <span>${cat.label}</span>
                <span class="sports-category-desc">${cat.desc}</span>
              </div>
              <div class="sports-category-items">
                ${App.Data.SportsTypes.filter(s => s.category === key).map(s => `
                  <div class="sports-type-item">
                    <span class="sports-type-icon">${s.icon}</span>
                    <div class="sports-type-info">
                      <span class="sports-type-name">${s.name}</span>
                      <span class="sports-type-tip">${s.tip}</span>
                    </div>
                    <button class="sports-type-checkin-btn" onclick="App.Modules.Sports.showCheckinDialog('${s.id}')">打卡</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">💊 运动处方</div>
        <div class="sports-prescription-cards">
          ${Object.values(prescriptions).map(p => `
            <div class="sports-prescription-card">
              <div class="sports-prescription-card-header">
                <span class="sports-prescription-card-icon">${p.icon}</span>
                <span class="sports-prescription-card-title">${p.title}</span>
              </div>
              <div class="sports-prescription-card-body">
                <div class="sports-prescription-card-row">
                  <span>时长</span>
                  <span>${p.duration}</span>
                </div>
                <div class="sports-prescription-card-row">
                  <span>强度</span>
                  <span>${p.intensity}</span>
                </div>
                <div class="sports-prescription-card-row">
                  <span>效果</span>
                  <span>${p.effect}</span>
                </div>
              </div>
              <div class="sports-prescription-card-tip">${p.tip}</div>
              <div class="sports-prescription-card-ref">📖 ${p.ref}</div>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">⏰ 子午流注运动指南</div>
        <div class="sports-meridian-list">
          ${meridianSports.map(m => `
            <div class="sports-meridian-item ${m.highlight ? 'highlight' : ''} ${hour >= m.start && hour < m.end ? 'current' : ''}">
              <span class="sports-meridian-icon">${m.icon}</span>
              <span class="sports-meridian-time">${m.name}</span>
              <span class="sports-meridian-meridian">${m.meridian}</span>
              <span class="sports-meridian-action">${m.action}</span>
            </div>
          `).join('')}
        </div>

        <div class="sports-section-title">🥗 运动营养</div>
        <div class="sports-nutrition-cards">
          ${Object.values(App.Data.SportNutrition).map(n => `
            <div class="sports-nutrition-card">
              <div class="sports-nutrition-card-header">${n.title}</div>
              <div class="sports-nutrition-card-time">${n.time}</div>
              <div class="sports-nutrition-card-detail">
                <div><strong>碳水</strong>: ${n.carbs}</div>
                <div><strong>蛋白</strong>: ${n.protein}</div>
              </div>
              <div class="sports-nutrition-card-tip">${n.tip}</div>
            </div>
          `).join('')}
        </div>

        ${sportsHabits.total > 0 ? `
          <div class="sports-section-title">📚 运动相关习惯</div>
          <div class="sports-habits-list">
            ${sportsHabits.habits.map(h => {
              const today = App.Core.Utils.today();
              const todayRec = checkinRecords[today] || {};
              const done = todayRec[h.id] && todayRec[h.id].done;
              return `
                <div class="sports-habit-item ${done ? 'done' : ''}" onclick="handleCheckin('${h.id}')">
                  <span class="sports-habit-icon">${h.icon}</span>
                  <span class="sports-habit-name">${h.name}</span>
                  <span class="sports-habit-check">${done ? '✓' : '打卡'}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <div class="sports-section-title">📖 参考文献</div>
        <div class="sports-refs">
          ${App.Data.SportReferences.map(r => `
            <a class="sports-ref-item" href="${r.url}" target="_blank">
              <span>${r.emoji}</span>
              <div class="sports-ref-info">
                <span class="sports-ref-name">${r.name}</span>
                <span class="sports-ref-desc">${r.desc}</span>
              </div>
              <span class="sports-ref-arrow">›</span>
            </a>
          `).join('')}
        </div>

        <div style="height:20px"></div>
      </div>
    `;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Sports = {
    renderSportsPanel,
    quickCheckin,
    showCheckinDialog,
    updateWeeklyStats,
    loadSportsData,
  };

  if (App.registerModule) {
    App.registerModule('modules.sports', 'modules', null);
  }
})();
