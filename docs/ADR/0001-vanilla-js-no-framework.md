# ADR-0001：采用 Vanilla JavaScript，不引入前端框架

- **状态**：Accepted
- **日期**：2026-07-18
- **决策者**：项目作者

## 背景

「生活习惯小助手」需要同时以 PWA 和 Android APK（通过 Capacitor）两种形态分发。
首屏加载预算 < 200KB（不含图片），目标兼容 Android 5.0+（API 21，Chrome 37 等同内核）。

候选技术栈：
1. Vanilla JS（无框架）
2. Vue 3 + Vite
3. React + Vite
4. Svelte / SvelteKit

## 决策

**采用 Vanilla JavaScript**，模块通过 `App.registerModule(name, layer, factory)` 注册到
`window.App.{Data,Core,Modules,UI}` 四层命名空间，由 `scripts/build.mjs` 按固定顺序拼接为
`bundle/{data,modules,ui}.js` 并经 terser 压缩。

## 后果

### 正面

- 首屏 JS 体积可控：当前 `bundle/*.min.js` 合计约 150KB，加 `app.js/lazy.js/main.js/compat.js`
  约 180KB，未触顶
- 无框架运行时开销，启动到可交互 < 1s（中端机型）
- 构建工具链极简：`terser` 唯一依赖，无 Babel/webpack/vite 复杂配置
- 老旧 WebView（Android 5）兼容性可控，不依赖 Proxy/Symbol 等新特性（除 storage.js 的
  `Object.defineProperty` 外）
- 跨平台层（Capacitor）只需包装静态资源，无需处理框架 SSR/CSR

### 负面

- 状态管理靠手动 `localStorage` + 命令式 `render()` 调用，易遗漏刷新
- 模块间通信靠全局函数和 `saveHook` 数组，无响应式系统
- HTML 内联 `onclick` 大量存在，可维护性下降
- 缺少模板编译期检查，XSS 风险靠 `esc()` 函数人工保障（已通过 `apply-xss.mjs` 扫描）

## 替代方案

### Vue 3 + Vite
- **优点**：响应式数据绑定自动刷新 UI；单文件组件可读性高
- **放弃原因**：Vue 3 运行时 ~50KB（gzip），加 Vite 构建链后首屏难以守住 200KB；
  Android 5 WebView 对 Proxy 的支持有兼容性问题（Vue 3 响应式依赖 Proxy）
- **何时重新评估**：若放弃 Android 5 支持，可重新考虑

### Svelte
- **优点**：编译期消除运行时，体积接近 Vanilla
- **放弃原因**：引入独立构建链，与现有 `build.mjs` 拼接策略冲突；团队对 Svelte 经验不足

### Preact + htm（无构建）
- **优点**：3KB 运行时，无 JSX 编译
- **放弃原因**：仍需重写所有 UI 代码，迁移成本 > 收益

## 参考

- 验证脚本：`scripts/apply-xss.mjs`
- 构建脚本：`scripts/build.mjs`
- 包体约束：`package.json` 中无任何前端框架依赖
