"use strict";
// Internal authorization contract. Trusted readers must run within the same transaction as mutations.
const validId=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
async function authorizeSync({businessId,action,bookingId,expectedRevision},trusted){
 try{
 const identity=await trusted.identity();
 if(!identity||identity.verified!==true||!validId(identity.uid)||!validId(businessId))return false;
 if(!["view","contact","edit","cancel"].includes(action)||!validId(bookingId))return false;
 const business=await trusted.business(businessId);
 if(!business||business.id!==businessId||business.active!==true||business.ownerUid!==businessId)return false;
 const booking=await trusted.booking(businessId,bookingId);
 if(!booking||booking.businessId!==businessId||booking.id!==bookingId||!Number.isSafeInteger(booking.revision)||booking.revision<1||typeof booking.historical!=="boolean")return false;
 if(["edit","cancel"].includes(action)&&(booking.historical||expectedRevision!==booking.revision))return false;
 if(identity.uid===business.ownerUid)return true;
 const {authorize}=require("./employee-backend-preview.cjs");
 return await authorize({businessId,bookingId,action,expectedRevision},{identity:async()=>identity,booking:async()=>booking,membership:trusted.membership.bind(trusted),policy:trusted.policy.bind(trusted)});
 }catch(_){return false;}
}
module.exports={authorizeSync};
