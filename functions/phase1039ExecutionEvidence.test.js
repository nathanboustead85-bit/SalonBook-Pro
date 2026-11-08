"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {assessExecutionEvidence:assess}=require("./phase1039ExecutionEvidence");
const now=2000000000000;
const owner="emulator-owner";
const valid=()=>({
 businessId:owner,authenticatedUid:owner,nowMs:now,
 identityEvidence:{verifiedByTrustedOperator:true,ownerUid:owner,operatorId:"operator-1"},
 approvalEvidence:{verifiedByTrustedOperator:true,ownerUid:owner,
 operation:"INITIALISE_LEGACY_BOOKING_MODE_ONLY",approvalId:"unique-once",used:false,
 issuedAtMs:now-60000,expiresAtMs:now+60000},
 permissionEvidence:{verifiedByTrustedOperator:true,projectId:"salonbook-pro-ad5ff",
 targetPath:"businesses/"+owner+"/settings/bookingMode",allowCreateOnly:true,
 allowDelete:false,allowUpdate:false,allowOtherWrites:false,readonlyVerifierUnchanged:true}
});
test("complete evidence is assessed but never grants a write",()=>{
 const result=assess(valid());assert.equal(result.approved,true);
 assert.equal(result.productionWriteAllowed,false);
});
for(const [name,change] of [
 ["wrong owner",x=>{x.authenticatedUid="other";}],
 ["unverified operator",x=>{x.identityEvidence.verifiedByTrustedOperator=false;}],
 ["wrong approval owner",x=>{x.approvalEvidence.ownerUid="other";}],
 ["used approval",x=>{x.approvalEvidence.used=true;}],
 ["expired approval",x=>{x.approvalEvidence.expiresAtMs=now;}],
 ["future approval",x=>{x.approvalEvidence.issuedAtMs=now+1;}],
 ["overlong approval",x=>{x.approvalEvidence.expiresAtMs=now+20*60*1000;}],
 ["wrong operation",x=>{x.approvalEvidence.operation="DELETE_BOOKINGS";}],
 ["wrong project",x=>{x.permissionEvidence.projectId="another-project";}],
 ["wrong document",x=>{x.permissionEvidence.targetPath="businesses/other/settings/bookingMode";}],
 ["update allowed",x=>{x.permissionEvidence.allowUpdate=true;}],
 ["delete allowed",x=>{x.permissionEvidence.allowDelete=true;}],
 ["other writes allowed",x=>{x.permissionEvidence.allowOtherWrites=true;}],
 ["read-only verifier elevated",x=>{x.permissionEvidence.readonlyVerifierUnchanged=false;}],
 ["unverified permissions",x=>{x.permissionEvidence.verifiedByTrustedOperator=false;}]
]){
 test(name+" blocks",()=>{const x=valid();change(x);
 const r=assess(x);assert.equal(r.approved,false);assert.equal(r.productionWriteAllowed,false);});
}
