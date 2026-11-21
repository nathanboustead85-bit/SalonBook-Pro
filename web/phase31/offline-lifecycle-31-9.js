"use strict";
// Phase 31.9: offline-only immutable lifecycle simulation; never writes bookings.
const {simulateAttempt}=require("./offline-conflicts-31-8");
const dateOK=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
const minute=t=>typeof t==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
const idOK=x=>typeof x==="string"&&x.length>0&&x.length<=128;
const reject=(state,reason)=>Object.freeze({accepted:false,reason,state});
function validState(state){
 if(!state||!Number.isSafeInteger(state.version)||state.version<0||!Array.isArray(state.reservations)||state.reservations.length>5000)return false;
 const ids=new Set(),active=[];
 for(const a of state.reservations){
  if(!a||!idOK(a.id)||ids.has(a.id)||!idOK(a.staffId)||!dateOK(a.date)||!Number.isInteger(a.durationMinutes)||a.durationMinutes<1||a.durationMinutes>480||
   !["confirmed","cancelled"].includes(a.status)||!Number.isFinite(minute(a.start))||minute(a.start)+a.durationMinutes>1440)return false;
  ids.add(a.id);
  if(a.status==="confirmed")active.push(a);
 }
 return !active.some((a,i)=>active.slice(i+1).some(b=>a.staffId===b.staffId&&a.date===b.date&&minute(a.start)<minute(b.start)+b.durationMinutes&&minute(a.start)+a.durationMinutes>minute(b.start)));
}
function applyChange(state,expectedVersion,change){
 if(!validState(state))return reject(state,"invalid_state");
 if(!Number.isSafeInteger(expectedVersion)||expectedVersion!==state.version)return reject(state,"stale_version");
 if(!change||!idOK(change.id)||!["cancel","reschedule"].includes(change.type))return reject(state,"invalid_change");
 const index=state.reservations.findIndex(a=>a.id===change.id);
 if(index<0)return reject(state,"not_found");
 const previous=state.reservations[index];
 if(previous.status==="cancelled")return reject(state,"already_cancelled");
 let nextEntry;
 if(change.type==="cancel")nextEntry={...previous,status:"cancelled"};
 else{
  const next=change.target;
  if(!next||!idOK(next.staffId)||!dateOK(next.date)||!Number.isInteger(next.durationMinutes)||next.durationMinutes<1||next.durationMinutes>480||
   !Number.isFinite(minute(next.start))||minute(next.start)+next.durationMinutes>1440)return reject(state,"invalid_target");
  nextEntry={...previous,staffId:next.staffId,date:next.date,start:next.start,durationMinutes:next.durationMinutes};
 }
 const reservations=state.reservations.map((a,i)=>Object.freeze(i===index?nextEntry:{...a}));
 const candidate={version:state.version+1,reservations};
 if(!validState(candidate))return reject(state,"conflict");
 const nextState=Object.freeze({version:candidate.version,reservations:Object.freeze(reservations)});
 return Object.freeze({accepted:true,reason:"simulated_only",state:nextState});
}
// Recovery is explicit: only a trusted, current snapshot may be used. Never replay a
// pending change automatically. The caller must inspect/revalidate and submit anew.
function recoverInterruptedAttempt(state,pending,now){
 if(!validState(state)||!pending||!Number.isSafeInteger(now)||!Number.isSafeInteger(pending.expectedVersion)||
 !Number.isSafeInteger(pending.expiresAt)||!idOK(pending.operationId))return reject(state,"invalid_recovery");
 if(now>pending.expiresAt)return reject(state,"expired_attempt");
 if(pending.expectedVersion!==state.version)return reject(state,"stale_version");
 return Object.freeze({accepted:false,reason:"manual_revalidation_required",state});
}
module.exports=Object.freeze({applyChange,recoverInterruptedAttempt,validState});
