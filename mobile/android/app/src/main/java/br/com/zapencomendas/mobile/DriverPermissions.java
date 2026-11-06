package br.com.zapencomendas.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;
import java.util.function.BooleanSupplier;

/** Permission wizard started only by the visible Entrar em serviço action. */
final class DriverPermissions {
    private static final int NOTIFICATIONS = 4401, LOCATION = 4402, SETTINGS = 4403, BACKGROUND_LOCATION = 4404;
    private final Activity activity;
    private Runnable ready;
    private boolean waiting;
    private BooleanSupplier settingsGranted;
    private AlertDialog dialog;
    private boolean resumed;

    DriverPermissions(Activity activity) { this.activity = activity; }
    void start(Runnable action) {
        if (ready != null) return;
        ready = action;
        waiting = false;
        resume();
    }
    void onResume() { resumed = true; resume(); }
    void onPause() { resumed = false; }
    private void resume() { activity.getWindow().getDecorView().post(this::advance); }
    void cancel() { ready = null; waiting = false; if (dialog != null) dialog.dismiss(); }
    private boolean granted(String permission) { return activity.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    private boolean gps() {
        LocationManager manager = activity.getSystemService(LocationManager.class);
        return manager != null && manager.isProviderEnabled(LocationManager.GPS_PROVIDER);
    }
    private boolean precise() { return granted(Manifest.permission.ACCESS_FINE_LOCATION); }
    private boolean backgroundLocation() { return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || granted(Manifest.permission.ACCESS_BACKGROUND_LOCATION); }
    private void denied() { cancel(); Toast.makeText(activity, "Serviço não ativado. Autorize as permissões solicitadas e tente novamente.", Toast.LENGTH_LONG).show(); }

    void advance() {
        if (ready == null || waiting || !resumed || activity.isFinishing()) return;
        if (!precise()) {
            request(Manifest.permission.ACCESS_FINE_LOCATION, LOCATION, "driver_location_requested", "Permita a localização precisa para entrar em serviço."); return;
        }
        if (!backgroundLocation()) {
            request(Manifest.permission.ACCESS_BACKGROUND_LOCATION, BACKGROUND_LOCATION, "driver_background_location_requested", "Para receber coletas enquanto estiver em serviço, abra Permissões > Localização e selecione ‘Permitir o tempo todo’. A localização para ao sair de serviço.");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
            request(Manifest.permission.POST_NOTIFICATIONS, NOTIFICATIONS, "notifications_requested", "Permita as notificações para receber chamadas."); return;
        }
        if (!gps()) { settings("Ative o GPS do aparelho para compartilhar sua localização durante o serviço.",
            new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS), this::gps); return; }
        NotificationManager manager = activity.getSystemService(NotificationManager.class);
        if (manager == null) { denied(); return; }
        if (!manager.areNotificationsEnabled()) {
            settings("Ative as notificações do aplicativo para receber chamadas.", new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName()), manager::areNotificationsEnabled); return;
        }
        DutyConnection.ensureCallChannel(activity);
        if (manager.getNotificationChannel(DutyConnection.CHANNEL).getImportance() < NotificationManager.IMPORTANCE_HIGH) {
            settings("Defina as chamadas de coleta como notificações de alta importância e permita a exibição na tela.",
                new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName())
                    .putExtra(Settings.EXTRA_CHANNEL_ID, DutyConnection.CHANNEL),
                () -> manager.getNotificationChannel(DutyConnection.CHANNEL).getImportance() >= NotificationManager.IMPORTANCE_HIGH); return;
        }
        if (Build.VERSION.SDK_INT >= 34 && !manager.canUseFullScreenIntent()) {
            settings("Permita chamadas em tela cheia para exibir a coleta sobre a tela bloqueada.",
                new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + activity.getPackageName())), manager::canUseFullScreenIntent); return;
        }
        Runnable action = ready; ready = null; action.run();
    }

    private void request(String permission, int code, String key, String explanation) {
        boolean asked = activity.getPreferences(Activity.MODE_PRIVATE).getBoolean(key, false);
        if (code == LOCATION) asked |= activity.getPreferences(Activity.MODE_PRIVATE).getBoolean("driver_location_prompt_shown", false);
        if (asked && !activity.shouldShowRequestPermissionRationale(permission)) {
            settings(explanation, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + activity.getPackageName())), () -> granted(permission)); return;
        }
        if (code == BACKGROUND_LOCATION && activity.shouldShowRequestPermissionRationale(permission)) {
            waiting = true;
            dialog = new AlertDialog.Builder(activity).setTitle("Localização durante o serviço")
                .setMessage(explanation)
                .setPositiveButton("Continuar", (d,w) -> {
                    activity.getPreferences(Activity.MODE_PRIVATE).edit().putBoolean(key, true).apply();
                    activity.requestPermissions(new String[]{permission}, code);
                }).setNegativeButton("Agora não", (d,w) -> denied()).setOnCancelListener(d -> denied()).show();
            return;
        }
        waiting = true;
        activity.getPreferences(Activity.MODE_PRIVATE).edit().putBoolean(key, true).apply();
        activity.requestPermissions(code == LOCATION ? new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}
            : new String[]{permission}, code);
    }

    private void settings(String message, Intent intent, BooleanSupplier granted) {
        waiting = true; settingsGranted = granted;
        dialog = new AlertDialog.Builder(activity).setTitle("Permissões para entrar em serviço").setMessage(message)
            .setNegativeButton("Agora não", (d,w) -> denied()).setOnCancelListener(d -> denied())
            .setPositiveButton("Abrir configurações", (d,w) -> {
                try { activity.startActivityForResult(intent, SETTINGS); } catch (Exception ignored) { denied(); }
            }).show();
    }

    boolean permissionResult(int code) {
        if (code != NOTIFICATIONS && code != LOCATION && code != BACKGROUND_LOCATION) return false;
        waiting = false;
        if (ready != null) { if (code == LOCATION ? precise() : code == BACKGROUND_LOCATION ? backgroundLocation() : granted(Manifest.permission.POST_NOTIFICATIONS)) resume(); else denied(); }
        return true;
    }
    boolean settingsResult(int code) {
        if (code != SETTINGS) return false;
        waiting = false;
        if (ready != null) { if (settingsGranted != null && settingsGranted.getAsBoolean()) resume(); else denied(); }
        return true;
    }
}
