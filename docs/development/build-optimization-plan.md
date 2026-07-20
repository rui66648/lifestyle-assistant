# 构建流程优化方案

> 项目：生活习惯小助手（lifestyle-assistant）
> 日期：2026-07-18
> 范围：scripts/build.mjs + scripts/detect-order.mjs + www/index.html + www/css/*
> 约束：不引入 Webpack/Vite；保持 `node scripts/build.mjs` 一行构建

---

## 目录

1. [现状分析](#1-现状分析)
2. [改进目标与约束](#2-改进目标与约束)
3. [方案总览](#3-方案总览)
4. [详细设计 1：build.mjs 与 bundle-order.json 同步](#4-详细设计-1buildmjs-与-bundle-orderjson-同步)
5. [详细设计 2：开发模式 vs 生产模式切换](#5-详细设计-2开发模式-vs-生产模式切换)
6. [详细设计 3：CSS 组织优化](#6-详细设计-3css-组织优化)
7. [详细设计 4：模块热替换（HMR）轻量方案](#7-详细设计-4模块热替换hmr轻量方案)
8. [详细设计 5：构建产物校验](#8-详细设计-5构建产物校验)
9. [验证标准对照](#9-验证标准对照)
10. [迁移路线图](#10-迁移路线图)

---

## 1. 现状分析

### 1.1 构建流程现状

```
┌─────────────────────────────────────────────────────────────┐
│  开发者编辑 www/js/{data,modules,ui}/*.js                  │
│                          ↓                                  │
│  node scripts/build.mjs                                     │
│    1. updateSwCacheVersion()  → www/sw.js 版本号 +1         │
│    2. buildBundle()           → 读硬编码 ORDER 拼接 3 个    │
│                                  bundle（无压缩）           │
│    3. minifyJs()              → terser 压缩为 *.min.js      │
│    4. minifyCss()             → 复制为 *.min.css（未压缩）  │
│                          ↓                                  │
│  www/index.html 引用 bundle/*.min.js + css/*.min.css        │
│  （版本号 ?v=2026071x 手动维护，共 19 处）                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 优点

| 优点 | 说明 | 位置 |
|---|---|---|
| 零重型依赖 | 仅 Node 原生 fs/path + 可选 terser | [build.mjs#L1-L3](file:///d:/AndroidStudioProjects/养生助手/scripts/build.mjs#L1-L3) |
| SW 缓存版本自动递增 | 基于正则匹配自增，无需手动 | [build.mjs#L83-L102](file:///d:/AndroidStudioProjects/养生助手/scripts/build.mjs#L83-L102) |
| 懒加载机制完备 | LazyLoad 按需加载 poster/pomodoro/ai | [lazy.js](file:///d:/AndroidStudioProjects/养生助手/www/js/lazy.js) |
| 模块分层清晰 | data / core / modules / ui 四层 + registerModule | [app.js](file:///d:/AndroidStudioProjects/养生助手/www/js/app.js) |
| 体积已达标 | JS gzip 83.4KB + CSS gzip 54.9KB = 138.3KB | 见 1.4 |

### 1.3 缺点（按严重度排序）

| # | 问题 | 影响 | 严重度 | 位置 |
|---|---|---|---|---|
| 1 | `bundle-order.json` 与 `build.mjs` 脱钩 | 新增模块需改两处；detect-order 漏报 ai/update | **高** | [build.mjs#L11-L20](file:///d:/AndroidStudioProjects/养生助手/scripts/build.mjs#L11-L20) vs [bundle-order.json](file:///d:/AndroidStudioProjects/养生助手/scripts/bundle-order.json) |
| 2 | `detect-order.mjs` 特征窗口匹配脆弱 | 注释开头的文件（ai.js/update.js）匹配失败 | **高** | [detect-order.mjs#L18-L25](file:///d:/AndroidStudioProjects/养生助手/scripts/detect-order.mjs#L18-L25) |
| 3 | CSS "压缩"实为复制 | main.css 213KB 未压缩，浪费带宽 | 中 | [build.mjs#L72-L81](file:///d:/AndroidStudioProjects/养生助手/scripts/build.mjs#L72-L81) |
| 4 | index.html 版本号手动维护 | 19 处 `?v=` 易遗忘，缓存失效不彻底 | 中 | [index.html](file:///d:/AndroidStudioProjects/养生助手/www/index.html) |
| 5 | 无开发模式 | 无法直接断点调试源文件 | 中 | — |
| 6 | 无构建产物校验 | 缺失文件仍可能"构建成功" | 中 | [build.mjs#L123-L126](file:///d:/AndroidStudioProjects/养生助手/scripts/build.mjs#L123-L126) |
| 7 | main.css 213KB 单文件 | 编辑困难，未按域拆分 | 低 | [main.css](file:///d:/AndroidStudioProjects/养生助手/www/css/main.css) |

### 1.4 bundle-order.json 与 build.mjs 脱钩详情

`build.mjs` 的 `ORDER` 完全硬编码，**未读取** `bundle-order.json`。两者对比：

| 模块文件 | bundle-order.json | build.mjs ORDER | 实际打包 |
|---|:---:|:---:|:---:|
| modules/checkin.js | ✅ | ✅ | ✅ |
| modules/habit.js | ✅ | ✅ | ✅ |
| modules/stats.js | ✅ | ✅ | ✅ |
| modules/water.js | ✅ | ✅ | ✅ |
| modules/diet.js | ✅ | ✅ | ✅ |
| modules/sports.js | ✅ | ✅ | ✅ |
| modules/pomodoro.js | ✅ | ✅ | ✅ |
| modules/constitution.js | ✅ | ✅ | ✅ |
| modules/poster.js | ✅ | ✅ | ✅ |
| modules/notification.js | ✅ | ✅ | ✅ |
| modules/guide.js | ✅ | ✅ | ✅ |
| **modules/ai.js** | ❌ 缺失 | ✅ | ✅ |
| **modules/update.js** | ❌ 缺失 | ✅ | ✅ |
| modules/push.js | ❌ | ❌ | ❌（独立懒加载） |
| modules/local-notify.js | ❌ | ❌ | ❌（直接引用） |

**根因**：`detect-order.mjs` 的 `firstWindow()` 取前 200 字符做指纹匹配，但 `ai.js` 和 `update.js` 开头是块注释（`// ===` / `// 应用内`），与 bundle 内拼接后的 `/* ===== modules/ai.js ===== */` 注释前缀对不上，导致漏报。

### 1.5 当前产物体积

| 文件 | 原始 | gzip |
|---|---:|---:|
| www/js/bundle/data.min.js | 69.0 KB | 21.8 KB |
| www/js/bundle/modules.min.js | 90.8 KB | 27.9 KB |
| www/js/bundle/ui.min.js | 121.5 KB | 33.7 KB |
| **JS 小计** | **281.3 KB** | **83.4 KB** |
| www/css/main.css | 213.2 KB | 37.4 KB |
| www/css/components.css | 27.7 KB | 4.7 KB |
| www/css/uiverse-raw.css | 27.3 KB | 5.1 KB |
| www/css/sports.css | 12.3 KB | 2.4 KB |
| www/css/ui-enhance.css | 22.1 KB | 4.5 KB |
| www/css/skin-targets.css | 2.3 KB | 0.8 KB |
| **CSS 小计** | **304.9 KB** | **54.9 KB** |
| **总计** | 586.2 KB | **138.3 KB** ✅ |

> 验证标准 `< 200KB gzip` 已满足，体积不是当前主要矛盾。

---

## 2. 改进目标与约束

### 2.1 硬约束（不可妥协）

1. **不引入** Webpack/Vite/Rollup 等重型构建工具
2. **保持** `node scripts/build.mjs` 一行命令完成生产构建
3. **保持** 新增模块只改 `bundle-order.json`（修复现状后真正成立）
4. **保持** 现有 `App.registerModule` / `LazyLoad` / `compat.js` 运行时机制不变

### 2.2 目标

| 目标 | 对应验证标准 |
|---|---|
| 构建命令一行完成 | ✅ 保持 `npm run build` |
| 开发模式可断点调试源文件 | 新增 `npm run dev` |
| 生产模式 bundle < 200KB gzip | 现状 138.3KB，持续达标 |
| 新增模块只改 bundle-order.json | 修复脱钩问题 |

---

## 3. 方案总览

```
┌─────────────────────── 生产模式（默认）─────────────────────┐
│  npm run build                                             │
│    → node scripts/build.mjs                                │
│      1. 读取 bundle-order.json（不再硬编码）                │
│      2. 拼接 bundle/*.js                                   │
│      3. terser 压缩 → bundle/*.min.js                      │
│      4. cssnano 压缩 → css/*.min.css（真正压缩）           │
│      5. 注入版本号 → index.html 的 ?v= 自动替换            │
│      6. SW 版本自增                                        │
│      7. 产物校验（体积/注册数/IIFE/引用一致性）            │
│    → www/index.html 引用 *.min.js / *.min.css              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────── 开发模式（新增）─────────────────────┐
│  npm run dev                                               │
│    → node scripts/dev-server.mjs                           │
│      1. 启动静态服务器（:5173）                             │
│      2. 从 index.html 派生 index.dev.html：                │
│         - bundle/*.min.js → 逐个源文件                     │
│         - css/*.min.css → 逐个源 CSS                       │
│         - 注入 HMR 客户端                                  │
│         - 禁用 SW 注册                                     │
│      3. fs.watch 监听源文件变化 → EventSource 推送         │
│    → 浏览器打开 http://localhost:5173/index.dev.html       │
│    → 断点直接命中源文件（无 bundle 干扰）                  │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 改动清单

| 文件 | 操作 | 说明 |
|---|---|---|
| scripts/build.mjs | 修改 | 读取 bundle-order.json、CSS 真压缩、版本号注入、产物校验 |
| scripts/bundle-order.json | 修改 | 补齐 ai.js、update.js |
| scripts/detect-order.mjs | 修改 | 修复特征匹配（改为 AST/正则后向匹配） |
| scripts/dev-server.mjs | **新增** | 极简静态服务器 + index.dev.html 派生 + HMR |
| scripts/hmr-client.js | **新增** | EventSource 客户端（~30 行） |
| scripts/verify.mjs | **新增** | 构建产物校验（也可内联进 build.mjs） |
| www/css/main.css | 拆分 | 按域拆为 6 个子文件（保留合并产物） |
| www/css/tokens.css | **新增** | 抽离 CSS 变量到独立文件 |
| package.json | 修改 | 新增 `dev` 脚本 |

---

## 4. 详细设计 1：build.mjs 与 bundle-order.json 同步

### 4.1 修复方案

**核心改动**：`build.mjs` 改为从 `bundle-order.json` 读取 ORDER，删除硬编码。

```javascript
// scripts/build.mjs（修改后）
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const wwwDir = join(root, '..', 'www');
const jsDir = join(wwwDir, 'js');
const bundleDir = join(jsDir, 'bundle');
const cssDir = join(wwwDir, 'css');

// ✅ 改为读取 bundle-order.json
const ORDER_FILE = join(root, 'bundle-order.json');
const ORDER_RAW = JSON.parse(readFileSync(ORDER_FILE, 'utf8'));

// 兼容现有命名：data → data.js
const ORDER = {
  'data.js': ORDER_RAW.data,
  'modules.js': ORDER_RAW.modules,
  'ui.js': ORDER_RAW.ui,
};
```

### 4.2 修复 bundle-order.json

补齐缺失的 `ai.js` 和 `update.js`：

```json
{
  "data": [
    "data/constants.js",
    "data/content.js",
    "data/habits.js",
    "data/packs.js",
    "data/sports.js"
  ],
  "modules": [
    "modules/checkin.js",
    "modules/habit.js",
    "modules/stats.js",
    "modules/water.js",
    "modules/diet.js",
    "modules/sports.js",
    "modules/pomodoro.js",
    "modules/ai.js",
    "modules/constitution.js",
    "modules/poster.js",
    "modules/notification.js",
    "modules/guide.js",
    "modules/update.js"
  ],
  "ui": [
    "ui/render.js",
    "ui/panels.js",
    "ui/components.js",
    "ui/events.js"
  ]
}
```

### 4.3 修复 detect-order.mjs

**问题根因**：`firstWindow()` 取前 200 字符作为指纹，但 bundle 内每个文件前会插入 `/* ===== path ===== */\n` 注释，导致注释开头的源文件指纹在 bundle 中找不到。

**修复方案**：改为"去除前导注释和空白后取 200 字符"作为指纹：

```javascript
// scripts/detect-order.mjs（修改后）
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
```

同时，bundle 内的拼接注释改为与源文件去除前导注释后的内容直接匹配。建议同步修改 `build.mjs` 的拼接逻辑，在文件分隔注释后立即跟源文件去注释后的内容，但这会改变 bundle 结构。**更稳妥的做法**：`detect-order.mjs` 改为基于"源文件前 N 行非注释代码"在 bundle 中搜索，并允许跳过 bundle 内的 `/* ===== */` 分隔注释。

---

## 5. 详细设计 2：开发模式 vs 生产模式切换

### 5.1 方案选型对比

| 方案 | 优点 | 缺点 | 推荐 |
|---|---|---|---|
| **A. 双 index.html** | 生产零运行时开销；调试断点 1:1；SW 策略分离简单 | 需维护派生逻辑 | ⭐ **推荐** |
| B. URL 参数 `?dev=1` | 单一 HTML | 运行时分支判断；生产 HTML 含 dev 代码；SW 难处理 | ✗ |
| C. 构建时生成两份 HTML | 完全静态 | 与方案 A 等价但多一步构建 | ✗ |

**推荐方案 A：双 index.html + 极简 dev server**

理由：
- 生产 `index.html` 完全不变，零风险
- 开发时浏览器加载源文件，断点准确命中 `www/js/modules/checkin.js:42` 而非 `bundle/modules.min.js:1234`
- dev server 仅 ~60 行 Node 代码，无新依赖

### 5.2 文件布局

```
www/
  index.html              ← 生产入口（引用 bundle/*.min.js）
  index.dev.html          ← 开发入口（运行时由 dev-server.mjs 派生，不入 git）
scripts/
  dev-server.mjs          ← 极简静态服务器 + HTML 派生 + HMR
  hmr-client.js           ← 注入到 index.dev.html 的热替换客户端
```

`.gitignore` 追加：
```
www/index.dev.html
```

### 5.3 dev-server.mjs 设计

```javascript
// scripts/dev-server.mjs
import { createServer } from 'http';
import { readFileSync, statSync, watch } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const wwwDir = join(root, '..', 'www');
const PORT = 5173;

// 1. 读取 bundle-order.json，得到源文件加载顺序
const ORDER = JSON.parse(readFileSync(join(root, 'bundle-order.json'), 'utf8'));

// 2. 从 index.html 派生 index.dev.html
function buildDevHtml() {
  let html = readFileSync(join(wwwDir, 'index.html'), 'utf8');

  // 替换 bundle 引用为源文件引用
  const replaceBundle = (bundleFile, sources) => {
    const srcList = sources.map(s => `  <script src="js/${s}?dev=${Date.now()}" defer></script>`).join('\n');
    html = html.replace(
      new RegExp(`<script src="js/bundle/${bundleFile}"[^>]*></script>`),
      `<!-- DEV: ${bundleFile} -->\n${srcList}`
    );
  };
  replaceBundle('data.min.js', ORDER.data);
  replaceBundle('modules.min.js', ORDER.modules);
  replaceBundle('ui.min.js', ORDER.ui);

  // CSS 引用 .min.css → 源 CSS
  html = html.replace(/\.min\.css\?v=\w+/g, '.css?dev=' + Date.now());

  // 注入 HMR 客户端
  html = html.replace('</body>',
    `<script src="/__hmr_client__"></script>\n</body>`);

  // 禁用 Service Worker（dev 模式不缓存）
  html = html.replace(/navigator\.serviceWorker\.register[^;]+;/,
    'console.log("[DEV] SW disabled");');

  return html;
}

// 3. 静态服务器
const MIME = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html',
               '.json':'application/json', '.jpg':'image/jpeg', '.png':'image/png' };

const server = createServer((req, res) => {
  if (req.url === '/__hmr_client__') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(readFileSync(join(root, 'hmr-client.js'), 'utf8'));
  }
  if (req.url === '/__hmr_events__') {
    // EventSource 端点
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  let url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') url = '/index.dev.html';
  const filePath = join(wwwDir, url);
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not Found');
  }
});

// 4. 文件监听 + HMR 推送
const clients = new Set();
let debounceTimer = null;
watch(wwwDir, { recursive: true }, (event, filename) => {
  if (!filename) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const msg = JSON.stringify({ type: 'change', file: filename });
    for (const c of clients) c.write(`data: ${msg}\n\n`);
  }, 100);
});

server.listen(PORT, () => {
  console.log(`[DEV] http://localhost:${PORT}/  (HMR enabled, SW disabled)`);
});
```

### 5.4 hmr-client.js 设计

```javascript
// scripts/hmr-client.js（注入到 index.dev.html）
(function() {
  const es = new EventSource('/__hmr_events__');
  es.onmessage = function(e) {
    const data = JSON.parse(e.data);
    if (data.type !== 'change') return;
    console.log('[HMR] file changed:', data.file);

    // CSS 热替换：直接替换 <link> href
    if (data.file.endsWith('.css')) {
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        if (link.href.includes(data.file.replace('.css', ''))) {
          link.href = link.href.split('?')[0] + '?dev=' + Date.now();
        }
      });
      return;
    }

    // JS 模块：重新加载对应 script
    if (data.file.endsWith('.js')) {
      const scripts = document.querySelectorAll(`script[src*="${data.file}"]`);
      if (scripts.length === 0) {
        // 源文件不在页面中（可能是 bundle 引用），降级整页刷新
        return location.reload();
      }
      scripts.forEach(s => {
        const newScript = document.createElement('script');
        newScript.src = s.src.split('?')[0] + '?dev=' + Date.now();
        newScript.defer = true;
        s.replaceWith(newScript);
      });
      // 重新触发渲染
      setTimeout(() => {
        if (window.App?.UI?.Render?.render) App.UI.Render.render();
      }, 50);
      return;
    }

    // HTML 变化：整页刷新
    if (data.file.endsWith('.html')) location.reload();
  };
})();
```

### 5.5 package.json 脚本

```json
{
  "scripts": {
    "build": "node scripts/build.mjs",
    "dev": "node scripts/dev-server.mjs",
    "sync:android": "npx cap sync android",
    "build:apk": "npm run build && npm run sync:android",
    "deploy": "npm run build && git push origin master"
  }
}
```

### 5.6 调试体验对照

| 场景 | 现状 | 改进后 |
|---|---|---|
| 在 checkin.js 第 42 行设断点 | 需先在 `bundle/modules.min.js` 中找对应位置 | 直接在 `www/js/modules/checkin.js:42` 设断点 ✅ |
| 修改 CSS 后查看效果 | 改 `main.css` → `npm run build` → 刷新 | 改 `main.css` → 浏览器自动热替换 ✅ |
| 修改模块 JS | 改源文件 → `npm run build` → 刷新 | 改源文件 → 自动重载该模块 ✅ |
| SW 干扰调试 | SW 缓存旧版本，需手动清 cache | dev 模式禁用 SW ✅ |

---

## 6. 详细设计 3：CSS 组织优化

### 6.1 现状诊断

| 文件 | 体积 | gzip | 问题 |
|---|---:|---:|---|
| main.css | 213.2 KB | 37.4 KB | 巨型单文件，混合 base/layout/components |
| components.css | 27.7 KB | 4.7 KB | OK |
| uiverse-raw.css | 27.3 KB | 5.1 KB | 第三方原样保留 |
| sports.css | 12.3 KB | 2.4 KB | OK |
| ui-enhance.css | 22.1 KB | 4.5 KB | 与 main.css 职责重叠 |
| skin-targets.css | 2.3 KB | 0.8 KB | OK |

**main.css 现状优点**：[main.css#L1-L80](file:///d:/AndroidStudioProjects/养生助手/www/css/main.css#L1-L80) 已有完整的 CSS 变量 token 系统（颜色/间距/圆角/阴影），分层良好。

**问题**：
1. 213KB 单文件难以维护，定位样式需大量滚动
2. base / layout / component 样式混在一起
3. `ui-enhance.css` 与 `main.css` 职责边界模糊
4. 类名混用：`.habit-card` / `.mg-stats` / `.sk-shimmer` / `.profile-card`，无统一命名规范

### 6.2 拆分方案

将 `main.css` 按域拆分，构建时合并为 `main.css`（生产）：

```
www/css/
  tokens.css           ← 新增：纯 CSS 变量（从 main.css :root 抽离）
  base.css             ← reset + body + 通用元素
  layout.css           ← .section / .panel-overlay / .bottom-nav 等布局
  checkin.css          ← 打卡页相关
  profile.css          ← 个人中心
  manage.css           ← 管理页
  panel.css            ← 各类 .panel 弹层
  components.css       ← 现有，保留
  ui-enhance.css       ← 现有，逐步合并到上述文件
  skin-targets.css     ← 现有，保留
  uiverse-raw.css      ← 现有，第三方保留
  sports.css           ← 现有，保留
  main.css             ← 构建产物：tokens + base + layout + checkin + profile + manage + panel
```

### 6.3 构建合并

在 `bundle-order.json` 中新增 `css` 字段（与 JS 同构）：

```json
{
  "data": [...],
  "modules": [...],
  "ui": [...],
  "css": {
    "main": [
      "tokens.css",
      "base.css",
      "layout.css",
      "checkin.css",
      "profile.css",
      "manage.css",
      "panel.css"
    ]
  }
}
```

`build.mjs` 增加合并逻辑：

```javascript
async function buildCssBundle() {
  const cssOrder = ORDER_RAW.css || {};
  for (const [outName, files] of Object.entries(cssOrder)) {
    const parts = files.map(f => {
      const src = readFileSync(join(cssDir, f), 'utf8');
      return `/* ===== ${f} ===== */\n${src.replace(/\s+$/, '')}`;
    });
    writeFileSync(join(cssDir, outName + '.css'), parts.join('\n\n') + '\n');
    console.log('built', outName + '.css');
  }
}
```

