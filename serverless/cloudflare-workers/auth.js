// ============================================================
// 用户认证与数据同步模块（Cloudflare Workers + D1）
// ============================================================
// 功能：
//   1. 用户注册/登录/登出（PBKDF2 密码哈希 + JWT）
//   2. Token 刷新机制（accessToken 15min + refreshToken 30d）
//   3. 用户数据云同步（上传/下载，Last-Write-Wins 策略）
//
// 依赖：
//   - D1 数据库绑定: env.DB
//   - Secret: JWT_SECRET（JWT 签名密钥）
//
// 路由前缀: /auth/* 和 /sync/*
// ============================================================

// ---- 常量 ----
const ACCESS_TOKEN_TTL = 15 * 60;          // 15 分钟（秒）
const REFRESH_TOKEN_TTL = 30 * 24 * 3600;  // 30 天（秒）
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;                  // 256 bit
const MAX_PASSWORD_LEN = 128;
const MIN_PASSWORD_LEN = 6;
const MAX_NICKNAME_LEN = 20;
const SYNC_DATA_KEYS = ['habits_config', 'checkin_records', 'constitution_result'];

// ---- 工具函数 ----

/**
 * 生成随机 UUID v4
 */
function uuid() {
  return crypto.randomUUID();
}

/**
 * 生成随机 hex 字符串（用于 salt 和 refresh token）
 */
function randomHex(len) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Base64Url 编码（用于 JWT）
 */
function b64urlEncode(str) {
  const bytes = typeof str === 'string' ? new TextEncoder().encode(str) : new Uint8Array(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64Url 解码
 */
function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - s.length % 4) % 4);
  const bin = atob(padded);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * PBKDF2 密码哈希（使用 Web Crypto API）
 * @returns {Promise<{hash: string, salt: string}>}
 */
async function hashPassword(password, existingSalt) {
  const salt = existingSalt || randomHex(16);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, PBKDF2_KEYLEN * 8
  );
  const hash = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  return { hash, salt };
}

/**
 * 验证密码
 */
async function verifyPassword(password, storedHash, salt) {
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * 签发 JWT（使用 HMAC-SHA256）
 * @param {object} payload - JWT 载荷
 * @param {string} secret - 签名密钥
 * @param {number} ttl - 有效期（秒）
 */
async function signJWT(payload, secret, ttl) {
  const header = { typ: 'JWT', alg: 'HS256' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + ttl };
  const signingInput = b64urlEncode(JSON.stringify(header)) + '.' + b64urlEncode(JSON.stringify(fullPayload));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return signingInput + '.' + b64urlEncode(new Uint8Array(sig));
}

/**
 * 验证 JWT
 * @returns {object|null} - 验证成功返回 payload，失败返回 null
 */
async function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = headerB64 + '.' + payloadB64;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const sig = b64urlDecode(sigB64);
  const valid = await crypto.subtle.verify('HMAC', key, sig, encoder.encode(signingInput));
  if (!valid) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * 从请求头提取并验证 accessToken
 * @returns {Promise<{userId: string, phone: string}|null>}
 */
async function authenticateRequest(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  return { userId: payload.sub, phone: payload.phone || '', nickname: payload.nickname || '' };
}

/**
 * 手机号格式校验（中国大陆）
 */
function isValidPhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 邮箱格式校验
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * JSON 响应（与 ai-proxy.js 保持一致的 CORS 头）
 */
function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}

// ============================================================
// 认证路由处理
// ============================================================

/**
 * 注册
 * POST /auth/register
 * Body: { phone: string, password: string, nickname?: string }
 */
