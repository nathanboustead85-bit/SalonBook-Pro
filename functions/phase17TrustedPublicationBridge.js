"use strict";
/**
 * Phase 17 offline trust-boundary orchestration. NOT a deployed endpoint.
 * Trusted adapters must be supplied by server code; never inject these from
 * a customer request. No cross-database transaction is claimed.
 */
const {preparePublicListing}=require("./phase17PublicListingProjection");
const {applyPublicListingCommand}=require("./phase17PublicDatabaseWriter");
const UID=/^[A-Za-z0-9_-]{1,128}$/;
function validUid(value){return typeof value==="string"&&UID.test(value);}
async function publishVerifiedOwner({auth,loadPrivateProfile,publicDb,version}){
 if(!auth||auth.emailVerified!==true||!validUid(auth.uid))
  return {status:"UNAUTHENTICATED"};
 if(typeof loadPrivateProfile!=="function"||!publicDb||!Number.isSafeInteger(version)||version<1)
  throw new Error("INVALID_TRUSTED_ADAPTER");
 // Private profile is fetched ONLY by trusted server adapter, never from request data.
 const profile=await loadPrivateProfile(auth.uid);
 if(!profile||profile.businessId!==auth.uid)
  return {status:"OWNER_PROFILE_NOT_FOUND"};
 let listing;
 try{listing=preparePublicListing(auth.uid,profile);}
 catch{return {status:"INVALID_OWNER_PROFILE"};}
 return applyPublicListingCommand(publicDb,{
  operation:"publish",uid:auth.uid,version,profile:listing
 });
}
module.exports=Object.freeze({publishVerifiedOwner});
