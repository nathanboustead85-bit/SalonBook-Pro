(function(root,factory){
"use strict";
const api=factory();
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPhase131PublicProfile=api;
})(typeof window!=="undefined"?window:this,function(){
"use strict";
// Phase 13.1: read-only boundary for an authorized public catalogue response.
// This does not query Firestore, accept owner/private data or enable bookings.
const {preparePublicView}=typeof module!=="undefined"&&module.exports
 ?require("../phase1281/cataloguePresentation")
 :{preparePublicView:window.BoustioCataloguePresentation.preparePublicView};
const rejected=(reason)=>Object.freeze({status:"PUBLIC_PROFILE_UNAVAILABLE",bookingEnabled:false,reason,profile:null});
function prepareBusinessProfile(publicPayload,requestedSlug){
 const result=preparePublicView(publicPayload,requestedSlug);
 if(result.status!=="PUBLIC_VIEW_READY")return rejected(result.reason||"invalid_public_catalogue");
 const view=result.view;
 if(!view.services.length||!view.staff.some(person=>person.serviceIds.length))return rejected("no_public_bookable_services");
 return Object.freeze({
  status:"PUBLIC_PROFILE_DISPLAY_READY",bookingEnabled:false,
  profile:Object.freeze({
   businessName:view.businessName,slug:view.slug,
   services:view.services,staff:view.staff,
   notice:"Public catalogue preview only. Live booking is not enabled."
  })
 });
}
return Object.freeze({prepareBusinessProfile});
});
