(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPublishedProfileAdapter=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Pure preparation only: no Firebase, network, storage, authentication or booking writes.
// Real data must eventually be provided by a separately authenticated, authorized backend.
const id=/^[a-zA-Z0-9_-]{1,80}$/;
const text=(v,max)=>typeof v==="string"&&v.trim().length>0&&v.trim().length<=max;
const money=v=>Number.isInteger(v)&&v>=0&&v<=1000000;
function preparePublishedProfile(input){
 const fail=(reason)=>Object.freeze({status:"INVALID_OR_UNPUBLISHED",bookingEnabled:false,reason,profile:null});
 if(!input||typeof input!=="object"||Array.isArray(input)||input.published!==true)return fail("not_published");
 if(!text(input.businessName,100)||!Array.isArray(input.services)||!Array.isArray(input.staff))return fail("invalid_structure");
 if(input.services.length>200||input.staff.length>100)return fail("too_many_records");
 const serviceIds=new Set(),staffIds=new Set(),services=[],staff=[];
 for(const s of input.services){
  if(!s||!id.test(s.id||"")||serviceIds.has(s.id)||!text(s.name,100)||!money(s.pricePence)||!Number.isInteger(s.durationMinutes)||s.durationMinutes<5||s.durationMinutes>480)return fail("invalid_service");
  serviceIds.add(s.id);
  if(s.published===true)services.push(Object.freeze({id:s.id,name:s.name.trim(),pricePence:s.pricePence,durationMinutes:s.durationMinutes,published:true}));
 }
 for(const p of input.staff){
  if(!p||!id.test(p.id||"")||staffIds.has(p.id)||!text(p.name,100)||!Array.isArray(p.serviceIds)||p.serviceIds.length>200||p.serviceIds.some(x=>!serviceIds.has(x)))return fail("invalid_staff");
  staffIds.add(p.id);
  if(p.active===true)staff.push(Object.freeze({id:p.id,name:p.name.trim(),serviceIds:Object.freeze([...new Set(p.serviceIds)].filter(x=>services.some(s=>s.id===x))),active:true}));
 }
 const profile=Object.freeze({businessName:input.businessName.trim(),published:true,services:Object.freeze(services),staff:Object.freeze(staff)});
 return Object.freeze({status:"VALIDATED_DISPLAY_ONLY",bookingEnabled:false,profile});
}
return Object.freeze({preparePublishedProfile});
});
