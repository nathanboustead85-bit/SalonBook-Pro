"use strict";
/** Phase 10.41: emulator-only issuance prototype, not exported from index.js.
 * Trust boundary: verifyOwnerToken and verifyOperatorAssertion MUST be independently
 * implemented by a trusted server. Mocked in tests; no production authority.
 */
const crypto=require("node:crypto");
const {checkArchive}=require("./testBookingCleanupPlan");
const {PROJECT,OPERATION}=require("./phase1040EmulatorLockedInitialization");
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function fail(message){const e=new Error(message);e.code="phase1041-blocked";throw e;}
function lock(db){
 if(!process.env.FIRESTORE_EMULATOR_HOST||
    process.env.GCLOUD_PROJECT!==PROJECT||
    process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
    process.env.GOOGLE_APPLICATION_CREDENTIALS||
    db?.projectId!==PROJECT)fail("Dedicated emulator required");
}
async function issueEmulatorApproval({
 db,businessId,archive,approvalId,ownerToken,operatorAssertion,
 verifyOwnerToken,verifyOperatorAssertion,nowMs,executionEnabled=false
}={}){
 lock(db);
 if(executionEnabled!==true)fail("Issuance disabled by default");
 if(!ID.test(businessId||"")||!ID.test(approvalId||""))fail("Invalid identifiers");
 if(typeof verifyOwnerToken!=="function"||typeof verifyOperatorAssertion!=="function"||
    typeof ownerToken!=="string"||!ownerToken||
    typeof operatorAssertion!=="string"||!operatorAssertion)fail("Independent verifiers required");
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)fail("Trusted clock required");
 const owner=await verifyOwnerToken(ownerToken,true);
 const operator=await verifyOperatorAssertion(operatorAssertion);
 if(owner?.uid!==businessId||owner.email_verified!==true)fail("Verified owner required");
 if(operator?.verified!==true||operator.role!=="legacy-mode-approver"||
    typeof operator.operatorId!=="string"||!ID.test(operator.operatorId)||
    operator.projectId!==PROJECT||operator.businessId!==businessId||
    operator.operation!==OPERATION||operator.approvalId!==approvalId||
    operator.archiveSha256!==archive?.sourceSha256||
    !Number.isSafeInteger(operator.expiresAtMs)||operator.expiresAtMs<=nowMs||
    operator.expiresAtMs>nowMs+5*60*1000)fail("Independent operator assertion required");
 if(!archive||archive.sourcePath!==`users/${businessId}/liveData/bookings`)
  fail("Archive owner mismatch");
 const checked=checkArchive(archive);
 if(!checked)fail("Invalid archive");
 const business=db.collection("businesses").doc(businessId);
 const approval=business.collection("legacyModeApprovals").doc(approvalId);
 const audit=business.collection("legacyModeApprovalAudit").doc(approvalId);
 const mode=business.collection("settings").doc("bookingMode");
 const marker=business.collection("migrations").doc("android-bookings-v1");
 const issuedAtMs=nowMs,expiresAtMs=nowMs+Math.min(5*60*1000,operator.expiresAtMs-nowMs);
 const digest=crypto.createHash("sha256").update(JSON.stringify({
  approvalId,businessId,operation:OPERATION,archiveSha256:checked.hash,
  operatorId:operator.operatorId,issuedAtMs,expiresAtMs
 })).digest("hex");
 return db.runTransaction(async tx=>{
  const [a,log,m,migration]=await Promise.all([
   tx.get(approval),tx.get(audit),tx.get(mode),tx.get(marker)
  ]);
  if(a.exists||log.exists)fail("Approval ID already used");
  if(m.exists||migration.exists)fail("Booking mode or migration already exists");
  tx.create(approval,{ownerUid:businessId,verifiedOwnerUid:businessId,
   operation:OPERATION,archiveSha256:checked.hash,status:"approved",usedAt:null,
   verifiedByTrustedOperator:true,operatorId:operator.operatorId,
   issuedAtMs,expiresAtMs,evidenceDigest:digest});
  tx.create(audit,{approvalId,ownerUid:businessId,operatorId:operator.operatorId,
   operation:OPERATION,archiveSha256:checked.hash,issuedAtMs,expiresAtMs,
   evidenceDigest:digest,event:"issued"});
  return {issued:true,approvalId,expiresAtMs,evidenceDigest:digest,
   productionWriteAllowed:false};
 });
}
module.exports={issueEmulatorApproval};
