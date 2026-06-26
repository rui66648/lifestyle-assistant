(function() {
  'use strict';

  /**
   * 兼容层：将 App 命名空间下的函数暴露到 window，使 HTML 中的 onclick 可以访问
   * 注意：storage.js 已通过 Object.defineProperty 暴露 habitsConfig/checkinRecords
   */
  function expose(obj) {
    if (!obj) return;
    for (const key in obj) {
      if (typeof obj[key] === 'function') {
        window[key] = obj[key];
      }
    }
  }

  // Data 层（常量 + 内容库）
  if (App.Data) {
    for (const key in App.Data) {
      if (Array.isArray(App.Data[key]) || typeof App.Data[key] === 'object') {
        window[key] = App.Data[key];
      }
    }
  }

  // Core 工具函数
  if (App.Core && App.Core.Utils) expose(App.Core.Utils);

  // Storage 方法（saveData, loadData, exportData, importData 等）
  if (App.Core && App.Core.Storage) expose(App.Core.Storage);

  // 模块层
  if (App.Modules) {
    for (const mod in App.Modules) {
      expose(App.Modules[mod]);
    }
  }

  // UI 层
  if (App.UI) {
    for (const mod in App.UI) {
      expose(App.UI[mod]);
    }
  }

  // 初始化由 main.js 统一处理
})();
