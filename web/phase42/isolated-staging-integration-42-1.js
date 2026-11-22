"use strict";
// Dependency-injected, emulator-only, read-only integration. No SDK initialization.
const {validateStagingEnvironment,validateSdkContract}=require("../phase41/staging-contract-41-1");
const {createAndroidBusinessReader}=require("../phase36/android-business-adapter-36-1");
const {createMultiDeviceRecovery}=require("../phase41/multidevice-recovery-41-4");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createIsolatedStagingIntegration({environment,sdk,db,verifyRevocation,now=Date.now}){
 if(validateStagingEnvironment(environment).status!=="EMULATOR_CONTRACT_VALID"||validateSdkContract(sdk).status!=="INJECTED_SDK_CONTRACT_VALID"||!db||typeof verifyRevocation!=="function"||typeof now!=="function")throw TypeError("emulator_only_dependencies_required");
 const readAtomic=createAndroidBusinessReader({db,doc:sdk.doc,runTransaction:sdk.runTransaction});
 const recovery=createMultiDeviceRecovery({readAtomic,now});
 let active=true,online=true,epoch=0,state=unavailable("signed_out"),user=null,pending=null;
 const listeners=new Set();
 const emit=x=>{state=x;for(const fn of [...listeners]){try{fn(x)}catch{}}return state};
 const clear=reason=>{epoch++;return emit(unavailable(reason))};
 const same=(seq,u)=>active&&online&&seq===epoch&&user===u&&sdk.auth.currentUser===u;
 async function performRefresh(){
  if(!active||!online)return state;
  const u=sdk.auth.currentUser;
  if(!u||typeof u.uid!=="string"||u.emailVerified!==true||typeof u.getIdTokenResult!=="function"){user=null;recovery.signOut();return clear("unverified_or_signed_out")}
  if(user!==u){user=u;recovery.accountChanged(u.uid);clear("account_changed")}
  const seq=++epoch;emit(unavailable("auth_refreshing"));
  try{
   const token=await u.getIdTokenResult(true);
   if(!same(seq,u))return state;
   if(!token?.claims||token.claims.user_id!==u.uid||token.claims.email_verified!==true||!Number.isFinite(Date.parse(token.expirationTime))||Date.parse(token.expirationTime)<=now()){recovery.signOut();return clear("invalid_or_expired_token")}
   if(await verifyRevocation({uid:u.uid,token})!==true){if(same(seq,u)){recovery.signOut();return clear("revocation_not_verified")}return state}
   if(!same(seq,u))return state;
   const result=await recovery.refresh({uid:u.uid,emailVerified:true,expiresAt:Date.parse(token.expirationTime)});
   if(!same(seq,u))return state;
   return emit(result?.state==="READY"?result:unavailable(result?.reason||"dashboard_unavailable"));
  }catch{if(same(seq,u)){recovery.signOut();return clear("verification_or_read_failed")}return state}
 }
 function refresh(){
  if(pending&&pending.user===sdk.auth.currentUser)return pending.promise;
  const current=sdk.auth.currentUser,promise=performRefresh();
  const entry={user:current,promise};pending=entry;
  void promise.then(()=>{if(pending===entry)pending=null},()=>{if(pending===entry)pending=null});
  return promise;
 }
 function observed(next){if(!active)return;user=null;recovery.signOut();clear(next?"auth_changed":"signed_out");if(next)void refresh()}
 const detach=sdk.onAuthStateChanged(sdk.auth,observed,()=>{if(active){user=null;recovery.signOut();clear("auth_observer_failed")}});
 return Object.freeze({
  snapshot:()=>state,refresh,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  signOut(){user=null;recovery.signOut();return clear("signed_out")},
  offline(){online=false;recovery.offline();return clear("network_unavailable")},
  async reconnect(){if(!active)return state;online=true;recovery.offline();clear("reconnecting");return refresh()},
  stop(){if(!active)return state;active=false;user=null;clear("stopped");try{if(typeof detach==="function")detach()}finally{recovery.stop();listeners.clear()}return state},
  stagingConnected:false,stagingApproved:false,canBook:false,canPay:false,canMessage:false,canDeploy:false
 });
}
module.exports=Object.freeze({createIsolatedStagingIntegration});
