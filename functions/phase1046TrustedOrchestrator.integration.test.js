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

test("Phase 10.49 missing audit anchor blocks consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("legacyModeAuditAnchors").doc("approval1").delete();
 await assert.rejects(f.consume(),/audit anchor mismatch/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.49 tampered audit anchor blocks consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("legacyModeAuditAnchors").doc("approval1").update({anchorHash:"forged"});
 await assert.rejects(f.consume(),/audit anchor mismatch/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.49 altered operator identity in anchor blocks consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("legacyModeAuditAnchors").doc("approval1").update({operatorId:"attacker"});
 await assert.rejects(f.consume(),/audit anchor mismatch/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.49 unmodified anchored approval still consumes successfully",async()=>{
 const f=await fixture();await f.issue();
 assert.equal((await f.consume()).initialized,true);
});

test("Phase 10.49 rejects inherited registry and non-plain key records",async()=>{
 const inherited=Object.create({hidden:{status:"active"}});
 inherited.primary=registry().primary;
 assert.throws(()=>createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:inherited}),/Plain trusted registry/);
 const keys={primary:Object.assign(Object.create({privateKey:"hidden"}),registry().primary)};
 assert.throws(()=>createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:keys}),/Plain key record/);
});
test("Phase 10.49 rejects private signing key in trusted registry",async()=>{
 const keys=registry();keys.primary.privateKeyPem="secret";
 assert.throws(()=>createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:keys}),/Invalid trusted key configuration/);
});

const {createIndependentAuditWitness}=require("./phase1051IndependentAuditWitness");
async function auditEvent(f){
 const approval=(await f.approval.get()).data();
 const audit=(await f.business.collection("legacyModeApprovalAudit").doc("approval1").get()).data();
 const anchor=(await f.business.collection("legacyModeAuditAnchors").doc("approval1").get()).data();
 const nonce=(await db.collection("legacyModeOperatorNonces").doc(approval.nonceId).get()).data();
 return {businessId:f.businessId,approvalId:"approval1",approval,audit,anchor,nonce};
}
test("Phase 10.51 independent witness verifies unchanged emulator approval evidence",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),w=createIndependentAuditWitness();
 assert.equal(w.witness(event).witnessed,true);
 assert.equal(w.verify(event).verified,true);
});
test("Phase 10.51 missing independent witness fails closed",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f);
 assert.throws(()=>createIndependentAuditWitness().verify(event),/missing independent event/);
});
test("Phase 10.51 tampered audit event fails independent witness",async()=>{
 const f=await fixture();await f.issue();
 const w=createIndependentAuditWitness(),event=await auditEvent(f);w.witness(event);
 const tampered=structuredClone(event);tampered.audit.operatorId="attacker";
 assert.throws(()=>w.verify(tampered),/scope mismatch/);
});
test("Phase 10.51 coordinated evidence rewrite is caught by independent fingerprint",async()=>{
 const f=await fixture();await f.issue();
 const w=createIndependentAuditWitness(),event=await auditEvent(f);w.witness(event);
 const tampered=structuredClone(event);
 tampered.approval.signedOperatorAssertion.signature="forged";
 tampered.audit.signedOperatorAssertion.signature="forged";
 const changed=crypto.createHash("sha256").update(JSON.stringify(tampered.approval.signedOperatorAssertion)).digest("hex");
 tampered.approval.operatorEvidenceSha256=changed;
 tampered.audit.operatorEvidenceSha256=changed;
 tampered.anchor.operatorEvidenceSha256=changed;
 tampered.nonce.operatorEvidenceSha256=changed;
 assert.throws(()=>w.verify(tampered),/audit evidence mismatch|independent event mismatch/);
});
test("Phase 10.51 unavailable independent audit fails closed",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),w=createIndependentAuditWitness();w.witness(event);
 w.setAvailable(false);
 assert.throws(()=>w.verify(event),/witness unavailable/);
 assert.throws(()=>w.witness(event),/witness unavailable/);
});
test("Phase 10.51 missing event in expected audit set is rejected",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),w=createIndependentAuditWitness();w.witness(event);
 assert.throws(()=>w.verifyExpected(f.businessId,["approval1","approval2"],[event]),/missing or duplicate events/);
});
test("Phase 10.51 duplicate independent event and duplicate batch are rejected",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),w=createIndependentAuditWitness();w.witness(event);
 assert.throws(()=>w.witness(event),/duplicate witness/);
 assert.throws(()=>w.verifyExpected(f.businessId,["approval1","approval1"],[event,event]),/missing or duplicate events/);
});
test("Phase 10.51 non-demo environment rejects witness verification",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),w=createIndependentAuditWitness();w.witness(event);
 const original=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 assert.throws(()=>w.verify(event),/demo emulators required/);}
 finally{process.env.GCLOUD_PROJECT=original;}
});

