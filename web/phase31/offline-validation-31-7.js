"use strict";
// Phase 31.7: isolated offline slot filtering. Never represents live bookable availability.
const {planSlots}=require("./offline-schedule-31-6");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,slots:Object.freeze([])});
const minute=t=>typeof t==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
const validDate=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
function ranges(v){if(!Array.isArray(v)||v.length>100)return null;const out=v.map(p=>Array.isArray(p)&&p.length===2?[minute(p[0]),minute(p[1])]:[NaN,NaN]);if(out.some(([a,b])=>!Number.isFinite(a)||!Number.isFinite(b)||a>=b))return null;out.sort((a,b)=>a[0]-b[0]);if(out.some((x,i)=>i&&x[0]<out[i-1][1]))return null;return out;}
function validateBlocked(blocked,staffId,date){
 if(!blocked||blocked.schemaVersion!==1||!blocked.staff||typeof blocked.staff!=="object"||Array.isArray(blocked.staff))return null;
 if(!Object.hasOwn(blocked.staff,staffId))return null;
 const person=blocked.staff[staffId];
 if(!person||typeof person!=="object"||Array.isArray(person)||!Array.isArray(person.daysOff)||!Array.isArray(person.holidays)||!person.breaks||typeof person.breaks!=="object"||Array.isArray(person.breaks))return null;
 if(person.daysOff.length>366||person.holidays.length>366||person.daysOff.some(x=>!validDate(x))||person.holidays.some(x=>!validDate(x)))return null;
 if(!Object.hasOwn(person.breaks,date))return null;
 const breaks=ranges(person.breaks[date]);if(!breaks)return null;
 return {closed:person.daysOff.includes(date)||person.holidays.includes(date),breaks};
}
function planValidatedSlots(display,schedule,blocked,options={}){
 const base=planSlots(display,schedule,options);
 if(base.status!=="OFFLINE_SCHEDULE_PREVIEW")return base;
 if(!blocked||blocked.businessId!==base.businessId||blocked.slug!==base.slug||blocked.revision!==base.revision)return deny("invalid_blocked_schedule");
 const exclusions=validateBlocked(blocked,base.staffId,base.date);
 if(!exclusions)return deny("invalid_staff_exclusions");
 const service=display.services.find(s=>s.id===base.serviceId);
 if(!service||!Number.isInteger(service.durationMinutes)||service.durationMinutes<1)return deny("invalid_duration");
 const slots=exclusions.closed?[]:base.slots.filter(t=>{
  const start=minute(t),end=start+service.durationMinutes;
  return !exclusions.breaks.some(([a,b])=>start<b&&end>a);
 });
 return Object.freeze({...base,status:"OFFLINE_VALIDATED_PREVIEW",availabilityStatus:"UNVERIFIED_NO_APPOINTMENT_CONFLICTS",bookingEnabled:false,slots:Object.freeze(slots)});
}
module.exports=Object.freeze({planValidatedSlots});
