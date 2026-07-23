(function() {
  'use strict';

  var _loaded = {};
  var _queue = {};

  /**
   * 动态加载 JS 模块，加载后执行回调
   * 同一模块只会加载一次，后续调用直接执行回调
   */
  window.LazyLoad = function(modulePath, callback) {
    // 如果已加载，直接执行
    if (_loaded[modulePath]) {
      if (typeof callback === 'function') callback();
      return;
    }

    // 如果正在加载中，排队等待
    if (_queue[modulePath]) {
      if (typeof callback === 'function') _queue[modulePath].push(callback);
      return;
    }

    _queue[modulePath] = [];
    if (typeof callback === 'function') _queue[modulePath].push(callback);

    var script = document.createElement('script');
    script.src = modulePath + (modulePath.indexOf('?') === -1 ? '?v=20260706' : '');
    script.async = true;

    script.onload = script.onreadystatechange = function() {
      if (!_loaded[modulePath]) {
        _loaded[modulePath] = true;
        var cbs = _queue[modulePath] || [];
        delete _queue[modulePath];
        for (var i = 0; i < cbs.length; i++) {
          try { cbs[i](); } catch(e) { console.warn('[Lazy] callback error:', e); }
        }
      }
    };

    script.onerror = function() {
      console.error('[Lazy] 模块加载失败:', modulePath);
      _loaded[modulePath] = true; // 标记为已尝试，避免重复失败
      var cbs = _queue[modulePath] || [];
      delete _queue[modulePath];
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i](); } catch(e) { console.warn('[Lazy] callback error:', e); }
      }
    };

    document.head.appendChild(script);
  };
})();