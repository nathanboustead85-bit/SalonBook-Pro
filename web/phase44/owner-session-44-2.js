"use strict";
// Synthetic trusted-backend session boundary: no SDK init, writes, production calls or deployment.
const {createAdminVerification}=require("./admin-verification-44-1");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,data:null,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
function createOwnerSession({readOwner,credentials,...options}={}){
 if(typeof readOwner!=="function"||typeof credentials!=="function")throw TypeError("isolated_owner_session_dependencies_required");
 const admin=createAdminVerification(options);
 let active=true,online=true,epoch=0,owner=null,state=deny("signed_out");
 const listeners=new Set();
 const emit=value=>{state=value;for(const fn of [...listeners]){try{fn(value)}catch{}}return state};
 const clear=reason=>{epoch++;admin.invalidate();return emit(deny(reason))};
 const current=(seq,uid)=>active&&online&&epoch===seq&&owner===uid;
 async function refresh(uid){
  if(!active||!online)return state;
  if(typeof uid!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(uid))return clear("invalid_owner");
  if(owner!==uid){owner=uid;clear("owner_changed")}
  const seq=++epoch;emit(deny("revalidating"));
  try{
   const input=await credentials(uid);
   if(!current(seq,uid))return state;
   if(!input||input.uid!==uid)return clear("identity_mismatch");
   const before=await admin.verify(input);
   if(!current(seq,uid))return state;
   if(before.status!=="ISOLATED_ADMIN_CONTRACT_VALID")return clear("authorization_denied");
   // The callback must implement owner-scoped READ ONLY access; never pass arbitrary paths.
   const result=await readOwner(uid);
   if(!current(seq,uid))return state;
   if(!result||result.ownerId!==uid||result.readOnly!==true||result.data==null)return clear("owner_data_mismatch");
   const fresh=await credentials(uid);
   if(!current(seq,uid))return state;
   if(!fresh||fresh.uid!==uid||fresh.appCheckToken===input.appCheckToken)return clear("fresh_attestation_required");
   const after=await admin.verify(fresh);
   if(!current(seq,uid))return state;
   if(after.status!=="ISOLATED_ADMIN_CONTRACT_VALID")return clear("post_read_authorization_denied");
   return emit(Object.freeze({status:"ISOLATED_READ_ONLY",ownerId:uid,data:result.data,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false}));
  }catch{return current(seq,uid)?clear("verification_or_read_unavailable"):state}
 }
 return Object.freeze({refresh,snapshot:()=>state,offline(){online=false;return clear("offline")},reconnect(uid){online=true;clear("reconnecting");return refresh(uid)},accountChanged(uid=null){owner=uid;return clear("account_changed")},signOut(){owner=null;return clear("signed_out")},stop(){active=false;owner=null;admin.stop();listeners.clear();return clear("stopped")},subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false});
}
module.exports=Object.freeze({createOwnerSession});
