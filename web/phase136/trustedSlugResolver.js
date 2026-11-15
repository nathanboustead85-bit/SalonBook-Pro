(function(root,factory){
"use strict";
const api=factory(typeof module!=="undefined"&&module.exports?require("../phase135/publicDirectoryIntegration"):root.BoustioPhase135PublicDirectory);
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPhase136SlugResolver=api;
})(typeof window!=="undefined"?window:this,function(directory){
"use strict";
// Phase 13.6: trusted resolver contract for a future backend-issued slug mapping.
// Do NOT query publicBusinesses by slug: Firestore rules explicitly deny list.
// Do NOT derive businessId from slug, expose owner records, or use untrusted client mappings.
// The caller must supply a server-verified, single-slug resolution function.
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
function createTrustedSlugResolver(lookup){
 if(typeof lookup!=="function")throw new TypeError("trusted server lookup required");
 return async function(slug){
  if(typeof slug!=="string"||!slugPattern.test(slug))return null;
  const mapping=await lookup(slug);
  if(!mapping||typeof mapping!=="object"||Array.isArray(mapping))return null;
  if(mapping.slug!==slug||mapping.published!==true||typeof mapping.businessId!=="string"||!idPattern.test(mapping.businessId))return null;
  return mapping.businessId;
 };
}
async function loadResolvedBusiness(slug,lookup,getPublicBusiness){
 if(typeof lookup!=="function"||typeof getPublicBusiness!=="function")
  return directory.loadPublicDirectoryProfile(slug,null,null);
 return directory.loadPublicDirectoryProfile(slug,createTrustedSlugResolver(lookup),getPublicBusiness);
}
return Object.freeze({createTrustedSlugResolver,loadResolvedBusiness,requiresServerVerifiedMapping:true});
});
