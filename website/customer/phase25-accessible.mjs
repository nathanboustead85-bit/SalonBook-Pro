// Phase 25.9: accessible, synthetic-only facade. Never writes or books.
import {createRefinedJourney} from "./phase25-refined.mjs";
export const LIVE=Object.freeze({bookings:false,registration:false,payments:false,publishing:false});
export function createAccessibleJourney(storage,owner){
 const base=createRefinedJourney(storage,owner);
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