test("Phase 10.52 new orchestrator without witnessed event cannot consume approval",async()=>{
 const f=await fixture();await f.issue();
 const other=createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:registry()});
 await assert.rejects(other.consume({businessId:f.businessId,archive:f.archive,
 approvalId:"approval1",ownerToken:f.ownerToken}),/missing independent event/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.52 altered audit document blocks witnessed consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("legacyModeApprovalAudit").doc("approval1").update({operatorId:"intruder"});
 await assert.rejects(f.consume(),/scope mismatch|signed evidence mismatch/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.52 removed anchor blocks witnessed consumption",async()=>{
 const f=await fixture();await f.issue();
 await f.business.collection("legacyModeAuditAnchors").doc("approval1").delete();
 await assert.rejects(f.consume(),/audit anchor mismatch|missing audit event/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.52 unavailable witness aborts transaction without booking-mode write",async()=>{
 const f=await fixture();await f.issue();
 const {consumeSigned}=require("./phase1048SignedApproval");
 const witness=createIndependentAuditWitness();
 witness.setAvailable(false);
 await assert.rejects(consumeSigned({db,businessId:f.businessId,archive:f.archive,
 approvalId:"approval1",ownerToken:f.ownerToken,
 verifyOwner:async token=>admin.auth().verifyIdToken(token,true),
 registry:registry(),nowMs:Date.now(),auditWitness:witness}),/witness unavailable/);
 assert.equal((await f.mode.get()).exists,false);
 assert.equal((await f.approval.get()).data().status,"approved");
});
test("Phase 10.52 concurrent witnessed consumption remains single-use",async()=>{
 const f=await fixture();await f.issue();
 const results=await Promise.allSettled([f.consume(),f.consume()]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 assert.equal((await f.mode.get()).exists,true);
 assert.equal((await f.source.get()).data().json,json);
});
test("Phase 10.52 caller cannot inject witness or bypass audit checks",async()=>{
 const f=await fixture();await f.issue();
 await assert.rejects(f.consume({auditWitness:{verify:()=>({verified:true})}}),/Unexpected/);
 await assert.rejects(f.consume({skipAudit:true}),/Unexpected/);
 assert.equal((await f.mode.get()).exists,false);
});

const fs1053=require("node:fs");
const os1053=require("node:os");
const path1053=require("node:path");
const {createDurableAuditPrototype}=require("./phase1053DurableAuditPrototype");
function durableFixture(){
 const directory=fs1053.mkdtempSync(path1053.join(os1053.tmpdir(),"boustio-audit-"));
 return {directory,store:()=>createDurableAuditPrototype({directory})};
}
test("Phase 10.53 durable receipt survives a fresh witness instance",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();
 assert.equal(d.store().witness(event).witnessed,true);
 assert.equal(d.store().reconcile(event).verified,true);
});
test("Phase 10.53 missing receipt never reconstructed from Firestore",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();
 assert.throws(()=>d.store().reconcile(event),/missing independent receipt/);
 assert.deepEqual(fs1053.readdirSync(d.directory),[]);
});
test("Phase 10.53 mismatched evidence rejected after restart",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();d.store().witness(event);
 const altered=structuredClone(event);
 altered.approval.signedOperatorAssertion.signature="forged";
 assert.throws(()=>d.store().reconcile(altered),/audit evidence mismatch|independent receipt mismatch/);
});
test("Phase 10.53 concurrent receipt creation permits only one writer",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();
 const attempts=await Promise.allSettled([Promise.resolve().then(()=>d.store().witness(event)),
 Promise.resolve().then(()=>d.store().witness(event))]);
 assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(attempts.filter(x=>x.status==="rejected").length,1);
 assert.equal(d.store().verify(event).verified,true);
});
test("Phase 10.53 corrupted independent receipt fails closed",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();d.store().witness(event);
 const file=path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]);
 fs1053.writeFileSync(file,"{broken");
 assert.throws(()=>d.store().reconcile(event),/corrupt independent receipt/);
});
test("Phase 10.53 outage rejects recovery and verification",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();
 const store=d.store();store.witness(event);store.setAvailable(false);
 assert.throws(()=>store.reconcile(event),/independent store unavailable/);
 assert.throws(()=>store.verify(event),/independent store unavailable/);
});
test("Phase 10.53 concurrent recovery never creates missing receipts",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();
 const results=await Promise.allSettled([Promise.resolve().then(()=>d.store().reconcile(event)),
 Promise.resolve().then(()=>d.store().reconcile(event))]);
 assert.equal(results.filter(x=>x.status==="rejected").length,2);
 assert.deepEqual(fs1053.readdirSync(d.directory),[]);
});
test("Phase 10.53 non-demo environment blocks recovery",async()=>{
 const f=await fixture();await f.issue();
 const event=await auditEvent(f),d=durableFixture();d.store().witness(event);
 const old=process.env.GCLOUD_PROJECT;
 try{process.env.GCLOUD_PROJECT="salonbook-pro-ad5ff";
 assert.throws(()=>d.store().reconcile(event),/demo emulators required/);}
 finally{process.env.GCLOUD_PROJECT=old;}
});

