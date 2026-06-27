(function() {
  function initDarkMode() {
    const saved = localStorage.getItem('dark_mode');
    const checkbox = document.getElementById('themeCheckbox');
    const icon = document.getElementById('themeIcon');

    // 确定实际暗黑模式状态：优先用户手动设置，其次系统偏好
    let useDark;
    if (saved !== null) {
      useDark = saved === 'true';
    } else {
      useDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (useDark) {
      if (document.body) document.body.classList.add('dark');
      if (checkbox) checkbox.checked = true;
      if (icon) icon.textContent = '🌙';
    } else {
      if (document.body) document.body.classList.remove('dark');
      if (checkbox) checkbox.checked = false;
      if (icon) icon.textContent = '☀️';
    }
  }

  function checkModules() {
    if (App.checkDependencies) {
      const ok = App.checkDependencies();
      if (!ok) {
        console.warn('[main] 模块依赖不完整，尝试继续运行...');
        if (App.listModules) App.listModules();
      } else {
        console.log('[main] 所有模块加载完成');
        if (App.listModules) App.listModules();
      }
    }
  }

  function initApp() {
    checkModules();
    if (App.UI && App.UI.Panels && App.UI.Panels.initAllSkins) {
      App.UI.Panels.initAllSkins();
    }
    initDarkMode();
    if (App.Core && App.Core.Storage && App.Core.Storage.loadData) {
      App.Core.Storage.loadData();
    }
    if (App.UI && App.UI.Render && App.UI.Render.render) {
      App.UI.Render.render();
    }
    if (App.UI && App.UI.Events && App.UI.Events.initTouchSwipe) {
      App.UI.Events.initTouchSwipe();
    }
    if (App.Modules && App.Modules.Guide && App.Modules.Guide.showGuide) {
      App.Modules.Guide.showGuide();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
