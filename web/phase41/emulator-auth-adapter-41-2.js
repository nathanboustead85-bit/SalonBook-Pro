"use strict";
// Explicit dependency-injected emulator-only auth lifecycle; never initializes Firebase.
const {validateStagingEnvironment,validateSdkContract}=require("./staging-contract-41-1");
const {unavailable}=require("../phase39/dashboard-view-model-39-3");
function createEmulatorAuthAdapter({environment,sdk,viewModel,verifyRevocation,now=Date.now}){
 if(validateStagingEnvironment(environment).status!=="EMULATOR_CONTRACT_VALID"||validateSdkContract(sdk).status!=="INJECTED_SDK_CONTRACT_VALID"||!viewModel||typeof viewModel.refresh!=="function"||typeof viewModel.userChanged!=="function"||typeof viewModel.signOut!=="function"||typeof viewModel.stop!=="function"||typeof verifyRevocation!=="function"||typeof now!=="function")throw TypeError("emulator_only_dependencies_required");
 let active=true,epoch=0,identity=null,state=unavailable("signed_out");
 const listeners=new Set();
 function emit(next){state=next;for(const fn of [...listeners]){try{fn(next)}catch{}}return state}
 function clear(reason){epoch++;emit(unavailable(reason));return state}
 function reset(reason){clear(reason);viewModel.signOut();return state}
 async function authenticate(user,seq){
  if(!active||seq!==epoch||sdk.auth.currentUser!==user)return state;
  if(!user||typeof user.uid!=="string"||user.emailVerified!==true)return reset("unverified_or_signed_out");
  try{
   const token=await user.getIdTokenResult(true);
   if(!active||seq!==epoch||sdk.auth.currentUser!==user)return state;
   if(!token?.claims||token.claims.user_id!==user.uid||token.claims.email_verified!==true||!Number.isFinite(Date.parse(token.expirationTime))||Date.parse(token.expirationTime)<=now())return reset("invalid_or_expired_token");
   if(await verifyRevocation({uid:user.uid,token})!==true){if(active&&seq===epoch)return reset("revocation_not_verified");return state}
   if(!active||seq!==epoch||sdk.auth.currentUser!==user)return state;
   const next=await viewModel.refresh();
   if(!active||seq!==epoch||sdk.auth.currentUser!==user)return state;
   return emit(next?.state==="READY"?next:unavailable("dashboard_unavailable"));
  }catch{if(active&&seq===epoch)return reset("authentication_failed");return state}
 }
 function observed(user){
  if(!active)return;
  clear(user?"auth_refreshing":"signed_out");
  identity=user?.uid||null;
  if(!user){viewModel.signOut();return}
  viewModel.userChanged(user);
  const seq=epoch;
  void authenticate(user,seq);
 }
 const detach=sdk.onAuthStateChanged(sdk.auth,observed,()=>{if(active){identity=null;reset("auth_observer_failed")}});
 return Object.freeze({
  snapshot:()=>state,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(state);return()=>listeners.delete(fn)},
  async refresh(){if(!active)return state;const user=sdk.auth.currentUser;clear("auth_refreshing");if(!user){identity=null;viewModel.signOut();return reset("signed_out")}if(identity!==user.uid){identity=user.uid;viewModel.userChanged(user)}return authenticate(user,epoch)},
  signOut(){identity=null;return reset("signed_out")},
  networkUnavailable(){return reset("network_unavailable")},
  stop(){if(!active)return state;active=false;identity=null;clear("stopped");try{if(typeof detach==="function")detach()}finally{viewModel.stop();listeners.clear()}return state},
  canBook:false,canPay:false,canMessage:false,canDeploy:false
 });
}
module.exports=Object.freeze({createEmulatorAuthAdapter});
