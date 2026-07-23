# ADR-0007：App 版用户系统（可选登录 + 云同步）

- **状态**：Accepted
- **日期**：2026-07-22
- **相关代码**：`serverless/aliyun-fc/`（新增 `auth/`、`sync/`）、`www/js/modules/auth.js`（新增）
- **关联 ADR**：扩展 ADR-0005 的演进路径，不推翻其核心原则；复用 ADR-0004 的 Capacitor App 架构

## 背景

ADR-0005 确立了「localStorage 单一数据源、无多设备自动同步」的原则，并明确将同步能力列为后续演进。该原则在 PWA 场景下成立，但随着 ADR-0004 落地后 App 版（Capacitor 包装）用户增长，以下问题日益突出：

1. **换机迁移成本高**：用户换手机必须手动「导出 → 传输文件 → 导入」，操作门槛高，老人/非技术用户极易丢失数据
2. **无云端备份**：localStorage 在清除应用数据、重装系统时会丢失，用户无法恢复
3. **多设备协同缺失**：用户在手机打卡后，平板/另一台设备看不到更新
4. **数据丢失投诉上升**：App Store/应用市场评论中"换机丢数据"成为主要负面反馈

ADR-0005 的「阶段 1：用户自托管同步」方案需要用户自行填 Token，门槛仍然偏高；App 版用户期望「注册即用」的体验。因此需要在 App 版引入可选的用户系统与云同步能力。

同时需保留 ADR-0005 的核心价值：
- PWA 版保持极简、无登录、离线优先
- 数据隐私：「养生数据属个人隐私」的定位不变
- 不强制登录：登录是「能力增强」而非「功能门槛」

## 决策

**为 App 版增加可选登录系统，登录后获得云同步能力；PWA 版保持无登录不变**：

### 1. PWA 版不变（ADR-0005 核心原则保留）

- PWA 继续使用 localStorage 作为唯一数据源
- 不引入登录界面、不引入认证 SDK
- PWA 用户继续通过手动导入/导出（`exportData()`/`importData()`）迁移数据
- PWA 不会因为本 ADR 而感知到任何变化

### 2. App 版增加可选登录系统

- **不登录也可用全部功能**：本地功能（习惯打卡、统计、体质测试、AI 对话）不依赖登录态
- **登录后获得云同步能力**：跨设备同步、云端备份、换机一键恢复
- **登录入口**：设置面板中新增「账号与同步」区块，默认隐藏同步开关
- **平台分支**（延续 ADR-0004 的 `main.js` 平台分支模式）：仅在 `Capacitor.isNativePlatform()` 为 true 时显示登录入口

### 3. 后端存储：阿里云函数计算（FC） + RDS MySQL

- **选型**：阿里云函数计算（FC）作为 API 网关，阿里云 RDS MySQL（免费版）作为数据库
- **理由**：
  1. 国内访问速度快，无 Cloudflare Workers 国内被墙问题
  2. FC 有每月 100 万次调用免费额度，RDS MySQL 基础版免费试用额度足够个人项目
  3. MySQL 关系模型适合用户/同步记录的结构化数据，支持复杂查询
  4. FC 支持 Node.js 20 运行时，可直接使用 mysql2 驱动
- **核心表设计**：
  - `users`：`id`（UUID）、`phone`（唯一）、`email`（唯一）、`password`（哈希）、`salt`、`nickname`、`created_at`、`updated_at`
  - `refresh_tokens`：`token`（64位随机）、`user_id`、`device_id`、`expires_at`、`created_at`
  - `user_data`：`user_id`、`data_key`（如 `habits_config`）、`data_value`（JSON TEXT）、`updated_at`
- **索引**：`user_data(user_id, data_key)` 复合主键、`users(phone)` 唯一索引、`refresh_tokens(expires_at)` 索引

### 4. 认证方案：PBKDF2 + JWT

