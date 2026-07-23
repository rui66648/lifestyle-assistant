// 参考文献页面返回按钮（自动注入）
// 在 APK WebView 和 PWA 中均可用
(function() {
  function addBackButton() {
    if (document.getElementById('ref-back-btn')) return;
    var btn = document.createElement('a');
    btn.id = 'ref-back-btn';
    btn.href = document.referrer || '../index.html';
    btn.innerHTML = '‹ 返回';
    btn.style.cssText = [
      'position:fixed',
      'top:16px',
      'left:16px',
      'z-index:99999',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'min-width:52px',
      'height:40px',
      'padding:0 16px',
      'border-radius:20px',
      'background:rgba(124,182,157,0.95)',
      'color:#fff',
      'font-size:15px',
      'font-weight:600',
      'text-decoration:none',
      'box-shadow:0 2px 12px rgba(0,0,0,0.2)',
      'backdrop-filter:blur(8px)',
      '-webkit-backdrop-filter:blur(8px)',
      'transition:opacity 0.2s, transform 0.15s',
      'user-select:none',
      '-webkit-tap-highlight-color:transparent'
    ].join(';');

    // 如果有历史记录，用 history.back() 返回
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = btn.href;
      }
    });

    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addBackButton);
  } else {
    addBackButton();
  }
})();
