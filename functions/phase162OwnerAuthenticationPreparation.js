"use strict";
// Phase 16.2: server-only verified Firebase identity + private owner profile inspection.
// No HTTP/callable export, Firestore writes, booking creation or client-trusted flags.
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const {prepareBookingStoragePlan}=require("./phase151BookingInfrastructurePreparation");
const OWNER=/^[A-Za-z0-9_-]{1,128}$/;
const deny=status=>Object.freeze({status,acceptingBookings:false,reservationCreated:false});
function createOwnerAuthenticationPreparation({verifyIdToken,readPrivateProfile,secret}={}){
 if(typeof verifyIdToken!=="function"||typeof readPrivateProfile!=="function")
  throw new TypeError("Server token verifier and private profile reader required");
 async function inspect({idToken,ownerId,key,intent}={}){
  if(typeof idToken!=="string"||idToken.length<10||idToken.length>8192)
   return deny("AUTH_TOKEN_MISSING");
  if(typeof ownerId!=="string"||!OWNER.test(ownerId))
   return deny("AUTH_OWNER_INVALID");
  let decoded;
  try{decoded=await verifyIdToken(idToken,true);}
  catch{return deny("AUTH_UNVERIFIED");}
  // Claims are accepted only from the injected server-side verifier, not request data.
  if(!decoded||typeof decoded.uid!=="string"||!OWNER.test(decoded.uid)
   ||decoded.email_verified!==true||decoded.firebase?.sign_in_provider==="anonymous")
   return deny("AUTH_UNVERIFIED");
  if(decoded.uid!==ownerId)return deny("AUTH_OWNER_FORBIDDEN");
  let profile;
  try{profile=await readPrivateProfile(decoded.uid);}
  catch{return deny("AUTH_PROFILE_UNAVAILABLE");}
  if(!profile||profile.businessId!==decoded.uid)
   return deny("AUTH_PROFILE_FORBIDDEN");
  const plan=prepareBookingStoragePlan({ownerId:decoded.uid,key,intent,secret});
  if(plan.status!=="BOOKING_STORAGE_PLAN_ONLY")return deny("AUTH_PLAN_INVALID");
  return Object.freeze({status:"AUTHENTICATED_OWNER_PREPARATION_ONLY",
   acceptingBookings:false,reservationCreated:false,
   bookingCollectionPath:plan.bookingCollectionPath,
   recoveryDocumentPath:plan.recoveryDocumentPath,
   verifiedOwner:true});
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createOwnerAuthenticationPreparation});
