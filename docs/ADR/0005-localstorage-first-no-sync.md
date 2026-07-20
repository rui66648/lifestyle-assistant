# ADR-0005：localStorage 单一数据源，无多设备自动同步

- **状态**：Accepted（同步能力列为后续演进）
- **日期**：2026-07-18
- **相关代码**：`www/js/core/storage.js`、`www/js/modules/ai.js`

## 背景

项目核心数据包括：
- 习惯配置（`habits_config`）：用户自定义的习惯列表，含提醒时间、目标值等
- 打卡记录（`checkin_records`）：按日期 key 索引的打卡数据，每日一条
- 体质测试结果（`constitution_result`）：九种体质辨识
- AI 配置（`ai_config`）：Worker URL、API Key、模型名（含敏感信息）

数据规模估算：
- 单设备 1 年打卡记录约 50KB JSON
- 习惯配置约 5KB
- 总数据量 < 100KB，远低于 localStorage 5MB 上限

## 决策

**采用 localStorage 作为唯一本地数据源，不实现自动多设备同步**：

1. **数据访问代理**：`storage.js` 通过 `Object.defineProperty` 把
   `habitsConfig` / `checkinRecords` 暴露到 window，所有模块通过代理读写，
   保证单一数据源
2. **写操作触发副作用**：`saveConfig/saveRecords` 内部依次执行
   `localStorage.setItem` → `markStatsDirty()`（统计缓存失效）→ `_runSaveHooks()`
   （当前仅 APK 通知重调度）
3. **跨设备迁移靠手动导入导出**：
   - `exportData()`：导出 JSON 文件（version=2 格式）
   - `importData()`：从 JSON 文件恢复
4. **AI 配置不同步**：`ai_config.apiKey` 仅存本地，导出文件中**不包含**
   （安全约束，见项目记忆中的 PAT 教训）
5. **数据格式版本化**：`migrateOldFormat()` 处理 v1 → v2 迁移（数组 → 对象）

## 后果

### 正面

- **实现极简**：核心存储逻辑 < 200 行，无网络依赖
- **离线 100% 可用**：所有读写本地完成，无网络延迟
- **隐私友好**：数据不离开设备，符合"养生数据属个人隐私"的定位
- **无冲突问题**：单设备单用户场景下无并发写入
- **导出文件可审计**：JSON 格式用户可读，可手动修改后导入

### 负面

- **跨设备需手动操作**：用户换手机必须先导出再导入，否则数据丢失
- **无实时同步**：在手机打卡后，平板看不到更新
- **数据丢失风险**：localStorage 在清除浏览数据时会被一并清除，无云端备份
- **AI 配置需重填**：每个设备都要单独配置 API Key
- **saveHook 仅 1 个槽位**：当前仅 APK 通知重调度使用，无法表达多订阅

## 替代方案

### 阶段 1：用户自托管同步（推荐演进路径）
- 复用现有 Cloudflare Worker，新增 `/sync` 端点
- 数据格式沿用 `exportData()` 的 JSON
- 设备生成 `deviceId`，文档同步带 `lastModifiedAt`
- 冲突策略：**Last-Write-Wins per habit per day**（按习惯 ID + 日期粒度合并）
- 鉴权：用户在设置里填同步 Token（沿用 `ai_config` 模式）
- **成本**：约 1 周；**收益**：解决跨设备基础需求

### 阶段 2：自动后台同步
- PWA：Background Sync API + `navigator.onLine` 监听
- APK：Capacitor BackgroundTask + 网络状态监听
- 增量同步：只传 `lastModifiedAt > lastSyncAt` 的 habit IDs
- 复用 KV 队列（推送任务已用）
- **成本**：2-3 周

### 阶段 3：CRDT 实时协同
- 引入 Yjs 或 JSON Patch（RFC 6902）
- 适合多人共享习惯场景
- **不推荐短期**：单人场景收益不抵成本

### IndexedDB 替代 localStorage
- **优点**：容量大（50MB+）、异步非阻塞、支持事务
- **放弃原因**：
  1. 当前数据量 < 100KB，localStorage 足够
  2. API 较繁，需引入 Promise 包装或 Dexie.js（违背极简）
  3. Android 5 WebView 对 IndexedDB 的支持有已知 bug
- **何时重新评估**：数据量突破 1MB 或引入附件（图片打卡）时

### 云端原生同步（Firebase / Supabase）
- **优点**：开箱即用
- **放弃原因**：
  1. 国内访问 Firebase 不稳定
  2. 引入大型 SDK，违背 ADR-0001
  3. 数据出境合规风险

## 后续演进

短期（1 周内）：
1. **导出文件含 `lastModifiedAt`**：为阶段 1 同步做准备，每个 habit 和每日记录
   带时间戳
2. **`saveHook` 升级为 EventBus**：30 行代码，统一 `data:changed` 事件，
   支持多订阅（统计、UI、通知、未来的同步模块）

中期（1-2 月）：
3. **阶段 1 同步实现**：Worker `/sync` 端点 + 设置面板的同步开关
4. **AI 配置不上云**的约束继续保留，仅同步 `habitsConfig` + `checkinRecords`

长期：
5. 评估阶段 2 自动同步的需求强度，决定是否投入
