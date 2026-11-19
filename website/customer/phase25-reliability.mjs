// Phase 25.5 — deterministic, read-only synthetic availability reliability checks.
import {createBufferedConflictPreview} from "./phase25-buffer-conflicts.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const clock=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const validDate=d=>typeof d==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T12:00:00Z"))&&new Date(d+"T12:00:00Z").toISOString().slice(0,10)===d;
export function createReliabilityPreview(storage,owner){
 const engine=createBufferedConflictPreview(storage,owner);
 function inspect(date,serviceId,staffId,nowDate="2026-11-19"){
  if(!validDate(date)||!validDate(nowDate))throw Error("Invalid demonstration date");
  if(!engine.ready)return Object.freeze({status:"unavailable",reason:"Synthetic drafts missing or invalid",slots:[],count:0,illustrative:true});
  const service=engine.services.find(s=>s.id===serviceId),person=engine.staff.find(s=>s.id===staffId);
  if(!service||!person)throw Error("Unknown synthetic service or professional");
  if(!engine.matching.matches(serviceId).some(s=>s.id===staffId))return Object.freeze({status:"unavailable",reason:"Professional not assigned",slots:[],count:0,illustrative:true});
  const slots=engine.slots(date,serviceId,staffId,nowDate);
  // Defence in depth: reject malformed, duplicate, unordered, out-of-bounds and overlapping candidate data.
  const seen=new Set();let previous=-1;
  for(const s of slots){
   if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end))throw Error("Invalid illustrative slot");
   const start=clock(s.time),end=clock(s.end);
   if(start>=end||start<previous||seen.has(s.time)||s.illustrative!==true)throw Error("Unsafe illustrative slot");
   previous=start;seen.add(s.time);
  }
  return Object.freeze({status:slots.length?"illustrative":"unavailable",reason:slots.length?"Synthetic preview only":"No illustrative times",slots:slots.map(s=>Object.freeze({...s})),count:slots.length,illustrative:true});
 }
 return Object.freeze({owner,inspect,get ready(){return engine.ready;},get canBook(){return false;},get canRegister(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
