// Cloudflare Workers - AI 养生顾问代理 (Service Worker 格式)
// 功能：隐藏 API Key + 请求限流 + 统一接口

// ============================================================
// 配置
// ============================================================
const RATE_WINDOW = 60 * 60 * 1000;
const API_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const DEFAULT_MODEL = 'qwen-turbo';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.7;

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
19.《睡眠革命》Nick Littlehales——R90睡眠方案
20.《运动改造大脑》John Ratey——运动与脑科学
21.《正念的奇迹》一行禅师——正念冥想
22.《抗炎生活》池谷敏郎——慢性炎症预防
23.《肠子的小心思》朱莉娅·恩德斯——肠道菌群
24.《深度营养》凯瑟琳·沙纳汉——传统饮食智慧

回答时请结合以上经典理论给出建议，并注明引用出处。回答简洁实用，每次控制在200字以内。`;

// ============================================================
// 工具函数
// ============================================================
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') ||
         request.headers.get('X-Forwarded-For') ||
         request.headers.get('X-Real-IP') ||
         'unknown';
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...headers
    }
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function validateRequest(body) {
  if (!body.messages || !Array.isArray(body.messages)) {
    return { valid: false, error: 'messages 字段是必需的' };
  }
  for (const msg of body.messages) {
    if (!msg.role || !msg.content) {
      return { valid: false, error: '每条消息必须包含 role 和 content' };
    }
    if (typeof msg.content !== 'string') {
      return { valid: false, error: '消息内容必须是字符串' };
    }
    if (msg.content.length > 2000) {
      return { valid: false, error: '单条消息内容不能超过 2000 字符' };
    }
  }
  return { valid: true };
}

// ============================================================
// 限流逻辑
// ============================================================
const rateLimitMap = new Map();

function checkRateLimit(ip, limit) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 0, windowStart: now });
  }
  const record = rateLimitMap.get(ip);
  if (now - record.windowStart > RATE_WINDOW) {
    record.count = 0;
    record.windowStart = now;
  }
  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: Math.ceil((record.windowStart + RATE_WINDOW - now) / 1000)
    };
  }
  record.count++;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetTime: Math.ceil((record.windowStart + RATE_WINDOW - now) / 1000)
  };
}

// ============================================================
// 主处理函数
// ============================================================
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  // 只允许 POST
  if (request.method !== 'POST') {
    return textResponse('Method not allowed', 405);
  }

  // 检查 API Key（环境变量作为全局变量注入）
  if (typeof QWEN_API_KEY === 'undefined' || !QWEN_API_KEY) {
    return jsonResponse({
      error: 'API Key 未配置',
      message: '请在 Worker 设置中添加环境变量 QWEN_API_KEY'
    }, 500);
  }

  // 获取限流配置
  const rateLimit = parseInt(typeof RATE_LIMIT !== 'undefined' ? RATE_LIMIT : '50') || 50;

  // 获取客户端 IP 并检查限流
  const clientIP = getClientIP(request);
  const rateCheck = checkRateLimit(clientIP, rateLimit);

  const headers = {
    'X-RateLimit-Limit': rateLimit.toString(),
    'X-RateLimit-Remaining': rateCheck.remaining.toString(),
    'X-RateLimit-Reset': rateCheck.resetTime.toString()
  };

  if (!rateCheck.allowed) {
    return jsonResponse({
      error: '请求过于频繁',
      message: `已达每小时 ${rateLimit} 次请求上限，请稍后再试`,
      retryAfter: rateCheck.resetTime
    }, 429, headers);
  }

  // 解析请求体
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: '无效的 JSON 请求体' }, 400);
  }

  // 验证请求
  const validation = validateRequest(body);
  if (!validation.valid) {
    return jsonResponse({ error: validation.error }, 400, headers);
  }

  // 提取参数
  const model = body.model || DEFAULT_MODEL;
  const messages = body.messages || [];
  const maxTokens = body.max_tokens || MAX_TOKENS;
  const temperature = body.temperature || TEMPERATURE;

  // 添加系统提示词
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
  ];

  try {
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${QWEN_API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: fullMessages,
        max_tokens: maxTokens,
        temperature: temperature,
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[AI Proxy] API Error:', response.status, data);
      let errorMsg = 'AI 服务暂时不可用';
      let statusCode = 500;
      if (response.status === 401 || response.status === 403) {
        errorMsg = 'API 认证失败，请检查配置';
        statusCode = 401;
      } else if (response.status === 429) {
        errorMsg = 'API 请求配额已用完，请稍后再试';
        statusCode = 429;
      } else if (response.status === 400) {
        errorMsg = data.error?.message || '请求参数错误';
        statusCode = 400;
      } else if (data.error?.message) {
        errorMsg = data.error.message;
      }
      return jsonResponse({ error: errorMsg, code: response.status }, statusCode, headers);
    }

    return jsonResponse(data, 200, headers);

  } catch (err) {
    console.error('[AI Proxy] Fetch Error:', err);
    return jsonResponse({
      error: '网络请求失败',
      message: err.message
    }, 500, headers);
  }
}
