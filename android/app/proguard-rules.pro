# ============================================================
# 生活习惯小助手 ProGuard / R8 规则
# ============================================================

# --- 保留调试堆栈信息 ---
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# --- WebView JS Interface（Capacitor WebView 桥接）---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepclassmembers class com.getcapacitor.** { *; }

# --- Capacitor 插件保留（反射注册）---
-keep class com.rui66648.lifestyle.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep class * extends com.getcapacitor.Plugin { *; }

# --- Capacitor Bridge 核心类 ---
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# --- AndroidX 保留 ---
-keep class androidx.** { *; }
-dontwarn androidx.**

# --- Cordova 插件兼容层 ---
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# --- 保留 WebView 相关 ---
-keepclassmembers class * extends android.webkit.WebView {
    public *;
}

# --- 保留 BuildConfig（供 JS 读取版本号）---
-keep class com.rui66648.lifestyle.BuildConfig { *; }
