package br.com.zapencomendas.mobile;

import android.app.*;
import android.content.Intent;
import android.location.Location;
import android.media.AudioAttributes;
import android.os.Handler;
import android.os.Looper;
import org.json.*;
import java.net.URI;
import java.util.*;
import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.client.Ack;

/** Owned exclusively by the foreground location service; no Activity/WebView dependency. */
final class DutyConnection {
    private final LocationService service;
    private final Socket socket;
    private final String professionalId;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, Long> pending = new HashMap<>();
    private final Map<String, JSONObject> pendingDetails = new HashMap<>();
    private volatile Location latest;
    private volatile boolean stopping;
    private long lastSent;
    static final String CHANNEL = "zap_pickup_calls_v2";
    private final Runnable heartbeat = new Runnable() {
        public void run() {
            if (stopping) return;
            if (socket.connected()) socket.emit("presence:heartbeat", new JSONObject(), (Ack) args -> {if ("UNAUTHENTICATED".equals(object(args).optString("code"))) handler.post(service::stopSelf);});
            handler.postDelayed(this, 30000);
        }
    };
    DutyConnection(LocationService service, String token) {
        this.service = service;
        this.professionalId = token.split("\\.", 2)[0];
        IO.Options options = IO.Options.builder().setAuth(Collections.singletonMap("token", token))
            .setReconnection(true).setReconnectionDelay(1000).setReconnectionDelayMax(15000).build();
        socket = IO.socket(URI.create(BuildConfig.API_URL), options);
        ensureCallChannel(service);
        socket.on(Socket.EVENT_CONNECT, args -> {
            if (stopping) return;
            socket.emit("duty:set", json("onDuty",true), (Ack) result -> {
                JSONObject response = object(result);
                if (response.has("error")) { handler.post(service::stopSelf); return; }
                socket.emit("pickup:sync", new JSONObject(), (Ack) items -> {
                    JSONArray calls = object(items).optJSONArray("data");
                    if (calls != null) for (int i=0;i<calls.length();i++) receive(calls.optJSONObject(i));
                });
                if (latest != null) location(latest);
            });
        });
        socket.on("pickup:updated", args -> receive(object(args)));
        socket.on(Socket.EVENT_CONNECT_ERROR, args -> {if(args.length>0 && String.valueOf(args[0]).contains("Sessão inválida.")) handler.post(service::stopSelf);});
        socket.connect();
        handler.post(heartbeat);
    }
    static void ensureCallChannel(android.content.Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel previous = manager.getNotificationChannel("zap_pickup_calls_v1");
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Chamadas de coleta", previous == null ? NotificationManager.IMPORTANCE_HIGH : previous.getImportance());
        if (previous == null) channel.setVibrationPattern(new long[]{0,400,200,400});
        else if (previous.getVibrationPattern() != null) channel.setVibrationPattern(previous.getVibrationPattern());
        channel.enableVibration(previous == null || previous.shouldVibrate());
        android.net.Uri sound = android.net.Uri.parse("android.resource://" + context.getPackageName() + "/raw/chamada_zap");
        channel.setSound(previous != null && previous.getSound() == null ? null : sound, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).build());
        manager.createNotificationChannel(channel);
    }
    private JSONObject object(Object[] args) { return args.length>0 && args[0] instanceof JSONObject ? (JSONObject)args[0] : new JSONObject(); }
    private JSONObject json(String key,Object value) { JSONObject obj=new JSONObject();try {obj.put(key,value);}catch(JSONException ignored){}return obj; }
    synchronized void location(Location location) {
        latest=location;
        if (!socket.connected() || stopping || System.currentTimeMillis()-lastSent<10000 || System.currentTimeMillis()-location.getTime()>120000) return;
        lastSent=System.currentTimeMillis();
        JSONObject body=json("latitude",location.getLatitude());
        try { body.put("longitude",location.getLongitude()); body.put("accuracy",location.hasAccuracy()?location.getAccuracy():1000); body.put("recordedAt",java.time.Instant.ofEpochMilli(location.getTime()).toString()); } catch(JSONException ignored){}
        socket.emit("location:update",body,(Ack) args -> {});
    }
    private void receive(JSONObject call) {
        if (call == null || !professionalId.equals(call.optString("professionalId"))) return;
        handler.post(() -> {
            String id=call.optString("id");
            NotificationManager manager=service.getSystemService(NotificationManager.class);
            if (!"pending".equals(call.optString("status"))) {pending.remove(id);pendingDetails.remove(id);manager.cancel(id,8200);publishStatus(id,call.optString("status"));return;}
            long expires;
            try {expires=java.time.Instant.parse(call.getString("expiresAt")).toEpochMilli();} catch(Exception e){return;}
            long remaining=expires-System.currentTimeMillis();
            if (remaining<=0 || pending.containsKey(id) || stopping) return;
            pending.put(id,expires);
            pendingDetails.put(id,call);
            alertPending(id,true);
        });
    }
    private void alertPending(String id,boolean first) {
        Long expires=pending.get(id);
        if (expires==null || stopping) return;
        NotificationManager manager=service.getSystemService(NotificationManager.class);
        long remaining=expires-System.currentTimeMillis();
        if (remaining<=0) {pending.remove(id);pendingDetails.remove(id);manager.cancel(id,8200);publishStatus(id,"expired");return;}
        Intent alert=new Intent(service,PickupAlertActivity.class).setData(android.net.Uri.parse("zap://pickup/"+id)).putExtra("id",id).putExtra("expires",expires);
        JSONObject details=pendingDetails.get(id);
        if (details != null) {
            alert.putExtra("companyName",details.optString("companyName", ""));
            alert.putExtra("pickupName",details.optString("pickupName", ""));
            alert.putExtra("pickupAddress",details.optString("pickupAddress", ""));
            if (!details.isNull("distanceKm")) alert.putExtra("distanceKm",details.optDouble("distanceKm", Double.NaN));
            if (!details.isNull("pickupLatitude") && !details.isNull("pickupLongitude")) {
                alert.putExtra("pickupLatitude",details.optDouble("pickupLatitude", Double.NaN));
                alert.putExtra("pickupLongitude",details.optDouble("pickupLongitude", Double.NaN));
            }
        }
        PendingIntent open=PendingIntent.getActivity(service,0,alert,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder notification=new Notification.Builder(service,CHANNEL).setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(detail(details,"pickupName","Local de coleta não informado"))
            .setContentText(detail(details,"companyName","Transportadora não informada"))
            .setLargeIcon(notificationIcon())
            .setContentIntent(open).setCategory(Notification.CATEGORY_CALL).setTimeoutAfter(remaining).setAutoCancel(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(new Notification.Action.Builder(null,"Visualizar",open).build());
        if (first) notification.setFullScreenIntent(open,true);
        try {manager.notify(id,8200,notification.build());} catch(SecurityException ignored){}
        handler.postDelayed(()->alertPending(id,false),Math.min(8000,remaining));
    }
    private String detail(JSONObject details,String key,String fallback) {
        if (details == null || details.isNull(key)) return fallback;
        String value=details.optString(key, "").trim();
        return value.isEmpty() || "null".equals(value) ? fallback : value;
    }
    private android.graphics.Bitmap notificationIcon() {
        android.graphics.drawable.Drawable drawable=androidx.core.content.ContextCompat.getDrawable(service,R.drawable.ic_launcher);
        if (drawable == null) return null;
        android.graphics.Bitmap bitmap=android.graphics.Bitmap.createBitmap(96,96,android.graphics.Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas=new android.graphics.Canvas(bitmap);
        drawable.setBounds(0,0,96,96); drawable.draw(canvas); return bitmap;
    }
    void respond(String id,String answer) {
        if (!socket.connected() || stopping) {publishStatus(id,"unavailable");return;}
        JSONObject body=json("id",id);try {body.put("answer",answer);}catch(JSONException ignored){}
        socket.emit("pickup:respond",body,(Ack) args -> {JSONObject call=object(args).optJSONObject("data");if(call!=null)receive(call);else publishStatus(id,"unavailable");});
    }
    private void publishStatus(String id,String status) {service.sendBroadcast(new Intent(PickupAlertActivity.STATUS_ACTION).setPackage(service.getPackageName()).putExtra("id",id).putExtra("status",status));}
    void stopDuty() {
        stopping=true;
        if (socket.connected()) socket.emit("duty:set",json("onDuty",false),(Ack) args->handler.post(service::stopSelf));
        handler.postDelayed(service::stopSelf,3000);
    }
    void close() {
        stopping=true;handler.removeCallbacksAndMessages(null);
        socket.off();socket.disconnect();
        for(String id:pending.keySet())service.getSystemService(NotificationManager.class).cancel(id,8200);
        pending.clear();
        pendingDetails.clear();
    }
}
