package com.rui66648.lifestyle;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.Bridge;
import com.getcapacitor.JSObject;

/**
 * 屏幕状态广播接收器
 * 捕获 SCREEN_ON / SCREEN_OFF / USER_PRESENT 事件
 * 通过 Capacitor Bridge 通知 JS 层
 */
public class ScreenReceiver extends BroadcastReceiver {

    private static final String TAG = "ScreenReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        Log.d(TAG, "收到广播: " + action);

        // 获取 Capacitor Bridge 实例
        Bridge bridge = ScreenWatcherPlugin.getBridgeInstance();
        if (bridge == null) {
            Log.w(TAG, "Bridge 为空，无法通知 JS 层");
            return;
        }

        String eventType = null;
        switch (action) {
            case Intent.ACTION_USER_PRESENT:
                eventType = "screenOn";
                break;
            case Intent.ACTION_SCREEN_OFF:
                eventType = "screenOff";
                break;
            case Intent.ACTION_SCREEN_ON:
                // SCREEN_ON 不含解锁信息，仅 USER_PRESENT 才代表用户主动解锁
                // 但部分场景下需要知道亮屏事件，也通知 JS 层
                eventType = "screenOn";
                break;
            default:
                return;
        }

        // 通知 JS 层
        JSObject ret = new JSObject();
        ret.put("type", eventType);
        ret.put("timestamp", System.currentTimeMillis());
        bridge.triggerJSEvent("screenWatcherEvent", ret.toString());
    }
}
