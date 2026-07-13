import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const jsDir = join(root, '..', 'www', 'js');
const bundleDir = join(jsDir, 'bundle');

// 拼接顺序（由 scripts/detect-order.mjs 探测得到，与既有 bundle 一致）
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

if (!ok) { console.error('构建存在缺失文件，请检查。'); process.exit(1); }
console.log('bundle 构建完成。');
