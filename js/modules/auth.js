// ============================================================
// 用户认证与云同步模块（前端）
// ============================================================
// 功能：
//   1. 用户注册/登录/登出
//   2. Token 管理（accessToken 存内存，refreshToken 存 Capacitor Preferences）
//   3. 自动 token 刷新
//   4. 数据云同步（上传/下载）
//
// 仅在 APK 环境激活；PWA 环境下所有方法返回安全默认值
//
// 挂载命名空间: window.App.Modules.Auth
// ============================================================

(function() {
  'use strict';

  if (!window.App) window.App = {};
  if (!App.Modules) App.Modules = {};
  if (App.Modules.Auth) return; // 防止重复加载

  // ---- 状态 ----
  let _accessToken = null;
  let _refreshToken = null;
  let _user = null;          // { id, phone, nickname }
  let _initialized = false;
  let _refreshing = false;
  let _refreshPromise = null;

  // 同步状态
  let _lastSyncAt = 0;
  let _autoSync = true;
  let _syncing = false;

  // 事件监听
  const _listeners = {};

  // ---- 工具函数 ----

  /**
   * 获取 Worker URL（复用 AI 模块的配置）
   */
  function getWorkerUrl() {
    try {
      const saved = localStorage.getItem('ai_config');
      if (saved) {
        const cfg = JSON.parse(saved);
        if (cfg.workerUrl) return cfg.workerUrl.replace(/\/$/, '');
      }
    } catch(e) {}
    // 兜底：App 内置配置
    const builtin = (typeof window.__APP_CONFIG__ !== 'undefined' && window.__APP_CONFIG__) ? window.__APP_CONFIG__ : {};
    return (builtin.cloudAiUrl || '').replace(/\/$/, '');
  }

  /**
   * Capacitor Preferences 安全访问
   */
  async function prefGet(key) {
    if (!window.isAPK()) return null;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key });
      return result.value;
    } catch(e) {
      console.warn('[Auth] Preferences.get 失败，回退到 localStorage:', e.message);
      return localStorage.getItem('auth_' + key);
    }
  }

  async function prefSet(key, value) {
    if (!window.isAPK()) return;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    } catch(e) {
      console.warn('[Auth] Preferences.set 失败，回退到 localStorage:', e.message);
      localStorage.setItem('auth_' + key, value);
    }
  }

  async function prefRemove(key) {
    if (!window.isAPK()) return;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
    } catch(e) {
      localStorage.removeItem('auth_' + key);
    }
  }

  /**
   * API 请求封装
   */
  async function apiRequest(method, path, body, withAuth) {
    const baseUrl = getWorkerUrl();
    if (!baseUrl) throw new Error('未配置 Worker URL，请在设置中配置');

    const headers = { 'Content-Type': 'application/json' };
    if (withAuth && _accessToken) {
      headers['Authorization'] = 'Bearer ' + _accessToken;
    }

    const resp = await fetch(baseUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await resp.json().catch(() => ({ error: '响应解析失败' }));

    // 401 时尝试自动刷新
    if (resp.status === 401 && withAuth && path !== '/auth/refresh') {
      const refreshed = await tryRefresh();
      if (refreshed) {
        // 重试请求
        headers['Authorization'] = 'Bearer ' + _accessToken;
        const retryResp = await fetch(baseUrl + path, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        return { ok: retryResp.ok, status: retryResp.status, data: await retryResp.json().catch(() => ({ error: '响应解析失败' })) };
      }
    }

    return { ok: resp.ok, status: resp.status, data };
  }

  /**
   * 触发事件
   */
  function emit(event, data) {
    const cbs = _listeners[event];
    if (cbs) cbs.forEach(cb => { try { cb(data); } catch(e) { console.warn('[Auth] 事件回调异常:', e); } });
  }

  // ---- Token 管理 ----

  /**
   * 尝试用 refreshToken 刷新 accessToken
   */
  async function tryRefresh() {
    if (_refreshing) return _refreshPromise;
    if (!_refreshToken) return false;

    _refreshing = true;
    _refreshPromise = (async () => {
      try {
        const { ok, data } = await apiRequest('POST', '/auth/refresh', { refreshToken: _refreshToken }, false);
        if (ok && data.accessToken) {
          _accessToken = data.accessToken;
          return true;
        }
        // 刷新失败，清除登录状态
        await clearAuth();
        return false;
      } catch(e) {
        console.warn('[Auth] 刷新 token 失败:', e.message);
        await clearAuth();
        return false;
      } finally {
        _refreshing = false;
        _refreshPromise = null;
      }
    })();

    return _refreshPromise;
  }

  /**
   * 清除认证状态
   */
  async function clearAuth() {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    await prefRemove('refresh_token');
    emit('logout', null);
  }

  // ---- 公开 API ----

  /**
   * 初始化模块（仅 APK 环境）
   * 从 Capacitor Preferences 恢复登录状态
   */
  async function init() {
    if (_initialized) return;
    if (!window.isAPK()) { _initialized = true; return; }

    _initialized = true;
    _refreshToken = await prefGet('refresh_token');
    _autoSync = (await prefGet('auto_sync')) !== 'false';

    if (_refreshToken) {
      // 尝试恢复登录状态
      const refreshed = await tryRefresh();
      if (refreshed) {
        // 获取用户信息
        const { ok, data } = await apiRequest('GET', '/auth/me', null, true);
        if (ok && data.user) {
          _user = data.user;
          emit('login', _user);
        }
      }
    }
    console.log('[Auth] 初始化完成，登录状态:', !!_user);
  }

  /**
   * 是否已登录
   */
  function isLoggedIn() {
    return !!_user;
  }

  /**
   * 获取当前用户信息
   */
  function getCurrentUser() {
    return _user;
  }

  /**
   * 注册
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @param {string} [nickname] - 昵称
   * @returns {Promise<{ok: boolean, error?: string, user?: object}>}
   */
  async function register(phone, password, nickname) {
    const { ok, status, data } = await apiRequest('POST', '/auth/register', { phone, password, nickname }, false);
    if (ok) {
      _accessToken = data.accessToken;
      _refreshToken = data.refreshToken;
      _user = data.user;
      await prefSet('refresh_token', _refreshToken);
      emit('login', _user);
      return { ok: true, user: _user };
    }
    return { ok: false, error: data.error || '注册失败' };
  }

  /**
   * 登录
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @returns {Promise<{ok: boolean, error?: string, user?: object}>}
   */
  async function login(phone, password) {
    const { ok, data } = await apiRequest('POST', '/auth/login', { phone, password }, false);
    if (ok) {
      _accessToken = data.accessToken;
      _refreshToken = data.refreshToken;
      _user = data.user;
      await prefSet('refresh_token', _refreshToken);
      emit('login', _user);
      return { ok: true, user: _user };
    }
    return { ok: false, error: data.error || '登录失败' };
  }

  /**
   * 登出
   */
  async function logout() {
    if (_accessToken && _refreshToken) {
      await apiRequest('POST', '/auth/logout', { refreshToken: _refreshToken }, true);
    }
    await clearAuth();
  }

  /**
   * 更新昵称
   */
  async function updateNickname(nickname) {
    const { ok, data } = await apiRequest('PUT', '/auth/me', { nickname }, true);
    if (ok && data.user) {
      _user = data.user;
      emit('profileUpdate', _user);
      return { ok: true, user: _user };
    }
    return { ok: false, error: data.error || '更新失败' };
  }

  // ---- 数据同步 ----

  /**
   * 上传本地数据到云端
   * @returns {Promise<{ok: boolean, error?: string, syncedKeys?: number}>}
   */
  async function syncUp() {
    if (!isLoggedIn()) return { ok: false, error: '未登录' };
    if (_syncing) return { ok: false, error: '正在同步中' };
    _syncing = true;

    try {
      const payload = {};
      const habitsConfig = localStorage.getItem('habits_config');
      if (habitsConfig) payload.habits_config = habitsConfig;

      const checkinRecords = localStorage.getItem('checkin_records');
      if (checkinRecords) payload.checkin_records = checkinRecords;

      const constitutionResult = localStorage.getItem('constitution_result');
      if (constitutionResult) payload.constitution_result = constitutionResult;

      const { ok, data } = await apiRequest('POST', '/sync/upload', payload, true);
      if (ok) {
        _lastSyncAt = data.timestamp || Date.now();
        emit('syncComplete', { direction: 'up', timestamp: _lastSyncAt });
        return { ok: true, syncedKeys: data.syncedKeys };
      }
      return { ok: false, error: data.error || '上传失败' };
    } catch(e) {
      return { ok: false, error: e.message };
    } finally {
      _syncing = false;
    }
  }

  /**
   * 从云端下载数据到本地
   * @returns {Promise<{ok: boolean, error?: string, data?: object}>}
   */
  async function syncDown() {
    if (!isLoggedIn()) return { ok: false, error: '未登录' };
    if (_syncing) return { ok: false, error: '正在同步中' };
    _syncing = true;

    try {
      const { ok, data } = await apiRequest('GET', '/sync/download', null, true);
      if (ok && data.data) {
        const cloudData = data.data;
        // 合并策略：Last-Write-Wins per key
        // 云端有数据时覆盖本地（用户可选择性地合并）
        if (cloudData.habits_config) {
          localStorage.setItem('habits_config', typeof cloudData.habits_config === 'string' ? cloudData.habits_config : JSON.stringify(cloudData.habits_config));
        }
        if (cloudData.checkin_records) {
          localStorage.setItem('checkin_records', typeof cloudData.checkin_records === 'string' ? cloudData.checkin_records : JSON.stringify(cloudData.checkin_records));
        }
        if (cloudData.constitution_result) {
          localStorage.setItem('constitution_result', typeof cloudData.constitution_result === 'string' ? cloudData.constitution_result : JSON.stringify(cloudData.constitution_result));
        }
        _lastSyncAt = data.lastSyncAt || Date.now();
        emit('syncComplete', { direction: 'down', timestamp: _lastSyncAt });
        return { ok: true, data: cloudData };
      }
      return { ok: false, error: data.error || '下载失败' };
    } catch(e) {
      return { ok: false, error: e.message };
    } finally {
      _syncing = false;
    }
  }

  /**
   * 获取同步状态
   */
  function getSyncStatus() {
    return {
      lastSyncAt: _lastSyncAt,
      syncing: _syncing,
      autoSync: _autoSync,
    };
  }

  /**
   * 设置自动同步
   */
  async function setAutoSync(enabled) {
    _autoSync = !!enabled;
    await prefSet('auto_sync', String(_autoSync));
  }

  /**
   * 注册事件监听
   * @param {string} event - 'login' | 'logout' | 'syncComplete' | 'profileUpdate'
   * @param {function} cb
   */
  function on(event, cb) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(cb);
  }

  /**
   * 取消事件监听
   */
  function off(event, cb) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(fn => fn !== cb);
  }

  // ---- 导出 ----
  App.Modules.Auth = {
    init,
    isLoggedIn,
    getCurrentUser,
    register,
    login,
    logout,
    updateNickname,
    syncUp,
    syncDown,
    getSyncStatus,
    setAutoSync,
    on,
    off,
  };

  console.log('[Auth] 模块已加载');

  // ============================================================
  // UI 交互函数（挂载到 window，供 index.html onclick 调用）
  // ============================================================

  let _isRegisterMode = false;

  /**
   * 更新设置面板中的账号区域显示
   * 在 openSettingsPanel 中调用
   */
  window.updateAccountUI = function() {
    if (!window.isAPK()) {
      const grp = document.getElementById('accountGroup');
      if (grp) grp.style.display = 'none';
      return;
    }
    const grp = document.getElementById('accountGroup');
    if (grp) grp.style.display = '';
    const loggedOut = document.getElementById('accountLoggedOut');
    const loggedIn = document.getElementById('accountLoggedIn');
    if (isLoggedIn()) {
      if (loggedOut) loggedOut.style.display = 'none';
      if (loggedIn) loggedIn.style.display = '';
      const user = getCurrentUser();
      const nickEl = document.getElementById('accountNickname');
      const phoneEl = document.getElementById('accountPhone');
      if (nickEl) nickEl.textContent = user.nickname || '已登录';
      if (phoneEl) phoneEl.textContent = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '--';
    } else {
      if (loggedOut) loggedOut.style.display = '';
      if (loggedIn) loggedIn.style.display = 'none';
    }
  };

  window.openLoginPanel = function() {
    _isRegisterMode = false;
    const titleEl = document.getElementById('loginPanelTitle');
    const btnEl = document.getElementById('loginSubmitBtn');
    const switchEl = document.getElementById('switchAuthMode');
    const nickWrap = document.getElementById('nicknameInputWrap');
    const errEl = document.getElementById('authError');
    if (titleEl) titleEl.textContent = '登录';
    if (btnEl) btnEl.textContent = '登录';
    if (switchEl) switchEl.textContent = '没有账号？去注册';
    if (nickWrap) nickWrap.style.display = 'none';
    if (errEl) errEl.style.display = 'none';
    openPanel('loginPanel');
  };

  window.switchAuthMode = function() {
    _isRegisterMode = !_isRegisterMode;
    const titleEl = document.getElementById('loginPanelTitle');
    const btnEl = document.getElementById('loginSubmitBtn');
    const switchEl = document.getElementById('switchAuthMode');
    const nickWrap = document.getElementById('nicknameInputWrap');
    const errEl = document.getElementById('authError');
    if (_isRegisterMode) {
      if (titleEl) titleEl.textContent = '注册';
      if (btnEl) btnEl.textContent = '注册';
      if (switchEl) switchEl.textContent = '已有账号？去登录';
      if (nickWrap) nickWrap.style.display = '';
    } else {
      if (titleEl) titleEl.textContent = '登录';
      if (btnEl) btnEl.textContent = '登录';
      if (switchEl) switchEl.textContent = '没有账号？去注册';
      if (nickWrap) nickWrap.style.display = 'none';
    }
    if (errEl) errEl.style.display = 'none';
  };

  window.handleLoginSubmit = async function() {
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('authError');
    const btnEl = document.getElementById('loginSubmitBtn');

    if (!phone || !password) {
      if (errEl) { errEl.textContent = '请填写手机号和密码'; errEl.style.display = 'block'; }
      return;
    }
    if (btnEl) { btnEl.disabled = true; btnEl.textContent = '处理中...'; }
    if (errEl) errEl.style.display = 'none';

    try {
      let result;
      if (_isRegisterMode) {
        const nickname = document.getElementById('registerNickname').value.trim();
        result = await register(phone, password, nickname);
      } else {
        result = await login(phone, password);
      }
      if (result.ok) {
        closeAllPanels();
        if (typeof showToast === 'function') showToast(_isRegisterMode ? '注册成功！' : '登录成功！');
        window.updateAccountUI();
      } else {
        if (errEl) { errEl.textContent = result.error || '操作失败'; errEl.style.display = 'block'; }
      }
    } catch(e) {
      if (errEl) { errEl.textContent = e.message || '网络错误'; errEl.style.display = 'block'; }
    } finally {
      if (btnEl) { btnEl.disabled = false; btnEl.textContent = _isRegisterMode ? '注册' : '登录'; }
    }
  };

  window.handleLogout = async function() {
    if (typeof showToast === 'function') showToast('正在退出...');
    await logout();
    if (typeof showToast === 'function') showToast('已退出登录');
    window.updateAccountUI();
  };

  window.handleSyncUp = async function() {
    const statusEl = document.getElementById('syncUpStatus');
    if (statusEl) statusEl.textContent = '正在上传...';
    const result = await syncUp();
    if (result.ok) {
      const time = new Date().toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      if (statusEl) statusEl.textContent = '已上传 · ' + time;
      if (typeof showToast === 'function') showToast('上传成功！');
    } else {
      if (statusEl) statusEl.textContent = '上传失败：' + (result.error || '');
      if (typeof showToast === 'function') showToast('上传失败：' + (result.error || ''));
    }
  };

  window.handleSyncDown = async function() {
    if (!confirm('从云端下载数据将覆盖本地当前数据，确定继续？')) return;
    if (typeof showToast === 'function') showToast('正在下载...');
    const result = await syncDown();
    if (result.ok) {
      if (typeof showToast === 'function') showToast('恢复成功！即将刷新页面...');
      setTimeout(() => location.reload(), 1500);
    } else {
      if (typeof showToast === 'function') showToast('下载失败：' + (result.error || ''));
    }
  };

  window.openNicknameEditPanel = function() {
    const user = getCurrentUser();
    const input = document.getElementById('nicknameEditInput');
    if (input && user) input.value = user.nickname || '';
    openPanel('nicknamePanel');
  };

  window.handleNicknameUpdate = async function() {
    const nickname = document.getElementById('nicknameEditInput').value.trim();
    const result = await updateNickname(nickname);
    if (result.ok) {
      closeAllPanels();
      if (typeof showToast === 'function') showToast('昵称已更新');
      window.updateAccountUI();
    } else {
      if (typeof showToast === 'function') showToast('更新失败：' + (result.error || ''));
    }
  };

  // APK 环境下自动初始化
  if (window.isAPK && window.isAPK()) {
    document.addEventListener('DOMContentLoaded', function() {
      // 延迟初始化，等待 Capacitor 插件加载
      setTimeout(() => init().catch(e => console.warn('[Auth] 初始化失败:', e)), 1000);
    });
  }
})();
