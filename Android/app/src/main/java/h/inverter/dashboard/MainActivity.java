package h.inverter.dashboard;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
//import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.support.v7.appcompat.R;

public class MainActivity extends Activity{

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        WebView mWebView = (WebView)findViewById(R.id.mWebView);
        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        mWebView.loadUrl("http://192.168.4.1:8080");
        //mWebView.loadUrl("file:///android_asset/index.html");
        //mWebView.setWebViewClient(new WebViewClient());
    }
}