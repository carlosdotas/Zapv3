package br.com.zapencomendas.mobile;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Shows only the active test-call prompt; it does not unlock the device. */
public final class PickupAlertActivity extends Activity {
    static final String STATUS_ACTION = "br.com.zapencomendas.mobile.PICKUP_STATUS";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private long expires;
    private TextView countdown;
    private TextView details;
    private TextView message;
    private WebView map;
    private Button accept;
    private Button reject;
    private boolean awaiting;
    private int responseAttempt;
    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) {
            if (!callId.equals(intent.getStringExtra("id"))) return;
            String status = intent.getStringExtra("status");
            if ("accepted".equals(status) || "rejected".equals(status) || "expired".equals(status)) finish();
            else if ("unavailable".equals(status)) showRetry();
        }
    };
    private final Runnable tick = new Runnable() {
        @Override public void run() {
            long seconds = (expires - System.currentTimeMillis() + 999) / 1000;
            if (seconds <= 0) { finish(); return; }
            countdown.setText("Responda em até " + seconds + " segundos.");
            handler.postDelayed(this, 1000);
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        else getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        if (!readCall(getIntent())) { finish(); return; }
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER_HORIZONTAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, padding, padding, padding);
        layout.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[]{Color.rgb(9,13,22),Color.rgb(15,23,42),Color.rgb(7,10,18)}));
        TextView eyebrow = new TextView(this);
        eyebrow.setText("ENCOMENDASZAP  •  MOTORISTA"); eyebrow.setTextColor(Color.rgb(253,186,116)); eyebrow.setTextSize(11); eyebrow.setTypeface(null,Typeface.BOLD); eyebrow.setGravity(Gravity.CENTER);
        TextView title = new TextView(this);
        title.setText("Nova coleta para você"); title.setTextColor(Color.WHITE); title.setTextSize(26); title.setTypeface(null,Typeface.BOLD); title.setGravity(Gravity.CENTER); title.setPadding(0,padding/2,0,padding/3);
        countdown = new TextView(this); countdown.setTextColor(Color.rgb(203,213,225)); countdown.setTextSize(14); countdown.setGravity(Gravity.CENTER); countdown.setPadding(0,0,0,padding/2);
        details = new TextView(this); details.setTextColor(Color.rgb(30,41,59)); details.setTextSize(16); details.setGravity(Gravity.START); details.setPadding(padding,padding,padding,padding); showDetails(getIntent());
        ScrollView detailsScroll = new ScrollView(this); detailsScroll.setBackground(rounded(Color.WHITE,20)); detailsScroll.addView(details);
        map = new WebView(this);
        map.getSettings().setJavaScriptEnabled(true);
        map.getSettings().setAllowFileAccess(false);
        map.getSettings().setAllowContentAccess(false);
        map.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
        });
        showMap(getIntent());
        message = new TextView(this); message.setTextColor(Color.WHITE); message.setGravity(Gravity.CENTER);
        accept = new Button(this); accept.setText("Aceitar chamada"); accept.setAllCaps(false); accept.setTypeface(null,Typeface.BOLD); accept.setTextColor(Color.WHITE); accept.setBackground(rounded(Color.rgb(5,150,105),14));
        reject = new Button(this); reject.setText("Recusar"); reject.setAllCaps(false); reject.setTypeface(null,Typeface.BOLD); reject.setTextColor(Color.rgb(190,18,60)); reject.setBackground(rounded(Color.rgb(255,241,242),14));
        accept.setOnClickListener(view -> respond("accepted")); reject.setOnClickListener(view -> respond("rejected"));
        LinearLayout actions = new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL); actions.setPadding(0,padding/2,0,0);
        LinearLayout.LayoutParams rejectSize = new LinearLayout.LayoutParams(0,(int)(52*getResources().getDisplayMetrics().density),1); rejectSize.setMargins(0,0,padding/3,0);
        actions.addView(reject,rejectSize); actions.addView(accept,new LinearLayout.LayoutParams(0,(int)(52*getResources().getDisplayMetrics().density),1.4f));
        layout.addView(eyebrow); layout.addView(title); layout.addView(countdown);
        layout.addView(map, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        layout.addView(detailsScroll, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (int)(140 * getResources().getDisplayMetrics().density)));
        layout.addView(message); layout.addView(actions);
        setContentView(layout);
        IntentFilter filter = new IntentFilter(STATUS_ACTION);
        androidx.core.content.ContextCompat.registerReceiver(this, statusReceiver, filter,
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED);
        handler.post(tick);
    }

    private GradientDrawable rounded(int color, int radiusDp) {
        GradientDrawable drawable = new GradientDrawable(); drawable.setColor(color);
        drawable.setCornerRadius(radiusDp * getResources().getDisplayMetrics().density); return drawable;
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!readCall(intent)) { finish(); return; }
        showDetails(intent); showMap(intent); responseAttempt++; awaiting = false; accept.setEnabled(true); reject.setEnabled(true); message.setText("");
    }

    private void showMap(Intent intent) {
        Uri.Builder params = new Uri.Builder();
        double lat = intent.getDoubleExtra("pickupLatitude", Double.NaN);
        double lon = intent.getDoubleExtra("pickupLongitude", Double.NaN);
        if (Double.isFinite(lat) && Math.abs(lat) <= 85 && Double.isFinite(lon) && Math.abs(lon) <= 180) {
            params.appendQueryParameter("dlat", Double.toString(lat)).appendQueryParameter("dlon", Double.toString(lon));
        }
        if (LocationService.running && LocationService.updatedAt > 0 && System.currentTimeMillis() - LocationService.updatedAt < 120000L) {
            params.appendQueryParameter("olat", Double.toString(LocationService.latitude)).appendQueryParameter("olon", Double.toString(LocationService.longitude));
        }
        try (java.util.Scanner scanner = new java.util.Scanner(getAssets().open("pickup-map.html"), "UTF-8").useDelimiter("\\A")) {
            String html = scanner.hasNext() ? scanner.next() : "";
            String query = params.build().getEncodedQuery();
            html = html.replace("new URLSearchParams(location.search)", "new URLSearchParams(" + org.json.JSONObject.quote(query == null ? "" : query) + ")");
            map.loadDataWithBaseURL("https://profissional.dotas.site/", html, "text/html", "UTF-8", null);
        } catch (java.io.IOException failure) {
            map.loadData("<p>Mapa indisponível.</p>", "text/html", "UTF-8");
        }
    }

    private void showDetails(Intent intent) {
        String company = value(intent, "companyName", "Não informada");
        String place = value(intent, "pickupName", "Não informado");
        String address = value(intent, "pickupAddress", "Não informado");
        double distance = intent.getDoubleExtra("distanceKm", Double.NaN);
        String distanceText = Double.isFinite(distance) && distance >= 0 ? String.format(new java.util.Locale("pt", "BR"), "%.2f km em linha reta", distance) : "Indisponível";
        details.setText("Transportadora: " + company + "\n\nLocal de coleta: " + place + "\n\nEndereço: " + address + "\n\nDistância aproximada: " + distanceText);
    }

    private String value(Intent intent, String name, String fallback) {
        String text = intent.getStringExtra(name);
        return text == null || text.trim().isEmpty() || "null".equals(text) ? fallback : text;
    }

    private boolean readCall(Intent intent) {
        String id = intent == null ? null : intent.getStringExtra("id");
        if (id == null || !id.matches("[0-9a-fA-F-]{36}")) return false;
        callId = id; expires = intent.getLongExtra("expires", 0);
        return expires > System.currentTimeMillis();
    }

    private void respond(String answer) {
        if (awaiting) return;
        if (!LocationService.running) { showRetry(); return; }
        awaiting = true; int attempt = ++responseAttempt; accept.setEnabled(false); reject.setEnabled(false); message.setText("Enviando resposta...");
        try {
            startService(new Intent(this, LocationService.class).setAction("respond").putExtra("id", callId).putExtra("answer", answer));
            handler.postDelayed(() -> { if (awaiting && responseAttempt == attempt) showRetry(); }, 7000);
        } catch (RuntimeException ignored) { showRetry(); }
    }

    private void showRetry() {
        awaiting = false; accept.setEnabled(true); reject.setEnabled(true);
        message.setText("Sem confirmação. Confira a conexão e tente novamente.");
    }

    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (countdown != null) unregisterReceiver(statusReceiver);
        if (map != null) map.destroy();
        super.onDestroy();
    }
}
