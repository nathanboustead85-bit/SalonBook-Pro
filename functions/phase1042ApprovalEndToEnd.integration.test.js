"use strict";
/** Phase 10.42: end-to-end emulator integration ONLY. No production credentials. */
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {issueEmulatorApproval}=require("./phase1041EmulatorApprovalIssuance");
const {initialiseWithSingleUseApproval}=require("./phase1040EmulatorLockedInitialization");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init",OPERATION="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
if(!process.env.FIRESTORE_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Isolated demo emulator required");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),now=2000000000000;
let seq=0;
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"test"+i,client:"Emulator Client "+i})));
const hash=digestBookings(json);
async function fixture(){
 const businessId="phase1042_"+process.pid+"_"+(++seq),approvalId="approval1";
 const business=db.collection("businesses").doc(businessId);
 const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 const initial={schemaVersion:1,json,updatedAt:"original",keep:"unchanged"};
 await source.set(initial);
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
  bookingCount:10,sourceSha256:hash,bookingsJson:json,
  sourcePath:"users/"+businessId+"/liveData/bookings"};
 const verifyOwnerToken=async()=>({uid:businessId,email_verified:true});
 const verifyOperatorAssertion=async()=>({verified:true,role:"legacy-mode-approver",
  operatorId:"operator1",projectId:PROJECT,businessId,operation:OPERATION,
  approvalId,archiveSha256:hash,expiresAtMs:now+60000});
 const issue=(extra={})=>issueEmulatorApproval({
  db,businessId,archive,approvalId,ownerToken:"emulator-owner-token",
  operatorAssertion:"emulator-operator-assertion",verifyOwnerToken,
  verifyOperatorAssertion,nowMs:now,executionEnabled:true,...extra});
 const consume=(extra={})=>initialiseWithSingleUseApproval({
  db,businessId,archive,approvalId,idToken:"emulator-owner-token",
  verifyIdToken:verifyOwnerToken,nowMs:now,executionEnabled:true,...extra});
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const audit=business.collection("legacyModeApprovalAudit").doc(approvalId);
 const mode=business.collection("settings").doc("bookingMode");
 return {businessId,business,source,initial,archive,issue,consume,approval,audit,mode};
}
async function assertUntouched(f){
 assert.deepEqual((await f.source.get()).data(),f.initial);
 assert.equal((await f.business.collection("appointments").get()).empty,true);
 assert.equal((await f.business.collection("bookingLocks").get()).empty,true);
 assert.equal((await f.business.collection("migrations").get()).empty,true);
}
test("full issuance and consumption creates only mode plus approval/audit changes, preserves ten bookings",async()=>{
 const f=await fixture();
 const issued=await f.issue();
 assert.equal(issued.issued,true);
 assert.equal((await f.mode.get()).exists,false);
 const beforeAudit=(await f.audit.get()).data();
 const consumed=await f.consume();
 assert.equal(consumed.initialized,true);
 assert.equal(consumed.approvalConsumed,true);
 assert.equal((await f.mode.get()).data().mode,"legacy");
 assert.equal((await f.approval.get()).data().status,"consumed");
 assert.deepEqual((await f.audit.get()).data(),beforeAudit);
 await assertUntouched(f);
});
test("replay after full flow cannot change mode, approval or bookings",async()=>{
 const f=await fixture();await f.issue();await f.consume();
 const modeBefore=(await f.mode.get()).data();
 await assert.rejects(f.consume(),/approval|exists/);
 assert.deepEqual((await f.mode.get()).data(),modeBefore);
 await assertUntouched(f);
});
test("two concurrent consumers result in exactly one success",async()=>{
 const f=await fixture();await f.issue();
 const outcomes=await Promise.allSettled([f.consume(),f.consume()]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 assert.equal((await f.approval.get()).data().status,"consumed");
 await assertUntouched(f);
});
test("unverified owner cannot issue approval",async()=>{
 const f=await fixture();
 await assert.rejects(f.issue({verifyOwnerToken:async()=>({uid:f.businessId,email_verified:false})}),/owner/);
 assert.equal((await f.approval.get()).exists,false);
 assert.equal((await f.audit.get()).exists,false);
 assert.equal((await f.mode.get()).exists,false);
 await assertUntouched(f);
});
test("wrong operator assertion cannot issue approval",async()=>{
 const f=await fixture();
 await assert.rejects(f.issue({verifyOperatorAssertion:async()=>({verified:false})}),/operator/);
 assert.equal((await f.approval.get()).exists,false);
 assert.equal((await f.mode.get()).exists,false);
 await assertUntouched(f);
});
test("owner mismatch at consumption does not consume issued approval",async()=>{
 const f=await fixture();await f.issue();
 await assert.rejects(f.consume({verifyIdToken:async()=>({uid:"other",email_verified:true})}),/owner/);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.mode.get()).exists,false);
 await assertUntouched(f);
});
test("changed cloud source blocks consumption and preserves approval",async()=>{
 const f=await fixture();await f.issue();
 await f.source.update({json:json+" "});
 await assert.rejects(f.consume(),/changed/);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.mode.get()).exists,false);
 assert.equal((await f.source.get()).data().json,json+" ");
});
test("existing appointment blocks consumption and preserves approval",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("appointments").doc("other").set({status:"confirmed"});
 await assert.rejects(f.consume(),/appointments/);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.mode.get()).exists,false);
 assert.deepEqual((await f.source.get()).data(),f.initial);
});
test("existing lock blocks consumption and preserves approval",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("bookingLocks").doc("occupied").set({appointmentId:"other"});
 await assert.rejects(f.consume(),/locks/);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.mode.get()).exists,false);
 assert.deepEqual((await f.source.get()).data(),f.initial);
});
test("disabled consumption leaves approved record and bookings intact",async()=>{
 const f=await fixture();await f.issue();
 await assert.rejects(f.consume({executionEnabled:false}),/disabled/);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.mode.get()).exists,false);
 await assertUntouched(f);
});
