import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const wwwJs = join(root, '..', 'www', 'js');

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

function firstWindow(src, len = 200) {
  // 去除前导空白
  let s = src.replace(/^\s+/, '');
  // 去除前导单行注释（// ...）和多行注释（/* ... */）
  while (true) {
    if (s.startsWith('//')) {
      const nl = s.indexOf('\n');
      if (nl < 0) { s = ''; break; }
      s = s.slice(nl + 1).replace(/^\s+/, '');
    } else if (s.startsWith('/*')) {
      const end = s.indexOf('*/');
      if (end < 0) { s = ''; break; }
      s = s.slice(end + 2).replace(/^\s+/, '');
    } else {
      break;
    }
  }
  return s.slice(0, len);
}

// bundle 内的文件分隔注释格式：/* ===== modules/ai.js ===== */
// 检测时跳过该注释，从实际代码内容开始匹配
function stripBundleComment(src) {
  return src.replace(/^\/\*\s*=====\s*[^\n]*=====\s*\*\/\s*/, '');
}

const groups = [
  { bundle: 'bundle/data.js', folder: 'data' },
  { bundle: 'bundle/modules.js', folder: 'modules' },
  { bundle: 'bundle/ui.js', folder: 'ui' },
];

const result = {};
for (const g of groups) {
  const bundlePath = join(wwwJs, g.bundle);
  const bundleSrc = readFileSync(bundlePath, 'utf8');
  const files = listFiles(join(wwwJs, g.folder));
  const entries = [];
  let missing = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const win = firstWindow(src);
    const idx = bundleSrc.indexOf(win);
    const rel = f.replace(wwwJs + '\\', '').replace(/\\/g, '/');
    if (idx >= 0) entries.push({ rel, idx });
    else missing.push(rel);
  }
  entries.sort((a, b) => a.idx - b.idx);
  result[g.folder] = entries.map(e => e.rel);
  if (missing.length) console.log('MISSING in', g.bundle, ':', missing);
  console.log('===', g.folder, 'order ===');
  console.log(JSON.stringify(result[g.folder], null, 2));
}

writeFileSync(join(root, 'bundle-order.json'), JSON.stringify(result, null, 2));
console.log('Wrote bundle-order.json');
