"use strict";
/**
 * Phase 17: public-database transaction writer, NOT wired to production.
 * Caller must supply an authenticated/authorised server-side publication command.
 * Never call this function directly with untrusted client data.
 * All references and the transaction belong to ONE isolated public database.
 */
const {preparePublicListing}=require("./phase17PublicListingProjection");
const {createHash}=require("node:crypto");
function commandDigest(command,listing){
 const ordered=listing?Object.keys(listing).sort().map(k=>[k,listing[k]]):null;
 return createHash("sha256").update(JSON.stringify([command.uid,command.operation,command.version,ordered])).digest("hex");
}
function validVersion(v){return Number.isSafeInteger(v)&&v>0&&v<=Number.MAX_SAFE_INTEGER;}
function validCommand(c){
 if(!c||typeof c!=="object"||Array.isArray(c)||!validVersion(c.version))throw Error("INVALID_PUBLICATION_COMMAND");
 if(c.operation!=="publish"&&c.operation!=="unpublish")throw Error("INVALID_PUBLICATION_COMMAND");
 if(c.operation==="publish")return preparePublicListing(c.uid,c.profile);
 if(typeof c.uid!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(c.uid))throw Error("INVALID_PUBLICATION_COMMAND");
 return null;
}
function validateFence(command,fence){
 if(fence===undefined)return null;
 if(!fence||typeof fence!=="object"||!Number.isSafeInteger(fence.generation)||fence.generation<1||
 typeof fence.worker!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(fence.worker)||
 fence.key!==command.uid+":"+command.operation+":"+command.version)
  throw Error("INVALID_DESTINATION_FENCE");
 return {key:fence.key,worker:fence.worker,generation:fence.generation};
}
async function applyPublicListingCommand(publicDb,command,options={}){
 const fence=validateFence(command,options.fence);
 if(options.requireFence&&!fence)throw Error("DESTINATION_FENCE_REQUIRED");
 const listing=validCommand(command);
 const uid=command.uid;
 const digest=commandDigest(command,listing);
 const profileRef=publicDb.collection("publicBusinesses").doc(uid);
 const fenceRef=fence?publicDb.collection("publicationDestinationFences").doc(fence.key):null;
 return publicDb.runTransaction(async tx=>{
  const existing=await tx.get(profileRef);
  const fenceSnap=fenceRef?await tx.get(fenceRef):null;
  const previousFence=fenceSnap?.exists?fenceSnap.data():null;
  if(fence&&previousFence&&(
    fence.generation<previousFence.generation||
    (fence.generation===previousFence.generation&&fence.worker!==previousFence.worker)))
   return {status:"FENCED"};
  const finish=result=>{
   if(fence&&["PUBLISHED","UNPUBLISHED","ALREADY_APPLIED"].includes(result.status)&&
      (!previousFence||fence.generation>previousFence.generation))
    tx.set(fenceRef,fence);
   return result;
  };
  const old=existing.exists?existing.data():null;
  const oldVersion=old&&Number.isSafeInteger(old.publicationVersion)?old.publicationVersion:0;
  if(command.version<oldVersion)return finish({status:"STALE"});
  if(command.version===oldVersion)return finish({status:old.publicationDigest===digest?"ALREADY_APPLIED":"VERSION_CONFLICT"});
  if(command.operation==="unpublish"){
   if(!old)return finish({status:"NOT_FOUND"});
   const slug=old.slug;
   const reservationRef=publicDb.collection("businessSlugs").doc(slug);
   const mappingRef=publicDb.collection("publicSlugMappings").doc(slug);
   const [reservation,mapping]=await Promise.all([tx.get(reservationRef),tx.get(mappingRef)]);
   if(!reservation.exists||reservation.get("businessId")!==uid||
      !mapping.exists||mapping.get("businessId")!==uid)
     return finish({status:"INCONSISTENT_RESERVATION"});
   tx.set(profileRef,{...old,published:false,acceptingBookings:false,publicationVersion:command.version,publicationDigest:digest});
   tx.set(mappingRef,{slug,businessId:uid,published:false});
   return finish({status:"UNPUBLISHED"});
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
    return finish({status:"SLUG_TAKEN"});
  if(reservation.exists!==mapping.exists)return finish({status:"INCONSISTENT_RESERVATION"});
  if(oldSlug&&(!oldReservation?.exists||oldReservation.get("businessId")!==uid||
     !oldMapping?.exists||oldMapping.get("businessId")!==uid))
    return finish({status:"INCONSISTENT_RESERVATION"});
  tx.set(profileRef,{...listing,publicationVersion:command.version,publicationDigest:digest});
  tx.set(slugRef,{businessId:uid});
  tx.set(mappingRef,{slug,businessId:uid,published:true});
  if(oldSlug){tx.delete(oldSlugRef);tx.delete(oldMappingRef);}
  return finish({status:"PUBLISHED",slug});
 });
}
module.exports=Object.freeze({applyPublicListingCommand});
