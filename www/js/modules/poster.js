(function() {
  // 中文字体栈：覆盖 iOS / Android / Windows / macOS 主流中文字体
  var CN_FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Source Han Sans CN", "Noto Sans CJK SC", sans-serif';

  // roundRect polyfill（旧版浏览器兼容）
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
  }

  function openPosterPanel() {
    generatePoster();
    openPanel('posterPanel');
  }

  function generatePoster() {
    var canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = 640, h = 960;
    // 高 DPR 渲染保证清晰：物理像素 = 逻辑像素 × dpr
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. 背景：4 stop 渐变营造层次（暖米色 → 浅米 → 浅米 → 暖白）
    var bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#FDF8F0');
    bgGrad.addColorStop(0.45, '#FAF1E2');
    bgGrad.addColorStop(0.85, '#F5EDE0');
    bgGrad.addColorStop(1, '#FFFDF8');
    ctx.fillStyle = bgGrad;
    roundRect(ctx, 0, 0, w, h, 24);
    ctx.fill();

    // 2. 顶部圆角装饰条（渐变绿）
    var topGrad = ctx.createLinearGradient(0, 0, w, 0);
    topGrad.addColorStop(0, '#7CB69D');
    topGrad.addColorStop(0.5, '#A8D5BA');
    topGrad.addColorStop(1, '#7CB69D');
    ctx.fillStyle = topGrad;
    roundRect(ctx, 0, 0, w, 10, { tl: 24, tr: 24, br: 0, bl: 0 });
    ctx.fill();

    // 3. 标题（带柔和阴影提升可读性）
    ctx.save();
    ctx.shadowColor = 'rgba(124, 182, 157, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 38px ' + CN_FONT;
    ctx.textAlign = 'center';
    ctx.fillText('生活习惯小助手', w / 2, 84);
    ctx.restore();

    // 4. 副标题
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px ' + CN_FONT;
    ctx.fillText('基于《黄帝内经》的养生习惯追踪', w / 2, 118);

    // 5. 分隔线（带圆角端点的渐变细线）
    var lineGrad = ctx.createLinearGradient(80, 0, w - 80, 0);
    lineGrad.addColorStop(0, 'rgba(224, 216, 204, 0)');
    lineGrad.addColorStop(0.5, '#E0D8CC');
    lineGrad.addColorStop(1, 'rgba(224, 216, 204, 0)');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(80, 145);
    ctx.lineTo(w - 80, 145);
    ctx.stroke();

    // 6. 日期
    var d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px ' + CN_FONT;
    ctx.fillText(d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日', w / 2, 180);

    // 7. 数据准备
    var done = getTodayDone();
    var total = getTodayTotal();
    var streak = getMaxStreakAll();
    var completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

    // 8. 完成率圆环（环形进度条）
    var ringCx = w / 2, ringCy = 290, ringR = 56;
    // 底环
    ctx.strokeStyle = 'rgba(124, 182, 157, 0.18)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    // 进度环（渐变）
    var ringGrad = ctx.createLinearGradient(ringCx - ringR, ringCy, ringCx + ringR, ringCy);
    ringGrad.addColorStop(0, '#7CB69D');
    ringGrad.addColorStop(1, '#F4A683');
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (completionPct / 100));
    ctx.stroke();
    // 中心百分比
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 32px ' + CN_FONT;
    ctx.fillText(completionPct + '%', ringCx, ringCy + 6);
    ctx.fillStyle = '#8D9196';
    ctx.font = '14px ' + CN_FONT;
    ctx.fillText('今日完成', ringCx, ringCy + 28);

    // 9. 今日完成数
    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 26px ' + CN_FONT;
    ctx.fillText('今日 ' + done + '/' + total + ' 个习惯', w / 2, 388);

    // 10. 连续打卡
    if (streak > 0) {
      ctx.fillStyle = '#F4A683';
      ctx.font = 'bold 24px ' + CN_FONT;
      ctx.fillText('连续打卡 ' + streak + ' 天 🔥', w / 2, 425);
    }

    // 11. 分隔线
    ctx.beginPath();
    ctx.moveTo(120, 460);
    ctx.lineTo(w - 120, 460);
    ctx.stroke();

    // 12. 今日养生名言
    var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    var quote = QUOTES[dayOfYear % QUOTES.length];

    // 名言卡片（圆角矩形背景）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    roundRect(ctx, 70, 490, w - 140, 220, 16);
    ctx.fill();

    ctx.fillStyle = '#5B8DB8';
    ctx.font = 'italic 22px ' + CN_FONT;
    ctx.fillText('📖 今日养生名言', w / 2, 525);

    ctx.fillStyle = '#2D3436';
    ctx.font = '22px ' + CN_FONT;
    var maxWidth = w - 200;
    var words = quote.split('');
    var line = '', y = 565;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i];
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, w / 2, y);
        line = words[i];
        y += 34;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w / 2, y);

    // 13. 底部圆角装饰条
    var botGrad = ctx.createLinearGradient(0, 0, w, 0);
    botGrad.addColorStop(0, '#7CB69D');
    botGrad.addColorStop(0.5, '#A8D5BA');
    botGrad.addColorStop(1, '#7CB69D');
    ctx.fillStyle = botGrad;
    roundRect(ctx, 0, h - 10, w, 10, { tl: 0, tr: 0, br: 24, bl: 24 });
    ctx.fill();

    // 14. 底部说明
    ctx.fillStyle = '#8D9196';
    ctx.font = '18px ' + CN_FONT;
    ctx.fillText('扫码体验 → rui66648.github.io/lifestyle-assistant', w / 2, h - 40);
  }

  function downloadPoster() {
    var canvas = document.getElementById('posterCanvas');
    if (!canvas) return;
    var link = document.createElement('a');
    link.download = '打卡海报_' + new Date().toISOString().slice(0, 10) + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Poster = {
    openPosterPanel,
    generatePoster,
    downloadPoster
  };

  // 暴露全局函数供点击调用
  window.openPosterPanel = openPosterPanel;
  window.downloadPoster = downloadPoster;

  if (App.registerModule) {
    App.registerModule('modules.poster', 'modules', null);
  }
})();
