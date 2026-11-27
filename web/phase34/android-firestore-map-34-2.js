"use strict";
// Phase 34.2: map inspected Android/Firestore documents, no SDK/network/writes.
const {mapLegacyServices}=require("../phase33/legacy-services-map-33-2");
const {mapLegacyStaff}=require("../phase33/staff-map-33-3");
const id=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false,editingEnabled:false,business:null,services:Object.freeze([]),staff:Object.freeze([])});
const paths=uid=>Object.freeze({profile:"users/"+uid+"/business/profile",services:"users/"+uid+"/liveData/services",staff:"users/"+uid+"/liveData/staff"});
function mapActualAndroidDocuments(auth,documents){
 if(!auth||!id(auth.uid)||auth.emailVerified!==true)return deny("unverified_owner");
 if(!obj(documents))return deny("missing_documents");
 const expected=paths(auth.uid);
 if(Object.keys(documents).length!==3||Object.keys(documents).some(k=>!Object.values(expected).includes(k)))return deny("unexpected_paths");
 const profile=documents[expected.profile],services=documents[expected.services],staff=documents[expected.staff];
 if(!obj(profile)||profile.schemaVersion!==1||profile.businessId!==auth.uid||
    typeof profile.name!=="string"||profile.name.trim().length<3||profile.name.length>100||
    profile.acceptingBookings!==false)return deny("invalid_private_profile");
 for(const envelope of [services,staff]){
  if(!obj(envelope)||envelope.schemaVersion!==1||typeof envelope.json!=="string"||
     envelope.json.length>500000||!Object.hasOwn(envelope,"updatedAt")||envelope.updatedAt===null)return deny("invalid_live_data_envelope");
 }
 if(!Object.hasOwn(profile,"updatedAt")||profile.updatedAt===null)return deny("missing_profile_timestamp");
 const mappedServices=mapLegacyServices(services);
 if(mappedServices.status!=="MAPPED_READ_ONLY")return deny("invalid_android_services");
 // Staff validation is delegated to the inspected Android staff schema mapper.
 let rawStaff;try{rawStaff=JSON.parse(staff.json)}catch{return deny("invalid_android_staff")}
 if(!Array.isArray(rawStaff)||rawStaff.length>500)return deny("invalid_android_staff");
 const staffIds=new Set(),mappedStaff=[];
 for(const s of rawStaff){
  if(!obj(s)||typeof s.id!=="string"||s.id.length<1||s.id.length>80||staffIds.has(s.id)||
     typeof s.name!=="string"||!s.name.trim()||s.name.length>150||
     typeof s.role!=="string"||s.role.length>150||!Array.isArray(s.serviceIds)||
     !obj(s.weeklySchedule)||!Array.isArray(s.weeklyBreaks)||!Array.isArray(s.timeOff)||
     (s.publicVisible!==undefined&&typeof s.publicVisible!=="boolean"))return deny("invalid_android_staff");
  if(s.serviceIds.some(x=>typeof x!=="string"||!mappedServices.services.some(v=>v.id===x)))return deny("unknown_staff_service");
  staffIds.add(s.id);
  mappedStaff.push(Object.freeze({id:s.id,name:s.name,role:s.role,serviceIds:Object.freeze([...s.serviceIds]),publicVisible:s.publicVisible===true}));
 }
 return Object.freeze({status:"MAPPED_ANDROID_READ_ONLY",reason:null,bookingEnabled:false,editingEnabled:false,
  business:Object.freeze({businessId:auth.uid,name:profile.name,acceptingBookings:false}),
  services:mappedServices.services,staff:Object.freeze(mappedStaff),
  sourcePaths:expected,openingHoursStatus:"NOT_VERIFIED_IN_ANDROID_SCHEMA",revisionStatus:"NO_SHARED_REVISION_FIELD"});
}
module.exports=Object.freeze({mapActualAndroidDocuments,paths});
