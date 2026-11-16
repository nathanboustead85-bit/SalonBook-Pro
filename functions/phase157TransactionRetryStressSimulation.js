"use strict";
// Phase 15.7: deterministic transaction contention/retry stress rehearsal.
// Uses only an in-memory shared booking simulator; never contacts Firestore.
const {createAtomicBookingSimulation}=require("./phase153AtomicBookingSimulation");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
const deny=(status,extra={})=>({status,acceptingBookings:false,reservationCreated:false,...extra});
function createTransactionRetryStressSimulation(fixture,{maxAttempts=3}={}){
 if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>10)
  throw new TypeError("Retry limit must be 1..10");
 const engine=createAtomicBookingSimulation(fixture);
 function run(requests,{order,dropAcknowledgements=[]}={}){
  if(!Array.isArray(requests)||requests.length<1||requests.length>100
   ||requests.some(r=>!r||typeof r!=="object"))return deny("STRESS_INVALID");
  const sequence=order===undefined?requests.map((_,i)=>i):order;
  if(!Array.isArray(sequence)||sequence.length!==requests.length
   ||new Set(sequence).size!==requests.length
   ||sequence.some(i=>!Number.isSafeInteger(i)||i<0||i>=requests.length)
   ||!Array.isArray(dropAcknowledgements)
   ||dropAcknowledgements.some(i=>!Number.isSafeInteger(i)||i<0||i>=requests.length))
   return deny("STRESS_INVALID");
  // All devices read the same snapshot before any simulated commit.
  const prepared=requests.map(r=>engine.prepare(r));
  const results=new Array(requests.length);
  for(const i of sequence){
   let p=prepared[i],attempts=0,result;
   while(attempts<maxAttempts){
    attempts++;
    result=engine.commit(p);
    if(result.status!=="SIMULATION_RETRY_REQUIRED")break;
    p=engine.prepare(requests[i]);
   }
   const committed=result.status==="SIMULATION_ATOMIC_COMMIT_ONLY";
   results[i]={status:committed&&dropAcknowledgements.includes(i)
    ?"STRESS_ACKNOWLEDGEMENT_LOST":result.status,attempts};
  }
  return deny("STRESS_SIMULATION_COMPLETE",{results});
 }
 return Object.freeze({run,read:engine.read,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createTransactionRetryStressSimulation});
