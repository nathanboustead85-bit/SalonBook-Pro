"use strict";
// Phase 12.42: trusted, emulator-only publication pipeline. Not a deployed Cloud Function.
const {buildPublicSnapshot}=require("./publicAvailabilityProjection");
function validateScope({projectId,emulatorHost,businessId}){
 if(projectId!=="demo-boustio-phase1242"||emulatorHost!=="127.0.0.1:8080"||
 !/^[A-Za-z0-9_-]{1,80}$/.test(businessId||""))
 throw Error("REFUSING: publication requires isolated Phase 12.42 emulator");
}
async function publishFromTrustedFixtures(db,{projectId,emulatorHost,businessId,date,generatedAt}){
 validateScope({projectId,emulatorHost,businessId});
 const root=db.collection("phase1242Private").doc(businessId);
 const [profile,services,staff,appointments]=await Promise.all([
  root.collection("source").doc("profile").get(),
  root.collection("source").doc("services").get(),
  root.collection("source").doc("staff").get(),
  root.collection("source").doc("appointments").get()
 ]);
 const outputRef=db.collection("phase1241PublicAvailability").doc(businessId);
 if(!profile.exists||!services.exists||!staff.exists||!appointments.exists)
  return {status:"NOT_PUBLISHED",reason:"MISSING_SOURCE"};
 const p=profile.data();
 if(p.businessId!==businessId)return {status:"NOT_PUBLISHED",reason:"OWNER_MISMATCH"};
 const result=buildPublicSnapshot({profile:p,slug:p.slug,
  services:services.get("items"),staff:staff.get("items").map(s=>({...s,workingHours:JSON.parse(s.workingHoursJson)})),
  appointments:appointments.get("items"),date,generatedAt});
 if(result.status!=="PUBLIC_PREVIEW")return {status:"NOT_PUBLISHED",reason:result.reason};
 // Prevent a stale worker from overwriting a newer publication.
 const written=await db.runTransaction(async tx=>{
  const existing=await tx.get(outputRef);
  if(existing.exists&&Number.isSafeInteger(existing.get("generatedAt"))&&
   existing.get("generatedAt")>=generatedAt)return false;
  tx.set(outputRef,JSON.parse(JSON.stringify(result)));
  return true;
 });
 return {status:written?"PUBLISHED":"SKIPPED_STALE",bookingEnabled:false};
}
module.exports={publishFromTrustedFixtures,validateScope};
