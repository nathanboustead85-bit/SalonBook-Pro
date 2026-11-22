"use strict";
// Opt-in, read-only auth lifecycle. Caller injects emulator-only SDK and auth.
// Never initializes Firebase, deploys, writes, or enables booking/payment/chat.
const {createIsolatedDashboardHarness}=require("./integration-contract-39-1");
const {deny}=require("../phase38/schema-compatibility-38-2");
function createUnifiedSession({auth,db,doc,runTransaction,now=Date.now}){
 if(!auth||typeof auth!=="object"||typeof now!=="function")throw TypeError("auth_dependency_required");
 let generation=0,active=true,identity=null,view=deny("signed_out");
 const listeners=new Set();
 const emit=next=>{view=next;for(const fn of [...listeners]){try{fn(view)}catch{}}return view};
 const credentials=async()=>{
  const user=auth.currentUser;
  if(!user||!user.uid||user.emailVerified!==true)throw Error("verified_user_required");
  const result=await user.getIdTokenResult(true);
  if(auth.currentUser!==user||user.uid!==identity)throw Error("auth_identity_changed");
  if(!result||!result.claims||result.claims.user_id!==user.uid||result.claims.email_verified!==true||!Number.isFinite(Date.parse(result.expirationTime))||Date.parse(result.expirationTime)<=now())throw Error("token_invalid_or_expired");
  return {user:{uid:user.uid,emailVerified:true},token:result};
 };
 const harness=createIsolatedDashboardHarness({db,doc,runTransaction,credentials,now});
 function invalidate(reason,action){
  generation++;
  harness[action]();
  return emit(deny(reason));
 }
 function userChanged(user){
  const next=user?.uid||null;
  if(next!==identity){identity=next;return invalidate(next?"account_changed":"signed_out",next?"accountChanged":"signOut")}
  return view;
 }
 async function refresh(){
  if(!active)return view;
  const user=auth.currentUser;
  if(!user){identity=null;return invalidate("signed_out","signOut")}
  if(user.uid!==identity)userChanged(user);
  const sequence=++generation,expected=user;
  emit(deny("auth_refreshing"));
  const next=await harness.refresh();
  if(!active||sequence!==generation||auth.currentUser!==expected||identity!==expected.uid){
   if(active&&sequence===generation)return invalidate("account_changed","accountChanged");
   return view;
  }
  return emit(next);
 }
 return Object.freeze({
  snapshot:()=>view,
  subscribe(fn){if(typeof fn!=="function")throw TypeError("listener_required");listeners.add(fn);fn(view);return()=>listeners.delete(fn)},
  userChanged,refresh,retry:()=>refresh(),
  networkUnavailable:()=>invalidate("network_unavailable","networkUnavailable"),
  async networkRestored(){if(!active)return view;harness.networkUnavailable();await harness.networkRestored();return refresh()},
  background:()=>invalidate("backgrounded","background"),
  async foreground(){if(!active)return view;await harness.foreground();return refresh()},
  signOut:()=>{identity=null;return invalidate("signed_out","signOut")},
  stop:()=>{active=false;identity=null;invalidate("stopped","stop");listeners.clear();return view},
  launchApproved:false,canDeploy:false,canBook:false,canPay:false,canMessage:false
 });
}
module.exports=Object.freeze({createUnifiedSession});