### 6.4 BEM 命名规范

**现状类名示例**：
```html
<div class="profile-card">
  <div class="profile-avatar">🌱</div>
  <div class="profile-info">
    <div class="profile-name">养生小白</div>
    <div class="profile-desc">连续打卡 0 天</div>
    <div class="profile-progress">
      <div class="profile-progress-bar">
        <div class="profile-progress-fill"></div>
      </div>
    </div>
  </div>
</div>
```

**问题**：层级靠类名前缀表达，无法看出归属；`profile-progress-bar` 与 `profile-progress-fill` 的父子关系不明确。

**BEM 规范**：`block__element--modifier`

```html
<div class="profile-card">
  <div class="profile-card__avatar">🌱</div>
  <div class="profile-card__info">
    <div class="profile-card__name">养生小白</div>
    <div class="profile-card__desc">连续打卡 0 天</div>
    <div class="profile-card__progress">
      <div class="profile-card__progress-bar">
        <div class="profile-card__progress-fill"></div>
      </div>
    </div>
  </div>
</div>
<!-- 修饰符 -->
<button class="profile-card__btn profile-card__btn--active">编辑</button>
```

### 6.5 迁移策略（渐进式）

**不建议一次性重命名全部类名**（会涉及大量 JS innerHTML 字符串）。建议：

