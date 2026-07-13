#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');

const syncFiles = [
  'manifest.json',
  'sw.js',
  'test-push.html'
];

const syncDirs = [
  'js',
  'css',
  'assets',
  'references'
];

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

console.log('📦 开始同步根目录到 www/...');

for (const file of syncFiles) {
  const src = path.join(rootDir, file);
  const dest = path.join(wwwDir, file);
  if (fs.existsSync(src)) {
    copyFile(src, dest);
    copiedFiles++;
  }
}

for (const dir of syncDirs) {
  const src = path.join(rootDir, dir);
  const dest = path.join(wwwDir, dir);
  if (fs.existsSync(src)) {
    copyDir(src, dest);
    copiedDirs++;
  }
}

console.log(`✅ 同步完成！文件: ${copiedFiles}, 目录: ${copiedDirs}`);
console.log(`📁 www/ 路径: ${wwwDir}`);
