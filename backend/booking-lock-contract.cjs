"use strict";
// Pure transaction planning helpers. Not a live endpoint.
const crypto=require("node:crypto");
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
function locks(staffId,date,start,end){
 if(!id(staffId)||typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||start>=end||start%15!==0)throw Error("Invalid interval");
 const d=new Date(date+"T12:00:00Z");if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==date)throw Error("Invalid date");
 const out=[];for(let m=start;m<end;m+=15)out.push(staffId+"_"+date+"_"+String(Math.floor(m/60)).padStart(2,"0")+String(m%60).padStart(2,"0"));return out;
}
function requestKey(businessId,actorId,key){
 if(![businessId,actorId,key].every(id))throw Error("Invalid identity or key");
 return crypto.createHash("sha256").update(JSON.stringify([businessId,actorId,key])).digest("hex");
}
function plan({appointmentId,oldLocks=[],newLocks=[],occupancy}){
 if(!id(appointmentId)||!Array.isArray(oldLocks)||!Array.isArray(newLocks)||!(occupancy instanceof Map))throw Error("Invalid plan");
 for(const k of new Set([...oldLocks,...newLocks]))if(!occupancy.has(k))throw Error("Missing transaction read");
 for(const k of oldLocks)if(occupancy.get(k)!==appointmentId)throw Error("Existing lock mismatch");
 for(const k of newLocks)if(occupancy.get(k)!==null&&!(oldLocks.includes(k)&&occupancy.get(k)===appointmentId))throw Error("Occupied");
 return {release:[...new Set(oldLocks)].filter(k=>!newLocks.includes(k)),acquire:[...new Set(newLocks)].filter(k=>!oldLocks.includes(k))};
}
module.exports={locks,requestKey,plan};
