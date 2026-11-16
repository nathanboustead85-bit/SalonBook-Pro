"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createBookingRetryRecoveryPreparation}=require("../functions/phase166BookingRetryRecoveryPreparation");
const {prepareBookingStoragePlan}=require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase166-server-only-test-secret-more-than-32-bytes";
const intent={serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"};
const input={ownerId:"salonA",key:"request_12345",intent};
const plan=prepareBookingStoragePlan({...input,secret});
const reservationId="a".repeat(64);
const marker={fingerprint:plan.fingerprint,requestId:plan.requestId,
 reservationId,ownerId:"salonA",state:"COMMITTED_SIMULATION"};
const reservation={id:reservationId,requestId:plan.requestId,fingerprint:plan.fingerprint,
 ownerId:"salonA",state:"COMMITTED_SIMULATION"};
const api=readConsistentPair=>createBookingRetryRecoveryPreparation({secret,readConsistentPair});
async function main(){
 const complete=api(async()=>({consistentSnapshot:true,marker,reservation}));
 assert.equal((await complete.inspect(input)).status,"RECOVERY_PRIOR_SIMULATED_COMMIT_VERIFIED");
 assert.equal((await complete.inspect({...input,key:"bad"})).status,"RECOVERY_REQUEST_INVALID");
 assert.equal((await api(async()=>({consistentSnapshot:true})).inspect(input)).status,
  "RECOVERY_NO_PRIOR_REQUEST_ONLY");
 assert.equal((await api(async()=>({consistentSnapshot:true,marker})).inspect(input)).status,
  "RECOVERY_AMBIGUOUS_REQUIRES_MANUAL_REVIEW");
 assert.equal((await api(async()=>({consistentSnapshot:true,reservation})).inspect(input)).status,
  "RECOVERY_AMBIGUOUS_REQUIRES_MANUAL_REVIEW");
 assert.equal((await api(async()=>({consistentSnapshot:false,marker,reservation})).inspect(input)).status,
  "RECOVERY_SNAPSHOT_UNTRUSTED");
 assert.equal((await api(async()=>{throw Error("outage");}).inspect(input)).status,
  "RECOVERY_READ_UNAVAILABLE");
 assert.equal((await api(async()=>({consistentSnapshot:true,marker:{...marker,fingerprint:"b".repeat(64)},reservation})).inspect(input)).status,
  "RECOVERY_IDEMPOTENCY_KEY_REUSED");
 assert.equal((await api(async()=>({consistentSnapshot:true,marker,reservation:{...reservation,ownerId:"salonB"}})).inspect(input)).status,
  "RECOVERY_AMBIGUOUS_REQUIRES_MANUAL_REVIEW");
 assert.equal((await api(async()=>({consistentSnapshot:true,marker,reservation:{...reservation,id:"b".repeat(64)}})).inspect(input)).status,
  "RECOVERY_AMBIGUOUS_REQUIRES_MANUAL_REVIEW");
 const hundred=await Promise.all(Array.from({length:100},()=>complete.inspect(input)));
 assert.ok(hundred.every(x=>x.status==="RECOVERY_PRIOR_SIMULATED_COMMIT_VERIFIED"
  &&x.reservationCreated===false&&x.acceptingBookings===false));
 const originals=[{id:"original1"},{id:"original2"}],before=JSON.stringify(originals);
 assert.deepEqual(await complete.reserve(input),DISABLED);
 assert.equal(JSON.stringify(originals),before);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase166BookingRetryRecoveryPreparation.js"),"utf8");
 assert.ok(!entry.includes("phase166BookingRetryRecoveryPreparation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 console.log("PASS Phase 16.6 100 concurrent retries, mismatch, ambiguity, outage, owner isolation and disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
