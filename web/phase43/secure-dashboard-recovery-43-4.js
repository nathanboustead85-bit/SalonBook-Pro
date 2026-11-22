"use strict";
// Isolated read-only dashboard composition. Synthetic policy approval is NOT trusted staging authorization.
const {createSessionRecoveryAudit}=require("../phase42/session-recovery-audit-42-4");
const {createAppCheckPolicy}=require("./app-check-policy-43-3");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createSecureDashboardRecovery(options={}){
 const {sdk,credentials,now=Date.now}=options;
 if(!sdk?.auth||typeof credentials!=="function")throw TypeError("isolated_dashboard_dependencies_required");
 const policy=createAppCheckPolicy(options);
 const session=createSessionRecoveryAudit(options);
 let active=true,online=true,epoch=0,state=unavailable("signed_out");
 const listeners=new Set();
 const emit=s=>{state=s;for(const fn of [...listeners]){try{fn(s)}catch{}}return state};
 const clear=reason=>{epoch++;return emit(unavailable(reason))};
 const valid=(seq,user)=>active&&online&&seq===epoch&&sdk.auth.currentUser===user;
 async function check(reconnect=false){
  if(!active||!online)return state;
  const user=sdk.auth.currentUser;
  const seq=++epoch;
  emit(unavailable("auth_policy_verifying"));
  if(!user||user.emailVerified!==true||typeof user.uid!=="string"){session.signOut();policy.invalidate();return clear("unverified_or_signed_out")}
  try{
   const supplied=await credentials(user);
   if(!valid(seq,user))return state;
   if(!supplied||supplied.uid!==user.uid){session.signOut();return clear("credentials_mismatch")}
   const verified=await policy.verify(supplied);
   if(!valid(seq,user))return state;
   if(verified.status!=="ISOLATED_POLICY_CONTRACT_VALID"){session.signOut();return clear("auth_policy_denied")}
   const result=await (reconnect?session.reconnect():session.refresh());
   if(!valid(seq,user))return state;
   if(result?.state!=="READY")return emit(unavailable(result?.reason||"dashboard_unavailable"));
   // Revalidate identity and policy AFTER the read. A distinct replay nonce is required.
   const fresh=await credentials(user);
   if(!valid(seq,user))return state;
   if(!fresh||fresh.uid!==user.uid||fresh.replayKey===supplied.replayKey){session.signOut();return clear("post_read_credentials_invalid")}
   const second=await policy.verify(fresh);
   if(!valid(seq,user))return state;
   if(second.status!=="ISOLATED_POLICY_CONTRACT_VALID"){session.signOut();return clear("post_read_policy_denied")}
   return emit(result);
  }catch{if(valid(seq,user)){session.signOut();return clear("recovery_unavailable")}return state}
 }
 return Object.freeze({
  snapshot:()=>state,refresh:()=>check(false),
  reconnect(){if(!active)return Promise.resolve(state);online=true;policy.invalidate();session.offline();clear("reconnecting");return check(true)},
  offline(){online=false;policy.invalidate();session.offline();return clear("network_unavailable")},
  accountChanged(){policy.invalidate();session.accountChanged();return clear("account_changed")},
  signOut(){policy.invalidate();session.signOut();return clear("signed_out")},
  stop(){if(!active)return state;active=false;policy.stop();session.stop();clear("stopped");listeners.clear();return state},
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  canBook:false,canPay:false,canMessage:false,canDeploy:false,stagingApproved:false,crossDeviceRevisionVerified:false
 });
}
module.exports=Object.freeze({createSecureDashboardRecovery});
