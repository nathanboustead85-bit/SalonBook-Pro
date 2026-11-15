"use strict";
// Phase 13.10: authenticated publish-flow integration boundary.
// Caller supplies a verified Firebase Auth identity from server middleware.
// Never accept a businessId from an untrusted request body: use the verified UID.
// This function is invoked only AFTER a trusted publishing operation has
// written a matching publicBusinesses/{uid} published document.
const {createSlugMappingProvisioner}=require("../phase139/provisionPublicSlugMapping");
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const idPattern=/^[A-Za-z0-9_-]{1,128}$/;
function createAuthorizedPublishMapping(db){
 const provision=createSlugMappingProvisioner(db);
 return async function registerPublishedLink(context){
  const identity=context&&context.identity;
  const slug=context&&context.slug;
  if(!identity||identity.emailVerified!==true||typeof identity.uid!=="string"||!idPattern.test(identity.uid))
   return {status:"UNAUTHORIZED"};
  if(typeof slug!=="string"||!slugPattern.test(slug))return {status:"INVALID_SLUG"};
  // The existing Phase 13.9 transaction verifies published state and exact
  // slug ownership in publicBusinesses before creating the slug mapping.
  return provision({slug,businessId:identity.uid});
 };
}
module.exports=Object.freeze({createAuthorizedPublishMapping});
