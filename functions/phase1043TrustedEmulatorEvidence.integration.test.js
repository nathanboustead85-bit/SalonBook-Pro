"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {issueEmulatorApproval}=require("./phase1041EmulatorApprovalIssuance");
const {initialiseWithSingleUseApproval}=require("./phase1040EmulatorLockedInitialization");
const {canonical,verifySignedOperatorAssertion,verifyFirebaseOwnerToken}=require("./phase1043TrustedEmulatorEvidence");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init",OPERATION="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Dedicated emulators only");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore(),now=2000000000000;
const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"booking"+i})));
const hash=digestBookings(json);
let seq=0;
async function ownerToken(uid,verified=true){
 await admin.auth().createUser({uid,email:uid+"@example.test",emailVerified:verified});
 const custom=await admin.auth().createCustomToken(uid);
 const response=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=emulator-test",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({token:custom,returnSecureToken:true})});
 const data=await response.json();
 if(!response.ok||!data.idToken)throw Error("Auth emulator token exchange failed: "+JSON.stringify(data));
 return data.idToken;
}
function sign(payload,key=privateKey){
 return {payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),key).toString("base64url")};
}
async function fixture(verified=true){
 const uid="phase1043_"+process.pid+"_"+(++seq),approvalId="approval1";
 const token=await ownerToken(uid,verified);
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
  bookingCount:10,sourceSha256:hash,bookingsJson:json,
  sourcePath:"users/"+uid+"/liveData/bookings"};
 const source=db.collection("users").doc(uid).collection("liveData").doc("bookings");
 await source.set({schemaVersion:1,json});
 const payload={approvalId,archiveSha256:hash,businessId:uid,
  expiresAtMs:now+60000,issuedAtMs:now-1000,nonce:"nonce"+seq,
  operation:OPERATION,operatorId:"operator1",projectId:PROJECT,role:"legacy-mode-approver"};
 const assertion=sign(payload);
 const verifyOperatorAssertion=async()=>verifySignedOperatorAssertion({
  assertion,publicKey,expected:{businessId:uid,approvalId,archiveSha256:hash},nowMs:now});
 const issue=(extra={})=>issueEmulatorApproval({
  db,businessId:uid,archive,approvalId,ownerToken:token,
  operatorAssertion:JSON.stringify(assertion),verifyOwnerToken:verifyFirebaseOwnerToken,
  verifyOperatorAssertion,nowMs:now,executionEnabled:true,...extra});
 const consume=(extra={})=>initialiseWithSingleUseApproval({
  db,businessId:uid,archive,approvalId,idToken:token,
  verifyIdToken:verifyFirebaseOwnerToken,nowMs:now,executionEnabled:true,...extra});
 const business=db.collection("businesses").doc(uid);
 return {uid,token,archive,source,payload,assertion,issue,consume,business,
  approval:business.collection("legacyModeApprovals").doc(approvalId),
  audit:business.collection("legacyModeApprovalAudit").doc(approvalId),
  mode:business.collection("settings").doc("bookingMode")};
}
test("real Auth emulator token and signed operator evidence complete issuance/consumption",async()=>{
 const f=await fixture();
 const identity=await verifyFirebaseOwnerToken(f.token);
 assert.equal(identity.uid,f.uid);assert.equal(identity.email_verified,true);
 const issued=await f.issue();assert.equal(issued.issued,true);
 const consumed=await f.consume();assert.equal(consumed.initialized,true);
 assert.equal((await f.mode.get()).data().mode,"legacy");
 assert.equal((await f.approval.get()).data().status,"consumed");
 assert.equal((await f.audit.get()).data().archiveSha256,hash);
 assert.equal((await f.source.get()).data().json,json);
 assert.equal((await f.business.collection("appointments").get()).empty,true);
 assert.equal((await f.business.collection("bookingLocks").get()).empty,true);
});
test("replay after genuine emulator token flow fails",async()=>{
 const f=await fixture();await f.issue();await f.consume();
 await assert.rejects(f.consume());
 assert.equal((await f.source.get()).data().json,json);
});
test("unverified Firebase Auth emulator owner cannot issue",async()=>{
 const f=await fixture(false);
 await assert.rejects(f.issue());
 assert.equal((await f.approval.get()).exists,false);
 assert.equal((await f.mode.get()).exists,false);
});
test("token for another owner cannot issue",async()=>{
 const f=await fixture(),other=await fixture();
 await assert.rejects(f.issue({ownerToken:other.token}),/owner/);
 assert.equal((await f.approval.get()).exists,false);
});
test("tampered operator payload fails signature check",async()=>{
 const f=await fixture();
 const tampered={...f.assertion,payload:{...f.payload,operatorId:"attacker"}};
 await assert.rejects(f.issue({verifyOperatorAssertion:async()=>verifySignedOperatorAssertion({
  assertion:tampered,publicKey,expected:{businessId:f.uid,approvalId:"approval1",archiveSha256:hash},nowMs:now})}),/signature/);
 assert.equal((await f.approval.get()).exists,false);
});
test("operator signature from untrusted key fails",async()=>{
 const f=await fixture();
 const rogue=crypto.generateKeyPairSync("ed25519");
 const forged=sign(f.payload,rogue.privateKey);
 assert.throws(()=>verifySignedOperatorAssertion({assertion:forged,publicKey,
  expected:{businessId:f.uid,approvalId:"approval1",archiveSha256:hash},nowMs:now}),/signature/);
});
test("expired signed operator evidence fails",async()=>{
 const f=await fixture();
 const expired=sign({...f.payload,expiresAtMs:now-1});
 assert.throws(()=>verifySignedOperatorAssertion({assertion:expired,publicKey,
  expected:{businessId:f.uid,approvalId:"approval1",archiveSha256:hash},nowMs:now}),/lifetime/);
});
test("operator evidence for different business fails",async()=>{
 const f=await fixture();
 const wrong=sign({...f.payload,businessId:"another"});
 assert.throws(()=>verifySignedOperatorAssertion({assertion:wrong,publicKey,
  expected:{businessId:f.uid,approvalId:"approval1",archiveSha256:hash},nowMs:now}),/scope/);
});
test("non-demo environment refuses token verification",async()=>{
 const f=await fixture(),original=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 await assert.rejects(verifyFirebaseOwnerToken(f.token),/emulators/);}
 finally{process.env.GCLOUD_PROJECT=original;}
});
