# 发布与上架指南

> 本文档涵盖 Android 签名包构建、GitHub Releases 自动发布、Google Play 上架、国内应用市场上架、以及应用内版本检测更新流程。

---

## 一、构建签名包

### 1.1 前置准备

| 文件 | 说明 |
|------|------|
| `android/keystore.properties` | 签名配置（从 `.example` 复制，已 gitignore） |
| `android/app/release.jks` | 签名证书（首次生成后备份） |
| `android/local.properties` | SDK 路径 + 云端 AI 密钥 + 更新地址 |

### 1.2 首次生成 Keystore

```powershell
keytool -genkeypair -v `
  -keystore android/app/release.jks `
  -alias release `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass <你的密码> -keypass <你的密码>
```

> ⚠️ `release.jks` 是应用身份的唯一凭证，丢失后无法找回、无法更新应用。请备份到加密 U 盘 / 密码管理器。

### 1.3 构建命令

```powershell
# 构建 PWA + 同步到 Android + 生成签名 APK（复制到 www/）
npm run build:release

# 构建 PWA + 同步到 Android + 生成签名 APK（不复制到 www/，用于 GitHub Releases）
node scripts/build-android.mjs --release --no-copy

# 构建 PWA + 同步到 Android + 生成签名 AAB（Google Play 上架用）
npm run build:aab
```

产物路径：
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`（Google Play 上传）

> 💡 **Git 仓库中不存放 APK**：APK 为二进制大文件，会严重拖慢仓库克隆速度。统一通过 GitHub Releases 分发。

### 1.4 发版版本号递增

每次发版前修改 `android/app/build.gradle`：
```gradle
versionCode 4      // ← 递增（整数，Google Play / 国内市场用于判断升级）
versionName "1.4"  // ← 用户可见版本号
```
同步更新 `www/version.json` 中的 `versionCode` / `versionName` / `whatsNew`，以及 `package.json` 中的 `version`。

---

## 二、GitHub Releases 自动发布

### 2.1 工作原理

推送 `v*` tag（如 `v1.4.0`）到 GitHub 后，GitHub Actions 自动：
1. 拉取代码
2. 构建 JS bundle
3. 编译签名 APK
4. 创建 GitHub Release
5. 上传 APK 到 Release

用户从 Releases 页面下载 APK，Watch 仓库的用户会收到新版本通知。

### 2.2 配置 GitHub Secrets

首次使用前，需在仓库 **Settings → Secrets and variables → Actions** 中配置以下 Secrets：

| Secret 名称 | 说明 | 必填 |
|------------|------|------|
| `SIGNING_KEY` | release.jks 文件的 base64 编码 | ✅ |
| `KEYSTORE_PASSWORD` | keystore 密码 | ✅ |
| `KEY_ALIAS` | key 别名（通常为 `release`） | ✅ |
| `KEY_PASSWORD` | key 密码 | ✅ |
| `CLOUD_AI_URL` | 云端 AI 代理地址 | ❌ |
| `CLOUD_AI_KEY` | 云端 AI API Key | ❌ |
| `CLOUD_AI_MODEL` | AI 模型名称（默认 qwen-max） | ❌ |
| `QWEATHER_API_KEY` | 和风天气 API Key | ❌ |
| `UPDATE_JSON_URL` | 更新检测 JSON 地址 | ❌ |

**生成 SIGNING_KEY（base64 编码）：**

```powershell
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\app\release.jks")) | Set-Content release.jks.base64

# macOS / Linux
base64 -i android/app/release.jks -o release.jks.base64
```

复制输出内容到 `SIGNING_KEY` Secret。

### 2.3 自动发布流程

```bash
# 1. 修改版本号
#    android/app/build.gradle → versionCode + 1, versionName 更新
#    www/version.json → versionCode / versionName / whatsNew / apkUrl
#    package.json → version

# 2. 提交并打 tag
git add .
git commit -m "release: v1.4.0"
git tag v1.4.0

# 3. 推送（tag 触发自动构建）
git push origin master
git push origin v1.4.0
```

然后到 **Actions** 页面查看构建进度，完成后 Releases 页面会自动出现新版本。

### 2.4 手动发布

如果 CI 出现问题，也可以手动构建并上传：

```bash
# 1. 本地构建签名 APK
npm run build:release

# 2. 在 GitHub 仓库 → Releases → Draft a new release
#    - Tag version: v1.4.0
#    - Release title: v1.4.0
#    - Describe this release: 填写更新内容
#    - Attach binaries: 上传 app-release.apk
#    - 点击 "Publish release"
```

