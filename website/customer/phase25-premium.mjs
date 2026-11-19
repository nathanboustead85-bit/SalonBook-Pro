// Phase 25.7: ephemeral step-by-step premium preview, no real booking operations.
import {createBookingJourney} from "./phase25-journey.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export function createPremiumJourney(storage,owner){
 const journey=createBookingJourney(storage,owner);
 let step=1,serviceId=null,staffId=null,date=null,slot=null;
 function resetFrom(level){journey.clear();if(level<=1){serviceId=null;staffId=null;date=null;slot=null;}else if(level<=2){staffId=null;date=null;slot=null;}else if(level<=3){date=null;slot=null;}else if(level<=4){slot=null;}}
 function service(id){if(!journey.list().some(s=>s.id===id))throw Error("Unknown demonstration service");resetFrom(1);serviceId=id;step=2;return state();}
 function professional(id){if(!serviceId||!journey.professionals(serviceId).some(s=>s.id===id))throw Error("Professional unavailable");resetFrom(2);staffId=id;step=3;return state();}
 function day(value,nowDate="2026-11-19"){if(!staffId)throw Error("Select a professional");const result=journey.availability(value,serviceId,staffId,nowDate);resetFrom(3);date=value;step=4;return result;}
 function time(value,nowDate="2026-11-19"){if(!date)throw Error("Select a date");const summary=journey.choose({serviceId,staffId,date,time:value,nowDate});slot=value;step=5;return summary;}
 function back(){if(step>1){resetFrom(step-1);step--;}return state();}
 function clear(){resetFrom(1);step=1;return state();}
 function state(){return Object.freeze({step,serviceId,staffId,date,time:slot,summary:journey.review(),illustrative:true});}
 return Object.freeze({owner,service,professional,day,time,back,clear,state,services:journey.list,professionals:journey.professionals,get ready(){return journey.ready;},get canBook(){return false;},get canRegister(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