function durableOrchestrator(directory){
 return createTrustedEmulatorOrchestrator({db,operatorKeyRegistry:registry(),durableAuditDirectory:directory});
}
async function durableApproval(){
 const f=await fixture(),d=durableFixture();
 const first=durableOrchestrator(d.directory);
 const request={businessId:f.businessId,archive:f.archive,approvalId:"approval1",
 ownerToken:f.ownerToken};
 await first.issue({...request,operatorAssertion:f.operatorAssertion});
 return {f,d,request,first};
}
test("Phase 10.54 durable orchestrator survives restart and consumes once",async()=>{
 const {f,d,request}=await durableApproval();
 const restarted=durableOrchestrator(d.directory);
 assert.equal((await restarted.consume(request)).initialized,true);
 assert.equal((await f.mode.get()).data().mode,"legacy");
 assert.equal((await f.source.get()).data().json,json);
});
test("Phase 10.54 absent receipt rejects consumption after restart",async()=>{
 const {f,d,request}=await durableApproval();
 fs1053.unlinkSync(path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]));
 await assert.rejects(durableOrchestrator(d.directory).consume(request),/missing independent receipt/);
 assert.equal((await f.mode.get()).exists,false);
 assert.equal((await f.approval.get()).data().status,"approved");
});
test("Phase 10.54 corrupted receipt rejects consumption after restart",async()=>{
 const {f,d,request}=await durableApproval();
 fs1053.writeFileSync(path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]),"{broken");
 await assert.rejects(durableOrchestrator(d.directory).consume(request),/corrupt independent receipt/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.54 changed approval evidence rejects durable verification",async()=>{
 const {f,d,request}=await durableApproval();
 await f.approval.update({operatorId:"tampered"});
 await assert.rejects(durableOrchestrator(d.directory).consume(request),/signed evidence mismatch|event scope mismatch/);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.54 concurrent recovery across orchestrator instances is single-use",async()=>{
 const {f,d,request}=await durableApproval();
 const a=durableOrchestrator(d.directory),b=durableOrchestrator(d.directory);
 const result=await Promise.allSettled([a.consume(request),b.consume(request)]);
 assert.equal(result.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(result.filter(x=>x.status==="rejected").length,1);
 assert.equal((await f.mode.get()).exists,true);
});
test("Phase 10.54 caller cannot override trusted durable directory",async()=>{
 const {f,d,request}=await durableApproval();
 await assert.rejects(durableOrchestrator(d.directory).consume({...request,durableAuditDirectory:"/tmp"}),/Unexpected/);
 assert.equal((await f.mode.get()).exists,false);
});

