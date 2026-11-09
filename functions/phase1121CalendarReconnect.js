"use strict";
/** Phase 11.21: offline/reconnect coordinator for synthetic calendar feeds only. */
const {guard}=require("./phase113DemoBookingEngine");
const {createSafeCalendarRefresh}=require("./phase1120SafeCalendarRefresh");
function createCalendarReconnect({request,initial,revision=0}){
 guard();
 const calendar=createSafeCalendarRefresh({request,initial,revision});
 let connected=false,attempts=0,lastError=null;
 return Object.freeze({
  state(){guard();return Object.freeze({connected,attempts,lastError,revision:calendar.revision(),snapshot:calendar.snapshot()});},
  disconnect(){guard();connected=false;},
  async reconnect(fetchSnapshot){
   guard();
   if(typeof fetchSnapshot!=="function")throw Error("trusted snapshot provider required");
   attempts++;
   connected=false;
   try{
    const response=await fetchSnapshot();
    if(!response||typeof response!=="object"||Array.isArray(response))throw Error("invalid reconnect response");
    // Reject stale, missing, and malformed feeds without modifying retained appointments.
    const changes=calendar.apply({next:response.snapshot,revision:response.revision});
    connected=true;lastError=null;
    return changes;
   }catch(err){
    lastError="calendar refresh unavailable";
    connected=false;
    throw Error(lastError,{cause:err});
   }
  }
 });
}
module.exports={createCalendarReconnect};
