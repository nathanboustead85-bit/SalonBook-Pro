"use strict";
// Phase 12.50: read-only interactive journey using explicitly synthetic fixture data.
// No network access, personal information, booking write or payment.
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BoustioPhase1250=api;})(typeof window!=="undefined"?window:null,function(){
 const fixtures=Object.freeze([
  {date:"2026-11-20",label:"Friday 20 November",services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Cut & colour",pricePence:5500,durationMinutes:90}],staff:[{id:"alex",name:"Alex"},{id:"sam",name:"Sam"}],availability:[{serviceId:"cut",staffId:"alex",times:["09:00","10:30","11:00"]},{serviceId:"cut",staffId:"sam",times:["09:30","14:00"]},{serviceId:"colour",staffId:"sam",times:["10:00","15:00"]}]},
  {date:"2026-11-21",label:"Saturday 21 November",services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Cut & colour",pricePence:5500,durationMinutes:90}],staff:[{id:"alex",name:"Alex"},{id:"sam",name:"Sam"}],availability:[{serviceId:"cut",staffId:"alex",times:["09:00","12:00"]},{serviceId:"cut",staffId:"sam",times:["10:30"]},{serviceId:"colour",staffId:"sam",times:["11:00"]}]}
 ]);
 const unavailable=()=>({status:"UNAVAILABLE",bookingEnabled:false,slots:[]});
 function options({date,serviceId,staffId="any"}={}){
  const day=fixtures.find(x=>x.date===date);if(!day)return unavailable();
  const service=day.services.find(x=>x.id===serviceId);if(!service)return unavailable();
  const staff=day.staff.filter(s=>day.availability.some(a=>a.serviceId===serviceId&&a.staffId===s.id));
  if(staffId!=="any"&&!staff.some(s=>s.id===staffId))return unavailable();
  const slots=day.availability.filter(a=>a.serviceId===serviceId&&(staffId==="any"||a.staffId===staffId)).flatMap(a=>a.times.map(time=>({time,staffId:a.staffId,staffName:day.staff.find(s=>s.id===a.staffId).name}))).sort((a,b)=>a.time.localeCompare(b.time)||a.staffId.localeCompare(b.staffId));
  return {status:"SYNTHETIC_PREVIEW",bookingEnabled:false,date,service,staff,slots};
 }
 function review({date,serviceId,staffId,time}={}){
  const data=options({date,serviceId,staffId});if(data.status!=="SYNTHETIC_PREVIEW")return unavailable();
  const slot=data.slots.find(s=>s.time===time&&(staffId==="any"||s.staffId===staffId));
  if(!slot)return unavailable();
  return {status:"NOT_BOOKED",bookingEnabled:false,serviceName:data.service.name,
   pricePence:data.service.pricePence,durationMinutes:data.service.durationMinutes,
   date,time,staffName:slot.staffName,message:"Demonstration only — no appointment has been created."};
 }
 return {fixtures,options,review,unavailable};
});
