/**
 * 运动模块 - 基于《运动改造大脑》等参考文献
 */
if (!App.Modules) App.Modules = {};

App.Modules.Sports = {
  // 面板ID
  panelId: 'sportsPanel',

  // 初始化
  init() {
    this.loadData();
    this.bindEvents();
  },

  // 加载运动数据
  loadData() {
    if (!App.Data.Sports) {
      App.Data.Sports = {
        records: [],      // 运动记录
        weeklyStats: { aerobic: 0, strength: 0, coordination: 0 },  // 周统计
      };
    }
  },

  // 绑定事件
  bindEvents() {
    // 面板切换事件
    const panel = document.getElementById(this.panelId);
    if (panel) {
      panel.addEventListener('panelOpen', () => this.render());
    }
  },

  // 打开面板
  open() {
    const existing = document.getElementById(this.panelId);
    if (existing) {
      this._showPanel(existing);
      this.render();
      return;
    }

    const panel = document.createElement('div');
    panel.id = this.panelId;
    panel.className = 'panel';
    panel.innerHTML = this.getPanelHTML();
    document.body.appendChild(panel);

    this._showPanel(panel);
    this.render();
    this.bindPanelEvents();
  },

  _showPanel(panel) {
    const overlay = document.getElementById('panelOverlay');
    if (overlay) overlay.classList.add('show');
    panel.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (App.UI.Panels && App.UI.Panels.attachPanelGesture) {
      App.UI.Panels.attachPanelGesture(panel);
    }
  },

  // 关闭面板
  close() {
    const panel = document.getElementById(this.panelId);
    if (panel) {
      panel.classList.remove('show');
      const overlay = document.getElementById('panelOverlay');
      if (overlay) overlay.classList.remove('show');
      document.body.style.overflow = '';
      setTimeout(() => panel.remove(), 300);
    }
  },

  // 获取面板HTML
  getPanelHTML() {
    const categories = App.Data.SportsCategories;
    const prescriptions = App.Data.SportPrescriptions;
    const meridianSports = App.Data.MeridianSports;
    const dailyTargets = App.Data.DailyTargets;
    const quotes = App.Data.SportQuotes;

    // 获取当前时辰
    const now = new Date();
    const hour = now.getHours();
    const currentMeridian = meridianSports.find(m => hour >= m.start && hour < m.end) || meridianSports[0];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];

    return `
        <!-- 今日处方 -->
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

        <!-- 今日名言 -->
        <div class="sports-quote">
          <div class="sports-quote-text">"${quote.text}"</div>
          <div class="sports-quote-source">—— ${quote.source}</div>
        </div>

        <!-- 快速打卡 -->
        <div class="sports-section">
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
                      <button class="sports-quick-btn" data-sport-id="${s.id}">
                        ${s.icon} ${s.name}
                      </button>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 运动类型 -->
        <div class="sports-section">
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
                    <div class="sports-type-item" data-sport-id="${s.id}">
                      <span class="sports-type-icon">${s.icon}</span>
                      <div class="sports-type-info">
                        <span class="sports-type-name">${s.name}</span>
                        <span class="sports-type-tip">${s.tip}</span>
                      </div>
                      <button class="sports-type-checkin-btn" data-sport-id="${s.id}">打卡</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 运动处方卡片 -->
        <div class="sports-section">
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
        </div>

        <!-- 子午流注 -->
        <div class="sports-section">
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
        </div>

        <!-- 运动营养 -->
        <div class="sports-section">
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
        </div>

        <!-- 参考文献 -->
        <div class="sports-section">
          <div class="sports-section-title">📚 参考文献</div>
          <div class="sports-refs">
            ${App.Data.SportReferences.map(r => `
              <a class="sports-ref-item" href="${r.url}" target="_blank">
                <span>${r.emoji}</span>
                <div class="sports-ref-info">
                  <span class="sports-ref-name">${r.name}</span>
                  <span class="sports-ref-desc">${r.desc}</span>
                </div>
                <span class="sports-ref-arrow">→</span>
              </a>
            `).join('')}
          </div>
        </div>
    `;
  },

  // 绑定面板事件
  bindPanelEvents() {
    // 快速打卡按钮
    document.querySelectorAll('.sports-quick-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sportId = e.target.dataset.sportId;
        this.quickCheckin(sportId);
      });
    });

    // 打卡按钮
    document.querySelectorAll('.sports-type-checkin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sportId = e.target.dataset.sportId;
        this.showCheckinDialog(sportId);
      });
    });
  },

  // 快速打卡
  quickCheckin(sportId) {
    const sport = App.Data.SportsTypes.find(s => s.id === sportId);
    if (!sport) return;

    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0];

    // 保存记录
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

    // 保存到localStorage
    localStorage.setItem('sports_records', JSON.stringify(App.Data.Sports.records));

    // 显示成功提示
    this.showToast(`${sport.icon} ${sport.name} 已打卡 ${sport.target}${sport.unit}！`);

    // 更新统计
    this.updateWeeklyStats();
  },

  // 显示打卡对话框
  showCheckinDialog(sportId) {
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
            <input type="number" id="sportsValue" value="${sport.target}" min="1" placeholder="输入数值">
          </div>
        </div>
        <div class="dialog-footer">
          <button class="dialog-btn cancel">取消</button>
          <button class="dialog-btn confirm">确认打卡</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);

    // 绑定事件
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.cancel').addEventListener('click', () => dialog.remove());
    dialog.querySelector('.confirm').addEventListener('click', () => {
      const value = parseInt(document.getElementById('sportsValue').value) || sport.target;
      this.confirmCheckin(sportId, value);
      dialog.remove();
    });

    // 点击背景关闭
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  },

  // 确认打卡
  confirmCheckin(sportId, value) {
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

    this.showToast(`${sport.icon} ${sport.name} 已打卡 ${value}${sport.unit}！`);
    this.updateWeeklyStats();
  },

  // 显示提示
  showToast(message) {
    const toast = document.getElementById('toast') || document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.textContent = message;
    if (!document.getElementById('toast')) {
      document.body.appendChild(toast);
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  },

  // 更新周统计
  updateWeeklyStats() {
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
  },

  // 渲染
  render() {
    // 渲染统计数据
    this.updateWeeklyStats();
  },
};

if (App.registerModule) {
  App.registerModule('modules.sports', 'modules', null);
}
