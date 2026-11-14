"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BoustioPhase1258=api;})(typeof window!=="undefined"?window:null,function(){
 const minutes=s=>typeof s==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
 const overlaps=(a,b)=>a.date===b.date&&a.staffId===b.staffId&&a.start<b.end&&b.start<a.end;
 const valid=h=>h&&typeof h.date==="string"&&typeof h.staffId==="string"&&Number.isInteger(h.start)&&Number.isInteger(h.end)&&h.start>=0&&h.end<=1440&&h.start<h.end;
 function cancel({holds=[],index}={}){
  if(!Array.isArray(holds)||!Number.isInteger(index)||index<0||index>=holds.length||!holds.every(valid))return {status:"INVALID_DEMO_SELECTION",changed:false};
  return {status:"DEMO_CANCELLED_NOT_REAL",changed:true,bookingCreated:false,holds:holds.filter((_,i)=>i!==index)};
 }
 function reschedule({holds=[],index,request}={}){
  if(!Array.isArray(holds)||!Number.isInteger(index)||index<0||index>=holds.length||!holds.every(valid)||!request||request.status!=="PREVIEW_ONLY")return {status:"INVALID_DEMO_SELECTION",changed:false};
  const next={date:request.date,staffId:request.staffId,start:minutes(request.time),end:minutes(request.end)};
  if(!valid(next))return {status:"INVALID_DEMO_SELECTION",changed:false};
  if(holds.some((h,i)=>i!==index&&overlaps(h,next)))return {status:"DEMO_RESCHEDULE_CONFLICT",changed:false};
  return {status:"DEMO_RESCHEDULED_NOT_REAL",changed:true,bookingCreated:false,holds:holds.map((h,i)=>i===index?next:h)};
 }
 return {cancel,reschedule,overlaps};
});
