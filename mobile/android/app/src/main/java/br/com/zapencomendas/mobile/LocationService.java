package br.com.zapencomendas.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import android.os.Looper;

public class LocationService extends Service implements LocationListener {
    private static final String CHANNEL_ID = "zap_location";
    private static final int NOTIFICATION_ID = 8101;

    public static volatile double latitude = 0.0;
    public static volatile double longitude = 0.0;
    public static volatile float accuracy = 0.0f;
    public static volatile long updatedAt = 0L;
    public static volatile boolean running = false;

    private DutyConnection connection;
    private LocationManager locationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        createChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        startLocationUpdates();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.location_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.location_channel_description));
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 8102, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        return new Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("EncomendasZap")
            .setContentText("Localização ativa durante a entrega.")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .build();
    }

    private void startLocationUpdates() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf();
            return;
        }
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;
        try {
            if (locationManager.getAllProviders().contains(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 10000L, 10f, this, Looper.getMainLooper());
            }
            if (locationManager.getAllProviders().contains(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 30000L, 25f, this, Looper.getMainLooper());
            }
        } catch (SecurityException ignored) {
            stopSelf();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "stop".equals(intent.getAction())) {
            if (locationManager != null) locationManager.removeUpdates(this);
            if (connection != null) connection.stopDuty(); else stopSelf();
            return START_NOT_STICKY;
        }
        if (intent != null && "respond".equals(intent.getAction())) {
            if (connection != null) connection.respond(intent.getStringExtra("id"), intent.getStringExtra("answer"));
            return START_NOT_STICKY;
        }
        String token = intent == null ? null : intent.getStringExtra("token");
        if (token == null) { stopSelf(); return START_NOT_STICKY; }
        if (connection != null) connection.close();
        connection = new DutyConnection(this, token);
        return START_NOT_STICKY;
    }

    @Override
    public void onLocationChanged(Location location) {
        latitude = location.getLatitude();
        longitude = location.getLongitude();
        accuracy = location.hasAccuracy() ? location.getAccuracy() : 0.0f;
        updatedAt = location.getTime();
        if (connection != null) connection.location(location);
    }

    @Override
    public void onProviderEnabled(String provider) {}
    @Override
    public void onProviderDisabled(String provider) {}
    @Override
    public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}

    @Override
    public void onDestroy() {
        if (connection != null) connection.close();
        if (locationManager != null) locationManager.removeUpdates(this);
        running = false;
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
