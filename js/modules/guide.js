(function() {
  const GUIDE_STEPS = [
    { emoji: '🌟', title: '欢迎使用健康习惯助手', text: '融合《黄帝内经》智慧与 AI 技术，帮助你养成科学养生习惯。共 6 步，约 2 分钟完成。' },
    { emoji: '🩺', title: 'Step 1：中医体质测评', text: '在「我的」页面进行体质测评，回答 8 道题，辨识体质类型，获取专属养生建议。' },
    { emoji: '✨', title: 'Step 2：添加养生习惯', text: '在「管理」页面添加习惯，支持从习惯库一键添加（按时间分类），也支持自定义创建。' },
    { emoji: '📦', title: 'Step 3：导入习惯包', text: '在习惯库中可一键导入「健康生活包」或「四季养生包」，快速获得多个科学搭配的习惯。' },
    { emoji: '✅', title: 'Step 4：每日打卡', text: '在「打卡」页面记录完成情况，支持三种模式：完成/未完成、计数（如喝水量）、计时（如运动时长）。' },
    { emoji: '📊', title: 'Step 5：查看进度', text: '在「我的」页面查看打卡统计、等级、成就和热力图。每周自动生成总结报告。' },
    { emoji: '🤖', title: 'Step 6：AI 健康顾问', text: '点击底部 AI 按钮，随时咨询养生问题，获取基于《黄帝内经》和现代医学的个性化建议。' }
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
