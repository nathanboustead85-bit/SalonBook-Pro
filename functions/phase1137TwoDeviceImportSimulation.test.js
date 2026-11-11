"use strict";
/**
 * Phase 11.37 — deterministic two-device import contract simulation.
 * This never connects to a real Firebase project or writes real appointments.
 * It models the existing Phase 11.36 opt-in import and its fail-closed guards.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
const workflow = fs.readFileSync(path.join(root,".github/workflows/boustio-phase-1130-android-persistence.yml"),"utf8");
const begin = source.indexOf("private fun previewCloudOnlyImport(date: String)");
const end = source.indexOf("private fun showCalendar()",begin);
const android = source.slice(begin,end);
const existing = Object.freeze({id:"local-1",date:"2026-11-11",time:"09:00",duration:30,staffId:"staff-1",client:"Existing"});
const remote = Object.freeze({id:"cloud-2",date:"2026-11-11",time:"10:00",duration:30,staffId:"staff-1",client:"Other device"});
const clone = value => structuredClone(value);
const minutes = time => Number(time.slice(0,2))*60 + Number(time.slice(3,5));
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function importPreview({phone,cloud,confirmed,cloudAtConfirmation=cloud,phoneAtConfirmation=phone,ownerValid=true}) {
  const original = clone(phone);
  if (!confirmed) return original;
  if (!ownerValid) throw Error("Account changed");
  if (!same(cloud,cloudAtConfirmation) || !same(phone,phoneAtConfirmation)) throw Error("Snapshot changed");
  const ids = new Set();
  for (const item of cloud) {
    if (!item.id || ids.has(item.id)) throw Error("Invalid cloud booking ID");
    ids.add(item.id);
  }
  const result = clone(phone);
  for (const item of cloud) {
    if (result.some(local => local.id===item.id)) continue;
    if (!item.id || !item.client || !item.staffId || item.duration<=0) throw Error("Incomplete appointment");
    if (result.some(local => local.date===item.date && local.staffId===item.staffId &&
      minutes(local.time)<minutes(item.time)+item.duration &&
      minutes(item.time)<minutes(local.time)+local.duration)) throw Error("Overlap");
    result.push(clone(item));
  }
  return result;
}
test("11.37 other-device booking imports only after explicit confirmation",()=>{
  assert.deepEqual(importPreview({phone:[existing],cloud:[existing,remote],confirmed:false}),[existing]);
  assert.deepEqual(importPreview({phone:[existing],cloud:[existing,remote],confirmed:true}),[existing,remote]);
});
test("11.37 repeated import is idempotent and preserves existing bookings",()=>{
  const first=importPreview({phone:[existing],cloud:[existing,remote],confirmed:true});
  assert.deepEqual(importPreview({phone:first,cloud:[existing,remote],confirmed:true}),first);
});
test("11.37 changed cloud or phone between preview and confirmation blocks import",()=>{
  assert.throws(()=>importPreview({phone:[existing],cloud:[existing,remote],confirmed:true,cloudAtConfirmation:[existing]}),/Snapshot changed/);
  assert.throws(()=>importPreview({phone:[existing],cloud:[existing,remote],confirmed:true,phoneAtConfirmation:[]}),/Snapshot changed/);
});
test("11.37 overlapping appointments and invalid cloud IDs fail closed",()=>{
  assert.throws(()=>importPreview({phone:[existing],cloud:[existing,{...remote,time:"09:15"}],confirmed:true}),/Overlap/);
  assert.throws(()=>importPreview({phone:[existing],cloud:[existing,remote,remote],confirmed:true}),/Invalid cloud booking ID/);
});
test("11.37 account switch and incomplete remote booking block import",()=>{
  assert.throws(()=>importPreview({phone:[existing],cloud:[existing,remote],confirmed:true,ownerValid:false}),/Account changed/);
  assert.throws(()=>importPreview({phone:[existing],cloud:[existing,{...remote,staffId:""}],confirmed:true}),/Incomplete/);
});
test("11.37 Android integration retains confirmation and server recheck; no cloud writes",()=>{
  assert.ok(begin>0&&end>begin);
  assert.match(android,/setPositiveButton\("Check and import"\)/);
  assert.match(android,/fresh\.getString\("json"\) == snapshotJson/);
  assert.match(android,/prefs\.getString\("bookings", "\[\]"\) == originalJson/);
  assert.match(android,/combined\.none/);
  assert.doesNotMatch(android,/CloudSyncManager\(\)\.upload|reference\.set\(|transaction\.set\(/);
  assert.match(workflow,/phase1137TwoDeviceImportSimulation\.test\.js/);
});
