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

const SYSTEM_PROMPT = '你是一位精通《黄帝内经》等14部中医养生经典的养生顾问。回答用户健康问题时，请结合中医经典理论给出建议，并尽可能注明引用的古籍出处（如《素问》《灵枢》等）。回答要简洁实用，适合普通用户理解，每次回答控制在200字以内。';

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
