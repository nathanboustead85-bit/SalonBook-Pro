"use strict";
// Phase 12.44: pure adapter for actual Android liveData v1 JSON arrays.
// No Firebase SDK, writes, deployments or access to original appointments.
const {buildPublicSnapshot}=require("./publicAvailabilityProjection");
const days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const clock=/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/;
function fail(reason){return Object.freeze({status:"NOT_PUBLISHABLE",reason,bookingEnabled:false});}
function parseDoc(doc){
 if(!doc||doc.schemaVersion!==1||typeof doc.json!=="string"||doc.json.length>500000)throw Error("INVALID_CLOUD_DOCUMENT");
 const a=JSON.parse(doc.json);
 if(!Array.isArray(a)||a.length>10000)return null;
 return a;
}
function timeToMinutes(t){if(!clock.test(t||""))throw Error("INVALID_TIME");const [h,m]=t.split(":").map(Number);return h*60+m;}
function minutesToTime(n){return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");}
function convert({profile,servicesDoc,staffDoc,bookingsDoc,date,generatedAt}={}){
 try{
  if(typeof date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||
   new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)return fail("INVALID_DATE");
  const servicesRaw=parseDoc(servicesDoc),staffRaw=parseDoc(staffDoc),bookingsRaw=parseDoc(bookingsDoc);
  if(!servicesRaw||!staffRaw||!bookingsRaw||servicesRaw.length>200||staffRaw.length>100)return fail("INVALID_SOURCE");
  const services=servicesRaw.map(s=>{
   if(!s||typeof s.id!=="string"||typeof s.name!=="string"||
    typeof s.publicVisible!=="boolean"||typeof s.price!=="string"||
    !/^[0-9]+(?:\.[0-9]{1,2})?$/.test(s.price)||!Number.isInteger(s.duration))
    throw Error("INVALID_SERVICE");
   const pricePence=Math.round(Number(s.price)*100);
   if(!Number.isSafeInteger(pricePence))throw Error("INVALID_PRICE");
   return {id:s.id,name:s.name,pricePence,durationMinutes:s.duration,published:s.publicVisible};
  });
  const staff=staffRaw.map(s=>{
   if(!s||typeof s.id!=="string"||typeof s.name!=="string"||
    typeof s.publicVisible!=="boolean"||!Array.isArray(s.serviceIds)||
    !s.weeklySchedule||typeof s.weeklySchedule!=="object"||
    !Array.isArray(s.weeklyBreaks)||!Array.isArray(s.timeOff))throw Error("INVALID_STAFF");
   const day=days[new Date(date+"T00:00:00Z").getUTCDay()];
   const period=s.weeklySchedule[day];
   const hours=[];
   if(period!==null&&period!==undefined){
    if(typeof period!=="object")throw Error("INVALID_SCHEDULE");
    const start=timeToMinutes(period.open),end=timeToMinutes(period.close);
    if(start>=end)throw Error("INVALID_SCHEDULE");
    let blocks=[[start,end]];
    const unavailable=[...s.weeklyBreaks.filter(x=>x&&x.day===day),
      ...s.timeOff.filter(x=>x&&x.date===date)];
    for(const x of unavailable){
     const a=timeToMinutes(x.start),b=timeToMinutes(x.end);
     if(a>=b)throw Error("INVALID_BREAK");
     blocks=blocks.flatMap(([lo,hi])=>b<=lo||a>=hi?[[lo,hi]]:
      [[lo,Math.min(a,hi)],[Math.max(b,lo),hi]].filter(([p,q])=>p<q));
    }
    hours.push(...blocks.map(([a,b])=>[minutesToTime(a),minutesToTime(b)]));
   }
   return {id:s.id,name:s.name,active:s.publicVisible,serviceIds:s.serviceIds,
    workingHours:{[date]:hours}};
  });
  const appointments=bookingsRaw.map(a=>{
   if(!a||typeof a.staffId!=="string"||typeof a.date!=="string"||
    typeof a.time!=="string"||!Number.isInteger(a.duration)||a.duration<=0||
    a.duration>1440)throw Error("INVALID_BOOKING");
   const start=timeToMinutes(a.time),end=start+a.duration;
   if(end>1440)throw Error("INVALID_BOOKING");
   // Legacy Android bookings do not guarantee a status field. Treat ALL as occupied.
   return {staffId:a.staffId,date:a.date,start:a.time,end:minutesToTime(end),
    status:"confirmed"};
  });
  if(new Set(services.map(s=>s.id)).size!==services.length||
   new Set(staff.map(s=>s.id)).size!==staff.length)return fail("DUPLICATE_ID");
  return buildPublicSnapshot({profile,slug:profile?.slug,services,staff,appointments,date,generatedAt});
 }catch(_){return fail("INVALID_ANDROID_DATA")}
}
module.exports={convert};
