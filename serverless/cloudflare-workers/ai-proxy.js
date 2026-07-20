// Cloudflare Workers - 生活习惯小助手后端
// 功能1：AI 养生顾问代理（隐藏 API Key + 限流）
// 功能2：Web Push 后台推送（Cron 定时 + VAPID + aes128gcm 加密）
//
// 部署：
//   npx wrangler deploy（在 workers/ 目录）
//   或 Cloudflare Dashboard 粘贴本文件
// 需配置：
//   Secret: QWEN_API_KEY, VAPID_PRIVATE_KEY, MODELSCOPE_API_TOKEN
//   KV namespace 绑定: PUSH_KV
//   Cron Triggers: * * * * * （每分钟）
//   MCP（可选）: HOWTOCOOK_MCP_URL, KNOWLEDGE_MCP_URL

// ============================================================
// VAPID 配置（公钥与前端 js/modules/push.js 一致；私钥用环境变量）
// ============================================================
const VAPID_PUBLIC_KEY = 'BM-yFa2y8NJ8iob-46qSH2sCjkRxr43gUgGbRAFJkoivKJ076fuXAHohFuCKh5pAp-UtLJYIztN9HU9oU6dJchg';
const VAPID_SUBJECT = 'mailto:admin@lifestyle-assistant.local';

// ============================================================
// AI 养生顾问系统提示词（CREATE 框架优化版 v2.0）
// 优化原则：黄金区域管理 + 自我验证闭环 + 结构化输出契约
// ============================================================
const SYSTEM_PROMPT = `【角色】
你是「养生小助手」AI 养生顾问，精通中医养生经典与现代健康科学，以「治未病」为核心理念，为用户提供实用、安全、有依据的养生建议。

你的说话风格：温和亲切、条理清晰、像一位经验丰富的养生师，不说空话套话，每条建议都具体可操作。

---

【核心原则 · 必须遵守】
1. 安全第一：不提供医疗诊断，不开处方药物，涉及疾病问题务必建议就医
2. 言必有据：每条养生建议至少标注一个引用出处（典籍或著作名称）
3. 实用至上：建议要具体到「做什么、做多久、什么时候做」，不泛泛而谈
4. 因人而异：结合体质、季节、时段给出差异化建议
5. 简洁高效：回答控制在 200 字以内，重点突出

---

【知识范围】
精通 9 部中医古籍与 15 部现代养生著作，涵盖：
- 中医基础：阴阳五行、脏腑经络、九种体质、二十四节气
- 生活方式：饮食营养、运动健身、睡眠调理、情志调养
- 道家养生：导引吐纳、形神兼养、不伤为本
- 现代科学：运动生理、营养科学、睡眠医学、正念冥想、肠道健康

主要典籍：《黄帝内经》《遵生八笺》《老老恒言》《饮膳正要》《养生论》《寿世青编》《备急千金要方·养性》《抱朴子》《闲情偶寄》
现代著作：《你是你吃出来的》《九种体质养生全书》《科学休息》《求医不如求己》《拉伸》《人体运动生理学》《高级运动营养学》《力量训练基础》《运动医学与康复》《睡眠革命》《运动改造大脑》《正念的奇迹》《抗炎生活》《肠子的小心思》《深度营养》

---

【能力边界 · 明确不能做的事】
- 不诊断疾病、不开药方、不替代专业医疗建议
- 不推荐具体药物、保健品品牌
- 对严重症状（持续疼痛、高烧、呼吸困难等）立即建议就医
- 不确定的知识坦诚说明，不编造理论或引用
- 不讨论与养生健康无关的话题

---

【回答格式】
按以下结构组织回答（用简短的小标题，不用 Markdown 标记）：

1. 核心建议（1-2 句点明主旨）
2. 具体方法（分点列出 2-3 条可操作建议）
3. 引用出处（标注参考的典籍或著作）

如果问题涉及疾病风险，在末尾加一行：⚠️ 以上建议仅供参考，症状持续请及时就医。

---

【输出前自检清单】
回答前请逐条检查，不满足的立即修正：
□ 是否给出了具体可操作的建议（不是空话）
□ 是否标注了至少一个引用出处
□ 字数是否控制在 200 字以内
□ 涉及健康风险是否有免责提醒
□ 是否超出了能力边界（如涉及医疗诊断）

---

【最后提醒】
记住：你是养生顾问，不是医生。安全永远是第一位的。用你的专业知识帮助用户建立健康的生活习惯，这才是「治未病」的真谛。`;

// ============================================================
// 限流配置（滑动窗口：每用户每分钟最多 5 次）
// 注：基于内存 Map 的滑动日志算法，单 isolate 内精确。
//   Cloudflare Workers 多 isolate 场景下为"尽力而为"策略；
//   如需全局限流精度，请改用 Durable Object 或 Cloudflare Rate Limiting binding。
// ============================================================
const RATE_WINDOW_MS = 60 * 1000;   // 窗口大小：1 分钟
const RATE_LIMIT_DEFAULT = 5;        // 默认阈值：5 次/分钟
const MAX_MSG_LENGTH = 2000;
const AI_UPSTREAM_TIMEOUT_MS = 30 * 1000; // 上游 AI 请求超时 30s
const LOG_LEVEL = 'info'; // 'debug' | 'info' | 'warn' | 'error' | 'none'

