"use strict";
// Phase 36.2 isolated session bridge: SDK methods injected, no production initialization.
const {createAndroidBusinessReader}=require("./android-business-adapter-36-1");
const {createAuthLifecycle}=require("../phase35/auth-lifecycle-35-3");
const empty=reason=>Object.freeze({status:"UNAVAILABLE",reason,data:null,bookingEnabled:false,editingEnabled:false});
const valid=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
function createVerifiedOwnerSession({auth,doc,db,runTransaction,getIdTokenResult}){
 if(!auth||!db||typeof getIdTokenResult!=="function")throw TypeError("trusted_auth_and_firestore_sdk_required");
 const lifecycle=createAuthLifecycle(createAndroidBusinessReader({db,doc,runTransaction}));
 let generation=0,identity=null,state=empty("signed_out");
 const snapshot=()=>state;
 function invalidate(reason){generation++;identity=null;lifecycle.signOut();state=empty(reason);return state}
 function signOut(){return invalidate("signed_out")}
 function authChanged(user){generation++;identity=user||null;lifecycle.signOut();state=empty(user?"auth_changed":"signed_out");return state}
 async function refresh(now){
  const token=++generation,user=identity;
  state=empty("loading");
  if(!user||!valid(user.uid)||auth.currentUser!==user||!Number.isSafeInteger(now)||now<0)return invalidate("invalid_session");
  let result;
  try{result=await getIdTokenResult(user,true)}catch{return token===generation?invalidate("token_refresh_failed"):state}
  if(token!==generation||identity!==user||auth.currentUser!==user)return state;
  const claims=result?.claims;
  const expiration=Date.parse(result?.expirationTime||"");
  if(!claims||claims.user_id!==user.uid||claims.email_verified!==true||user.emailVerified!==true||
    !Number.isSafeInteger(expiration)||expiration<=now)return invalidate("unverified_or_expired");
  lifecycle.transition({uid:user.uid,emailVerified:true,expiresAt:expiration},now);
  const next=await lifecycle.refresh(now);
  if(token!==generation||identity!==user||auth.currentUser!==user)return state;
  if(next.status!=="READ_ONLY_READY"){state=empty(next.reason);return state}
  state=next;return state;
 }
 function offline(){return invalidate("network_unavailable")}
 return Object.freeze({authChanged,refresh,signOut,offline,snapshot});
}
module.exports=Object.freeze({createVerifiedOwnerSession});
