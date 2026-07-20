import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const wwwDir = join(root, '..', 'www');
const jsDir = join(wwwDir, 'js');
const bundleDir = join(jsDir, 'bundle');
const cssDir = join(wwwDir, 'css');

// 从 bundle-order.json 读取 ORDER（单一数据源，避免脱钩）
const ORDER_FILE = join(root, 'bundle-order.json');
const ORDER_RAW = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));
const ORDER = {
  'data.js': ORDER_RAW.data,
  'modules.js': ORDER_RAW.modules,
  'ui.js': ORDER_RAW.ui,
};

async function buildBundle() {
  mkdirSync(bundleDir, { recursive: true });
  let ok = true;
  for (const [outName, files] of Object.entries(ORDER)) {
    const parts = [];
    for (const f of files) {
      const p = join(jsDir, f);
      let src;
      try { src = readFileSync(p, 'utf8'); }
      catch (e) { console.error('缺失源文件:', f); ok = false; continue; }
      parts.push('/* ===== ' + f + ' ===== */\n' + src.replace(/\s+$/, ''));
    }
    const out = parts.join('\n\n') + '\n';
    const outPath = join(bundleDir, outName);
    writeFileSync(outPath, out, 'utf8');
    console.log('built', outName, '(', files.length, 'files,', out.length, 'bytes )');
  }
  return ok;
}

async function minifyJs() {
  let terser;
  try {
    const mod = await import('terser');
    terser = mod.default || mod;
  } catch (e) {
    console.warn('terser 未安装，跳过 JS 压缩');
    return;
  }

  const files = ['data.js', 'modules.js', 'ui.js'];
  for (const f of files) {
    const srcPath = join(bundleDir, f);
    if (!readFileSync(srcPath, 'utf8')) continue;
    const src = readFileSync(srcPath, 'utf8');
    const result = await terser.minify(src, {
      compress: { drop_console: false, dead_code: true },
      mangle: { toplevel: false },
      output: { comments: false }
    });
    if (result.error) {
      console.warn('JS 压缩失败:', f, '-', result.error.message);
      continue;
    }
    const minPath = join(bundleDir, f.replace('.js', '.min.js'));
    writeFileSync(minPath, result.code, 'utf8');
    console.log('minified', f, '→', (result.code.length / 1024).toFixed(1), 'KB');
  }
}

// 简易 CSS 压缩器（无需 cssnano 依赖）
// 移除注释、空白、压缩颜色、去掉末尾分号
function minifyCssSource(src) {
  return src
    // 移除块注释 /* ... */
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 移除行尾空白
    .replace(/[ \t]+\n/g, '\n')
    // 合并多个换行
    .replace(/\n{2,}/g, '\n')
    // 移除 { 前空白
    .replace(/\s*\{\s*/g, '{')
    // 移除 } 前后空白
    .replace(/\s*\}\s*/g, '}')
    // 移除 : ; , 前后空白
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',')
    // 移除末尾分号
    .replace(/;}/g, '}')
    // 压缩 hex 颜色 #ffffff → #fff
    .replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3\b/g, '#$1$2$3')
    // 移除 0px → 0
    .replace(/\b0px\b/g, '0')
    // 移除 0.5 → .5
    .replace(/\b0\.(\d+)/g, '.$1')
    // 压缩空白
    .replace(/\s+/g, ' ')
    .trim();
}

async function minifyCss() {
  const files = readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.endsWith('.min.css'));
  for (const f of files) {
    const srcPath = join(cssDir, f);
    const src = readFileSync(srcPath, 'utf8');
    const minPath = join(cssDir, f.replace('.css', '.min.css'));
    const minified = minifyCssSource(src);
    writeFileSync(minPath, minified, 'utf8');
    const ratio = ((1 - minified.length / src.length) * 100).toFixed(1);
    console.log('minified', f, '→', (minified.length / 1024).toFixed(1), 'KB', '(压缩率 ' + ratio + '%)');
  }
}