1. **第一步**：拆分 main.css 为多个子文件（纯物理拆分，类名不变）
2. **第二步**：新建模块采用 BEM 命名
3. **第三步**：每次修改某个组件时，顺手迁移其类名为 BEM
4. **第四步**：tokens.css 独立后，所有新文件强制使用 var(--token)

### 6.6 CSS 变量分层

将 `main.css :root` 中的变量分为三层：

```css
/* tokens.css — 基础 token（不随主题变化） */
:root {
  /* 颜色基础色阶 */
  --accent-50: #ECFDF5;
  --accent-500: #10B981;
  /* ... */

  /* 间距系统 */
  --space-1: 4px;
  --space-4: 16px;
  /* ... */

  /* 圆角 */
  --radius-sm: 10px;
  --radius: 16px;
}

/* theme.css — 语义 token（随主题切换） */
:root {
  --bg: #F8FAFC;
  --surface: #FFFFFF;
  --ink: #1E293B;
  --accent: var(--accent-500);
}
body.dark {
  --bg: #0F172A;
  --surface: #1E293B;
  --ink: #F1F5F9;
}

/* skin.css — 皮肤覆盖（用户自定义皮肤） */
.skin-forest { --accent: #047857; }
.skin-sunset { --accent: #F59E0B; }
```

