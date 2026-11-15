(function(root,factory){
"use strict";
const api=factory(typeof module!=="undefined"&&module.exports?require("../phase133/publicCatalogueLoader"):root.BoustioPhase133PublicCatalogueLoader);
if(typeof module!=="undefined"&&module.exports)module.exports=api;
else root.BoustioPhase134FirebaseBridge=api;
})(typeof window!=="undefined"?window:this,function(loader){
"use strict";
// Phase 13.4: Firebase-facing read-only adapter. The caller must provide an
// independently authorized PUBLIC document reader. No collection path is assumed;
// production Firestore rules and actual published schema require verification.
function createPublicFirestoreLoader(readPublicDocument){
 if(typeof readPublicDocument!=="function")throw new TypeError("authorized public document reader required");
 return async function(slug){
  if(loader.requestedSlug("?business="+encodeURIComponent(slug))!==slug)throw new Error("invalid business slug");
  const snapshot=await readPublicDocument(slug);
  if(!snapshot||typeof snapshot.exists!=="function"||!snapshot.exists())return null;
  if(typeof snapshot.data!=="function")return null;
  const data=snapshot.data();
  if(!data||typeof data!=="object"||Array.isArray(data))return null;
  // Explicit public fields only; never forward arbitrary snapshot properties.
  return {
   schemaVersion:data.schemaVersion,slug:data.slug,published:data.published,
   businessName:data.businessName,
   services:Array.isArray(data.services)?data.services.map(s=>({
    id:s&&s.id,name:s&&s.name,pricePence:s&&s.pricePence,
    durationMinutes:s&&s.durationMinutes,published:s&&s.published
   })):null,
   staff:Array.isArray(data.staff)?data.staff.map(s=>({
    id:s&&s.id,name:s&&s.name,active:s&&s.active,
    serviceIds:s&&s.serviceIds
   })):null
  };
 };
}
async function loadFirebasePublicCatalogue(slug,readPublicDocument){
 if(typeof readPublicDocument!=="function")return loader.loadPublishedBusiness(slug,null);
 return loader.loadPublishedBusiness(slug,createPublicFirestoreLoader(readPublicDocument));
}
return Object.freeze({createPublicFirestoreLoader,loadFirebasePublicCatalogue});
});
