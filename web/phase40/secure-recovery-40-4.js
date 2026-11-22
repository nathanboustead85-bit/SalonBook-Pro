"use strict";
// Synthetic read-only lifecycle gate. Revocation must be checked by injected trusted verifier.
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createSecureRecovery({auth,viewModel,verifyRevocation,now=Date.now}){
 if(!auth||!viewModel||typeof viewModel.refresh!=="function"||typeof viewModel.subscribe!=="function"||typeof verifyRevocation!=="function"||typeof now!=="function")throw TypeError("isolated_recovery_dependencies_required");
 let epoch=0,active=true,online=true,visible=true,identity=null,state=unavailable("signed_out");
 const listeners=new Set();
 const emit=next=>{state=next;for(const fn of [...listeners]){try{fn(next)}catch{}}return next};
 const clear=(reason)=>{epoch++;emit(unavailable(reason));return state};
 const same=(seq,user)=>active&&online&&visible&&seq===epoch&&auth.currentUser===user&&identity===user.uid;
 async function refresh(){
  if(!active||!online||!visible)return state;
  const user=auth.currentUser;
  if(!user||typeof user.uid!=="string"||user.emailVerified!==true){identity=null;viewModel.signOut();return clear("unverified_or_signed_out")}
  if(identity!==user.uid){identity=user.uid;viewModel.userChanged(user)}
  const seq=++epoch;emit(unavailable("auth_refreshing"));
  try{
   const token=await user.getIdTokenResult(true);
   if(!same(seq,user))return state;
   if(!token?.claims||token.claims.user_id!==user.uid||token.claims.email_verified!==true||!Number.isFinite(Date.parse(token.expirationTime))||Date.parse(token.expirationTime)<=now()){viewModel.signOut();return clear("invalid_or_expired_token")}
   // This injected verifier must fail closed on revoked/unknown/offline responses.
   if(await verifyRevocation({uid:user.uid,token})!==true){if(same(seq,user)){viewModel.signOut();return clear("revocation_not_verified")}return state}
   if(!same(seq,user))return state;
   const result=await viewModel.refresh();
   if(!same(seq,user))return state;
   return emit(result?.state==="READY"?result:unavailable("dashboard_unavailable"));
  }catch{if(same(seq,user)){viewModel.signOut();return clear("session_verification_failed")}return state}
 }
 function boundary(reason,method){clear(reason);if(typeof viewModel[method]==="function")viewModel[method]();return state}
 const unsubscribe=viewModel.subscribe(next=>{if(active&&next?.state==="UNAVAILABLE"&&next.reason!=="auth_refreshing"&&state.state==="READY")clear("underlying_session_invalidated")});
 return Object.freeze({
  snapshot:()=>state,refresh,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  accountChanged(user){identity=user?.uid||null;return boundary("account_changed","signOut")},
  signOut(){identity=null;return boundary("signed_out","signOut")},
  networkUnavailable(){online=false;return boundary("network_unavailable","networkUnavailable")},
  async networkRestored(){online=true;clear("reconnecting");return refresh()},
  background(){visible=false;return boundary("backgrounded","networkUnavailable")},
  async foreground(){visible=true;clear("foreground_recheck");return online?refresh():state},
  stop(){if(!active)return state;active=false;identity=null;clear("stopped");unsubscribe();viewModel.stop();listeners.clear();return state},
  canBook:false,canPay:false,canMessage:false,canDeploy:false
 });
}
module.exports=Object.freeze({createSecureRecovery});