async function handleRegister(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: '无效的 JSON 请求体' }, 400); }

  const { phone, password, nickname } = body;
  if (!phone || !password) return jsonRes({ error: '手机号和密码为必填项' }, 400);
  if (!isValidPhone(phone)) return jsonRes({ error: '手机号格式不正确' }, 400);
  if (password.length < MIN_PASSWORD_LEN || password.length > MAX_PASSWORD_LEN) {
    return jsonRes({ error: `密码长度需在 ${MIN_PASSWORD_LEN}-${MAX_PASSWORD_LEN} 之间` }, 400);
  }

  // 检查手机号是否已注册
  const existing = await env.DB.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
  if (existing) return jsonRes({ error: '该手机号已注册' }, 409);

  // 创建用户
  const userId = uuid();
  const now = Date.now();
  const { hash, salt } = await hashPassword(password);
  const displayName = (nickname || '').slice(0, MAX_NICKNAME_LEN);

  await env.DB.prepare(
    'INSERT INTO users (id, phone, password, salt, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, phone, hash, salt, displayName, now, now).run();

  // 签发 token
  const accessToken = await signJWT({ sub: userId, phone, nickname: displayName }, env.JWT_SECRET, ACCESS_TOKEN_TTL);
  const refreshToken = randomHex(32);
  const deviceId = body.deviceId || '';
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (token, user_id, device_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(refreshToken, userId, deviceId, now + REFRESH_TOKEN_TTL * 1000, now).run();

  return jsonRes({
    ok: true,
    user: { id: userId, phone, nickname: displayName },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
  }, 201);
}

/**
 * 登录
 * POST /auth/login
 * Body: { phone: string, password: string, deviceId?: string }
 */
async function handleLogin(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: '无效的 JSON 请求体' }, 400); }

  const { phone, password, deviceId } = body;
  if (!phone || !password) return jsonRes({ error: '手机号和密码为必填项' }, 400);

  const user = await env.DB.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
  if (!user) return jsonRes({ error: '手机号或密码错误' }, 401);

  const valid = await verifyPassword(password, user.password, user.salt);
  if (!valid) return jsonRes({ error: '手机号或密码错误' }, 401);

  // 签发 token
  const accessToken = await signJWT({ sub: user.id, phone: user.phone, nickname: user.nickname }, env.JWT_SECRET, ACCESS_TOKEN_TTL);
  const refreshToken = randomHex(32);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO refresh_tokens (token, user_id, device_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(refreshToken, user.id, deviceId || '', now + REFRESH_TOKEN_TTL * 1000, now).run();

  return jsonRes({
    ok: true,
    user: { id: user.id, phone: user.phone, nickname: user.nickname },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/**
 * 刷新 accessToken
 * POST /auth/refresh
 * Body: { refreshToken: string }
 */
async function handleRefresh(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: '无效的 JSON 请求体' }, 400); }

  const { refreshToken } = body;
  if (!refreshToken) return jsonRes({ error: 'refreshToken 为必填项' }, 400);

  const stored = await env.DB.prepare(
    'SELECT rt.*, u.phone, u.nickname FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = ?'
  ).bind(refreshToken).first();

  if (!stored) return jsonRes({ error: '无效的刷新令牌' }, 401);
  if (stored.expires_at < Date.now()) {
    // 清理过期 token
    await env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ?').bind(refreshToken).run();
    return jsonRes({ error: '刷新令牌已过期，请重新登录' }, 401);
  }

  // 签发新 accessToken（refresh token 轮转可选，此处不轮转以减少 D1 写入）
  const accessToken = await signJWT(
    { sub: stored.user_id, phone: stored.phone, nickname: stored.nickname },
    env.JWT_SECRET, ACCESS_TOKEN_TTL
  );

  return jsonRes({
    ok: true,
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

/**
 * 登出
 * POST /auth/logout
 * Body: { refreshToken: string }
 * Header: Authorization: Bearer <accessToken>
 */
async function handleLogout(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth) return jsonRes({ error: '未认证' }, 401);

  let body;
  try { body = await request.json(); } catch { body = {}; }

  if (body.refreshToken) {
    await env.DB.prepare('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?')
      .bind(body.refreshToken, auth.userId).run();
  }
  return jsonRes({ ok: true });
}

/**
 * 获取当前用户信息
 * GET /auth/me
 */
async function handleMe(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth) return jsonRes({ error: '未认证' }, 401);

  const user = await env.DB.prepare('SELECT id, phone, nickname, created_at FROM users WHERE id = ?')
    .bind(auth.userId).first();
  if (!user) return jsonRes({ error: '用户不存在' }, 404);

  return jsonRes({ ok: true, user });
}

/**
 * 更新昵称
 * PUT /auth/me
 * Body: { nickname: string }
 */
async function handleUpdateMe(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth) return jsonRes({ error: '未认证' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: '无效的 JSON 请求体' }, 400); }

  const nickname = (body.nickname || '').slice(0, MAX_NICKNAME_LEN);
  await env.DB.prepare('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?')
    .bind(nickname, Date.now(), auth.userId).run();

  return jsonRes({ ok: true, user: { id: auth.userId, phone: auth.phone, nickname } });
}

