"use strict";
/**
 * Phase 17: public-database transaction writer, NOT wired to production.
 * Caller must supply an authenticated/authorised server-side publication command.
 * Never call this function directly with untrusted client data.
 * All references and the transaction belong to ONE isolated public database.
 */
const {preparePublicListing}=require("./phase17PublicListingProjection");
function validVersion(v){return Number.isSafeInteger(v)&&v>0&&v<=Number.MAX_SAFE_INTEGER;}
function validCommand(c){
 if(!c||typeof c!=="object"||Array.isArray(c)||!validVersion(c.version))throw Error("INVALID_PUBLICATION_COMMAND");
 if(c.operation!=="publish"&&c.operation!=="unpublish")throw Error("INVALID_PUBLICATION_COMMAND");
 if(c.operation==="publish")return preparePublicListing(c.uid,c.profile);
 if(typeof c.uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(c.uid))throw Error("INVALID_PUBLICATION_COMMAND");
 return null;
}
async function applyPublicListingCommand(publicDb,command){
 const listing=validCommand(command);
 const uid=command.uid;
 const profileRef=publicDb.collection("publicBusinesses").doc(uid);
 return publicDb.runTransaction(async tx=>{
  const existing=await tx.get(profileRef);
  const old=existing.exists?existing.data():null;
  const oldVersion=old&&Number.isSafeInteger(old.publicationVersion)?old.publicationVersion:0;
  if(command.version<oldVersion)return {status:"STALE"};
  if(command.version===oldVersion)return {status:"ALREADY_APPLIED"};
  if(command.operation==="unpublish"){
   if(!old)return {status:"NOT_FOUND"};
   const slug=old.slug;
   const reservationRef=publicDb.collection("businessSlugs").doc(slug);
   const mappingRef=publicDb.collection("publicSlugMappings").doc(slug);
   const [reservation,mapping]=await Promise.all([tx.get(reservationRef),tx.get(mappingRef)]);
   if(!reservation.exists||reservation.get("businessId")!==uid||
      !mapping.exists||mapping.get("businessId")!==uid)
     return {status:"INCONSISTENT_RESERVATION"};
   tx.set(profileRef,{...old,published:false,acceptingBookings:false,publicationVersion:command.version});
   tx.set(mappingRef,{slug,businessId:uid,published:false});
   return {status:"UNPUBLISHED"};
  }
  const slug=listing.slug;
  const slugRef=publicDb.collection("businessSlugs").doc(slug);
  const mappingRef=publicDb.collection("publicSlugMappings").doc(slug);
  const oldSlug=old&&old.slug!==slug?old.slug:null;
  const oldSlugRef=oldSlug?publicDb.collection("businessSlugs").doc(oldSlug):null;
  const oldMappingRef=oldSlug?publicDb.collection("publicSlugMappings").doc(oldSlug):null;
  // ALL reads before ANY writes: Firestore transaction requirement.
  const [reservation,mapping,oldReservation,oldMapping]=await Promise.all([
   tx.get(slugRef),tx.get(mappingRef),
   oldSlugRef?tx.get(oldSlugRef):Promise.resolve(null),
   oldMappingRef?tx.get(oldMappingRef):Promise.resolve(null)
  ]);
  if((reservation.exists&&reservation.get("businessId")!==uid)||
     (mapping.exists&&mapping.get("businessId")!==uid))
    return {status:"SLUG_TAKEN"};
  if(reservation.exists!==mapping.exists)return {status:"INCONSISTENT_RESERVATION"};
  if(oldSlug&&(!oldReservation?.exists||oldReservation.get("businessId")!==uid||
     !oldMapping?.exists||oldMapping.get("businessId")!==uid))
    return {status:"INCONSISTENT_RESERVATION"};
  tx.set(profileRef,{...listing,publicationVersion:command.version});
  tx.set(slugRef,{businessId:uid});
  tx.set(mappingRef,{slug,businessId:uid,published:true});
  if(oldSlug){tx.delete(oldSlugRef);tx.delete(oldMappingRef);}
  return {status:"PUBLISHED",slug};
 });
}
module.exports=Object.freeze({applyPublicListingCommand});
