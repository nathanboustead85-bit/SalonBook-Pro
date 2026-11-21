"use strict";
// Phase 31.2: pure, fail-closed mapping of EXISTING published catalogue v1.
// No reads from Firestore; the caller must supply an already-authorized public payload.
const {prepareCatalogue}=require("../phase1280/catalogueContract");
const {adaptPublicBusiness}=require("../phase1239/catalogueAdapter");
const deny=reason=>Object.freeze({status:"NOT_AVAILABLE",reason,bookingEnabled:false,profile:null});
function mapPublishedBusiness(profileDoc,catalogueDoc,expectedSlug){
 const profile=adaptPublicBusiness(profileDoc,expectedSlug);
 if(profile.status!=="PROFILE_ONLY")return deny("unavailable_public_profile");
 if(!catalogueDoc||catalogueDoc.businessId!==profile.businessId||
 catalogueDoc.businessName!==profile.businessName||
 catalogueDoc.acceptingBookings!==false)return deny("catalogue_profile_mismatch");
 const catalogue=prepareCatalogue(catalogueDoc,expectedSlug);
 if(catalogue.status!=="CATALOGUE_DISPLAY_READY")return deny("invalid_or_unpublished_catalogue");
 const result=catalogue.profile;
 // Explicit allowlist: private owner, customer, appointment and contact fields cannot escape.
 const services=Object.freeze(result.services.map(s=>Object.freeze({
  id:s.id,name:s.name,pricePence:s.pricePence,durationMinutes:s.durationMinutes
 })));
 const staff=Object.freeze(result.staff.map(s=>Object.freeze({
  id:s.id,name:s.name,serviceIds:Object.freeze([...s.serviceIds])
 })));
 return Object.freeze({status:"READ_ONLY_DISPLAY",bookingEnabled:false,source:"authorized_published_catalogue_v1",
  businessId:profile.businessId,slug:expectedSlug,
  profile:Object.freeze({name:profile.businessName,category:profile.category}),
  services,staff,availabilityStatus:"NOT_CONNECTED"});
}
module.exports=Object.freeze({mapPublishedBusiness});
