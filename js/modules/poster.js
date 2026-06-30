(function() {
  function openPosterPanel() {
    generatePoster();
    openPanel('posterPanel');
  }

  function generatePoster() {
    const canvas = document.getElementById('posterCanvas');
    const ctx = canvas.getContext('2d');
    const w = 640, h = 960;
    canvas.width = w; canvas.height = h;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#FDF8F0');
    grad.addColorStop(1, '#F5EDE0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, 0, w, 8);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('生活习惯小助手', w/2, 80);

    ctx.fillStyle = '#8D9196';
    ctx.font = '22px sans-serif';
    ctx.fillText('基于《黄帝内经》的养生习惯追踪', w/2, 115);

    ctx.strokeStyle = '#E0D8CC';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 140); ctx.lineTo(w-80, 140);
    ctx.stroke();

    const d = new Date();
    ctx.fillStyle = '#8D9196';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`, w/2, 175);

    const done = getTodayDone();
    const total = getTodayTotal();
    const streak = getMaxStreakAll();

    ctx.font = '80px sans-serif';
    ctx.fillText('🎉', w/2, 280);

    ctx.fillStyle = '#2D3436';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(`今日 ${done}/${total} 个习惯完成`, w/2, 340);

    if (streak > 0) {
      ctx.fillStyle = '#F4A683';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`连续打卡 ${streak} 天 🔥`, w/2, 390);
    }

    ctx.beginPath();
    ctx.moveTo(120, 430); ctx.lineTo(w-120, 430);
    ctx.stroke();

    const dayOfYear = Math.floor((d - new Date(d.getFullYear(),0,0)) / 86400000);
    const quote = QUOTES[dayOfYear % QUOTES.length];
    ctx.fillStyle = '#5B8DB8';
    ctx.font = 'italic 22px sans-serif';
    ctx.fillText('📖 今日养生名言', w/2, 475);

    ctx.fillStyle = '#2D3436';
    ctx.font = '22px sans-serif';
    const maxWidth = 480;
    const words = quote.split('');
    let line = '', y = 515;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i];
      if (ctx.measureText(test).width > maxWidth && i > 0) {
        ctx.fillText(line, w/2, y);
        line = words[i];
        y += 32;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, w/2, y);

    ctx.fillStyle = '#7CB69D';
    ctx.fillRect(0, h-8, w, 8);

    ctx.fillStyle = '#8D9196';
    ctx.font = '18px sans-serif';
    ctx.fillText('扫码体验 → rui66648.github.io/lifestyle-assistant', w/2, h-40);
  }

  function downloadPoster() {
    const canvas = document.getElementById('posterCanvas');
    const link = document.createElement('a');
    link.download = `打卡海报_${new Date().toISOString().slice(0,10)}.png`;
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
