"use strict";
/** Phase 11.22: reject ambiguous website/calendar conflicts, synthetic only. */
const {guard}=require("./phase113DemoBookingEngine");
const {validateRequest,projectSnapshot}=require("./phase1115CloudCalendarContract");
function detectBookingConflicts({request,base,local,remote}){
 guard();
 const validated=validateRequest(request);
 const b=projectSnapshot(validated,base),l=projectSnapshot(validated,local),r=projectSnapshot(validated,remote);
 const byId=s=>new Map(s.appointments.map(a=>[a.id,a]));
 const bm=byId(b),lm=byId(l),rm=byId(r);
 const same=(x,y)=>JSON.stringify(x??null)===JSON.stringify(y??null);
 const conflicts=[];
 for(const id of new Set([...bm.keys(),...lm.keys(),...rm.keys()])){
  const original=bm.get(id),left=lm.get(id),right=rm.get(id);
  const localChanged=!same(left,original),remoteChanged=!same(right,original);
  if(localChanged&&remoteChanged&&!same(left,right))conflicts.push(id);
 }
 return Object.freeze({businessId:validated.businessId,date:validated.date,conflicts:Object.freeze(conflicts.sort()),safe:conflicts.length===0});
}
module.exports={detectBookingConflicts};
