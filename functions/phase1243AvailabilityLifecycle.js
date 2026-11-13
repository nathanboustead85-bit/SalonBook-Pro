"use strict";
// Emulator-only Phase 12.43. No production deployment or Firebase credentials.
const {buildPublicSnapshot}=require("./publicAvailabilityProjection");
const PROJECT="demo-boustio-phase1243",HOST="127.0.0.1:8080",TTL=300000;
function scope({projectId,emulatorHost,businessId}){
 if(projectId!==PROJECT||emulatorHost!==HOST||
 typeof businessId!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(businessId))
 throw Error("REFUSING: Phase 12.43 isolated emulator required");
}
async function reconcile(db,{projectId,emulatorHost,businessId,date,generatedAt}){
 scope({projectId,emulatorHost,businessId});
 if(!Number.isSafeInteger(generatedAt)||generatedAt<=0)throw Error("Invalid generation");
 const root=db.collection("phase1243Private").doc(businessId);
 const keys=["profile","services","staff","appointments"];
 const refs=keys.map(k=>root.collection("source").doc(k));
 const pub=db.collection("phase1243PublicAvailability").doc(businessId);
 return db.runTransaction(async tx=>{
  // Read all inputs and existing output inside the same transaction.
  const [existing,...docs]=await Promise.all([tx.get(pub),...refs.map(ref=>tx.get(ref))]);
  const last=existing.exists?existing.get("generatedAt"):undefined;
  if(Number.isSafeInteger(last)&&last>=generatedAt)
   return {status:"SKIPPED_STALE"};
  let projection=null,reason="MISSING_SOURCE";
  if(docs.every(d=>d.exists)){
   const [profile,services,staff,appointments]=docs.map(d=>d.data());
   if(profile.businessId!==businessId)reason="OWNER_MISMATCH";
   else{
    try{
     const items=staff.items.map(s=>({...s,workingHours:JSON.parse(s.workingHoursJson)}));
     projection=buildPublicSnapshot({profile,slug:profile.slug,services:services.items,
      staff:items,appointments:appointments.items,date,generatedAt});
     if(projection.status!=="PUBLIC_PREVIEW"){
      reason=projection.reason;projection=null;
     }
    }catch(_){reason="INVALID_SOURCE";}
   }
  }
  if(!projection){
   if(existing.exists)tx.delete(pub);
   return {status:existing.exists?"WITHDRAWN":"NOT_PUBLISHED",reason};
  }
  // Expiry is enforced by Firestore security rules, not just browser code.
  const timestamp= new Date(generatedAt+TTL);
  tx.set(pub,{...JSON.parse(JSON.stringify(projection)),expiresAt:timestamp});
  return {status:"PUBLISHED",bookingEnabled:false};
 });
}
module.exports={reconcile,scope,TTL};
