"use strict";
// Phase 33.1: pure owner-scoped read-only dashboard adapter; no network or writes.
const {validateServiceSnapshot}=require("../phase32/content-validation-32-9");
const empty=Object.freeze([]);
const state=(status,reason)=>Object.freeze({status,reason,bookingEnabled:false,editingEnabled:false,services:empty,business:null});
const loading=()=>state("LOADING","awaiting_verified_snapshot");
const unavailable=reason=>state("UNAVAILABLE",reason);
function adaptDashboardSnapshot(input,{ownerId,now}={}){
 if(!input||input.loading===true)return loading();
 if(input.error)return unavailable("source_error");
 if(typeof ownerId!=="string"||ownerId.length<1||!Number.isSafeInteger(now)||now<0)return unavailable("invalid_context");
 if(!input.auth||input.auth.uid!==ownerId||input.auth.emailVerified!==true)return unavailable("unauthorised_owner");
 if(!input.business||input.business.businessId!==ownerId||input.business.acceptingBookings!==false||
    typeof input.business.name!=="string"||input.business.name.trim().length<1||input.business.name.length>150)return unavailable("invalid_business");
 if(!Number.isSafeInteger(input.expiresAt)||now>input.expiresAt||!Number.isSafeInteger(input.revision)||input.revision<0)return unavailable("stale_or_invalid_snapshot");
 if(input.servicesOwnerId!==ownerId||input.servicesRevision!==input.revision)return unavailable("mixed_owner_or_revision");
 const result=validateServiceSnapshot(input.services);
 if(result.status!=="VALIDATED_OFFLINE_PREVIEW")return unavailable("invalid_service_content");
 return Object.freeze({status:"READ_ONLY_READY",reason:null,bookingEnabled:false,editingEnabled:false,
  business:Object.freeze({businessId:ownerId,name:input.business.name}),
  services:result.services,revision:input.revision,expiresAt:input.expiresAt});
}
module.exports=Object.freeze({adaptDashboardSnapshot,loading,unavailable});
