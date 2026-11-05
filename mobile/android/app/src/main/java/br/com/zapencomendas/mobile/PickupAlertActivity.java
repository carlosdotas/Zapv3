package br.com.zapencomendas.mobile;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Shows only the active test-call prompt; it does not unlock the device. */
public final class PickupAlertActivity extends Activity {
    static final String STATUS_ACTION = "br.com.zapencomendas.mobile.PICKUP_STATUS";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private String callId;
    private long expires;
    private TextView countdown;
    private TextView message;
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
        layout.setGravity(Gravity.CENTER);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, padding, padding, padding);
        layout.setBackgroundColor(Color.rgb(0, 43, 73));
        TextView title = new TextView(this);
        title.setText("Chamada de coleta — teste"); title.setTextColor(Color.WHITE); title.setTextSize(24); title.setGravity(Gravity.CENTER);
        countdown = new TextView(this); countdown.setTextColor(Color.WHITE); countdown.setTextSize(17); countdown.setGravity(Gravity.CENTER);
        message = new TextView(this); message.setTextColor(Color.WHITE); message.setGravity(Gravity.CENTER);
        accept = new Button(this); accept.setText("Aceitar"); accept.setTextColor(Color.WHITE); accept.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(8, 122, 77)));
        reject = new Button(this); reject.setText("Recusar"); reject.setTextColor(Color.WHITE); reject.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(180, 35, 24)));
        accept.setOnClickListener(view -> respond("accepted")); reject.setOnClickListener(view -> respond("rejected"));
        layout.addView(title); layout.addView(countdown); layout.addView(message); layout.addView(accept); layout.addView(reject);
        setContentView(layout);
        IntentFilter filter = new IntentFilter(STATUS_ACTION);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        else registerReceiver(statusReceiver, filter);
        handler.post(tick);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (!readCall(intent)) { finish(); return; }
        responseAttempt++; awaiting = false; accept.setEnabled(true); reject.setEnabled(true); message.setText("");
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
        super.onDestroy();
    }
}
