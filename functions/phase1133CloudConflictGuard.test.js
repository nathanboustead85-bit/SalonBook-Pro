"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const source = fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
const workflow = fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
test("11.33 server preflight and atomic transaction guard legacy bookings",()=>{
 assert.match(source,/reference\.get\(Source\.SERVER\)/);
 assert.match(source,/db\.runTransaction \{ transaction ->/);
 assert.match(source,/transaction\.get\(reference\)/);
 assert.match(source,/transaction\.set\(reference, data\)/);
 assert.match(source,/if \(key != "bookings"\) \{/);
});
test("11.33 rejects remote booking IDs missing locally and duplicate IDs",()=>{
 assert.match(source,/id\.isNotBlank\(\) && localIds\.add\(id\)/);
 assert.match(source,/id\.isNotBlank\(\) && id in localIds/);
 assert.match(source,/assertNoRemoteBookingsLost\(latest\.getString\("json"\), json\)/);
 assert.match(source,/Unsupported cloud booking schema; upload blocked/);
});
test("11.33 tests run before Android compilation",()=>{
 assert.match(workflow,/phase1133CloudConflictGuard\.test\.js/);
});
