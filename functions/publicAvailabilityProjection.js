"use strict";
// Phase 12.40: pure public-safe projection. Never writes Firestore.
// Inputs are trusted OWNER-SIDE snapshots, never browser-submitted data.
const {availableSlots}=require("../web/phase1238/availabilityPreview");
const {adaptPublicBusiness}=require("../web/phase1239/catalogueAdapter");
function safeId(v){return typeof v==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(v)}
function safeName(v){return typeof v==="string"&&v.trim().length>0&&v.length<=100}
function isoDate(v){if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+"T00:00:00Z");return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v}
function buildPublicSnapshot({profile,slug,services,staff,appointments,date,generatedAt}={}){
 const business=adaptPublicBusiness(profile,slug);
 const deny=(reason)=>Object.freeze({status:"NOT_PUBLISHABLE",reason,bookingEnabled:false});
 if(business.status!=="PROFILE_ONLY")return deny("INVALID_BUSINESS");
 if(!isoDate(date)||!Number.isSafeInteger(generatedAt)||generatedAt<=0)return deny("INVALID_METADATA");
 if(!Array.isArray(services)||!Array.isArray(staff)||!Array.isArray(appointments)||
 services.length>200||staff.length>100||appointments.length>10000)return deny("INVALID_INPUT");
 // Fail closed if any source record is incomplete. Never leak the source records.
 if(services.some(s=>!s||!safeId(s.id)||!safeName(s.name)||
 typeof s.published!=="boolean"||!Number.isInteger(s.pricePence)||s.pricePence<0||
 !Number.isInteger(s.durationMinutes)||s.durationMinutes<1||s.durationMinutes>480))return deny("INVALID_SERVICES");
 if(staff.some(s=>!s||!safeId(s.id)||!safeName(s.name)||typeof s.active!=="boolean"||
 !Array.isArray(s.serviceIds)||s.serviceIds.some(id=>!safeId(id))||
 !s.workingHours||typeof s.workingHours!=="object"))return deny("INVALID_STAFF");
 if(appointments.some(a=>!a||!safeId(a.staffId)||!isoDate(a.date)||
 typeof a.start!=="string"||typeof a.end!=="string"||
 !["confirmed","cancelled"].includes(a.status)))return deny("INVALID_APPOINTMENTS");
 const publicServices=services.filter(s=>s.published).map(s=>Object.freeze({
 id:s.id,name:s.name,pricePence:s.pricePence,durationMinutes:s.durationMinutes}));
 const slots=[];
 const fixture={published:true,services,staff,appointments};
 for(const person of staff.filter(s=>s.active)){
  for(const service of publicServices.filter(s=>person.serviceIds.includes(s.id))){
   const times=availableSlots(fixture,{serviceId:service.id,staffId:person.id,date});
   // Do not publish staff names or individual appointment records.
   slots.push(Object.freeze({serviceId:service.id,staffId:person.id,times:Object.freeze(times)}));
  }
 }
 return Object.freeze({status:"PUBLIC_PREVIEW",schemaVersion:1,
 businessId:business.businessId,slug:business.slug,businessName:business.businessName,
 date,generatedAt,bookingEnabled:false,services:Object.freeze(publicServices),
 availability:Object.freeze(slots)});
}
function readPublicSnapshot(snapshot,{slug,now,maxAgeMs=300000}={}){
 if(!snapshot||snapshot.status!=="PUBLIC_PREVIEW"||snapshot.bookingEnabled!==false||
 snapshot.schemaVersion!==1||snapshot.slug!==slug||!Number.isSafeInteger(now)||
 !Number.isSafeInteger(snapshot.generatedAt)||now<snapshot.generatedAt||
 now-snapshot.generatedAt>maxAgeMs||!Array.isArray(snapshot.services)||
 !Array.isArray(snapshot.availability))return Object.freeze({status:"UNAVAILABLE",bookingEnabled:false});
 return Object.freeze({status:"READ_ONLY",bookingEnabled:false,
 businessName:snapshot.businessName,date:snapshot.date,
 services:snapshot.services,availability:snapshot.availability});
}
module.exports={buildPublicSnapshot,readPublicSnapshot};
