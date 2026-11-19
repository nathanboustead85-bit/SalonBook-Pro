// Phase 25.3 — synthetic existing appointment conflict filtering, no live writes.
import {createMatchingDemo} from "./phase25-matching.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const ownerOK=x=>typeof x==="string"&&/^demo-[a-z0-9-]{3,40}$/.test(x);
const dateOK=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"))&&new Date(x+"T12:00:00Z").toISOString().slice(0,10)===x;
const timeOK=x=>typeof x==="string"&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x);
const minutes=x=>Number(x.slice(0,2))*60+Number(x.slice(3));
const overlap=(a,b,c,d)=>a<d&&c<b;
export function createConflictPreview(storage,owner){
 if(!ownerOK(owner))throw Error("Synthetic owner required");
 if(!storage||!(typeof storage.getItem==="function"||typeof storage.get==="function"))throw Error("Local storage required");
 const matching=createMatchingDemo(storage,owner),key="boustio-phase25-3:"+owner;
 const read=()=>storage.getItem?storage.getItem(key):storage.get(key);
 const write=v=>storage.setItem?storage.setItem(key,v):storage.set(key,v);
 const remove=()=>storage.removeItem?storage.removeItem(key):storage.delete(key);
 let appointments=[];
 function validate(items){
  if(!Array.isArray(items)||items.length>100)throw Error("Invalid appointments");
  const seen=new Set();
  return items.map(a=>{
   if(!a||typeof a!=="object"||Array.isArray(a)||Object.keys(a).sort().join(",")!=="date,end,id,staffId,start"||
      typeof a.id!=="string"||!/^demo-appt-[a-z0-9-]{1,36}$/.test(a.id)||seen.has(a.id)||
      !dateOK(a.date)||!timeOK(a.start)||!timeOK(a.end)||minutes(a.end)<=minutes(a.start)||
      !matching.staff.some(s=>s.id===a.staffId))throw Error("Invalid appointment");
   seen.add(a.id);return {id:a.id,date:a.date,start:a.start,end:a.end,staffId:a.staffId};
  });
 }
 function add(a){appointments=validate([...appointments,a]);}
 function cancel(id){appointments=appointments.filter(a=>a.id!==id);}
 function save(){write(JSON.stringify({version:1,owner,appointments:validate(appointments)}));}
 function recover(){const raw=read();if(!raw)return false;const data=JSON.parse(raw);if(!data||data.version!==1||data.owner!==owner)throw Error("Owner mismatch");const next=validate(data.appointments);appointments=next;return true;}
 function clear(){remove();appointments=[];}
 function slots(date,serviceId,staffId,nowDate="2026-11-19"){
  // Never mutate appointments or source drafts; only filter explicit matching results.
  const base=matching.slots(date,serviceId,staffId,nowDate);
  return base.filter(s=>!appointments.some(a=>a.staffId===staffId&&a.date===date&&overlap(minutes(s.time),minutes(s.end),minutes(a.start),minutes(a.end))));
 }
 return Object.freeze({owner,add,cancel,save,recover,clear,slots,get appointments(){return appointments.map(a=>({...a}));},get services(){return matching.services;},get staff(){return matching.staff;},get matching(){return matching;},get canBook(){return false;},get canRegister(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
