"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const admin=require("firebase-admin");
const {issueEmulatorApproval:issue}=require("./phase1041EmulatorApprovalIssuance");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init",OPERATION="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
if(!process.env.FIRESTORE_EMULATOR_HOST||process.env.GCLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||process.env.GOOGLE_APPLICATION_CREDENTIALS)
 throw Error("Dedicated emulator required");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),now=2000000000000;
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"id"+i})));
const hash=digestBookings(json);
let seq=0;
function setup(){
 const businessId="phase1041_"+process.pid+"_"+(++seq),approvalId="approval1";
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,bookingsJson:json,sourceSha256:hash,
 sourcePath:"users/"+businessId+"/liveData/bookings"};
 const business=db.collection("businesses").doc(businessId);
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const audit=business.collection("legacyModeApprovalAudit").doc(approvalId);
 const args={db,businessId,archive,approvalId,ownerToken:"test-owner-token",
 operatorAssertion:"test-operator-assertion",nowMs:now,executionEnabled:true,
 verifyOwnerToken:async()=>({uid:businessId,email_verified:true}),
 verifyOperatorAssertion:async()=>({verified:true,role:"legacy-mode-approver",
 operatorId:"operator1",projectId:PROJECT,businessId,operation:OPERATION,
 approvalId,archiveSha256:hash,expiresAtMs:now+60000})};
 return {args,approval,audit,business};
}
test("trusted emulator fixture issues one approval and matching audit evidence",async()=>{
 const f=setup();const result=await issue(f.args);
 assert.equal(result.issued,true);assert.equal(result.productionWriteAllowed,false);
 const a=(await f.approval.get()).data(),log=(await f.audit.get()).data();
 assert.equal(a.evidenceDigest,log.evidenceDigest);
 assert.equal(a.archiveSha256,hash);assert.equal(a.status,"approved");
 assert.equal((await f.business.collection("settings").get()).empty,true);
});
test("duplicate approval cannot overwrite audit or approval",async()=>{
 const f=setup();await issue(f.args);
 const before=(await f.audit.get()).data();
 await assert.rejects(issue(f.args),/already used/);
 assert.deepEqual((await f.audit.get()).data(),before);
});
test("two concurrent issuance attempts yield exactly one approval",async()=>{
 const f=setup();const results=await Promise.allSettled([issue(f.args),issue(f.args)]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 assert.equal((await f.approval.get()).exists,true);
 assert.equal((await f.audit.get()).exists,true);
});
for(const [name,mutate] of [
 ["disabled issuance",x=>{x.executionEnabled=false;}],
 ["wrong owner",x=>{x.verifyOwnerToken=async()=>({uid:"other",email_verified:true});}],
 ["unverified email",x=>{x.verifyOwnerToken=async()=>({uid:x.businessId,email_verified:false});}],
 ["missing independent verifier",x=>{x.verifyOperatorAssertion=null;}],
 ["wrong operator role",x=>{x.verifyOperatorAssertion=async()=>({verified:true,role:"admin"});}],
 ["operator archive mismatch",x=>{x.verifyOperatorAssertion=async()=>({verified:true,role:"legacy-mode-approver",operatorId:"op",projectId:PROJECT,businessId:x.businessId,operation:OPERATION,approvalId:x.approvalId,archiveSha256:"0".repeat(64),expiresAtMs:now+60000});}],
 ["archive path mismatch",x=>{x.archive={...x.archive,sourcePath:"users/other/liveData/bookings"};}],
 ["invalid archive",x=>{x.archive={...x.archive,sourceSha256:"0".repeat(64)};}]
]){
 test(name+" fails without audit or approval",async()=>{
  const f=setup();mutate(f.args);await assert.rejects(issue(f.args));
  assert.equal((await f.approval.get()).exists,false);
  assert.equal((await f.audit.get()).exists,false);
 });
}
test("non-demo environment blocks issuance",async()=>{
 const f=setup(),old=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 await assert.rejects(issue(f.args),/emulator/);}
 finally{process.env.GCLOUD_PROJECT=old;}
 assert.equal((await f.approval.get()).exists,false);
});
