// stats.js - 统计模块（函数定义已统一至 js/ui/render.js 和 js/ui/events.js）
// 仅保留 renderWeekBarChart（唯一未被重复定义的函数）
(function() {
  function renderWeekBarChart(containerId) {
    const container = document.getElementById(containerId || 'weekBarChart');
    if (!container) return;

    const dayNames = ['日','一','二','三','四','五','六'];
    const today = new Date();
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = formatDate(d);
      const rec = checkinRecords[key] || {};
      let done = 0, total = 0;
      habitsConfig.forEach(h => {
        total++;
        if (h.type === 'water') {
          if (((rec[h.id] && rec[h.id].value) || 0) >= ((h.waterConfig && h.waterConfig.dailyGoal) || 2000)) done++;
        } else if (h.negative) {
          if ((rec[h.id] && rec[h.id].done) && !rec[h.id].failed) done++;
        } else if ((rec[h.id] && rec[h.id].done)) done++;
      });
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      data.push({ day: dayNames[d.getDay()], date: `${d.getMonth()+1}/${d.getDate()}`, pct, isToday: i === 0 });
    }

    const maxH = 120;
    let html = '<div style="display:flex;align-items:flex-end;justify-content:space-between;height:' + (maxH + 30) + 'px;gap:8px">';
    data.forEach(d => {
      const h = Math.max(2, (d.pct / 100) * maxH);
      const isToday = d.isToday;
      const color = isToday ? 'background:linear-gradient(180deg,var(--accent),var(--accent2))' : 'background:var(--accent-light)';
      html += `<div style="flex:1;text-align:center">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;font-weight:${isToday?'700':'400'}">${d.pct}%</div>
        <div style="width:100%;height:${h}px;${color};border-radius:6px 6px 4px 4px;margin:0 auto;transition:height .5s"></div>
        <div style="font-size:11px;color:${isToday?'var(--accent)':'var(--muted)'};margin-top:4px;font-weight:${isToday?'700':'400'}">${d.isToday ? '今天' : d.day}</div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Stats = {
    renderWeekBarChart
  };

  if (App.registerModule) {
    App.registerModule('modules.stats', 'modules', null);
  }
})();
