package com.rui66648.lifestyle;

import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setTextZoom(100);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
        }
    }
}
