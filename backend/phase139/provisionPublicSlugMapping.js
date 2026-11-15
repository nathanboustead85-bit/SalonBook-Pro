"use strict";
// Phase 13.9: trusted backend-only slug index provisioning.
// Caller MUST authenticate/authorize the business owner before invoking this function.
// This module deliberately does not provide a public HTTP write endpoint.
// Firestore Admin transaction prevents concurrent slug takeover.
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
function createSlugMappingProvisioner(db){
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function")throw new TypeError("Admin Firestore transactions required");
 return async function provision({slug,businessId}={}){
  if(typeof slug!=="string"||!slugPattern.test(slug)||typeof businessId!=="string"||!idPattern.test(businessId))
   throw new TypeError("invalid slug or business ID");
  const businessRef=db.collection("publicBusinesses").doc(businessId);
  const mappingRef=db.collection("publicSlugMappings").doc(slug);
  return db.runTransaction(async tx=>{
   // All reads occur before any write, as required by Firestore transactions.
   const businessSnap=await tx.get(businessRef);
   const mappingSnap=await tx.get(mappingRef);
   const business=businessSnap.exists?businessSnap.data():null;
   if(!business||business.published!==true||business.slug!==slug)return {status:"NOT_PUBLISHED"};
   if(mappingSnap.exists){
    const existing=mappingSnap.data();
    if(!existing||existing.businessId!==businessId||existing.slug!==slug)return {status:"SLUG_TAKEN"};
    if(existing.published===true)return {status:"ALREADY_MAPPED"};
    tx.set(mappingRef,{slug,businessId,published:true});
    return {status:"MAPPED"};
   }
   tx.create(mappingRef,{slug,businessId,published:true});
   return {status:"MAPPED"};
  });
 };
}
module.exports=Object.freeze({createSlugMappingProvisioner});
