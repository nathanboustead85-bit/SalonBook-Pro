"use strict";
// Read-only inspection of synthetic Android v1 documents. Never enables availability.
const {paths}=require("../phase34/android-firestore-map-34-2");
const {validateBusinessCompatibility,deny}=require("../phase38/schema-compatibility-38-2");
const {mapStaff}=require("../phase33/staff-map-33-3");
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const validTime=x=>typeof x==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
const days=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
function inspectWorkingHours(staff){
 if(!Array.isArray(staff)||staff.length>500)return {ok:false,reason:"invalid_staff_collection"};
 for(const person of staff){
  if(!obj(person)||!obj(person.weeklySchedule)||!Array.isArray(person.weeklyBreaks)||!Array.isArray(person.timeOff))return {ok:false,reason:"invalid_staff_schedule"};
  for(const [day,period] of Object.entries(person.weeklySchedule)){
   if(!days.includes(day)||!obj(period)||!validTime(period.open)||!validTime(period.close)||minutes(period.open)>=minutes(period.close))return {ok:false,reason:"invalid_working_hours"};
  }
  const byDay=new Map();
  for(const b of person.weeklyBreaks){
   const h=person.weeklySchedule[b?.day];
   if(!obj(b)||!h||!validTime(b.start)||!validTime(b.end)||minutes(b.start)<minutes(h.open)||minutes(b.end)>minutes(h.close)||minutes(b.start)>=minutes(b.end))return {ok:false,reason:"invalid_staff_break"};
   const a=byDay.get(b.day)||[];a.push([minutes(b.start),minutes(b.end)]);byDay.set(b.day,a);
  }
  for(const ranges of byDay.values()){ranges.sort((a,b)=>a[0]-b[0]);if(ranges.some((r,i)=>i&&r[0]<ranges[i-1][1]))return {ok:false,reason:"overlapping_staff_breaks"}}
 }
 return {ok:true};
}
function inspectAndroidCompatibility(auth,documents,now){
 if(!auth||typeof auth.uid!=="string"||!obj(documents))return deny("invalid_context");
 const p=paths(auth.uid);
 for(const key of Object.values(p))if(!obj(documents[key]))return deny("missing_document");
 for(const key of Object.values(p))if(documents[key].schemaVersion!==1)return deny("unsupported_schema_version");
 let raw;try{raw=JSON.parse(documents[p.staff].json)}catch{return deny("malformed_staff_json")}
 const hours=inspectWorkingHours(raw);if(!hours.ok)return deny(hours.reason);
 const result=validateBusinessCompatibility(auth,documents,now);
 if(result.status!=="COMPATIBLE_READ_ONLY")return result;
 const mapped=mapStaff(documents[p.staff],result.services);
 if(mapped.status!=="STAFF_MAPPED_READ_ONLY")return deny(mapped.reason);
 return Object.freeze({...result,staff:mapped.staff,workingHoursStatus:"STAFF_SCHEDULE_VALIDATED_ONLY",businessOpeningHoursStatus:"NOT_VERIFIED",availabilityStatus:"UNVERIFIED_READ_ONLY",migrationReady:false,sharedRevisionVerified:false});
}
module.exports=Object.freeze({inspectAndroidCompatibility,inspectWorkingHours});
