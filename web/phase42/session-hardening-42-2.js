"use strict";
// Emulator-only session boundary around Phase 42.1. No backend revocation claim.
const {createIsolatedStagingIntegration}=require("./isolated-staging-integration-42-1");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createHardenedSession({environment,sdk,db,verifyRevocation,now=Date.now}){
 if(typeof verifyRevocation!=="function"||typeof now!=="function")throw TypeError("trusted_verifier_contract_required");
 let active=true,online=true,generation=0,identity=null,state=unavailable("signed_out");
 const listeners=new Set(),emit=x=>{state=x;for(const fn of [...listeners]){try{fn(x)}catch{}}return state};
 const clear=reason=>{generation++;return emit(unavailable(reason))};
 // A verifier is injected for isolated tests only; unknown/error must fail closed.
 const gatedVerifier=async ({uid,token})=>{
  if(!active||!online||identity!==uid)return false;
  try{return await verifyRevocation({uid,token})===true}catch{return false}
 };
 const base=createIsolatedStagingIntegration({environment,sdk,db,verifyRevocation:gatedVerifier,now});
 const unsub=base.subscribe(next=>{if(active&&next?.state==="UNAVAILABLE"&&state.state==="READY")clear("underlying_session_invalidated")});
 async function refresh({reconnect=false}={}){
  if(!active||!online)return state;
  const current=sdk.auth.currentUser;
  if(!current||typeof current.uid!=="string"||current.emailVerified!==true){identity=null;base.signOut();return clear("unverified_or_signed_out")}
  if(identity!==current.uid){identity=current.uid;clear("account_changed")}
  const seq=++generation;emit(unavailable("auth_refreshing"));
  const result=reconnect?await base.reconnect():await base.refresh();
  if(!active||!online||seq!==generation||identity!==current.uid||sdk.auth.currentUser!==current)return state;
  // Do not return a READY view if the token expires while an atomic read is pending.
  if(result?.state==="READY"){
   try{
    const token=await current.getIdTokenResult(true);
    if(!active||!online||seq!==generation||identity!==current.uid||sdk.auth.currentUser!==current)return state;
    if(token?.claims?.user_id!==current.uid||token?.claims?.email_verified!==true||!Number.isFinite(Date.parse(token.expirationTime))||Date.parse(token.expirationTime)<=now()||await gatedVerifier({uid:current.uid,token})!==true){base.signOut();return clear("session_revalidation_failed")}
    if(!active||!online||seq!==generation||identity!==current.uid||sdk.auth.currentUser!==current)return state;
   }catch{if(seq===generation){base.signOut();return clear("session_revalidation_failed")}return state}
  }
  return emit(result?.state==="READY"?result:unavailable(result?.reason||"dashboard_unavailable"));
 }
 return Object.freeze({
  snapshot:()=>state,refresh:()=>refresh(),
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  signOut(){identity=null;base.signOut();return clear("signed_out")},
  offline(){online=false;base.offline();return clear("network_unavailable")},
  async reconnect(){if(!active)return state;online=true;clear("reconnecting");return refresh({reconnect:true})},
  accountChanged(){identity=null;base.signOut();return clear("account_changed")},
  stop(){if(!active)return state;active=false;identity=null;clear("stopped");unsub();base.stop();listeners.clear();return state},
  stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false
 });
}
module.exports=Object.freeze({createHardenedSession});
