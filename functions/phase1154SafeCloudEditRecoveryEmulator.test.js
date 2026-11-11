"use strict";
/** Phase 11.54: verify Android fail-closed cloud edits and isolated emulator recovery. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin"),projectId="demo-boustio-phase-1154";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Phase 11.54 requires disposable Firestore emulator");
const app=admin.initializeApp({projectId},"phase1154-phone");
const db=app.firestore(),ref=db.doc("users/phase1154-disposable/liveData/bookings");
const original=[{id:"demo-a",client:"Demo",date:"2026-11-11",time:"09:00"},{id:"demo-b",client:"Demo 2",date:"2026-11-11",time:"11:30"}];
const proposed=[{...original[0],time:"09:30"},original[1]];
const data=x=>({json:JSON.stringify(x),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
async function safeEdit(baseline){
 const pre=await ref.get();
 if(!pre.exists||pre.get("schemaVersion")!==1||typeof pre.get("json")!=="string")
  throw Error("cloud booking document invalid");
 const remote=JSON.parse(pre.get("json"));
 if(remote.some(x=>!proposed.find(y=>y.id===x.id)))throw Error("cloud-only appointment");
 for(const r of remote){const p=proposed.find(x=>x.id===r.id);
  if(JSON.stringify(p)!==JSON.stringify(r)&&(!baseline||JSON.stringify(baseline.find(x=>x.id===r.id))!==JSON.stringify(r)))throw Error("stale edit");
 }
 await db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(!latest.exists||latest.get("json")!==pre.get("json")||latest.get("schemaVersion")!==1)
   throw Error("cloud changed");
  if(typeof latest.get("json")!=="string")throw Error("missing json");
  tx.set(ref,data(proposed));
 });
}
test("11.54 malformed cloud document fails closed and preserves document",async()=>{
 await ref.set({schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 await assert.rejects(safeEdit(original),/invalid/);
 assert.equal((await ref.get()).get("json"),undefined);
});
test("11.54 invalid schema fails closed without replacing server data",async()=>{
 await ref.set({...data(original),schemaVersion:2});
 await assert.rejects(safeEdit(original),/invalid/);
 assert.equal((await ref.get()).get("schemaVersion"),2);
});
test("11.54 matching baseline safely commits edit and preserves second booking",async()=>{
 await ref.set(data(original));await safeEdit(original);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),proposed);
});
test("11.54 stale baseline rejects edit, preserving server appointments",async()=>{
 const changed=[{...original[0],time:"10:00"},original[1]];
 await ref.set(data(changed));
 await assert.rejects(safeEdit(original),/stale edit/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),changed);
});
test("11.54 Android code explicitly rejects missing JSON at both guard points",()=>{
 const sync=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
 assert.match(sync,/val verifiedServerJson = preflight.getString\("json"\)\s*\?: error\("Cloud booking snapshot missing JSON; upload blocked"\)/);
 assert.match(sync,/val latestServerJson = latest.getString\("json"\)\s*\?: error\("Cloud booking snapshot missing JSON; upload blocked"\)/);
 assert.match(sync,/assertNoStaleBookingEdits\(verifiedServerJson, json, acknowledgedBookingsJson\)/);
 assert.match(sync,/assertNoStaleBookingEdits\(latestServerJson, json, acknowledgedBookingsJson\)/);
});
test.after(async()=>{try{await ref.delete()}finally{await app.delete()}});
