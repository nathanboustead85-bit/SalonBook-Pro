"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {canonical}=require("./phase1043TrustedEmulatorEvidence");
const {verifyRotatedAssertion,signAudit,verifyAudit,revokeApprovalEmulator}=require("./phase1044KeyRotationAndAudit");
const {initialiseWithSingleUseApproval}=require("./phase1040EmulatorLockedInitialization");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init",OPERATION="INITIALISE_LEGACY_BOOKING_MODE_ONLY",now=2000000000000;
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Demo emulators only");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
const old=crypto.generateKeyPairSync("ed25519"),next=crypto.generateKeyPairSync("ed25519");
const pem=k=>k.publicKey.export({type:"spki",format:"pem"});
const active={old:{status:"active",publicKeyPem:pem(old),validFromMs:now-10000,validUntilMs:now+60000},
 next:{status:"active",publicKeyPem:pem(next),validFromMs:now-10000,validUntilMs:now+60000}};
let seq=0;
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"id"+i}))),hash=digestBookings(json);
function payload(uid,approvalId="approval1"){return {approvalId,archiveSha256:hash,businessId:uid,
 expiresAtMs:now+30000,issuedAtMs:now-1000,nonce:"nonce"+seq,
 operation:OPERATION,operatorId:"operator1",projectId:PROJECT,role:"legacy-mode-approver"};}
function signed(p,keyId="old",key=old.privateKey){
 return {keyId,payload:p,signature:crypto.sign(null,Buffer.from(canonical(p)),key).toString("base64url")};}
function check(assertion,registry=active){
 return verifyRotatedAssertion({assertion,registry,expected:{businessId:assertion.payload.businessId,
 approvalId:assertion.payload.approvalId,archiveSha256:hash},nowMs:now});}
async function fixture(){
 const uid="phase1044_"+process.pid+"_"+(++seq),approvalId="approval1";
 const business=db.collection("businesses").doc(uid);
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const source=db.collection("users").doc(uid).collection("liveData").doc("bookings");
 await source.set({schemaVersion:1,json});
 await approval.set({ownerUid:uid,verifiedOwnerUid:uid,operation:OPERATION,
 archiveSha256:hash,status:"approved",usedAt:null,verifiedByTrustedOperator:true,
 issuedAtMs:now-1000,expiresAtMs:now+30000});
 const auditEvent={approvalId,archiveSha256:hash,businessId:uid,eventType:"revoked",
 keyId:"next",operatorId:"operator1",occurredAtMs:now,projectId:PROJECT};
 const signedAudit=signAudit(auditEvent,next.privateKey);
 const revoke=(extra={})=>revokeApprovalEmulator({db,businessId:uid,approvalId,
 signedAudit,registry:active,nowMs:now,executionEnabled:true,...extra});
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 bookingCount:10,sourceSha256:hash,bookingsJson:json,
 sourcePath:"users/"+uid+"/liveData/bookings"};
 const consume=()=>initialiseWithSingleUseApproval({db,businessId:uid,archive,approvalId,
 idToken:"emulator-test",verifyIdToken:async()=>({uid,email_verified:true}),
 nowMs:now,executionEnabled:true});
 return {uid,business,approval,source,signedAudit,revoke,consume,
 audit:business.collection("legacyModeRevocationAudit").doc(approvalId),
 mode:business.collection("settings").doc("bookingMode")};
}
test("both trusted active rotation keys verify",()=>{
 const p=payload("owner1");
 assert.equal(check(signed(p,"old",old.privateKey)).verified,true);
 assert.equal(check(signed(p,"next",next.privateKey)).verified,true);
});
test("retired old key is rejected, new key still works",()=>{
 const p=payload("owner2"),registry={...active,old:{...active.old,status:"retired"}};
 assert.throws(()=>check(signed(p,"old",old.privateKey),registry),/inactive/);
 assert.equal(check(signed(p,"next",next.privateKey),registry).verified,true);
});
test("revoked key is rejected",()=>{
 const p=payload("owner3"),registry={...active,next:{...active.next,status:"revoked"}};
 assert.throws(()=>check(signed(p,"next",next.privateKey),registry),/inactive/);
});
test("signature cannot be relabelled to another key",()=>{
 const p=payload("owner4");
 assert.throws(()=>check(signed(p,"next",old.privateKey)),/signature/);
});
test("tampering signed operator evidence fails",()=>{
 const p=payload("owner5");
 assert.throws(()=>check({...signed(p),payload:{...p,operatorId:"attacker"}}),/signature/);
});
test("audit signature detects changes",()=>{
 const f={approvalId:"approval1",archiveSha256:hash,businessId:"owner6",
 eventType:"revoked",keyId:"next",operatorId:"operator1",occurredAtMs:now,projectId:PROJECT};
 const signedRecord=signAudit(f,next.privateKey);
 assert.equal(verifyAudit(signedRecord,active,now),true);
 assert.throws(()=>verifyAudit({...signedRecord,operatorId:"attacker"},active,now),/signature/);
});
test("revocation atomically marks unused approval and creates signed audit",async()=>{
 const f=await fixture();const result=await f.revoke();
 assert.equal(result.revoked,true);
 assert.equal((await f.approval.get()).data().status,"revoked");
 assert.equal(verifyAudit((await f.audit.get()).data(),active,now),true);
 assert.equal((await f.mode.get()).exists,false);
 assert.equal((await f.source.get()).data().json,json);
});
test("revoked approval cannot initialise booking mode",async()=>{
 const f=await fixture();await f.revoke();
 await assert.rejects(f.consume(),/approval/);
 assert.equal((await f.mode.get()).exists,false);
 assert.equal((await f.source.get()).data().json,json);
});
test("revocation cannot be replayed",async()=>{
 const f=await fixture();await f.revoke();
 await assert.rejects(f.revoke(),/revoked/);
 assert.equal((await f.source.get()).data().json,json);
});
test("concurrent revocations only one succeeds",async()=>{
 const f=await fixture();const results=await Promise.allSettled([f.revoke(),f.revoke()]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
});
test("tampered revocation audit cannot revoke",async()=>{
 const f=await fixture();
 await assert.rejects(f.revoke({signedAudit:{...f.signedAudit,operatorId:"attacker"}}),/signature/);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.audit.get()).exists,false);
});
test("non-demo project is blocked",async()=>{
 const f=await fixture(),previous=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 await assert.rejects(f.revoke(),/emulator/);}
 finally{process.env.GCLOUD_PROJECT=previous;}
 assert.equal((await f.approval.get()).data().status,"approved");
});
