"use strict";
/**
 * Phase 17: server-side Google OIDC verification adapter.
 * PREPARATION ONLY. This module has no network activity until its exported
 * factory is invoked by a future, separately approved server deployment.
 * Never use decode-only JWT helpers or accept client-supplied audience values.
 */
const {OAuth2Client}=require("google-auth-library");
function createGoogleServiceTokenVerifier({expectedAudience,client}={}){
 if(typeof expectedAudience!=="string"||
    !/^https:\/\/[a-z0-9.-]+(?:\/[a-zA-Z0-9/_-]*)?$/.test(expectedAudience))
  throw Error("INVALID_CONFIGURED_AUDIENCE");
 const verifier=client||new OAuth2Client();
 if(typeof verifier.verifyIdToken!=="function")throw Error("INVALID_GOOGLE_VERIFIER");
 return async (idToken,requestedAudience)=>{
  if(requestedAudience!==expectedAudience)throw Error("AUDIENCE_CONFIGURATION_MISMATCH");
  if(typeof idToken!=="string"||idToken.length<10||idToken.length>8192)
   throw Error("INVALID_SERVICE_TOKEN");
  // Google library verifies JWT signature, expiry and requested audience.
  // The downstream service boundary additionally checks issuer, caller email,
  // verified email and subject.
  const ticket=await verifier.verifyIdToken({idToken,audience:expectedAudience});
  const claims=ticket&&ticket.getPayload&&ticket.getPayload();
  if(!claims||typeof claims!=="object")throw Error("MISSING_VERIFIED_TOKEN_PAYLOAD");
  return claims;
 };
}
module.exports=Object.freeze({createGoogleServiceTokenVerifier});
