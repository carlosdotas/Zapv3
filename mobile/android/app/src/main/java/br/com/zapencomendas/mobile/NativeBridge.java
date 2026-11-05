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
    public String getAppProfile() { return "motorista".equals(BuildConfig.FLAVOR) ? "motorista" : "transportadora"; }

    @JavascriptInterface
    public void requestLocation() { activity.runOnUiThread(activity::requestLocationFromWeb); }

    @JavascriptInterface
    public void stopLocation() { activity.runOnUiThread(activity::stopLocationFromWeb); }

    @JavascriptInterface
    public void startDuty(String token) { activity.runOnUiThread(() -> activity.startDutyFromWeb(token)); }

    @JavascriptInterface
    public void stopDuty() { activity.runOnUiThread(activity::stopDutyFromWeb); }

    @JavascriptInterface
    public boolean isDutyRunning() { return LocationService.running; }

    @JavascriptInterface
    public boolean isDutyConnected() { return LocationService.dutyConnected; }

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
    public void showNotification(String title, String message) { activity.runOnUiThread(() -> activity.showLocalNotification(title, message)); }

    @JavascriptInterface
    public void openCall(String phone) { activity.runOnUiThread(() -> activity.openDialer(phone)); }

    @JavascriptInterface
    public void pickContact() { activity.runOnUiThread(activity::openContactPicker); }

    @JavascriptInterface
    public void openWhatsApp(String phone, String message) { activity.runOnUiThread(() -> activity.openWhatsApp(phone, message)); }
}
