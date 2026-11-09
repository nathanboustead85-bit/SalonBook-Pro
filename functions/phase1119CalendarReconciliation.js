"use strict";
/** Phase 11.19: synthetic website-to-calendar reconciliation contract. No deployment. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
function reconcileCalendar({request,previous,current}){
 guard();
 const validated=validateRequest(request);
 const before=projectSnapshot(validated,previous);
 const after=projectSnapshot(validated,current);
 const oldById=new Map(before.appointments.map(a=>[a.id,a]));
 const newById=new Map(after.appointments.map(a=>[a.id,a]));
 const added=[],changed=[],removed=[];
 for(const item of after.appointments){
  const old=oldById.get(item.id);
  if(!old)added.push(item);
  else if(["source","serviceId","staffId","startAt","endAt","status"].some(k=>old[k]!==item[k]))changed.push(item);
 }
 for(const item of before.appointments)if(!newById.has(item.id))removed.push(item.id);
 return Object.freeze({
  businessId:validated.businessId,date:validated.date,
  added:Object.freeze(added),changed:Object.freeze(changed),removed:Object.freeze(removed),
  unchanged:after.appointments.length-added.length-changed.length
 });
}
module.exports={reconcileCalendar};
