"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {canonical}=require("./phase1043TrustedEmulatorEvidence");
const {createTrustedEmulatorOrchestrator}=require("./phase1046TrustedOrchestrator");
const {digestBookings}=require("./finalBookingSyncVerifier");
const PROJECT="demo-boustio-legacy-init",OPERATION="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)throw Error("Demo emulators only");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const db=admin.firestore();
const trusted=crypto.generateKeyPairSync("ed25519"),rogue=crypto.generateKeyPairSync("ed25519");
const pem=trusted.publicKey.export({format:"pem",type:"spki"});
const registry=()=>({primary:{status:"active",publicKeyPem:pem,
 validFromMs:Date.now()-60000,validUntilMs:Date.now()+600000}});
const json=JSON.stringify(Array.from({length:10},(_,i)=>({id:"booking"+i})));
const hash=digestBookings(json);
let seq=0;
async function token(uid,verified=true){
 await admin.auth().createUser({uid,email:uid+"@example.test",emailVerified:verified});
 const custom=await admin.auth().createCustomToken(uid);
 const response=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
 "/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=test",{
 method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({token:custom,returnSecureToken:true})});
 const data=await response.json();
 if(!response.ok)throw Error(JSON.stringify(data));
 return data.idToken;
}
async function fixture(verified=true){
 const businessId="phase1046_"+process.pid+"_"+(++seq),approvalId="approval1";
 const ownerToken=await token(businessId,verified);
 const archive={archiveType:"boustio-cloud-bookings-readonly",schemaVersion:1,
 sourcePath:"users/"+businessId+"/liveData/bookings",sourceSha256:hash,
 bookingCount:10,bookingsJson:json};
 const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 await source.set({json,schemaVersion:1});
 const business=db.collection("businesses").doc(businessId);
 const now=Date.now();
 const payload={approvalId,archiveSha256:hash,businessId,expiresAtMs:now+60000,
 issuedAtMs:now-1000,nonce:"nonce"+seq,operation:OPERATION,operatorId:"operator1",
 projectId:PROJECT,role:"legacy-mode-approver"};
 const signed=(key=trusted.privateKey,keyId="primary")=>({
 keyId,payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),key).toString("base64url")});
 const operatorAssertion=signed();
 const orchestrator=createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:registry()});
 const issue=(extra={})=>orchestrator.issue({businessId,archive,approvalId,ownerToken,operatorAssertion,...extra});
 const consume=(extra={})=>orchestrator.consume({businessId,archive,approvalId,ownerToken,...extra});
 return {businessId,archive,ownerToken,operatorAssertion,payload,signed,source,business,
 issue,consume,orchestrator,approval:business.collection("legacyModeApprovals").doc(approvalId),
 mode:business.collection("settings").doc("bookingMode")};
}
test("genuine Auth token and trusted signed assertion complete issuance and consumption",async()=>{
 const f=await fixture();
 assert.equal((await f.issue()).issued,true);
 assert.equal((await f.consume()).initialized,true);
 assert.equal((await f.mode.get()).data().mode,"legacy");
 assert.equal((await f.source.get()).data().json,json);
});
test("caller cannot override identity verifier",async()=>{
 const f=await fixture(false);
 await assert.rejects(f.issue({verifyOwnerToken:async()=>({uid:f.businessId,email_verified:true})}),/Unexpected/);
 assert.equal((await f.approval.get()).exists,false);
});
test("caller cannot override operator verifier",async()=>{
 const f=await fixture();
 await assert.rejects(f.issue({verifyOperatorAssertion:async()=>({verified:true})}),/Unexpected/);
 assert.equal((await f.approval.get()).exists,false);
});
test("caller cannot override trusted clock",async()=>{
 const f=await fixture();
 await assert.rejects(f.issue({nowMs:f.payload.issuedAtMs}),/Unexpected/);
 await assert.rejects(f.consume({nowMs:f.payload.issuedAtMs}),/Unexpected/);
 assert.equal((await f.mode.get()).exists,false);
});
test("caller cannot supply key registry or public key",async()=>{
 const f=await fixture();
 await assert.rejects(f.issue({operatorKeyRegistry:{rogue:{}},publicKey:"rogue"}),/Unexpected/);
 assert.equal((await f.approval.get()).exists,false);
});
test("forged assertion signed with unknown key fails",async()=>{
 const f=await fixture();
 await assert.rejects(f.issue({operatorAssertion:f.signed(rogue.privateKey)}),/signature/);
 assert.equal((await f.approval.get()).exists,false);
});
test("key registry is snapshotted and caller mutation cannot replace trusted key",async()=>{
 const f=await fixture();
 const keys=registry();
 const orchestrator=createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:keys});
 keys.primary.publicKeyPem=rogue.publicKey.export({format:"pem",type:"spki"});
 await assert.rejects(orchestrator.issue({businessId:f.businessId,archive:f.archive,
 approvalId:"approval1",ownerToken:f.ownerToken,operatorAssertion:f.signed(rogue.privateKey)}),/signature/);
 assert.equal((await f.approval.get()).exists,false);
});
test("unverified real Auth owner is rejected without callback substitution",async()=>{
 const f=await fixture(false);
 await assert.rejects(f.issue());
 assert.equal((await f.approval.get()).exists,false);
});
test("replay after consumed approval is blocked",async()=>{
 const f=await fixture();await f.issue();await f.consume();
 await assert.rejects(f.consume());
 assert.equal((await f.source.get()).data().json,json);
});
test("another owner cannot consume approval",async()=>{
 const f=await fixture();await f.issue();
 const other=await fixture();
 await assert.rejects(f.consume({ownerToken:other.ownerToken}));
 assert.equal((await f.mode.get()).exists,false);
});
test("non-demo environment is blocked at execution",async()=>{
 const f=await fixture(),original=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 await assert.rejects(f.issue(),/emulators/);}
 finally{process.env.GCLOUD_PROJECT=original;}
 assert.equal((await f.approval.get()).exists,false);
});
test("all caller-controlled extra fields are rejected even when legitimate",async()=>{
 const f=await fixture();
 await assert.rejects(f.consume({executionEnabled:true}),/Unexpected/);
 await assert.rejects(f.issue({db}),/Unexpected/);
 assert.equal((await f.mode.get()).exists,false);
});

