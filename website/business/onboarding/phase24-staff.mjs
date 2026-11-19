// Phase 24.5: synthetic local-only staff and schedules. No live operations.
export const LIVE=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
export const DAYS=Object.freeze(["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]);
const time=v=>typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const minutes=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
const name=v=>typeof v==="string"&&v.trim().length>=2&&v.trim().length<=80;
const id=v=>typeof v==="string"&&/^staff-[1-9]\d{0,4}$/.test(v);
const hours=()=>Object.fromEntries(DAYS.map(d=>[d,{off:d==="Sunday",start:d==="Sunday"?"":"09:00",end:d==="Sunday"?"":"17:00",breaks:[]}]));
const checkHours=h=>{if(!h||typeof h!=="object"||typeof h.off!=="boolean")throw Error("Invalid hours");if(h.off)return {off:true,start:"",end:"",breaks:[]};if(!time(h.start)||!time(h.end)||minutes(h.start)>=minutes(h.end))throw Error("Invalid working hours");return {off:false,start:h.start,end:h.end,breaks:[]};};
export function createStaffScheduleDemo(storage,owner){
 if(typeof owner!=="string"||!/^demo-[a-z0-9-]{3,40}$/.test(owner))throw Error("Synthetic owner required");
 const key="boustio-phase24-5:"+owner;
 let state={staff:[],services:[],next:1};
 const clone=()=>structuredClone(state);
 const read=()=>storage.getItem?storage.getItem(key):storage.get(key);
 const write=v=>storage.setItem?storage.setItem(key,v):storage.set(key,v);
 const remove=()=>storage.removeItem?storage.removeItem(key):storage.delete(key);
 function addStaff(input){if(!input||!name(input.name)||state.staff.length>=20)throw Error("Invalid professional");const role=typeof input.role==="string"?input.role.trim():"";if(role.length>60)throw Error("Invalid role");const sid="staff-"+state.next++;state.staff.push({id:sid,name:input.name.trim(),role,hours:hours(),serviceIds:[]});return sid;}
 function addService(label){if(!name(label)||state.services.length>=50)throw Error("Invalid service");const sid="service-"+state.next++;state.services.push({id:sid,name:label.trim()});return sid;}
 function find(sid){if(!id(sid))throw Error("Invalid professional ID");const s=state.staff.find(x=>x.id===sid);if(!s)throw Error("Professional not found");return s;}
 function setDay(sid,day,input){if(!DAYS.includes(day))throw Error("Invalid day");const s=find(sid),next=checkHours(input);s.hours[day]=next;}
 function addBreak(sid,day,start,end){if(!DAYS.includes(day)||!time(start)||!time(end)||minutes(start)>=minutes(end))throw Error("Invalid break");const h=find(sid).hours[day];if(h.off||minutes(start)<minutes(h.start)||minutes(end)>minutes(h.end)||h.breaks.length>=5||h.breaks.some(b=>minutes(start)<minutes(b.end)&&minutes(end)>minutes(b.start)))throw Error("Break outside working hours or overlapping");h.breaks.push({start,end});h.breaks.sort((a,b)=>a.start.localeCompare(b.start));}
 function assign(sid,ids){const s=find(sid);if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(x=>!state.services.some(v=>v.id===x)))throw Error("Invalid service assignment");s.serviceIds=[...ids];}
 function preview(){return state.staff.map(s=>({...structuredClone(s),services:s.serviceIds.map(i=>state.services.find(v=>v.id===i)?.name).filter(Boolean)}));}
 function validateDraft(v){if(!v||!Array.isArray(v.staff)||!Array.isArray(v.services)||v.staff.length>20||v.services.length>50||!Number.isSafeInteger(v.next)||v.next<1||v.next>10000)throw Error("Invalid saved draft");const fresh={staff:[],services:[],next:1};const ids=new Set();for(const service of v.services){if(!service||!/^service-[1-9]\d{0,4}$/.test(service.id)||ids.has(service.id)||!name(service.name))throw Error("Invalid saved service");ids.add(service.id);fresh.services.push({id:service.id,name:service.name.trim()});}for(const s of v.staff){if(!s||!id(s.id)||ids.has(s.id)||!name(s.name)||typeof s.role!=="string"||s.role.length>60||!s.hours||Object.keys(s.hours).length!==7||!Array.isArray(s.serviceIds)||new Set(s.serviceIds).size!==s.serviceIds.length||s.serviceIds.some(x=>!fresh.services.some(z=>z.id===x)))throw Error("Invalid saved staff");ids.add(s.id);const normalized={id:s.id,name:s.name.trim(),role:s.role,hours:{},serviceIds:[...s.serviceIds]};for(const day of DAYS){const h=s.hours[day];const clean=checkHours(h);if(!Array.isArray(h.breaks)||h.breaks.length>5)throw Error("Invalid saved breaks");for(const b of h.breaks){if(clean.off||!time(b.start)||!time(b.end)||minutes(b.start)>=minutes(b.end)||minutes(b.start)<minutes(clean.start)||minutes(b.end)>minutes(clean.end)||clean.breaks.some(x=>minutes(b.start)<minutes(x.end)&&minutes(b.end)>minutes(x.start)))throw Error("Invalid saved break");clean.breaks.push({start:b.start,end:b.end});}normalized.hours[day]=clean;}fresh.staff.push(normalized);}if(v.next<=Math.max(0,...[...ids].map(x=>Number(x.split("-")[1]))))throw Error("Invalid next ID");fresh.next=v.next;return fresh;}
 function save(){write(JSON.stringify({version:1,owner,state:clone()}));}
 function load(){const raw=read();if(!raw)return false;const data=JSON.parse(raw);if(data.version!==1||data.owner!==owner)throw Error("Owner mismatch");const fresh=validateDraft(data.state);state=fresh;return true;}
 return Object.freeze({owner,get state(){return clone();},get preview(){return preview();},addStaff,addService,setDay,addBreak,assign,save,load,clear(){remove();state={staff:[],services:[],next:1};},get canPublish(){return false;}});
}
