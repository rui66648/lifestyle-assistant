window.App = window.App || {};
App.Data = App.Data || {};
App.Core = App.Core || {};
App.Modules = App.Modules || {};
App.UI = App.UI || {};

(function() {
  'use strict';

  const _modules = {};
  const _moduleOrder = [];
  const _layers = {
    data: [],
    core: [],
    modules: [],
    ui: []
  };

  App.registerModule = function(name, layer, factory) {
    if (_modules[name]) {
      console.warn('[App] 模块重复注册:', name);
      return;
    }
    _modules[name] = { name, layer, factory, initialized: false };
    _moduleOrder.push(name);
    if (_layers[layer]) {
      _layers[layer].push(name);
    }
  };

  App.getModule = function(name) {
    return _modules[name] || null;
  };

  App.checkDependencies = function() {
    const required = {
      'data': ['constants', 'content', 'habits', 'packs'],
      'core': ['utils', 'storage'],
      'modules': ['checkin', 'habit', 'stats', 'water', 'guide'],
      'ui': ['render', 'panels', 'events', 'components']
    };

    const missing = [];
    for (const layer in required) {
      for (const name of required[layer]) {
        const fullName = layer + '.' + name;
        if (!_modules[fullName]) {
          missing.push(fullName);
        }
      }
    }

    if (missing.length > 0) {
      console.warn('[App] 以下模块未找到:', missing);
      return false;
    }
    return true;
  };

  App.listModules = function() {
    console.log('[App] 已注册模块 (' + _moduleOrder.length + '):');
    for (const name of _moduleOrder) {
      const mod = _modules[name];
      console.log('  -', name, '[' + mod.layer + ']');
    }
  };

  App.getModuleInfo = function() {
    return {
      total: _moduleOrder.length,
      order: _moduleOrder.slice(),
      layers: JSON.parse(JSON.stringify(_layers))
    };
  };

  App._modules = _modules;
})();
