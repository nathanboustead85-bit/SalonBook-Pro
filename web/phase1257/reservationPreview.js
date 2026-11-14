"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BoustioPhase1257=api;})(typeof window!=="undefined"?window:null,function(){
 const mins=s=>typeof s==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
 const clock=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 const overlap=(a,b)=>a.start<b.end&&b.start<a.end;
 function preview({profile,smart,serviceId,staffId,date,time,today,holds=[]}={}){
  const service=profile?.services?.find(x=>x.id===serviceId&&x.published===true);
  if(!service||!Number.isInteger(service.durationMinutes)||!Number.isFinite(mins(time))||!/^\d{4}-\d{2}-\d{2}$/.test(date||"")||!Array.isArray(holds))return {status:"INVALID_PREVIEW",bookingCreated:false};
  const start=mins(time),end=start+service.durationMinutes;
  if(end>1440||!smart?.calculate({profile,serviceId,staffId,date,today})?.slots?.some(x=>x.time===time&&x.staffId===staffId))return {status:"UNAVAILABLE",bookingCreated:false};
  const target={staffId,date,start,end};
  if(holds.some(h=>h.staffId===staffId&&h.date===date&&overlap(target,h)))return {status:"DEMO_CONFLICT",bookingCreated:false};
  const staff=profile.staff.find(x=>x.id===staffId);
  return {status:"PREVIEW_ONLY",bookingCreated:false,reservationCreated:false,serviceName:service.name,staffName:staff.name,date,time,end:clock(end),durationMinutes:service.durationMinutes,pricePence:service.pricePence};
 }
 function simulate({request,holds=[]}={}){
  if(!request||request.status!=="PREVIEW_ONLY"||!Array.isArray(holds))return {status:"INVALID_PREVIEW",bookingCreated:false};
  const target={staffId:request.staffId,date:request.date,start:mins(request.time),end:mins(request.end)};
  if(!target.staffId||!Number.isFinite(target.start)||!Number.isFinite(target.end)||target.end<=target.start)return {status:"INVALID_PREVIEW",bookingCreated:false};
  if(holds.some(h=>h.staffId===target.staffId&&h.date===target.date&&overlap(target,h)))return {status:"DEMO_CONFLICT",bookingCreated:false};
  return {status:"DEMO_CONFIRMED_NOT_BOOKED",bookingCreated:false,reservationCreated:false,holds:[...holds,target]};
 }
 function requestFor({profile,smart,serviceId,staffId,date,time,today,holds=[]}={}){
  const p=preview({profile,smart,serviceId,staffId,date,time,today,holds});
  return p.status==="PREVIEW_ONLY"?{...p,staffId}:p;
 }
 return {preview,requestFor,simulate};
});
