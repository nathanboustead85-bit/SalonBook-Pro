"use strict";
// Phase 13.8: Firebase Admin Firestore adapter for the Phase 13.7 HTTP handler.
// Inject a server-only Admin Firestore instance; never bundle this into the website.
// publicSlugMappings/{slug} must be provisioned by a trusted backend process.
// No client writes, collection queries or scans. Default-deny Firestore rules protect mappings.
const {createSlugLookupHandler}=require("../phase137/publicSlugLookupHandler");
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
function createAdminFirestoreLookup(db){
 if(!db||typeof db.collection!=="function")throw new TypeError("Admin Firestore required");
 return async function lookup(slug){
  if(typeof slug!=="string"||!slugPattern.test(slug))return null;
  // Two exact document reads: a server-maintained slug index, then the
  // published public business record. Never trust a mapping alone.
  const mappingSnap=await db.collection("publicSlugMappings").doc(slug).get();
  if(!mappingSnap.exists)return null;
  const mapping=mappingSnap.data();
  if(!mapping||mapping.slug!==slug||mapping.published!==true||typeof mapping.businessId!=="string"||!idPattern.test(mapping.businessId))return null;
  const businessSnap=await db.collection("publicBusinesses").doc(mapping.businessId).get();
  if(!businessSnap.exists)return null;
  const business=businessSnap.data();
  if(!business||business.published!==true||business.slug!==slug)return null;
  return {slug,businessId:mapping.businessId,published:true};
 };
}
function createFirebaseSlugLookupHandler(db){
 return createSlugLookupHandler(createAdminFirestoreLookup(db));
}
module.exports=Object.freeze({createAdminFirestoreLookup,createFirebaseSlugLookupHandler});
