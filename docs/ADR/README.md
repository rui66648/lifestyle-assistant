# 架构决策记录（ADR）

> 本目录记录「生活习惯小助手」项目的所有架构决策。每个 ADR 遵循 Michael Nygard 模板，
> 包含：背景、决策、后果、替代方案。

## 决策列表

| 编号  | 标题                                      | 状态     | 日期        |
| ----- | ----------------------------------------- | -------- | ----------- |
| 0001  | 采用 Vanilla JavaScript，不引入前端框架    | Accepted | 2026-07-18  |
| 0002  | 四层架构 + 命名空间手动挂载的模块注册系统  | Accepted | 2026-07-18  |
| 0003  | Service Worker 使用 Stale-While-Revalidate | Accepted | 2026-07-18  |
| 0004  | 通过 Capacitor 包装 PWA，平台分支在 main.js| Accepted | 2026-07-18  |
| 0005  | localStorage 单一数据源，无多设备自动同步  | Accepted | 2026-07-18  |
| 0006  | Serverless 后端：Cloudflare Workers 主 + 阿里云 FC 备 | Accepted | 2026-07-18 |

## 状态定义

- **Proposed**：已提出，待评审
- **Accepted**：已接受，正在执行
- **Deprecated**：已废弃，被后续 ADR 取代
- **Superseded**：已被 ADR-XXXX 取代

## 何时新增 ADR

- 引入或移除一项核心技术依赖
- 改变模块间通信机制
- 改变数据存储或同步策略
- 改变构建/部署流程
- 任何会影响"如何做后续开发"的全局选择
