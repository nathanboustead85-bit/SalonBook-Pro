"use strict";
/** Phase 11.50: two independent emulator clients and disposable bookings.
 * Models the Phase 11.46 Android transaction guard, not Android instrumentation.
 * Does not connect to production or touch real customer appointments.
 */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1150";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Phase 11.50 requires isolated Firestore emulator");
const appA=admin.initializeApp({projectId},"phase1150-phone"),appB=admin.initializeApp({projectId},"phase1150-other");
const db=appA.firestore(),other=appB.firestore(),ref=db.doc("users/phase1150-disposable/liveData/bookings");
const booking=(id,time)=>({id,client:id,service:"Cut",date:"2026-11-11",time,notes:"",serviceId:"cut",staffId:"staff",duration:30,price:20});
const first=booking("first","09:00"),second=booking("second","11:30");
const payload=items=>({json:JSON.stringify(items),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
const map=items=>{const m=new Map();for(const x of items){if(!x.id||m.has(x.id))throw Error("invalid or duplicate booking");m.set(x.id,x)}return m};
async function guardedEdit(proposed,baseline,{beforeTransaction}={}){
 const pre=await ref.get();
 if(!pre.exists||pre.get("schemaVersion")!==1||typeof pre.get("json")!=="string")throw Error("unverified cloud");
 const cloud=map(JSON.parse(pre.get("json"))),local=map(proposed),trusted=baseline===null?null:map(baseline);
 for(const [id,item] of cloud){
  if(!local.has(id))throw Error("cloud-only booking missing");
  if(JSON.stringify(item)!==JSON.stringify(local.get(id))&&(!trusted||JSON.stringify(trusted.get(id))!==JSON.stringify(item)))
   throw Error("stale same-ID booking");
 }
 if(beforeTransaction)await beforeTransaction();
 await db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(!latest.exists||latest.get("json")!==pre.get("json"))throw Error("concurrent cloud change");
  tx.set(ref,payload(proposed));
 });
}
test("11.50 verified baseline permits editing a booking while cloud is unchanged",async()=>{
 await ref.set(payload([first,second]));
 const edited={...first,time:"09:30"};
 await guardedEdit([edited,second],[first,second]);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[edited,second]);
});
test("11.50 second device edit after baseline blocks stale phone edit",async()=>{
 await ref.set(payload([first,second]));
 const remote={...first,time:"10:00"};
 await other.doc(ref.path).set(payload([remote,second]));
 await assert.rejects(guardedEdit([{...first,time:"09:30"},second],[first,second]),/stale same-ID/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[remote,second]);
});
test("11.50 concurrent update between preflight and transaction blocks overwrite",async()=>{
 await ref.set(payload([first,second]));
 const remote={...first,time:"10:00"};
 await assert.rejects(guardedEdit([{...first,time:"09:30"},second],[first,second],{
  beforeTransaction:()=>other.doc(ref.path).set(payload([remote,second]))
 }),/concurrent cloud change/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[remote,second]);
});
test("11.50 no baseline cannot edit existing cloud booking",async()=>{
 await ref.set(payload([first,second]));
 await assert.rejects(guardedEdit([{...first,time:"09:30"},second],null),/stale same-ID/);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[first,second]);
});
test("11.50 Android guards source matches modeled preflight, baseline and transaction",()=>{
 const sync=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
 const main=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
 for(const fragment of ["assertNoStaleBookingEdits","assertNoRemoteBookingsLost","db.runTransaction","get(Source.SERVER)"])assert.ok(sync.includes(fragment),fragment);
 assert.match(main,/putString\("bookingSyncAcknowledgedJson", serverJson\)/);
 assert.match(main,/bookingSyncAcknowledgedOwner/);
});
test.after(async()=>{try{await ref.delete()}finally{await Promise.all([appA.delete(),appB.delete()])}});
