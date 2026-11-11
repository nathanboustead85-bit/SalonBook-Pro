"use strict";
/** Phase 11.40: real Firestore emulator recovery scenarios, no production access.
 * Two isolated admin clients model two phones; Android import safeguards are
 * separately asserted against the actual MainActivity implementation.
 */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1140";
if(process.env.GCLOUD_PROJECT!==projectId ||
   process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
  throw Error("Phase 11.40 refuses non-isolated Firestore connections");
const appA=admin.initializeApp({projectId},"phase1140-phone");
const appB=admin.initializeApp({projectId},"phase1140-other-device");
const phone=appA.firestore(),other=appB.firestore();
const doc=phone.doc("users/phase1140-fixture/liveData/bookings");
const booking=(id,time)=>({id,client:id,service:"Cut",date:"2026-11-11",time,
  notes:"",serviceId:"cut",staffId:"staff-1",duration:30,price:"20"});
const original=booking("original","09:00"),remote=booking("cloud-only","10:00");
const payload=items=>({json:JSON.stringify(items),schemaVersion:1,
  updatedAt:admin.firestore.FieldValue.serverTimestamp()});
const parse=snap=>JSON.parse(snap.get("json"));
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5));
function guardedImport(local,preview,fresh,approved){
  if(!approved)return structuredClone(local);
  if(preview.get("json")!==fresh.get("json"))throw Error("cloud changed");
  const existing=new Set(local.map(x=>x.id)),incoming=parse(fresh).filter(x=>!existing.has(x.id));
  if(incoming.some((x,i)=>[...local,...incoming.slice(0,i)].some(y=>
    y.id===x.id || (x.date===y.date&&x.staffId===y.staffId&&
    minutes(x.time)<minutes(y.time)+y.duration&&
    minutes(y.time)<minutes(x.time)+x.duration))))throw Error("overlap");
  return [...structuredClone(local),...incoming];
}
test("11.40 genuine emulator cloud-only recovery requires consent and is idempotent",async()=>{
  await doc.set(payload([original]));
  const local=parse(await doc.get());
  await other.doc(doc.path).set(payload([original,remote]));
  const preview=await doc.get();
  assert.deepEqual(parse(preview),[original,remote]);
  assert.deepEqual(guardedImport(local,preview,preview,false),local);
  const fresh=await doc.get();
  const imported=guardedImport(local,preview,fresh,true);
  assert.deepEqual(imported,[original,remote]);
  assert.deepEqual(guardedImport(imported,fresh,fresh,true),imported);
  assert.deepEqual(parse(await doc.get()),[original,remote],"local import never writes server");
});
test("11.40 server edit between preview and confirmation cancels recovery",async()=>{
  await doc.set(payload([original,remote]));
  const preview=await doc.get();
  await other.doc(doc.path).set(payload([original,{...remote,time:"10:30"}]));
  const fresh=await doc.get();
  assert.throws(()=>guardedImport([original],preview,fresh,true),/cloud changed/);
});
test("11.40 overlapping remote booking cannot displace existing appointment",async()=>{
  const overlapping=booking("conflict","09:15");
  await other.doc(doc.path).set(payload([original,overlapping]));
  const snapshot=await doc.get();
  assert.throws(()=>guardedImport([original],snapshot,snapshot,true),/overlap/);
});
test("11.40 Android calendar implements server recheck and local-only confirmation",()=>{
  const source=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
  const start=source.indexOf("private fun previewCloudOnlyImport(date: String)");
  const end=source.indexOf("private fun showCalendar()",start);
  assert.ok(start>0&&end>start);
  const body=source.slice(start,end);
  assert.match(body,/setPositiveButton\("Check and import"\)/);
  assert.match(body,/reference\.get\(Source\.SERVER\)/);
  assert.match(body,/fresh\.getString\("json"\) == snapshotJson/);
  assert.match(body,/prefs\.getString\("bookings", "\[\]"\) == originalJson/);
  assert.match(body,/combined\.none/);
  assert.match(body,/prefs\.edit\(\)\.putString\("bookings", array\.toString\(\)\)\.commit\(\)/);
  assert.doesNotMatch(body,/CloudSyncManager\(\)\.upload|reference\.set\(/);
});
test.after(async()=>{
  try{await doc.delete();}finally{await Promise.all([appA.delete(),appB.delete()]);}
});
