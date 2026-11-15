"use strict";
// Phase 13.13: strict request validation around the existing publishing HTTP handler.
// Deployment must still enforce HTTPS, rate limits, CORS and CSRF policy.
// Origin checking here is defense in depth, not a substitute for authentication.
const {createPublishLinkHttpHandler}=require("../phase1312/publishLinkHttpHandler");
const slugPattern=/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const baseHeaders={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const fail=(status,label)=>({status,headers:{...baseHeaders},body:{status:label}});
function header(headers,name){
 if(!headers)return null;
 if(typeof headers.get==="function")return headers.get(name);
 const key=Object.keys(headers).find(k=>k.toLowerCase()===name);
 return key?headers[key]:null;
}
function createValidatedPublishEndpoint(db,auth,{allowedOrigins}={}){
 if(!Array.isArray(allowedOrigins)||allowedOrigins.length===0||allowedOrigins.some(o=>typeof o!=="string"||!/^https:\/\/[^/]+$/.test(o)))
  throw new TypeError("explicit HTTPS origin allowlist required");
 const origins=new Set(allowedOrigins);
 const handler=createPublishLinkHttpHandler(db,auth);
 return async function handle(request){
  if(!request||request.method!=="POST")return fail(405,"METHOD_NOT_ALLOWED");
  const origin=header(request.headers,"origin");
  if(typeof origin!=="string"||!origins.has(origin))return fail(403,"ORIGIN_FORBIDDEN");
  const contentType=header(request.headers,"content-type");
  if(typeof contentType!=="string"||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType))return fail(415,"UNSUPPORTED_MEDIA_TYPE");
  const body=request.body;
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).length!==1||!Object.prototype.hasOwnProperty.call(body,"slug")||typeof body.slug!=="string"||!slugPattern.test(body.slug))
   return fail(400,"INVALID_REQUEST");
  return handler({method:"POST",headers:request.headers,body:{slug:body.slug}});
 };
}
module.exports=Object.freeze({createValidatedPublishEndpoint});
