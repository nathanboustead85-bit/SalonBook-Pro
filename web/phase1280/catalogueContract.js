(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioCatalogueContract=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Display-only contract. Input must originate from an authorized PUBLIC catalogue endpoint.
// This module does not fetch, authenticate, persist, reserve slots, or submit bookings.
const slug=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const id=/^[a-zA-Z0-9_-]{1,80}$/;
const name=v=>typeof v==="string"&&v.trim().length>0&&v.trim().length<=100;
const fail=reason=>Object.freeze({status:"CATALOGUE_REJECTED",bookingEnabled:false,reason,profile:null});
function prepareCatalogue(payload,expectedSlug){
 if(typeof expectedSlug!=="string"||!slug.test(expectedSlug))return fail("invalid_requested_slug");
 if(!payload||typeof payload!=="object"||Array.isArray(payload)||payload.schemaVersion!==1||payload.published!==true||payload.slug!==expectedSlug)return fail("unpublished_or_mismatched");
 if(!name(payload.businessName)||!Array.isArray(payload.services)||!Array.isArray(payload.staff)||payload.services.length>200||payload.staff.length>100)return fail("invalid_structure");
 const services=[],staff=[],seenServices=new Set(),seenStaff=new Set();
 for(const s of payload.services){
  if(!s||!id.test(s.id||"")||seenServices.has(s.id)||!name(s.name)||!Number.isInteger(s.pricePence)||s.pricePence<0||s.pricePence>1000000||!Number.isInteger(s.durationMinutes)||s.durationMinutes<5||s.durationMinutes>480||typeof s.published!=="boolean")return fail("invalid_service");
  seenServices.add(s.id);
  services.push({id:s.id,name:s.name.trim(),pricePence:s.pricePence,durationMinutes:s.durationMinutes,published:s.published});
 }
 for(const p of payload.staff){
  if(!p||!id.test(p.id||"")||seenStaff.has(p.id)||!name(p.name)||typeof p.active!=="boolean"||!Array.isArray(p.serviceIds)||p.serviceIds.length>200||p.serviceIds.some(x=>!seenServices.has(x)))return fail("invalid_staff");
  seenStaff.add(p.id);
  staff.push({id:p.id,name:p.name.trim(),active:p.active,serviceIds:[...new Set(p.serviceIds)]});
 }
 const profile=Object.freeze({businessName:payload.businessName.trim(),published:true,services:Object.freeze(services.filter(s=>s.published).map(s=>Object.freeze(s))),staff:Object.freeze(staff.filter(p=>p.active).map(p=>Object.freeze({...p,serviceIds:Object.freeze(p.serviceIds.filter(x=>services.some(s=>s.id===x&&s.published)))})))});
 return Object.freeze({status:"CATALOGUE_DISPLAY_READY",bookingEnabled:false,profile});
}
return Object.freeze({prepareCatalogue});
});
