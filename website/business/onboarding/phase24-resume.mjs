// Phase 24.2: synthetic demo accounts only. No production authentication or registration.
import {createDemoOnboarding,FLAGS} from "./phase24-demo.mjs";
export {FLAGS};
const validOwner=id=>typeof id==="string"&&/^demo-[a-z0-9-]{3,40}$/.test(id);
export function createResumableDemo(storage,ownerId){
 if(!validOwner(ownerId))throw Error("Invalid synthetic owner");
 const key="boustio-phase24-2:"+ownerId,engine=createDemoOnboarding();
 const snapshot=()=>engine.state;
 function load(){const raw=storage.getItem(key);if(!raw)return false;const data=JSON.parse(raw);if(data.version!==1||data.owner!==ownerId||!data.state)throw Error("Invalid demo recovery");const s=data.state;engine.reset();if(s.business?.name)engine.setBusiness(s.business.name,s.business.category);for(const v of s.services||[])engine.addService(v.name,v.pricePence,v.durationMinutes);for(const v of s.staff||[])engine.addStaff(v.name);return true;}
 function save(){storage.setItem(key,JSON.stringify({version:1,owner:ownerId,state:snapshot()}));return progress();}
 function progress(){const s=snapshot();return Object.freeze({profile:!!s.business.slug,services:s.services.length>0,staff:s.staff.length>0,complete:!!s.business.slug&&s.services.length>0&&s.staff.length>0});}
 return Object.freeze({ownerId,get state(){return snapshot();},get previewLink(){return engine.previewLink;},get progress(){return progress();},setBusiness:(...a)=>engine.setBusiness(...a),addService:(...a)=>engine.addService(...a),addStaff:(...a)=>engine.addStaff(...a),save,load,clear(){storage.removeItem(key);engine.reset();},get canRegister(){return false;},get canPublish(){return false;}});
}
