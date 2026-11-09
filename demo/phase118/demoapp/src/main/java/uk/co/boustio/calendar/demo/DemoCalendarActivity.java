package uk.co.boustio.calendar.demo;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.*;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.time.format.*;
import java.util.*;
import java.util.concurrent.*;

/** Separate, unsigned debug-only demo. Loopback transport via adb reverse only. */
public final class DemoCalendarActivity extends Activity {
 private final Handler ui=new Handler(Looper.getMainLooper());
 private final ExecutorService io=Executors.newSingleThreadExecutor();
 private LinearLayout rows;
 private TextView state;
 private EditText business,token,date;
 private boolean running=false;
 private long generation=0;
 private String lastFingerprint="";
 private final Runnable poll=new Runnable(){public void run(){if(running)load();}};
 private static final String ENDPOINT="http://127.0.0.1:8765/api/owner-calendar";
 @Override public void onCreate(Bundle b){
  super.onCreate(b);
  LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setPadding(24,24,24,24);
  TextView heading=new TextView(this);heading.setText("BOUSTIO • DEVELOPMENT DEMO ONLY");heading.setTextSize(20);root.addView(heading);
  state=new TextView(this);state.setText("Not connected");root.addView(state);
  business=new EditText(this);business.setHint("Synthetic business ID (demo_...)");root.addView(business);
  date=new EditText(this);date.setHint("Date YYYY-MM-DD");date.setText(LocalDate.now(ZoneId.of("Europe/London")).toString());root.addView(date);
  token=new EditText(this);token.setHint("Verified owner Auth emulator ID token");token.setInputType(129);root.addView(token);
  Button refresh=new Button(this);refresh.setText("Connect to local demo calendar");refresh.setOnClickListener(v->{generation++;lastFingerprint="";running=true;ui.removeCallbacks(poll);load();});root.addView(refresh);
  rows=new LinearLayout(this);rows.setOrientation(1);ScrollView scroll=new ScrollView(this);scroll.addView(rows);root.addView(scroll);
  setContentView(root);
 }
 private void load(){
  final long current=generation;
  final String id=business.getText().toString().trim(),key=token.getText().toString().trim(),day=date.getText().toString().trim();
  if(!id.matches("demo_[A-Za-z0-9_-]{3,75}")||key.isEmpty()||!day.matches("\\d{4}-\\d{2}-\\d{2}")){state.setText("Enter a demo business, date and owner emulator token");return;}
  state.setText("Connecting to local emulator…");
  io.execute(()->{
   try{
    HttpURLConnection conn=(HttpURLConnection)new URL(ENDPOINT).openConnection();
    conn.setConnectTimeout(3000);conn.setReadTimeout(3000);conn.setRequestMethod("POST");conn.setDoOutput(true);
    conn.setRequestProperty("Content-Type","application/json");
    JSONObject payload=new JSONObject();payload.put("businessId",id);payload.put("ownerToken",key);payload.put("date",day);
    try(OutputStream out=conn.getOutputStream()){out.write(payload.toString().getBytes(StandardCharsets.UTF_8));}
    int status=conn.getResponseCode();
    if(status!=200)throw new IOException("Demo owner access denied or local server unavailable ("+status+")");
    String raw;
    try(InputStream input=conn.getInputStream()){raw=new String(input.readAllBytes(),StandardCharsets.UTF_8);}
    JSONObject data=new JSONObject(raw);JSONArray appointments=data.getJSONArray("appointments");
    LinkedHashMap<String,String> unique=new LinkedHashMap<>();
    for(int i=0;i<appointments.length();i++){
     JSONObject a=appointments.getJSONObject(i);
     if(!"demo_customer_web".equals(a.getString("source")))throw new IOException("Unexpected appointment source");
     String bookingId=a.getString("id"),statusText=a.getString("status");
     if(!statusText.equals("confirmed")&&!statusText.equals("cancelled")||unique.containsKey(bookingId))throw new IOException("Invalid or duplicate booking");
     ZonedDateTime london=Instant.parse(a.getString("startAt")).atZone(ZoneId.of("Europe/London"));
     unique.put(bookingId,london.format(DateTimeFormatter.ofPattern("EEE d MMM HH:mm"))+" • "+a.getString("serviceId")+" • "+a.getString("staffId")+" • "+statusText);
    }
    ui.post(()->{if(!running||generation!=current)return;String fingerprint=unique.toString();if(!fingerprint.equals(lastFingerprint)){lastFingerprint=fingerprint;rows.removeAllViews();if(unique.isEmpty())addRow("No demo appointments");else unique.values().forEach(this::addRow);}state.setText("Connected • "+unique.size()+" demo appointments");});
   }catch(Exception e){ui.post(()->{if(running&&generation==current)state.setText("Reconnecting • "+e.getMessage());});}
   finally{ui.postDelayed(()->{if(running&&generation==current)poll.run();},5000);}
  });
 }
 private void addRow(String text){TextView t=new TextView(this);t.setText(text);t.setTextSize(16);t.setPadding(0,14,0,14);rows.addView(t);}
 @Override protected void onStop(){running=false;generation++;ui.removeCallbacks(poll);super.onStop();}
 @Override protected void onDestroy(){io.shutdownNow();super.onDestroy();}
}
