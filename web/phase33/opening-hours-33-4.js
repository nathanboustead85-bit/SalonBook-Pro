"use strict";
// Phase 33.4: offline-only owner-supplied business-hours preview; never availability.
const {adaptStaffDashboard}=require("./staff-map-33-3");
const DAYS=Object.freeze(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]);
const empty=Object.freeze([]);
const unavailable=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,openingHours:empty,services:empty,staff:empty,business:null});
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const time=x=>typeof x==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
function mapOpeningHours(snapshot){
 if(!object(snapshot)||snapshot.schemaVersion!==1||!object(snapshot.days)||Object.keys(snapshot.days).some(x=>!DAYS.includes(x)))return unavailable("invalid_hours_schema");
 const output=[];
 for(const day of DAYS){
  if(!Object.hasOwn(snapshot.days,day))return unavailable("missing_day");
  const value=snapshot.days[day];
  if(!object(value)||typeof value.closed!=="boolean")return unavailable("invalid_day");
  if(value.closed){
   if(Object.keys(value).some(x=>x!=="closed"))return unavailable("closed_day_has_hours");
   output.push(Object.freeze({day,closed:true,intervals:empty}));
   continue;
  }
  if(!Array.isArray(value.intervals)||value.intervals.length<1||value.intervals.length>4||Object.keys(value).some(x=>!["closed","intervals"].includes(x)))return unavailable("invalid_intervals");
  const intervals=[];
  for(const slot of value.intervals){
   if(!object(slot)||Object.keys(slot).some(x=>!["open","close"].includes(x))||!time(slot.open)||!time(slot.close)||minutes(slot.open)>=minutes(slot.close))return unavailable("invalid_interval");
   intervals.push(Object.freeze({open:slot.open,close:slot.close}));
  }
  intervals.sort((a,b)=>minutes(a.open)-minutes(b.open));
  if(intervals.some((slot,i)=>i>0&&minutes(slot.open)<minutes(intervals[i-1].close)))return unavailable("overlapping_intervals");
  output.push(Object.freeze({day,closed:false,intervals:Object.freeze(intervals)}));
 }
 return Object.freeze({status:"HOURS_READ_ONLY_PREVIEW",bookingEnabled:false,openingHours:Object.freeze(output)});
}
function adaptOpeningHoursDashboard(input,context){
 const base=adaptStaffDashboard(input,context);
 if(base.status!=="READ_ONLY_READY")return base;
 if(!input.openingHours||input.hoursOwnerId!==context?.ownerId||input.hoursRevision!==base.revision)return unavailable("hours_owner_or_revision_mismatch");
 const mapped=mapOpeningHours(input.openingHours);
 if(mapped.status!=="HOURS_READ_ONLY_PREVIEW")return unavailable(mapped.reason);
 return Object.freeze({...base,openingHours:mapped.openingHours,availabilityStatus:"UNVERIFIED_READ_ONLY",bookingEnabled:false,editingEnabled:false});
}
module.exports=Object.freeze({mapOpeningHours,adaptOpeningHoursDashboard,DAYS});
