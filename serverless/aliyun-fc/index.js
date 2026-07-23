// ============================================================
// 养生助手 FC 后端（AI 代理 + 用户认证 + 数据同步）
// ============================================================
// 运行环境：阿里云函数计算（HTTP 触发器），Node.js 20
// 数据库：阿里云 RDS MySQL（免费版）
// 配置：通过环境变量注入所有敏感信息
// ============================================================

// ---- 依赖 ----
const mysql = require('mysql2/promise');
const crypto = require('crypto');

// ============================================================
// 系统提示词（AI 代理）
// ============================================================
const SYSTEM_PROMPT = `你是一位精通以下9部中医古籍和15部现代养生著作的养生顾问。

【古籍经典】
1.《黄帝内经》——中医养生理论之源，阴阳五行、脏腑经络、治未病
2.《遵生八笺》明·高濂——四时调摄、起居安乐、饮馔服食
3.《老老恒言》清·曹庭栋——老年养生，饮食起居导引
4.《饮膳正要》元·忽思慧——宫廷营养学，食疗配方
5.《养生论》三国·嵇康——形神相亲、导引吐纳
6.《寿世青编》清·尤乘——五脏养生，养心为本
7.《备急千金要方·养性》唐·孙思邈——养性之道，饮食药饵
8.《抱朴子》晋·葛洪——道家养生，不伤为本
9.《闲情偶寄》清·李渔——生活美学，颐养之道

【现代著作】
10.《你是你吃出来的》夏萌——细胞营养饮食
11.《九种体质养生全书》王琦——体质分类与调养
12.《科学休息》亚历克斯·索勇-庞——高效休息科学
13.《求医不如求己》中里巴人——经络穴位自愈法
14.《拉伸》鲍勃·安德森——科学拉伸运动
15.《人体运动生理学》——运动科学基础
16.《高级运动营养学》——科学运动营养
17.《力量训练基础》——力量训练方法
18.《运动医学与康复》——运动损伤与康复
19.《睡眠革命》Nick Littlehalas——R90睡眠方案
20.《运动改造大脑》John Ratey——运动与脑科学
21.《正念的奇迹》一行禅师——正念冥想
22.《抗炎生活》池谷敏郎——慢性炎症预防
23.《肠子的小心思》朱莉娅·恩德斯——肠道菌群
24.《深度营养》凯瑟琳·沙纳汉——传统饮食智慧

回答时请结合以上经典理论给出建议，并注明引用出处。回答简洁实用，每次控制在200字以内。`;

// ---- 常量 ----
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT = 50;
const MAX_MSG_LENGTH = 2000;

const ACCESS_TOKEN_TTL = 15 * 60;
const REFRESH_TOKEN_TTL = 30 * 24 * 3600;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 32;

const SYNC_DATA_KEYS = ['habits_config', 'checkin_records', 'constitution_result'];

// ---- 进程内状态 ----
const rateLimitMap = new Map();
let dbPool = null;