// ============================================================
// 工具函数
// ============================================================
function getClientIP(request){
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For') ||
         request.headers.get('X-Real-IP') || 'unknown';
}
function genRequestId(){
  return 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
const LOG_PRIORITY = { debug:10, info:20, warn:30, error:40, none:99 };
function log(level, tag, message, extra){
  if (LOG_PRIORITY[level] < LOG_PRIORITY[LOG_LEVEL]) return;
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level, tag, message,
    ...(extra || {})
  });
  if (level === 'error') console.error(line); else if (level === 'warn') console.warn(line); else console.log(line);
}
function jsonResponse(data, status = 200, headers = {}){
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...headers
    }
  });
}
function validateRequest(body){
  if (!body.messages || !Array.isArray(body.messages)) return { valid:false, error:'messages 字段是必需的' };
  for (const msg of body.messages){
    if (!msg.role || !msg.content) return { valid:false, error:'每条消息必须包含 role 和 content' };
    if (typeof msg.content !== 'string') return { valid:false, error:'消息内容必须是字符串' };
    if (msg.content.length > MAX_MSG_LENGTH) return { valid:false, error:'单条消息内容不能超过 '+MAX_MSG_LENGTH+' 字符' };
  }
  return { valid:true };
}
// 把上游错误体安全地转成可读消息（不泄露内部细节给前端）
function classifyUpstreamError(status, data){
  if (status === 401 || status === 403) return { msg:'AI 服务认证失败，请检查 API Key 配置', code:'auth_failed' };
  if (status === 429) return { msg:'AI 服务请求配额已用完，请稍后再试', code:'quota_exhausted' };
  if (status === 400) return { msg:(data && data.error && data.error.message) || '请求参数错误', code:'bad_request' };
  if (status >= 500) return { msg:'AI 服务暂时不可用，请稍后重试', code:'upstream_error' };
  if (data && data.error && data.error.message) return { msg:data.error.message, code:'upstream_error' };
  return { msg:'AI 服务返回未知错误', code:'unknown' };
}

// ============================================================
// MCP 服务配置
// ============================================================
const HOWTOCOOK_MCP_ID = '@worryzyy/howtocook-mcp';
const KNOWLEDGE_MCP_ID = '@Geeksfino/kb-mcp-server';
const STRAVA_MCP_ID = 'strava-mcp';
const MODELSCOPE_OPENAPI_BASE = 'https://modelscope.cn/openapi/v1';
const MCP_URL_TTL_MS = 55 * 60 * 1000; // operational URL 缓存 55 分钟

// MCP operational URL 缓存：{ serverId: { url, transport, expires } }
const mcpUrlCache = new Map();

// 读取环境变量中硬编码的 MCP URL（可选）
function getEnvMcpUrl(serverId, env){
  if (serverId === HOWTOCOOK_MCP_ID) return env.HOWTOCOOK_MCP_URL || '';
  if (serverId === KNOWLEDGE_MCP_ID) return env.KNOWLEDGE_MCP_URL || '';
  if (serverId === STRAVA_MCP_ID) return env.STRAVA_MCP_URL || '';
  return '';
}

// 通过 ModelScope OpenAPI 获取/刷新 MCP operational URL
async function fetchMcpOperationalUrl(serverId, env){
  const token = env.MODELSCOPE_API_TOKEN;
  if (!token) throw new Error('未配置 MODELSCOPE_API_TOKEN');

  const encodedId = encodeURIComponent(serverId);
  // 先尝试查询已有链接
  const queryUrl = `${MODELSCOPE_OPENAPI_BASE}/mcp/servers/${encodedId}?get_operational_url=true`;
  const resp = await fetch(queryUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
  const data = await resp.json().catch(() => ({}));

  let url = '';
  let transport = 'streamable_http';
  if (resp.ok && data.success && data.data && Array.isArray(data.data.operational_urls) && data.data.operational_urls.length > 0){
    const item = data.data.operational_urls[0];
    if (!item.expiration || new Date(item.expiration).getTime() > Date.now() + 5 * 60 * 1000){
      url = item.url || '';
      transport = item.transport_type || 'streamable_http';
    }
  }

  // 没有可用链接则尝试部署
  if (!url){
    const deployUrl = `${MODELSCOPE_OPENAPI_BASE}/mcp/servers/${encodedId}/deploy`;
    const deployResp = await fetch(deployUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transport_type: 'streamable_http' })
    });
    const deployData = await deployResp.json().catch(() => ({}));
    if (!deployResp.ok || !deployData.success || !deployData.data || !deployData.data.url){
      throw new Error('部署 MCP 服务失败: ' + (deployData.message || deployResp.status));
    }
    url = deployData.data.url;
    transport = deployData.data.transport_type || 'streamable_http';
  }

  if (!url) throw new Error('无法获取 MCP operational URL');
  return { url, transport };
}

// 获取 MCP operational URL（带缓存）
async function getMcpOperationalUrl(serverId, env){
  const envUrl = getEnvMcpUrl(serverId, env);
  if (envUrl) return { url: envUrl, transport: 'streamable_http' };

  const cached = mcpUrlCache.get(serverId);
  if (cached && cached.expires > Date.now()) return cached;

  const result = await fetchMcpOperationalUrl(serverId, env);
  mcpUrlCache.set(serverId, { ...result, expires: Date.now() + MCP_URL_TTL_MS });
  return result;
}

