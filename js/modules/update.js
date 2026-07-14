// 应用内"检查更新"模块（纯前端，无需后端）
// 版本信息 JSON 托管在 UPDATE_JSON_URL（android/local.properties 配置），格式：
// {
//   "versionCode": 2,
//   "versionName": "1.1",
//   "apkUrl": "https://example.com/app-debug.apk",
//   "whatsNew": ["修复习惯库搜索中文输入法打断", "新增应用内检查更新"],
//   "publishedAt": "2026-07-07"
// }
(function () {
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  const LOCAL_CODE = (window.__APP_CONFIG__ && window.__APP_CONFIG__.appVersionCode) || 1;
  const LOCAL_NAME = (window.__APP_CONFIG__ && window.__APP_CONFIG__.appVersionName) || '1.0';
  const UPDATE_URL = (window.__APP_CONFIG__ && window.__APP_CONFIG__.updateJsonUrl) || '';

  const CHECK_INTERVAL = 24 * 3600 * 1000; // 自动检查每天最多一次

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fillVersionInfo() {
    const n = document.getElementById('currentVersionName');
    if (n) n.textContent = LOCAL_NAME;
    const c = document.getElementById('currentVersionCode');
    if (c) c.textContent = LOCAL_CODE;
  }

  function getLocalVersion() {
    return { code: LOCAL_CODE, name: LOCAL_NAME };
  }

  function lastCheck() {
    return parseInt(localStorage.getItem('update_last_check') || '0', 10);
  }

  async function check(manual) {
    if (!UPDATE_URL) {
      if (manual) showToast('未配置更新地址', 2000);
      return;
    }
    if (!manual && Date.now() - lastCheck() < CHECK_INTERVAL) return; // 节流：每天最多一次
    localStorage.setItem('update_last_check', String(Date.now()));
    let info;
    try {
      const res = await fetch(UPDATE_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      info = await res.json();
    } catch (e) {
      if (manual) showToast('检查更新失败：' + e.message, 2500);
      return;
    }
    if (!info || typeof info.versionCode !== 'number') {
      if (manual) showToast('更新信息格式错误', 2000);
      return;
    }
    if (info.versionCode > LOCAL_CODE) {
      showUpdateModal(info);
    } else if (manual) {
      showToast('已是最新版本 v' + LOCAL_NAME, 2000);
    }
  }

  function showUpdateModal(info) {
    if (document.getElementById('updateModal')) return; // 避免重复弹窗
    const overlay = document.createElement('div');
    overlay.id = 'updateModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    const vName = info.versionName || info.versionCode;
    const whats = (Array.isArray(info.whatsNew) && info.whatsNew.length)
      ? '<ul style="margin:10px 0 0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.7">' +
        info.whatsNew.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'
      : '';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:18px;max-width:340px;width:100%;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
        '<div style="font-size:18px;font-weight:800;color:var(--ink)">🎉 发现新版本 v' + esc(vName) + '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:6px">当前 v' + esc(LOCAL_NAME) + ' → 新版本 v' + esc(vName) + '</div>' +
        whats +
        '<div style="display:flex;gap:10px;margin-top:18px">' +
          '<button id="updateLater" style="flex:1;padding:12px;border:2px solid var(--rule);background:#fff;border-radius:12px;font-size:14px;color:var(--muted)">稍后</button>' +
          '<button id="updateNow" style="flex:1;padding:12px;border:none;background:var(--accent);color:#fff;border-radius:12px;font-size:14px;font-weight:700">立即更新</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    const close = function () { if (overlay.parentElement) overlay.remove(); };
    overlay.querySelector('#updateLater').addEventListener('click', close);
    overlay.querySelector('#updateNow').addEventListener('click', function () {
      close();
      const url = info.apkUrl || UPDATE_URL;
      if (url) {
        showToast('正在打开下载…', 1500);
        setTimeout(function () { window.location.href = url; }, 800);
      }
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillVersionInfo);
  } else {
    fillVersionInfo();
  }

  App.Modules.Update = { check: check, getLocalVersion: getLocalVersion };
})();
