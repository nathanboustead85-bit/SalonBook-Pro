"use strict";
/** Phase 10.51: independent in-memory audit witness for isolated emulator tests.
 * Deliberately separate from Firestore and approval service; NOT durable/WORM.
 * No production exports, credentials, writes, or deployment.
 */
const crypto=require("node:crypto");
const {canonical}=require("./phase1043TrustedEmulatorEvidence");
const {PROJECT}=require("./phase1040EmulatorLockedInitialization");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function deny(message){throw Error("phase1051 audit denied: "+message);}
function requireDemo(){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS)deny("demo emulators required");
}
function digest(value){return crypto.createHash("sha256").update(canonical(value)).digest("hex");}
function evidenceOf({businessId,approvalId,approval,audit,anchor,nonce}){
 if(!ID.test(businessId||"")||!ID.test(approvalId||"")||
 !approval||!audit||!anchor||!nonce)deny("missing audit event");
 const assertion=approval.signedOperatorAssertion;
 if(!assertion||typeof assertion!=="object"||!assertion.payload||
 typeof assertion.signature!=="string")deny("missing signed evidence");
 const p=assertion.payload;
 if(p.businessId!==businessId||p.approvalId!==approvalId||
 approval.ownerUid!==businessId||audit.ownerUid!==businessId||
 audit.approvalId!==approvalId||anchor.approvalId!==approvalId||
 anchor.businessId!==businessId||nonce.businessId!==businessId||
 nonce.approvalId!==approvalId||audit.event!=="issued"||
 p.operatorId!==approval.operatorId||p.operatorId!==audit.operatorId||
 p.operatorId!==anchor.operatorId||p.operatorId!==nonce.operatorId||
 p.archiveSha256!==approval.archiveSha256||
 p.archiveSha256!==anchor.archiveSha256||
 typeof p.nonce!=="string"||p.nonce!==nonce.nonce)deny("event scope mismatch");
 const evidenceDigest=crypto.createHash("sha256").update(JSON.stringify(assertion)).digest("hex");
 const nonceId=crypto.createHash("sha256").update(p.operatorId+"\0"+p.nonce).digest("hex");
 const anchorHash=crypto.createHash("sha256").update(JSON.stringify({
  businessId,approvalId,operatorId:p.operatorId,archiveSha256:p.archiveSha256,
  nonceId,digest:evidenceDigest})).digest("hex");
 if(approval.operatorEvidenceSha256!==evidenceDigest||
 audit.operatorEvidenceSha256!==evidenceDigest||
 anchor.operatorEvidenceSha256!==evidenceDigest||
 nonce.operatorEvidenceSha256!==evidenceDigest||
 JSON.stringify(audit.signedOperatorAssertion)!==JSON.stringify(assertion)||
 approval.nonceId!==nonceId||anchor.nonceId!==nonceId||
 anchor.anchorHash!==anchorHash)deny("audit evidence mismatch");
 return {businessId,approvalId,operatorId:p.operatorId,archiveSha256:p.archiveSha256,
  nonceId,evidenceDigest,anchorHash,signature:assertion.signature,keyId:assertion.keyId};
}
function createIndependentAuditWitness(){
 requireDemo();
 const witnessed=new Map();
 let available=true;
 return Object.freeze({
  setAvailable(value){available=value===true;},
  witness(event){
   requireDemo();if(!available)deny("witness unavailable");
   const evidence=evidenceOf(event),key=evidence.businessId+"/"+evidence.approvalId;
   const fingerprint=digest(evidence);
   if(witnessed.has(key))deny("duplicate witness");
   witnessed.set(key,fingerprint);
   return {witnessed:true,fingerprint};
  },
  verify(event){
   requireDemo();if(!available)deny("witness unavailable");
   const evidence=evidenceOf(event),key=evidence.businessId+"/"+evidence.approvalId;
   if(!witnessed.has(key))deny("missing independent event");
   if(witnessed.get(key)!==digest(evidence))deny("independent event mismatch");
   return {verified:true,productionWriteAllowed:false};
  },
  verifyExpected(businessId,approvalIds,events){
   requireDemo();if(!available)deny("witness unavailable");
   if(!Array.isArray(approvalIds)||new Set(approvalIds).size!==approvalIds.length||
    !Array.isArray(events)||events.length!==approvalIds.length)
    deny("missing or duplicate events");
   const expected=new Set(approvalIds);
   for(const event of events){
    if(event.businessId!==businessId||!expected.delete(event.approvalId))
     deny("unexpected or duplicate event");
    this.verify(event);
   }
   if(expected.size)deny("missing event");
   return {verified:true,count:events.length,productionWriteAllowed:false};
  }
 });
}
module.exports={createIndependentAuditWitness,evidenceOf};
