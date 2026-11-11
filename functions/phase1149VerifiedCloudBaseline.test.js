"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const start=src.indexOf("private fun establishVerifiedBookingBaseline(date: String)");
const end=src.indexOf("private fun showCalendar()",start);
const block=src.slice(start,end);
test("11.49 calendar offers explicit baseline verification",()=>{
 assert.ok(start>0&&end>start);
 assert.match(src,/button\("Verify matching cloud baseline · no booking changes"\)/);
});
test("11.49 baseline requires verified owner, fresh server, matching JSON and no pending sync",()=>{
 for(const fragment of ["isEmailVerified","get(Source.SERVER)","schemaVersion","serverJson == phoneJson","bookingSyncPendingOwner","currentScreen != \"calendar\"","selectedDate != date","Invalid or duplicate booking ID"])
 assert.ok(block.includes(fragment),fragment);
});
test("11.49 writes only acknowledged baseline keys; never booking or cloud data",()=>{
 assert.match(block,/putString\("bookingSyncAcknowledgedOwner", owner.uid\)/);
 assert.match(block,/putString\("bookingSyncAcknowledgedJson", serverJson\)/);
 assert.doesNotMatch(block,/CloudSyncManager\(\)\.upload|\.runTransaction\(|\.set\(|\.update\(|\.delete\(|saveBookings\(|putString\("bookings"/);
});