分层后，主题切换只需替换 `theme.css` 中的语义 token，无需改动组件样式。

---

## 7. 详细设计 4：模块热替换（HMR）轻量方案

### 7.1 设计目标

- 零新依赖（仅用 Node `fs.watch` + 浏览器 `EventSource`）
- CSS 修改无需刷新页面（热替换 `<link>`）
- JS 模块修改支持局部重载（不丢失应用状态）
- 总代码量 < 100 行

### 7.2 架构

```
┌──────────────── dev-server.mjs ────────────────┐
│  fs.watch(wwwDir, {recursive:true})            │
│       ↓ (文件变化)                              │
│  debounce 100ms                                 │
│       ↓                                         │
│  EventSource 推送 {type:'change', file:'...'}   │
└────────────────────┬────────────────────────────┘
                     ↓ SSE
┌──────────────── hmr-client.js ─────────────────┐
│  收到 change 事件                               │
│    ├─ .css → 替换对应 <link> href（保状态）     │
│    ├─ .js  → 替换对应 <script> src + 重渲染     │
│    └─ .html → location.reload()                │
└─────────────────────────────────────────────────┘
```

### 7.3 关键实现要点

**1. 文件监听去抖**：`fs.watch` 在文件保存时会触发多次事件（编辑器原子写），需 100ms debounce。

