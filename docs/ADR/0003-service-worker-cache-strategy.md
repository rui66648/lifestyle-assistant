# ADR-0003：Service Worker 使用 Stale-While-Revalidate 缓存策略

- **状态**：Accepted
- **日期**：2026-07-18
- **相关代码**：`www/sw.js`、`scripts/build.mjs`、`www/index.html`

## 背景

项目要求**离线优先**：所有核心功能（打卡、统计、提醒、体质测试）必须在断网下可用。
同时需要保证用户能及时拿到新版本，避免"老版本卡死在 SW 缓存里"。

资源类型分布：
- 应用 Shell：`index.html`、`manifest.json`
- 静态资产：JS bundle、CSS、图标
- 懒加载模块：`ai.js`、`pomodoro.js`、`poster.js`、`local-notify.js`
- 文献内容：`references/*.html`（约 30 个 HTML，总大小 ~5MB）
- 版本元数据：`version.json`
- 后端 API：Cloudflare Workers（`/ai-proxy`、`/push`）

## 决策

**按资源类型采用混合缓存策略**：

| 资源类型           | 策略                          | 实现位置       |
| ------------------ | ----------------------------- | -------------- |
| HTML 文档          | Network-First，失败回退缓存   | `sw.js:88-96`  |
| JS / CSS           | Stale-While-Revalidate        | `sw.js:67-85`  |
| 图片 / 字体        | Cache-First，回退网络         | `sw.js:99`     |
| `version.json`     | 不缓存（`cache: 'no-store'`） | `index.html:870` |
| 懒加载模块         | 首次网络加载后自动进缓存      | `sw.js:78-84`  |
| API 请求           | 不拦截，直接走网络            | `sw.js:60` 默认 |

**版本管理**：
- SW 缓存名 `lifestyle-assistant-v{N}`，由 `build.mjs` 每次 build 自增（当前 v46）
- `index.html` 启动时拉 `version.json`，若版本号变化则清空所有 caches 并 reload
- SW `controllerchange` 事件触发自动 reload（用户无感更新）

## 后果

### 正面

- **首屏快**：JS/CSS 命中缓存立即返回，后台静默拉新版本，下次访问生效
- **HTML 及时更新**：Network-First 保证用户拿到最新 index.html，避免卡在旧版本
- **离线可用**：所有应用 Shell 资源在 install 阶段预缓存（`Promise.allSettled` 容错）
- **自动更新**：三重保险——SW 版本号 + version.json 比对 + controllerchange reload

### 负面

- **references/ 未预缓存**：30 个养生文献 HTML 当前不在 `ASSETS` 列表，
  首次离线访问会 404。需要用户先在线访问过才能离线阅读
- **`?v=` 查询串手写**：`index.html` 里的 `?v=20260714` 是手写硬编码，
  与 SW 版本号 `v46` 不同步，可能导致 SWR 后台拉到缓存键不同的"旧资源"
- **APK 环境冗余**：Capacitor WebView 走 `https://localhost` 本地资产，SW 是多余的
  （但仍会注册，增加首次启动 ~200ms）
- **`ai.js` 双重缓存**：`bundle/modules.min.js` 已包含，`sw.js:24` 又单独缓存，
  浪费 ~30KB 缓存空间

## 替代方案

### Cache-First（全缓存优先）
- **优点**：极快，离线完整
- **放弃原因**：HTML 也走 Cache-First 会导致用户长期停留在旧版本，
  即使发布了修复也无法触达。已踩过此坑

### Network-First（全网络优先）
- **优点**：永远最新
- **放弃原因**：弱网下首屏白屏时间长，违背"离线优先"约束

### Workbox
- **优点**：成熟工具链，预置 SWR/NetworkFirst 等策略
- **放弃原因**：
  1. Workbox 运行时 ~30KB，违背 ADR-0001 的体积约束
  2. 当前 `sw.js` 仅 154 行，手写策略足够清晰
  3. 引入构建依赖（workbox-webpack-plugin 等），违背极简构建

### 离线优先 + 后台同步（Background Sync API）
- **状态**：列为后续演进，用于多设备同步（见 ADR-0005）

## 后续演进

1. **`references/` 预缓存**：把文献目录加入 install 阶段的 ASSETS，或运行时首次访问
   时 `cache.put`
2. **统一 `?v=` 与 SW 版本号**：让 `build.mjs` 同时改写 `index.html` 的查询串
3. **APK 环境跳过 SW 注册**：`index.html:893` 加 `if (!isAPK())` 判断
4. **从 ASSETS 移除已在 bundle 中的懒加载文件**：`ai.js` 既然进了 bundle，
   不再单独缓存
