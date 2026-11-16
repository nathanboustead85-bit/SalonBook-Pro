"use strict";
// Phase 14.13: two-device stale-view and collision simulation.
// This module has no Firestore dependency, endpoint or production write path.
const {createRollbackSimulator}=require("./phase148RollbackSimulator");
const {DISABLED}=require("./phase147DisabledAtomicReservation");
function createMultiDeviceConflictSimulator(config){
 const engine=createRollbackSimulator(config);
 function device(name){
  if(typeof name!=="string"||!name.trim())throw new TypeError("device label required");
  let last=null;
  return Object.freeze({
   observe(){last=engine.read();return last;},
   prepare(intent){const plan=engine.prepare(intent);return {...plan,device:name};},
   // A client cannot treat a cached view as an authorization to write.
   attempt(plan,options={}){
    if(!plan||plan.device!==name)return {status:"DEVICE_PLAN_INVALID",reservationCreated:false,acceptingBookings:false};
    return engine.commit(plan,options);
   },
   cached(){return last?{version:last.version,bookings:JSON.parse(JSON.stringify(last.bookings))}:null;}
  });
 }
 return Object.freeze({device,read:engine.read,reserve:async()=>({...DISABLED})});
}
module.exports=Object.freeze({createMultiDeviceConflictSimulator});
