(function() {
  function initApp() {
    App.Core.Storage.loadData();
    App.UI.Render.render();
    App.UI.Events.initTouchSwipe();
    
    const hasSeenGuide = localStorage.getItem('guide_seen');
    if (!hasSeenGuide) {
      App.Modules.Guide.showGuide();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
