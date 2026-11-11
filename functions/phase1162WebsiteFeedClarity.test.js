"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const a=src.indexOf("private fun showSharedCloudAppointments("),b=src.indexOf("private fun showLegacyMultiDeviceReadiness(",a),body=src.slice(a,b);
test("11.62 shared feed explicitly distinguished from phone booking backup",()=>{assert.ok(a>0&&b>a);assert.match(body,/Website\/shared appointments · separate cloud feed/);assert.match(body,/separate feed from your phone bookings/);});
test("11.62 reads only website appointment collection",()=>{assert.match(body,/collection\("businesses"\)/);assert.match(body,/collection\("appointments"\)/);assert.match(body,/addSnapshotListener/);assert.doesNotMatch(body,/\.set\(|\.update\(|\.delete\(|saveBookings\(|CloudSyncManager\.upload/);});
test("11.62 empty and error states avoid false missing-booking warnings",()=>{assert.match(body,/No website\/shared appointments on this date/);assert.match(body,/does not mean your phone appointments are missing/);assert.match(body,/Website\/shared feed unavailable/);});
test("11.62 website items remain read-only and not silently imported",()=>{assert.match(body,/read only · not imported/);assert.match(body,/status == "cancelled"/);assert.match(body,/sortedBy/);});
