"use strict";
// Phase 13.12: framework-independent HTTP adapter for authenticated link registration.
// Deployment must supply Firebase Admin Auth/Firestore, HTTPS, CSRF/origin controls
// and rate limiting. This does not publish a business document or deploy an endpoint.
const {createAuthenticatedPublishLink}=require("../phase1311/authenticatedPublishLink");
const code={MAPPED:200,ALREADY_MAPPED:200,NOT_PUBLISHED:409,SLUG_TAKEN:409,INVALID_SLUG:400,UNAUTHORIZED:401,METHOD_NOT_ALLOWED:405};
function createPublishLinkHttpHandler(db,auth){
 const register=createAuthenticatedPublishLink(db,auth);
 return async function handle(request){
  const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
  let result;
  try{
   if(!request||request.method!=="POST")result={status:"METHOD_NOT_ALLOWED"};
   else if(request.body===null||typeof request.body!=="object"||Array.isArray(request.body))result={status:"INVALID_SLUG"};
   else result=await register(request);
  }catch{result={status:"SERVER_UNAVAILABLE"};}
  const status=code[result.status]||503;
  // Only expose a fixed public status, never Firestore errors or token details.
  return {status,headers,body:{status:result.status}};
 };
}
module.exports=Object.freeze({createPublishLinkHttpHandler});
