"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const a=src.indexOf("private fun showSharedCloudAppointments("),b=src.indexOf("// Phase 11.32:",a),body=src.slice(a,b);
test("11.63 website feed stays distinct from legacy phone bookings",()=>{assert.ok(a>0&&b>a);assert.match(body,/collection\("businesses"\)/);assert.match(body,/collection\("appointments"\)/);assert.match(body,/read only · not imported/);});
test("11.63 warns about possible same-start-time collisions",()=>{assert.match(body,/localAtDisplay = bookings\.filter/);assert.match(body,/localStarts/);assert.match(body,/websiteStarts/);assert.match(body,/POSSIBLE TIME COLLISION/);});
test("11.63 explicitly avoids claiming definitive staff-aware conflicts",()=>{assert.match(body,/staff and duration must be reviewed manually/);assert.match(body,/possible same-start-time collision/);});
test("11.63 feed does not write, import or mutate bookings",()=>{assert.doesNotMatch(body,/\.set\(|\.update\(|\.delete\(|runTransaction|saveBookings\(|prefs\.edit\(|CloudSyncManager\.upload/);});
