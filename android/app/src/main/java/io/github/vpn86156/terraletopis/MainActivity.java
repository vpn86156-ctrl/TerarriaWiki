package io.github.vpn86156.terraletopis;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
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

/** Small offline Android host. No remote page, JavaScript bridge or network permission. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private WebView browser;
    private boolean exitDialogVisible;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 30) getWindow().setDecorFitsSystemWindows(false);
        else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(17, 25, 30));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
            }
        });
        setContentView(root);
        browser = new WebView(this);
        browser.setBackgroundColor(Color.rgb(16, 21, 25));
        WebSettings settings = browser.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setBuiltInZoomControls(false);
        settings.setTextZoom(100);
        // Asset URLs use a synthetic HTTPS origin, intercepted before any network operation.
        browser.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                        && path != null && path.startsWith("/assets/") && "GET".equals(request.getMethod())) {
                    String asset = path.substring(8);
                    if (!asset.contains("..") && !asset.contains("\\") && !asset.startsWith("/")) {
                        try {
                            String encoding = asset.endsWith(".html") || asset.endsWith(".md") ? "UTF-8" : null;
                            return new WebResourceResponse(mime(asset), encoding, 200, "OK",
                                Collections.singletonMap("X-Content-Type-Options", "nosniff"), getAssets().open(asset));
                        } catch (IOException ignored) { return empty(404, "Not Found"); }
                    }
                }
                return empty(403, "Blocked");
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                        && "/assets/index.html".equals(uri.getPath())) return false;
                if (request.hasGesture()) openReference(uri);
                return true;
            }
        });
        browser.setWebChromeClient(new WebChromeClient());
        root.addView(browser, new FrameLayout.LayoutParams(-1, -1));
        browser.loadUrl(HOME);
        root.requestApplyInsets();
    }

    private static String mime(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".md") || p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }
    private static WebResourceResponse empty(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
            Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
    private void openReference(final Uri uri) {
        String host = uri.getHost();
        if (!"https".equals(uri.getScheme()) || host == null ||
                !(host.equals("terraria.wiki.gg") || host.equals("github.com"))) return;
        new AlertDialog.Builder(MainActivity.this).setTitle("Открыть источник?")
            .setMessage("Ссылка откроется во внешнем браузере и потребует интернета.\n\n" + uri)
            .setNegativeButton("Остаться", null).setPositiveButton("Открыть", new android.content.DialogInterface.OnClickListener() {
                @Override public void onClick(android.content.DialogInterface dialog, int which) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
                catch (android.content.ActivityNotFoundException ignored) {
                    new AlertDialog.Builder(MainActivity.this).setMessage("Не найден браузер для открытия ссылки.")
                        .setPositiveButton("Понятно", null).show();
                }
            } }).show();
    }
    @Override public void onBackPressed() {
        if (browser == null) { super.onBackPressed(); return; }
        browser.evaluateJavascript("Boolean(window.__terraAndroidBack && window.__terraAndroidBack())", new android.webkit.ValueCallback<String>() { @Override public void onReceiveValue(String value) {
            if (!"true".equals(value) && !isFinishing() && !exitDialogVisible) {
                exitDialogVisible = true;
                new AlertDialog.Builder(MainActivity.this).setTitle("Закрыть летопись?")
                    .setMessage("Прогресс и записи останутся на этом устройстве.")
                    .setNegativeButton("Остаться", null).setPositiveButton("Выйти", new android.content.DialogInterface.OnClickListener(){ @Override public void onClick(android.content.DialogInterface dialog,int which){finish();}})
                    .setOnDismissListener(new android.content.DialogInterface.OnDismissListener(){@Override public void onDismiss(android.content.DialogInterface dialog){exitDialogVisible=false;}}).show();
            }
        } });
    }
    @Override protected void onPause() { if (browser != null) browser.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (browser != null) browser.onResume(); }
    @Override protected void onDestroy() {
        if (browser != null) { ((FrameLayout) browser.getParent()).removeView(browser); browser.destroy(); browser = null; }
        super.onDestroy();
    }
}