### 2.5 更新检测配置

切换到 GitHub Releases 分发后，`www/version.json` 中的 `apkUrl` 应改为 Releases 下载地址：

```json
{
  "apkUrl": "https://github.com/rui66648/lifestyle-assistant/releases/latest/download/app-release.apk"
}
```

`/latest/download/app-release.apk` 始终指向最新版本的 APK，无需每次发版都修改 URL。

---

## 三、Google Play 上架材料

### 3.1 商店列表信息

| 字段 | 内容 |
|------|------|
| 应用名称 | 生活习惯小助手 |
| 简短描述（80字） | 融合中医养生与现代行为科学的习惯打卡App，122+养生习惯、8套养生套餐、智能提醒。 |
| 完整描述 | 见下方 |

**完整描述：**
```
生活习惯小助手——你的口袋养生顾问。

【融合中医与科学】
基于《黄帝内经》《千金要方》《抱朴子》等中医典籍，结合现代行为科学与正念疗法，为你打造全方位的养生习惯体系。

【122+ 养生习惯库】
覆盖运动健身（八段锦、太极拳、站桩）、饮食营养（五谷为养、五色养心）、经络穴位（叩齿咽津、搓涌泉、揉腹）、心灵修养（冥想、正念行走、慈悲冥想）等11大分类。

【8 套养生套餐】
晨间养生、办公防护、午后调养、晚间放松、睡眠调理、脾胃调养、补肾养生、疏肝养肝——一键添加配套习惯组合。

【智能提醒】
支持固定时间提醒与间隔提醒（如每2小时喝水），即使App被关闭也能准时送达。三个独立通知渠道，可分别控制。

【离线优先】
所有数据存储在本地，无需注册、无需联网即可使用。云端AI养生顾问可选开启。

【数据安全】
无服务器同步，你的习惯数据只属于你。
```

### 3.2 应用分类

| 字段 | 值 |
|------|-----|
| 类别 | 健康与健身 (Health & Fitness) |
| 内容分级 | 所有人 (3+) |
| 目标受众 | 18+ |
| 包含广告 | 否 |
| 应用内购买 | 否 |

### 3.3 隐私政策 URL

需托管隐私政策页面，Google Play 要求提供 URL。要点：
- 声明收集的数据范围：仅本地存储习惯打卡数据，不上传服务器
- 声明权限用途：通知权限用于习惯提醒，精确闹钟用于定时提醒
- 如开启云端AI功能，声明AI对话数据经你自己的Worker代理传输

### 3.4 数据安全声明（Data Safety 表单）

| 数据类型 | 是否收集 | 用途 |
|----------|---------|------|
| 习惯打卡记录 | 是（仅本地） | 应用功能 |
| 个人设置 | 是（仅本地） | 应用功能 |
| 位置信息 | 否 | — |
| 邮箱/账号 | 否（无需注册） | — |
| AI对话内容 | 可选 | 用户主动使用AI顾问时经加密代理传输 |

### 3.5 截图与素材

| 素材 | 要求 |
|------|------|
| 手机截图 | 至少 2 张，推荐 4-8 张（1080×1920 或 16:9） |
| 高分辨率图标 | 512×512 PNG |
| 置顶大图 | 1024×500 PNG |
| 应用图标 | 已配置自适应图标（青绿底+白色心形对勾） |

### 3.6 Google Play 审核注意事项

1. **目标 API 级别**：当前 compileSdk/targetSdk = 35（Android 15），满足 Play 最新要求
2. **USE_EXACT_ALARM 权限**：Google Play 对此权限审核严格。如果被拒，改用 `SCHEDULE_EXACT_ALARM`（需用户授权）或在 Play Console 声明用途为「闹钟/提醒」
3. **通知权限**：已在 Manifest 声明 POST_NOTIFICATIONS，运行时正确请求（Android 13+）
4. **WebView 数据采集声明**：App 使用 WebView 加载本地 PWA，需在数据安全表单中如实声明
5. **无账号登录**：App 无需注册登录，避免账号相关审核问题
6. **内容分级问卷**：如实填写 IARC 问卷，本应用不含暴力/色情/赌博内容

---

## 四、国内应用市场上架

### 4.1 各市场对比

