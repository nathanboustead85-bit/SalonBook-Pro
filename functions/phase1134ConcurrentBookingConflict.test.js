"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const source = fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
const workflow = fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");

// Model the fail-closed transaction contract using two simulated devices.
// This is a deterministic concurrency simulation, NOT a Firebase emulator
// integration test or proof of production multi-device synchronization.
function guardedUpload(preflight, latest, local) {
  if (JSON.stringify(preflight) !== JSON.stringify(latest)) {
    throw new Error("Cloud bookings changed during upload");
  }
  const localIds = new Set();
  for (const booking of local || []) {
    if (!booking.id || localIds.has(booking.id)) throw new Error("Invalid local booking ID");
    localIds.add(booking.id);
  }
  for (const booking of latest || []) {
    if (!booking.id || !localIds.has(booking.id)) throw new Error("Cloud booking missing locally");
  }
  return structuredClone(local);
}
const a = {id:"A", date:"2026-11-11", start:"09:00"};
const b = {id:"B", date:"2026-11-11", start:"10:00"};

test("11.34 simulated device B adds booking after device A preflight: reject",()=>{
  assert.throws(()=>guardedUpload([a],[a,b],[a]),/changed/);
});
test("11.34 simulated device B edits booking after device A preflight: reject",()=>{
  assert.throws(()=>guardedUpload([a],[{...a,start:"09:30"}],[a]),/changed/);
});
test("11.34 simulated device B deletes booking after device A preflight: reject",()=>{
  assert.throws(()=>guardedUpload([a],[],[a]),/changed/);
});
test("11.34 stale device cannot remove a cloud booking already present at preflight",()=>{
  assert.throws(()=>guardedUpload([a,b],[a,b],[a]),/missing locally/);
});
test("11.34 unchanged cloud snapshot permits valid new local booking",()=>{
  assert.deepEqual(guardedUpload([a],[a],[a,b]),[a,b]);
});
test("11.34 rejects duplicate booking IDs",()=>{
  assert.throws(()=>guardedUpload([a],[a],[a,a]),/Invalid local booking ID/);
});
test("11.34 Android source checks transaction snapshot against preflight",()=>{
  assert.match(source,/db\.runTransaction \{ transaction ->/);
  assert.match(source,/latest\.exists\(\) == preflight\.exists\(\)/);
  assert.match(source,/latest\.getString\("json"\) == preflight\.getString\("json"\)/);
  assert.match(source,/transaction\.set\(reference, data\)/);
  assert.match(workflow,/phase1134ConcurrentBookingConflict\.test\.js/);
});
