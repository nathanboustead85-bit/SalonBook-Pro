"use strict";
// Phase 33.3 offline staff display mapping; never represents live availability.
const {adaptLegacyDashboard}=require("./legacy-services-map-33-2");
const {MAX_JSON_CHARS,MAX_RECORDS}=require("../phase32/content-validation-32-9");
const days=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const empty=Object.freeze([]);
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,staff:empty,services:empty,business:null});
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const clock=x=>typeof x==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const minute=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
const period=(a,b)=>clock(a)&&clock(b)&&minute(a)<minute(b);
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
function mapStaff(snapshot,services){
 if(!obj(snapshot)||snapshot.schemaVersion!==1||typeof snapshot.json!=="string")return deny("invalid_staff_envelope");
 if(snapshot.json.length>MAX_JSON_CHARS)return deny("oversized_staff");
 let data;try{data=JSON.parse(snapshot.json)}catch{return deny("malformed_staff_json")}
 if(!Array.isArray(data)||data.length>MAX_RECORDS||!Array.isArray(services))return deny("invalid_staff_collection");
 const allowed=new Set(services.map(s=>s.id)),ids=new Set(),out=[];
 for(const s of data){
  if(!obj(s)||!id(s.id)||ids.has(s.id)||typeof s.name!=="string"||!s.name.trim()||s.name.length>150||
     typeof s.role!=="string"||s.role.length>150||!Array.isArray(s.serviceIds)||s.serviceIds.length>MAX_RECORDS||
     s.serviceIds.some(x=>!id(x)||!allowed.has(x))||new Set(s.serviceIds).size!==s.serviceIds.length||
     (s.publicVisible!==undefined&&typeof s.publicVisible!=="boolean"))return deny("invalid_staff_profile");
  const weekly=obj(s.weeklySchedule)?s.weeklySchedule:{};
  if(s.weeklySchedule!==undefined&&!obj(s.weeklySchedule))return deny("invalid_staff_hours");
  if(Object.keys(weekly).some(d=>!days.includes(d)))return deny("invalid_staff_hours");
  const hours={};
  for(const d of days)if(Object.hasOwn(weekly,d)){
   const h=weekly[d];if(!obj(h)||!period(h.open,h.close))return deny("invalid_staff_hours");
   hours[d]=Object.freeze({open:h.open,close:h.close});
  }
  const breaks=s.weeklyBreaks===undefined?[]:s.weeklyBreaks;
  const leave=s.timeOff===undefined?[]:s.timeOff;
  if(!Array.isArray(breaks)||breaks.length>500||!Array.isArray(leave)||leave.length>500)return deny("invalid_exclusions");
  const mappedBreaks=[],mappedLeave=[];
  for(const b of breaks){
   if(!obj(b)||!id(b.id)||!days.includes(b.day)||!period(b.start,b.end)||!hours[b.day]||
      minute(b.start)<minute(hours[b.day].open)||minute(b.end)>minute(hours[b.day].close))return deny("invalid_break");
   mappedBreaks.push(Object.freeze({day:b.day,start:b.start,end:b.end}));
  }
  for(const t of leave){
   if(!obj(t)||!id(t.id)||!date(t.date)||!period(t.start,t.end))return deny("invalid_time_off");
   mappedLeave.push(Object.freeze({date:t.date,start:t.start,end:t.end}));
  }
  for(const d of days){
   const ranges=mappedBreaks.filter(x=>x.day===d).sort((a,b)=>minute(a.start)-minute(b.start));
   if(ranges.some((x,i)=>i>0&&minute(x.start)<minute(ranges[i-1].end)))return deny("overlapping_breaks");
  }
  ids.add(s.id);
  out.push(Object.freeze({id:s.id,name:s.name,role:s.role,serviceIds:Object.freeze([...s.serviceIds]),publicVisible:s.publicVisible===true,
   weeklySchedule:Object.freeze(hours),weeklyBreaks:Object.freeze(mappedBreaks),timeOff:Object.freeze(mappedLeave)}));
 }
 return Object.freeze({status:"STAFF_MAPPED_READ_ONLY",bookingEnabled:false,staff:Object.freeze(out)});
}
function adaptStaffDashboard(input,context){
 if(!input||input.loading===true)return adaptLegacyDashboard(input,context);
 const dashboard=adaptLegacyDashboard(input,context);
 if(dashboard.status!=="READ_ONLY_READY")return dashboard;
 if(!input.staff||input.staffOwnerId!==context?.ownerId||input.staffRevision!==dashboard.revision)return deny("staff_owner_or_revision_mismatch");
 const staff=mapStaff(input.staff,dashboard.services);
 if(staff.status!=="STAFF_MAPPED_READ_ONLY")return deny(staff.reason);
 return Object.freeze({...dashboard,staff:staff.staff,availabilityStatus:"UNVERIFIED_READ_ONLY"});
}
module.exports=Object.freeze({mapStaff,adaptStaffDashboard});
