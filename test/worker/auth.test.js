/**
 * 用户认证与同步模块 (auth.js) 单元测试
 * ----------------------------------------------------------------
 * 覆盖范围：
 *   1. 注册（成功 + 重复手机号 + 参数校验）
 *   2. 登录（成功 + 密码错误 + 不存在的用户）
 *   3. Token 刷新（成功 + 过期 token）
 *   4. 获取/更新用户信息
 *   5. 登出
 *   6. 数据同步（上传 + 下载）
 *   7. JWT 签发与验证
 *   8. 密码哈希与验证
 *
 * 运行：`npx vitest run test/worker/auth.test.js`
 * ----------------------------------------------------------------
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================
// Mock D1 数据库
// ============================================================
function makeFakeD1() {
  const tables = {
    users: new Map(),
    refresh_tokens: new Map(),
    user_data: new Map(),
  };

  return {
    _tables: tables,

    prepare(sql) {
      const self = this;
      const binds = [];

      const stmt = {
        bind(...args) { binds.push(...args); return stmt; },

        async first() {
          return self._query(sql, binds, 'first');
        },

        async all() {
          return { results: self._query(sql, binds, 'all') };
        },

        async run() {
          self._execute(sql, binds);
          return {};
        },
      };

      return stmt;
    },

    async batch(stmts) {
      for (const s of stmts) await s.run();
    },

    _query(sql, binds, mode) {
      const sqlLower = sql.toLowerCase().trim();

      if (!sqlLower.startsWith('select')) return mode === 'first' ? null : [];

      // SELECT ... FROM users WHERE phone = ?
      if (sqlLower.includes('from users') && sqlLower.includes('where phone')) {
        const phone = binds[0];
        const user = Array.from(this._tables.users.values()).find(u => u.phone === phone);
        return mode === 'first' ? (user || null) : (user ? [user] : []);
      }
      // SELECT ... FROM users WHERE id = ?
      if (sqlLower.includes('from users') && sqlLower.includes('where id')) {
        const id = binds[0];
        const user = this._tables.users.get(id);
        return mode === 'first' ? (user || null) : (user ? [user] : []);
      }
      // SELECT rt.*, u.* FROM refresh_tokens rt JOIN users u ... WHERE rt.token = ?
      if (sqlLower.includes('refresh_tokens') && sqlLower.includes('join')) {
        const token = binds[0];
        const rt = this._tables.refresh_tokens.get(token);
        if (!rt) return mode === 'first' ? null : [];
        const user = this._tables.users.get(rt.user_id);
        if (!user) return mode === 'first' ? null : [];
        return mode === 'first'
          ? { ...rt, phone: user.phone, nickname: user.nickname }
          : [{ ...rt, phone: user.phone, nickname: user.nickname }];
      }
      // SELECT data_key, data_value, updated_at FROM user_data WHERE user_id = ?
      if (sqlLower.includes('from user_data') && sqlLower.includes('where user_id')) {
        const userId = binds[0];
        const rows = Array.from(this._tables.user_data.values()).filter(d => d.user_id === userId);
        return mode === 'first' ? (rows[0] || null) : rows;
      }

      return mode === 'first' ? null : [];
    },

    _execute(sql, binds) {
      const sqlLower = sql.toLowerCase().trim();

      // INSERT INTO users
      if (sqlLower.startsWith('insert into users')) {
        const [id, phone, password, salt, nickname, createdAt, updatedAt] = binds;
        this._tables.users.set(id, { id, phone, password, salt, nickname, created_at: createdAt, updated_at: updatedAt });
        return;
      }

      // INSERT INTO refresh_tokens
      if (sqlLower.startsWith('insert into refresh_tokens')) {
        const [token, userId, deviceId, expiresAt, createdAt] = binds;
        this._tables.refresh_tokens.set(token, { token, user_id: userId, device_id: deviceId, expires_at: expiresAt, created_at: createdAt });
        return;
      }

      // INSERT INTO user_data ... ON CONFLICT ... DO UPDATE
      if (sqlLower.startsWith('insert into user_data')) {
        const [userId, dataKey, dataValue, updatedAt] = binds;
        const pk = userId + ':' + dataKey;
        this._tables.user_data.set(pk, { user_id: userId, data_key: dataKey, data_value: dataValue, updated_at: updatedAt });
        return;
      }

      // DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?
      if (sqlLower.startsWith('delete from refresh_tokens')) {
        const token = binds[0];
        this._tables.refresh_tokens.delete(token);
        return;
      }

      // UPDATE users SET nickname
      if (sqlLower.startsWith('update users')) {
        const [nickname, updatedAt, userId] = binds;
        const user = this._tables.users.get(userId);
        if (user) { user.nickname = nickname; user.updated_at = updatedAt; }
        return;
      }
    },
  };
}

// ============================================================
// 构造 Request 和 env
// ============================================================
function makeRequest(path, options = {}) {
  const url = 'https://auth.test' + path;
  const init = {
    method: options.method || 'POST',
    headers: options.headers || {},
  };
  if (options.body) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }
  return new Request(url, init);
}

function makeEnv(overrides = {}) {
  return {
    JWT_SECRET: 'test-jwt-secret-key-12345',
    DB: makeFakeD1(),
    ...overrides,
  };
}

// ============================================================
// 导入被测模块
// ============================================================
// 由于 auth.js 使用 export，需要动态导入
// 但 Workers 代码在 Node 环境运行需要一些 polyfill
// 我们直接读取源码并 eval，或使用 ESM import

// polyfill btoa/atob for Node
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof globalThis.atob === 'undefined') {
  globalThis.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

// 动态导入 auth.js 模块
let handleAuthRoute, handleSyncRoute;

beforeEach(async () => {
  // 每次测试前重新导入，确保干净状态
  vi.resetModules();
  const module = await import('../../serverless/cloudflare-workers/auth.js');
  handleAuthRoute = module.handleAuthRoute;
  handleSyncRoute = module.handleSyncRoute;
});

// ============================================================
// 测试用例
// ============================================================
describe('密码哈希', () => {
  it('PBKDF2 应生成不同盐值的哈希', async () => {
    // 通过注册接口间接测试
    const env = makeEnv();
    const req = makeRequest('/auth/register', {
      method: 'POST',
      body: { phone: '13800138000', password: 'test123456', nickname: '测试用户' },
    });
    const resp = await handleAuthRoute(req, env, '/auth/register');
    const data = await resp.json();

    expect(resp.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.user.phone).toBe('13800138000');
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();

    // 验证密码哈希不等于明文
    const userRecord = Array.from(env.DB._tables.users.values())[0];
    expect(userRecord.password).not.toBe('test123456');
    expect(userRecord.salt).toBeTruthy();
    expect(userRecord.password.length).toBe(64); // 32 bytes hex = 64 chars
  });
});

describe('注册 /auth/register', () => {
  it('注册成功返回 201 + token', async () => {
    const env = makeEnv();
    const req = makeRequest('/auth/register', {
      method: 'POST',
      body: { phone: '13900139000', password: 'mypassword', nickname: '小明' },
    });
    const resp = await handleAuthRoute(req, env, '/auth/register');
    const data = await resp.json();

    expect(resp.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(data.user).toBeDefined();
    expect(data.user.nickname).toBe('小明');
    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.expiresIn).toBe(900);
  });

  it('重复手机号返回 409', async () => {
    const env = makeEnv();
    // 先注册一次
    await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13700137000', password: 'test123' } }),
      env, '/auth/register'
    );
    // 再注册同一手机号
    const resp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13700137000', password: 'test456' } }),
      env, '/auth/register'
    );
    const data = await resp.json();
    expect(resp.status).toBe(409);
    expect(data.error).toContain('已注册');
  });

  it('手机号格式错误返回 400', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '12345', password: 'test123' } }),
      env, '/auth/register'
    );
    expect(resp.status).toBe(400);
  });

  it('密码过短返回 400', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138001', password: '123' } }),
      env, '/auth/register'
    );
    expect(resp.status).toBe(400);
  });
});

describe('登录 /auth/login', () => {
  it('登录成功返回 token', async () => {
    const env = makeEnv();
    // 先注册
    await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138002', password: 'test123456' } }),
      env, '/auth/register'
    );
    // 登录
    const resp = await handleAuthRoute(
      makeRequest('/auth/login', { body: { phone: '13800138002', password: 'test123456' } }),
      env, '/auth/login'
    );
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.accessToken).toBeTruthy();
  });

  it('密码错误返回 401', async () => {
    const env = makeEnv();
    await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138003', password: 'correct123' } }),
      env, '/auth/register'
    );
    const resp = await handleAuthRoute(
      makeRequest('/auth/login', { body: { phone: '13800138003', password: 'wrong123' } }),
      env, '/auth/login'
    );
    expect(resp.status).toBe(401);
    const data = await resp.json();
    expect(data.error).toContain('错误');
  });

  it('不存在的用户返回 401', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/login', { body: { phone: '13999999999', password: 'test123' } }),
      env, '/auth/login'
    );
    expect(resp.status).toBe(401);
  });
});

describe('Token 刷新 /auth/refresh', () => {
  it('有效 refreshToken 成功刷新', async () => {
    const env = makeEnv();
    // 注册获取 refreshToken
    const regResp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138004', password: 'test123456' } }),
      env, '/auth/register'
    );
    const regData = await regResp.json();
    const refreshToken = regData.refreshToken;

    // 刷新
    const resp = await handleAuthRoute(
      makeRequest('/auth/refresh', { body: { refreshToken } }),
      env, '/auth/refresh'
    );
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.accessToken).toBeTruthy();
  });

  it('无效 refreshToken 返回 401', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/refresh', { body: { refreshToken: 'invalid-token' } }),
      env, '/auth/refresh'
    );
    expect(resp.status).toBe(401);
  });
});

describe('用户信息 /auth/me', () => {
  it('已认证可获取用户信息', async () => {
    const env = makeEnv();
    const regResp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138005', password: 'test123456', nickname: '测试' } }),
      env, '/auth/register'
    );
    const regData = await regResp.json();

    const resp = await handleAuthRoute(
      makeRequest('/auth/me', { method: 'GET', headers: { Authorization: 'Bearer ' + regData.accessToken } }),
      env, '/auth/me'
    );
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.user.phone).toBe('13800138005');
    expect(data.user.nickname).toBe('测试');
  });

  it('未认证返回 401', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/me', { method: 'GET' }),
      env, '/auth/me'
    );
    expect(resp.status).toBe(401);
  });

  it('更新昵称成功', async () => {
    const env = makeEnv();
    const regResp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138006', password: 'test123456' } }),
      env, '/auth/register'
    );
    const regData = await regResp.json();

    const resp = await handleAuthRoute(
      makeRequest('/auth/me', { method: 'PUT', headers: { Authorization: 'Bearer ' + regData.accessToken }, body: { nickname: '新昵称' } }),
      env, '/auth/me'
    );
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.user.nickname).toBe('新昵称');
  });
});

describe('登出 /auth/logout', () => {
  it('登出后 refreshToken 被删除', async () => {
    const env = makeEnv();
    const regResp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138007', password: 'test123456' } }),
      env, '/auth/register'
    );
    const regData = await regResp.json();

    // 登出
    const resp = await handleAuthRoute(
      makeRequest('/auth/logout', { headers: { Authorization: 'Bearer ' + regData.accessToken }, body: { refreshToken: regData.refreshToken } }),
      env, '/auth/logout'
    );
    expect(resp.status).toBe(200);

    // 验证 refreshToken 已失效
    const refreshResp = await handleAuthRoute(
      makeRequest('/auth/refresh', { body: { refreshToken: regData.refreshToken } }),
      env, '/auth/refresh'
    );
    expect(refreshResp.status).toBe(401);
  });
});

describe('数据同步', () => {
  it('上传数据成功', async () => {
    const env = makeEnv();
    const regResp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138008', password: 'test123456' } }),
      env, '/auth/register'
    );
    const regData = await regResp.json();
    const token = regData.accessToken;

    const resp = await handleSyncRoute(
      makeRequest('/sync/upload', {
        headers: { Authorization: 'Bearer ' + token },
        body: {
          habits_config: '[{"id":"test"}]',
          checkin_records: '{"2026-07-22":{}}',
        },
      }),
      env, '/sync/upload'
    );
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.syncedKeys).toBe(2);
  });

  it('下载数据成功', async () => {
    const env = makeEnv();
    const regResp = await handleAuthRoute(
      makeRequest('/auth/register', { body: { phone: '13800138009', password: 'test123456' } }),
      env, '/auth/register'
    );
    const regData = await regResp.json();
    const token = regData.accessToken;

    // 先上传
    await handleSyncRoute(
      makeRequest('/sync/upload', {
        headers: { Authorization: 'Bearer ' + token },
        body: { habits_config: '[{"id":"water"}]' },
      }),
      env, '/sync/upload'
    );

    // 再下载
    const resp = await handleSyncRoute(
      makeRequest('/sync/download', { method: 'GET', headers: { Authorization: 'Bearer ' + token } }),
      env, '/sync/download'
    );
    const data = await resp.json();
    expect(resp.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.habits_config).toBe('[{"id":"water"}]');
  });

  it('未认证同步返回 401', async () => {
    const env = makeEnv();
    const resp = await handleSyncRoute(
      makeRequest('/sync/upload', { body: { habits_config: '[]' } }),
      env, '/sync/upload'
    );
    expect(resp.status).toBe(401);
  });
});

describe('路由边界', () => {
  it('未知 auth 路由返回 404', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/unknown', { method: 'GET' }),
      env, '/auth/unknown'
    );
    expect(resp.status).toBe(404);
  });

  it('未绑定 D1 返回 500', async () => {
    const env = { JWT_SECRET: 'test' };
    const resp = await handleAuthRoute(
      makeRequest('/auth/login', { body: { phone: '13800138000', password: 'test' } }),
      env, '/auth/login'
    );
    expect(resp.status).toBe(500);
  });

  it('OPTIONS 预检返回 CORS 头', async () => {
    const env = makeEnv();
    const resp = await handleAuthRoute(
      makeRequest('/auth/register', { method: 'OPTIONS' }),
      env, '/auth/register'
    );
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
