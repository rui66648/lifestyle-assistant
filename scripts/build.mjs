import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const wwwDir = join(root, '..', 'www');
const jsDir = join(wwwDir, 'js');
const bundleDir = join(jsDir, 'bundle');
const cssDir = join(wwwDir, 'css');

const ORDER = {
  'data.js': ['data/constants.js', 'data/content.js', 'data/habits.js', 'data/packs.js', 'data/sports.js'],
  'modules.js': [
    'modules/checkin.js', 'modules/habit.js', 'modules/stats.js', 'modules/water.js',
    'modules/diet.js', 'modules/sports.js', 'modules/pomodoro.js', 'modules/ai.js',
    'modules/constitution.js', 'modules/poster.js', 'modules/notification.js', 'modules/guide.js',
    'modules/update.js'
  ],
  'ui.js': ['ui/render.js', 'ui/panels.js', 'ui/components.js', 'ui/events.js']
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

async function minifyCss() {
  const files = readdirSync(cssDir).filter(f => f.endsWith('.css') && !f.endsWith('.min.css'));
  for (const f of files) {
    const srcPath = join(cssDir, f);
    const src = readFileSync(srcPath, 'utf8');
    const minPath = join(cssDir, f.replace('.css', '.min.css'));
    writeFileSync(minPath, src, 'utf8');
    console.log('copied', f, '→', (src.length / 1024).toFixed(1), 'KB');
  }
}

function updateSwCacheVersion() {
  let versionCode = 30;
  try {
    const versionJson = JSON.parse(readFileSync(join(wwwDir, 'version.json'), 'utf8'));
    versionCode = (versionJson.versionCode || 1) * 10 + (versionJson.cacheVersion || 0);
    if (versionCode < 30) versionCode = 30;
  } catch (e) {
    console.warn('无法读取 version.json，使用默认版本:', versionCode);
  }

  const swPath = join(wwwDir, 'sw.js');
  let swContent = readFileSync(swPath, 'utf8');
  const oldMatch = swContent.match(/const CACHE_NAME = 'lifestyle-assistant-v(\d+)';/);
  const newVersion = versionCode;
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

if (!ok) {
  console.error('构建存在缺失文件，请检查。');
  process.exit(1);
}

console.log('✅ 构建完成！');
