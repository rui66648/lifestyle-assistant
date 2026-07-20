/**
 * Cloudflare Worker (ai-proxy.js) 单元测试
 * ----------------------------------------------------------------
 * 覆盖范围：
 *   1. 健康检查路由
 *   2. 滑动窗口限流（5 次/分钟 → 第 6 次返回 429）
 *   3. 请求校验（messages 缺失、内容过长）
 *   4. OpenAI 兼容非流式响应透传
 *   5. 流式 SSE 响应透传
 *   6. 上游错误分类（401/429/400/500/超时）
 *   7. 推送路由 /push/subscribe、/push/status
 *   8. 路由不存在 → 404；非 POST → 405
 *
 * 运行：`npm test` 或 `npx vitest run test/worker/`
 *
 * 设计要点：
 *   - 完全 mock `globalThis.fetch`，断网测试
 *   - 自定义 fake KV（内存 Map）模拟 PUSH_KV 绑定
 *   - 不依赖真实 VAPID 私钥（推送加密走集成测试）
 * ----------------------------------------------------------------
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================
// Mock 工具：fake KV / fake ctx / 构造 Request
// ============================================================
function makeFakeKv() {
  const store = new Map();
  return {
    _store: store,
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value, opts) {
      store.set(key, value);
      // 简化 TTL：到期自动删除（测试中通常无需触发）
      if (opts && opts.expirationTtl) {
        setTimeout(() => store.delete(key), opts.expirationTtl * 1000).unref?.();
      }
    },
    async delete(key) { store.delete(key); }
  };
}

function makeEnv(overrides = {}) {
  return {
    QWEN_API_KEY: 'sk-test-key',
    VAPID_PRIVATE_KEY: '', // 默认不配 VAPID，避免影响 AI 测试
    PUSH_KV: makeFakeKv(),
    RATE_LIMIT: 5,
    ...overrides
  };
}

function makeCtx() {
  return { waitUntil: (p) => { p.catch(() => {}); } };
}

function makeRequest(path, options = {}) {
  const url = 'https://ai-proxy.test' + path;
  const init = {
    method: options.method || 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4', ...(options.headers || {}) },
  };
  if (options.body !== undefined) {
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }
  return new Request(url, init);
}

async function readJson(resp) {
  return JSON.parse(await resp.text());
}

// ============================================================
// 测试套件
// ============================================================
// 注：worker 模块内 rateLimitMap 为模块级状态，跨用例会污染。
// 用 vi.resetModules() + 动态 import() 在每个用例前重新加载模块，确保隔离。
describe('ai-proxy Worker', () => {
  let worker;
  let originalFetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
    worker = (await import('../../serverless/cloudflare-workers/ai-proxy.js')).default;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------
  // 1. 健康检查
  // ----------------------------------------------------------
  describe('健康检查 /health', () => {
    it('GET /health 返回 200 + service 信息', async () => {
      const res = await worker.fetch(makeRequest('/health', { method: 'GET' }), makeEnv(), makeCtx());
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body.ok).toBe(true);
      expect(body.service).toBe('ai-proxy');
      expect(body.version).toBe('2.0');
      expect(body.requestId).toMatch(/^req_/);
    });

    it('GET / 返回健康检查（不与 POST / 冲突）', async () => {
      const res = await worker.fetch(makeRequest('/', { method: 'GET' }), makeEnv(), makeCtx());
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body.ok).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 2. 滑动窗口限流
  // ----------------------------------------------------------
  describe('滑动窗口限流（5 次/分钟）', () => {
    beforeEach(() => {
      // mock 上游：永远返回成功
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
        usage: { total_tokens: 10 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });

    it('前 5 次请求成功，第 6 次返回 429', async () => {
      const env = makeEnv();
      const ctx = makeCtx();
      const body = { messages: [{ role: 'user', content: 'hi' }] };

      for (let i = 0; i < 5; i++) {
        const res = await worker.fetch(makeRequest('/', { body }), env, ctx);
        expect(res.status).toBe(200);
        const headers = res.headers;
        expect(headers.get('X-RateLimit-Limit')).toBe('5');
        expect(parseInt(headers.get('X-RateLimit-Remaining'))).toBe(4 - i);
      }

      const sixth = await worker.fetch(makeRequest('/', { body }), env, ctx);
      expect(sixth.status).toBe(429);
      expect(sixth.headers.get('Retry-After')).toMatch(/^\d+$/);
      const errBody = await readJson(sixth);
      expect(errBody.code).toBe('rate_limited');
      expect(errBody.request_id).toMatch(/^req_/);
    });

    it('不同 IP 独立计数', async () => {
      const env = makeEnv();
      const ctx = makeCtx();
      const body = { messages: [{ role: 'user', content: 'hi' }] };

      // IP-A 打满 5 次
      for (let i = 0; i < 5; i++) {
        await worker.fetch(makeRequest('/', { body, headers: { 'CF-Connecting-IP': '10.0.0.1' } }), env, ctx);
      }
      // IP-A 第 6 次被限流
      const blocked = await worker.fetch(makeRequest('/', { body, headers: { 'CF-Connecting-IP': '10.0.0.1' } }), env, ctx);
      expect(blocked.status).toBe(429);

      // IP-B 仍可用
      const other = await worker.fetch(makeRequest('/', { body, headers: { 'CF-Connecting-IP': '10.0.0.2' } }), env, ctx);
      expect(other.status).toBe(200);
    });

    it('429 响应包含 X-RateLimit-* 头', async () => {
      const env = makeEnv();
      const ctx = makeCtx();
      const body = { messages: [{ role: 'user', content: 'hi' }] };
      for (let i = 0; i < 5; i++) {
        await worker.fetch(makeRequest('/', { body }), env, ctx);
      }
      const res = await worker.fetch(makeRequest('/', { body }), env, ctx);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(parseInt(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // 3. 请求校验
  // ----------------------------------------------------------
  describe('请求校验', () => {
    it('缺少 messages 字段返回 400 + bad_request', async () => {
      const res = await worker.fetch(makeRequest('/', { body: { model: 'qwen-turbo' } }), makeEnv(), makeCtx());
      expect(res.status).toBe(400);
      const body = await readJson(res);
      expect(body.code).toBe('bad_request');
    });

    it('单条消息超过 2000 字符返回 400', async () => {
      const long = 'a'.repeat(2001);
      const res = await worker.fetch(makeRequest('/', { body: { messages: [{ role: 'user', content: long }] } }), makeEnv(), makeCtx());
      expect(res.status).toBe(400);
      const body = await readJson(res);
      expect(body.code).toBe('bad_request');
      expect(body.error).toContain('2000');
    });

    it('无效 JSON 返回 400 + bad_json', async () => {
      const req = new Request('https://ai-proxy.test/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
        body: 'not-json'
      });
      const res = await worker.fetch(req, makeEnv(), makeCtx());
      expect(res.status).toBe(400);
      const body = await readJson(res);
      expect(body.code).toBe('bad_json');
    });

    it('未配置 QWEN_API_KEY 返回 500 + config_missing', async () => {
      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv({ QWEN_API_KEY: '' }),
        makeCtx()
      );
      expect(res.status).toBe(500);
      const body = await readJson(res);
      expect(body.code).toBe('config_missing');
    });
  });

  // ----------------------------------------------------------
  // 4. 非流式 AI 响应透传
  // ----------------------------------------------------------
  describe('非流式 AI 代理', () => {
    it('透传上游 OpenAI 格式响应', async () => {
      const upstreamResp = {
        id: 'chatcmpl-xxx',
        choices: [{ message: { role: 'assistant', content: '建议多喝水' }, finish_reason: 'stop', index: 0 }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
      };
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(upstreamResp), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));

      const res = await worker.fetch(
        makeRequest('/', { body: { model: 'qwen-turbo', messages: [{ role: 'user', content: '怎么喝水' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body.choices[0].message.content).toBe('建议多喝水');
      expect(body.usage.total_tokens).toBe(30);
      expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
    });

    it('/v1/chat/completions 路由别名也能工作', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

      const res = await worker.fetch(
        makeRequest('/v1/chat/completions', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(200);
    });

    it('上游 401 → 返回 401 + auth_failed', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
        error: { message: 'Invalid API key' }
      }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(401);
      const body = await readJson(res);
      expect(body.code).toBe('auth_failed');
    });

    it('上游 429 → 返回 429 + quota_exhausted', async () => {
      globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
        error: { message: 'quota exceeded' }
      }), { status: 429, headers: { 'Content-Type': 'application/json' } }));

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(429);
      const body = await readJson(res);
      expect(body.code).toBe('quota_exhausted');
    });

    it('上游 500 → 返回 502 + upstream_error', async () => {
      globalThis.fetch = vi.fn(async () => new Response('Internal Server Error', { status: 500 }));

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(502);
      const body = await readJson(res);
      expect(body.code).toBe('upstream_error');
    });
  });

  // ----------------------------------------------------------
  // 5. 流式响应
  // ----------------------------------------------------------
  describe('流式 SSE 响应', () => {
    it('透传上游 SSE chunk 并以 [DONE] 结尾', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"好"}}]}\n\n',
        'data: [DONE]\n\n'
      ];
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          sseChunks.forEach(c => controller.enqueue(encoder.encode(c)));
          controller.close();
        }
      });
      globalThis.fetch = vi.fn(async () => new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      }));

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/event-stream');
      expect(res.headers.get('Cache-Control')).toContain('no-cache');

      const text = await res.text();
      expect(text).toContain('"content":"你"');
      expect(text).toContain('"content":"好"');
      expect(text.trim().endsWith('[DONE]')).toBe(true);
    });

    it('上游流式错误时返回错误 SSE chunk', async () => {
      globalThis.fetch = vi.fn(async () => new Response('Unauthorized', { status: 401 }));

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }], stream: true } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('"error"');
      expect(text).toContain('"code":"auth_failed"');
      expect(text).toContain('[DONE]');
    });
  });

  // ----------------------------------------------------------
  // 6. 超时控制
  // ----------------------------------------------------------
  describe('上游超时', () => {
    it('AbortError → 返回 504 + timeout', async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      globalThis.fetch = vi.fn(async () => { throw err; });

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(504);
      const body = await readJson(res);
      expect(body.code).toBe('timeout');
    });

    it('网络异常 → 返回 500 + network_error', async () => {
      globalThis.fetch = vi.fn(async () => { throw new Error('connect ECONNREFUSED'); });

      const res = await worker.fetch(
        makeRequest('/', { body: { messages: [{ role: 'user', content: 'hi' }] } }),
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(500);
      const body = await readJson(res);
      expect(body.code).toBe('network_error');
    });
  });

  // ----------------------------------------------------------
  // 7. 路由匹配
  // ----------------------------------------------------------
  describe('路由匹配', () => {
    it('未知路由返回 404', async () => {
      const res = await worker.fetch(makeRequest('/unknown-path', { body: {} }), makeEnv(), makeCtx());
      expect(res.status).toBe(404);
      const body = await readJson(res);
      expect(body.error).toContain('路由不存在');
    });

    it('GET /v1/chat/completions 返回 405', async () => {
      const res = await worker.fetch(makeRequest('/v1/chat/completions', { method: 'GET' }), makeEnv(), makeCtx());
      expect(res.status).toBe(405);
    });

    it('OPTIONS 请求返回 CORS 预检响应', async () => {
      const res = await worker.fetch(makeRequest('/', { method: 'OPTIONS' }), makeEnv(), makeCtx());
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  // ----------------------------------------------------------
  // 8. 推送路由（无需 VAPID 私钥的部分）
  // ----------------------------------------------------------
  describe('推送路由', () => {
    it('POST /push/subscribe 注册订阅到 KV', async () => {
      const env = makeEnv();
      const sub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: 'xxx', auth: 'yyy' }
      };
      const res = await worker.fetch(makeRequest('/push/subscribe', { body: sub }), env, makeCtx());
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body.ok).toBe(true);
      expect(body.total).toBe(1);
      // 验证已写入 KV
      const stored = JSON.parse(await env.PUSH_KV.get('subs'));
      expect(stored).toHaveLength(1);
      expect(stored[0].endpoint).toBe(sub.endpoint);
    });

    it('订阅数据不完整返回 400', async () => {
      const res = await worker.fetch(
        makeRequest('/push/subscribe', { body: { endpoint: 'x' } }), // 缺 keys
        makeEnv(),
        makeCtx()
      );
      expect(res.status).toBe(400);
    });

    it('GET /push/status 返回订阅数和 metrics', async () => {
      const env = makeEnv();
      // 先注册一个订阅
      await worker.fetch(makeRequest('/push/subscribe', { body: {
        endpoint: 'https://x.test/a', keys: { p256dh: 'p', auth: 'a' }
      } }), env, makeCtx());

      const res = await worker.fetch(makeRequest('/push/status', { method: 'GET' }), env, makeCtx());
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body.subs).toBe(1);
      expect(body.scheduleCount).toBe(0);
      expect(body.offset).toBe(480);
      expect(body.vapidConfigured).toBe(false); // 未配置 VAPID
      expect(body.metrics).toBeDefined();
      expect(body.metrics.ok).toBe(0);
    });

    it('未绑定 PUSH_KV 时返回 500', async () => {
      const env = makeEnv({ PUSH_KV: undefined });
      const res = await worker.fetch(makeRequest('/push/status', { method: 'GET' }), env, makeCtx());
      expect(res.status).toBe(500);
      const body = await readJson(res);
      expect(body.error).toContain('PUSH_KV');
    });
  });

  // ----------------------------------------------------------
  // 9. Cron 调度（无 VAPID 时应跳过）
  // ----------------------------------------------------------
  describe('Cron scheduled', () => {
    it('未配置 VAPID_PRIVATE_KEY 时安全跳过', async () => {
      const env = makeEnv({ VAPID_PRIVATE_KEY: '' });
      const ctx = makeCtx();
      // 应不抛异常
      await expect(worker.scheduled({}, env, ctx)).resolves.toBeUndefined();
    });

    it('无订阅时安全跳过', async () => {
      const env = makeEnv({ VAPID_PRIVATE_KEY: 'fake-key' });
      const ctx = makeCtx();
      await expect(worker.scheduled({}, env, ctx)).resolves.toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 10. KV 数据结构
  // ----------------------------------------------------------
  describe('KV schema', () => {
    it('/push/schedule 上传时间表写入 KV schedule 键', async () => {
      const env = makeEnv();
      const schedule = [
        { id: 'h1', name: '喝水', icon: '💧', tip: '该喝水啦', fixed: { time: '09:00', days: [1,2,3,4,5] } }
      ];
      const res = await worker.fetch(makeRequest('/push/schedule', { body: { schedule, offset: 480 } }), env, makeCtx());
      expect(res.status).toBe(200);
      const body = await readJson(res);
      expect(body.count).toBe(1);

      const stored = JSON.parse(await env.PUSH_KV.get('schedule'));
      expect(stored.schedule).toHaveLength(1);
      expect(stored.offset).toBe(480);
      expect(stored.updatedAt).toBeGreaterThan(0);
    });
  });
});
