"use strict";
// Phase 12.37: isolated customer booking preview; no backend writes.
const SERVICES=Object.freeze([
 Object.freeze({id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30}),
 Object.freeze({id:"beard",name:"Beard Trim",pricePence:1200,durationMinutes:20}),
 Object.freeze({id:"cut-beard",name:"Haircut & Beard",pricePence:3000,durationMinutes:50})
]);
const TIMES=Object.freeze(["09:00","09:30","10:00","11:00","14:00"]);
function validatePreview({serviceId,time,customerName}={}){
 const service=SERVICES.find(s=>s.id===serviceId);
 const errors=[];
 if(!service)errors.push("Select a service");
 if(!TIMES.includes(time))errors.push("Select a time");
 if(typeof customerName!=="string"||customerName.trim().length<2||customerName.trim().length>80)
  errors.push("Enter a name between 2 and 80 characters");
 return Object.freeze({valid:errors.length===0,errors:Object.freeze(errors),service:service||null,
  time:TIMES.includes(time)?time:null});
}
function confirmationPreview(details){
 const v=validatePreview(details);
 if(!v.valid)return Object.freeze({status:"INVALID_PREVIEW",errors:v.errors,bookingCreated:false});
 return Object.freeze({status:"PREVIEW_ONLY",bookingCreated:false,
  serviceName:v.service.name,pricePence:v.service.pricePence,
  durationMinutes:v.service.durationMinutes,time:v.time,
  customerName:details.customerName.trim(),message:"Demo only — no appointment has been booked."});
}
const API={SERVICES,TIMES,validatePreview,confirmationPreview};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
if(typeof window!=="undefined")window.BoustioBookingPreview=API;
