(function() {
  const GUIDE_STEPS = [
    { emoji: '🌿', title: '欢迎使用生活习惯小助手', text: '融合《黄帝内经》千年中医智慧与 AI 技术的健康习惯追踪工具。帮助你建立科学养生习惯，改善生活质量。' },
    { emoji: '🩺', title: '第一步：中医体质测评', text: '在「我的」页面点击「体质测评」，回答 8 道简单问题，辨识你的中医体质类型，获取专属养生建议和习惯推荐。' },
    { emoji: '📦', title: '第二步：添加养生习惯', text: '在「管理」页面点击「添加新习惯」，从习惯库中选择。我们已按早晨/上午/下午/晚上分类，点击卡片即可一键添加。还支持自定义习惯。' },
    { emoji: '🌿', title: '第三步：导入养生习惯包', text: '在习惯库中，可一键导入「健康生活建议包」或「四季养生包」（黄帝内经），一次获得多个科学搭配的养生习惯。' },
    { emoji: '📋', title: '第四步：每日打卡', text: '在「打卡」页面完成每日习惯打卡。支持三种打卡方式：✅ 完成/未完成、🔢 计数打卡（如喝水杯数）、⏱️ 计时打卡（如运动分钟数）。' },
    { emoji: '🤖', title: '第五步：AI 健康顾问', text: '点击底部 AI 按钮，随时咨询养生问题。AI 基于《黄帝内经》和现代医学知识，为你提供个性化饮食、作息、运动建议。' },
    { emoji: '📊', title: '第六步：追踪与回顾', text: '在「我的」页面查看打卡统计、等级成长、成就徽章和热力图。每周自动生成总结报告，直观了解习惯养成进度。' }
  ];
  let guideStep = 0;

  function showGuide() {
    // 首次自动弹出：检查是否已看过
    if (localStorage.getItem('has_seen_guide')) return;
    startGuide();
  }

  function replayGuide() {
    // 手动重看：不检查，始终显示
    startGuide();
  }

  function startGuide() {
    guideStep = 0;
    renderGuideStep();
    document.getElementById('guideOverlay').style.display = 'flex';
  }

  function renderGuideStep() {
    const step = GUIDE_STEPS[guideStep];
    document.getElementById('guideEmoji').textContent = step.emoji;
    document.getElementById('guideTitle').textContent = step.title;
    document.getElementById('guideText').textContent = step.text;
    document.getElementById('guideBtn').textContent = guideStep < GUIDE_STEPS.length - 1 ? '下一步' : '开始使用';

    const dots = document.getElementById('guideDots');
    const stepCount = GUIDE_STEPS.length;
    let dotsHtml = '';
    for (let i = 0; i < stepCount; i++) {
      const bg = i === guideStep ? 'var(--accent)' : 'var(--rule)';
      dotsHtml += `<span style="width:7px;height:7px;border-radius:50%;background:${bg};flex-shrink:0"></span>`;
    }
    dots.innerHTML = dotsHtml;
  }

  function nextGuideStep() {
    guideStep++;
    if (guideStep >= GUIDE_STEPS.length) {
      localStorage.setItem('has_seen_guide', 'true');
      document.getElementById('guideOverlay').style.display = 'none';
    } else {
      renderGuideStep();
    }
  }

  function skipGuide() {
    localStorage.setItem('has_seen_guide', 'true');
    document.getElementById('guideOverlay').style.display = 'none';
  }

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  App.Modules.Guide = {
    showGuide,
    replayGuide,
    renderGuideStep,
    nextGuideStep,
    skipGuide
  };

  if (App.registerModule) {
    App.registerModule('modules.guide', 'modules', null);
  }
})();
