// Phase 25.4 — conservative buffer-aware synthetic conflict preview, never real availability.
import {createConflictPreview} from "./phase25-conflicts.mjs";
import {createPoliciesDemo} from "../business/onboarding/phase24-policies.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
const overlaps=(a,b,c,d)=>a<d&&c<b;
export function createBufferedConflictPreview(storage,owner){
 const conflicts=createConflictPreview(storage,owner);
 const policy=createPoliciesDemo(storage,owner);
 let policyValid=false,appointmentsValid=true,matchingValid=true;
 try{conflicts.matching.recover();}catch{matchingValid=false;}
 try{conflicts.recover();}catch{appointmentsValid=false;}
 try{policyValid=policy.load();}catch{}
 function slots(date,serviceId,staffId,nowDate="2026-11-19"){
  // Fail closed if policies cannot be recovered. Never show times based on guessed buffers.
  if(!policyValid||!appointmentsValid||!matchingValid)return [];
  const {bufferBeforeMinutes:before,bufferAfterMinutes:after}=policy.state;
  const base=conflicts.matching.slots(date,serviceId,staffId,nowDate);
  return base.filter(slot=>{
   const candidateStart=minutes(slot.time)-before,candidateEnd=minutes(slot.end)+after;
   return !conflicts.appointments.some(a=>a.date===date&&a.staffId===staffId&&
     overlaps(candidateStart,candidateEnd,minutes(a.start)-before,minutes(a.end)+after));
  });
 }
 return Object.freeze({
  owner,slots,
  get appointments(){return conflicts.appointments;},
  get matching(){return conflicts.matching;},
  get services(){return conflicts.services;},
  get staff(){return conflicts.staff;},
  get buffers(){return policyValid?{before:policy.state.bufferBeforeMinutes,after:policy.state.bufferAfterMinutes}:null;},
  get ready(){return policyValid&&appointmentsValid&&matchingValid&&conflicts.matching.ready;},
  get canBook(){return false;},get canRegister(){return false;},get canPay(){return false;},get canPublish(){return false;}
 });
}
