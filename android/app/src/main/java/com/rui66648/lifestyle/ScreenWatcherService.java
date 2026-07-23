package com.rui66648.lifestyle;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

/**
 * 屏幕监听前台服务
 * 保持后台运行，接收屏幕亮屏/关屏/解锁广播
 * 通过 Capacitor 插件回调通知 JS 层
 */
public class ScreenWatcherService extends Service {

    private static final String TAG = "ScreenWatcherService";
    private static final String CHANNEL_ID = "screen_watcher_channel";
    private static final int NOTIFICATION_ID = 1001;

    private ScreenReceiver screenReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "屏幕监听服务启动");

        // 启动前台通知（保活）
        Notification notification = buildForegroundNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        // 注册屏幕广播接收器
        if (screenReceiver == null) {
            screenReceiver = new ScreenReceiver();
        }
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_ON);
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_USER_PRESENT);
        registerReceiver(screenReceiver, filter);

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "屏幕监听服务停止");
        if (screenReceiver != null) {
            try {
                unregisterReceiver(screenReceiver);
            } catch (IllegalArgumentException e) {
                Log.w(TAG, "接收器未注册，跳过注销");
            }
            screenReceiver = null;
        }
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "自动打卡服务",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("监听屏幕开关状态以自动打卡");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        builder.setContentTitle("PulseBreath 运行中")
               .setContentText("自动打卡服务已启用")
               .setSmallIcon(R.drawable.ic_stat_notify)
               .setOngoing(true)
               .setPriority(Notification.PRIORITY_LOW);

        return builder.build();
    }
}
