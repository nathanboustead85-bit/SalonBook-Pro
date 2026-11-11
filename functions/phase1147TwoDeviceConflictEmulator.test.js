"use strict";
/** Phase 11.47: isolated Firestore emulator with two independent Admin clients.
 * This models Android's Phase 11.46 guard; it does not execute Android code.
 * Never writes production bookings or requires a second physical phone.
 */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1147";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Refusing Phase 11.47 outside isolated Firestore emulator");
const a=admin.initializeApp({projectId},"phase1147-a"),b=admin.initializeApp({projectId},"phase1147-b");
const db=a.firestore(),other=b.firestore(),ref=db.doc("users/phase1147-disposable/liveData/bookings");
const booking=(id,time)=>({id,client:id,service:"Cut",date:"2026-11-11",time,notes:"",serviceId:"cut",staffId:"staff",duration:30,price:20});
const one=booking("one","09:00"),two=booking("two","11:30");
const payload=items=>({json:JSON.stringify(items),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
const byId=items=>{const map=new Map();for(const item of items){if(!item.id||map.has(item.id))throw Error("duplicate ID");map.set(item.id,item)}return map};
async function guardedUpload(local,acknowledged){
 const preflight=await ref.get();
 if(!preflight.exists||preflight.get("schemaVersion")!==1)throw Error("unverified cloud");
 const remote=JSON.parse(preflight.get("json")),cloud=byId(remote),phone=byId(local),baseline=acknowledged===null?null:byId(acknowledged);
 for(const [id,item] of cloud){
  if(!phone.has(id))throw Error("cloud-only booking");
  if(JSON.stringify(phone.get(id))!==JSON.stringify(item)&&(!baseline||!baseline.has(id)||JSON.stringify(baseline.get(id))!==JSON.stringify(item)))
   throw Error("stale same-ID edit");
 }
 await db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(latest.get("json")!==preflight.get("json"))throw Error("concurrent edit");
  tx.set(ref,payload(local));
 });
}
test("11.47 stale same-ID edit cannot replace newer second-device change",async()=>{
 await ref.set(payload([one]));
 const acknowledged=[one];
 const newer={...one,time:"09:30"};
 await other.doc(ref.path).set(payload([newer]));
 await assert.rejects(guardedUpload([{...one,time:"10:00"}],acknowledged),/stale same-ID edit/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[newer]);
});
test("11.47 second-device new booking is not removed by stale phone",async()=>{
 await ref.set(payload([one]));
 await other.doc(ref.path).set(payload([one,two]));
 await assert.rejects(guardedUpload([one],[one]),/cloud-only booking/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[one,two]);
});
test("11.47 missing acknowledged baseline blocks changing an existing booking",async()=>{
 await ref.set(payload([one]));
 await assert.rejects(guardedUpload([{...one,time:"10:00"}],null),/stale same-ID edit/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[one]);
});
test("11.47 valid baseline permits an edit when cloud remains unchanged",async()=>{
 await ref.set(payload([one]));
 const edited={...one,time:"10:00"};
 await guardedUpload([edited],[one]);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[edited]);
});
test("11.47 Android source includes same-ID baseline and transactional guard",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
 assert.match(source,/assertNoStaleBookingEdits\(latestServerJson, json, acknowledgedBookingsJson\)/);
 assert.match(source,/val latestServerJson = latest\.getString\("json"\)\s*\?: error\("Cloud booking snapshot missing JSON; upload blocked"\)/);
 assert.match(source,/assertNoRemoteBookingsLost\(latestServerJson, json\)/);
 assert.match(source,/db\.runTransaction/);
});
test.after(async()=>{try{await ref.delete()}finally{await Promise.all([a.delete(),b.delete()])}});
