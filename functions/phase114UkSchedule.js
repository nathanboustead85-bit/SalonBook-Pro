"use strict";
/** Phase 11.4: emulator-only UK schedule validation and Auth token verification. */
const {guard}=require("./phase113DemoBookingEngine");
const ZONE="Europe/London";
function localParts(ms){
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(new Date(ms));
 return Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
}
function localDay(ms){const p=localParts(ms);return p.year+"-"+p.month+"-"+p.day;}
function minute(p){return Number(p.hour)*60+Number(p.minute);}
function validateIntervals(list){return Array.isArray(list)&&list.every(i=>Array.isArray(i)&&i.length===2&&i.every(n=>Number.isInteger(n)&&n>=0&&n<=1440)&&i[0]<i[1]);}
function evaluateSchedule({startMs,durationMinutes,staff,closures=[]}){
 const endMs=startMs+durationMinutes*60000;
 if(!Number.isFinite(startMs)||!Number.isInteger(durationMinutes)||durationMinutes<=0)throw Error("invalid schedule request");
 const a=localParts(startMs),b=localParts(endMs-60000);
 if(localDay(startMs)!==localDay(endMs-60000))throw Error("cross-day booking");
 const day=localDay(startMs);
 if(!Array.isArray(closures)||closures.some(d=>typeof d!=="string"))throw Error("invalid closures");
 if(closures.includes(day)||staff.holidays?.includes(day))throw Error("business or staff holiday");
 const weekday=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(a.weekday);
 const hours=staff.weeklyHours?.[String(weekday)];
 if(!validateIntervals(hours)||!hours.length)throw Error("staff unavailable");
 const start=minute(a),end=minute(b)+1;
 if(end<=start)throw Error("DST fold or invalid local interval");
 if(!hours.some(([lo,hi])=>start>=lo&&end<=hi))throw Error("outside staff working hours");
 const breaks=staff.breaks?.[String(weekday)]||[];
 if(!validateIntervals(breaks))throw Error("invalid breaks");
 if(breaks.some(([lo,hi])=>start<hi&&end>lo))throw Error("staff break");
 // UTC interval must match wall-clock minutes, rejecting spring-forward gaps and autumn folds.
 if(end-start!==durationMinutes)throw Error("DST transition interval");
 return {localDay:day,startMinute:start,endMinute:end};
}
function createVerifiedCustomer({auth}={}){
 guard();
 if(!auth||typeof auth.verifyIdToken!=="function")throw Error("Auth emulator required");
 return async token=>{
  guard();
  if(typeof token!=="string"||!token)throw Error("missing customer token");
  const decoded=await auth.verifyIdToken(token,true);
  if(!decoded||!decoded.uid||decoded.email_verified!==true)throw Error("unverified customer");
  return {uid:decoded.uid,verified:true};
 };
}
module.exports={evaluateSchedule,createVerifiedCustomer,localDay};
