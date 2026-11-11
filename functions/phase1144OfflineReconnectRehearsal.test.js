"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const wf=fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
const start=src.indexOf("private fun showOfflineReconnectRehearsal(date: String)");
const end=src.indexOf("private fun showCalendar()",start);
const body=src.slice(start,end);
test("11.44 demo is debug-only and reachable via labelled calendar control",()=>{
 assert.ok(start>0&&end>start);
 assert.match(body,/if \(!BuildConfig\.DEBUG\) return/);
 assert.match(src,/button\("Demo offline reconnect · no real changes"\)/);
 assert.match(src,/showOfflineReconnectRehearsal\(selectedDate\)/);
});
test("11.44 simulated offline phone and second device never touch real data",()=>{
 assert.match(body,/Booking\("demo-offline"/);
 assert.match(body,/Booking\("demo-other"/);
 assert.match(body,/setPositiveButton\("Rehearse reconnect"\)/);
 assert.match(body,/cloudOnlyIds/);
 assert.match(body,/cloudChanged && cloudOnlyIds\.isNotEmpty\(\)/);
 assert.doesNotMatch(body,/FirebaseFirestore|CloudSyncManager|FirebaseAuth|prefs\.|saveBookings\(|loadBookings\(|bookings\.add|\.commit\(\)/);
});
test("11.44 demo explicitly reports stale upload blocked and unchanged real appointments",()=>{
 assert.match(body,/Stale upload rejected/);
 assert.match(body,/Your real appointments and Firebase data were not modified/);
 assert.match(wf,/phase1144OfflineReconnectRehearsal\.test\.js/);
});
