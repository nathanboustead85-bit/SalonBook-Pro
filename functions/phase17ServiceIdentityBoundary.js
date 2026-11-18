"use strict";
/**
 * Phase 17 offline service-to-service authentication boundary.
 * Production must inject a trusted Google OIDC ID-token verifier configured
 * with the EXACT deployed Cloud Run audience; never trust decoded tokens,
 * caller-supplied identities, or request bodies as authentication.
 * NOT wired to an HTTP endpoint or deployment.
 */
const {applyPublicListingCommand}=require("./phase17PublicDatabaseWriter");
const {preparePublicListing}=require("./phase17PublicListingProjection");
const EXPECTED_CALLER="boustio-private-profile-reader@salonbook-pro-ad5ff.iam.gserviceaccount.com";
const ISSUERS=new Set(["https://accounts.google.com","accounts.google.com"]);
function bearer(header){
 if(typeof header!=="string"||!/^Bearer [A-Za-z0-9._~-]+$/.test(header))throw Error("MISSING_SERVICE_ID_TOKEN");
 return header.slice(7);
}
async function authenticateService({authorization,audience,verifyIdToken}){
 if(typeof audience!=="string"||!/^https:\/\/[a-z0-9.-]+(?:\/[a-zA-Z0-9/_-]*)?$/.test(audience)||
    typeof verifyIdToken!=="function")throw Error("INVALID_TRUSTED_VERIFIER");
 const token=bearer(authorization);
 // verifyIdToken MUST cryptographically verify signature, issuer and audience.
 const claims=await verifyIdToken(token,audience);
 if(!claims||!ISSUERS.has(claims.iss)||claims.aud!==audience||
    claims.email!==EXPECTED_CALLER||claims.email_verified!==true||
    typeof claims.sub!=="string"||!/^\d+$/.test(claims.sub)||
    !Number.isFinite(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))
  throw Error("UNAUTHORISED_SERVICE_IDENTITY");
 return {serviceAccount:EXPECTED_CALLER};
}
function validatedFence(command,fence){
 if(!fence||typeof fence!=="object"||Array.isArray(fence)||
  fence.key!==command.uid+":"+command.operation+":"+command.version||
  typeof fence.worker!=="string"||!/^[A-Za-z0-9_-]{1,128}$/.test(fence.worker)||
  !Number.isSafeInteger(fence.generation)||fence.generation<1)
  throw Error("INVALID_RECOVERY_FENCE");
 return Object.freeze({key:fence.key,worker:fence.worker,generation:fence.generation});
}
async function acceptTrustedPublication({authorization,audience,verifyIdToken,publicDb,command,fence,verifyRecoveryFence,requireFence=false}){
 await authenticateService({authorization,audience,verifyIdToken});
 if(!command||command.operation!=="publish"||typeof command.uid!=="string"||
    !Number.isSafeInteger(command.version)||command.version<1)
  throw Error("INVALID_PUBLICATION_COMMAND");
 // Re-project, rejecting extra fields. A verified service identity does not
 // make arbitrary payloads safe for public exposure.
 const listing=preparePublicListing(command.uid,command.profile);
 let options={};
 if(requireFence){
  if(typeof verifyRecoveryFence!=="function")throw Error("TRUSTED_FENCE_VERIFIER_REQUIRED");
  const trustedFence=validatedFence(command,fence);
  // Must verify from trusted server-side claim state, never a client assertion.
  if(await verifyRecoveryFence(trustedFence)!==true)throw Error("RECOVERY_FENCE_NOT_AUTHORISED");
  options={fence:trustedFence,requireFence:true};
 }
 return applyPublicListingCommand(publicDb,{
  uid:command.uid,version:command.version,operation:"publish",profile:listing
 },options);
}
module.exports=Object.freeze({EXPECTED_CALLER,authenticateService,acceptTrustedPublication});
