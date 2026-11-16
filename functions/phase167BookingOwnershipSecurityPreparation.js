"use strict";
// Phase 16.7: server-only Firestore path/ownership preparation.
// No Firebase Admin writes, endpoint exports, or live customer bookings.
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function createBookingOwnershipSecurityPreparation({verifyIdToken,readPrivateProfile}={}){
 if(typeof verifyIdToken!=="function"||typeof readPrivateProfile!=="function")
  throw new TypeError("Trusted Firebase verifier and private profile reader required");
 async function inspect({idToken,ownerId}={}){
  if(typeof idToken!=="string"||idToken.length<10||idToken.length>8192
   ||typeof ownerId!=="string"||!ID.test(ownerId))return deny("BOOKING_ACCESS_INVALID");
  let claims;
  try{claims=await verifyIdToken(idToken,true);}
  catch{return deny("BOOKING_ACCESS_UNVERIFIED");}
  if(!claims||typeof claims.uid!=="string"||!ID.test(claims.uid)
   ||claims.email_verified!==true||claims.firebase?.sign_in_provider==="anonymous")
   return deny("BOOKING_ACCESS_UNVERIFIED");
  if(claims.uid!==ownerId)return deny("BOOKING_ACCESS_CROSS_OWNER");
  let profile;
  try{profile=await readPrivateProfile(claims.uid);}
  catch{return deny("BOOKING_ACCESS_PROFILE_UNAVAILABLE");}
  if(!profile||profile.businessId!==claims.uid)return deny("BOOKING_ACCESS_PROFILE_MISMATCH");
  return Object.freeze({status:"BOOKING_OWNER_VERIFIED_PREPARATION_ONLY",
   acceptingBookings:false,reservationCreated:false,
   ownerId:claims.uid,serverOnlyCollections:Object.freeze([
    "users/"+claims.uid+"/customerBookingReservations",
    "users/"+claims.uid+"/customerBookingRequests",
    "businesses/"+claims.uid+"/customerBookingGuards"
   ])});
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createBookingOwnershipSecurityPreparation});
