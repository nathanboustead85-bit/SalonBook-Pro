"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const start=src.indexOf("private fun showTwoDeviceTestReadiness()");
const next=src.indexOf("private fun showSinglePhoneRecoveryAudit()",start);
const end=next>start?next:src.indexOf("private fun showCalendar()",start);
const body=src.slice(start,end);
test("11.59 preparation control is present and debug-only",()=>{
 assert.ok(start>0&&end>start);
 assert.match(body,/if \(!BuildConfig\.DEBUG\) return/);
 assert.match(src,/button\("Two-device test readiness · no changes"\)/);
});
test("11.59 checks verified identity and pending sync before guidance",()=>{
 assert.match(body,/owner\.isEmailVerified/);
 assert.match(body,/bookingSyncPendingOwner/);
 assert.match(body,/NOT READY/);
});
test("11.59 instructions prevent real booking edits and account confusion",()=>{
 assert.match(body,/disposable test account/);
 assert.match(body,/Do not edit, import, delete or force-sync existing appointments/);
 assert.match(body,/matching read-only report on this phone does not prove/);
});
test("11.59 dialog cannot mutate local or cloud booking records",()=>{
 assert.doesNotMatch(body,/FirebaseFirestore|CloudSyncManager|\.set\(|\.update\(|\.delete\(|\.runTransaction\(|prefs\.edit\(|saveBookings\(|signOut\(/);
 assert.match(body,/AlertDialog\.Builder/);
});
