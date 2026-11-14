(function(){
"use strict";
// Phase 12.38: isolated published-catalogue snapshot adapter; NO live Firestore reads/writes.
const SAMPLE=Object.freeze({
 businessId:"demo-salon",businessName:"Demo Salon",published:true,
 services:[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30,published:true},
 {id:"colour",name:"Colour",pricePence:4500,durationMinutes:60,published:true},
 {id:"private",name:"Internal service",pricePence:500,durationMinutes:15,published:false}],
 staff:[{id:"alex",name:"Alex",active:true,serviceIds:["cut","colour"],
 workingHours:{"2026-11-20":[["09:00","12:00"],["13:00","17:00"]]}},
 {id:"off",name:"Unavailable staff",active:false,serviceIds:["cut"],workingHours:{"2026-11-20":[["09:00","17:00"]]}}],
 appointments:[{staffId:"alex",date:"2026-11-20",start:"09:30",end:"10:00",status:"confirmed"},
 {staffId:"alex",date:"2026-11-20",start:"14:00",end:"15:00",status:"confirmed"}]
});
function minutes(v){if(typeof v!=="string"||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v))return NaN;
 const [h,m]=v.split(":").map(Number);return h*60+m;}
function clock(m){return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");}
function publishedServices(b){
 if(!b||b.published!==true||!Array.isArray(b.services))return [];
 return b.services.filter(s=>s&&s.published===true&&typeof s.id==="string"&&
 typeof s.name==="string"&&Number.isInteger(s.pricePence)&&s.pricePence>=0&&
 Number.isInteger(s.durationMinutes)&&s.durationMinutes>0&&s.durationMinutes<=480);
}
function availableSlots(b,{serviceId,staffId,date}={}){
 if(!b||b.published!==true||!/^\d{4}-\d{2}-\d{2}$/.test(date||""))return [];
 const s=publishedServices(b).find(x=>x.id===serviceId);
 const staff=Array.isArray(b.staff)?b.staff.find(x=>x.id===staffId&&x.active===true&&Array.isArray(x.serviceIds)&&x.serviceIds.includes(serviceId)):null;
 if(!s||!staff)return [];
 const hours=staff.workingHours&&staff.workingHours[date];
 if(!Array.isArray(hours))return [];
 const bookings=Array.isArray(b.appointments)?b.appointments.filter(x=>x.staffId===staffId&&x.date===date&&x.status!=="cancelled"):null;
 if(!bookings)return [];
 // Fail closed on malformed working hours or appointments, never guess availability.
 if(hours.some(h=>!Array.isArray(h)||h.length!==2||!Number.isFinite(minutes(h[0]))||
 !Number.isFinite(minutes(h[1]))||minutes(h[0])>=minutes(h[1])))return [];
 if(bookings.some(x=>!Number.isFinite(minutes(x.start))||!Number.isFinite(minutes(x.end))||minutes(x.start)>=minutes(x.end)))return [];
 const result=[];
 for(const [from,to] of hours){
  for(let start=minutes(from);start+s.durationMinutes<=minutes(to);start+=30){
   const end=start+s.durationMinutes;
   if(!bookings.some(x=>start<minutes(x.end)&&end>minutes(x.start)))result.push(clock(start));
  }
 }
 return [...new Set(result)].sort();
}
function review(b,{serviceId,staffId,date,time,customerName}={}){
 const service=publishedServices(b).find(x=>x.id===serviceId);
 const staff=Array.isArray(b&&b.staff)?b.staff.find(x=>x.id===staffId):null;
 if(!service||!staff||!availableSlots(b,{serviceId,staffId,date}).includes(time)||
 typeof customerName!=="string"||customerName.trim().length<2||customerName.trim().length>80)
 return Object.freeze({status:"INVALID_PREVIEW",bookingCreated:false});
 return Object.freeze({status:"PREVIEW_ONLY",bookingCreated:false,businessName:b.businessName,
 serviceName:service.name,staffName:staff.name,date,time,pricePence:service.pricePence,
 durationMinutes:service.durationMinutes,customerName:customerName.trim()});
}
const API={SAMPLE,publishedServices,availableSlots,review};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
if(typeof window!=="undefined")window.BoustioAvailabilityPreview=API;

})();
