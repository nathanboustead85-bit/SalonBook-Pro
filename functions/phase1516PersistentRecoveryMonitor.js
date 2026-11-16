"use strict";
// Phase 15.16: restart-safe mock monitoring snapshot preparation.
// This is monitoring-only storage, NOT a booking or Firestore production integration.
const {createRecoveryAuditPreparation}=require("./phase1514RecoveryAuditPreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const CATEGORIES=["access_denied","integrity_alert","uncertain"];
const LIMITS={access_denied:3,integrity_alert:2,uncertain:5};
const deny=status=>({status,acceptingBookings:false,reservationCreated:false});
function createPersistentRecoveryMonitor(store,snapshotStore,{clock=()=>Date.now(),windowMs=60000,
 thresholds=LIMITS,emitAlert=()=>{}}={}){
 if(!snapshotStore||typeof snapshotStore.load!=="function"||typeof snapshotStore.save!=="function"
  ||typeof clock!=="function"||typeof emitAlert!=="function"
  ||!Number.isSafeInteger(windowMs)||windowMs<1||!thresholds
  ||CATEGORIES.some(c=>!Number.isSafeInteger(thresholds[c])||thresholds[c]<1||thresholds[c]>1000))
  throw new TypeError("Invalid monitoring persistence configuration");
 const audit=createRecoveryAuditPreparation(store,{clock});
 let state=null;
 let queue=Promise.resolve();
 function validate(s,now){
  if(!s||s.version!==1||s.windowMs!==windowMs||!s.thresholds
   ||CATEGORIES.some(c=>s.thresholds[c]!==thresholds[c])
   ||!Number.isSafeInteger(s.lastNow)||s.lastNow<0||s.lastNow>now
   ||!s.events||!s.active||!Array.isArray(s.active)
   ||s.active.some(c=>!CATEGORIES.includes(c))
   ||CATEGORIES.some(c=>!Array.isArray(s.events[c])||s.events[c].length>10000
    ||s.events[c].some(t=>!Number.isSafeInteger(t)||t<0||t>now)
    ||s.events[c].some((t,i)=>i>0&&t<s.events[c][i-1])))return false;
  return true;
 }
 async function inspect(input,context){
  // Serialize monitoring updates to prevent lost counters in this mock adapter.
  const pending=queue.then(async()=>{
   const now=clock();
   if(!Number.isSafeInteger(now)||now<0)return deny("MONITORING_UNAVAILABLE");
   try{
    if(state===null){
     const saved=await snapshotStore.load();
     if(saved==null)state={version:1,windowMs,thresholds:{...thresholds},lastNow:now,
      events:Object.fromEntries(CATEGORIES.map(c=>[c,[]])),active:[]};
     else if(validate(saved,now))state=structuredClone(saved);
     else return deny("MONITORING_UNAVAILABLE");
    }
    if(now<state.lastNow)return deny("MONITORING_UNAVAILABLE");
    const result=await audit.inspect(input,context);
    const category=result.status==="OWNERSHIP_FORBIDDEN"||result.status==="OWNERSHIP_UNAUTHORIZED"
     ?"access_denied":result.status==="OWNERSHIP_KEY_REUSED_OR_CORRUPT"
     ?"integrity_alert":result.status==="OWNERSHIP_SIMULATED_PAIR_VERIFIED"?null:"uncertain";
    const next=structuredClone(state);
    next.lastNow=now;
    for(const c of CATEGORIES){
     next.events[c]=next.events[c].filter(t=>t>now-windowMs);
     if(next.events[c].length<thresholds[c])next.active=next.active.filter(x=>x!==c);
    }
    let alert=null;
    if(category){
     next.events[category].push(now);
     if(next.events[category].length>=thresholds[category]&&!next.active.includes(category)){
      next.active.push(category);
      alert=Object.freeze({type:"recovery_security_threshold",category,
       count:next.events[category].length,windowMs});
     }
    }
    // Persist suppression latch before notifying; failed writes never issue alerts.
    await snapshotStore.save(structuredClone(next));
    state=next;
    if(alert)try{await emitAlert(alert);}catch{/* safe failure: do not enable bookings */}
    return deny(result.status);
   }catch{return deny("MONITORING_UNAVAILABLE");}
  });
  queue=pending.then(()=>{},()=>{});
  return pending;
 }
 return Object.freeze({inspect,reserve:async()=>({...DISABLED}),
  // No sensitive request data or raw backend errors are exported.
  monitoringStatus:()=>state===null?"UNINITIALIZED":"READY"});
}
module.exports=Object.freeze({createPersistentRecoveryMonitor});
