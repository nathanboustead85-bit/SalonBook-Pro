// Phase 18.9: in-memory dashboard editing, deliberately disconnected from real accounts.
import {DAYS,DURATIONS,MAX_SERVICES,MAX_STAFF,validateService,validateStaff,validateWeek} from "../setup/enhanced-draft.mjs";
export const DASHBOARD_EDIT_PREVIEW_ONLY=true;
export const DASHBOARD_WRITES_ENABLED=false;
export const CUSTOMER_BOOKINGS_ENABLED=false;
export const PUBLIC_REGISTRATION_ENABLED=false;
const clone=value=>structuredClone(value);
const categories=["salon","barber","nails","beauty","wellness"];
const canonical=value=>value.trim().toLocaleLowerCase("en-GB");
export function validateProfile(profile){
 return !!profile&&typeof profile.name==="string"&&profile.name.trim().length>=2&&profile.name.trim().length<=100&&
 categories.includes(profile.category)&&typeof profile.email==="string"&&profile.email.length<=254&&
 /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim());
}
export function validateDashboardDraft(d){
 if(!d||!validateProfile(d.profile)||!Array.isArray(d.services)||!Array.isArray(d.staff)||
 d.services.length<1||d.services.length>MAX_SERVICES||d.staff.length<1||d.staff.length>MAX_STAFF||
 !d.services.every(validateService)||!d.staff.every(validateStaff)||!validateWeek(d.week))return false;
 return new Set(d.services.map(s=>canonical(s.name))).size===d.services.length&&
 new Set(d.staff.map(s=>canonical(s.name))).size===d.staff.length;
}
export function demoEditableDraft(){
 return {profile:{name:"Kody Blends (demo)",category:"barber",email:"demo@example.invalid"},
  services:[{name:"Haircut",price:"20.00",duration:30},{name:"Beard trim",price:"8.00",duration:15}],
  staff:[{name:"Kody (demo)"},{name:"Alex (demo)"}],
  week:Object.fromEntries(DAYS.map((day,i)=>[day,{closed:i>=5,open:"09:00",close:"17:00"}]))};
}
export function createEditor(initial=demoEditableDraft()){
 if(!validateDashboardDraft(initial))throw new Error("Invalid initial dashboard data.");
 let saved=clone(initial),working=clone(initial);
 const state=()=>({draft:clone(working),dirty:JSON.stringify(working)!==JSON.stringify(saved),valid:validateDashboardDraft(working)});
 const mutate=fn=>{const candidate=clone(working);fn(candidate);if(!validateDashboardDraft(candidate))throw new Error("Invalid edit. Changes were not applied.");working=candidate;return state();};
 return Object.freeze({
  state,
  updateProfile:profile=>mutate(d=>{d.profile={...d.profile,...profile};}),
  addService:service=>mutate(d=>{d.services.push(clone(service));}),
  editService:(index,service)=>mutate(d=>{if(!Number.isInteger(index)||index<0||index>=d.services.length)throw new Error("Unknown service.");d.services[index]={...d.services[index],...service};}),
  removeService:index=>mutate(d=>{if(!Number.isInteger(index)||index<0||index>=d.services.length)throw new Error("Unknown service.");d.services.splice(index,1);}),
  addStaff:person=>mutate(d=>{d.staff.push(clone(person));}),
  editStaff:(index,person)=>mutate(d=>{if(!Number.isInteger(index)||index<0||index>=d.staff.length)throw new Error("Unknown staff member.");d.staff[index]={...d.staff[index],...person};}),
  removeStaff:index=>mutate(d=>{if(!Number.isInteger(index)||index<0||index>=d.staff.length)throw new Error("Unknown staff member.");d.staff.splice(index,1);}),
  updateDay:(day,hours)=>mutate(d=>{if(!DAYS.includes(day))throw new Error("Unknown weekday.");d.week[day]={...d.week[day],...hours};}),
  discard:()=>{working=clone(saved);return state();},
  // Accept changes only in this page's memory. Never persists or publishes.
  acceptPreview:()=>{if(!validateDashboardDraft(working))throw new Error("Invalid draft.");saved=clone(working);return state();},
  reset:()=>{working=clone(initial);saved=clone(initial);return state();}
 });
}
export async function persistDashboardChanges(){
 if(!DASHBOARD_WRITES_ENABLED)throw new Error("Dashboard writes are disabled.");
 throw new Error("Trusted owner-scoped persistence is not configured.");
}
