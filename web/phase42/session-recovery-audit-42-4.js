"use strict";
// Independent emulator-only device sessions. No cross-device data synchronization claim.
const {createSessionRaceGuard}=require("./session-races-42-3");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createSessionRecoveryAudit(options){
 const {sdk,now=Date.now}=options||{};
 if(!sdk?.auth||typeof now!=="function")throw TypeError("injected_device_session_required");
 const base=createSessionRaceGuard({...options,now});
 let active=true,online=true,epoch=0,owner=null,user=null,state=unavailable("signed_out");
 const listeners=new Set();
 const emit=x=>{state=x;for(const fn of [...listeners]){try{fn(x)}catch{}}return state};
 const clear=reason=>{epoch++;return emit(unavailable(reason))};
 const valid=(seq,u)=>active&&online&&seq===epoch&&sdk.auth.currentUser===u&&user===u&&owner===u?.uid;
 async function check(reconnect=false){
  if(!active||!online)return state;
  const u=sdk.auth.currentUser;
  if(!u||typeof u.uid!=="string"||u.emailVerified!==true||typeof u.getIdTokenResult!=="function"){user=null;owner=null;base.signOut();return clear("unverified_or_signed_out")}
  if(u!==user||u.uid!==owner){user=u;owner=u.uid;clear("device_identity_changed")}
  const seq=++epoch;emit(unavailable("revalidating"));
  try{
   const result=await (reconnect?base.reconnect():base.refresh());
   if(!valid(seq,u))return state;
   if(result?.state!=="READY")return emit(unavailable(result?.reason||"session_unavailable"));
   const token=await u.getIdTokenResult(true);
   if(!valid(seq,u))return state;
   const expires=Date.parse(token?.expirationTime);
   if(token?.claims?.user_id!==u.uid||token?.claims?.email_verified!==true||!Number.isFinite(expires)||expires<=now()){base.signOut();return clear("expired_during_read")}
   return emit(result);
  }catch{if(valid(seq,u)){base.signOut();return clear("recovery_failed")}return state}
 }
 return Object.freeze({
  snapshot:()=>state,refresh:()=>check(false),
  reconnect(){if(!active)return Promise.resolve(state);online=true;clear("reconnecting");return check(true)},
  offline(){online=false;base.offline();return clear("network_unavailable")},
  accountChanged(){owner=null;user=null;base.accountChanged();return clear("account_changed")},
  signOut(){owner=null;user=null;base.signOut();return clear("signed_out")},
  stop(){if(!active)return state;active=false;owner=null;user=null;clear("stopped");base.stop();listeners.clear();return state},
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false,crossDeviceRevisionVerified:false
 });
}
module.exports=Object.freeze({createSessionRecoveryAudit});
