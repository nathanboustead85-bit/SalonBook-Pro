// Phase 25.10: integration facade for synthetic customer journey only.
// No production Firebase calls, no bookings, no payments, no publication.
import {createAccessibleJourney} from "./phase25-accessible.mjs";
export const LIVE=Object.freeze({bookings:false,registration:false,payments:false,publishing:false});
export function createIntegratedJourney(storage,owner){
 const base=createAccessibleJourney(storage,owner);
 return Object.freeze({
  owner,services:()=>base.services(),professionals:id=>base.professionals(id),
  service:id=>base.service(id),professional:id=>base.professional(id),
  day:(date,nowDate)=>base.day(date,nowDate),
  time:(value,nowDate)=>base.time(value,nowDate),
  back:()=>base.back(),clear:()=>base.clear(),state:()=>base.state(),
  get ready(){return base.ready;},
  get canBook(){return false;},get canRegister(){return false;},
  get canPay(){return false;},get canPublish(){return false;}
 });
}