function updateSwCacheVersion() {
  const swPath = join(wwwDir, 'sw.js');
  let swContent = readFileSync(swPath, 'utf8');
  const oldMatch = swContent.match(/const CACHE_NAME = 'lifestyle-assistant-v(\d+)';/);
  let newVersion = 30;
  if (oldMatch) {
    newVersion = parseInt(oldMatch[1], 10) + 1;
  }
  swContent = swContent.replace(
    /const CACHE_NAME = 'lifestyle-assistant-v\d+';/,
    `const CACHE_NAME = 'lifestyle-assistant-v${newVersion}';`
  );
  writeFileSync(swPath, swContent, 'utf8');

  if (oldMatch) {
    console.log('SW 缓存版本:', 'v' + oldMatch[1], '→', 'v' + newVersion);
  } else {
    console.log('SW 缓存版本设置为:', 'v' + newVersion);
  }
}

// 版本号自动注入：基于 version.json 替换 index.html 中所有 ?v=xxx
function injectVersionStamp() {
  const htmlPath = join(wwwDir, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  const versionJsonPath = join(wwwDir, 'version.json');
  if (!existsSync(versionJsonPath)) {
    console.warn('version.json 不存在，跳过版本号注入');
    return;
  }
  const versionJson = JSON.parse(readFileSync(versionJsonPath, 'utf8'));
  const stamp = (versionJson.versionName || String(Date.now())).replace(/[^\w]/g, '');
  const count = (html.match(/\?v=\w+/g) || []).length;
  html = html.replace(/\?v=\w+/g, `?v=${stamp}`);
  writeFileSync(htmlPath, html, 'utf8');
  console.log('版本号注入:', stamp, '（', count, '处 ）');
}

// 构建产物校验
function verify() {
  const errors = [];
  const warnings = [];

  // 1. 源文件存在性
  for (const group of ['data', 'modules', 'ui']) {
    for (const f of ORDER_RAW[group]) {
      if (!existsSync(join(jsDir, f))) errors.push(`缺失源文件: ${f}`);
    }
  }

  // 2. bundle 非空
  for (const b of ['data.min.js', 'modules.min.js', 'ui.min.js']) {
    const p = join(bundleDir, b);
    if (!existsSync(p)) { errors.push(`缺失 bundle: ${b}`); continue; }
    const buf = readFileSync(p);
    if (buf.length === 0) errors.push(`bundle 为空: ${b}`);
  }

  // 3. 模块注册数对比
  for (const group of ['modules', 'ui']) {
    const bundlePath = join(bundleDir, group + '.js');
    if (!existsSync(bundlePath)) continue;
    const bundleSrc = readFileSync(bundlePath, 'utf8');
    const regCount = (bundleSrc.match(/App\.registerModule\(/g) || []).length;
    const fileCount = ORDER_RAW[group].length;
    if (regCount < fileCount) {
      warnings.push(`${group}: ${fileCount} 个源文件，但 bundle 中只有 ${regCount} 次 registerModule 调用`);
    }
  }

  // 4. CSS 引用一致性
  const html = readFileSync(join(wwwDir, 'index.html'), 'utf8');
  const cssRefs = [...html.matchAll(/href="([^"]+\.min\.css)/g)].map(m => m[1]);
  for (const ref of cssRefs) {
    const p = join(wwwDir, ref);
    if (!existsSync(p)) errors.push(`index.html 引用的 CSS 不存在: ${ref}`);
  }

  // 5. 版本号一致性
  const versions = new Set([...html.matchAll(/\?v=(\w+)/g)].map(m => m[1]));
  if (versions.size > 1) errors.push(`index.html 版本号不一致: ${[...versions].join(', ')}`);

  // 输出报告
  if (warnings.length) {
    console.log('⚠️  警告:');
    warnings.forEach(w => console.log('   -', w));
  }
  if (errors.length) {
    console.log('❌ 错误:');
    errors.forEach(e => console.log('   -', e));
    return false;
  }
  console.log('✅ 校验通过');
  return true;
}

console.log('=== 养生助手构建流程 ===');
console.log('');

console.log('1. 更新 SW 缓存版本...');
updateSwCacheVersion();
console.log('');

console.log('2. 构建 JS bundle...');
const ok = await buildBundle();
console.log('');

console.log('3. 压缩 JS...');
await minifyJs();
console.log('');

console.log('4. 压缩 CSS...');
await minifyCss();
console.log('');

console.log('5. 注入版本号...');
injectVersionStamp();
console.log('');

console.log('6. 构建产物校验...');
const verified = verify();
console.log('');

if (!ok || !verified) {
  console.error('❌ 构建失败，请检查上方日志。');
  process.exit(1);
}

console.log('✅ 构建完成！');
