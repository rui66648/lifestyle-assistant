(function() {
  function initApp() {
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
