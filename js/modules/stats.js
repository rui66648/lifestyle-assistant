(function() {
  function renderWeekBarChart() {
    const container = document.getElementById('weekBarChart');
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

  function renderHeatmap() {
    const year = heatmapDate.getFullYear();
    const month = heatmapDate.getMonth();
    document.getElementById('heatmapMonth').textContent = `${year}年${month+1}月`;
    const grid = document.getElementById('heatmapGrid');
    const dayLabels = ['一','二','三','四','五','六','日'];
    let html = dayLabels.map(l => `<div class="heatmap-day-label">${l}</div>`).join('');

    const firstDay = new Date(year, month, 1);
    let startWeekday = firstDay.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = today();

    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="heatmap-cell empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const rec = checkinRecords[key] || {};
      const total = habitsConfig.length;
      let doneCount = 0;
      habitsConfig.forEach(h => {
        if (rec[h.id] && rec[h.id].done) doneCount++;
      });
      const ratio = total > 0 ? doneCount / total : 0;
      let cls = '';
      if (ratio > 0 && ratio <= 0.25) cls = 'l1';
      else if (ratio > 0.25 && ratio <= 0.5) cls = 'l2';
      else if (ratio > 0.5 && ratio <= 0.75) cls = 'l3';
      else if (ratio > 0.75) cls = 'l4';
      const todayCls = key === todayStr ? ' today' : '';
      html += `<div class="heatmap-cell ${cls}${todayCls}" title="${key}: ${doneCount}/${total}"></div>`;
    }

    grid.innerHTML = html;
  }

  function changeMonth(delta) {
    heatmapDate.setMonth(heatmapDate.getMonth() + delta);
    renderHeatmap();
  }

  function renderAchievements() {
    const container = document.getElementById('achievements');
    const badges = [
      {id:'streak7',label:'7天连续',icon:'🔥',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 7)},
      {id:'streak14',label:'14天连续',icon:'🔥',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 14)},
      {id:'streak30',label:'30天连续',icon:'⭐',check: () => habitsConfig.some(h => getMaxStreak(h.id) >= 30)},
      {id:'all_done',label:'全部完成',icon:'🏆',check: () => {
        const rec = checkinRecords[today()] || {};
        return habitsConfig.length > 0 && habitsConfig.every(h => rec[h.id] && rec[h.id].done);
      }}
    ];

    container.innerHTML = badges.map(b => {
      const unlocked = b.check();
      return `<div class="badge">
        <div class="badge-icon ${unlocked ? 'unlocked' : 'locked'}">${b.icon}</div>
        <div class="badge-label ${unlocked ? 'unlocked' : ''}">${b.label}</div>
      </div>`;
    }).join('');
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

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Stats = {
    renderWeekBarChart,
    renderHeatmap,
    changeMonth,
    renderAchievements,
    exportCSV
  };
})();