// 调用 MCP tool（简化版 JSON-RPC）
async function callMcpTool(serverId, toolName, args, env){
  const { url, transport } = await getMcpOperationalUrl(serverId, env);
  const headers = { 'Content-Type': 'application/json' };
  const token = env.MODELSCOPE_API_TOKEN;
  // 部分托管 MCP 需要在 header 中透传 Authorization
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const requestId = Math.random().toString(36).slice(2);
  const body = {
    jsonrpc: '2.0',
    id: requestId,
    method: 'tools/call',
    params: { name: toolName, arguments: args || {} }
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!resp.ok){
    const text = await resp.text().catch(() => '');
    throw new Error(`MCP 调用失败 [${resp.status}]: ${text}`);
  }

  const result = await resp.json().catch(() => ({}));
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
  return result.result || result;
}

// ============================================================
// 滑动窗口限流（Sliding Window Log 算法）
// 记录每次请求的时间戳，清理窗口外的旧记录，剩余即为当前窗口内请求数。
// 优点：相比固定窗口，避免边界突发流量；相比令牌桶，无需后台补充。
// 缺点：内存占用随 QPS 增长（limit 数量级，本场景可忽略）。
// ============================================================
const rateLimitMap = new Map(); // key: clientId, value: number[] (时间戳数组)
const RATE_MAP_MAX_SIZE = 10000; // 防止 Map 无限增长（LRU 式淘汰）
function checkRateLimit(clientId, limit){
  const now = Date.now();
  const windowStart = now - RATE_WINDOW_MS;

  // 简易防溢出：Map 过大时整体重置（生产环境建议改用 LRU）
  if (rateLimitMap.size > RATE_MAP_MAX_SIZE) rateLimitMap.clear();

  let timestamps = rateLimitMap.get(clientId);
  if (!timestamps){ timestamps = []; rateLimitMap.set(clientId, timestamps); }

  // 清理过期时间戳
  while (timestamps.length > 0 && timestamps[0] < windowStart) timestamps.shift();

  if (timestamps.length >= limit){
    const oldest = timestamps[0];
    const resetSec = Math.ceil((oldest + RATE_WINDOW_MS - now) / 1000);
    return { allowed:false, remaining:0, resetTime:Math.max(1, resetSec), window:timestamps.length };
  }

  timestamps.push(now);
  return { allowed:true, remaining:limit - timestamps.length, resetTime:Math.ceil(RATE_WINDOW_MS / 1000), window:timestamps.length };
}

