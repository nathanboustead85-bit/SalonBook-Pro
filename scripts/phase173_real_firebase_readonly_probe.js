"use strict";
// Opt-in operator script. Run ONLY with an isolated read-only service account.
// Requires: BOUSTIO_PHASE173_APPROVED=true, BOUSTIO_FIREBASE_PROJECT_ID,
// BOUSTIO_FIREBASE_ALLOWED_PROJECT_ID, BOUSTIO_FIREBASE_OWNER_ID.
// Never prints document contents or personal identifiers.
const {createRealFirebaseReadOnlyProbe}=require("../functions/phase173RealFirebaseReadOnlyProbe");
async function main(){
 const approved=process.env.BOUSTIO_PHASE173_APPROVED==="true";
 const projectId=process.env.BOUSTIO_FIREBASE_PROJECT_ID;
 const allowedProjectId=process.env.BOUSTIO_FIREBASE_ALLOWED_PROJECT_ID;
 const ownerId=process.env.BOUSTIO_FIREBASE_OWNER_ID;
 if(!approved||!projectId||projectId!==allowedProjectId||!ownerId){
  console.log("Phase 17.3 real Firebase probe disabled: approval/configuration required");
  process.exitCode=1;return;
 }
 if(process.env.FIRESTORE_EMULATOR_HOST){
  console.log("Phase 17.3 rejected: emulator host configured");
  process.exitCode=1;return;
 }
 const {initializeApp,cert,applicationDefault}=require("firebase-admin/app");
 const {getFirestore}=require("firebase-admin/firestore");
 // No service-account JSON in logs. Prefer a narrowly scoped credential.
 const app=initializeApp({credential:applicationDefault(),projectId},"phase173-readonly-probe");
 const result=await createRealFirebaseReadOnlyProbe({
  db:getFirestore(app),projectId,allowedProjectId,enabled:true
 }).verify(ownerId);
 console.log("Phase 17.3:",result.status,"documents present:",result.documentsPresent??"unavailable",
  "bookings enabled:",result.acceptingBookings,"failure category:",result.failureCode||"none");
 if(result.status!=="REAL_FIREBASE_METADATA_READ_VERIFIED")process.exitCode=1;
}
main().catch(()=>{console.error("Phase 17.3 real Firebase probe failed safely");process.exitCode=1;});
