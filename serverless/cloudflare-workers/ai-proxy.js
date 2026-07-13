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
// AI 养生顾问系统提示词
// ============================================================
const SYSTEM_PROMPT = `你是一位精通以下9部中医古籍和15部现代养生著作的养生顾问。

【古籍经典】
1.《黄帝内经》（《素问》《灵枢》）——中医养生理论之源，阴阳五行、脏腑经络、治未病
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

// ============================================================
// 限流配置
// ============================================================
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_LIMIT = 50;
const MAX_MSG_LENGTH = 2000;

// ============================================================
// 工具函数
// ============================================================
function getClientIP(request){
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For') ||
         request.headers.get('X-Real-IP') || 'unknown';
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

const rateLimitMap = new Map();
function checkRateLimit(ip, limit){
  const now = Date.now();
  if (!rateLimitMap.has(ip)) rateLimitMap.set(ip, { count:0, windowStart:now });
  const record = rateLimitMap.get(ip);
  if (now - record.windowStart > RATE_WINDOW){ record.count = 0; record.windowStart = now; }
  if (record.count >= limit) return { allowed:false, remaining:0, resetTime:Math.ceil((record.windowStart+RATE_WINDOW-now)/1000) };
  record.count++;
  return { allowed:true, remaining:limit-record.count, resetTime:Math.ceil((record.windowStart+RATE_WINDOW-now)/1000) };
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
// KV 辅助（PUSH_KV 绑定）
// ============================================================
async function kvGetSubs(env){
  try { const raw = await env.PUSH_KV.get('subs'); return raw ? JSON.parse(raw) : []; }
  catch(e){ return []; }
}
async function kvSaveSubs(env, subs){
  await env.PUSH_KV.put('subs', JSON.stringify(subs));
}
async function kvGetSchedule(env){
  try { const raw = await env.PUSH_KV.get('schedule'); return raw ? JSON.parse(raw) : { schedule:[], offset:480 }; }
  catch(e){ return { schedule:[], offset:480 }; }
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
    await kvSaveSchedule(env, data);
    return jsonResponse({ ok:true, count:data.schedule.length });
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
    return jsonResponse({ subs:subs.length, scheduleCount:sch.schedule.length, offset:sch.offset, vapidConfigured: !!VAPID_PRIVATE_KEY_SECRET });
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
  if (!VAPID_PRIVATE_KEY_SECRET){ console.log('[cron] 未配置 VAPID_PRIVATE_KEY，跳过'); return; }
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

  const pushed = [];
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
            const r = await sendPush(sub, {
              title: (item.icon||'⏰') + ' ' + item.name + '时间到了',
              body: item.tip || '记得完成打卡哦',
              tag: 'habit-' + item.id,
              requireInteraction: true,
              vibrate: [200,100,200,100,300]
            });
            await env.PUSH_KV.put(dedupKey, '1', { expirationTtl: 7200 });
            pushed.push({ id:item.id, time:t, ok:r.ok, status:r.status });
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
          const r = await sendPush(sub, {
            title: (item.icon||'⏰') + ' ' + item.name + '提醒',
            body: item.tip || '该完成啦',
            tag: 'habit-iv-' + item.id,
            requireInteraction: true
          });
          await kvSetIntervalTs(env, sub.endpoint, item.id, Date.now());
          pushed.push({ id:item.id, type:'interval', ok:r.ok, status:r.status });
        }
      }
    }
  }
  console.log('[cron] pushed', pushed.length, JSON.stringify(pushed));
}

// ============================================================
// 主入口（ES Module）
// ============================================================
export default {
  async fetch(request, env, ctx){
    // 注入 VAPID 私钥
    VAPID_PRIVATE_KEY_SECRET = env.VAPID_PRIVATE_KEY || '';

    // CORS 预检
    if (request.method === 'OPTIONS'){
      return new Response(null, {
        headers:{
          'Access-Control-Allow-Origin':'*',
          'Access-Control-Allow-Methods':'POST, OPTIONS, GET',
          'Access-Control-Allow-Headers':'Content-Type'
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ===== 推送相关路由 =====
    if (path.startsWith('/push/')){
      if (!env.PUSH_KV) return jsonResponse({ error:'未绑定 PUSH_KV' }, 500);
      try { return await handlePushRoute(request, env, path); }
      catch(e){ return jsonResponse({ error:'推送路由错误:'+e.message }, 500); }
    }

    // ===== MCP 代理路由 =====
    if (path.startsWith('/mcp/')){
      try { return await handleMcpRoute(request, env, path); }
      catch(e){ return jsonResponse({ error:'MCP 路由错误:'+e.message }, 500); }
    }

    // ===== 以下为原 AI 代理逻辑 =====
    if (request.method !== 'POST'){
      return new Response('Method not allowed', { status:405, headers:{ 'Access-Control-Allow-Origin':'*' } });
    }
    const QWEN_API_KEY = env.QWEN_API_KEY;
    if (!QWEN_API_KEY){
      return jsonResponse({ error:'Worker 未配置 QWEN_API_KEY', message:'请在 Worker 设置中添加 QWEN_API_KEY' }, 500);
    }
    const rateLimit = parseInt(env.RATE_LIMIT) || RATE_LIMIT;
    const clientIP = getClientIP(request);
    const rateCheck = checkRateLimit(clientIP, rateLimit);
    const rateHeaders = {
      'X-RateLimit-Limit':rateLimit.toString(),
      'X-RateLimit-Remaining':rateCheck.remaining.toString(),
      'X-RateLimit-Reset':rateCheck.resetTime.toString()
    };
    if (!rateCheck.allowed){
      return jsonResponse({ error:'请求过于频繁', message:'已达每小时 '+rateLimit+' 次请求上限', retryAfter:rateCheck.resetTime }, 429, rateHeaders);
    }
    let body;
    try { body = await request.json(); }
    catch(e){ return jsonResponse({ error:'无效的 JSON 请求体' }, 400, rateHeaders); }
    const validation = validateRequest(body);
    if (!validation.valid) return jsonResponse({ error:validation.error }, 400, rateHeaders);

    const model = body.model || 'qwen-turbo';
    const messages = body.messages || [];
    const maxTokens = body.max_tokens || 500;
    const temperature = body.temperature || 0.7;
    const fullMessages = [{ role:'system', content:SYSTEM_PROMPT }, ...messages];

    try {
      const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + QWEN_API_KEY },
        body: JSON.stringify({ model, messages:fullMessages, max_tokens:maxTokens, temperature, stream:false })
      });
      const data = await response.json();
      if (!response.ok){
        let errorMsg = 'AI 服务暂时不可用', statusCode = 500;
        if (response.status === 401 || response.status === 403){ errorMsg='API 认证失败，请检查配置'; statusCode=401; }
        else if (response.status === 429){ errorMsg='API 请求配额已用完'; statusCode=429; }
        else if (response.status === 400){ errorMsg=(data.error && data.error.message)||'请求参数错误'; statusCode=400; }
        else if (data.error && data.error.message){ errorMsg = data.error.message; }
        return jsonResponse({ error:errorMsg, code:response.status }, statusCode, rateHeaders);
      }
      return jsonResponse(data, 200, rateHeaders);
    } catch(err){
      return jsonResponse({ error:'网络请求失败', message:err.message }, 500, rateHeaders);
    }
  },

  // Cron 定时触发器
  async scheduled(event, env, ctx){
    VAPID_PRIVATE_KEY_SECRET = env.VAPID_PRIVATE_KEY || '';
    ctx.waitUntil(runScheduled(env));
  }
};
