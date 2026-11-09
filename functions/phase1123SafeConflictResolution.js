"use strict";
/** Phase 11.23: conservative three-way merge, synthetic only. No writes or deployment. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
const {detectBookingConflicts}=require("./phase1122BookingConflicts");
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
function resolveBookingConflicts({request,base,local,remote}){
 guard();
 const valid=validateRequest(request);
 const snapshots=[base,local,remote].map(s=>projectSnapshot(valid,s));
 const conflicts=detectBookingConflicts({request:valid,base,local,remote}).conflicts;
 const blocked=new Set(conflicts);
 const [baseMap,localMap,remoteMap]=snapshots.map(s=>new Map(s.appointments.map(b=>[b.id,b])));
 const merged=[],held=[];
 for(const id of [...new Set([...baseMap.keys(),...localMap.keys(),...remoteMap.keys()])].sort()){
  const original=baseMap.get(id),left=localMap.get(id),right=remoteMap.get(id);
  // No deletion is inferred from an absent feed item: retain the last known booking.
  if(blocked.has(id)){held.push(id);if(original)merged.push(original);continue;}
  let selected;
  if(same(left,right))selected=left;
  else if(same(left,original))selected=right;
  else if(same(right,original))selected=left;
  else {held.push(id);selected=original;}
  if(!selected){
   if(original){held.push(id);selected=original;}
   else if(left||right)selected=left||right;
  }
  if(selected)merged.push(selected);
 }
 const result=projectSnapshot(valid,{businessId:valid.businessId,date:valid.date,appointments:merged});
 return Object.freeze({snapshot:result,held:Object.freeze([...new Set(held)].sort()),requiresReview:held.length>0});
}
module.exports={resolveBookingConflicts};
