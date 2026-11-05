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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URI;
import java.time.Instant;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.client.Ack;

public class LocationService extends Service implements LocationListener {
    public static final String ACTION_START = "br.com.zapencomendas.mobile.START_DUTY";
    public static final String ACTION_STOP = "br.com.zapencomendas.mobile.STOP_DUTY";
    private static final String ACTION_RESPOND = "br.com.zapencomendas.mobile.RESPOND_CALL";
    public static final String EXTRA_TOKEN = "session_token";
    private static final String CHANNEL_ID = "zap_location";
    private static final String CALL_CHANNEL_ID = "zap_pickup_calls";
    private static final int SERVICE_NOTIFICATION_ID = 8101;
    public static volatile double latitude = 0.0;
    public static volatile double longitude = 0.0;
    public static volatile float accuracy = 0.0f;
    public static volatile long updatedAt = 0L;
    public static volatile boolean running = false;
    public static volatile boolean dutyConnected = false;

    private LocationManager locationManager;
    private Socket socket;
    private volatile Location latestLocation;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override public void onCreate() {
        super.onCreate();
        createChannels();
        startForeground(SERVICE_NOTIFICATION_ID, serviceNotification());
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_START.equals(action)) {
            handler.removeCallbacksAndMessages(null);
            String token = intent.getStringExtra(EXTRA_TOKEN);
            if (token == null || token.isBlank()) { stopSelf(); return START_NOT_STICKY; }
            running = true;
            if (locationManager == null) startLocationUpdates();
            connect(token);
        } else if (ACTION_STOP.equals(action)) {
            running = false;
            dutyConnected = false;
            if (locationManager != null) locationManager.removeUpdates(this);
            if (socket != null && socket.connected()) {
                socket.emit("duty:set", false, (Ack) args -> handler.post(this::stopSelf));
                handler.postDelayed(this::stopSelf, 2000);
            } else stopSelf();
        } else if (ACTION_RESPOND.equals(action)) {
            if (socket == null) { stopSelf(); return START_NOT_STICKY; }
            respond(intent.getStringExtra("call_id"), intent.getStringExtra("answer"));
        } else if (intent != null && action == null) {
            running = true;
            if (locationManager == null) startLocationUpdates();
        }
        return START_NOT_STICKY;
    }

    private void connect(String token) {
        if (socket != null) { socket.off(); socket.disconnect(); }
        try {
            IO.Options options = IO.Options.builder().setReconnection(true).setReconnectionDelay(1000).setReconnectionDelayMax(15000).build();
            options.auth = new java.util.HashMap<>();
            options.auth.put("token", token);
            options.auth.put("kind", "service");
            socket = IO.socket(URI.create("https://api.dotas.site"), options);
            socket.on(Socket.EVENT_CONNECT, args -> {
                socket.emit("duty:set", true, (Ack) result -> {
                    if (result.length > 0 && result[0] instanceof JSONObject && ((JSONObject) result[0]).optBoolean("ok")) {
                        dutyConnected = true;
                        socket.emit("test-call:pending", (Ack) pending -> {
                            if (pending.length > 0 && pending[0] instanceof JSONObject) {
                                JSONArray calls = ((JSONObject) pending[0]).optJSONArray("data");
                                if (calls != null) for (int i = 0; i < calls.length(); i++) handleCall(calls.optJSONObject(i));
                            }
                        });
                        sendLocation();
                    } else {
                        dutyConnected = false;
                    }
                });
            });
            socket.on(Socket.EVENT_DISCONNECT, args -> dutyConnected = false);
            socket.on(Socket.EVENT_CONNECT_ERROR, args -> dutyConnected = false);
            socket.on("test-call:updated", args -> { if (args.length > 0 && args[0] instanceof JSONObject) handleCall((JSONObject) args[0]); });
            socket.connect();
        } catch (Exception ignored) { Log.w("ZapLocation", "Não foi possível iniciar a conexão em tempo real."); }
    }

    private void createChannels() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel location = new NotificationChannel(CHANNEL_ID, "Serviço do motorista", NotificationManager.IMPORTANCE_LOW);
        location.setDescription("Mantém o motorista em serviço e compartilha sua localização.");
        manager.createNotificationChannel(location);
        NotificationChannel calls = new NotificationChannel(CALL_CHANNEL_ID, "Chamadas de coleta", NotificationManager.IMPORTANCE_HIGH);
        calls.setDescription("Avisa sobre chamadas de coleta de teste.");
        calls.enableVibration(true);
        manager.createNotificationChannel(calls);
    }

    private Notification serviceNotification() {
        Intent intent = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(this, 8102, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new Notification.Builder(this, CHANNEL_ID).setSmallIcon(R.drawable.ic_launcher).setContentTitle("Motorista em serviço")
            .setContentText("Localização e chamadas ativas enquanto você estiver em serviço.").setOngoing(true).setContentIntent(open).build();
    }

    private void handleCall(JSONObject call) {
        if (call == null) return;
        String id = call.optString("id");
        if (id.isEmpty()) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        int notificationId = id.hashCode();
        if (!"pending".equals(call.optString("status"))) { manager.cancel(notificationId); return; }
        long remaining;
        try { remaining = Instant.parse(call.optString("expiresAt")).toEpochMilli() - System.currentTimeMillis(); if (remaining <= 0) return; } catch (Exception ignored) { return; }
        Intent openIntent = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(this, notificationId, openIntent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder builder = new Notification.Builder(this, CALL_CHANNEL_ID).setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("Chamada de coleta de teste").setContentText("Aceite ou recuse a chamada em até 30 segundos.")
            .setPriority(Notification.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(open).setTimeoutAfter(Math.min(remaining, 30000));
        builder.addAction(new Notification.Action.Builder(null, "Aceitar", responseIntent(id, "accepted", notificationId)).build());
        builder.addAction(new Notification.Action.Builder(null, "Recusar", responseIntent(id, "rejected", notificationId)).build());
        manager.notify(notificationId, builder.build());
    }

    private PendingIntent responseIntent(String id, String answer, int notificationId) {
        Intent intent = new Intent(this, LocationService.class).setAction(ACTION_RESPOND).setData(android.net.Uri.parse("zapcall://" + id + "/" + answer));
        intent.putExtra("call_id", id); intent.putExtra("answer", answer);
        return PendingIntent.getService(this, notificationId, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void respond(String id, String answer) {
        if (socket == null || !socket.connected() || id == null || answer == null) return;
        JSONObject payload = new JSONObject();
        try { payload.put("id", id); payload.put("answer", answer); } catch (Exception ignored) { return; }
        socket.emit("test-call:respond", payload, (Ack) args -> {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null && args.length > 0 && args[0] instanceof JSONObject && ((JSONObject) args[0]).optBoolean("ok")) manager.cancel(id.hashCode());
        });
    }

    private void startLocationUpdates() {
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
            && checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return; }
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null) return;
        try {
            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 20000L, 20f, this, Looper.getMainLooper());
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 30000L, 50f, this, Looper.getMainLooper());
        } catch (SecurityException ignored) { stopSelf(); }
    }

    @Override public void onLocationChanged(Location location) {
        latitude = location.getLatitude(); longitude = location.getLongitude(); accuracy = location.hasAccuracy() ? location.getAccuracy() : 0.0f; updatedAt = System.currentTimeMillis();
        latestLocation = location; sendLocation();
    }
    private long lastSentAt;
    private void sendLocation() {
        Location location = latestLocation;
        if (!running || socket == null || !socket.connected() || !dutyConnected || location == null || System.currentTimeMillis() - location.getTime() > 120000 || System.currentTimeMillis() - lastSentAt < 15000) return;
        try {
            JSONObject payload = new JSONObject().put("latitude", location.getLatitude()).put("longitude", location.getLongitude()).put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 0);
            socket.emit("location:update", payload, (Ack) args -> {}); lastSentAt = System.currentTimeMillis();
        } catch (Exception ignored) {}
    }
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onProviderDisabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, android.os.Bundle extras) {}
    @Override public void onDestroy() {
        if (locationManager != null) locationManager.removeUpdates(this);
        if (socket != null) { socket.off(); socket.disconnect(); }
        running = false; dutyConnected = false; latestLocation = null; latitude = 0; longitude = 0; accuracy = 0; updatedAt = 0;
        stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
