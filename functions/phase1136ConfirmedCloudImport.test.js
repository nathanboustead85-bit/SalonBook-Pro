"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
const start=source.indexOf("private fun previewCloudOnlyImport(date: String)");
const end=source.indexOf("private fun showCalendar()",start);
const body=source.slice(start,end);
test("11.36 offers opt-in cloud-only import, never automatic",()=>{
 assert.ok(start>0&&end>start);
 assert.match(source,/button\("Review cloud-only appointment import"\)/);
 assert.match(body,/setPositiveButton\("Check and import"\)/);
 assert.match(body,/setNegativeButton\("Cancel", null\)/);
 assert.match(body,/id in originalIds/);
});
test("11.36 rechecks cloud and phone snapshots before local changes",()=>{
 assert.match(body,/reference\.get\(Source\.SERVER\)/);
 assert.match(body,/fresh\.getString\("json"\) == snapshotJson/);
 assert.match(body,/prefs\.getString\("bookings", "\[\]"\) == originalJson/);
 assert.match(body,/FirebaseAuth\.getInstance\(\)\.currentUser\?\.uid == owner\.uid/);
 assert.match(body,/seen\.add\(id\)/);
 assert.match(body,/combined\.none/);
 assert.match(body,/toMinutes\(existing\.time\)/);
});
test("11.36 local-only additive import, no server write",()=>{
 assert.match(body,/prefs\.edit\(\)\.putString\("bookings", array\.toString\(\)\)\.commit\(\)/);
 assert.doesNotMatch(body,/CloudSyncManager\(\)\.upload|transaction\.set|reference\.set/);
 assert.match(workflow,/phase1136ConfirmedCloudImport\.test\.js/);
});
