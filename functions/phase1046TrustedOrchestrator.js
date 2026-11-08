"use strict";
/** Phase 10.46 — emulator-only trusted boundary. NOT exported from index.js.
 * Caller inputs are allowlisted. Trusted dependencies are bound at construction,
 * not accepted in request payloads. Production execution remains prohibited.
 */
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {PROJECT}=require("./phase1040EmulatorLockedInitialization");
const {verifyRotatedAssertion}=require("./phase1044KeyRotationAndAudit");
const {issueSigned,consumeSigned}=require("./phase1048SignedApproval");
const {createIndependentAuditWitness}=require("./phase1051IndependentAuditWitness");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function fail(message){const error=new Error(message);error.code="phase1046-denied";throw error;}
function lock(db){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||db?.projectId!==PROJECT)
 fail("Dedicated Auth and Firestore demo emulators required");
}
function exactKeys(value,keys){
 return value&&typeof value==="object"&&!Array.isArray(value)&&
 Object.keys(value).sort().join("|")===keys.slice().sort().join("|");
}
function createTrustedEmulatorOrchestrator({db,operatorKeyRegistry}={}){
 lock(db);
 if(!operatorKeyRegistry||typeof operatorKeyRegistry!=="object"||
 Array.isArray(operatorKeyRegistry)||Object.keys(operatorKeyRegistry).length===0)
 fail("Trusted operator registry required");
 // Snapshot trusted configuration; never read registry or key from a request.
 if(Object.getPrototypeOf(operatorKeyRegistry)!==Object.prototype&&Object.getPrototypeOf(operatorKeyRegistry)!==null)
  fail("Plain trusted registry required");
 const registry=Object.create(null);
 for(const [id,item] of Object.entries(operatorKeyRegistry)){
  if(!ID.test(id)||!exactKeys(item,["status","publicKeyPem","validFromMs","validUntilMs"])||
  typeof item.publicKeyPem!=="string"||
  !["active","retired","revoked"].includes(item.status)||
  !Number.isSafeInteger(item.validFromMs)||!Number.isSafeInteger(item.validUntilMs))
  fail("Invalid trusted key configuration");
  let key;try{key=crypto.createPublicKey(item.publicKeyPem);}catch(_){fail("Invalid trusted key");}
  if(key.asymmetricKeyType!=="ed25519")fail("Ed25519 only");
  if(Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)
   fail("Plain key record required");
  registry[id]=Object.freeze({...item});
 }
 Object.freeze(registry);
 // Private per-orchestrator witness: never accepted from a caller request.
 const auditWitness=createIndependentAuditWitness();
 async function readAuditEvent(businessId,approvalId){
  const business=db.collection("businesses").doc(businessId);
  const approval=(await business.collection("legacyModeApprovals").doc(approvalId).get()).data();
  if(!approval)fail("issued approval missing");
  const [audit,anchor,nonce]=await Promise.all([
   business.collection("legacyModeApprovalAudit").doc(approvalId).get(),
   business.collection("legacyModeAuditAnchors").doc(approvalId).get(),
   db.collection("legacyModeOperatorNonces").doc(approval.nonceId).get()]);
  return {businessId,approvalId,approval,audit:audit.data(),anchor:anchor.data(),nonce:nonce.data()};
 }
 const verifyOwner=async token=>{
  lock(db);
  if(typeof token!=="string"||!token)fail("ID token required");
  const identity=await admin.auth().verifyIdToken(token,true);
  if(!identity?.uid||identity.email_verified!==true)fail("Verified owner required");
  return identity;
 };
 const trustedNow=()=>Date.now();
 async function issue(request){
  lock(db);
  if(!exactKeys(request,["businessId","archive","approvalId","ownerToken","operatorAssertion"]))
   fail("Unexpected caller-controlled fields");
  const {businessId,archive,approvalId,ownerToken,operatorAssertion}=request;
  if(!ID.test(businessId||"")||!ID.test(approvalId||""))fail("Invalid identifiers");
  const nowMs=trustedNow();
  if(!exactKeys(operatorAssertion,["keyId","payload","signature"]))
   fail("Malformed signed operator assertion");
  const result=await issueSigned({db,businessId,archive,approvalId,ownerToken,assertion:operatorAssertion,verifyOwner,registry,nowMs});
  // If witnessing fails, return failure and leave the approval unconsumable.
  auditWitness.witness(await readAuditEvent(businessId,approvalId));
  return result;
 }
 async function consume(request){
  lock(db);
  if(!exactKeys(request,["businessId","archive","approvalId","ownerToken"]))
   fail("Unexpected caller-controlled fields");
  const {businessId,archive,approvalId,ownerToken}=request;
  if(!ID.test(businessId||"")||!ID.test(approvalId||""))fail("Invalid identifiers");
  return consumeSigned({db,businessId,archive,approvalId,ownerToken,verifyOwner,registry,nowMs:trustedNow(),auditWitness});
 }
 return Object.freeze({issue,consume});
}
module.exports={createTrustedEmulatorOrchestrator};
