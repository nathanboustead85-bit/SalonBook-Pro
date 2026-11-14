"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BoustioPhase1256=api;})(typeof window!=="undefined"?window:null,function(){
 const toMin=s=>typeof s==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
 const fmt=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 function classify({date,today,serviceId,staffId="any",profile,smart}={}){
  if(!profile||!smart||!Array.isArray(profile.staff)||!Array.isArray(profile.services)||!Array.isArray(profile.appointments))return [];
  const service=profile.services.find(x=>x.id===serviceId&&x.published===true);
  if(!service||!Number.isInteger(service.durationMinutes)||service.durationMinutes<1)return [];
  const day=new Date(date+"T00:00:00Z");if(Number.isNaN(day.getTime()))return [];
  const dow=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][day.getUTCDay()];
  const people=profile.staff.filter(x=>x.active&&x.serviceIds.includes(serviceId)&&(staffId==="any"||x.id===staffId));
  const available=smart.calculate({date,today,serviceId,staffId,profile}).slots;
  if(!people.length||date<today)return [];
  const candidates=[];
  for(const person of people){
   const hours=person.weeklySchedule&&person.weeklySchedule[dow];if(!hours)continue;
   const start=toMin(hours.open),end=toMin(hours.close);if(!Number.isFinite(start)||!Number.isFinite(end))continue;
   for(let t=start;t+service.durationMinutes<=end;t+=30){
    const time=fmt(t),endTime=t+service.durationMinutes;
    const slot=available.find(x=>x.time===time&&x.staffId===person.id);
    if(slot){candidates.push({time,end:fmt(endTime),staffId:person.id,staffName:person.name,status:"available",label:"Available"});continue}
    const overlaps=(a,z)=>Number.isFinite(toMin(a))&&Number.isFinite(toMin(z))&&t<toMin(z)&&endTime>toMin(a);
    const onLeave=person.timeOff.some(x=>x.date===date&&overlaps(x.start,x.end));
    const onBreak=person.breaks.some(x=>x.day===dow&&overlaps(x.start,x.end));
    const booked=profile.appointments.some(x=>x.staffId===person.id&&x.date===date&&x.status!=="cancelled"&&overlaps(x.start,x.end));
    const status=onLeave?"leave":onBreak?"break":booked?"booked":"unavailable";
    candidates.push({time,end:fmt(endTime),staffId:person.id,staffName:person.name,status,label:{leave:"Away",break:"Lunch break",booked:"Overlaps booking",unavailable:"Unavailable"}[status]});
   }
  }
  candidates.sort((a,b)=>a.time.localeCompare(b.time)||a.staffId.localeCompare(b.staffId));
  // A customer selects a start time, not individual 30-minute calendar cells.
  // When "Any stylist" is selected, collapse duplicate starts; prefer a free stylist.
  if(staffId==="any"){
   const grouped=new Map();
   for(const item of candidates){const prior=grouped.get(item.time);if(!prior||(prior.status!=="available"&&item.status==="available"))grouped.set(item.time,item)}
   return [...grouped.values()].sort((a,b)=>a.time.localeCompare(b.time));
  }
  return candidates;
 }
 function summary({service,slot,date}={}){
  if(!service||!slot||!/^\d{4}-\d{2}-\d{2}$/.test(date||""))return null;
  return {status:"NOT_BOOKED",serviceName:service.name,staffName:slot.staffName,date,time:slot.time,end:fmt(toMin(slot.time)+service.durationMinutes),durationMinutes:service.durationMinutes,pricePence:service.pricePence,bookingEnabled:false};
 }
 return {classify,summary};
});
