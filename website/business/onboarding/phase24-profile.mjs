// Phase 24.3: synthetic premium business profile; no live registration, booking or payments.
export const LIVE_FEATURES=Object.freeze({registration:false,bookings:false,payments:false,publishing:false});
const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const trim=(v,n)=>typeof v==="string"?v.trim().slice(0,n):"";
const validTime=v=>typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const minute=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
const defaultHours=()=>Object.fromEntries(days.map(d=>[d,{closed:d==="Sunday",open:"09:00",close:"17:00"}]));
export function createProfileDemo(store,owner){
 if(!/^demo-[a-z0-9-]{3,40}$/.test(owner||""))throw Error("Synthetic demo owner required");
 const key="boustio-phase24-3:"+owner;
 let profile={name:"",category:"Barber",email:"",phone:"",address1:"",town:"",postcode:"",website:"",hours:defaultHours()};
 const copy=()=>structuredClone(profile);
 const read=()=>store.getItem?store.getItem(key):store.get(key);
 const write=v=>store.setItem?store.setItem(key,v):store.set(key,v);
 const remove=()=>store.removeItem?store.removeItem(key):store.delete(key);
 function update(fields){
  const allowed=["name","category","email","phone","address1","town","postcode","website"];
  if(!fields||typeof fields!=="object"||Object.keys(fields).some(k=>!allowed.includes(k)))throw Error("Invalid profile fields");
  const next=copy();for(const [k,v] of Object.entries(fields))next[k]=trim(v,k==="address1"?120:100);
  if(next.name&&!/^[\p{L}\p{N} .,'&()-]{2,100}$/u.test(next.name))throw Error("Invalid business name");
  if(!["Barber","Hair salon","Nails","Beauty"].includes(next.category))throw Error("Invalid category");
  if(next.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))throw Error("Invalid email");
  if(next.phone&&!/^\+?[0-9 ()-]{7,25}$/.test(next.phone))throw Error("Invalid phone");
  if(next.postcode&&!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s*\d[A-Za-z]{2}$/.test(next.postcode))throw Error("Invalid UK postcode");
  if(next.website){let u;try{u=new URL(next.website);}catch{throw Error("Invalid website");}if(u.protocol!=="https:"||u.username||u.password)throw Error("HTTPS website required");}
  profile=next;return copy();
 }
 function setHours(day,value){if(!days.includes(day)||!value||typeof value.closed!=="boolean")throw Error("Invalid day");const v={closed:value.closed,open:value.open,close:value.close};if(!v.closed&&(!validTime(v.open)||!validTime(v.close)||minute(v.open)>=minute(v.close)))throw Error("Invalid opening hours");if(v.closed){v.open="";v.close="";}profile.hours[day]=v;return copy();}
 function completeness(){const required={name:!!profile.name,contact:!!profile.email&&!!profile.phone,address:!!profile.address1&&!!profile.town&&!!profile.postcode,hours:days.some(d=>!profile.hours[d].closed)};return {checks:required,complete:Object.values(required).every(Boolean),percent:Math.round(Object.values(required).filter(Boolean).length/4*100)};}
 function save(){write(JSON.stringify({version:1,owner,profile:copy()}));return completeness();}
 function load(){const raw=read();if(!raw)return false;const parsed=JSON.parse(raw);if(parsed.version!==1||parsed.owner!==owner||!parsed.profile)throw Error("Invalid or mismatched recovery");const old=copy();try{profile={name:"",category:"Barber",email:"",phone:"",address1:"",town:"",postcode:"",website:"",hours:defaultHours()};const {hours,...fields}=parsed.profile;update(fields);if(!hours||Object.keys(hours).some(d=>!days.includes(d)))throw Error("Invalid saved hours");for(const d of days)setHours(d,hours[d]);}catch(e){profile=old;throw e;}return true;}
 return Object.freeze({owner,get profile(){return copy();},get completeness(){return completeness();},update,setHours,save,load,clear(){remove();profile={name:"",category:"Barber",email:"",phone:"",address1:"",town:"",postcode:"",website:"",hours:defaultHours()};},get canPublish(){return false;}});
}
