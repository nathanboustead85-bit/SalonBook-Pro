"use strict";
// Synthetic calendar only. Never reads or writes live bookings.
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BoustioPhase1252=api;})(typeof window!=="undefined"?window:null,function(){
 const maxAdvanceDays=60,services=[{id:"cut",name:"Haircut",pricePence:2000,durationMinutes:30},{id:"colour",name:"Cut & colour",pricePence:5500,durationMinutes:90}],staff=[{id:"alex",name:"Alex"},{id:"sam",name:"Sam"}];
 const parse=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+"T12:00:00Z"))&&new Date(s+"T12:00:00Z").toISOString().slice(0,10)===s?new Date(s+"T12:00:00Z"):null;
 const iso=d=>d.toISOString().slice(0,10);
 const plus=(s,n)=>{const d=parse(s);if(!d)return null;d.setUTCDate(d.getUTCDate()+n);return iso(d)};
 const dayDifference=(a,b)=>{const x=parse(a),y=parse(b);return x&&y?Math.round((x-y)/86400000):NaN};
 function available(date,{today,serviceId="cut",staffId="any",advanceDays=maxAdvanceDays}={}){
  const d=parse(date),base=parse(today);
  if(!d||!base||!Number.isInteger(advanceDays)||advanceDays<0||advanceDays>365)return false;
  const diff=dayDifference(date,today),dow=d.getUTCDay();
  if(diff<0||diff>advanceDays||dow===0)return false;
  if(!services.some(s=>s.id===serviceId)||!["any","alex","sam"].includes(staffId))return false;
  return !(serviceId==="colour"&&staffId==="alex");
 }
 function slots({date,today,serviceId="cut",staffId="any",advanceDays=maxAdvanceDays}={}){
  if(!available(date,{today,serviceId,staffId,advanceDays}))return [];
  const d=parse(date),dow=d.getUTCDay();
  const members=staffId==="any"?(serviceId==="colour"?["sam"]:["alex","sam"]):[staffId];
  return members.flatMap(id=>(id==="alex"?["09:00","10:30","11:30"]:["09:30","11:00","14:00"]).filter(t=>dow!==6||t<"12:00").map(time=>({time,staffId:id,staffName:id==="alex"?"Alex":"Sam"}))).sort((a,b)=>a.time.localeCompare(b.time)||a.staffId.localeCompare(b.staffId));
 }
 function month(year,monthIndex,{today,serviceId="cut",staffId="any",advanceDays=maxAdvanceDays}={}){
  if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(monthIndex)||monthIndex<0||monthIndex>11)return [];
  const n=new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();
  return Array.from({length:n},(_,i)=>{const date=iso(new Date(Date.UTC(year,monthIndex,i+1)));return {date,day:i+1,enabled:available(date,{today,serviceId,staffId,advanceDays})}});
 }
 function review({date,today,serviceId,staffId,time,advanceDays=maxAdvanceDays}={}){
  const service=services.find(s=>s.id===serviceId),slot=slots({date,today,serviceId,staffId,advanceDays}).find(s=>s.time===time&&s.staffId===staffId);
  if(!service||!slot)return {status:"UNAVAILABLE",bookingEnabled:false};
  return {status:"NOT_BOOKED",bookingEnabled:false,date,time,serviceName:service.name,pricePence:service.pricePence,staffName:slot.staffName};
 }
 return {maxAdvanceDays,services,staff,parse,iso,plus,available,slots,month,review};
});