**2. CSS 热替换保状态**：
```javascript
function reloadCss(filename) {
  document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    if (link.href.includes(filename.replace('.css', ''))) {
      const newHref = link.href.split('?')[0] + '?dev=' + Date.now();
      const newLink = link.cloneNode();
      newLink.href = newHref;
      newLink.onload = () => link.remove();
      link.parentNode.insertBefore(newLink, link.nextSibling);
    }
  });
}
```

**3. JS 模块重载**：
- 开发模式下每个源文件单独 `<script>` 标签加载
- 修改后替换 `script` 标签，浏览器重新执行
- IIFE 模块会重新注册到 `App.Modules`，需先清除旧注册：

```javascript
function reloadJs(filename) {
  const scripts = document.querySelectorAll(`script[src*="${filename}"]`);
  scripts.forEach(old => {
    // 清除旧模块注册
    if (window.App?._modules) {
      for (const key in App._modules) {
        if (key.includes(filename.replace('.js', '').split('/').pop())) {
          delete App._modules[key];
        }
      }
    }
    const fresh = document.createElement('script');
    fresh.src = old.src.split('?')[0] + '?dev=' + Date.now();
    fresh.defer = true;
    old.replaceWith(fresh);
  });
  // 重新渲染
  setTimeout(() => App.UI?.Render?.render?.(), 100);
}
```

