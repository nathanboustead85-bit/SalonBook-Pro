"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
const save=src.slice(src.indexOf("private fun saveBookings()"),src.indexOf("private fun loadBookings()"));
const calendar=src.slice(src.indexOf("private fun showCalendar()"),src.indexOf("private fun showAppointments()",src.indexOf("private fun showCalendar()"))>0?src.indexOf("private fun showAppointments()",src.indexOf("private fun showCalendar()")):undefined);
test("11.42 saves phone data and persistent unconfirmed marker before upload",()=>{
 assert.match(save,/putString\("bookings", json\)/);
 assert.match(save,/putString\("bookingSyncPendingOwner", ownerAtSave.uid\)/);
 assert.match(save,/putString\("bookingSyncPendingJson", json\)/);
 assert.ok(save.indexOf("editor.apply()")<save.indexOf('CloudSyncManager().upload("bookings", json,'));
});
test("11.42 only clears pending status after same owner and same snapshot acknowledgement",()=>{
 assert.match(save,/if \(result.isSuccess\)/);
 assert.match(save,/currentUser\?\.uid != ownerAtSave.uid/);
 assert.match(save,/getString\("bookingSyncPendingJson", null\) == json/);
 assert.match(save,/getString\("bookings", null\) == json/);
 assert.match(save,/remove\("bookingSyncPendingOwner"\)/);
 assert.match(save,/remove\("bookingSyncPendingJson"\)/);
});
test("11.42 failure retains local bookings and warns without automatic reconnect upload",()=>{
 assert.match(save,/Saved on phone; cloud sync not confirmed/);
 assert.match(src,/Cloud sync needs review · phone bookings preserved/);
 assert.match(src,/Nothing will be uploaded automatically on reconnect/);
 assert.doesNotMatch(calendar,/CloudSyncManager\(\)\.upload/);
 assert.match(workflow,/phase1142OfflineSyncPending\.test\.js/);
});
