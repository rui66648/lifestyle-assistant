(function() {
  const GUIDE_STEPS = [
    { emoji: '🌿', title: '欢迎使用生活习惯小助手', text: '基于《黄帝内经》的AI养生习惯追踪应用，让千年中医智慧融入日常生活。' },
    { emoji: '🩺', title: '先测体质，个性化推荐', text: '通过8道简单问题，辨识你的中医体质类型，获取专属养生习惯推荐。' },
    { emoji: '📦', title: '从黄帝内经习惯包开始', text: '一键导入四季养生、五色饮食、情志调理等经典养生习惯，零基础入门。' }
  ];
  let guideStep = 0;

  function showGuide() {
    if (localStorage.getItem('has_seen_guide')) return;
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

    const dots = document.getElementById('guideDots').children;
    for (let i = 0; i < dots.length; i++) {
      dots[i].style.background = i === guideStep ? 'var(--accent)' : 'var(--rule)';
    }
  }

  function nextGuideStep() {
    guideStep++;
    if (guideStep >= GUIDE_STEPS.length) {
      localStorage.setItem('has_seen_guide', 'true');
      document.getElementById('guideOverlay').style.display = 'none';
      openConstitutionPanel();
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
    renderGuideStep,
    nextGuideStep,
    skipGuide
  };
})();
