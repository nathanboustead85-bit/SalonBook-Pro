"use strict";
/** Phase 11.56: disposable Firestore emulator stress tests; no production access. */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const admin=require("firebase-admin");
const projectId="demo-boustio-phase-1156";
if(process.env.GCLOUD_PROJECT!==projectId||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080")
 throw Error("Phase 11.56 must run against the isolated Firestore emulator");
const a=admin.initializeApp({projectId},"phase1156-a"),b=admin.initializeApp({projectId},"phase1156-b");
const db=a.firestore(),other=b.firestore(),ref=db.doc("users/phase1156-disposable/liveData/bookings");
const item=(id,time)=>({id,client:id,date:"2026-11-11",time,service:"Cut"});
const original=[item("one","09:00"),item("two","11:30")],encode=JSON.stringify;
const payload=x=>({json:encode(x),schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
function device(){return {owner:"phase1156-disposable",local:encode(original),ack:encode(original),pending:null}}
function edit(p,bookings){p.local=encode(bookings);p.pending=p.local;return p.pending}
function confirm(p,submitted){if(p.local===submitted&&p.pending===submitted){p.ack=submitted;p.pending=null}}
function indexed(arr){const map=new Map();for(const x of arr){if(!x.id||map.has(x.id))throw Error("invalid booking ID");map.set(x.id,x)}return map}
async function upload(submitted,baseline,hook){
 const pre=await ref.get();
 if(!pre.exists||pre.get("schemaVersion")!==1||typeof pre.get("json")!=="string")throw Error("invalid server snapshot");
 const remote=indexed(JSON.parse(pre.get("json"))),local=indexed(JSON.parse(submitted)),trusted=baseline?indexed(JSON.parse(baseline)):null;
 for(const [id,booking] of remote){
  if(!local.has(id))throw Error("cloud-only booking protected");
  if(encode(local.get(id))!==encode(booking)&&(!trusted||encode(trusted.get(id))!==encode(booking)))
   throw Error("stale booking protected");
 }
 if(hook)await hook();
 await db.runTransaction(async tx=>{
  const latest=await tx.get(ref);
  if(!latest.exists||latest.get("schemaVersion")!==1||typeof latest.get("json")!=="string"||latest.get("json")!==pre.get("json"))
   throw Error("cloud changed during transaction");
  tx.set(ref,{json:submitted,schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 });
}
test("11.56 two devices: first edit succeeds, stale second edit fails without lost bookings",async()=>{
 await ref.set(payload(original));const first=device(),second=device();
 const editA=edit(first,[{...original[0],time:"09:30"},original[1]]);
 const editB=edit(second,[{...original[0],time:"10:00"},original[1]]);
 await upload(editA,first.ack);confirm(first,editA);
 await assert.rejects(upload(editB,second.ack),/stale booking/);
 assert.equal(first.pending,null);assert.equal(second.pending,editB);
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),[{...original[0],time:"09:30"},original[1]]);
});
test("11.56 offline server read failure leaves local edit and pending marker intact",async()=>{
 await ref.set(payload(original));const p=device(),proposal=edit(p,[{...original[0],time:"09:30"},original[1]]);
 // Simulate an unavailable server read before upload; never queue an automatic write.
 await assert.rejects(async()=>{throw Error("server unavailable")},/server unavailable/);
 assert.equal(p.pending,proposal);assert.equal(p.ack,encode(original));
 assert.deepEqual(JSON.parse((await ref.get()).get("json")),original);
});
test("11.56 concurrent cloud-only booking blocks stale upload and preserves pending edit",async()=>{
 await ref.set(payload(original));const p=device(),proposal=edit(p,[{...original[0],time:"09:30"},original[1]]);
 await other.doc(ref.path).set(payload([...original,item("remote-only","15:00")]));
 await assert.rejects(upload(proposal,p.ack),/cloud-only booking/);
 assert.equal(p.pending,proposal);
 assert.equal(JSON.parse((await ref.get()).get("json")).length,3);
});
test("11.56 changed cloud between preflight and transaction blocks upload",async()=>{
 await ref.set(payload(original));const p=device(),proposal=edit(p,[{...original[0],time:"09:30"},original[1]]);
 const newer=[{...original[0],time:"10:30"},original[1]];
 await assert.rejects(upload(proposal,p.ack,()=>other.doc(ref.path).set(payload(newer))),/cloud changed/);
 assert.equal(p.pending,proposal);assert.deepEqual(JSON.parse((await ref.get()).get("json")),newer);
});
test("11.56 malformed cloud snapshot rejects overwrite",async()=>{
 await ref.set({schemaVersion:1,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
 const p=device(),proposal=edit(p,[{...original[0],time:"09:30"},original[1]]);
 await assert.rejects(upload(proposal,p.ack),/invalid server snapshot/);
 assert.equal((await ref.get()).get("json"),undefined);assert.equal(p.pending,proposal);
});
test("11.56 delayed old acknowledgement cannot clear newer local edit",async()=>{
 await ref.set(payload(original));const p=device(),old=edit(p,[{...original[0],time:"09:30"},original[1]]);
 await upload(old,p.ack);
 const newer=edit(p,[{...original[0],time:"10:00"},original[1]]);
 confirm(p,old);
 assert.equal(p.pending,newer);assert.equal(p.ack,encode(original));
});
test("11.56 Android source retains server preflight, atomic checks and pending acknowledgement",()=>{
 const root=path.resolve(__dirname,"..");
 const cloud=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/CloudSyncManager.kt"),"utf8");
 const main=fs.readFileSync(path.join(root,"app/src/main/java/com/salonbook/pro/MainActivity.kt"),"utf8");
 assert.match(cloud,/reference\.get\(Source\.SERVER\)/);
 assert.match(cloud,/val latestServerJson = latest\.getString\("json"\)/);
 assert.match(cloud,/assertNoStaleBookingEdits\(latestServerJson, json, acknowledgedBookingsJson\)/);
 assert.match(main,/bookingSyncPendingJson/);assert.match(main,/bookingSyncAcknowledgedJson/);
});
test.after(async()=>{try{await ref.delete()}finally{await Promise.all([a.delete(),b.delete()])}});
