package io.github.vpn86156.kosmopilot;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.DisplayCutout;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;
import java.util.Locale;

/** Offline game host: only bundled assets can be loaded, with no JavaScript bridge. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private WebView browser;
    private boolean exitDialogVisible;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.rgb(8, 12, 35));
        getWindow().setNavigationBarColor(Color.rgb(8, 12, 35));
        immersive();

        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(8, 12, 35));
        browser.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        browser.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                        && path != null && path.startsWith("/assets/") && "GET".equals(request.getMethod())) {
                    String asset = path.substring(8);
                    if (!asset.contains("..") && !asset.contains("\\") && !asset.startsWith("/")) {
                        try {
                            String encoding = asset.endsWith(".html") || asset.endsWith(".js") || asset.endsWith(".css") ? "UTF-8" : null;
                            return new WebResourceResponse(mime(asset), encoding, 200, "OK",
                                    Collections.singletonMap("X-Content-Type-Options", "nosniff"), getAssets().open(asset));
                        } catch (IOException ignored) { return empty(404, "Not Found"); }
                    }
                }
                return empty(403, "Blocked");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOME.equals(request.getUrl().toString());
            }
        });
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 12, 35));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                if (Build.VERSION.SDK_INT >= 28) {
                    DisplayCutout cutout = insets.getDisplayCutout();
                    if (cutout != null) {
                        view.setPadding(cutout.getSafeInsetLeft(), cutout.getSafeInsetTop(),
                                cutout.getSafeInsetRight(), cutout.getSafeInsetBottom());
                        return insets.consumeDisplayCutout();
                    }
                }
                view.setPadding(0, 0, 0, 0);
                return insets;
            }
        });
        root.addView(browser, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.requestApplyInsets();
        browser.loadUrl(HOME);
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }
    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }
    private static String mime(String name) {
        String p = name.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }
    private static WebResourceResponse empty(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
                Collections.<String, String>emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    @Override public void onBackPressed() {
        if (browser == null) { super.onBackPressed(); return; }
        browser.evaluateJavascript("Boolean(window.__cosmoBack && window.__cosmoBack())", new ValueCallback<String>() {
            @Override public void onReceiveValue(String handled) {
                if (!"true".equals(handled) && !isFinishing() && !exitDialogVisible) {
                    exitDialogVisible = true;
                    new AlertDialog.Builder(MainActivity.this)
                            .setTitle("Закрыть игру?")
                            .setMessage("Рекорд останется на этом устройстве.")
                            .setNegativeButton("Остаться", null)
                            .setPositiveButton("Выйти", new DialogInterface.OnClickListener() {
                                @Override public void onClick(DialogInterface dialog, int which) { finish(); }
                            })
                            .setOnDismissListener(new DialogInterface.OnDismissListener() {
                                @Override public void onDismiss(DialogInterface dialog) { exitDialogVisible = false; }
                            })
                            .show();
                }
            }
        });
    }
    @Override protected void onPause() {
        if (browser != null) {
            browser.evaluateJavascript("window.dispatchEvent(new Event('cosmopilot:background'))", null);
            browser.onPause();
            browser.pauseTimers();
        }
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (browser != null) {
            browser.resumeTimers();
            browser.onResume();
            // Reassert the pause when returning, even if the outgoing event was interrupted.
            browser.evaluateJavascript("window.dispatchEvent(new Event('cosmopilot:background'))", null);
        }
    }
    @Override protected void onDestroy() {
        if (browser != null) {
            if (browser.getParent() instanceof FrameLayout) ((FrameLayout) browser.getParent()).removeView(browser);
            browser.destroy(); browser = null;
        }
        super.onDestroy();
    }
}
