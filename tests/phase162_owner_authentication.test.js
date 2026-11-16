"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createOwnerAuthenticationPreparation}=require("../functions/phase162OwnerAuthenticationPreparation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase162-server-secret-more-than-32-bytes";
const input={idToken:"valid-id-token-for-tests",ownerId:"salonA",key:"request_12345",
 intent:{serviceId:"cut",staffId:"kody",date:"2026-11-20",time:"09:00",customerName:"PRIVATE_PERSON"}};
async function main(){
 let verified=0,read=0,writes=0;
 const verifyIdToken=async(token,checkRevoked)=>{
  verified++;assert.equal(checkRevoked,true);
  if(token==="revoked-id-token")throw Error("PRIVATE_TOKEN_ERROR");
  return {uid:"salonA",email_verified:true,firebase:{sign_in_provider:"password"}};
 };
 const readPrivateProfile=async(uid)=>{read++;assert.equal(uid,"salonA");return {businessId:"salonA"};};
 const api=createOwnerAuthenticationPreparation({verifyIdToken,readPrivateProfile,secret});
 assert.equal((await api.inspect({...input,idToken:""})).status,"AUTH_TOKEN_MISSING");
 assert.equal((await api.inspect({...input,ownerId:"../bad"})).status,"AUTH_OWNER_INVALID");
 assert.equal(verified,0);assert.equal(read,0);
 assert.equal((await api.inspect({...input,idToken:"revoked-id-token"})).status,"AUTH_UNVERIFIED");
 assert.equal((await api.inspect({...input,ownerId:"salonB"})).status,"AUTH_OWNER_FORBIDDEN");
 assert.equal(read,0,"cross-owner requests must not read private profile");
 const good=await api.inspect(input);
 assert.equal(good.status,"AUTHENTICATED_OWNER_PREPARATION_ONLY");
 assert.equal(good.verifiedOwner,true);
 assert.equal(good.acceptingBookings,false);
 assert.equal(good.reservationCreated,false);
 assert.equal(good.bookingCollectionPath,"users/salonA/customerBookingReservations");
 assert.equal((await api.inspect({...input,key:"bad"})).status,"AUTH_PLAN_INVALID");
 const unverified=createOwnerAuthenticationPreparation({
  verifyIdToken:async()=>({uid:"salonA",email_verified:false}),readPrivateProfile,secret});
 assert.equal((await unverified.inspect(input)).status,"AUTH_UNVERIFIED");
 const anonymous=createOwnerAuthenticationPreparation({
  verifyIdToken:async()=>({uid:"salonA",email_verified:true,firebase:{sign_in_provider:"anonymous"}}),
  readPrivateProfile,secret});
 assert.equal((await anonymous.inspect(input)).status,"AUTH_UNVERIFIED");
 const mismatched=createOwnerAuthenticationPreparation({
  verifyIdToken,readPrivateProfile:async()=>({businessId:"salonB"}),secret});
 assert.equal((await mismatched.inspect(input)).status,"AUTH_PROFILE_FORBIDDEN");
 const offline=createOwnerAuthenticationPreparation({
  verifyIdToken,readPrivateProfile:async()=>{throw Error("PRIVATE_DB_ERROR");},secret});
 assert.equal((await offline.inspect(input)).status,"AUTH_PROFILE_UNAVAILABLE");
 const fixtures=[{id:"original1"},{id:"original2"}],before=JSON.stringify(fixtures);
 assert.deepEqual(await api.reserve(input),DISABLED);
 assert.equal(JSON.stringify(fixtures),before);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase162OwnerAuthenticationPreparation.js"),"utf8");
 assert.ok(!entry.includes("phase162OwnerAuthenticationPreparation"));
 assert.ok(!source.includes("runTransaction(")&&!source.includes("firebase-admin"));
 assert.ok(!JSON.stringify(good).includes(input.idToken));
 assert.ok(!JSON.stringify(good).includes("PRIVATE_PERSON"));
 assert.equal(writes,0);
 console.log("PASS Phase 16.2 revoked/anonymous/unverified/cross-owner/profile outage safety, private identity, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
