"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const src=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const start=src.indexOf("private fun reviewPendingBookingSync(date: String)");
const end=src.indexOf("private fun showCalendar()",start);
const body=src.slice(start,end);
test("11.45 pending review is explicitly user-triggered and server-only",()=>{
 assert.ok(start>0&&end>start);
 assert.match(src,/button\("Review pending cloud sync · read only"\)/);
 assert.match(body,/\.get\(Source\.SERVER\)/);
 assert.match(body,/bookingSyncPendingOwner/);
 assert.match(body,/bookingSyncPendingJson/);
 assert.match(body,/owner\.isEmailVerified/);
});
test("11.45 does not retry uploads or change persisted phone bookings",()=>{
 assert.doesNotMatch(body,/CloudSyncManager|\.set\(|runTransaction|saveBookings\(|prefs\.edit\(|bookings\.clear\(|bookings\.add\(/);
 assert.match(body,/cloudJson == localJson/);
 assert.match(body,/snapshot\.getLong\("schemaVersion"\) == 1L/);
 assert.match(body,/No upload, import or pending-status reset was performed/);
 assert.match(body,/No upload attempted/);
});
test("11.45 stale callbacks and network failures preserve pending state",()=>{
 assert.match(body,/selectedDate != date/);
 assert.match(body,/currentUser\?\.uid != owner\.uid/);
 assert.match(body,/getString\("bookings", null\) != localJson/);
 assert.match(body,/\.addOnFailureListener/);
 assert.match(body,/pending sync remains flagged/);
});
