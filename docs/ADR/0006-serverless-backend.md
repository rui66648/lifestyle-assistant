# ADR-0006：Serverless 后端——Cloudflare Workers 主 + 阿里云 FC 备

- **状态**：Accepted
- **日期**：2026-07-18
- **相关代码**：`serverless/cloudflare-workers/`、`serverless/aliyun-fc/`

## 背景

项目需要两类后端能力：
1. **AI 代理**：前端调用通义千问（阿里百炼）模型，但 API Key 不能暴露在客户端
2. **Web Push 推送**：PWA 后台推送需要 VAPID 密钥签名，同样不能放客户端

约束：
- 无服务器维护成本预算（个人项目）
- 国内访问速度（PWA 用户主要在国内）
- 数据不出境（合规）
- API Key / VAPID 私钥绝不进入前端代码或 bundle（见项目记忆中的 PAT 泄露教训）

## 决策

**采用双 Serverless 后端，Cloudflare Workers 为主，阿里云函数计算为备**：

### 主：Cloudflare Workers
- **职责**：
  - `ai-proxy.js`：通义千问 API 代理，Key 由 Worker 环境变量 `QWEN_API_KEY` 持有
  - Web Push 推送：VAPID 私钥由 Worker 环境变量持有
  - 推送任务队列：使用 KV 存储待推送任务
- **配置**：`wrangler.toml` + `.env.example`（不含真实密钥）
- **域名**：可绑定自定义域名（`is-a-dev-domain.json` 提供免费子域名选项）

### 备：阿里云函数计算（FC）
- **职责**：与 Worker 同语义的备用入口（`index.js`）
- **触发**：当 Cloudflare 在国内访问异常时手动切换
- **配置**：`s.yaml`
- **本地开发**：`local-dev.cjs` 提供本地模拟

### 客户端配置注入
- 纯 Web/PWA：用户在设置面板手动填写 Worker URL + API Key
- APK：Gradle 构建时注入 `window.__APP_CONFIG__`（含云端 Key + Worker URL），
  实现"开箱即用"
- AI 模块 `autoInitConfig()` 优先使用内置配置，回退到 localStorage 用户配置

## 后果

### 正面

- **零运维**：两端均为 Serverless，无服务器维护、无扩容压力
- **成本可控**：Cloudflare Workers 免费额度 10 万次/天，足够个人项目；
  阿里云 FC 按调用计费
- **密钥安全**：API Key / VAPID 私钥仅在 Worker 环境变量中，前端代码扫描确认无泄露
- **双活容灾**：主备切换提供国内访问保障
- **APK 零配置**：内置云端 Key 让 App 用户开箱即用

### 负面

- **冷启动延迟**：Worker 首次调用约 50-100ms，FC 冷启动 200-500ms
- **依赖外部服务**：Cloudflare 在国内偶发访问问题，需备用方案
- **APK 内置 Key 风险**：`window.__APP_CONFIG__` 中的 cloudAiKey 可被逆向提取
  （已接受该风险，因为是受限 Key + 速率限制）
- **KV 一致性**：最终一致模型，推送任务可能延迟 1-2 秒

## 替代方案

### 单一 Cloudflare Workers（无备用）
- **优点**：架构更简单
- **放弃原因**：国内访问不稳定，无备用会导致 PWA 推送在故障期完全不可用

### 单一阿里云 FC（无 Worker）
- **优点**：国内访问稳定
- **放弃原因**：
  1. 海外用户访问延迟高
  2. Web Push 在国内 Serverless 实现复杂（需 HTTPS 证书 + VAPID 库）
  3. Cloudflare 的 KV 比 FC 的表格存储更适合任务队列

### 自建 VPS + Nginx + Node.js
- **优点**：完全可控
- **放弃原因**：
  1. 违背"零运维"约束
  2. 需处理 HTTPS 证书、DDoS 防护、日志等运维事项
  3. 成本高于 Serverless 免费额度

### Supabase / Firebase
- **优点**：开箱即用，含数据库 + 推送 + 函数
- **放弃原因**：
  1. 国内访问受限
  2. SDK 体积大，违背 ADR-0001
  3. 数据出境合规风险

## 后续演进

1. **APK 内置 Key 速率限制**：在 Worker 端按 `window.__APP_CONFIG__.cloudAiKey`
   设置每日调用上限（KV 计数器），防逆向滥用
2. **FC 自动切换**：客户端检测 Worker 超时后自动回退到 FC（当前需手动切换配置）
3. **推送任务持久化**：KV 任务队列增加重试和死信队列
4. **可观测性**：Worker 端接入 Cloudflare Analytics，监控 AI 调用量和推送成功率
