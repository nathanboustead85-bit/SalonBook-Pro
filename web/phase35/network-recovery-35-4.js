"use strict";
// Phase 35.4: isolated retry orchestration, no Firebase SDK, writes, timers or production I/O.
const {createAuthLifecycle}=require("./auth-lifecycle-35-3");
const RETRY_MS=Object.freeze([1000,3000,10000]);
const transient=new Set(["unavailable","deadline-exceeded","resource-exhausted","aborted"]);
const unavailable=reason=>Object.freeze({status:"UNAVAILABLE",reason,data:null,bookingEnabled:false,editingEnabled:false});
const safe=x=>Number.isSafeInteger(x)&&x>=0;
function createNetworkRecovery(readAtomic,wait){
 if(typeof readAtomic!=="function"||typeof wait!=="function")throw TypeError("injected_reader_and_wait_required");
 let epoch=0,active=null,display=unavailable("signed_out");
 const lifecycle=createAuthLifecycle(async (...args)=>readAtomic(...args));
 const snapshot=()=>display;
 function invalidate(reason){epoch++;active=null;lifecycle.signOut();display=unavailable(reason);return display}
 function transition(auth,now){epoch++;active=auth&&auth.emailVerified===true&&safe(auth.expiresAt)&&auth.expiresAt>now?Object.freeze({...auth}):null;lifecycle.transition(auth,now);display=unavailable(active?"session_changed":"invalid_session");return display}
 function signOut(){return invalidate("signed_out")}
 function offline(){return invalidate("network_unavailable")}
 async function refresh(now){
  const token=++epoch,auth=active;
  display=unavailable("loading");
  if(!auth||!safe(now)||auth.expiresAt<=now)return invalidate("expired_or_signed_out");
  // A new attempt resets old display before reading. Every retry is a fresh
  // transaction via the injected atomic reader; no partial documents are shown.
  for(let attempt=0;attempt<=RETRY_MS.length;attempt++){
   if(token!==epoch)return display;
   if(auth.expiresAt<=now)return invalidate("expired_session");
   let code=null;
   try{
    // Auth lifecycle remains the only path to a visible mapped result.
    const result=await lifecycle.refresh(now);
    if(token!==epoch)return display;
    if(result.status==="READ_ONLY_READY"){display=result;return display}
    // Mapper/auth failures are terminal. The 35.3 lifecycle deliberately
    // masks Firestore error codes, so retry eligibility comes from the
    // narrowly-scoped injected reader wrapper below.
    return invalidate(result.reason||"read_failed");
   }catch(e){code=e?.code}
   if(token!==epoch)return display;
   if(!transient.has(code)||attempt===RETRY_MS.length)return invalidate("read_failed");
   await wait(RETRY_MS[attempt]);
  }
  return invalidate("read_failed");
 }
 return Object.freeze({transition,refresh,signOut,offline,snapshot,RETRY_MS});
}
// Separate narrowly-scoped retrier preserves error codes without changing
// the already-tested 35.3 lifecycle. A caller must supply a trusted atomic reader.
function createRetryingAtomicReader(reader,wait,isCurrent){
 if(typeof reader!=="function"||typeof wait!=="function"||typeof isCurrent!=="function")throw TypeError("injected_dependencies_required");
 return async (paths,uid)=>{
  for(let attempt=0;attempt<=RETRY_MS.length;attempt++){
   if(!isCurrent())throw Object.assign(Error("cancelled"),{code:"cancelled"});
   try{return await reader(paths,uid)}
   catch(e){
    if(!isCurrent())throw Object.assign(Error("cancelled"),{code:"cancelled"});
    if(!transient.has(e?.code)||attempt===RETRY_MS.length)throw e;
    await wait(RETRY_MS[attempt]);
   }
  }
 };
}
module.exports=Object.freeze({createNetworkRecovery,createRetryingAtomicReader,RETRY_MS});
