// 测试 workers.dev 是否整体不可达
const tests = [
  'https://www.cloudflare.com',           // CF 主站（已知可达）
  'https://workers.cloudflare.com',        // Workers 官方文档站点
  'https://hello-world-example.3487331518.workers.dev',  // 不存在的 worker
];

for (const u of tests) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(u, { signal: ctrl.signal });
    clearTimeout(t);
    console.log(r.status.toString().padStart(4), '|', r.ok ? 'OK' : '-- ', '|', u);
  } catch (e) {
    console.log('FAIL'.padStart(4), '| ERR  |', u, '|', (e && e.message) || e);
  }
}
