// 阿里云函数计算（FC）版 AI 代理
// 与养生助手 App 端 ai.js 的「Worker 代理模式」完全兼容：
//   App 发送 POST {本函数地址}  body={model,messages,max_tokens,temperature}
//   本函数加上 SYSTEM_PROMPT 后转发阿里百炼，并把 OpenAI 格式响应原样返回
// 部署：函数计算控制台创建「HTTP 触发器」函数（运行时 Node.js 20），上传本文件，
//       配置环境变量 QWEN_API_KEY，触发器认证方式选 anonymous。
// 注意：FC 原生 HTTP 触发器的入参为 (req, resp, context)，req.body 为 Buffer，
//       本函数使用 async/await，FC 运行时支持 handler 返回 Promise。

// ============================================================
// 系统提示词（与 serverless/cloudflare-workers/ai-proxy.js 保持一致）
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
// 配置
// ============================================================
const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const RATE_WINDOW = 60 * 60 * 1000; // 1 小时
const RATE_LIMIT = 50;             // 每 IP 每小时上限
const MAX_MSG_LENGTH = 2000;

// 进程内限流（多实例不共享，仅作基础防护）
const rateLimitMap = new Map();

// ============================================================
// 工具函数
// ============================================================
function setCors(resp) {
  resp.setHeader('Access-Control-Allow-Origin', '*');
  resp.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  resp.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

// ============================================================
// 主入口（FC HTTP 触发器，async 写法）
// ============================================================
exports.handler = async function (req, resp, context) {
  try {
    // CORS 预检
    if (req.method === 'OPTIONS') {
      setCors(resp);
      resp.setStatusCode(204);
      resp.send('');
      return;
    }

    // 存活检测
    if (req.method === 'GET') {
      sendJson(resp, 200, { ok: true, service: 'lifestyle-ai-proxy-fc', dashscope: !!process.env.QWEN_API_KEY });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(resp, 405, { error: 'Method not allowed' });
      return;
    }

    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) {
      sendJson(resp, 500, { error: '未配置 QWEN_API_KEY', message: '请在函数环境变量中添加 QWEN_API_KEY' });
      return;
    }

    // 限流
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

    // 解析 body
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
  } catch (err) {
    sendJson(resp, 500, { error: '内部错误', message: err.message });
  }
};
