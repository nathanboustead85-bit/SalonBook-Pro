// Phase 25.8: presentation-only enrichment of synthetic premium journey.
import {createPremiumJourney} from "./phase25-premium.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export function createRefinedJourney(storage,owner){
 const base=createPremiumJourney(storage,owner);
 return Object.freeze({
  owner,
  services:()=>base.services().map(s=>Object.freeze({...s,category:s.category||"Haircuts"})),
  professionals:id=>base.professionals(id).map(p=>Object.freeze({...p,role:p.role||"Professional"})),
  service:id=>base.service(id),professional:id=>base.professional(id),
  day:(date,nowDate)=>base.day(date,nowDate),
  time:(value,nowDate)=>base.time(value,nowDate),
  back:()=>base.back(),clear:()=>base.clear(),state:()=>base.state(),
  get ready(){return base.ready;},
  get canBook(){return false;},get canRegister(){return false;},
  get canPay(){return false;},get canPublish(){return false;}
 });
}
