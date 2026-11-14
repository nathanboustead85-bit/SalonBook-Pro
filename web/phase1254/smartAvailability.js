(function(){
"use strict";
// Phase 12.53: pure, fictional owner-side availability. No network, production data or booking writes.
const {availableSlots}=typeof module!=="undefined"&&module.exports?require("./availabilityPreview"):window.BoustioAvailabilityPreview;
const clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const validDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const minutes=s=>clock.test(s||"")?Number(s.slice(0,2))*60+Number(s.slice(3)):NaN;
const fmt=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
const days=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function calculate({date,serviceId,staffId="any",today,advanceDays=60,profile}={}){
 const fail=()=>Object.freeze({status:"UNAVAILABLE",bookingEnabled:false,slots:[]});
 if(!validDate(date)||!validDate(today)||!Number.isInteger(advanceDays)||advanceDays<0||advanceDays>365||!profile||profile.published!==true)return fail();
 const diff=(Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000;
 if(diff<0||diff>advanceDays||!Array.isArray(profile.services)||!Array.isArray(profile.staff)||!Array.isArray(profile.appointments))return fail();
 if(profile.services.length>200||profile.staff.length>100||profile.appointments.length>10000)return fail();
 const service=profile.services.find(s=>s&&s.id===serviceId&&s.published===true&&Number.isInteger(s.durationMinutes)&&s.durationMinutes>0&&s.durationMinutes<=480);
 if(!service)return fail();
 const day=days[new Date(date+"T00:00:00Z").getUTCDay()];
 const people=profile.staff.filter(s=>s&&s.active===true&&Array.isArray(s.serviceIds)&&s.serviceIds.includes(serviceId)&&(staffId==="any"||s.id===staffId));
 if(!people.length)return fail();
 const slots=[];
 for(const person of people){
  if(!person.weeklySchedule||typeof person.weeklySchedule!=="object"||!Array.isArray(person.breaks)||!Array.isArray(person.timeOff))return fail();
  const period=person.weeklySchedule[day];if(period===null||period===undefined)continue;
  if(!period||!Number.isFinite(minutes(period.open))||!Number.isFinite(minutes(period.close))||minutes(period.open)>=minutes(period.close))return fail();
  let intervals=[[minutes(period.open),minutes(period.close)]];
  const blocked=[...person.breaks.filter(x=>x&&x.day===day),...person.timeOff.filter(x=>x&&x.date===date)];
  for(const block of blocked){
   const a=minutes(block.start),z=minutes(block.end);if(!Number.isFinite(a)||!Number.isFinite(z)||a>=z)return fail();
   intervals=intervals.flatMap(([start,end])=>z<=start||a>=end?[[start,end]]:[[start,Math.min(end,a)],[Math.max(start,z),end]].filter(([u,v])=>u<v));
  }
  const hours=intervals.map(([a,z])=>[fmt(a),fmt(z)]);
  const sample={published:true,services:[service],staff:[{id:person.id,active:true,serviceIds:person.serviceIds,workingHours:{[date]:hours}}],appointments:profile.appointments};
  const times=availableSlots(sample,{date,serviceId,staffId:person.id});
  for(const time of times)slots.push({time,staffId:person.id,staffName:person.name});
 }
 slots.sort((a,b)=>a.time.localeCompare(b.time)||a.staffId.localeCompare(b.staffId));
 return Object.freeze({status:"SYNTHETIC_PREVIEW",bookingEnabled:false,slots});
}
function demoProfile(){
 return {published:true,services:[{id:"cut",name:"Haircut",published:true,pricePence:2000,durationMinutes:30},{id:"colour",name:"Cut & colour",published:true,pricePence:5500,durationMinutes:90}],staff:[
 {id:"alex",name:"Alex",active:true,serviceIds:["cut"],weeklySchedule:Object.fromEntries(["monday","tuesday","wednesday","thursday","friday","saturday"].map(day=>[day,{open:"09:00",close:day==="saturday"?"13:00":"17:00"}])),breaks:[{day:"friday",start:"12:00",end:"13:00"}],timeOff:[{date:"2026-11-23",start:"09:00",end:"17:00"}]},
 {id:"sam",name:"Sam",active:true,serviceIds:["cut","colour"],weeklySchedule:Object.fromEntries(["monday","tuesday","wednesday","thursday","friday"].map(day=>[day,{open:"10:00",close:"18:00"}])),breaks:[{day:"friday",start:"13:00",end:"14:00"}],timeOff:[]}
 ],appointments:[{staffId:"alex",date:"2026-11-20",start:"09:30",end:"10:00",status:"confirmed"},{staffId:"sam",date:"2026-11-20",start:"11:00",end:"12:00",status:"confirmed"}]};
}
const API={calculate,demoProfile};if(typeof module!=="undefined"&&module.exports)module.exports=API;if(typeof window!=="undefined")window.BoustioPhase1254=API;

})();
