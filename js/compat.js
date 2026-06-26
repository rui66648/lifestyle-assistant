(function() {
  function expose(obj, prefix) {
    for (const key in obj) {
      if (typeof obj[key] === 'function') {
        window[key] = obj[key];
      }
    }
  }

  if (App.Data) expose(App.Data, '');
  if (App.Core && App.Core.Utils) expose(App.Core.Utils, '');
  if (App.Core && App.Core.Storage) expose(App.Core.Storage, '');
  if (App.Modules) {
    for (const mod in App.Modules) {
      expose(App.Modules[mod], '');
    }
  }
  if (App.UI) {
    for (const mod in App.UI) {
      expose(App.UI[mod], '');
    }
  }

  if (typeof loadData === 'function') {
    loadData();
  }
  if (typeof render === 'function') {
    render();
  }
  if (typeof initTouchSwipe === 'function') {
    initTouchSwipe();
  }

  if (!localStorage.getItem('guide_seen')) {
    if (typeof showGuide === 'function') {
      showGuide();
    }
  }
})();
