"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const a=src.indexOf("private fun diagnoseBookingRecoveryReadOnly("),b=src.indexOf("private fun showCalendar()",a),body=src.slice(a,b);
test("11.61 diagnostics accessible from calendar and debug-only",()=>{assert.ok(a>0&&b>a);assert.match(body,/if \(!BuildConfig\.DEBUG\) return/);assert.match(src,/button\("Recovery diagnostics · read only"\)/)});
test("11.61 verified owner, pending and server-only checks",()=>{assert.match(body,/owner\.isEmailVerified/);assert.match(body,/bookingSyncPendingOwner/);assert.match(body,/get\(Source\.SERVER\)/)});
test("11.61 validates cloud schema, JSON and unique IDs",()=>{assert.match(body,/schemaVersion/);assert.match(body,/getString\("json"\)/);assert.match(body,/ids\.add\(id\)/)});
test("11.61 stale callback cannot show misleading results",()=>{assert.match(body,/currentScreen != "calendar"/);assert.match(body,/selectedDate != date/);assert.match(body,/prefs\.getString\("bookings", "\[\]"\) != localAtStart/);});
test("11.61 fails closed and never writes or retries",()=>{assert.match(body,/CLOUD UNAVAILABLE/);assert.match(body,/ACTION NEEDED/);assert.doesNotMatch(body,/\.set\(|\.update\(|\.delete\(|runTransaction|prefs\.edit\(|saveBookings\(|CloudSyncManager\.upload/);});
