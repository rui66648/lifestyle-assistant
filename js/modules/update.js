// 应用内"检查更新"模块（纯前端，无需后端）
// 版本信息 JSON 托管在 UPDATE_JSON_URL（android/local.properties 配置），格式：
// {
//   "versionCode": 4,
//   "versionName": "1.4",
//   "apkUrl": "https://example.com/app-release.apk",
//   "whatsNew": ["新增八段锦/太极拳等中医导引习惯", "优化通知权限请求流程"],
//   "publishedAt": "2026-07-18",
//   "forceUpdate": false,           // 可选：true 时用户不可跳过
//   "minVersionCode": 3             // 可选：低于此版本强制更新
// }
(function () {
  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};

  const LOCAL_CODE = (window.__APP_CONFIG__ && window.__APP_CONFIG__.appVersionCode) || 1;
  const LOCAL_NAME = (window.__APP_CONFIG__ && window.__APP_CONFIG__.appVersionName) || '1.0';
  const UPDATE_URL = (window.__APP_CONFIG__ && window.__APP_CONFIG__.updateJsonUrl)
    || (window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'version.json');

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

  // 用户是否已跳过此版本
  function isSkipped(versionCode) {
    return parseInt(localStorage.getItem('update_skipped') || '0', 10) === versionCode;
  }

  function markSkipped(versionCode) {
    localStorage.setItem('update_skipped', String(versionCode));
  }

  // 判断是否需要强制更新
  function isForceUpdate(info) {
    if (info.forceUpdate === true) return true;
    if (typeof info.minVersionCode === 'number' && LOCAL_CODE < info.minVersionCode) return true;
    return false;
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
      // 强制更新 → 始终弹窗，不可跳过
      // 手动检查 → 始终弹窗
      // 自动检查且用户曾跳过此版本 → 不弹窗
      var force = isForceUpdate(info);
      if (force || manual || !isSkipped(info.versionCode)) {
        showUpdateModal(info, force);
      }
    } else if (manual) {
      showToast('已是最新版本 v' + LOCAL_NAME, 2000);
    }
  }

  function showUpdateModal(info, force) {
    if (document.getElementById('updateModal')) return; // 避免重复弹窗
    const overlay = document.createElement('div');
    overlay.id = 'updateModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px';
    const vName = info.versionName || info.versionCode;
    const whats = (Array.isArray(info.whatsNew) && info.whatsNew.length)
      ? '<ul style="margin:10px 0 0;padding-left:18px;color:var(--muted);font-size:13px;line-height:1.7">' +
        info.whatsNew.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>'
      : '';
    // 强制更新时不显示"跳过"和"稍后"按钮
    var skipBtn = force
      ? ''
      : '<button id="updateSkip" style="flex:1;padding:12px;border:2px solid var(--rule);background:#fff;border-radius:12px;font-size:14px;color:var(--muted)">跳过此版</button>';
    var laterBtn = force
      ? ''
      : '<button id="updateLater" style="flex:1;padding:12px;border:2px solid var(--rule);background:#fff;border-radius:12px;font-size:14px;color:var(--muted)">稍后</button>';
    var btnRow = force
      ? '<div style="margin-top:18px"><button id="updateNow" style="width:100%;padding:12px;border:none;background:var(--accent);color:#fff;border-radius:12px;font-size:14px;font-weight:700">立即更新</button></div>'
      : '<div style="display:flex;gap:10px;margin-top:18px">' + skipBtn + laterBtn +
        '<button id="updateNow" style="flex:1;padding:12px;border:none;background:var(--accent);color:#fff;border-radius:12px;font-size:14px;font-weight:700">立即更新</button></div>';
    var title = force ? '⚠️ 需要更新到 v' + esc(vName) : '🎉 发现新版本 v' + esc(vName);
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:18px;max-width:340px;width:100%;padding:22px;box-shadow:0 12px 40px rgba(0,0,0,.25)">' +
        '<div style="font-size:18px;font-weight:800;color:var(--ink)">' + title + '</div>' +
        '<div style="font-size:13px;color:var(--muted);margin-top:6px">当前 v' + esc(LOCAL_NAME) + ' → 新版本 v' + esc(vName) + '</div>' +
        whats +
        btnRow +
      '</div>';
    document.body.appendChild(overlay);
    const close = function () { if (overlay.parentElement) overlay.remove(); };
    // 稍后
    var laterEl = overlay.querySelector('#updateLater');
    if (laterEl) laterEl.addEventListener('click', close);
    // 跳过此版本
    var skipEl = overlay.querySelector('#updateSkip');
    if (skipEl) skipEl.addEventListener('click', function () {
      markSkipped(info.versionCode);
      close();
      showToast('已跳过 v' + vName + '，可在设置页手动检查', 2000);
    });
    // 立即更新
    overlay.querySelector('#updateNow').addEventListener('click', function () {
      const url = info.apkUrl || UPDATE_URL;
      if (url) {
        showToast('正在打开下载…', 1500);
        setTimeout(function () { window.location.href = url; }, 800);
      }
    });
    // 强制更新时点击遮罩不关闭
    if (!force) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fillVersionInfo);
  } else {
    fillVersionInfo();
  }

  App.Modules.Update = { check: check, getLocalVersion: getLocalVersion };
})();
