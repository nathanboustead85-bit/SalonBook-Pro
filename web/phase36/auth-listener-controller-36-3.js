"use strict";
// Phase 36.3: dependency-injected auth listener controller, isolated and read-only.
const {createVerifiedOwnerSession}=require("./verified-owner-session-36-2");
const empty=reason=>Object.freeze({status:"UNAVAILABLE",reason,data:null,bookingEnabled:false,editingEnabled:false});
function createAuthListenerController({auth,db,doc,runTransaction,getIdTokenResult,onIdTokenChanged,now=Date.now}){
 if(!auth||typeof onIdTokenChanged!=="function"||typeof now!=="function")throw TypeError("auth_listener_dependencies_required");
 const bridge=createVerifiedOwnerSession({auth,db,doc,runTransaction,getIdTokenResult});
 let started=false,unsubscribe=null,epoch=0,online=true,current=null,state=empty("not_started");
 const observers=new Set();
 const publish=next=>{state=next;for(const listener of [...observers]){try{listener(state)}catch{/* observers cannot interrupt auth */}}return state};
 const subscribe=listener=>{if(typeof listener!=="function")throw TypeError("listener_required");observers.add(listener);listener(state);return ()=>observers.delete(listener)};
 const snapshot=()=>state;
 const clear=reason=>{epoch++;current=null;bridge.signOut();return publish(empty(reason))};
 const notify=async(user)=>{
  const token=++epoch;
  current=user||null;
  bridge.authChanged(user||null);
  publish(empty(user?"auth_refreshing":"signed_out"));
  if(!started||!online||!user)return state;
  let result;
  try{result=await bridge.refresh(now())}catch{if(token===epoch)return clear("auth_refresh_failed");return state}
  if(token!==epoch||!started||!online||current!==user||auth.currentUser!==user)return state;
  publish(result.status==="READ_ONLY_READY"?result:empty(result.reason||"auth_refresh_failed"));
  return state;
 };
 function start(){
  if(started)return snapshot();
  started=true;online=true;publish(empty("awaiting_auth"));
  try{
   const stop=onIdTokenChanged(auth,user=>{void notify(user)},()=>{clear("auth_listener_error")});
   if(typeof stop!=="function")throw Error("missing_unsubscribe");
   unsubscribe=stop;
  }catch{started=false;clear("auth_listener_setup_failed")}
  return snapshot();
 }
 function stop(){
  started=false;const stopListener=unsubscribe;unsubscribe=null;
  if(stopListener){try{stopListener()}catch{/* no stale state retained */}}
  return clear("stopped");
 }
 function networkUnavailable(){online=false;return clear("network_unavailable")}
 async function networkRestored(){
  if(!started)return empty("not_started");
  online=true;
  return notify(auth.currentUser);
 }
 async function refresh(){
  if(!started||!online)return snapshot();
  return notify(auth.currentUser);
 }
 return Object.freeze({start,stop,networkUnavailable,networkRestored,refresh,snapshot,subscribe});
}
module.exports=Object.freeze({createAuthListenerController});
