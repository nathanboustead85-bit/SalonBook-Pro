"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const main = fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const workflow = fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
const block = main.split("private fun showLegacyMultiDeviceReadiness(date: String) {")[1]?.split("private fun showCloudBookingDifferences(date: String) {")[0];
test("11.32 uses a verified owner's server snapshot rather than cache",()=>{
 assert.ok(block);
 assert.match(block,/owner\.isEmailVerified/);
 assert.match(block,/document\("bookings"\)\.get\(Source\.SERVER\)/);
 assert.match(block,/currentUser\?\.uid != owner\.uid/);
});
test("11.32 compares by appointment ID and date without writing data",()=>{
 assert.match(block,/cloudIds == localIds/);
 assert.match(block,/entry\.optString\("date"\) == date/);
 assert.doesNotMatch(block,/\.set\(|\.update\(|saveBookings\(|prefs\.edit\(/);
 assert.match(block,/Do not overwrite either copy/);
});
test("11.32 runs in Android CI alongside signing and persistence guards",()=>{
 assert.match(workflow,/phase1132MultiDeviceReadiness\.test\.js/);
 assert.match(workflow,/Phase 11\.32 multi-device readiness checks/);
});
