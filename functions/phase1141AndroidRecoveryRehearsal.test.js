"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
const start=source.indexOf("private fun showIsolatedRecoveryRehearsal(date: String)");
const end=source.indexOf("private fun showOfflineReconnectRehearsal(date: String)",start);
const body=source.slice(start,end);
test("11.41 isolated rehearsal is only exposed in debug Android builds",()=>{
 assert.ok(start>0&&end>start);
 assert.match(body,/if \(!BuildConfig\.DEBUG\) return/);
 assert.match(source,/if \(BuildConfig\.DEBUG\) \{\s*button\("Demo recovery rehearsal · no real changes"\)/);
});
test("11.41 rehearsal uses only in-memory sample bookings and opt-in confirmation",()=>{
 assert.match(body,/Booking\("demo-local"/);
 assert.match(body,/Booking\("demo-cloud"/);
 assert.match(body,/setPositiveButton\("Rehearse import"\)/);
 assert.match(body,/setNegativeButton\("Cancel", null\)/);
 assert.match(body,/sampleCloud\.filter/);
 assert.match(body,/combined\.none/);
 assert.doesNotMatch(body,/FirebaseFirestore|FirebaseAuth|CloudSyncManager|prefs\.|saveBookings\(|loadBookings\(|bookings\.add|reference\.set|\.commit\(\)/);
});
test("11.41 rehearsal is labelled as simulated and never claims to import real data",()=>{
 assert.match(body,/No real appointments or Firebase data will change/);
 assert.match(body,/Your real calendar and cloud data were not modified/);
 assert.match(workflow,/phase1141AndroidRecoveryRehearsal\.test\.js/);
});
