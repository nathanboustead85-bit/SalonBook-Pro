"use strict";
/** Phase 11.26: synthetic reconnect coordinator. In-memory only, never a production Firebase export. */
const {guard}=require("./phase113DemoBookingEngine");
const {createOfflineCalendarReplay}=require("./phase1125OfflineCalendarReplay");
function createReconnectRecovery(options){
 guard();
 const queue=createOfflineCalendarReplay(options);
 let online=false,attempts=0,lastError=null;
 function setOnline(value){
  guard();
  if(typeof value!=="boolean")throw Error("invalid connection state");
  online=value;
  return status();
 }
 function status(){
  guard();
  return Object.freeze({...queue.state(),online,attempts,lastError});
 }
 function recover(){
  guard();
  if(!online)return Object.freeze({...status(),outcome:"offline"});
  attempts++;
  try{
   const result=queue.flush();
   lastError=null;
   return Object.freeze({...status(),outcome:"synchronized",applied:result.applied,duplicates:result.duplicates});
  }catch(error){
   // A failed atomic replay leaves the entire queue intact for operator recovery.
   lastError="replay rejected";
   return Object.freeze({...status(),outcome:"blocked"});
  }
 }
 return Object.freeze({
  enqueue(update){guard();return queue.enqueue(update);},
  setOnline,recover,status,
  discardPending(){guard();return queue.discardPending();}
 });
}
module.exports={createReconnectRecovery};
