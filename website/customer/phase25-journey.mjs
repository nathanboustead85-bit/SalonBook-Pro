// Phase 25.6: in-memory synthetic selection and review; no reservation or customer data.
import {createReliabilityPreview} from "./phase25-reliability.mjs";
import {createMatchingDemo} from "./phase25-matching.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export function createBookingJourney(storage,owner){
 const availability=createReliabilityPreview(storage,owner);
 const matching=createMatchingDemo(storage,owner);
 try{matching.recover();}catch{}
 let selection=null;
 const list=()=>matching.services.map(s=>({id:s.id,name:s.name,pricePence:s.pricePence,durationMinutes:s.durationMinutes}));
 function professionals(serviceId){return matching.matches(serviceId);}
 function choose({serviceId,staffId,date,time,nowDate="2026-11-19"}){
  selection=null;
  if(!availability.ready)throw Error("Synthetic availability unavailable");
  const result=availability.inspect(date,serviceId,staffId,nowDate);
  const slot=result.slots.find(s=>s.time===time);
  if(!slot)throw Error("Illustrative time unavailable");
  const service=list().find(s=>s.id===serviceId),person=professionals(serviceId).find(s=>s.id===staffId);
  if(!service||!person)throw Error("Invalid selection");
  selection=Object.freeze({serviceId,staffId,date,time:slot.time,end:slot.end,serviceName:service.name,staffName:person.name,pricePence:service.pricePence,durationMinutes:service.durationMinutes,illustrative:true});
  return review();
 }
 function review(){return selection?Object.freeze({...selection,priceLabel:"£"+(selection.pricePence/100).toFixed(2),status:"DEMO ONLY — NOT BOOKED",canConfirm:false}):null;}
 function clear(){selection=null;}
 return Object.freeze({owner,list,professionals,availability:(date,serviceId,staffId,nowDate)=>availability.inspect(date,serviceId,staffId,nowDate),choose,review,clear,get ready(){return availability.ready;},get canBook(){return false;},get canRegister(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
