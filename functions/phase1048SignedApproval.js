"use strict";
/** Phase 10.48: emulator-only signed-evidence issuance and consumption.
 * Never deploy or export from functions/index.js. Trusted callers only.
 */
const crypto=require("node:crypto");
const {checkArchive}=require("./testBookingCleanupPlan");
const {digestBookings}=require("./finalBookingSyncVerifier");
const {MODES,MIGRATION_ID}=require("./bookingMode");
const {PROJECT,OPERATION}=require("./phase1040EmulatorLockedInitialization");
const {verifyRotatedAssertion}=require("./phase1044KeyRotationAndAudit");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function deny(reason){throw Error("Phase 10.48: "+reason);}
function lock(db){
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST||
 process.env.GCLOUD_PROJECT!==PROJECT||process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
 process.env.GOOGLE_APPLICATION_CREDENTIALS||db?.projectId!==PROJECT)deny("emulator only");
}
function hashEvidence(assertion){
 return crypto.createHash("sha256").update(JSON.stringify(assertion)).digest("hex");
}
async function issueSigned({db,businessId,archive,approvalId,ownerToken,assertion,verifyOwner,registry,nowMs}){
 lock(db);
 if(!ID.test(businessId||"")||!ID.test(approvalId||"")||
 !Number.isSafeInteger(nowMs))deny("invalid request");
 const identity=await verifyOwner(ownerToken);
 if(identity?.uid!==businessId||identity.email_verified!==true)deny("owner verification");
 if(archive?.sourcePath!==`users/${businessId}/liveData/bookings`)deny("archive scope");
 const checked=checkArchive(archive);
 if(!checked||checked.hash!==archive.sourceSha256)deny("archive invalid");
 const operator=verifyRotatedAssertion({assertion,registry,expected:{
  businessId,approvalId,archiveSha256:checked.hash},nowMs});
 const nonce=assertion.payload.nonce;
 const nonceId=crypto.createHash("sha256").update(operator.operatorId+"\0"+nonce).digest("hex");
 const business=db.collection("businesses").doc(businessId);
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const audit=business.collection("legacyModeApprovalAudit").doc(approvalId);
 // Nonce ledger is project-wide, preventing cross-business and cross-approval reuse.
 const nonceRef=db.collection("legacyModeOperatorNonces").doc(nonceId);
 const mode=business.collection("settings").doc("bookingMode");
 const marker=business.collection("migrations").doc(MIGRATION_ID);
 const digest=hashEvidence(assertion);
 const anchor=business.collection("legacyModeAuditAnchors").doc(approvalId);
 const anchorHash=crypto.createHash("sha256").update(JSON.stringify({businessId,approvalId,operatorId:operator.operatorId,archiveSha256:checked.hash,nonceId,digest})).digest("hex");
 return db.runTransaction(async tx=>{
  const [a,l,n,m,mark,anch]=await Promise.all([tx.get(approval),tx.get(audit),
   tx.get(nonceRef),tx.get(mode),tx.get(marker),tx.get(anchor)]);
  if(a.exists||l.exists||n.exists||anch.exists)deny("approval or nonce replay");
  if(m.exists||mark.exists)deny("mode already exists");
  const record={ownerUid:businessId,verifiedOwnerUid:businessId,
   operation:OPERATION,archiveSha256:checked.hash,status:"approved",usedAt:null,
   verifiedByTrustedOperator:true,operatorId:operator.operatorId,
   issuedAtMs:nowMs,expiresAtMs:Math.min(nowMs+300000,operator.expiresAtMs),
   signedOperatorAssertion:assertion,operatorEvidenceSha256:digest,nonceId};
  tx.create(nonceRef,{businessId,approvalId,operatorId:operator.operatorId,
   nonce,operatorEvidenceSha256:digest,issuedAtMs:nowMs});
  tx.create(anchor,{businessId,approvalId,operatorId:operator.operatorId,archiveSha256:checked.hash,nonceId,operatorEvidenceSha256:digest,anchorHash});
  tx.create(approval,record);
  tx.create(audit,{event:"issued",approvalId,ownerUid:businessId,
   operatorId:operator.operatorId,operatorEvidenceSha256:digest,
   signedOperatorAssertion:assertion,issuedAtMs:nowMs});
  return {issued:true,approvalId,expiresAtMs:record.expiresAtMs,productionWriteAllowed:false};
 });
}
async function consumeSigned({db,businessId,archive,approvalId,ownerToken,verifyOwner,registry,nowMs}){
 lock(db);
 if(!ID.test(businessId||"")||!ID.test(approvalId||"")||
 !Number.isSafeInteger(nowMs))deny("invalid request");
 const identity=await verifyOwner(ownerToken);
 if(identity?.uid!==businessId||identity.email_verified!==true)deny("owner verification");
 if(archive?.sourcePath!==`users/${businessId}/liveData/bookings`)deny("archive scope");
 const checked=checkArchive(archive);
 if(!checked||checked.hash!==archive.sourceSha256)deny("archive invalid");
 const business=db.collection("businesses").doc(businessId);
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const audit=business.collection("legacyModeApprovalAudit").doc(approvalId);
 const mode=business.collection("settings").doc("bookingMode");
 const marker=business.collection("migrations").doc(MIGRATION_ID);
 const source=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 const anchor=business.collection("legacyModeAuditAnchors").doc(approvalId);
 return db.runTransaction(async tx=>{
  const [a,l,m,mark,src,appts,locks,anch]=await Promise.all([
   tx.get(approval),tx.get(audit),tx.get(mode),tx.get(marker),tx.get(source),
   tx.get(business.collection("appointments")),tx.get(business.collection("bookingLocks")),tx.get(anchor)]);
  if(!a.exists||!l.exists)deny("approval evidence missing");
  const record=a.data(),log=l.data(),assertion=record.signedOperatorAssertion;
  if(record.ownerUid!==businessId||record.verifiedOwnerUid!==businessId||
   record.operation!==OPERATION||record.archiveSha256!==checked.hash||
   record.status!=="approved"||record.usedAt!==null||
   record.verifiedByTrustedOperator!==true||
   !Number.isSafeInteger(record.issuedAtMs)||!Number.isSafeInteger(record.expiresAtMs)||
   record.issuedAtMs>nowMs||record.expiresAtMs<=nowMs||
   record.expiresAtMs-record.issuedAtMs>300000)deny("approval invalid");
  const operator=verifyRotatedAssertion({assertion,registry,expected:{
   businessId,approvalId,archiveSha256:checked.hash},nowMs});
  const digest=hashEvidence(assertion);
  const nonceId=crypto.createHash("sha256").update(operator.operatorId+"\0"+assertion.payload.nonce).digest("hex");
  const expectedAnchorHash=crypto.createHash("sha256").update(JSON.stringify({businessId,approvalId,operatorId:operator.operatorId,archiveSha256:checked.hash,nonceId,digest})).digest("hex");
  const anchorRecord=anch.data();
  if(!anch.exists||anchorRecord.anchorHash!==expectedAnchorHash||
   anchorRecord.businessId!==businessId||anchorRecord.approvalId!==approvalId||
   anchorRecord.operatorId!==operator.operatorId||anchorRecord.nonceId!==nonceId||
   anchorRecord.archiveSha256!==checked.hash||anchorRecord.operatorEvidenceSha256!==digest)
   deny("audit anchor mismatch");
  if(digest!==record.operatorEvidenceSha256||digest!==log.operatorEvidenceSha256||
   JSON.stringify(assertion)!==JSON.stringify(log.signedOperatorAssertion)||
   log.event!=="issued"||log.ownerUid!==businessId||
   log.approvalId!==approvalId||log.operatorId!==operator.operatorId||
   record.operatorId!==operator.operatorId)deny("signed evidence mismatch");
  if(record.nonceId!==nonceId)deny("nonce binding invalid");
  const nonceRef=db.collection("legacyModeOperatorNonces").doc(nonceId);
  const nonceSnap=await tx.get(nonceRef);
  const n=nonceSnap.data();
  if(!nonceSnap.exists||n.businessId!==businessId||n.approvalId!==approvalId||
   n.operatorEvidenceSha256!==digest)deny("nonce ledger mismatch");
  if(m.exists||mark.exists||!appts.empty||!locks.empty)deny("shared mode or booking conflict");
  if(!src.exists||src.data()?.schemaVersion!==1||
   typeof src.data()?.json!=="string")deny("source missing");
  let records;try{records=JSON.parse(src.data().json);}catch(_){deny("invalid source JSON");}
  if(!Array.isArray(records)||records.length!==10||
   digestBookings(src.data().json)!==checked.hash)deny("source changed");
  tx.update(approval,{status:"consumed",usedAt:new Date(nowMs)});
  tx.create(mode,{mode:MODES.LEGACY,schemaVersion:1,updatedAt:new Date(nowMs)});
  return {initialized:true,approvalConsumed:true,mode:MODES.LEGACY,bookingCount:10};
 });
}
module.exports={issueSigned,consumeSigned};
