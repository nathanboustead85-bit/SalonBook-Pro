"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.BoustioPhase29Hours=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
const DAYS=Object.freeze(["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]);
function day(open=false,start="09:00",end="17:00"){return {open,start,end};}
function defaults(){return {business:DAYS.map((_,i)=>day(i<5)),staff:{}};}
function validTime(t){return typeof t==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);}
function minutes(t){return validTime(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):null;}
function validDay(d){return !!d&&typeof d.open==="boolean"&&(!d.open||(validTime(d.start)&&validTime(d.end)&&minutes(d.start)<minutes(d.end)));}
function withinBusiness(staff,business){return !staff.open||(business.open&&minutes(staff.start)>=minutes(business.start)&&minutes(staff.end)<=minutes(business.end));}
function validate(schedule,staffIds=[]){const errors=[];if(!schedule||!Array.isArray(schedule.business)||schedule.business.length!==7||schedule.business.some(d=>!validDay(d)))errors.push("INVALID_BUSINESS_HOURS");
const ids=new Set(staffIds);if(!schedule||!schedule.staff||typeof schedule.staff!=="object"||Array.isArray(schedule.staff))errors.push("INVALID_STAFF_HOURS");
else {for(const id of Object.keys(schedule.staff)){if(!ids.has(id))errors.push("UNKNOWN_STAFF_HOURS");const days=schedule.staff[id];if(!Array.isArray(days)||days.length!==7||days.some((d,i)=>!validDay(d)||!schedule.business||!schedule.business[i]||!withinBusiness(d,schedule.business[i])))errors.push("INVALID_STAFF_HOURS");}}
return {ok:errors.length===0,errors:[...new Set(errors)]};}
function ensureStaff(schedule,id){if(!schedule.staff[id])schedule.staff[id]=schedule.business.map(d=>({...d}));return schedule.staff[id];}
function pruneStaff(schedule,ids){const allowed=new Set(ids);for(const id of Object.keys(schedule.staff))if(!allowed.has(id))delete schedule.staff[id];}
function describe(days){return DAYS.map((name,i)=>({name,hours:days[i]&&days[i].open?days[i].start+"–"+days[i].end:"Closed"}));}
return Object.freeze({DAYS,defaults,day,validTime,minutes,validDay,withinBusiness,validate,ensureStaff,pruneStaff,describe});});