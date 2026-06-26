(function() {
  function expose(obj) {
    for (const key in obj) {
      if (typeof obj[key] === 'function') {
        window[key] = obj[key];
      }
    }
  }

  if (App.Data) expose(App.Data);
  if (App.Core && App.Core.Utils) expose(App.Core.Utils);
  if (App.Core && App.Core.Storage) expose(App.Core.Storage);
  if (App.Modules) {
    for (const mod in App.Modules) {
      expose(App.Modules[mod]);
    }
  }
  if (App.UI) {
    for (const mod in App.UI) {
      expose(App.UI[mod]);
    }
  }
  // 初始化由 main.js 统一处理，避免双重渲染
})();
