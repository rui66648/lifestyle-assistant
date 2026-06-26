(function() {
  function initDarkMode() {
    const saved = localStorage.getItem('dark_mode');
    const checkbox = document.getElementById('themeCheckbox');
    const icon = document.getElementById('themeIcon');
    if (saved === 'true') {
      if (document.body) document.body.classList.add('dark');
      if (checkbox) checkbox.checked = true;
      if (icon) icon.textContent = '🌙';
    } else {
      if (document.body) document.body.classList.remove('dark');
      if (checkbox) checkbox.checked = false;
      if (icon) icon.textContent = '☀️';
    }
  }

  function initApp() {
    App.UI.Panels.initAllSkins();  // 统一初始化所有皮肤（主题 + 按钮/复选框等组件）
    initDarkMode();
    App.Core.Storage.loadData();
    App.UI.Render.render();
    App.UI.Events.initTouchSwipe();
    App.Modules.Guide.showGuide();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
