"use strict";
/* Boustio Phase 31.1 — pure read-only business snapshot adapter.
 * No Firebase SDK, network, storage, mutations, booking writes or deployment.
 * Input must be supplied by a trusted staging harness in later phases.
 */
(function(root){
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const clean=(v,max=120)=>typeof v==="string"?v.trim().slice(0,max):"";
 const finite=(n)=>typeof n==="number"&&Number.isFinite(n);
 const safeId=v=>/^[a-zA-Z0-9_-]{1,64}$/.test(v||"");
 const days=["mon","tue","wed","thu","fri","sat","sun"];
 function normalizeBusinessSnapshot(input){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Invalid business snapshot");
  if(input.schemaVersion!==1)throw Error("Unsupported snapshot version");
  if(!safeId(input.businessId))throw Error("Invalid business identifier");
  if(!input.profile||typeof input.profile!=="object"||Array.isArray(input.profile))throw Error("Missing business profile");
  const profile=Object.freeze({name:clean(input.profile.name,100),category:clean(input.profile.category,60),location:clean(input.profile.location,120),description:clean(input.profile.description,300)});
  if(!profile.name)throw Error("Business name required");
  if(!Array.isArray(input.services)||input.services.length>100)throw Error("Invalid services");
  if(!Array.isArray(input.staff)||input.staff.length>100)throw Error("Invalid staff");
  const ids=new Set(),staffIds=new Set();
  const services=input.services.map(s=>{
   if(!s||!safeId(s.id)||ids.has(s.id)||!clean(s.name,100)||!Number.isInteger(s.durationMinutes)||s.durationMinutes<5||s.durationMinutes>480||!finite(s.pricePence)||!Number.isInteger(s.pricePence)||s.pricePence<0||s.pricePence>10000000)throw Error("Invalid service");
   ids.add(s.id);
   return Object.freeze({id:s.id,name:clean(s.name,100),description:clean(s.description,250),durationMinutes:s.durationMinutes,pricePence:s.pricePence,active:s.active===true});
  });
  const staff=input.staff.map(s=>{
   if(!s||!safeId(s.id)||staffIds.has(s.id)||!clean(s.name,100)||!Array.isArray(s.serviceIds)||s.serviceIds.length>100||s.serviceIds.some(id=>!ids.has(id)))throw Error("Invalid staff");
   staffIds.add(s.id);
   return Object.freeze({id:s.id,name:clean(s.name,100),serviceIds:Object.freeze([...new Set(s.serviceIds)]),active:s.active===true});
  });
  const hours=input.openingHours;
  if(!hours||typeof hours!=="object"||Array.isArray(hours))throw Error("Invalid opening hours");
  const time=t=>typeof t==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const openingHours={};
  for(const d of days){
   if(!own(hours,d))throw Error("Missing day "+d);
   const h=hours[d];
   if(!h||typeof h!=="object"||typeof h.closed!=="boolean")throw Error("Invalid day "+d);
   if(h.closed)openingHours[d]=Object.freeze({closed:true,open:null,close:null});
   else if(!time(h.open)||!time(h.close)||h.open>=h.close)throw Error("Invalid hours "+d);
   else openingHours[d]=Object.freeze({closed:false,open:h.open,close:h.close});
  }
  return Object.freeze({schemaVersion:1,businessId:input.businessId,profile,services:Object.freeze(services),staff:Object.freeze(staff),openingHours:Object.freeze(openingHours),source:"supplied-read-only-snapshot",live:false});
 }
 function summarize(snapshot){
  return Object.freeze({businessName:snapshot.profile.name,activeServices:snapshot.services.filter(s=>s.active).length,activeStaff:snapshot.staff.filter(s=>s.active).length,openDays:days.filter(d=>!snapshot.openingHours[d].closed).length});
 }
 const api=Object.freeze({normalizeBusinessSnapshot,summarize});
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 else root.BoustioReadOnlyBusiness=api;
})(typeof globalThis!=="undefined"?globalThis:this);
