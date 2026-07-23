/**
 * Android 签名包构建封装
 * 用法：
 *   node scripts/build-android.mjs --release          → 生成签名 APK 并复制到 www/
 *   node scripts/build-android.mjs --release --no-copy  → 生成签名 APK，不复制到 www/
 *   node scripts/build-android.mjs --aab              → 生成签名 AAB (app-release.aab)
 *
 * 参数：
 *   --release : 构建 APK（默认）
 *   --aab     : 构建 AAB（Google Play 上架用）
 *   --no-copy : 不将 APK 复制到 www/（使用 GitHub Releases 分发时使用）
 *
 * 前置条件：
 *   1. android/keystore.properties 已配置（从 keystore.properties.example 复制）
 *   2. JAVA_HOME 指向 JDK 17+（Android Studio 自带 jbr 即可）
 *   3. ANDROID_HOME 或 local.properties 中 sdk.dir 已配置
 */
import { existsSync, statSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = dirname(fileURLToPath(import.meta.url));
const androidDir = join(root, '..', 'android');
const wwwDir = join(root, '..', 'www');

const mode = process.argv.includes('--aab') ? 'aab' : 'release';
const noCopy = process.argv.includes('--no-copy');
const gradleTask = mode === 'aab' ? 'bundleRelease' : 'assembleRelease';
const outputExt = mode === 'aab' ? '.aab' : '.apk';
const outputName = 'app-release' + outputExt;

// ---- 检查 keystore.properties ----
const keystoreProps = join(androidDir, 'keystore.properties');
if (!existsSync(keystoreProps)) {
  console.error('❌ 未找到 android/keystore.properties');
  console.error('   请复制 keystore.properties.example 为 keystore.properties 并填入签名信息');
  process.exit(1);
}

// ---- 检查 release.jks ----
const jksPath = join(androidDir, 'app', 'release.jks');
if (!existsSync(jksPath)) {
  console.error('❌ 未找到签名证书 android/app/release.jks');
  console.error('   生成命令：');
  console.error('   keytool -genkeypair -v -keystore android/app/release.jks -alias release \\');
  console.error('     -keyalg RSA -keysize 2048 -validity 10000');
  process.exit(1);
}

// ---- 检查 gradlew ----
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const gradlewPath = join(androidDir, gradlew);
if (!existsSync(gradlewPath)) {
  console.error('❌ 未找到 gradlew，请确认 android/ 目录完整性');
  process.exit(1);
}

// ---- 执行 Gradle 构建 ----
console.log('=== Android 签名构建 ===');
console.log('模式:', mode === 'aab' ? 'AAB (Google Play 上架)' : 'APK (直接分发)');
console.log('Gradle Task:', gradleTask);
console.log('');

// 设置 JAVA_HOME（如果未设置则尝试 Android Studio 自带 jbr）
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const candidates = [
    'D:/Android/Android Studio/jbr',
    'C:/Program Files/Android/Android Studio/jbr',
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      env.JAVA_HOME = c;
      console.log('JAVA_HOME 自动设置:', c);
      break;
    }
  }
}

try {
  const cmd = gradlew + ' ' + gradleTask;
  console.log('执行:', cmd);
  console.log('');
  execSync(cmd, {
    cwd: androidDir,
    env,
    stdio: 'inherit',
  });
} catch (e) {
  console.error('');
  console.error('❌ Gradle 构建失败');
  process.exit(1);
}

// ---- 复制产物到 www/ ----
const buildOutput = join(androidDir, 'app', 'build', 'outputs', mode === 'aab' ? 'bundle' : 'apk', 'release', outputName);
if (existsSync(buildOutput)) {
  const sizeMB = (statSync(buildOutput).size / 1024 / 1024).toFixed(2);
  if (mode === 'release') {
    console.log('');
    console.log('✅ APK 构建成功！');
    console.log('   产物:', buildOutput);
    console.log('   大小:', sizeMB, 'MB');
    if (!noCopy) {
      const dest = join(wwwDir, outputName);
      copyFileSync(buildOutput, dest);
      console.log('   已复制到:', dest);
    } else {
      console.log('   (--no-copy: 未复制到 www/)');
    }
  } else {
    console.log('');
    console.log('✅ AAB 构建成功！');
    console.log('   产物:', buildOutput);
    console.log('   大小:', sizeMB, 'MB');
    console.log('   上传至 Google Play Console → 生产轨道 → 创建新版本');
  }

  // 体积检查
  if (parseFloat(sizeMB) > 20) {
    console.warn('⚠️  警告: 产物体积 ' + sizeMB + 'MB 超过 20MB 目标');
  } else {
    console.log('   体积合规 (< 20MB) ✓');
  }
} else {
  console.error('❌ 未找到构建产物:', buildOutput);
  process.exit(1);
}
