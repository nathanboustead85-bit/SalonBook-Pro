"use strict";
// Isolated race boundary. No production Firebase SDK or write operations.
const {createHardenedSession}=require("./session-hardening-42-2");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createSessionRaceGuard(options){
 const {sdk,verifyRevocation}=options||{};
 if(!sdk?.auth||typeof verifyRevocation!=="function")throw TypeError("injected_session_dependencies_required");
 let active=true,online=true,epoch=0,owner=null,current=null,state=unavailable("signed_out");
 const listeners=new Set();
 const emit=x=>{state=x;for(const fn of [...listeners]){try{fn(x)}catch{}}return state};
 const clear=reason=>{epoch++;return emit(unavailable(reason))};
 const verified=async args=>{
  const user=sdk.auth.currentUser;
  if(!active||!online||!user||user.uid!==args.uid)return false;
  try{return await verifyRevocation(args)===true}catch{return false}
 };
 const base=createHardenedSession({...options,verifyRevocation:verified});
 const valid=(seq,user)=>active&&online&&epoch===seq&&sdk.auth.currentUser===user&&owner===user?.uid;
 async function refresh(reconnect=false){
  if(!active||!online)return state;
  const user=sdk.auth.currentUser;
  if(!user||user.emailVerified!==true||typeof user.uid!=="string"){owner=null;current=null;base.signOut();return clear("unverified_or_signed_out")}
  if(owner!==user.uid||current!==user){owner=user.uid;current=user;base.accountChanged();clear("identity_changed")}
  const seq=++epoch;emit(unavailable("refreshing"));
  try{
   const result=reconnect?await base.reconnect():await base.refresh();
   if(!valid(seq,user))return state;
   if(result?.state!=="READY")return emit(unavailable(result?.reason||"session_unavailable"));
   // Recheck after the read and after the verifier's asynchronous response.
   const token=await user.getIdTokenResult(true);
   if(!valid(seq,user))return state;
   const expiry=Date.parse(token?.expirationTime);
   if(token?.claims?.user_id!==user.uid||token?.claims?.email_verified!==true||!Number.isFinite(expiry)||expiry<=options.now?.() /* optional injected clock */){
    base.signOut();return clear("expired_or_invalid_token");
   }
   if(await verified({uid:user.uid,token})!==true){if(valid(seq,user)){base.signOut();return clear("revoked_or_unverified_session")}return state}
   if(!valid(seq,user))return state;
   return emit(result);
  }catch{if(valid(seq,user)){base.signOut();return clear("session_refresh_failed")}return state}
 }
 return Object.freeze({
  snapshot:()=>state,refresh:()=>refresh(),reconnect:()=>{if(!active)return Promise.resolve(state);online=true;clear("reconnecting");return refresh(true)},
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  accountChanged(){owner=null;current=null;base.accountChanged();return clear("account_changed")},
  signOut(){owner=null;current=null;base.signOut();return clear("signed_out")},
  offline(){online=false;base.offline();return clear("network_unavailable")},
  stop(){if(!active)return state;active=false;owner=null;current=null;clear("stopped");base.stop();listeners.clear();return state},
  canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false
 });
}
module.exports=Object.freeze({createSessionRaceGuard});