test("Phase 10.55 incomplete pending receipt cannot be recovered",async()=>{
 const f=await fixture();await f.issue();const event=await auditEvent(f),d=durableFixture();
 fs1053.writeFileSync(path1053.join(d.directory,".interrupted.pending"),'{"schemaVersion":1');
 assert.throws(()=>d.store().reconcile(event),/missing independent receipt/);
});
test("Phase 10.55 published receipts contain integrity checksum and no pending files",async()=>{
 const f=await fixture();await f.issue();const event=await auditEvent(f),d=durableFixture();
 d.store().witness(event);
 const names=fs1053.readdirSync(d.directory);
 assert.equal(names.length,1);assert.ok(names[0].endsWith(".receipt"));
 const receipt=JSON.parse(fs1053.readFileSync(path1053.join(d.directory,names[0]),"utf8"));
 assert.match(receipt.checksum,/^[a-f0-9]{64}$/);
 assert.equal(d.store().verify(event).verified,true);
});
test("Phase 10.55 modified receipt fingerprint without checksum update is rejected",async()=>{
 const f=await fixture();await f.issue();const event=await auditEvent(f),d=durableFixture();
 d.store().witness(event);
 const file=path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]);
 const receipt=JSON.parse(fs1053.readFileSync(file,"utf8"));
 receipt.fingerprint="0".repeat(64);fs1053.writeFileSync(file,JSON.stringify(receipt));
 assert.throws(()=>d.store().verify(event),/invalid independent receipt|independent receipt mismatch/);
});
test("Phase 10.55 symlink receipt is never trusted",async()=>{
 const f=await fixture();await f.issue();const event=await auditEvent(f),d=durableFixture();
 d.store().witness(event);
 const file=path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]);
 const target=path1053.join(d.directory,"outside.json");
 fs1053.renameSync(file,target);fs1053.symlinkSync(target,file);
 assert.throws(()=>d.store().verify(event),/unsafe receipt file/);
});
test("Phase 10.55 truncated published receipt fails closed",async()=>{
 const f=await fixture();await f.issue();const event=await auditEvent(f),d=durableFixture();
 d.store().witness(event);
 const file=path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]);
 fs1053.truncateSync(file,8);
 assert.throws(()=>d.store().reconcile(event),/corrupt independent receipt/);
});
test("Phase 10.55 duplicate receipt publication does not overwrite original",async()=>{
 const f=await fixture();await f.issue();const event=await auditEvent(f),d=durableFixture();
 const store=d.store();store.witness(event);
 const file=path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]);
 const before=fs1053.readFileSync(file,"utf8");
 assert.throws(()=>d.store().witness(event),/receipt already exists/);
 assert.equal(fs1053.readFileSync(file,"utf8"),before);
 assert.equal(fs1053.readdirSync(d.directory).length,1);
});

