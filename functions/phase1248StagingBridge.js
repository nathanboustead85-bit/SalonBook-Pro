"use strict";
// Phase 12.48: synthetic Android v1 -> emulator -> customer-safe staging data.
// No production access, customer booking writes, or live website publication.
const {reconcileAndroid}=require("./phase1245AndroidPublisher");
const {view}=require("../web/phase1246/publicAvailabilityReader");
const PROJECT="demo-boustio-phase1245",HOST="127.0.0.1:8080";
async function stageFromAndroid(db,{projectId,emulatorHost,businessId,date,generatedAt,slug}={}){
 if(projectId!==PROJECT||emulatorHost!==HOST||businessId!=="demo-owner"||
  slug!=="demo-salon"||!Number.isSafeInteger(generatedAt))throw Error("REFUSING: synthetic emulator staging only");
 const result=await reconcileAndroid(db,{projectId,emulatorHost,businessId,date,generatedAt});
 if(result.status!=="PUBLISHED")return {status:"UNAVAILABLE",bookingEnabled:false};
 const snap=await db.collection("phase1245PublicAvailability").doc(businessId).get();
 if(!snap.exists)return {status:"UNAVAILABLE",bookingEnabled:false};
 const data=snap.data();
 const safe=view({...data,expiresAt:data.expiresAt.toMillis()},{slug,now:generatedAt});
 if(safe.status!=="READ_ONLY")return {status:"UNAVAILABLE",bookingEnabled:false};
 return {status:"STAGING_PREVIEW",source:"SYNTHETIC_EMULATOR",bookingEnabled:false,
  businessName:safe.businessName,date:safe.date,services:safe.services,
  availability:safe.availability};
}
module.exports={stageFromAndroid};
