package br.com.zapencomendas.mobile;

import android.webkit.JavascriptInterface;

public final class NativeBridge {
    private final MainActivity activity;

    public NativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNativeApp() { return true; }

    @JavascriptInterface
    public String getAppProfile() { return BuildConfig.APPLICATION_ID.endsWith("motorista") ? "motorista" : "transportadora"; }

    @JavascriptInterface
    public void requestLocation() { activity.requestLocationFromWeb(); }

    @JavascriptInterface
    public void stopLocation() { activity.stopLocationFromWeb(); }

    @JavascriptInterface
    public boolean isLocationRunning() { return LocationService.running; }

    @JavascriptInterface
    public double getLatitude() { return LocationService.latitude; }

    @JavascriptInterface
    public double getLongitude() { return LocationService.longitude; }

    @JavascriptInterface
    public float getAccuracy() { return LocationService.accuracy; }

    @JavascriptInterface
    public long getLocationUpdatedAt() { return LocationService.updatedAt; }

    @JavascriptInterface
    public void showNotification(String title, String message) { activity.showLocalNotification(title, message); }

    @JavascriptInterface
    public void openCall(String phone) { activity.openDialer(phone); }

    @JavascriptInterface
    public void pickContact() { activity.openContactPicker(); }

    @JavascriptInterface
    public void openWhatsApp(String phone, String message) { activity.openWhatsApp(phone, message); }
}
