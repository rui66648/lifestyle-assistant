# 生活习惯小助手

融合中医养生与现代行为科学的习惯打卡 App，基于《黄帝内经》《千金要方》等中医典籍，结合行为科学与正念疗法，为你打造全方位的养生习惯体系。

[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/rui66648/lifestyle-assistant?label=最新版本)](https://github.com/rui66648/lifestyle-assistant/releases/latest)
[![Release Date](https://img.shields.io/github/release-date/rui66648/lifestyle-assistant?label=发布时间)](https://github.com/rui66648/lifestyle-assistant/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/rui66648/lifestyle-assistant/total?label=总下载量)](https://github.com/rui66648/lifestyle-assistant/releases)

---

## 📥 下载安装

### Android APK（推荐）

👉 **[点击下载最新版 APK](https://github.com/rui66648/lifestyle-assistant/releases/latest)**

所有版本 APK 均托管在 [GitHub Releases](https://github.com/rui66648/lifestyle-assistant/releases)，按版本号组织，支持自动更新检测。

> **安装提示**：首次安装需在系统设置中开启「未知来源应用安装」权限。

### PWA 网页版

🌐 **[在线体验](https://rui66648.github.io/lifestyle-assistant/)**

支持添加到主屏幕，离线可用。

---

## ✨ 核心功能

### 122+ 养生习惯库
覆盖 11 大分类：
- 🏃 **运动健身**：八段锦、太极拳、站桩、拉伸等
- 🍎 **饮食营养**：五谷为养、五色养脏、饮食有节等
- 🧘 **经络穴位**：叩齿咽津、搓涌泉、揉腹、艾灸等
- 🧠 **心灵修养**：冥想、正念行走、慈悲冥想等
- 😴 **睡眠调理**：子午觉、睡前放松、睡眠 hygiene 等
- 💧 **饮水管理**：定时饮水、每日目标、间隔提醒等
- 👁️ **护眼护脊**：眼保健操、正确坐姿、远眺休息等
- 🌿 **时令养生**：二十四节气养生、四季调理等
- 🚶 **日常活动**：散步、爬楼梯、站立办公等
- 📚 **学习成长**：每日阅读、经典诵读等
- 🏠 **居家养生**：环境调理、起居有常等

### 8 套养生套餐
一键添加习惯组合，快速启动养生之旅：
- 🌅 晨间养生
- 💼 办公防护
- ☀️ 午后调养
- 🌙 晚间放松
- 😴 睡眠调理
- 🥣 脾胃调养
- 💪 补肾养生
- 🌿 疏肝养肝

### 智能提醒系统
- ⏰ **固定时间提醒**：按子午流注规律推荐最佳时间
- 🔔 **间隔提醒**：如每 2 小时喝水、每小时起身活动
- 📱 **多渠道通知**：App 内提醒 / 系统通知 / 强提醒
- 🌙 **免打扰模式**：夜间自动静默，不打扰休息

### AI 养生顾问
- 基于云端 AI 模型的个性化养生建议
- 支持体质辨识与定制化方案
- 可选开启，所有数据本地存储优先

### 离线优先
- 📶 所有核心功能无需联网
- 💾 习惯数据仅保存在本地
- 🔒 无需注册、无需账号
- ☁️ 云端 AI 功能可选开启

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vanilla JS + HTML5 + CSS3 | 无框架依赖，轻量高效 |
| PWA | Service Worker + Web Manifest | 离线可用，可安装到主屏幕 |
| 移动端 | Capacitor 8 | 一套代码，多端运行 |
| 构建 | 自研构建脚本（build.mjs） | 代码压缩、资源打包、版本管理 |
| 测试 | Vitest | 单元测试 + 覆盖率 |
| CI/CD | GitHub Actions | 自动构建、自动发布 |
| 部署 | GitHub Pages | PWA 网页版托管 |

---

## 🚀 本地开发

### 环境要求
- Node.js >= 20
- npm >= 10
- JDK 17+（Android 构建用）
- Android SDK（Android 构建用）

### 快速开始

```bash
# 安装依赖
npm install

# 构建 JS bundle
npm run build

# 本地预览（需自行启动 HTTP 服务器）
# 例如使用 Python:
python -m http.server 8080 --directory www
```

然后访问 http://localhost:8080

### Android 构建

```bash
# 1. 配置签名（首次使用）
cp android/keystore.properties.example android/keystore.properties
# 编辑 keystore.properties 填入签名信息

# 2. 配置 SDK 路径
cp android/local.properties.example android/local.properties
# 编辑 local.properties 填入 SDK 路径等

# 3. 构建 Debug APK
npm run build:apk

# 4. 构建 Release 签名 APK
npm run build:release
```

构建产物路径：
- Debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK：`android/app/build/outputs/apk/release/app-release.apk`

### 运行测试

```bash
# 运行所有测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

---

## 📦 发布流程

### 自动发布（推荐）

推送到 `v*` tag 会自动触发 GitHub Actions 构建并发布到 Releases：

```bash
# 1. 更新版本号
# 修改 android/app/build.gradle 中的 versionCode 和 versionName
# 修改 www/version.json 中的版本信息
# 修改 package.json 中的 version

# 2. 提交并打 tag
git add .
git commit -m "release: v1.4.0"
git tag v1.4.0
git push origin v1.4.0
```

GitHub Actions 会自动：
1. 构建 JS bundle
2. 编译签名 APK
3. 创建 GitHub Release
4. 上传 APK 到 Release

### 手动发布

```bash
# 构建签名 APK
npm run build:release

# 手动在 GitHub 创建 Release 并上传 APK
```

---

## 🔐 GitHub Secrets 配置

使用自动发布功能前，需在 GitHub 仓库 Settings → Secrets and variables → Actions 中配置以下 Secrets：

| Secret 名称 | 说明 | 必填 |
|------------|------|------|
| `SIGNING_KEY` | keystore 文件的 base64 编码 | ✅ |
| `KEYSTORE_PASSWORD` | keystore 密码 | ✅ |
| `KEY_ALIAS` | key 别名（通常为 `release`） | ✅ |
| `KEY_PASSWORD` | key 密码 | ✅ |
| `CLOUD_AI_URL` | 云端 AI 代理地址 | ❌ |
| `CLOUD_AI_KEY` | 云端 AI API Key | ❌ |
| `CLOUD_AI_MODEL` | AI 模型名称（默认 qwen-max） | ❌ |
| `QWEATHER_API_KEY` | 和风天气 API Key | ❌ |
| `UPDATE_JSON_URL` | 更新检测 JSON 地址 | ❌ |

**生成 SIGNING_KEY 的方法：**

```bash
# 将 jks 文件转为 base64
base64 -i android/app/release.jks -o release.jks.base64
# 复制文件内容到 SIGNING_KEY
```

---

## 📁 项目结构

```
养生助手/
├── .github/workflows/     # CI/CD 工作流
│   ├── deploy.yml         # GitHub Pages 部署
│   ├── release.yml        # APK 自动构建发布
│   └── test.yml           # 测试验证
├── android/               # Android 原生工程（Capacitor）
│   ├── app/
│   │   └── build.gradle   # 应用级构建配置
│   ├── build.gradle       # 项目级构建配置
│   ├── keystore.properties.example
│   └── local.properties.example
├── docs/                  # 项目文档
│   ├── ADR/               # 架构决策记录
│   ├── development/       # 开发文档
│   └── business-plan/     # 商业计划
├── scripts/               # 构建脚本
│   ├── build.mjs          # JS 打包构建
│   └── build-android.mjs  # Android 构建封装
├── serverless/            # 服务端代码（可选）
│   ├── cloudflare-workers/
│   └── aliyun-fc/
├── test/                  # 单元测试
├── www/                   # PWA 源码（前端主目录）
│   ├── assets/            # 静态资源
│   ├── css/               # 样式文件
│   ├── js/                # JavaScript 源码
│   │   ├── core/          # 核心模块
│   │   ├── data/          # 数据定义
│   │   ├── modules/       # 业务模块
│   │   └── ui/            # UI 层
│   ├── references/        # 养生参考文献
│   ├── index.html         # 入口页面
│   ├── manifest.json      # PWA 清单
│   ├── sw.js              # Service Worker
│   └── version.json       # 版本信息
├── package.json
├── vitest.config.js
└── README.md
```

---

## 📄 许可协议

ISC License

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📮 反馈

如有问题或建议，欢迎通过 [GitHub Issues](https://github.com/rui66648/lifestyle-assistant/issues) 反馈。
