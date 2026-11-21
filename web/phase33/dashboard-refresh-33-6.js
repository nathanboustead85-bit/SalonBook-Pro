"use strict";
// Phase 33.6: deterministic offline refresh state machine; no I/O or persistence.
const {assembleDashboard}=require("./dashboard-assembly-33-5");
const empty=Object.freeze([]);
const blank=(status,reason,requestId=null)=>Object.freeze({status,reason,requestId,bookingEnabled:false,editingEnabled:false,availabilityStatus:"UNVERIFIED_READ_ONLY",business:null,services:empty,staff:empty,openingHours:empty});
const validId=x=>typeof x==="string"&&/^[A-Za-z0-9_-]{1,80}$/.test(x);
const validContext=c=>c&&validId(c.ownerId)&&Number.isSafeInteger(c.now)&&c.now>=0;
function startLoading(context,requestId){
 if(!validContext(context)||!validId(requestId))return blank("UNAVAILABLE","invalid_refresh_context");
 return Object.freeze({...blank("LOADING","awaiting_verified_snapshot",requestId),ownerId:context.ownerId});
}
function finishLoading(previous,requestId,input,context){
 if(!validContext(context)||!validId(requestId))return blank("UNAVAILABLE","invalid_refresh_context");
 if(!previous||previous.status!=="LOADING"||previous.requestId!==requestId||previous.ownerId!==context.ownerId)return blank("UNAVAILABLE","out_of_order_or_cross_owner_refresh");
 if(!input||input.loading===true||input.error)return blank("UNAVAILABLE",input?.error?"refresh_failed":"incomplete_refresh");
 const assembled=assembleDashboard(input,context);
 if(assembled.status!=="ASSEMBLED_READ_ONLY")return blank("UNAVAILABLE","invalid_or_stale_refresh");
 return Object.freeze({...assembled,requestId,ownerId:context.ownerId,loadedAt:context.now});
}
function refreshFailure(previous,requestId,context){
 if(!validContext(context)||!validId(requestId)||!previous||previous.status!=="LOADING"||previous.requestId!==requestId||previous.ownerId!==context.ownerId)return blank("UNAVAILABLE","out_of_order_or_cross_owner_refresh");
 return blank("UNAVAILABLE","refresh_failed");
}
function resetDashboard(){return blank("IDLE","not_loaded")}
module.exports=Object.freeze({startLoading,finishLoading,refreshFailure,resetDashboard});
