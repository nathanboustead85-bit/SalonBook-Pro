// Phase 18.5: pure, offline-only onboarding draft helpers.
export const MAX_SERVICES=30;
export const MAX_STAFF=25;
export const DAYS=Object.freeze(["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]);
export const DURATIONS=Object.freeze([15,30,45,60,90,120,180,240]);
const text=(v,max=100)=>typeof v==="string"?v.trim().slice(0,max):"";
const time=v=>typeof v==="string"&&/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(v);
export function validateService(v){
 const name=text(v?.name);
 const price=typeof v?.price==="string"||typeof v?.price==="number"?String(v.price):"";
 return name.length>=2 && name.length<=100 && /^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/.test(price) &&
 Number(price)<=10000 && DURATIONS.includes(Number(v?.duration));
}
export function validateStaff(v){return text(v?.name).length>=2&&text(v?.name).length<=100;}
export function validateWeek(week){
 return !!week&&typeof week==="object"&&DAYS.every(day=>{
  const v=week[day];
  return !!v&&typeof v==="object"&&typeof v.closed==="boolean"&&
   (v.closed===true||(time(v.open)&&time(v.close)&&v.open<v.close));
 })&&DAYS.some(day=>!week[day].closed);
}
export function defaultWeek(){
 return Object.fromEntries(DAYS.map((day,i)=>[day,{closed:i>=5,open:"09:00",close:"17:00"}]));
}
export function validateCollection(items,validate,max){
 return Array.isArray(items)&&items.length>0&&items.length<=max&&items.every(validate);
}
export function validateSetup(d){
 return !!d&&typeof d==="object"&&typeof d.name==="string"&&d.name.trim().length>=2&&d.name.trim().length<=100&&
 ["salon","barber","nails","beauty","wellness"].includes(d.category)&&
 typeof d.contact==="string"&&d.contact.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contact.trim())&&
 validateCollection(d.services,validateService,MAX_SERVICES)&&validateWeek(d.week)&&
 validateCollection(d.staff,validateStaff,MAX_STAFF);
}
export function reviewLines(d){
 if(!validateSetup(d))throw new Error("Complete every setup step before review.");
 return [
  "Business: "+text(d.name),
  "Category: "+text(d.category),
  "Contact: "+text(d.contact,254),
  "Services ("+d.services.length+"):",
  ...d.services.map(s=>"  "+text(s.name)+" — £"+Number(s.price).toFixed(2)+" / "+Number(s.duration)+" min"),
  "Weekly opening hours:",
  ...DAYS.map(day=>"  "+day+": "+(d.week[day].closed?"Closed":d.week[day].open+"–"+d.week[day].close)),
  "Staff ("+d.staff.length+"):",
  ...d.staff.map(s=>"  "+text(s.name)),
  "Public registration: Disabled",
  "Customer bookings: Disabled",
  "Publishing: Disabled"
 ];
}
