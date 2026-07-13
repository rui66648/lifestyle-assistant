/**
 * VAPID 密钥生成工具
 * 运行：node workers/generate-vapid.js
 * 
 * 生成的密钥用于 Web Push：
 * - 公钥：放入 www/js/modules/push.js 的 VAPID_PUBLIC_KEY
 * - 私钥：用 wrangler secret put VAPID_PRIVATE_KEY 注入 Worker
 */
const crypto = require('crypto');

// 生成 ECDSA P-256 密钥对（VAPID 标准）
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1',
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' }
});

// 公钥：提取 65 字节未压缩点 (04 || x || y)
const pubDer = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
const pubJwk = pubDer.export({ format: 'jwk' });

// 从 JWK 构建 65 字节未压缩公钥
function b64urlDecode(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const padded = s + '='.repeat((4 - s.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}
function b64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const x = b64urlDecode(pubJwk.x);
const y = b64urlDecode(pubJwk.y);
const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
const publicKeyB64 = b64urlEncode(uncompressed);

// 私钥：导出为 JWK 格式，取 d 字段（base64url）
const privDer = crypto.createPrivateKey({ key: privateKey, format: 'der', type: 'pkcs8' });
const privJwk = privDer.export({ format: 'jwk' });
const privateKeyB64 = privJwk.d;

console.log('========================================');
console.log('VAPID 密钥对生成完成');
console.log('========================================');
console.log('');
console.log('1. 公钥（放入 www/js/modules/push.js）：');
console.log('   VAPID_PUBLIC_KEY = \'' + publicKeyB64 + '\'');
console.log('');
console.log('2. 私钥（用 wrangler secret put 注入 Worker）：');
console.log('   npx wrangler secret put VAPID_PRIVATE_KEY');
console.log('   粘贴以下值：');
console.log('   ' + privateKeyB64);
console.log('');
console.log('3. 验证：');
console.log('   公钥长度: ' + publicKeyB64.length + ' 字符 (应为 ~87)');
console.log('   私钥长度: ' + privateKeyB64.length + ' 字符 (应为 ~43)');
console.log('========================================');
