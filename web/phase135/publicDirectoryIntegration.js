(function(root,factory){
"use strict";
const api=factory(typeof module!=="undefined"&&module.exports?require("../phase134/firebasePublicCatalogueBridge"):root.BoustioPhase134FirebaseBridge);
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPhase135PublicDirectory=api;
})(typeof window!=="undefined"?window:this,function(bridge){
"use strict";
// Verified against repository firestore.rules: publicBusinesses/{businessId}
// permits get only when published, denies list and all client writes.
// A booking slug is NOT necessarily a businessId. Require a trusted mapping.
// No Firestore SDK is initialized here, and no owner/private collection is read.
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
function createDirectoryReader(resolvePublicBusinessId,getPublicBusiness){
 if(typeof resolvePublicBusinessId!=="function"||typeof getPublicBusiness!=="function")throw new TypeError("trusted resolver and public get required");
 return async function(slug){
  if(typeof slug!=="string"||!slugPattern.test(slug))throw new Error("invalid slug");
  const businessId=await resolvePublicBusinessId(slug);
  if(typeof businessId!=="string"||!idPattern.test(businessId))return null;
  // Only the explicitly approved publicBusinesses document is eligible.
  const snapshot=await getPublicBusiness("publicBusinesses",businessId);
  if(!snapshot||typeof snapshot.exists!=="function"||!snapshot.exists())return null;
  const data=typeof snapshot.data==="function"?snapshot.data():null;
  if(!data||data.published!==true||data.slug!==slug)return null;
  return snapshot;
 };
}
async function loadPublicDirectoryProfile(slug,resolvePublicBusinessId,getPublicBusiness){
 if(typeof resolvePublicBusinessId!=="function"||typeof getPublicBusiness!=="function")
  return bridge.loadFirebasePublicCatalogue(slug,null);
 return bridge.loadFirebasePublicCatalogue(slug,createDirectoryReader(resolvePublicBusinessId,getPublicBusiness));
}
return Object.freeze({createDirectoryReader,loadPublicDirectoryProfile,publicCollection:"publicBusinesses",requiresTrustedSlugResolution:true});
});
