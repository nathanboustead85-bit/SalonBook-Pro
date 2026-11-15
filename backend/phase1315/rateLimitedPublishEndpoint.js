"use strict";
// Phase 13.15: fail-closed rate-limit boundary.
// In production supply a shared, atomic limiter (Redis/managed gateway) and
// a trusted key derived by the server, NEVER from X-Forwarded-For sent by clients.
// consume(key) resolves to {allowed:boolean,retryAfterSeconds?:number}.
const {createBoundedPublishEndpoint}=require("../phase1314/boundedPublishEndpoint");
const baseHeaders={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
function fail(status,label,retry){
 const headers={...baseHeaders};
 if(Number.isSafeInteger(retry)&&retry>0)headers["retry-after"]=String(Math.min(retry,3600));
 return {status,headers,body:{status:label}};
}
function createRateLimitedPublishEndpoint(db,auth,options,{limiter}={}){
 if(!limiter||typeof limiter.consume!=="function")throw new TypeError("shared atomic limiter required");
 const bounded=createBoundedPublishEndpoint(db,auth,options);
 return async function handle(request,context){
  if(!request||request.method!=="POST")return fail(405,"METHOD_NOT_ALLOWED");
  // The key is supplied only by trusted server middleware; do not use body or headers.
  const key=context&&context.trustedRateLimitKey;
  if(typeof key!=="string"||key.length<1||key.length>200)return fail(503,"RATE_LIMIT_UNAVAILABLE");
  let decision;
  try{decision=await limiter.consume("publish-link:"+key);}
  catch{return fail(503,"RATE_LIMIT_UNAVAILABLE");}
  if(!decision||typeof decision.allowed!=="boolean")return fail(503,"RATE_LIMIT_UNAVAILABLE");
  if(!decision.allowed)return fail(429,"RATE_LIMITED",decision.retryAfterSeconds);
  return bounded(request);
 };
}
module.exports=Object.freeze({createRateLimitedPublishEndpoint});
