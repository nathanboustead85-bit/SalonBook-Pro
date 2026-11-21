"use strict";
// Phase 35.3: injected auth lifecycle guard. No SDK, I/O, tokens persisted or deployment.
const {createRefreshCoordinator}=require("./refresh-coordinator-35-2");
const valid=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
const unavailable=reason=>Object.freeze({status:"UNAVAILABLE",reason,data:null,bookingEnabled:false,editingEnabled:false});
function createAuthLifecycle(readAtomic){
 const dashboard=createRefreshCoordinator(readAtomic);
 let generation=0,session=null,state=unavailable("signed_out");
 const clear=reason=>{generation++;session=null;dashboard.signOut();state=unavailable(reason);return state};
 const snapshot=()=>state;
 function transition(auth,now){
  generation++;dashboard.signOut();state=unavailable("session_changed");session=null;
  if(!auth||!valid(auth.uid)||auth.emailVerified!==true||!safe(auth.expiresAt)||!safe(now)||auth.expiresAt<=now)return clear("invalid_or_unverified_session");
  session=Object.freeze({uid:auth.uid,emailVerified:true,expiresAt:auth.expiresAt});
  return state;
 }
 async function refresh(now){
  const token=generation,auth=session;
  if(!auth||!safe(now)||auth.expiresAt<=now)return clear("expired_or_signed_out");
  state=unavailable("loading");
  const result=await dashboard.refresh(auth,now);
  if(token!==generation||session!==auth)return state;
  if(result.status!=="READ_ONLY_READY"){state=unavailable(result.reason);return state}
  if(auth.expiresAt<=now)return clear("expired_session");
  state=result;return state;
 }
 function networkUnavailable(){return clear("network_unavailable")}
 function signOut(){return clear("signed_out")}
 return Object.freeze({transition,refresh,networkUnavailable,signOut,snapshot});
}
module.exports=Object.freeze({createAuthLifecycle});
