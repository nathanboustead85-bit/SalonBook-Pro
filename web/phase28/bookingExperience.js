(function(root,factory){"use strict";const api=factory(typeof module!=="undefined"&&module.exports?require("../phase131/publicBusinessProfile"):root.BoustioPhase131PublicProfile);if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BoustioPhase28BookingExperience=api;})(typeof window!=="undefined"?window:this,function(profiles){"use strict";
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function prepareBookingPage(publicCatalogue,requestedSlug){
 if(typeof requestedSlug!=="string"||requestedSlug.length>50||!SLUG.test(requestedSlug))return Object.freeze({status:"UNAVAILABLE",reason:"invalid_slug",bookingEnabled:false});
 const result=profiles.prepareBusinessProfile(publicCatalogue,requestedSlug);
 if(result.status!=="PUBLIC_PROFILE_DISPLAY_READY")return Object.freeze({status:"UNAVAILABLE",reason:result.reason,bookingEnabled:false});
 const p=result.profile;
 return Object.freeze({status:"PREVIEW_READY",bookingEnabled:false,businessName:p.businessName,slug:p.slug,services:p.services,staff:p.staff});
}
function getRequestedSlug(search){const value=new URLSearchParams(search).get("business");return typeof value==="string"&&SLUG.test(value)&&value.length<=50?value:null;}
return Object.freeze({prepareBookingPage,getRequestedSlug});
});
