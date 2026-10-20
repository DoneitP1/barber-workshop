package com.barberworkshop.app;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.graphics.Color;
import androidx.webkit.WebViewAssetLoader;
import android.widget.FrameLayout;
public class MainActivity extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.rgb(247,245,255));
    getWindow().setNavigationBarColor(Color.rgb(247,245,255));
    getWindow().getDecorView().setSystemUiVisibility(0x00002000 | 0x00000010);
    WebView web = new WebView(this);
    web.setBackgroundColor(Color.rgb(247,245,255));
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setAllowFileAccess(false);
    // Local development backend is HTTP on the Android emulator host gateway.
    web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    WebViewAssetLoader loader = new WebViewAssetLoader.Builder().addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
    web.setWebViewClient(new WebViewClient() { @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView v, android.webkit.WebResourceRequest r) { return loader.shouldInterceptRequest(r.getUrl()); } });
    web.setWebChromeClient(new WebChromeClient());
    FrameLayout content = new FrameLayout(this);
    content.setBackgroundColor(Color.rgb(247,245,255));
    content.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    content.setOnApplyWindowInsetsListener((view, insets) -> {
      view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
          insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
      return insets.consumeSystemWindowInsets();
    });
    setContentView(content);
    web.loadUrl("https://appassets.androidplatform.net/assets/index.html");
  }
}
