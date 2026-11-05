package br.com.zapencomendas.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.ContactsContract;
import android.view.Window;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final int LOCATION_PERMISSION_CODE = 4101;
    private static final int BACKGROUND_LOCATION_CODE = 4102;
    private static final int NOTIFICATION_PERMISSION_CODE = 4103;
    private static final int CONTACT_PICKER_CODE = 4104;
    private static final int CONTACT_PERMISSION_CODE = 4105;
    private static final String ALERT_CHANNEL_ID = "zap_alerts";

    private WebView webView;
    private boolean startLocationAfterPermission = false;
    private long lastBackPressedAt = 0L;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        configureWebView();
        requestNotificationPermission();
        loadRemoteApplication();
    }

    private void configureSystemBars() {
        Window window = getWindow();
        window.setStatusBarColor(android.graphics.Color.rgb(0, 43, 73));
        window.setNavigationBarColor(android.graphics.Color.rgb(0, 43, 73));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            window.getDecorView().setSystemUiVisibility(0);
        }
    }

    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(android.graphics.Color.rgb(0, 20, 36));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUserAgentString(settings.getUserAgentString() + " EncomendasZapMobile/0.1");
        webView.addJavascriptInterface(new NativeBridge(this), "AndroidApp");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(Uri.parse(url));
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectMobileHelpers(view);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                boolean allowed = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                    || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
                callback.invoke(origin, allowed, false);
            }
        });
        setContentView(webView);
    }

    private void loadRemoteApplication() {
        webView.loadUrl(BuildConfig.WEB_URL);
    }

    private boolean handleExternalUrl(Uri uri) {
        if (uri == null || uri.getScheme() == null) return false;
        String scheme = uri.getScheme().toLowerCase();
        if ("tel".equals(scheme)) {
            openDialer(uri.getSchemeSpecificPart());
            return true;
        }
        if ("whatsapp".equals(scheme) || "mailto".equals(scheme)) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
            return true;
        }
        return false;
    }

    private void injectMobileHelpers(WebView view) {
        view.evaluateJavascript("(function(){window.ZapMobile=window.ZapMobile||{};window.ZapMobile.isNative=true;})();", null);
    }

    public void requestLocationFromWeb() {
        boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        if (!granted) {
            startLocationAfterPermission = true;
            requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_PERMISSION_CODE);
            return;
        }
        startLocationService();
        showToast("Localização ativada para a entrega.");
    }

    public void stopLocationFromWeb() {
        stopService(new Intent(this, LocationService.class));
        showToast("Localização pausada.");
    }

    private void startLocationService() {
        Intent serviceIntent = new Intent(this, LocationService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(serviceIntent);
        else startService(serviceIntent);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.ACCESS_BACKGROUND_LOCATION}, BACKGROUND_LOCATION_CODE);
        }
    }

    public void showLocalNotification(String title, String message) {
        createAlertChannel();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 4201, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification notification = new Notification.Builder(this, ALERT_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(title == null || title.isBlank() ? "EncomendasZap" : title)
            .setContentText(message == null ? "" : message)
            .setAutoCancel(true)
            .setPriority(Notification.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .build();
        manager.notify((int) (System.currentTimeMillis() & 0x7fffffff), notification);
    }

    private void createAlertChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(ALERT_CHANNEL_ID, getString(R.string.alert_channel_name), NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(getString(R.string.alert_channel_description));
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    public void openDialer(String phone) {
        if (phone == null) return;
        String clean = phone.replaceAll("[^+0-9]", "");
        if (clean.isBlank()) return;
        try { startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + clean))); }
        catch (Exception ignored) { showToast("Não foi possível abrir o telefone."); }
    }

    public void openWhatsApp(String phone, String message) {
        String clean = phone == null ? "" : phone.replaceAll("[^0-9]", "");
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/" + clean + "?text=" + Uri.encode(message == null ? "" : message)))); }
        catch (Exception ignored) { showToast("Não foi possível abrir o WhatsApp."); }
    }

    public void openContactPicker() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            && checkSelfPermission(Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_CONTACTS}, CONTACT_PERMISSION_CODE);
            return;
        }
        launchContactPicker();
    }

    private void launchContactPicker() {
        try {
            startActivityForResult(new Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI), CONTACT_PICKER_CODE);
        } catch (Exception ignored) { showToast("A agenda de contatos não está disponível."); }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != CONTACT_PICKER_CODE || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri contactUri = data.getData();
        String[] projection = { ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER };
        try (Cursor cursor = getContentResolver().query(contactUri, projection, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME));
                String phone = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER));
                dispatchContact(name, phone);
            }
        } catch (Exception ignored) {}
    }

    private void dispatchContact(String name, String phone) {
        if (webView == null) return;
        String json = "{name:" + JSONObject.quote(name) + ",phone:" + JSONObject.quote(phone) + "}";
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('zapContactSelected',{detail:" + json + "}));", null);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_CODE && startLocationAfterPermission
            && (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED)) {
            startLocationAfterPermission = false;
            startLocationService();
            showToast("Localização ativada para a entrega.");
        }
        if (requestCode == CONTACT_PERMISSION_CODE
            && checkSelfPermission(Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED) {
            launchContactPicker();
        }
    }

    private void showToast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) { webView.goBack(); return; }
        long now = System.currentTimeMillis();
        if (now - lastBackPressedAt < 2000) { super.onBackPressed(); return; }
        lastBackPressedAt = now;
        showToast("Pressione voltar novamente para sair.");
    }

    @Override
    protected void onDestroy() {
        if (webView != null) { webView.stopLoading(); webView.destroy(); }
        super.onDestroy();
    }
}
