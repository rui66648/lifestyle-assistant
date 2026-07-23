package com.rui66648.lifestyle;

import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.core.os.HandlerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private long lastBackPressTime = 0L;
    private static final long EXIT_INTERVAL = 2000L;
    private Toast exitToast = null;
    private boolean isHomePage = true;
    private final Handler handler = HandlerCompat.createAsync(Looper.getMainLooper());

    @Override
    public void onStart() {
        registerPlugin(NotificationSettingsPlugin.class);
        registerPlugin(ScreenWatcherPlugin.class);
        super.onStart();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setTextZoom(100);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
        }

        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBackNavigation();
            }
        });
    }

    private void handleBackNavigation() {
        checkHasPanel(new HasPanelCallback() {
            @Override
            public void onResult(boolean hasPanel) {
                if (hasPanel) {
                    getBridge().getWebView().evaluateJavascript(
                        "typeof closeAllPanels === 'function' && closeAllPanels()",
                        null
                    );
                } else {
                    checkIsHomePage(new HomePageCallback() {
                        @Override
                        public void onResult(boolean home) {
                            isHomePage = home;
                            if (!isHomePage) {
                                getBridge().getWebView().goBack();
                            } else {
                                long currentTime = System.currentTimeMillis();
                                if (currentTime - lastBackPressTime < EXIT_INTERVAL) {
                                    if (exitToast != null) {
                                        exitToast.cancel();
                                        exitToast = null;
                                    }
                                    finishAffinity();
                                } else {
                                    lastBackPressTime = currentTime;
                                    showExitHint();
                                }
                            }
                        }
                    });
                }
            }
        });
    }

    private void checkHasPanel(final HasPanelCallback callback) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "typeof hasOpenPanel === 'function' && hasOpenPanel() || false",
                        new android.webkit.ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                boolean result = false;
                                if (value != null && value.equalsIgnoreCase("true")) {
                                    result = true;
                                }
                                callback.onResult(result);
                            }
                        }
                    );
                } else {
                    callback.onResult(false);
                }
            }
        });
    }

    private void checkIsHomePage(final HomePageCallback callback) {
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "typeof isOnHomePage === 'function' && isOnHomePage() || true",
                        new android.webkit.ValueCallback<String>() {
                            @Override
                            public void onReceiveValue(String value) {
                                boolean result = true;
                                if (value != null && value.equalsIgnoreCase("false")) {
                                    result = false;
                                }
                                callback.onResult(result);
                            }
                        }
                    );
                } else {
                    callback.onResult(true);
                }
            }
        });
    }

    private void showExitHint() {
        if (exitToast != null) {
            exitToast.cancel();
        }

        View toastView = LayoutInflater.from(this).inflate(R.layout.toast_exit, null);
        exitToast = new Toast(this);
        exitToast.setView(toastView);
        exitToast.setGravity(Gravity.CENTER, 0, 0);
        exitToast.setDuration(Toast.LENGTH_SHORT);
        exitToast.show();

        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (exitToast != null) {
                    exitToast.cancel();
                    exitToast = null;
                }
            }
        }, EXIT_INTERVAL);
    }

    private interface HomePageCallback {
        void onResult(boolean isHome);
    }

    private interface HasPanelCallback {
        void onResult(boolean hasPanel);
    }
}