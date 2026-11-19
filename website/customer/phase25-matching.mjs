// Phase 25.2: synthetic explicit mapping between independent Phase 24 service/staff IDs.
import {createServicesDemo} from "../business/onboarding/phase24-services.mjs";
import {createStaffScheduleDemo} from "../business/onboarding/phase24-staff.mjs";
import {createAvailabilityPreview} from "./phase25-availability.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const ownerOK=x=>typeof x==="string"&&/^demo-[a-z0-9-]{3,40}$/.test(x);
const sid=x=>typeof x==="string"&&/^item-[a-z0-9-]{1,40}$/.test(x);
const pid=x=>typeof x==="string"&&/^staff-[1-9]\d{0,4}$/.test(x);
export function createMatchingDemo(storage,owner){
 if(!ownerOK(owner))throw Error("Synthetic owner required");
 if(!storage||!(typeof storage.getItem==="function"||typeof storage.get==="function"))throw Error("Local storage required");
 const key="boustio-phase25-2:"+owner;
 const services=createServicesDemo(storage,owner),staff=createStaffScheduleDemo(storage,owner),availability=createAvailabilityPreview(storage,owner);
 let validServices=false,validStaff=false,assignments=[];
 try{validServices=services.load();}catch{}
 try{validStaff=staff.load();}catch{}
 const get=()=>storage.getItem?storage.getItem(key):storage.get(key);
 const set=v=>storage.setItem?storage.setItem(key,v):storage.set(key,v);
 const del=()=>storage.removeItem?storage.removeItem(key):storage.delete(key);
 const availableServices=()=>validServices?services.state.services:[];
 const availableStaff=()=>validStaff?staff.state.staff:[];
 function validate(pairs){
  if(!Array.isArray(pairs)||pairs.length>100)throw Error("Invalid assignments");
  const seen=new Set();
  return pairs.map(pair=>{
   if(!pair||typeof pair!=="object"||Object.keys(pair).sort().join(",")!=="serviceId,staffId"||!sid(pair.serviceId)||!pid(pair.staffId)||!availableServices().some(s=>s.id===pair.serviceId)||!availableStaff().some(s=>s.id===pair.staffId))throw Error("Invalid assignment");
   const token=pair.serviceId+":"+pair.staffId;
   if(seen.has(token))throw Error("Duplicate assignment");
   seen.add(token);return {serviceId:pair.serviceId,staffId:pair.staffId};
  });
 }
 function recover(){const raw=get();if(!raw)return false;const data=JSON.parse(raw);if(data.version!==1||data.owner!==owner)throw Error("Owner mismatch");const next=validate(data.assignments);assignments=next;return true;}
 function assign(serviceId,staffId){assignments=validate([...assignments,{serviceId,staffId}]);}
 function unassign(serviceId,staffId){assignments=assignments.filter(x=>x.serviceId!==serviceId||x.staffId!==staffId);}
 function save(){if(!validServices||!validStaff)throw Error("Missing synthetic source drafts");set(JSON.stringify({version:1,owner,assignments:validate(assignments)}));}
 function clear(){del();assignments=[];}
 function matches(serviceId){if(!sid(serviceId)||!availableServices().some(s=>s.id===serviceId))throw Error("Unknown service");return availableStaff().filter(s=>assignments.some(a=>a.serviceId===serviceId&&a.staffId===s.id)).map(s=>({id:s.id,name:s.name,role:s.role}));}
 function slots(date,serviceId,staffId,nowDate="2026-11-19"){if(!assignments.some(a=>a.serviceId===serviceId&&a.staffId===staffId))return [];return availability.slots(date,serviceId,staffId,nowDate);}
 return Object.freeze({owner,assign,unassign,save,recover,clear,matches,slots,get assignments(){return assignments.map(a=>({...a}));},get services(){return availableServices().map(s=>({...s}));},get staff(){return availableStaff().map(s=>({id:s.id,name:s.name,role:s.role}));},get ready(){return validServices&&validStaff&&availability.ready;},get canBook(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
