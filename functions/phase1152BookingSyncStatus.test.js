"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const start=src.indexOf("private fun showBookingSyncStatus(date: String)");
const end=src.indexOf("private fun showCalendar()",start);
const body=src.slice(start,end);
test("11.52 calendar displays read-only booking status",()=>{
 assert.ok(start>0&&end>start);
 assert.match(src,/showBookingSyncStatus\(selectedDate\)/);
 assert.match(body,/BOOKING SYNC STATUS · READ ONLY/);
});
test("11.52 does not claim cloud confirmation without server comparison",()=>{
 for(const marker of ['get(Source.SERVER)','serverJson == localJson','bookingSyncPendingOwner','isEmailVerified','selectedDate != date','cloud confirmation pending review','cloud differs','cloud unavailable'])assert.ok(body.includes(marker),marker);
});
test("11.52 status cannot mutate bookings, cloud or acknowledgement state",()=>{
 assert.doesNotMatch(body,/\.set\(|\.update\(|\.delete\(|\.runTransaction\(|CloudSyncManager\(\)\.upload|prefs\.edit\(\)|saveBookings\(/);
});
