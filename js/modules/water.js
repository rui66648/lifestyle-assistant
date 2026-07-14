// water.js - 饮水追踪模块
(function() {
  function renderWaterTracker(h, rec) {
    const wc = h.waterConfig || {dailyGoal:2000, perCup:250};
    const goal = wc.dailyGoal || 2000;
    const perCup = wc.perCup || 250;
    const waterRec = rec[h.id] || {};
    const value = waterRec.value || 0;
    const cups = waterRec.cups || [];
    const pct = Math.min(100, Math.round((value / goal) * 100));
    const remaining = Math.max(0, goal - value);
    const remainingCups = Math.ceil(remaining / perCup);
    const totalCups = Math.round(goal / perCup);
    const doneCups = Math.round(value / perCup);
    const streak = getStreak(h.id);

    let fillClass = '';
    if (pct >= 80) fillClass = 'high';
    else if (pct >= 50) fillClass = 'mid';

    let cupsViz = `<div class="water-cups-row">`;
    for (let i = 0; i < totalCups; i++) {
      const filled = i < doneCups;
      const isNext = i === doneCups;
      const clickAttr = filled ? '' : `onclick="quickAddWater('${h.id}',${perCup})"`;

      cupsViz += `<div class="water-cup-item">
        <div class="water-cup ${filled ? 'filled' : ''} ${isNext ? 'next' : ''}" ${clickAttr} title="${filled ? '已喝 ✓' : '点击记录一杯'}">
          <span class="water-cup-num">${i+1}</span>
          ${filled ? '<span class="water-cup-check">✓</span>' : ''}
        </div>
      </div>`;
    }
    cupsViz += `</div>`;

    let smartTip = '';
    if (cups.length > 0) {
      const lastCup = cups[cups.length - 1];
      const [lh, lm] = lastCup.time.split(':').map(Number);
      const lastMinutes = lh * 60 + lm;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const diffMinutes = currentMinutes - lastMinutes;
      if (diffMinutes >= 120) {
        const hours = Math.floor(diffMinutes / 60);
        const mins = diffMinutes % 60;
        smartTip = `<div class="water-smart-tip">⏰ 距离上次喝水已 ${hours}小时${mins > 0 ? mins + '分钟' : ''}，建议补充${perCup}ml</div>`;
      }
    } else if (value === 0) {
      smartTip = `<div class="water-smart-tip">💧 今天还没喝水哦，来一杯吧！</div>`;
    }

    let cupsHtml = '';
    if (cups.length > 0) {
      cupsHtml = '<div style="font-size:11px;color:var(--muted);margin-top:6px">今日：';
      cups.forEach((c, i) => {
        if (i > 0) cupsHtml += '、';
        cupsHtml += `${c.time} ${c.amount}ml`;
      });
      cupsHtml += '</div>';
    }

    return `<div class="water-tracker" id="card-${h.id}">
      <div class="water-header">
        <div class="water-title">${esc(h.icon)} ${esc(h.name)} ${streak > 0 ? `<span style="font-size:11px;color:var(--accent);background:var(--accent-light);padding:2px 8px;border-radius:10px;font-weight:600">🔥${streak}天</span>` : ''}</div>
        <div class="water-amount">${doneCups}杯(${value}ml) / ${totalCups}杯(${goal}ml)</div>
      </div>
      <div class="water-progress">
        <div class="water-progress-fill ${fillClass}" style="width:${pct}%"></div>
        <div class="water-progress-text">${pct}%</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${remaining > 0 ? `还需 ${remainingCups}杯(${remaining}ml)` : '今日目标已达成！🎉'}</div>
      ${smartTip}
      ${cupsViz}
      <div class="water-quick-row" style="margin:8px 0">
        <span class="water-qty-group">
          <button class="water-qty-btn" onclick="quickAddWater('${h.id}',${Math.round(perCup/2)})">${Math.round(perCup/2)}ml</button>
          <button class="water-qty-btn primary" onclick="quickAddWater('${h.id}',${perCup})">${perCup}ml</button>
          <button class="water-qty-btn" onclick="quickAddWater('${h.id}',${perCup*2})">${perCup*2}ml</button>
        </span>
        <button class="water-custom-btn" onclick="openWaterInputPanel('${h.id}')" title="自定义量">✏️ 自定义</button>
      </div>
      ${cupsHtml}
    </div>`;
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Water = {
    renderWaterTracker
  };

  if (App.registerModule) {
    App.registerModule('modules.water', 'modules', null);
  }
})();