| 市场 | 包名要求 | 签名 | 审核周期 | 特殊要求 |
|------|---------|------|---------|---------|
| 华为 AppGallery | 包名一致 | 签名一致 | 1-3 工作日 | 需软著 |
| 小米应用商店 | 包名一致 | 签名一致 | 1-2 工作日 | 需软著 |
| OPPO 开放平台 | 包名一致 | 签名一致 | 1-3 工作日 | 需软著 |
| vivo 开放平台 | 包名一致 | 签名一致 | 1-3 工作日 | 需软著 |
| 应用宝（腾讯） | 包名一致 | 签名一致 | 1-3 工作日 | 需软著 |

### 4.2 软件著作权（必备）

国内市场上架需提供《计算机软件著作权登记证书》。
- 申请渠道：中国版权保护中心（https://register.ccopyright.com.cn）
- 材料：源代码前30页+后30页、用户手册、申请表
- 周期：普通 30 工作日，可加急

### 4.3 通用审核要点

1. **应用权限说明**：每个权限需说明用途
   - `INTERNET`：AI 养生顾问功能（可选）
   - `POST_NOTIFICATIONS`：习惯打卡提醒通知
   - `USE_EXACT_ALARM`：定时提醒精确触发
2. **隐私政策**：需提供可访问的隐私政策 URL（与 Google Play 一致即可）
3. **ICP 备案**：部分市场要求提供 ICP 备案号（如有网站）
4. **无广告/无内购声明**：如实声明，避免审核被打回
5. **应用截图**：3-5 张，中文界面，清晰可辨
6. **应用描述**：不可含"最""第一"等极限词（广告法限制）

### 4.4 各市场特殊注意事项

**华为 AppGallery：**
- 需注册华为开发者账号（需实名认证）
- 支持 AppSigning（上传未签名包，华为代签名）——建议自行签名上传
- 需填写「应用安全评估」问卷

**小米应用商店：**
- 审核较严格，禁止诱导下载
- 需提供「应用合规自查表」
- 通知权限需在描述中说明用途

**OPPO / vivo：**
- 需提供「隐私政策」和「用户协议」URL
- 对后台行为有检测，确保无后台偷跑

---

## 五、应用内版本检测与更新提示

### 5.1 现有机制

已实现纯前端更新检测（`www/js/modules/update.js`）：
- App 启动时自动检查（每 24 小时最多一次）
- 设置页可手动检查更新
- 发现新版本弹窗 → 引导用户下载安装

### 5.2 版本信息 JSON

托管在 `UPDATE_JSON_URL`（配置在 `local.properties`），格式：
```json
{
  "versionCode": 4,
  "versionName": "1.4",
  "apkUrl": "https://你的托管地址/app-release.apk",
  "whatsNew": ["新增八段锦/太极拳等中医导引习惯", "优化通知权限请求流程"],
  "publishedAt": "2026-07-18"
}
```

### 5.3 标准发版流程

```
1. 修改 android/app/build.gradle → versionCode + 1, versionName 更新
2. npm run build:release          → 生成签名 APK
3. 上传 APK 到托管地址（GitHub Pages / OSS / COS）
4. 更新 www/version.json          → versionCode / versionName / apkUrl / whatsNew
5. 推送 version.json 到托管地址
6. 用户打开 App → 自动检测到新版本 → 弹窗 → 下载安装
```

### 5.4 Google Play 更新流程

Google Play 上架后，更新由 Play 商店自动推送。应用内更新检测仅用于国内市场（侧载分发）。
如需接入 Play In-App Update API，需额外集成 `com.google.android.play:app-update` 库。

### 5.5 国内市场更新流程

国内市场支持自更新（下载APK → 引导安装）。现有 `update.js` 已实现：
- 检测到新版本 → 弹窗显示更新内容
- 用户点「立即更新」→ 浏览器打开 `apkUrl` 下载
- 用户手动安装（需在设置开启「未知来源安装」权限）

如需应用内直接下载安装（不跳浏览器），可集成 `@capacitor/filesystem` + `@capacitor-community/file-opener` 实现静默下载安装。

---

## 六、验证清单

- [ ] APK 体积 < 20MB（当前 ~8MB ✓）
- [ ] 签名证书已备份到安全位置
- [ ] keystore.properties 已配置且未入版本库
- [ ] 在 Android 5.0+（API 24+）模拟器正常运行
- [ ] Android 13+ 通知权限正确请求（prompt → 授权/denied 三态处理）
- [ ] 自适应图标在启动器中正确显示
- [ ] version.json 已托管并可访问
- [ ] 隐私政策页面已部署
- [ ] Google Play 商店列表材料完整
- [ ] 软件著作权已申请（国内市场）
