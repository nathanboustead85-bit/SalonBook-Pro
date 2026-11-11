"use strict";
/** Phase 11.51: isolated phone save/ack/rejection lifecycle against Firestore.
 * A model of the Android persistence flow, not Android device instrumentation.
 * Production Firebase and real bookings are never accessed.
 */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin"),projectId="demo-boustio-phase-1151";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Refusing Phase 11.51 outside isolated Firestore emulator");
const appA=admin.initializeApp({projectId},"phase1151-phone"),appB=admin.initializeApp({projectId},"phase1151-second");
const db=appA.firestore(),second=appB.firestore(),ref=db.doc("users/phase1151-disposable/liveData/bookings");
const booking=(id,time)=>({id,client:id,service:"Cut",date:"2026-11-11",time,notes:"",serviceId:"cut",staffId:"staff",duration:30,price:20});
const initial=[booking("first","09:00"),booking("second","11:30")];
const json=x=>JSON.stringify(x);
const payload=x=>({json:json(x),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
function phone(){return {owner:"isolated-user",bookings:json(initial),ackOwner:"isolated-user",ack:json(initial),pendingOwner:null,pending:null}}
function localEdit(p,items){const proposed=json(items);p.bookings=proposed;p.pendingOwner=p.owner;p.pending=proposed;return proposed}
function acknowledge(p,owner,proposed){if(p.owner===owner&&p.pendingOwner===owner&&p.pending===proposed&&p.bookings===proposed){p.pending=null;p.pendingOwner=null;p.ack=proposed;p.ackOwner=owner}}
async function guardedUpload(proposed,baseline,{beforeTransaction}={}){
 const pre=await ref.get();
 if(!pre.exists||pre.get("schemaVersion")!==1||typeof pre.get("json")!=="string")throw Error("cloud unverified");
 const server=JSON.parse(pre.get("json")),phone=JSON.parse(proposed),ack=baseline?JSON.parse(baseline):null;
 const unique=arr=>{const m=new Map();for(const x of arr){if(!x.id||m.has(x.id))throw Error("duplicate booking");m.set(x.id,x)}return m};
 const cloud=unique(server),local=unique(phone),trusted=ack?unique(ack):null;
 for(const [id,remote] of cloud){if(!local.has(id))throw Error("cloud-only booking");
  if(json(local.get(id))!==json(remote)&&(!trusted||json(trusted.get(id))!==json(remote)))throw Error("stale edit");
 }
 if(beforeTransaction)await beforeTransaction();
 await db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(!latest.exists||latest.get("json")!==pre.get("json"))throw Error("concurrent edit");
  tx.set(ref,{json:proposed,schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 });
}
test("11.51 successful edit: local save, server confirmation, then clear pending and advance baseline",async()=>{
 await ref.set(payload(initial));const p=phone(),edited=[{...initial[0],time:"09:30"},initial[1]];
 const proposed=localEdit(p,edited);assert.equal(p.pending,proposed);assert.equal(p.ack,json(initial));
 await guardedUpload(proposed,p.ack);acknowledge(p,p.owner,proposed);
 assert.equal(p.pending,null);assert.equal(p.ack,proposed);assert.equal(p.bookings,proposed);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),edited);
});
test("11.51 rejected stale edit: preserve phone proposal, pending marker, old acknowledged baseline and newer server booking",async()=>{
 await ref.set(payload(initial));const p=phone(),proposed=localEdit(p,[{...initial[0],time:"09:30"},initial[1]]);
 const newer=[{...initial[0],time:"10:00"},initial[1]];
 await second.doc(ref.path).set(payload(newer));
 await assert.rejects(guardedUpload(proposed,p.ack),/stale edit/);
 assert.equal(p.bookings,proposed);assert.equal(p.pending,proposed);assert.equal(p.ack,json(initial));
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),newer);
});
test("11.51 older acknowledgement cannot clear a newer unsent phone edit",async()=>{
 await ref.set(payload(initial));const p=phone(),first=localEdit(p,[{...initial[0],time:"09:30"},initial[1]]);
 await guardedUpload(first,p.ack);
 const newer=localEdit(p,[{...initial[0],time:"10:00"},initial[1]]);
 acknowledge(p,p.owner,first);
 assert.equal(p.pending,newer);assert.equal(p.bookings,newer);assert.equal(p.ack,json(initial));
});
test("11.51 concurrent server change cannot clear pending or overwrite newer server edit",async()=>{
 await ref.set(payload(initial));const p=phone(),proposed=localEdit(p,[{...initial[0],time:"09:30"},initial[1]]);
 const remote=[{...initial[0],time:"10:00"},initial[1]];
 await assert.rejects(guardedUpload(proposed,p.ack,{beforeTransaction:()=>second.doc(ref.path).set(payload(remote))}),/concurrent edit/);
 assert.equal(p.pending,proposed);assert.equal(p.ack,json(initial));
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),remote);
});
test("11.51 Android implementation retains pending marker and rejects stale callbacks",()=>{
 const src=fs.readFileSync(path.join(__dirname,"../app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
 const start=src.indexOf("private fun saveBookings()"),end=src.indexOf("private fun loadBookings()",start),body=src.slice(start,end);
 assert.ok(start>0&&end>start);
 for(const marker of ['putString("bookings", json)','putString("bookingSyncPendingOwner", ownerAtSave.uid)','putString("bookingSyncPendingJson", json)','bookingSyncAcknowledgedJson','result.isSuccess','bookingSyncPendingJson", null) == json','Saved on phone; cloud sync not confirmed'])assert.ok(body.includes(marker),marker);
 assert.match(body,/\.remove\("bookingSyncPendingOwner"\)/);
});
test.after(async()=>{try{await ref.delete()}finally{await Promise.all([appA.delete(),appB.delete()])}});
