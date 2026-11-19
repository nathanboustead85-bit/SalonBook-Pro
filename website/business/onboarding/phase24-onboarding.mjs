// Phase 24.9 — local-only synthetic onboarding integration; never production.
import {createDashboardDemo,SECTIONS} from "./phase24-dashboard.mjs";
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const LABELS=Object.freeze({profile:"Business profile",services:"Services and pricing",staff:"Staff and schedules",branding:"Brand identity",preferences:"Booking preferences"});
export function createOnboardingDemo(storage,owner){
 if(typeof owner!=="string"||!/^demo-[a-z0-9-]{3,40}$/.test(owner))throw Error("Synthetic owner required");
 if(!storage||!(typeof storage.getItem==="function"||typeof storage.get==="function"))throw Error("Local storage required");
 const key="boustio-phase24-9:"+owner,dashboard=createDashboardDemo(storage,owner);
 const read=()=>storage.getItem?storage.getItem(key):storage.get(key),write=v=>storage.setItem?storage.setItem(key,v):storage.set(key,v),remove=()=>storage.removeItem?storage.removeItem(key):storage.delete(key);
 let active="profile",navigationError=null;
 function restoreNavigation(){const raw=read();if(!raw)return false;try{const parsed=JSON.parse(raw);if(parsed.version!==1||parsed.owner!==owner||!SECTIONS.includes(parsed.active))throw Error("Invalid saved navigation");active=parsed.active;navigationError=null;return true;}catch{navigationError="Invalid saved navigation";return false;}}
 function navigate(section){if(!SECTIONS.includes(section))throw Error("Unknown setup section");active=section;write(JSON.stringify({version:1,owner,active}));navigationError=null;return active;}
 function refresh(){dashboard.recover();return snapshot();}
 function snapshot(){const d=dashboard.snapshot(),steps=SECTIONS.map(id=>{const card=d.cards[id];const saved=card.status==="saved",invalid=card.status==="invalid draft";const ready=saved&&(id==="profile"?d.profileCompleteness.complete:id==="services"?d.serviceCount>0:id==="staff"?d.professionalCount>0:true);return {id,label:LABELS[id],status:invalid?"needs attention":ready?"ready":saved?"in progress":"not started",saved,ready,active:id===active,summary:card.summary,detail:card.detail};});const ready=steps.filter(x=>x.ready).length;return {owner,active,steps,ready,total:steps.length,percent:Math.round(ready/steps.length*100),navigationError,canLaunch:false,live:{...LIVE}};}
 function clearNavigation(){remove();active="profile";navigationError=null;}
 restoreNavigation();
 return Object.freeze({owner,navigate,refresh,snapshot,restoreNavigation,clearNavigation,get canRegister(){return false;},get canBook(){return false;},get canPay(){return false;},get canPublish(){return false;}});
}
