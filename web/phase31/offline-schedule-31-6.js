"use strict";
// Phase 31.6: pure offline planning, NOT live availability. No appointment inputs.
// Trusted caller supplies a Phase 31.3 validated read-only display and separate
// owner-authorized staging schedule. Never infer working hours from public profile.
function minute(t){if(typeof t!=="string"||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))return NaN;const [h,m]=t.split(":").map(Number);return h*60+m;}
function clock(n){return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");}
function dateValid(s){if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,slots:Object.freeze([])});
function intervals(v){if(!Array.isArray(v)||v.length>8)return null;const a=v.map(p=>Array.isArray(p)&&p.length===2?[minute(p[0]),minute(p[1])]:[NaN,NaN]);if(a.some(([x,y])=>!Number.isFinite(x)||!Number.isFinite(y)||x>=y))return null;a.sort((x,y)=>x[0]-y[0]);if(a.some((p,i)=>i>0&&p[0]<a[i-1][1]))return null;return a;}
function planSlots(display,schedule,{businessId,slug,serviceId,staffId,date,now,stepMinutes=15}={}){
 if(!display||display.status!=="FRESH_READ_ONLY"||display.bookingEnabled!==false||
 !Number.isSafeInteger(now)||now<0||!Number.isSafeInteger(display.expiresAt)||now>display.expiresAt||
 display.businessId!==businessId||display.slug!==slug)return deny("invalid_or_expired_display");
 if(!schedule||schedule.schemaVersion!==1||schedule.businessId!==businessId||schedule.slug!==slug||
 schedule.revision!==display.revision||!dateValid(date)||!Number.isInteger(stepMinutes)||
 stepMinutes<5||stepMinutes>60||60%stepMinutes!==0)return deny("invalid_schedule");
 const service=Array.isArray(display.services)?display.services.find(s=>s.id===serviceId):null;
 const staff=Array.isArray(display.staff)?display.staff.find(s=>s.id===staffId&&s.serviceIds.includes(serviceId)):null;
 if(!service||!staff||!Number.isInteger(service.durationMinutes)||service.durationMinutes<1||
 service.durationMinutes>480)return deny("invalid_selection");
 if(!schedule.openingHours||!schedule.staffHours||typeof schedule.openingHours!=="object"||
 typeof schedule.staffHours!=="object"||!Object.hasOwn(schedule.openingHours,date)||
 !Object.hasOwn(schedule.staffHours,staffId)||!Object.hasOwn(schedule.staffHours[staffId],date))return deny("missing_hours");
 const business=intervals(schedule.openingHours[date]),person=intervals(schedule.staffHours[staffId][date]);
 if(!business||!person)return deny("malformed_hours");
 const slots=[];
 for(const [s,e] of person)for(const [b,c] of business){
  const start=Math.ceil(Math.max(s,b)/stepMinutes)*stepMinutes,finish=Math.min(e,c);
  for(let m=start;m+service.durationMinutes<=finish;m+=stepMinutes)slots.push(clock(m));
 }
 return Object.freeze({status:"OFFLINE_SCHEDULE_PREVIEW",bookingEnabled:false,availabilityStatus:"UNVERIFIED_NO_APPOINTMENT_CONFLICTS",
  businessId,slug,serviceId,staffId,date,revision:display.revision,slots:Object.freeze([...new Set(slots)].sort())});
}
module.exports=Object.freeze({planSlots});