const {authorize:authorize1056}=require("./phase1056EmulatorPermissions");
const permissionBase={projectId:PROJECT,businessId:"salon1",ownerUid:"salon1",verified:true,operatorRole:"legacy-mode-approver"};
test("Phase 10.56 owner may request but cannot directly issue or consume records",()=>{
 assert.equal(authorize1056({...permissionBase,role:"owner",action:"request-issue"}).allowed,true);
 assert.throws(()=>authorize1056({...permissionBase,role:"owner",action:"issue-record"}),/permission denied/);
 assert.throws(()=>authorize1056({...permissionBase,role:"owner",action:"consume-record"}),/permission denied/);
});
test("Phase 10.56 issuer cannot consume, sign or audit",()=>{
 assert.equal(authorize1056({...permissionBase,role:"issuer",action:"issue-record"}).allowed,true);
 for(const action of ["consume-record","sign-approval","verify-receipt"])
  assert.throws(()=>authorize1056({...permissionBase,role:"issuer",action}),/permission denied/);
});
test("Phase 10.56 consumer cannot issue, sign or audit",()=>{
 assert.equal(authorize1056({...permissionBase,role:"consumer",action:"consume-record"}).allowed,true);
 for(const action of ["issue-record","sign-approval","verify-receipt"])
  assert.throws(()=>authorize1056({...permissionBase,role:"consumer",action}),/permission denied/);
});
test("Phase 10.56 auditor is verification-only and operator is signing-only",()=>{
 assert.equal(authorize1056({...permissionBase,role:"auditor",action:"verify-receipt"}).allowed,true);
 assert.equal(authorize1056({...permissionBase,role:"operator",action:"sign-approval"}).allowed,true);
 assert.throws(()=>authorize1056({...permissionBase,role:"auditor",action:"issue-record"}),/permission denied/);
 assert.throws(()=>authorize1056({...permissionBase,role:"operator",action:"consume-record"}),/permission denied/);
});
test("Phase 10.56 cross-business or unverified owner rejected",()=>{
 assert.throws(()=>authorize1056({...permissionBase,role:"owner",action:"request-issue",ownerUid:"other"}),/permission denied/);
 assert.throws(()=>authorize1056({...permissionBase,role:"owner",action:"request-consume",verified:false}),/permission denied/);
});
test("Phase 10.56 unknown roles, actions and prototype properties rejected",()=>{
 for(const role of ["admin","__proto__","constructor","ownerClient"])
  assert.throws(()=>authorize1056({...permissionBase,role,action:"request-issue"}),/permission denied/);
 assert.throws(()=>authorize1056({...permissionBase,role:"owner",action:"delete-bookings"}),/permission denied/);
});
test("Phase 10.56 non-demo project and missing emulator rejected",()=>{
 assert.throws(()=>authorize1056({...permissionBase,role:"auditor",action:"verify-receipt",projectId:"salonbook-pro-ad5ff"}),/permission denied/);
 const old=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 try{delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
 assert.throws(()=>authorize1056({...permissionBase,role:"auditor",action:"verify-receipt"}),/permission denied/);}
 finally{process.env.FIREBASE_AUTH_EMULATOR_HOST=old;}
});
test("Phase 10.56 orchestrator denies wrong owner before approval mutation",async()=>{
 const f=await fixture(),other=await fixture();
 await assert.rejects(f.issue({ownerToken:other.ownerToken}),/permission denied|owner/);
 assert.equal((await f.approval.get()).exists,false);
});

async function bookingProtectionSnapshot(f){
 const [source,appointments,locks,migration]=await Promise.all([
  f.source.get(),f.business.collection("appointments").get(),
  f.business.collection("bookingLocks").get(),
  f.business.collection("migrations").doc("android-bookings-v1").get()]);
 return {source:source.data(),sourceExists:source.exists,
  appointments:appointments.docs.map(x=>({id:x.id,data:x.data()})),
  locks:locks.docs.map(x=>({id:x.id,data:x.data()})),
  migrationExists:migration.exists,migration:migration.data()||null};
}
async function assertBookingProtection(f,before){
 assert.deepEqual(await bookingProtectionSnapshot(f),before);
}
test("Phase 10.57 issuance preserves source bookings, appointments and locks",async()=>{
 const f=await fixture(),before=await bookingProtectionSnapshot(f);
 await f.issue();await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.57 successful consumption preserves source bookings and protected collections",async()=>{
 const {f,d,request}=await durableApproval();
 const before=await bookingProtectionSnapshot(f);
 await durableOrchestrator(d.directory).consume(request);
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).data().mode,"legacy");
});
test("Phase 10.57 missing audit receipt blocks mode but preserves all booking data",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 fs1053.unlinkSync(path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]));
 await assert.rejects(durableOrchestrator(d.directory).consume(request),/missing independent receipt/);
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.57 tampered audit evidence blocks consumption without booking writes",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 await f.business.collection("legacyModeApprovalAudit").doc("approval1").update({operatorId:"rogue"});
 await assert.rejects(durableOrchestrator(d.directory).consume(request));
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.57 failed owner authorisation preserves booking data and approval state",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 const other=await fixture();
 await assert.rejects(durableOrchestrator(d.directory).consume({...request,ownerToken:other.ownerToken}));
 await assertBookingProtection(f,before);
 assert.equal((await f.approval.get()).data().status,"approved");
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.57 concurrent consumption is single-use and never changes booking data",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 const results=await Promise.allSettled([
  durableOrchestrator(d.directory).consume(request),
  durableOrchestrator(d.directory).consume(request)]);
 assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(results.filter(x=>x.status==="rejected").length,1);
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).data().mode,"legacy");
});
test("Phase 10.57 changed source hash rejects consumption without further source mutation",async()=>{
 const {f,d,request}=await durableApproval();
 const altered=JSON.stringify(Array.from({length:10},(_,i)=>({id:"changed"+i})));
 await f.source.update({json:altered});
 const before=await bookingProtectionSnapshot(f);
 await assert.rejects(durableOrchestrator(d.directory).consume(request),/source changed/);
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).exists,false);
});

