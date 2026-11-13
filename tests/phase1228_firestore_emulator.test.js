"use strict";
// Emulator-only transaction rehearsal. NEVER invoke against production.
const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const {sealSnapshot,verifySnapshot} = require("../functions/migrationRecoveryRehearsal");
const {auditLegacyBookings} = require("../functions/legacyBookingAudit");

if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" ||
    process.env.GCLOUD_PROJECT !== "demo-boustio-phase1228") {
  throw new Error("REFUSING: Phase 12.28 requires the isolated local Firestore emulator");
}
admin.initializeApp({projectId:"demo-boustio-phase1228"});
const db=admin.firestore();
const owner="phase1228-test-owner";
const root=db.collection("businesses").doc(owner);
const legacy=db.collection("users").doc(owner).collection("liveData").doc("bookings");
const marker=root.collection("migrations").doc("android-bookings-v1");
const mode=root.collection("settings").doc("bookingMode");
const items=[
  {id:"emulator-a",staffId:"staff-1",date:"2026-11-20",time:"09:00",duration:30},
  {id:"emulator-b",staffId:"staff-1",date:"2026-11-20",time:"11:30",duration:30}
];
const json=JSON.stringify(items),sealed=sealSnapshot(json);
const locks=auditLegacyBookings(json).lockPlan;
async function count(collection){return (await root.collection(collection).get()).size;}
async function reset(){
  for(const collection of ["appointments","bookingLocks","migrations","settings"]){
    const snap=await root.collection(collection).get();
    for(const doc of snap.docs)await doc.ref.delete();
  }
  await legacy.set({json,schemaVersion:1});
  await mode.set({liveBookingsEnabled:false});
}
async function transactionRehearsal({failAt=0,conflict=false}={}){
  return db.runTransaction(async tx=>{
    const original=await tx.get(legacy);
    assert.equal(original.get("json"),sealed.json);
    assert.deepEqual(verifySnapshot(sealed),items);
    const migration=await tx.get(marker);
    if(migration.exists)throw Error("Migration already recorded");
    const appointments=items.map(item=>root.collection("appointments").doc(item.id));
    const lockRefs=locks.map(lock=>root.collection("bookingLocks").doc(lock.lockId));
    // Firestore transactions require all reads before any writes.
    const appointmentSnaps=await Promise.all(appointments.map(ref=>tx.get(ref)));
    const lockSnaps=await Promise.all(lockRefs.map(ref=>tx.get(ref)));
    if(appointmentSnaps.some(s=>s.exists)||lockSnaps.some(s=>s.exists))
      throw Error("Existing appointment or lock conflict");
    if(conflict)throw Error("Injected pre-commit conflict");
    items.forEach((item,i)=>{
      tx.create(appointments[i],{...item,ownerId:owner});
      if(failAt===i+1)throw Error("Injected transaction interruption");
    });
    lockRefs.forEach((ref,i)=>tx.create(ref,{bookingId:locks[i].bookingId}));
    tx.create(marker,{status:"emulator-only",count:items.length});
  });
}
async function unchanged(){
  assert.equal((await legacy.get()).get("json"),json);
  assert.equal(await count("appointments"),0);
  assert.equal(await count("bookingLocks"),0);
  assert.equal((await marker.get()).exists,false);
  assert.equal((await mode.get()).get("liveBookingsEnabled"),false);
}
async function run(){
  await reset();
  await unchanged();
  console.log("PASS emulator baseline isolated and unchanged");
  for(const failAt of [1,2]){
    await assert.rejects(transactionRehearsal({failAt}),/Injected transaction interruption/);
    await unchanged();
    console.log("PASS transaction interruption after appointment",failAt,"rolled back");
  }
  await assert.rejects(transactionRehearsal({conflict:true}),/Injected pre-commit conflict/);
  await unchanged();
  console.log("PASS injected pre-commit conflict leaves no partial writes");
  await root.collection("appointments").doc(items[0].id).set({preexisting:true});
  await assert.rejects(transactionRehearsal(),/Existing appointment or lock conflict/);
  assert.equal((await root.collection("appointments").doc(items[0].id).get()).get("preexisting"),true);
  assert.equal(await count("appointments"),1);
  assert.equal(await count("bookingLocks"),0);
  console.log("PASS existing appointment preserved without overwrite");
  await reset();
  await root.collection("bookingLocks").doc(locks[0].lockId).set({preexisting:true});
  await assert.rejects(transactionRehearsal(),/Existing appointment or lock conflict/);
  assert.equal(await count("appointments"),0);
  assert.equal((await root.collection("bookingLocks").doc(locks[0].lockId).get()).get("preexisting"),true);
  console.log("PASS existing lock preserved without overwrite");
  await reset();
  await transactionRehearsal();
  assert.equal(await count("appointments"),2);
  assert.equal(await count("bookingLocks"),locks.length);
  assert.equal((await marker.get()).exists,true);
  assert.equal((await legacy.get()).get("json"),json);
  assert.equal((await mode.get()).get("liveBookingsEnabled"),false);
  console.log("PASS atomic emulator transaction commits with live booking disabled");
  await assert.rejects(transactionRehearsal(),/Migration already recorded/);
  assert.equal(await count("appointments"),2);
  assert.equal(await count("bookingLocks"),locks.length);
  console.log("PASS repeat transaction blocked without duplicates");
  await reset();
  await unchanged();
  console.log("PASS disposable emulator data cleaned up");
}
run().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});
