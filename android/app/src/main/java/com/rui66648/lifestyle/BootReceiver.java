package com.rui66648.lifestyle;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

/**
 * 开机自启动接收器
 * 设备重启后自动恢复屏幕监听服务（仅在用户已启用时）
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            Log.i(TAG, "收到开机完成广播");

            // 检查是否已启用自动打卡（通过 SharedPreferences）
            boolean enabled = context.getSharedPreferences(
                    "auto_checkin_prefs", Context.MODE_PRIVATE
            ).getBoolean("enabled", false);

            if (enabled) {
                Log.i(TAG, "自动打卡已启用，启动监听服务");
                Intent serviceIntent = new Intent(context, ScreenWatcherService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } else {
                Log.i(TAG, "自动打卡未启用，跳过服务启动");
            }
        }
    }
}
