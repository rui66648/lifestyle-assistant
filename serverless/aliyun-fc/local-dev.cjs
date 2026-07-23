// 本地联调服务器：复用 fc/index.js 的 handler，无需部署 FC 即可在手机/模拟器上调试
// 用法（PowerShell）：
//   $env:QWEN_API_KEY="sk-你的Key"
//   node local-dev.cjs
// 默认监听 http://localhost:3000
//   - Android 模拟器访问宿主机请用 http://10.0.2.2:3000
//   - 真机需用电脑局域网 IP，如 http://192.168.1.x:3000
// 然后在 android/local.properties 填：
//   CLOUD_AI_URL=http://10.0.2.2:3000   (模拟器) / http://192.168.1.x:3000 (真机)
//   CLOUD_AI_KEY=
//   CLOUD_AI_MODEL=qwen-max
// 再执行 npx cap sync && npx cap build android

const http = require('http');
const { handler } = require('./index.js');

const PORT = process.env.PORT || 3000;

const server = http.createServer((nodeReq, nodeRes) => {
  const chunks = [];
  nodeReq.on('data', (c) => chunks.push(c));
  nodeReq.on('end', async () => {
    const bodyBuf = Buffer.concat(chunks);
    const req = {
      method: nodeReq.method,
      path: nodeReq.url,
      headers: nodeReq.headers,
      body: bodyBuf,
      clientIP: nodeReq.socket.remoteAddress
    };
    const captured = { headers: {}, statusCode: 200, body: '' };
    const resp = {
      setHeader(k, v) { captured.headers[k] = v; },
      setStatusCode(c) { captured.statusCode = c; },
      send(data) { captured.body = data; }
    };
    try {
      await handler(req, resp, {});
    } catch (e) {
      captured.statusCode = 500;
      captured.body = JSON.stringify({ error: 'local-dev error', message: e.message });
    }
    const headers = { ...captured.headers };
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json; charset=utf-8';
    nodeRes.writeHead(captured.statusCode, headers);
    nodeRes.end(captured.body || '');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[local-dev] 养生助手后端已启动');
  console.log('  GET  http://localhost:' + PORT + '                 (健康检查)');
  console.log('  POST http://localhost:' + PORT + '                 (AI 代理)');
  console.log('  POST http://localhost:' + PORT + '/auth/register  (用户注册)');
  console.log('  POST http://localhost:' + PORT + '/auth/login     (用户登录)');
  console.log('  GET  http://localhost:' + PORT + '/auth/me        (获取用户)');
  console.log('  POST http://localhost:' + PORT + '/sync/upload    (数据上传)');
  console.log('  GET  http://localhost:' + PORT + '/sync/download  (数据下载)');
  console.log('  QWEN_API_KEY=' + (process.env.QWEN_API_KEY ? '已设置' : '未设置'));
  console.log('  JWT_SECRET=' + (process.env.JWT_SECRET ? '已设置' : '未设置（认证功能不可用）'));
  console.log('  DB_HOST=' + (process.env.DB_HOST ? process.env.DB_HOST : '未设置（数据库不可用）'));
  console.log('  Android 模拟器请访问 http://10.0.2.2:' + PORT);
});
