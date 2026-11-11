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
test("11.39 recovery rejects duplicate local IDs before preview and commit",()=>{
 assert.ok(start>0&&end>start);
 assert.match(body,/originalIds\.size != bookings\.size/);
 assert.match(body,/originalIds\.any \{ it\.isBlank\(\) \}/);
 assert.match(body,/check\(originalIds\.size == bookings\.size\)/);
});
test("11.39 recovery rejects invalid time and bookings crossing midnight",()=>{
 assert.match(body,/2\[0-3\]/);
 assert.match(body,/toMinutes\(candidate\.time\) \+ candidate\.duration <= 24 \* 60/);
});
test("11.39 recovery rejects overlapping cloud-only candidates before user confirmation",()=>{
 assert.match(body,/check\(candidates\.none \{ earlier ->/);
 assert.match(body,/earlier\.staffId == candidate\.staffId/);
 assert.match(body,/Cloud appointments overlap; import blocked/);
});
test("11.39 recovery remains opt-in, server-rechecked, additive and local only",()=>{
 assert.match(body,/setPositiveButton\("Check and import"\)/);
 assert.match(body,/fresh\.getString\("json"\) == snapshotJson/);
 assert.match(body,/prefs\.getString\("bookings", "\[\]"\) == originalJson/);
 assert.match(body,/prefs\.edit\(\)\.putString\("bookings", array\.toString\(\)\)\.commit\(\)/);
 assert.doesNotMatch(body,/CloudSyncManager\(\)\.upload|reference\.set\(/);
 assert.match(workflow,/phase1139AndroidRecoverySafety\.test\.js/);
});
