"use strict";
// Phase 13.19: optional, explicitly published public catalogue projection.
// No private collection access. Never infer services/staff from owner data.
function safeCatalogue(profile){
 const services=profile.get("services"),staff=profile.get("staff");
 if(!Array.isArray(services)||!Array.isArray(staff))return null;
 if(services.length>100||staff.length>50)return null;
 const ids=new Set();
 const publicServices=[];
 for(const s of services){
  if(!s||s.published!==true)continue;
  if(typeof s.id!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(s.id)||ids.has(s.id)||
   typeof s.name!=="string"||s.name.trim().length<1||s.name.length>100||
   !Number.isSafeInteger(s.pricePence)||s.pricePence<0||s.pricePence>10000000||
   !Number.isSafeInteger(s.durationMinutes)||s.durationMinutes<5||s.durationMinutes>720)return null;
  ids.add(s.id);
  publicServices.push({id:s.id,name:s.name,pricePence:s.pricePence,durationMinutes:s.durationMinutes});
 }
 const staffIds=new Set(),publicStaff=[];
 for(const person of staff){
  if(!person||person.active!==true)continue;
  if(typeof person.id!=="string"||!/^[A-Za-z0-9_-]{1,80}$/.test(person.id)||staffIds.has(person.id)||
   typeof person.name!=="string"||person.name.trim().length<1||person.name.length>100||
   !Array.isArray(person.serviceIds)||person.serviceIds.length>100||
   person.serviceIds.some(id=>typeof id!=="string"||!ids.has(id)))return null;
  staffIds.add(person.id);
  publicStaff.push({id:person.id,name:person.name,serviceIds:[...new Set(person.serviceIds)]});
 }
 return {services:publicServices,staff:publicStaff};
}
module.exports=Object.freeze({safeCatalogue});
