// Phase 24.4: isolated synthetic service catalogue; no production data access.
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export const CATEGORIES=Object.freeze(["Haircuts","Colour","Styling","Beard","Nails","Beauty","Other"]);
const ownerOK=v=>typeof v==="string"&&/^demo-[a-z0-9-]{3,40}$/.test(v);
const nameOK=v=>typeof v==="string"&&v.trim().length>=2&&v.trim().length<=80;
const idOK=v=>typeof v==="string"&&/^item-[a-z0-9-]{1,40}$/.test(v);
export function createServicesDemo(storage,owner){
 if(!ownerOK(owner))throw Error("Synthetic owner required");
 const key="boustio-phase24-4:"+owner;
 let state={staff:[],services:[],next:1};
 const copy=()=>structuredClone(state);
 const read=()=>storage.getItem?storage.getItem(key):storage.get(key);
 const write=v=>storage.setItem?storage.setItem(key,v):storage.set(key,v);
 const remove=()=>storage.removeItem?storage.removeItem(key):storage.delete(key);
 function addStaff(name){if(!nameOK(name)||state.staff.length>=20)throw Error("Invalid professional");const id="item-"+state.next++;state.staff.push({id,name:name.trim()});return id;}
 function addService(input){
  if(!input||!nameOK(input.name)||!CATEGORIES.includes(input.category)||!Number.isInteger(input.pricePence)||input.pricePence<0||input.pricePence>100000||!Number.isInteger(input.durationMinutes)||input.durationMinutes<5||input.durationMinutes>480||!Array.isArray(input.staffIds)||state.services.length>=50)throw Error("Invalid service");
  if(new Set(input.staffIds).size!==input.staffIds.length||input.staffIds.some(id=>!state.staff.some(s=>s.id===id)))throw Error("Invalid staff assignment");
  const id="item-"+state.next++;state.services.push({id,name:input.name.trim(),category:input.category,pricePence:input.pricePence,durationMinutes:input.durationMinutes,staffIds:[...input.staffIds]});return id;
 }
 function assign(serviceId,staffIds){if(!idOK(serviceId)||!Array.isArray(staffIds)||new Set(staffIds).size!==staffIds.length||staffIds.some(id=>!state.staff.some(s=>s.id===id)))throw Error("Invalid assignment");const service=state.services.find(s=>s.id===serviceId);if(!service)throw Error("Service not found");service.staffIds=[...staffIds];}
 function menu(){return state.services.map(s=>({...structuredClone(s),staff:s.staffIds.map(id=>state.staff.find(x=>x.id===id)?.name).filter(Boolean)}));}
 function save(){write(JSON.stringify({version:1,owner,state:copy()}));}
 function load(){const raw=read();if(!raw)return false;const data=JSON.parse(raw);if(data.version!==1||data.owner!==owner||!data.state||!Array.isArray(data.state.staff)||!Array.isArray(data.state.services)||!Number.isSafeInteger(data.state.next)||data.state.next<1||data.state.next>10000)throw Error("Invalid recovery");const old=copy();try{state={staff:[],services:[],next:1};const seen=new Set();for(const s of data.state.staff){if(!idOK(s.id)||seen.has(s.id))throw Error("Invalid staff recovery");seen.add(s.id);addStaff(s.name);state.staff.at(-1).id=s.id;}for(const s of data.state.services){if(!idOK(s.id)||seen.has(s.id))throw Error("Invalid service recovery");seen.add(s.id);addService(s);state.services.at(-1).id=s.id;}if(data.state.next<=Math.max(0,...[...seen].map(x=>Number(x.slice(5)))))throw Error("Invalid next identifier");state.next=data.state.next;}catch(e){state=old;throw e;}return true;}
 return Object.freeze({owner,get state(){return copy();},get menu(){return menu();},addStaff,addService,assign,save,load,clear(){remove();state={staff:[],services:[],next:1};},get canPublish(){return false;}});
}
