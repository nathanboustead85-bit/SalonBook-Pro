"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const a=src.indexOf("private fun showIsolatedAppointmentEditRehearsal()");
const nextMethod=src.indexOf("private fun verifyDeviceCloudBookingsReadOnly(date: String)",a);
const calendar=src.indexOf("private fun showCalendar()",a);
const b=nextMethod>a?nextMethod:calendar;
const body=src.slice(a,b);
test("11.53 debug-only isolated edit dialog is reachable from calendar",()=>{
 assert.ok(a>0&&b>a);assert.match(src,/button\("Demo appointment edit · no real changes"\)/);
 assert.match(body,/if \(!BuildConfig.DEBUG\) return/);
 assert.match(body,/TEST APPOINTMENT ONLY/);
});
test("11.53 demo validates time but never saves or uploads",()=>{
 assert.match(body,/Regex\(/);assert.match(body,/Cloud acknowledgement was NOT tested/);
 assert.doesNotMatch(body,/saveBookings\(|CloudSyncManager|FirebaseFirestore|bookings\.add|bookings\.remove|prefs\.edit|\.runTransaction\(/);
});
