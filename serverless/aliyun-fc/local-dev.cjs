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
    // 构造兼容 FC 运行时的 req / resp shim
    const req = {
      method: nodeReq.method,
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
    nodeRes.writeHead(captured.statusCode, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    nodeRes.end(captured.body || '');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[local-dev] AI 代理已启动');
  console.log('  GET  http://localhost:' + PORT + '   (健康检查)');
  console.log('  POST http://localhost:' + PORT + '   (AI 代理)');
  console.log('  QWEN_API_KEY=' + (process.env.QWEN_API_KEY ? '已设置' : '未设置（将返回 500）'));
  console.log('  Android 模拟器请访问 http://10.0.2.2:' + PORT);
});
