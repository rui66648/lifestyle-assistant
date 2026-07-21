# 养生助手 - 构建流程指南

## 一、项目架构

```
养生助手/
├── www/                    # Web 应用根目录（PWA + APK 共享）
│   ├── index.html          # 应用入口
│   ├── css/                # 样式文件（含压缩版 .min.css）
│   ├── js/                 # JavaScript 源代码
│   │   ├── core/           # 核心模块（storage, utils）
│   │   ├── data/           # 数据模块（constants, habits）
│   │   ├── modules/        # 业务模块（ai, diet, habit 等）
│   │   ├── ui/             # UI 模块（render, panels, events）
│   │   └── bundle/         # 构建产物（合并后的 .js 和压缩版 .min.js）
│   ├── sw.js               # Service Worker（自动版本管理）
│   ├── version.json        # 版本配置（versionName, versionCode, apkUrl）
│   └── app-release.apk     # 构建产物（GitHub Pages 分发用）
├── android/                # Android 原生项目（Capacitor）
│   ├── app/
│   │   ├── release.jks     # 签名证书
│   │   └── build.gradle    # 构建配置
│   ├── keystore.properties # 签名信息（需从 .example 复制）
│   └── gradle/             # Gradle 配置
├── scripts/                # 构建脚本
│   ├── build.mjs           # Web 构建主脚本
│   └── build-android.mjs   # Android 签名构建脚本
└── .github/workflows/      # CI/CD 工作流
    ├── deploy.yml          # GitHub Pages 部署
    └── test.yml            # 单元测试
```

## 二、构建脚本说明

### 2.1 package.json 脚本

| 脚本命令 | 功能说明 | 执行步骤 |
|----------|----------|----------|
| `npm run build` | Web 应用构建 | 更新 SW 缓存 → 合并 JS → 压缩 JS/CSS → 注入版本号 → 校验 |
| `npm run sync:android` | Capacitor 同步 | 将 www/ 资源同步到 android/app/src/main/assets/public/ |
| `npm run build:apk` | Debug APK 构建 | build → sync:android → gradlew assembleDebug |
| `npm run build:release` | 签名 APK 构建 | build:apk → build-android.mjs --release |
| `npm run build:aab` | 签名 AAB 构建 | build:apk → build-android.mjs --aab |
| `npm run deploy` | GitHub 部署 | build → git push（触发 Pages 部署） |
| `npm test` | 单元测试 | 运行 Vitest 测试套件（301 个测试） |

### 2.2 build.mjs 构建流程

```
┌─────────────────────────────────────────────────────────────┐
│                    npm run build                            │
├─────────────────────────────────────────────────────────────┤
│  1. 更新 SW 缓存版本                                        │
│     → 读取 sw.js 中的 CACHE_NAME                            │
│     → 版本号自动 +1（如 v89 → v90）                         │
├─────────────────────────────────────────────────────────────┤
│  2. 构建 JS Bundle                                          │
│     → 读取 scripts/bundle-order.json 配置                   │
│     → 按顺序合并源文件：                                     │
│       - data.js: 数据模块（constants, habits, packs）        │
│       - modules.js: 业务模块（ai, diet, habit, notification）│
│       - ui.js: UI 模块（render, panels, events）            │
├─────────────────────────────────────────────────────────────┤
│  3. 压缩 JS                                                 │
│     → 使用 terser 压缩，生成 .min.js 文件                    │
│     → 保留 console 日志，移除死代码                         │
├─────────────────────────────────────────────────────────────┤
│  4. 压缩 CSS                                                │
│     → 移除注释、空白、压缩颜色值                             │
│     → 生成 .min.css 文件                                    │
├─────────────────────────────────────────────────────────────┤
│  5. 注入版本号                                              │
│     → 读取 www/version.json 中的 versionName                │
│     → 替换 index.html 中所有 ?v=xxx 为统一版本号            │
├─────────────────────────────────────────────────────────────┤
│  6. 构建产物校验                                            │
│     → 检查源文件存在性                                       │
│     → 检查 bundle 非空                                      │
│     → 检查模块注册数一致性                                   │
│     → 检查 CSS 引用一致性                                   │
│     → 检查版本号一致性                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 build-android.mjs 签名构建流程

```
┌─────────────────────────────────────────────────────────────┐
│              npm run build:release                          │
├─────────────────────────────────────────────────────────────┤
│  前置检查：                                                  │
│  1. android/keystore.properties 存在且配置正确              │
│  2. android/app/release.jks 签名证书存在                    │
│  3. JAVA_HOME 指向 JDK 17+（推荐 Android Studio 自带 jbr）   │
├─────────────────────────────────────────────────────────────┤
│  执行步骤：                                                  │
│  1. 自动检测 JAVA_HOME（未设置时尝试 Android Studio jbr）    │
│  2. 执行 gradlew assembleRelease                            │
│  3. 将构建产物复制到 www/app-release.apk                    │
│  4. 体积检查（目标 < 20MB）                                  │
└─────────────────────────────────────────────────────────────┘
```

## 三、Android 构建前置条件

### 3.1 签名配置

```bash
# 1. 复制签名配置模板
cp android/keystore.properties.example android/keystore.properties

# 2. 修改 keystore.properties，填入签名信息
storePassword=rui66648
keyPassword=rui66648
keyAlias=release
storeFile=release.jks

# 3. 确保签名证书存在（已有 release.jks）
#    如需要重新生成：
#    keytool -genkeypair -v -keystore android/app/release.jks -alias release \
#      -keyalg RSA -keysize 2048 -validity 10000
```

### 3.2 Java 版本要求

| Java 版本 | Gradle 8.14.3 | 备注 |
|-----------|---------------|------|
| 17 | ✅ 支持 | 推荐 |
| 21 | ✅ 支持 | Android Studio jbr 21.0.10 测试通过 |
| 26 | ❌ 不支持 | "Unsupported class file major version 70" |

**推荐方案**：使用 Android Studio 自带的 JetBrains Runtime

```powershell
# Windows PowerShell
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

