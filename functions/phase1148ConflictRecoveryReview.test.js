"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const start=src.indexOf("private fun previewConflictRecovery(date: String)");
const end=src.indexOf("private fun establishVerifiedBookingBaseline(date: String)",start)>start
 ? src.indexOf("private fun establishVerifiedBookingBaseline(date: String)",start)
 : src.indexOf("private fun showCalendar()",start);
const review=src.slice(start,end);
test("11.48 exposes read-only recovery review on calendar",()=>{
 assert.ok(start>0&&end>start);
 assert.match(src,/button\("Review conflict recovery · read only"\)/);
 assert.match(review,/get\(Source\.SERVER\)/);
 assert.match(review,/isEmailVerified/);
 assert.match(review,/currentScreen != "calendar"/);
 assert.match(review,/prefs\.getString\("bookings", "();"\)/.source? /prefs\.getString\("bookings", "\[\]"\)/ : /bookings/);
});
test("11.48 distinguishes cloud-only, phone-only and same-ID conflicts",()=>{
 for(const marker of ["cloudOnly","phoneOnly","changed","bookingSyncPendingOwner","bookingSyncAcknowledgedOwner","Duplicate or invalid booking ID"])assert.ok(review.includes(marker),marker);
});
test("11.48 recovery review never writes or clears pending status",()=>{
 assert.doesNotMatch(review,/\.set\(|\.update\(|\.delete\(|\.runTransaction\(|CloudSyncManager\(\)\.upload|prefs\.edit\(\)|saveBookings\(/);
 assert.match(review,/No booking was changed, uploaded/);
});
