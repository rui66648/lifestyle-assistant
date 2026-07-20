# ADR-0002：四层架构 + 命名空间手动挂载的模块注册系统

- **状态**：Accepted（含已知缺陷，见"后续演进"）
- **日期**：2026-07-18
- **相关代码**：`www/js/app.js`、`www/js/core/storage.js`、`scripts/build.mjs`

## 背景

项目采用 Vanilla JS（见 ADR-0001），需要在不引入框架的前提下组织 ~18 个业务模块。
模块间存在明确的层次依赖（数据 → 核心 → 业务 → UI），且部分模块（AI、番茄钟、海报）
需要按需懒加载以控制首屏体积。

## 决策

**采用四层命名空间 + 轻量注册表**：

1. **分层**：`App.Data` / `App.Core` / `App.Modules` / `App.UI`，依赖只能向下流动
2. **注册函数**：`App.registerModule(name, layer, factory)` 仅做"已注册"标记，
   `factory` 参数保留为 future hook 但当前传 `null`
3. **挂载方式**：模块通过 IIFE **直接赋值**到对应命名空间
   （如 `App.Core.Storage = {...}`），而非通过 factory 返回
4. **加载顺序**：由 `index.html` 的 5 层 `<script defer>` 顺序保证，
   `scripts/build.mjs` 按相同顺序拼接 bundle
5. **依赖检查**：`App.checkDependencies()` 硬编码关键模块清单，启动时校验

```
data.constants ─┐
data.content ───┼─→ core.utils ─→ core.storage ─┬─→ modules.checkin ─┐
data.habits ────┤                                ├─→ modules.stats    ├─→ ui.render
data.packs ─────┤                                ├─→ modules.water    ├─→ ui.panels
data.sports ────┘                                └─→ [lazy] ai ───────┘  ui.events
```

## 后果

### 正面

- 零运行时开销：模块加载即直接挂到全局对象，无 DI 容器查找
- 调试直观：浏览器控制台输入 `App.Core.Storage` 即可看到全部 API
- 加载顺序明确：`index.html` 的 script 顺序即依赖顺序，新人易读
- 懒加载集成简单：`LazyLoad(path, cb)` + `window.LazyLoad` 全局函数即可

### 负面

- **`factory` 参数是死代码**：所有 18 个模块都传 `null`，接口有误导性
- **依赖关系隐式**：模块 A 依赖模块 B 仅通过"在 B 之后加载"保证，无显式声明
- **`checkDependencies` 硬编码**：新增模块需修改 `app.js` 才能加入校验
- **三处 bundle 顺序不同步风险**（已知缺陷）：
  - `scripts/bundle-order.json`（modules 缺 `ai.js`、`update.js`）
  - `scripts/build.mjs` 的 `ORDER`（含 `ai.js`、`update.js`，缺 `local-notify.js`）
  - `www/sw.js` 的 `ASSETS`（额外缓存 `ai.js`、`pomodoro.js`、`poster.js`）
- **`ai.js` 双重加载风险**：既在 `bundle/modules.min.js` 中，又被 `index.html:823`
  通过 `LazyLoad('js/modules/ai.js')` 加载

## 替代方案

### 真正的 DI 容器（factory 激活）
- 让 `App.boot()` 按 layer 顺序调用 `factory(App)`，模块不再直接挂全局
- **优点**：可单测、可懒加载注入、依赖显式
- **放弃原因**：需要重写 18 个模块的挂载方式，迁移成本高；
  当前 IIFE 直挂模式工作正常，收益不抵成本

### ES Modules（import/export）
- 用浏览器原生 ESM，依赖关系编译期解析
- **放弃原因**：
  1. Android 5 WebView 不支持 `<script type="module">`
  2. 大量 HTTP 请求需引入打包器（Rollup/esbuild），违背 ADR-0001 的极简构建
  3. 现有 `onclick="handleCheckin(...)"` 内联事件依赖全局函数，迁到 ESM 需大量改造

### Pub/Sub EventBus 替代 saveHook
- 引入 30 行的 EventBus，统一 `data:changed` 等事件
- **状态**：列为后续演进项，见"后续演进"

## 后续演进

短期修补（P0，本周内）：
1. **单一真相源**：让 `build.mjs` 读取 `bundle-order.json`，并自动生成 `sw.js` 的 ASSETS
   清单和 `index.html` 的 script 标签
2. **决定懒加载文件的归属**：`ai.js/pomodoro.js/poster.js/local-notify.js` 二选一——
   要么进 bundle（首屏），要么纯 LazyLoad（从 bundle 移除）

中期重构（P1，1-2 周）：
3. 激活 `factory` 参数或诚实地删除它
4. 让每个模块在 `registerModule` 时声明 `requires`，`checkDependencies` 改为遍历注册表

长期演进（P2）：
5. 引入轻量 EventBus 替代 `saveHook` 数组
6. 事件委托替代 HTML 内联 `onclick`
