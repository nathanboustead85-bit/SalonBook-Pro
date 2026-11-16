"use strict";
// Phase 15.15: bounded in-memory threshold/alert rehearsal for privacy-safe audit events.
// No production notification, database writes, personal identifiers or booking endpoint.
const {createRecoveryAuditPreparation}=require("./phase1514RecoveryAuditPreparation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const CATEGORIES=Object.freeze(["access_denied","integrity_alert","uncertain"]);
const LIMITS=Object.freeze({access_denied:3,integrity_alert:2,uncertain:5});
function createRecoverySecurityMonitor(store,{clock=()=>Date.now(),windowMs=60000,
 thresholds=LIMITS,emitAlert=()=>{}}={}){
 if(typeof clock!=="function"||typeof emitAlert!=="function"
  ||!Number.isSafeInteger(windowMs)||windowMs<1
  ||!thresholds||typeof thresholds!=="object"
  ||CATEGORIES.some(c=>!Number.isSafeInteger(thresholds[c])||thresholds[c]<1||thresholds[c]>1000))
  throw new TypeError("Invalid monitoring configuration");
 const events=new Map(CATEGORIES.map(c=>[c,[]]));
 const active=new Set();
 const alerts=[];
 let lastNow=-1;
 const audit=createRecoveryAuditPreparation(store,{clock,emit:async event=>{
  if(!CATEGORIES.includes(event.category))return;
  const now=clock();
  if(!Number.isSafeInteger(now)||now<0||now<lastNow)return; // invalid clock: no false alert
  lastNow=now;
  const times=events.get(event.category);
  times.push(now);
  while(times.length&&times[0]<=now-windowMs)times.shift();
  // Release latches when a category falls below its threshold.
  for(const c of CATEGORIES){
   const list=events.get(c);
   while(list.length&&list[0]<=now-windowMs)list.shift();
   if(list.length<thresholds[c])active.delete(c);
  }
  if(times.length>=thresholds[event.category]&&!active.has(event.category)){
   active.add(event.category);
   const alert=Object.freeze({type:"recovery_security_threshold",
    category:event.category,count:times.length,windowMs});
   alerts.push(alert);
   try{await emitAlert(alert);}catch{/* monitoring must never authorize bookings */}
  }
 }});
 return Object.freeze({
  inspect:audit.inspect,
  reserve:async()=>({...DISABLED}),
  summary:()=>Object.freeze({audit:audit.summary(),alerts:alerts.slice()}),
  // No raw requests, owners, keys or booking details exposed.
 });
}
module.exports=Object.freeze({createRecoverySecurityMonitor});
