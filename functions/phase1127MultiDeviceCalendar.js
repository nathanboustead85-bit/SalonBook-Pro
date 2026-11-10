"use strict";
/** Phase 11.27: synthetic multi-device compare-and-swap calendar. No network writes or production exports. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
const {createIdempotentCalendarSync}=require("./phase1124IdempotentCalendarSync");
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function createMultiDeviceCalendar({request,initial,revision=0}){
 guard();
 const valid=validateRequest(request);
 const sync=createIdempotentCalendarSync({request:valid,initial,revision});
 const seen=new Map();
 function submit({deviceId,operationId,baseRevision,snapshot}={}){
  guard();
  if(typeof deviceId!=="string"||! /^[a-zA-Z0-9_-]{1,64}$/.test(deviceId)||
     typeof operationId!=="string"||! /^[a-zA-Z0-9_-]{1,64}$/.test(operationId))throw Error("invalid device operation");
  if(!Number.isSafeInteger(baseRevision)||baseRevision<0)throw Error("invalid base revision");
  const candidate=projectSnapshot(valid,snapshot);
  const key=JSON.stringify([deviceId,operationId]);
  const previous=seen.get(key);
  if(previous){
   if(previous.baseRevision!==baseRevision||!same(previous.snapshot,candidate))throw Error("operation replay conflict");
   return Object.freeze({outcome:"duplicate",...sync.state()});
  }
  const state=sync.state();
  if(baseRevision!==state.revision)return Object.freeze({outcome:"stale",...state});
  // Different booking IDs cannot reserve overlapping time on the same staff member.
  const active=candidate.appointments.filter(b=>b.status!=="cancelled");
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j];
   if(a.staffId===b.staffId&&a.startAt<b.endAt&&b.startAt<a.endAt)
    return Object.freeze({outcome:"conflict",...state});
  }
  // Existing appointments cannot disappear from a partial device feed.
  const currentIds=new Set(state.snapshot.appointments.map(b=>b.id));
  const candidateIds=new Set(candidate.appointments.map(b=>b.id));
  if([...currentIds].some(id=>!candidateIds.has(id)))
   return Object.freeze({outcome:"incomplete",...state});
  const nextRevision=state.revision+1;
  if(!Number.isSafeInteger(nextRevision))throw Error("revision exhausted");
  const result=sync.apply({revision:nextRevision,snapshot:candidate});
  seen.set(key,{baseRevision,snapshot:candidate});
  return Object.freeze({outcome:"applied",...result});
 }
 return Object.freeze({submit,state(){guard();return sync.state();}});
}
module.exports={createMultiDeviceCalendar};
