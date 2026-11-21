"use strict";
// Phase 31.8: deterministic, offline-only conflict preview; no persistent reservation.
const {planValidatedSlots}=require("./offline-validation-31-7");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,slots:Object.freeze([])});
const minute=t=>typeof t==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
const dateOK=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
const idOK=x=>typeof x==="string"&&x.length>0&&x.length<=128;
function validateSnapshot(snapshot,base,now){
 if(!snapshot||snapshot.schemaVersion!==1||snapshot.businessId!==base.businessId||snapshot.slug!==base.slug||snapshot.revision!==base.revision||
 !Number.isSafeInteger(snapshot.version)||snapshot.version<0||!Number.isSafeInteger(snapshot.expiresAt)||now>snapshot.expiresAt||
 !Array.isArray(snapshot.appointments)||snapshot.appointments.length>5000)return null;
 const ids=new Set(),ranges=[];
 for(const a of snapshot.appointments){
  if(!a||!idOK(a.id)||ids.has(a.id)||!idOK(a.staffId)||!dateOK(a.date)||!Number.isInteger(a.durationMinutes)||a.durationMinutes<1||a.durationMinutes>480||
   !["confirmed","held","cancelled"].includes(a.status))return null;
  ids.add(a.id);
  const start=minute(a.start);if(!Number.isFinite(start)||start+a.durationMinutes>1440)return null;
  if(a.staffId===base.staffId&&a.date===base.date&&a.status!=="cancelled")ranges.push([start,start+a.durationMinutes]);
 }
 ranges.sort((a,b)=>a[0]-b[0]);
 if(ranges.some((r,i)=>i>0&&r[0]<ranges[i-1][1]))return null; // corrupted snapshot: fail closed
 return ranges;
}
function planConflictFreeSlots(display,schedule,blocked,snapshot,options={}){
 const base=planValidatedSlots(display,schedule,blocked,options);
 if(base.status!=="OFFLINE_VALIDATED_PREVIEW")return base;
 const ranges=validateSnapshot(snapshot,base,options.now);
 if(!ranges)return deny("invalid_or_stale_appointment_snapshot");
 const service=display.services.find(s=>s.id===base.serviceId);
 if(!service||!Number.isInteger(service.durationMinutes)||service.durationMinutes<1||service.durationMinutes>480)return deny("invalid_service_duration");
 const slots=base.slots.filter(t=>{const start=minute(t),end=start+service.durationMinutes;return !ranges.some(([a,b])=>start<b&&end>a)});
 return Object.freeze({...base,status:"OFFLINE_CONFLICT_PREVIEW",availabilityStatus:"UNVERIFIED_NOT_BOOKABLE",snapshotVersion:snapshot.version,bookingEnabled:false,slots:Object.freeze(slots)});
}
// Pure compare-and-swap simulation; the caller must use returned state on subsequent calls.
// This does NOT implement cross-device locking or atomic Firebase transactions.
function simulateAttempt(state,expectedVersion,request){
 if(!state||!Number.isSafeInteger(state.version)||!Array.isArray(state.reservations)||!Number.isSafeInteger(expectedVersion)||!request||
 !idOK(request.id)||!idOK(request.staffId)||!dateOK(request.date)||!Number.isInteger(request.durationMinutes)||request.durationMinutes<1||request.durationMinutes>480)
 return Object.freeze({accepted:false,reason:"invalid_request",state});
 if(expectedVersion!==state.version)return Object.freeze({accepted:false,reason:"stale_version",state});
 const start=minute(request.start),end=start+request.durationMinutes;
 if(!Number.isFinite(start)||end>1440||state.reservations.some(a=>a.id===request.id))return Object.freeze({accepted:false,reason:"invalid_or_duplicate",state});
 if(state.reservations.some(a=>a.staffId===request.staffId&&a.date===request.date&&start<minute(a.start)+a.durationMinutes&&end>minute(a.start)))
 return Object.freeze({accepted:false,reason:"conflict",state});
 const next=Object.freeze({version:state.version+1,reservations:Object.freeze([...state.reservations,Object.freeze({id:request.id,staffId:request.staffId,date:request.date,start:request.start,durationMinutes:request.durationMinutes})])});
 return Object.freeze({accepted:true,reason:"simulated_only",state:next});
}
module.exports=Object.freeze({planConflictFreeSlots,simulateAttempt});
