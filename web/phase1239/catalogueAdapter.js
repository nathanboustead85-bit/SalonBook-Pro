"use strict";
// Phase 12.39 — read-only adapter for EXISTING publicBusinesses v1 documents.
// No Firebase calls. Existing publicBusinesses docs have profile fields only;
// services, staff, and bookings are not published in that schema.
function validSlug(s){return typeof s==="string"&&s.length>=3&&s.length<=50&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);}
function adaptPublicBusiness(doc,requestedSlug){
 if(!validSlug(requestedSlug)||!doc||typeof doc!=="object"||Array.isArray(doc)||
 doc.schemaVersion!==1||doc.published!==true||doc.acceptingBookings!==false||
 doc.slug!==requestedSlug||typeof doc.businessId!=="string"||!doc.businessId||
 typeof doc.name!=="string"||doc.name.trim().length<3){
  return Object.freeze({status:"NOT_AVAILABLE",bookingEnabled:false,services:Object.freeze([])});
 }
 return Object.freeze({status:"PROFILE_ONLY",businessId:doc.businessId,slug:doc.slug,
 businessName:doc.name.trim(),category:typeof doc.category==="string"?doc.category:"",
 bookingEnabled:false,services:Object.freeze([]),
 availabilityStatus:"NOT_PUBLISHED",
 message:"Business profile is published, but public service and availability data are not yet available."});
}
function adaptIsolatedCatalogue(profile,serviceSnapshot,staffSnapshot,appointmentSnapshot){
 // Isolated test-only snapshots: never accept private records from a public browser.
 if(profile.status!=="PROFILE_ONLY"||!Array.isArray(serviceSnapshot)||
 !Array.isArray(staffSnapshot)||!Array.isArray(appointmentSnapshot))
  return Object.freeze({status:"NOT_AVAILABLE",bookingEnabled:false});
 const services=serviceSnapshot.filter(s=>s&&s.published===true&&typeof s.id==="string"&&
 typeof s.name==="string"&&Number.isInteger(s.pricePence)&&s.pricePence>=0&&
 Number.isInteger(s.durationMinutes)&&s.durationMinutes>0&&s.durationMinutes<=480)
 .map(s=>Object.freeze({id:s.id,name:s.name,pricePence:s.pricePence,
 durationMinutes:s.durationMinutes,published:true}));
 // This is a NONPUBLIC fixture adapter. Production needs an owner-controlled
 // publication pipeline that excludes customer and private appointment details.
 const staff=staffSnapshot.filter(s=>s&&s.active===true&&typeof s.id==="string"&&
 Array.isArray(s.serviceIds)&&s.workingHours&&typeof s.workingHours==="object")
 .map(s=>({id:s.id,name:s.name,active:true,serviceIds:[...s.serviceIds],
 workingHours:s.workingHours}));
 const appointments=appointmentSnapshot.map(a=>({staffId:a.staffId,date:a.date,
 start:a.start,end:a.end,status:a.status}));
 return Object.freeze({status:"ISOLATED_SNAPSHOT",businessId:profile.businessId,
 businessName:profile.businessName,published:true,acceptingBookings:false,
 bookingEnabled:false,services,staff,appointments});
}
const API={validSlug,adaptPublicBusiness,adaptIsolatedCatalogue};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
if(typeof window!=="undefined")window.BoustioCatalogueAdapter=API;
