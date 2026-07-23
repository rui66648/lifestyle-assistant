package com.rui66648.lifestyle;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import androidx.core.content.ContextCompat;

/**
 * Capacitor 插件：屏幕监听
 * JS 端通过 ScreenWatcher.start() / stop() / isRunning() 控制
 * 事件通过 'screenWatcherEvent' 回调到 JS 层
 */
@CapacitorPlugin(
    name = "ScreenWatcher",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class ScreenWatcherPlugin extends Plugin {

    private static final String TAG = "ScreenWatcherPlugin";
    private static final String PREFS_NAME = "auto_checkin_prefs";

    private static Bridge staticBridge = null;

    /**
     * 获取 Bridge 实例（供 ScreenReceiver 使用）
     */
    public static Bridge getBridgeInstance() {
        return staticBridge;
    }

    @Override
    public void load() {
        super.load();
        staticBridge = getBridge();
    }

    /**
     * 启动屏幕监听服务
     */
    @PluginMethod
    public void start(PluginCall call) {
        // 检查通知权限（Android 13+）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("notifications", call, "onPermissionResult");
                return;
            }
        }

        startWatcherService();
        saveEnabled(true);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("running", true);
        call.resolve(ret);
    }

    /**
     * 停止屏幕监听服务
     */
    @PluginMethod
    public void stop(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), ScreenWatcherService.class);
        getContext().stopService(serviceIntent);
        saveEnabled(false);

        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("running", false);
        call.resolve(ret);
    }

    /**
     * 查询服务运行状态
     */
    @PluginMethod
    public void isRunning(PluginCall call) {
        boolean enabled = getPrefs().getBoolean("enabled", false);
        JSObject ret = new JSObject();
        ret.put("running", enabled);
        call.resolve(ret);
    }

    /**
     * 请求忽略电池优化（引导用户授权）
     */
    @PluginMethod
    public void requestIgnoreBatteryOptimization(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
            try {
                Intent intent = new Intent();
                intent.setAction(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception e) {
                Log.e(TAG, "无法请求电池优化白名单", e);
                call.reject("无法打开电池优化设置: " + e.getMessage());
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("alreadyIgnored", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(ret);
    }

    /**
     * 检查电池优化状态
     */
    @PluginMethod
    public void isBatteryOptimizationIgnored(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignored = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("ignored", ignored);
        call.resolve(ret);
    }

    // ---- 内部方法 ----

    private void startWatcherService() {
        Intent serviceIntent = new Intent(getContext(), ScreenWatcherService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
    }

    @PermissionCallback
    private void onPermissionResult(PluginCall call) {
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            startWatcherService();
            saveEnabled(true);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("running", true);
            call.resolve(ret);
        } else {
            JSObject ret = new JSObject();
            ret.put("ok", false);
            ret.put("running", false);
            ret.put("error", "通知权限被拒绝，前台服务需要通知权限");
            call.resolve(ret);
        }
    }

    private void saveEnabled(boolean enabled) {
        getPrefs().edit().putBoolean("enabled", enabled).apply();
    }

    private SharedPreferences getPrefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
