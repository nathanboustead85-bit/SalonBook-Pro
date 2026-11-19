// Phase 25.1: synthetic read-only availability preview, never a reservation system.
import {createProfileDemo} from "../business/onboarding/phase24-profile.mjs";
import {createServicesDemo} from "../business/onboarding/phase24-services.mjs";
import {createStaffScheduleDemo} from "../business/onboarding/phase24-staff.mjs";
import {createPoliciesDemo} from "../business/onboarding/phase24-policies.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const DAYS=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const pad=n=>String(n).padStart(2,"0");
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const time=m=>pad(Math.floor(m/60))+":"+pad(m%60);
const dateOK=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
function safeLoad(module){try{return module.load();}catch{return false;}}
export function createAvailabilityPreview(storage,owner){
 if(typeof owner!=="string"||!/^demo-[a-z0-9-]{3,40}$/.test(owner))throw Error("Synthetic owner required");
 if(!storage||!(typeof storage.getItem==="function"||typeof storage.get==="function"))throw Error("Local storage required");
 const profile=createProfileDemo(storage,owner),services=createServicesDemo(storage,owner),staff=createStaffScheduleDemo(storage,owner),policies=createPoliciesDemo(storage,owner);
 const loaded={profile:safeLoad(profile),services:safeLoad(services),staff:safeLoad(staff),policies:safeLoad(policies)};
 function catalogue(){return loaded.services?services.state.services.map(s=>({id:s.id,name:s.name,category:s.category,pricePence:s.pricePence,durationMinutes:s.durationMinutes})):[];}
 function slots(date,serviceId,staffId,nowDate="2026-11-19"){
  if(!dateOK(date)||!dateOK(nowDate))throw Error("Invalid date");
  const menu=catalogue(),service=menu.find(s=>s.id===serviceId);
  if(!service)throw Error("Unknown synthetic service");
  if(!loaded.profile||!loaded.staff||!loaded.policies)return [];
  const people=staff.state.staff,person=people.find(s=>s.id===staffId);
  if(!person)throw Error("Unknown synthetic professional");
  const daysAhead=Math.round((Date.parse(date+"T12:00:00Z")-Date.parse(nowDate+"T12:00:00Z"))/86400000);
  const policy=policies.state;
  if(daysAhead<1||daysAhead>policy.maximumAdvanceDays)return [];
  const weekday=DAYS[new Date(date+"T12:00:00Z").getUTCDay()];
  const business=profile.profile.hours[weekday],working=person.hours[weekday];
  if(!business||business.closed||!working||working.off)return [];
  // Phase 24.4 and 24.5 use independent service identifiers. No matching is assumed.
  // The preview is a general availability illustration, NOT a verified staff/service assignment.
  const start=Math.max(minutes(business.open),minutes(working.start)),end=Math.min(minutes(business.close),minutes(working.end));
  const length=service.durationMinutes+policy.bufferBeforeMinutes+policy.bufferAfterMinutes;
  if(length<=0)return [];
  const result=[];
  for(let cursor=Math.ceil(start/15)*15;cursor+length<=end&&result.length<60;cursor+=15){
   const finish=cursor+length;
   if(working.breaks.some(b=>cursor<minutes(b.end)&&finish>minutes(b.start)))continue;
   result.push({time:time(cursor+policy.bufferBeforeMinutes),end:time(cursor+policy.bufferBeforeMinutes+service.durationMinutes),staffName:person.name,serviceName:service.name,pricePence:service.pricePence,illustrative:true});
  }
  return result;
 }
 return Object.freeze({owner,catalogue,slots,get ready(){return Object.values(loaded).every(Boolean);},get canBook(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