// ============================================================
// Web Push 加密（RFC 8291 aes128gcm + RFC 8292 VAPID）
// ============================================================
function b64urlEncode(buffer){
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = '';
  for (let i=0;i<bytes.length;i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function b64urlDecode(str){
  const s = String(str).replace(/-/g,'+').replace(/_/g,'/');
  const padded = s + '='.repeat((4 - s.length % 4) % 4);
  const bin = atob(padded);
  const arr = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
async function hkdf(salt, ikm, info, length){
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'HKDF', hash:'SHA-256', salt, info }, key, length*8);
  return new Uint8Array(bits);
}
function buildVapidJwk(pubB64url, privB64url){
  const pub = b64urlDecode(pubB64url);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('VAPID 公钥格式错误');
  return { kty:'EC', crv:'P-256', x:b64urlEncode(pub.slice(1,33)), y:b64urlEncode(pub.slice(33,65)), d:privB64url, ext:true };
}
async function buildVapidAuthHeader(endpoint){
  const aud = new URL(endpoint).origin;
  const exp = Math.floor(Date.now()/1000) + 12*60*60;
  const header = { typ:'JWT', alg:'ES256' };
  const payload = { aud, exp, sub:VAPID_SUBJECT };
  const enc = new TextEncoder();
  const signingInput = b64urlEncode(enc.encode(JSON.stringify(header))) + '.' + b64urlEncode(enc.encode(JSON.stringify(payload)));
  const jwk = buildVapidJwk(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY_SECRET);
  const key = await crypto.subtle.importKey('jwk', jwk, { name:'ECDSA', namedCurve:'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-256' }, key, enc.encode(signingInput));
  return 'vapid t=' + signingInput + '.' + b64urlEncode(new Uint8Array(sig));
}
async function encryptPayload(payloadStr, subscription){
  const enc = new TextEncoder();
  const plaintext = enc.encode(payloadStr);
  // 临时 ECDH 密钥对
  const asKeyPair = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-256' }, true, ['deriveBits']);
  const asPubJwk = await crypto.subtle.exportKey('jwk', asKeyPair.publicKey);
  const asPub65 = new Uint8Array(65);
  asPub65[0] = 0x04;
  asPub65.set(b64urlDecode(asPubJwk.x), 1);
  asPub65.set(b64urlDecode(asPubJwk.y), 33);
  // ECDH 共享密钥
  const uaPubKey = await crypto.subtle.importKey('raw', b64urlDecode(subscription.keys.p256dh), { name:'ECDH', namedCurve:'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name:'ECDH', public:uaPubKey }, asKeyPair.privateKey, 256));
  const authSecret = b64urlDecode(subscription.keys.auth);
  const uaPubRaw = b64urlDecode(subscription.keys.p256dh);
  // IKM: info = "WebPush: info" + \0 + uaPub + asPub（动态长度，避免手算出错）
  const wpInfo = enc.encode('WebPush: info');
  const infoIkm = new Uint8Array(wpInfo.length + 1 + uaPubRaw.length + asPub65.length);
  infoIkm.set(wpInfo, 0);
  infoIkm[wpInfo.length] = 0;
  infoIkm.set(uaPubRaw, wpInfo.length + 1);
  infoIkm.set(asPub65, wpInfo.length + 1 + uaPubRaw.length);
  const ikm = await hkdf(authSecret, sharedSecret, infoIkm, 32);
  // salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  // CEK: info = "Content-Encoding: aes128gcm" + \0
  const cekInfoStr = enc.encode('Content-Encoding: aes128gcm');
  const cekInfo = new Uint8Array(cekInfoStr.length + 1);
  cekInfo.set(cekInfoStr, 0);
  cekInfo[cekInfoStr.length] = 0;
  const cek = await hkdf(salt, ikm, cekInfo, 16);
  // nonce: info = "Content-Encoding: nonce" + \0
  const nonceInfoStr = enc.encode('Content-Encoding: nonce');
  const nonceInfo = new Uint8Array(nonceInfoStr.length + 1);
  nonceInfo.set(nonceInfoStr, 0);
  nonceInfo[nonceInfoStr.length] = 0;
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);
  // AES-128-GCM
  const ptPadded = new Uint8Array(plaintext.length + 1);
  ptPadded.set(plaintext, 0);
  ptPadded[plaintext.length] = 0x02;
  const cekKey = await crypto.subtle.importKey('raw', cek, { name:'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name:'AES-GCM', iv:nonce, tagLength:128 }, cekKey, ptPadded));
  // record: salt(16) + rs(4=4096) + idlen(1=65) + keyid(65) + ciphertext
  const record = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  record.set(salt, 0);
  record.set(new Uint8Array([0x00,0x00,0x10,0x00]), 16); // rs=4096
  record[20] = 65;
  record.set(asPub65, 21);
  record.set(ciphertext, 86);
  return record;
}
async function sendPush(subscription, payloadObj){
  const payloadStr = JSON.stringify(payloadObj);
  const encrypted = await encryptPayload(payloadStr, subscription);
  const auth = await buildVapidAuthHeader(subscription.endpoint);
  const resp = await fetch(subscription.endpoint, {
    method:'POST',
    headers:{
      'Content-Type':'application/octet-stream',
      'Content-Encoding':'aes128gcm',
      'TTL':'86400',
      'Authorization':auth,
      'Urgency':'high'
    },
    body:encrypted
  });
  return { ok:resp.ok, status:resp.status, endpoint:subscription.endpoint, text:await resp.text().catch(()=>'') };
}

// VAPID 私钥（从 env 注入，模块级变量在 fetch/scheduled 时赋值）
let VAPID_PRIVATE_KEY_SECRET = '';

// ============================================================
// KV 数据结构（PUSH_KV 命名空间）
// ============================================================
// 任务队列与状态存储 schema：
//   "subs"             -> PushSubscription[]            // 全部推送订阅
//   "schedule"         -> { schedule: ScheduleItem[], offset:number, updatedAt:number, quietHours?: QuietHours }
//   "iv:<endpoint>:<habitId>" -> string(timestamp)     // 间隔提醒上次推送时间
//   "pd:<endpoint>:<habitId>:<dateStr>:<minute>" -> "1" // 定点提醒当日去重标记（TTL 7200s）
//   "metrics:push"     -> { ok:number, fail:number, lastRun:number } // 推送指标
//
// ScheduleItem 结构：
//   { id, name, icon, tip,
//     fixed?:    { time:'HH:MM', extraTimes:['HH:MM'], days:number[] },
//     interval?: { interval:number(min), startTime:'HH:MM', endTime:'HH:MM', days:number[] } }
//
// QuietHours 结构：
//   { enabled: boolean, start: number(hour), end: number(hour) }
// ============================================================
async function kvGetSubs(env){
  try { const raw = await env.PUSH_KV.get('subs'); return raw ? JSON.parse(raw) : []; }
  catch(e){ log('warn','kv','subs 解析失败，返回空数组', { err:e.message }); return []; }
}
async function kvSaveSubs(env, subs){
  await env.PUSH_KV.put('subs', JSON.stringify(subs));
}
async function kvGetSchedule(env){
  try { const raw = await env.PUSH_KV.get('schedule'); return raw ? JSON.parse(raw) : { schedule:[], offset:480 }; }
  catch(e){ log('warn','kv','schedule 解析失败', { err:e.message }); return { schedule:[], offset:480 }; }
}
async function kvSaveSchedule(env, data){
  await env.PUSH_KV.put('schedule', JSON.stringify(data));
}
// 间隔提醒：记录某订阅某习惯的上次推送时间
async function kvGetIntervalTs(env, endpoint, habitId){
  const v = await env.PUSH_KV.get('iv:'+endpoint+':'+habitId);
  return v ? parseInt(v) : 0;
}
async function kvSetIntervalTs(env, endpoint, habitId, ts){
  await env.PUSH_KV.put('iv:'+endpoint+':'+habitId, String(ts));
}
// 推送指标（用于监控）
async function kvBumpMetrics(env, ok, fail){
  try {
    const raw = await env.PUSH_KV.get('metrics:push');
    const m = raw ? JSON.parse(raw) : { ok:0, fail:0, lastRun:0 };
    m.ok += ok; m.fail += fail; m.lastRun = Date.now();
    await env.PUSH_KV.put('metrics:push', JSON.stringify(m));
  } catch(e){ /* 指标失败不影响主流程 */ }
}

// ============================================================
// 推送路由处理
// ============================================================
async function handlePushRoute(request, env, path){
  // 订阅注册
  if (path === '/push/subscribe' && request.method === 'POST'){
    const sub = await request.json();
    if (!sub || !sub.endpoint || !sub.keys) return jsonResponse({ error:'订阅数据不完整' }, 400);
    const subs = await kvGetSubs(env);
    const idx = subs.findIndex(s => s.endpoint === sub.endpoint);
    if (idx >= 0) subs[idx] = sub; else subs.push(sub);
    await kvSaveSubs(env, subs);
    return jsonResponse({ ok:true, total:subs.length });
  }
  // 上传提醒时间表
  if (path === '/push/schedule' && request.method === 'POST'){
    const body = await request.json();
    const data = {
      schedule: body.schedule || [],
      offset: typeof body.offset === 'number' ? body.offset : 480,
      updatedAt: Date.now()
    };
    if (body.quietHours) {
      data.quietHours = {
        enabled: body.quietHours.enabled !== false,
        start: typeof body.quietHours.start === 'number' ? body.quietHours.start : 22,
        end: typeof body.quietHours.end === 'number' ? body.quietHours.end : 7
      };
    }
    await kvSaveSchedule(env, data);
    return jsonResponse({ ok:true, count:data.schedule.length, hasQuietHours: !!data.quietHours });
  }
  // 测试推送
  if (path === '/push/test' && request.method === 'POST'){
    const subs = await kvGetSubs(env);
    if (!subs.length) return jsonResponse({ error:'暂无订阅' }, 400);
    const r = await sendPush(subs[0], {
      title:'测试推送',
      body:'Web Push 后台提醒已生效！',
      tag:'push-test',
      requireInteraction:true
    });
    return jsonResponse({ ok:r.ok, status:r.status, text:r.text });
  }
  // 查看状态
  if (path === '/push/status' && request.method === 'GET'){
    const subs = await kvGetSubs(env);
    const sch = await kvGetSchedule(env);
    let metrics = { ok:0, fail:0, lastRun:0 };
    try { const raw = await env.PUSH_KV.get('metrics:push'); if (raw) metrics = JSON.parse(raw); } catch(e){}
    return jsonResponse({
      subs:subs.length,
      scheduleCount:sch.schedule.length,
      offset:sch.offset,
      vapidConfigured: !!VAPID_PRIVATE_KEY_SECRET,
      metrics
    });
  }
  return jsonResponse({ error:'未知推送路由' }, 404);
}

// ============================================================
// MCP 路由处理
// ============================================================
async function handleMcpRoute(request, env, path){
  if (request.method === 'OPTIONS'){
    return new Response(null, {
      headers:{
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type'
      }
    });
  }
  if (request.method !== 'POST'){
    return jsonResponse({ error:'MCP 路由仅支持 POST' }, 405);
  }

  let body;
  try { body = await request.json(); }
  catch(e){ return jsonResponse({ error:'无效的 JSON 请求体' }, 400); }

  try {
    if (path === '/mcp/howtocook'){
      const action = body.action;
      const params = body.params || {};
      if (action === 'search'){
        const result = await callMcpTool(HOWTOCOOK_MCP_ID, 'search_recipes_by_category', { category: params.category || '' }, env);
        return jsonResponse({ ok:true, data:result });
      }
      if (action === 'recommend'){
        const result = await callMcpTool(HOWTOCOOK_MCP_ID, 'recommend_weekly_menu', {
          peopleCount: params.peopleCount || 2,
          allergies: params.allergies || [],
          avoidItems: params.avoidItems || []
        }, env);
        return jsonResponse({ ok:true, data:result });
      }
      if (action === 'today'){
        const result = await callMcpTool(HOWTOCOOK_MCP_ID, 'recommend_today_menu', { peopleCount: params.peopleCount || 2 }, env);
        return jsonResponse({ ok:true, data:result });
      }
      if (action === 'all'){
        const result = await callMcpTool(HOWTOCOOK_MCP_ID, 'get_all_recipes', {}, env);
        return jsonResponse({ ok:true, data:result });
      }
      return jsonResponse({ error:'未知的 howtocook action: ' + action, supported:['search','recommend','today','all'] }, 400);
    }

    if (path === '/mcp/knowledge'){
      const action = body.action;
      const params = body.params || {};
      if (action === 'search'){
        const result = await callMcpTool(KNOWLEDGE_MCP_ID, 'search', { query: params.query || '', limit: params.limit || 5 }, env);
        return jsonResponse({ ok:true, data:result });
      }
      if (action === 'graph'){
        const result = await callMcpTool(KNOWLEDGE_MCP_ID, 'graph_query', { query: params.query || '', limit: params.limit || 5 }, env);
        return jsonResponse({ ok:true, data:result });
      }
      if (action === 'status'){
        return jsonResponse({ ok:true, configured: !!(env.MODELSCOPE_API_TOKEN || env.KNOWLEDGE_MCP_URL) });
      }
      return jsonResponse({ error:'未知的 knowledge action: ' + action, supported:['search','graph','status'] }, 400);
    }

    if (path === '/mcp/strava'){
      const action = body.action;
      const params = body.params || {};
      const stravaTools = {
        'recent-activities': 'get-recent-activities',
        'profile': 'get-athlete-profile',
        'stats': 'get-athlete-stats',
        'activity-details': 'get-activity-details',
        'activity-streams': 'get-activity-streams',
        'clubs': 'list-athlete-clubs',
        'starred-segments': 'list-starred-segments',
        'explore-segments': 'explore-segments',
        'routes': 'list-athlete-routes',
        'route-details': 'get-route',
        'segment-details': 'get-segment',
        'segment-effort': 'get-segment-effort',
        'segment-efforts': 'list-segment-efforts',
        'activity-laps': 'get-activity-laps',
        'zones': 'get-athlete-zones'
      };
      const toolName = stravaTools[action];
      if (!toolName){
        return jsonResponse({ error:'未知的 strava action: ' + action, supported:Object.keys(stravaTools) }, 400);
      }
      const result = await callMcpTool(STRAVA_MCP_ID, toolName, params, env);
      return jsonResponse({ ok:true, data:result });
    }
  } catch(err){
    console.error('[MCP] 路由错误:', err);
    return jsonResponse({ error:'MCP 调用失败', message:err.message }, 502);
  }

  return jsonResponse({ error:'未知 MCP 路由' }, 404);
}

// ============================================================
// Cron 定时检查（scheduled）
// ============================================================
async function runScheduled(env){
  if (!VAPID_PRIVATE_KEY_SECRET){ log('warn','cron','未配置 VAPID_PRIVATE_KEY，跳过推送'); return; }
  const subs = await kvGetSubs(env);
  if (!subs.length) return;
  const sch = await kvGetSchedule(env);
  if (!sch.schedule.length) return;

  // 用户本地时间（用 offset 分钟）
  const now = new Date();
  const localMs = now.getTime() + (sch.offset || 0) * 60000;
  const local = new Date(localMs);
  const hh = local.getHours();
  const mm = local.getMinutes();
  const day = local.getDay();
  const dateStr = local.getFullYear() + '-' + (local.getMonth()+1) + '-' + local.getDate();
  const curMin = hh * 60 + mm;

  // 免打扰时段检查
  function isQuietHours(){
    if (!sch.quietHours || !sch.quietHours.enabled) return false;
    const qStart = sch.quietHours.start || 22;
    const qEnd = sch.quietHours.end || 7;
    return hh >= qStart || hh < qEnd;
  }
  if (isQuietHours()) {
    log('info','cron','免打扰时段，跳过推送', { localTime: hh+':'+mm });
    return;
  }

  const pushed = [];
  let okCount = 0, failCount = 0;

  for (const item of sch.schedule){
    // 定点提醒：精确匹配当前 HH:MM
    if (item.fixed){
      const days = item.fixed.days || [0,1,2,3,4,5,6];
      if (days.indexOf(day) === -1) continue;
      const times = [item.fixed.time].concat(item.fixed.extraTimes || []);
      for (const t of times){
        if (!t) continue;
        const parts = t.split(':');
        const tMin = (parseInt(parts[0])||0)*60 + (parseInt(parts[1])||0);
        if (tMin === curMin){
          for (const sub of subs){
            const dedupKey = 'pd:'+sub.endpoint+':'+item.id+':'+dateStr+':'+tMin;
            const seen = await env.PUSH_KV.get(dedupKey);
            if (seen) continue;
            try {
              const r = await sendPush(sub, {
                title: (item.icon||'⏰') + ' ' + item.name + '时间到了',
                body: item.tip || '记得完成打卡哦',
                tag: 'habit-' + item.id,
                requireInteraction: true,
                vibrate: [200,100,200,100,300]
              });
              await env.PUSH_KV.put(dedupKey, '1', { expirationTtl: 7200 });
              pushed.push({ id:item.id, time:t, ok:r.ok, status:r.status });
              if (r.ok) okCount++; else failCount++;
              // 订阅失效（410 Gone）则记录待清理
              if (r.status === 410 || r.status === 404) log('warn','cron','订阅失效', { endpoint: sub.endpoint, status:r.status });
            } catch(err){
              failCount++;
              log('error','cron','定点推送失败', { id:item.id, err:err.message, endpoint: sub.endpoint });
            }
          }
        }
      }
    }
    // 间隔提醒：距上次推送 >= interval 且在窗口内
    if (item.interval){
      const days = item.interval.days || [0,1,2,3,4,5,6];
      if (days.indexOf(day) === -1) continue;
      const sh = (item.interval.startTime||'08:00').split(':').map(Number);
      const eh = (item.interval.endTime||'22:00').split(':').map(Number);
      const startMin = (sh[0]||0)*60 + (sh[1]||0);
      const endMin = (eh[0]||0)*60 + (eh[1]||0);
      if (curMin < startMin || curMin > endMin) continue;
      const interval = item.interval.interval || 120;
      for (const sub of subs){
        const last = await kvGetIntervalTs(env, sub.endpoint, item.id);
        const elapsed = last ? Math.floor((Date.now() - last)/60000) : interval;
        if (elapsed >= interval){
          try {
            const r = await sendPush(sub, {
              title: (item.icon||'⏰') + ' ' + item.name + '提醒',
              body: item.tip || '该完成啦',
              tag: 'habit-iv-' + item.id,
              requireInteraction: true
            });
            await kvSetIntervalTs(env, sub.endpoint, item.id, Date.now());
            pushed.push({ id:item.id, type:'interval', ok:r.ok, status:r.status });
            if (r.ok) okCount++; else failCount++;
          } catch(err){
            failCount++;
            log('error','cron','间隔推送失败', { id:item.id, err:err.message, endpoint: sub.endpoint });
          }
        }
      }
    }
  }

  // 上报指标
  await kvBumpMetrics(env, okCount, failCount);
  log('info','cron','推送批次完成', { ok:okCount, fail:failCount, total:pushed.length, localTime: hh+':'+mm });
}

// ============================================================
// AI 代理主处理（兼容 OpenAI Chat Completions 格式）
// ============================================================
// 入参（兼容 OpenAI / 阿里百炼 OpenAI 兼容模式）：
//   {
//     model?: 'qwen-turbo' | 'qwen-plus' | 'qwen-max' | 'deepseek-v3' | 'deepseek-r1',
//     messages: [{ role:'user'|'assistant'|'system', content:string }],
//     max_tokens?: number,     // 默认 500
//     temperature?: number,    // 默认 0.7
//     stream?: boolean         // 默认 false；为 true 时返回 SSE 流
//   }
//
// 出参（非流式）：
//   成功：直接透传上游响应体（OpenAI 格式 { choices:[{ message:{...} }], usage:{...} }）
//   失败：{ error:string, code:string, request_id:string }
//
// 出参（流式）：
//   Content-Type: text/event-stream
//   逐行透传上游 SSE chunk，并以 data: [DONE]\n\n 结尾
//   上游错误时：data: {"error":"...","code":"..."}\n\n
// ============================================================
async function handleAiProxy(request, env, ctx, requestId){
  const QWEN_API_KEY = env.QWEN_API_KEY;
  if (!QWEN_API_KEY){
    log('error','ai','QWEN_API_KEY 未配置', { requestId });
    return jsonResponse({ error:'Worker 未配置 QWEN_API_KEY', code:'config_missing', request_id:requestId }, 500);
  }

  // 限流：每用户每分钟 5 次（可通过环境变量 RATE_LIMIT 覆盖）
  const rateLimit = parseInt(env.RATE_LIMIT) || RATE_LIMIT_DEFAULT;
  const clientIP = getClientIP(request);
  const rateCheck = checkRateLimit(clientIP, rateLimit);
  const rateHeaders = {
    'X-RateLimit-Limit':rateLimit.toString(),
    'X-RateLimit-Remaining':rateCheck.remaining.toString(),
    'X-RateLimit-Reset':rateCheck.resetTime.toString(),
    'X-Request-Id':requestId
  };
  if (!rateCheck.allowed){
    log('warn','ai','限流触发', { requestId, clientIP, window:rateCheck.window, limit:rateLimit });
    return jsonResponse({
      error:'请求过于频繁',
      message:'已达每分钟 '+rateLimit+' 次请求上限，请稍后再试',
      code:'rate_limited',
      retryAfter:rateCheck.resetTime,
      request_id:requestId
    }, 429, { ...rateHeaders, 'Retry-After':rateCheck.resetTime.toString() });
  }

  let body;
  try { body = await request.json(); }
  catch(e){ return jsonResponse({ error:'无效的 JSON 请求体', code:'bad_json', request_id:requestId }, 400, rateHeaders); }

  const validation = validateRequest(body);
  if (!validation.valid) return jsonResponse({ error:validation.error, code:'bad_request', request_id:requestId }, 400, rateHeaders);

  const model = body.model || 'qwen-turbo';
  const messages = body.messages || [];
  const maxTokens = body.max_tokens || 500;
  const temperature = body.temperature ?? 0.7;
  const stream = body.stream === true;
  const fullMessages = [{ role:'system', content:SYSTEM_PROMPT }, ...messages];

  log('info','ai','请求', { requestId, model, stream, msgCount:fullMessages.length, ip:clientIP });

  const upstreamBody = { model, messages:fullMessages, max_tokens:maxTokens, temperature, stream };
  // AbortController 超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + QWEN_API_KEY, 'X-DashScope-SSE': stream ? 'enable' : 'disable' },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal
    });

    // 流式：透传 SSE
    if (stream){
      if (!upstream.ok || !upstream.body){
        const errText = await upstream.text().catch(()=>'');
        const classified = classifyUpstreamError(upstream.status, null);
        log('error','ai','流式上游错误', { requestId, status:upstream.status, errText:errText.slice(0,200) });
        const encoder = new TextEncoder();
        const errChunk = 'data: ' + JSON.stringify({ error:classified.msg, code:classified.code, request_id:requestId }) + '\n\n';
        clearTimeout(timeoutId);
        return new Response(errChunk + 'data: [DONE]\n\n', {
          status: 200,
          headers: {
            'Content-Type':'text/event-stream; charset=utf-8',
            'Cache-Control':'no-cache, no-transform',
            'Connection':'keep-alive',
            'Access-Control-Allow-Origin':'*',
            'X-Request-Id':requestId
          }
        });
      }
      const reader = upstream.body.getReader();
      const encoder = new TextEncoder();
      const streamObj = new ReadableStream({
        async start(controller){
          try {
            while (true){
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch(e){
            log('error','ai','流式传输中断', { requestId, err:e.message });
            try {
              controller.enqueue(encoder.encode('data: ' + JSON.stringify({ error:'流式传输中断', code:'stream_interrupted', request_id:requestId }) + '\n\n'));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch(_){ /* controller 已关闭 */ }
          } finally {
            clearTimeout(timeoutId);
          }
        },
        cancel(reason){ clearTimeout(timeoutId); reader.cancel(reason); }
      });
      return new Response(streamObj, {
        status: 200,
        headers: {
          'Content-Type':'text/event-stream; charset=utf-8',
          'Cache-Control':'no-cache, no-transform',
          'Connection':'keep-alive',
          'Access-Control-Allow-Origin':'*',
          'X-Request-Id':requestId
        }
      });
    }

    // 非流式
    if (!upstream.ok){
      // 上游错误响应可能不是合法 JSON（如 500 + "Internal Server Error"），需容错解析
      let data = null;
      try { data = await upstream.json(); } catch(e) {}
      const classified = classifyUpstreamError(upstream.status, data);
      log('warn','ai','上游错误', { requestId, status:upstream.status, code:classified.code });
      const status = (upstream.status === 429) ? 429
                   : (upstream.status === 401 || upstream.status === 403) ? 401
                   : (upstream.status === 400) ? 400 : 502;
      return jsonResponse({ error:classified.msg, code:classified.code, request_id:requestId }, status, rateHeaders);
    }
    const data = await upstream.json();
    log('info','ai','响应成功', { requestId, model, usage: data.usage });
    return jsonResponse(data, 200, rateHeaders);
  } catch(err){
    clearTimeout(timeoutId);
    if (err.name === 'AbortError'){
      log('error','ai','上游超时', { requestId, timeoutMs:AI_UPSTREAM_TIMEOUT_MS });
      return jsonResponse({ error:'AI 服务响应超时，请稍后重试', code:'timeout', request_id:requestId }, 504, rateHeaders);
    }
    log('error','ai','网络异常', { requestId, err:err.message });
    return jsonResponse({ error:'网络请求失败', code:'network_error', message:err.message, request_id:requestId }, 500, rateHeaders);
  }
}

// ============================================================
// 主入口（ES Module）
// ============================================================
export default {
  async fetch(request, env, ctx){
    const requestId = genRequestId();
    // 注入 VAPID 私钥
    VAPID_PRIVATE_KEY_SECRET = env.VAPID_PRIVATE_KEY || '';

    // CORS 预检
    if (request.method === 'OPTIONS'){
      return new Response(null, {
        headers:{
          'Access-Control-Allow-Origin':'*',
          'Access-Control-Allow-Methods':'POST, OPTIONS, GET',
          'Access-Control-Allow-Headers':'Content-Type',
          'X-Request-Id':requestId
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ===== 健康检查（仅 GET）=====
    if (request.method === 'GET' && (path === '/health' || path === '/')){
      return jsonResponse({ ok:true, service:'ai-proxy', version:'2.0', time:new Date().toISOString(), requestId });
    }

    // ===== 推送相关路由 =====
    if (path.startsWith('/push/')){
      if (!env.PUSH_KV) return jsonResponse({ error:'未绑定 PUSH_KV', request_id:requestId }, 500);
      try { return await handlePushRoute(request, env, path); }
      catch(e){
        log('error','push','路由异常', { requestId, err:e.message, path });
        return jsonResponse({ error:'推送路由错误:'+e.message, request_id:requestId }, 500);
      }
    }

    // ===== MCP 代理路由 =====
    if (path.startsWith('/mcp/')){
      try { return await handleMcpRoute(request, env, path); }
      catch(e){
        log('error','mcp','路由异常', { requestId, err:e.message, path });
        return jsonResponse({ error:'MCP 路由错误:'+e.message, request_id:requestId }, 500);
      }
    }

    // ===== AI 代理路由（兼容 / 、/v1/chat/completions 、/chat/completions 、/ai）=====
    if (request.method !== 'POST'){
      return new Response('Method not allowed', { status:405, headers:{ 'Access-Control-Allow-Origin':'*', 'X-Request-Id':requestId } });
    }
    const isAiRoute = path === '/' || path === '/v1/chat/completions' || path === '/chat/completions' || path === '/ai';
    if (!isAiRoute){
      return jsonResponse({ error:'路由不存在', path, request_id:requestId }, 404);
    }
    try {
      return await handleAiProxy(request, env, ctx, requestId);
    } catch(e){
      // 兜底：任何未捕获异常都不让前端崩溃
      log('error','ai','未捕获异常', { requestId, err:e.message, stack:e.stack });
      return jsonResponse({ error:'服务器内部错误', code:'internal_error', request_id:requestId }, 500);
    }
  },

  // Cron 定时触发器
  async scheduled(event, env, ctx){
    VAPID_PRIVATE_KEY_SECRET = env.VAPID_PRIVATE_KEY || '';
    ctx.waitUntil(runScheduled(env));
  }
};
