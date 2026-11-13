package co.muzcast.setup;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Looper;
import android.util.Base64;
import java.io.ByteArrayOutputStream;
import org.json.JSONObject;

/** Read-only PackageManager inspection; no app is installed, enabled or disabled. */
public final class AppMetadata {
  public static void main(String[] args) throws Exception {
    if (Looper.myLooper() == null) Looper.prepareMainLooper();
    Class<?> activityThread = Class.forName("android.app.ActivityThread");
    Object thread = activityThread.getMethod("systemMain").invoke(null);
    Context context = (Context) activityThread.getMethod("getSystemContext").invoke(thread);
    PackageManager manager = context.getPackageManager();
    for (int i = 0; i < Math.min(args.length, 24); i++) {
      String pkg = args[i];
      if (!pkg.matches("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)+")) continue;
      try {
        ApplicationInfo info = manager.getApplicationInfo(pkg, 0);
        JSONObject row = new JSONObject();
        row.put("pkg", pkg);
        row.put("label", String.valueOf(manager.getApplicationLabel(info)));
        row.put("system", (info.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
        try {
          Drawable icon = manager.getApplicationIcon(info);
          Bitmap bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888);
          icon.setBounds(0, 0, 64, 64);
          icon.draw(new Canvas(bitmap));
          ByteArrayOutputStream bytes = new ByteArrayOutputStream();
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes);
          bitmap.recycle();
          if (bytes.size() <= 24576) row.put("icon", "data:image/png;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP));
        } catch (Exception ignored) { /* Name remains useful without an icon. */ }
        System.out.println(row.toString());
      } catch (PackageManager.NameNotFoundException ignored) { /* Not installed. */ }
    }
  }
}
