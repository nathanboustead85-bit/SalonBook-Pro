(function(root,factory){"use strict";const api=factory(typeof module!=="undefined"&&module.exports?require("../phase136/trustedSlugResolver"):root.BoustioPhase136SlugResolver,typeof module!=="undefined"&&module.exports?require("./bookingExperience"):root.BoustioPhase28BookingExperience);if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.BoustioPhase282StagingCatalogue=api;})(typeof window!=="undefined"?window:this,function(resolver,booking){"use strict";
// Read-only integration boundary. The host supplies trusted server-verified slug lookup
// and authorized publicBusinesses document getter. This module does NOT initialize Firebase.
const fail=reason=>Object.freeze({status:"UNAVAILABLE",reason,bookingEnabled:false});
async function loadStagingBookingPage(slug,lookup,getPublicBusiness){
 if(typeof lookup!=="function"||typeof getPublicBusiness!=="function")return fail("staging_reader_not_configured");
 if(booking.getRequestedSlug("?business="+encodeURIComponent(slug))!==slug)return fail("invalid_slug");
 try{
  const result=await resolver.loadResolvedBusiness(slug,lookup,getPublicBusiness);
  if(result.status!=="PUBLIC_CATALOGUE_READY")return fail(result.reason||"public_catalogue_unavailable");
  // The display adapter intentionally strips private fields, but cannot be fed back
  // to the booking contract. Obtain the public snapshot once more through the same
  // trusted mapping and validate the complete public schema at the final boundary.
  const businessId=await resolver.createTrustedSlugResolver(lookup)(slug);
  if(!businessId)return fail("unresolved_slug");
  const snapshot=await getPublicBusiness("publicBusinesses",businessId);
  if(!snapshot||typeof snapshot.exists!=="function"||!snapshot.exists()||typeof snapshot.data!=="function")return fail("public_catalogue_unavailable");
  const data=snapshot.data();
  if(!data||data.published!==true||data.slug!==slug)return fail("public_catalogue_unavailable");
  // Explicit allowlist prevents private owner/client fields crossing into UI.
  const payload={schemaVersion:data.schemaVersion,slug:data.slug,published:data.published,businessName:data.businessName,
   services:Array.isArray(data.services)?data.services.map(s=>({id:s&&s.id,name:s&&s.name,pricePence:s&&s.pricePence,durationMinutes:s&&s.durationMinutes,published:s&&s.published})):null,
   staff:Array.isArray(data.staff)?data.staff.map(s=>({id:s&&s.id,name:s&&s.name,active:s&&s.active,serviceIds:s&&s.serviceIds})):null};
  return booking.prepareBookingPage(payload,slug);
 }catch{return fail("staging_public_read_failed");}
}
return Object.freeze({loadStagingBookingPage});
});
