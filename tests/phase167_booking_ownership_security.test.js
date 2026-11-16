"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createBookingOwnershipSecurityPreparation}=require("../functions/phase167BookingOwnershipSecurityPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const root=path.resolve(__dirname,"..");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
const index=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const source=fs.readFileSync(path.join(root,"functions/phase167BookingOwnershipSecurityPreparation.js"),"utf8");
async function main(){
 for(const match of [
  /match \/users\/\{userId\}\/customerBookingReservations\/\{reservationId\} \{\s*allow read, write: if false;/,
  /match \/users\/\{userId\}\/customerBookingRequests\/\{requestId\} \{\s*allow read, write: if false;/,
  /match \/businesses\/\{businessId\}\/customerBookingGuards\/\{guardId\} \{\s*allow read, write: if false;/
 ])assert.match(rules,match);
 assert.match(rules,/match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
 assert.ok(!index.includes("phase167BookingOwnershipSecurityPreparation"));
 assert.ok(!source.includes("firebase-admin")&&!source.includes("transaction.create("));
 const claims={uid:"salonA",email_verified:true,firebase:{sign_in_provider:"password"}};
 const good=createBookingOwnershipSecurityPreparation({
  verifyIdToken:async(_token,checkRevoked)=>{assert.equal(checkRevoked,true);return claims;},
  readPrivateProfile:async uid=>({businessId:uid})
 });
 const input={idToken:"firebase_token_mock_123",ownerId:"salonA"};
 const ok=await good.inspect(input);
 assert.equal(ok.status,"BOOKING_OWNER_VERIFIED_PREPARATION_ONLY");
 assert.equal(ok.serverOnlyCollections.length,3);
 assert.equal(ok.acceptingBookings,false);
 assert.equal((await good.inspect({...input,ownerId:"salonB"})).status,"BOOKING_ACCESS_CROSS_OWNER");
 assert.equal((await good.inspect({...input,idToken:"bad"})).status,"BOOKING_ACCESS_INVALID");
 assert.equal((await createBookingOwnershipSecurityPreparation({
  verifyIdToken:async()=>({...claims,email_verified:false}),
  readPrivateProfile:async()=>({businessId:"salonA"})
 }).inspect(input)).status,"BOOKING_ACCESS_UNVERIFIED");
 assert.equal((await createBookingOwnershipSecurityPreparation({
  verifyIdToken:async()=>({...claims,firebase:{sign_in_provider:"anonymous"}}),
  readPrivateProfile:async()=>({businessId:"salonA"})
 }).inspect(input)).status,"BOOKING_ACCESS_UNVERIFIED");
 assert.equal((await createBookingOwnershipSecurityPreparation({
  verifyIdToken:async()=>{throw Error("revoked");},
  readPrivateProfile:async()=>({businessId:"salonA"})
 }).inspect(input)).status,"BOOKING_ACCESS_UNVERIFIED");
 assert.equal((await createBookingOwnershipSecurityPreparation({
  verifyIdToken:async()=>claims,readPrivateProfile:async()=>({businessId:"salonB"})
 }).inspect(input)).status,"BOOKING_ACCESS_PROFILE_MISMATCH");
 assert.equal((await createBookingOwnershipSecurityPreparation({
  verifyIdToken:async()=>claims,readPrivateProfile:async()=>{throw Error("outage");}
 }).inspect(input)).status,"BOOKING_ACCESS_PROFILE_UNAVAILABLE");
 assert.deepEqual(await good.reserve(input),DISABLED);
 const hundred=await Promise.all(Array.from({length:100},()=>good.inspect(input)));
 assert.ok(hundred.every(x=>x.status==="BOOKING_OWNER_VERIFIED_PREPARATION_ONLY"
  &&x.reservationCreated===false));
 const originals=[{id:"original1"},{id:"original2"}],before=JSON.stringify(originals);
 assert.equal(JSON.stringify(originals),before);
 console.log("PASS Phase 16.7 private rules, verified owner, cross-owner, revoked, anonymous, outage, 100 checks and disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