### 7.4 HMR 局限性

| 场景 | HMR 行为 | 说明 |
|---|---|---|
| 修改 CSS | ✅ 热替换，保状态 | 推荐用法 |
| 修改 UI 模块（render/events） | ⚠️ 重载脚本 + 重渲染 | 应用状态保留，但事件监听需重新绑定 |
| 修改数据模块（constants/content） | ⚠️ 重载脚本 | 全局变量被重新定义，引用旧值的代码可能出错 |
| 修改 storage.js | ❌ 整页刷新 | 涉及 localStorage 状态 |
| 修改 app.js / main.js | ❌ 整页刷新 | 入口文件，无法热替换 |
| 新增/删除文件 | ❌ 整页刷新 | 需重启 dev server |

### 7.5 可选项：精确模块热替换

若需更精确的 HMR（仅替换变更模块的导出，不重新执行整个文件），需引入模块签名机制：

```javascript
// 每个 IIFE 模块声明 accept 钩子
App.Modules.Checkin.__hot_accept = function(newModule) {
  Object.assign(App.Modules.Checkin, newModule);
  App.UI.Render.render();
};
```

但这会增加模块编写负担，**不推荐**当前阶段实施。简单的脚本重载 + 重渲染已能满足 90% 调试需求。

---

## 8. 详细设计 5：构建产物校验

### 8.1 校验项清单

