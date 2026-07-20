# ADR-0004：通过 Capacitor 包装 PWA，平台分支集中在 main.js

- **状态**：Accepted
- **日期**：2026-07-18
- **相关代码**：`capacitor.config.json`、`www/js/core/platform.js`、`www/js/main.js`、
  `android/app/src/main/java/com/rui66648/lifestyle/`

## 背景

项目需要同时以 PWA（浏览器访问）和 Android APK（应用商店分发）两种形态提供服务。
两种环境在通知能力上差异显著：

- **PWA**：依赖浏览器 Notification API + Service Worker Push（Web Push API + VAPID），
  iOS Safari 支持有限
- **APK**：可使用 Capacitor LocalNotifications，系统级通知渠道，支持后台唤醒

其他能力（localStorage、Canvas、Touch Events）在两端行为一致。

## 决策

**单一 Web 代码库 + Capacitor 包装，平台分支集中在 `main.js`**：

1. **平台检测**：`core/platform.js` 同步执行，注入 `window.__PLATFORM__`（`'pwa'` 或 `'apk'`），
   提供 `isAPK() / isPWA()` 工具函数。`index.html:846` 内联同样逻辑消除 HTTP 请求
2. **分支入口**：`main.js:initApp()` 根据 `_platform` 调用 `initAPK()` 或 `initPWA()`
3. **通知抽象**：`modules/local-notify.js` 暴露统一 API（`sendLocalNotification`、
   `scheduleHabitReminders`），内部根据平台调用 Capacitor 或浏览器 API
4. **共享逻辑**：暗黑模式、UI 渲染、数据加载、定时提醒检查（每分钟）在两平台共享
5. **原生插件**：仅在 APK 环境生效
   - `LocalModelPlugin.java`：本地模型推理（可选）
   - `NotificationSettingsPlugin.java`：跳转系统通知设置页

```js
// main.js 的分支模式
function initApp() {
  // 共享初始化：模块检查、皮肤、暗黑模式、数据加载、UI 渲染
  if (_platform === 'apk') initAPK(); else initPWA();
  startIntervalReminderCheck();  // 共享
}

function initAPK() {
  initLocalNotify();  // Capacitor LocalNotifications
  Storage.registerSaveHook(() => rescheduleAllNotifications());
  scheduleHabitRemindersOnStart();  // 设备重启后重新调度
}

function initPWA() {
  initLocalNotify();  // 浏览器 Notification API
  setupNotificationClickHandler();  // 监听 SW postMessage
  handleHabitUrlParam();  // 从通知点击新窗口打开
  checkIOSPWANotifyWarning();  // iOS 限制提示
}
```

## 后果

### 正面

- **一套代码两端运行**：UI、业务逻辑、数据层 100% 共享，维护成本最低
- **平台差异显式**：所有 `if (_platform === 'apk')` 集中在 `main.js`，
  不散落在业务模块中
- **能力降级清晰**：PWA 在 iOS 上自动提示"建议使用番茄钟模式"（见
  `checkIOSPWANotifyWarning`）
- **APK 通知可靠**：设备重启后 `scheduleHabitRemindersOnStart()` 自动重新调度

### 负面

- **APK 包体偏大**：Capacitor 运行时 + WebView 兼容层约 2MB，加 www 资源总包 ~5MB
- **APK 启动慢于原生**：WebView 初始化 + SW 注册约 200-400ms
- **`local-notify.js` 内部仍有平台分支**：虽然 `main.js` 抽象了入口，
  但 `local-notify.js` 内部仍需 `if (isAPK())` 调用不同 API
- **PWA 在 iOS 上通知能力受限**：无法后台推送，只能前台提醒

## 替代方案

### 原生 Android 重写
- **优点**：性能最优，包体最小，通知能力最强
- **放弃原因**：开发成本高 3-5 倍；失去 Web 端能力；维护两套代码

### React Native / Flutter
- **优点**：跨平台 + 接近原生性能
- **放弃原因**：
  1. 与 ADR-0001 的 Vanilla JS 路线冲突
  2. 包体更大（RN ~7MB，Flutter ~8MB）
  3. 失去 PWA 形态，无法在浏览器直接访问

### Tauri Mobile
- **优点**：更轻量，Rust 后端
- **放弃原因**：2026 年移动端仍不成熟；生态弱于 Capacitor

### Progressive Web App + WebAPK（Trusted Web Activity）
- **优点**：零原生代码
- **放弃原因**：
  1. 国内 Android 厂商对 TWA 支持差
  2. 通知能力仍受 WebView 限制
  3. 无法上架部分应用商店

## 后续演进

1. **抽离 `LocalNotify` 接口**：把 `local-notify.js` 拆为 `local-notify-base.js`
   + `local-notify-capacitor.js` + `local-notify-web.js`，按平台加载对应实现
2. **APK 跳过 SW 注册**：见 ADR-0003 的后续演进
3. **Capacitor 8 → 9 升级评估**：关注 LocalNotifications API 变化