test("Phase 10.48 persists signed operator evidence and nonce ledger",async()=>{
 const f=await fixture();await f.issue();
 const approval=(await f.approval.get()).data();
 assert.deepEqual(approval.signedOperatorAssertion,f.operatorAssertion);
 const nonceId=crypto.createHash("sha256").update("operator1\0"+f.payload.nonce).digest("hex");
 const ledger=await db.collection("legacyModeOperatorNonces").doc(nonceId).get();
 assert.equal(ledger.data().approvalId,"approval1");
 assert.equal((await f.business.collection("legacyModeApprovalAudit").doc("approval1").get())
  .data().operatorEvidenceSha256,approval.operatorEvidenceSha256);
});
test("Phase 10.48 rejects same signed nonce across distinct approval IDs",async()=>{
 const f=await fixture();await f.issue();
 const p={...f.payload,approvalId:"approval2"};
 const second={keyId:"primary",payload:p,
 signature:crypto.sign(null,Buffer.from(canonical(p)),trusted.privateKey).toString("base64url")};
 await assert.rejects(f.issue({approvalId:"approval2",operatorAssertion:second}),/nonce replay/);
 assert.equal((await f.business.collection("legacyModeApprovals").doc("approval2").get()).exists,false);
});
test("Phase 10.48 rejects tampered approval signed evidence at consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.approval.update({"signedOperatorAssertion.signature":"tampered"});
 await assert.rejects(f.consume(),/signature|evidence/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.48 rejects tampered audit evidence at consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("legacyModeApprovalAudit").doc("approval1")
  .update({operatorEvidenceSha256:"forged"});
 await assert.rejects(f.consume(),/evidence mismatch/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.48 rejects deleted nonce ledger at consumption",async()=>{
 const f=await fixture();await f.issue();
 const nonceId=crypto.createHash("sha256").update("operator1\0"+f.payload.nonce).digest("hex");
 await db.collection("legacyModeOperatorNonces").doc(nonceId).delete();
 await assert.rejects(f.consume(),/nonce ledger/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.48 concurrent replay attempts cannot issue twice",async()=>{
 const f=await fixture();
 const p={...f.payload,approvalId:"approval2"};
 const second={keyId:"primary",payload:p,
 signature:crypto.sign(null,Buffer.from(canonical(p)),trusted.privateKey).toString("base64url")};
 const results=await Promise.allSettled([f.issue(),f.issue({approvalId:"approval2",operatorAssertion:second})]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
});
