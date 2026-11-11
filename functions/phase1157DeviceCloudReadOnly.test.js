"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const start=src.indexOf("private fun verifyDeviceCloudBookingsReadOnly(date: String)");
const end=src.indexOf("private fun showCalendar()",start);
const body=src.slice(start,end);
test("11.57 read-only device check is debug-only and accessible in calendar",()=>{
 assert.ok(start>0&&end>start);
 assert.match(body,/if \(!BuildConfig\.DEBUG\) return/);
 assert.match(src,/button\("Verify device\/cloud appointments · read only"\)/);
});
test("11.57 check uses verified owner and fresh server snapshot",()=>{
 assert.match(body,/owner\.isEmailVerified/);
 assert.match(body,/\.get\(Source\.SERVER\)/);
 assert.match(body,/snapshot\.getLong\("schemaVersion"\) == 1L/);
 assert.match(body,/snapshot\.getString\("json"\)/);
});
test("11.57 rejects pending and changed phone state and does not write",()=>{
 assert.match(body,/bookingSyncPendingOwner/);
 assert.match(body,/prefs\.getString\("bookings", "\[\]"\) != localAtStart/);
 assert.match(body,/selectedDate != date/);
 assert.doesNotMatch(body,/\.set\(|\.update\(|\.delete\(|\.runTransaction\(|saveBookings\(/);
});
test("11.57 checks duplicates and shows mismatches without forcing sync",()=>{
 assert.match(body,/Invalid or duplicate booking ID/);
 assert.match(body,/Cloud-only IDs:/);
 assert.match(body,/Phone-only IDs:/);
 assert.match(body,/Exact snapshot match:/);
 assert.match(body,/No changes or retries were made/);
});
