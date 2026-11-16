"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {createSecureBookingValidation}=require("../functions/phase163SecureBookingValidation");
const {DISABLED}=require("../functions/phase147DisabledAtomicReservation");
const secret="phase163-server-only-secret-over-32-bytes";
const intent={serviceId:"cut",staffId:"barber",date:"2026-11-20",time:"10:00"};
const input={idToken:"valid-test-id-token",ownerId:"salonA",key:"request_123456",intent};
const catalogue={services:[{id:"cut",published:true,durationMinutes:30}],
 staff:[{id:"barber",active:true,serviceIds:["cut"]}]};
const staffSchedules=[{id:"barber",weeklySchedule:{friday:{open:"09:00",close:"17:00"}},
 weeklyBreaks:[],timeOff:[]}];
const snapshot={ownerId:"salonA",serverRead:true,complete:true,catalogue,staffSchedules,bookings:[]};
const verifyIdToken=async()=>({uid:"salonA",email_verified:true,firebase:{sign_in_provider:"password"}});
const readPrivateProfile=async()=>({businessId:"salonA"});
const create=(readOwnerSnapshot,verify=verifyIdToken,profile=readPrivateProfile)=>
 createSecureBookingValidation({verifyIdToken:verify,readPrivateProfile:profile,readOwnerSnapshot,secret});
async function main(){
 let reads=0;
 const api=create(async owner=>{reads++;assert.equal(owner,"salonA");return snapshot;});
 const result=await api.inspect(input);
 assert.equal(result.status,"VALIDATED_SERVER_SNAPSHOT_ONLY");
 assert.equal(result.acceptingBookings,false);
 assert.equal(result.reservationCreated,false);
 assert.equal(result.liveAvailabilityConfirmed,false);
 assert.equal(result.durationMinutes,30);
 assert.equal((await api.inspect({...input,ownerId:"salonB"})).status,"AUTH_OWNER_FORBIDDEN");
 assert.equal(reads,1,"cross-owner must never read booking snapshot");
 assert.equal((await create(async()=>snapshot,async()=>{throw Error("revoked");}).inspect(input)).status,"AUTH_UNVERIFIED");
 assert.equal((await create(async()=>({...snapshot,ownerId:"salonB"})).inspect(input)).status,"VALIDATION_SNAPSHOT_UNTRUSTED");
 assert.equal((await create(async()=>({...snapshot,serverRead:false})).inspect(input)).status,"VALIDATION_SNAPSHOT_UNTRUSTED");
 assert.equal((await create(async()=>{throw Error("outage");}).inspect(input)).status,"VALIDATION_SNAPSHOT_UNAVAILABLE");
 assert.equal((await api.inspect({...input,intent:{...intent,serviceId:"missing"}})).status,"SELECTION_UNAVAILABLE");
 assert.equal((await api.inspect({...input,intent:{...intent,time:"19:00"}})).status,"OUTSIDE_WORKING_HOURS");
 const occupied={staffId:"barber",date:"2026-11-20",time:"10:15",durationMinutes:30,status:"confirmed"};
 assert.equal((await create(async()=>({...snapshot,bookings:[occupied]})).inspect(input)).status,"EXISTING_BOOKING_CONFLICT");
 const breakSchedule=[{...staffSchedules[0],weeklyBreaks:[{day:"friday",start:"10:00",end:"10:15"}]}];
 assert.equal((await create(async()=>({...snapshot,staffSchedules:breakSchedule})).inspect(input)).status,"STAFF_BREAK_CONFLICT");
 const originals=[{id:"original1"},{id:"original2"}],before=JSON.stringify(originals);
 assert.deepEqual(await api.reserve(input),DISABLED);
 assert.equal(JSON.stringify(originals),before);
 const root=path.resolve(__dirname,"..");
 const entry=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
 const source=fs.readFileSync(path.join(root,"functions/phase163SecureBookingValidation.js"),"utf8");
 assert.ok(!entry.includes("phase163SecureBookingValidation"));
 assert.ok(!source.includes("runTransaction(")&&!source.includes("firebase-admin"));
 assert.ok(!JSON.stringify(result).includes(input.idToken));
 console.log("PASS Phase 16.3 authentication, trusted snapshots, service/staff/hours/conflicts, disabled bookings");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
