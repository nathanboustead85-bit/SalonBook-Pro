"use strict";
// Synthetic, read-only staging data boundary; no Firebase SDK, production access or deployment.
const {authorizeOwnerRead}=require("./access-guard-45-3");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,business:null,revision:null,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
function createIntegrityRecovery({read,now=Date.now,maxAgeMs=300000}={}){
 if(typeof read!=="function"||typeof now!=="function"||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1000||maxAgeMs>3600000)throw TypeError("invalid_isolated_dependencies");
 let active=true,online=true,epoch=0,owner=null,state=deny("signed_out");
 const revisions=new Map();
 const clear=reason=>{epoch++;state=deny(reason);return state};
 async function refresh(uid,identity){
  if(!active||!online)return state;
  if(owner!==uid){owner=uid;clear("account_changed")}
  const seq=++epoch;state=deny("revalidating");
  if(authorizeOwnerRead({identity,ownerId:uid,resourceOwnerId:uid}).status!=="ISOLATED_OWNER_READ_ALLOWED")return seq===epoch?clear("authorization_denied"):state;
  try{
   const data=await read(uid);
   if(!active||!online||seq!==epoch||owner!==uid)return state;
   if(authorizeOwnerRead({identity,ownerId:uid,resourceOwnerId:uid}).status!=="ISOLATED_OWNER_READ_ALLOWED")return clear("authorization_denied");
   if(!data||typeof data!=="object"||Array.isArray(data)||!data.business||typeof data.business!=="object"||Array.isArray(data.business)||data.business.businessId!==uid)return clear("corrupt_or_cross_owner");
   const {updatedAt,revision}=data;
   const t=now();
   if(!Number.isSafeInteger(updatedAt)||updatedAt>t+30000||t-updatedAt>maxAgeMs)return clear("stale_or_invalid_timestamp");
   if(!Number.isSafeInteger(revision)||revision<1)return clear("invalid_revision");
   if(revision<(revisions.get(uid)||0))return clear("revision_rollback");
   if(data.business.acceptingBookings!==false)return clear("booking_mode_not_disabled");
   revisions.set(uid,revision);
   state=Object.freeze({status:"ISOLATED_INTEGRITY_READ_ONLY",business:Object.freeze({...data.business}),revision,canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
   return state;
  }catch{return seq===epoch&&active&&online?clear("read_unavailable"):state}
 }
 return Object.freeze({refresh,snapshot:()=>state,offline(){online=false;return clear("offline")},reconnect(uid,identity){online=true;clear("reconnecting");return refresh(uid,identity)},accountChanged(uid=null){owner=uid;return clear("account_changed")},signOut(){owner=null;return clear("signed_out")},stop(){active=false;owner=null;return clear("stopped")},canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false});
}
module.exports=Object.freeze({createIntegrityRecovery});