// ============================================================
// 数据同步路由处理
// ============================================================

/**
 * 上传数据
 * POST /sync/upload
 * Header: Authorization: Bearer <accessToken>
 * Body: { habits_config?: string, checkin_records?: string, constitution_result?: string }
 *       （各字段为 JSON 字符串）
 */
async function handleSyncUpload(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth) return jsonRes({ error: '未认证' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonRes({ error: '无效的 JSON 请求体' }, 400); }

  const now = Date.now();
  const stmts = [];
  for (const key of SYNC_DATA_KEYS) {
    if (body[key] !== undefined) {
      stmts.push(
        env.DB.prepare(
          'INSERT INTO user_data (user_id, data_key, data_value, updated_at) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(user_id, data_key) DO UPDATE SET data_value = excluded.data_value, updated_at = excluded.updated_at'
        ).bind(auth.userId, key, JSON.stringify(body[key]), now)
      );
    }
  }

  if (stmts.length === 0) return jsonRes({ error: '没有需要同步的数据' }, 400);

  await env.DB.batch(stmts);
  return jsonRes({ ok: true, syncedKeys: stmts.length, timestamp: now });
}

/**
 * 下载数据
 * GET /sync/download
 * Header: Authorization: Bearer <accessToken>
 */
async function handleSyncDownload(request, env) {
  const auth = await authenticateRequest(request, env);
  if (!auth) return jsonRes({ error: '未认证' }, 401);

  const rows = await env.DB.prepare(
    'SELECT data_key, data_value, updated_at FROM user_data WHERE user_id = ?'
  ).bind(auth.userId).all();

  const data = {};
  let lastSyncAt = 0;
  for (const row of rows.results || []) {
    try {
      data[row.data_key] = JSON.parse(row.data_value);
    } catch {
      data[row.data_key] = row.data_value;
    }
    if (row.updated_at > lastSyncAt) lastSyncAt = row.updated_at;
  }

  return jsonRes({ ok: true, data, lastSyncAt });
}

// ============================================================
// 路由分发
// ============================================================

/**
 * 处理 /auth/* 路由
 */
export async function handleAuthRoute(request, env, path) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (!env.DB) return jsonRes({ error: '未绑定 D1 数据库' }, 500);
  if (!env.JWT_SECRET) return jsonRes({ error: '未配置 JWT_SECRET' }, 500);

  try {
    if (path === '/auth/register' && request.method === 'POST') return await handleRegister(request, env);
    if (path === '/auth/login' && request.method === 'POST') return await handleLogin(request, env);
    if (path === '/auth/refresh' && request.method === 'POST') return await handleRefresh(request, env);
    if (path === '/auth/logout' && request.method === 'POST') return await handleLogout(request, env);
    if (path === '/auth/me' && request.method === 'GET') return await handleMe(request, env);
    if (path === '/auth/me' && request.method === 'PUT') return await handleUpdateMe(request, env);
    return jsonRes({ error: '未知的认证路由', path }, 404);
  } catch (err) {
    console.error('[Auth] 路由错误:', path, err);
    return jsonRes({ error: '服务器内部错误', message: err.message }, 500);
  }
}

/**
 * 处理 /sync/* 路由
 */
export async function handleSyncRoute(request, env, path) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  if (!env.DB) return jsonRes({ error: '未绑定 D1 数据库' }, 500);
  if (!env.JWT_SECRET) return jsonRes({ error: '未配置 JWT_SECRET' }, 500);

  try {
    if (path === '/sync/upload' && request.method === 'POST') return await handleSyncUpload(request, env);
    if (path === '/sync/download' && request.method === 'GET') return await handleSyncDownload(request, env);
    return jsonRes({ error: '未知的同步路由', path }, 404);
  } catch (err) {
    console.error('[Sync] 路由错误:', path, err);
    return jsonRes({ error: '服务器内部错误', message: err.message }, 500);
  }
}