- **密码哈希**：PBKDF2-SHA256，迭代次数 100,000，salt 16 字节随机
  - 选择 PBKDF2 而非 bcrypt/argon2 的原因：Cloudflare Workers 原生支持 `crypto.subtle.deriveBits`，无需引入额外依赖（违背 ADR-0001 极简原则）
  - 迭代次数可在 Worker 环境变量配置，便于后续上调
- **JWT 策略**：
  - `accessToken`：15 分钟有效期，包含 `userId`，签名算法 HS256
  - `refreshToken`：30 天有效期，随机 32 字节 base64url，**仅哈希存储**于 D1（不存明文）
  - `accessToken` 过期后由 `refreshToken` 静默换新
  - `refreshToken` 支持轮换（rotation）：每次刷新后旧 token 立即 revoke
- **JWT 密钥**：Worker 环境变量 `JWT_SECRET`，不入库、不进前端
- **密码策略**：最短 8 位，不强制复杂度（受众包含中老年用户，过严会导致遗忘）

### 5. Token 存储

- **accessToken**：仅存内存（JS 变量），App 重启后丢失，由 refreshToken 重新获取
  - 理由：accessToken 有效期短，丢失可接受；不入存储降低 XSS 风险
- **refreshToken**：存 **Capacitor Preferences**（`@capacitor/preferences`）
  - **关键约束**：绝不存 localStorage。原生平台 Preferences 在 Android 是 SharedPreferences、iOS 是 NSUserDefaults，不被 WebView JS 上下文直接访问，降低 XSS 窃取风险
  - PWA 不使用此机制（PWA 不登录）
- **登出**：调用后端 `/auth/logout` 撤销 refreshToken，并清除本地 Preferences 中对应 key

### 6. 同步策略：Last-Write-Wins per key

- **粒度**：以 `data_key` 为最小同步单元（如 `habits_config` 整体为一个 key，`checkin_records:2026-07-22` 为一个 key）
- **冲突解决**：比较 `updated_at` 时间戳，晚写覆盖早写
- **触发时机**：
  - 本地写入后：`storage.js` 的 `saveHook`（升级后的 EventBus）触发 `sync:push` 事件，同步模块去抖 3 秒后批量上传
  - App 启动时：拉取服务端全量 key，与本地按 `updated_at` 合并
  - 网络恢复时：监听 `network` 事件，补传离线期间变更
- **时钟漂移**：以服务端 D1 的 `CURRENT_TIMESTAMP` 为权威，客户端 `updated_at` 仅作参考；冲突时服务端时间优先

### 7. 数据同步范围

仅同步以下三类数据，**不包含敏感配置**：

| 数据 key 格式                         | 来源                       | 同步 | 备注                                   |
| ------------------------------------- | -------------------------- | ---- | -------------------------------------- |
| `habits_config`                       | `storage.habitsConfig`     | ✅   | 习惯配置，整体作为一个 key             |
| `checkin_records:YYYY-MM-DD`          | `storage.checkinRecords`   | ✅   | 按日 key 粒度，减少单次同步数据量      |
| `constitution_result`                 | 体质测试模块               | ✅   | 最新一次结果                           |
| `ai_config`                           | AI 模块                    | ❌   | 含 API Key，**绝不上云**（沿用 ADR-0005 安全约束） |
| `statistics_cache`                    | 统计模块                   | ❌   | 派生数据，本地可重算                   |

## 后果

### 正面

- **App 用户换机无痛**：登录后自动拉取云端数据，一键恢复
- **云端备份**：避免本地清数据导致永久丢失
- **PWA 用户无感知**：本 ADR 不影响 PWA 任何行为
- **隐私可控**：用户可选择不登录，数据完全不离开设备
- **复用现有 FC 后端**：在已有 AI 代理基础上扩展，零新增运维，免费额度覆盖
- **ADR-0005 原则保留**：PWA 仍是 localStorage 单源，不破坏原有架构
- **安全基线明确**：refreshToken 走原生存储，降低 XSS 风险

### 负面

