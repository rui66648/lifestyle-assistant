#!/usr/bin/env node
// 同步 www/ 内容到根目录（GitHub Pages 部署源 = 根目录）
// 注意：根目录 www/ 目录是 APK 构建源（Capacitor sync 从这里复制到 android/）
// 而根目录是 GitHub Pages 部署入口，必须保持与 www/ 内容一致

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

// 要同步的文件
const syncFiles = [
  'index.html',
  'manifest.json',
  'sw.js',
  'test-push.html',
  'version.json'
];

// 要同步的目录
const syncDirs = [
  'js',
  'css',
  'assets',
  'references'
];

// 不同步的文件/目录（保留 APK 在 www/ 内，不暴露在根目录）
const skipNames = ['app-release.apk'];

function shouldSkip(name) {
  return skipNames.includes(name);
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  }
}

let copiedFiles = 0;
let copiedDirs = 0;

console.log('📦 开始同步 www/ → 根目录...');

for (const file of syncFiles) {
  const src = path.join(wwwDir, file);
  const dest = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    copyFile(src, dest);
    copiedFiles++;
    console.log(`  ✓ ${file}`);
  }
}

for (const dir of syncDirs) {
  const src = path.join(wwwDir, dir);
  const dest = path.join(rootDir, dir);
  if (fs.existsSync(src)) {
    // 删除根目录同名目录，重新复制（避免遗留过期文件）
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDir(src, dest);
    copiedDirs++;
    console.log(`  ✓ ${dir}/`);
  }
}

console.log(`\n✅ 同步完成！文件: ${copiedFiles}, 目录: ${copiedDirs}`);
console.log(`📁 根目录: ${rootDir}`);
console.log(`📁 www/: ${wwwDir}`);
