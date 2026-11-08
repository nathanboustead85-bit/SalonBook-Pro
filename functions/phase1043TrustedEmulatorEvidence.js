"use strict";
/** Phase 10.43: isolated emulator identity + Ed25519 assertion verifier.
 * Not an HTTP endpoint. Never export from functions/index.js.
 * Operator PUBLIC KEY must be provisioned independently by trusted server.
 */
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const {PROJECT,OPERATION}=require("./phase1040EmulatorLockedInitialization");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function deny(message){const e=new Error(message);e.code="phase1043-denied";throw e;}
function requireEmulator(){
 if(!process.env.FIRESTORE_EMULATOR_HOST||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST||
    process.env.GCLOUD_PROJECT!==PROJECT||
    process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
    process.env.GOOGLE_APPLICATION_CREDENTIALS)deny("Dedicated Firestore and Auth emulators required");
}
function canonical(payload){
 return JSON.stringify({
  approvalId:payload.approvalId,archiveSha256:payload.archiveSha256,
  businessId:payload.businessId,expiresAtMs:payload.expiresAtMs,
  issuedAtMs:payload.issuedAtMs,nonce:payload.nonce,
  operation:payload.operation,operatorId:payload.operatorId,
  projectId:payload.projectId,role:payload.role
 });
}
function verifySignedOperatorAssertion({assertion,publicKey,expected,nowMs}){
 requireEmulator();
 if(!assertion||typeof assertion!=="object"||!assertion.payload||
    typeof assertion.signature!=="string"||!publicKey||
    !Number.isSafeInteger(nowMs))deny("Invalid signed assertion");
 const p=assertion.payload;
 if(!ID.test(p.operatorId||"")||!ID.test(p.nonce||"")||
    p.role!=="legacy-mode-approver"||p.projectId!==PROJECT||
    p.operation!==OPERATION||p.businessId!==expected.businessId||
    p.approvalId!==expected.approvalId||
    p.archiveSha256!==expected.archiveSha256||
    !Number.isSafeInteger(p.issuedAtMs)||!Number.isSafeInteger(p.expiresAtMs)||
    p.issuedAtMs>nowMs||p.expiresAtMs<=nowMs||
    p.expiresAtMs-p.issuedAtMs>5*60*1000)deny("Assertion scope or lifetime invalid");
 let key;
 try{key=publicKey?.type==="public"?publicKey:crypto.createPublicKey(publicKey);}catch(_){deny("Invalid trusted public key");}
 if(key.asymmetricKeyType!=="ed25519")deny("Ed25519 public key required");
 let signature;
 try{
  if(!/^[A-Za-z0-9_-]+$/.test(assertion.signature))deny("Invalid signature encoding");
  signature=Buffer.from(assertion.signature,"base64url");
 }catch(_){deny("Invalid signature");}
 if(signature.length!==64||
    !crypto.verify(null,Buffer.from(canonical(p)),key,signature))
  deny("Operator signature verification failed");
 return {verified:true,role:p.role,operatorId:p.operatorId,
  projectId:p.projectId,businessId:p.businessId,operation:p.operation,
  approvalId:p.approvalId,archiveSha256:p.archiveSha256,expiresAtMs:p.expiresAtMs};
}
async function verifyFirebaseOwnerToken(token){
 requireEmulator();
 if(typeof token!=="string"||!token)deny("Firebase ID token required");
 const decoded=await admin.auth().verifyIdToken(token,true);
 if(!decoded?.uid||decoded.email_verified!==true)deny("Verified Firebase owner required");
 return decoded;
}
module.exports={canonical,verifySignedOperatorAssertion,verifyFirebaseOwnerToken,requireEmulator};
