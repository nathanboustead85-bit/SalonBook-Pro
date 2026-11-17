"use strict";
// Phase 17.17: fixed-path existence checks only. No .data(), writes or identifiers in output.
const {initializeApp,applicationDefault}=require("firebase-admin/app");
const {getFirestore}=require("firebase-admin/firestore");
async function main(){
 const project=process.env.BOUSTIO_FIREBASE_PROJECT_ID;
 const owner=process.env.BOUSTIO_FIREBASE_OWNER_ID;
 if(process.env.BOUSTIO_PHASE1717_APPROVED!=="true"||project!=="salonbook-pro-ad5ff"||
    typeof owner!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(owner)||
    process.env.FIRESTORE_EMULATOR_HOST){
  console.log("Phase 17.17: CONFIGURATION_REJECTED");process.exitCode=1;return;
 }
 const db=getFirestore(initializeApp({credential:applicationDefault(),projectId:project},"phase1717-readonly"));
 const refs=[db.collection("users").doc(owner).collection("business").doc("profile"),
             db.collection("publicBusinesses").doc(owner)];
 try{
  const exists=await db.runTransaction(async tx=>{
   const snapshots=await Promise.all(refs.map(ref=>tx.get(ref)));
   return snapshots.map(snapshot=>snapshot.exists===true);
  },{readOnly:true,maxAttempts:1});
  console.log("Phase 17.17: PRIVATE_PROFILE",exists[0]?"PRESENT":"MISSING");
  console.log("Phase 17.17: PUBLIC_PROFILE",exists[1]?"PRESENT":"MISSING");
  console.log("Phase 17.17: NO_WRITES_REQUESTED; BOOKINGS_DISABLED");
 }catch(_){
  console.log("Phase 17.17: READ_ONLY_DIAGNOSTIC_FAILED");
  process.exitCode=1;
 }
}
main().catch(()=>{console.log("Phase 17.17: SAFE_FAILURE");process.exitCode=1;});
