"use strict";
// Phase 12.29: emulator-only concurrency rehearsal, NEVER run on production.
const assert=require("node:assert/strict");
const admin=require("../functions/node_modules/firebase-admin");
const {auditLegacyBookings}=require("../functions/legacyBookingAudit");
const {sealSnapshot,verifySnapshot}=require("../functions/migrationRecoveryRehearsal");
if(process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080" ||
   process.env.GCLOUD_PROJECT!=="demo-boustio-phase1229")
  throw Error("REFUSING: expected disposable Phase 12.29 emulator only");
admin.initializeApp({projectId:"demo-boustio-phase1229"});
const db=admin.firestore(),owner="phase1229-test-owner";
const root=db.collection("businesses").doc(owner);
const legacy=db.collection("users").doc(owner).collection("liveData").doc("bookings");
const marker=root.collection("migrations").doc("android-bookings-v1");
const mode=root.collection("settings").doc("bookingMode");
const bookings=[
 {id:"race-a",staffId:"staff-1",date:"2026-11-20",time:"09:00",duration:30},
 {id:"race-b",staffId:"staff-1",date:"2026-11-20",time:"11:30",duration:30}
];
const sealed=sealSnapshot(JSON.stringify(bookings));
const locks=auditLegacyBookings(sealed.json).lockPlan;
const appts=bookings.map(b=>root.collection("appointments").doc(b.id));
const lockRefs=locks.map(l=>root.collection("bookingLocks").doc(l.lockId));
async function reset(){
 for(const name of ["appointments","bookingLocks","migrations","settings"]){
  const docs=await root.collection(name).get();
  for(const d of docs.docs)await d.ref.delete();
 }
 await legacy.set({json:sealed.json});
 await mode.set({liveBookingsEnabled:false});
}
async function migrate(label,{beforeCommit}={}){
 return db.runTransaction(async tx=>{
  const original=await tx.get(legacy);
  if(original.get("json")!==sealed.json)throw Error("Legacy snapshot changed");
  assert.deepEqual(verifySnapshot(sealed),bookings);
  if((await tx.get(marker)).exists)throw Error("Already migrated");
  const currentAppts=await Promise.all(appts.map(ref=>tx.get(ref)));
  const currentLocks=await Promise.all(lockRefs.map(ref=>tx.get(ref)));
  if(currentAppts.some(s=>s.exists)||currentLocks.some(s=>s.exists))
   throw Error("Appointment or lock conflict");
  if(beforeCommit)await beforeCommit();
  bookings.forEach((b,i)=>tx.create(appts[i],{...b,source:label}));
  locks.forEach((l,i)=>tx.create(lockRefs[i],{bookingId:l.bookingId}));
  tx.create(marker,{source:label,count:bookings.length});
 },{maxAttempts:5});
}
async function count(name){return (await root.collection(name).get()).size;}
async function checkCommitted(){
 assert.equal(await count("appointments"),2);
 assert.equal(await count("bookingLocks"),locks.length);
 assert.equal((await marker.get()).exists,true);
 assert.equal((await legacy.get()).get("json"),sealed.json);
 assert.equal((await mode.get()).get("liveBookingsEnabled"),false);
}
async function run(){
 await reset();
 const simultaneous=await Promise.allSettled([migrate("device-a"),migrate("device-b")]);
 assert.equal(simultaneous.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(simultaneous.filter(x=>x.status==="rejected").length,1);
 await checkCommitted();
 console.log("PASS two simultaneous migrations yield exactly one winner");
 assert.equal(new Set((await root.collection("appointments").get()).docs.map(d=>d.id)).size,2);
 console.log("PASS simultaneous attempts produce no duplicate appointments or locks");
 const winner=(await marker.get()).get("source");
 assert.equal((await appts[0].get()).get("source"),winner);
 assert.equal((await appts[1].get()).get("source"),winner);
 console.log("PASS winning transaction owns all appointment records");
 await assert.rejects(migrate("third-device"),/Already migrated/);
 await checkCommitted();
 console.log("PASS subsequent device cannot replay migration");
 await reset();
 // A concurrent modification after transaction reads forces retry or rejection.
 let altered=false;
 const delayed=migrate("stale-device",{beforeCommit:async()=>{
  if(!altered){
   altered=true;
   await appts[0].set({preexisting:true});
  }
 }});
 await assert.rejects(delayed,/Appointment or lock conflict/);
 assert.equal((await appts[0].get()).get("preexisting"),true);
 assert.equal(await count("appointments"),1);
 assert.equal(await count("bookingLocks"),0);
 assert.equal((await marker.get()).exists,false);
 assert.equal((await mode.get()).get("liveBookingsEnabled"),false);
 console.log("PASS concurrent appointment creation blocks stale migration without overwrite");
 await reset();
 let lockAltered=false;
 await assert.rejects(migrate("stale-lock-device",{beforeCommit:async()=>{
  if(!lockAltered){lockAltered=true;await lockRefs[0].set({preexisting:true});}
 }}),/Appointment or lock conflict/);
 assert.equal((await lockRefs[0].get()).get("preexisting"),true);
 assert.equal(await count("appointments"),0);
 assert.equal(await count("bookingLocks"),1);
 assert.equal((await marker.get()).exists,false);
 console.log("PASS concurrent lock creation blocks stale migration without overwrite");
 await reset();
 assert.equal(await count("appointments"),0);
 assert.equal(await count("bookingLocks"),0);
 assert.equal((await marker.get()).exists,false);
 console.log("PASS isolated emulator records cleaned up");
}
run().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
