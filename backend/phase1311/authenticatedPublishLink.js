"use strict";
// Phase 13.11: server-side Firebase ID token verification boundary.
// The Firebase Admin Auth instance is injected by trusted server initialization.
// Never trust client-provided uid, emailVerified or businessId fields.
const {createAuthorizedPublishMapping}=require("../phase1310/authorizedPublishMapping");
const uidPattern=/^[A-Za-z0-9_-]{1,128}$/;
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
function createAuthenticatedPublishLink(db,adminAuth){
 if(!adminAuth||typeof adminAuth.verifyIdToken!=="function")throw new TypeError("Firebase Admin Auth required");
 const register=createAuthorizedPublishMapping(db);
 return async function publishLink(request){
  if(!request||request.method!=="POST")return {status:"METHOD_NOT_ALLOWED"};
  const headers=request.headers||{};
  const authorization=typeof headers.get==="function"?headers.get("authorization"):headers.authorization;
  if(typeof authorization!=="string"||!/^Bearer [A-Za-z0-9._~-]{20,4096}$/.test(authorization))return {status:"UNAUTHORIZED"};
  const slug=request.body&&request.body.slug;
  if(typeof slug!=="string"||!slugPattern.test(slug))return {status:"INVALID_SLUG"};
  let token;
  try{token=await adminAuth.verifyIdToken(authorization.slice(7),true);}
  catch{return {status:"UNAUTHORIZED"};}
  if(!token||token.email_verified!==true||typeof token.uid!=="string"||!uidPattern.test(token.uid))
   return {status:"UNAUTHORIZED"};
  // Never forward request.body.businessId or request.body.identity.
  return register({identity:{uid:token.uid,emailVerified:true},slug});
 };
}
module.exports=Object.freeze({createAuthenticatedPublishLink});