### 3.3 compileSdk 版本要求

| 依赖库 | 最低 compileSdk | 当前配置 |
|--------|-----------------|----------|
| androidx.browser:browser:1.9.0 | 36 | ✅ 已更新 |
| androidx.appcompat:appcompat | 24 | ✅ 兼容 |

**配置文件**：`android/variables.gradle`

```groovy
ext {
    minSdkVersion = 24
    compileSdkVersion = 36  // 必须 ≥ 36 以支持 androidx.browser:1.9.0
    targetSdkVersion = 35
}
```

> ⚠️ **重要**：如果构建报错 `Dependency 'androidx.browser:browser:1.9.0' requires compileSdk 36`，请检查 `android/variables.gradle` 中的 `compileSdkVersion` 是否为 36。

## 四、版本管理

### 4.1 version.json 配置

```json
{
  "versionName": "1.4.0",
  "versionCode": 4,
  "apkUrl": "https://rui66648.github.io/lifestyle-assistant/app-release.apk",
  "whatsNew": "优化提醒设置页面交互体验",
  "publishedAt": "2026-07-21"
}
```

### 4.2 版本同步规则

所有版本号必须同步：
- `package.json` → `version` 字段
- `www/version.json` → `versionName` 字段
- `android/app/build.gradle` → `versionName` 和 `versionCode`

## 五、CI/CD 流程

### 5.1 GitHub Pages 部署

触发条件：推送 `master` 分支

```
push master → GitHub Actions deploy.yml → npm run build → 部署到 main 分支（Pages 源）
```

### 5.2 单元测试

触发条件：推送 `master` 分支 或 Pull Request

```
push/pr → GitHub Actions test.yml → npm run test:coverage → 上传覆盖率报告
```

### 5.3 APK 手动构建

当前无自动 APK 构建，需本地执行：

```powershell
# 完整构建流程（推荐）
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run build:apk           # 构建 Debug APK
cd android ; .\gradlew.bat assembleRelease  # 构建 Release APK
copy app\build\outputs\apk\release\app-release.apk ..\www\app-release.apk
```

## 六、常见问题

### Q1: Gradle 构建失败 "Unsupported class file major version 70"

**原因**：Java 26 版本太新，Gradle 8.14.3 不支持

**解决**：切换到 Java 17 或 Java 21（Android Studio jbr）

```powershell
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

### Q2: 构建失败 "Dependency 'androidx.browser:browser:1.9.0' requires compileSdk 36"

**原因**：`android/variables.gradle` 中的 `compileSdkVersion` 版本过低

**解决**：更新 `compileSdkVersion` 为 36

```groovy
// android/variables.gradle
ext {
    compileSdkVersion = 36  // 从 35 更新到 36
}
```

### Q3: APK 文件未更新到 GitHub Pages

**原因**：`npm run deploy` 不包含 APK 构建步骤

**解决**：先构建 APK，再部署

```powershell
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npm run build:release   # 生成 www/app-release.apk
npm run deploy          # 推送到 GitHub
```

### Q4: Service Worker 缓存导致更新不生效

**原因**：旧版本缓存未过期

**解决**：`npm run build` 会自动更新 SW 缓存版本号，用户下次访问自动刷新

### Q5: 构建后模块功能缺失

**原因**：模块未注册或 bundle-order.json 配置遗漏

**解决**：检查 `scripts/bundle-order.json` 中是否包含新模块，确保每个模块调用 `App.registerModule()`

## 七、构建产物清单

| 文件 | 路径 | 说明 |
|------|------|------|
| 主页面 | www/index.html | 应用入口，含版本号注入 |
| JS Bundle | www/js/bundle/data.js/modules.js/ui.js | 合并后的源文件 |
| 压缩 JS | www/js/bundle/*.min.js | 生产环境使用 |
| 压缩 CSS | www/css/*.min.css | 生产环境使用 |
| Service Worker | www/sw.js | 自动版本管理 |
| 版本配置 | www/version.json | APP 自动更新检测 |
| APK 产物 | www/app-release.apk | GitHub Pages 分发 |

## 八、发布流程（标准）

```powershell
# 1. 设置 Java 环境
$env:JAVA_HOME = "D:\Android\Android Studio\jbr"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

# 2. 更新版本号（三处必须同步）
#    - package.json → version
#    - www/version.json → versionName, versionCode, whatsNew
#    - android/app/build.gradle → versionCode, versionName

# 3. 运行测试
npm test

# 4. 构建签名 APK
npm run build:apk                    # Web 构建 + Capacitor 同步 + Debug APK
cd android ; .\gradlew.bat assembleRelease  # Release APK（签名+压缩）
copy app\build\outputs\apk\release\app-release.apk ..\www\app-release.apk
cd ..

# 5. 部署到 GitHub
git add .
git commit -m "release: v1.4.0"
git push origin master

# 6. 验证部署
#    - 访问 https://rui66648.github.io/lifestyle-assistant/
#    - 检查 APP 版本更新提示
#    - 下载 APK 确认大小合理（< 20MB）
```

### 8.1 版本号同步检查清单

| 文件 | 字段 | 示例值 |
|------|------|--------|
| package.json | version | "1.4.0" |
| www/version.json | versionName | "1.4.0" |
| www/version.json | versionCode | 4 |
| android/app/build.gradle | versionName | "1.4.0" |
| android/app/build.gradle | versionCode | 4 |

> ⚠️ **重要**：versionCode 必须递增，否则 APK 无法覆盖安装