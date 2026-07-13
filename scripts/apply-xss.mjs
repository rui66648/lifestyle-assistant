import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
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

// 仅处理源文件，跳过 bundle（bundle 由 build.mjs 重新拼接生成）
const files = listFiles(wwwJs).filter(f => !f.includes(join('js', 'bundle')));

// 1) 对 ${var.name|icon|tip|note|unit|target} 统一转义（覆盖所有用户数据字段，且不误伤 rate/done 等数值）
const fieldRe = /\$\{([A-Za-z_$][\w$]*)\.(name|icon|tip|note|unit|target)\}/g;

// 2) 个别单变量用户数据（note/search/icon 等）
const explicit = [
  '${habit.unit || \'\'}',
  '${habit.target || \'\'}',
  '${note}',
  '${search}',
  '${selectedIconLabel}',
  '${ico}',
  '${ic}'
];

// 3) 字符串拼接里的用户数据（innerHTML 场景）
const concat = [
  { from: "'<div class=\"hr-name\">' + h.name + '</div>'", to: "'<div class=\"hr-name\">' + esc(h.name) + '</div>'" },
  { from: "'<span class=\"rh-name\">' + habit.name + '</span>'", to: "'<span class=\"rh-name\">' + esc(habit.name) + '</span>'" }
];

let totalChanges = 0;
for (const f of files) {
  let src = readFileSync(f, 'utf8');
  let before = src;
  src = src.replace(fieldRe, '${esc($1.$2)}');
  for (const e of explicit) {
    if (src.includes(e)) src = src.split(e).join('${esc(' + e.slice(2, -1) + ')}');
  }
  for (const c of concat) {
    if (src.includes(c.from)) { src = src.split(c.from).join(c.to); }
  }
  if (src !== before) {
    writeFileSync(f, src, 'utf8');
    const n = (before.match(fieldRe) || []).length;
    console.log('patched', f.replace(wwwJs, ''), '(field-repl ~', n, ')');
    totalChanges++;
  }
}
console.log('XSS esc applied to', totalChanges, 'file(s).');
