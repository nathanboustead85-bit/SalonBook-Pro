"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
test("11.35 calendar shows server-only read-only booking differences",()=>{
 assert.match(source,/private fun showCloudBookingDifferences\(date: String\)/);
 assert.match(source,/showCloudBookingDifferences\(selectedDate\)/);
 assert.match(source,/document\("bookings"\)\.get\(Source\.SERVER\)/);
 assert.match(source,/Cloud only:/);
 assert.match(source,/Changed on cloud:/);
 assert.match(source,/Phone only:/);
 assert.match(source,/No bookings were imported or overwritten/);
});
test("11.35 validates schema, identity, booking IDs, and navigation",()=>{
 assert.match(source,/check\(document\.getLong\("schemaVersion"\) == 1L\)/);
 assert.match(source,/seen\.add\(id\)/);
 assert.match(source,/selectedDate != date/);
 assert.match(source,/currentUser\?\.uid != owner\.uid/);
});
test("11.35 does not import server snapshot in preview",()=>{
 const begin=source.indexOf("private fun showCloudBookingDifferences");
 const end=source.indexOf("private fun previewCloudOnlyImport(",begin);
 assert.ok(begin>=0&&end>begin);
 const preview=source.slice(begin,end);
 assert.doesNotMatch(preview,/prefs\.edit\(|saveBookings\(|bookings\.add\(|\.set\(/);
 assert.match(workflow,/phase1135CloudDifferencePreview\.test\.js/);
});
