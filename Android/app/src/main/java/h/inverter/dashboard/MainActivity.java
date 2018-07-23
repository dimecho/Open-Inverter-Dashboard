package h.inverter.dashboard;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.support.v7.appcompat.R;

public class MainActivity extends Activity{

    WebView mWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        mWebView = (WebView)findViewById(R.id.mWebView);
        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);

        mWebView.loadUrl("http://192.168.1.101:8081");
        
        /*
        String customHtml = "<html><body></body></html>";
        webView.loadData(customHtml, "text/html", "UTF-8");
        */

        mWebView.setWebViewClient(new WebViewClient());
    }
}