// ============================================================
// 工具函数
// ============================================================
function setCors(resp) {
  resp.setHeader('Access-Control-Allow-Origin', '*');
  resp.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  resp.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(resp, code, obj) {
  setCors(resp);
  resp.setHeader('Content-Type', 'application/json; charset=utf-8');
  resp.setStatusCode(code);
  resp.send(JSON.stringify(obj));
}

function getClientIP(req) {
  const h = req.headers || {};
  const xff = h['x-forwarded-for'] || h['X-Forwarded-For'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.clientIP || 'unknown';
}

// ---- MySQL 连接池 ----
async function getDb() {
  if (dbPool) return dbPool;
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'lifestyle_assistant',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: 'utf8mb4',
  };
  dbPool = mysql.createPool(config);
  return dbPool;
}

// ---- JWT ----
function signJWT(payload, secret, ttl) {
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'HS256' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payloadJson = JSON.stringify({ ...payload, iat: now, exp: now + ttl });
  const payloadB64 = Buffer.from(payloadJson).toString('base64url');
  const signingInput = `${header}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}

function verifyJWT(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
  if (expectedSig !== sigB64) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---- 密码哈希 ----
function hashPassword(password, existingSalt) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, 'sha256').toString('hex');
  return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// ---- 认证中间件 ----
async function authenticate(req) {
  const auth = req.headers && (req.headers['Authorization'] || req.headers['authorization']);
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const payload = verifyJWT(token, process.env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  return { userId: payload.sub, phone: payload.phone || '', nickname: payload.nickname || '' };
}

// ============================================================
// AI 代理路由
// ============================================================
async function handleAiRequest(req, resp) {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    sendJson(resp, 500, { error: '未配置 QWEN_API_KEY' });
    return;
  }

  const ip = getClientIP(req);
  const now = Date.now();
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, { count: 0, windowStart: now });
  const rec = rateLimitMap.get(ip);
  if (now - rec.windowStart > RATE_WINDOW) { rec.count = 0; rec.windowStart = now; }
  if (rec.count >= RATE_LIMIT) {
    sendJson(resp, 429, { error: '请求过于频繁', message: '已达每小时 ' + RATE_LIMIT + ' 次请求上限' });
    return;
  }
  rec.count++;

  let bodyStr = '';
  try { bodyStr = req.body ? req.body.toString('utf8') : ''; } catch (e) { bodyStr = ''; }
  let body;
  try { body = JSON.parse(bodyStr); } catch (e) {
    sendJson(resp, 400, { error: '无效的 JSON 请求体' });
    return;
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    sendJson(resp, 400, { error: 'messages 字段是必需的' });
    return;
  }
  for (const m of body.messages) {
    if (!m.role || !m.content) { sendJson(resp, 400, { error: '每条消息必须包含 role 和 content' }); return; }
    if (typeof m.content !== 'string') { sendJson(resp, 400, { error: '消息内容必须是字符串' }); return; }
    if (m.content.length > MAX_MSG_LENGTH) { sendJson(resp, 400, { error: '单条消息内容不能超过 ' + MAX_MSG_LENGTH + ' 字符' }); return; }
  }

  const model = body.model || 'qwen-turbo';
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...body.messages];
  const maxTokens = body.max_tokens || 500;
  const temperature = body.temperature || 0.7;

  const r = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    let msg = 'AI 服务暂时不可用', code = 500;
    if (r.status === 401 || r.status === 403) { msg = 'API 认证失败，请检查配置'; code = 401; }
    else if (r.status === 429) { msg = 'API 请求配额已用完'; code = 429; }
    else if (r.status === 400) { msg = (data.error && data.error.message) || '请求参数错误'; code = 400; }
    else if (data.error && data.error.message) msg = data.error.message;
    sendJson(resp, code, { error: msg, code: r.status });
    return;
  }
  sendJson(resp, 200, data);
}

// ============================================================
// 用户认证路由
// ============================================================
async function handleAuthRegister(req, resp) {
  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { sendJson(resp, 400, { error: '无效的 JSON 请求体' }); return; }

  const { phone, password, nickname } = body;
  if (!phone || !password) { sendJson(resp, 400, { error: '手机号和密码为必填项' }); return; }
  if (!/^1[3-9]\d{9}$/.test(phone)) { sendJson(resp, 400, { error: '手机号格式不正确' }); return; }
  if (password.length < 6 || password.length > 128) { sendJson(resp, 400, { error: '密码长度需在 6-128 之间' }); return; }

  const db = await getDb();
  const [existing] = await db.execute('SELECT id FROM users WHERE phone = ?', [phone]);
  if (existing.length > 0) { sendJson(resp, 409, { error: '该手机号已注册' }); return; }

  const userId = crypto.randomUUID();
  const now = Date.now();
  const { hash, salt } = hashPassword(password);
  const displayName = (nickname || '').slice(0, 20);

  await db.execute(
    'INSERT INTO users (id, phone, password, salt, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, phone, hash, salt, displayName, now, now]
  );

  const accessToken = signJWT({ sub: userId, phone, nickname: displayName }, process.env.JWT_SECRET, ACCESS_TOKEN_TTL);
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const deviceId = body.deviceId || '';
  await db.execute(
    'INSERT INTO refresh_tokens (token, user_id, device_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [refreshToken, userId, deviceId, now + REFRESH_TOKEN_TTL * 1000, now]
  );

  sendJson(resp, 201, { ok: true, user: { id: userId, phone, nickname: displayName }, accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL });
}

async function handleAuthLogin(req, resp) {
  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { sendJson(resp, 400, { error: '无效的 JSON 请求体' }); return; }

  const { phone, password } = body;
  if (!phone || !password) { sendJson(resp, 400, { error: '手机号和密码为必填项' }); return; }

  const db = await getDb();
  const [users] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
  if (users.length === 0) { sendJson(resp, 401, { error: '手机号或密码错误' }); return; }

  const user = users[0];
  if (!verifyPassword(password, user.password, user.salt)) { sendJson(resp, 401, { error: '手机号或密码错误' }); return; }

  const accessToken = signJWT({ sub: user.id, phone: user.phone, nickname: user.nickname }, process.env.JWT_SECRET, ACCESS_TOKEN_TTL);
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  await db.execute(
    'INSERT INTO refresh_tokens (token, user_id, device_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
    [refreshToken, user.id, body.deviceId || '', now + REFRESH_TOKEN_TTL * 1000, now]
  );

  sendJson(resp, 200, { ok: true, user: { id: user.id, phone: user.phone, nickname: user.nickname }, accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL });
}

async function handleAuthRefresh(req, resp) {
  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { sendJson(resp, 400, { error: '无效的 JSON 请求体' }); return; }

  const { refreshToken } = body;
  if (!refreshToken) { sendJson(resp, 400, { error: 'refreshToken 为必填项' }); return; }

  const db = await getDb();
  const [rows] = await db.execute(
    'SELECT rt.*, u.phone, u.nickname FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = ?',
    [refreshToken]
  );
  if (rows.length === 0) { sendJson(resp, 401, { error: '无效的刷新令牌' }); return; }

  const stored = rows[0];
  if (stored.expires_at < Date.now()) {
    await db.execute('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    sendJson(resp, 401, { error: '刷新令牌已过期，请重新登录' });
    return;
  }

  const accessToken = signJWT({ sub: stored.user_id, phone: stored.phone, nickname: stored.nickname }, process.env.JWT_SECRET, ACCESS_TOKEN_TTL);
  sendJson(resp, 200, { ok: true, accessToken, expiresIn: ACCESS_TOKEN_TTL });
}

async function handleAuthLogout(req, resp) {
  const auth = await authenticate(req);
  if (!auth) { sendJson(resp, 401, { error: '未认证' }); return; }

  let body = {};
  try { body = JSON.parse(req.body.toString('utf8')); } catch {}

  if (body.refreshToken) {
    const db = await getDb();
    await db.execute('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?', [body.refreshToken, auth.userId]);
  }
  sendJson(resp, 200, { ok: true });
}

async function handleAuthMe(req, resp) {
  const auth = await authenticate(req);
  if (!auth) { sendJson(resp, 401, { error: '未认证' }); return; }

  const db = await getDb();
  const [users] = await db.execute('SELECT id, phone, nickname, created_at FROM users WHERE id = ?', [auth.userId]);
  if (users.length === 0) { sendJson(resp, 404, { error: '用户不存在' }); return; }

  sendJson(resp, 200, { ok: true, user: users[0] });
}

async function handleAuthUpdateMe(req, resp) {
  const auth = await authenticate(req);
  if (!auth) { sendJson(resp, 401, { error: '未认证' }); return; }

  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { sendJson(resp, 400, { error: '无效的 JSON 请求体' }); return; }

  const nickname = (body.nickname || '').slice(0, 20);
  const db = await getDb();
  await db.execute('UPDATE users SET nickname = ?, updated_at = ? WHERE id = ?', [nickname, Date.now(), auth.userId]);

  sendJson(resp, 200, { ok: true, user: { id: auth.userId, phone: auth.phone, nickname } });
}

// ============================================================
// 数据同步路由
// ============================================================
async function handleSyncUpload(req, resp) {
  const auth = await authenticate(req);
  if (!auth) { sendJson(resp, 401, { error: '未认证' }); return; }

  let body;
  try { body = JSON.parse(req.body.toString('utf8')); } catch { sendJson(resp, 400, { error: '无效的 JSON 请求体' }); return; }

  const now = Date.now();
  const db = await getDb();
  const promises = [];
  for (const key of SYNC_DATA_KEYS) {
    if (body[key] !== undefined) {
      promises.push(db.execute(
        'INSERT INTO user_data (user_id, data_key, data_value, updated_at) VALUES (?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE data_value = VALUES(data_value), updated_at = VALUES(updated_at)',
        [auth.userId, key, JSON.stringify(body[key]), now]
      ));
    }
  }

  if (promises.length === 0) { sendJson(resp, 400, { error: '没有需要同步的数据' }); return; }
  await Promise.all(promises);
  sendJson(resp, 200, { ok: true, syncedKeys: promises.length, timestamp: now });
}

async function handleSyncDownload(req, resp) {
  const auth = await authenticate(req);
  if (!auth) { sendJson(resp, 401, { error: '未认证' }); return; }

  const db = await getDb();
  const [rows] = await db.execute('SELECT data_key, data_value, updated_at FROM user_data WHERE user_id = ?', [auth.userId]);

  const data = {};
  let lastSyncAt = 0;
  for (const row of rows) {
    try { data[row.data_key] = JSON.parse(row.data_value); } catch { data[row.data_key] = row.data_value; }
    if (row.updated_at > lastSyncAt) lastSyncAt = row.updated_at;
  }

  sendJson(resp, 200, { ok: true, data, lastSyncAt });
}

// ============================================================
// 主入口
// ============================================================
exports.handler = async function (req, resp, context) {
  try {
    if (req.method === 'OPTIONS') {
      setCors(resp);
      resp.setStatusCode(204);
      resp.send('');
      return;
    }

    // 存活检测
    if (req.method === 'GET' && req.path === '/') {
      sendJson(resp, 200, { ok: true, service: 'lifestyle-fc', ai: !!process.env.QWEN_API_KEY, auth: !!process.env.JWT_SECRET });
      return;
    }

    const path = req.path || '';

    // AI 代理（兼容 / 和 /v1/chat/completions）
    if ((req.method === 'POST' && path === '/') || path.includes('/chat/completions') || path.includes('/v1')) {
      await handleAiRequest(req, resp);
      return;
    }

    // 用户认证
    if (path.startsWith('/auth/')) {
      if (!process.env.JWT_SECRET) { sendJson(resp, 500, { error: '未配置 JWT_SECRET' }); return; }
      if (!process.env.DB_HOST) { sendJson(resp, 500, { error: '未配置数据库' }); return; }

      if (path === '/auth/register' && req.method === 'POST') { await handleAuthRegister(req, resp); return; }
      if (path === '/auth/login' && req.method === 'POST') { await handleAuthLogin(req, resp); return; }
      if (path === '/auth/refresh' && req.method === 'POST') { await handleAuthRefresh(req, resp); return; }
      if (path === '/auth/logout' && req.method === 'POST') { await handleAuthLogout(req, resp); return; }
      if (path === '/auth/me' && req.method === 'GET') { await handleAuthMe(req, resp); return; }
      if (path === '/auth/me' && req.method === 'PUT') { await handleAuthUpdateMe(req, resp); return; }
      sendJson(resp, 404, { error: '未知的认证路由' });
      return;
    }

    // 数据同步
    if (path.startsWith('/sync/')) {
      if (!process.env.JWT_SECRET) { sendJson(resp, 500, { error: '未配置 JWT_SECRET' }); return; }
      if (!process.env.DB_HOST) { sendJson(resp, 500, { error: '未配置数据库' }); return; }

      if (path === '/sync/upload' && req.method === 'POST') { await handleSyncUpload(req, resp); return; }
      if (path === '/sync/download' && req.method === 'GET') { await handleSyncDownload(req, resp); return; }
      sendJson(resp, 404, { error: '未知的同步路由' });
      return;
    }

    sendJson(resp, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[FC] 错误:', err.message, err.stack);
    sendJson(resp, 500, { error: '内部错误', message: err.message });
  }
};