- **后端新增 FC + MySQL 依赖**：需要维护阿里云账号和数据库实例，但免费额度足够个人使用
- **前端新增 `@capacitor/preferences` 依赖**：增加约 5KB 包体积（仅 App 端，PWA 通过平台分支不打包）
- **同步冲突可能丢失数据**：Last-Write-Wins 在极端并发下（两台设备同时编辑同一 key）会丢失先写的版本
  - 缓解：打卡记录按日 key 粒度，冲突域最小化到单日
- **密码找回复杂**：无邮箱验证体系（个人项目不想接入邮件服务），密码遗忘只能「重新注册 + 联系作者手动绑数据」
- **JWT 密钥轮换缺失**：当前单密钥，若泄露需全员强制登出
- **D1 写入限额**：10 万行/天在极端场景（如批量导入历史打卡）可能触发，需在前端做批量合并

## 替代方案

### 方案 A：PWA 也接入登录系统
- **优点**：统一架构，代码分支更少
- **放弃原因**：
  1. 违背 ADR-0005 的「PWA 无登录」核心原则
  2. PWA 用户多为试用/轻度用户，登录门槛会降低转化
  3. PWA 场景下 localStorage 已足够，无同步刚需

### 方案 B：使用 Supabase / Firebase Auth + Database
- **优点**：开箱即用的认证 + 数据库 + 实时订阅
- **放弃原因**：
  1. 国内访问 Firebase 不稳定（ADR-0005 已论证）
  2. Supabase 国内访问延迟较高，免费额度有限
  3. SDK 体积大，违背 ADR-0001 极简原则
  4. 数据出境合规风险

### 方案 C：仅用 ADR-0005 的「自托管同步 Token」方案
- **优点**：不引入用户系统，最轻量
- **放弃原因**：
  1. 用户需自行管理 Token，门槛偏高
  2. 无账号体系无法做「换机恢复」「忘记密码」等用户预期功能
  3. App Store/应用市场用户期望「注册登录」标准体验

### 方案 D：使用 bcrypt/argon2 替代 PBKDF2
- **优点**：抗 GPU/ASIC 破解更强
- **放弃原因**：
  1. Cloudflare Workers 运行时不原生支持，需引入 WASM 版本（增加包体积与冷启动）
  2. PBKDF2 10 万次迭代在当前威胁模型下足够
  3. 可通过环境变量后续切换，不锁死

### 方案 E：accessToken 也存 Preferences
- **优点**：App 重启后无需重新换 token，启动更快
- **放弃原因**：accessToken 有效期短（15min），存持久化收益有限；仅存内存可降低 token 泄露窗口

### 方案 F：CRDT 实时协同同步
- **优点**：无冲突丢失
- **放弃原因**：
  1. 单人单账号场景下并发极低，收益不抵成本
  2. 引入 Yjs/JSON Patch 增加复杂度（ADR-0005 已论证）
  3. Last-Write-Wins per day key 已能覆盖 99% 场景

## 后续演进

短期（本次落地）：
1. **FC 端**：新增 `/auth/register`、`/auth/login`、`/auth/refresh`、`/auth/logout`、`/auth/me`、`/sync/upload`、`/sync/download` 端点
2. **MySQL schema**：通过 init-db.sql 脚本建表，包含索引
3. **前端 auth 模块**：`www/js/modules/auth.js`，通过平台分支仅 App 端加载
4. **UI 集成**：设置面板新增账号区域与同步操作按钮

中期（1-2 月）：
5. **密码找回**：评估接入 Cloudflare Email Routing（见项目可用 Skill）发送重置邮件
6. **JWT 密钥轮换**：支持 `kid` 多密钥并存，平滑轮换
7. **同步冲突可视化**：在「账号与同步」面板展示最近冲突 key，允许用户手动选择保留版本
8. **增量同步**：基于 `updated_at` 增量拉取，减少全量同步流量

长期：
9. **多设备会话管理**：在「账号与同步」面板列出当前活跃设备，支持远程登出
10. **可选家庭共享**：评估「家庭成员只读共享」场景（独立 ADR）
11. **D1 → R2 + 索引**：若同步数据量突破 D1 单库承载，评估迁移至 R2 + KV 索引
