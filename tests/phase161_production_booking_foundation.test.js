"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createProductionBookingFoundation,REQUIRED}=require("../functions/phase161ProductionBookingFoundation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase161-test-server-secret-at-least-32-bytes";
const input={ownerId:"salonA",key:"request_12345",intent:{
 serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00",customerName:"PRIVATE_PERSON"}};
async function main(){
 const denied=createProductionBookingFoundation({secret});
 assert.equal(denied.inspect(input).status,"PRODUCTION_CONTEXT_UNAVAILABLE");
 assert.deepEqual(await denied.reserve(input),DISABLED);
 const unverified=createProductionBookingFoundation({secret,trustedContext:{
  resolveOwner:()=>({ownerId:"salonA",serverVerified:false,emailVerified:true})}});
 assert.equal(unverified.inspect(input).status,"PRODUCTION_OWNER_UNVERIFIED");
 const wrong=createProductionBookingFoundation({secret,trustedContext:{
  resolveOwner:()=>({ownerId:"salonB",serverVerified:true,emailVerified:true})}});
 assert.equal(wrong.inspect(input).status,"PRODUCTION_OWNER_MISMATCH");
 const trustedContext={resolveOwner:()=>({ownerId:"salonA",serverVerified:true,emailVerified:true})};
 const foundation=createProductionBookingFoundation({secret,trustedContext});
 const result=foundation.inspect(input);
 assert.equal(result.status,"PRODUCTION_ARCHITECTURE_ONLY");
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(result.bookingCollectionPath,"users/salonA/customerBookingReservations");
 assert.equal(result.requiredControls.length,7);
 assert.ok(REQUIRED.includes("atomic_reservation_and_marker"));
 assert.equal(foundation.inspect({...input,key:"bad"}).status,"PRODUCTION_PLAN_INVALID");
 assert.equal(foundation.readiness().readyForLiveCustomerBookings,false);
 assert.equal(foundation.readiness().launchBlockers.length,7);
 assert.deepEqual(await foundation.reserve(input),DISABLED);
 const original=[{id:"original1"},{id:"original2"}],before=JSON.stringify(original);
 foundation.inspect(input);await foundation.reserve(input);
 assert.equal(JSON.stringify(original),before);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase161ProductionBookingFoundation.js"),"utf8");
 assert.ok(!entry.includes("phase161ProductionBookingFoundation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("runTransaction("));
 assert.ok(!JSON.stringify(result).includes("PRIVATE_PERSON"));
 assert.ok(!JSON.stringify(result).includes(input.key));
 console.log("PASS Phase 16.1 server-only architecture, owner scope, disabled bookings, privacy and original fixtures");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
