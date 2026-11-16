"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {prepareBookingStoragePlan,createBookingInfrastructurePreparation}=
 require("../functions/phase151BookingInfrastructurePreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase151-secret-at-least-thirty-two-bytes-long";
const intent={serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00"};
const args={ownerId:"owner_1",key:"request_12345",intent,secret};
async function main(){
 const before=JSON.stringify(args);
 const p=prepareBookingStoragePlan(args);
 assert.equal(p.status,"BOOKING_STORAGE_PLAN_ONLY");
 assert.equal(p.acceptingBookings,false);
 assert.equal(p.reservationCreated,false);
 assert.equal(p.legacyAppointmentsUntouched,true);
 assert.equal(p.bookingCollectionPath,"users/owner_1/customerBookingReservations");
 assert.match(p.recoveryDocumentPath,/^users\/owner_1\/customerBookingRequests\/[a-f0-9]{64}$/);
 assert.match(p.fingerprint,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(p).includes("request_12345"),"raw idempotency key must not leak");
 assert.ok(!JSON.stringify(p).includes("09:00"),"booking intent must not leak");
 assert.deepEqual(prepareBookingStoragePlan(args),p,"same request yields same plan");
 assert.notEqual(prepareBookingStoragePlan({...args,key:"request_54321"}).requestId,p.requestId);
 assert.notEqual(prepareBookingStoragePlan({...args,ownerId:"owner_2"}).requestId,p.requestId);
 assert.notEqual(prepareBookingStoragePlan({...args,intent:{...intent,time:"11:00"}}).fingerprint,p.fingerprint);
 for(const bad of [
  {...args,ownerId:"../other"},{...args,key:"short"},
  {...args,secret:"too-short"},{...args,intent:null}
 ])assert.equal(prepareBookingStoragePlan(bad).status,"BOOKING_STORAGE_PLAN_INVALID");
 assert.equal(JSON.stringify(args),before,"input remains unchanged");
 const preparation=createBookingInfrastructurePreparation();
 assert.deepEqual(await preparation.reserve(args),DISABLED);
 const functions=fs.readFileSync(path.resolve(__dirname,"../functions/index.js"),"utf8");
 assert.ok(!/exports\.(?:reserve|createBooking|bookAppointment|customerBooking)\s*=/.test(functions));
 const source=fs.readFileSync(path.resolve(__dirname,"../functions/phase151BookingInfrastructurePreparation.js"),"utf8");
 assert.ok(!/\b(?:transaction|tx|batch|docRef|documentRef|db)\s*\.\s*(?:set|create|update|delete|runTransaction|batch)\s*\(/.test(source),
  "preparation module must not write Firestore");
 assert.ok(!source.includes("firebase-admin"),"no Firestore admin access");
 console.log("PASS Phase 15.1 deterministic opaque storage plan, owner isolation, no writes, booking disabled");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
