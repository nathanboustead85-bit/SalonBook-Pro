"use strict";
// Phase 33.5: immutable offline dashboard assembly, not a booking/availability engine.
const {adaptOpeningHoursDashboard}=require("./opening-hours-33-4");
const empty=Object.freeze([]);
const unavailable=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,services:empty,staff:empty,openingHours:empty,business:null});
const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
function assembleDashboard(input,context){
 const base=adaptOpeningHoursDashboard(input,context);
 if(base.status!=="READ_ONLY_READY")return base;
 const hours=new Map(base.openingHours.map(d=>[d.day,d]));
 const serviceIds=new Set(base.services.map(s=>s.id));
 for(const person of base.staff){
  if(person.serviceIds.some(id=>!serviceIds.has(id)))return unavailable("unknown_assigned_service");
  for(const [day,shift] of Object.entries(person.weeklySchedule)){
   const business=hours.get(day);
   if(!business||business.closed)return unavailable("staff_on_closed_day");
   if(!business.intervals.some(i=>mins(i.open)<=mins(shift.open)&&mins(i.close)>=mins(shift.close)))return unavailable("staff_outside_business_hours");
  }
  for(const pause of person.weeklyBreaks){
   const shift=person.weeklySchedule[pause.day];
   if(!shift||mins(pause.start)<mins(shift.open)||mins(pause.end)>mins(shift.close))return unavailable("invalid_staff_break");
  }
 }
 const warnings=[];
 if(base.services.length===0)warnings.push("no_services");
 if(base.staff.length===0)warnings.push("no_staff");
 if(base.openingHours.every(d=>d.closed))warnings.push("business_closed_all_week");
 if(base.staff.some(s=>s.publicVisible&&s.serviceIds.length===0))warnings.push("visible_staff_without_services");
 const summary=Object.freeze({serviceCount:base.services.length,staffCount:base.staff.length,closedDays:base.openingHours.filter(d=>d.closed).length});
 return Object.freeze({...base,status:"ASSEMBLED_READ_ONLY",summary,warnings:Object.freeze(warnings),bookingEnabled:false,editingEnabled:false,availabilityStatus:"UNVERIFIED_READ_ONLY"});
}
module.exports=Object.freeze({assembleDashboard});
