"use strict";
/** Offline exact-revision unpublish writer. No production wiring.
 * Destination-local authoritative claim must be in the SAME transaction.
 * Does not bridge independent databases or authenticate the private reader.
 */
const {exactPublicationIdentity}=require("./phase17ExactPublicationIdentity");
const {exactDestinationDecision,assertExactDestinationFence}=require("./phase17ExactDestinationGate");
async function applyExactUnpublish({db,identity,sourceSnapshot,nowMs,claimPlacement}={}){
 if(claimPlacement!=="destination-transaction")throw Error("CROSS_DATABASE_CLAIM_NOT_ATOMIC");
 if(!db||typeof db.collection!=="function"||typeof db.runTransaction!=="function"||typeof nowMs!=="function")
  throw Error("EXACT_UNPUBLISH_ADAPTER_REQUIRED");
 if(!identity||identity.operation!=="unpublish")throw Error("EXACT_UNPUBLISH_ONLY");
 const expected=exactPublicationIdentity({uid:identity.uid,operation:"unpublish",snapshot:sourceSnapshot});
 if(identity.key!==expected.key||identity.digest!==expected.digest||identity.revision!==expected.revision)
  throw Error("EXACT_UNPUBLISH_SOURCE_MISMATCH");
 const profileRef=db.collection("publicBusinesses").doc(identity.uid);
 const claimRef=db.collection("publicationExactRecoveryClaims").doc(identity.key);
 return db.runTransaction(async tx=>{
  const [claimSnap,profileSnap]=await Promise.all([tx.get(claimRef),tx.get(profileRef)]);
  const claim=claimSnap.exists?claimSnap.data():null;
  const now=nowMs();
  try{assertExactDestinationFence({identity,claim,nowMs:now});}
  catch(e){if(e.message==="EXACT_DESTINATION_FENCED")return {status:"FENCED"};throw e;}
  const old=profileSnap.exists?profileSnap.data():null;
  if(!old)return {status:"NOT_FOUND"};
  const decision=exactDestinationDecision({incoming:identity,stored:{
   revision:old.fullPrecisionRevision,digest:old.exactPublicationDigest
  }});
  if(decision.status!=="APPLY")return decision;
  if(typeof old.slug!=="string"||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(old.slug)||
     old.businessId!==identity.uid)throw Error("INVALID_EXACT_DESTINATION_PROFILE");
  const reservationRef=db.collection("businessSlugs").doc(old.slug);
  const mappingRef=db.collection("publicSlugMappings").doc(old.slug);
  const [reservation,mapping]=await Promise.all([tx.get(reservationRef),tx.get(mappingRef)]);
  if(!reservation.exists||reservation.get("businessId")!==identity.uid||
     !mapping.exists||mapping.get("businessId")!==identity.uid)
   return {status:"INCONSISTENT_RESERVATION"};
  tx.set(profileRef,{...old,published:false,acceptingBookings:false,
   fullPrecisionRevision:identity.revision,exactPublicationDigest:identity.digest});
  tx.set(mappingRef,{slug:old.slug,businessId:identity.uid,published:false});
  return {status:"UNPUBLISHED"};
 });
}
module.exports=Object.freeze({applyExactUnpublish});
