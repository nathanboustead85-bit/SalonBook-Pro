"use strict";
/** Phase 10.44: emulator-only operator key rotation, revocation and signed audit.
 * This is NOT an independent production audit store or deployable endpoint.
 */
const crypto=require("node:crypto");
const {PROJECT,OPERATION}=require("./phase1040EmulatorLockedInitialization");
const {canonical}=require("./phase1043TrustedEmulatorEvidence");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function deny(reason){const e=new Error(reason);e.code="phase1044-blocked";throw e;}
function lock(db){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||db?.projectId!==PROJECT)
  deny("Dedicated emulator required");
}
function strictKeys(value,keys){
 return value&&typeof value==="object"&&!Array.isArray(value)&&
 Object.keys(value).sort().join("|")===keys.slice().sort().join("|");
}
function trustedKey(registry,keyId,atMs){
 if(!ID.test(keyId||""))deny("Invalid key ID");
 const record=registry?.[keyId];
 if(!record||record.status!=="active"||
 !Number.isSafeInteger(record.validFromMs)||!Number.isSafeInteger(record.validUntilMs)||
 atMs<record.validFromMs||atMs>=record.validUntilMs)deny("Key inactive, retired or revoked");
 let key;try{key=crypto.createPublicKey(record.publicKeyPem);}catch(_){deny("Untrusted public key");}
 if(key.asymmetricKeyType!=="ed25519")deny("Ed25519 required");
 return key;
}
function verifyRotatedAssertion({assertion,registry,expected,nowMs}){
 if(!Number.isSafeInteger(nowMs)||!assertion||
 !strictKeys(assertion,["keyId","payload","signature"]))deny("Malformed assertion");
 const p=assertion.payload;
 if(!strictKeys(p,["approvalId","archiveSha256","businessId","expiresAtMs",
  "issuedAtMs","nonce","operation","operatorId","projectId","role"])||
 !ID.test(p.operatorId||"")||!ID.test(p.nonce||"")||
 p.role!=="legacy-mode-approver"||p.projectId!==PROJECT||
 p.operation!==OPERATION||p.businessId!==expected?.businessId||
 p.approvalId!==expected?.approvalId||p.archiveSha256!==expected?.archiveSha256||
 !Number.isSafeInteger(p.issuedAtMs)||!Number.isSafeInteger(p.expiresAtMs)||
 p.issuedAtMs>nowMs||p.expiresAtMs<=nowMs||
 p.expiresAtMs-p.issuedAtMs>5*60*1000)deny("Assertion scope or expiry invalid");
 const key=trustedKey(registry,assertion.keyId,nowMs);
 if(typeof assertion.signature!=="string"||
 !/^[A-Za-z0-9_-]+$/.test(assertion.signature))deny("Malformed signature");
 const sig=Buffer.from(assertion.signature,"base64url");
 if(sig.length!==64||!crypto.verify(null,Buffer.from(canonical(p)),key,sig))
  deny("Invalid signature");
 return {verified:true,role:p.role,operatorId:p.operatorId,
 projectId:p.projectId,businessId:p.businessId,operation:p.operation,
 approvalId:p.approvalId,archiveSha256:p.archiveSha256,expiresAtMs:p.expiresAtMs};
}
function auditMessage(event){
 return JSON.stringify({approvalId:event.approvalId,archiveSha256:event.archiveSha256,
 businessId:event.businessId,eventType:event.eventType,keyId:event.keyId,
 operatorId:event.operatorId,occurredAtMs:event.occurredAtMs,projectId:event.projectId});
}
function signAudit(event,privateKey){
 return {...event,signature:crypto.sign(null,Buffer.from(auditMessage(event)),privateKey).toString("base64url")};
}
function verifyAudit(record,registry,nowMs){
 if(!record||!strictKeys(record,["approvalId","archiveSha256","businessId",
 "eventType","keyId","operatorId","occurredAtMs","projectId","signature"])||
 record.projectId!==PROJECT||!ID.test(record.businessId||"")||
 !ID.test(record.approvalId||"")||!ID.test(record.operatorId||"")||
 !["issued","revoked"].includes(record.eventType)||
 !Number.isSafeInteger(record.occurredAtMs)||record.occurredAtMs>nowMs||
 typeof record.signature!=="string"||
 !/^[A-Za-z0-9_-]+$/.test(record.signature))deny("Malformed audit evidence");
 const key=trustedKey(registry,record.keyId,nowMs);
 const sig=Buffer.from(record.signature,"base64url");
 if(sig.length!==64||!crypto.verify(null,Buffer.from(auditMessage(record)),key,sig))
  deny("Audit signature invalid");
 return true;
}
async function revokeApprovalEmulator({db,businessId,approvalId,signedAudit,
 registry,nowMs,executionEnabled=false}={}){
 lock(db);
 if(executionEnabled!==true)deny("Revocation disabled by default");
 if(!ID.test(businessId||"")||!ID.test(approvalId||"")||
 signedAudit?.businessId!==businessId||signedAudit?.approvalId!==approvalId||
 signedAudit?.eventType!=="revoked"||signedAudit?.occurredAtMs!==nowMs)
  deny("Revocation scope mismatch");
 verifyAudit(signedAudit,registry,nowMs);
 const business=db.collection("businesses").doc(businessId);
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const audit=business.collection("legacyModeRevocationAudit").doc(approvalId);
 return db.runTransaction(async tx=>{
  const [a,existing]=await Promise.all([tx.get(approval),tx.get(audit)]);
  if(!a.exists||existing.exists)deny("Approval missing or already revoked");
  const record=a.data();
  if(record.status!=="approved"||record.usedAt!==null||
     record.archiveSha256!==signedAudit.archiveSha256)deny("Approval not revocable");
  tx.update(approval,{status:"revoked",revokedAt:new Date(nowMs),
   revocationAuditSignature:signedAudit.signature});
  tx.create(audit,signedAudit);
  return {revoked:true,approvalId,productionWriteAllowed:false};
 });
}
module.exports={verifyRotatedAssertion,signAudit,verifyAudit,revokeApprovalEmulator};