| # | 校验项 | 失败动作 | 实现 |
|---|---|---|---|
| 1 | 源文件存在性 | ❌ 失败终止 | 遍历 ORDER，readFileSync 失败即报错 |
| 2 | bundle 体积阈值 | ⚠️ 警告 | gzip 后 > 200KB 警告，> 300KB 失败 |
| 3 | 模块注册数对比 | ❌ 失败终止 | bundle 中 `App.registerModule` 调用数 vs ORDER 文件数 |
| 4 | IIFE 结构完整性 | ⚠️ 警告 | 每个源文件应以 `(function` 开头（去注释后） |
| 5 | CSS 引用一致性 | ❌ 失败终止 | index.html 引用的 CSS 文件必须存在 |
| 6 | 版本号一致性 | ❌ 失败终止 | index.html 所有 `?v=xxx` 参数值相同 |
| 7 | bundle 文件非空 | ❌ 失败终止 | 每个 bundle/*.min.js size > 0 |

### 8.2 verify.mjs 设计

```javascript
// scripts/verify.mjs
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));
const wwwDir = join(root, '..', 'www');
const jsDir = join(wwwDir, 'js');
const bundleDir = join(jsDir, 'bundle');
const cssDir = join(wwwDir, 'css');

const ORDER = JSON.parse(readFileSync(join(root, 'bundle-order.json'), 'utf8'));

const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

// 1. 源文件存在性
for (const group of ['data', 'modules', 'ui']) {
  for (const f of ORDER[group]) {
    if (!existsSync(join(jsDir, f))) fail(`缺失源文件: ${f}`);
  }
}

// 2. bundle 体积阈值
const BUNDLES = ['data.min.js', 'modules.min.js', 'ui.min.js'];
let totalGzip = 0;
for (const b of BUNDLES) {
  const p = join(bundleDir, b);
  if (!existsSync(p)) { fail(`缺失 bundle: ${b}`); continue; }
  const buf = readFileSync(p);
  if (buf.length === 0) fail(`bundle 为空: ${b}`);
  const gz = gzipSync(buf);
  totalGzip += gz.length;
  if (gz.length > 100 * 1024) warn(`${b} gzip ${(gz.length/1024).toFixed(1)}KB > 100KB`);
}
if (totalGzip > 200 * 1024) fail(`JS bundle gzip 总计 ${(totalGzip/1024).toFixed(1)}KB > 200KB`);
else console.log(`✅ JS gzip 总计: ${(totalGzip/1024).toFixed(1)}KB`);

// 3. 模块注册数对比
for (const group of ['modules', 'ui']) {
  const bundleSrc = readFileSync(join(bundleDir, group + '.js'), 'utf8');
  const regCount = (bundleSrc.match(/App\.registerModule\(/g) || []).length;
  const fileCount = ORDER[group].length;
  if (regCount < fileCount) {
    warn(`${group}: ${fileCount} 个源文件，但 bundle 中只有 ${regCount} 次 registerModule 调用`);
  }
}

// 4. IIFE 结构完整性
for (const group of ['data', 'modules', 'ui']) {
  for (const f of ORDER[group]) {
    const src = readFileSync(join(jsDir, f), 'utf8');
    const stripped = src.replace(/^\s+/, '').replace(/^\/\/.*$/m, '').replace(/^\/\*[\s\S]*?\*\//, '').replace(/^\s+/, '');
    if (!stripped.startsWith('(function') && !stripped.startsWith('window.')) {
      warn(`${f} 非 IIFE 开头，可能影响 bundle 隔离`);
    }
  }
}

// 5. CSS 引用一致性
const html = readFileSync(join(wwwDir, 'index.html'), 'utf8');
const cssRefs = [...html.matchAll(/href="([^"]+\.min\.css)/g)].map(m => m[1]);
for (const ref of cssRefs) {
  const p = join(wwwDir, ref);
  if (!existsSync(p)) fail(`index.html 引用的 CSS 不存在: ${ref}`);
}

// 6. 版本号一致性
const versions = new Set([...html.matchAll(/\?v=(\w+)/g)].map(m => m[1]));
if (versions.size > 1) fail(`index.html 版本号不一致: ${[...versions].join(', ')}`);

// 输出报告
console.log('\n=== 校验报告 ===');
if (warnings.length) {
  console.log('⚠️ 警告:');
  warnings.forEach(w => console.log('  -', w));
}
if (errors.length) {
  console.log('❌ 错误:');
  errors.forEach(e => console.log('  -', e));
  process.exit(1);
}
console.log('✅ 校验通过');
```

### 8.3 集成到 build.mjs

在 `build.mjs` 末尾调用：

```javascript
// scripts/build.mjs 末尾
console.log('5. 校验产物...');
await import('./verify.mjs');
```

或保持独立脚本，在 `npm run build` 中串联：

```json
{
  "scripts": {
    "build": "node scripts/build.mjs && node scripts/verify.mjs"
  }
}
```

**推荐**：保持 `build` 一行命令，将 verify 内联为 build.mjs 的最后一步，避免脚本膨胀。

### 8.4 版本号自动注入

修复"19 处 `?v=` 手动维护"问题。在 `build.mjs` 中：

```javascript
function injectVersionStamp() {
  const htmlPath = join(wwwDir, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  const versionJson = JSON.parse(readFileSync(join(wwwDir, 'version.json'), 'utf8'));
  const stamp = versionJson.versionName || String(Date.now());
  // 替换所有 ?v=xxx 为 ?v=<stamp>
  html = html.replace(/\?v=\w+/g, `?v=${stamp}`);
  writeFileSync(htmlPath, html, 'utf8');
  console.log('版本号注入:', stamp, '（', (html.match(/\?v=/g) || []).length, '处 ）');
}
```

调用时机：在 SW 版本更新之后、构建结束之前。

---

## 9. 验证标准对照

| 验证标准 | 现状 | 改进后 | 章节 |
|---|---|---|---|
| 构建命令保持一行完成 | ✅ `npm run build` | ✅ `npm run build`（内含 verify） | §8.3 |
| 开发模式可断点调试源文件 | ❌ | ✅ `npm run dev` → 加载源文件 | §5 |
| 生产模式 bundle < 200KB gzip | ✅ 138.3KB | ✅ 持续监控，超阈值 fail | §8.2 |
| 新增模块只需改 bundle-order.json | ❌ 需改 build.mjs | ✅ build.mjs 读取 JSON | §4.1 |

---

## 10. 迁移路线图

按优先级分 4 个阶段，每阶段独立可交付：

### 阶段 1：修复脱钩（最高优先级，1 处文件改动）

**目标**：让"新增模块只改 bundle-order.json"真正成立。

| 任务 | 文件 | 工作量 |
|---|---|---|
| 补齐 bundle-order.json 的 ai.js、update.js | scripts/bundle-order.json | 2 行 |
| build.mjs 改为读取 bundle-order.json | scripts/build.mjs | ~10 行 |
| 修复 detect-order.mjs 特征匹配 | scripts/detect-order.mjs | ~15 行 |

**验证**：在 bundle-order.json 中新增一个空模块文件，运行 `npm run build`，确认 bundle 包含该文件。

### 阶段 2：CSS 真压缩 + 版本号注入

| 任务 | 文件 | 工作量 |
|---|---|---|
| minifyCss() 改用 cssnano | scripts/build.mjs | ~10 行 |
| 新增 injectVersionStamp() | scripts/build.mjs | ~10 行 |
| 移除 index.html 手动 ?v= | www/index.html | 19 处替换 |

**验证**：`npm run build` 后 main.min.css 体积应 < 150KB（cssnano 压缩率约 30%）。

### 阶段 3：开发模式 + HMR

| 任务 | 文件 | 工作量 |
|---|---|---|
| 新增 dev-server.mjs | scripts/dev-server.mjs | ~60 行 |
| 新增 hmr-client.js | scripts/hmr-client.js | ~30 行 |
| package.json 添加 dev 脚本 | package.json | 1 行 |
| .gitignore 添加 index.dev.html | .gitignore | 1 行 |

**验证**：`npm run dev` → 浏览器打开 localhost:5173 → 修改 checkin.js → 浏览器自动重载该模块且断点命中源文件。

### 阶段 4：构建产物校验 + CSS 拆分

| 任务 | 文件 | 工作量 |
|---|---|---|
| 新增 verify.mjs（或内联） | scripts/verify.mjs | ~80 行 |
| 拆分 main.css 为 6 个子文件 | www/css/*.css | 大量剪切粘贴 |
| bundle-order.json 添加 css 字段 | scripts/bundle-order.json | ~10 行 |
| build.mjs 添加 CSS 合并逻辑 | scripts/build.mjs | ~15 行 |

**验证**：故意删除一个源文件 → `npm run build` 应失败并报告缺失文件。

---

## 附录 A：风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| build.mjs 读取 JSON 后格式不兼容 | 低 | 构建失败 | 保留旧 ORDER 作为 fallback |
| cssnano 压缩破坏样式 | 低 | 样式错乱 | 先在 dev 环境全量验证 |
| dev-server 端口冲突 | 中 | dev 启动失败 | 端口可配置，默认 5173 |
| fs.watch 在 Windows 上递归监听不稳定 | 中 | HMR 漏触发 | 用 chokidar 替代（仅 dev 依赖） |
| main.css 拆分时类名遗漏 | 中 | 样式丢失 | 拆分后 diff 检查合并产物与原文件 |

**回滚策略**：每个阶段独立 git commit，任何阶段出问题可直接 revert 对应 commit，不影响其他阶段。

---

## 附录 B：不实施的事项

以下事项虽有收益但**不在本方案范围**，避免过度工程：

| 事项 | 不做的原因 |
|---|---|
| 引入 ES Modules + bundler | 违反"不引入重型构建工具"约束 |
| TypeScript | 现有代码全 JS，迁移成本高 |
| CSS Modules / Tailwind | 现有 BEM + 变量系统已足够 |
| 单元测试框架 | 与构建流程优化无关 |
| 自动化 E2E 测试 | 与构建流程优化无关 |
| Source Map | 生产 bundle 较小，调试可走 dev 模式 |
| Tree Shaking | 现有 IIFE 模式无法静态分析 |

---

**文档结束**
