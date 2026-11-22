"use strict";
// Synthetic, read-only compatibility gate; no Firebase initialization or writes.
const {validateDocumentFreshness}=require("../phase34/document-freshness-34-3");
const {mapStaff}=require("../phase33/staff-map-33-3");
const {paths}=require("../phase34/android-firestore-map-34-2");
const deny=reason=>Object.freeze({status:"UNAVAILABLE",reason,business:null,services:Object.freeze([]),staff:Object.freeze([]),bookingEnabled:false,editingEnabled:false,canMessage:false,canPay:false});
function validateBusinessCompatibility(auth,documents,now,options={consistentRead:true}){
 const checked=validateDocumentFreshness(auth,documents,now,options);
 if(checked.status!=="FRESH_ANDROID_READ_ONLY")return deny(checked.reason);
 const p=paths(auth.uid),envelope=documents[p.staff];
 const staff=mapStaff(envelope,checked.data.services);
 if(staff.status!=="STAFF_MAPPED_READ_ONLY")return deny(staff.reason);
 // Require both historical and strict staff interpretations to agree on identity and service assignments.
 if(staff.staff.length!==checked.data.staff.length||staff.staff.some((s,i)=>s.id!==checked.data.staff[i].id||s.serviceIds.join("\u0000")!==checked.data.staff[i].serviceIds.join("\u0000")))return deny("staff_mapper_disagreement");
 return Object.freeze({status:"COMPATIBLE_READ_ONLY",business:checked.data.business,services:checked.data.services,staff:staff.staff,bookingEnabled:false,editingEnabled:false,canMessage:false,canPay:false,revisionStatus:"NO_SHARED_REVISION_FIELD",availabilityStatus:"UNVERIFIED_READ_ONLY"});
}
module.exports=Object.freeze({validateBusinessCompatibility,deny});
