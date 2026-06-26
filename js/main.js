(function() {
  function initSkin() {
    const saved = localStorage.getItem('app_skin');
    if (!saved || saved === 'default') return;
    // SKINS 定义在 panels.js 中，这里需要引用；用内联方式加载
    const skinMap = {
      ocean:   {accent:'#4A90D9',accent2:'#48C9B0','accent-light':'#D6EAF8','accent2-light':'#D1F2EB',bg:'#F5F9FC',bg2:'#EBF2F8'},
      rose:    {accent:'#E07B8C',accent2:'#D4A0B5','accent-light':'#FADBD8','accent2-light':'#F5EEF8',bg:'#FFF5F7',bg2:'#FEF0F3'},
      sunset:  {accent:'#E8913A',accent2:'#E05A4B','accent-light':'#FDEBD0','accent2-light':'#FADBD8',bg:'#FFFBF5',bg2:'#FFF3E6'},
      lavender:{accent:'#7B6CB8',accent2:'#9B8EC4','accent-light':'#E8E5F5','accent2-light':'#F0EEF8',bg:'#FAFAFE',bg2:'#F2F1FA'},
      forest:  {accent:'#2E7D5B',accent2:'#8D9B6A','accent-light':'#D4EDDA','accent2-light':'#E8ECD6',bg:'#F5FAF6',bg2:'#EBF4EE'},
    };
    const vars = skinMap[saved];
    if (vars) {
      const root = document.documentElement;
      for (const [key, val] of Object.entries(vars)) {
        root.style.setProperty('--' + key, val);
      }
    }
  }

  function initApp() {
    initSkin();
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