test("Phase 10.58 cross-phase forged operator and owner cannot issue or change bookings",async()=>{
 const f=await fixture(),before=await bookingProtectionSnapshot(f);
 await assert.rejects(f.issue({operatorAssertion:f.signed(rogue.privateKey)}),/signature/);
 const stranger=await fixture();
 await assert.rejects(f.issue({ownerToken:stranger.ownerToken}));
 assert.equal((await f.approval.get()).exists,false);
 await assertBookingProtection(f,before);
});
test("Phase 10.58 cross-phase nonce replay rejected without booking mutation",async()=>{
 const f=await fixture();await f.issue();const before=await bookingProtectionSnapshot(f);
 const payload={...f.payload,approvalId:"approval2"};
 const assertion={keyId:"primary",payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),trusted.privateKey).toString("base64url")};
 await assert.rejects(f.issue({approvalId:"approval2",operatorAssertion:assertion}),/nonce replay/);
 await assertBookingProtection(f,before);
 assert.equal((await f.business.collection("legacyModeApprovals").doc("approval2").get()).exists,false);
});
test("Phase 10.58 cross-phase independent receipt missing blocks recovery and preserves bookings",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 const receipt=path1053.join(d.directory,fs1053.readdirSync(d.directory)[0]);
 fs1053.unlinkSync(receipt);
 await assert.rejects(durableOrchestrator(d.directory).consume(request),/missing independent receipt/);
 await assertBookingProtection(f,before);
 assert.equal((await f.approval.get()).data().status,"approved");
});
test("Phase 10.58 cross-phase tampered nonce evidence blocks witnessed consumption",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 const nonceId=(await f.approval.get()).data().nonceId;
 await db.collection("legacyModeOperatorNonces").doc(nonceId).update({operatorId:"attacker"});
 await assert.rejects(durableOrchestrator(d.directory).consume(request));
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.58 cross-phase denied role cannot override trusted orchestrator",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 assert.throws(()=>authorize1056({...permissionBase,role:"auditor",action:"consume-record"}),/permission denied/);
 await assert.rejects(durableOrchestrator(d.directory).consume({...request,role:"consumer"}),/Unexpected/);
 await assertBookingProtection(f,before);
 assert.equal((await f.mode.get()).exists,false);
});
test("Phase 10.58 cross-phase concurrent consumption preserves bookings and replay is denied",async()=>{
 const {f,d,request}=await durableApproval(),before=await bookingProtectionSnapshot(f);
 const outcomes=await Promise.allSettled([durableOrchestrator(d.directory).consume(request),durableOrchestrator(d.directory).consume(request)]);
 assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
 await assert.rejects(durableOrchestrator(d.directory).consume(request));
 await assertBookingProtection(f,before);
 assert.equal((await f.approval.get()).data().status,"consumed");
});
