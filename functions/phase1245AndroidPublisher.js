"use strict";
// Phase 12.45: emulator-only Android liveData v1 -> public preview transaction.
const {convert}=require("./phase1244AndroidSchemaAdapter");
const PROJECT="demo-boustio-phase1245",HOST="127.0.0.1:8080",TTL=300000;
function guard({projectId,emulatorHost,businessId,generatedAt}){
 if(projectId!==PROJECT||emulatorHost!==HOST||typeof businessId!=="string"||
 !/^[A-Za-z0-9_-]{1,80}$/.test(businessId)||!Number.isSafeInteger(generatedAt)||
 generatedAt<=0)throw Error("REFUSING: Phase 12.45 isolated emulator required");
}
async function reconcileAndroid(db,{projectId,emulatorHost,businessId,date,generatedAt}){
 guard({projectId,emulatorHost,businessId,generatedAt});
 const owner=db.collection("phase1245Owners").doc(businessId);
 const profileRef=owner.collection("business").doc("profile");
 const keys=["services","staff","bookings"];
 const dataRefs=keys.map(k=>owner.collection("liveData").doc(k));
 const pub=db.collection("phase1245PublicAvailability").doc(businessId);
 const control=owner.collection("control").doc("publication");
 return db.runTransaction(async tx=>{
  const [previous,watermark,profile,...documents]=await Promise.all([
   tx.get(pub),tx.get(control),tx.get(profileRef),...dataRefs.map(ref=>tx.get(ref))]);
  if(watermark.exists&&Number.isSafeInteger(watermark.get("generatedAt"))&&
   watermark.get("generatedAt")>=generatedAt)return {status:"SKIPPED_STALE"};
  let output=null,reason="MISSING_SOURCE";
  if(profile.exists&&documents.every(d=>d.exists)){
   const p=profile.data();
   if(p.businessId!==businessId)reason="OWNER_MISMATCH";
   else{
    output=convert({profile:p,servicesDoc:documents[0].data(),
     staffDoc:documents[1].data(),bookingsDoc:documents[2].data(),
     date,generatedAt});
    if(output.status!=="PUBLIC_PREVIEW"){reason=output.reason;output=null;}
   }
  }
  tx.set(control,{generatedAt});
  if(!output){
   if(previous.exists)tx.delete(pub);
   return {status:previous.exists?"WITHDRAWN":"NOT_PUBLISHED",reason};
  }
  tx.set(pub,{...JSON.parse(JSON.stringify(output)),expiresAt:new Date(generatedAt+TTL)});
  return {status:"PUBLISHED",bookingEnabled:false};
 });
}
module.exports={reconcileAndroid,guard,TTL};
