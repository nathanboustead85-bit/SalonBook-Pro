"use strict";
/**
 * Phase 10.40 — EMULATOR-ONLY single-use approval prototype.
 * HARD LOCK: refuses all non-demo projects, missing emulator host or credentials.
 * Never import this module from functions/index.js or deploy it.
 */
const {digestBookings}=require("./finalBookingSyncVerifier");
const {checkArchive}=require("./testBookingCleanupPlan");
const {MODES,MIGRATION_ID}=require("./bookingMode");
const PROJECT="demo-boustio-legacy-init";
const OPERATION="INITIALISE_LEGACY_BOOKING_MODE_ONLY";
const ID=/^[A-Za-z0-9_-]{1,100}$/;
function block(reason){const e=new Error(reason);e.code="phase1040-locked";throw e;}
function emulatorLock(db){
 if(process.env.FIRESTORE_EMULATOR_HOST===undefined||
    process.env.GCLOUD_PROJECT!==PROJECT||
    process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
    process.env.GOOGLE_APPLICATION_CREDENTIALS||
    db?.projectId!==PROJECT)block("Emulator-only execution lock");
}
async function initialiseWithSingleUseApproval({
 db,verifyIdToken,idToken,businessId,archive,approvalId,nowMs,
 executionEnabled=false
}={}){
 emulatorLock(db);
 if(executionEnabled!==true)block("Execution disabled by default");
 if(typeof verifyIdToken!=="function"||typeof idToken!=="string"||!idToken)
  block("Trusted token verifier required");
 if(typeof businessId!=="string"||!ID.test(businessId)||
    typeof approvalId!=="string"||!ID.test(approvalId))block("Invalid identifiers");
 if(!Number.isSafeInteger(nowMs)||nowMs<=0)block("Trusted time required");
 // In real use, verifier must be the trusted Firebase Admin verifyIdToken,
 // never an identity supplied by the client. This module is demo-only.
 const identity=await verifyIdToken(idToken,true);
 if(!identity||identity.uid!==businessId||identity.email_verified!==true)
  block("Verified Firebase owner required");
 if(!archive||archive.sourcePath!==`users/${businessId}/liveData/bookings`)
  block("Owner-bound archive required");
 const verified=checkArchive(archive);
 if(!verified)block("Invalid archived bookings");
 const business=db.collection("businesses").doc(businessId);
 const approvalRef=business.collection("legacyModeApprovals").doc(approvalId);
 const modeRef=business.collection("settings").doc("bookingMode");
 const markerRef=business.collection("migrations").doc(MIGRATION_ID);
 const sourceRef=db.collection("users").doc(businessId).collection("liveData").doc("bookings");
 const appointments=business.collection("appointments");
 const locks=business.collection("bookingLocks");
 return db.runTransaction(async tx=>{
  const [a,m,marker,source,appts,lockDocs]=await Promise.all([
   tx.get(approvalRef),tx.get(modeRef),tx.get(markerRef),tx.get(sourceRef),
   tx.get(appointments),tx.get(locks)
  ]);
  const record=a.exists?a.data():null;
  if(!record||record.ownerUid!==businessId||record.operation!==OPERATION||
     record.archiveSha256!==verified.hash||record.status!=="approved"||
     record.usedAt!==null||record.verifiedOwnerUid!==businessId||
     record.verifiedByTrustedOperator!==true||
     !Number.isSafeInteger(record.issuedAtMs)||
     !Number.isSafeInteger(record.expiresAtMs)||
     record.issuedAtMs>nowMs||record.expiresAtMs<=nowMs||
     record.expiresAtMs-record.issuedAtMs>15*60*1000)
   block("Valid unused short-lived approval required");
  if(m.exists||marker.exists)block("Mode or migration marker already exists");
  if(!appts.empty||!lockDocs.empty)block("Shared appointments or locks exist");
  if(!source.exists||source.data()?.schemaVersion!==1||
     typeof source.data()?.json!=="string")block("Invalid legacy source");
  const json=source.data().json;
  let records;try{records=JSON.parse(json);}catch(_){block("Invalid JSON");}
  if(!Array.isArray(records)||records.length!==10||digestBookings(json)!==verified.hash)
   block("Legacy source changed");
  // The approval is consumed and the single mode doc created atomically.
  tx.update(approvalRef,{status:"consumed",usedAt:new Date(nowMs)});
  tx.create(modeRef,{mode:MODES.LEGACY,schemaVersion:1,updatedAt:new Date(nowMs)});
  return {initialized:true,approvalConsumed:true,mode:MODES.LEGACY,bookingCount:10};
 });
}
module.exports={initialiseWithSingleUseApproval,PROJECT,OPERATION};
