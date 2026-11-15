"use strict";
// Phase 13.16: Firebase HTTPS-function wiring factory, deliberately NOT exported
// as a live endpoint until an atomic shared limiter and trusted client identity
// provider are configured. No implicit in-memory limiter or header-derived IP.
// Existing production publishBusiness callable remains unchanged.
const {createRateLimitedPublishEndpoint}=require("../phase1315/rateLimitedPublishEndpoint");
function createFirebasePublishFunction({onRequest,db,auth,limiter,clientKey,allowedOrigins,enabled=false}={}){
 if(enabled!==true)throw new Error("Publishing HTTP endpoint disabled until production review");
 if(typeof onRequest!=="function"||typeof clientKey!=="function")throw new TypeError("trusted Firebase adapter required");
 if(!limiter||typeof limiter.consume!=="function")throw new TypeError("shared atomic limiter required");
 const handle=createRateLimitedPublishEndpoint(db,auth,{allowedOrigins},{limiter});
 return onRequest({region:"europe-west2",maxInstances:10,invoker:"public",cors:false},async(req,res)=>{
  // HTTPS, trusted client identification, rate limits and origin controls are
  // deployment responsibilities; never use request headers as client identity.
  let response;
  try{
   const key=await clientKey(req);
   response=await handle({method:req.method,headers:req.headers,rawBody:req.rawBody},{trustedRateLimitKey:key});
  }catch{
   response={status:503,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"},body:{status:"SERVICE_UNAVAILABLE"}};
  }
  res.status(response.status);
  for(const [name,value] of Object.entries(response.headers))res.set(name,value);
  res.json(response.body);
 });
}
module.exports=Object.freeze({createFirebasePublishFunction});
