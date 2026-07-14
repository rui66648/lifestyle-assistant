// habit.js - 习惯管理模块（所有功能已迁移至 js/ui/events.js 和 js/ui/panels.js）
// 此文件仅保留空占位，避免其他模块引用报错
(function() {
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};
  if (!App.Modules.Habit) App.Modules.Habit = {};

  if (App.registerModule) {
    App.registerModule('modules.habit', 'modules', null);
  }
})();
