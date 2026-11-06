package br.com.zapencomendas.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** One bounded check per Activity opening; never changes authentication or duty state. */
final class AppUpdater {
    static final int INSTALL_PERMISSION_CODE = 4301;
    private final Activity activity;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile boolean closed;
    private JSONObject available;
    private File downloaded;
    private AlertDialog progress;
    private long lastCheck;

    AppUpdater(Activity activity) { this.activity = activity; }

    void check() {
        if (closed || downloaded != null || System.currentTimeMillis() - lastCheck < 60000) return;
        lastCheck = System.currentTimeMillis();
        worker.execute(() -> {
            try {
                HttpsURLConnection connection = connect("https://dotas.site/downloads/" + BuildConfig.FLAVOR + ".json");
                JSONObject manifest;
                try (InputStream stream = connection.getInputStream()) {
                    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
                    byte[] buffer = new byte[1024]; int count;
                    while ((count = stream.read(buffer)) != -1) {
                        if (bytes.size() + count > 16384) return;
                        bytes.write(buffer, 0, count);
                    }
                    manifest = new JSONObject(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
                } finally { connection.disconnect(); }
                if (!BuildConfig.APPLICATION_ID.equals(manifest.getString("packageName"))
                    || !BuildConfig.FLAVOR.equals(manifest.getString("flavor"))
                    || manifest.getLong("versionCode") <= BuildConfig.VERSION_CODE
                    || !manifest.getString("sha256").matches("[a-f0-9]{64}")
                    || manifest.getLong("size") <= 0 || manifest.getLong("size") > 100 * 1024 * 1024
                    || !manifest.getString("apkUrl").equals("https://dotas.site/downloads/encomendaszap-" + BuildConfig.FLAVOR + ".apk")) return;
                ui(() -> { available = manifest; offer(); });
            } catch (Exception ignored) { /* Offline checks must not obstruct normal app use. */ }
        });
    }

    void offer() {
        if (closed || available == null || !activity.hasWindowFocus()) return;
        JSONObject manifest = available;
        available = null;
        new AlertDialog.Builder(activity).setMessage("Nova versão disponível. Deseja atualizar?")
            .setNegativeButton("Agora não", null)
            .setPositiveButton("Atualizar", (dialog, which) -> download(manifest)).show();
    }

    private void download(JSONObject manifest) {
        progress = new AlertDialog.Builder(activity).setMessage("Baixando atualização…") .setCancelable(false).show();
        worker.execute(() -> {
            File file = new File(new File(activity.getCacheDir(), "updates"), "update.apk");
            try {
                if (!file.getParentFile().isDirectory() && !file.getParentFile().mkdirs()) throw new Exception();
                HttpsURLConnection connection = connect(manifest.getString("apkUrl"));
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long count = 0;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(file)) {
                    byte[] buffer = new byte[32768]; int length;
                    while ((length = input.read(buffer)) != -1) {
                        count += length;
                        if (closed || Thread.currentThread().isInterrupted() || count > manifest.getLong("size")) throw new Exception();
                        output.write(buffer, 0, length); digest.update(buffer, 0, length);
                    }
                } finally { connection.disconnect(); }
                StringBuilder hash = new StringBuilder();
                for (byte value : digest.digest()) hash.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
                if (count != manifest.getLong("size") || !hash.toString().equals(manifest.getString("sha256"))) throw new Exception();
                PackageManager manager = activity.getPackageManager();
                PackageInfo archive = manager.getPackageArchiveInfo(file.getPath(), PackageManager.GET_SIGNATURES);
                PackageInfo installed = manager.getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNATURES);
                if (archive == null || !installed.packageName.equals(archive.packageName)
                    || archive.versionCode != manifest.getLong("versionCode") || archive.versionCode <= BuildConfig.VERSION_CODE
                    || archive.signatures == null || installed.signatures == null
                    || !Arrays.equals(archive.signatures, installed.signatures)) throw new Exception();
                ui(() -> { progress.dismiss(); downloaded = file; install(); });
            } catch (Exception ignored) {
                file.delete();
                ui(() -> { progress.dismiss(); Toast.makeText(activity, "Não foi possível baixar ou validar a atualização. Tente novamente ao abrir o aplicativo.", Toast.LENGTH_LONG).show(); });
            }
        });
    }

    void install() {
        if (closed || downloaded == null || !downloaded.isFile()) return;
        try {
            if (!activity.getPackageManager().canRequestPackageInstalls()) {
                new AlertDialog.Builder(activity).setMessage("Permita instalar atualizações deste aplicativo. Depois, confirme a instalação no Android.")
                    .setNegativeButton("Agora não", (dialog, which) -> downloaded = null)
                    .setOnCancelListener(dialog -> downloaded = null)
                    .setPositiveButton("Abrir configurações", (dialog, which) -> {
                        try { activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                            Uri.parse("package:" + activity.getPackageName())), INSTALL_PERMISSION_CODE); }
                        catch (Exception ignored) { error(); }
                    }).show();
                return;
            }
            Uri uri = FileProvider.getUriForFile(activity, BuildConfig.APPLICATION_ID + ".updates", downloaded);
            activity.startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
            downloaded = null;
        } catch (Exception ignored) { error(); }
    }

    private static HttpsURLConnection connect(String url) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
        connection.setRequestProperty("Cache-Control", "no-cache");
        if (connection.getResponseCode() != 200) { connection.disconnect(); throw new Exception(); }
        return connection;
    }

    private void error() { Toast.makeText(activity, "Não foi possível abrir a instalação. Verifique as permissões do Android.", Toast.LENGTH_LONG).show(); }
    void permissionResult() { if (activity.getPackageManager().canRequestPackageInstalls()) install(); else { downloaded = null; error(); } }
    private void ui(Runnable action) { activity.runOnUiThread(() -> { if (!closed && !activity.isFinishing() && !activity.isDestroyed()) action.run(); }); }
    void close() { closed = true; worker.shutdownNow(); if (progress != null) progress.dismiss(); }
}
