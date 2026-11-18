"use strict";
/**
 * Offline-only exact revision destination writer (publish path).
 * Requires a destination-transaction-local authoritative claim. This is NOT
 * connected to production and cannot be used with private-database claims.
 * No legacy numeric fallback, no unpublish support, no live Firebase setup.
 */
const {exactDestinationDecision,assertExactDestinationFence}=require("./phase17ExactDestinationGate");
const {exactPublicationIdentity}=require("./phase17ExactPublicationIdentity");
const {preparePublicListing}=require("./phase17PublicListingProjection");
async function applyExactPublish({db,identity,profile,sourceSnapshot,nowMs,claimPlacement}={}){
 if(claimPlacement!=="destination-transaction")throw Error("CROSS_DATABASE_CLAIM_NOT_ATOMIC");
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function"||typeof nowMs!=="function")
  throw Error("EXACT_WRITER_ADAPTER_REQUIRED");
 if(!identity||identity.operation!=="publish")throw Error("EXACT_PUBLISH_ONLY");
 const expected=exactPublicationIdentity({uid:identity.uid,operation:"publish",snapshot:sourceSnapshot,profile});
 if(identity.key!==expected.key||identity.digest!==expected.digest||identity.revision!==expected.revision)
  throw Error("EXACT_WRITER_SOURCE_MISMATCH");
 const listing=preparePublicListing(identity.uid,profile);
 const profileRef=db.collection("publicBusinesses").doc(identity.uid);
 const claimRef=db.collection("publicationExactRecoveryClaims").doc(identity.key);
 return db.runTransaction(async tx=>{
  // Read authoritative destination claim and profile in the same transaction.
  const [claimSnap,profileSnap]=await Promise.all([tx.get(claimRef),tx.get(profileRef)]);
  const claim=claimSnap.exists?claimSnap.data():null;
  const now=nowMs();
  try{assertExactDestinationFence({identity,claim,nowMs:now});}
  catch(e){if(e.message==="EXACT_DESTINATION_FENCED")return {status:"FENCED"};throw e;}
  const old=profileSnap.exists?profileSnap.data():null;
  // Do not silently migrate existing legacy records.
  const decision=exactDestinationDecision({incoming:identity,stored:old?{
   revision:old.fullPrecisionRevision,digest:old.exactPublicationDigest
  }:null});
  if(decision.status!=="APPLY")return decision;
  const slugRef=db.collection("businessSlugs").doc(listing.slug);
  const mappingRef=db.collection("publicSlugMappings").doc(listing.slug);
  const oldSlug=old&&old.slug!==listing.slug?old.slug:null;
  const oldSlugRef=oldSlug?db.collection("businessSlugs").doc(oldSlug):null;
  const oldMappingRef=oldSlug?db.collection("publicSlugMappings").doc(oldSlug):null;
  // Firestore requires all transaction reads before writes.
  const [reservation,mapping,oldReservation,oldMapping]=await Promise.all([
   tx.get(slugRef),tx.get(mappingRef),
   oldSlugRef?tx.get(oldSlugRef):Promise.resolve(null),
   oldMappingRef?tx.get(oldMappingRef):Promise.resolve(null)
  ]);
  if(reservation.exists&&reservation.get("businessId")!==identity.uid||
     mapping.exists&&mapping.get("businessId")!==identity.uid)return {status:"SLUG_TAKEN"};
  if(reservation.exists!==mapping.exists)return {status:"INCONSISTENT_RESERVATION"};
  if(oldSlug&&(!oldReservation.exists||oldReservation.get("businessId")!==identity.uid||
     !oldMapping.exists||oldMapping.get("businessId")!==identity.uid))
   return {status:"INCONSISTENT_RESERVATION"};
  tx.set(profileRef,{...listing,fullPrecisionRevision:identity.revision,exactPublicationDigest:identity.digest});
  tx.set(slugRef,{businessId:identity.uid});
  tx.set(mappingRef,{slug:listing.slug,businessId:identity.uid,published:true});
  if(oldSlug){tx.delete(oldSlugRef);tx.delete(oldMappingRef);}
  return {status:"PUBLISHED",slug:listing.slug};
 });
}
module.exports=Object.freeze({applyExactPublish});
